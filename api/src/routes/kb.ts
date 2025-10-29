import { Router } from "express";
import { prisma } from "../lib/prisma";

export const kbRouter = Router();

kbRouter.get("/search", async (req, res) => {
  const { q } = req.query as { q?: string };
  if (!q) {
    res.json({ results: [] });
    return;
  }

  const docs = await prisma.kbDoc.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } }
      ]
    },
    take: 5
  });

  res.json({
    results: docs.map((doc: { id: string; title: string; anchor: string; content: string }) => ({
      docId: doc.id,
      title: doc.title,
      anchor: doc.anchor,
      extract: doc.content.slice(0, 160)
    }))
  });
});
