/**
 * Diagnosis families and working-diagnosis label matching for the web diagnostic-reasoning
 * adapter (diagnostic-reasoning.ts). Web only; deterministic; derived from the PANE registry
 * (disease ids, labels and ICD-10 codes), never from vignette text.
 *
 * PANE models some conditions at more than one granularity: "Inguinal / Femoral Hernia" and
 * "Incarcerated / Strangulated Hernia", "Peptic Ulcer Disease" and "Perforated Peptic Ulcer",
 * "Acute Appendicitis" and "Appendix Mass / Late Appendicitis", "Bowel Obstruction" and "Small
 * Bowel Obstruction — Adhesions". A parent and its child are the same condition, so the reasoning
 * panel treats them as compatible: the child never "competes" with a confirmed parent (or the
 * reverse) in a "Doesn't fit the working diagnosis" alert.
 *
 * Two diseases are one family when (registered in `diagnostic-reasoning-web`; needs sign-off):
 *  1. they share the ICD-10 category (letter + 2 digits) AND a head noun of their labels
 *     (K35 appendicitis / appendix mass, K27 peptic ulcer / perforated peptic ulcer, K56 bowel
 *     obstruction / adhesional obstruction, K92 upper / lower GI haemorrhage, C73 thyroid
 *     carcinomas; not K22 achalasia / oesophageal perforation or I71 aneurysm / dissection);
 *  2. both are injuries (ICD-10 S) of the same body region (block S2x thorax, S3x abdomen);
 *  3. one is a complication or grade of the other: its label carries a complication or grade
 *     modifier (incarcerated, strangulated, perforated, gangrene, necrotising, infected,
 *     obstructed, toxic, major, minor, late, early) and shares a head noun with the other in the
 *     same ICD-10 chapter ("Incarcerated / Strangulated Hernia" and every "… Hernia" in K), or
 *     names the other in its parenthesis ("Toxic Megacolon (Acute Severe Colitis)" and "Ulcerative
 *     Colitis"; "Fournier's Gangrene (Perineal Necrotising Fasciitis)" and "Necrotising
 *     Fasciitis").
 */

import type { DiseaseNode } from '@workspace/pane-engine';

/** Label words that mark a complication or a grade of a condition (rule 3). */
export const FAMILY_COMPLICATION_MODIFIERS: ReadonlySet<string> = new Set([
  'incarcerated', 'strangulated', 'perforated', 'gangrene', 'gangrenous', 'necrotising', 'necrotizing', 'infected',
  'obstructed', 'toxic', 'major', 'minor', 'late', 'early',
]);

/** Trailing label words that are not the condition's head noun. */
const GENERIC_TAIL = new Set(['disease', 'diseases', 'syndrome', 'disorder', 'disorders']);

/** Spelling / synonym normalisation for label words. */
const SYNONYMS: Record<string, string> = {
  hemorrhage: 'haemorrhage', bleed: 'haemorrhage', bleeding: 'haemorrhage', haemorrhagic: 'haemorrhage',
  hemorrhagic: 'haemorrhage', bleeds: 'haemorrhage',
  gastrointestinal: 'gi', esophageal: 'oesophageal', tumor: 'tumour', cancer: 'carcinoma', adenocarcinoma: 'carcinoma',
  malignancy: 'carcinoma', ischemia: 'ischaemia', ischemic: 'ischaemic', edema: 'oedema', fistulae: 'fistula',
  hernias: 'hernia', stones: 'stone', calculi: 'stone', calculus: 'stone', gallstone: 'cholelithiasis',
  gallstones: 'cholelithiasis',
};

