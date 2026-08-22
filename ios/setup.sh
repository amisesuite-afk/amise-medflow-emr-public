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

# ── 3. Configuration.xcconfig (Supabase secrets) ─────────────────────────────
if [ ! -f "Configuration.xcconfig" ]; then
    echo ""
    echo "→ Creating Configuration.xcconfig from example…"
    cp Configuration.xcconfig.example Configuration.xcconfig
    echo ""
    echo "  ╔═══════════════════════════════════════════════════════════════╗"
    echo "  ║  ACTION REQUIRED: fill in your Supabase URL and anon key     ║"
    echo "  ║                                                               ║"
    echo "  ║  Open:  ios/Configuration.xcconfig                           ║"
    echo "  ║  Set:   SUPABASE_URL  = https://xxxx.supabase.co             ║"
    echo "  ║         SUPABASE_ANON_KEY = eyJ…                             ║"
    echo "  ║                                                               ║"
    echo "  ║  (Find these in Supabase dashboard → Project Settings → API) ║"
    echo "  ╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    read -rp "  Press Enter when you have saved Configuration.xcconfig… "
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
