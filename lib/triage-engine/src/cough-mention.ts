/**
 * Cough: the symptom, or a manoeuvre that makes something else worse?
 *
 * "Cough for three weeks", "productive cough", "coughing up blood" record a cough. "Pain worse on
 * coughing", "aggravated by coughing", "hurts when coughing" record an aggravating factor of
 * another symptom (usually pain): the patient may have no cough at all. "Cough impulse" and
 * "cough tenderness" are examination signs. A keyword match cannot tell these apart, so the
 * mappers that turn record text into engine features ask this classifier about each mention.
 *
 * Twin: ios/AmiseMedFlow/Services/CoughMention.swift. Shared vectors:
 * ios/AmiseMedFlowTests/Resources/CoughMentionVectors.json (CoughMentionTests.swift and
 * artifacts/dashboard/src/lib/__tests__/cough-mention.test.ts). Change both platforms together.
 *
 * Deterministic and clause-based. Negation is not decided here (negation.ts / NegationMatcher do
 * that): "no cough" is a symptom mention that the negation rule then drops.
 *
 * Rules, for a word starting with "cough" (cough, coughs, coughing, coughed), within its sentence
 * (a sentence ends at . ; ! ? a line break, brackets or "|"; a colon and a comma do not end it, so
 * a chip written "aggravating: coughing" keeps its label):
 *  1. SIGN: followed by "impulse" or "tender…", or preceded by "impulse on / with".
 *  2. SYMPTOM: followed by "up" ("coughing up blood").
 *  3. AGGRAVATING:
 *     - followed by "hurts"; by "makes / made … worse" (within four words); or by
 *       "worsens / aggravates / exacerbates / triggers / provokes / brings on" + an object
 *       ("the pain", "it", "the lump" …): "coughing worsens the pain" (but "cough worsened over
 *       a week" is the symptom);
 *     - directly after "on / when / while / during / upon" ("tender on coughing");
 *     - after a lead-in word (worse, better, eased, relieved, aggravated, exacerbated,
 *       precipitated, provoked, brought, triggered, made) followed within one word by
 *       on / with / when / by / during / while / upon ("worse with coughing", "made worse by
 *       coughing", "brought on by coughing");
 *     - after a pain word (pain, painful, hurts, tender, discomfort, ache) followed within one
 *       word by on / when / during / while / upon ("pain on deep breathing or coughing"); "pain
 *       with cough" stays a symptom;
 *     - after a chip label or verb that is itself the factor (aggravating, exacerbating,
 *       relieving, aggravates, exacerbates) within three words ("aggravating: coughing").
 *     At most three words may sit between the preposition (or label) and the cough word, and none
 *     of them may start a new statement (but, however, has, have, had, is, was, are, were, also,
 *     reports, denies, plus).
 *  4. Otherwise SYMPTOM.
 */

import { isNegatedAt } from './negation';

export type CoughMentionKind = 'symptom' | 'aggravating' | 'sign';

export interface CoughMention {
  /** Offset of the cough word in the lower-cased text. */
  index: number;
  /** The cough word as written (lower case). */
  word: string;
  kind: CoughMentionKind;
}

interface Tok { text: string; start: number; end: number; sentence: number }

const LEAD_PREP = new Set(['worse', 'better', 'eased', 'relieved', 'aggravated', 'exacerbated', 'precipitated',
  'provoked', 'brought', 'triggered', 'made']);
const PAIN_LEAD = new Set(['pain', 'pains', 'painful', 'hurts', 'hurt', 'hurting', 'tender', 'tenderness', 'discomfort',
  'ache', 'aches', 'aching']);
const PREP_ANY = new Set(['on', 'with', 'when', 'by', 'during', 'while', 'upon']);
const PREP_PAIN = new Set(['on', 'when', 'during', 'while', 'upon']);
const DIRECT_PREP = new Set(['on', 'when', 'while', 'during', 'upon']);
const LABEL_LEAD = new Set(['aggravating', 'exacerbating', 'relieving', 'aggravates', 'exacerbates']);
const BLOCK = new Set(['but', 'however', 'has', 'have', 'had', 'is', 'was', 'are', 'were', 'also', 'reports',
  'denies', 'plus']);
const AFTER_VERB = new Set(['worsens', 'aggravates', 'exacerbates', 'triggers', 'provokes', 'brings']);
const OBJECTS = new Set(['the', 'it', 'his', 'her', 'their', 'my', 'this', 'that', 'pain', 'discomfort', 'on']);
const MAX_GAP = 3;

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}
function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= '0' && c <= '9';
}

