/**
 * Diagnosis families and working-diagnosis label matching (shared by the web PANE adapter and the
 * iOS Bayesian adapter). Deterministic; derived from each engine's own diagnosis labels and ICD-10
 * codes, never from vignette text. Vocabulary: clinical-content/rules/diagnostic-reasoning-rules.json
 * (`families`, `workingDiagnosis`). iOS twin: DiagnosticReasoningRules.swift (`DiagnosisFamilies`),
 * shared vectors in DiagnosticReasoningVectors.json (`families`, `labelMatch`, `resolveWorking`).
 *
 * An engine models some conditions at more than one granularity: "Inguinal / Femoral Hernia" and
 * "Incarcerated / Strangulated Hernia", "Peptic Ulcer Disease" and "Perforated Peptic Ulcer",
 * "Acute Appendicitis" and "Appendix Mass / Late Appendicitis". A parent and its child are the same
 * condition, so the reasoning layer treats them as compatible: the child never "competes" with a
 * confirmed parent (or the reverse) in a "Doesn't fit the working diagnosis" alert.
 *
 * Two diagnoses are one family when (registered in `diagnostic-reasoning-rules`; needs sign-off):
 *  1. they share the ICD-10 category (letter + 2 digits) AND a head noun of their labels
 *     (K35 appendicitis / appendix mass, K27 peptic ulcer / perforated peptic ulcer, K56 bowel
 *     obstruction / adhesional obstruction, K92 upper / lower GI haemorrhage, C73 thyroid
 *     carcinomas; not K22 achalasia / oesophageal perforation or I71 aneurysm / dissection);
 *  2. both are injuries (ICD-10 chapter `injuryChapter`, S) of the same block (S2x thorax, S3x
 *     abdomen);
 *  3. one is a complication or grade of the other: its label carries a complication or grade
 *     modifier (`complicationModifiers`) and shares a head noun with the other in the same ICD-10
 *     chapter ("Incarcerated / Strangulated Hernia" and every "… Hernia" in K), or names the other
 *     in its parenthesis ("Toxic Megacolon (Acute Severe Colitis)" and "Ulcerative Colitis").
 */

import { REASONING_RULES } from './reasoning-rules';

/** A diagnosis as the reasoning layer sees it (a PANE node or an iOS database candidate). */
export interface DiagnosisNode {
  id: string;
  label: string;
  icd10: string;
}

const FAMILY = REASONING_RULES.families;
const WORKING = REASONING_RULES.workingDiagnosis;
const MODIFIERS: ReadonlySet<string> = new Set(FAMILY.complicationModifiers);
const GENERIC_TAIL: ReadonlySet<string> = new Set(FAMILY.genericTailWords);
const NEUTRAL: ReadonlySet<string> = new Set(WORKING.neutralWords);

/** Label words that mark a complication or a grade of a condition (rule 3). */
export const FAMILY_COMPLICATION_MODIFIERS: ReadonlySet<string> = MODIFIERS;

/** Lower case, possessive "'s" removed, synonyms normalised. */
export function normaliseLabelWord(word: string): string {
  const w = word.toLowerCase().replace(/['’]s$/, '');
  return FAMILY.synonyms[w] ?? w;
}

/** The words of a label or diagnosis text, normalised. */
export function labelWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).map(normaliseLabelWord);
}

/**
 * The alternatives of a label phrase: "Inguinal / Femoral Hernia" → ["inguinal hernia",
 * "femoral hernia"] (a one-word alternative borrows the next alternative's last word).
 */
export function labelAlternatives(phrase: string): string[][] {
  const parts = phrase.split(/\s*\/\s*|\s+[—–-]\s+|,|\bor\b|\bincl\.?\b|;/).map(p => labelWords(p)).filter(p => p.length);
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i].length === 1 && parts[i + 1].length > 1) parts[i] = [parts[i][0], parts[i + 1][parts[i + 1].length - 1]];
  }
  return parts;
}

function headOf(ws: string[]): string | null {
  const w = [...ws];
  while (w.length > 1 && GENERIC_TAIL.has(w[w.length - 1])) w.pop();
  return w.length ? w[w.length - 1] : null;
}

export interface LabelParts {
  mainAlternatives: string[][];
  mainHeads: Set<string>;
  parenHeads: Set<string>;
  modifier: boolean;
}

const partsCache = new Map<string, LabelParts>();

export function labelParts(label: string): LabelParts {
  const hit = partsCache.get(label);
  if (hit) return hit;
  const parens = [...label.matchAll(/\(([^)]*)\)/g)].map(m => m[1]);
  const main = label.replace(/\([^)]*\)/g, ' ');
  const mainAlternatives = labelAlternatives(main);
  const mainHeads = new Set(mainAlternatives.map(headOf).filter((h): h is string => !!h));
  const parenHeads = new Set(parens.flatMap(p => labelAlternatives(p).map(headOf)).filter((h): h is string => !!h));
  const modifier = mainAlternatives.some(a => a.some(w => MODIFIERS.has(w)));
  const parts = { mainAlternatives, mainHeads, parenHeads, modifier };
  partsCache.set(label, parts);
  return parts;
}

/** ICD-10 code without dots or spaces, upper case. */
export function normaliseIcd(code: string): string {
  return code.replace(/[.\s]/g, '').toUpperCase();
}

