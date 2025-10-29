import Redis from "ioredis";
import { env } from "../config/env";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});

redis.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Redis error", err);
});
