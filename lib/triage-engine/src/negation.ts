/**
 * Negation-aware free-text matching, shared by the triage engine (web + api-server) and the
 * dashboard's consultation engines (clinical prompts, dx variants, PANE feature mapping,
 * passive ranking).
 *
 * Clinicians document pertinent negatives ("No guarding, no rebound", "Murphy's sign negative",
 * "afebrile", "not jaundiced"). A plain substring or regex test reads those as positive findings,
 * which raised emergency triage, alarms and operative plans for patients without the finding
 * (clinical-validation findings, 2026-09). Every free-text rule should go through
 * `containsAffirmed()` / `testAffirmed()` instead.
 *
 * The rule (a small, deterministic NegEx-style check), applied to each occurrence of a term:
 *
 *  1. PRE-NEGATION. The occurrence is negated when a negation cue precedes it in the same clause,
 *     with at most N words in between:
 *       - N = 5: "no", "not", "nil", "denies"/"denied", "without", "never", "neither", "absence",
 *         contractions such as "doesn't"/"didn't"/"isn't" (NOT "can't"/"cannot"/"unable": "can't
 *         swallow" is a complaint), and the phrases "free of", "negative for".
 *       - N = 1: "negative", "neg", "absent", "-ve" ("negative Murphy's sign").
 *       - N = 0: "non" ("non-tender" negates "tender"; "non-bilious vomiting" does not negate
 *         "vomiting").
 *  2. POST-NEGATION. The occurrence is negated when, in the same clause, it is followed by
 *     "negative", "neg", "-ve", "absent", "nil", "none", "excluded", "ruled out" or "not
 *     present/seen/elicited/…", with at most one word in between (copulas such as "is"/"was" are
 *     not counted, and a ":" or spaced dash may sit in between): "Murphy's sign negative",
 *     "pregnancy test negative", "guarding: absent".
 *  3. FUSED NEGATIVES. A term found inside one of a short list of negating words is negated:
 *     "febrile" in "afebrile", "icteric" in "anicteric", "tender" in "nontender", "pain" in
 *     "painless", "reducible" in "irreducible"; "pain-free"/"symptom-free" likewise.
 *
 * Scope ends at sentence punctuation (. ; : ! ? brackets, a new line, a spaced dash), at a comma
 * (unless the comma is part of a "no A, B or C" list, where the "or"/"nor" carries the negation),
 * and at words that start a new assertion: "but", "however", "although", "except", "and",
 * "with", "has", "shows", "reports", … . "or", "nor" and "/" continue the scope.
 *
 * Pseudo-negations do not negate: "no change", "no improvement", "not improving", "not
 * relieved", "not only", "no doubt", "not excluded", "cannot be excluded", "not ruled out",
 * "nil by mouth", "without delay".
 *
 * SAFETY BIAS: when negation is uncertain the match is KEPT (over-triage is safer than missing an
 * emergency). Hence "and" ends the scope ("no nausea and vomiting" keeps "vomiting"), a comma ends
 * it ("No vomiting, rigid abdomen" keeps "rigid"), and hedges such as "?", "query", "possible",
 * "cannot exclude", "to exclude" are never negations. Only explicit, simple negations are dropped.
 *
 * Matching itself is case-insensitive. By default a string term keeps the old substring semantics
 * (so "append" still finds "appendicitis"); pass `{ wholeWord: true }` to require word
 * boundaries ("hinchey i" must not match "hinchey iii", "thyroidectomy" must not match
 * "parathyroidectomy").
 */

export interface AffirmedMatchOptions {
  /**
   * Require word boundaries around a string term: before it when it starts with a letter or digit,
   * and after it when it ends with a letter (a plural "s"/"es" is allowed after a final word of
   * four or more letters, so "adhesion" still finds "adhesions"). A term ending in a digit may be
   * followed by more digits ("k35.3" finds "K35.30"). Ignored for RegExp terms.
   */
  wholeWord?: boolean;
}

export interface AffirmedMatch {
  /** Offset of the match in the lowercased text. */
  index: number;
  /** The matched text (lowercased). */
  text: string;
}

type TokenKind = 'word' | 'comma' | 'slash' | 'hyphen' | 'colon' | 'hard';

interface Token {
  kind: TokenKind;
  text: string;
  start: number;
  end: number;
}

