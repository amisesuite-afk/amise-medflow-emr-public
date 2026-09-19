#!/usr/bin/env bash
# retain.sh — Enforce backup retention policy on NAS.
#
# Policy (HIPAA 6-year minimum; we keep 7 years):
#   DB daily:    30 directories (one per day)
#   DB monthly:  12 directories (one per month)
#   DB yearly:   7  directories (one per year)
#   Storage:     no auto-delete — mirrors live bucket (rclone sync handles it)
#
# Required env:
#   NAS_BACKUP_PATH   Root path on NAS
#
# Optional:
#   DRY_RUN=1         Print what would be deleted; do not delete.

set -euo pipefail

log() { echo "[retain] $*"; }

delete_oldest() {
  local path="$1"
  local keep="$2"
  local label="$3"

  # List directories sorted oldest first, skip the newest $keep
  mapfile -t all < <(
    rclone lsf "nas:${path}/" --dirs-only 2>/dev/null \
    | sort \
    | head -n -"${keep}"
  )

  if [[ ${#all[@]} -eq 0 ]]; then
    log "${label}: nothing to prune (${keep} kept)"
    return
  fi

  for dir in "${all[@]}"; do
    dir="${dir%/}"
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
      log "[DRY RUN] Would delete ${label}: nas:${path}/${dir}"
    else
      log "Pruning ${label}: nas:${path}/${dir}"
      rclone purge "nas:${path}/${dir}" --stats 0
    fi
  done
}

NAS_DB="${NAS_BACKUP_PATH}/db"

delete_oldest "${NAS_DB}/daily"   30 "daily"
delete_oldest "${NAS_DB}/monthly" 12 "monthly"
delete_oldest "${NAS_DB}/yearly"  7  "yearly"

log "Retention sweep complete."
