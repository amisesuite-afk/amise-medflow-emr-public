/**
 * Clinical decision rules added for evidence-exam 1.0.0 (the ones the Scales step did not have):
 * AIR, PERC, Ottawa ankle and knee, Canadian CT head, NEXUS, Canadian C-spine, Centor/McIsaac,
 * STONE, LRINEC, San Francisco syncope rule and the Canadian syncope risk score. Each is a
 * checklist whose total is the recorded value; its band, likelihood ratio or risk come from
 * clinical-content/rules/decision-rules.json. The existing calculators (Alvarado, Wells, HEART,
 * CURB-65, Glasgow-Blatchford, RCRI, Caprini, qSOFA, NEWS2, TG18) are unchanged.
 *
 * Pre-fill: what the record shows (age, sex, observations, results, negation-aware history and
 * examination text, the Exam-step sign chips) is ticked and marked "from record"; nothing is
 * assumed normal, and the clinician reviews every item before recording the value.
 */
import { decisionRule, formatLrValue, ruleBandFor } from '@workspace/pane-engine';
import type { DecisionRule, RuleBand, SignState } from '@workspace/pane-engine';
import { recordHas } from './record-text-match';

export type RuleValues = Record<string, boolean | string>;

export type RuleItem =
  | { kind: 'check'; key: string; label: string; points: number }
  | { kind: 'choice'; key: string; label: string; options: { value: string; label: string; points: number }[] };

/** What the record says, for the pre-fill. Units: Hb g/dL, creatinine µmol/L, glucose mmol/L. */
export interface RuleRecord {
  age: number | null;
  sex: string;
  heartRate: number | null;
  systolicBp: number | null;
  spo2: number | null;
  temperatureC: number | null;
  wbc: number | null;
  crp: number | null;
  haemoglobinGdl: number | null;
  sodium: number | null;
  creatinine: number | null;
  glucose: number | null;
  /** History, examination and results text (negation-aware matching). */
  text: string;
  signs: Record<string, SignState>;
}

export interface RuleSpec {
  /** ScalesTab SCALE_COMPONENTS key (decision-rules.json web.calculator). */
  scaleKey: string;
  /** decision-rules.json id. */
  ruleId: string;
  title: string;
  /** Who it applies to, one line. */
  applies: string;
  items: RuleItem[];
  total(v: RuleValues): number;
  prefill(r: RuleRecord): RuleValues;
}

const pts = (v: RuleValues, items: RuleItem[]): number => items.reduce((sum, it) => {
  if (it.kind === 'check') return sum + (v[it.key] === true ? it.points : 0);
  const o = it.options.find(x => x.value === v[it.key]);
  return sum + (o?.points ?? 0);
}, 0);

const has = (r: RuleRecord, re: RegExp) => !!r.text && recordHas(r.text, re);
const set = (out: RuleValues, key: string, value: boolean | string | null | undefined) => {
  if (value !== null && value !== undefined && value !== false) out[key] = value;
};

const AIR_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'vomiting', label: 'Vomiting', points: 1 },
  { kind: 'check', key: 'rifPain', label: 'Pain in the right iliac fossa', points: 1 },
  { kind: 'choice', key: 'rebound', label: 'Rebound tenderness or muscular defence', options: [
    { value: 'none', label: 'None', points: 0 }, { value: 'light', label: 'Light', points: 1 },
    { value: 'medium', label: 'Medium', points: 2 }, { value: 'strong', label: 'Strong', points: 3 }] },
  { kind: 'check', key: 'temp385', label: 'Temperature 38.5 °C or more', points: 1 },
  { kind: 'choice', key: 'neutrophils', label: 'Neutrophils', options: [
    { value: 'lt70', label: 'Below 70 %', points: 0 }, { value: '70to84', label: '70–84 %', points: 1 }, { value: 'ge85', label: '85 % or more', points: 2 }] },
  { kind: 'choice', key: 'wbc', label: 'White cell count (×10⁹/L)', options: [
    { value: 'lt10', label: 'Below 10', points: 0 }, { value: '10to14', label: '10–14.9', points: 1 }, { value: 'ge15', label: '15 or more', points: 2 }] },
  { kind: 'choice', key: 'crp', label: 'CRP (mg/L)', options: [
    { value: 'lt10', label: 'Below 10', points: 0 }, { value: '10to49', label: '10–49', points: 1 }, { value: 'ge50', label: '50 or more', points: 2 }] },
];

