/**
 * Visit continuity on the web dashboard: which visit type a new encounter for a returning patient
 * starts as. Mirrors ios ConsultationView.handleAppear:
 *
 *  - A returning patient (a completed encounter before today) is a follow-up of the last problem,
 *    unless today's chief complaint is a new, different one — then it is a first consult for the
 *    new problem. The booked "First Consult" type does not win for a returning patient.
 *  - Specific bookings stand: pre-op, post-op, day of surgery, ERCP, OGD, colonoscopy, breast,
 *    telephone, diabetic foot, urgent, trauma, burns. So does a ward (inpatient) encounter.
 *  - It is decided once, when the encounter starts (created today, not closed), without a picker.
 *    The clinician can change it with one tap (VisitContinuityPanel) or the header select.
 *
 * Pure (no React, no I/O) so the defaulting rules are unit-tested
 * (src/lib/__tests__/visit-continuity-web.test.ts). The word rules live in
 * @workspace/triage-engine/visit-continuity, the twin of VisitContinuity.swift.
 */
import {
  isPracticeToday, lastVisit, recommendContinuity,
  type ContinuityRecommendation, type PreviousVisit, type VisitRecord,
} from '@workspace/triage-engine/visit-continuity';
import type { EncounterSummary } from '@/lib/db';

/** Visit types the record may decide for a returning patient. Anything else is a specific booking. */
export const CONTINUITY_DECIDES_VISIT_TYPES: ReadonlySet<string> = new Set(['', 'new_consult', 'follow_up']);

/** Encounter statuses that mean the visit is finished (the web's "completed encounter"). */
const COMPLETE_STATUSES = new Set(['closed']);
const DEAD_STATUSES = new Set(['cancelled']);

/**
 * First non-empty line of a free-text field, capped. The web stores the whole assessment text as
 * the encounter's "diagnosis"; iOS compares a short working diagnosis, so only its first line is
 * used for matching and display.
 */
export function firstClinicalLine(text: string | null | undefined, max = 160): string | null {
  if (!text) return null;
  const line = text.split(/\r?\n/).map(s => s.trim()).find(s => s.length > 0);
  if (!line) return null;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** The dashboard's encounter summaries (GET /api/encounters/patient/:id) as visit records. */
export function encounterSummariesToVisits(list: readonly EncounterSummary[]): VisitRecord[] {
  return list.map(e => ({
    id: e.id,
    date: e.createdAt,
    complete: COMPLETE_STATUSES.has(e.status),
    live: !DEAD_STATUSES.has(e.status),
    complaint: firstClinicalLine(e.chiefComplaint, 300),
    diagnosis: firstClinicalLine(e.diagnosis),
    diagnosisICD: e.icd10Code?.trim() || null,
    plan: e.planDescription?.trim() || null,
  }));
}

interface CcEntryLike { complaint?: unknown }

/**
 * Today's chief complaint as text: the consultation's CC entries (procedureData.cc), else the
 * intake symptoms, else the first line of the free-text complaint.
 */
export function currentComplaintText(input: {
  procedureData?: Record<string, unknown> | null;
  symptoms?: readonly string[] | null;
  freeText?: string | null;
}): string {
  const cc = input.procedureData?.['cc'];
  if (Array.isArray(cc)) {
    const names = (cc as CcEntryLike[])
      .map(e => (typeof e?.complaint === 'string' ? e.complaint.trim() : ''))
      .filter(Boolean);
    if (names.length) return names.join('; ').slice(0, 300);
  }
  const symptoms = (input.symptoms ?? []).map(s => s.trim()).filter(Boolean);
  if (symptoms.length) return symptoms.join(', ').slice(0, 300);
  const ft = (input.freeText ?? '').replace(/\[From questionnaire\]\s*/g, '');
  return firstClinicalLine(ft, 300) ?? '';
}

/**
 * Is the encounter being documented a new one (starting today)? An encounter not yet in the list
 * was just created. A closed or cancelled one, or one opened before today (a reopened old
 * encounter), is not re-decided.
 */
export function encounterIsStarting(currentEncounterId: string | null | undefined,
                                    encounters: readonly EncounterSummary[], now: Date = new Date()): boolean {
  if (!currentEncounterId) return false;
  const cur = encounters.find(e => e.id === currentEncounterId);
  if (!cur) return true;
  if (COMPLETE_STATUSES.has(cur.status) || DEAD_STATUSES.has(cur.status)) return false;
  return isPracticeToday(cur.createdAt, now);
}

export interface ContinuityState {
  previous: PreviousVisit;
  recommendation: ContinuityRecommendation;
}

/** Last visit before today and what it suggests for today's complaint; null for a new patient. */
export function computeContinuity(input: {
  encounters: readonly EncounterSummary[];
  currentEncounterId: string | null | undefined;
  complaint: string;
  now?: Date;
}): ContinuityState | null {
  const now = input.now ?? new Date();
  const previous = lastVisit({
    encounters: encounterSummariesToVisits(input.encounters),
    excludeEncounterId: input.currentEncounterId ?? null,
    now,
  });
  if (!previous) return null;
  return { previous, recommendation: recommendContinuity(previous, input.complaint, now) };
}

export type AutoVisitTypeDecision =
  /** The patient's encounter list has not loaded yet — decide later. */
  | { action: 'wait' }
  /** Nothing to do (and nothing to re-check for this encounter). */
  | { action: 'skip'; reason: 'no_encounter' | 'not_starting' | 'no_history' | 'specific_booking' | 'inpatient' }
  /** Record this visit type (it may already be the current one). */
  | { action: 'set'; visitType: 'follow_up' | 'new_consult'; state: ContinuityState };

/**
 * What visit type a starting encounter gets (iOS handleAppear). Called once per encounter, when
 * the consultation opens.
 */
export function decideAutoVisitType(input: {
  visitType: string | null | undefined;
  encounterMode?: 'outpatient' | 'inpatient' | string | null;
  currentEncounterId: string | null | undefined;
  encounters: readonly EncounterSummary[];
  /** The encounter list above belongs to the loaded patient. */
  encountersLoaded: boolean;
  complaint: string;
  now?: Date;
}): AutoVisitTypeDecision {
  const now = input.now ?? new Date();
  if (!input.currentEncounterId) return { action: 'skip', reason: 'no_encounter' };
  if (!input.encountersLoaded) return { action: 'wait' };
  if (!encounterIsStarting(input.currentEncounterId, input.encounters, now)) {
    return { action: 'skip', reason: 'not_starting' };
  }
  if (!CONTINUITY_DECIDES_VISIT_TYPES.has(input.visitType ?? '')) {
    return { action: 'skip', reason: 'specific_booking' };
  }
  if (input.encounterMode === 'inpatient') return { action: 'skip', reason: 'inpatient' };
  const state = computeContinuity({
    encounters: input.encounters, currentEncounterId: input.currentEncounterId,
    complaint: input.complaint, now,
  });
  if (!state) return { action: 'skip', reason: 'no_history' };
  return { action: 'set', visitType: state.recommendation.visitType, state };
}

/** Medicines on the last visit's list that today's list does not have yet (case-insensitive). */
export function medicationsToCarryForward(lastVisitMeds: readonly string[], todaysMeds: readonly string[]): string[] {
  const have = new Set(todaysMeds.map(m => m.trim().toLowerCase()));
  const out: string[] = [];
  for (const m of lastVisitMeds) {
    const key = m.trim().toLowerCase();
    if (!key || have.has(key)) continue;
    have.add(key);
    out.push(m.trim());
  }
  return out;
}
