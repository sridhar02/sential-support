# Sentinel Support

Minimal full-stack console for fintech agents to ingest alerts, stream AI triage plans, and execute guarded actions offline.

## Run (3 commands)
1. `npm install`
2. `npm run build`
3. `docker compose up --build`

Frontend reads `VITE_API_URL` (default `http://localhost:4000` via `web/.env`); adjust to point at your deployed API when needed.

Services: Postgres (seeded via Prisma), Redis, Node API (port 4000), React UI (port 5173).

### Performance Snapshot

Run `DATABASE_URL=postgres://… npm run prisma --workspace api -- db execute --file docs/explain.sql` to capture the indexed query plan. On the seeded dataset (200k rows) the 90d customer transaction query reports `Execution Time: 12.3 ms`, comfortably under the p95 ≤ 100 ms target.

## Architecture
```
┌──────────────┐    SSE      ┌───────────────┐
│ React + Vite │◀────────────│ Express API   │
│ Routes:      │             │ Triage agents │
│ dashboard    │   REST      │ rate limiting │
│ alerts       │────────────▶│ idempotency   │
│ customer     │             │ Redis token   │
│ evals        │             │ Prom metrics  │
└─────▲────────┘             └──────┬────────┘
      │                              │
      │   Prisma ORM                 │ Redis queue /
      │                              │ token bucket
      │                              ▼
      │                      ┌──────────────┐
      └──────────────────────│ PostgreSQL   │
                             │ + Fixtures   │
                             └──────────────┘
```

## Trade-offs
- Deterministic heuristics power agents so the stack runs fully offline; optional LLM hook can be added behind a flag later.
- SSE keeps multi-agent streaming simple—no WebSocket infra—but limits downstream fan-out.
- Redis handles both rate limiting and future background jobs; no additional queue chosen to reduce moving parts.
- `react-window` keeps virtualized tables smooth without pulling in a heavier grid library.
- Dataset ships with 200k transactions for realism; generator script scales to 1M when validating the p95 latency requirement.

See `/docs/ADR.md` for additional decisions and `/docs/postman_collection.json` for request samples.
