/**
 * Record-text matching for the PANE feature mappers (socrates-to-features.ts,
 * transcript-dx-mapper.ts). Web only; deterministic.
 *
 * Every match first goes through the shared negation-aware matcher
 * (lib/triage-engine negation.ts `findAllAffirmed`, iOS twin NegationMatcher.swift, unchanged).
 * This module adds the clause rules a feature mapper needs on top of it, because a feature is a
 * finding about THIS patient NOW:
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
import { findAllAffirmed } from '@workspace/triage-engine';

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

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

/** Start of the sentence containing `pos` (after . ; ! ? or a new line; not a decimal point). */
function sentenceStart(lower: string, pos: number): number {
  for (let i = pos - 1; i >= 0; i--) {
    const c = lower[i];
    if (c === ';' || c === '!' || c === '?' || c === '\n' || c === '\r') return i + 1;
    if (c === '.' && !(/\d/.test(lower[i - 1] ?? '') && /\d/.test(lower[i + 1] ?? ''))) return i + 1;
  }
  return 0;
}

function sentenceEnd(lower: string, pos: number): number {
  for (let i = pos; i < lower.length; i++) {
    const c = lower[i];
    if (c === ';' || c === '!' || c === '?' || c === '\n' || c === '\r') return i;
    if (c === '.' && !(/\d/.test(lower[i - 1] ?? '') && /\d/.test(lower[i + 1] ?? ''))) return i;
  }
  return lower.length;
}

/** Start of the clause containing `pos`: the sentence, also cut at ":" and brackets. */
function clauseStart(lower: string, pos: number): number {
  const s = sentenceStart(lower, pos);
  for (let i = pos - 1; i >= s; i--) {
    const c = lower[i];
    if (c === ':' || c === '(' || c === ')' || c === '[' || c === ']') return i + 1;
  }
  return s;
}

/** The sentence containing [start, end) (lowercased text). */
export function sentenceOf(lower: string, start: number, end: number): string {
  return lower.slice(sentenceStart(lower, start), sentenceEnd(lower, end));
}

// ── 1. List negation ────────────────────────────────────────────────────────────

/** Cues that govern a list (a subset of negation.ts's pre-negation cues). */
const LIST_CUE_RE = /\b(?:no|not|nil|never|without|neither|nor|denies|denied|deny|denying|free of|negative for)\b/g;
/** After these cues, a list may end with "and" as well as "or". */
const AND_LIST_CUES = new Set(['never', 'denies', 'denied', 'deny', 'denying', 'negative for', 'free of']);
/** Pseudo-negations (negation.ts PSEUDO_AFTER): the cue does not negate. */
const PSEUDO_NEXT = new Set([
  'change', 'changes', 'increase', 'improvement', 'better', 'relief', 'doubt', 'significant', 'only', 'improving',
  'improved', 'relieved', 'settling', 'settled', 'responding', 'responded', 'controlled', 'certain', 'sure',
  'clear', 'excluded', 'ruled', 'necessarily', 'delay', 'response', 'by', 'stopped', 'resolved', 'gone',
]);
/** Words that start a new assertion inside a list (negation.ts SCOPE_TERMINATORS, less "and"). */
const LIST_BREAKERS = new Set([
  'but', 'however', 'although', 'though', 'except', 'yet', 'whereas', 'while', 'whilst', 'apart', 'other',
  'besides', 'despite', 'with', 'which', 'who', 'shows', 'showed', 'showing', 'reveals', 'revealed',
  'demonstrates', 'demonstrated', 'plus', 'then', 'now', 'still', 'because', 'due', 'reports', 'reported',
  'complains', 'complained', 'presents', 'presented', 'describes', 'described', 'is', 'was', 'are', 'were',
  'has', 'have', 'had', 'feels', 'felt', 'says', 'said', 'developed', 'started', 'noticed',
]);
/** Words allowed straight after the cue ("never had", "has not had", "denies any"). */
const CUE_FILLERS = new Set(['had', 'has', 'have', 'any', 'been', 'experienced', 'noticed', 'reported', 'complained', 'of']);

const MAX_ITEM_WORDS = 5;
const MAX_LIST_ITEMS = 8;

/**
 * True when the occurrence starting at `start` is an item of a negated list, e.g. "fever" in
 * "never had abdominal pain, indigestion after food, jaundice or fever".
 */
