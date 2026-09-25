/**
 * Herbs, teas, bush remedies and supplements — clinician-facing alerts and "ask about" prompts
 * (decision support only; nothing is stopped, ordered or written without a clinician tap).
 *
 * Twin of iOS `ios/AmiseMedFlow/Services/SupplementAlerts.swift`: same prompt ids, wording
 * (SUPPLEMENT_PROMPTS / SUPPLEMENT_TRIGGER_TERMS in supplement-catalogue.ts, parity-linted) and
 * thresholds:
 *  - not_asked: before a procedure, the mandatory question has not been answered.
 *  - periop_<item>: a recorded catalogue item — "Supplement: <name> — <concern>. Commonly cited
 *    stop time: <…> before elective surgery (source)."
 *  - ashwagandha_avoid: ashwagandha recorded with liver disease, pregnancy or thyroid disease.
 *  - liver: ALT or AST ≥ 120 U/L (3 × an upper limit of 40) or hepatitis / raised-LFT words.
 *  - lead: raised blood lead or lead words; or anaemia (Hb < 12 g/dL, < 13 in men) or neuropathy
 *    with abdominal pain; or a recorded Ayurvedic / turmeric product with any of those.
 *  - aristolochic: rapidly progressive renal failure / upper-tract urothelial cancer words, or a
 *    recorded Chinese herbal slimming product.
 *  - detox: K < 3.5 or Na < 135 mmol/L, dehydration / chronic constipation words, or a recorded
 *    detox tea / cleanse.
 *  - iv_drip: fever (≥ 38.0 °C or fever words) or cellulitis / line-site infection words, or a
 *    recorded IV drip.
 *
 * Lab names are read as WHOLE words (like iOS LabNameMatch), not with clinical-inference's
 * substring `numLab()`, so "Gastrin" is never AST and "HbA1c" is never haemoglobin.
 */
import { containsAnyAffirmed } from '@workspace/triage-engine';
import {
  SUPPLEMENT_TRIGGER_TERMS, perioperativeAlertText, recordedSupplementItems, supplementPrompt,
  type SupplementHistory, type SupplementItem,
} from './supplement-catalogue';

export interface SupplementPromptInput {
  history: SupplementHistory;
  /** A procedure or operation is planned. */
  preOp: boolean;
  /** Clinical text: PMH, HPI, complaint, diagnosis, assessment, symptoms, examination. */
  clinicalText: string;
  /** Conditions only (PMH, working diagnosis) — for the ashwagandha alert. */
  conditionsText: string;
  sex: string;
  pregnant: boolean;
  /** Consultation results, name → value text (investigationResults). */
  labs: Record<string, string>;
  temperatureC: number | null;
}

export type SupplementPromptLevel = 'high' | 'moderate' | 'info';

export interface SupplementPrompt {
  id: string;
  level: SupplementPromptLevel;
  title: string;
  detail: string;
  /** Catalogue items the prompt names (for "add to plan" text). */
  items: SupplementItem[];
}

const terms = (key: string) => SUPPLEMENT_TRIGGER_TERMS[key] ?? [];

/** "… Recorded: Turmeric / curcumin." (same format as iOS `withRecorded`). */
export function withRecorded(detail: string, recorded: SupplementItem[]): string {
  return recorded.length ? `${detail} Recorded: ${recorded.map(r => r.label).join(', ')}.` : detail;
}

/** Lowercase words of a lab name ("PT/INR" → pt, inr; "Ca++" keeps "+"). */
function labWords(name: string): string[] {
  return name.toLowerCase().split(/[^a-z0-9+µ]+/).filter(Boolean);
}

/** Whole-word, in-order match of any keyword in the lab name. */
function nameMatches(name: string, keywords: string[]): boolean {
  const words = labWords(name);
  return keywords.some(k => {
    const kw = labWords(k);
    for (let i = 0; i + kw.length <= words.length; i++) {
      if (kw.every((w, j) => words[i + j] === w)) return true;
    }
    return false;
  });
}

/** First number in the value of the first result whose name matches (whole words). */
export function labValue(labs: Record<string, string>, keywords: string[]): { value: number; text: string } | null {
  for (const [name, text] of Object.entries(labs)) {
    if (!nameMatches(name, keywords)) continue;
    const m = String(text).match(/\d+(?:\.\d+)?/);
    if (m) return { value: parseFloat(m[0]), text: String(text) };
  }
  return null;
}

