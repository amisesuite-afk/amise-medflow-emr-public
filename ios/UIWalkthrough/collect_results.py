#!/usr/bin/env python3
"""Collect the UI walkthrough's screenshots and metrics.

  collect_results.py export <result.xcresult> <out-dir> [metrics-dir]
      Exports every attachment of the result bundle: screenshots → <out-dir>/screenshots/*.png,
      ux-metrics JSON → <out-dir>/metrics/*.json. Uses `xcrun xcresulttool export attachments`
      (Xcode 16+), falling back to `xcparse attachments` when that is not available. JSON files
      the test runner wrote straight to [metrics-dir] (UX_METRICS_DIR) are copied as well.

  collect_results.py merge <root-dir>
      Merges <root-dir>/*/metrics/*.json into <root-dir>/ux-metrics.json (per device, per flow)
      and writes <root-dir>/ux-summary.md (a table for the CI job summary).
"""
import datetime
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

UUID_SUFFIX = re.compile(r"^(?P<base>.*?)(?:_\d+)?_[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}(?P<ext>\.\w+)$")


def clean_name(name):
    m = UUID_SUFFIX.match(name)
    return f"{m.group('base')}{m.group('ext')}" if m else name


def attachments_from_manifest(node):
    """Yields (exportedFileName, humanName) from xcresulttool's manifest, whatever its nesting."""
    if isinstance(node, dict):
        if "exportedFileName" in node:
            yield node["exportedFileName"], node.get("suggestedHumanReadableName") or node["exportedFileName"]
        for value in node.values():
            yield from attachments_from_manifest(value)
    elif isinstance(node, list):
        for value in node:
            yield from attachments_from_manifest(value)


def export(xcresult, out_dir, metrics_dir=None):
    out = pathlib.Path(out_dir)
    shots, metrics = out / "screenshots", out / "metrics"
    shots.mkdir(parents=True, exist_ok=True)
    metrics.mkdir(parents=True, exist_ok=True)

    files = []   # (path, human name)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        ok = subprocess.run(["xcrun", "xcresulttool", "export", "attachments",
                             "--path", str(xcresult), "--output-path", str(tmp)]).returncode == 0
        manifest = tmp / "manifest.json"
        if ok and manifest.exists():
            for exported, human in attachments_from_manifest(json.loads(manifest.read_text())):
                files.append((tmp / exported, human))
        elif shutil.which("xcparse"):
            print("xcresulttool export attachments unavailable; using xcparse", file=sys.stderr)
            subprocess.run(["xcparse", "attachments", str(xcresult), str(tmp / "xcparse")], check=False)
            files = [(p, p.name) for p in (tmp / "xcparse").rglob("*") if p.is_file()]
        else:
            print("::warning::No attachment exporter (Xcode 16+ xcresulttool or xcparse)", file=sys.stderr)

        count_png = count_json = 0
        for path, human in files:
            if not path.exists():
                continue
            name = clean_name(pathlib.Path(human).name)
            if name.lower().endswith((".png", ".jpg", ".jpeg", ".heic")):
                shutil.copy2(path, shots / name)
                count_png += 1
            elif "ux-metrics__" in name:
                name = name.split(".json")[0] + ".json"
                shutil.copy2(path, metrics / name)
                count_json += 1

    if metrics_dir and pathlib.Path(metrics_dir).is_dir():
        for p in pathlib.Path(metrics_dir).glob("ux-metrics__*.json"):
            shutil.copy2(p, metrics / p.name)
            count_json += 1
    print(f"Exported {count_png} screenshots and {count_json} metrics files to {out}")


def merge(root_dir):
    root = pathlib.Path(root_dir)
    devices = {}
    for p in sorted(root.glob("*/metrics/ux-metrics__*.json")):
        try:
            m = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        devices.setdefault(m.get("device", p.parent.parent.name), {})[m.get("flow", p.stem)] = m

    merged = {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "definitions": {
            "taps": "taps on controls, including the tap into a text field",
            "textEntries": "blocks of typed text (one per field)",
            "interactions": "taps + textEntries",
            "keystrokes": "characters typed",
            "scrolls": "swipes or drags needed to bring a control on screen",
            "screens": "distinct screens seen (each consultation step counts as one)",
        },
        "devices": devices,
    }
    (root / "ux-metrics.json").write_text(json.dumps(merged, indent=2, sort_keys=True))

    lines = ["| Device | Flow | Outcome | Taps | Text entries | Interactions | Keystrokes | Scrolls | Screens |",
             "|---|---|---|---:|---:|---:|---:|---:|---:|"]
    for device, flows in sorted(devices.items()):
        for flow, m in sorted(flows.items()):
            lines.append(f"| {device} | {flow} | {m.get('outcome')} | {m.get('taps')} | {m.get('textEntries')} | "
                         f"{m.get('interactions')} | {m.get('keystrokes')} | {m.get('scrolls')} | {m.get('screens')} |")
    notes = [f"- **{d} / {f}**: {n}" for d, fl in sorted(devices.items())
             for f, m in sorted(fl.items()) for n in m.get("notes", [])]
    summary = "## UI walkthrough — UX metrics\n\n" + "\n".join(lines)
    if notes:
        summary += "\n\n### Notes\n\n" + "\n".join(notes)
    (root / "ux-summary.md").write_text(summary + "\n")
    print(summary)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "export":
        export(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif len(sys.argv) == 3 and sys.argv[1] == "merge":
        merge(sys.argv[2])
    else:
        sys.exit(__doc__)
