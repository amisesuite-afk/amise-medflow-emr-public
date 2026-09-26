#!/bin/bash
# Print the most recent AmiseMedFlow crash report synced from a connected iPad/iPhone.
# Usage:  ~/amise-medflow-emr-public/ios/crash-log.sh

f=${1:-$(ls -t ~/Downloads/AmiseMedFlow*.ips ~/Desktop/AmiseMedFlow*.ips \
          ~/Library/Logs/CrashReporter/MobileDevice/*/AmiseMedFlow*.ips \
          ~/Library/Logs/DiagnosticReports/AmiseMedFlow*.ips 2>/dev/null | head -1)}
if [ -z "$f" ]; then
  echo "No AmiseMedFlow crash report found on this Mac."
  echo "On the phone: Settings > Privacy & Security > Analytics & Improvements > Analytics Data,"
  echo "tap an AmiseMedFlow-... entry, Share > AirDrop to this Mac, then run this again."
  exit 1
fi
echo "FILE: $f"
python3 - "$f" <<'EOF'
import sys, json
raw = open(sys.argv[1], encoding="utf-8", errors="replace").read()
body = raw.split("\n", 1)[1] if raw.startswith("{") else raw
d = json.loads(body)
print("DATE:", d.get("captureTime"))
print("EXCEPTION:", json.dumps(d.get("exception")))
print("TERMINATION:", json.dumps(d.get("termination")))
asi = d.get("asi") or {}
for lib, msgs in asi.items():
    for m in msgs:
        print("MESSAGE:", m)
imgs = d.get("usedImages", [])
threads = d.get("threads", [])
t = next((t for t in threads if t.get("triggered")), threads[0] if threads else None)
if t:
    print("CRASHED THREAD frames:")
    for i, fr in enumerate(t.get("frames", [])[:25]):
        im = imgs[fr["imageIndex"]] if fr.get("imageIndex") is not None and fr["imageIndex"] < len(imgs) else {}
        name = im.get("name", "?")
        sym = fr.get("symbol", "")
        off = fr.get("symbolLocation", fr.get("imageOffset"))
        print(f"  {i:2d} {name:28s} {sym} +{off}")
EOF
