# BACKUP_RESTORE.md — Backups + restore drill

## Production backups (Oracle Postgres 16, `kivo-db-micro`)

- **Nightly `pg_dump -Fc`** on the DB VM via cron (~03:00 Toronto), script
  `scripts/backup-db.sh`, uploaded the same night to a **private** OCI
  Object Storage bucket by `scripts/upload-backup-oci.sh`
  (`BACKUP_UPLOAD_HOOK`). Retention: daily 30 days, Sunday 91 days,
  1st-of-month 365 days.
- **Status (2026-11-17):** script + upload wrapper + restore drill are
  built and verified on a local scratch DB. The **nightly cron is NOT
  installed yet** — it needs the 5 user-only Oracle steps in
  `docs/runbooks/backups.md` ("User-only setup"). Until those are done,
  there is still no production backup.
- The old Prisma Postgres (`kivo-db`) no longer exists. Any doc mentioning
  Vercel Storage backups or point-in-time recovery for it is stale.

## Local scratch DB (for drills)

```bash
# One-time setup (as the postgres OS user; data dir on local disk):
su postgres -c '/usr/lib/postgresql/16/bin/initdb -D /var/tmp/kivo-scratch-pg -U postgres --auth=trust'
# + append to /var/tmp/kivo-scratch-pg/postgresql.conf:
#   port = 54333, listen_addresses = '127.0.0.1', shared_buffers = 32MB, max_connections = 20
su postgres -c '/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/kivo-scratch-pg -l /var/tmp/kivo-scratch-pg/logfile start'
psql -h 127.0.0.1 -p 54333 -U postgres -c "CREATE DATABASE kivo_scratch;"
DATABASE_URL="postgresql://postgres@127.0.0.1:54333/kivo_scratch" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres@127.0.0.1:54333/kivo_scratch" node --experimental-strip-types scripts/seed-staging.ts
```

## Restore drill

Script: `scripts/restore-drill.ts` (scratch-local only; refuses non-local
URLs). Restores a **real** `pg_dump -Fc` artifact with `pg_restore` into
a fresh database and verifies it.

What it does:
1. **Source counts** — reads per-table row counts from the source DB
   (`information_schema`, all `public` base tables).
2. **Fresh database** — `DROP`/`CREATE DATABASE kivo_restore_drill`.
3. **Restore** — `pg_restore --dbname kivo_restore_drill --no-owner <dump>`.
4. **Verify** — every table count must match exactly; unexpected tables
   in the restored DB also fail.
5. **Spot checks (data-driven, no hardcoded seed ids)** — the first
   business's customers/jobs/invoices match, and the first invoice's
   `totalCents` and completed-payment sum match.

### Drill result (2026-11-17, local scratch DB, P1.0 F3)

| Phase | Result |
|---|---|
| Backup: `backup-db.sh` → `everyjob-2026-11-17.dump` | 351,385 bytes, 864 TOC entries, `pg_restore --list` clean |
| Source: 107 tables / 101 rows (seed-staging two-business dataset) | migrate deploy clean through m36 |
| `pg_restore` into fresh `kivo_restore_drill` | ok (~0.6 s) |
| Verify (per-table counts + spot checks) | **0 mismatches across 107 tables**; first business customers 3 / jobs 3 / invoices 2; invoice `seed-inv-partial` totalCents 226000, completed payments 100000 |
| **Total** | **~1.5 s — DRILL PASSED** |

Regression coverage: `src/lib/__tests__/backup-script.test.mts`
(script guards, no DB) and `src/lib/__tests__/backup-restore.test.db.mts`
(full dump → restore → compare, needs a real Postgres; skips only when
`pg_dump` is missing or older than the server).

## What this drill does NOT cover (user-action items)

- **No nightly production backup yet.** The drill proves the tooling on
  scratch data; production dumps start only after the 5 user-only Oracle
  steps (runbook). Re-run the drill against a real production dump once
  the cron is live.
- **No staging database exists yet.** Restoring the latest production
  backup into a staging database and verifying the app boots against it
  is still blocked until staging exists.
- App-boot verification against the restored DB was not performed (no
  staging app instance); the drill verified data-level integrity only.
- **Attachments are not in backup scope** (Vercel Blob; known gap, DR
  plan P1-6).

## Cadence

- Drill **monthly** (agent runs, result recorded here + DR plan Appendix C).
- Re-run after every infra change (VM rebuild, Postgres upgrade, password
  rotation). Re-record the table above each run; investigate any mismatch
  before the next deploy.
