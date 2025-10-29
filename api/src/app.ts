import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import type { Request, Response } from "express";
import { ingestRouter } from "./routes/ingest";
import { customerRouter } from "./routes/customer";
import { insightsRouter } from "./routes/insights";
import { triageRouter } from "./routes/triage";
import { actionsRouter } from "./routes/actions";
import { kbRouter } from "./routes/kb";
import { systemRouter } from "./routes/system";
import { alertsRouter } from "./routes/alerts";
import { evalsRouter } from "./routes/evals";
import { requestLogger } from "./middleware/logger";
import { metricsMiddleware } from "./middleware/metrics";
import { rateLimit } from "./services/rateLimiter";
import { redactPII } from "./utils/redact";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"]
      }
    }
  })
);
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.text({ type: "text/csv" }));
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(rateLimit);

app.use("/api/ingest/transactions", ingestRouter);
app.use("/api/customer", customerRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/triage", triageRouter);
app.use("/api/action", actionsRouter);
app.use("/api/kb", kbRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/evals", evalsRouter);
app.use(systemRouter);

app.use((err: Error, _req: Request, res: Response) => {
  res.status(500).json({ error: "internal_error", detail: redactPII(err.message) });
});