const PERC_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'age50', label: 'Age 50 or over', points: 1 },
  { kind: 'check', key: 'hr100', label: 'Heart rate 100/min or more', points: 1 },
  { kind: 'check', key: 'spo2', label: 'SpO₂ below 95 % on air', points: 1 },
  { kind: 'check', key: 'legSwelling', label: 'Unilateral leg swelling', points: 1 },
  { kind: 'check', key: 'haemoptysis', label: 'Haemoptysis', points: 1 },
  { kind: 'check', key: 'surgeryTrauma', label: 'Surgery or trauma needing hospital treatment in the last 4 weeks', points: 1 },
  { kind: 'check', key: 'priorVte', label: 'Previous DVT or PE', points: 1 },
  { kind: 'check', key: 'hormones', label: 'Oestrogen use (oral contraceptive, HRT)', points: 1 },
];

const OTTAWA_ANKLE_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'lateral', label: 'Bone tenderness: posterior edge or tip of the lateral malleolus (distal 6 cm)', points: 1 },
  { kind: 'check', key: 'medial', label: 'Bone tenderness: posterior edge or tip of the medial malleolus (distal 6 cm)', points: 1 },
  { kind: 'check', key: 'fifthMt', label: 'Bone tenderness: base of the fifth metatarsal', points: 1 },
  { kind: 'check', key: 'navicular', label: 'Bone tenderness: navicular', points: 1 },
  { kind: 'check', key: 'weightBearing', label: 'Unable to bear weight for 4 steps, both after the injury and now', points: 1 },
];

const OTTAWA_KNEE_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'age55', label: 'Age 55 or over', points: 1 },
  { kind: 'check', key: 'patella', label: 'Isolated tenderness of the patella', points: 1 },
  { kind: 'check', key: 'fibula', label: 'Tenderness of the head of the fibula', points: 1 },
  { kind: 'check', key: 'flex90', label: 'Unable to flex to 90 degrees', points: 1 },
  { kind: 'check', key: 'weightBearing', label: 'Unable to bear weight for 4 steps, both after the injury and now', points: 1 },
];

const CT_HEAD_HIGH: RuleItem[] = [
  { kind: 'check', key: 'gcs2h', label: 'GCS below 15 two hours after the injury', points: 1 },
  { kind: 'check', key: 'openFracture', label: 'Suspected open or depressed skull fracture', points: 1 },
  { kind: 'check', key: 'basal', label: 'Any sign of basal skull fracture', points: 1 },
  { kind: 'check', key: 'vomiting2', label: 'Vomiting twice or more', points: 1 },
  { kind: 'check', key: 'age65', label: 'Age 65 or over', points: 1 },
];
const CT_HEAD_MEDIUM: RuleItem[] = [
  { kind: 'check', key: 'amnesia30', label: 'Amnesia for 30 minutes or more before the impact', points: 1 },
  { kind: 'check', key: 'dangerous', label: 'Dangerous mechanism (pedestrian struck, ejected, fall from more than 3 ft or 5 stairs)', points: 1 },
];

const NEXUS_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'midline', label: 'Posterior midline cervical tenderness', points: 1 },
  { kind: 'check', key: 'focal', label: 'Focal neurological deficit', points: 1 },
  { kind: 'check', key: 'alertness', label: 'Altered alertness', points: 1 },
  { kind: 'check', key: 'intoxication', label: 'Intoxication', points: 1 },
  { kind: 'check', key: 'distracting', label: 'Painful distracting injury', points: 1 },
];

const CCS_HIGH: RuleItem[] = [
  { kind: 'check', key: 'age65', label: 'Age 65 or over', points: 1 },
  { kind: 'check', key: 'dangerous', label: 'Dangerous mechanism', points: 1 },
  { kind: 'check', key: 'paraesthesia', label: 'Paraesthesia in the extremities', points: 1 },
];
const CCS_LOW: RuleItem[] = [
  { kind: 'check', key: 'lowRisk', label: 'A low-risk factor: simple rear-end collision, sitting in the ED, walking at any time, delayed neck pain or no midline tenderness', points: 1 },
  { kind: 'check', key: 'rotate', label: 'Able to rotate the neck 45 degrees left and right', points: 1 },
];

