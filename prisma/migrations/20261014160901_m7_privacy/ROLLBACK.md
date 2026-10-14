# Rollback: M7 privacy columns

Reverse SQL:
```sql
DROP TABLE "ConfidentialityIncident";
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "archivedBy";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "archivedAt";
ALTER TABLE "Job" DROP COLUMN IF EXISTS "archivedBy";
ALTER TABLE "Equipment" DROP COLUMN IF EXISTS "archivedAt";
ALTER TABLE "Equipment" DROP COLUMN IF EXISTS "archivedBy";
```
Plus `ALTER TABLE "<T>" DROP COLUMN IF EXISTS "createdBy";` /
`"updatedBy"` for T in (Job, Invoice, Payment, Quote, CreditNote,
Customer, Lead, JobExpense, TimeEntry, Project, QuoteDeposit, MessageLog).
Then `prisma migrate resolve --rolled-back 20261014160901_m7_privacy` and
redeploy the previous release. All new columns are nullable with no
backfill — no data loss.
