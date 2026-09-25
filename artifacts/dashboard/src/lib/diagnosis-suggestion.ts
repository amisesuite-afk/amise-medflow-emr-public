/**
 * Suggested working diagnosis (UX review C4).
 *
 * A single exam sign ("Murphy's sign +") used to set AND lock the working diagnosis, fill the
 * primary ICD-10 code and drive an inpatient plan — the system diagnosing before the surgeon
 * decided. A pathognomonic-sign match is now only a SUGGESTION ("Suggested: Acute cholecystitis
 * — tap to confirm"); `workingDiagnosis` and the ICD code are set, and locked, only when the
 * clinician confirms it. Plan and other tabs radiate only from a confirmed diagnosis, and then
 * only as suggestions (CLAUDE.md → Central diagnosis radiation).
 */
import type { WorkingDiagnosis } from '@/context/AppContext';

export interface SignMatch {
  finding: string;
  diseaseId: string;
  diseaseLabel: string;
  icd10: string;
  specificity: 'high' | 'definitive';
}

export interface DiagnosisSuggestion {
  key: string;
  diseaseId: string;
  diseaseLabel: string;
  icd10: string;
  signText: string;
  specificity: SignMatch['specificity'];
}

/** True when the clinician has confirmed (and so locked) a working diagnosis. */
export function isConfirmedDiagnosis(wd: WorkingDiagnosis | null | undefined): wd is WorkingDiagnosis {
  return !!wd && wd.locked === true;
}

export function suggestionKey(m: Pick<SignMatch, 'diseaseId' | 'finding'>): string {
  return `${m.diseaseId}|${m.finding.toLowerCase().trim()}`;
}

/**
 * The suggestion to show for a sign match, or null: nothing matched, the clinician dismissed it,
 * or a working diagnosis is already confirmed (a sign never overrides the clinician's choice).
 */
export function diagnosisSuggestion(
  match: SignMatch | null | undefined,
  workingDiagnosis: WorkingDiagnosis | null | undefined,
  dismissed: ReadonlySet<string> = new Set(),
): DiagnosisSuggestion | null {
  if (!match) return null;
  if (isConfirmedDiagnosis(workingDiagnosis)) return null;
  const key = suggestionKey(match);
  if (dismissed.has(key)) return null;
  return { key, diseaseId: match.diseaseId, diseaseLabel: match.diseaseLabel, icd10: match.icd10, signText: match.finding, specificity: match.specificity };
}

/**
 * The clinician's "Confirm" tap: the working diagnosis (locked) and the ICD-10 list with this
 * code as primary when none is recorded yet (a code the clinician already chose stays primary;
 * this one is added after it).
 */
export function confirmDiagnosisSuggestion(
  s: DiagnosisSuggestion,
  icdCodes: readonly string[],
): { workingDiagnosis: WorkingDiagnosis; icdCodes: string[] } {
  const label = `${s.icd10} — ${s.diseaseLabel}`;
  const hasCode = icdCodes.some(c => c === label || c.split(' — ')[0]?.trim() === s.icd10);
  return {
    workingDiagnosis: {
      diseaseId: s.diseaseId,
      icdCode: s.icd10,
      // Same confidence the sign carried before (the clinician's confirmation is `locked`).
      confidence: s.specificity === 'definitive' ? 0.97 : 0.88,
      source: 'pathognomonic',
      locked: true,
      signText: s.signText,
      diseaseLabel: s.diseaseLabel,
    },
    icdCodes: hasCode ? [...icdCodes] : [...icdCodes, label],
  };
}

/**
 * The protocol a plan suggestion may come from: only a clinician-confirmed diagnosis (a locked
 * working diagnosis, or an ICD-10 code the clinician recorded) — never an unconfirmed PANE
 * convergence or a sign match. Returns the disease id and ICD-10 code to look up, or nulls.
 */
export function confirmedPlanSource(
  workingDiagnosis: WorkingDiagnosis | null | undefined,
  icdCodes: readonly string[],
): { diseaseId: string | null; icdCode: string | null } {
  const recordedIcd = icdCodes[0]?.split(' — ')[0]?.trim() || null;
  const wd = isConfirmedDiagnosis(workingDiagnosis) ? workingDiagnosis : null;
  return { diseaseId: wd?.diseaseId ?? null, icdCode: recordedIcd ?? wd?.icdCode ?? null };
}

/**
 * The clinician's "Insert suggested plan" tap. An empty plan, or one still holding the previous
 * inserted suggestion unedited, is replaced; anything the clinician wrote is kept and the
 * suggestion is appended below it.
 */
export function insertSuggestedPlan(current: string, suggested: string, lastInserted: string): string {
  if (!current.trim() || (lastInserted && current === lastInserted)) return suggested;
  return `${current.trimEnd()}\n\n${suggested}`;
}
