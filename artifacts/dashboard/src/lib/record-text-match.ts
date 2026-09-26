/**
 * Record-text matching for the PANE feature mappers (socrates-to-features.ts,
 * transcript-dx-mapper.ts). Web only; deterministic.
 *
 * Every match first goes through the shared negation-aware matcher
 * (lib/triage-engine negation.ts `findAllAffirmed`, iOS twin NegationMatcher.swift, unchanged).
 * This module applies the clause rules a feature mapper needs on top of it (implemented once in
 * lib/triage-engine/src/record-clauses.ts, twin of iOS RecordClauses.swift), because a feature is
 * a finding about THIS patient NOW:
 *
 *  1. LIST NEGATION. negation.ts counts every word between a cue and the term (window 5), so in
 *     "has never had abdominal pain, indigestion after food, jaundice or fever" the "fever" is too
 *     far from "never". Here, inside a negated comma list that ends with "or" / "nor" ("no A, B or
 *     C"), each item gets its own window of 5 words. After "denies" / "denied" / "never" a comma
 *     list may also end with "and" ("denies fever, rigors and night sweats"). A bare "no A, B" list
 *     without "or" keeps negation.ts's safety bias ("No vomiting, rigid abdomen" keeps "rigid").
 *  2. FAMILY HISTORY. "Mother had breast cancer", "family history of bowel cancer", "FH: IHD":
 *     the finding belongs to a relative, never to the patient.
 *  3. NOT CURRENT (findings that mean "now": symptoms, signs, an injury mechanism). A finding in a
 *     sentence dated years back ("Splenectomy 6 years ago after a motorbike accident") that does not
 *     also say it is ongoing; a condition named as the reason for an operation that is done or
 *     planned ("after an umbilical hernia repair", "awaiting elective repair of a femoral
 *     hernia", "plan surgery for a large incisional hernia": a known background condition, not a
 *     presenting finding); and a lay person's guess ("Mother thought it was a hernia").
 *
 * The rules only ever REMOVE a match; when unsure the match is kept (negation.ts safety bias).
 */

import { FEATURES } from '@workspace/pane-engine';
import { familyHistoryAt, findAllAffirmed, listNegatedAt, notCurrentAt } from '@workspace/triage-engine';

// The clause rules live in lib/triage-engine/src/record-clauses.ts (twin: iOS RecordClauses.swift,
// shared vectors RecordClauseVectors.json); re-exported here for the mapper and its tests.
export { familyHistoryAt, listNegatedAt, notCurrentAt, sentenceOf } from '@workspace/triage-engine';

/**
 * PANE features that mean "now" (symptoms and signs, and an injury mechanism): a mention in a
 * historical sentence, a background operation or a lay guess does not record them. History
 * features (previous surgery, a known stone, medicines) and results do.
 */
export const CURRENT_FEATURES: ReadonlySet<string> = new Set([
  ...FEATURES.filter(f => f.category === 'symptom' || f.category === 'sign').map(f => f.id),
  'trauma_mechanism',
]);

export interface RecordMatchOptions {
  /**
   * The feature means a current finding (symptom, sign, injury mechanism): also drop matches in
   * historical, background-operation and attributed-guess clauses. Family history and negation
   * always apply.
   */
  current?: boolean;
  /** Negation only (negation.ts and negated lists): the family-history and time rules are off. */
  negationOnly?: boolean;
}

export interface RecordMatch {
  index: number;
  text: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Every occurrence of `pattern` in `text` that is a finding about the patient (see header). */
export function findRecordMatches(text: string, pattern: RegExp | string, opts: RecordMatchOptions = {}): RecordMatch[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return findAllAffirmed(text, pattern).filter(m => {
    if (listNegatedAt(lower, m.index)) return false;
    if (opts.negationOnly) return true;
    if (familyHistoryAt(lower, m.index, m.index + m.text.length)) return false;
    if (opts.current && notCurrentAt(lower, m.index, m.index + m.text.length)) return false;
    return true;
  });
}

/** Negation-, list-, family- (and optionally time-) aware `pattern.test(text)`. */
export function recordHas(text: string, pattern: RegExp | string, opts: RecordMatchOptions = {}): boolean {
  return findRecordMatches(text, pattern, opts).length > 0;
}

/**
 * Regex gap that cannot cross a negation cue: rule patterns written as "A[^.]{0,30}B" become
 * "A(?:(?!\bno\b|...)[^.]){0,30}B", so "DRE: no mass" no longer matches "dre … mass" (the cue sat
 * inside the match, where the negation check cannot see it).
 */
export function negationFreeGaps(re: RegExp): RegExp {
  const src = re.source.replace(/\[\^\.\]\{0,(\d+)\}/g, (_, n: string) =>
    String.raw`(?:(?!\b(?:no|not|nil|without|never|denies|denied|negative|absent|none)\b)[^.]){0,${n}}`);
  return src === re.source ? re : new RegExp(src, re.flags);
}
