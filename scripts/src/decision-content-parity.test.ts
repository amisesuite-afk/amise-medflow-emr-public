/**
 * Decision support: web and iOS read identical content and identical test vectors.
 *
 *   lib/pane-engine/src/decision/treatment-decisions.json   (web)
 *   ios/AmiseMedFlow/Resources/TreatmentDecisions.json       (iOS app bundle)
 * must be byte-identical, and ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json must be
 * what scripts/src/gen-decision-vectors.ts produces from the current engine and content (both
 * platforms assert those expected values).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildVectors, VECTORS_FILE } from './gen-decision-vectors';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

describe('decision content parity (web = iOS)', () => {
  it('the iOS bundle copy is byte-identical to the web content', () => {
    const web = readFileSync(join(REPO_ROOT, 'lib/pane-engine/src/decision/treatment-decisions.json'), 'utf8');
    const ios = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Resources/TreatmentDecisions.json'), 'utf8');
    expect(ios).toBe(web);
  });

  it('the shared vectors are current (run gen:decision-vectors after a deliberate change)', () => {
    const onDisk = JSON.parse(readFileSync(VECTORS_FILE, 'utf8'));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(buildVectors())));
  });

  it('the Swift content structs name every JSON key the web engine reads', () => {
    const swift = readFileSync(join(REPO_ROOT, 'ios/AmiseMedFlow/Services/TreatmentDecisionContent.swift'), 'utf8');
    for (const key of [
      'confirmedFloor', 'minEngineProbability', 'maxDecisions', 'uln', 'scoreActions', 'resultActions', 'modifiers',
      'decisions', 'missingInputs', 'riskLabel', 'requires', 'ulnMultiple', 'strictLower', 'upperExclusive',
      'supersededBy', 'diagnosisHint', 'harmOR', 'benefitX', 'benefitAdd', 'requiresAllergyClass', 'allergyClasses',
      'harmInDiseased', 'observeText', 'planLine', 'pretestScore', 'riskScore', 'triggerScore', 'baselineRisk',
      'riskFactors', 'excludeKeywords', 'diseaseIds', 'sensitivity', 'specificity',
    ]) {
      expect(swift, key).toMatch(new RegExp(`\\b${key}\\b`));
    }
  });
});
