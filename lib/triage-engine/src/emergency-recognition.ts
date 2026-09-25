/**
 * Emergency recognition — the "recognise and redirect" layer (web triage + consultation prompts).
 *
 * The practice is an outpatient general and endoscopic surgery clinic. Medical, obstetric,
 * paediatric and neurological emergencies are not managed in clinic: this layer RECOGNISES them
 * from the whole record (history, examination, vital signs, NEWS2, blood pressure, laboratory
 * results, ECG / imaging reports, confirmed diagnosis), names them, lists the standard first
 * actions AS SUGGESTIONS for the clinician, and gives the redirect:
 *
 *     Call 911 or go to the nearest emergency department now
 *     (OKEU Hospital, St Jude's Hospital or Tapion Hospital).
 *
 * Owner-approved scope (2026-09-25 "fix all gaps" programme; SURGEON-DECISIONS.md C1–C3, G1.1,
 * G1.3, G3). Nothing here diagnoses, prescribes or orders: every action is a suggestion the
 * clinician accepts or ignores. Deterministic only — no AI, no network.
 *
 * Every free-text test goes through the negation-aware matcher (negation.ts), whole-word
 * regexes only. Doses appear only where the named guideline states them; children (< 16 years)
 * get "weight-based — calculate per BNFc" instead of an adult dose, except the RCUK 2021
 * age-banded IM adrenaline doses, which the guideline itself states per age band.
 *
 * Consumed by adaptiveTriage() (triage level = max of all sources; the AI never downgrades it)
 * and by the dashboard's computeClinicalPrompts() (alarm + first actions). Items that are the
 * surgeon's decision are listed in docs/clinical-validation/changes/fix-web-triage.md
 * ("Needs sign-off").
 */

import { joinClauses, testAffirmed } from './negation';
import { evaluateNews2, type News2Avpu, type News2Evaluation } from './news2';

export const EMERGENCY_RULES_VERSION = '1.0.0';

/** The redirect sentence. Victoria Hospital no longer exists and must never be named. */
export const EMERGENCY_REDIRECT =
  "Call 911 or go to the nearest emergency department now (OKEU Hospital, St Jude's Hospital or Tapion Hospital).";

export type EmergencyLevel = 'emergency' | 'urgent' | 'priority';

const LEVEL_RANK: Record<EmergencyLevel, number> = { priority: 1, urgent: 2, emergency: 3 };

