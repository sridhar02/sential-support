import { Router } from "express";
import { prisma } from "../lib/prisma";

export const alertsRouter = Router();

alertsRouter.get("/", async (_req, res) => {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      suspectTxn: true,
      customer: true,
      card: true
    }
  });

  res.json({ alerts });
});

alertsRouter.get("/kpis", async (_req, res) => {
  const [alertsAgg, disputesAgg, avgLatency] = await Promise.all([
    prisma.alert.aggregate({
      _count: true,
      where: { status: { in: ["NEW", "OPEN"] } }
    }),
    prisma.case.aggregate({
      _count: true,
      where: { status: "OPEN" }
    }),
    prisma.triageRun.aggregate({
      _avg: { latencyMs: true }
    })
  ]);

  res.json({
    alertsOpen: alertsAgg._count ?? 0,
    disputesOpen: disputesAgg._count ?? 0,
    avgTriageLatencyMs: Math.round(avgLatency._avg.latencyMs || 0)
  });
});
