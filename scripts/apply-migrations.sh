#!/bin/sh
# Applies the Prompt 3 ordered migrations (m1..m13) to the database pointed at
# by DATABASE_URL. Used by the Vercel build BEFORE `prisma db push`, because
# db push cannot add NOT NULL columns / drop columns on tables that already
# have production data - the migration files do the backfills first.
#
# Skips 20261014154131_init on purpose: it is a CREATE TABLE baseline of the
# schema production already has (verified: no schema diff between the last
# production push and the baseline). Running it would fail on existing tables.
#
# Fail-fast: `set -e` aborts the build on the first failing migration, so the
# previous production deployment keeps serving. Check the build log for the
# failing statement and fix forward - never re-run blindly after a partial
# apply (DDL statements are not all idempotent).
set -e

for m in \
  20261014154247_m1_memberships \
  20261014154539_m2_consumer_link \
  20261014154806_m3_tax_rates \
  20261014155327_m4_document_counter \
  20261014155655_m5_audit_events \
  20261014160354_m6_idempotency_webhooks \
  20261014160901_m7_privacy \
  20261014161219_m8_cents_cutover \
  20261014170000_m9_tenancy_notnull \
  20261014173000_m10_constraints \
  20261014180000_m11_rls \
  20261014183000_m12_indexes \
  20261014190000_m13_totp \
; do
  echo "==> Applying migration ${m}..."
  prisma db execute --file "prisma/migrations/${m}/migration.sql" --schema prisma/schema.prisma
  echo "    OK ${m}"
done

echo "All Prompt 3 migrations applied."
