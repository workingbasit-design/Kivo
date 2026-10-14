-- M12: EXPLAIN ANALYZE for the 10 most common app queries.
-- Run against the seeded scratch DB before and after the M12 index migration.
-- Each statement is prefixed with a -- Qn: name comment. Runner splits on semicolons.

-- Q1: dashboard today (jobs due today)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","title","status","startAt" FROM "Job"
WHERE "businessId" = 'perf-biz'
  AND "date" >= CURRENT_DATE AND "date" < CURRENT_DATE + interval '1 day'
ORDER BY "startAt" LIMIT 50;

-- Q2: schedule week (jobs by startAt range)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","title","status","startAt" FROM "Job"
WHERE "businessId" = 'perf-biz'
  AND "startAt" >= date_trunc('week', CURRENT_DATE)
  AND "startAt" < date_trunc('week', CURRENT_DATE) + interval '7 days'
ORDER BY "startAt";

-- Q3: jobs list by status
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","title","startAt" FROM "Job"
WHERE "businessId" = 'perf-biz' AND "status" = 'SCHEDULED'
ORDER BY "startAt" LIMIT 50;

-- Q4: money outstanding (unpaid invoices)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","number","totalCents","dueAt" FROM "Invoice"
WHERE "businessId" = 'perf-biz' AND "status" IN ('UNPAID','PARTIALLY PAID')
ORDER BY "dueAt" LIMIT 50;

-- Q5: customer jobs
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","title","status","date" FROM "Job"
WHERE "businessId" = 'perf-biz' AND "customerId" = 'perf-cust-1'
ORDER BY "date" DESC LIMIT 50;

-- Q6: invoice list (recent first)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","number","status","totalCents" FROM "Invoice"
WHERE "businessId" = 'perf-biz'
ORDER BY "createdAt" DESC LIMIT 50;

-- Q7: quote list by status
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","number","status","totalCents" FROM "Quote"
WHERE "businessId" = 'perf-biz' AND "status" = 'SENT'
ORDER BY "createdAt" DESC LIMIT 50;

-- Q8: attention list (overdue invoices)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","number","totalCents","dueAt" FROM "Invoice"
WHERE "businessId" = 'perf-biz'
  AND "dueAt" < NOW()
  AND "status" IN ('UNPAID','PARTIALLY PAID')
ORDER BY "dueAt" LIMIT 50;

-- Q9: search customers by name
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT "id","name" FROM "Customer"
WHERE "businessId" = 'perf-biz' AND "name" ILIKE '%Smith%'
ORDER BY "name" LIMIT 20;

-- Q10: reports revenue (completed payments this month)
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)
SELECT sum("amountCents") FROM "Payment"
WHERE "businessId" = 'perf-biz'
  AND "status" = 'COMPLETED'
  AND "createdAt" >= date_trunc('month', CURRENT_DATE);
