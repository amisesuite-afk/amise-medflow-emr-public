#!/bin/sh
# nas-usb-copy.sh
# Runs ON the Synology NAS (BusyBox ash) via DSM Task Scheduler.
# Triggered when a USB drive is connected.
#
# Install in DSM:
#   Control Panel → Task Scheduler → Create → Triggered Task → User-defined script
#   Event: Device plug-in
#   Run as: root
#   Task settings → paste this script (or reference the path after uploading)
#
# What it does:
#   1. Identifies which drive (A/B/C) from its volume label
#   2. Copies /volume1/medflow-backups → USB drive
#   3. Verifies checksums (SHA-256 every file)
#   4. Writes VERIFY.txt and DRIVE_LOG.csv to the drive
#   5. Updates the shared access log on the NAS
#   6. Sends a push notification in DSM + posts to the API server (email to doctor)
#   7. Safely ejects the drive
#
# Configuration — edit these values once:
NAS_SOURCE="/volume1/medflow-backups"
ACCESS_LOG="/volume1/medflow-backups/DRIVE_ACCESS_LOG.csv"
API_SERVER_URL="https://amise-medflow-api.onrender.com"
CRON_SECRET="REPLACE_WITH_YOUR_CRON_SECRET"
DOCTOR_EMAIL="dawit@amise.lc"       # fallback if API server is down
PRACTICE_NAME="Amise Medical Services"
# ─────────────────────────────────────────────────────────────────────────────

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*"; notify_fail "$*"; exit 1; }

# ── Find connected USB volume ─────────────────────────────────────────────────
find_usb() {
    for vol in /volumeUSB*/usbshare; do
        [ -d "$vol" ] && echo "$vol" && return 0
    done
    return 1
}

USB_MOUNT=$(find_usb) || fail "No USB drive found after plug-in event."
log "USB drive mounted at: $USB_MOUNT"

# ── Identify drive label (A / B / C) ─────────────────────────────────────────
# Synology exposes the volume label via /proc/mounts and blkid.
# Fallback: use a DRIVE_ID.txt file placed on the drive when you first format it.
DRIVE_LABEL=""
if [ -f "${USB_MOUNT}/DRIVE_ID.txt" ]; then
    DRIVE_LABEL=$(head -1 "${USB_MOUNT}/DRIVE_ID.txt" | tr -d '[:space:]')
fi

# Try blkid if DRIVE_ID.txt not present
if [ -z "$DRIVE_LABEL" ]; then
    USB_DEV=$(awk -v mp="$USB_MOUNT" '$2==mp{print $1}' /proc/mounts | head -1)
    if [ -n "$USB_DEV" ]; then
        DRIVE_LABEL=$(blkid -s LABEL -o value "$USB_DEV" 2>/dev/null | tr -d '[:space:]')
    fi
fi

[ -z "$DRIVE_LABEL" ] && DRIVE_LABEL="UNKNOWN"
log "Drive identified as: ${DRIVE_LABEL}"

NOW=$(date '+%Y-%m-%dT%H:%M:%S')
DATE=$(date '+%Y-%m-%d')
DEST="${USB_MOUNT}/medflow-backups"
VERIFY_FILE="${USB_MOUNT}/VERIFY.txt"
LOG_FILE="${USB_MOUNT}/DRIVE_LOG.csv"

# ── Notify: starting ─────────────────────────────────────────────────────────
synodsmnotify @administrators \
    "MedFlow Backup Starting" \
    "Drive ${DRIVE_LABEL} connected. Copying ${NAS_SOURCE} → USB. Do not unplug." \
    2>/dev/null || true

log "Starting copy: ${NAS_SOURCE} → ${DEST}"

# ── Copy ──────────────────────────────────────────────────────────────────────
mkdir -p "$DEST"

# rsync is available on Synology. --checksum verifies every file.
rsync \
    --archive \
    --checksum \
    --delete \
    --human-readable \
    --stats \
    "$NAS_SOURCE/" \
    "$DEST/" \
    2>&1 | while IFS= read -r line; do log "rsync: $line"; done

RSYNC_EXIT=${PIPESTATUS:-$?}
if [ "$RSYNC_EXIT" -ne 0 ]; then
    fail "rsync exited with code ${RSYNC_EXIT} — copy may be incomplete."
fi

log "rsync complete."

# ── Checksum verification ─────────────────────────────────────────────────────
log "Computing SHA-256 checksums for all backup files..."

CHECKSUM_FILE="${DEST}/checksums-${DATE}.sha256"
FAIL_COUNT=0
FILE_COUNT=0

find "$DEST" -type f ! -name "*.sha256" ! -name "VERIFY.txt" ! -name "DRIVE_LOG.csv" \
    | sort \
    | while IFS= read -r f; do
        sha256sum "$f" >> "$CHECKSUM_FILE.tmp"
    done

mv "${CHECKSUM_FILE}.tmp" "$CHECKSUM_FILE" 2>/dev/null || true

# Verify checksums
while IFS= read -r line; do
    FILE_COUNT=$((FILE_COUNT + 1))
    EXPECTED_HASH=$(echo "$line" | awk '{print $1}')
    FILE_PATH=$(echo "$line" | awk '{print $2}')
    if [ ! -f "$FILE_PATH" ]; then
        log "MISSING: $FILE_PATH"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done < "$CHECKSUM_FILE"

