import { prisma } from "../../lib/prisma";
import { agentLatencyHistogram, fallbackCounter, toolCallCounter } from "../../lib/metrics";
import type { TriageEvent, TriageStep, RecommendedAction } from "../../types/triage";
import { logger } from "../../lib/logger";
import { maskObject } from "../../utils/redact";
import { sanitizeInput } from "../../utils/security";
import { z } from "zod";
import { consumeSimulation } from "./simulations";

const DEFAULT_PLAN: TriageStep[] = [
  "getProfile",
  "recentTx",
  "riskSignals",
  "kbLookup",
  "complianceCheck",
  "decide",
  "summarize"
];

const TOOL_TIMEOUT_MS = 1000;
const FLOW_BUDGET_MS = 5000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF = [150, 400];

type Context = {
  alertId: string;
  customerId: string;
  runId: string;
  traceSeq: number;
  profile?: {
    customer: any;
    suspectTxn?: any;
    alert: any;
  };
  transactions?: any[];
  risk?: { score: number; reasons: string[]; level: "low" | "medium" | "high" };
  kb?: { docId: string; title: string; anchor: string; extract: string }[];
  decision?: RecommendedAction;
  fallbackUsed?: boolean;
  compliance?: { requiresOtp: boolean; status: "PASS" | "OTP_REQUIRED" | "BYPASS" };
  summary?: { headline: string; fallbackUsed: boolean };
};

const riskSchema = z.object({
  score: z.number(),
  reasons: z.array(z.string()),
  level: z.enum(["low", "medium", "high"])
});

const kbSchema = z.array(
  z.object({
    docId: z.string(),
    title: z.string(),
    anchor: z.string(),
    extract: z.string()
  })
);

const complianceSchema = z.object({
  requiresOtp: z.boolean(),
  status: z.enum(["PASS", "OTP_REQUIRED", "BYPASS"])
});

const decisionSchema = z.object({
  action: z.string(),
  reason: z.string()
});

const summarySchema = z.object({
  headline: z.string(),
  fallbackUsed: z.boolean()
});

const circuitBreaker = new Map<TriageStep, { failures: number; openUntil: number }>();

async function withTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), TOOL_TIMEOUT_MS);
    })
  ]);
}

async function runTool<T>(
  ctx: Context,
  step: TriageStep,
  tool: () => Promise<T>,
  validator?: z.ZodTypeAny
): Promise<T> {
  const state = circuitBreaker.get(step);
  if (state && state.openUntil > Date.now()) {
    throw new Error("circuit_open");
  }
  if (state && state.openUntil <= Date.now()) {
    circuitBreaker.set(step, { failures: 0, openUntil: 0 });
  }
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const timer = agentLatencyHistogram.startTimer({ step });
    const start = Date.now();
    try {
      const simulated = consumeSimulation(step);
      if (simulated === "timeout") {
        throw new Error("simulated_timeout");
      }
      const result = await withTimeout(tool);
      if (validator) {
        validator.parse(result);
      }
      toolCallCounter.inc({ tool: step, ok: "true" });
      const sanitized = maskObject(result);
      await prisma.agentTrace.create({
        data: {
          runId: ctx.runId!,
          seq: ctx.traceSeq++,
          step,
          ok: true,
          durationMs: Date.now() - start,
          detail: sanitized as any
        }
      });
      circuitBreaker.set(step, { failures: 0, openUntil: 0 });
      timer();
      return result;
    } catch (err) {
      attempt += 1;
      timer();
      toolCallCounter.inc({ tool: step, ok: "false" });
      const message = (err as Error).message;
      const simulated = message === "simulated_timeout";
      logger.warn({
        event: "tool_invoked",
        step,
        ok: false,
        error: message,
        masked: true
      });
      await prisma.agentTrace.create({
        data: {
          runId: ctx.runId!,
          seq: ctx.traceSeq++,
          step,
          ok: false,
          durationMs: Date.now() - start,
          detail: { error: message } as any
        }
      });
      if (attempt > MAX_RETRIES) {
        fallbackCounter.inc({ tool: step });
        ctx.fallbackUsed = true;
        if (!simulated) {
          const prev = circuitBreaker.get(step) ?? { failures: 0, openUntil: 0 };
          const failures = prev.failures + 1;
          circuitBreaker.set(step, {
            failures,
            openUntil: failures >= 3 ? Date.now() + 30000 : 0
          });
        }
        throw err;
      }
      if (!simulated) {
        const prev = circuitBreaker.get(step) ?? { failures: 0, openUntil: 0 };
        circuitBreaker.set(step, {
          failures: prev.failures + 1,
          openUntil: 0
        });
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF[attempt - 1]));
    }
  }
  throw new Error("tool_failed");
}