export function maxEmergencyLevel(a: EmergencyLevel | null, b: EmergencyLevel | null): EmergencyLevel | null {
  if (!a) return b;
  if (!b) return a;
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

export type EmergencyCategory =
  | 'cardiac' | 'vascular' | 'neurological' | 'sepsis' | 'respiratory' | 'allergy' | 'metabolic'
  | 'obstetric' | 'gynaecological' | 'urological' | 'paediatric' | 'surgical' | 'trauma' | 'physiology'
  | 'laboratory' | 'perioperative';

export interface EmergencyAction {
  text: string;
  /** 'investigation' → an order suggestion; 'action' → a plan suggestion; 'redirect' → 911 / ED. */
  kind: 'investigation' | 'action' | 'redirect';
}

export interface RecognisedEmergency {
  id: string;
  title: string;
  level: EmergencyLevel;
  category: EmergencyCategory;
  /** The findings that triggered the rule ("SpO₂ 88%", "K⁺ 6.7 mmol/L", "sudden facial droop"). */
  reasons: string[];
  /** True → show the 911 / emergency department redirect. */
  redirect: boolean;
  actions: EmergencyAction[];
  /** Guideline(s) the rule and its actions follow. */
  guideline: string;
}

export interface SafeguardingFlag {
  id: string;
  title: string;
  reasons: string[];
  level: EmergencyLevel | null;
  actions: EmergencyAction[];
  guideline: string;
}

export interface RiskModifier {
  id: string;
  /** Shown as a triage reason. */
  text: string;
}

export interface TriageLabs {
  potassium: number | null;
  sodium: number | null;
  glucose: number | null;
  ketones: number | null;
  ph: number | null;
  bicarbonate: number | null;
  /** Adjusted / corrected calcium when recorded, otherwise total calcium (mmol/L). */
  calcium: number | null;
  troponin: number | null;
  /** True when the troponin result text says raised / positive. */
  troponinRaisedText: boolean;
  lactate: number | null;
  /** g/dL (a value above 25 is read as g/L and converted). */
  haemoglobin: number | null;
  platelets: number | null;
  creatinine: number | null;
  osmolality: number | null;
  wbc: number | null;
  /** Absolute neutrophil count (×10⁹/L); a percentage is ignored. */
  neutrophils: number | null;
  alt: number | null;
  ast: number | null;
  inr: number | null;
  /** mmol/L (a value above 60 is read as mg/dL and converted). */
  triglycerides: number | null;
  /** Urine dipstick protein grade (0 = negative/trace, 1 = 1+ …), null when not recorded. */
  urineProtein: number | null;
  /** Pregnancy test result text: 'positive' | 'negative' | null. */
  pregnancyTest: 'positive' | 'negative' | null;
}

export interface EmergencyVitals {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  glucoseMmol?: number | null;
  avpu?: News2Avpu | null;
  onSupplementalO2?: boolean | null;
}

export interface EmergencyInput {
  age?: number | null;
  sex?: string;
  /** Chief complaint, HPI, symptom chips and chip details (one clause each). */
  historyText?: string;
  /** Examination free text (general, systems, ECG written in the examination). */
  examText?: string;
  comorbidities?: string[];
  surgicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  vitals?: EmergencyVitals;
  /** Laboratory results, name → result text ("Potassium" → "6.7 mmol/L"). */
  investigationResults?: Record<string, string>;
  /** Imaging, ECG and other report texts. */
  resultReports?: string[];
  /** The working / confirmed diagnosis: assessment text and ICD-10 codes. */
  diagnosis?: { text?: string | null; icd10?: ReadonlyArray<string | null | undefined> } | null;
  pregnancyPossible?: boolean;
  isPostOp?: boolean;
  postOpDays?: number | null;
}

export interface PregnancyState {
  pregnant: boolean;
  weeks: number | null;
  /** Weeks since delivery when postpartum is recorded (0 when the timing is not written). */
  postpartumWeeks: number | null;
}

export interface EmergencyAssessment {
  emergencies: RecognisedEmergency[];
  safeguarding: SafeguardingFlag[];
  riskModifiers: RiskModifier[];
  labs: TriageLabs;
  /** NEWS2 for adults (≥ 16, not pregnant) when at least one observation is recorded. */
  news2: News2Evaluation | null;
  /** Age in years, refined from "7-week-old" / "9-month-old" wording when ageYears < 2. */
  ageYears: number | null;
  paediatric: boolean;
  pregnancy: PregnancyState;
  /** Highest level across emergencies and safeguarding flags. */
  level: EmergencyLevel | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function firstNumber(s: string): number | null {
  const m = s.replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Numeric lab by name. `include` must match the (lowercased) name, `exclude` must not. */
function labBy(results: Record<string, string>, include: RegExp, exclude?: RegExp): { value: number | null; text: string } | null {
  for (const [k, v] of Object.entries(results)) {
    const name = k.toLowerCase();
    if (!include.test(name)) continue;
    if (exclude && exclude.test(name)) continue;
    return { value: firstNumber(v ?? ''), text: (v ?? '').toLowerCase() };
  }
  return null;
}

/** Parses the laboratory results the triage and prompts need (name keywords, units as written). */
export function extractTriageLabs(results: Record<string, string> | undefined): TriageLabs {
  const r = results ?? {};
  const urine = /\burine|\burinary|\bur\b|dipstick/;
  const calciumAdj = labBy(r, /\b(adjusted|corrected)\b.*calcium|calcium.*\b(adjusted|corrected)\b/);
  const calciumAny = labBy(r, /\bcalcium\b|^ca$|^ca2\+$/, /urine|ionis|ioniz|24/);
  const tn = labBy(r, /troponin|\bhs-?c?tn[it]?\b|\bc?tn[it]\b/);
  const hbRaw = labBy(r, /haemoglobin|hemoglobin|^hb$|^hgb$|\bhb\b(?!a1c)/, /a1c|glycated|electrophoresis|hplc/);
  let hb = hbRaw?.value ?? null;
  if (hb !== null && hb > 25) hb = hb / 10; // g/L → g/dL
  const neut = labBy(r, /neutrophil/, /%|percent|ratio/);
  const dip = labBy(r, /dipstick|urinalysis|urine protein|proteinuria/);
  let urineProtein: number | null = null;
  if (dip) {
    const m = dip.text.match(/protein[^,;.]{0,6}?(\d)\s*\+|protein\s*\+{1,4}|(\d)\+\s*protein/);
    if (m) urineProtein = m[1] ? parseInt(m[1], 10) : m[2] ? parseInt(m[2], 10) : (m[0].match(/\+/g)?.length ?? 0);
    else if (/protein\s*(negative|nil|neg|trace)/.test(dip.text) || /^negative/.test(dip.text)) urineProtein = 0;
  }
  const hcg = labBy(r, /\bhcg\b|β-?hcg|beta-?hcg|pregnancy test|b-?hcg/);
  let pregnancyTest: TriageLabs['pregnancyTest'] = null;
  if (hcg) {
    if (/positive|\bpos\b|detected/.test(hcg.text) && !/not detected|negative/.test(hcg.text)) pregnancyTest = 'positive';
    else if (/negative|\bneg\b|not detected|< ?5/.test(hcg.text)) pregnancyTest = 'negative';
    else if (hcg.value !== null && hcg.value >= 25) pregnancyTest = 'positive';
  }
  return {
    potassium: labBy(r, /\bpotassium\b|^k\+?$|^k \(|serum k\b/, urine)?.value ?? null,
    sodium: labBy(r, /\bsodium\b|^na\+?$|serum na\b/, urine)?.value ?? null,
    glucose: labBy(r, /glucose|blood sugar|\bcbg\b|\bbm\b|capillary blood/, /urine|hba1c|tolerance/)?.value ?? null,
    ketones: labBy(r, /ketone|hydroxybutyrate/, urine)?.value ?? null,
    ph: labBy(r, /(^|\b)ph\b/, urine)?.value ?? null,
    bicarbonate: labBy(r, /bicarbonate|hco3|\bbicarb\b/)?.value ?? null,
    calcium: (calciumAdj ?? calciumAny)?.value ?? null,
    troponin: tn?.value ?? null,
    troponinRaisedText: !!tn && /\b(raised|elevated|positive|high|rising|above)\b/.test(tn.text) && !/not (raised|elevated)|normal|negative/.test(tn.text),
    lactate: labBy(r, /lactate/)?.value ?? null,
    haemoglobin: hb,
    platelets: labBy(r, /platelet|\bplt\b/)?.value ?? null,
    creatinine: labBy(r, /creatinine/, /clearance|urine|ratio/)?.value ?? null,
    osmolality: labBy(r, /osmolality|osmolarity/, urine)?.value ?? null,
    wbc: labBy(r, /\bwbc\b|\bwcc\b|white (blood )?cell|leucocyte count|leukocyte count/)?.value ?? null,
    neutrophils: neut?.value ?? null,
    alt: labBy(r, /\balt\b|alanine/)?.value ?? null,
    ast: labBy(r, /\bast\b|aspartate/)?.value ?? null,
    inr: labBy(r, /\binr\b/)?.value ?? null,
    triglycerides: (() => {
      const tg = labBy(r, /triglycerid/)?.value ?? null;
      return tg !== null && tg > 60 ? Math.round((tg / 88.57) * 10) / 10 : tg;
    })(),
    urineProtein,
    pregnancyTest,
  };
}

/** Age in years, refined from "12-day-old", "7-week-old", "9-month-old" wording for infants. */
export function refineAgeYears(age: number | null | undefined, text: string): number | null {
  const a = isNum(age) ? age : null;
  if (a !== null && a >= 2) return a;
  const m = text.toLowerCase().match(/\b(\d{1,2})[- ](day|week|month)s?[- ]old\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (m[2] === 'day') return n / 365;
    if (m[2] === 'week') return (n * 7) / 365;
    return n / 12;
  }
  return a;
}

/** Pregnancy / postpartum state written in the record (NICE NG133 uses "up to 6 weeks postpartum"). */
export function detectPregnancy(text: string, sex: string | undefined, pregnancyPossible: boolean | undefined): PregnancyState {
  const female = sex === 'female';
  const lower = text.toLowerCase();
  let weeks: number | null = null;
  const w = lower.match(/\b(\d{1,2})\s*(?:\+\s*\d\s*)?(?:weeks?|wks?)'?\s*(?:pregnant|gestation|of pregnancy|by dates|gestational)\b/)
    ?? lower.match(/\b(?:pregnant|gestation|primigravida|multigravida|g\d\s*p\d)\b[^.;\n]{0,20}?\b(?:at\s+)?(\d{1,2})\s*(?:\+\s*\d\s*)?(?:weeks?|wks?)\b/)
    ?? lower.match(/\bat (\d{1,2}) weeks\b/);
  if (w) weeks = parseInt(w[1], 10);
  // "Pregnancy test negative" is not a pregnancy; "chest pain in pregnancy" is.
  const pregnantText = testAffirmed(/\b(pregnant|gestation|gravid|primigravida|multigravida|antenatal|g\d\s*p\d|in (this |her |my )?pregnancy)\b/, text);
  // The written record decides; the "pregnancy possible" tick alone does not make a pregnancy.
  void pregnancyPossible;
  const pregnant = female && (weeks !== null || pregnantText);
  let postpartumWeeks: number | null = null;
  const pp = testAffirmed(/\b(post-?partum|post-?natal|puerper\w*|delivery|delivered|gave birth|since (the |her )?birth)\b/, text);
  if (female && pp && !pregnant) {
    const t = lower.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week)s?\s+(?:after|since|post)/);
    const n = t ? (/^\d/.test(t[1]) ? parseInt(t[1], 10) : ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].indexOf(t[1]) + 1) : null;
    postpartumWeeks = t && n !== null ? (t[2] === 'day' ? n / 7 : n) : 0;
  }
  return { pregnant, weeks: pregnant ? weeks : null, postpartumWeeks };
}

/**
 * Paediatric vital-sign limits (children under 16). Heart and respiratory rate are the NICE NG51
 * (2016, updated 2024) "high risk" thresholds by age band, which match NICE NG143 (fever in under
 * 5s, 2019) for the under-5 bands; hypotension is the AHA PALS 2020 definition. Adult thresholds
 * are used only from 16 years.
 */
export interface PaediatricVitalLimits {
  band: string;
  hrHigh: number;
  hrLow: number;
  rrHigh: number;
  sbpLow: number;
  spo2Low: number;
}

export function paediatricVitalLimits(ageYears: number | null | undefined): PaediatricVitalLimits | null {
  if (!isNum(ageYears) || ageYears >= 16) return null;
  const sbpLow = ageYears < 28 / 365 ? 60 : ageYears < 1 ? 70 : ageYears <= 10 ? 70 + 2 * Math.floor(ageYears) : 90;
  if (ageYears < 1) return { band: 'under 1 year', hrHigh: 160, hrLow: 60, rrHigh: 60, sbpLow, spo2Low: 90 };
  if (ageYears < 3) return { band: '1–2 years', hrHigh: 150, hrLow: 60, rrHigh: 50, sbpLow, spo2Low: 90 };
  if (ageYears < 5) return { band: '3–4 years', hrHigh: 140, hrLow: 60, rrHigh: 40, sbpLow, spo2Low: 90 };
  if (ageYears < 12) return { band: '5–11 years', hrHigh: 130, hrLow: 60, rrHigh: 29, sbpLow, spo2Low: 90 };
  return { band: '12–15 years', hrHigh: 131, hrLow: 50, rrHigh: 25, sbpLow, spo2Low: 92 };
}

/** ICD-10 prefix → level of the confirmed diagnosis (the diagnosis alone, before physiology). */
const DX_LEVELS: Array<{ prefixes: string[]; level: EmergencyLevel; label: string }> = [
  { level: 'emergency', label: 'acute coronary syndrome', prefixes: ['I21', 'I22', 'I24', 'I20.0'] },
  { level: 'emergency', label: 'stroke / intracranial haemorrhage', prefixes: ['I60', 'I61', 'I62', 'I63', 'I64'] },
  { level: 'emergency', label: 'aortic dissection / ruptured aneurysm', prefixes: ['I71.0', 'I71.1', 'I71.3', 'I71.5', 'I71.8'] },
  { level: 'emergency', label: 'arterial embolism / thrombosis', prefixes: ['I74'] },
  { level: 'emergency', label: 'acute mesenteric ischaemia', prefixes: ['K55.0'] },
  { level: 'emergency', label: 'high-risk pulmonary embolism', prefixes: ['I26.0'] },
  { level: 'emergency', label: 'meningitis / meningococcal disease', prefixes: ['G00', 'G01', 'G02', 'G03', 'A39', 'A87'] },
  { level: 'emergency', label: 'sepsis / shock', prefixes: ['A40', 'A41', 'R65.2', 'R57'] },
  { level: 'emergency', label: 'anaphylaxis', prefixes: ['T78.0', 'T78.2', 'T88.6', 'T80.5'] },
  { level: 'emergency', label: 'diabetic ketoacidosis', prefixes: ['E10.1', 'E11.1', 'E13.1', 'E14.1'] },
  { level: 'emergency', label: 'hyperosmolar hyperglycaemic state', prefixes: ['E10.0', 'E11.0', 'E13.0'] },
  { level: 'emergency', label: 'cauda equina / spinal cord compression', prefixes: ['G83.4', 'G95.2'] },
  { level: 'emergency', label: 'severe pre-eclampsia / HELLP / eclampsia', prefixes: ['O14.1', 'O14.2', 'O15'] },
  { level: 'emergency', label: 'ectopic pregnancy', prefixes: ['O00'] },
  { level: 'emergency', label: 'placental abruption', prefixes: ['O45'] },
  { level: 'emergency', label: 'testicular torsion', prefixes: ['N44'] },
  { level: 'emergency', label: 'ovarian torsion', prefixes: ['N83.5'] },
  { level: 'emergency', label: 'intussusception / malrotation', prefixes: ['K56.1', 'Q43.3'] },
  { level: 'emergency', label: 'perforated viscus / peritonitis', prefixes: ['K65', 'K63.1', 'K22.3', 'K25.1', 'K25.2', 'K25.5', 'K25.6', 'K26.1', 'K26.2', 'K26.5', 'K26.6', 'K27.1', 'K27.2', 'K27.5', 'K27.6', 'K28.1', 'K28.2', 'K28.5', 'K28.6'] },
  { level: 'emergency', label: 'hernia with gangrene', prefixes: ['K40.1', 'K40.4', 'K41.1', 'K41.4', 'K42.1', 'K43.1', 'K43.4', 'K43.7', 'K44.1', 'K45.1', 'K46.1'] },
  { level: 'emergency', label: 'necrotising soft-tissue infection', prefixes: ['M72.6', 'N49.3'] },
  { level: 'emergency', label: 'respiratory failure / status asthmaticus', prefixes: ['J96.0', 'J46', 'J93.0', 'S27.0'] },
  { level: 'emergency', label: 'hypertensive emergency', prefixes: ['I16.1'] },
  { level: 'emergency', label: 'major burn (≥ 20% TBSA)', prefixes: ['T31.2', 'T31.3', 'T31.4', 'T31.5', 'T31.6', 'T31.7', 'T31.8', 'T31.9'] },
  { level: 'urgent', label: 'pulmonary embolism', prefixes: ['I26'] },
  { level: 'urgent', label: 'transient ischaemic attack', prefixes: ['G45'] },
  { level: 'urgent', label: 'aortic aneurysm', prefixes: ['I71'] },
  { level: 'urgent', label: 'acute heart failure', prefixes: ['I50'] },
  { level: 'urgent', label: 'acute appendicitis', prefixes: ['K35', 'K36', 'K37'] },
  { level: 'urgent', label: 'anorectal abscess', prefixes: ['K61'] },
  { level: 'urgent', label: 'bowel obstruction / volvulus', prefixes: ['K56'] },
  { level: 'urgent', label: 'complicated diverticulitis', prefixes: ['K57.0', 'K57.2', 'K57.4', 'K57.8'] },
  { level: 'urgent', label: 'obstructed / incarcerated hernia', prefixes: ['K40.0', 'K40.3', 'K41.0', 'K41.3', 'K42.0', 'K43.0', 'K43.3', 'K43.6', 'K44.0', 'K45.0', 'K46.0'] },
  { level: 'urgent', label: 'acute cholecystitis / cholangitis', prefixes: ['K81.0', 'K80.0', 'K80.1', 'K80.3', 'K80.4', 'K83.0'] },
  { level: 'urgent', label: 'acute pancreatitis', prefixes: ['K85'] },
  { level: 'urgent', label: 'gastrointestinal haemorrhage', prefixes: ['K92.0', 'K92.1', 'K92.2', 'K25.0', 'K25.4', 'K26.0', 'K26.4', 'I85.0', 'I85.1'] },
  { level: 'urgent', label: 'intra-abdominal / penetrating injury', prefixes: ['S36', 'S31', 'S37'] },
  { level: 'urgent', label: 'head injury', prefixes: ['S06'] },
  { level: 'urgent', label: 'burn 10–19% TBSA', prefixes: ['T31.1'] },
  { level: 'urgent', label: 'post-procedural hypocalcaemia', prefixes: ['E89.2'] },
  { level: 'urgent', label: 'hypercalcaemia', prefixes: ['E83.52'] },
  { level: 'urgent', label: 'hyperkalaemia', prefixes: ['E87.5'] },
  { level: 'urgent', label: 'hyponatraemia', prefixes: ['E87.1'] },
  { level: 'urgent', label: 'hypoglycaemia', prefixes: ['E16.0', 'E16.1', 'E16.2', 'E10.64', 'E11.64'] },
  { level: 'urgent', label: 'acute kidney injury', prefixes: ['N17'] },
  { level: 'urgent', label: 'pyonephrosis', prefixes: ['N13.6'] },
  { level: 'urgent', label: 'pre-eclampsia', prefixes: ['O14', 'O11'] },
  { level: 'urgent', label: 'pyloric stenosis', prefixes: ['Q40.0'] },
  { level: 'urgent', label: 'suspected child maltreatment', prefixes: ['T74', 'T76'] },
  { level: 'urgent', label: 'delirium', prefixes: ['F05'] },
  { level: 'urgent', label: 'hypertensive urgency', prefixes: ['I16'] },
  { level: 'priority', label: 'suspected cancer', prefixes: ['C'] },
  { level: 'priority', label: 'unexplained visible haematuria', prefixes: ['R31.0'] },
  { level: 'priority', label: 'positive faecal occult blood / FIT', prefixes: ['R19.5'] },
  { level: 'priority', label: 'femoral hernia', prefixes: ['K41'] },
  { level: 'priority', label: 'abscess', prefixes: ['L02', 'L05.0'] },
  { level: 'priority', label: 'superficial vein thrombosis', prefixes: ['I80.0'] },
  { level: 'priority', label: 'Charcot neuro-osteoarthropathy', prefixes: ['E11.61', 'M14.6'] },
];

function normIcd(code: string): string {
  const c = code.trim().toUpperCase().replace(/\s+/g, '');
  if (c.length > 3 && !c.includes('.')) return `${c.slice(0, 3)}.${c.slice(3)}`;
  return c;
}

/** The highest level implied by the confirmed diagnosis codes. */
export function diagnosisLevel(icd10: ReadonlyArray<string | null | undefined> | undefined): { level: EmergencyLevel; label: string; code: string } | null {
  let best: { level: EmergencyLevel; label: string; code: string } | null = null;
  for (const raw of icd10 ?? []) {
    if (!raw) continue;
    const code = normIcd(raw);
    // Longest (most specific) matching prefix wins for this code.
    let hit: { level: EmergencyLevel; label: string; len: number } | null = null;
    for (const row of DX_LEVELS) {
      for (const p of row.prefixes) {
        const pp = normIcd(p.length > 3 ? p : p);
        if (code.startsWith(pp) && (!hit || pp.length > hit.len)) hit = { level: row.level, label: row.label, len: pp.length };
      }
    }
    if (hit && (!best || LEVEL_RANK[hit.level] > LEVEL_RANK[best.level])) best = { level: hit.level, label: hit.label, code };
  }
  return best;
}

// ── The rules ────────────────────────────────────────────────────────────────────────────────

interface Ctx {
  age: number | null;
  paed: boolean;
  female: boolean;
  male: boolean;
  preg: PregnancyState;
  /** History: CC, HPI, chips. */
  H: string;
  /** Examination. */
  E: string;
  /** Results: imaging/ECG reports + lab texts. */
  R: string;
  /** Diagnosis text. */
  D: string;
  /** Past history: comorbidities. */
  PMH: string;
  PSH: string;
  MEDS: string;
  ALLERGY: string;
  HE: string;
  HER: string;
  HERD: string;
  v: Required<{ [K in keyof EmergencyVitals]: EmergencyVitals[K] | null }>;
  labs: TriageLabs;
  news2: News2Evaluation | null;
  limits: PaediatricVitalLimits | null;
  gcs: number | null;
  icd: string[];
  isPostOp: boolean;
}

const a = (text: string, re: RegExp) => testAffirmed(re, text);

const RX = {
  chestPain: /\b(chest (pain|pressure|tightness|heaviness|discomfort|ache)|(central|retrosternal|crushing) (chest )?(pain|pressure|tightness)|angina)\b/,
  cardiacRadiation: /\b(radiat\w*|spread\w*|going|goes|shoot\w*)\b[^.;\n]{0,25}\b(arm|arms|jaw|neck|shoulder)\b/,
  cardiacCharacter: /\b(crushing|pressure|heavy|heaviness|squeez\w*|band-like|elephant)\b/,
  sweating: /\b(sweat\w*|diaphore\w*|clammy|sweaty)\b/,
  jawArmAche: /\b(jaw|arm)\b[^.;\n]{0,15}\b(ache|aching|pain|discomfort|heaviness)\b|\b(ache|aching|pain|discomfort)\b[^.;\n]{0,15}\b(in|of) (the |her |his )?(jaw|left arm|arms)\b|\bjaw pain\b/,
  breathless: /\b(breathless\w*|short(ness)? of breath|sob\b|dyspn(o)?ea|difficulty breathing|struggling to breathe|can'?t catch (my|his|her) breath)\b/,
  epigastric: /\b(epigastri\w*|upper abdominal)\b/,
  nausea: /\b(nause\w*|vomit\w*)\b/,
  pleuritic: /\bpleuritic\b/,
  stElevation: /\b(st[- ]?(segment )?elevation|stemi|new (left )?bundle branch block|new lbbb)\b/,
  stDepression: /\b(st[- ]?(segment )?depression|t[- ]wave inversion|dynamic st)\b/,
  heartBlock: /\b(complete heart block|third[- ]degree (av |heart )?block|chb)\b/,
  vt: /\b(ventricular tachycardia|ventricular fibrillation|\bvt\b|\bvf\b)\b/,
  kEcg: /\b(peaked|tall|tented)\b[^.;\n]{0,12}\bt[- ]?waves?\b|\b(broad|wide|widened|broadened)\b[^.;\n]{0,6}\bqrs\b|\bqrs\b[^.;\n]{0,4}\b(1[3-9]\d|[2-9]\d\d)\s*ms\b|\bsine[- ]wave\b|\b(flattened|absent) p[- ]?waves?\b/,
  // "Tearing pain on defecation" (anal fissure) is not dissection: chest / back / interscapular only.
  dissection: /\b(tearing|ripping)\b[^.;\n]{0,30}\b(chest|back|interscapular|between (the|his|her) shoulder)|\b(chest|back|interscapular)\b[^.;\n]{0,20}\b(tearing|ripping)\b|\baortic dissection\b/,
  aaa: /\b(abdominal aortic aneurysm|aortic aneurysm|\baaa\b|pulsatile (abdominal |epigastric |expansile )?mass)\b/,
  aaaPain: /\b(abdominal|back|loin|flank|groin) pain\b|\bpain\b[^.;\n]{0,25}\b(abdomen|back|loin|flank)\b|\bcollaps\w*\b|\bsyncope\b|\bfaint\w*\b/,
  face: /\b(facial (droop|weakness|asymmetry)|face (droop\w*|weak\w*)|droop\w* (of the )?(face|mouth)|mouth droop\w*|facial palsy)\b/,
  arm: /\b((left|right)[- ]sided weakness|(left|right) (arm|leg|hand|side)\b[^.;\n]{0,15}\b(weak\w*|drift|numb\w*|heavy)|(arm|leg) drift|hemipar\w*|hemiplegi\w*|weakness of (the )?(left|right) (arm|leg|side)|unilateral weakness|one-sided weakness|weak (left|right) (arm|leg))\b/,
  speech: /\b(slurred speech|slurr\w* (his |her )?(words|speech)|dysarthri\w*|dysphasi\w*|aphasi\w*|word[- ]finding|difficulty (speaking|finding words)|speech (difficult\w*|disturb\w*)|garbled speech|can'?t speak)\b/,
  transient: /\b(transient|resolved|fully recovered|back to normal|lasted \d+ (minutes|mins|hours)|tia)\b/,
  thunderclap: /\b(thunderclap|worst headache|worst[- ]ever headache|sudden (severe |onset )?(occipital |explosive )?headache|headache\b[^.;\n]{0,40}\b(worst|maximum within|peaked within|within (seconds|a minute|1 minute))|hit (on the head )?with a (bat|hammer)|first[- ]?(\/|or )?worst[- ]ever)\b/,
  headache: /\bheadache\b/,
  meningism: /\b(neck stiffness|stiff neck|neck (is |feels )?stiff|meningism|kernig\w*|brudzinski\w*|photophobi\w*|light hurts|nuchal rigidity)\b/,
  nonBlanching: /\b(non[- ]?blanching|purpur\w*|petechia\w*|does not fade|doesn'?t fade)\b/,
  confusion: /\b(confus\w*|disorientat\w*|drows\w*|obtunded|reduced (level of )?consciousness|altered (mental|consciousness)|not (him|her)self|delirium|delirious|agitat\w*|hallucinat\w*|unresponsive)\b/,
  fever: /\b(fever\w*|febrile|pyrexi\w*|rigors?|chills|high temperature)\b/,
  infection: /\b(infect\w*|sepsis|septic|pneumonia|cellulitis|abscess|perforat\w*|pyelonephritis|urosepsis|uti|urinary tract infection|cholangitis|pus|purulent|productive cough|consolidation|dysuria|wound (discharge|infection)|empyema|peritonitis|meningitis|fever\w*|febrile|pyrexi\w*|rigors?)\b/,
  saddle: /\b(saddle (anaesthesia|anesthesia|numbness|area)|numb\w*\b[^.;\n]{0,30}\b(bottom|back passage|perine\w*|perianal|genital\w*|buttock\w*|saddle)|(bottom|back passage|perine\w*|perianal|genitals?|buttocks?)\b[^.;\n]{0,15}\b(feels? |is |are )?numb\w*|(perianal|perineal|saddle) (numbness|sensory loss|anaesthesia)|reduced (pinprick )?(perianal|perineal|saddle) sensation|reduced (pinprick )?sensation\b[^.;\n]{0,25}\b(perianal|perine\w*|s3|s4|saddle))\b/,
  analTone: /\b((lax|reduced|poor|decreased|absent) anal tone)\b/,
  retention: /\b(urinary retention|unable to pass urine|can'?t pass urine|cannot pass urine|retention of urine|hesitan\w*|reduced (bladder|urinary) sensation|difficulty (starting|passing) (to pass )?urine|incontinen\w*|bladder \/ bowel dysfunction|bladder dysfunction)\b/,
  backPain: /\b(back pain|backache|sciatica|lumbar|disc (prolapse|herniation)|spinal pain|\bback\b)\b/,
  cancer: /\b(cancer|carcinoma|malignan\w*|metasta\w*|myeloma|lymphoma|sarcoma|oncolog\w*|tumou?r)\b/,
  spinalPain: /\b(back pain|spinal pain|thoracic pain|mid-back pain|neck pain|band-like|pain\b[^.;\n]{0,20}\b(spine|back))\b/,
  neuroDeficit: /\b((legs?|limbs?) (going |are |is )?(weak\w*|numb\w*)|weakness\b[^.;\n]{0,20}\b(legs?|limbs?)|limb weakness|paraparesis|paraplegi\w*|sensory level|unsteady\w*|(unsteady|abnormal|ataxic|spastic) gait|difficulty walking|numb\w* (below|from)|upgoing plantars|extensor plantars|hesitan\w*|incontinen\w*|retention|power [0-4]\/5)\b/,
  anaphylaxisSkin: /\b(urticari\w*|hives|angio-?o?edema|(lip|lips|tongue|face|facial|throat)\b[^.;\n]{0,12}\b(swell\w*|swollen)|swollen (lips|tongue|face)|swelling of (the )?(lips|tongue|face)|flush\w*|itchy (blotchy )?rash|blotchy rash)\b/,
  anaphylaxisABC: /\b(wheez\w*|stridor|hoarse\w*|breathless\w*|difficulty (breathing|swallowing)|noisy breathing|throat (tight\w*|closing|swelling)|faint\w*|collaps\w*|dizz\w*|light-?headed)\b/,
  anaphylaxisWord: /\banaphyla\w*\b/,
  af: /\b(atrial fibrillation|irregularly irregular|fast af|rapid af|new af|af with (rapid|fast))\b/,
  syncope: /\b(syncope|collaps\w*|faint\w*|blackout|passed out)\b/,
  hfSigns: /\b(pulmonary o?edema|orthopn\w*|pnd|paroxysmal nocturnal|bibasal crackles|crackles (to|at|in) (the )?(mid|both)|raised jvp|jvp (raised|elevated)|gallop|s3|heart failure)\b/,
  papilloedema: /\b(papill?o?edema|retinal ha?emorrhag\w*|flame ha?emorrhag\w*|hypertensive retinopathy|cotton wool)\b/,
  htnOrgan: /\b(papill?o?edema|retinal ha?emorrhag\w*|encephalopath\w*|seizure\w*|had a fit|fitting|visual (disturbance|loss|blurring)|blurred vision|flashing lights|chest pain|pulmonary o?edema|confus\w*|focal (neuro\w*|deficit)|severe headache)\b/,
  preEclampsiaSx: /\b(headache|visual (disturbance|blurring|loss)|blurred vision|flashing lights|spots before|epigastric|right upper quadrant|ruq|under the (right )?ribs|clonus|hyperreflexi\w*|brisk reflexes|(facial|sudden) (o?edema|swelling)|swollen face|vomit\w*)\b/,
  seizure: /\b(seizure\w*|convuls\w*|had a fit|a fit\b(?! and)|fitting|tonic[- ]clonic|eclampsi\w*)\b/,
  kussmaul: /\b(kussmaul|deep (sighing|rapid) (respiration|breathing)|ketotic breath|ketones? (high|hi\b))\b/,
  sglt2: /\b(\w*gliflozin|sglt-?2)\b/,
  dkaWords: /\b(diabetic ketoacidosis|\bdka\b|ketoacidosis)\b/,
  hhsWords: /\b(hyperosmolar|\bhhs\b)\b/,
  vomiting: /\b(vomit\w*|nause\w*)\b/,
  abdoPain: /\b(abdominal pain|tummy pain|belly pain|abdo(minal)? (ache|discomfort)|stomach pain|epigastric pain|central abdominal pain)\b/,
  pelvicPain: /\b(pelvic pain|(lower abdominal|iliac fossa|lower quadrant|adnexal|ovarian) pain|pain\b[^.;\n]{0,20}\b(pelvis|lower abdomen|iliac fossa|adnexa))\b/,
  suddenSevere: /\b(sudden\w*|acute|abrupt\w*|severe|excruciating|worst)\b/,
  adnexalMass: /\b(ovarian (cyst|mass|dermoid)|adnexal (mass|cyst)|dermoid|enlarged ovary)\b/,
  torsionWords: /\b(torsion|twisted (ovary|testis|testicle))\b/,
  scrotal: /\b(testicular pain|scrotal pain|testis pain|pain in (the |his |my )?(testicle|testis|scrotum)|high[- ]riding (testis|testicle)|absent cremasteric)\b/,
  missedPeriod: /\b(missed (a )?(period|menses)|amenorrho\w*|late period|period (is )?late|positive pregnancy test|pregnancy test positive|hcg positive|early pregnancy)\b/,
  vaginalBleed: /\b(vaginal bleed\w*|pv bleed\w*|spotting|bleeding per vagina)\b/,
  shoulderTip: /\bshoulder[- ]tip pain\b/,
  bilious: /\b(bilious|green|bile[- ]stained|dark green)\b[^.;\n]{0,15}\b(vomit\w*|aspirate|fluid)\b|\bvomit\w*\b[^.;\n]{0,25}\b(green|bile|bilious)\b/,
  intussusception: /\b(red ?currant|jelly[- ]like stool|blood and mucus|sausage[- ]shaped mass|drawing (up )?(his |her |the )?(legs|knees)|episodic (screaming|crying)|inconsolable (screaming|crying)|intussuscept\w*)\b/,
  projectile: /\bprojectile\b[^.;\n]{0,15}\bvomit\w*\b|\bvomit\w*\b[^.;\n]{0,10}\bprojectile\b|\bolive[- ]shaped mass\b|\bvisible (gastric )?peristalsis\b/,
  ng143Red: /\b(mottled|ashen|blue (lips|skin)|cyanos\w*|grunting|bulging fontanelle|weak (high[- ]pitched )?cry|high[- ]pitched cry|does not wake|doesn'?t wake|floppy|hypotoni\w*|non[- ]?blanching|status epilepticus)\b/,
  penetrating: /\b(stab(bed|bing)?( wound)?|knife wound|gunshot|shot (in|to)|penetrating (injury|trauma|wound)|impaled|evisceration|eviscerated)\b/,
  headInjury: /\b(head injury|head trauma|hit (his|her|my) head|struck (his|her|the) head|fall\b[^.;\n]{0,25}\bhead|banged (his|her|my) head)\b/,
  burn: /\b(burns?|burnt|scald\w*|flame|thermal injury)\b/,
  inhalation: /\b(inhalation (injury)?|smoke inhalation|soot|singed (nasal|facial) hair|enclosed[- ]space|carbonaceous sputum|hoarse\w*|stridor)\b/,
  circumferential: /\bcircumferential\b/,
  electrical: /\b(high[- ]voltage|electrical (injury|burn)|electrocut\w*|lightning)\b/,
  chemical: /\b(chemical (burn|injury|splash)|alkali\w*|acid (burn|injury|splash)|caustic|corrosive|cement burn|bleach|sodium hydroxide|oven cleaner|hydrofluoric)\b/,
  fullThickness: /\b(full[- ]thickness|deep dermal|deep partial)\b/,
  specialArea: /\b(face|facial|hands?|feet|foot|perine\w*|genital\w*|buttocks?|major joints?)\b/,
  limbIschaemia: /\b(cold|pale|white|mottled|dusky)\b[^.;\n]{0,20}\b(leg|foot|limb|arm|hand|toes|calf)\b|\b(pulseless|absent (foot |pedal |femoral |popliteal |distal |dorsalis pedis |posterior tibial )?pulses?|no (palpable )?(foot |pedal |distal )?pulses?)\b/,
  limbPainAcute: /\b(sudden\w*|acute\w*|abrupt\w*)\b[^.;\n]{0,40}\b(pain|numb\w*|weak\w*|cold)\b|\b(paraesthesi\w*|paralysis|can'?t move (the |his |her )?(leg|foot|toes))\b/,
  mesenteric: /\b(pain out of proportion|out of proportion to (the )?(signs|examination|findings)|mesenteric ischa?emia|bowel ischa?emia)\b/,
  necFasc: /\b(necroti[sz]ing (fasciitis|soft[- ]tissue infection)|fournier\w*|crepitus|gas in (the )?(soft )?tissues?|soft[- ]tissue gas|pain out of proportion|dusky (skin|discolou?ration)|ha?emorrhagic bullae|bullae)\b/,
  peritonitis: /\b(board[- ]like|rigid(ity)?\b|generali[sz]ed (guarding|peritonism|peritonitis|tenderness)|peritonism|peritonitis|involuntary guarding)\b/,
  freeAir: /\b(free (intraperitoneal |intra-abdominal |sub-?diaphragmatic )?(air|gas)|pneumoperitoneum|subdiaphragmatic (air|gas))\b/,
  completeDysphagia: /\b(unable to swallow (saliva|secretions|anything|liquids|water)|can'?t swallow (saliva|anything|his own saliva|her own saliva)|cannot swallow (saliva|anything)|spitting (out )?(saliva|secretions)|drooling)\b/,
  stridor: /\bstridor\b/,
  neckHaematoma: /\b(neck (haematoma|hematoma)|ha?ematoma\b[^.;\n]{0,20}\b(neck|wound)|expanding (neck )?(ha?ematoma|swelling)|(wound|neck) swelling\b[^.;\n]{0,30}\b(increasing|expanding|tense|rapid\w*|stridor|breath\w*))\b/,
  thyroidSurgery: /\b(thyroidectomy|parathyroidectomy|hemithyroidectomy|thyroid (surgery|lobectomy)|neck (dissection|exploration))\b/,
  tetany: /\b(tetany|carpo-?pedal spasm|chvostek\w*|trousseau\w*|perioral (tingling|numbness|paraesthesi\w*)|tingling (around|of) (the )?(mouth|lips|fingers)|pins and needles in (the )?(fingers|hands|lips))\b/,
  haematuria: /\b((visible|frank|gross|macroscopic|painless) ha?ematuria|blood in (the |his |her |my )?urine|passing blood\b|red urine)\b/,
  uti: /\b(dysuria|urinary tract infection|\buti\b|nitrite positive|cystitis)\b/,
  asthma: /\basthma\w*\b/,
  asthmaSevere: /\b(can'?t (complete|finish) (sentences|a sentence)|unable to complete sentences|single words|silent chest|exhaust\w*|peak flow\b[^.;\n]{0,15}\b([1-4]\d)\s*%|pef\b[^.;\n]{0,15}\b([1-4]\d)\s*%)\b/,
  copd: /\b(copd|chronic obstructive|emphysema|chronic bronchitis|co2 retain\w*|co₂ retain\w*|hypercapni\w*|type 2 respiratory failure)\b/,
  delirium: /\b(new(ly)? confus\w*|acute(ly)? confus\w*|delirium|delirious|disorientat\w*|agitat\w*|hallucinat\w*|not (him|her)self|muddled|drows\w*)\b/,
  postOp: /\b(post-?op\w*|after (the |his |her |my )?(operation|surgery|procedure)|day \d+ (after|post)|following (the |his |her )?(operation|surgery|laparotomy|resection|repair))\b/,
  pe: /\b(pulmonary embol\w*|\bpe\b)\b/,
  dvtSigns: /\b(calf (swelling|tenderness|pain)|swollen (calf|leg)|unilateral leg swelling|dvt|deep vein thrombosis)\b/,
  haemoptysis: /\b(ha?emoptysis|coughing (up )?blood)\b/,
  steroid: /\b(prednisolone|hydrocortisone|dexamethasone|methylprednisolone|budesonide|long-term steroids?|oral steroids?|steroid[- ]dependent)\b/,
  immunosuppressant: /\b(methotrexate|azathioprine|mercaptopurine|tacrolimus|ciclosporin|cyclosporin\w*|mycophenol\w*|sirolimus|everolimus|adalimumab|infliximab|etanercept|golimumab|certolizumab|vedolizumab|ustekinumab|tocilizumab|rituximab|biologic\w*|chemotherapy|immunotherapy|capecitabine|cyclophosphamide|leflunomide)\b/,
  immunoPmh: /\b(immunosuppress\w*|immunocompromis\w*|transplant\w*|\bhiv\b|aids|neutropeni\w*|chemotherapy|on chemo)\b/,
  chemo: /\b(chemotherapy|on chemo|chemo (cycle|last)|cycle \d+ of)\b/,
  asplenia: /\b(splenectomy|asplen\w*|post-?splenectomy|no spleen|hyposplen\w*)\b/,
  betaBlocker: /\b(\w+olol|bisoprolol|atenolol|metoprolol|propranolol|carvedilol|nebivolol|labetalol|sotalol)\b/,
  ivdu: /\b(inject\w* (drug|heroin)|injecting drug|\bivdu\b|\bpwid\b|iv drug (use|user)|intravenous drug (use|user)|heroin)\b/,
  aorticGraft: /\b(aortic (graft|repair|stent|aneurysm repair)|\bevar\b|aorto-?(bifemoral|iliac)|endovascular (aneurysm|aortic) repair|aaa repair)\b/,
  mechanicalValve: /\bmechanical (heart |mitral |aortic |prosthetic )?valve\b|\bmechanical (mvr|avr)\b|\b(mvr|avr)\b[^.;\n]{0,15}\bmechanical\b/,
  dementia: /\b(dementia|alzheimer\w*|cognitive impairment|memory (problems|impairment))\b/,
  mh: /\b(malignant hyperthermia|mh[- ]suscept\w*|\bmhs\b)\b/,
  suxApnoea: /\b(suxamethonium (apnoea|apnea|sensitivity)|scoline (apnoea|apnea)|(butyryl|pseudo-?|plasma )?cholinesterase deficiency|prolonged (neuromuscular )?block\w* after suxamethonium|suxamethonium\b[^.;\n]{0,40}\b(apnoea|apnea|ventilat\w*))\b/,
  latex: /\blatex\b/,
  difficultAirway: /\b(difficult (airway|intubation|laryngoscopy)|failed intubation|cannot intubate)\b/,
  osa: /\b(obstructive sleep apn\w*|sleep apn\w*|\bosa\b|cpap at night|snor\w*)\b/,
  tetanusWound: /\b(laceration|puncture wound|wound|bite|cut|graze|burn)\b/,
  tetanusProne: /\b(soil|manure|farm\w*|rusty|contaminat\w*|dirty|puncture|devitali[sz]\w*|compound fracture|foreign body|animal bite|bite|garden\w*|nail)\b/,
  mobility: /\b(not (yet )?(crawling|walking|cruising|mobile|rolling)|non-?mobile|pre-?mobile|immobile infant)\b/,
  bruise: /\b(bruis\w*)\b/,
  inconsistentHistory: /\b((explanation|history|account|story)\b[^.;\n]{0,20}\b(vague|varied|varies|changes|changed|changing|inconsistent)|(vague|inconsistent|changing|varying) (explanation|history|account)|changes on (re-?telling|retelling)|varied between carers|initially said)\b/,
  immersion: /\b((stocking|glove)[- ]distribution|tide-?marks?|sparing of (the )?(natal cleft|flexures)|immersion (scald|burn|injury)|no splash marks)\b/,
  patternedBruise: /\b(fingertip[- ]pattern|fingertip bruis\w*|finger-?tip bruis\w*|bruis\w* of (different|differing|varying) (ages|colours|colors)|(linear|patterned|slap) (mark|bruis)\w*|old and new bruises)\b/,
  partnerViolence: /\b((pushed|hit|punched|kicked|slapped|strangled|assaulted|beaten|attacked|choked) by (her |his |my )?(partner|husband|boyfriend|ex|wife|girlfriend)|(partner|husband|boyfriend)\b[^.;\n]{0,15}\b(pushed|hit|punched|kicked|slapped|strangled|assaulted|beat|attacked|choked)|domestic (violence|abuse)|intimate partner (violence|abuse))\b/,
};

function vitalsOf(v: EmergencyVitals | undefined): Ctx['v'] {
  const n = (x: number | null | undefined) => (isNum(x) ? x : null);
  return {
    systolicBp: n(v?.systolicBp), diastolicBp: n(v?.diastolicBp), heartRate: n(v?.heartRate),
    respiratoryRate: n(v?.respiratoryRate), temperatureC: n(v?.temperatureC), spo2: n(v?.spo2),
    glucoseMmol: n(v?.glucoseMmol), avpu: v?.avpu ?? null, onSupplementalO2: typeof v?.onSupplementalO2 === 'boolean' ? v.onSupplementalO2 : null,
  };
}

function parseGcs(text: string): number | null {
  const m = text.toLowerCase().match(/\bgcs\b\D{0,6}(\d{1,2})\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 3 && n <= 15 ? n : null;
}

/** "fever" written with a temperature below 38.0 °C in the same clause is not a fever. */
export function textReportsFever(text: string): boolean {
  return textFever(text);
}

/** Green / bilious vomit, negation-aware on the colour word, in the same clause as the vomit. */
function biliousVomit(text: string): boolean {
  return text.split(/[.;\n()]/).some(c => testAffirmed(/\b(bilious|green|bile[- ]stained|dark green)\b/, c)
    && /\b(vomit\w*|aspirate|fluid|posset\w*)\b/i.test(c));
}

function textFever(text: string): boolean {
  if (!a(text, RX.fever)) return false;
  const lower = text.toLowerCase();
  const clauses = lower.split(/[.;\n]/);
  return clauses.some(c => {
    if (!testAffirmed(RX.fever, c)) return false;
    const t = c.match(/\b(3[4-9](?:\.\d)?|4[0-2](?:\.\d)?)\s*(?:°|degrees|c\b)/);
    return !t || parseFloat(t[1]) >= 38.0;
  });
}

/** The leading clause of the working diagnosis (before the first full stop, bracket, colon or dash). */
export function diagnosisHead(text: string): string {
  const noBrackets = text.replace(/\([^)]*\)/g, ' ');
  return (noBrackets.split(/[.;:\n]| - | — | – /)[0] ?? '').replace(/\s+/g, ' ').trim();
}

/** Sentences that describe the present, not a dated past event ("in 2015", "aged 19", "years ago"). */
function currentOnly(text: string): string {
  return text.split(/(?<=[.;\n])/).filter(s => !/\b(19|20)\d{2}\b|\baged \d+|\byears? ago\b|\bhistory of\b|\bprevious(ly)?\b|\bprior\b|\bin the past\b|\bas a child\b/i.test(s)).join(' ');
}

function measuredOrWrittenTemp(ctx: Ctx): number | null {
  if (ctx.v.temperatureC !== null) return ctx.v.temperatureC;
  const m = ctx.HE.toLowerCase().match(/\b(?:t|temp(?:erature)?)\b\s*:?\s*(3[4-9](?:\.\d)?|4[0-2](?:\.\d)?)/)
    ?? ctx.HE.toLowerCase().match(/\b(3[4-9](?:\.\d)?|4[0-2](?:\.\d)?)\s*°\s*c\b/);
  return m ? parseFloat(m[1]) : null;
}

function alteredConsciousness(ctx: Ctx): boolean {
  return (ctx.v.avpu !== null && ctx.v.avpu !== 'A') || (ctx.gcs !== null && ctx.gcs < 15)
    || a(ctx.HE, /\b(confus\w*|disorientat\w*|drows\w*|obtunded|unresponsive|reduced (level of )?consciousness|rousable)\b/);
}

const REDIRECT_ACTION: EmergencyAction = { kind: 'redirect', text: EMERGENCY_REDIRECT };

// Short, reusable action texts.
const ACT = {
  ecg: (why: string): EmergencyAction => ({ kind: 'investigation', text: `12-lead ECG — ${why}` }),
  inv: (text: string): EmergencyAction => ({ kind: 'investigation', text }),
  act: (text: string): EmergencyAction => ({ kind: 'action', text }),
};

const BNFC = 'weight-based dose — calculate per BNFc';

type Rule = (ctx: Ctx) => RecognisedEmergency | null;

const RULES: Rule[] = [
  // ── Acute coronary syndrome (ESC 2023 ACS guideline) ─────────────────────────────────────
  (ctx) => {
    const chest = a(ctx.H, RX.chestPain);
    const reasons: string[] = [];
    const typicalFeature = a(ctx.H, RX.cardiacRadiation) || a(ctx.H, RX.cardiacCharacter) || a(ctx.HE, RX.sweating);
    const riskGroup = (ctx.age ?? 0) >= 40 || a(ctx.PMH, /\bdiabet\w*/) || ctx.female;
    const equivalent = a(ctx.H, RX.jawArmAche) && (a(ctx.H, RX.breathless) || a(ctx.HE, RX.sweating) || a(ctx.H, RX.nausea) || a(ctx.H, /\b(tired\w*|fatigue)\b/)) && riskGroup;
    const epigastricEquivalent = a(ctx.H, RX.epigastric) && a(ctx.HE, RX.sweating) && ((ctx.age ?? 0) >= 50 || a(ctx.PMH, /\b(diabet\w*|ischaemic heart|angina|coronary|myocardial|\bmi\b|stent)\b/));
    const ste = a(ctx.R + '\n' + ctx.E, RX.stElevation);
    const std = a(ctx.R + '\n' + ctx.E, RX.stDepression);
    const tn = (ctx.labs.troponin !== null && ctx.labs.troponin >= 52) || ctx.labs.troponinRaisedText;
    const dx = a(ctx.D, /\b(acute coronary syndrome|\bacs\b|myocardial infarction|\bstemi\b|\bnstemi\b|unstable angina|coronary (artery )?dissection|\bscad\b)\b/);
    if (chest && typicalFeature) reasons.push('chest pain with cardiac features (radiation, pressure/tightness or sweating)');
    if (equivalent) reasons.push('anginal equivalent (jaw/arm ache with breathlessness, sweating, nausea or fatigue)');
    if (epigastricEquivalent) reasons.push('epigastric pain with sweating in a high-risk patient');
    if (ste) reasons.push('ST elevation / STEMI on ECG');
    if (std && (chest || equivalent)) reasons.push('ischaemic ST/T change on ECG');
    if (tn) reasons.push(`troponin raised${ctx.labs.troponin !== null ? ` (${ctx.labs.troponin} ng/L)` : ''}`);
    if (dx) reasons.push('working diagnosis of acute coronary syndrome');
    const plainChest = chest && !reasons.length && !a(ctx.H, /\b(chest wall|reproducible|musculoskeletal|costochondr\w*|asthma\w*|wheez\w*)\b/) && !a(ctx.HE, /\breproduc\w* (on|by) palpation\b/);
    if (!reasons.length && !plainChest) return null;
    if (!reasons.length && plainChest) {
      return {
        id: 'chest_pain_ecg', title: 'Chest pain — exclude acute coronary syndrome', level: 'urgent', category: 'cardiac',
        reasons: ['chest pain'], redirect: false, guideline: 'ESC 2023 ACS §3 (ECG within 10 minutes of first contact)',
        actions: [ACT.ecg('within 10 minutes (ESC 2023)'), ACT.inv('High-sensitivity troponin (ESC 2023 0 h/1 h or 0 h/2 h algorithm)')],
      };
    }
    const aspirinContra = a(ctx.ALLERGY, /\b(aspirin|salicylate|nsaid)\b/) || a(ctx.H, /\b(haematemesis|melaena|active bleeding|vomiting blood)\b/);
    const actions: EmergencyAction[] = [
      REDIRECT_ACTION,
      ACT.ecg('within 10 minutes of first contact (ESC 2023)'),
      ACT.inv('High-sensitivity troponin — ESC 2023 0 h/1 h (or 0 h/2 h) algorithm'),
    ];
    if (ctx.paed) actions.push(ACT.act('Paediatric chest pain — senior paediatric assessment; no adult antiplatelet dosing'));
    else if (aspirinContra) actions.push(ACT.act('Aspirin loading dose NOT suggested: aspirin/NSAID allergy or active bleeding recorded — discuss antiplatelet therapy with cardiology'));
    else actions.push(ACT.act('Suggest aspirin loading dose 150–300 mg orally (ESC 2023) unless allergic, actively bleeding or otherwise contraindicated — clinician decision'));
    actions.push(ACT.act('ST elevation / STEMI: immediate reperfusion — primary PCI pathway via cardiology (fibrinolysis if PCI cannot be delivered in time; ESC 2023)'));
    actions.push(ACT.act('Oxygen only if SpO₂ < 90% (ESC 2023); IV access; continuous ECG monitoring during transfer'));
    return {
      id: 'acs', title: 'Suspected acute coronary syndrome', level: 'emergency', category: 'cardiac', reasons, redirect: true,
      guideline: 'ESC 2023 ACS guideline §3–5', actions,
    };
  },

  // ── ECG emergencies other than ACS (ESC 2021 pacing; ESC 2022 ventricular arrhythmias) ─
  (ctx) => {
    const text = ctx.R + '\n' + ctx.E;
    const reasons: string[] = [];
    if (a(text, RX.heartBlock)) reasons.push('complete heart block on ECG');
    if (a(text, RX.vt)) reasons.push('ventricular arrhythmia on ECG');
    if (!reasons.length) return null;
    return {
      id: 'ecg_arrhythmia', title: 'Life-threatening arrhythmia on ECG', level: 'emergency', category: 'cardiac', reasons, redirect: true,
      guideline: 'ESC 2021 cardiac pacing; ESC 2022 ventricular arrhythmias',
      actions: [REDIRECT_ACTION, ACT.act('Continuous ECG monitoring, defibrillator/pacing available; resuscitation team (RCUK 2021 ALS)')],
    };
  },

  // ── Aortic dissection (ESC 2014 aortic diseases) ─────────────────────────────────────────
  (ctx) => {
    const dx = a(ctx.D, /\baortic dissection\b/) || ctx.icd.some(c => c.startsWith('I71.0'));
    const tearing = a(ctx.H, RX.dissection);
    if (!dx && !tearing) return null;
    return {
      id: 'aortic_dissection', title: 'Suspected acute aortic dissection', level: 'emergency', category: 'vascular',
      reasons: [dx ? 'working diagnosis of aortic dissection' : 'tearing / ripping chest or back pain'], redirect: true,
      guideline: 'ESC 2014 aortic diseases guideline',
      actions: [REDIRECT_ACTION, ACT.inv('CT angiography of the aorta'), ACT.act('BP in both arms; do not give antiplatelet or thrombolytic therapy until dissection is excluded')],
    };
  },

  // ── Symptomatic / ruptured AAA (ESVS 2024) ───────────────────────────────────────────────
  (ctx) => {
    const code = ctx.icd.find(c => /^I71\.[13589]/.test(c) || c.startsWith('I71.4') || c === 'I71');
    const aaaText = a(ctx.HERD + '\n' + ctx.PMH, RX.aaa);
    const pain = a(ctx.H, RX.aaaPain) || (ctx.v.systolicBp !== null && ctx.v.systolicBp < 90);
    if (!((code || aaaText) && (pain || (code && /^I71\.[1358]/.test(code))))) return null;
    const reasons = [code ? `diagnosis code ${code}` : 'aortic aneurysm / pulsatile mass', pain ? 'with pain, collapse or hypotension' : 'ruptured'];
    return {
      id: 'aaa', title: 'Symptomatic or ruptured abdominal aortic aneurysm', level: 'emergency', category: 'vascular', reasons, redirect: true,
      guideline: 'ESVS 2024 abdominal aorto-iliac aneurysm guideline',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Immediate vascular surgery referral — emergency repair pathway (ESVS 2024)'),
        ACT.act('Permissive hypotension: avoid large fluid boluses while the patient is conscious; blood products via the major haemorrhage pathway (ESVS 2024)'),
        ACT.inv('Bedside ultrasound of the aorta; CT angiography of the aorta only if haemodynamically stable'),
      ],
    };
  },

  // ── Pulmonary embolism (ESC 2019 PE) ─────────────────────────────────────────────────────
  (ctx) => {
    const dx = ctx.icd.some(c => c.startsWith('I26')) || a(ctx.D, /\bpulmonary embol\w*/);
    const suspected = dx || (a(ctx.H, RX.pe) && !a(ctx.H, /\bpe(rc)?\b[^.;\n]{0,10}\bnegative\b/))
      || (a(ctx.H, RX.pleuritic) && (a(ctx.H, RX.breathless) || a(ctx.H, RX.haemoptysis)) && (a(ctx.HE, RX.dvtSigns) || ctx.isPostOp || ctx.preg.pregnant || ctx.preg.postpartumWeeks !== null || a(ctx.PMH + ctx.MEDS + ctx.H, /\b(oral contracepti\w*|\bocp\b|combined pill|long[- ]haul|flight|immobil\w*|previous (dvt|pe|vte)|cancer)\b/)));
    if (!suspected) return null;
    const unstable = (ctx.v.systolicBp !== null && ctx.v.systolicBp < 90) || (ctx.v.spo2 !== null && ctx.v.spo2 < 90);
    if (!unstable && !dx) {
      return {
        id: 'pe_suspected', title: 'Possible pulmonary embolism', level: 'urgent', category: 'respiratory',
        reasons: ['pleuritic pain / breathlessness with VTE risk factors'], redirect: false, guideline: 'ESC 2019 PE guideline',
        actions: [ACT.inv('Wells score; D-dimer (if PE unlikely) or CT pulmonary angiography (V/Q scan may be preferred in pregnancy)'), ACT.ecg('right heart strain, alternative diagnosis')],
      };
    }
    return {
      id: 'pe', title: unstable ? 'Pulmonary embolism with shock or hypoxia (high risk)' : 'Pulmonary embolism', level: unstable ? 'emergency' : 'urgent',
      category: 'respiratory', reasons: [dx ? 'working diagnosis of pulmonary embolism' : 'suspected pulmonary embolism', ...(unstable ? ['SBP < 90 mmHg or SpO₂ < 90%'] : [])],
      redirect: unstable, guideline: 'ESC 2019 PE guideline §5–6',
      actions: [
        ...(unstable ? [REDIRECT_ACTION] : []),
        ACT.inv('CT pulmonary angiography (bedside echocardiography if too unstable to move)'),
        ACT.act('Cautious fluids only — volume loading can worsen right ventricular failure (ESC 2019); no routine fluid bolus'),
        ...(ctx.preg.pregnant ? [ACT.act('Pregnancy: LMWH — DOACs and warfarin are not used in pregnancy (RCOG GTG 37b)')] : []),
      ],
    };
  },

  // ── Stroke and TIA (NICE NG128) ──────────────────────────────────────────────────────────
  (ctx) => {
    const face = a(ctx.HE, RX.face);
    const arm = a(ctx.HE, RX.arm);
    const speech = a(ctx.HE, RX.speech);
    const dxStroke = ctx.icd.some(c => /^I6[0134]/.test(c)) || a(ctx.D, /\b(stroke|cerebral infarct\w*|intracerebral ha?emorrhage|cerebrovascular accident|\bcva\b)\b/);
    const dxTia = ctx.icd.some(c => c.startsWith('G45')) || a(ctx.D, /\b(transient ischa?emic attack|\btia\b)\b/);
    const fast = [face && 'facial weakness', arm && 'unilateral arm/leg weakness', speech && 'speech disturbance'].filter(Boolean) as string[];
    if (!fast.length && !dxStroke && !dxTia) return null;
    if (ctx.icd.some(c => c.startsWith('I60')) && !fast.length) return null; // SAH handled below
    // A cold, pale, pulseless weak limb without face/speech signs is limb ischaemia, not stroke.
    if (!face && !speech && !dxStroke && !dxTia && a(ctx.HE, RX.limbIschaemia)) return null;
    const resolved = dxTia || (a(ctx.H, RX.transient) && !a(ctx.E, /\b(droop|drift|weak\w*|dysarthri\w*|dysphasi\w*|hemipar\w*)\b/));
    const glucoseLow = (ctx.labs.glucose ?? ctx.v.glucoseMmol ?? 99) < 4;
    if (resolved && !dxStroke) {
      return {
        id: 'tia', title: 'Suspected transient ischaemic attack', level: 'urgent', category: 'neurological',
        reasons: [dxTia ? 'working diagnosis of TIA' : `transient ${fast.join(', ') || 'neurological symptoms'}`], redirect: false,
        guideline: 'NICE NG128 (2019, updated 2022) §1.1.2–1.1.3',
        actions: [
          ACT.act('Aspirin 300 mg immediately unless contraindicated (bleeding disorder, anticoagulant, aspirin allergy) — NICE NG128'),
          ACT.act('Specialist stroke assessment within 24 hours of symptom onset (NICE NG128); do not use ABCD2 or other risk scores to decide urgency'),
          ACT.act('If symptoms recur or persist: treat as acute stroke — ' + EMERGENCY_REDIRECT),
        ],
      };
    }
    return {
      id: 'stroke', title: 'Suspected acute stroke (FAST positive)', level: 'emergency', category: 'neurological',
      reasons: fast.length ? fast : ['working diagnosis of stroke'], redirect: true,
      guideline: 'NICE NG128 (2019, updated 2022)',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Record the time last known well; check glucose first — then the stroke team decides on thrombolysis / thrombectomy (time of onset, CT and any anticoagulant use decide eligibility)'),
        ACT.inv(`Capillary glucose now — exclude hypoglycaemia as a stroke mimic${glucoseLow ? ' (glucose recorded below 4 mmol/L: treat hypoglycaemia first)' : ''}`),
        ACT.inv('Non-contrast CT head immediately (with CT angiography if thrombectomy may be indicated) — NICE NG128'),
        ACT.act('Nil by mouth until swallow screened; do not give aspirin until intracranial haemorrhage is excluded on imaging'),
        ...(a(ctx.MEDS, /\b(apixaban|rivaroxaban|edoxaban|dabigatran|warfarin)\b/) ? [ACT.act('Anticoagulant recorded: time of last dose affects thrombolysis eligibility — tell the stroke team')] : []),
      ],
    };
  },

  // ── Thunderclap headache / subarachnoid haemorrhage (NICE NG228, 2022) ───────────────────
  (ctx) => {
    const thunder = a(ctx.H, RX.thunderclap);
    const dx = ctx.icd.some(c => c.startsWith('I60')) || a(ctx.D, /\b(subarachnoid ha?emorrhage|\bsah\b|thunderclap)\b/);
    if (!thunder && !dx) return null;
    return {
      id: 'sah', title: 'Thunderclap headache — suspected subarachnoid haemorrhage', level: 'emergency', category: 'neurological',
      reasons: [thunder ? 'sudden severe (thunderclap / worst-ever) headache' : 'working diagnosis of subarachnoid haemorrhage'], redirect: true,
      guideline: 'NICE NG228 (2022) subarachnoid haemorrhage',
      actions: [
        REDIRECT_ACTION,
        ACT.inv('Non-contrast CT head as soon as possible (NICE NG228); if normal and > 6 h after onset, lumbar puncture at least 12 h after onset'),
        ACT.act('Neurosurgical referral if SAH is confirmed (NICE NG228)'),
      ],
    };
  },

  // ── Meningitis / meningococcal disease (NICE NG240, 2024) ────────────────────────────────
  (ctx) => {
    const temp = measuredOrWrittenTemp(ctx);
    const fever = (temp !== null && temp >= 38) || textFever(ctx.H);
    const mening = a(ctx.HE, RX.meningism);
    const rash = a(ctx.HE, RX.nonBlanching) && !a(ctx.HE, /\b(palpable purpura|henoch|hsp\b|iga vasculitis)\b/);
    const dx = ctx.icd.some(c => /^(G0[0-3]|A39|A87)/.test(c)) || a(ctx.D, /\b(meningitis|meningococc\w*|encephalitis)\b/);
    const headache = a(ctx.H, RX.headache);
    const altered = alteredConsciousness(ctx);
    const hit = dx || (fever && (mening || rash)) || (rash && (altered || a(ctx.H, /\b(unwell|drows\w*|vomit\w*)\b/)) && fever) || (fever && headache && altered && mening);
    if (!hit) return null;
    const immuno = (ctx.age ?? 0) >= 60 || a(ctx.MEDS + '\n' + ctx.PMH, RX.immunosuppressant) || a(ctx.PMH, RX.immunoPmh) || a(ctx.MEDS, RX.steroid);
    const reasons = [dx ? 'working diagnosis of meningitis' : 'fever with meningism, non-blanching rash or altered consciousness'];
    const drugDose = ctx.paed ? ` (${BNFC})` : '';
    return {
      id: 'meningitis', title: 'Suspected bacterial meningitis / meningococcal disease', level: 'emergency', category: 'neurological',
      reasons, redirect: true, guideline: 'NICE NG240 (2024) bacterial meningitis and meningococcal disease',
      actions: [
        REDIRECT_ACTION,
        ACT.act(`IV ceftriaxone without delay${drugDose} — do not delay antibiotics for lumbar puncture or imaging (NICE NG240)`),
        ...(immuno && !ctx.paed ? [ACT.act('Age ≥ 60 or immunocompromised: add amoxicillin (Listeria cover) — NICE NG240')] : []),
        ACT.act(`Suspected meningococcal disease with transfer delay: IM/IV benzylpenicillin before transfer unless penicillin anaphylaxis${drugDose} (NICE NG240)`),
        ACT.inv('Blood cultures (before antibiotics only if this causes no delay); meningococcal PCR'),
      ],
    };
  },

  // ── Cauda equina syndrome (GIRFT national suspected CES pathway 2023) ────────────────────
  (ctx) => {
    const saddle = a(ctx.HE, RX.saddle);
    const tone = a(ctx.E, RX.analTone);
    const bladder = a(ctx.H, RX.retention);
    const back = a(ctx.H, RX.backPain) || a(ctx.PMH, /\b(disc|sciatica|back)\b/);
    const dx = ctx.icd.some(c => c.startsWith('G83.4')) || a(ctx.D, /\bcauda equina\b/);
    const hit = dx || saddle || tone || (bladder && back && a(ctx.H, /\b(bilateral|both legs|sciatica|leg pain|pain in both legs)\b/));
    if (!hit) return null;
    if (a(ctx.PMH + '\n' + ctx.H, RX.cancer) && a(ctx.H, /\b(thoracic|mid-back|band-like|sensory level)\b/) && !saddle && !tone) return null; // MSCC rule
    const reasons = [saddle && 'saddle / perianal numbness', tone && 'reduced anal tone', bladder && 'new bladder dysfunction', dx && 'working diagnosis of cauda equina syndrome'].filter(Boolean) as string[];
    return {
      id: 'cauda_equina', title: 'Suspected cauda equina syndrome', level: 'emergency', category: 'neurological', reasons, redirect: true,
      guideline: 'GIRFT national suspected cauda equina syndrome pathway (2023)',
      actions: [
        REDIRECT_ACTION,
        ACT.inv('Emergency MRI lumbosacral spine (GIRFT 2023 pathway)'),
        ACT.act('Immediate referral to the on-call spinal surgical team for decompression'),
        ACT.act('Bladder scan (post-void residual); catheterise if in retention'),
      ],
    };
  },

  // ── Metastatic spinal cord compression (NICE NG234, 2023) ────────────────────────────────
  (ctx) => {
    const cancer = a(ctx.PMH + '\n' + ctx.H + '\n' + ctx.D, RX.cancer);
    const spinal = a(ctx.H, RX.spinalPain) || a(ctx.E, /\btender\w*\b[^.;\n]{0,25}\b(spin\w*|vertebra\w*|t\d{1,2}|l\d)\b/);
    const neuro = a(ctx.HE, RX.neuroDeficit);
    const dx = ctx.icd.some(c => c.startsWith('G95.2')) || a(ctx.D, /\b(spinal cord compression|\bmscc\b|cord compression)\b/);
    if (!(dx || (cancer && spinal))) return null;
    if (dx || neuro) {
      return {
        id: 'mscc', title: 'Suspected metastatic spinal cord compression', level: 'emergency', category: 'neurological',
        reasons: [dx ? 'working diagnosis of spinal cord compression' : 'known cancer with spinal pain and neurological symptoms'], redirect: true,
        guideline: 'NICE NG234 (2023) spinal metastases and MSCC',
        actions: [
          REDIRECT_ACTION,
          ACT.inv('MRI whole spine urgently — within 24 hours with neurological symptoms or signs (NICE NG234)'),
          ACT.act(`Dexamethasone (NICE NG234) unless contraindicated${ctx.paed ? ` — ${BNFC}` : ''}`),
          ACT.act('Contact the acute oncology / MSCC coordinator and spinal surgery now; keep the spine neutral if mechanical instability is suspected'),
        ],
      };
    }
    const suggestive = a(ctx.H, /\b(thoracic|night pain|worse at night|waking|cough\w*|strain\w*|progressive|band-like|mid-back)\b/);
    if (!suggestive) return null;
    return {
      id: 'spinal_metastases', title: 'Spinal pain suggestive of metastases (no neurological deficit)', level: 'priority', category: 'neurological',
      reasons: ['known cancer with spinal pain (night / thoracic / progressive)'], redirect: false, guideline: 'NICE NG234 (2023)',
      actions: [
        ACT.inv('MRI whole spine within 1 week (NICE NG234)'),
        ACT.act('MSCC safety-net: seek help immediately (911) for new leg weakness, numbness, unsteadiness or bladder or bowel change'),
      ],
    };
  },

  // ── Sepsis, including sepsis WITHOUT fever (NICE NG51, 2016 updated 2024; RCP NEWS2) ──────
  (ctx) => {
    const temp = measuredOrWrittenTemp(ctx);
    // "Bilateral leg cellulitis" without fever is usually venous stasis / heart failure, not
    // infection (NICE CKS cellulitis): it alone does not make the physiology "sepsis".
    const bilateralCellulitisOnly = a(ctx.H, /\b(bilateral|both)\b[^.;\n]{0,25}\bcellulitis\b/)
      && !(temp !== null && temp >= 38) && !textFever(ctx.H)
      && !a(ctx.HERD.replace(/cellulitis/gi, ''), RX.infection);
    const infection = !bilateralCellulitisOnly && (a(ctx.HERD, RX.infection) || (temp !== null && (temp >= 38 || temp < 36)) || textFever(ctx.H)
      || (ctx.labs.wbc !== null && (ctx.labs.wbc > 12 || ctx.labs.wbc < 4)));
    const neutropenic = (a(ctx.PMH + '\n' + ctx.MEDS + '\n' + ctx.H, RX.chemo) || (ctx.labs.neutrophils !== null && ctx.labs.neutrophils <= 0.5))
      && ((temp !== null && temp >= 38) || textFever(ctx.H) || a(ctx.H, /\b(unwell|rigors?|shiver\w*)\b/));
    const asplenic = a(ctx.PSH + '\n' + ctx.PMH + '\n' + ctx.H, RX.asplenia) && ((temp !== null && temp >= 38) || textFever(ctx.H));
    if (!infection && !neutropenic && !asplenic) return null;
    const high: string[] = [];
    const moderate: string[] = [];
    const v = ctx.v;
    if (ctx.paed && ctx.limits) {
      const L = ctx.limits;
      if (v.heartRate !== null && v.heartRate >= L.hrHigh) high.push(`HR ${v.heartRate} (≥ ${L.hrHigh} for ${L.band})`);
      if (v.respiratoryRate !== null && v.respiratoryRate >= L.rrHigh) high.push(`RR ${v.respiratoryRate} (≥ ${L.rrHigh} for ${L.band})`);
      if (v.spo2 !== null && v.spo2 < L.spo2Low) high.push(`SpO₂ ${v.spo2}%`);
      if (v.systolicBp !== null && v.systolicBp < L.sbpLow) high.push(`SBP ${v.systolicBp} (< ${L.sbpLow} for age)`);
      if (a(ctx.HE, RX.ng143Red)) high.push('NICE NG143 / NG51 red feature (mottled, ashen, weak cry, non-blanching rash…)');
    } else {
      if (ctx.news2 && ctx.news2.total >= 7) high.push(`NEWS2 ${ctx.news2.total}`);
      else if (ctx.news2 && ctx.news2.total >= 5) moderate.push(`NEWS2 ${ctx.news2.total}`);
      if (v.respiratoryRate !== null && v.respiratoryRate >= 25) high.push(`RR ${v.respiratoryRate}`);
      if (v.systolicBp !== null && v.systolicBp <= 90) high.push(`SBP ${v.systolicBp}`);
      if (v.heartRate !== null && v.heartRate > 130) high.push(`HR ${v.heartRate}`);
      if (v.spo2 !== null && v.spo2 < 92) high.push(`SpO₂ ${v.spo2}%`);
    }
    if (alteredConsciousness(ctx)) high.push('new altered mental state');
    if (ctx.labs.lactate !== null && ctx.labs.lactate >= 4) high.push(`lactate ${ctx.labs.lactate}`);
    else if (ctx.labs.lactate !== null && ctx.labs.lactate >= 2) moderate.push(`lactate ${ctx.labs.lactate}`);
    if (a(ctx.HE, RX.nonBlanching) && !a(ctx.HE, /\bpalpable purpura\b/)) high.push('non-blanching rash');
    if (a(ctx.HE, /\b(mottled|ashen|cyanos\w*)\b/)) high.push('mottled / ashen skin');
    const special = neutropenic ? 'neutropenic sepsis (chemotherapy / neutrophils ≤ 0.5)' : asplenic ? 'fever in an asplenic patient (overwhelming post-splenectomy infection risk)' : null;
    if (!high.length && !moderate.length && !special) return null;
    const level: EmergencyLevel = high.length || special ? 'emergency' : 'urgent';
    const afebrile = temp !== null && temp < 38 && !textFever(ctx.H);
    const reasons = [...(special ? [special] : []), ...high, ...moderate, ...(afebrile ? ['afebrile — sepsis can present without fever'] : [])];
    const dose = ctx.paed ? ` (${BNFC})` : '';
    return {
      id: 'sepsis', title: special ? `Suspected sepsis — ${special.split(' (')[0]}` : `Suspected sepsis${afebrile ? ' without fever' : ''} (${level === 'emergency' ? 'high' : 'moderate to high'} risk)`,
      level, category: 'sepsis', reasons, redirect: level === 'emergency',
      guideline: `NICE NG51 (2016, updated 2024)${neutropenic ? '; NICE CG151 neutropenic sepsis' : ''}${asplenic ? '; BCSH 2011 / UKHSA Green Book ch. 7 asplenia' : ''}`,
      actions: [
        ...(level === 'emergency' ? [REDIRECT_ACTION] : []),
        ACT.inv('Blood cultures, lactate, FBC, U&E, CRP; find the source (urine, chest X-ray, wound, abdomen)'),
        a(ctx.HERD, /\bpancreatitis\b/)
          ? ACT.act('Acute pancreatitis: no prophylactic antibiotics without documented infection — SIRS alone is not sepsis (ACG 2024; IAP/APA 2013); treat a proven infective source per NICE NG51')
          : ACT.act(`IV broad-spectrum antibiotics within 1 hour for high risk when infection is the likely cause (NICE NG51)${neutropenic ? ' — piperacillin with tazobactam as initial empirical therapy (NICE CG151)' : ''}${dose}`),
        ACT.act(ctx.paed ? 'IV fluid bolus only by paediatric weight-based protocol (NICE NG51)' : 'IV fluid resuscitation per NICE NG51 unless heart failure or pulmonary oedema is recorded; senior review'),
        ...(a(ctx.MEDS, RX.steroid) ? [ACT.act('Long-term steroids: fever and peritonism can be masked; give steroid cover (hydrocortisone) per the Society for Endocrinology adrenal crisis guidance')] : []),
      ],
    };
  },

  // ── Atrial fibrillation: new / unstable (ESC 2024 AF) ────────────────────────────────────
  (ctx) => {
    const af = a(ctx.H + '\n' + ctx.E + '\n' + ctx.R + '\n' + ctx.D, RX.af) || ctx.icd.some(c => c.startsWith('I48'));
    if (!af) return null;
    const hr = ctx.v.heartRate;
    const instability: string[] = [];
    if (ctx.v.systolicBp !== null && ctx.v.systolicBp < 90) instability.push(`SBP ${ctx.v.systolicBp}`);
    if (a(ctx.H, RX.chestPain)) instability.push('chest pain');
    if (a(ctx.H, RX.syncope)) instability.push('syncope');
    if (a(ctx.HE, RX.hfSigns)) instability.push('heart failure signs');
    if (alteredConsciousness(ctx)) instability.push('altered consciousness');
    const fast = hr !== null && hr > 110;
    if (fast && instability.length) {
      return {
        id: 'af_unstable', title: 'Atrial fibrillation with haemodynamic instability', level: 'emergency', category: 'cardiac',
        reasons: [`AF, HR ${hr}`, ...instability], redirect: true, guideline: 'ESC 2024 AF guideline (AF-CARE)',
        actions: [
          REDIRECT_ACTION, ACT.ecg('confirm rhythm'),
          ACT.act('Emergency synchronised DC cardioversion for haemodynamically unstable AF (ESC 2024) — resuscitation team'),
        ],
      };
    }
    if (!fast) return null;
    return {
      id: 'af_rapid', title: 'Atrial fibrillation with rapid ventricular response', level: 'urgent', category: 'cardiac',
      reasons: [`AF, HR ${hr}`], redirect: false, guideline: 'ESC 2024 AF guideline (AF-CARE)',
      actions: [
        ACT.ecg('confirm AF and rate'),
        ACT.inv('TFTs, U&E, magnesium; echocardiogram'),
        ACT.act('Rate control and thromboembolic risk (CHA₂DS₂-VA) with anticoagulation decision (ESC 2024) — same-day medical review'),
      ],
    };
  },

  // ── Anaphylaxis (Resuscitation Council UK 2021) ──────────────────────────────────────────
  (ctx) => {
    // A past reaction ("anaphylaxis to penicillin in 2015", "aged 19") is an allergy, not an emergency.
    const now = currentOnly(ctx.HE);
    const skin = a(now, RX.anaphylaxisSkin);
    const abc = a(now, RX.anaphylaxisABC) || (ctx.v.systolicBp !== null && ctx.v.systolicBp < (ctx.limits?.sbpLow ?? 90)) || (ctx.v.spo2 !== null && ctx.v.spo2 < 94);
    const dx = ctx.icd.some(c => /^(T78\.0|T78\.2|T88\.6|T80\.5)/.test(c));
    const currentWord = a(now, /\b(now|minutes? ago|this morning|just|after (eating|taking|the first))\b/) && a(now, RX.anaphylaxisWord);
    if (!((skin && abc) || dx || (currentWord && abc))) return null;
    const age = ctx.age ?? 30;
    const dose = age > 12 ? '500 micrograms (0.5 mL of 1 mg/mL)' : age >= 6 ? '300 micrograms (0.3 mL of 1 mg/mL)' : age >= 0.5 ? '150 micrograms (0.15 mL of 1 mg/mL)' : '100–150 micrograms (0.1–0.15 mL of 1 mg/mL)';
    const band = age > 12 ? 'adult / child > 12 years' : age >= 6 ? 'child 6–12 years' : age >= 0.5 ? 'child 6 months–6 years' : 'infant < 6 months';
    return {
      id: 'anaphylaxis', title: 'Anaphylaxis', level: 'emergency', category: 'allergy',
      reasons: [dx ? 'working diagnosis of anaphylaxis' : 'acute skin/mucosal features with airway, breathing or circulation compromise'], redirect: true,
      guideline: 'Resuscitation Council UK 2021 emergency treatment of anaphylaxis',
      actions: [
        REDIRECT_ACTION,
        ACT.act(`IM adrenaline ${dose} into the anterolateral thigh — ${band} (RCUK 2021); repeat after 5 minutes if no improvement`),
        ACT.act('Remove the trigger; lie flat with legs raised (sit up if breathing is difficult); high-flow oxygen'),
        ACT.act(ctx.paed ? 'IV fluid bolus 10 mL/kg crystalloid if shocked (RCUK 2021)' : 'IV fluid bolus 500–1000 mL crystalloid if shocked (RCUK 2021)'),
        ACT.act('Record the allergy; do not re-expose; refer to allergy clinic and issue adrenaline auto-injector training on discharge (RCUK 2021)'),
      ],
    };
  },

  // ── Hypertensive emergency; pregnancy / postpartum severe hypertension (ESH 2023, NICE NG136, NICE NG133) ─
  (ctx) => {
    const sbp = ctx.v.systolicBp;
    const dbp = ctx.v.diastolicBp;
    if (sbp === null && dbp === null) return null;
    const obstetric = ctx.preg.pregnant || (ctx.preg.postpartumWeeks !== null && ctx.preg.postpartumWeeks <= 6);
    const bp = `${sbp ?? '?'}/${dbp ?? '?'} mmHg`;
    if (obstetric) {
      const severe = (sbp !== null && sbp >= 160) || (dbp !== null && dbp >= 110);
      const htn = (sbp !== null && sbp >= 140) || (dbp !== null && dbp >= 90);
      const features: string[] = [];
      if (a(ctx.HE, RX.preEclampsiaSx)) features.push('headache, visual disturbance, epigastric/RUQ pain, clonus or oedema');
      if (ctx.labs.urineProtein !== null && ctx.labs.urineProtein >= 1) features.push(`proteinuria (${ctx.labs.urineProtein}+)`);
      if (ctx.labs.platelets !== null && ctx.labs.platelets < 150) features.push(`platelets ${ctx.labs.platelets}`);
      if ((ctx.labs.alt ?? 0) > 70 || (ctx.labs.ast ?? 0) > 70) features.push('transaminases > 70 IU/L');
      const seizure = a(ctx.H, RX.seizure);
      if (!(severe || (htn && features.length) || seizure && htn)) return null;
      const hellp = ctx.labs.platelets !== null && ctx.labs.platelets < 100 && ((ctx.labs.alt ?? 0) > 70 || (ctx.labs.ast ?? 0) > 70);
      return {
        id: 'pre_eclampsia',
        title: seizure ? 'Eclampsia / severe pre-eclampsia' : hellp ? 'Severe pre-eclampsia / HELLP syndrome' : severe ? 'Severe hypertension in pregnancy / postpartum — suspected pre-eclampsia' : 'Pre-eclampsia',
        level: 'emergency', category: 'obstetric',
        reasons: [`BP ${bp}${ctx.preg.pregnant ? ' in pregnancy' : ' within 6 weeks postpartum'}`, ...features, ...(seizure ? ['seizure'] : [])], redirect: true,
        guideline: 'NICE NG133 (2019, updated 2023) hypertension in pregnancy',
        actions: [
          REDIRECT_ACTION,
          ACT.act('Obstetric emergency: immediate transfer to a hospital with an obstetric unit; inform the obstetric / maternity team'),
          ACT.act('Treat severe hypertension (≥ 160/110) with labetalol, nifedipine or hydralazine per NICE NG133 in a monitored setting'),
          ACT.act('IV magnesium sulfate for eclampsia or severe pre-eclampsia (NICE NG133, Collaborative Eclampsia Trial regimen)'),
          ACT.inv('FBC (platelets), LFTs (ALT/AST), creatinine, urine protein:creatinine ratio'),
          ...(ctx.preg.pregnant ? [ACT.inv('Fetal assessment: CTG / fetal heart monitoring')] : []),
          ACT.act('Do not attribute epigastric / RUQ pain to the gallbladder until pre-eclampsia / HELLP is excluded; no NSAIDs'),
        ],
      };
    }
    if (ctx.paed) return null;
    if (!((sbp !== null && sbp >= 180) || (dbp !== null && dbp >= 120))) return null;
    const organ: string[] = [];
    if (a(ctx.HE, RX.papilloedema)) organ.push('papilloedema / retinal haemorrhage');
    if (a(ctx.HE, /\b(encephalopath\w*|confus\w*|seizure\w*|drows\w*)\b/)) organ.push('encephalopathy');
    if (a(ctx.H, RX.chestPain)) organ.push('chest pain');
    if (a(ctx.HE, /\b(pulmonary o?edema|orthopn\w*|crackles)\b/)) organ.push('pulmonary oedema');
    if (a(ctx.HE, /\b(visual (disturbance|loss|blurring)|blurred vision)\b/)) organ.push('visual disturbance');
    if (a(ctx.HE, RX.face) || a(ctx.HE, RX.arm) || a(ctx.HE, RX.speech)) organ.push('focal neurology');
    if (ctx.labs.creatinine !== null && ctx.labs.creatinine > 200) organ.push(`creatinine ${ctx.labs.creatinine}`);
    if (organ.length) {
      return {
        id: 'hypertensive_emergency', title: 'Hypertensive emergency (acute organ damage)', level: 'emergency', category: 'cardiac',
        reasons: [`BP ${bp}`, ...organ], redirect: true, guideline: 'ESH 2023 hypertension guideline (hypertensive emergencies); NICE NG136 (2019, updated 2023)',
        actions: [
          REDIRECT_ACTION,
          ACT.act('Hypertensive emergency: controlled reduction with an IV agent (e.g. labetalol, nicardipine or GTN infusion, chosen by the organ involved) in a monitored HDU / critical care setting — lower mean arterial pressure by 20–25% over the first hours (ESH 2023); not rapid oral reduction in clinic'),
          ACT.inv('Fundoscopy, ECG, troponin, U&E / creatinine, urine dipstick'),
          ACT.act('Defer any elective surgery'),
        ],
      };
    }
    return {
      id: 'severe_hypertension', title: 'Severe hypertension (≥ 180/120) without recorded acute organ damage', level: 'priority', category: 'cardiac',
      reasons: [`BP ${bp}`], redirect: false, guideline: 'NICE NG136 (2019, updated 2023) §1.5',
      actions: [
        ACT.inv('Investigate for target organ damage as soon as possible: fundoscopy, ECG, U&E, urine albumin:creatinine ratio (NICE NG136)'),
        ACT.act('Same-day specialist referral if papilloedema, retinal haemorrhage, new confusion, chest pain, heart failure or AKI (NICE NG136); defer elective surgery'),
      ],
    };
  },

  // ── DKA (incl. euglycaemic), HHS, hypoglycaemia (JBDS 2023 DKA; JBDS 2022 HHS; JBDS 2021 hypoglycaemia) ─
  (ctx) => {
    const L = ctx.labs;
    const glucose = L.glucose ?? ctx.v.glucoseMmol;
    const diabetic = a(ctx.PMH + '\n' + ctx.H + '\n' + ctx.MEDS, /\b(diabet\w*|insulin|metformin|gliclazide|\w*gliflozin|\w*gliptin|glargine|lispro|aspart|degludec|detemir)\b/)
      || a(ctx.H, /\b(polyuria|polydipsia|drinking a lot|passing a lot of urine|thirst\w*)\b/);
    const sglt2 = a(ctx.MEDS, RX.sglt2);
    const acidosis = (L.ph !== null && L.ph < 7.3) || (L.bicarbonate !== null && L.bicarbonate < 15);
    const ketotic = L.ketones !== null && L.ketones >= 3;
    const dkaDx = ctx.icd.some(c => /^E1[0-4]\.1/.test(c)) || a(ctx.D, RX.dkaWords);
    const hhsDx = ctx.icd.some(c => /^E1[0-3]\.0/.test(c)) || a(ctx.D, RX.hhsWords);
    const dose = ctx.paed ? ` (${BNFC})` : '';
    if ((ketotic && (acidosis || L.ph === null && L.bicarbonate === null) && (diabetic || (glucose ?? 0) > 11)) || dkaDx) {
      const eu = glucose !== null && glucose < 14;
      return {
        id: 'dka', title: eu ? 'Diabetic ketoacidosis — euglycaemic (glucose < 14 mmol/L)' : 'Diabetic ketoacidosis', level: 'emergency', category: 'metabolic',
        reasons: [ketotic ? `ketones ${L.ketones} mmol/L` : 'working diagnosis of DKA', ...(L.ph !== null ? [`pH ${L.ph}`] : []), ...(L.bicarbonate !== null ? [`bicarbonate ${L.bicarbonate}`] : []), ...(glucose !== null ? [`glucose ${glucose}`] : []), ...(sglt2 ? ['on an SGLT2 inhibitor'] : [])],
        redirect: true, guideline: ctx.paed ? 'BSPED 2021 paediatric DKA guideline; ISPAD 2022' : 'JBDS-IP 2023 DKA guideline; MHRA 2020 SGLT2 inhibitor advice',
        actions: [
          REDIRECT_ACTION,
          ...(ctx.paed
            ? [
                ACT.act('Paediatric DKA protocol (BSPED 2021): weight-based fluids, insulin infusion started after fluids with no bolus, potassium replacement — calculate per BNFc / BSPED'),
                ACT.act('Hourly neurological observations for cerebral oedema (headache, falling GCS, bradycardia) — paediatric team / HDU'),
              ]
            : [
                ACT.act('IV 0.9% sodium chloride fluid resuscitation (JBDS 2023)'),
                ACT.act('Fixed-rate IV insulin infusion 0.1 units/kg/h (JBDS 2023); continue long-acting basal insulin'),
                ACT.act('Potassium replacement in the IV fluids guided by hourly/2-hourly K⁺ (JBDS 2023)'),
                ACT.act('Add 10% glucose when blood glucose falls below 14 mmol/L — and from the start in euglycaemic DKA (JBDS 2023)'),
              ]),
          ACT.inv('Hourly capillary ketones and glucose; venous blood gas (pH, bicarbonate, potassium)'),
          ...(sglt2 ? [ACT.act('Stop the SGLT2 inhibitor now and do not restart until recovered (MHRA 2020; JBDS 2023)')] : []),
          ...(ctx.preg.pregnant ? [ACT.act('Pregnancy: joint obstetric and medical care; fetal monitoring (CTG)')] : []),
          ACT.act('Abdominal pain may be caused by DKA — re-examine as the acidosis corrects before any operation'),
        ],
      };
    }
    if ((glucose !== null && glucose >= 30 && L.osmolality !== null && L.osmolality >= 320 && !(ketotic && acidosis)) || hhsDx) {
      return {
        id: 'hhs', title: 'Hyperosmolar hyperglycaemic state', level: 'emergency', category: 'metabolic',
        reasons: [hhsDx ? 'working diagnosis of HHS' : `glucose ${glucose}, osmolality ${L.osmolality}`], redirect: true,
        guideline: 'JBDS-IP 2022 HHS guideline',
        actions: [
          REDIRECT_ACTION,
          ACT.act('IV 0.9% sodium chloride first — fluid replacement alone lowers glucose (JBDS 2022)'),
          ACT.inv('Measure / calculate serum osmolality hourly at first; aim for a gradual fall (JBDS 2022)'),
          ACT.act('Insulin only once glucose stops falling with fluids alone, or at the start if significant ketonaemia (β-hydroxybutyrate > 1 mmol/L): fixed-rate 0.05 units/kg/h (JBDS 2022) — not the DKA rate'),
          ACT.act('VTE prophylaxis and foot protection (JBDS 2022)'),
        ],
      };
    }
    if (sglt2 && !ketotic && a(ctx.H, /\b(vomit\w*|nause\w*|abdominal pain|tummy pain|malaise|breathless\w*|unwell)\b/)) {
      return {
        id: 'euglycaemic_dka_check', title: 'Possible euglycaemic DKA (SGLT2 inhibitor)', level: 'urgent', category: 'metabolic',
        reasons: ['on an SGLT2 inhibitor with vomiting, abdominal pain, malaise or breathlessness'], redirect: false,
        guideline: 'MHRA 2020 SGLT2 inhibitor DKA advice; JBDS-IP 2023',
        actions: [
          ACT.inv('Blood ketones and venous blood gas now — whatever the glucose (euglycaemic DKA)'),
          ACT.act('Withhold the SGLT2 inhibitor while acutely unwell (MHRA 2020)'),
        ],
      };
    }
    if (glucose !== null && glucose < 4) {
      const severe = glucose < 3 || alteredConsciousness(ctx) || a(ctx.HE, RX.speech) || a(ctx.HE, RX.face);
      const sulfonylurea = a(ctx.MEDS, /\b(gliclazide|glibenclamide|glimepiride|glipizide|tolbutamide)\b/);
      return {
        id: 'hypoglycaemia', title: 'Hypoglycaemia', level: severe ? 'emergency' : 'urgent', category: 'metabolic',
        reasons: [`glucose ${glucose} mmol/L`, ...(severe ? ['neuroglycopenic features or glucose < 3'] : [])], redirect: severe,
        guideline: 'JBDS-IP 2021 hypoglycaemia in adults (4th edn); BSPED for children',
        actions: [
          ...(severe ? [REDIRECT_ACTION] : []),
          ...(ctx.paed
            ? [ACT.act(`Treat hypoglycaemia now: oral fast-acting carbohydrate if able to swallow, otherwise IV glucose or IM glucagon — ${BNFC}`)]
            : [
                ACT.act('Able to swallow: 15–20 g quick-acting carbohydrate (e.g. glucose tablets or juice), recheck in 10–15 minutes (JBDS 2021)'),
                ACT.act('Unable to swallow / reduced consciousness: IV glucose 10% (150–200 mL over 15 minutes) or IM glucagon 1 mg (JBDS 2021)'),
              ]),
          ACT.inv('Recheck capillary glucose 10–15 minutes after treatment; then monitor regularly'),
          ...(sulfonylurea || a(ctx.PMH, /\b(ckd|chronic kidney|renal)\b/) ? [ACT.act('Sulfonylurea and/or renal impairment: prolonged and recurrent hypoglycaemia risk — admit for monitoring; review the drug (JBDS 2021)')] : []),
          ACT.act('Reassess any focal neurology after the glucose is corrected before treating as stroke'),
        ],
      };
    }
    return null;
  },

  // ── Critical electrolytes / labs (UKKA 2023 hyperkalaemia; SfE 2016 emergency guidance) ─
  (ctx) => {
    const K = ctx.labs.potassium;
    if (K === null || K < 6.0) return null;
    const ecg = a(ctx.E + '\n' + ctx.R, RX.kEcg);
    const level: EmergencyLevel = K >= 6.5 || ecg ? 'emergency' : 'urgent';
    return {
      id: 'hyperkalaemia', title: `Hyperkalaemia${K >= 6.5 ? ' — severe' : ''}${ecg ? ' with ECG changes' : ''}`, level, category: 'laboratory',
      reasons: [`K⁺ ${K} mmol/L`, ...(ecg ? ['ECG changes (peaked T / broad QRS)'] : [])], redirect: level === 'emergency',
      guideline: 'UK Kidney Association 2023 treatment of acute hyperkalaemia in adults',
      actions: [
        ...(level === 'emergency' ? [REDIRECT_ACTION] : []),
        ACT.ecg('hyperkalaemic changes; continuous cardiac monitoring'),
        ...(ctx.paed
          ? [ACT.act(`Hyperkalaemia treatment per paediatric protocol — ${BNFC}`)]
          : [
              ACT.act('If ECG changes: IV calcium gluconate 10% 30 mL (or calcium chloride 10% 10 mL) over 5–10 minutes (UKKA 2023)'),
              ACT.act('IV insulin–glucose: 10 units soluble insulin with 25 g glucose, then monitor glucose for hypoglycaemia (UKKA 2023)'),
            ]),
        ACT.act('Stop potassium-raising drugs (ACE inhibitor/ARB, spironolactone, trimethoprim, NSAIDs); treat the cause (AKI)'),
      ],
    };
  },
  (ctx) => {
    const Ca = ctx.labs.calcium;
    if (Ca === null) return null;
    if (Ca >= 3.0) {
      const symptomatic = alteredConsciousness(ctx) || a(ctx.H, /\b(vomit\w*|confus\w*|drows\w*)\b/);
      const level: EmergencyLevel = Ca >= 3.5 || symptomatic ? 'emergency' : 'urgent';
      return {
        id: 'hypercalcaemia', title: `Hypercalcaemia${Ca >= 3.5 ? ' — severe' : ''}`, level, category: 'laboratory',
        reasons: [`adjusted calcium ${Ca} mmol/L`, ...(symptomatic ? ['symptomatic (vomiting / confusion)'] : [])], redirect: level === 'emergency',
        guideline: 'Society for Endocrinology 2016 emergency guidance: acute hypercalcaemia',
        actions: [
          ...(level === 'emergency' ? [REDIRECT_ACTION] : []),
          ACT.act('IV 0.9% sodium chloride rehydration (Society for Endocrinology 2016)'),
          ACT.act('IV bisphosphonate (zoledronic acid or pamidronate) after rehydration, adjusted for renal function (Society for Endocrinology 2016)'),
          ACT.act('Stop thiazides, calcium and vitamin D supplements'),
          ACT.inv('PTH, phosphate, U&E; myeloma screen (serum protein electrophoresis, serum free light chains) if no cause'),
        ],
      };
    }
    const postThyroid = a(ctx.PSH + '\n' + ctx.H + '\n' + ctx.D, RX.thyroidSurgery);
    const tetany = a(ctx.HE, RX.tetany);
    if (Ca < 1.9 || (Ca < 2.1 && (postThyroid || tetany)) || (tetany && postThyroid)) {
      const level: EmergencyLevel = Ca < 1.9 || tetany ? 'emergency' : 'urgent';
      return {
        id: 'hypocalcaemia', title: 'Acute hypocalcaemia', level, category: 'laboratory',
        reasons: [`adjusted calcium ${Ca} mmol/L`, ...(tetany ? ['tetany / perioral or digital paraesthesia'] : []), ...(postThyroid ? ['after thyroid/parathyroid surgery'] : [])],
        redirect: level === 'emergency', guideline: 'Society for Endocrinology 2016 emergency guidance: acute hypocalcaemia',
        actions: [
          ...(level === 'emergency' ? [REDIRECT_ACTION] : []),
          ACT.act(ctx.paed ? `IV calcium gluconate — ${BNFC}` : 'Symptomatic or calcium < 1.9 mmol/L: IV calcium gluconate 10% (10–20 mL in 50–100 mL of 5% glucose over 10 minutes) with ECG monitoring (Society for Endocrinology 2016)'),
          ACT.inv('Magnesium, phosphate, PTH; ECG (QTc)'),
        ],
      };
    }
    return null;
  },
  (ctx) => {
    const Na = ctx.labs.sodium;
    if (Na === null) return null;
    const severeSx = a(ctx.H, RX.seizure) || alteredConsciousness(ctx) || a(ctx.H, /\b(vomit\w*)\b/) && Na < 125;
    if (Na < 125 || (Na < 130 && severeSx)) {
      const level: EmergencyLevel = severeSx || Na < 120 ? 'emergency' : 'urgent';
      return {
        id: 'hyponatraemia', title: `Hyponatraemia${Na < 125 ? ' — profound' : ''}${severeSx ? ' with severe symptoms' : ''}`, level, category: 'laboratory',
        reasons: [`Na⁺ ${Na} mmol/L`, ...(severeSx ? ['seizure, reduced consciousness or vomiting'] : [])], redirect: level === 'emergency',
        guideline: 'European clinical practice guideline on hyponatraemia 2014 (ESE/ESICM/ERA-EDTA)',
        actions: [
          ...(level === 'emergency' ? [REDIRECT_ACTION] : []),
          ...(severeSx && !ctx.paed ? [ACT.act('Severe symptoms (seizure, reduced consciousness): 150 mL 3% hypertonic saline over 20 minutes, check Na⁺, repeat up to twice aiming for a 5 mmol/L rise; limit the rise to 10 mmol/L in the first 24 h (European guideline 2014)')] : []),
          ACT.act('Assess volume status first: hypovolaemic → isotonic saline; euvolaemic (SIADH) → fluid restriction; stop thiazides and other causative drugs'),
          ACT.act('Stop hypotonic IV fluids (e.g. 5% glucose, 0.18% saline) — NICE CG174 / NPSA'),
          ACT.inv('Serum and urine osmolality, urine sodium'),
        ],
      };
    }
    if (Na > 160) {
      return {
        id: 'hypernatraemia', title: 'Severe hypernatraemia', level: 'urgent', category: 'laboratory', reasons: [`Na⁺ ${Na} mmol/L`], redirect: false,
        guideline: 'European guideline 2014 (principles of correction rate)',
        actions: [ACT.act('Same-day medical review: water deficit replacement, correct slowly')],
      };
    }
    return null;
  },
  (ctx) => {
    const reasons: string[] = [];
    const L = ctx.labs;
    const tnRaised = (L.troponin !== null && L.troponin >= 52) || L.troponinRaisedText;
    if (L.lactate !== null && L.lactate >= 4) reasons.push(`lactate ${L.lactate} mmol/L`);
    if (L.haemoglobin !== null && L.haemoglobin < 7) reasons.push(`Hb ${L.haemoglobin} g/dL`);
    if (L.ph !== null && L.ph < 7.2) reasons.push(`pH ${L.ph}`);
    if (L.glucose !== null && L.glucose >= 30) reasons.push(`glucose ${L.glucose} mmol/L`);
    if (tnRaised) reasons.push(`troponin raised${L.troponin !== null ? ` (${L.troponin} ng/L)` : ''}`);
    if (L.neutrophils !== null && L.neutrophils <= 0.5) reasons.push(`neutrophils ${L.neutrophils}`);
    if (!reasons.length) return null;
    const emergency = (L.lactate !== null && L.lactate >= 4) || (L.ph !== null && L.ph < 7.2);
    return {
      id: 'critical_labs', title: 'Critical laboratory result', level: emergency ? 'emergency' : 'urgent', category: 'laboratory', reasons,
      redirect: emergency, guideline: 'RCPath 2017 critical results; NICE NG51 (lactate)',
      actions: [...(emergency ? [REDIRECT_ACTION] : []), ACT.act('Act on the critical result now: senior review, repeat and identify the cause')],
    };
  },
  (ctx) => {
    const L = ctx.labs;
    if (L.lactate === null || L.lactate < 2 || L.lactate >= 4) return null;
    return {
      id: 'raised_lactate', title: 'Raised lactate', level: 'urgent', category: 'laboratory', reasons: [`lactate ${L.lactate} mmol/L`],
      redirect: false, guideline: 'NICE NG51 (lactate 2–4 mmol/L)', actions: [ACT.act('Look for sepsis, hypoperfusion or ischaemia (e.g. mesenteric); repeat lactate')],
    };
  },

  // ── Acute severe / life-threatening asthma (BTS/SIGN 158, 2019) ──────────────────────────
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.PMH + '\n' + ctx.D, RX.asthma) || !a(ctx.HE, /\b(wheez\w*|breathless\w*|short(ness)? of breath|tight chest|chest tightness|attack|exacerbation)\b/)) return null;
    if (a(ctx.HE, RX.anaphylaxisSkin)) return null; // anaphylaxis rule
    const v = ctx.v;
    const life: string[] = [];
    const severe: string[] = [];
    if (v.spo2 !== null && v.spo2 < 92) life.push(`SpO₂ ${v.spo2}%`);
    if (a(ctx.HE, /\b(silent chest|cyanos\w*|exhaust\w*|poor respiratory effort)\b/)) life.push('silent chest, cyanosis or exhaustion');
    if (alteredConsciousness(ctx)) life.push('altered consciousness');
    if (v.systolicBp !== null && v.systolicBp < 90) life.push('hypotension');
    const pef = ctx.HE.toLowerCase().match(/\b(?:pef|peak flow)\b[^.;\n]{0,25}?(\d{1,3})\s*%/);
    if (pef && parseInt(pef[1], 10) < 33) life.push(`PEF ${pef[1]}% predicted`);
    else if (pef && parseInt(pef[1], 10) <= 50) severe.push(`PEF ${pef[1]}% predicted`);
    if (!ctx.paed) {
      if (v.respiratoryRate !== null && v.respiratoryRate >= 25) severe.push(`RR ${v.respiratoryRate}`);
      if (v.heartRate !== null && v.heartRate >= 110) severe.push(`HR ${v.heartRate}`);
    }
    if (a(ctx.HE, /\b(can'?t (complete|finish) (sentences|a sentence)|unable to complete sentences|single words|short phrases)\b/)) severe.push('unable to complete sentences');
    if (!life.length && !severe.length) return null;
    const dose = ctx.paed ? ` — ${BNFC}` : '';
    return {
      id: 'asthma', title: life.length ? 'Life-threatening asthma' : 'Acute severe asthma', level: 'emergency', category: 'respiratory',
      reasons: [...life, ...severe], redirect: true, guideline: 'BTS/SIGN 158 (2019) British guideline on the management of asthma',
      actions: [
        REDIRECT_ACTION,
        ACT.act(`Oxygen-driven nebulised salbutamol ${ctx.paed ? '' : '5 mg '}(BTS/SIGN 158)${dose}; repeat / back-to-back if poor response`),
        ACT.act(ctx.paed ? `Oral prednisolone — ${BNFC}` : 'Oral prednisolone 40–50 mg (BTS/SIGN 158)'),
        ACT.act('Controlled oxygen to SpO₂ 94–98%'),
      ],
    };
  },

  // ── Acute heart failure / pulmonary oedema (ESC 2021 HF) ─────────────────────────────────
  (ctx) => {
    const signs = a(ctx.HE, RX.hfSigns) || ctx.icd.some(c => c.startsWith('I50')) || a(ctx.D, /\b(heart failure|pulmonary o?edema)\b/);
    if (!signs) return null;
    const hypoxic = ctx.v.spo2 !== null && ctx.v.spo2 < 92;
    const oedema = a(ctx.HE, /\b(pulmonary o?edema|orthopn\w*|paroxysmal nocturnal|crackles)\b/) || a(ctx.D, /\bpulmonary o?edema\b/);
    if (!oedema && !hypoxic) return null;
    return {
      id: 'acute_heart_failure', title: 'Acute heart failure / pulmonary oedema', level: hypoxic ? 'emergency' : 'urgent', category: 'cardiac',
      reasons: [oedema ? 'pulmonary oedema signs (orthopnoea, crackles, raised JVP)' : 'heart failure', ...(hypoxic ? [`SpO₂ ${ctx.v.spo2}%`] : [])],
      redirect: hypoxic, guideline: 'ESC 2021 heart failure guideline §11',
      actions: [
        ...(hypoxic ? [REDIRECT_ACTION] : []),
        ACT.act('IV loop diuretic (furosemide) for congestion (ESC 2021); sit upright; oxygen if SpO₂ < 90%'),
        ACT.act('No IV fluid bolus while heart-failure signs are present'),
        ACT.inv('ECG, troponin, NT-proBNP, chest X-ray'),
      ],
    };
  },

  // ── Obstetric and gynaecological emergencies ─────────────────────────────────────────────
  (ctx) => {
    if (!ctx.female || (ctx.age !== null && (ctx.age < 11 || ctx.age > 55))) return null;
    const dx = ctx.icd.some(c => c.startsWith('O00')) || a(ctx.D, /\bectopic\b/);
    const knownIntrauterine = a(ctx.HER, /\b(intrauterine pregnancy|\biup\b|gravid uterus|fetal heart|fundus)\b/) || (ctx.preg.weeks !== null && ctx.preg.weeks >= 14);
    const early = ctx.labs.pregnancyTest === 'positive' || a(ctx.H, RX.missedPeriod) || (ctx.preg.weeks !== null && ctx.preg.weeks < 14);
    const sx = a(ctx.H, RX.abdoPain) || a(ctx.H, RX.pelvicPain) || a(ctx.H, RX.vaginalBleed) || a(ctx.H, RX.shoulderTip) || a(ctx.H, RX.syncope);
    if (!(dx || (early && sx && !knownIntrauterine))) return null;
    return {
      id: 'ectopic', title: 'Suspected ectopic pregnancy', level: 'emergency', category: 'obstetric',
      reasons: [dx ? 'working diagnosis of ectopic pregnancy' : 'possible early pregnancy with pain, bleeding, shoulder-tip pain or collapse'], redirect: true,
      guideline: 'NICE NG126 (2019, updated 2023) ectopic pregnancy and miscarriage',
      actions: [
        REDIRECT_ACTION,
        ACT.inv('Urine pregnancy test now; serum β-hCG and transvaginal ultrasound'),
        ACT.act('Immediate gynaecology referral; haemodynamically unstable → emergency surgery (NICE NG126)'),
      ],
    };
  },
  (ctx) => {
    if (!ctx.female) return null;
    const dx = ctx.icd.some(c => c.startsWith('N83.5')) || a(ctx.D, /\b(ovarian|adnexal) torsion\b/);
    const pelvic = a(ctx.H, /\b(pelvic|adnexal|ovarian) pain\b|\bpain\b[^.;\n]{0,20}\b(pelvis|adnexa)\b/);
    const lower = a(ctx.H, RX.pelvicPain);
    const acutePelvic = (pelvic && a(ctx.H, /\b(sudden\w*|acute\w*|abrupt\w*)\b/))
      || (lower && a(ctx.H, /\b(sudden\w*|abrupt\w*)\b/) && (a(ctx.H, RX.vomiting) || a(ctx.HER, RX.adnexalMass)));
    const torsionText = a(ctx.H, /\b(ovarian|adnexal) torsion\b/);
    if (!(dx || torsionText || acutePelvic)) return null;
    if (ctx.preg.pregnant && (ctx.preg.weeks ?? 0) >= 14) return null;
    return {
      id: 'ovarian_torsion', title: 'Acute pelvic pain — ovarian torsion must be excluded', level: 'emergency', category: 'gynaecological',
      reasons: [dx || torsionText ? 'suspected ovarian torsion' : 'sudden / severe acute pelvic pain'], redirect: true,
      guideline: 'ACOG Committee Opinion 783 (2019) adnexal torsion; RCOG',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Urgent gynaecology review — ovarian torsion is a surgical emergency (diagnostic laparoscopy); ultrasound must not delay surgery'),
        ACT.inv('Pregnancy test; pelvic ultrasound with Doppler if it does not delay theatre'),
      ],
    };
  },
  (ctx) => {
    if (!ctx.preg.pregnant) return null;
    const trauma = a(ctx.H, /\b(fall|fell|pushed|assault\w*|road traffic|rtc|collision|struck|hit|kicked|punched|trauma)\b/);
    const abruption = ctx.icd.some(c => c.startsWith('O45')) || a(ctx.HE, /\b(abruption|woody[- ]hard|uterus (is )?(hard|tender)|uterine tenderness|reduced fetal movements|baby moving less|vaginal bleed\w*)\b/);
    if (!(trauma || abruption) || (ctx.preg.weeks !== null && ctx.preg.weeks < 20 && !abruption)) return null;
    return {
      id: 'obstetric_trauma', title: trauma ? 'Trauma in pregnancy — possible placental abruption' : 'Suspected placental abruption', level: 'emergency', category: 'obstetric',
      reasons: [trauma ? 'abdominal trauma in pregnancy' : 'abruption features (tense/tender uterus, bleeding, reduced fetal movements)'], redirect: true,
      guideline: 'ATLS 10th edn (trauma in pregnancy); RCOG GTG 63 antepartum haemorrhage',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Obstetric emergency: immediate obstetric / maternity team'),
        ACT.act('Manual left uterine displacement or left lateral tilt from 20 weeks (ATLS 10)'),
        ACT.inv('Fetal monitoring (CTG); FBC, coagulation, fibrinogen, group and save; Kleihauer test and anti-D if RhD negative (RCOG GTG 63)'),
      ],
    };
  },

  // ── Urology: testicular torsion, infected obstructed kidney, visible haematuria ──────────
  (ctx) => {
    if (!ctx.male && !ctx.icd.some(c => c.startsWith('N44'))) return null;
    const dx = ctx.icd.some(c => c.startsWith('N44')) || a(ctx.D, /\btesticular torsion\b|\btorsion of (the )?(testis|testicle|spermatic cord)\b/);
    const scrotal = a(ctx.HE, RX.scrotal) || a(ctx.H, /\b(testicular|scrotal|testicle|testis)\b[^.;\n]{0,20}\bpain\b/);
    // An inguino-scrotal hernia swelling is not acute scrotal pain unless the pain is sudden.
    const hernia = a(ctx.H + '\n' + ctx.D, /\bhernia\w*\b/) && !a(ctx.H, /\b(sudden\w*|acute\w*)\b/);
    if (!(dx || (scrotal && !hernia))) return null;
    return {
      id: 'testicular_torsion', title: 'Acute scrotal pain — testicular torsion until proven otherwise', level: 'emergency', category: 'urological',
      reasons: [dx ? 'working diagnosis of testicular torsion' : 'acute testicular / scrotal pain'], redirect: true,
      guideline: 'EAU 2024 guidelines (paediatric urology / urological trauma: acute scrotum)',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Emergency scrotal exploration — do not delay surgery for ultrasound when torsion is suspected (EAU 2024); salvage is time-critical'),
      ],
    };
  },
  (ctx) => {
    const obstruct = a(ctx.HERD, /\b(hydronephrosis|obstructed (kidney|ureter)|obstructing (stone|calculus)|pyonephrosis|infected obstructed|obstructed infected)\b/) || ctx.icd.some(c => c.startsWith('N13.6'));
    const temp = measuredOrWrittenTemp(ctx);
    const infected = (temp !== null && temp >= 38) || textFever(ctx.H) || a(ctx.HERD, /\b(rigors?|sepsis|septic|pyonephrosis|infected)\b/);
    const solitary = a(ctx.HERD + '\n' + ctx.PMH + '\n' + ctx.PSH, /\b(solitary|single|only) (functioning )?kidney\b|\bnephrectomy\b|\banuri\w*\b/);
    if (!(obstruct && (infected || solitary))) return null;
    return {
      id: 'infected_obstructed_kidney', title: infected ? 'Infected obstructed kidney' : 'Obstructed solitary kidney / anuria', level: 'emergency', category: 'urological',
      reasons: [infected ? 'urinary obstruction with fever / sepsis' : 'obstruction of a solitary kidney or anuria'], redirect: true, guideline: 'EAU 2024 urolithiasis guideline',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Urgent decompression — percutaneous nephrostomy or retrograde ureteric stent (EAU 2024); definitive stone treatment later'),
        ACT.act('IV antibiotics after blood and urine cultures; no NSAIDs if the kidney function is impaired'),
      ],
    };
  },
  (ctx) => {
    if ((ctx.age ?? 0) < 45) return null;
    if (!a(ctx.H, RX.haematuria) && !ctx.icd.some(c => c.startsWith('R31.0'))) return null;
    const uti = a(ctx.H + '\n' + ctx.R, RX.uti);
    return {
      id: 'visible_haematuria', title: 'Visible haematuria at 45 or over — suspected urological cancer pathway', level: 'priority', category: 'urological',
      reasons: ['visible haematuria, age ≥ 45'], redirect: false, guideline: 'NICE NG12 (2015, updated 2023) §1.6',
      actions: [
        ACT.act(`Suspected cancer pathway referral (NICE NG12: aged 45 and over with unexplained visible haematuria without urinary tract infection, or persisting after treatment of UTI)${uti ? ' — treat the UTI and re-test first' : ''}`),
        ACT.inv('Urine culture; U&E; CT urography and flexible cystoscopy via urology'),
      ],
    };
  },

  // ── Paediatric recognition (NICE NG143; Langer 2017 malrotation; APSA / BAPS) ────────────
  (ctx) => {
    if (!ctx.paed) return null;
    const age = ctx.age ?? 10;
    const temp = measuredOrWrittenTemp(ctx) ?? (() => {
      const m = ctx.H.toLowerCase().match(/\b(?:temperature|temp)\b[^.;\n]{0,15}?(3[89](?:\.\d)?|4[01](?:\.\d)?)/);
      return m ? parseFloat(m[1]) : null;
    })();
    const reasons: string[] = [];
    if (age < 0.25 && temp !== null && temp >= 38) reasons.push(`age under 3 months with temperature ${temp} °C`);
    if (a(ctx.HE, RX.ng143Red)) reasons.push('NICE NG143 red feature');
    if (!reasons.length) {
      if (age >= 0.25 && age < 0.5 && temp !== null && temp >= 39) {
        return {
          id: 'febrile_infant', title: 'Fever in an infant aged 3–6 months (≥ 39 °C)', level: 'urgent', category: 'paediatric',
          reasons: [`temperature ${temp} °C`], redirect: false, guideline: 'NICE NG143 (2019, updated 2021) fever in under 5s',
          actions: [ACT.act('Same-day paediatric assessment (NICE NG143 amber feature)')],
        };
      }
      return null;
    }
    return {
      id: 'febrile_infant', title: age < 0.25 ? 'Febrile infant under 3 months — NICE NG143 red' : 'Seriously unwell child — NICE NG143 red features', level: 'emergency', category: 'paediatric',
      reasons, redirect: true, guideline: 'NICE NG143 (2019, updated 2021) fever in under 5s; NICE NG51 (children)',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Urgent paediatric assessment / admission — the paediatric team, not the surgical clinic'),
        ACT.inv('Full septic screen per NICE NG143: blood culture, FBC, CRP, lumbar puncture as indicated'),
        ACT.act('Urine sample (clean catch) for dipstick and urine culture before antibiotics if it does not delay them (NICE NG143)'),
        ACT.act(`Parenteral antibiotics per NICE NG143 (under 3 months: include cover for Listeria) — ${BNFC}`),
      ],
    };
  },
  (ctx) => {
    if (!ctx.paed) return null;
    const dx = ctx.icd.some(c => c.startsWith('Q43.3')) || a(ctx.D, /\b(malrotation|midgut volvulus)\b/);
    if (!biliousVomit(ctx.HE) && !dx) return null;
    return {
      id: 'bilious_vomiting_child', title: 'Bilious vomiting in a child — malrotation with volvulus until proven otherwise', level: 'emergency', category: 'paediatric',
      reasons: [dx ? 'working diagnosis of malrotation / volvulus' : 'green (bilious) vomiting'], redirect: true,
      guideline: 'Langer 2017 (malrotation and volvulus, Semin Pediatr Surg); APSA',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Immediate paediatric surgery referral — do not treat as reflux or gastroenteritis'),
        ACT.inv('Urgent upper GI contrast study (paediatric radiology) if stable; do not delay surgery if unstable'),
        ACT.act(`Nil by mouth; nasogastric tube; IV fluids — ${BNFC}`),
      ],
    };
  },
  (ctx) => {
    if (!ctx.paed || (ctx.age ?? 10) >= 6) return null;
    const dx = ctx.icd.some(c => c.startsWith('K56.1')) || a(ctx.D, /\bintussuscept\w*/);
    // Specific signs alone; colicky screaming / drawing up the legs only with vomiting or pallor
    // ("inconsolable crying" alone is not intussusception).
    const specific = a(ctx.HE, /\b(red ?currant|jelly[- ]like stool|blood and mucus|sausage[- ]shaped mass|intussuscept\w*|target sign)\b/);
    const colic = a(ctx.HE, RX.intussusception) && a(ctx.HE, /\b(vomit\w*|pale|pallor|letharg\w*|sleepy between)\b/);
    const signs = specific || colic;
    const infantLethargy = (ctx.age ?? 10) < 2 && a(ctx.HE, /\b(letharg\w*|floppy|hypotoni\w*|pale)\b/) && a(ctx.H, RX.vomiting);
    if (!(dx || signs || infantLethargy)) return null;
    return {
      id: 'intussusception', title: 'Possible intussusception', level: 'emergency', category: 'paediatric',
      reasons: [dx ? 'working diagnosis of intussusception' : signs ? 'colicky screaming / drawing up legs, redcurrant-jelly stool or sausage-shaped mass' : 'infant with lethargy, pallor and vomiting'], redirect: true,
      guideline: 'APSA 2021 / BAPS; NICE NG143',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Immediate paediatric surgery referral'),
        ACT.inv('Abdominal ultrasound (target sign) by paediatric radiology'),
        ACT.act('Air or hydrostatic enema reduction if no peritonitis or perforation; surgery if it fails or the child is unstable'),
      ],
    };
  },
  (ctx) => {
    if (!ctx.paed || (ctx.age ?? 10) > 0.35) return null;
    const dx = ctx.icd.some(c => c.startsWith('Q40.0')) || a(ctx.D, /\bpyloric stenosis\b/);
    if (!dx && !a(ctx.HE, RX.projectile)) return null;
    if (biliousVomit(ctx.HE)) return null;
    return {
      id: 'pyloric_stenosis', title: 'Suspected pyloric stenosis', level: 'urgent', category: 'paediatric',
      reasons: ['projectile non-bilious vomiting in a young infant'], redirect: false, guideline: 'APSA / BAPS; Pandya 2012',
      actions: [
        ACT.inv('Pyloric ultrasound'),
        ACT.inv('Capillary blood gas and electrolytes (chloride, bicarbonate, potassium)'),
        ACT.act('Correct dehydration and hypochloraemic alkalosis before pyloromyotomy — paediatric surgery; fluids per BNFc / APLS'),
      ],
    };
  },

  // ── Surgical emergencies read from the examination and imaging ───────────────────────────
  (ctx) => {
    const perit = a(ctx.E, RX.peritonitis);
    const air = a(ctx.R, RX.freeAir);
    const dx = ctx.icd.some(c => /^(K65|K63\.1|K2[5-8]\.[1256]|K22\.3)/.test(c)) || a(ctx.D, /\b(perforat\w*|peritonitis)\b/);
    if (!(perit || air || dx)) return null;
    return {
      id: 'peritonitis', title: air ? 'Pneumoperitoneum — perforated viscus' : 'Peritonitis — possible perforated viscus', level: 'emergency', category: 'surgical',
      reasons: [perit ? 'generalised peritonism / rigidity' : air ? 'free intraperitoneal gas on imaging' : 'working diagnosis of perforation / peritonitis'], redirect: true,
      guideline: 'WSES 2017 / 2020 perforated peptic ulcer and intra-abdominal infection guidelines',
      actions: [REDIRECT_ACTION, ACT.act('Emergency surgical assessment; nil by mouth, IV access, analgesia, IV antibiotics; senior decision on source control')],
    };
  },
  (ctx) => {
    if (!a(ctx.HE, RX.mesenteric) && !ctx.icd.some(c => c.startsWith('K55.0'))) return null;
    if (a(ctx.HE, /\b(skin|leg|thigh|arm|perine\w*|scrot\w*|groin)\b[^.;\n]{0,30}\bout of proportion\b|\bout of proportion\b[^.;\n]{0,30}\b(skin|leg|thigh|arm|perine\w*|scrot\w*)\b/)) return null;
    return {
      id: 'mesenteric_ischaemia', title: 'Suspected acute mesenteric ischaemia', level: 'emergency', category: 'vascular',
      reasons: ['abdominal pain out of proportion to the signs, or diagnosis of acute mesenteric ischaemia'], redirect: true,
      guideline: 'ESVS 2017 mesenteric arterial disease guideline',
      actions: [REDIRECT_ACTION, ACT.inv('CT angiography (arterial and portal venous phase)'), ACT.act('Heparin and immediate vascular / general surgical referral for revascularisation (ESVS 2017)')],
    };
  },
  (ctx) => {
    const isch = a(ctx.HE, RX.limbIschaemia);
    const acute = a(ctx.HE, RX.limbPainAcute);
    const dx = ctx.icd.some(c => c.startsWith('I74')) || a(ctx.D, /\bacute limb ischa?emia\b|\b(arterial )?embol\w* (of|to) the (leg|limb|arm|femoral|popliteal)\b/);
    if (!(dx || (isch && acute && a(ctx.HE, /\b(leg|foot|limb|arm|hand|calf|toes)\b/)))) return null;
    if (a(ctx.HE, RX.hfSigns) && !dx && !a(ctx.HE, /\b(pulseless|absent (foot |pedal |femoral |popliteal |distal )?pulses?)\b/)) return null;
    return {
      id: 'acute_limb_ischaemia', title: 'Acute limb ischaemia', level: 'emergency', category: 'vascular',
      reasons: ['sudden cold, pale, painful or pulseless limb'], redirect: true, guideline: 'ESVS 2020 acute limb ischaemia guideline',
      actions: [
        REDIRECT_ACTION,
        ACT.act('IV unfractionated heparin unless contraindicated (ESVS 2020)'),
        ACT.act('Immediate vascular surgery referral for revascularisation (embolectomy / thrombolysis / bypass)'),
        ...(a(ctx.HE + '\n' + ctx.PMH, RX.af) ? [ACT.act('Atrial fibrillation — likely embolic source; anticoagulation plan with vascular team')] : []),
      ],
    };
  },
  (ctx) => {
    const text = ctx.HE;
    const nec = a(text, RX.necFasc) || ctx.icd.some(c => /^(M72\.6|N49\.3)/.test(c));
    if (!nec) return null;
    if (a(text, /\bpain out of proportion\b/) && !a(text, /\b(skin|cellulitis|erythema|swelling|thigh|leg|arm|perine\w*|scrot\w*|wound|groin)\b/)) return null;
    if (!a(text, /\b(cellulitis|erythema|skin|wound|swelling|perine\w*|scrot\w*|groin|fournier\w*|necroti\w*|crepitus|bullae)\b/)) return null;
    return {
      id: 'nsti', title: 'Suspected necrotising soft-tissue infection', level: 'emergency', category: 'surgical',
      reasons: ['crepitus, pain out of proportion, rapid spread, bullae or dusky skin'], redirect: true, guideline: 'WSES/SIS-E 2018 skin and soft-tissue infections',
      actions: [REDIRECT_ACTION, ACT.act('Emergency surgical exploration and debridement; broad-spectrum IV antibiotics; a low LRINEC score does not exclude NSTI (WSES 2018)')],
    };
  },
  (ctx) => {
    if (!a(ctx.H, RX.completeDysphagia)) return null;
    return {
      id: 'complete_dysphagia', title: 'Complete oesophageal obstruction (unable to swallow saliva)', level: 'emergency', category: 'surgical',
      reasons: ['unable to swallow saliva / drooling'], redirect: true, guideline: 'ESGE 2016 removal of foreign bodies in the upper GI tract',
      actions: [REDIRECT_ACTION, ACT.act('Emergency endoscopy (within 6 hours for complete obstruction) for bolus removal — ESGE 2016')],
    };
  },
  (ctx) => {
    const stridor = a(ctx.HE, RX.stridor);
    const recentNeckSurgery = a(ctx.PSH, RX.thyroidSurgery) || (ctx.isPostOp && a(ctx.H + '\n' + ctx.D, RX.thyroidSurgery))
      || a(ctx.H, /\b(after|since|following|post-?op\w*)\b[^.;\n]{0,30}\b(thyroidectomy|parathyroidectomy|hemithyroidectomy|neck (surgery|dissection|exploration))\b/);
    const neck = a(ctx.HE, RX.neckHaematoma) && recentNeckSurgery;
    if (!stridor && !neck) return null;
    if (stridor && a(ctx.HE, RX.anaphylaxisSkin)) return null; // anaphylaxis rule covers it
    return {
      id: 'airway', title: neck ? 'Airway emergency — neck haematoma after thyroid/parathyroid surgery' : 'Airway emergency — stridor', level: 'emergency', category: 'respiratory',
      reasons: [neck ? 'neck swelling / haematoma after neck surgery' : 'stridor (upper airway obstruction)'], redirect: true,
      guideline: 'DAS/BAETS 2014 management of post-thyroidectomy haematoma; RCUK 2021 ABCDE',
      actions: [
        REDIRECT_ACTION,
        ACT.act('Senior anaesthetic and surgical help now; sit upright; high-flow oxygen'),
        ...(neck ? [ACT.act('If the haematoma compromises the airway: open the wound at the bedside — SCOOP (skin exposure, cut sutures, open skin, open muscles, pack) — DAS/BAETS 2014')] : []),
        ...(a(ctx.H, /\brapid\w*\b[^.;\n]{0,25}\b(enlarg\w*|grow\w*|swelling)\b/) ? [ACT.inv('Urgent core / incisional biopsy once the airway is secure — exclude anaplastic thyroid cancer and lymphoma (BTA 2014)')] : []),
      ],
    };
  },

  // ── Trauma and burns (ATLS 10; NICE NG232 head injury; National Burn Care Referral Guidance) ─
  (ctx) => {
    const penetrating = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D, RX.penetrating);
    if (!penetrating) return null;
    return {
      id: 'penetrating_trauma', title: 'Penetrating trauma', level: 'emergency', category: 'trauma', reasons: ['stab / gunshot / penetrating wound or evisceration'], redirect: true,
      guideline: 'ATLS 10th edn (2018)',
      actions: [REDIRECT_ACTION, ACT.act('ATLS primary survey; do not remove an impaled object; cover eviscerated bowel with moist dressings; trauma surgery')],
    };
  },
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.D, RX.headInjury) && !ctx.icd.some(c => c.startsWith('S06'))) return null;
    const anticoag = a(ctx.MEDS, /\b(warfarin|apixaban|rivaroxaban|edoxaban|dabigatran|heparin|enoxaparin|clopidogrel|ticagrelor|prasugrel)\b/);
    const gcs = ctx.gcs;
    const low = gcs !== null && gcs <= 12;
    const level: EmergencyLevel = low ? 'emergency' : 'urgent';
    return {
      id: 'head_injury', title: `Head injury${low ? ` with GCS ${gcs}` : anticoag ? ' on anticoagulant / antiplatelet' : ''}`, level, category: 'trauma',
      reasons: [gcs !== null ? `GCS ${gcs}` : 'head injury', ...(anticoag ? ['anticoagulant / antiplatelet recorded'] : [])], redirect: low,
      guideline: 'NICE NG232 (2023) head injury',
      actions: [
        ...(low ? [REDIRECT_ACTION] : []),
        ACT.inv(`CT head${low ? ' immediately (GCS ≤ 12)' : anticoag ? ' — anticoagulated: NICE NG232 time frame' : ' if any NICE NG232 criterion is met'}`),
        ...(anticoag ? [ACT.act('Anticoagulant reversal if intracranial bleeding is confirmed (haematology); do not simply hold / bridge')] : []),
      ],
    };
  },
  (ctx) => {
    if (!a(ctx.HE + '\n' + ctx.D, RX.burn) && !a(ctx.HE + '\n' + ctx.D, RX.chemical) && !ctx.icd.some(c => /^T(2[0-9]|3[01]|54)/.test(c))) return null;
    // A swallowed caustic is an upper-GI emergency, not a skin burn (no skin irrigation plan).
    if (a(ctx.H + '\n' + ctx.D, /\b(swallow\w*|ingest\w*|drank|drunk|ingestion)\b/) && !a(ctx.HE + '\n' + ctx.D, /\b(skin|face|arm|hand|leg|eye|splash\w*|spray\w*)\b/)) return null;
    const m = ctx.HE.toLowerCase().match(/\b(\d{1,2}(?:\.\d)?)\s*%\s*(?:tbsa|total body surface|bsa|body surface|burns?\b|scalds?\b|partial|full|deep|superficial)/)
      ?? ctx.D.toLowerCase().match(/\b(\d{1,2}(?:\.\d)?)\s*%\s*(?:tbsa|total body surface|bsa)/);
    const tbsa = m ? parseFloat(m[1]) : null;
    const reasons: string[] = [];
    let level: EmergencyLevel | null = null;
    const raise = (l: EmergencyLevel, r: string) => { reasons.push(r); level = maxEmergencyLevel(level, l); };
    if (tbsa !== null && ((!ctx.paed && tbsa >= 15) || (ctx.paed && tbsa >= 10))) raise('emergency', `${tbsa}% TBSA (major burn)`);
    else if (tbsa !== null && tbsa >= (ctx.paed ? 1 : 3)) raise('urgent', `${tbsa}% TBSA`);
    if (a(ctx.HE, RX.inhalation)) raise('emergency', 'possible inhalation injury');
    if (a(ctx.HE, RX.circumferential)) raise('emergency', 'circumferential burn (compartment / escharotomy risk)');
    if (a(ctx.HE, RX.electrical)) raise('emergency', 'high-voltage electrical injury');
    if (a(ctx.HE + '\n' + ctx.D, RX.chemical)) raise('emergency', 'chemical burn');
    if (a(ctx.HE, RX.fullThickness)) raise('urgent', 'deep / full-thickness burn');
    if (a(ctx.HE, RX.specialArea) && a(ctx.HE, RX.burn)) raise('urgent', 'burn to a special area (face, hands, feet, perineum, genitalia)');
    if (ctx.paed) raise('urgent', 'burn in a child');
    if (!level) return null;
    const lvl = level as EmergencyLevel;
    return {
      id: 'burn', title: lvl === 'emergency' ? 'Major / complex burn' : 'Burn meeting specialist referral criteria', level: lvl, category: 'trauma', reasons,
      redirect: lvl === 'emergency', guideline: 'National Network for Burn Care referral guidance (2012); ATLS 10; ABA',
      actions: [
        ...(lvl === 'emergency' ? [REDIRECT_ACTION] : []),
        ACT.act('Refer to the burns service / burns unit (National Burn Care referral criteria)'),
        ...(a(ctx.HE + '\n' + ctx.D, RX.chemical) ? [ACT.act('Chemical burn: copious irrigation with running water now (skin and eyes); remove contaminated clothing; water only; ophthalmology if the eye is involved')] : []),
        ...(a(ctx.HE, RX.inhalation) ? [ACT.act('Inhalation injury: 100% oxygen; early anaesthetic review for intubation before airway oedema')] : []),
        ...(a(ctx.HE, RX.circumferential) ? [ACT.act('Circumferential burn: monitor distal perfusion; escharotomy by the burns team')] : []),
        ...(tbsa !== null && ((!ctx.paed && tbsa >= 15) || (ctx.paed && tbsa >= 10)) ? [ACT.act('Formal IV fluid resuscitation from the time of burn, titrated to urine output (burns unit protocol)')] : []),
        ACT.act('Tetanus status check (UKHSA Green Book ch. 30)'),
      ],
    };
  },


  // ── Aorto-enteric fistula (ESVS 2020 vascular graft infections) ──────────────────────────
  (ctx) => {
    const graft = a(ctx.PSH + '\n' + ctx.PMH + '\n' + ctx.H, RX.aorticGraft);
    const bleed = a(ctx.H, /\b(ha?ematemesis|mela?ena|vomiting blood|rectal bleed\w*|black stool\w*|gi bleed\w*|bleed\w*)\b/);
    if (!(graft && bleed)) return null;
    return {
      id: 'aortoenteric_fistula', title: 'GI bleeding after aortic graft — aorto-enteric fistula until proven otherwise', level: 'emergency', category: 'vascular',
      reasons: ['previous aortic graft / repair with GI bleeding (a "herald" bleed)'], redirect: true,
      guideline: 'ESVS 2020 vascular graft and endograft infections',
      actions: [REDIRECT_ACTION, ACT.inv('CT angiography of the aorta and graft before endoscopy if stable'), ACT.act('Urgent vascular surgery referral (vascular on-call)')],
    };
  },

  // ── Pulsatile groin mass (ESVS 2017 / femoral aneurysm; not a hernia template) ───────────
  (ctx) => {
    if (!a(ctx.HE, /\b(pulsatile|expansile)\b[^.;\n]{0,30}\b(groin|femoral|inguinal|mass|lump|swelling)\b|\b(groin|femoral|inguinal)\b[^.;\n]{0,30}\b(pulsatile|expansile)\b|\bbruit\b[^.;\n]{0,20}\b(groin|femoral)\b|\bpseudo-?aneurysm\b/)) return null;
    return {
      id: 'pulsatile_groin_mass', title: 'Pulsatile groin mass — possible femoral aneurysm / pseudoaneurysm', level: 'urgent', category: 'vascular',
      reasons: ['pulsatile / expansile groin swelling'], redirect: false, guideline: 'ESVS 2017 peripheral arterial disease (femoral aneurysm); never needle or explore as a hernia',
      actions: [ACT.inv('Arterial duplex ultrasound (or CT angiography) of the groin before any hernia surgery or aspiration'), ACT.act('Vascular surgery referral; do not aspirate or incise')],
    };
  },

  // ── Umbilical hernia with tense ascites (EASL 2018 decompensated cirrhosis) ──────────────
  (ctx) => {
    const hernia = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D, /\bumbilical hernia\b|\bparaumbilical hernia\b/);
    const ascites = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D + '\n' + ctx.PMH, /\bascites\b/);
    if (!(hernia && ascites)) return null;
    const skin = a(ctx.E + '\n' + ctx.H, /\b(thin\w*|shiny|stretched|ulcerat\w*|necrotic|discolou?r\w*|weeping|leak\w*)\b[^.;\n]{0,25}\b(skin|hernia)\b|\bskin\b[^.;\n]{0,25}\b(thin\w*|shiny|ulcerat\w*|necrotic|discolou?r\w*|weeping|leak\w*)\b/);
    return {
      id: 'umbilical_hernia_ascites', title: `Umbilical hernia with ascites — rupture risk${skin ? ' (thin / ulcerated skin)' : ''}`, level: skin ? 'urgent' : 'priority', category: 'surgical',
      reasons: ['umbilical hernia in a patient with ascites', ...(skin ? ['skin changes over the hernia'] : [])], redirect: false,
      guideline: 'EASL 2018 decompensated cirrhosis (hernia in ascites)',
      actions: [
        ACT.act('Risk of rupture and ascitic leak (Flood syndrome): control ascites first (paracentesis / diuretics, TIPS assessment) with hepatology before any repair'),
        ACT.act(`Safety-net: leak of fluid, ulceration or a tender irreducible hernia — ${EMERGENCY_REDIRECT}`),
      ],
    };
  },

  // ── Compressive / retrosternal goitre (BTA 2014; BAETS) ──────────────────────────────────
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.E + '\n' + ctx.D + '\n' + ctx.R, /\b(goitre|goiter|thyroid (mass|swelling|enlargement))\b/)) return null;
    const compress = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D + '\n' + ctx.R, /\b(compress\w*|retrosternal|substernal|tracheal (deviation|narrowing)|stridor|pemberton\w*|orthopn\w*|dysphagia|breathless\w* (lying|when lying|on lying))\b/);
    if (!compress) return null;
    return {
      id: 'compressive_goitre', title: 'Compressive / retrosternal goitre — airway assessment', level: 'urgent', category: 'respiratory',
      reasons: ['goitre with compressive features (tracheal compression, retrosternal extension, stridor or dysphagia)'], redirect: false,
      guideline: 'British Thyroid Association 2014; BAETS',
      actions: [ACT.inv('CT neck and thorax (airway calibre, retrosternal extent)'), ACT.act('Anaesthetic airway assessment before surgery; urgent endocrine surgery review (thyroidectomy for compressive goitre)')],
    };
  },

  // ── Atrial fibrillation found without instability or rapid rate (ESC 2024 AF-CARE) ───────
  (ctx) => {
    const af = a(ctx.H + '\n' + ctx.E + '\n' + ctx.R + '\n' + ctx.D, RX.af) || ctx.icd.some(c => c.startsWith('I48'));
    if (!af || (ctx.v.heartRate !== null && ctx.v.heartRate > 110)) return null;
    if (!a(ctx.H + '\n' + ctx.D + '\n' + ctx.E, /\b(new\w*|newly|detected|found|incidental|irregular pulse|irregularly irregular)\b/)) return null;
    return {
      id: 'af_new', title: 'Atrial fibrillation — newly detected', level: 'priority', category: 'cardiac',
      reasons: ['newly detected / irregular pulse'], redirect: false, guideline: 'ESC 2024 AF guideline (AF-CARE)',
      actions: [
        ACT.inv('12-lead ECG to confirm atrial fibrillation'),
        ACT.act('Thromboembolic risk (CHA₂DS₂-VA) and anticoagulation decision, rate control, TFTs (ESC 2024); defer elective surgery until there is a plan with cardiology / GP'),
      ],
    };
  },

  // ── Moderate acute asthma (BTS/SIGN 158, 2019) — severe / life-threatening handled above ─
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.PMH + '\n' + ctx.D, RX.asthma) || !a(ctx.HE, /\b(wheez\w*|breathless\w*|short(ness)? of breath|tight chest|chest tightness|exacerbation|attack)\b/)) return null;
    if (a(ctx.HE, RX.anaphylaxisSkin)) return null;
    const dose = ctx.paed ? ` — ${BNFC}` : '';
    return {
      id: 'asthma_moderate', title: 'Acute asthma exacerbation', level: 'urgent', category: 'respiratory',
      reasons: ['asthma with wheeze / breathlessness'], redirect: false, guideline: 'BTS/SIGN 158 (2019) British guideline on the management of asthma',
      actions: [
        ACT.act(`Inhaled salbutamol (β2 agonist) via spacer or nebuliser${dose}; oral prednisolone${ctx.paed ? '' : ' 40–50 mg'} (BTS/SIGN 158)${dose}; reassess PEF and SpO₂`),
        ...(ctx.preg.pregnant ? [ACT.act('Pregnancy: treat acute asthma as in non-pregnant patients (BTS/SIGN 158); inform the obstetric team')] : []),
      ],
    };
  },

  // ── Urinary retention / obstructive AKI (EAU 2024 non-neurogenic male LUTS; NICE NG148) ──
  (ctx) => {
    const retention = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D, /\b(urinary retention|retention of urine|unable to pass urine|can'?t pass urine|cannot pass urine|palpable (bladder|urinary bladder)|distended bladder|bladder scan\b[^.;\n]{0,20}\b\d{3,4}\s*ml)\b/)
      || a(ctx.R, /\b(residual|bladder)\b[^.;\n]{0,25}\b([5-9]\d\d|\d{4})\s*ml\b|\bhydronephrosis\b[^.;\n]{0,30}\bbilateral\b|\bbilateral hydronephrosis\b/);
    if (!retention) return null;
    if (a(ctx.HE, RX.saddle) || a(ctx.E, RX.analTone)) return null; // cauda equina rule
    const aki = ctx.labs.creatinine !== null && ctx.labs.creatinine > 130;
    return {
      id: 'urinary_retention', title: `Urinary retention${aki ? ' with acute kidney injury (obstructive uropathy)' : ''}`, level: 'urgent', category: 'urological',
      reasons: ['urinary retention', ...(aki ? [`creatinine ${ctx.labs.creatinine}`] : [])], redirect: false,
      guideline: 'EAU 2024 male LUTS / urinary retention; NICE NG148 acute kidney injury',
      actions: [
        ACT.act('Urethral catheterisation (suprapubic if urethral fails); record the residual volume'),
        ...(aki ? [ACT.act('Chronic retention with AKI: hourly urine output — watch for post-obstructive diuresis and replace fluid losses; repeat U&E (NICE NG148)')] : []),
        ACT.inv('U&E / creatinine; urine culture'),
      ],
    };
  },

  // ── First seizure (NICE NG217, 2022 epilepsies) ──────────────────────────────────────────
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.D, /\b(first|new)[- ]?(onset )?(seizure|fit|convulsion|tonic[- ]clonic)|seizure\w*\b|convuls\w*|tonic[- ]clonic|\bhad a fit\b|\bfitting\b/)) return null;
    if (ctx.preg.pregnant || (ctx.preg.postpartumWeeks !== null && ctx.preg.postpartumWeeks <= 6)) return null; // eclampsia rule
    if (a(ctx.H, /\b(epilep\w*|known seizures)\b/) || a(ctx.PMH, /\bepilep\w*/)) return null;
    const ongoing = a(ctx.H + '\n' + ctx.E, /\b(still fitting|ongoing seizure|status epilepticus|not recovered|not back to normal|prolonged seizure)\b/) || alteredConsciousness(ctx);
    return {
      id: 'first_seizure', title: ongoing ? 'Seizure with incomplete recovery' : 'First seizure', level: ongoing ? 'emergency' : 'urgent', category: 'neurological',
      reasons: [ongoing ? 'seizure with ongoing / reduced consciousness' : 'first seizure, recovered'], redirect: ongoing,
      guideline: 'NICE NG217 (2022) epilepsies; NICE CG109 transient loss of consciousness',
      actions: [
        ...(ongoing ? [REDIRECT_ACTION] : []),
        ACT.inv('Capillary glucose, U&E, calcium, magnesium'),
        ACT.act('12-lead ECG (cardiac cause of transient loss of consciousness — NICE CG109 / NG217)'),
        ACT.act('Urgent referral to a first-seizure clinic / neurologist, seen within 2 weeks (NICE NG217)'),
        ACT.act('Driving safety advice: stop driving and inform the licensing authority; avoid unsupervised swimming and working at heights until reviewed'),
      ],
    };
  },

  // ── Superficial vein thrombosis near the saphenofemoral junction (ESVS 2021 venous thrombosis) ─
  (ctx) => {
    if (!a(ctx.H + '\n' + ctx.E + '\n' + ctx.D + '\n' + ctx.R, /\b(superficial (vein |venous )?thrombo\w*|thrombophlebitis|svt\b)/)) return null;
    const nearJunction = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D + '\n' + ctx.R, /\b(saphenofemoral|sapheno-femoral|sfj|saphenopopliteal|spj|junction)\b/);
    return {
      id: 'superficial_vein_thrombosis', title: `Superficial vein thrombosis${nearJunction ? ' near the saphenofemoral junction' : ''}`, level: nearJunction ? 'urgent' : 'priority', category: 'vascular',
      reasons: [nearJunction ? 'thrombus extending towards the deep venous junction' : 'superficial vein thrombosis'], redirect: false,
      guideline: 'ESVS 2021 clinical practice guidelines on the management of venous thrombosis',
      actions: [
        ACT.inv('Venous duplex ultrasound of both legs (extent, distance from the junction, concomitant DVT)'),
        ACT.act(nearJunction
          ? 'Within 3 cm of the saphenofemoral junction: therapeutic anticoagulation as for DVT (ESVS 2021)'
          : 'Length ≥ 5 cm above the knee: fondaparinux prophylactic dose for 45 days (ESVS 2021); shorter / below-knee: NSAID or compression and repeat duplex'),
      ],
    };
  },

  // ── Hyperemesis gravidarum (RCOG GTG 69, 2016) ───────────────────────────────────────────
  (ctx) => {
    if (!ctx.preg.pregnant || (ctx.preg.weeks !== null && ctx.preg.weeks > 20)) return null;
    const vomiting = a(ctx.H, /\b(vomit\w*|hyperemesis|unable to keep (anything|fluids|water) down)\b/);
    const severe = a(ctx.H + '\n' + ctx.E + '\n' + ctx.D, /\b(hyperemesis|weight (loss|down)|dehydrat\w*|ketotic|ketones|unable to keep (anything|fluids|water) down|dry mucous)\b/)
      || (ctx.labs.potassium !== null && ctx.labs.potassium < 3.5);
    if (!(vomiting && severe)) return null;
    return {
      id: 'hyperemesis', title: 'Hyperemesis gravidarum', level: 'urgent', category: 'obstetric',
      reasons: ['vomiting in early pregnancy with dehydration, ketonuria or weight loss'], redirect: false,
      guideline: 'RCOG Green-top Guideline 69 (2016) nausea, vomiting and hyperemesis gravidarum',
      actions: [
        ACT.act('IV 0.9% sodium chloride with potassium chloride guided by daily U&E (RCOG GTG 69); antiemetics'),
        ACT.act('Thiamine supplementation (Wernicke encephalopathy prevention — RCOG GTG 69)'),
        ACT.act('Thromboprophylaxis with LMWH if admitted (RCOG GTG 69); early pregnancy / obstetric team review'),
        ACT.inv('Pelvic ultrasound (viability, multiple or molar pregnancy); U&E, LFTs, TFTs; urine ketones'),
      ],
    };
  },

  // ── Severe hypertriglyceridaemia (ACG 2024 acute pancreatitis; ESC/EAS 2019) ──────────────
  (ctx) => {
    const tg = ctx.labs.triglycerides;
    const lipaemic = a(ctx.R + '\n' + ctx.H + '\n' + ctx.D, /\blipa?emi\w*\b/);
    if (!((tg !== null && tg >= 11.3) || lipaemic)) return null;
    return {
      id: 'hypertriglyceridaemia', title: 'Severe hypertriglyceridaemia', level: 'urgent', category: 'laboratory',
      reasons: [tg !== null ? `triglycerides ${tg} mmol/L` : 'lipaemic sample'], redirect: false,
      guideline: 'ACG 2024 acute pancreatitis (triglycerides ≥ 11.3 mmol/L / 1000 mg/dL as a cause)',
      actions: [ACT.act('Triglycerides ≥ 11.3 mmol/L can cause pancreatitis: treat as the cause, not gallstones (insulin-glucose / lipid-lowering per specialist)')],
    };
  },

  // ── Post-operative delirium (NICE CG103) ─────────────────────────────────────────────────
  (ctx) => {
    const postOp = ctx.isPostOp || a(ctx.H, RX.postOp);
    if (!postOp || !a(ctx.HE, RX.delirium)) return null;
    return {
      id: 'postop_delirium', title: 'Post-operative delirium — find the cause', level: 'urgent', category: 'perioperative',
      reasons: ['new confusion, drowsiness or agitation after surgery'], redirect: false, guideline: 'NICE CG103 (2010, updated 2023) delirium',
      actions: [
        ACT.act('Assess with the 4AT; look for and treat the cause: sepsis / anastomotic leak, hypoxia, pain, urinary retention, constipation, drugs (opioids, anticholinergics), electrolytes, alcohol withdrawal (NICE CG103)'),
        ACT.inv('Observations with NEWS2, capillary glucose, FBC, U&E, calcium, CRP, urine; review the drug chart'),
      ],
    };
  },
];

