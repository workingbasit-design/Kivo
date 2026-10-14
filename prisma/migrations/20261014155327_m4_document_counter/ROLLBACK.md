# Rollback: M4 DocumentCounter

Reverse SQL:
```sql
ALTER TABLE "DocumentCounter" DROP CONSTRAINT IF EXISTS "DocumentCounter_docType_check";
DROP TABLE "DocumentCounter";
ALTER TABLE "CreditNote" DROP COLUMN IF EXISTS "number";
```
Then `prisma migrate resolve --rolled-back 20261014155327_m4_document_counter`
and redeploy the previous release (max+1 numbering). Data note: credit-note
numbers assigned by the M4 backfill are lost; document numbering reverts to
the old retry scheme. Do NOT roll back while the new code is still deployed
(it calls `nextDocumentNumber`, which requires the table).
