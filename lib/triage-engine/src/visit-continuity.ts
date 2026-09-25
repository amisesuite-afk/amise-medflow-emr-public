// visit-continuity.ts
// Is this a returning patient, and is today's complaint the same problem as last time?
//
// Web twin of ios/AmiseMedFlow/Services/VisitContinuity.swift. The owner's instruction
// (Dr Kabiye, 2026-09-25): a patient seen before is automatically a follow-up of the last
// problem unless today's chief complaint is a new, different one, in which case it is a
// new-problem (first-visit) consultation.
//
// DRIFT NOTE: the word rules below (stop words, body-region map, suffix trimming, four-letter
// minimum) must stay identical to VisitContinuity.swift. The iOS test vectors in
// ios/AmiseMedFlowTests/VisitContinuityTests.swift are ported one for one in
// artifacts/dashboard/src/lib/__tests__/visit-continuity.test.ts — change both files and both
// test files in the same PR.
//
// Pure: no I/O, no React. The dashboard adapts its encounter summaries into `VisitRecord`s
// (artifacts/dashboard/src/lib/visit-continuity-web.ts).

/** Eastern Caribbean Time — America/St_Lucia, UTC-4, no DST (CLAUDE.md "Timezone"). */
export const VISIT_CONTINUITY_UTC_OFFSET_MINUTES = -240;

/** The patient's last completed visit before today. */
export interface PreviousVisit {
  /** ISO timestamp of the visit. */
  date: string;
  complaint: string | null;
  diagnosis: string | null;
  diagnosisICD: string | null;
  plan: string | null;
  /** Web only: the encounter the visit was saved as (null for a note-only visit). */
  encounterId?: string | null;
}

/** A saved visit (an encounter on the web). */
export interface VisitRecord {
  id?: string | null;
  /** ISO timestamp or Date of the visit. */
  date: string | Date;
  /** Completed (a closed encounter on the web; `Encounter.isComplete` on iOS). */
  complete: boolean;
  /** Not cancelled / soft-deleted. Defaults to true. */
  live?: boolean;
  complaint?: string | null;
  diagnosis?: string | null;
  diagnosisICD?: string | null;
  plan?: string | null;
}

/** A clinical note, used only when no completed visit was saved. */
export interface VisitNoteRecord {
  date: string | Date;
  status: string;
  noteType: string;
  live?: boolean;
  plan?: string | null;
  complaint?: string | null;
  diagnosis?: string | null;
  diagnosisICD?: string | null;
}

/** Note types that document a clinic or ward visit (iOS `visitNoteTypes`). */
export const VISIT_NOTE_TYPES: ReadonlySet<string> = new Set(['soap', 'progress', 'consultation']);

/** "Acute cholecystitis [K81.0]", else the complaint (iOS `PreviousVisit.problem`). */
export function previousVisitProblem(v: PreviousVisit): string | null {
  const dx = v.diagnosis?.trim();
  if (dx) {
    if (v.diagnosisICD) return `${dx} [${v.diagnosisICD}]`;
    return dx;
  }
  const cc = v.complaint?.trim();
  if (cc) return cc;
  return null;
}

function toMs(d: string | Date): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

function toIso(d: string | Date): string {
  return d instanceof Date ? d.toISOString() : d;
}

/** Calendar day number (days since epoch) of an instant, in the practice's time zone. */
export function practiceDayNumber(d: string | Date, offsetMinutes = VISIT_CONTINUITY_UTC_OFFSET_MINUTES): number {
  return Math.floor((toMs(d) + offsetMinutes * 60_000) / 86_400_000);
}

/** Whole calendar days from the visit to `now`, in the practice's time zone. */
export function daysSinceVisit(visitDate: string | Date, now: Date = new Date(),
                               offsetMinutes = VISIT_CONTINUITY_UTC_OFFSET_MINUTES): number {
  return practiceDayNumber(now, offsetMinutes) - practiceDayNumber(visitDate, offsetMinutes);
}

/** True when the instant falls on today's calendar date (practice time zone). */
export function isPracticeToday(d: string | Date, now: Date = new Date(),
                                offsetMinutes = VISIT_CONTINUITY_UTC_OFFSET_MINUTES): boolean {
  return practiceDayNumber(d, offsetMinutes) === practiceDayNumber(now, offsetMinutes);
}

