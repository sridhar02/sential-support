import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withIdempotency } from "../services/idempotency";
import { requireAgentOrLead, requireApiKey } from "../middleware/apiKey";
import { policyBlockCounter } from "../lib/metrics";

export const actionsRouter = Router();

async function appendCaseEvent(params: {
  customerId: string;
  txnId?: string | null;
  type: string;
  status: string;
  actor: string;
  action: string;
  payload: Prisma.InputJsonValue;
}) {
  const { customerId, txnId, type, status, actor, action, payload } = params;
  const reasonExtract =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).reasonCode
      : null;
  const reasonCode = typeof reasonExtract === "string" ? reasonExtract : null;

  let caseRecord;
  if (txnId) {
    caseRecord = await prisma.case.upsert({
      where: { txnId },
      create: {
        customerId,
        txnId,
        type,
        status,
        reasonCode
      },
      update: {
        status,
        reasonCode
      }
    });
  } else {
    const existing = await prisma.case.findFirst({
      where: {
        customerId,
        type,
        status: { not: "CLOSED" }
      },
      orderBy: { createdAt: "desc" }
    });
    caseRecord =
      existing ||
      (await prisma.case.create({
        data: {
          customerId,
          type,
          status,
          reasonCode
        }
      }));
  }

  await prisma.caseEvent.create({
    data: {
      caseId: caseRecord.id,
      actor,
      action,
      payload
    }
  });
}

actionsRouter.post(
  "/freeze-card",
  requireAgentOrLead(),
  async (req, res) => {
    await withIdempotency(req, res, async () => {
      const { cardId, otp } = req.body as { cardId: string; otp?: string };
      if (!cardId) {
        return { error: "cardId_required" };
      }

      const card = await prisma.card.findUnique({ where: { id: cardId } });
      if (!card) {
        return { error: "card_not_found" };
      }

      const actor = req.header("x-api-key") || "unknown";
      const role = (res.locals.role as string) || "agent";

      if (card.status === "FROZEN") {
        return { status: "FROZEN", requestId: req.header("x-request-id") || null };
      }

      const requiresOtp = otp === "123456" || role === "lead";
      if (!requiresOtp) {
        policyBlockCounter.inc({ policy: "otp_required" });
        await prisma.auditLog.create({
          data: {
            actor,
            action: "freeze_card_blocked",
            resource: "card",
            resourceId: cardId,
            payload: { reason: "otp_required" }
          }
        });
        return { status: "PENDING_OTP", requestId: req.header("x-request-id") || null };
      }

      const updated = await prisma.card.update({
        where: { id: cardId },
        data: { status: "FROZEN" }
      });

      await prisma.auditLog.create({
        data: {
          actor,
          action: "freeze_card",
          resource: "card",
          resourceId: cardId,
          payload: { status: updated.status }
        }
      });

      await appendCaseEvent({
        customerId: card.customerId,
        txnId: null,
        type: "CARD_FREEZE",
        status: "FROZEN",
        actor,
        action: "freeze_card",
        payload: { cardId, role } as Prisma.InputJsonValue
      });

      return { status: "FROZEN", requestId: req.header("x-request-id") || null };
    });
  }
);

actionsRouter.post(
  "/open-dispute",
  requireApiKey("agent"),
  async (req, res) => {
    await withIdempotency(req, res, async () => {
      const { txnId, reasonCode, confirm } = req.body as {
        txnId: string;
        reasonCode: string;
        confirm?: boolean;
      };
      if (!txnId || !reasonCode || !confirm) {
        return { error: "invalid_request" };
      }

      const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
      if (!txn) {
        return { error: "transaction_not_found" };
      }

      const actor = req.header("x-api-key") || "unknown";
      const normalizedReason = reasonCode.toUpperCase();
      const disputeCase = await prisma.case.create({
        data: {
          customerId: txn.customerId,
          txnId: txn.id,
          type: "DISPUTE",
          status: "OPEN",
          reasonCode: normalizedReason
        }
      });

      await prisma.caseEvent.create({
        data: {
          caseId: disputeCase.id,
          actor,
          action: "case_opened",
          payload: { txnId, reasonCode: normalizedReason }
        }
      });

      await prisma.auditLog.create({
        data: {
          actor,
          action: "open_dispute",
          resource: "case",
          resourceId: disputeCase.id,
          payload: { txnId, reasonCode: normalizedReason }
        }
      });

      await appendCaseEvent({
        customerId: txn.customerId,
        txnId: txn.id,
        type: "DISPUTE",
        status: "OPEN",
        actor,
        action: "open_dispute",
        payload: { txnId, reasonCode: normalizedReason } as Prisma.InputJsonValue
      });

      return { caseId: disputeCase.id, status: "OPEN" };
    });
  }
);

actionsRouter.post(
  "/contact-customer",
  requireApiKey("agent"),
  async (req, res) => {
    await withIdempotency(req, res, async () => {
      const { customerId, note } = req.body as { customerId: string; note: string };
      if (!customerId || !note) {
        return { error: "invalid_request" };
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return { error: "customer_not_found" };
      }

      const actor = req.header("x-api-key") || "unknown";
      await prisma.auditLog.create({
        data: {
          actor,
          action: "contact_customer",
          resource: "customer",
          resourceId: customerId,
          payload: { note }
        }
      });

      await appendCaseEvent({
        customerId,
        txnId: null,
        type: "CUSTOMER_CONTACT",
        status: "FOLLOWED_UP",
        actor,
        action: "contact_customer",
        payload: { note } as Prisma.InputJsonValue
      });

      return { status: "CONTACTED" };
    });
  }
);