const CENTOR_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'fever', label: 'Temperature above 38 °C', points: 1 },
  { kind: 'check', key: 'noCough', label: 'No cough', points: 1 },
  { kind: 'check', key: 'nodes', label: 'Tender, swollen anterior cervical nodes', points: 1 },
  { kind: 'check', key: 'exudate', label: 'Tonsillar swelling or exudate', points: 1 },
  { kind: 'choice', key: 'age', label: 'Age', options: [
    { value: '3to14', label: '3–14 years', points: 1 }, { value: '15to44', label: '15–44 years', points: 0 }, { value: 'ge45', label: '45 or over', points: -1 }] },
];

const STONE_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'male', label: 'Male sex', points: 2 },
  { kind: 'choice', key: 'timing', label: 'Duration of pain', options: [
    { value: 'gt24', label: 'More than 24 h', points: 0 }, { value: '6to24', label: '6–24 h', points: 1 }, { value: 'lt6', label: 'Less than 6 h', points: 3 }] },
  { kind: 'check', key: 'nonBlack', label: 'Origin: non-black ethnicity (as derived; the rule was not validated in Caribbean populations)', points: 3 },
  { kind: 'choice', key: 'nausea', label: 'Nausea and vomiting', options: [
    { value: 'none', label: 'None', points: 0 }, { value: 'nausea', label: 'Nausea alone', points: 1 }, { value: 'vomiting', label: 'Vomiting', points: 2 }] },
  { kind: 'check', key: 'haematuria', label: 'Haematuria (microscopic or on dipstick)', points: 3 },
];

const LRINEC_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'crp150', label: 'CRP 150 mg/L or more', points: 4 },
  { kind: 'choice', key: 'wbc', label: 'White cell count (×10⁹/L)', options: [
    { value: 'lt15', label: 'Below 15', points: 0 }, { value: '15to25', label: '15–25', points: 1 }, { value: 'gt25', label: 'Above 25', points: 2 }] },
  { kind: 'choice', key: 'hb', label: 'Haemoglobin (g/dL)', options: [
    { value: 'gt135', label: 'Above 13.5', points: 0 }, { value: '11to135', label: '11–13.5', points: 1 }, { value: 'lt11', label: 'Below 11', points: 2 }] },
  { kind: 'check', key: 'na135', label: 'Sodium below 135 mmol/L', points: 2 },
  { kind: 'check', key: 'creat141', label: 'Creatinine above 141 µmol/L', points: 2 },
  { kind: 'check', key: 'glucose10', label: 'Glucose above 10 mmol/L', points: 1 },
];

const SFSR_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'chf', label: 'History of congestive heart failure', points: 1 },
  { kind: 'check', key: 'hct', label: 'Haematocrit below 30 %', points: 1 },
  { kind: 'check', key: 'ecg', label: 'Abnormal ECG (non-sinus rhythm or new changes)', points: 1 },
  { kind: 'check', key: 'sob', label: 'Shortness of breath', points: 1 },
  { kind: 'check', key: 'sbp90', label: 'Systolic BP below 90 mmHg at triage', points: 1 },
];

const CSRS_ITEMS: RuleItem[] = [
  { kind: 'check', key: 'vasovagalPredisposition', label: 'Predisposition to vasovagal symptoms (warm crowded place, prolonged standing, fear, emotion, pain)', points: -1 },
  { kind: 'check', key: 'heartDisease', label: 'History of heart disease', points: 1 },
  { kind: 'check', key: 'sbp', label: 'Any systolic BP below 90 or above 180 mmHg', points: 2 },
  { kind: 'check', key: 'troponin', label: 'Troponin above the 99th centile', points: 2 },
  { kind: 'check', key: 'axis', label: 'Abnormal QRS axis (below -30 or above 100 degrees)', points: 1 },
  { kind: 'check', key: 'qrs', label: 'QRS duration above 130 ms', points: 1 },
  { kind: 'check', key: 'qtc', label: 'Corrected QT above 480 ms', points: 2 },
  { kind: 'choice', key: 'edDiagnosis', label: 'Emergency department diagnosis', options: [
    { value: 'neither', label: 'Neither', points: 0 }, { value: 'vasovagal', label: 'Vasovagal syncope', points: -2 }, { value: 'cardiac', label: 'Cardiac syncope', points: 2 }] },
];

