import { describe, expect, it } from 'vitest';
import { DISEASES, FEATURES } from '../vademecum/index.js';
import { PRIOR_MODIFIERS } from '../engine/modifiers.js';
import { CONJUNCTION_FEATURES, UMBRELLA_FEATURES } from '../engine/likelihood.js';
import { PRIOR_TIER } from '../vademecum/priors.js';
import { PANE_MODEL_VERSION } from '../constants.js';

const featureIds = new Set(FEATURES.map(f => f.id));
const diseaseIds = new Set(DISEASES.map(d => d.id));

describe('pane model integrity (1.0.0)', () => {
  it('has a semver model version', () => {
    expect(PANE_MODEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('every feature a disease lists is registered', () => {
    const missing: string[] = [];
    for (const d of DISEASES) {
      for (const f of Object.keys(d.features)) if (!featureIds.has(f)) missing.push(`${d.id}.${f}`);
    }
    expect(missing).toEqual([]);
  });

  it('every likelihood is a probability', () => {
    for (const d of DISEASES) {
      for (const [f, p] of Object.entries(d.features)) {
        expect(p, `${d.id}.${f}`).toBeGreaterThan(0);
        expect(p, `${d.id}.${f}`).toBeLessThan(1);
      }
    }
  });

  it('every feature base rate is a probability', () => {
    for (const f of FEATURES) {
      if (f.baseRate === undefined) continue;
      expect(f.baseRate, f.id).toBeGreaterThan(0);
      expect(f.baseRate, f.id).toBeLessThan(1);
    }
  });

  it('every prior modifier names a registered disease', () => {
    const unknown = [...new Set(PRIOR_MODIFIERS.map(m => m.diseaseId))].filter(id => !diseaseIds.has(id));
    expect(unknown).toEqual([]);
  });

  it('umbrella and conjunction features only name registered features', () => {
    for (const [u, parts] of Object.entries({ ...UMBRELLA_FEATURES, ...CONJUNCTION_FEATURES })) {
      expect(featureIds.has(u), u).toBe(true);
      for (const p of parts) expect(featureIds.has(p), `${u} → ${p}`).toBe(true);
    }
  });

  it('every disease prior is one of the PRIOR_TIER tiers (no specialty-level boost)', () => {
    const tiers = new Set<number>(Object.values(PRIOR_TIER));
    const off = DISEASES.filter(d => d.id !== '_other_' && !tiers.has(d.prior)).map(d => `${d.id}=${d.prior}`);
    expect(off).toEqual([]);
  });

  it('every disease states its usual course', () => {
    const missing = DISEASES.filter(d => d.id !== '_other_' && !d.course).map(d => d.id);
    expect(missing).toEqual([]);
  });

  it('no sex modifier exceeds the ×2 likelihood-ratio bound', () => {
    const over = PRIOR_MODIFIERS.filter(m => m.condition.sex && m.condition.ageMin === undefined
      && m.condition.ageMax === undefined && m.multiplier > 2);
    expect(over).toEqual([]);
  });
});
