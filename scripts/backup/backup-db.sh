#!/usr/bin/env bash
# backup-db.sh — Dump Supabase Postgres, encrypt, ship to NAS via rclone SFTP.
#
# Required env:
#   DATABASE_URL            postgres://... connection string (Supabase → Settings → Database)
#   NAS_BACKUP_PATH         Root path on NAS, e.g. /volume1/medflow-backups
#   BACKUP_GPG_PASSPHRASE   Symmetric encryption passphrase (keep in a password manager)
#
# Optional:
#   DRY_RUN=1               Print what would happen; do not upload or delete.

set -euo pipefail

NOW=$(date -u +%Y%m%dT%H%M%SZ)
DATE=$(date -u +%Y-%m-%d)
MONTH=$(date -u +%Y-%m)
YEAR=$(date -u +%Y)
DAY_OF_MONTH=$(date -u +%-d)

DUMP_FILE="/tmp/medflow-db-${NOW}.sql.gz"
ENC_FILE="${DUMP_FILE}.gpg"

NAS_DAILY="${NAS_BACKUP_PATH}/db/daily"
NAS_MONTHLY="${NAS_BACKUP_PATH}/db/monthly"
NAS_YEARLY="${NAS_BACKUP_PATH}/db/yearly"

log() { echo "[backup-db] $*"; }

log "Starting database backup — ${NOW}"

# ── 1. Dump ──────────────────────────────────────────────────────────────────
log "Dumping Supabase Postgres..."
pg_dump \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  "${DATABASE_URL}" \
  | gzip -9 > "${DUMP_FILE}"

DUMP_SIZE=$(wc -c < "${DUMP_FILE}")
log "Dump complete: ${DUMP_SIZE} bytes (compressed)"

# ── 2. Encrypt ───────────────────────────────────────────────────────────────
log "Encrypting with GPG (symmetric AES256)..."
gpg \
  --batch \
  --yes \
  --passphrase "${BACKUP_GPG_PASSPHRASE}" \
  --cipher-algo AES256 \
  --symmetric \
  "${DUMP_FILE}"

rm -f "${DUMP_FILE}"

ENC_SIZE=$(wc -c < "${ENC_FILE}")
log "Encrypted: ${ENC_SIZE} bytes"

# ── 3. Upload to NAS ─────────────────────────────────────────────────────────
REMOTE_DAILY="nas:${NAS_DAILY}/${DATE}/"
REMOTE_FILENAME="medflow-db-${NOW}.sql.gz.gpg"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "[DRY RUN] Would upload to ${REMOTE_DAILY}${REMOTE_FILENAME}"
else
  log "Uploading to NAS: ${REMOTE_DAILY}${REMOTE_FILENAME}"
  rclone copyto \
    --stats 0 \
    --retries 3 \
    "${ENC_FILE}" \
    "nas:${NAS_DAILY}/${DATE}/${REMOTE_FILENAME}"
  log "Daily upload complete."

  # Monthly copy — on the 1st of each month
  if [[ "${DAY_OF_MONTH}" == "1" ]]; then
    rclone copyto \
      --stats 0 \
      --retries 3 \
      "${ENC_FILE}" \
      "nas:${NAS_MONTHLY}/${MONTH}/medflow-db-${MONTH}.sql.gz.gpg"
    log "Monthly copy written: ${MONTH}"
  fi

  # Yearly copy — on 1 Jan
  if [[ "$(date -u +%m-%d)" == "01-01" ]]; then
    rclone copyto \
      --stats 0 \
      --retries 3 \
      "${ENC_FILE}" \
      "nas:${NAS_YEARLY}/${YEAR}/medflow-db-${YEAR}.sql.gz.gpg"
    log "Yearly copy written: ${YEAR}"
  fi
fi

rm -f "${ENC_FILE}"
log "Database backup done."
