#!/usr/bin/env bash
set -euo pipefail

# AmiseMedFlow iOS — one-command setup
# Run from the repo root:  bash ios/setup.sh
# Or from the ios/ dir:    bash setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=== AmiseMedFlow iOS Setup ==="
echo ""

# ── 1. Homebrew ──────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
    echo "→ Installing Homebrew…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✓ Homebrew found"
fi

# ── 2. XcodeGen ──────────────────────────────────────────────────────────────
if ! command -v xcodegen &>/dev/null; then
    echo "→ Installing XcodeGen…"
    brew install xcodegen
else
    echo "✓ XcodeGen found ($(xcodegen --version))"
fi

# ── 3. Configuration.xcconfig (Supabase credentials) ────────────────────────
# The anon key is a public read-only key already committed in deploy-dashboard.yml.
if [ ! -f "Configuration.xcconfig" ]; then
    echo "→ Writing Configuration.xcconfig…"
    cat > Configuration.xcconfig << 'XCCONFIG'
// AmiseMedFlow — Supabase configuration
// This file is gitignored. Regenerated automatically by setup.sh.

SUPABASE_URL = https://nornhfzfrlmfzaqmrzzp.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vcm5oZnpmcmxtZnphcW1yenpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5OTU5NjcsImV4cCI6MjA5NDU3MTk2N30.IQqwEuwp4_CYRj5r6H-83vjXKeob-N8z5TBwLk-rXLc

// Optional: uncomment and set your 10-character Apple Developer Team ID
// DEVELOPMENT_TEAM = XXXXXXXXXX
XCCONFIG
    echo "✓ Configuration.xcconfig written"
else
    echo "✓ Configuration.xcconfig exists"
fi

# ── 4. Generate .xcodeproj ───────────────────────────────────────────────────
echo ""
echo "→ Generating AmiseMedFlow.xcodeproj…"
xcodegen generate --spec project.yml
echo "✓ AmiseMedFlow.xcodeproj generated"

# ── 5. Open in Xcode ─────────────────────────────────────────────────────────
echo ""
echo "→ Opening in Xcode…"
open AmiseMedFlow.xcodeproj

echo ""
echo "=== Setup complete ==="
echo ""
echo "In Xcode:"
echo "  1. Wait for package resolution to finish (bottom status bar)"
echo "  2. Select your iPhone as the run destination (top-left dropdown)"
echo "  3. Press  ⌘R  to build and run"
echo ""
echo "If you see 'Signing requires a development team':"
echo "  Signing & Capabilities → Team → select your Apple ID"
echo ""
