#!/usr/bin/env bash
# EveryJob nightly database backup (P1.0 F3 / D5 Stage 3).
#
# Takes a compressed logical dump (pg_dump -Fc) of the database named by
# DATABASE_URL, verifies the dump parses (pg_restore --list), prunes old
# dumps per retention policy, and — if BACKUP_UPLOAD_HOOK is set — hands
# the dump to an off-host upload command (e.g. an OCI Object Storage
# `oci os object put` wrapper). A dump that stays on the same host is NOT
# a complete backup: the hook is what makes this survive a dead VM.
#
# Designed to run on the database VM from cron, ~03:00 Toronto time:
#   0 3 * * * TZ=America/Toronto DATABASE_URL="$(cat /etc/everyjob/db-url)" \
#       BACKUP_DIR=/var/backups/everyjob \
#       BACKUP_UPLOAD_HOOK=/usr/local/bin/everyjob-upload-backup.sh \
#       /opt/everyjob/scripts/backup-db.sh >> /var/log/everyjob-backup.log 2>&1
#
# The script itself lives in the repo so the logic is reviewed and tested;
# the VM copy is deployed from here (see docs/runbooks/backups.md).
# NEVER commit DATABASE_URL or any credential: it arrives via environment.
#
# Safety:
# - Read-only against the database (pg_dump never writes to it).
# - DATABASE_URL is never echoed or logged (it carries the DB password).
# - Refuses to run without DATABASE_URL, without pg_dump/pg_restore,
#   or when BACKUP_DIR cannot be created.
# - Exit 0 = dump written + verified (+ uploaded when a hook is set).
#   A missing upload hook is a WARNING, not a failure: the local dump is
#   still written, but the runbook treats it as incomplete until the
#   off-host copy exists.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set (never commit it; on the DB VM it comes from the host env file)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/everyjob}"
DAILY_KEEP_DAYS="${BACKUP_DAILY_KEEP_DAYS:-30}"
WEEKLY_KEEP_DAYS="${BACKUP_WEEKLY_KEEP_DAYS:-91}"
MONTHLY_KEEP_DAYS="${BACKUP_MONTHLY_KEEP_DAYS:-365}"
UPLOAD_HOOK="${BACKUP_UPLOAD_HOOK:-}"

command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump not found on PATH" >&2; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "ERROR: pg_restore not found on PATH" >&2; exit 1; }

mkdir -p "$BACKUP_DIR" || { echo "ERROR: cannot create BACKUP_DIR=$BACKUP_DIR" >&2; exit 1; }
[ -w "$BACKUP_DIR" ] || { echo "ERROR: BACKUP_DIR=$BACKUP_DIR is not writable" >&2; exit 1; }

STAMP="$(date +%F)"
FILE="$BACKUP_DIR/everyjob-$STAMP.dump"

echo "backup: dumping to $FILE"
# -Fc = custom format (compressed, restores with pg_restore). The URL is
# passed as the dbname; pg_dump never prints the password in errors.
pg_dump -Fc --dbname="$DATABASE_URL" -f "$FILE"

echo "backup: verifying dump parses"
pg_restore --list "$FILE" >/dev/null

SIZE_BYTES="$(stat -c%s "$FILE")"
if [ "$SIZE_BYTES" -lt 1024 ]; then
  echo "ERROR: dump suspiciously small ($SIZE_BYTES bytes): $FILE" >&2
  exit 1
fi

# Retention: keep daily dumps DAILY_KEEP_DAYS; keep Sunday dumps
# WEEKLY_KEEP_DAYS; keep 1st-of-month dumps MONTHLY_KEEP_DAYS.
prune() {
  local now cutoff_daily cutoff_weekly cutoff_monthly f base d epoch day dow
  now="$(date +%s)"
  cutoff_daily=$((now - DAILY_KEEP_DAYS * 86400))
  cutoff_weekly=$((now - WEEKLY_KEEP_DAYS * 86400))
  cutoff_monthly=$((now - MONTHLY_KEEP_DAYS * 86400))
  for f in "$BACKUP_DIR"/everyjob-*.dump; do
    [ -e "$f" ] || continue
    base="$(basename "$f" .dump)"   # everyjob-YYYY-MM-DD
    d="${base#everyjob-}"
    date -d "$d" +%s >/dev/null 2>&1 || continue
    epoch="$(date -d "$d" +%s)"
    day="${d##*-}"
    dow="$(date -d "$d" +%u)"      # 7 = Sunday
    if [ "$epoch" -ge "$cutoff_daily" ]; then continue; fi
    if [ "$day" = "01" ] && [ "$epoch" -ge "$cutoff_monthly" ]; then continue; fi
    if [ "$dow" = "7" ] && [ "$epoch" -ge "$cutoff_weekly" ]; then continue; fi
    echo "backup: pruning $f"
    rm -f "$f"
  done
}
prune

if [ -n "$UPLOAD_HOOK" ]; then
  echo "backup: uploading via $UPLOAD_HOOK"
  "$UPLOAD_HOOK" "$FILE"
  echo "BACKUP OK: $FILE (${SIZE_BYTES} bytes, uploaded)"
else
  echo "WARNING: no BACKUP_UPLOAD_HOOK set — dump is local-only, NOT a complete backup (see docs/runbooks/backups.md)"
  echo "BACKUP OK (local-only): $FILE (${SIZE_BYTES} bytes)"
fi
