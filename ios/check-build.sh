#!/bin/bash
# Pull the latest branch, regenerate the Xcode project, build, and print compiler errors.
# Usage (from anywhere):  ~/amise-medflow-emr-public/ios/check-build.sh

cd "$(dirname "$0")" || exit 1

branch="$(git branch --show-current)"
git pull --ff-only origin "$branch" || { echo "git pull failed — send this output"; exit 1; }
echo "Version: $(git log --oneline -1)"

command -v xcodegen >/dev/null || { echo "xcodegen missing — run: brew install xcodegen"; exit 1; }
xcodegen generate --quiet || { echo "xcodegen failed — send this output"; exit 1; }

echo "Building (3–5 min)..."
xcodebuild -project AmiseMedFlow.xcodeproj -scheme AmiseMedFlow \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build > ~/build-full.log 2>&1
grep -E 'error:|BUILD (SUCCEEDED|FAILED)' \
  ~/build-full.log | sed 's|.*/AmiseMedFlow/||' | sort -u > ~/build-errors.txt

errors=$(grep -c 'error:' ~/build-errors.txt)
if grep -q 'BUILD SUCCEEDED' ~/build-errors.txt; then
  echo "RESULT: BUILD SUCCEEDED"
elif [ "$errors" -gt 0 ]; then
  echo "RESULT: BUILD FAILED — $errors errors"
  grep 'error:' ~/build-errors.txt | head -40
else
  echo "RESULT: BUILD FAILED before compiling — last lines of the log:"
  tail -20 ~/build-full.log
fi
