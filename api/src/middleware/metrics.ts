import type { Request, Response, NextFunction } from "express";
import { apiLatencyHistogram } from "../lib/metrics";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = apiLatencyHistogram.startTimer({ method: req.method, route: req.path });
  res.on("finish", () => {
    end();
  });
  next();
}