// A number (with decimals and a unit: "36.8", "4mm"), or a word with internal apostrophes
// ("murphy's", "doesn't"); then the punctuation that matters for scope.
const TOKEN_RE = /(\d+(?:\.\d+)?[\p{L}]*|[\p{L}\p{N}]+(?:['’][\p{L}]+)*)|(\s[-–—]+\s)|(:)|([.;!?()[\]{}\n\r•|])|(,)|(\/)|([-–])/gu;

function tokenize(lower: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(lower)) !== null) {
    const [text] = m;
    const start = m.index;
    const end = start + text.length;
    let kind: TokenKind;
    if (m[1] !== undefined) kind = 'word';
    else if (m[2] !== undefined) kind = 'colon'; // spaced dash: same role as a colon
    else if (m[3] !== undefined) kind = 'colon';
    else if (m[4] !== undefined) kind = 'hard';
    else if (m[5] !== undefined) kind = 'comma';
    else if (m[6] !== undefined) kind = 'slash';
    else kind = 'hyphen';
    tokens.push({ kind, text: text.replace(/’/g, "'"), start, end });
  }
  return tokens;
}

/** Pre-negation cues → the number of words allowed between the cue and the term. */
const PRE_CUES: Record<string, number> = {
  no: 5, not: 5, nil: 5, denies: 5, denied: 5, deny: 5, denying: 5, without: 5, never: 5,
  neither: 5, absence: 5,
  negative: 1, neg: 1, absent: 1,
  non: 0,
};

/** Contractions that negate (deliberately excludes can't / couldn't / won't: "can't swallow"). */
const NEGATING_CONTRACTIONS = new Set([
  "doesn't", "don't", "didn't", "isn't", "wasn't", "aren't", "weren't", "hasn't", "haven't", "hadn't",
]);

/** Words that, directly after a cue, make it a pseudo-negation ("no change", "not improving"). */
const PSEUDO_AFTER: Record<string, ReadonlySet<string>> = {
  no: new Set(['change', 'changes', 'increase', 'improvement', 'better', 'relief', 'doubt', 'significant']),
  not: new Set([
    'only', 'improving', 'improved', 'improve', 'relieved', 'settling', 'settled', 'responding', 'responded',
    'controlled', 'certain', 'sure', 'clear', 'excluded', 'ruled', 'necessarily', 'yet', 'been',
  ]),
  without: new Set(['improvement', 'relief', 'response', 'delay']),
  nil: new Set(['by']),
};

/** Words that end a negation scope: a new assertion starts. */
const SCOPE_TERMINATORS = new Set([
  'but', 'however', 'although', 'though', 'except', 'yet', 'whereas', 'while', 'whilst', 'apart', 'other',
  'besides', 'despite', 'and', 'with', 'which', 'who', 'has', 'have', 'had', 'shows', 'showed', 'showing',
  'reveals', 'revealed', 'demonstrates', 'demonstrated', 'plus', 'then', 'now', 'still', 'because', 'due',
  'reports', 'reported', 'complains', 'complained', 'presents', 'presented', 'describes', 'described',
]);

/** Words that continue a negation scope without counting towards the window. */
const SCOPE_CONTINUERS = new Set(['or', 'nor']);

/** Post-negation cues. */
const POST_CUES = new Set(['negative', 'neg', 'absent', 'nil', 'none', 'excluded']);
/** "not X" after a term: "rebound not elicited". */
const NOT_FOLLOWERS = new Set([
  'present', 'seen', 'elicited', 'demonstrated', 'identified', 'detected', 'found', 'palpable', 'felt', 'noted',
  'evident', 'visualised', 'visualized', 'appreciated',
]);
/** Words skipped (not counted) between a term and a post-cue. */
const COPULAS = new Set(['is', 'was', 'are', 'were', 'be', 'been', 'remains', 'remained', 'appears', 'appeared']);

/** Whole words that negate a root found inside them. */
const FUSED_NEGATIVES = new Set([
  'afebrile', 'apyrexial', 'apyrexic', 'anicteric', 'asymptomatic', 'atraumatic',
  'nontender', 'nondistended', 'nonpalpable', 'impalpable', 'irreducible', 'painless',
]);
/** "pain-free", "symptom-free": the term's word followed by a hyphen and one of these. */
const HYPHEN_FREE = new Set(['free']);

const MAX_PRE_WINDOW = 6;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

/** Index of the first token that ends after `pos`, i.e. the token containing or following it. */
function firstTokenAtOrAfter(tokens: Token[], pos: number): number {
  let lo = 0;
  let hi = tokens.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid].end <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function nextWordIndex(tokens: Token[], i: number): number {
  for (let j = i + 1; j < tokens.length; j++) {
    if (tokens[j].kind === 'hyphen') continue;
    return tokens[j].kind === 'word' ? j : -1;
  }
  return -1;
}

function prevWordIndex(tokens: Token[], i: number): number {
  for (let j = i - 1; j >= 0; j--) {
    if (tokens[j].kind === 'hyphen') continue;
    return tokens[j].kind === 'word' ? j : -1;
  }
  return -1;
}

/** A comma inside "no A, B or C": an "or"/"nor" follows before the clause ends. */
function commaContinuesList(tokens: Token[], commaIdx: number): boolean {
  for (let j = commaIdx + 1, seen = 0; j < tokens.length && seen < 14; j++) {
    const t = tokens[j];
    if (t.kind === 'hard' || t.kind === 'colon') return false;
    if (t.kind !== 'word') continue;
    seen++;
    if (SCOPE_CONTINUERS.has(t.text)) return true;
    if (SCOPE_TERMINATORS.has(t.text)) return false;
  }
  return false;
}

/** The cue ending at token i, with its window, or null. */
function cueAt(tokens: Token[], i: number): number | null {
  const w = tokens[i].text;
  if (w === 've' && i > 0 && tokens[i - 1].kind === 'hyphen') return 1; // "-ve"
  if (w === 'of') {
    const p = prevWordIndex(tokens, i);
    if (p >= 0 && tokens[p].text === 'free') return 5; // "free of"
    return null;
  }
  if (w === 'for') {
    const p = prevWordIndex(tokens, i);
    if (p >= 0 && (tokens[p].text === 'negative' || tokens[p].text === 'neg')) return 5; // "negative for"
    return null;
  }
  if (NEGATING_CONTRACTIONS.has(w)) return 5;
  return Object.prototype.hasOwnProperty.call(PRE_CUES, w) ? PRE_CUES[w] : null;
}

function isPseudoNegation(tokens: Token[], cueIdx: number): boolean {
  const pseudo = PSEUDO_AFTER[tokens[cueIdx].text];
  if (!pseudo) return false;
  const n = nextWordIndex(tokens, cueIdx);
  return n >= 0 && pseudo.has(tokens[n].text);
}

function preNegated(tokens: Token[], wordStart: number): boolean {
  let i = firstTokenAtOrAfter(tokens, wordStart) - 1;
  // Skip tokens that overlap the term's own word.
  while (i >= 0 && tokens[i].end > wordStart) i--;
  let words = 0;
  for (; i >= 0; i--) {
    const t = tokens[i];
    if (t.kind === 'hard' || t.kind === 'colon') return false;
    if (t.kind === 'hyphen' || t.kind === 'slash') continue;
    if (t.kind === 'comma') {
      if (!commaContinuesList(tokens, i)) return false;
      continue;
    }
    if (SCOPE_CONTINUERS.has(t.text)) continue;
    if (SCOPE_TERMINATORS.has(t.text)) {
      // "doesn't have a fever", "does not have", "has not had": part of the negation, not a new
      // assertion.
      const p = prevWordIndex(tokens, i);
      const pw = p >= 0 ? tokens[p].text : '';
      const negatedVerb = (t.text === 'have' || t.text === 'has' || t.text === 'had')
        && (pw === 'not' || pw === 'never' || NEGATING_CONTRACTIONS.has(pw));
      if (!negatedVerb) return false;
      continue;
    }
    // A two-word cue ("free of", "negative for") is found at its last word.
    const window = cueAt(tokens, i);
    if (window !== null) {
      if (isPseudoNegation(tokens, i)) return false;
      return words <= window;
    }
    // "-ve" is two tokens; the hyphen is skipped above and the cue found at "ve".
    words++;
    if (words > MAX_PRE_WINDOW) return false;
  }
  return false;
}

function postNegated(tokens: Token[], wordEnd: number): boolean {
  let j = firstTokenAtOrAfter(tokens, wordEnd);
  // Skip the rest of the term's own word (e.g. the "'s" of "murphy's").
  while (j < tokens.length && tokens[j].start < wordEnd) j++;
  let words = 0;
  for (; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.kind === 'hard' || t.kind === 'comma' || t.kind === 'slash') return false;
    if (t.kind === 'colon') continue; // "guarding: absent", "Murphy's – negative"
    if (t.kind === 'hyphen') {
      const n = j + 1 < tokens.length ? tokens[j + 1] : undefined;
      if (n && n.kind === 'word' && n.text === 've') return true; // "murphy's -ve"
      continue;
    }
    const w = t.text;
    if (COPULAS.has(w)) continue;
    if (POST_CUES.has(w)) {
      // "cannot be excluded", "not excluded", "not been excluded": a hedge, not a negation.
      if (w === 'excluded') {
        for (let k = j - 1, seen = 0; k >= 0 && seen < 3; k--) {
          if (tokens[k].kind !== 'word') continue;
          seen++;
          const pw = tokens[k].text;
          if (pw === 'not' || pw === 'cannot' || pw === "can't" || pw === "couldn't" || pw.endsWith("n't")) return false;
        }
      }
      return true;
    }
    if (w === 'ruled') {
      const n = nextWordIndex(tokens, j);
      if (n >= 0 && tokens[n].text === 'out') {
        const p = prevWordIndex(tokens, j);
        if (p >= 0 && (tokens[p].text === 'not' || tokens[p].text === 'cannot' || tokens[p].text === 'be')) return false;
        return true;
      }
    }
    if (w === 'not') {
      const n = nextWordIndex(tokens, j);
      return n >= 0 && NOT_FOLLOWERS.has(tokens[n].text);
    }
    words++;
    if (words > 1) return false;
  }
  return false;
}