/** WHO anaemia thresholds: Hb < 13 g/dL in men, < 12 g/dL otherwise. g/L values are converted. */
export function isAnaemic(hb: number | null, sex: string): boolean {
  if (hb === null || !(hb > 0)) return false;
  const gdl = hb > 25 ? hb / 10 : hb;
  return gdl < (sex === 'male' ? 13 : 12);
}

/** Blood lead above the reference, only when the unit is stated: ≥ 5 µg/dL or ≥ 0.24 µmol/L. */
export function leadIsRaised(value: number | null, resultText: string): boolean {
  if (value === null) return false;
  const t = resultText.toLowerCase();
  if (t.includes('µg/dl') || t.includes('ug/dl') || t.includes('mcg/dl')) return value >= 5;
  if (t.includes('µmol/l') || t.includes('umol/l')) return value >= 0.24;
  return false;
}

export function computeSupplementPrompts(i: SupplementPromptInput): SupplementPrompt[] {
  const out: SupplementPrompt[] = [];
  const has = (key: string) => containsAnyAffirmed(i.clinicalText, terms(key));
  const add = (id: string, level: SupplementPromptLevel, recorded: SupplementItem[] = []) => {
    const p = supplementPrompt(id);
    out.push({ id, level, title: p.title, detail: withRecorded(p.detail, recorded), items: recorded });
  };
  const recorded = recordedSupplementItems(i.history);
  const ids = new Set(recorded.map(r => r.id));
  const answered = i.history.status !== 'not_asked' || i.history.entries.length > 0;

  if (i.preOp && !answered) add('not_asked', 'moderate');

  for (const item of recorded) {
    out.push({
      id: `periop_${item.id}`, level: i.preOp ? 'moderate' : 'info',
      title: `Supplement: ${item.label}`, detail: perioperativeAlertText(item), items: [item],
    });
  }

  if (ids.has('ashwagandha') && (i.pregnant
    || containsAnyAffirmed(i.conditionsText, terms('liverDisease'))
    || containsAnyAffirmed(i.conditionsText, terms('thyroidDisease')))) {
    add('ashwagandha_avoid', 'high');
  }

  const alt = labValue(i.labs, ['alt', 'alanine aminotransferase'])?.value ?? null;
  const ast = labValue(i.labs, ['ast', 'aspartate aminotransferase', 'aspartate transaminase'])?.value ?? null;
  if ((alt ?? 0) >= 120 || (ast ?? 0) >= 120 || has('liver')) {
    add('liver', 'moderate', recorded.filter(r => r.id === 'turmeric' || r.id === 'ashwagandha'));
  }

  const hb = labValue(i.labs, ['haemoglobin', 'hemoglobin', 'hgb', 'hb'])?.value ?? null;
  const lead = labValue(i.labs, ['lead', 'blood lead']);
  const anaemia = isAnaemic(hb, i.sex) || has('anaemia');
  const abdoPain = has('abdominalPain');
  const neuropathy = has('neuropathy');
  const metalProduct = ids.has('ayurvedic_metals') || ids.has('turmeric');
  if (leadIsRaised(lead?.value ?? null, lead?.text ?? '') || has('lead')
    || ((anaemia || neuropathy) && abdoPain)
    || (metalProduct && (anaemia || abdoPain || neuropathy))) {
    add('lead', 'moderate', recorded.filter(r => r.id === 'ayurvedic_metals' || r.id === 'turmeric'));
  }

  if (has('aristolochic') || ids.has('aristolochia')) {
    add('aristolochic', 'moderate', recorded.filter(r => r.id === 'aristolochia'));
  }

  const k = labValue(i.labs, ['potassium', 'k'])?.value ?? null;
  const na = labValue(i.labs, ['sodium', 'na'])?.value ?? null;
  if ((k !== null && k < 3.5) || (na !== null && na < 135) || has('dehydration') || ids.has('detox_cleanse')) {
    add('detox', 'info', recorded.filter(r => r.id === 'detox_cleanse'));
  }

  const fever = (i.temperatureC !== null && i.temperatureC >= 38.0) || has('fever');
  if (fever || has('lineInfection') || ids.has('iv_vitamin_drip')) {
    add('iv_drip', 'info', recorded.filter(r => r.id === 'iv_vitamin_drip'));
  }
  return out;
}
