#!/usr/bin/env bash
# Writes ios/Configuration.xcconfig from environment variables (CI release builds).
# Must run BEFORE `xcodegen generate`: project.yml lists this file as the target's configFile,
# and XcodeGen refuses to generate when it is missing.
#
# In an xcconfig, "//" starts a comment, so URLs are written as "https:/$()/host/…"
# (the same escaping set-sentry-dsn.sh uses). Never echo the values.
set -euo pipefail
cd "$(dirname "$0")"

esc() { printf '%s' "${1:-}" | sed 's#//#/$()/#'; }
dsn="$(printf '%s' "${SENTRY_DSN:-}" | tr -d '[:space:]')"
dsn="${dsn%.}"   # tolerate a stray trailing full stop, as set-sentry-dsn.sh does

{
  echo "// Auto-generated in CI by ci-write-xcconfig.sh — do not commit"
  echo "DEVELOPMENT_TEAM = ${DEVELOPER_TEAM_ID:-}"
  echo "SUPABASE_URL = $(esc "${SUPABASE_URL:-}")"
  echo "SUPABASE_ANON_KEY = ${SUPABASE_ANON_KEY:-}"
  echo "SENTRY_DSN = $(esc "$dsn")"
} > Configuration.xcconfig

if [ -n "$dsn" ]; then echo "Configuration.xcconfig written (crash reporting DSN set)."
else echo "::warning::SENTRY_DSN secret not set — crash reporting will be OFF in this build."; fi
