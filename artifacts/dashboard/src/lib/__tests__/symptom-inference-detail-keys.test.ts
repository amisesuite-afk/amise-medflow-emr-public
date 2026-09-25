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
