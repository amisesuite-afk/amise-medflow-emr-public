import { describe, expect, it } from 'vitest';
import { EXAM_SIGNS, examSign, ruleFeatureId, signFeatureId } from '@workspace/pane-engine';
import {
  EXAM_SIGNS_KEY, examSignStates, parseSignChips, recordedEvidence, recordedRuleValues, signChipText, withSignState,
} from '../exam-evidence-features';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from '../socrates-to-features';
import { withRecordedScore } from '../decision-support';

describe('exam sign chips', () => {
  it('every sign round-trips through its record line, present and absent', () => {
    for (const s of EXAM_SIGNS.signs) {
      expect(parseSignChips([signChipText(s, 'present')])).toEqual({ [s.id]: 'present' });
      expect(parseSignChips([signChipText(s, 'absent')])).toEqual({ [s.id]: 'absent' });
    }
  });

  it('the record lines read naturally and negate the absent sign', () => {
    expect(signChipText(examSign('murphy')!, 'present')).toBe("Murphy's sign: present");
    expect(signChipText(examSign('murphy')!, 'absent')).toBe("No Murphy's sign (examined)");
    expect(signChipText(examSign('rebound')!, 'absent')).toBe('No rebound tenderness (examined)');
  });

  it('withSignState sets, replaces and clears one sign only', () => {
    let f: Record<string, string[]> = { abdomen: ['Soft'] };
    f = withSignState(f, 'murphy', 'present');
    f = withSignState(f, 'rebound', 'absent');
    f = withSignState(f, 'murphy', 'absent');
    expect(examSignStates(f)).toEqual({ murphy: 'absent', rebound: 'absent' });
    f = withSignState(f, 'murphy', null);
    expect(examSignStates(f)).toEqual({ rebound: 'absent' });
    expect(f.abdomen).toEqual(['Soft']);
  });

  it('reads recorded decision-rule values only (not the record-derived NEWS2 / qSOFA)', () => {
    const cs = withRecordedScore(withRecordedScore({}, 'alvarado', 8, 'x'), 'perc', 0, 'x');
    expect(recordedRuleValues(cs)).toEqual({ alvarado: 8, perc: 0 });
    expect(recordedRuleValues(null)).toEqual({});
  });
});

describe('PANE mapper with examination evidence', () => {
  const base = {
    age: '45', sex: 'female', symptoms: [], hpiNotes: 'Right upper quadrant pain for two days after a fatty meal.',
    examAbdomen: "Murphy's sign positive.",
  };

  it("a Murphy's chip supersedes the free-text Murphy's sign", () => {
    const withoutChip = extractFeaturesFromSocrates('Abdominal pain', {}, paneContextFromConsultation(base));
    expect(withoutChip.murphy_sign).toBe(true);
    const ctx = paneContextFromConsultation({ ...base, examFindings: withSignState({}, 'murphy', 'present') });
    const f = extractFeaturesFromSocrates('Abdominal pain', {}, ctx);
    expect(f.murphy_sign).toBeUndefined();
    expect(f[signFeatureId('murphy')]).toBe(true);
    // The sign lines are not read as free text.
    expect(ctx.examFindings?.[EXAM_SIGNS_KEY]).toHaveLength(1);
  });

  it('an absent sign is applied only when its absence is meaningful', () => {
    const ctx = paneContextFromConsultation({
      ...base, examAbdomen: '',
      examFindings: withSignState(withSignState({}, 'murphy', 'absent'), 'rovsing', 'absent'),
    });
    const f = extractFeaturesFromSocrates('Abdominal pain', {}, ctx);
    expect(f[signFeatureId('murphy')]).toBe(false);
    expect(signFeatureId('rovsing') in f).toBe(false);
  });

  it('recorded rule bands come last', () => {
    const ctx = paneContextFromConsultation({ ...base, clinicalScores: withRecordedScore({}, 'alvarado', 3, 'x') });
    const f = extractFeaturesFromSocrates('Abdominal pain', {}, ctx);
    const keys = Object.keys(f);
    expect(keys[keys.length - 1]).toBe(ruleFeatureId('alvarado', 'low'));
  });

  it('recordedEvidence carries the age for the paediatric signs', () => {
    expect(recordedEvidence({ examFindings: withSignState({}, 'crt_child', 'present'), age: 3 }).ageYears).toBe(3);
  });
});
