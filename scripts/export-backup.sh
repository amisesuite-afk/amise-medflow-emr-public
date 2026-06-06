#!/usr/bin/env bash
# Amise MedFlow EMR — source backup script
# Creates a timestamped tar.gz of all source files, excluding build artefacts.
# Usage: bash scripts/export-backup.sh [output-dir]
# Output dir defaults to ~/Desktop if it exists, otherwise ~/

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
ARCHIVE_NAME="amise-medflow-emr_${TIMESTAMP}.tar.gz"

if [ -d "$HOME/Desktop" ]; then
  OUT_DIR="$HOME/Desktop"
elif [ -n "${1:-}" ]; then
  OUT_DIR="$1"
else
  OUT_DIR="$HOME"
fi

mkdir -p "$OUT_DIR"
ARCHIVE_PATH="${OUT_DIR}/${ARCHIVE_NAME}"

echo "Creating backup: ${ARCHIVE_PATH}"
echo "Source: ${REPO_ROOT}"

tar -czf "$ARCHIVE_PATH" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.pnpm-store' \
  --exclude='dist' \
  --exclude='.next' \
  --exclude='build' \
  --exclude='*.log' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  -C "$(dirname "$REPO_ROOT")" \
  "$(basename "$REPO_ROOT")"

SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
echo ""
echo "✓ Backup complete"
echo "  File:   ${ARCHIVE_PATH}"
echo "  Size:   ${SIZE}"
echo ""
echo "Key files included:"
echo "  artifacts/api-server/src/     — Express API (routes, lib)"
echo "  artifacts/dashboard/src/      — Staff Vite dashboard"
echo "  artifacts/front-desk/app/     — Patient Next.js portal"
echo "  lib/triage-engine/src/        — Shared triage rules"
echo "  supabase-schema.sql           — Full DB schema + RLS"
echo "  supabase-ai-adaptive-intake-migration.sql"
echo "  render.yaml                   — Render deploy config"
echo ""
echo "To restore: extract with tar -xzf ${ARCHIVE_NAME}"
