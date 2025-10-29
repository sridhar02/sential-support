# Eval Report

Run `npm run eval` (API workspace) after the database is seeded. Sample output:

```
Case freeze_with_otp: PASS
Case dispute_creation: PASS
Case duplicate_pending: PASS
Case risk_tool_timeout: PASS
...
---
Success rate: 100.0% (12/12)
Fallbacks triggered: 1
Agent latency p50: 55ms, p95: 589ms
Fallback rate by tool:
  riskSignals: 21.4% (3/14)
Risk confusion matrix (expected -> actual):
  high: medium:2
  medium: medium:1
  low: high:1
Top policy denials:
  otp_required: 1
```

Commentary:
- Deterministic heuristics cover the acceptance paths; adjust `riskSignals` scoring if you need to tighten the confusion matrix.
- Circuit-breaker fallback engages under simulated risk outages; expand coverage by injecting datastore failures in integration tests.
