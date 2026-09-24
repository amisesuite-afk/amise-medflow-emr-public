#!/bin/bash
# Turn on crash & freeze reporting: store your Sentry DSN in Configuration.xcconfig.
# Usage:  ~/amise-medflow-emr-public/ios/set-sentry-dsn.sh 'https://abc123@o0.ingest.sentry.io/456'
# (xcconfig treats "//" as a comment, so the DSN is written as https:/$()/… automatically.)
set -e
cd "$(dirname "$0")"
DSN="$1"
# Tolerate stray punctuation/whitespace from copy-paste (e.g. a trailing full stop).
DSN="$(printf '%s' "$DSN" | tr -d '[:space:]' | sed -E 's/[.,;:]+$//')"
if [[ ! "$DSN" =~ ^https://[0-9a-f]+@[A-Za-z0-9.-]+/[0-9]+$ ]]; then
  echo "That doesn't look like a Sentry DSN (expected https://<key>@<host>/<number>): $DSN"; exit 1
fi
if [[ "$DSN" != https://* ]]; then
  echo "Usage: $0 'https://<key>@<org>.ingest.sentry.io/<project>'"; exit 1
fi
[ -f Configuration.xcconfig ] || cp Configuration.xcconfig.example Configuration.xcconfig
grep -v '^SENTRY_DSN' Configuration.xcconfig > Configuration.xcconfig.tmp || true
echo "SENTRY_DSN = https:/\$()/${DSN#https://}" >> Configuration.xcconfig.tmp
mv Configuration.xcconfig.tmp Configuration.xcconfig
echo "Saved. Now run: ~/amise-medflow-emr-public/ios/check-build.sh, then ⌘R in Xcode."
echo "In the app: Settings → Diagnostics should say 'Crash & freeze reporting: On'."
