#!/usr/bin/env bash
# Upload one backup dump to OCI Object Storage (P1.0 F3 / D5 Stage 3).
#
# This is the BACKUP_UPLOAD_HOOK for scripts/backup-db.sh on the DB VM:
#   BACKUP_UPLOAD_HOOK=/usr/local/bin/everyjob-upload-backup.sh
#
# Requires: the OCI CLI (`oci`) + a configured API key (~/.oci/config),
# and OCI_BACKUP_BUCKET set to the private backup bucket name.
# Never commit credentials: the API key lives only in ~/.oci on the VM.
set -euo pipefail

: "${OCI_BACKUP_BUCKET:?OCI_BACKUP_BUCKET must be set (the private backup bucket name)}"
FILE="${1:?usage: everyjob-upload-backup.sh <dump-file>}"
[ -f "$FILE" ] || { echo "ERROR: no such file: $FILE" >&2; exit 1; }
command -v oci >/dev/null 2>&1 || { echo "ERROR: oci CLI not found on PATH" >&2; exit 1; }

NAME="$(basename "$FILE")"
echo "upload: $FILE -> oci://$OCI_BACKUP_BUCKET/$NAME"
oci os object put --bucket-name "$OCI_BACKUP_BUCKET" --file "$FILE" --name "$NAME" >/dev/null
oci os object head --bucket-name "$OCI_BACKUP_BUCKET" --name "$NAME" >/dev/null
echo "upload: verified oci://$OCI_BACKUP_BUCKET/$NAME"
