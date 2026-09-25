/**
 * Cancer screening criteria based on NICE NG12 (2-week-wait referral)
 * and BSG/ACG guidelines, adapted for Dr Kabiye's surgical/endoscopy
 * practice in Saint Lucia.
 *
 * Also detects presentations that are primarily internal medicine / allied
 * health and flags them for appropriate initial assessment or referral.
 *
 * Version 1.1.0 (2026-09-25, SURGEON-DECISIONS C9 / C1): adds the NG12 rules the clinical
 * validation found missing (nipple change ≥ 50, rectal bleeding ≥ 50, weight loss + abdominal
 * pain ≥ 40, visible haematuria ≥ 45), and rules that read LAB VALUES rather than text:
 * FIT ≥ 10 µg Hb/g (NICE DG56 2023 / BSG-ACPGBI 2022) and iron-deficiency anaemia from Hb +
 * ferritin (NICE NG12 2015; BSG 2021). Free text is matched negation-aware (negation.ts).
 * Every citation is unverified until the surgeon checks it (docs/clinical-validation).
 *
 * Asymptomatic, age-based screening (USPSTF) lives in ./screening/preventive.ts.
 */

import { Severity } from './rules';
import { joinClauses, testAffirmed } from './negation';

/** Rule-set version (clinical-content/registry.json `cancer-screening`). Bump with a changelog entry. */
export const CANCER_SCREENING_VERSION = '1.1.0';

export interface CancerScreenResult {
  triggered: boolean;
  criteria: CancerCriterion[];
  referralUrgency: 'two_week_wait' | 'urgent' | 'routine_screening' | 'none';
  recommendedInvestigation: string[];
  cancerType: string | null;
}

export interface CancerCriterion {
  rule: string;
  met: boolean;
  guideline: string;
  /**
   * Referral pathway when met. Absent = NG12 suspected-cancer (2-week-wait) referral. 'urgent'
   * marks an urgent-but-not-2WW investigation (BSG 2021 IDA under 60 years).
   */
  pathway?: 'two_week_wait' | 'urgent';
  /**
   * Set on the rules added in 1.1.0 (the red flags and lab results the clinical validation found
   * easy to miss). The consultation prompt strip shows these criteria; the older chip-based rules
   * reach the clinician through the triage banner only.
   */
  id?: string;
  /** Cancer site the criterion points to (1.1.0 rules). */
  site?: string;
  /** Investigations for this criterion when met (1.1.0 rules). */
  investigations?: string[];
}

/**
 * Laboratory values the lab-driven rules read. Hb in g/dL, ferritin in µg/L (= ng/mL), MCV in fL,
 * FIT in µg Hb/g faeces. `fitPositive` is set when a FIT result is recorded as positive/negative
 * without a number.
 */
export interface CancerScreenLabs {
  haemoglobinGdl?: number | null;
  ferritinUgL?: number | null;
  mcvFl?: number | null;
  fitUgHbG?: number | null;
  fitPositive?: boolean | null;
}

export interface ReferralRecommendation {
  specialty: string;
  reason: string;
  urgency: Severity | 'routine';
  isPrimarilySurgical: boolean;
}

export interface ScreeningInput {
  age: number | null;
  sex: 'male' | 'female' | 'other' | 'unknown';
  chiefComplaints: string[];
  symptoms: string[];
  familyHistory: string[];
  duration?: string;
  responses: Record<string, string | string[]>;
  /**
   * Clinician free text (HPI, assessment). Read negation-aware by the rules added in 1.1.0 only;
   * the older rules read the chips/complaints above.
   */
  freeText?: string;
  /** Structured lab values (see readCancerScreenLabs). */
  labs?: CancerScreenLabs;
}

// ── Lab reading ────────────────────────────────────────────────────────────

const HB_KEY = /\b(haemoglobin|hemoglobin|hb|hgb)\b/i;
const HB_EXCLUDE = /a1c|glyc|electrophoresis|hplc|urine|dipstick/i;
const FERRITIN_KEY = /\bferritin\b/i;
const MCV_KEY = /\bmcv\b|mean cell volume|mean corpuscular volume/i;
const FIT_KEY = /\bq?fit\b|faecal immunochemical|fecal immunochemical/i;