function norm(word: string): string {
  const w = word.toLowerCase().replace(/['’]s$/, '');
  return SYNONYMS[w] ?? w;
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []).map(norm);
}

/**
 * The alternatives of a label phrase: "Inguinal / Femoral Hernia" → ["inguinal hernia",
 * "femoral hernia"] (a one-word alternative borrows the next alternative's last word).
 */
function alternatives(phrase: string): string[][] {
  const parts = phrase.split(/\s*\/\s*|\s+[—–-]\s+|,|\bor\b|\bincl\.?\b|;/).map(p => words(p)).filter(p => p.length);
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

interface LabelParts {
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
  const mainAlternatives = alternatives(main);
  const mainHeads = new Set(mainAlternatives.map(headOf).filter((h): h is string => !!h));
  const parenHeads = new Set(parens.flatMap(p => alternatives(p).map(headOf)).filter((h): h is string => !!h));
  const modifier = mainAlternatives.some(a => a.some(w => FAMILY_COMPLICATION_MODIFIERS.has(w)));
  const parts = { mainAlternatives, mainHeads, parenHeads, modifier };
  partsCache.set(label, parts);
  return parts;
}

function icd(code: string): string {
  return code.replace(/[.\s]/g, '').toUpperCase();
}

function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function childOf(child: DiseaseNode, parent: DiseaseNode): boolean {
  const c = labelParts(child.label);
  if (!c.modifier) return false;
  const p = labelParts(parent.label);
  if (intersects(c.parenHeads, p.mainHeads)) return true;
  return intersects(c.mainHeads, p.mainHeads) && icd(child.icd10).charAt(0) === icd(parent.icd10).charAt(0);
}

/** True when `a` and `b` are the same condition at different granularity (see the header). */
export function sameFamily(a: DiseaseNode, b: DiseaseNode): boolean {
  if (a.id === b.id) return true;
  if (a.id === '_other_' || b.id === '_other_') return false;
  const ca = icd(a.icd10);
  const cb = icd(b.icd10);
  if (ca.slice(0, 3) === cb.slice(0, 3) && intersects(labelParts(a.label).mainHeads, labelParts(b.label).mainHeads)) return true;
  if (ca.startsWith('S') && cb.startsWith('S') && ca.slice(0, 2) === cb.slice(0, 2)) return true;
  return childOf(a, b) || childOf(b, a);
}

/** Ids of the diseases in `diseases` that are one family with `node` (not including it). */
export function familyOf(node: DiseaseNode, diseases: DiseaseNode[]): Set<string> {
  return new Set(diseases.filter(d => d.id !== node.id && sameFamily(node, d)).map(d => d.id));
}

// ── Working-diagnosis label matching ─────────────────────────────────────────

/** Words that neither confirm nor contradict a label match. */
const NEUTRAL = new Set([
  'acute', 'chronic', 'disease', 'syndrome', 'disorder', 'and', 'or', 'of', 'the', 'with', 'in', 'on', 'a', 'an',
  'incl', 'including', 'symptomatic', 'adult', 'child', 'primary', 'other', 'unspecified',
]);
/** Neutral words that contradict each other. */
const OPPOSITE: Record<string, string> = { acute: 'chronic', chronic: 'acute' };

/**
 * How well a PANE label matches the working diagnosis text: over the label's alternatives, the
 * best (words found − words missing), neutral words ignored. "Diabetic Ketoacidosis" for
 * "Euglycaemic diabetic ketoacidosis" scores 2; "Hyperosmolar Hyperglycaemic State" scores −3.
 */
export function labelMatchScore(label: string, workingText: string): number {
  const have = new Set(words(workingText));
  const { mainAlternatives } = labelParts(label);
  let best = -Infinity;
  for (const alt of mainAlternatives) {
    const ws = alt.filter(w => !NEUTRAL.has(w));
    // "Acute Limb Ischaemia" does not match "chronic limb-threatening ischaemia" (nor the reverse).
    const clash = alt.filter(w => OPPOSITE[w] && have.has(OPPOSITE[w])).length;
    if (!ws.length && !clash) continue;
    const found = ws.filter(w => have.has(w)).length;
    best = Math.max(best, found - (ws.length - found) - clash);
  }
  return best;
}

/** True when every non-neutral word of one of the label's alternatives is in the working text. */
export function labelFullyNamed(label: string, workingText: string): boolean {
  const have = new Set(words(workingText));
  return labelParts(label).mainAlternatives.some(alt => {
    const ws = alt.filter(w => !NEUTRAL.has(w));
    return ws.length > 0 && ws.every(w => have.has(w));
  });
}