async function getProfile(ctx: Context) {
  const alert = await prisma.alert.findUniqueOrThrow({
    where: { id: ctx.alertId },
    include: {
      customer: true,
      suspectTxn: true
    }
  });
  ctx.customerId = alert.customerId;
  ctx.profile = {
    customer: sanitizeInput(alert.customer),
    suspectTxn: sanitizeInput(alert.suspectTxn),
    alert: sanitizeInput({ risk: alert.risk, status: alert.status })
  };
  return ctx.profile;
}

async function recentTransactions(ctx: Context) {
  const transactions = await prisma.transaction.findMany({
    where: { customerId: ctx.customerId },
    orderBy: { ts: "desc" },
    take: 50
  });
  ctx.transactions = transactions;
  return transactions;
}

async function riskSignals(ctx: Context) {
  const txs = ctx.transactions || [];
  const highAmount = txs.filter((t) => Math.abs(t.amountCents) > 50000).length;
  const differentCountry = new Set(txs.map((t) => t.country)).size > 1;
  const chargebacks = await prisma.chargeback.count({
    where: { customerId: ctx.customerId }
  });

  const score = highAmount * 20 + (differentCountry ? 15 : 0) + chargebacks * 30;
  const reasons: string[] = [];
  if (highAmount > 0) reasons.push("high_amount_activity");
  if (differentCountry) reasons.push("location_change");
  if (chargebacks > 0) reasons.push("prior_chargebacks");

  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  ctx.risk = { score, reasons, level };
  return ctx.risk;
}

async function kbLookup(ctx: Context) {
  const orFilters = ctx.risk?.reasons?.map((reason) => ({ content: { contains: reason } }));
  const docs = await prisma.kbDoc.findMany({
    where: orFilters && orFilters.length ? { OR: orFilters } : undefined,
    take: 3
  });
  ctx.kb = docs.map((doc: { id: string; title: string; anchor: string; content: string }) => ({
    docId: doc.id,
    title: doc.title,
    anchor: doc.anchor,
    extract: doc.content.slice(0, 140)
  }));
  return ctx.kb;
}

async function complianceCheck(ctx: Context) {
  const alertRisk = String(ctx.profile?.alert?.risk ?? "LOW").toUpperCase();
  const requiresOtp = ctx.risk?.level === "high" || alertRisk === "HIGH";
  const status: "PASS" | "OTP_REQUIRED" | "BYPASS" = requiresOtp ? "OTP_REQUIRED" : "PASS";
  ctx.compliance = { requiresOtp, status };
  return ctx.compliance;
}

async function decide(ctx: Context): Promise<RecommendedAction> {
  const suspect = ctx.profile?.suspectTxn;
  if (!suspect) {
    ctx.decision = {
      action: "mark_false_positive",
      reason: "no_suspect_transaction"
    };
    return ctx.decision;
  }

  const alertRisk = String(ctx.profile?.alert?.risk ?? "LOW").toUpperCase();
  const transactions = ctx.transactions || [];

  const existingCase = await prisma.case.findFirst({
    where: {
      txnId: suspect.id,
      status: { in: ["OPEN", "PENDING", "FROZEN"] }
    }
  });

  if (existingCase) {
    ctx.decision = {
      action: "mark_false_positive",
      reason: "case_already_open",
      note: `Existing case ${existingCase.id}`
    } as RecommendedAction;
    return ctx.decision;
  }

  const priorRuns = await prisma.triageRun.count({
    where: {
      alertId: ctx.alertId,
      NOT: { id: ctx.runId }
    }
  });

  if (priorRuns > 0 && alertRisk !== "HIGH") {
    ctx.decision = {
      action: "mark_false_positive",
      reason: "repeat_alert",
      note: `Prior triage runs: ${priorRuns}`
    };
    return ctx.decision;
  }

  const duplicateAuth = transactions.find((txn) => {
    if (txn.id === suspect.id) return false;
    if (txn.merchant !== suspect.merchant) return false;
    const timeDelta = Math.abs(new Date(txn.ts).getTime() - new Date(suspect.ts).getTime());
    if (timeDelta > 1000 * 60 * 60 * 24 * 2) return false;
    const amountDelta = Math.abs(Math.abs(txn.amountCents) - Math.abs(suspect.amountCents));
    if (amountDelta > Math.abs(suspect.amountCents) * 0.2 + 500) return false;
    return Math.sign(txn.amountCents) !== Math.sign(suspect.amountCents);
  });

  if (duplicateAuth) {
    if (ctx.risk) {
      ctx.risk.level = "low";
      ctx.risk.reasons.push("duplicate_pending_capture");
    }
    ctx.decision = {
      action: "contact_customer",
      reason: "duplicate_pending_capture",
      note: "Matched pending vs captured pair"
    } as RecommendedAction;
    return ctx.decision;
  }

  if (alertRisk === "LOW") {
    ctx.decision = {
      action: "contact_customer",
      reason: "low_alert_review"
    };
    return ctx.decision;
  }

  if (alertRisk === "HIGH" || ctx.risk?.level === "high") {
    ctx.decision = {
      action: "freeze_card",
      reason: "high_risk_detected",
      otpRequired: true,
      note: alertRisk === "HIGH" ? "Alert flagged high risk" : undefined
    };
    return ctx.decision;
  }

  if (alertRisk === "MEDIUM") {
    ctx.decision = {
      action: "open_dispute",
      reason: "pattern_match_dispute",
      reasonCode: "10.4",
      note: "Medium risk alert recommends dispute"
    };
    return ctx.decision;
  }

  const duplicates = (ctx.transactions || []).filter(
    (txn) =>
      txn.id !== suspect.id &&
      txn.merchant === suspect.merchant &&
      Math.abs(txn.amountCents) === Math.abs(suspect.amountCents) &&
      Math.abs(new Date(txn.ts).getTime() - new Date(suspect.ts).getTime()) < 1000 * 60 * 60 * 24
  );

  if (duplicates.length) {
    ctx.decision = {
      action: "contact_customer",
      reason: "detected_duplicate_pending_capture",
      note: "Likely pending vs captured pair"
    } as RecommendedAction;
    if (ctx.risk) {
      ctx.risk.level = "low";
      ctx.risk.reasons.push("duplicate_pending_capture");
    }
    return ctx.decision;
  }

  if ((ctx.risk?.level ?? "low") === "medium") {
    ctx.decision = {
      action: "contact_customer",
      reason: "manual_followup"
    };
    return ctx.decision;
  }

  ctx.decision = {
    action: "mark_false_positive",
    reason: "low_risk_alert"
  };
  return ctx.decision;
}

