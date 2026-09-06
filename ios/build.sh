#!/bin/bash
# Automated build script for AmiseMedFlow
# Usage:
#   ./build.sh device            — build + install on connected device (Debug)
#   ./build.sh archive           — archive for export (Release)
#   ./build.sh testflight        — archive + upload to TestFlight
#   ./build.sh <device-udid>     — build + install on specific device UDID
#
# Run ./setup.sh first on a new Mac.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEME="AmiseMedFlow"
PROJECT="$SCRIPT_DIR/AmiseMedFlow.xcodeproj"
ARCHIVE="$SCRIPT_DIR/build/AmiseMedFlow.xcarchive"
EXPORT_DIR="$SCRIPT_DIR/build/export"
MODE="${1:-device}"

# ── Guard: xcconfig must exist ──────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/Configuration.xcconfig" ]; then
    echo "ERROR: Configuration.xcconfig not found."
    echo "       Run ./setup.sh first to patch your Apple Team ID."
    exit 1
fi

TEAM_ID=$(grep 'DEVELOPMENT_TEAM' "$SCRIPT_DIR/Configuration.xcconfig" \
    | grep -oE '[A-Z0-9]{10}' | head -1 || true)

if [ -z "$TEAM_ID" ]; then
    echo "ERROR: DEVELOPMENT_TEAM not set in Configuration.xcconfig."
    echo "       Run ./setup.sh first."
    exit 1
fi

echo "==> Team ID: $TEAM_ID"
echo "==> Mode:    $MODE"
echo ""

mkdir -p "$SCRIPT_DIR/build"

# ── Regenerate xcodeproj ────────────────────────────────────────────────────
if command -v xcodegen &>/dev/null; then
    echo "==> xcodegen generate..."
    cd "$SCRIPT_DIR" && xcodegen generate --quiet
fi

# ── Device build (Debug, direct install) ────────────────────────────────────
if [ "$MODE" = "device" ]; then
    # Find first connected iPad/iPhone
    DEST=$(xcrun devicectl list devices 2>/dev/null \
        | grep -E 'iPad|iPhone' | grep 'connected' \
        | head -1 | grep -oE '[0-9A-F-]{36}' | head -1 || true)

    if [ -z "$DEST" ]; then
        # Fallback: first booted simulator
        DEST=$(xcrun simctl list devices booted | grep -oE '\([0-9A-F-]{36}\)' \
            | head -1 | tr -d '()' || true)
        PLATFORM="iphonesimulator"
        echo "==> No physical device found — using simulator: $DEST"
        xcodebuild build \
            -project "$PROJECT" \
            -scheme "$SCHEME" \
            -configuration Debug \
            -destination "platform=iOS Simulator,id=$DEST" \
            -xcconfig "$SCRIPT_DIR/Configuration.xcconfig" \
            | xcpretty 2>/dev/null || cat
    else
        echo "==> Building for device: $DEST"
        xcodebuild build \
            -project "$PROJECT" \
            -scheme "$SCHEME" \
            -configuration Debug \
            -sdk iphoneos \
            -destination "platform=iOS,id=$DEST" \
            -xcconfig "$SCRIPT_DIR/Configuration.xcconfig" \
            | xcpretty 2>/dev/null || cat
    fi

# ── Specific UDID ────────────────────────────────────────────────────────────
elif [[ "$MODE" =~ ^[0-9A-Fa-f-]{25,}$ ]]; then
    echo "==> Building for UDID: $MODE"
    xcodebuild build \
        -project "$PROJECT" \
        -scheme "$SCHEME" \
        -configuration Debug \
        -sdk iphoneos \
        -destination "platform=iOS,id=$MODE" \
        -xcconfig "$SCRIPT_DIR/Configuration.xcconfig" \
        | xcpretty 2>/dev/null || cat

# ── Archive (Release) ────────────────────────────────────────────────────────
elif [ "$MODE" = "archive" ] || [ "$MODE" = "testflight" ]; then
    echo "==> Archiving (Release)..."
    xcodebuild archive \
        -project "$PROJECT" \
        -scheme "$SCHEME" \
        -configuration Release \
        -destination "generic/platform=iOS" \
        -archivePath "$ARCHIVE" \
        -xcconfig "$SCRIPT_DIR/Configuration.xcconfig" \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        | xcpretty 2>/dev/null || cat

    if [ "$MODE" = "archive" ]; then
        echo "==> Exporting IPA (Development)..."
        # Patch team ID into export options
        sed "s|<!-- TEAM_ID -->|$TEAM_ID|g" \
            "$SCRIPT_DIR/ExportOptions-Development.plist" \
            > /tmp/ExportOptions-patched.plist
        xcodebuild -exportArchive \
            -archivePath "$ARCHIVE" \
            -exportOptionsPlist /tmp/ExportOptions-patched.plist \
            -exportPath "$EXPORT_DIR" \
            DEVELOPMENT_TEAM="$TEAM_ID"
        echo "==> IPA exported to: $EXPORT_DIR"

    elif [ "$MODE" = "testflight" ]; then
        echo "==> Uploading to TestFlight..."
        xcodebuild -exportArchive \
            -archivePath "$ARCHIVE" \
            -exportOptionsPlist "$SCRIPT_DIR/ExportOptions-TestFlight.plist" \
            -exportPath "$EXPORT_DIR" \
            DEVELOPMENT_TEAM="$TEAM_ID"
        echo "==> Uploaded. Check App Store Connect → TestFlight."
    fi

else
    echo "ERROR: Unknown mode '$MODE'"
    echo "Usage: ./build.sh [device|archive|testflight|<udid>]"
    exit 1
fi

echo ""
echo "==> Done."