/**
 * True when the text between `start` and `end` (offsets into `text`) is negated by its context.
 * For callers that already found a match with their own regex.
 */
export function isNegatedAt(text: string, start: number, end: number): boolean {
  const lower = text.toLowerCase();
  return negatedAt(lower, start, end, tokensFor(lower));
}

function negatedAt(lower: string, start: number, end: number, tokens: Token[]): boolean {
  // Word containing the match.
  let ws = start;
  while (ws > 0 && isWordChar(lower[ws - 1])) ws--;
  let we = end;
  while (we < lower.length && isWordChar(lower[we])) we++;
  const fused = start !== ws || end !== we;
  if (fused && FUSED_NEGATIVES.has(lower.slice(ws, we))) return true;
  // "pain-free", "symptom-free"
  if (lower[we] === '-') {
    const m = /^-([\p{L}]+)/u.exec(lower.slice(we));
    if (m && HYPHEN_FREE.has(m[1])) return true;
  }
  if (preNegated(tokens, ws)) return true;
  return postNegated(tokens, we);
}

function wholeWordOk(lower: string, index: number, term: string): boolean {
  const first = term[0];
  const last = term[term.length - 1];
  if (isWordChar(first) && isWordChar(lower[index - 1])) return false;
  if (/\p{L}/u.test(last)) {
    const after = index + term.length;
    if (!isWordChar(lower[after])) return true;
    // Allow a plural after a final word of 4+ letters: "adhesion" → "adhesions".
    const lastWord = /[\p{L}]+$/u.exec(term)?.[0] ?? '';
    if (lastWord.length >= 4) {
      const rest = /^[\p{L}\p{N}]+/u.exec(lower.slice(after))?.[0] ?? '';
      return rest === 's' || rest === 'es';
    }
    return false;
  }
  return true;
}