function firstNumber(v: string): number | null {
  const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads Hb, ferritin, MCV and FIT from a "result name → result text" map (the dashboard's
 * investigationResults). Names are matched on whole words, so "HbA1c" is not haemoglobin and
 * "benefit" is not FIT. Hb above 25 (or written in g/L) is converted to g/dL.
 */
export function readCancerScreenLabs(results: Record<string, string>): CancerScreenLabs {
  const out: CancerScreenLabs = {};
  for (const [name, raw] of Object.entries(results ?? {})) {
    const value = String(raw ?? '');
    if (!value.trim()) continue;
    if (out.haemoglobinGdl == null && HB_KEY.test(name) && !HB_EXCLUDE.test(name)) {
      const n = firstNumber(value);
      if (n !== null && n > 0) {
        const gPerL = /g\s*\/\s*l\b/i.test(value) && !/g\s*\/\s*dl/i.test(value);
        out.haemoglobinGdl = gPerL || n > 25 ? n / 10 : n;
      }
    } else if (out.ferritinUgL == null && FERRITIN_KEY.test(name)) {
      out.ferritinUgL = firstNumber(value);
    } else if (out.mcvFl == null && MCV_KEY.test(name)) {
      out.mcvFl = firstNumber(value);
    } else if (out.fitUgHbG == null && out.fitPositive == null && FIT_KEY.test(name)) {
      const n = firstNumber(value);
      const below = /(<|less than|below)\s*\d/i.test(value);
      if (n !== null) {
        out.fitUgHbG = below ? Math.max(0, n - 0.1) : n;
      } else if (/\bnot detected\b|\bnegative\b/i.test(value)) {
        out.fitPositive = false;
      } else if (/\bpositive\b|\bdetected\b/i.test(value)) {
        out.fitPositive = true;
      }
    }
  }
  return out;
}

/** WHO / BSG 2021 anaemia thresholds: Hb < 13.0 g/dL (men), < 12.0 g/dL (non-pregnant women). */
export function isAnaemic(hbGdl: number | null | undefined, sex: ScreeningInput['sex']): boolean {
  if (hbGdl == null) return false;
  const threshold = sex === 'male' ? 13.0 : 12.0; // unknown sex: the lower (female) threshold
  return hbGdl < threshold;
}

/**
 * Iron-deficiency anaemia on bloods: anaemia plus serum ferritin < 45 µg/L (BSG 2021, Snook et
 * al., Gut 2021: 45 µg/L is the recommended cut-off; < 15 µg/L is diagnostic).
 */
export function hasLabIronDeficiencyAnaemia(labs: CancerScreenLabs | undefined, sex: ScreeningInput['sex']): boolean {
  if (!labs) return false;
  return isAnaemic(labs.haemoglobinGdl, sex) && labs.ferritinUgL != null && labs.ferritinUgL < 45;
}

/** FIT ≥ 10 µg Hb/g faeces (NICE DG56 2023; BSG/ACPGBI FIT guideline 2022), or recorded positive. */
export function isFitPositive(labs: CancerScreenLabs | undefined): boolean {
  if (!labs) return false;
  if (labs.fitUgHbG != null) return labs.fitUgHbG >= 10;
  return labs.fitPositive === true;
}

// ── NICE NG12 2-Week-Wait Cancer Criteria ─────────────────────────────────

export function screenForCancer(input: ScreeningInput): CancerScreenResult {
  const criteria: CancerCriterion[] = [];
  const investigations: string[] = [];
  let cancerType: string | null = null;
  const age = input.age ?? 0;
  const cc = input.chiefComplaints.map(c => c.toLowerCase());
  const sx = input.symptoms.map(s => s.toLowerCase());
  // One clause per chip / complaint, so a negation in one item cannot reach the next; every text
  // test below is negation-aware ("no weight loss" in a chip or the free text does not count).
  const all = joinClauses([...cc, ...sx]);
  const text = joinClauses([...cc, ...sx, input.freeText ?? '']);
  const fhx = joinClauses(input.familyHistory.map(f => f.toLowerCase()));
  const r = input.responses;
  const labs = input.labs;
  const sex = input.sex;
  const t = (re: RegExp, s: string = all) => testAffirmed(re, s);

  // --- Colorectal cancer ---
  const hasRectalBleeding = cc.includes('rectal_bleeding') || t(/rectal bleed|blood in stool|pr bleed/i);
  const hasBowelChange = cc.includes('change_in_bowel_habit') || t(/bowel habit change|alternating/i);
  const hasDarkStool = r['rectal_bleeding_character'] === 'dark_tarry';
  const hasWeightLoss = cc.includes('weight_loss') || t(/weight loss/i);
  const hasIronDeficiency = t(/anaemia|pale|unusually tired/i);
  const hasFhxCRC = t(/bowel|colon|colorectal|rectal/i, fhx);
  // 1.1.0 rules: chips/complaints plus the clinician's free text, whole-word, negation-aware.
  const txRectalBleeding = hasRectalBleeding
    || t(/\b(rectal bleed(ing)?|bleeding per rectum|blood (in|mixed with|on) (the )?(stools?|faeces|feces)|bright red blood|haematochezia|hematochezia|pr bleed(ing)?)\b/i, text);
  const txWeightLoss = hasWeightLoss || t(/\b(weight loss|losing weight|lost \d+(\.\d+)? ?(kg|lb|kilos?|pounds))\b/i, text);
  const txAbdoPain = cc.includes('abdominal_pain')
    || t(/\b(abdominal pain|abdominal discomfort|tummy pain|belly pain|abdominal cramps?|abdominal cramping)\b/i, text);
  const labIda = hasLabIronDeficiencyAnaemia(labs, sex);
  const fitPositive = isFitPositive(labs);

  // NICE NG12: age >=40 with rectal bleeding + change in bowel habit
  criteria.push({
    rule: 'Age >=40 with rectal bleeding AND change in bowel habit',
    met: age >= 40 && hasRectalBleeding && hasBowelChange,
    guideline: 'NICE NG12 1.3.1',
  });

  // NICE NG12: age >=60 with change in bowel habit alone
  criteria.push({
    rule: 'Age >=60 with unexplained change in bowel habit',
    met: age >= 60 && hasBowelChange,
    guideline: 'NICE NG12 1.3.2',
  });

  // NICE NG12: age >=60 with iron deficiency anaemia
  criteria.push({
    rule: 'Age >=60 with iron deficiency anaemia',
    met: age >= 60 && hasIronDeficiency,
    guideline: 'NICE NG12 1.3.4',
  });

  // BSG: rectal bleeding with dark tarry stool at any age
  criteria.push({
    rule: 'Dark tarry stool (melaena) at any age',
    met: !!hasDarkStool,
    guideline: 'BSG upper/lower GI bleed',
  });

  // Family history + symptoms
  criteria.push({
    rule: 'Family history of colorectal cancer with GI symptoms',
    met: hasFhxCRC && (hasRectalBleeding || hasBowelChange),
    guideline: 'BSG polyp surveillance',
  });

  // NICE NG12 (2015) 1.3.1: aged 50 and over with unexplained rectal bleeding. (The 2023 NG12
  // update puts FIT first for this group; direct referral is kept here as the more conservative
  // choice for a practice without a FIT pathway — listed for sign-off.)
  const lowerGiInvestigations = ['Colonoscopy', 'FBC with iron studies'];
  // BSG 2021: IDA → bidirectional endoscopy (OGD + colonoscopy), coeliac serology and urinalysis.
  const idaInvestigations = ['Colonoscopy', 'OGD (bidirectional endoscopy with colonoscopy)', 'Coeliac serology (tTG-IgA)', 'Urinalysis'];
  criteria.push({
    rule: 'Age >=50 with unexplained rectal bleeding',
    met: age >= 50 && txRectalBleeding,
    guideline: 'NICE NG12 1.3.1 (2015)',
    id: 'ng12-rectal-bleeding-50', site: 'colorectal', investigations: lowerGiInvestigations,
  });

  // NICE NG12 (2015) 1.3.1: aged 40 and over with unexplained weight loss and abdominal pain.
  criteria.push({
    rule: 'Age >=40 with unexplained weight loss AND abdominal pain (colorectal)',
    met: age >= 40 && txWeightLoss && txAbdoPain,
    guideline: 'NICE NG12 1.3.1 (2015)',
    id: 'ng12-weight-loss-abdominal-pain-40', site: 'colorectal', investigations: lowerGiInvestigations,
  });

  // NICE DG56 (2023) / NG12 2023 update; BSG-ACPGBI FIT guideline (Monahan, Gut 2022):
  // FIT ≥ 10 µg Hb/g faeces → suspected colorectal cancer pathway referral, at any age.
  criteria.push({
    rule: 'FIT >=10 µg Hb/g faeces (colorectal)',
    met: fitPositive,
    guideline: 'NICE DG56 (2023); BSG/ACPGBI FIT 2022',
    id: 'fit-10', site: 'colorectal', investigations: lowerGiInvestigations,
  });

  // NICE NG12 (2015) 1.3.1: aged 60 and over with iron-deficiency anaemia — read from Hb + ferritin.
  criteria.push({
    rule: 'Age >=60 with iron deficiency anaemia on blood results (colorectal)',
    met: age >= 60 && labIda,
    guideline: 'NICE NG12 1.3.1 (2015); BSG 2021 IDA thresholds',
    id: 'ng12-ida-60', site: 'colorectal / upper GI', investigations: idaInvestigations,
  });

  // BSG 2021 IDA guideline (Snook, Gut 2021): bidirectional endoscopy (OGD + colonoscopy) for
  // men and post-menopausal women with IDA, with or without GI symptoms. Age ≥ 50 stands in for
  // post-menopausal status (menopausal status is not recorded). Urgent, not 2-week-wait, under 60.
  criteria.push({
    rule: 'Iron deficiency anaemia in a man or a woman aged >=50: bidirectional endoscopy (colorectal / upper GI)',
    met: labIda && age >= 18 && age < 60 && (sex === 'male' || age >= 50),
    guideline: 'BSG 2021 iron deficiency anaemia',
    pathway: 'urgent',
    id: 'bsg-ida', site: 'colorectal / upper GI', investigations: idaInvestigations,
  });

  // Parenthesised: `c.met && a || b || c` was true whenever any colorectal rule merely existed,
  // so every 2-week-wait screen (breast, upper GI, pancreas) was labelled colorectal. The IDA
  // rule belongs to this block (NG12 colorectal) and was labelled colorectal before, so it stays.
  if (criteria.some(c => c.met && (c.rule.includes('colorectal') || c.rule.includes('bowel') || c.rule.includes('rectal') || c.rule.includes('tarry') || c.rule.includes('iron deficiency')))) {
    cancerType = 'colorectal';
    investigations.push('Colonoscopy', 'FBC with iron studies', 'CEA');
    if (hasDarkStool) investigations.push('OGD (to exclude upper GI source)');
    if (labIda) investigations.push(...idaInvestigations);
  }

  // --- Upper GI / oesophago-gastric cancer ---
  const hasDysphagia = cc.includes('difficulty_swallowing') || t(/dysphagia|swallowing/i);
  const hasAlarmGI = hasWeightLoss || hasDysphagia || t(/loss of appetite|early satiety/i);

  // NICE NG12: age >=55 with weight loss and upper GI symptoms
  criteria.push({
    rule: 'Age >=55 with weight loss AND upper abdominal symptoms or reflux',
    met: age >= 55 && hasWeightLoss && t(/reflux|heartburn|epigastric|abdominal pain|dyspepsia/i),
    guideline: 'NICE NG12 1.6.1',
  });

  // NICE NG12: dysphagia at any age
  criteria.push({
    rule: 'New dysphagia at any age',
    met: hasDysphagia,
    guideline: 'NICE NG12 1.6.2',
  });

  // Age >=55 with persistent dyspepsia + alarm features
  criteria.push({
    rule: 'Age >=55 with treatment-resistant dyspepsia',
    met: age >= 55 && t(/reflux|heartburn|dyspepsia|acid/i) && hasAlarmGI,
    guideline: 'NICE NG12 1.6.3',
  });

  if (criteria.some(c => c.met && (c.rule.includes('dysphagia') || c.rule.includes('upper abdominal') || c.rule.includes('dyspepsia')))) {
    cancerType = cancerType ?? 'oesophago-gastric';
    investigations.push('OGD (oesophago-gastro-duodenoscopy)');
    if (hasWeightLoss) investigations.push('CT abdomen/pelvis');
  }

  // --- Breast cancer ---
  const hasBreastLump = cc.includes('breast_concern') || cc.includes('lump_or_mass') || t(/breast lump|breast mass/i);
  const hasNippleDischarge = t(/bloody nipple|nipple discharge.*bloody/i) || r['nipple_discharge_type'] === 'bloody';
  const hasSkinChanges = t(/dimpling|puckering|skin changes.*breast|peau d.orange/i) || r['skin_changes'] === 'true';
  const hasBreastFhx = t(/breast|ovarian|brca/i, fhx);
  const lumpGrowing = r['breast_lump_change'] === 'getting_larger';
  // NG12 1.8: discharge, retraction or other change of concern in ONE nipple. Bilateral wording
  // excludes it; laterality not recorded counts (conservative).
  const nippleChange = cc.includes('nipple_discharge') || !!r['nipple_discharge_type']
    || t(/\b(nipple discharge|discharge from (the |her |his |my )?(left |right )?nipple|bloody nipple|blood-stained (nipple )?discharge|nipple (retraction|inversion|change|eczema|crusting)|(retracted|inverted) nipple)\b/i, text);
  const nippleBilateral = t(/\bbilateral\b[^.]{0,30}\bnipple|\bnipple[^.]{0,30}\b(bilateral|both (breasts|nipples|sides))\b/i, text);

  // NICE NG12: age >=30 with unexplained breast lump
  criteria.push({
    rule: 'Age >=30 with unexplained breast lump',
    met: age >= 30 && hasBreastLump,
    guideline: 'NICE NG12 1.8.1',
  });

  // Any age with breast lump + skin changes or bloody discharge
  criteria.push({
    rule: 'Breast lump with skin changes or bloody nipple discharge',
    met: hasBreastLump && (hasSkinChanges || hasNippleDischarge),
    guideline: 'NICE NG12 1.8.2',
  });

  // Growing lump
  criteria.push({
    rule: 'Breast lump getting larger',
    met: hasBreastLump && !!lumpGrowing,
    guideline: 'NICE NG12 1.8.3',
  });

  // NICE NG12 (2015) 1.8.1: aged 50 and over with discharge, retraction or other changes of
  // concern in one nipple only.
  const bloodyNippleDischarge = hasNippleDischarge
    || t(/\b(blood[- ]stained|bloody|haemoserous|serosanguinous)\b[^.]{0,30}\b(nipple|discharge)\b/i, text);
  // Single-duct bloody discharge with normal imaging: duct excision for histology (ACR
  // Appropriateness Criteria, evaluation of nipple discharge, 2022).
  const ductExcision = 'Microdochectomy / duct excision if imaging is normal';
  criteria.push({
    rule: 'Age >=50 with discharge, retraction or other change in one nipple (breast)',
    met: age >= 50 && nippleChange && !nippleBilateral,
    guideline: 'NICE NG12 1.8.1 (2015)',
    id: 'ng12-nipple-50', site: 'breast',
    investigations: ['Mammogram', 'Breast ultrasound', ...(bloodyNippleDischarge ? [ductExcision] : [])],
  });

  if (criteria.some(c => c.met && c.rule.toLowerCase().includes('breast'))) { // "Breast lump …" rules start with a capital
    cancerType = cancerType ?? 'breast';
    investigations.push('Breast ultrasound', 'Mammogram');
    if (bloodyNippleDischarge) {
      investigations.push('Ductogram or MRI breast');
      if (nippleChange) investigations.push(ductExcision);
    }
    if (hasBreastFhx) investigations.push('BRCA risk assessment');
  }

  // --- Pancreatic cancer ---
  const hasJaundice = cc.includes('jaundice') || t(/jaundice|yellow/i);

  criteria.push({
    rule: 'Age >=40 with jaundice',
    met: age >= 40 && hasJaundice,
    guideline: 'NICE NG12 1.10.1',
  });

  criteria.push({
    rule: 'Unexplained weight loss with new-onset back or epigastric pain',
    met: hasWeightLoss && t(/back pain|epigastric/i),
    guideline: 'NICE NG12 1.10.2',
  });

  if (criteria.some(c => c.met && (c.rule.includes('jaundice') || c.rule.includes('epigastric pain')))) {
    cancerType = cancerType ?? 'pancreatic';
    investigations.push('CT pancreas protocol', 'LFTs', 'CA 19-9');
    if (hasJaundice) investigations.push('MRCP or ERCP');
  }

  // --- Bladder / renal cancer ---
  // NICE NG12 (2015) 1.6 (bladder): aged 45 and over with unexplained visible haematuria without
  // urinary tract infection. "Unexplained": not counted with a recorded UTI, dysuria, loin pain,
  // renal colic or stone; non-visible (dipstick/microscopic) haematuria is not this rule.
  const visibleHaematuria = cc.includes('haematuria') || cc.includes('blood_in_urine')
    || t(/\b(haematuria|hematuria|blood in (the |his |her |my )?urine|red urine|passing blood in (the )?urine)\b/i, text);
  const nonVisibleOnly = t(/\b(non-visible|nonvisible|microscopic|dipstick) (haematuria|hematuria)\b/i, text)
    && !t(/\b(visible|frank|macroscopic|gross) (haematuria|hematuria)\b/i, text);
  const haematuriaExplained = t(/\b(uti|urinary tract infection|cystitis|dysuria|loin pain|flank pain|renal colic|ureteric colic|kidney stones?|renal stones?|ureteric stones?|urolithiasis|calculus|calculi)\b/i, text);
  criteria.push({
    rule: 'Age >=45 with unexplained visible haematuria (urological)',
    met: age >= 45 && visibleHaematuria && !nonVisibleOnly && !haematuriaExplained,
    guideline: 'NICE NG12 1.6 (2015) bladder cancer',
    id: 'ng12-haematuria-45', site: 'urological',
    investigations: ['Cystoscopy', 'CT urogram', 'Urine culture (exclude UTI)', 'U&E / eGFR'],
  });

  if (criteria.some(c => c.met && c.rule.includes('haematuria'))) {
    cancerType = cancerType ?? 'urological';
    investigations.push('Cystoscopy', 'CT urogram', 'Urine culture (exclude UTI)', 'U&E / eGFR');
  }

  const metCriteria = criteria.filter(c => c.met);
  let referralUrgency: CancerScreenResult['referralUrgency'] = 'none';
  if (metCriteria.some(c => (c.pathway ?? 'two_week_wait') === 'two_week_wait')) {
    referralUrgency = 'two_week_wait';
  } else if (metCriteria.length > 0) {
    referralUrgency = 'urgent';
  }

  return {
    triggered: metCriteria.length > 0,
    criteria,
    referralUrgency,
    recommendedInvestigation: [...new Set(investigations)],
    cancerType,
  };
}

// ── Internal Medicine / Allied Referral Detection ─────────────────────────

const INTERNAL_MEDICINE_PATTERNS: Array<{
  pattern: RegExp;
  specialty: string;
  reason: string;
  urgency: Severity | 'routine';
}> = [
  // Cardiology
  { pattern: /(chest pain|angina|palpitations|heart racing|atrial fibrillation|heart failure|shortness of breath.{0,20}(exertion|lying|climbing))/i, specialty: 'Cardiology', reason: 'Cardiac symptoms requiring medical assessment', urgency: 'priority' },

  // Respiratory
  { pattern: /(chronic cough|asthma|copd|emphysema|wheezing.{0,15}(persistent|chronic)|sleep apn[eo]a)/i, specialty: 'Respiratory Medicine', reason: 'Respiratory condition requiring medical management', urgency: 'routine' },
  { pattern: /(coughing.{0,10}blood|haemoptysis|hemoptysis)/i, specialty: 'Respiratory Medicine', reason: 'Haemoptysis — requires urgent chest imaging and referral', urgency: 'urgent' },

  // Endocrinology
  { pattern: /(thyroid (disorder|problem|overactive|underactive)|hyperthyroid|hypothyroid|diabetes (control|management|type [12])|hba1c|adrenal|cushing)/i, specialty: 'Endocrinology', reason: 'Endocrine condition requiring specialist management', urgency: 'routine' },

  // Rheumatology
  { pattern: /(joint (pain|swelling).{0,20}(multiple|both|bilateral)|rheumatoid|lupus|sle|gout|autoimmune)/i, specialty: 'Rheumatology', reason: 'Multi-joint or autoimmune symptoms', urgency: 'routine' },

  // Nephrology / Urology
  { pattern: /(kidney (stones?|failure|disease)|renal (failure|impairment)|dialysis|creatinine (raised|elevated|high))/i, specialty: 'Nephrology', reason: 'Renal condition requiring specialist review', urgency: 'routine' },
  { pattern: /(prostate|psa|urinary retention|haematuria|hematuria|blood in urine)/i, specialty: 'Urology', reason: 'Urological symptoms requiring assessment', urgency: 'priority' },

  // Dermatology (non-surgical skin)
  { pattern: /(eczema|psoriasis|dermatitis|chronic rash|fungal infection.{0,10}skin)/i, specialty: 'Dermatology', reason: 'Dermatological condition — non-surgical', urgency: 'routine' },

  // Neurology
  { pattern: /(headache.{0,15}(persistent|chronic|worst)|seizure|epilepsy|numbness.{0,15}(arm|leg|face)|weakness.{0,15}(one side|arm|leg|facial))/i, specialty: 'Neurology', reason: 'Neurological symptoms requiring specialist assessment', urgency: 'priority' },
  { pattern: /(sudden (weakness|numbness|vision loss|difficulty speaking)|stroke|tia)/i, specialty: 'Emergency / Neurology', reason: 'Possible stroke/TIA — emergency assessment', urgency: 'urgent' },

  // Orthopaedics
  { pattern: /(fracture|broken bone|joint replacement|knee (pain|replacement)|hip (pain|replacement)|back pain.{0,10}(chronic|severe)|sciatica|slipped disc)/i, specialty: 'Orthopaedics', reason: 'Musculoskeletal condition — orthopaedic referral', urgency: 'routine' },

  // Gynaecology (non-surgical)
  { pattern: /(irregular (period|menstruation|bleeding)|heavy (period|menstrual)|endometriosis|pcos|ovarian cyst|pelvic pain.{0,15}(chronic|cyclical))/i, specialty: 'Gynaecology', reason: 'Gynaecological symptoms — specialist referral', urgency: 'routine' },

  // Psychiatry / Mental health
  { pattern: /(depression|anxiety|panic attacks?|suicidal|self.?harm|mental health)/i, specialty: 'Psychiatry / Mental Health', reason: 'Mental health concern — specialist referral', urgency: 'priority' },

  // ENT
  { pattern: /(ear (pain|infection|discharge)|hearing loss|tinnitus|sinus(itis)?|nosebleed.{0,10}(recurrent|persistent)|hoarse voice.{0,10}(persistent|over 3 weeks))/i, specialty: 'ENT', reason: 'Ear, nose, or throat symptoms', urgency: 'routine' },

  // Ophthalmology
  { pattern: /(vision (loss|change|blurred)|eye (pain|red|swollen)|diabetic retinopathy|glaucoma)/i, specialty: 'Ophthalmology', reason: 'Eye symptoms requiring specialist assessment', urgency: 'priority' },
];

export function detectReferrals(input: ScreeningInput): ReferralRecommendation[] {
  // One clause per item and negation-aware ("no chest pain" is not a cardiology referral).
  const all = joinClauses([
    ...input.chiefComplaints,
    ...input.symptoms,
    ...Object.values(input.responses).flat(),
  ]);

  const referrals: ReferralRecommendation[] = [];
  const seenSpecialties = new Set<string>();

  for (const { pattern, specialty, reason, urgency } of INTERNAL_MEDICINE_PATTERNS) {
    if (testAffirmed(pattern, all) && !seenSpecialties.has(specialty)) {
      seenSpecialties.add(specialty);
      referrals.push({ specialty, reason, urgency, isPrimarilySurgical: false });
    }
  }

  return referrals;
}
