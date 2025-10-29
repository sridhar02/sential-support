import type { Request, Response, NextFunction } from "express";
import { redis } from "../lib/redis";
import { rateLimitCounter } from "../lib/metrics";

const WINDOW_MS = 1000;
const TOKENS = 5;

export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = `rate:${req.ip}`;
  const now = Date.now();
  const script = `
  local key = KEYS[1]
  local tokens = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local data = redis.call('HMGET', key, 'tokens', 'updated')
  local current = tonumber(data[1])
  local updated = tonumber(data[2])

  if not current then
    current = tokens
    updated = now
  else
    local refill = math.floor((now - updated) / window)
    if refill > 0 then
      current = math.min(tokens, current + refill)
      updated = now
    end
  end

  if current <= 0 then
    redis.call('HMSET', key, 'tokens', 0, 'updated', updated)
    redis.call('PEXPIRE', key, window)
    return -1
  else
    current = current - 1
    redis.call('HMSET', key, 'tokens', current, 'updated', updated)
    redis.call('PEXPIRE', key, window)
    return current
  end`;

  try {
    const result = await redis.eval(script, 1, key, TOKENS, WINDOW_MS, now);
    if (typeof result === "number" && result === -1) {
      rateLimitCounter.inc();
      res.setHeader("Retry-After", "1");
      res.status(429).json({ error: "rate_limited" });
      return;
    }
  } catch (err) {
    // fail open if redis unavailable
  }
  next();
}
