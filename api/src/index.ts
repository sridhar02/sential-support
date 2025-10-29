import { env } from "./config/env";
import { app } from "./app";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { logger } from "./lib/logger";

async function start() {
  try {
    await prisma.$connect();
    await redis.connect();

    app.listen(env.port, () => {
      logger.info({ event: "server_started", port: env.port, masked: true });
    });
  } catch (err) {
    logger.error({ event: "startup_failed", error: (err as Error).message, masked: true });
    process.exit(1);
  }
}

start();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});
