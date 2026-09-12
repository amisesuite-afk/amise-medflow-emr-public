#!/usr/bin/env bash
# backup-storage.sh — Mirror Supabase Storage (patient documents) to NAS.
#
# Uses rclone with the supabase-storage remote (S3-compatible).
# Documents are mirrored verbatim — no encryption needed since NAS
# volume-level AES-256 encryption covers them at rest (Synology DSM).
#
# Required env:
#   NAS_BACKUP_PATH           Root path on NAS
#   SUPABASE_STORAGE_BUCKET   Bucket to mirror (default: patient-documents)
#
# Optional:
#   DRY_RUN=1                 Print what would happen; do not transfer.

set -euo pipefail

NOW=$(date -u +%Y%m%dT%H%M%SZ)
BUCKET="${SUPABASE_STORAGE_BUCKET:-patient-documents}"
NAS_STORAGE_PATH="${NAS_BACKUP_PATH}/storage/${BUCKET}"

log() { echo "[backup-storage] $*"; }

log "Mirroring Supabase Storage bucket '${BUCKET}' → NAS:${NAS_STORAGE_PATH}"

RCLONE_FLAGS=(
  --stats 60s
  --retries 3
  --retries-sleep 10s
  --transfers 4
  --checkers 8
  --log-level INFO
)

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  log "[DRY RUN] Would sync supabase-storage:${BUCKET} → nas:${NAS_STORAGE_PATH}"
  rclone ls "supabase-storage:${BUCKET}" "${RCLONE_FLAGS[@]}" || true
else
  # sync: delete NAS files that no longer exist in Supabase (mirrors deletions)
  rclone sync \
    "${RCLONE_FLAGS[@]}" \
    "supabase-storage:${BUCKET}" \
    "nas:${NAS_STORAGE_PATH}"

  TRANSFERRED=$(rclone lsjson "nas:${NAS_STORAGE_PATH}" --recursive 2>/dev/null | python3 -c "
import sys, json
items = json.load(sys.stdin)
total = sum(i.get('Size', 0) for i in items if not i.get('IsDir'))
print(f'{len(items)} objects, {total:,} bytes')
" 2>/dev/null || echo "count unavailable")

  log "Mirror complete: ${TRANSFERRED}"
fi

log "Storage backup done — ${NOW}"
