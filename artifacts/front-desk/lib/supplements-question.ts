/**
 * The mandatory "herbs, teas, bush remedies and supplements" question, asked of patients in the
 * pre-visit questionnaire (/previsit/[token]) and the portal intake (/patient/intake).
 *
 * Worded to include local Caribbean bush teas, which patients often do not count as medicine
 * (owner's evidence briefing §7). It ASKS only — it never tells a patient to take, stop or hold
 * anything (hazard H-10). Same words as the dashboard's SUPPLEMENT_PATIENT_QUESTION
 * (artifacts/dashboard/src/lib/supplement-catalogue.ts) and iOS SupplementCatalogue.patientQuestion;
 * `lint:patient-instructions` fails if they differ.
 */

export const SUPPLEMENT_PATIENT_QUESTION =
  'Do you take any herbs, bush teas, bush medicines, vitamins or supplements? Please include teas and remedies from the garden or market.';

export type SupplementAnswer = '' | 'yes' | 'no' | 'unsure';

/** Marker stored as the `indication` of the answer row in previsit_submissions.medications. */
export const SUPPLEMENT_ANSWER_INDICATION = 'Herbs, bush teas, vitamins or supplements (patient-reported answer)';

/** One-line summary of the answer, e.g. for current_meds text and the review screen. */
export function supplementAnswerLine(answer: SupplementAnswer, details: string): string | null {
  const d = details.trim();
  switch (answer) {
    case 'yes':    return `Herbs, bush teas, vitamins or supplements: ${d || 'yes (not named)'}`;
    case 'no':     return 'Herbs, bush teas, vitamins or supplements: none';
    case 'unsure': return `Herbs, bush teas, vitamins or supplements: not sure${d ? ` — ${d}` : ''}`;
    default:       return null;
  }
}
