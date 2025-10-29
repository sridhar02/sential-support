#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const customers = require("../fixtures/customers.json");
const cards = require("../fixtures/cards.json");

const total = Number(process.argv[2] || 200000);
const outputPath = path.resolve(__dirname, "../fixtures/transactions.json");

const merchants = [
  { name: "ABC Mart", mcc: "5411", country: "IN", city: "Mumbai" },
  { name: "QuickCab", mcc: "4111", country: "US", city: "New York" },
  { name: "GlobalAir", mcc: "4511", country: "US", city: "San Francisco" },
  { name: "DigitalHub", mcc: "4812", country: "US", city: "Seattle" },
  { name: "ElectroMax", mcc: "5732", country: "US", city: "Austin" },
  { name: "Cafe Bliss", mcc: "5814", country: "US", city: "Chicago" }
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad(num, size = 4) {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
}

const baseTs = Date.now();
const items = [];

function pushTxn(overrides = {}) {
  const customer = overrides.customerId
    ? { id: overrides.customerId }
    : randomChoice(customers);
  const card = cards.find((c) => c.customerId === customer.id) || randomChoice(cards);
  const merchant = overrides.merchant
    ? merchants.find((m) => m.name === overrides.merchant) || { name: overrides.merchant, mcc: "5999", country: "US", city: "San Jose" }
    : randomChoice(merchants);
  const index = items.length + 1;

  const txn = {
    id: overrides.id || `txn_${pad(index, 6)}`,
    customerId: customer.id,
    cardId: card.id,
    mcc: overrides.mcc || merchant.mcc,
    merchant: merchant.name,
    amountCents: overrides.amountCents || (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 50000 + 1000),
    currency: overrides.currency || "USD",
    ts: overrides.ts || new Date(baseTs - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 120)).toISOString(),
    deviceId: overrides.deviceId || `device_${customer.id}_${Math.floor(Math.random() * 5)}`,
    country: overrides.country || merchant.country,
    city: overrides.city || merchant.city
  };
  items.push(txn);
}

// Deterministic seed transactions to match alerts/evals
pushTxn({
  id: "txn_1001",
  customerId: "cust_1",
  cardId: "card_1",
  merchant: "ABC Mart",
  mcc: "5411",
  amountCents: -499900,
  currency: "INR",
  ts: new Date(baseTs - 1000 * 60 * 60 * 24).toISOString(),
  country: "IN",
  city: "Mumbai"
});

pushTxn({
  id: "txn_2001",
  customerId: "cust_2",
  cardId: "card_2",
  merchant: "QuickCab",
  mcc: "4111",
  amountCents: -2500,
  currency: "USD",
  ts: new Date(baseTs - 1000 * 60 * 60 * 12).toISOString(),
  country: "US",
  city: "New York"
});

pushTxn({
  id: "txn_3001",
  customerId: "cust_3",
  cardId: "card_3",
  merchant: "GlobalAir",
  mcc: "4511",
  amountCents: -78000,
  currency: "USD",
  ts: new Date(baseTs - 1000 * 60 * 60 * 30).toISOString(),
  country: "US",
  city: "San Francisco"
});

while (items.length < total) {
  pushTxn();
}

fs.writeFileSync(outputPath, JSON.stringify(items));
console.log(`wrote ${items.length} transactions to ${outputPath}`);
