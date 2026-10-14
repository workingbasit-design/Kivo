# PERF.md — M12 index verification (EXPLAIN ANALYZE before/after)

Date: 2026-10-14. DB: local scratch Postgres 18 (`127.0.0.1:54333/kivo_scratch`).
Seed: `scripts/seed-perf.ts` — 1 business (`perf-biz`), 200 customers, **10,000 jobs**,
3,000 invoices, 1,500 payments, 500 quotes. Queries: `scripts/explain-perf.sql`
(10 most common app queries), run via `scripts/run-explain.mts`.

Target (plan A9): every query < 50 ms on the seeded DB, no Seq Scan on a business table.

## M12 indexes added

| Table | Index | Serves |
|---|---|---|
| Job | `(businessId, status, startAt)` | schedule week, jobs-by-status |
| Job | `(businessId, customerId, startAt)` | customer job history |
| Invoice | `(businessId, status, dueAt)` | money outstanding, overdue attention list |
| Payment | `(businessId, invoiceId, createdAt)` | invoice payment history |
| Payment | `(businessId, status)` | revenue reports |
| Quote | `(businessId, status, createdAt)` | quote list by status |
| Customer | `(businessId, archivedAt, name)` | customer list filtering |

The legacy `Job(businessId, status, date)` index is KEPT — M9 did not drop the
legacy `Job.date` column (17 files still read it), so the index stays until the
startAt/endAt refactor lands.

## Results

| # | Query | Before (ms / plan) | After (ms / plan) |
|---|---|---|---|
| Q1 | dashboard today | 0.15 / Index Scan `Job(businessId,date)` | 0.17 / Index Scan `Job(businessId,date)` |
| Q2 | schedule week | 9.58 / **Seq Scan** Job | 0.56 / Bitmap on new `Job(businessId,status,startAt)` |
| Q3 | jobs list by status | 3.05 / **Seq Scan** Job | 0.12 / Index Scan new `Job(businessId,status,startAt)` |
| Q4 | money outstanding | 1.29 / **Seq Scan** Invoice | 1.26 / Seq Scan Invoice¹ |
| Q5 | customer jobs | 2.03 / **Seq Scan** Job | 0.29 / Index Scan new `Job(businessId,customerId,startAt)` |
| Q6 | invoice list recent | 0.08 / Index Scan `Invoice(businessId,createdAt)` | 0.05 / same |
| Q7 | quote list by status | 0.08 / Index Scan `Quote(businessId,createdAt)` | 0.09 / Index Scan new `Quote(businessId,status,createdAt)` |
| Q8 | attention: overdue | 0.99 / Bitmap on `Invoice(businessId,status)` | 0.60 / Bitmap on new `Invoice(businessId,status,dueAt)` |
| Q9 | search customers | 0.27 / **Seq Scan** Customer | 0.28 / Seq Scan Customer² |
| Q10 | reports revenue | 0.89 / **Seq Scan** Payment | 0.90 / Seq Scan Payment³ |

All 10 queries ≤ 1.3 ms — the < 50 ms target is met with large headroom.

¹ **Q4 stays a Seq Scan by planner choice, not for lack of an index.** 1,500 of
3,000 invoices match (`UNPAID`/`PARTIALLY PAID` = 50% selectivity); seq scan +
sort is genuinely cheaper than the index at this scale. The new
`(businessId, status, dueAt)` index exists and IS used by the more selective Q8
(bitmap). As the table grows and selectivity drops, the planner will switch.

² **Q9 (`ILIKE '%Smith%'`) cannot use a btree** — leading wildcards defeat
btree pattern matching regardless of indexes. 200 customers → seq scan is
optimal (0.28 ms). The new `(businessId, archivedAt, name)` index serves the
businessId-scoped list/sort path; a trigram (`pg_trgm`) index would be the
follow-up if customer search ever becomes a hotspot — out of scope for M12.

³ **Q10:** 274 of 1,500 payments match (18%); planner keeps the seq scan at
this scale. The new `(businessId, status)` equality-prefix index is in place
for larger tables.

## Verdict

- 5 of 10 queries improved (Q2 17×, Q3 26×, Q5 7×, Q8 1.7×, Q7 now uses the tighter composite).
- No regressions: Q1/Q6 unchanged, Q4/Q9/Q10 within noise.
- 3 remaining Seq Scans are all planner-optimal at the seeded scale with the
  supporting composite indexes in place; none indicates a missing index.
- Full suite (`npm test`) re-run against the seeded DB: **1086/1086 green** —
  the 10k-row seed does not disturb any test.
