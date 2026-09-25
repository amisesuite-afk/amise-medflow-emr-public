/**
 * Returning patient: follow-up of the same problem, or a new problem.
 *
 * DRIFT NOTE: the first describe block is ios/AmiseMedFlowTests/VisitContinuityTests.swift ported
 * one for one, so both platforms agree on what counts as "the same problem". When a vector changes
 * on one platform, change it on the other (and VisitContinuity.swift / visit-continuity.ts) in the
 * same PR.
 */
import { describe, expect, it } from 'vitest';
import {
  isSameProblem, lastVisit, meaningfulWords, previousVisitProblem, recommendContinuity,
  daysSinceVisit, type PreviousVisit,
} from '@workspace/triage-engine/visit-continuity';
import { VISIT_TYPE_TABS, visitTypeTabLabel } from '@/lib/visit-type-tabs';

const DAY = 86_400_000;

function previous(complaint: string | null = null, diagnosis: string | null = null): PreviousVisit {
  return {
    date: new Date(Date.now() - 14 * DAY).toISOString(), complaint,
    diagnosis, diagnosisICD: null, plan: 'Review with ultrasound',
  };
}

// ── iOS VisitContinuityTests, 1:1 ────────────────────────────────────────────────────────────
describe('VisitContinuity (iOS parity vectors)', () => {
  it('testNoNewComplaintIsTheSameProblem', () => {
    const last = previous('Right upper quadrant pain', 'Biliary colic');
    expect(isSameProblem(null, last)).toBe(true);
    expect(isSameProblem('  ', last)).toBe(true);
  });

  it('testUnchangedOrRewordedComplaintIsTheSameProblem', () => {
    const last = previous('RUQ pain after fatty food', 'Biliary colic');
    expect(isSameProblem('RUQ pain after fatty food', last)).toBe(true);
    // Same region in different words.
    expect(isSameProblem('Abdominal pain again', last)).toBe(true);
    // Names the diagnosis.
    expect(isSameProblem('Biliary colic review', last)).toBe(true);
    // Plural and suffix forms.
    expect(isSameProblem('Gallstones', previous('Gallstone'))).toBe(true);
  });

  it('testDifferentComplaintIsANewProblem', () => {
    const last = previous('Right inguinal lump', 'Inguinal hernia');
    expect(isSameProblem('Breast lump', last)).toBe(false);
    expect(isSameProblem('Rectal bleeding', last)).toBe(false);
    // Generic words alone ("pain", "left", "severe") do not make it the same problem.
    expect(isSameProblem('Severe left foot pain', last)).toBe(false);
  });

  it('testNothingToCompareWithIsTheSameProblem', () => {
    expect(isSameProblem('Breast lump', previous())).toBe(true);
  });

  it('testPreviousProblemPrefersDiagnosis', () => {
    const last: PreviousVisit = {
      date: new Date().toISOString(), complaint: 'RUQ pain', diagnosis: 'Acute cholecystitis',
      diagnosisICD: 'K81.0', plan: null,
    };
    expect(previousVisitProblem(last)).toBe('Acute cholecystitis [K81.0]');
    expect(previousVisitProblem(previous('Neck swelling'))).toBe('Neck swelling');
  });

  it('testFollowUpStepsIncludeTheStandingHistory', () => {
    // iOS: ConsultPathway.followUp.steps ⊇ history, hpi, pmh, pshx, meds, allergies, exam,
    // investigations, diagnosis, plan. Web: the follow_up visit-type tab list.
    const ids = VISIT_TYPE_TABS.follow_up.map(t => t.id);
    for (const id of ['encounter_history', 'hpi', 'pmh', 'surgical', 'medications', 'allergies',
                      'examination', 'investigations', 'assessment', 'plan'] as const) {
      expect(ids, `follow-up is missing ${id}`).toContain(id);
    }
    expect(visitTypeTabLabel('follow_up', 'encounter_history')).toBe('Last visit');
    expect(visitTypeTabLabel('follow_up', 'hpi')).toBe('S — Interval');
  });
});

// ── Word rules ──────────────────────────────────────────────────────────────────────────────
describe('meaningfulWords', () => {
  it('maps body-region words (even three-letter ones) to one region', () => {
    expect(meaningfulWords('RUQ')).toEqual(new Set(['region-abdomen']));
    expect(meaningfulWords('epigastric belly')).toEqual(new Set(['region-abdomen']));
  });

  it('drops stop words and words under four letters, trims simple suffixes', () => {
    expect(meaningfulWords('Severe pain in the left leg')).toEqual(new Set()); // "the"/"leg" < 4
    expect(meaningfulWords('Vomiting, bleeding')).toEqual(new Set(['vomit', 'bleed']));
    expect(meaningfulWords('abscess')).toEqual(new Set(['abscess'])); // "ss" is not a plural
    expect(meaningfulWords('lumps swelling mass')).toEqual(new Set());
  });

  it('splits on anything that is not a letter', () => {
    expect(meaningfulWords('wound/infection')).toEqual(new Set(['wound', 'infection']));
  });
});

