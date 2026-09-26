/**
 * Clause-aware record reading: is a mention a finding about THIS patient NOW? Deterministic.
 *
 * Twin: ios/AmiseMedFlow/Services/RecordClauses.swift. Shared vectors:
 * ios/AmiseMedFlowTests/Resources/RecordClauseVectors.json (RecordClauseTests.swift on iOS,
 * artifacts/dashboard/src/lib/__tests__/record-clauses.test.ts on the web). Change both together.
 *
 * Each rule looks at one occurrence of a term (offsets into the lower-cased text) that the
 * negation matcher (negation.ts / NegationMatcher.swift) has already let through, and only ever
 * REMOVES a match; when unsure the match is kept (negation.ts safety bias).
 *
 *  1. LIST NEGATION (listNegatedAt). negation.ts counts every word between a cue and the term
 *     (window 5), so in "has never had abdominal pain, indigestion after food, jaundice or fever"
 *     the "fever" is too far from "never". Inside a negated comma list that ends with "or" / "nor"
 *     ("no A, B or C"), each item gets its own window. After "denies" / "denied" / "never" /
 *     "negative for" / "free of" a list may also end with "and" ("Negative for blood, leucocytes
 *     and nitrites"). A bare "no A, B" list without "or" keeps negation.ts's safety bias ("No
 *     vomiting, rigid abdomen" keeps "rigid").
 *  2. FAMILY HISTORY (familyHistoryAt). "Mother had breast cancer", "family history of bowel
 *     cancer", "FH: IHD": the finding belongs to a relative. A relative who reports ("Mother says he
 *     has vomited") is not family history.
 *  3. NOT CURRENT (notCurrentAt = yearsBackAt || backgroundAt || attributedAt): a sentence dated
 *     years back without an "ongoing" word; a condition named as the reason for an operation done
 *     or planned ("awaiting elective repair of a femoral hernia"); a lay person's guess ("Mother
 *     thought it was a hernia"). The web PANE mapper applies it to features that mean "now"
 *     (symptoms, signs, injury mechanism). iOS database terms do not say whether they mean "now"
 *     ("gallstones", "previous AAA repair" are history evidence), so iOS applies only the guess
 *     rule (attributedAt) and the query rule below.
 *  4. QUERY (queryAt): "?appendicitis", "query appendicitis", "referred as '?appendicitis'" — a
 *     question or a referral label, not a finding.
 *  5. RELIEF THAT FAILED (reliefFailedAt): the clause says the remedy did not help ("Took
 *     antacids with no relief", "Gaviscon did not help"): not relief by antacids.
 */

/** A decimal point ("7.2") does not end a sentence. */
function isDecimalPoint(lower: string, i: number): boolean {
  return lower[i] === '.' && /\d/.test(lower[i - 1] ?? '') && /\d/.test(lower[i + 1] ?? '');
}

function isSentenceBreak(lower: string, i: number): boolean {
  const c = lower[i];
  if (c === ';' || c === '!' || c === '?' || c === '\n' || c === '\r') return true;
  return c === '.' && !isDecimalPoint(lower, i);
}

/** Start of the sentence containing `pos` (after . ; ! ? or a new line; not a decimal point). */
export function sentenceStart(lower: string, pos: number): number {
  for (let i = pos - 1; i >= 0; i--) if (isSentenceBreak(lower, i)) return i + 1;
  return 0;
}

/** End (exclusive) of the sentence containing `pos`. */
export function sentenceEnd(lower: string, pos: number): number {
  for (let i = pos; i < lower.length; i++) if (isSentenceBreak(lower, i)) return i;
  return lower.length;
}

/** Start of the clause containing `pos`: the sentence, also cut at ":" and brackets. */
export function clauseStart(lower: string, pos: number): number {
  const s = sentenceStart(lower, pos);
  for (let i = pos - 1; i >= s; i--) {
    const c = lower[i];
    if (c === ':' || c === '(' || c === ')' || c === '[' || c === ']') return i + 1;
  }
  return s;
}

/** The sentence containing [start, end) (lower-cased text). */
export function sentenceOf(lower: string, start: number, end: number): string {
  return lower.slice(sentenceStart(lower, start), sentenceEnd(lower, end));
}

// ── 1. List negation ────────────────────────────────────────────────────────────

