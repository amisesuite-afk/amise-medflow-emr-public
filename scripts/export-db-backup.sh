#!/usr/bin/env bash
# Amise MedFlow EMR — local database backup script
#
# Creates a timestamped pg_dump of the Supabase Postgres database on this
# machine. Interim mitigation while Supabase PITR (Point-in-Time Recovery)
# is not enabled on the production project — see docs/INCIDENT-RUNBOOK.md's
# "Database point-in-time recovery" section for the cost tradeoff and why
# this was deferred. export-backup.sh (source code only) does NOT cover
# patient data — this script is the piece that does.
#
# Usage: bash scripts/export-db-backup.sh [output-dir]
#
# Requires:
#   - pg_dump on PATH (install the postgresql-client package)
#   - SUPABASE_DB_URL set to the full connection string, e.g.
#       postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
#     Get this from the Supabase dashboard: Project Settings -> Database ->
#     Connection string. Set it in your own shell/.env — never hardcode it
#     here or commit it.
#
# The resulting .dump file contains real patient data. Store it encrypted
# at rest (e.g. an encrypted volume/disk image) and never commit it to git
# or sync it to an unencrypted cloud folder.

set -euo pipefail

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install the postgresql-client package first." >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set." >&2
  echo "  Get the connection string from Supabase dashboard -> Project Settings -> Database." >&2
  exit 1
fi

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
ARCHIVE_NAME="amise-medflow-db_${TIMESTAMP}.dump"

if [ -n "${1:-}" ]; then
  OUT_DIR="$1"
elif [ -d "$HOME/Desktop" ]; then
  OUT_DIR="$HOME/Desktop/Amise-DB-Backup"
else
  OUT_DIR="$HOME/Amise-DB-Backup"
fi

mkdir -p "$OUT_DIR"
DEST_PATH="${OUT_DIR}/${ARCHIVE_NAME}"

echo "Dumping Supabase database to: ${DEST_PATH}"

pg_dump "$SUPABASE_DB_URL" --format=custom --file="$DEST_PATH"

SIZE=$(du -sh "$DEST_PATH" | cut -f1)
echo ""
echo "✓ Database backup complete"
echo "  File: ${DEST_PATH}"
echo "  Size: ${SIZE}"

# Retention: keep the 14 most recent local dumps (~2 weeks if run daily)
KEEP=14
ls -1t "$OUT_DIR"/amise-medflow-db_*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | while IFS= read -r old; do
  rm -f "$old"
  echo "  Pruned old dump: $(basename "$old")"
done

echo ""
echo "To restore: pg_restore --clean --if-exists -d <target-db-url> \"${DEST_PATH}\""
echo "IMPORTANT: This dump contains real patient data — keep it encrypted at rest"
echo "and never commit it or sync it to an unencrypted cloud folder."