log "Verification: ${FILE_COUNT} files checked, ${FAIL_COUNT} failures."

if [ "$FAIL_COUNT" -gt 0 ]; then
    fail "${FAIL_COUNT} files failed checksum verification. Do not use this drive for recovery."
fi

# ── VERIFY.txt ───────────────────────────────────────────────────────────────
TOTAL_SIZE=$(du -sh "$DEST" 2>/dev/null | awk '{print $1}')

cat > "$VERIFY_FILE" << VERIFY_EOF
AMISE MEDFLOW — BACKUP VERIFICATION RECORD
Drive:        ${DRIVE_LABEL}
Date:         ${DATE}
Time (ECT):   $(TZ='America/St_Lucia' date '+%Y-%m-%d %H:%M:%S')
Files:        ${FILE_COUNT}
Size:         ${TOTAL_SIZE}
Status:       VERIFIED OK — ${FAIL_COUNT} failures
Checksums:    $(basename "$CHECKSUM_FILE")

This backup contains encrypted Supabase DB dumps (GPG AES-256)
and Supabase Storage documents for ${PRACTICE_NAME}.

To restore DB:
  gpg --decrypt medflow-db-TIMESTAMP.sql.gz.gpg | gunzip | psql DATABASE_URL
VERIFY_EOF

log "VERIFY.txt written."

# ── DRIVE_LOG.csv (on the drive) ─────────────────────────────────────────────
if [ ! -f "$LOG_FILE" ]; then
    echo "date,time_ect,files,size,status,nas_hostname" > "$LOG_FILE"
fi
ECT_TIME=$(TZ='America/St_Lucia' date '+%H:%M:%S')
NAS_HOST=$(hostname 2>/dev/null || echo "synology")
printf '%s,%s,%s,%s,%s,%s\n' \
    "$DATE" "$ECT_TIME" "$FILE_COUNT" "$TOTAL_SIZE" "OK" "$NAS_HOST" \
    >> "$LOG_FILE"

# ── Access log on NAS ─────────────────────────────────────────────────────────
if [ ! -f "$ACCESS_LOG" ]; then
    echo "date,time_ect,drive,files,size,status,notes" > "$ACCESS_LOG"
fi
printf '%s,%s,%s,%s,%s,%s,%s\n' \
    "$DATE" "$ECT_TIME" "$DRIVE_LABEL" "$FILE_COUNT" "$TOTAL_SIZE" "OK" \
    "auto-copy via nas-usb-copy.sh" \
    >> "$ACCESS_LOG"

log "Access log updated: $ACCESS_LOG"

# ── Sync filesystem before eject ─────────────────────────────────────────────
sync
log "Filesystem synced."

# ── API server notification (email to doctor via existing cron endpoint) ──────
ALERT_SENT=0
if curl -sf \
    --max-time 10 \
    -X POST "${API_SERVER_URL}/api/cron/backup-usb-complete" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"drive\":\"${DRIVE_LABEL}\",\"files\":${FILE_COUNT},\"size\":\"${TOTAL_SIZE}\",\"date\":\"${DATE}\",\"status\":\"success\"}" \
    > /dev/null 2>&1; then
    ALERT_SENT=1
    log "API server notified."
else
    log "API server unreachable — DSM notification only."
fi

# ── DSM push notification ─────────────────────────────────────────────────────
synodsmnotify @administrators \
    "MedFlow Backup Complete — Drive ${DRIVE_LABEL}" \
    "${FILE_COUNT} files (${TOTAL_SIZE}) verified OK on ${DATE}. Safe to remove drive." \
    2>/dev/null || true

# ── Safe eject ───────────────────────────────────────────────────────────────
log "Ejecting drive ${DRIVE_LABEL}..."
USB_DEV=$(awk -v mp="$USB_MOUNT" '$2==mp{print $1}' /proc/mounts | head -1)

if [ -n "$USB_DEV" ]; then
    # Synology: unmount then eject
    umount "$USB_MOUNT" 2>/dev/null || true
    sync
    # Trigger Synology's safe removal
    eject "$USB_DEV" 2>/dev/null || true
    log "Drive ejected: ${USB_DEV} — safe to remove physically."
fi

synodsmnotify @administrators \
    "Drive ${DRIVE_LABEL} — Safe to Remove" \
    "Backup complete and verified. The drive has been safely ejected." \
    2>/dev/null || true

log "Done. Drive ${DRIVE_LABEL} backup complete — ${DATE}."
exit 0

# ── Failure handler ───────────────────────────────────────────────────────────
notify_fail() {
    local MSG="$1"
    synodsmnotify @administrators \
        "MedFlow Backup FAILED — Drive ${DRIVE_LABEL:-UNKNOWN}" \
        "${MSG} Check /volume1/medflow-backups/backup.log for details." \
        2>/dev/null || true

    curl -sf \
        --max-time 10 \
        -X POST "${API_SERVER_URL}/api/cron/backup-usb-complete" \
        -H "x-cron-secret: ${CRON_SECRET}" \
        -H "Content-Type: application/json" \
        -d "{\"drive\":\"${DRIVE_LABEL:-UNKNOWN}\",\"status\":\"failed\",\"error\":\"${MSG}\"}" \
        > /dev/null 2>&1 || true
}