export interface LastVisitInput {
  encounters: readonly VisitRecord[];
  /** Signed-note fallback, used only when no completed visit before today exists. */
  notes?: readonly VisitNoteRecord[];
  /** Diagnosis to report for a note-only visit when the note carries none (iOS: the patient's). */
  fallbackDiagnosis?: string | null;
  fallbackDiagnosisICD?: string | null;
  /** The encounter being documented now — never "a previous visit". */
  excludeEncounterId?: string | null;
  now?: Date;
  offsetMinutes?: number;
}

/**
 * Last saved visit (completed encounter) or, when none was saved, the last signed visit note,
 * from before today. Today's own record is not "a previous visit" (iOS `lastVisit(for:)`).
 */
export function lastVisit(input: LastVisitInput): PreviousVisit | null {
  const now = input.now ?? new Date();
  const offset = input.offsetMinutes ?? VISIT_CONTINUITY_UTC_OFFSET_MINUTES;
  const today = practiceDayNumber(now, offset);
  const beforeToday = (d: string | Date) => {
    const ms = toMs(d);
    return Number.isFinite(ms) && practiceDayNumber(d, offset) < today;
  };

  let bestEnc: VisitRecord | null = null;
  for (const e of input.encounters) {
    if (e.live === false || !e.complete || !beforeToday(e.date)) continue;
    if (input.excludeEncounterId && e.id === input.excludeEncounterId) continue;
    if (!bestEnc || toMs(e.date) > toMs(bestEnc.date)) bestEnc = e;
  }
  if (bestEnc) {
    return {
      date: toIso(bestEnc.date),
      complaint: bestEnc.complaint ?? null,
      diagnosis: bestEnc.diagnosis ?? null,
      diagnosisICD: bestEnc.diagnosisICD ?? null,
      plan: bestEnc.plan ?? null,
      encounterId: bestEnc.id ?? null,
    };
  }

  let bestNote: VisitNoteRecord | null = null;
  for (const n of input.notes ?? []) {
    if (n.live === false || n.status !== 'signed' || !VISIT_NOTE_TYPES.has(n.noteType)) continue;
    if (!beforeToday(n.date)) continue;
    if (!bestNote || toMs(n.date) > toMs(bestNote.date)) bestNote = n;
  }
  if (bestNote) {
    const hasOwnDx = !!bestNote.diagnosis?.trim();
    return {
      date: toIso(bestNote.date),
      complaint: bestNote.complaint ?? null,
      diagnosis: hasOwnDx ? bestNote.diagnosis ?? null : input.fallbackDiagnosis ?? null,
      diagnosisICD: hasOwnDx ? bestNote.diagnosisICD ?? null : input.fallbackDiagnosisICD ?? null,
      plan: bestNote.plan ?? null,
      encounterId: null,
    };
  }
  return null;
}

/**
 * Same problem as last time? True when there is no new complaint, or when today's complaint
 * shares a meaningful word with the last visit's complaint or diagnosis. A complaint with no
 * word in common is a new problem.
 */
export function isSameProblem(current: string | null | undefined, previous: PreviousVisit): boolean {
  const now = meaningfulWords(current ?? '');
  if (now.size === 0) return true;
  const before = meaningfulWords([previous.complaint, previous.diagnosis]
    .filter((s): s is string => typeof s === 'string').join(' '));
  if (before.size === 0) return true;   // nothing to compare with: treat as the same problem
  for (const w of now) if (before.has(w)) return true;
  return false;
}

/** Lower-cased content words of four letters or more, with simple plural/suffix trimming. */
export function meaningfulWords(text: string): Set<string> {
  // Swift: components(separatedBy: CharacterSet.letters.inverted) — split on anything that is not
  // a letter (CharacterSet.letters is Unicode categories L* and M*).
  const words = text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(w => w.length > 0);
  const out = new Set<string>();
  for (const w of words) {
    const region = REGION_OF.get(w);
    if (region) { out.add(region); continue; }   // "RUQ" ≈ "abdominal"
    if (charCount(w) < 4 || STOP_WORDS.has(w)) continue;
    out.add(stem(w));
  }
  return out;
}

