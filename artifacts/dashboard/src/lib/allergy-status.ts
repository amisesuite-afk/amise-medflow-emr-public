/**
 * Allergy status for the header, the consultation banners and the printed note.
 *
 * Web twin of the iOS model (`ios/AmiseMedFlow/Models/Patient+Allergies.swift`): an empty
 * allergy field means "not recorded", never "no known drug allergies". NKDA is reported only
 * when the chart explicitly records it — the "No known allergies" chip on the Allergies step,
 * the encounter wizard's "None — NKDA" toggle (stored as `NKDA`), or the clinician typing it.
 *
 * The allergy field is a comma-separated string (`AppContext.allergies`); nothing about its
 * storage changes here, so every saved encounter reads back exactly as before.
 */

/** Value the encounter wizard stores for an explicit "no known drug allergies" answer. */
export const NKDA_MARKER = 'NKDA';

export type AllergyStatus =
  /** Nothing recorded: the allergy history has not been taken (or not written down). */
  | { kind: 'not_recorded' }
  /** The clinician explicitly recorded "no known drug allergies". */
  | { kind: 'nkda' }
  /** Real allergies are recorded. `conflictsWithNkda` = NKDA was also marked (needs reconciling). */
  | { kind: 'recorded'; allergies: string[]; conflictsWithNkda: boolean };

// "NKDA", "NKA", "No known allergies", "No known drug allergies (NKDA)", "None", "Nil known"…
const NKDA_ENTRY = /^(?:nkda|nka|nil|none|nil known|none known|no known(?: drug)? allerg(?:y|ies)(?:\s*\((?:nkda|nka)\))?)\.?$/i;

/** True for an entry that explicitly states "no known (drug) allergies". */
export function isNkdaEntry(entry: string): boolean {
  return NKDA_ENTRY.test(entry.trim());
}

/** Split the stored allergy text into entries (comma, semicolon or new line). */
export function parseAllergyEntries(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
}

export function allergyStatus(text: string | null | undefined): AllergyStatus {
  const entries = parseAllergyEntries(text);
  if (entries.length === 0) return { kind: 'not_recorded' };
  const real = entries.filter(e => !isNkdaEntry(e));
  const hasNkda = real.length < entries.length;
  if (real.length === 0) return { kind: 'nkda' };
  return { kind: 'recorded', allergies: real, conflictsWithNkda: hasNkda };
}

/** One line for printed documents (clinical note, referral letter). */
export function allergyNoteText(text: string | null | undefined): string {
  const s = allergyStatus(text);
  if (s.kind === 'not_recorded') return 'Allergies: not recorded';
  if (s.kind === 'nkda') return 'No known drug allergies (NKDA)';
  return s.conflictsWithNkda
    ? `${s.allergies.join(', ')} (NKDA was also marked — reconcile)`
    : s.allergies.join(', ');
}

/** Short label for the header chip. */
export function allergyHeaderLabel(text: string | null | undefined): string {
  const s = allergyStatus(text);
  if (s.kind === 'not_recorded') return 'Allergies: not recorded';
  if (s.kind === 'nkda') return 'NKDA';
  const [first, ...rest] = s.allergies;
  return `⚠ ${first}${rest.length ? ` +${rest.length}` : ''}`;
}
