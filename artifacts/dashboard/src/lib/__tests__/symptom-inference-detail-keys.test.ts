import { describe, expect, it } from 'vitest';
import { DETAIL_KEY_ALIASES, DIFFERENTIALS, computeRankedDifferentials, detailKeysFor } from '../symptom-inference';
import { SYMPTOM_BRANCHES } from '../symptom-branches';

const allKeys = new Set(DIFFERENTIALS.flatMap(d => Object.keys(d.detailWeights ?? {})));
const options = (sym: string) => (SYMPTOM_BRANCHES[sym] ?? []).flatMap(b => b.options);

describe('symptom-inference detail weights reach the picker options', () => {
  it('every alias source is a real SmartSymptomPicker option', () => {
    const bad = Object.keys(DETAIL_KEY_ALIASES).filter(k => {
      const i = k.indexOf('.');
      return !options(k.slice(0, i)).includes(k.slice(i + 1));
    });
    expect(bad).toEqual([]);
  });

  it('every alias target is a real detailWeights key', () => {
    const bad = Object.values(DETAIL_KEY_ALIASES).flat().filter(k => !allKeys.has(k));
    expect(bad).toEqual([]);
  });

  it('detailKeysFor returns the option key first, then its aliases', () => {
    expect(detailKeysFor('chest pain', 'Left arm')).toEqual(['chest pain.Left arm', 'chest pain.Radiating to arm', 'chest pain.Radiation to left arm']);
    expect(detailKeysFor('chest pain', 'None')).toEqual(['chest pain.None']);
  });

  it('chest-pain options now score ACS (these weights never fired before the aliases)', () => {
    const base = computeRankedDifferentials({ symptoms: ['chest pain'], symptomDetails: {}, age: 58, sex: 'male' });
    const detailed = computeRankedDifferentials({
      symptoms: ['chest pain'], symptomDetails: { 'chest pain': ['Crushing / pressure', 'Left arm', 'Jaw'] }, age: 58, sex: 'male',
    });
    const acsBase = base.find(r => r.id === 'acs')!.rawScore;
    const acsDetailed = detailed.find(r => r.id === 'acs')!.rawScore;
    expect(acsDetailed).toBeGreaterThan(acsBase + 60);
    expect(['acs', 'stemi']).toContain(detailed[0].id);
  });

  it('"Tearing / ripping" chest pain puts aortic dissection in the top 3', () => {
    const r = computeRankedDifferentials({
      symptoms: ['chest pain'], symptomDetails: { 'chest pain': ['Tearing / ripping'] }, age: 65, sex: 'male',
    });
    expect(r.slice(0, 3).map(x => x.id)).toContain('aortic_dissection');
  });
});

describe('symptom-inference age applicability and anaphylaxis', () => {
  it('childhood diseases are scaled down from age 16 (adult wheeze is not bronchiolitis)', () => {
    const input = { symptoms: ['wheeze', 'shortness of breath'], symptomDetails: {}, sex: 'female' as const };
    const child = computeRankedDifferentials({ ...input, age: 1 }).find(r => r.id === 'bronchiolitis')!;
    const adult = computeRankedDifferentials({ ...input, age: 40 }).find(r => r.id === 'bronchiolitis');
    expect(adult === undefined || adult.rawScore <= child.rawScore * 0.05 + 1e-9).toBe(true);
  });

  it('adult-also childhood diseases (epiglottitis) keep more weight in adults than other childhood entries', () => {
    const input = { symptoms: ['stridor', 'fever'], symptomDetails: {}, sex: 'male' as const };
    const child = computeRankedDifferentials({ ...input, age: 5 }).find(r => r.id === 'epiglottitis')!;
    const adult = computeRankedDifferentials({ ...input, age: 45 }).find(r => r.id === 'epiglottitis')!;
    // ×0.3 (other age terms also apply, so only the order of magnitude is checked).
    expect(adult.rawScore).toBeGreaterThan(child.rawScore * 0.15);
    expect(adult.rawScore).toBeLessThan(child.rawScore);
  });

  it('an anaphylaxis entry exists and ranks top 3 for rash + wheeze + stridor + pre-syncope', () => {
    expect(DIFFERENTIALS.some(d => d.id === 'anaphylaxis')).toBe(true);
    const r = computeRankedDifferentials({
      symptoms: ['rash', 'wheeze', 'stridor', 'pre-syncope'], symptomDetails: {}, age: 32, sex: 'female',
    });
    expect(r.slice(0, 3).map(x => x.id)).toContain('anaphylaxis');
  });
});