function charCount(w: string): number {
  return [...w].length;
}

/** Body-region words, so a reworded complaint about the same area is not a new problem. */
const REGION_OF: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (region: string, words: string[]) => { for (const w of words) m.set(w, region); };
  add('region-abdomen', ['abdomen', 'abdominal', 'belly', 'stomach', 'tummy', 'epigastric', 'epigastrium',
    'ruq', 'luq', 'rlq', 'llq', 'rif', 'lif', 'umbilical', 'periumbilical', 'flank',
    'hypochondrium', 'suprapubic']);
  add('region-groin', ['groin', 'inguinal', 'femoral', 'scrotal', 'scrotum']);
  add('region-anorectal', ['anal', 'anus', 'perianal', 'rectal', 'rectum', 'bottom', 'piles', 'haemorrhoids',
    'hemorrhoids']);
  add('region-breast', ['breast', 'breasts', 'nipple', 'axilla', 'axillary']);
  add('region-neck', ['neck', 'thyroid', 'goitre', 'goiter']);
  add('region-foot', ['foot', 'feet', 'toe', 'toes', 'heel']);
  return m;
})();

function stem(w: string): string {
  for (const suffix of ['ing', 'ed', 's']) {
    if (w.endsWith(suffix) && !w.endsWith('ss') && charCount(w) - suffix.length >= 4) {
      return w.slice(0, w.length - suffix.length);
    }
  }
  return w;
}

/** Words that say nothing about which problem it is. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'pain', 'painful', 'ache', 'aching', 'with', 'without', 'since', 'days', 'weeks', 'months',
  'years', 'hours', 'left', 'right', 'both', 'bilateral', 'severe', 'mild', 'moderate',
  'acute', 'chronic', 'worse', 'worsening', 'better', 'improving', 'review', 'follow',
  'followup', 'check', 'visit', 'problem', 'issue', 'patient', 'history', 'after', 'before',
  'about', 'some', 'more', 'less', 'also', 'still', 'again', 'recurrent', 'ongoing', 'new',
  'unspecified', 'other', 'site', 'area', 'general', 'symptoms', 'symptom',
  'lump', 'lumps', 'swelling', 'mass', 'masses',
]);

/** Exposed for the parity test only. */
export const VISIT_CONTINUITY_WORD_RULES = { stopWords: STOP_WORDS, regionOf: REGION_OF } as const;

// ── Recommendation (iOS ConsultPathway.recommend, returning-patient branch) ──────────────────

export type ContinuityKind = 'follow_up' | 'new_problem';

export interface ContinuityRecommendation {
  kind: ContinuityKind;
  /** 'follow_up' or 'new_consult' (the web visit-type ids). */
  visitType: 'follow_up' | 'new_consult';
  daysAgo: number;
  problem: string | null;
  /** e.g. ["Seen before — last visit 14 days ago", "Continuing: Acute cholecystitis [K81.0]"]. */
  reasons: string[];
}

/**
 * Follow-up of the last problem ("Continuing: <problem>"), or a new problem ("New complaint —
 * last visit was for …"). Same wording as iOS `ConsultPathway.recommend(for:)`.
 */
export function recommendContinuity(previous: PreviousVisit, currentComplaint: string | null | undefined,
                                    now: Date = new Date(),
                                    offsetMinutes = VISIT_CONTINUITY_UTC_OFFSET_MINUTES): ContinuityRecommendation {
  const days = Math.max(0, daysSinceVisit(previous.date, now, offsetMinutes));
  const seen = `Seen before — last visit ${days} day${days === 1 ? '' : 's'} ago`;
  const problem = previousVisitProblem(previous);
  if (isSameProblem(currentComplaint, previous)) {
    return {
      kind: 'follow_up', visitType: 'follow_up', daysAgo: days, problem,
      reasons: [seen, ...(problem ? [`Continuing: ${problem}`] : [])],
    };
  }
  return {
    kind: 'new_problem', visitType: 'new_consult', daysAgo: days, problem,
    reasons: [seen, `New complaint — last visit was for ${problem ?? 'another problem'}`],
  };
}
