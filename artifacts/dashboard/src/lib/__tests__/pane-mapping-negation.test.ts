/**
 * PANE feature mapping (SOCRATES answers, ambient transcript), pathognomonic-sign suggestions and
 * the passive differential read free text through the shared negation-aware matcher.
 */
import { describe, expect, it } from 'vitest';
import { extractFeaturesFromSocrates } from '../socrates-to-features';
import { detectPathognomonic, extractFeaturesFromTranscript } from '../transcript-dx-mapper';
import { computeRankedDifferentials } from '../symptom-inference';

describe('SOCRATES answers → PANE features', () => {
  it('negated associated symptoms extract nothing', () => {
    const f = extractFeaturesFromSocrates('Acute abdominal pain', { associated: 'No fever, no vomiting, not jaundiced' });
    expect(f.fever).toBeUndefined();
    expect(f.nausea_vomiting).toBeUndefined();
    expect(f.jaundice).toBeUndefined();
  });
  it('affirmed associated symptoms still extract', () => {
    const f = extractFeaturesFromSocrates('Acute abdominal pain', { associated: 'Fever and vomiting' });
    expect(f.fever).toBe(true);
    expect(f.nausea_vomiting).toBe(true);
  });
});

describe('ambient transcript → observed features', () => {
  const observed = (text: string, id: string) => extractFeaturesFromTranscript(text).find(f => f.featureId === id)?.observed;
  it('a negation in the previous sentence no longer marks a finding absent', () => {
    expect(observed('No vomiting. Guarding in the right iliac fossa.', 'rebound_tenderness')).toBe(true);
  });
  it('an explicit negation marks it absent', () => {
    expect(observed('Soft abdomen, no guarding.', 'rebound_tenderness')).toBe(false);
  });
});

describe('pathognomonic-sign suggestions', () => {
  it('a negated sign suggests nothing', () => {
    expect(detectPathognomonic("Rovsing's sign negative")).toEqual([]);
    expect(detectPathognomonic("No Rovsing's sign, no psoas sign")).toEqual([]);
  });
  it('a positive sign is suggested, with the text as written', () => {
    const [m] = detectPathognomonic("RIF tender. Rovsing's sign present.");
    expect(m?.diseaseId).toBe('appendicitis');
    expect(m?.finding).toBe("Rovsing's sign");
  });
});

describe('passive ranking (exam text)', () => {
  const top = (examText: string) => computeRankedDifferentials({ symptoms: ['abdominal pain'], symptomDetails: {}, examText })[0];
  it('"Murphy\'s sign negative" does not confirm cholecystitis', () => {
    expect(top("RIF tenderness. Murphy's sign negative.")?.pathognomicMatchSign).toBeUndefined();
  });
  it('"Murphy\'s sign" affirmed still does', () => {
    expect(top("Murphy's sign elicited in the RUQ")?.pathognomicMatchSign).toBe("murphy's sign");
  });
});
