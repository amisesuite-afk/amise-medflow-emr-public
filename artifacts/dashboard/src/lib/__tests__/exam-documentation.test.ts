/**
 * Examination documentation (UX review C2): systems start "not examined", normal templates are
 * per-system suggestions the clinician applies, the count and the note include only documented
 * systems, and no wound template is ever written unless the clinician records a wound.
 */
import { describe, it, expect } from 'vitest';
import {
  allNormalTargets, applyNormalTemplate, countDocumentedSystems, examNoteLines, isSystemDocumented,
} from '@/lib/exam-documentation';
import { effectBodies, readSrc } from './helpers/source-scan';

const KEYS = ['general', 'respiratory', 'cardiovascular', 'abdomen', 'extremities', 'wound'];
const EMPTY = { findings: {}, notes: {} };
const NO_EXAM = {
  examGeneral: '', examCardio: '', examResp: '', examAbdomen: '',
  examNeuro: '', examExtremities: '', examBreast: '', examWound: '',
};

describe('exam documentation rules', () => {
  it('a fresh encounter has 0 systems documented', () => {
    expect(countDocumentedSystems(KEYS, EMPTY)).toBe(0);
    expect(examNoteLines(NO_EXAM)).toEqual([]);
  });

  it('applying the normal template touches only that system', () => {
    const s = applyNormalTemplate({ findings: { abdomen: ['Tender RUQ'] }, notes: {} }, 'general', 'Well.');
    expect(s.notes).toEqual({ general: 'Well.' });
    expect(s.findings).toEqual({ abdomen: ['Tender RUQ'], general: [] });
    expect(countDocumentedSystems(KEYS, s)).toBe(2);
  });

  it('counts only entered systems and ignores omitted ones', () => {
    const s = { findings: { abdomen: ["Murphy's sign +"] }, notes: { respiratory: '  ' } };
    expect(isSystemDocumented(s, 'abdomen')).toBe(true);
    expect(isSystemDocumented(s, 'respiratory')).toBe(false);
    expect(countDocumentedSystems(KEYS, s)).toBe(1);
    expect(countDocumentedSystems(KEYS, s, { abdomen: true })).toBe(0);
  });

  it('"All normal" never fills the wound, nor an omitted system', () => {
    expect(allNormalTargets(KEYS, { respiratory: true })).toEqual(['general', 'cardiovascular', 'abdomen', 'extremities']);
  });

  it('the note lists only examined systems (no wound line for a patient without one)', () => {
    const lines = examNoteLines({ ...NO_EXAM, examAbdomen: "Tender RUQ. Murphy's sign +" });
    expect(lines).toEqual(["Abdomen: Tender RUQ. Murphy's sign +"]);
    expect(lines.some(l => l.startsWith('Wound'))).toBe(false);
  });
});

describe('no screen pre-applies normal findings (regression guard)', () => {
  it('ExaminationTab has no effect that writes normal prose', () => {
    const src = readSrc('pages/tabs/ExaminationTab.tsx');
    for (const body of effectBodies(src)) expect(body).not.toMatch(/normalProse|setExamNotes|setExam[A-Z]\w*\(/);
  });

  it('AmbientConsultation has no effect that writes EXAM_NORMALS', () => {
    const src = readSrc('components/AmbientConsultation.tsx');
    const effects = effectBodies(src);
    expect(effects.length).toBeGreaterThan(0);
    for (const body of effects) expect(body).not.toMatch(/EXAM_NORMALS/);
  });

  it('the clinical note builds the examination from the documented systems only', () => {
    expect(readSrc('pages/tabs/SummaryTab.tsx')).toMatch(/examNoteLines\(ctx\)/);
  });
});