async function summarize(ctx: Context) {
  const action = ctx.decision?.action ?? "contact_customer";
  const headline = `Plan: ${action.replace(/_/g, " ")}`;
  ctx.summary = {
    headline,
    fallbackUsed: Boolean(ctx.fallbackUsed)
  };
  return ctx.summary;
}

export async function orchestrateTriage(
  alertId: string,
  runId: string,
  emit: (event: TriageEvent) => void
): Promise<{ runId: string; decision: RecommendedAction; context: Context }> {
  const startTime = Date.now();
  const ctx: Context = { alertId, customerId: "", traceSeq: 0, runId };

  emit({ type: "plan_built", detail: DEFAULT_PLAN });

  const plan = DEFAULT_PLAN;

  try {
    for (const step of plan) {
      if (Date.now() - startTime > FLOW_BUDGET_MS) {
        ctx.fallbackUsed = true;
        emit({ type: "fallback_triggered", detail: "flow_budget_exceeded" });
        break;
      }
      const handler = async () => {
        switch (step) {
          case "getProfile":
            return await getProfile(ctx);
          case "recentTx":
            return await recentTransactions(ctx);
          case "riskSignals":
            return await riskSignals(ctx);
          case "kbLookup":
            return await kbLookup(ctx);
          case "complianceCheck":
            return await complianceCheck(ctx);
          case "decide":
            return await decide(ctx);
          case "summarize":
            return await summarize(ctx);
          default:
            throw new Error(`unknown step ${step}`);
        }
      };

      const schema =
        step === "riskSignals"
          ? riskSchema
          : step === "kbLookup"
          ? kbSchema
          : step === "complianceCheck"
          ? complianceSchema
          : step === "decide"
          ? decisionSchema
          : step === "summarize"
          ? summarySchema
          : undefined;
      const result = await runTool(ctx, step, handler, schema);
      emit({ type: "tool_update", step, ok: true, detail: maskObject(result) });
    }
  } catch (err) {
    emit({ type: "fallback_triggered", detail: (err as Error).message });
    ctx.fallbackUsed = true;
  }

  const elapsed = Date.now() - startTime;
  const decision = ctx.decision ?? ({
    action: "contact_customer",
    reason: "fallback"
  } as RecommendedAction);

  emit({ type: "decision_finalized", detail: decision });

  await prisma.triageRun.update({
    where: { id: runId },
    data: {
      endedAt: new Date(),
      risk: ctx.risk?.level ?? "unknown",
      reasons: ctx.risk?.reasons ?? [],
      fallbackUsed: ctx.fallbackUsed ?? false,
      latencyMs: elapsed
    }
  });

  return { runId, decision, context: ctx };
}
