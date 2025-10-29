import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

type Role = "agent" | "lead";

function resolveRole(header: string | undefined): Role | null {
  if (header === env.apiKeyLead) {
    return "lead";
  }
  if (header === env.apiKeyAgent) {
    return "agent";
  }
  return null;
}

export function requireApiKey(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("x-api-key");
    const resolved = resolveRole(header);
    if (!resolved) {
      res.status(401).json({ error: "invalid_api_key" });
      return;
    }
    if (role === "lead" && resolved !== "lead") {
      res.status(403).json({ error: "lead_required" });
      return;
    }
    res.locals.role = resolved;
    next();
  };
}

export function requireAgentOrLead() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("x-api-key");
    const resolved = resolveRole(header);
    if (!resolved) {
      res.status(401).json({ error: "invalid_api_key" });
      return;
    }
    res.locals.role = resolved;
    next();
  };
}
