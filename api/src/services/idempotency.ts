import type { Response, Request } from "express";
import { prisma } from "../lib/prisma";

export async function withIdempotency(
  req: Request,
  res: Response,
  handler: () => Promise<any>
): Promise<void> {
  const key = req.header("idempotency-key");
  const endpoint = req.path;

  if (!key) {
    const payload = await handler();
    res.json(payload);
    return;
  }

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    res.json(existing.response);
    return;
  }

  const payload = await handler();
  await prisma.idempotencyKey.create({
    data: {
      key,
      endpoint,
      response: payload
    }
  });
  res.json(payload);
}
