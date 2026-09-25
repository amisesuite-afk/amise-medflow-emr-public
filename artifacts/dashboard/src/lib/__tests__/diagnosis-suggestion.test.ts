/**
 * Suggested working diagnosis (UX review C4): a sign match is a suggestion; the working
 * diagnosis and ICD code are set (and locked) only on the clinician's Confirm; the plan radiates
 * only from a confirmed diagnosis, and then only as a suggestion inserted on a tap.
 */
import { describe, it, expect } from 'vitest';
import type { WorkingDiagnosis } from '@/context/AppContext';
import { detectPathognomonic } from '@/lib/transcript-dx-mapper';
import {
  diagnosisSuggestion, confirmDiagnosisSuggestion, confirmedPlanSource, insertSuggestedPlan,
  isConfirmedDiagnosis, suggestionKey,
} from '@/lib/diagnosis-suggestion';
import { effectBodies, readSrc } from './helpers/source-scan';

const murphy = detectPathognomonic("Tender RUQ. Murphy's sign +")[0] ?? null;

describe('sign match → suggestion only', () => {
  it("Murphy's sign produces a cholecystitis suggestion, not a diagnosis", () => {
    expect(murphy).not.toBeNull();
    const s = diagnosisSuggestion(murphy, null);
    expect(s).not.toBeNull();
    expect(s!.diseaseLabel).toMatch(/cholecystitis/i);
    expect(s!.icd10).toMatch(/^K81/);
  });

  it('no suggestion once a diagnosis is confirmed, or after Dismiss', () => {
    const confirmed: WorkingDiagnosis = { diseaseId: null, icdCode: 'K80.2', confidence: 1, source: 'manual_icd', locked: true };
    expect(diagnosisSuggestion(murphy, confirmed)).toBeNull();
    expect(diagnosisSuggestion(murphy, null, new Set([suggestionKey(murphy!)]))).toBeNull();
    expect(diagnosisSuggestion(null, null)).toBeNull();
  });

  it('Confirm sets the locked working diagnosis and the primary ICD code only when none is recorded', () => {
    const s = diagnosisSuggestion(murphy, null)!;
    const a = confirmDiagnosisSuggestion(s, []);
    expect(a.workingDiagnosis.locked).toBe(true);
    expect(a.workingDiagnosis.diseaseId).toBe(s.diseaseId);
    expect(a.icdCodes).toEqual([`${s.icd10} — ${s.diseaseLabel}`]);
    const b = confirmDiagnosisSuggestion(s, ['K80.2 — Calculus of gallbladder without cholecystitis']);
    expect(b.icdCodes[0]).toBe('K80.2 — Calculus of gallbladder without cholecystitis');
    expect(b.icdCodes).toHaveLength(2);
  });
});

describe('plan radiates only from a confirmed diagnosis, as a suggestion', () => {
  it('no plan source without a confirmed diagnosis or a recorded ICD code', () => {
    expect(confirmedPlanSource(null, [])).toEqual({ diseaseId: null, icdCode: null });
    const unlocked: WorkingDiagnosis = { diseaseId: 'cholecystitis', icdCode: 'K81.0', confidence: 0.9, source: 'pane_high', locked: false };
    expect(isConfirmedDiagnosis(unlocked)).toBe(false);
    expect(confirmedPlanSource(unlocked, [])).toEqual({ diseaseId: null, icdCode: null });
  });

  it('a confirmed diagnosis or a recorded ICD code is a plan source', () => {
    const s = diagnosisSuggestion(murphy, null)!;
    const { workingDiagnosis } = confirmDiagnosisSuggestion(s, []);
    expect(confirmedPlanSource(workingDiagnosis, []).diseaseId).toBe(s.diseaseId);
    expect(confirmedPlanSource(null, ['K35.80 — Acute appendicitis']).icdCode).toBe('K35.80');
  });

  it('inserting a suggested plan never discards what the clinician wrote', () => {
    expect(insertSuggestedPlan('', 'PLAN A', '')).toBe('PLAN A');
    expect(insertSuggestedPlan('PLAN A', 'PLAN B', 'PLAN A')).toBe('PLAN B');
    expect(insertSuggestedPlan('My own plan', 'PLAN B', 'PLAN A')).toBe('My own plan\n\nPLAN B');
  });
});

describe('nothing sets the diagnosis or the plan by itself (regression guard)', () => {
  it('AssessmentTab has no effect that sets the working diagnosis or ICD codes', () => {
    for (const body of effectBodies(readSrc('pages/tabs/AssessmentTab.tsx'))) {
      expect(body).not.toMatch(/setWorkingDiagnosis|setIcdCodes/);
    }
  });

  it('PlanTab and AmbientConsultation have no effect that writes the plan', () => {
    for (const f of ['pages/tabs/PlanTab.tsx', 'components/AmbientConsultation.tsx']) {
      for (const body of effectBodies(readSrc(f))) expect(body).not.toMatch(/setPlan\(/);
    }
  });

  it('entering the Plan phase never writes the plan or picks a working diagnosis', () => {
    const src = readSrc('components/AmbientConsultation.tsx');
    const enterPlan = src.slice(src.indexOf('function enterPlan()'), src.indexOf('function insertSuggestedPlanForDx'));
    expect(enterPlan).not.toMatch(/setPlan|setWorkingDxId/);
    expect(src).not.toMatch(/AI suggestion — please confirm/);
  });

  it('plan and medication suggestions use the confirmed-diagnosis source', () => {
    expect(readSrc('pages/tabs/PlanTab.tsx')).toMatch(/confirmedPlanSource\(/);
    expect(readSrc('pages/tabs/PrescriptionsTab.tsx')).toMatch(/confirmedPlanSource\(/);
  });
});
