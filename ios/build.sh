#!/bin/bash
# Automated build script for AmiseMedFlow
# Usage:
#   ./build.sh <device-udid>     — build + install on specific device UDID
#   ./build.sh device            — build + install on first connected device
#   ./build.sh archive           — archive for IPA export (Release)
#   ./build.sh testflight        — archive + upload to TestFlight (Release)
#
# Run ./setup.sh first on a new Mac to patch your Apple Team ID.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEME="AmiseMedFlow"
PROJECT="$SCRIPT_DIR/AmiseMedFlow.xcodeproj"
ARCHIVE="$SCRIPT_DIR/build/AmiseMedFlow.xcarchive"
EXPORT_DIR="$SCRIPT_DIR/build/export"
MODE="${1:-device}"

# ── Guard: xcodeproj must exist ────────────────────────────────────────────────
if [ ! -d "$PROJECT" ]; then
    echo "ERROR: AmiseMedFlow.xcodeproj not found."
    echo "       Run: xcodegen generate  (then ./setup.sh)"
    exit 1
fi

# ── Guard: Configuration.xcconfig must exist ───────────────────────────────
if [ ! -f "$SCRIPT_DIR/Configuration.xcconfig" ]; then
    echo "ERROR: Configuration.xcconfig not found. Run ./setup.sh first."
    exit 1
fi

TEAM_ID=$(grep 'DEVELOPMENT_TEAM' "$SCRIPT_DIR/Configuration.xcconfig" \
    | grep -oE '[A-Z0-9]{10}' | head -1 || true)

if [ -z "$TEAM_ID" ]; then
    echo "ERROR: DEVELOPMENT_TEAM not set. Run ./setup.sh first."
    exit 1
fi

echo "==> Team ID: $TEAM_ID"
echo "==> Mode:    $MODE"
echo ""

mkdir -p "$SCRIPT_DIR/build"

# ── Helper: run xcodebuild, pretty-print if xcpretty is available ──────────
run_build() {
    if command -v xcpretty &>/dev/null; then
        "$@" | xcpretty
    else
        "$@"
    fi
}

# ── Helper: install .app onto a device ─────────────────────────────────────
install_app() {
    local UDID="$1"
    echo "==> Locating built .app..."
    APP=$(find ~/Library/Developer/Xcode/DerivedData -name "${SCHEME}.app" \
        -path "*/Debug-iphoneos/*" 2>/dev/null | head -1 || true)

    if [ -z "$APP" ]; then
        echo "ERROR: Could not find ${SCHEME}.app in DerivedData."
        echo "       Build may have failed. Check output above."
        exit 1
    fi

    echo "==> Found: $APP"
    echo "==> Installing on device $UDID..."

    if xcrun devicectl device install app --device "$UDID" "$APP" 2>/dev/null; then
        echo "==> Installed via devicectl."
    elif command -v ios-deploy &>/dev/null; then
        ios-deploy --id "$UDID" --bundle "$APP"
        echo "==> Installed via ios-deploy."
    else
        echo "==> App built at: $APP"
        echo "    Drag it into Xcode Devices window to install manually,"
        echo "    or: brew install ios-deploy"
    fi
}

# ── Core build command (NO -destination flag — avoids scheme platform check) ─
build_device() {
    run_build xcodebuild build \
        -project "$PROJECT" \
        -target "$SCHEME" \
        -configuration Debug \
        -sdk iphoneos \
        ARCHS="arm64" \
        ONLY_ACTIVE_ARCH=YES \
        CODE_SIGN_STYLE=Automatic \
        DEVELOPMENT_TEAM="$TEAM_ID" \
        IPHONEOS_DEPLOYMENT_TARGET=17.0
}

# ── Specific UDID ────────────────────────────────────────────────────────────
if [[ "$MODE" =~ ^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4} ]] || \
   [[ "$MODE" =~ ^[0-9A-Fa-f]{40}$ ]] || \
   [[ "$MODE" =~ ^[0-9A-F]{25,}$ ]]; then
    echo "==> Building for device UDID: $MODE"
    build_device
    install_app "$MODE"

# ── First connected device ───────────────────────────────────────────────────
elif [ "$MODE" = "device" ]; then
    echo "==> Detecting connected devices..."
    UDID=$(xcrun devicectl list devices 2>/dev/null \
        | grep -i 'connected' | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' \
        | head -1 || true)
    if [ -z "$UDID" ]; then
        UDID=$(instruments -s devices 2>/dev/null \
            | grep 'iPad\|iPhone' | grep -v Simulator \
            | grep -oE '[0-9a-f]{40}' | head -1 || true)
    fi
    if [ -z "$UDID" ]; then
        echo "ERROR: No physical device found. Connect your iPad and unlock it."
        echo "       Or run: ./build.sh <udid>"
        exit 1
    fi
    echo "==> Found device: $UDID"
    build_device
    install_app "$UDID"

# ── Archive (Release) ─────────────────────────────────────────────────────────
elif [ "$MODE" = "archive" ] || [ "$MODE" = "testflight" ]; then
    echo "==> Archiving (Release)..."
    run_build xcodebuild archive \
        -project "$PROJECT" \
        -scheme "$SCHEME" \
        -configuration Release \
        -destination "generic/platform=iOS" \
        -archivePath "$ARCHIVE" \
        CODE_SIGN_STYLE=Automatic \
        DEVELOPMENT_TEAM="$TEAM_ID"

    if [ "$MODE" = "archive" ]; then
        echo "==> Exporting IPA..."
        xcodebuild -exportArchive \
            -archivePath "$ARCHIVE" \
            -exportOptionsPlist "$SCRIPT_DIR/ExportOptions-Development.plist" \
            -exportPath "$EXPORT_DIR" \
            DEVELOPMENT_TEAM="$TEAM_ID"
        echo "==> IPA at: $EXPORT_DIR"

    elif [ "$MODE" = "testflight" ]; then
        echo "==> Uploading to TestFlight..."
        xcodebuild -exportArchive \
            -archivePath "$ARCHIVE" \
            -exportOptionsPlist "$SCRIPT_DIR/ExportOptions-TestFlight.plist" \
            -exportPath "$EXPORT_DIR" \
            DEVELOPMENT_TEAM="$TEAM_ID"
        echo "==> Done — check App Store Connect → TestFlight."
    fi

else
    echo "ERROR: Unknown mode '$MODE'"
    echo "Usage: ./build.sh [<udid>|device|archive|testflight]"
    exit 1
fi

echo ""
echo "==> Done."
