/**
 * "What's missing": web and iOS read one rules file and identical test vectors.
 *
 *   clinical-content/rules/whats-missing-rules.json   (shared: the web imports it, iOS bundles it in
 *                                                      the "rules" folder, SharedClinicalContent)
 * lint:shared-content checks it against its JSON Schema and checks the Swift Codable structs
 * (WhatsMissingRules.swift) and the TypeScript interfaces (whats-missing/rules.ts) against that
 * schema. ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json must be what
 * scripts/src/gen-whats-missing-vectors.ts produces from the current web core (both platforms
 * assert those expected values). The Swift rule structs and core must name every key and text the
 * web core reads.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WHATS_MISSING_RULES } from '../../lib/pane-engine/src/index';
import { WM_VECTORS_FILE, buildWhatsMissingVectors } from './gen-whats-missing-vectors';
import { SHARED_CONTENT } from './shared-content';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SHARED = 'clinical-content/rules/whats-missing-rules.json';

describe("what's missing parity (web = iOS)", () => {
  it('the web core reads the one shared file, and the platform copies are gone', () => {
    const shared = JSON.parse(readFileSync(join(REPO_ROOT, SHARED), 'utf8'));
    expect(JSON.parse(JSON.stringify(WHATS_MISSING_RULES))).toEqual(shared);
    expect(existsSync(join(REPO_ROOT, 'lib/pane-engine/src/whats-missing/whats-missing-rules.json'))).toBe(false);
    expect(existsSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/WhatsMissingRules.json'))).toBe(false);
  });

  it('iOS loads it through SharedClinicalContent, and lint:shared-content maps both platforms', () => {
    const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/WhatsMissingRules.swift'), 'utf8');
    expect(swift).toMatch(/SharedClinicalContent\.load\(Rules\.self, \.whatsMissingRules/);
    const cfg = SHARED_CONTENT.find(c => c.name === 'whats-missing-rules');
    expect(cfg?.swift.root).toBe('WhatsMissing.Rules');
    expect(cfg?.ts.root).toBe('MissingRules');
  });

  it('the shared vectors are current (run gen:whats-missing-vectors after a deliberate change)', () => {
    const onDisk = JSON.parse(readFileSync(WM_VECTORS_FILE, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildWhatsMissingVectors())));
  });

  it('the Swift rule structs and core name every key and text the web core reads', () => {
    const swift = ['WhatsMissingRules.swift', 'WhatsMissingCore.swift', 'WhatsMissingCore+Fill.swift', 'WhatsMissingCore+Probe.swift']
      .map(f => readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services', f), 'utf8')).join('\n');
    const rules = JSON.parse(readFileSync(join(REPO_ROOT, SHARED), 'utf8'));
    const header = new Set(['$schema', '$comment', 'id']);
    const keys = [
      ...Object.keys(rules).filter(k => !header.has(k)), ...Object.keys(rules.thresholds), ...Object.keys(rules.terms),
      ...Object.keys(rules.text), 'safetyOrder', 'partsWhat', 'alt', 'probe', 'concepts', 'part',
    ];
    for (const key of keys) expect(swift, key).toMatch(new RegExp(`\\b${key}\\b`));
  });
});
