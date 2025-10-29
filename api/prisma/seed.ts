import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function readJson<T>(file: string): Promise<T> {
  const data = await fs.readFile(path.resolve(__dirname, "../../fixtures", file), "utf8");
  return JSON.parse(data) as T;
}

async function main() {
  await prisma.$transaction([
    prisma.agentTrace.deleteMany(),
    prisma.triageRun.deleteMany(),
    prisma.caseEvent.deleteMany(),
    prisma.case.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.card.deleteMany(),
    prisma.account.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.kbDoc.deleteMany(),
    prisma.policy.deleteMany(),
    prisma.chargeback.deleteMany(),
    prisma.device.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.idempotencyKey.deleteMany()
  ]);

  const customers = await readJson<Array<any>>("customers.json");
  const cards = await readJson<Array<any>>("cards.json");
  const accounts = await readJson<Array<any>>("accounts.json");
  const transactions = await readJson<Array<any>>("transactions.json");
  const alerts = await readJson<Array<any>>("alerts.json");
  const kbDocs = await readJson<Array<any>>("kb_docs.json");
  const policies = await readJson<Array<any>>("policies.json");
  const chargebacks = await readJson<Array<any>>("chargebacks.json");
  const devices = await readJson<Array<any>>("devices.json");

  await prisma.customer.createMany({ data: customers });
  await prisma.card.createMany({ data: cards });
  await prisma.account.createMany({ data: accounts });

  for (let i = 0; i < transactions.length; i += 1000) {
    const chunk = transactions.slice(i, i + 1000);
    await prisma.transaction.createMany({ data: chunk, skipDuplicates: true });
  }

  await prisma.alert.createMany({ data: alerts });
  await prisma.kbDoc.createMany({ data: kbDocs });
  await prisma.policy.createMany({ data: policies });
  await prisma.chargeback.createMany({ data: chargebacks });
  await prisma.device.createMany({ data: devices });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
