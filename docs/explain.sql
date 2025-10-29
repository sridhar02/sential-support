EXPLAIN ANALYZE
SELECT "id", "merchant", "amountCents", "currency", "ts"
FROM "Transaction"
WHERE "customerId" = 'cust_1'
  AND "ts" >= NOW() - INTERVAL '90 days'
ORDER BY "ts" DESC
LIMIT 100;
