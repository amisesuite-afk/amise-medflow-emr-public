#!/usr/bin/env bash
# UI walkthrough: runs the XCUITest flows (AmiseMedFlowUITests, scheme AmiseMedFlowUIWalkthrough)
# on an iPhone and/or an iPad simulator, then exports the screenshots and UX metrics.
#
#   ios/UIWalkthrough/run.sh [all|iphone|ipad]        (default: all)
#
# Needs a Mac with Xcode (16 or later for the attachment export) and XcodeGen
# (brew install xcodegen). The app runs in DEBUG demo mode (-UITestDemoMode): synthetic
# in-memory patients, no sign-in, no sync, nothing sent anywhere.
#
# Environment (optional):
#   UX_IPHONE   preferred iPhone simulator (default "iPhone 16 Pro Max")
#   UX_IPAD     preferred iPad simulator   (default "iPad Pro 13-inch (M4)")
#   UX_OUT_DIR  output folder              (default ios/build/ux-walkthrough)
#
# Output: <out>/<device>/screenshots/*.png, <out>/<device>/metrics/*.json,
#         <out>/<device>/result.xcresult, <out>/<device>/test.log,
#         <out>/ux-metrics.json (all devices and flows), <out>/ux-summary.md
# Exit status: non-zero if the build or any device's UI tests failed (whatever ran is exported).
# Test time: 10 minutes per flow by default; the two consultation halves (a1, a2) ask for 15
# minutes each (executionTimeAllowance), capped here at 30. A flow that ends "interrupted" in
# the metrics was stopped by an XCTest failure, not necessarily a time-out: see the test log.
# Works with the macOS system bash (3.2).
set -uo pipefail
cd "$(dirname "$0")/.."        # ios/

WHICH="${1:-all}"
OUT="${UX_OUT_DIR:-$PWD/build/ux-walkthrough}"
DERIVED="$PWD/build/UIWalkthroughDerivedData"
IPHONE_PREF="${UX_IPHONE:-iPhone 16 Pro Max}"
IPAD_PREF="${UX_IPAD:-iPad Pro 13-inch (M4)}"
HERE="$PWD/UIWalkthrough"

case "$WHICH" in
  all)    DEVICES="iphone ipad" ;;
  iphone) DEVICES="iphone" ;;
  ipad)   DEVICES="ipad" ;;
  *) echo "usage: $0 [all|iphone|ipad]"; exit 2 ;;
esac

command -v xcodegen >/dev/null || { echo "XcodeGen is required: brew install xcodegen"; exit 1; }
# Placeholders are enough: demo mode never contacts Supabase or Sentry.
[ -f Configuration.xcconfig ] || cp Configuration.xcconfig.example Configuration.xcconfig
xcodegen generate || exit 1
mkdir -p "$OUT"

# "<udid>\t<name>\t<runtime>" for a device family.
pick() {
  if [ "$1" = iphone ]; then python3 "$HERE/pick_simulator.py" iphone "$IPHONE_PREF"
  else python3 "$HERE/pick_simulator.py" ipad "$IPAD_PREF" "iPad Pro 13-inch (M5)"; fi
}

slugify() { printf '%s' "$1" | tr -c 'A-Za-z0-9' '-' | tr -s '-' | sed 's/^-//;s/-$//'; }

# Boot, clean status bar, no autocorrection / keyboard tips (they change typed text or cover
# the screen), software keyboard shown as a clinician would see it.
prepare_sim() {
  local udid="$1"
  defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false 2>/dev/null || true
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  for key in KeyboardAutocorrection KeyboardPrediction KeyboardAutocapitalization KeyboardCheckSpelling; do
    xcrun simctl spawn "$udid" defaults write com.apple.Preferences "$key" -bool NO || true
  done
  xcrun simctl spawn "$udid" defaults write com.apple.Preferences DidShowContinuousPathIntroduction -bool YES || true
  xcrun simctl status_bar "$udid" override --time "09:41" --batteryState charged --batteryLevel 100 \
    --wifiBars 3 --cellularBars 4 2>/dev/null || true
}

# Build once for the first device (both are arm64 simulators); each device then runs
# test-without-building against the same products.
first=$(echo "$DEVICES" | cut -d' ' -f1)
first_pick=$(pick "$first") || exit 1
first_udid=$(printf '%s' "$first_pick" | cut -f1)
echo "Building for testing on $(printf '%s' "$first_pick" | cut -f2) ($first_udid)"
xcodebuild -project AmiseMedFlow.xcodeproj -scheme AmiseMedFlowUIWalkthrough \
  -destination "id=$first_udid" -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  build-for-testing > "$OUT/build.log" 2>&1
build_status=$?
grep -E "error:|\*\* (BUILD|TEST BUILD) " "$OUT/build.log" | sed 's|.*/ios/||' | sort -u
[ "$build_status" -eq 0 ] || { echo "Build for testing failed (log: $OUT/build.log)"; exit 1; }

overall=0
for d in $DEVICES; do
  p=$(pick "$d") || { overall=1; continue; }
  udid=$(printf '%s' "$p" | cut -f1)
  name=$(printf '%s' "$p" | cut -f2)
  echo "=== UI walkthrough on $name ($udid, $(printf '%s' "$p" | cut -f3)) ==="
  dev_out="$OUT/$(slugify "$name")"
  rm -rf "$dev_out" && mkdir -p "$dev_out/runner-metrics"
  prepare_sim "$udid"
  TEST_RUNNER_UX_METRICS_DIR="$dev_out/runner-metrics" \
  xcodebuild -project AmiseMedFlow.xcodeproj -scheme AmiseMedFlowUIWalkthrough \
    -destination "id=$udid" -derivedDataPath "$DERIVED" \
    -resultBundlePath "$dev_out/result.xcresult" \
    -test-timeouts-enabled YES \
    -default-test-execution-time-allowance 600 \
    -maximum-test-execution-time-allowance 1800 \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
    test-without-building > "$dev_out/test.log" 2>&1
  status=$?
  grep -E "Test Case .*(passed|failed)|error:|\*\* TEST" "$dev_out/test.log" || true
  [ "$status" -eq 0 ] || overall=1
  python3 "$HERE/collect_results.py" export "$dev_out/result.xcresult" "$dev_out" "$dev_out/runner-metrics"
done

python3 "$HERE/collect_results.py" merge "$OUT"
echo "Screenshots and metrics: $OUT"
exit $overall
