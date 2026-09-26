/**
 * Cough mentions — shared test vectors. The same file drives the iOS twin
 * (ios/AmiseMedFlowTests/CoughMentionTests.swift: CoughMention.swift and ClinicalTextParser), so a
 * typed "cough" is a cough and "worse on coughing" an aggravating factor on both platforms.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { coughMentions, recordsCough, recordsCoughAsFactor } from '@workspace/triage-engine';
import { extractFeaturesFromSocrates } from '../socrates-to-features';

const VECTORS_PATH = fileURLToPath(new URL('../../../../../ios/AmiseMedFlowTests/Resources/CoughMentionVectors.json', import.meta.url));

interface Vector { text: string; kinds: string[]; cough: boolean; factor: boolean }
const { vectors } = JSON.parse(readFileSync(VECTORS_PATH, 'utf8')) as { vectors: Vector[] };

describe('cough mentions (shared vectors)', () => {
  it('has the vectors', () => expect(vectors.length).toBeGreaterThan(25));

  for (const v of vectors) {
    it(`"${v.text}"`, () => {
      expect(coughMentions(v.text).map(m => m.kind)).toEqual(v.kinds);
      expect(recordsCough(v.text)).toBe(v.cough);
      expect(recordsCoughAsFactor(v.text)).toBe(v.factor);
    });
  }
});

describe('PANE mapper: the cough feature follows the mention', () => {
  for (const v of vectors) {
    it(`narrative "${v.text}"`, () => {
      const out = extractFeaturesFromSocrates('', {}, { narrative: [v.text] });
      expect(out.cough === true).toBe(v.cough);
    });
  }

  it('the pain Aggravating chip "Coughing" is not a cough', () => {
    expect(extractFeaturesFromSocrates('Abdominal pain', { triggers: 'Coughing' }).cough).toBeUndefined();
  });
});