// ── Last visit before today ──────────────────────────────────────────────────────────────────
describe('lastVisit', () => {
  // 2026-09-25 15:00 in St Lucia (UTC-4) = 19:00Z.
  const now = new Date('2026-09-25T19:00:00Z');

  it('takes the most recent completed visit before today, never today or the current one', () => {
    const v = lastVisit({
      now,
      excludeEncounterId: 'current',
      encounters: [
        { id: 'old', date: '2026-08-01T14:00:00Z', complete: true, diagnosis: 'Inguinal hernia' },
        { id: 'recent', date: '2026-09-11T14:00:00Z', complete: true, diagnosis: 'Acute cholecystitis', diagnosisICD: 'K81.0', plan: 'USS' },
        { id: 'open', date: '2026-09-20T14:00:00Z', complete: false, diagnosis: 'Draft' },
        { id: 'cancelled', date: '2026-09-21T14:00:00Z', complete: true, live: false },
        { id: 'today', date: '2026-09-25T12:00:00Z', complete: true },
        { id: 'current', date: '2026-09-24T12:00:00Z', complete: true },
      ],
    });
    expect(v?.encounterId).toBe('recent');
    expect(v && previousVisitProblem(v)).toBe('Acute cholecystitis [K81.0]');
    expect(v?.plan).toBe('USS');
  });

  it('uses the practice time zone for "today": 23:30 last night in St Lucia is yesterday', () => {
    // 2026-09-25T03:30Z = 24 Sep 23:30 in St Lucia → before today.
    const v = lastVisit({ now, encounters: [{ id: 'late', date: '2026-09-25T03:30:00Z', complete: true }] });
    expect(v?.encounterId).toBe('late');
    // 2026-09-25T04:30Z = 25 Sep 00:30 in St Lucia → today, not a previous visit.
    expect(lastVisit({ now, encounters: [{ id: 'x', date: '2026-09-25T04:30:00Z', complete: true }] })).toBeNull();
  });

  it('falls back to the last signed SOAP / progress / consultation note', () => {
    const v = lastVisit({
      now,
      encounters: [{ id: 'open', date: '2026-09-01T14:00:00Z', complete: false }],
      notes: [
        { date: '2026-09-02T14:00:00Z', status: 'signed', noteType: 'soap', plan: 'Repeat LFTs' },
        { date: '2026-09-10T14:00:00Z', status: 'draft', noteType: 'soap' },
        { date: '2026-09-12T14:00:00Z', status: 'signed', noteType: 'discharge' },
      ],
      fallbackDiagnosis: 'Choledocholithiasis',
    });
    expect(v).toMatchObject({ date: '2026-09-02T14:00:00Z', diagnosis: 'Choledocholithiasis', plan: 'Repeat LFTs', encounterId: null });
  });

  it('is null for a patient never seen before', () => {
    expect(lastVisit({ now, encounters: [] })).toBeNull();
  });

  it('counts calendar days in the practice time zone', () => {
    expect(daysSinceVisit('2026-09-11T14:00:00Z', now)).toBe(14);
    expect(daysSinceVisit('2026-09-25T03:30:00Z', now)).toBe(1);
  });
});

// ── Recommendation wording (iOS ConsultPathway.recommend) ────────────────────────────────────
describe('recommendContinuity', () => {
  const now = new Date('2026-09-25T19:00:00Z');
  const last: PreviousVisit = {
    date: '2026-09-11T14:00:00Z', complaint: 'RUQ pain', diagnosis: 'Acute cholecystitis',
    diagnosisICD: 'K81.0', plan: 'Lap chole list',
  };

  it('same problem → follow-up, "Continuing: <problem>"', () => {
    const r = recommendContinuity(last, 'abdominal pain', now);
    expect(r.visitType).toBe('follow_up');
    expect(r.reasons).toEqual(['Seen before — last visit 14 days ago', 'Continuing: Acute cholecystitis [K81.0]']);
  });

  it('different complaint → new problem, "New complaint — last visit was for …"', () => {
    const r = recommendContinuity(last, 'Breast lump', now);
    expect(r.visitType).toBe('new_consult');
    expect(r.reasons).toEqual(['Seen before — last visit 14 days ago', 'New complaint — last visit was for Acute cholecystitis [K81.0]']);
  });

  it('singular day; nothing recorded last time → follow-up without a "Continuing" line', () => {
    const r = recommendContinuity({ ...last, date: '2026-09-24T14:00:00Z', complaint: null, diagnosis: null, diagnosisICD: null }, 'Breast lump', now);
    // Nothing to compare with → same problem, no "Continuing" line.
    expect(r.reasons).toEqual(['Seen before — last visit 1 day ago']);
  });
});
