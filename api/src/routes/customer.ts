import { Router } from "express";
import { prisma } from "../lib/prisma";

export const customerRouter = Router();

function decodeCursor(cursor: string | undefined): { ts: Date; id: string } | null {
  if (!cursor) return null;
  const [ts, id] = Buffer.from(cursor, "base64").toString("utf8").split("|");
  if (!ts || !id) return null;
  return { ts: new Date(ts), id };
}

function encodeCursor(ts: Date, id: string): string {
  return Buffer.from(`${ts.toISOString()}|${id}`, "utf8").toString("base64");
}

customerRouter.get("/:id/transactions", async (req, res) => {
  const { id } = req.params;
  const { from, to, cursor } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);

  const cursorValue = decodeCursor(cursor);

  const where: any = {
    customerId: id
  };
  if (from) where.ts = { ...(where.ts || {}), gte: new Date(from) };
  if (to) where.ts = { ...(where.ts || {}), lte: new Date(to) };

  if (cursorValue) {
    where.AND = [
      {
        OR: [
          { ts: { lt: cursorValue.ts } },
          {
            AND: [{ ts: cursorValue.ts }, { id: { lt: cursorValue.id } }]
          }
        ]
      }
    ];
  }

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ ts: "desc" }, { id: "desc" }],
    take: limit + 1
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const last = items.pop()!;
    nextCursor = encodeCursor(last.ts, last.id);
  }

  res.json({ items, nextCursor });
});