/** Cues that govern a list (a subset of negation.ts's pre-negation cues). */
export const LIST_CUES = ['no', 'not', 'nil', 'never', 'without', 'neither', 'nor', 'denies', 'denied', 'deny', 'denying', 'free of', 'negative for'];
/** After these cues, a list may end with "and" as well as "or". */
export const AND_LIST_CUES = ['never', 'denies', 'denied', 'deny', 'denying', 'negative for', 'free of'];
/** Pseudo-negations (negation.ts PSEUDO_AFTER): the cue does not negate. */
export const LIST_PSEUDO_NEXT = [
  'change', 'changes', 'increase', 'improvement', 'better', 'relief', 'doubt', 'significant', 'only', 'improving',
  'improved', 'relieved', 'settling', 'settled', 'responding', 'responded', 'controlled', 'certain', 'sure',
  'clear', 'excluded', 'ruled', 'necessarily', 'delay', 'response', 'by', 'stopped', 'resolved', 'gone',
];
/** Words that start a new assertion inside a list (negation.ts SCOPE_TERMINATORS, less "and"). */
export const LIST_BREAKERS = [
  'but', 'however', 'although', 'though', 'except', 'yet', 'whereas', 'while', 'whilst', 'apart', 'other',
  'besides', 'despite', 'with', 'which', 'who', 'shows', 'showed', 'showing', 'reveals', 'revealed',
  'demonstrates', 'demonstrated', 'plus', 'then', 'now', 'still', 'because', 'due', 'reports', 'reported',
  'complains', 'complained', 'presents', 'presented', 'describes', 'described', 'is', 'was', 'are', 'were',
  'has', 'have', 'had', 'feels', 'felt', 'says', 'said', 'developed', 'started', 'noticed',
];
/** Words allowed straight after the cue ("never had", "has not had", "denies any"). */
export const LIST_CUE_FILLERS = ['had', 'has', 'have', 'any', 'been', 'experienced', 'noticed', 'reported', 'complained', 'of'];
export const MAX_LIST_ITEM_WORDS = 5;
export const MAX_LIST_ITEMS = 8;

const LIST_CUE_RE = new RegExp(`\\b(?:${LIST_CUES.join('|')})\\b`, 'g');
const AND_CUES = new Set(AND_LIST_CUES);
const PSEUDO_NEXT = new Set(LIST_PSEUDO_NEXT);
const BREAKERS = new Set(LIST_BREAKERS);
const FILLERS = new Set(LIST_CUE_FILLERS);
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

function wordsOf(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

/** A list item: at most MAX_LIST_ITEM_WORDS words and no word that starts a new assertion. */
function isListItem(item: string): boolean {
  const ws = wordsOf(item);
  return ws.length <= MAX_LIST_ITEM_WORDS && !ws.some(w => BREAKERS.has(w));
}

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
    if (!m || !FILLERS.has(m[1])) break;
    between = between.slice(m[0].length);
  }
  const allowAnd = AND_CUES.has(cueWord);
  // Split into items at commas, "or", "nor", "/" (and "and" after denies / never).
  const sepRe = allowAnd ? /,|\/|\b(?:or|nor|and)\b/g : /,|\/|\b(?:or|nor)\b/g;
  const seps: string[] = [];
  const items = between.split(sepRe);
  for (let m = sepRe.exec(between); m; m = sepRe.exec(between)) seps.push(m[0]);
  if (items.length < 2 || items.length > MAX_LIST_ITEMS) return false; // not a list: negation.ts decided
  if (!items.every(isListItem)) return false;
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
  const restItems = rest.slice(0, conj).split(/,|\//);
  if (items.length + restItems.length - 1 > MAX_LIST_ITEMS) return false;
  return restItems.every(isListItem);
}

// ── 2. Family history ───────────────────────────────────────────────────────────

export const RELATIVE_WORDS = String.raw`(?:mother|mum|mom|father|dad|sister|brother|son|daughter|aunt|uncle|grand(?:mother|father|parent)s?|cousin|parents?|siblings?|twin|relatives?|niece|nephew)`;
/**
 * Family-history markers before the finding in the same sentence: "family history of", "FH:",
 * or a relative as the subject of a condition ("mother had", "father died of", "sister with").
 * A relative who reports ("Mother says he has vomited", "Parents have noticed") is not one.
 */
export const FAMILY_HISTORY_PATTERN = String.raw`\b(?:family history|family hx|fhx?|fh of|runs in (?:the|his|her|their) family)\b`
  + String.raw`|\b${RELATIVE_WORDS}\s+(?:also\s+|both\s+)?(?:(?:had|has|have)(?!\s+(?:noticed|seen|brought|reported|said|told|been|observed|found|given|taken|called|thought|heard|asked|mentioned|described))|died|passed away|was diagnosed|diagnosed|developed|suffered|suffers|with)\b`;
/** A contrast that returns to the patient ("Mother had gallstones but he has never had pain"). */
export const FAMILY_CONTRAST_PATTERN = String.raw`\b(?:but|however|whereas|although|though|while|whilst|himself|herself|patient|she has|he has|she had|he had|she is|he is)\b`;
const FAMILY_RE = new RegExp(FAMILY_HISTORY_PATTERN, 'g');
const CONTRAST_RE = new RegExp(FAMILY_CONTRAST_PATTERN);

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
export const ATTRIBUTED_PATTERN = String.raw`\b(?:thought|thinks|think|worried|worries|wondered|wonders|feared|fears|believed|believes|suspected|suspects|concerned)\b[^.;]{0,15}?\b(?:it was|it is|it's|it might be|it may be|it could be|this was|that it)\b[^.;]*$`;
const ATTRIBUTED_RE = new RegExp(ATTRIBUTED_PATTERN);

