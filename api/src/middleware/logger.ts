import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { redactPII } from "../utils/redact";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info({
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : "info",
      requestId: req.headers["x-request-id"] || undefined,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      masked: true
    });
  });
  if (req.body && typeof req.body === "object") {
    Object.entries(req.body).forEach(([key, value]) => {
      if (typeof value === "string") {
        req.body[key] = redactPII(value);
      }
    });
  }
  next();
}
