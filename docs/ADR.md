# Architectural Decisions

1. **Workspace Monorepo** – Root npm workspaces host `api` and `web` to share linting/formatting presets and align build tooling.
2. **Prisma ORM + PostgreSQL** – Prisma schema maps 1:1 with required entities and provides type-safe keyset pagination with `createMany` bulk ingestion.
3. **Express Server** – Chosen over Fastify for familiar middleware ecosystem while still meeting performance targets behind Redis cache.
4. **Redis Token Bucket** – Simple Lua script enforces 5 r/s per client and keeps rate-limit logic centralized for both API and triage triggers.
5. **SSE Streaming** – Server-Sent Events deliver unidirectional planner updates without WebSocket brokers; reconnection falls back to idempotent triage runs.
6. **Deterministic Multi-Agent Rules** – Insights/Fraud/Compliance steps rely on rule heuristics (amount thresholds, geo change, prior chargebacks) to work offline with fallback summaries.
7. **Structured JSON Logging** – Pino logger enriches every audit/triage event with `masked=true` and leverages a redactor to scrub PAN-like numbers.
8. **React + CSS Modules** – Vite-powered SPA keeps footprint light while `react-window` virtualizes large tables to satisfy ≥2k-row requirement.
9. **Eval CLI via Orchestrator** – `npm run eval` reuses server orchestration against fixtures to produce success/fallback metrics for regression checks.
10. **Docker Compose Baseline** – Single compose file orchestrates Postgres, Redis, API, and Web containers for parity between local dev and demo recordings.
