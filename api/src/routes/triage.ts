import { Router } from "express";
import { prisma } from "../lib/prisma";
import { orchestrateTriage } from "../services/triage/orchestrator";
import { triageBus } from "../services/triage/bus";
import type { TriageEvent } from "../types/triage";
import { requireApiKey } from "../middleware/apiKey";
import { logger } from "../lib/logger";

export const triageRouter = Router();

triageRouter.post("/", requireApiKey("agent"), async (req, res, next) => {
  try {
    const { alertId } = req.body as { alertId: string };
    if (!alertId) {
      res.status(400).json({ error: "alertId_required" });
      return;
    }

    const run = await prisma.triageRun.create({
      data: {
        alertId,
        risk: "pending",
        reasons: [],
        fallbackUsed: false
      }
    });

    triageBus.create(run.id);

    setImmediate(async () => {
      try {
        await orchestrateTriage(alertId, run.id, (event: TriageEvent) => {
          triageBus.publish(run.id, event);
          logger.info({
            event: event.type,
            runId: run.id,
            detail: event.detail,
            masked: true
          });
        });
      } catch (err) {
        logger.error({
          event: "triage_failed",
          runId: run.id,
          error: (err as Error).message,
          masked: true
        });
        triageBus.publish(run.id, {
          type: "fallback_triggered",
          detail: (err as Error).message
        });
      }
    });

    res.json({ runId: run.id, alertId });
  } catch (err) {
    next(err);
  }
});

triageRouter.get("/:runId/stream", async (req, res) => {
  const { runId } = req.params;
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");

  const emitter = triageBus.get(runId);
  if (!emitter) {
    res.write(`event: fallback_triggered\ndata: ${JSON.stringify({ detail: "run_not_found" })}\n\n`);
    res.end();
    return;
  }

  const send = (event: TriageEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  emitter.on("event", send);

  const heartbeat = setInterval(() => {
    res.write(`event: keepalive\ndata: {}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    emitter.off("event", send);
  });
});
