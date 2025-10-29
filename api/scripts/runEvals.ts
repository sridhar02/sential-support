import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { orchestrateTriage } from "../src/services/triage/orchestrator";
import { setSimulation } from "../src/services/triage/simulations";
import type { TriageEvent } from "../src/types/triage";

interface EvalCase {
  name: string;
  alertId: string;
  simulate?: Record<string, string>;
  expected: Record<string, unknown>;
}

async function loadCases(): Promise<EvalCase[]> {
  const dir = path.resolve(__dirname, "../../fixtures/evals");
  const files = await fs.readdir(dir);
  const cases: EvalCase[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await fs.readFile(path.join(dir, file), "utf8");
    cases.push(JSON.parse(content));
  }
  return cases;
}

async function runCase(testCase: EvalCase) {
  const run = await prisma.triageRun.create({
    data: {
      alertId: testCase.alertId,
      risk: "pending",
      reasons: [],
      fallbackUsed: false
    }
  });
  const events: TriageEvent[] = [];
  const started = Date.now();
  setSimulation(testCase.simulate as any);
  const result = await orchestrateTriage(testCase.alertId, run.id, (event) => {
    events.push(event);
  });
  setSimulation(undefined);
  const elapsed = Date.now() - started;
  const traces = await prisma.agentTrace.findMany({ where: { runId: run.id } });
  return { events, result, elapsed, traces };
}

async function main() {
  await prisma.$connect();
  const cases = await loadCases();

  let success = 0;
  let fallback = 0;
  const riskMatrix: Record<string, Record<string, number>> = {};
  const toolStats: Record<string, { total: number; failures: number }> = {};
  const latencies: number[] = [];
  const policyDenials: Record<string, number> = {};

  for (const testCase of cases) {
    const { result, events, elapsed, traces } = await runCase(testCase);
    const decision = result.decision;
    const risk = result.context.risk?.level ?? "unknown";
    latencies.push(elapsed);

    const expectation = testCase.expected;
    let passed = true;
    if (expectation.action && decision.action !== expectation.action) {
      passed = false;
    }
    if (expectation.reasonCode && (decision as any).reasonCode !== expectation.reasonCode) {
      passed = false;
    }
    if (expectation.fallback && !events.find((event) => event.type === "fallback_triggered")) {
      passed = false;
    }

    if (passed) {
      success += 1;
    }
    if (events.find((event) => event.type === "fallback_triggered")) {
      fallback += 1;
    }

    traces.forEach((trace) => {
      if (!toolStats[trace.step]) {
        toolStats[trace.step] = { total: 0, failures: 0 };
      }
      toolStats[trace.step].total += 1;
      if (!trace.ok) {
        toolStats[trace.step].failures += 1;
        const detail = trace.detail as Record<string, unknown>;
        const policy = typeof detail?.error === "string" && detail.error.includes("otp") ? "otp_required" : null;
        if (policy) {
          policyDenials[policy] = (policyDenials[policy] || 0) + 1;
        }
      }
    });

    if (expectation.risk) {
      const expectedRisk = String(expectation.risk);
      riskMatrix[expectedRisk] = riskMatrix[expectedRisk] || {};
      riskMatrix[expectedRisk][risk] = (riskMatrix[expectedRisk][risk] || 0) + 1;
    }

    console.log(`Case ${testCase.name}: ${passed ? "PASS" : "FAIL"}`);
    if (!passed) {
      console.log("  expected:", expectation);
      console.log("  received:", decision);
      console.log("  events:", events.map((event) => event.type));
    }
  }

  console.log("---");
  console.log(`Success rate: ${(success / cases.length * 100).toFixed(1)}% (${success}/${cases.length})`);
  console.log(`Fallbacks triggered: ${fallback}`);
  if (latencies.length) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1] ?? 0;
    console.log(`Agent latency p50: ${p50}ms, p95: ${p95}ms`);
  }

  console.log("Fallback rate by tool:");
  Object.entries(toolStats).forEach(([step, stats]) => {
    const rate = stats.total === 0 ? 0 : (stats.failures / stats.total) * 100;
    console.log(`  ${step}: ${rate.toFixed(1)}% (${stats.failures}/${stats.total})`);
  });

  console.log("Risk confusion matrix (expected -> actual):");
  Object.entries(riskMatrix).forEach(([expected, actuals]) => {
    const row = Object.entries(actuals)
      .map(([actual, count]) => `${actual}:${count}`)
      .join(", ");
    console.log(`  ${expected}: ${row}`);
  });

  if (Object.keys(policyDenials).length) {
    console.log("Top policy denials:");
    Object.entries(policyDenials).forEach(([policy, count]) => {
      console.log(`  ${policy}: ${count}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
