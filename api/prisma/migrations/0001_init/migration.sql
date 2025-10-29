-- CreateEnum

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "emailMasked" TEXT NOT NULL,
    "kycLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Card" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE
);

CREATE TABLE "Account" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "Account_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE
);

CREATE TABLE "Transaction" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "cardId" TEXT,
    "mcc" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "ts" TIMESTAMP WITH TIME ZONE NOT NULL,
    "deviceId" TEXT,
    "country" TEXT,
    "city" TEXT,
    CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE,
    CONSTRAINT "Transaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL
);

CREATE TABLE "Alert" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "suspectTxnId" TEXT,
    "cardId" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "risk" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "Alert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE,
    CONSTRAINT "Alert_suspectTxnId_fkey" FOREIGN KEY ("suspectTxnId") REFERENCES "Transaction"("id") ON DELETE SET NULL,
    CONSTRAINT "Alert_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL
);

CREATE TABLE "Case" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "txnId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Case_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE,
    CONSTRAINT "Case_txnId_fkey" FOREIGN KEY ("txnId") REFERENCES "Transaction"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "Case_txnId_key" ON "Case"("txnId");

CREATE TABLE "CaseEvent" (
    "id" TEXT PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "ts" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE
);

CREATE TABLE "TriageRun" (
    "id" TEXT PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP WITH TIME ZONE,
    "risk" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    CONSTRAINT "TriageRun_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE
);

CREATE TABLE "AgentTrace" (
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "step" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "detail" JSONB NOT NULL,
    PRIMARY KEY ("runId", "seq"),
    CONSTRAINT "AgentTrace_runId_fkey" FOREIGN KEY ("runId") REFERENCES "TriageRun"("id") ON DELETE CASCADE
);

CREATE TABLE "KbDoc" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "content" TEXT NOT NULL
);

CREATE TABLE "Policy" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL
);

CREATE TABLE "Chargeback" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "txnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Device" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "lastSeen" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT
);

CREATE TABLE "IdempotencyKey" (
    "key" TEXT PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "resource" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX "Transaction_customer_ts_idx" ON "Transaction"("customerId", "ts" DESC);
CREATE INDEX "Transaction_merchant_idx" ON "Transaction"("merchant");
CREATE INDEX "Transaction_mcc_idx" ON "Transaction"("mcc");
CREATE INDEX "Transaction_customer_merchant_idx" ON "Transaction"("customerId", "merchant");