// ── Safeguarding (NICE CG89 child maltreatment; NICE PH50 domestic violence and abuse) ─────

function safeguardingFlags(ctx: Ctx): SafeguardingFlag[] {
  const out: SafeguardingFlag[] = [];
  const text = ctx.HE;
  const childReasons: string[] = [];
  if (ctx.paed) {
    const nonMobile = (ctx.age !== null && ctx.age < 0.5) || a(text, RX.mobility);
    if (nonMobile && a(text, RX.bruise)) childReasons.push('bruising in a non-mobile infant');
    if (a(text, RX.patternedBruise)) childReasons.push('patterned bruising / bruises of different ages');
    if (a(text, RX.immersion)) childReasons.push('immersion-pattern scald (stocking/glove distribution, tide-marks, sparing of flexures)');
    if (a(text, RX.inconsistentHistory) && a(text, /\b(injur\w*|bruis\w*|burn\w*|scald\w*|fracture\w*|fell|fall|haematoma)\b/)) childReasons.push('history vague, changing or inconsistent with the injury');
  }
  if (childReasons.length || ctx.icd.some(c => /^T7[46]/.test(c))) {
    out.push({
      id: 'safeguarding_child', title: 'Safeguarding concern — possible child maltreatment', level: 'urgent',
      reasons: childReasons.length ? childReasons : ['diagnosis code of child maltreatment'],
      guideline: 'NICE CG89 (2009, updated 2017) child maltreatment: when to suspect',
      actions: [
        { kind: 'action', text: "Safeguarding concern: follow the practice's safeguarding procedure — record the account verbatim and the injuries (body map), inform the practice safeguarding lead, and arrange same-day paediatric assessment (child protection) — NICE CG89" },
        { kind: 'investigation', text: 'Paediatric team to decide on skeletal survey and further child-protection investigations' },
      ],
    });
  }
  if (a(text, RX.partnerViolence)) {
    out.push({
      id: 'safeguarding_domestic_abuse', title: `Domestic abuse disclosed${ctx.preg.pregnant ? ' in pregnancy' : ''}`, level: null,
      reasons: ['injury attributed to a partner / domestic abuse'],
      guideline: 'NICE PH50 (2014) domestic violence and abuse; NICE CG110 pregnancy and complex social factors',
      actions: [
        { kind: 'action', text: "Domestic abuse (safeguarding): follow the practice's safeguarding procedure — speak with the patient alone, assess immediate safety, document, and offer referral to specialist domestic-abuse support (NICE PH50)" },
      ],
    });
  }
  return out;
}

