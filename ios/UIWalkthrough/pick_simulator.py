#!/usr/bin/env python3
"""Pick (or create) an available iOS simulator for the UI walkthrough.

Usage: pick_simulator.py <family: iphone|ipad> [preferred name ...]
Prints "<udid>\t<device name>\t<runtime>" for the first match, in this order:
  1. a preferred name, exactly, on the newest iOS runtime that has it;
  2. a same-family fallback (iPhone "Pro Max" / iPad "Pro 13-inch"), newest runtime;
  3. a new simulator created from the first preferred device type the newest runtime supports;
  4. any device of that family.
"""
import json
import re
import subprocess
import sys


def simctl_json(*args):
    out = subprocess.run(["xcrun", "simctl", "list", *args, "-j"], check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out)


def runtime_version(key):
    m = re.search(r"iOS[-.](\d+)[-.](\d+)(?:[-.](\d+))?", key)
    return tuple(int(x or 0) for x in m.groups()) if m else (0, 0, 0)


def main():
    family = sys.argv[1].lower()
    preferred = sys.argv[2:] or (["iPhone 16 Pro Max"] if family == "iphone" else ["iPad Pro 13-inch (M4)"])
    prefix = "iPhone" if family == "iphone" else "iPad"
    fallback = re.compile(r"Pro Max" if family == "iphone" else r"iPad Pro.*13")

    devices = simctl_json("devices", "available")["devices"]
    runtimes = sorted((k for k in devices if "iOS" in k), key=runtime_version, reverse=True)

    def emit(dev, runtime):
        print(f"{dev['udid']}\t{dev['name']}\t{runtime}")
        sys.exit(0)

    for name in preferred:
        for rt in runtimes:
            for dev in devices[rt]:
                if dev["name"] == name:
                    emit(dev, rt)
    for rt in runtimes:
        for dev in devices[rt]:
            if dev["name"].startswith(prefix) and fallback.search(dev["name"]):
                emit(dev, rt)

    # Create one from a preferred device type on the newest iOS runtime.
    all_runtimes = [r for r in simctl_json("runtimes")["runtimes"]
                    if r.get("isAvailable") and r.get("platform", "iOS") == "iOS"]
    all_runtimes.sort(key=lambda r: runtime_version(r["identifier"]), reverse=True)
    types = {t["name"]: t["identifier"] for t in simctl_json("devicetypes")["devicetypes"]}
    for rt in all_runtimes:
        supported = {t["name"] for t in rt.get("supportedDeviceTypes", [])} or set(types)
        for name in preferred:
            if name in types and name in supported:
                udid = subprocess.run(["xcrun", "simctl", "create", name, types[name], rt["identifier"]],
                                      check=True, capture_output=True, text=True).stdout.strip()
                print(f"{udid}\t{name}\t{rt['identifier']}")
                sys.exit(0)

    for rt in runtimes:
        for dev in devices[rt]:
            if dev["name"].startswith(prefix):
                emit(dev, rt)
    sys.exit(f"No {prefix} simulator available")


if __name__ == "__main__":
    main()