export function listNegatedAt(lower: string, start: number): boolean {
  const cs = clauseStart(lower, start);
  const before = lower.slice(cs, start);
  // The last list cue in the clause before the occurrence.
  let cue: RegExpExecArray | null = null;
  LIST_CUE_RE.lastIndex = 0;
  for (let m = LIST_CUE_RE.exec(before); m; m = LIST_CUE_RE.exec(before)) cue = m;
  if (!cue) return false;
  const cueWord = cue[0];
  let between = before.slice(cue.index + cueWord.length);
  const firstWord = /^\s*([\p{L}'’]+)/u.exec(between)?.[1] ?? '';
  if (PSEUDO_NEXT.has(firstWord)) return false;
  // Skip "had", "any" ... straight after the cue.
  for (;;) {
    const m = /^\s*([\p{L}'’]+)/u.exec(between);
    if (!m || !CUE_FILLERS.has(m[1])) break;
    between = between.slice(m[0].length);
  }
  const allowAnd = AND_LIST_CUES.has(cueWord);
  // Split into items at commas, "or", "nor", "/" (and "and" after denies / never).
  const sepRe = allowAnd ? /,|\/|\b(?:or|nor|and)\b/g : /,|\/|\b(?:or|nor)\b/g;
  const seps: string[] = [];
  const items = between.split(sepRe);
  for (let m = sepRe.exec(between); m; m = sepRe.exec(between)) seps.push(m[0]);
  sepRe.lastIndex = 0;
  if (items.length < 2 || items.length > MAX_LIST_ITEMS) return false; // not a list: negation.ts decided
  for (const item of items) {
    const words = item.match(WORD_RE) ?? [];
    if (words.length > MAX_ITEM_WORDS) return false;
    if (words.some(w => LIST_BREAKERS.has(w))) return false;
  }
  // A real list: the separator before this item is "or"/"nor" (or "and" after denies / never), or
  // a conjunction follows in the same clause ("no fever, jaundice or rigors"; "denies fever,
  // rigors and night sweats"), with only short list items and no new assertion before it.
  const lastSep = seps[seps.length - 1]?.trim() ?? '';
  if (lastSep === 'or' || lastSep === 'nor' || (allowAnd && lastSep === 'and')) return true;
  const after = lower.slice(start, sentenceEnd(lower, start));
  const cut = after.search(/[:()[\]]/);
  const rest = cut >= 0 ? after.slice(0, cut) : after;
  const conj = rest.search(allowAnd ? /\b(?:or|nor|and)\b/ : /\b(?:or|nor)\b/);
  if (conj < 0) return false;
  const upToConj = rest.slice(0, conj);
  const restItems = upToConj.split(/,|\//);
  if (items.length + restItems.length - 1 > MAX_LIST_ITEMS) return false;
  return restItems.every(item => {
    const ws = item.match(WORD_RE) ?? [];
    return ws.length <= MAX_ITEM_WORDS && !ws.some(w => LIST_BREAKERS.has(w));
  });
}

// ── 2. Family history ───────────────────────────────────────────────────────────

const RELATIVE = String.raw`(?:mother|mum|mom|father|dad|sister|brother|son|daughter|aunt|uncle|grand(?:mother|father|parent)s?|cousin|parents?|siblings?|twin|relatives?|niece|nephew)`;
/**
 * Family-history markers before the finding in the same sentence: "family history of", "FH:",
 * or a relative as the subject of a condition ("mother had", "father died of", "sister with").
 * A relative who reports ("Mother says he has vomited", "Parents have noticed") is not one.
 */
const FAMILY_RE = new RegExp(
  String.raw`\b(?:family history|family hx|fhx?|fh of|runs in (?:the|his|her|their) family)\b`
  + String.raw`|\b${RELATIVE}\s+(?:also\s+|both\s+)?(?:(?:had|has|have)(?!\s+(?:noticed|seen|brought|reported|said|told|been|observed|found|given|taken|called|thought|heard|asked|mentioned|described))|died|passed away|was diagnosed|diagnosed|developed|suffered|suffers|with)\b`,
  'g',
);
const CONTRAST_RE = /\b(?:but|however|whereas|although|though|while|whilst|himself|herself|patient|she has|he has|she had|he had|she is|he is)\b/;

/**
 * True when the occurrence [start, end) sits in a family-history clause. The marker may overlap
 * the match ("history of" in "family history of bowel cancer").
 */
export function familyHistoryAt(lower: string, start: number, end = start): boolean {
  const ss = sentenceStart(lower, start);
  const before = lower.slice(ss, Math.max(start, Math.min(end, start + 12)));
  let last: RegExpExecArray | null = null;
  FAMILY_RE.lastIndex = 0;
  for (let m = FAMILY_RE.exec(before); m; m = FAMILY_RE.exec(before)) last = m;
  if (!last) return false;
  // "Mother had gallstones but he has never had pain": a contrast returns to the patient.
  return !CONTRAST_RE.test(before.slice(last.index + last[0].length));
}

// ── 3. Not current ─────────────────────────────────────────────────────────────

const NUM_WORD = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|many|several|a few|some|a couple of)`;
/** A sentence dated years back. */
const YEARS_BACK_RE = new RegExp(
  String.raw`\b${NUM_WORD} (?:years?|yrs?|decades?) (?:ago|earlier|previously|before)\b|\bas an? (?:child|teenager|baby|boy|girl|infant)\b|\bin (?:his|her|their) (?:childhood|teens|twenties|youth)\b|\bin childhood\b|\bin (?:19|20)\d\d\b`,
);
/** ...unless the sentence says the finding goes on ("started 2 years ago", "since", "now"). */
const ONGOING_RE = /\b(?:since|started|starting|begun|began|onset|first noticed|ongoing|for the (?:past|last)|over the (?:past|last)|now|still|currently|recurr\w*|again|worse|worsening|progressive|progressing|getting|increasing|persist\w*|continu\w*|intermittent\w*|on and off)\b/;

/**
 * An operation already planned (or done) for the condition that follows: "awaiting elective
 * repair of a femoral hernia", "plan surgery for a large incisional hernia", "previous excision
 * of a lipoma". Not "referred for repair of …" or "needs surgery for …": then the condition is
 * the presenting problem.
 */
const PROCEDURE = String.raw`(?:surgery|repair|operation|excision|removal|drainage|incision and drainage|\w+ectomy|\w+plasty|\w+orrhaphy)`;
const BACKGROUND_BEFORE_RE = new RegExp(
  String.raw`\b(?:awaiting|waiting list for|listed for|booked for|scheduled for|planned|plan|planning|previous|prior|past)\s+(?:(?:an?|the|his|her|their|elective|routine|day-case)\s+){0,2}${PROCEDURE}\s+(?:of|for)\s+(?:[\p{L}'’-]+\s+){0,3}$`,
  'u',
);
/** The condition followed by its (past) operation: "umbilical hernia repair", "hernia repaired". */
const BACKGROUND_AFTER_RE = /^(?:\s+(?:hernia|cyst|lump|abscess|mass|swelling))?\s+(?:(?:was|were|had been|has been)\s+)?(?:repair|repaired|mesh repair|excised|removed|drained|drainage)\b/u;
/** A lay person's or referrer's guess: "Mother thought it was a hernia". */
const ATTRIBUTED_RE = /\b(?:thought|thinks|think|worried|worries|wondered|wonders|feared|fears|believed|believes|suspected|suspects|concerned)\b[^.;]{0,15}?\b(?:it was|it is|it's|it might be|it may be|it could be|this was|that it)\b[^.;]*$/;

/** True when the occurrence [start, end) is historical, background or a guess (not a current finding). */
export function notCurrentAt(lower: string, start: number, end: number): boolean {
  const ss = sentenceStart(lower, start);
  const se = sentenceEnd(lower, end);
  const sentence = lower.slice(ss, se);
  if (YEARS_BACK_RE.test(sentence) && !ONGOING_RE.test(sentence)) return true;
  const cs = clauseStart(lower, start);
  const before = lower.slice(cs, start);
  if (BACKGROUND_BEFORE_RE.test(before)) return true;
  const after = lower.slice(end, se);
  const afterClause = after.split(/[,:()]/)[0];
  if (BACKGROUND_AFTER_RE.test(afterClause)) return true;
  if (ATTRIBUTED_RE.test(before)) return true;
  return false;
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