// ── Risk modifiers (triage reasons; they change no level) ───────────────────────────────────

function riskModifiers(ctx: Ctx): RiskModifier[] {
  const out: RiskModifier[] = [];
  const medsPmh = `${ctx.MEDS}\n${ctx.PMH}`;
  const immunoDrug = ctx.MEDS.match(new RegExp(RX.immunosuppressant.source, 'i'))?.[0] ?? ctx.MEDS.match(new RegExp(RX.steroid.source, 'i'))?.[0];
  if ((immunoDrug && (a(ctx.MEDS, RX.immunosuppressant) || a(ctx.MEDS, RX.steroid))) || a(ctx.PMH, RX.immunoPmh)) {
    const what = immunoDrug ?? (ctx.PMH.match(/\b(hiv|transplant\w*|chemotherapy|neutropeni\w*|immunosuppress\w*)\b/i)?.[0] ?? 'recorded');
    out.push({ id: 'immunosuppressed', text: `Immunosuppressed (${what}) — fever, tachycardia and peritonism may be masked; lower threshold for sepsis / perforation` });
  }
  if (a(ctx.MEDS, RX.steroid)) out.push({ id: 'steroids', text: 'Long-term steroids — adrenal insufficiency risk: peri-operative / sick-day steroid cover (AAGBI 2020)' });
  if (a(ctx.PSH + '\n' + ctx.PMH, RX.asplenia)) out.push({ id: 'asplenia', text: 'Asplenia / post-splenectomy — overwhelming infection risk; vaccination and antibiotic prophylaxis status (UKHSA Green Book ch. 7)' });
  if (a(ctx.MEDS, RX.betaBlocker)) {
    const bb = ctx.MEDS.match(new RegExp(RX.betaBlocker.source, 'i'))?.[0] ?? 'beta-blocker';
    out.push({ id: 'beta_blocker', text: `Beta-blocker (${bb}) — may blunt tachycardia: shock can be masked` });
  }
  if (a(ctx.MEDS, RX.sglt2)) out.push({ id: 'sglt2', text: 'SGLT2 inhibitor — euglycaemic DKA risk: check ketones if unwell, vomiting or fasting (MHRA 2020)' });
  if (a(ctx.H + '\n' + medsPmh, RX.ivdu)) out.push({ id: 'ivdu', text: 'Injecting drug use — consider MRSA, endocarditis, pseudoaneurysm and blood-borne viruses' });
  if (a(ctx.PSH + '\n' + ctx.PMH, RX.aorticGraft)) out.push({ id: 'aortic_graft', text: 'Previous aortic graft / repair — any GI bleed: exclude aorto-enteric fistula (CT angiography)' });
  if (a(ctx.PMH + '\n' + ctx.PSH, RX.mechanicalValve)) out.push({ id: 'mechanical_valve', text: 'Mechanical heart valve — high thrombotic risk: anticoagulation plan with cardiology / haematology' });
  if (a(ctx.PMH, RX.dementia)) out.push({ id: 'dementia', text: 'Dementia / cognitive impairment — high delirium risk (NICE CG103)' });
  if (a(ctx.PMH + '\n' + ctx.PSH, /\b(atrial fibrillation|\baf\b)\b/) && a(ctx.H, /\b(sudden\w*|acute)\b/) && a(ctx.H, /\b(pain|cold|numb\w*|weak\w*)\b/)) {
    out.push({ id: 'af_embolic', text: 'Atrial fibrillation — embolic source: consider acute limb or mesenteric ischaemia and stroke' });
  }
  const hazardText = `${ctx.PMH}\n${ctx.PSH}\n${ctx.ALLERGY}\n${ctx.H}`;
  if (a(hazardText, RX.mh)) out.push({ id: 'anaesthetic_mh', text: 'Anaesthetic hazard: malignant hyperthermia susceptibility — alert the anaesthetist; trigger-free anaesthesia' });
  if (a(hazardText, RX.suxApnoea)) out.push({ id: 'anaesthetic_sux', text: 'Anaesthetic hazard: suxamethonium apnoea (butyrylcholinesterase deficiency) — alert the anaesthetist' });
  if (a(ctx.ALLERGY + '\n' + ctx.PMH, RX.latex)) out.push({ id: 'anaesthetic_latex', text: 'Anaesthetic hazard: latex allergy — latex-free theatre and ward' });
  if (a(hazardText, RX.difficultAirway)) out.push({ id: 'anaesthetic_airway', text: 'Anaesthetic hazard: known difficult airway — alert the anaesthetist' });
  if (a(ctx.PMH, RX.osa)) out.push({ id: 'anaesthetic_osa', text: 'Obstructive sleep apnoea / STOP-Bang risk — airway and post-operative monitoring plan' });
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────────────────────────

export function assessEmergencies(input: EmergencyInput): EmergencyAssessment {
  const H = input.historyText ?? '';
  const E = input.examText ?? '';
  const labTexts = Object.entries(input.investigationResults ?? {}).map(([k, v]) => `${k}: ${v}`);
  const R = joinClauses([...(input.resultReports ?? []), ...labTexts]);
  // Only the leading diagnosis counts: "…at pre-op assessment (age >= 75, TIA, …)" and
  // "…Drug-eluting stent 3 months after NSTEMI" name past history, not the current problem.
  const D = diagnosisHead(input.diagnosis?.text ?? '');
  const age = refineAgeYears(input.age, `${H}\n${E}`);
  const sex = input.sex ?? 'unknown';
  const preg = detectPregnancy(`${H}\n${E}\n${D}`, sex, input.pregnancyPossible);
  const v = vitalsOf(input.vitals);
  const paed = age !== null && age < 16;
  const labs = extractTriageLabs(input.investigationResults);
  const hasObs = [v.respiratoryRate, v.spo2, v.systolicBp, v.heartRate, v.temperatureC].some(x => x !== null);
  const news2 = !paed && !preg.pregnant && hasObs
    ? evaluateNews2({
        respiratoryRate: v.respiratoryRate, spo2: v.spo2, onOxygen: v.onSupplementalO2, systolicBP: v.systolicBp,
        heartRate: v.heartRate, temperatureCelsius: v.temperatureC, avpu: v.avpu,
      })
    : null;
  const ctx: Ctx = {
    age, paed, female: sex === 'female', male: sex === 'male', preg,
    H, E, R, D,
    PMH: joinClauses(input.comorbidities ?? []), PSH: joinClauses(input.surgicalHistory ?? []),
    MEDS: joinClauses(input.medications ?? []), ALLERGY: joinClauses(input.allergies ?? []),
    HE: joinClauses([H, E]), HER: joinClauses([H, E, R]), HERD: joinClauses([H, E, R, D]),
    v, labs, news2, limits: paediatricVitalLimits(age), gcs: parseGcs(`${E}\n${H}`),
    icd: (input.diagnosis?.icd10 ?? []).filter((c): c is string => !!c).map(normIcd),
    isPostOp: !!input.isPostOp,
  };
  const emergencies: RecognisedEmergency[] = [];
  for (const rule of RULES) {
    const r = rule(ctx);
    if (r && !emergencies.some(e => e.id === r.id)) emergencies.push(r);
  }
  // The confirmed diagnosis radiates a level even when no specific rule fired.
  const dxl = diagnosisLevel(ctx.icd);
  if (dxl && !emergencies.some(e => LEVEL_RANK[e.level] >= LEVEL_RANK[dxl.level])) {
    emergencies.push({
      id: 'confirmed_diagnosis', title: `Confirmed diagnosis: ${dxl.label}`, level: dxl.level, category: 'surgical',
      reasons: [`diagnosis code ${dxl.code}`], redirect: dxl.level === 'emergency', guideline: 'Diagnosis severity (triage level = max of all sources)',
      actions: dxl.level === 'emergency' ? [REDIRECT_ACTION] : [],
    });
  }
  const safeguarding = safeguardingFlags(ctx);
  let level: EmergencyLevel | null = null;
  for (const e of emergencies) level = maxEmergencyLevel(level, e.level);
  for (const s of safeguarding) level = maxEmergencyLevel(level, s.level);
  emergencies.sort((x, y) => LEVEL_RANK[y.level] - LEVEL_RANK[x.level]);
  return { emergencies, safeguarding, riskModifiers: riskModifiers(ctx), labs, news2, ageYears: age, paediatric: paed, pregnancy: preg, level };
}
