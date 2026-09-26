/**
 * Decision support: web and iOS read one content file and identical test vectors.
 *
 *   clinical-content/rules/treatment-decisions.json   (shared: the web imports it, iOS bundles it
 *                                                      in the "rules" folder, SharedClinicalContent)
 * lint:shared-content checks it against its JSON Schema and checks the Swift Codable structs
 * (TreatmentDecisionContent.swift) and the TypeScript interfaces (decision/types.ts) against that
 * schema. ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json must be what
 * scripts/src/gen-decision-vectors.ts produces from the current engine and content (both
 * platforms assert those expected values).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DECISION_CONTENT } from '../../lib/pane-engine/src/index';
import { buildVectors, VECTORS_FILE } from './gen-decision-vectors';
import { SHARED_CONTENT } from './shared-content';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SHARED = 'clinical-content/rules/treatment-decisions.json';

describe('decision content parity (web = iOS)', () => {
  it('the web engine reads the one shared file, and the platform copies are gone', () => {
    const shared = JSON.parse(readFileSync(join(REPO_ROOT, SHARED), 'utf8'));
    expect(JSON.parse(JSON.stringify(DECISION_CONTENT))).toEqual(shared);
    expect(existsSync(join(REPO_ROOT, 'lib/pane-engine/src/decision/treatment-decisions.json'))).toBe(false);
    expect(existsSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/TreatmentDecisions.json'))).toBe(false);
  });

  it('iOS loads it through SharedClinicalContent, and lint:shared-content maps both platforms', () => {
    const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/TreatmentDecisionContent.swift'), 'utf8');
    expect(swift).toMatch(/SharedClinicalContent\.load\(Content\.self, \.treatmentDecisions/);
    const cfg = SHARED_CONTENT.find(c => c.name === 'treatment-decisions');
    expect(cfg?.swift.root).toBe('TreatmentDecisions.Content');
    expect(cfg?.ts.root).toBe('DecisionContent');
  });

  it('the shared vectors are current (run gen:decision-vectors after a deliberate change)', () => {
    const onDisk = JSON.parse(readFileSync(VECTORS_FILE, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildVectors())));
  });
});