/** Words of `lower` with their sentence number (same tokens as the Swift twin). */
function tokenize(lower: string): Tok[] {
  const out: Tok[] = [];
  let sentence = 0;
  let i = 0;
  while (i < lower.length) {
    const c = lower[i]!;
    if (isWordChar(c)) {
      let j = i + 1;
      // Letters, digits and an inner apostrophe ("doesn't"); a decimal point between digits stays.
      while (j < lower.length) {
        const d = lower[j];
        if (isWordChar(d)) { j++; continue; }
        if ((d === "'" || d === '’') && isWordChar(lower[j + 1])) { j++; continue; }
        if (d === '.' && isDigit(lower[j - 1]) && isDigit(lower[j + 1])) { j++; continue; }
        break;
      }
      out.push({ text: lower.slice(i, j), start: i, end: j, sentence });
      i = j;
      continue;
    }
    if ('.;!?()[]{}|\n\r•'.includes(c)) sentence++;
    i++;
  }
  return out;
}

function gapOk(words: Tok[], from: number, to: number): boolean {
  // words strictly between index `from` and index `to`
  if (to - from - 1 > MAX_GAP) return false;
  for (let k = from + 1; k < to; k++) if (BLOCK.has(words[k]!.text)) return false;
  return true;
}

function kindAt(words: Tok[], w: number): CoughMentionKind {
  const s = words[w]!.sentence;
  const at = (k: number): string | undefined => (k >= 0 && k < words.length && words[k]!.sentence === s ? words[k]!.text : undefined);
  const next = at(w + 1);
  const prev = at(w - 1);

  // 1. Examination sign.
  if (next === 'impulse' || next?.startsWith('tender')) return 'sign';
  if ((prev === 'on' || prev === 'with') && at(w - 2) === 'impulse') return 'sign';
  // 2. "coughing up blood / sputum".
  if (next === 'up') return 'symptom';
  // 3a. The factor is named after the cough.
  if (next === 'hurts') return 'aggravating';
  if (next === 'makes' || next === 'made' || next === 'make') {
    for (let k = w + 2; k <= w + 5; k++) if (at(k) === 'worse') return 'aggravating';
  }
  if (next && AFTER_VERB.has(next) && at(w + 2) !== undefined && OBJECTS.has(at(w + 2)!)) return 'aggravating';
  // 3b. Directly after "on / when / while / during / upon".
  if (prev && DIRECT_PREP.has(prev)) return 'aggravating';
  // 3c. A lead-in before the cough.
  for (let k = w - 1; k >= 0 && k >= w - (MAX_GAP + 3) && words[k]!.sentence === s; k--) {
    const t = words[k]!.text;
    if (LABEL_LEAD.has(t)) {
      if (gapOk(words, k, w)) return 'aggravating';
      continue;
    }
    const preps = LEAD_PREP.has(t) ? PREP_ANY : PAIN_LEAD.has(t) ? PREP_PAIN : null;
    if (!preps) continue;
    for (let p = k + 1; p <= k + 2 && p < w; p++) {
      if (preps.has(words[p]!.text) && gapOk(words, p, w)) return 'aggravating';
    }
  }
  return 'symptom';
}

/** Every cough word in `text`, with what it records. Offsets index the lower-cased text. */
export function coughMentions(text: string): CoughMention[] {
  const lower = text.toLowerCase();
  const words = tokenize(lower);
  const out: CoughMention[] = [];
  words.forEach((t, w) => {
    if (/^cough(s|ing|ed)?$/.test(t.text)) out.push({ index: t.start, word: t.text, kind: kindAt(words, w) });
  });
  return out;
}

/** What the cough word starting at `index` of `lower` (already lower-cased) records. */
export function coughMentionKindAt(lower: string, index: number): CoughMentionKind {
  const words = tokenize(lower);
  const w = words.findIndex(t => t.start <= index && index < t.end);
  if (w < 0) return 'symptom';
  return kindAt(words, w);
}

/** True when `text` records a cough (an affirmed symptom mention). */
export function recordsCough(text: string): boolean {
  return coughMentions(text).some(m => m.kind === 'symptom' && !isNegatedAt(text, m.index, m.index + m.word.length));
}

/** True when `text` records coughing as an aggravating factor (affirmed). */
export function recordsCoughAsFactor(text: string): boolean {
  return coughMentions(text).some(m => m.kind === 'aggravating' && !isNegatedAt(text, m.index, m.index + m.word.length));
}
