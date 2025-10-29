import client from "prom-client";

export const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const apiLatencyHistogram = new client.Histogram({
  name: "api_request_latency_ms",
  help: "API request latency in milliseconds",
  labelNames: ["route", "method"],
  registers: [register],
  buckets: [50, 100, 200, 400, 800, 1600]
});

export const agentLatencyHistogram = new client.Histogram({
  name: "agent_latency_ms",
  help: "Latency of agent orchestration",
  labelNames: ["step"],
  registers: [register],
  buckets: [50, 100, 200, 500, 1000, 2000, 5000]
});

export const toolCallCounter = new client.Counter({
  name: "tool_call_total",
  help: "Tool call outcome",
  labelNames: ["tool", "ok"],
  registers: [register]
});

export const fallbackCounter = new client.Counter({
  name: "agent_fallback_total",
  help: "Fallback invocations",
  labelNames: ["tool"],
  registers: [register]
});

export const rateLimitCounter = new client.Counter({
  name: "rate_limit_block_total",
  help: "Number of rate limit blocks",
  registers: [register]
});

export const policyBlockCounter = new client.Counter({
  name: "action_blocked_total",
  help: "Actions blocked by policy",
  labelNames: ["policy"],
  registers: [register]
});
