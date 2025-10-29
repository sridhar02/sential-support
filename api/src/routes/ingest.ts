import { Router } from "express";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { requireApiKey } from "../middleware/apiKey";
import { withIdempotency } from "../services/idempotency";

type IngestBody = {
  transactions?: Array<{
    id: string;
    customerId: string;
    cardId?: string | null;
    mcc: string;
    merchant: string;
    amountCents: number;
    currency: string;
    ts: string;
    deviceId?: string | null;
    country?: string | null;
    city?: string | null;
  }>;
};

export const ingestRouter = Router();

ingestRouter.post(
  "/",
  requireApiKey("agent"),
  async (req, res) => {
    await withIdempotency(req, res, async () => {
      const items: IngestBody["transactions"] = [];
      if (req.is("application/json")) {
        const body = req.body as IngestBody;
        if (!body.transactions) {
          return { error: "transactions_required" };
        }
        items.push(...body.transactions);
      } else if (req.is("text/csv")) {
        const records = parse(req.body, {
          columns: true,
          skip_empty_lines: true
        });
        records.forEach((row: any) => {
          items.push({
            id: row.id,
            customerId: row.customerId,
            cardId: row.cardId || null,
            mcc: row.mcc,
            merchant: row.merchant,
            amountCents: Number(row.amountCents),
            currency: row.currency,
            ts: row.ts,
            deviceId: row.deviceId || null,
            country: row.country || null,
            city: row.city || null
          });
        });
      } else {
        return { error: "unsupported_content_type" };
      }

      const data = items.map((item) => ({
        id: item.id,
        customerId: item.customerId,
        cardId: item.cardId,
        mcc: item.mcc,
        merchant: item.merchant,
        amountCents: item.amountCents,
        currency: item.currency,
        ts: new Date(item.ts),
        deviceId: item.deviceId,
        country: item.country,
        city: item.city
      }));

      await prisma.transaction.createMany({
        data,
        skipDuplicates: true
      });

      return {
        accepted: true,
        count: data.length,
        requestId: req.header("x-request-id") || null
      };
    });
  }
);