const bandOf = (v: number | null, cuts: [number, string][], fallback: string): string | null => {
  if (v === null) return null;
  for (const [limit, value] of cuts) if (v < limit) return value;
  return fallback;
};

export const RULE_SPECS: Record<string, RuleSpec> = {
  air: {
    scaleKey: 'air', ruleId: 'air', title: 'Appendicitis Inflammatory Response (AIR) score',
    applies: 'Suspected appendicitis (adults and children).', items: AIR_ITEMS,
    total: v => pts(v, AIR_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'vomiting', has(r, /\bvomit\w*/));
      set(out, 'rifPain', has(r, /\b(right iliac fossa|rif|right lower quadrant|rlq)\b/));
      const reb = r.signs.rigidity === 'present' ? 'strong' : r.signs.guarding === 'present' ? 'medium' : r.signs.rebound === 'present' ? 'light' : null;
      set(out, 'rebound', reb);
      set(out, 'temp385', r.temperatureC !== null && r.temperatureC >= 38.5);
      set(out, 'wbc', bandOf(r.wbc, [[10, 'lt10'], [15, '10to14']], 'ge15'));
      set(out, 'crp', bandOf(r.crp, [[10, 'lt10'], [50, '10to49']], 'ge50'));
      return out;
    },
  },
  perc: {
    scaleKey: 'perc', ruleId: 'perc', title: 'PERC rule (pulmonary embolism rule-out)',
    applies: 'Only when the clinical probability of PE is already low (gestalt under 15 % or Wells PE 4 or less).', items: PERC_ITEMS,
    total: v => pts(v, PERC_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'age50', r.age !== null && r.age >= 50);
      set(out, 'hr100', r.heartRate !== null && r.heartRate >= 100);
      set(out, 'spo2', r.spo2 !== null && r.spo2 < 95);
      set(out, 'legSwelling', has(r, /\b(unilateral|one|left|right) (leg|calf) (is )?(swell\w*|swollen)|\b(swollen|swelling of the) (left|right) (leg|calf)\b/));
      set(out, 'haemoptysis', has(r, /\bha?emoptysis|coughing (up )?blood\b/));
      set(out, 'surgeryTrauma', has(r, /\b(operation|surgery|surgical|fracture|trauma)\b[^.]{0,30}\b(\d|two|three|four) weeks? ago\b|\bpost-?op(erative)?\b/));
      set(out, 'priorVte', has(r, /\b(previous|prior|history of|past) (dvt|pe|pulmonary embol\w*|deep vein thrombosis|vte)\b/));
      set(out, 'hormones', has(r, /\b(oral contraceptive|combined pill|ocp|hrt|hormone replacement|oestrogen|estrogen)\b/));
      return out;
    },
  },
  ottawaAnkle: {
    scaleKey: 'ottawaAnkle', ruleId: 'ottawa-ankle', title: 'Ottawa ankle and foot rules',
    applies: 'Acute ankle or midfoot injury, age 18 or over (validated also in children over 5).', items: OTTAWA_ANKLE_ITEMS,
    total: v => pts(v, OTTAWA_ANKLE_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'lateral', has(r, /\b(tender\w*)\b[^.]{0,30}\blateral malleol\w*/));
      set(out, 'medial', has(r, /\b(tender\w*)\b[^.]{0,30}\bmedial malleol\w*/));
      set(out, 'fifthMt', has(r, /\b(tender\w*)\b[^.]{0,40}\b(fifth|5th) metatarsal/));
      set(out, 'navicular', has(r, /\b(tender\w*)\b[^.]{0,30}\bnavicular/));
      set(out, 'weightBearing', has(r, /\b(unable|cannot|can't|could not|couldn't) (to )?(bear weight|weight[- ]bear|walk)\b/));
      return out;
    },
  },
  ottawaKnee: {
    scaleKey: 'ottawaKnee', ruleId: 'ottawa-knee', title: 'Ottawa knee rule',
    applies: 'Acute knee injury, age 18 or over.', items: OTTAWA_KNEE_ITEMS,
    total: v => pts(v, OTTAWA_KNEE_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'age55', r.age !== null && r.age >= 55);
      set(out, 'weightBearing', has(r, /\b(unable|cannot|can't|could not|couldn't) (to )?(bear weight|weight[- ]bear|walk)\b/));
      return out;
    },
  },
  canadianCtHead: {
    scaleKey: 'canadianCtHead', ruleId: 'canadian-ct-head', title: 'Canadian CT head rule',
    applies: 'Minor head injury (GCS 13–15) with loss of consciousness, amnesia or disorientation; age 16 or over; not on anticoagulants.',
    items: [...CT_HEAD_HIGH, ...CT_HEAD_MEDIUM],
    total: v => (pts(v, CT_HEAD_HIGH) > 0 ? 2 : pts(v, CT_HEAD_MEDIUM) > 0 ? 1 : 0),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'age65', r.age !== null && r.age >= 65);
      set(out, 'vomiting2', has(r, /\b(vomited|vomiting)\b[^.]{0,20}\b(twice|two|three|several|repeated\w*)\b|\brepeated vomiting\b/));
      set(out, 'basal', has(r, /\b(battle'?s sign|raccoon eyes|panda eyes|haemotympanum|hemotympanum|csf (otorrh|rhinorrh)\w*)/));
      return out;
    },
  },
  nexus: {
    scaleKey: 'nexus', ruleId: 'nexus', title: 'NEXUS low-risk criteria (cervical spine)',
    applies: 'Blunt trauma with possible neck injury: imaging is not needed when none of the five is present.', items: NEXUS_ITEMS,
    total: v => pts(v, NEXUS_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'midline', has(r, /\bmidline (cervical |neck |c-spine )?tender\w*/));
      set(out, 'intoxication', has(r, /\b(intoxicat\w*|drunk|smells? of alcohol)\b/));
      return out;
    },
  },
  canadianCSpine: {
    scaleKey: 'canadianCSpine', ruleId: 'canadian-c-spine', title: 'Canadian C-spine rule',
    applies: 'Alert (GCS 15), stable adults after blunt trauma with neck pain or a dangerous mechanism.',
    items: [...CCS_HIGH, ...CCS_LOW],
    total: v => (pts(v, CCS_HIGH) > 0 || v.lowRisk !== true || v.rotate !== true ? 1 : 0),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'age65', r.age !== null && r.age >= 65);
      set(out, 'paraesthesia', has(r, /\b(paraesthesi\w*|paresthesi\w*|tingling|pins and needles)\b/));
      return out;
    },
  },
  centor: {
    scaleKey: 'centor', ruleId: 'centor', title: 'Centor / McIsaac score',
    applies: 'Sore throat: probability of group A streptococcal pharyngitis.', items: CENTOR_ITEMS,
    total: v => pts(v, CENTOR_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'fever', r.temperatureC !== null && r.temperatureC > 38);
      set(out, 'exudate', has(r, /\b(tonsillar (exudate|swelling)|exudative tonsil\w*|pus on (the )?tonsils)\b/));
      set(out, 'age', r.age === null ? null : r.age < 15 ? '3to14' : r.age < 45 ? '15to44' : 'ge45');
      return out;
    },
  },
  stone: {
    scaleKey: 'stone', ruleId: 'stone', title: 'STONE score (uncomplicated ureteric stone)',
    applies: 'Flank pain in an adult: probability of an uncomplicated ureteric stone (derived in the USA).', items: STONE_ITEMS,
    total: v => pts(v, STONE_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'male', r.sex === 'male');
      set(out, 'nausea', has(r, /\bvomit\w*/) ? 'vomiting' : has(r, /\bnause\w*/) ? 'nausea' : null);
      set(out, 'haematuria', has(r, /\b(ha?ematuria|blood in (the )?urine|dipstick[^.]{0,20}blood)\b/));
      return out;
    },
  },
  lrinec: {
    scaleKey: 'lrinec', ruleId: 'lrinec', title: 'LRINEC score (necrotising soft-tissue infection)',
    applies: 'Severe soft-tissue infection. A low score never excludes necrotising infection.', items: LRINEC_ITEMS,
    total: v => pts(v, LRINEC_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'crp150', r.crp !== null && r.crp >= 150);
      set(out, 'wbc', bandOf(r.wbc, [[15, 'lt15'], [25.0001, '15to25']], 'gt25'));
      set(out, 'hb', r.haemoglobinGdl === null ? null : r.haemoglobinGdl > 13.5 ? 'gt135' : r.haemoglobinGdl >= 11 ? '11to135' : 'lt11');
      set(out, 'na135', r.sodium !== null && r.sodium < 135);
      set(out, 'creat141', r.creatinine !== null && r.creatinine > 141);
      set(out, 'glucose10', r.glucose !== null && r.glucose > 10);
      return out;
    },
  },
  sfSyncope: {
    scaleKey: 'sfSyncope', ruleId: 'sf-syncope', title: 'San Francisco syncope rule (CHESS)',
    applies: 'Syncope in the emergency department: any criterion means a higher risk of a serious outcome.', items: SFSR_ITEMS,
    total: v => pts(v, SFSR_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'chf', has(r, /\b(heart failure|ccf|chf|lvsd)\b/));
      set(out, 'sob', has(r, /\b(short(ness)? of breath|breathless\w*|dyspnoea|dyspnea)\b/));
      set(out, 'sbp90', r.systolicBp !== null && r.systolicBp < 90);
      return out;
    },
  },
  canadianSyncope: {
    scaleKey: 'canadianSyncope', ruleId: 'canadian-syncope', title: 'Canadian syncope risk score',
    applies: 'Adults after syncope: 30-day risk of a serious adverse event.', items: CSRS_ITEMS,
    total: v => pts(v, CSRS_ITEMS),
    prefill: r => {
      const out: RuleValues = {};
      set(out, 'heartDisease', has(r, /\b(ischaemic heart disease|ihd|heart failure|atrial fibrillation|myocardial infarction|valve disease|cardiomyopathy)\b/));
      set(out, 'sbp', r.systolicBp !== null && (r.systolicBp < 90 || r.systolicBp > 180));
      return out;
    },
  },
};

