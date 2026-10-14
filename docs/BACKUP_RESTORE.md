# BACKUP_RESTORE.md — Backups + restore drill

## Production backups (Prisma Postgres, free plan)

- Prisma Postgres takes **daily backups** automatically (verify retention window
  in the Vercel project's Storage tab — free-plan retention is limited; confirm
  the exact window there, it is not in code).
- Point-in-time recovery (PITR): check availability on the current plan in the
  dashboard. If PITR is available, it is the first-choice restore path.
- If the database outgrows the free plan, re-evaluate: backup story changes
  with the plan.

## Restore drill

Script: `scripts/restore-drill.ts` (scratch-local only; refuses non-local URLs).

What it does:
1. **Extract** — reads every row from all 88 user tables (`information_schema`,
   excludes `_prisma_migrations`).
2. **Fresh database** — `DROP`/`CREATE DATABASE kivo_restore_drill`.
3. **`prisma migrate deploy` on the empty DB** — this also validates the full
   hand-written migration chain (M1–M12) applies cleanly from zero.
4. **Load** — batched parameterized `INSERT`s (500 rows/batch) with
   `session_replication_role = 'replica'` (FK checks deferred, the pg_restore
   equivalent) and `ON CONFLICT DO NOTHING` (migrate deploy re-seeds static
   tables such as the M3 TaxRate rows — the restore must not duplicate them).
5. **Verify** — per-table row counts must match exactly; spot-checks:
   business-scoped job count and an unpaid-invoice query return expected rows.

### Drill result (2026-10-14, local scratch DB)

| Phase | Result |
|---|---|
| Extract 88 tables / 15,267 rows | ~1.0 s |
| Create fresh database | ~0.1 s |
| `migrate deploy` on empty DB | ok (~2.3 s) — full M1–M12 chain applies cleanly |
| Load 15,267 rows | ~1.4 s |
| Verify (per-table counts + spot checks) | 0 mismatches; perf-biz jobs = 10,000; unpaid-invoice sample returned |
| **Total** | **4.9 s — DRILL PASSED** |

The drill database `kivo_restore_drill` was left on the scratch Postgres for
re-verification; drop it with `DROP DATABASE "kivo_restore_drill"` when done.

## What this drill does NOT cover (user-action items)

- **No staging database exists yet.** The plan calls for restoring the latest
  *production* backup into a *staging* database and verifying the app boots
  against it. That half of the drill is blocked until staging exists.
- Setting up the staging DB (and the production backup-restore runbook against
  it) is a **user-action item**: create the staging Postgres, wire its URL
  into the deployment pipeline as a non-production secret, then re-run this
  drill's step 2–5 shape against it and record the timings here.
- App-boot verification against the restored DB was not performed (no staging
  app instance); the drill verified data-level integrity only.

## Cadence

- Drill once after staging exists, then **quarterly** (calendar reminder, not a cron).
- Re-record the table above each run; investigate any mismatch before the next deploy.
