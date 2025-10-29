import { Router } from "express";
import { prisma } from "../lib/prisma";

const CATEGORY_MAP: Record<string, string> = {
  "5411": "Groceries",
  "6011": "ATM",
  "4111": "Transport",
  "4812": "Telecom",
  "5732": "Electronics"
};

export const insightsRouter = Router();

insightsRouter.get("/:customerId/summary", async (req, res) => {
  const { customerId } = req.params;
  const transactions = await prisma.transaction.findMany({
    where: { customerId },
    orderBy: { ts: "desc" },
    take: 500
  });

  const merchantCount = new Map<string, number>();
  const categoryTotals = new Map<string, { total: number; count: number }>();
  const monthly = new Map<string, number>();
  const amounts: number[] = [];

  for (const txn of transactions) {
    merchantCount.set(txn.merchant, (merchantCount.get(txn.merchant) || 0) + 1);
    const category = CATEGORY_MAP[txn.mcc] || "Other";
    const current = categoryTotals.get(category) || { total: 0, count: 0 };
    current.total += txn.amountCents;
    current.count += 1;
    categoryTotals.set(category, current);

    const month = txn.ts.toISOString().slice(0, 7);
    monthly.set(month, (monthly.get(month) || 0) + txn.amountCents);
    amounts.push(Math.abs(txn.amountCents));
  }

  const topMerchants = Array.from(merchantCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([merchant, count]) => ({ merchant, count }));

  const totalCategory = Array.from(categoryTotals.entries()).reduce((acc, [, value]) => acc + value.total, 0);
  const categories = Array.from(categoryTotals.entries())
    .map(([name, value]) => ({ name, pct: totalCategory === 0 ? 0 : Math.abs(value.total) / Math.abs(totalCategory) }))
    .slice(0, 5);

  const monthlyTrend = Array.from(monthly.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([month, sum]) => ({ month, sum }));

  const mean = amounts.reduce((acc, v) => acc + v, 0) / (amounts.length || 1);
  const variance = amounts.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (amounts.length || 1);
  const stdDev = Math.sqrt(variance);
  type Txn = (typeof transactions)[number];
  const anomalies = transactions
    .filter((txn: Txn) => Math.abs(txn.amountCents) > mean + 2 * stdDev)
    .slice(0, 3)
    .map((txn: Txn) => ({
      ts: txn.ts.toISOString(),
      z: stdDev === 0 ? 0 : (Math.abs(txn.amountCents) - mean) / stdDev,
      note: `Spike at ${txn.merchant}`
    }));

  res.json({
    topMerchants,
    categories,
    monthlyTrend,
    anomalies
  });
});