export interface RuleOutcome {
  rule: DecisionRule;
  value: number;
  band: RuleBand | null;
  /** "LR 0.17 (0.11–0.25) for Pulmonary embolism" or the band's risk. */
  summary: string;
}

export function ruleOutcome(spec: RuleSpec, values: RuleValues): RuleOutcome | null {
  const rule = decisionRule(spec.ruleId);
  if (!rule) return null;
  const value = spec.total(values);
  const band = ruleBandFor(rule, value);
  const lr = band?.lr ? `LR ${formatLrValue(band.lr)} for ${rule.target.finding}` : '';
  const summary = [band?.label, lr, band?.risk].filter(Boolean).join(' — ');
  return { rule, value, band, summary };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export interface RuleRecordSource {
  age?: string | number | null;
  sex?: string;
  vitals?: Partial<Record<string, string | number | null>>;
  labs?: Partial<Record<'wbc' | 'crp' | 'haemoglobin' | 'sodium' | 'creatinine' | 'glucose', number | null>>;
  text?: string;
  signs?: Record<string, SignState>;
}

export function ruleRecord(src: RuleRecordSource): RuleRecord {
  const l = src.labs ?? {};
  const hb = num(l.haemoglobin);
  return {
    age: num(src.age), sex: (src.sex ?? '').toLowerCase(),
    heartRate: num(src.vitals?.heartRate), systolicBp: num(src.vitals?.systolicBp), spo2: num(src.vitals?.spo2),
    temperatureC: num(src.vitals?.temperatureC),
    wbc: num(l.wbc), crp: num(l.crp), haemoglobinGdl: hb === null ? null : hb > 25 ? hb / 10 : hb,
    sodium: num(l.sodium), creatinine: num(l.creatinine), glucose: num(l.glucose),
    text: src.text ?? '', signs: src.signs ?? {},
  };
}
