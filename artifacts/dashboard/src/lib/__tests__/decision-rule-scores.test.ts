import { describe, expect, it } from 'vitest';
import { DECISION_RULES } from '@workspace/pane-engine';
import { RULE_SPECS, ruleOutcome, ruleRecord } from '../decision-rule-scores';

const empty = ruleRecord({});

describe('decision-rule calculators (evidence-exam)', () => {
  it('every rule has a calculator: a new card here or an existing Scales-step card', () => {
    const existing = new Set(['alvarado', 'wellsPe', 'wellsDvt', 'heart', 'curb65', 'glasgowBlatchford', 'tg18Cholecystitis',
      'tg18Cholangitis', 'qsofa', 'news2', 'caprini', 'rcri']);
    for (const r of DECISION_RULES.rules) {
      expect(existing.has(r.web.calculator) || r.web.calculator in RULE_SPECS, r.id).toBe(true);
    }
    for (const spec of Object.values(RULE_SPECS)) {
      expect(DECISION_RULES.rules.find(r => r.id === spec.ruleId)?.web.calculator, spec.ruleId).toBe(spec.scaleKey);
    }
  });

  it('an empty form scores the lowest band and nothing is pre-filled from an empty record', () => {
    for (const spec of Object.values(RULE_SPECS)) {
      expect(spec.prefill(empty), spec.ruleId).toEqual({});
    }
    expect(ruleOutcome(RULE_SPECS.perc, {})!.band!.id).toBe('negative');
    expect(ruleOutcome(RULE_SPECS.ottawaAnkle, {})!.band!.id).toBe('negative');
    // The Canadian C-spine rule needs a low-risk factor and rotation to avoid imaging.
    expect(ruleOutcome(RULE_SPECS.canadianCSpine, {})!.band!.id).toBe('positive');
    expect(ruleOutcome(RULE_SPECS.canadianCSpine, { lowRisk: true, rotate: true })!.band!.id).toBe('negative');
  });

  it('scores the published examples', () => {
    // AIR: vomiting, RIF pain, medium defence, WBC 15, CRP 60 → 1+1+2+2+2 = 8.
    expect(RULE_SPECS.air.total({ vomiting: true, rifPain: true, rebound: 'medium', wbc: 'ge15', crp: 'ge50' })).toBe(8);
    // STONE: male, <6 h, non-black, vomiting, haematuria → 2+3+3+2+3 = 13.
    expect(RULE_SPECS.stone.total({ male: true, timing: 'lt6', nonBlack: true, nausea: 'vomiting', haematuria: true })).toBe(13);
    expect(ruleOutcome(RULE_SPECS.stone, { male: true, timing: 'lt6', haematuria: true, nausea: 'vomiting' })!.band!.id).toBe('high');
    // Centor/McIsaac 45+ with no criteria → -1.
    expect(RULE_SPECS.centor.total({ age: 'ge45' })).toBe(-1);
    // LRINEC: CRP ≥150, WBC >25, Hb <11, Na <135 → 4+2+2+2 = 10.
    expect(RULE_SPECS.lrinec.total({ crp150: true, wbc: 'gt25', hb: 'lt11', na135: true })).toBe(10);
    expect(RULE_SPECS.canadianCtHead.total({ amnesia30: true })).toBe(1);
    expect(RULE_SPECS.canadianCtHead.total({ amnesia30: true, age65: true })).toBe(2);
    expect(RULE_SPECS.canadianSyncope.total({ vasovagalPredisposition: true, edDiagnosis: 'vasovagal' })).toBe(-3);
  });

  it('pre-fills from the observations, results, text and sign chips', () => {
    const r = ruleRecord({
      age: 58, sex: 'male', vitals: { heartRate: '112', spo2: '93', temperatureC: '38.9' },
      labs: { wbc: 16.2, crp: 180, haemoglobin: 105, sodium: 131, creatinine: 150, glucose: 12 },
      text: 'Vomiting since last night. No haemoptysis. Pain in the right iliac fossa.',
      signs: { guarding: 'present' },
    });
    expect(RULE_SPECS.perc.prefill(r)).toEqual({ age50: true, hr100: true, spo2: true });
    expect(RULE_SPECS.air.prefill(r)).toMatchObject({ vomiting: true, rifPain: true, rebound: 'medium', temp385: true, wbc: 'ge15', crp: 'ge50' });
    expect(RULE_SPECS.lrinec.prefill(r)).toEqual({ crp150: true, wbc: '15to25', hb: 'lt11', na135: true, creat141: true, glucose10: true });
  });
});
