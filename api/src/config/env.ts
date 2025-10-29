import { config as loadEnv } from "dotenv";

loadEnv();

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  databaseUrl: process.env.DATABASE_URL || "postgres://sentinel:sentinel@localhost:5432/sentinel",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  nodeEnv: process.env.NODE_ENV || "development",
  apiKeyAgent: process.env.API_KEY_AGENT || "agent-key",
  apiKeyLead: process.env.API_KEY_LEAD || "lead-key"
};

export const isProduction = env.nodeEnv === "production";
