/**
 * "What's missing": web and iOS read identical rules and identical test vectors.
 *
 *   lib/pane-engine/src/whats-missing/whats-missing-rules.json   (web)
 *   ios/AmiseMedFlow/Resources/WhatsMissingRules.json             (iOS app bundle)
 * must be byte-identical, and ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json must be
 * what scripts/src/gen-whats-missing-vectors.ts produces from the current web core (both platforms
 * assert those expected values). The Swift structs must name every key the web core reads.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WM_VECTORS_FILE, buildWhatsMissingVectors } from './gen-whats-missing-vectors';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

describe("what's missing parity (web = iOS)", () => {
  it('the iOS bundle copy is byte-identical to the web rules', () => {
    const web = readFileSync(join(REPO_ROOT, 'lib/pane-engine/src/whats-missing/whats-missing-rules.json'), 'utf8');
    const ios = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/WhatsMissingRules.json'), 'utf8');
    expect(ios).toBe(web);
  });

  it('the shared vectors are current (run gen:whats-missing-vectors after a deliberate change)', () => {
    const onDisk = JSON.parse(readFileSync(WM_VECTORS_FILE, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildWhatsMissingVectors())));
  });

  it('the Swift rule structs and core name every key and text the web core reads', () => {
    const swift = ['WhatsMissingRules.swift', 'WhatsMissingCore.swift', 'WhatsMissingCore+Fill.swift', 'WhatsMissingCore+Probe.swift']
      .map(f => readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services', f), 'utf8')).join('\n');
    const rules = JSON.parse(readFileSync(join(REPO_ROOT, 'lib/pane-engine/src/whats-missing/whats-missing-rules.json'), 'utf8'));
    const keys = [
      ...Object.keys(rules), ...Object.keys(rules.thresholds), ...Object.keys(rules.terms), ...Object.keys(rules.text),
      'safetyOrder', 'partsWhat', 'alt', 'probe', 'concepts', 'part',
    ];
    for (const key of keys) expect(swift, key).toMatch(new RegExp(`\\b${key}\\b`));
  });
});
