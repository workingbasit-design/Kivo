# Rollback: M5 AuditEvent

Reverse SQL:
```sql
DROP TRIGGER IF EXISTS audit_events_no_update_delete ON "AuditEvent";
DROP FUNCTION IF EXISTS audit_events_block_mutation();
DROP TABLE "AuditEvent";
```
(The RLS policies are dropped with the table.) Then `prisma migrate resolve
--rolled-back 20261014155655_m5_audit_events` and redeploy the previous
release. Data note: audit rows written after M5 are lost — export them
first if the audit trail must be preserved. `PiaAuditLog` is untouched.