// Tokenising is the expensive part; callers test many terms against the same text.
let cachedText: string | null = null;
let cachedTokens: Token[] = [];
function tokensFor(lower: string): Token[] {
  if (lower !== cachedText) {
    cachedText = lower;
    cachedTokens = tokenize(lower);
  }
  return cachedTokens;
}

/** Every occurrence of `term` in `text`, affirmed or not (lowercased offsets). */
function occurrences(lower: string, term: string | RegExp, opts: AffirmedMatchOptions): AffirmedMatch[] {
  const out: AffirmedMatch[] = [];
  if (typeof term === 'string') {
    const t = term.toLowerCase();
    if (!t) return out;
    for (let i = lower.indexOf(t); i !== -1; i = lower.indexOf(t, i + 1)) {
      if (opts.wholeWord && !wholeWordOk(lower, i, t)) continue;
      out.push({ index: i, text: t });
    }
    return out;
  }
  const flags = term.flags.includes('g') ? term.flags : `${term.flags}g`;
  const re = new RegExp(term.source, flags.includes('i') ? flags : `${flags}i`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    out.push({ index: m.index, text: m[0] });
  }
  return out;
}

/** The first occurrence of `term` in `text` that is not negated, or null. */
export function findAffirmed(text: string, term: string | RegExp, opts: AffirmedMatchOptions = {}): AffirmedMatch | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const hits = occurrences(lower, term, opts);
  if (!hits.length) return null;
  const tokens = tokensFor(lower);
  for (const h of hits) {
    if (!negatedAt(lower, h.index, h.index + h.text.length, tokens)) return h;
  }
  return null;
}

/** True when `term` occurs in `text` at least once without being negated. */
export function containsAffirmed(text: string, term: string | RegExp, opts: AffirmedMatchOptions = {}): boolean {
  return findAffirmed(text, term, opts) !== null;
}

/** True when any of `terms` occurs in `text` without being negated. */
export function containsAnyAffirmed(
  text: string, terms: ReadonlyArray<string | RegExp>, opts: AffirmedMatchOptions = {},
): boolean {
  return terms.some(t => containsAffirmed(text, t, opts));
}

/** Negation-aware `pattern.test(text)`. */
export function testAffirmed(pattern: RegExp, text: string): boolean {
  return containsAffirmed(text, pattern);
}

/**
 * Join list items (symptom chips, comorbidities, exam fields) into one text for matching, with a
 * sentence break between items so a negation in one item cannot reach into the next.
 */
export function joinClauses(items: ReadonlyArray<string | null | undefined>): string {
  return items.map(s => (s ?? '').trim()).filter(Boolean).join('.\n');
}
