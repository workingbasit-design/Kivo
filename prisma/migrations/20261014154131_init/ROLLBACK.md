# Rollback: 20261014154131_init (baseline)

Baseline migration — captures the pre-hardening schema. Rollback = restore
the database from the pre-migration backup (this migration creates the
entire schema; there is no partial reverse). Then `prisma migrate resolve
--rolled-back 20261014154131_init`.
