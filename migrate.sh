#!/usr/bin/env bash
# migrate.sh — run Supabase migrations against a self-hosted instance
#
# Usage:
#   ./migrate.sh                         # run ALL supabase*.sql files in order
#   ./migrate.sh supabase-some-file.sql  # run one specific file
#
# Required env vars (or edit defaults below):
#   PGHOST     — host running the Supabase Docker stack  (default: localhost)
#   PGPORT     — PostgreSQL port                         (default: 5432)
#   PGUSER     — database user                           (default: postgres)
#   PGPASSWORD — database password                       (from your .env JWT_SECRET / POSTGRES_PASSWORD)
#   PGDATABASE — database name                           (default: postgres)

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"

if [[ -z "${PGPASSWORD:-}" ]]; then
  echo "Error: PGPASSWORD is not set."
  echo "Set it to the POSTGRES_PASSWORD value from your supabase/docker/.env file."
  exit 1
fi

export PGPASSWORD PGHOST PGPORT PGUSER PGDATABASE

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

run_file() {
  local file="$1"
  echo "  → $(basename "$file")"
  psql --set ON_ERROR_STOP=on -f "$file"
}

if [[ $# -eq 1 ]]; then
  # Single file
  FILE="$SCRIPT_DIR/$1"
  if [[ ! -f "$FILE" ]]; then
    echo "Error: file not found: $FILE"
    exit 1
  fi
  echo "Running migration: $1"
  run_file "$FILE"
  echo "Done."
else
  # All files, sorted by name (numeric prefix keeps order stable)
  FILES=( $(ls "$SCRIPT_DIR"/supabase*.sql 2>/dev/null | sort) )
  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "No supabase*.sql files found in $SCRIPT_DIR"
    exit 1
  fi
  echo "Running ${#FILES[@]} migration files against $PGHOST:$PGPORT/$PGDATABASE"
  for f in "${FILES[@]}"; do
    run_file "$f"
  done
  echo ""
  echo "All migrations complete."
fi
