/**
 * Visit-type defaulting for a returning patient on the web (mirrors iOS ConsultationView
 * handleAppear): follow-up of the last problem unless today's complaint is new; specific bookings
 * stand; decided only for an encounter that is starting.
 */
import { describe, expect, it } from 'vitest';
import type { EncounterSummary } from '@/lib/db';
import {
  computeContinuity, currentComplaintText, decideAutoVisitType, encounterIsStarting,
  encounterSummariesToVisits, firstClinicalLine, medicationsToCarryForward,
} from '@/lib/visit-continuity-web';

// 2026-09-25 15:00 in St Lucia (UTC-4).
const NOW = new Date('2026-09-25T19:00:00Z');

function enc(over: Partial<EncounterSummary> & { id: string }): EncounterSummary {
  return {
    createdAt: '2026-09-11T14:00:00Z', status: 'closed', encounterType: 'outpatient',
    chiefComplaint: null, site: 'rodney_bay', diagnosis: null, icd10Code: null,
    planDescription: null, followUpDate: null, followUpNotes: null,
    ...over,
  };
}

const lastCholecystitis = enc({
  id: 'prev', chiefComplaint: 'RUQ pain', diagnosis: 'Acute cholecystitis\nTokyo grade I',
  icd10Code: 'K81.0', planDescription: 'Lap chole list; USS in 2 weeks',
});
const today = enc({ id: 'today', createdAt: '2026-09-25T13:00:00Z', status: 'open' });

function decide(visitType: string, complaint: string, encounters: EncounterSummary[] = [today, lastCholecystitis],
                extra: Partial<Parameters<typeof decideAutoVisitType>[0]> = {}) {
  return decideAutoVisitType({
    visitType, complaint, encounters, currentEncounterId: 'today', encountersLoaded: true,
    encounterMode: 'outpatient', now: NOW, ...extra,
  });
}

describe('decideAutoVisitType', () => {
  it('returning patient, same problem: booked "First Consult" becomes a follow-up', () => {
    const d = decide('new_consult', 'abdominal pain');
    expect(d.action).toBe('set');
    if (d.action !== 'set') return;
    expect(d.visitType).toBe('follow_up');
    expect(d.state.recommendation.reasons).toEqual([
      'Seen before — last visit 14 days ago', 'Continuing: Acute cholecystitis [K81.0]',
    ]);
  });

  it('no complaint yet, or no visit type chosen: follow-up', () => {
    const d = decide('', '');
    expect(d).toMatchObject({ action: 'set', visitType: 'follow_up' });
  });

  it('returning patient, different complaint: first consult for the new problem', () => {
    const d = decide('follow_up', 'Breast lump');
    expect(d.action).toBe('set');
    if (d.action !== 'set') return;
    expect(d.visitType).toBe('new_consult');
    expect(d.state.recommendation.reasons[1]).toBe('New complaint — last visit was for Acute cholecystitis [K81.0]');
  });

  it('specific bookings stand', () => {
    for (const vt of ['pre_op', 'post_op', 'day_of_surgery', 'ercp', 'endoscopy_ogd', 'endoscopy_col',
                      'breast', 'telephone', 'diabetic_foot', 'urgent', 'trauma', 'burns']) {
      expect(decide(vt, 'abdominal pain'), vt).toEqual({ action: 'skip', reason: 'specific_booking' });
    }
  });

  it('a ward (inpatient) encounter stands', () => {
    expect(decide('new_consult', '', undefined, { encounterMode: 'inpatient' }))
      .toEqual({ action: 'skip', reason: 'inpatient' });
  });

  it('a patient never seen before is left to the clinician', () => {
    expect(decide('new_consult', 'RUQ pain', [today])).toEqual({ action: 'skip', reason: 'no_history' });
    // An earlier encounter that was never completed is not a previous visit.
    expect(decide('new_consult', 'RUQ pain', [today, enc({ id: 'old', status: 'open' })]))
      .toEqual({ action: 'skip', reason: 'no_history' });
  });

  it('a visit completed earlier today is not "a previous visit"', () => {
    const earlierToday = enc({ id: 'am', createdAt: '2026-09-25T12:00:00Z', status: 'closed' });
    expect(decide('new_consult', '', [today, earlierToday])).toEqual({ action: 'skip', reason: 'no_history' });
  });

  it('waits for the patient’s encounters, and never re-decides a closed or older encounter', () => {
    expect(decide('new_consult', '', undefined, { encountersLoaded: false })).toEqual({ action: 'wait' });
    expect(decide('new_consult', '', undefined, { currentEncounterId: 'prev' }))
      .toEqual({ action: 'skip', reason: 'not_starting' });
    const reopened = enc({ id: 'reopened', createdAt: '2026-09-20T14:00:00Z', status: 'in_progress' });
    expect(decide('new_consult', '', [reopened, lastCholecystitis], { currentEncounterId: 'reopened' }))
      .toEqual({ action: 'skip', reason: 'not_starting' });
    expect(decide('new_consult', '', undefined, { currentEncounterId: null }))
      .toEqual({ action: 'skip', reason: 'no_encounter' });
  });

  it('an encounter created after the list loaded counts as starting', () => {
    expect(encounterIsStarting('brand-new', [lastCholecystitis], NOW)).toBe(true);
    expect(decide('new_consult', '', [lastCholecystitis], { currentEncounterId: 'brand-new' }))
      .toMatchObject({ action: 'set', visitType: 'follow_up' });
  });
});

