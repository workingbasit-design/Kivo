#!/bin/sh
# Applies the ordered migrations (m1..m13, m22, m23, m31, m32, m33, m34) to the database pointed at
# by DATABASE_URL. Used by the Vercel build BEFORE `prisma db push`, because
# db push cannot add NOT NULL columns / drop columns on tables that already
# have production data - the migration files do the backfills first.
#
# m33 (2026-11-16) adds the optional DirectoryRequest.customerId link (plus
# FK + index) so a signed-in customer's unmatched request can be shown in
# /customer/requests. Pure additive, no rows touched.
#
# m34 (2026-11-17) adds the optional Job.startedAt (actual start time, set
# when a job transitions into IN PROGRESS). Pure additive, no rows touched.
#
# m35 (2026-11-17, P1.0 Stage 1) closes the 17-table RLS policy gap found
# by the master-plan audit: 13 business tables added after M11 never got a
# policy, plus 4 parent-linked child tables. Also tightens
# CustomerFieldValue (field business AND customer business) and carves out
# NULL businessId rows on the 6 nullable-businessId models so platform /
# pre-auth rows do not vanish under a future FORCE. Pure DDL, no rows
# touched; idempotent (DROP POLICY IF EXISTS + CREATE POLICY).
#
# m31/m32 (2026-11-11, Claude design+DB series) are pure backfills with no
# schema change: m31 seeds BookableService rows so existing /book pages do
# not go blank when the page starts reading the curated list, and m32 flips
# gstHstRegistered false -> true for businesses with registration evidence
# so they keep charging GST/HST. Both are idempotent, so a re-run is a no-op.
#
# Skips 20261014154131_init on purpose: it is a CREATE TABLE baseline of the
# schema production already has (verified: no schema diff between the last
# production push and the baseline). Running it would fail on existing tables.
#
# Fail-fast: `set -e` aborts the build on the first failing migration, so the
# previous production deployment keeps serving.
#
# IDEMPOTENT (2026-10-14): every statement in m1..m13 now uses IF NOT EXISTS /
# IF EXISTS / DO-block guards (see the header in each migration.sql), so a
# re-run after a partial apply - or two builds racing each other - converges
# instead of failing on "already exists". (Lesson learned the hard way: the
# first two production builds raced - a delayed GitHub webhook fired ~10s
# before a manual deploy - and the second build died on m1 with
# 'relation "Membership" already exists'.) Re-running a fully-applied file
# is all no-ops. Fix forward, never blindly.
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
  20261016090000_m22_template_overrides \
  20261016100000_m23_stripe_bank_first \
  20261111120000_m31_backfill_bookable_services \
  20261111130000_m32_backfill_gst_registered \
  20261116120000_m33_directory_request_customer \
  20261117120000_m34_job_startedat \
  20261117130000_m35_rls_policy_gaps \
; do
  echo "==> Applying migration ${m}..."
  prisma db execute --file "prisma/migrations/${m}/migration.sql" --schema prisma/schema.prisma
  echo "    OK ${m}"
done

echo "All Prompt 3 migrations applied."