function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function childOf(child: DiagnosisNode, parent: DiagnosisNode): boolean {
  const c = labelParts(child.label);
  if (!c.modifier) return false;
  const p = labelParts(parent.label);
  if (intersects(c.parenHeads, p.mainHeads)) return true;
  return intersects(c.mainHeads, p.mainHeads) && normaliseIcd(child.icd10).charAt(0) === normaliseIcd(parent.icd10).charAt(0);
}

/** True when `a` and `b` are the same condition at different granularity (see the header). */
export function sameFamily(a: DiagnosisNode, b: DiagnosisNode): boolean {
  if (a.id === b.id) return true;
  if (a.id === '_other_' || b.id === '_other_') return false;
  const ca = normaliseIcd(a.icd10);
  const cb = normaliseIcd(b.icd10);
  if (ca.slice(0, 3) === cb.slice(0, 3) && intersects(labelParts(a.label).mainHeads, labelParts(b.label).mainHeads)) return true;
  const injury = FAMILY.injuryChapter;
  if (ca.startsWith(injury) && cb.startsWith(injury) && ca.slice(0, 2) === cb.slice(0, 2)) return true;
  return childOf(a, b) || childOf(b, a);
}

/** Ids of the diagnoses in `nodes` that are one family with `node` (not including it). */
export function familyOf(node: DiagnosisNode, nodes: readonly DiagnosisNode[]): Set<string> {
  return new Set(nodes.filter(d => d.id !== node.id && sameFamily(node, d)).map(d => d.id));
}

// ── Working-diagnosis label matching ─────────────────────────────────────────

/**
 * How well a label matches the working-diagnosis text: over the label's alternatives, the best
 * (words found − words missing), neutral words ignored; −Infinity when no alternative has a word.
 * "Diabetic Ketoacidosis" for "Euglycaemic diabetic ketoacidosis" scores 2; "Hyperosmolar
 * Hyperglycaemic State" scores −3.
 */
export function labelMatchScore(label: string, workingText: string): number {
  const have = new Set(labelWords(workingText));
  const { mainAlternatives } = labelParts(label);
  let best = -Infinity;
  for (const alt of mainAlternatives) {
    const ws = alt.filter(w => !NEUTRAL.has(w));
    // "Acute Limb Ischaemia" does not match "chronic limb-threatening ischaemia" (nor the reverse).
    const clash = alt.filter(w => WORKING.opposites[w] !== undefined && have.has(WORKING.opposites[w])).length;
    if (!ws.length && !clash) continue;
    const found = ws.filter(w => have.has(w)).length;
    best = Math.max(best, found - (ws.length - found) - clash);
  }
  return best;
}

/** True when every non-neutral word of one of the label's alternatives is in the working text. */
export function labelFullyNamed(label: string, workingText: string): boolean {
  const have = new Set(labelWords(workingText));
  return labelParts(label).mainAlternatives.some(alt => {
    const ws = alt.filter(w => !NEUTRAL.has(w));
    return ws.length > 0 && ws.every(w => have.has(w));
  });
}

/** A candidate for the working diagnosis: its label, ICD-10 code and engine probability. */
export interface WorkingCandidate {
  label: string;
  icd10: string;
  probability: number;
}

/**
 * Index (into `nodes`, most probable first or in registry order) of the node the confirmed working
 * diagnosis names: the node whose label matches the diagnosis text better than the ICD-10 match
 * does (an ICD code can be shared or unspecific: K92.2 "GI haemorrhage" for a lower GI bleed, E11.1
 * for euglycaemic DKA in type 2 diabetes); else its ICD-10 code (exact, then the same category,
 * most probable first); else the exact label. A one-word label match only overrules an ICD-10
 * match; without one it needs two words. Null when nothing matches.
 */
export function resolveWorkingIndex(nodes: readonly WorkingCandidate[], label: string, icdCode: string | null): number | null {
  const text = label.trim();
  let byIcd = -1;
  const code = icdCode ? normaliseIcd(icdCode) : '';
  if (code) {
    byIcd = nodes.findIndex(n => normaliseIcd(n.icd10) === code);
    if (byIcd < 0) {
      const head = code.slice(0, 3);
      for (let i = 0; i < nodes.length; i++) {
        if (normaliseIcd(nodes[i].icd10).slice(0, 3) !== head) continue;
        if (byIcd < 0 || nodes[i].probability > nodes[byIcd].probability) byIcd = i;
      }
    }
  }
  if (text) {
    const icdRank = (n: WorkingCandidate) => {
      if (!code) return 0;
      const c = normaliseIcd(n.icd10);
      return c === code ? 2 : c.slice(0, 3) === code.slice(0, 3) ? 1 : 0;
    };
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const sc = labelMatchScore(nodes[i].label, text);
      const better = best < 0 || sc > bestScore
        || (sc === bestScore && (icdRank(nodes[i]) > icdRank(nodes[best])
          || (icdRank(nodes[i]) === icdRank(nodes[best]) && nodes[i].probability > nodes[best].probability)));
      if (better) { best = i; bestScore = sc; }
    }
    const icdScore = byIcd >= 0 ? labelMatchScore(nodes[byIcd].label, text) : -Infinity;
    const min = byIcd >= 0 ? WORKING.labelMatchMin : WORKING.labelMatchMinAlone;
    if (best >= 0 && bestScore >= min && bestScore >= icdScore + WORKING.labelMatchMargin) return best;
  }
  if (byIcd >= 0) return byIcd;
  const lower = text.toLowerCase();
  if (lower) {
    const i = nodes.findIndex(n => n.label.toLowerCase() === lower);
    if (i >= 0) return i;
  }
  return null;
}