describe('web adapters', () => {
  it('maps encounter summaries (closed = completed, cancelled = not live, first line of the assessment)', () => {
    const [v] = encounterSummariesToVisits([lastCholecystitis]);
    expect(v).toMatchObject({
      id: 'prev', complete: true, live: true, diagnosis: 'Acute cholecystitis',
      diagnosisICD: 'K81.0', plan: 'Lap chole list; USS in 2 weeks',
    });
    expect(encounterSummariesToVisits([enc({ id: 'c', status: 'cancelled' })])[0]).toMatchObject({ live: false });
  });

  it('computeContinuity keeps the previous encounter id and plan for the "Continuing from" card', () => {
    const s = computeContinuity({ encounters: [today, lastCholecystitis], currentEncounterId: 'today', complaint: '', now: NOW });
    expect(s?.previous).toMatchObject({ encounterId: 'prev', plan: 'Lap chole list; USS in 2 weeks' });
  });

  it('currentComplaintText prefers CC entries, then symptoms, then free text', () => {
    expect(currentComplaintText({ procedureData: { cc: [{ complaint: 'RUQ pain' }, { complaint: 'Jaundice' }] }, symptoms: ['Fever'], freeText: 'x' }))
      .toBe('RUQ pain; Jaundice');
    expect(currentComplaintText({ procedureData: {}, symptoms: ['Fever', 'Vomiting'], freeText: 'x' })).toBe('Fever, Vomiting');
    expect(currentComplaintText({ freeText: '\n[From questionnaire] Breast lump\nsecond line' })).toBe('Breast lump');
    expect(currentComplaintText({})).toBe('');
  });

  it('firstClinicalLine trims and caps', () => {
    expect(firstClinicalLine('  \n  Acute appendicitis  \nplan')).toBe('Acute appendicitis');
    expect(firstClinicalLine('a'.repeat(200), 10)).toBe(`${'a'.repeat(9)}…`);
    expect(firstClinicalLine('   ')).toBeNull();
  });

  it('medicationsToCarryForward lists only medicines not already on today’s list', () => {
    expect(medicationsToCarryForward(['Metformin 500 mg', 'Omeprazole', 'omeprazole', ' '], ['OMEPRAZOLE']))
      .toEqual(['Metformin 500 mg']);
  });
});