/** A sentence dated years back that does not say the finding goes on. */
export function yearsBackAt(lower: string, start: number, end: number): boolean {
  const sentence = lower.slice(sentenceStart(lower, start), sentenceEnd(lower, end));
  return YEARS_BACK_RE.test(sentence) && !ONGOING_RE.test(sentence);
}

/** A condition named as the reason for an operation done or planned. */
export function backgroundAt(lower: string, start: number, end: number): boolean {
  const before = lower.slice(clauseStart(lower, start), start);
  if (BACKGROUND_BEFORE_RE.test(before)) return true;
  const after = lower.slice(end, sentenceEnd(lower, end));
  return BACKGROUND_AFTER_RE.test(after.split(/[,:()]/)[0]);
}

/** A lay person's or referrer's guess ("Mother thought it was a hernia"). */
export function attributedAt(lower: string, start: number): boolean {
  return ATTRIBUTED_RE.test(lower.slice(clauseStart(lower, start), start));
}

/** True when the occurrence [start, end) is historical, background or a guess (not a current finding). */
export function notCurrentAt(lower: string, start: number, end: number): boolean {
  return yearsBackAt(lower, start, end) || backgroundAt(lower, start, end) || attributedAt(lower, start);
}

// ── 4. Query ───────────────────────────────────────────────────────────────────

/**
 * "?appendicitis", "? appendicitis", "'?appendicitis'", "(?PE)", "query appendicitis" right before
 * the term. The "?" must follow a space, a quote, a bracket, "/" or the start of the text: in "any
 * pain? Appendicitis …" it ends a question.
 */
export const QUERY_BEFORE_PATTERN = String.raw`[\s'"‘“(/]\? ?['"‘“]?$|\bquery\s+$`;
const QUERY_BEFORE_RE = new RegExp(QUERY_BEFORE_PATTERN);
/** Characters looked at before the term. */
export const QUERY_LOOKBACK = 12;

/** True when the occurrence starting at `start` is a query or a referral label, not a finding. */
export function queryAt(lower: string, start: number): boolean {
  const from = Math.max(0, start - QUERY_LOOKBACK);
  const pre = (from === 0 ? ' ' : '') + lower.slice(from, start);
  return QUERY_BEFORE_RE.test(pre);
}

// ── 5. Relief that failed ────────────────────────────────────────────────────────

/**
 * The remedy did not help: "antacids did not help", "no relief", "nothing helps", "unhelpful"
 * (also used as a whole-answer test by the web PANE mapper, socrates-to-features.ts).
 */
export const NO_HELP_RE = /\b(not|no|didn'?t|did not|doesn'?t|does not|nothing|without|never)\b[^.]{0,15}\b(help|helps|helped|relie\w*|benefit|effect|work\w*)\b|\bno (help|relief|benefit|effect)\b|\bunhelpful\b/;
/** Words that start a contrasting clause: "antacids help but paracetamol did not". */
const CONTRAST_WORDS_RE = /\b(?:but|however|although|though|whereas|while|whilst)\b/g;

/** The clause around [start, end): the sentence, cut at contrast words. */
export function clauseAround(lower: string, start: number, end: number): string {
  const s = sentenceStart(lower, start);
  const e = sentenceEnd(lower, end);
  let cs = s;
  let ce = e;
  const seg = lower.slice(s, e);
  CONTRAST_WORDS_RE.lastIndex = 0;
  for (let m = CONTRAST_WORDS_RE.exec(seg); m; m = CONTRAST_WORDS_RE.exec(seg)) {
    const at = s + m.index;
    if (at + m[0].length <= start) cs = at + m[0].length;
    else if (at >= end) { ce = at; break; }
  }
  return lower.slice(cs, ce);
}

/** True when the clause around the occurrence says the remedy did not help. */
export function reliefFailedAt(lower: string, start: number, end: number): boolean {
  return NO_HELP_RE.test(clauseAround(lower, start, end));
}

/**
 * Database terms (iOS BayesianDiagnosisEngine termOccurrences): an occurrence that is about a
 * relative, a lay guess or a query is not about the patient. (List negation is checked with the
 * negation matcher: listNegatedAt.)
 */
export function notAboutPatientAt(lower: string, start: number, end: number): boolean {
  return familyHistoryAt(lower, start, end) || attributedAt(lower, start) || queryAt(lower, start);
}
