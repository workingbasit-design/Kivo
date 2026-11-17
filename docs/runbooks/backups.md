# Runbook — Backups

**Status (2026-11-17, P1.0 F3):** the backup script and the restore drill
exist and pass on a local scratch DB. The **nightly production backup is
NOT running yet** — it needs 5 user-only Oracle steps (§ "User-only setup"
below). Until those are done, there is still no production backup.

## What the backup is

- **Script:** `scripts/backup-db.sh` — nightly `pg_dump -Fc` of the database
  named by `DATABASE_URL`, verified with `pg_restore --list`, old dumps
  pruned per retention. Read-only against the database; never echoes
  `DATABASE_URL`.
- **Upload hook:** `scripts/upload-backup-oci.sh` — hands the dump to OCI
  Object Storage (private bucket). Set as `BACKUP_UPLOAD_HOOK` when
  installing the cron. Without it the script warns `BACKUP OK (local-only)`
  — a dump left only on the VM is **not** a complete backup.
- **Retention:** daily dumps 30 days; Sunday dumps 91 days; 1st-of-month
  dumps 365 days (implemented in `backup-db.sh`, `prune()`).
- **Database:** PostgreSQL 16 on the Oracle VM `kivo-db-micro`
  (140.238.145.140, `ca-toronto-1`). The old Prisma Postgres (`kivo-db`)
  no longer exists — any runbook mentioning it is stale.

## User-only setup (nightly cron on the DB VM)

Only the user can do these (Oracle sign-in + VM access). Do them in order:

1. **Sign in to Oracle Cloud Console** (Mobile Authenticator) —
   tenancy `basitmomin01`, region `ca-toronto-1`.
2. **Create a private Object Storage bucket** for backups (e.g.
   `everyjob-backups`). Private — never public; dumps contain customer
   PII. Note the bucket name.
3. **Create an API key for the VM to upload** — Console → user profile →
   API Keys → Add API Key. Save the private key + fingerprint on the VM
   at `~/.oci/` (config + key files, `chmod 600`).
4. **On the VM (SSH or Cloud Shell):** install the OCI CLI; copy
   `scripts/backup-db.sh` and `scripts/upload-backup-oci.sh` from the
   repo to `/opt/everyjob/scripts/` (or `/usr/local/bin/` for the upload
   wrapper); put `DATABASE_URL` in a root-only env file
   (e.g. `/etc/everyjob/db-url`, never in the repo); add the cron line:
   `0 3 * * * TZ=America/Toronto DATABASE_URL="$(cat /etc/everyjob/db-url)" BACKUP_DIR=/var/backups/everyjob BACKUP_UPLOAD_HOOK=/usr/local/bin/everyjob-upload-backup.sh OCI_BACKUP_BUCKET=everyjob-backups /opt/everyjob/scripts/backup-db.sh >> /var/log/everyjob-backup.log 2>&1`
5. **Verify the first nightly dump** the next morning: the object must
   appear in the bucket, and `/var/log/everyjob-backup.log` must say
   `BACKUP OK` (not `local-only`). If it says `local-only`, the upload
   hook is not wired.

## Verify a backup (anytime)

```bash
pg_restore --list /var/backups/everyjob/everyjob-YYYY-MM-DD.dump | head
# must parse cleanly (TOC entries); file size must be sane (not ~0 bytes)
ls -la /var/backups/everyjob/
```

## Restore drill (monthly)

Script: `scripts/restore-drill.ts` — restores a real dump file into a
fresh database and verifies every table count + spot checks. Scratch-local
only (refuses non-local URLs). Run against the local scratch Postgres
(`127.0.0.1:54333`, see `docs/BACKUP_RESTORE.md` for the setup):

```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:54333/kivo_scratch" \
  node --experimental-strip-types scripts/restore-drill.ts \
  /var/backups/everyjob/everyjob-YYYY-MM-DD.dump
```

Record the result in `docs/BACKUP_RESTORE.md` and in the DR plan's drill
log (`~/workspace/goals/kivo-end-to-end-app-build/files/DR-PLAN.md`,
Appendix C). A restore that has never been run is not a backup.

## Restore paths (production incident)

Follow the DR plan scenarios (`DR-PLAN.md` §5): never restore blindly
over production — restore to a scratch database first, verify, then
promote. Take a fresh dump of the current (broken) database first if it
is at all readable. After any restore: `GET /api/health` must return
`db:"ok"`, then sign in and spot-check jobs/invoices/payments.

## What gets deleted when

- Deleting a business cascades per Prisma relations; there is no soft-delete. Treat deletes as permanent.
- `unsafeUnscoped` agent-proposal purges (`/api/cron/agent-purge`) hard-delete expired proposals after 24h.
