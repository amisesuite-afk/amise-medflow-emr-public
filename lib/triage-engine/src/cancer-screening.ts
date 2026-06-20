/**
 * Cancer screening criteria based on NICE NG12 (2-week-wait referral)
 * and BSG/ACG guidelines, adapted for Dr Kabiye's surgical/endoscopy
 * practice in Saint Lucia.
 *
 * Also detects presentations that are primarily internal medicine / allied
 * health and flags them for appropriate initial assessment or referral.
 */

import { Severity } from './rules';

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
}

// ── NICE NG12 2-Week-Wait Cancer Criteria ─────────────────────────────────

export function screenForCancer(input: ScreeningInput): CancerScreenResult {
  const criteria: CancerCriterion[] = [];
  const investigations: string[] = [];
  let cancerType: string | null = null;
  const age = input.age ?? 0;
  const cc = input.chiefComplaints.map(c => c.toLowerCase());
  const sx = input.symptoms.map(s => s.toLowerCase());
  const all = [...cc, ...sx].join(' ');
  const fhx = input.familyHistory.map(f => f.toLowerCase()).join(' ');
  const r = input.responses;

  // --- Colorectal cancer ---
  const hasRectalBleeding = cc.includes('rectal_bleeding') || /rectal bleed|blood in stool|pr bleed/i.test(all);
  const hasBowelChange = cc.includes('change_in_bowel_habit') || /bowel habit change|alternating/i.test(all);
  const hasDarkStool = r['rectal_bleeding_character'] === 'dark_tarry';
  const hasWeightLoss = cc.includes('weight_loss') || /weight loss/i.test(all);
  const hasIronDeficiency = /anaemia|pale|unusually tired/i.test(all);
  const hasFhxCRC = /bowel|colon|colorectal|rectal/i.test(fhx);

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

  if (criteria.some(c => c.met && c.rule.includes('colorectal') || c.rule.includes('bowel') || c.rule.includes('rectal') || c.rule.includes('tarry'))) {
    cancerType = 'colorectal';
    investigations.push('Colonoscopy', 'FBC with iron studies', 'CEA');
    if (hasDarkStool) investigations.push('OGD (to exclude upper GI source)');
  }

  // --- Upper GI / oesophago-gastric cancer ---
  const hasDysphagia = cc.includes('difficulty_swallowing') || /dysphagia|swallowing/i.test(all);
  const hasAlarmGI = hasWeightLoss || hasDysphagia || /loss of appetite|early satiety/i.test(all);

  // NICE NG12: age >=55 with weight loss and upper GI symptoms
  criteria.push({
    rule: 'Age >=55 with weight loss AND upper abdominal symptoms or reflux',
    met: age >= 55 && hasWeightLoss && /reflux|heartburn|epigastric|abdominal pain|dyspepsia/i.test(all),
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
    met: age >= 55 && /reflux|heartburn|dyspepsia|acid/i.test(all) && hasAlarmGI,
    guideline: 'NICE NG12 1.6.3',
  });

  if (criteria.some(c => c.met && (c.rule.includes('dysphagia') || c.rule.includes('upper abdominal') || c.rule.includes('dyspepsia')))) {
    cancerType = cancerType ?? 'oesophago-gastric';
    investigations.push('OGD (oesophago-gastro-duodenoscopy)');
    if (hasWeightLoss) investigations.push('CT abdomen/pelvis');
  }

  // --- Breast cancer ---
  const hasBreastLump = cc.includes('breast_concern') || cc.includes('lump_or_mass') || /breast lump|breast mass/i.test(all);
  const hasNippleDischarge = /bloody nipple|nipple discharge.*bloody/i.test(all) || r['nipple_discharge_type'] === 'bloody';
  const hasSkinChanges = /dimpling|puckering|skin changes.*breast|peau d.orange/i.test(all) || r['skin_changes'] === 'true';
  const hasBreastFhx = /breast|ovarian|brca/i.test(fhx);
  const lumpGrowing = r['breast_lump_change'] === 'getting_larger';

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

  if (criteria.some(c => c.met && c.rule.includes('breast'))) {
    cancerType = cancerType ?? 'breast';
    investigations.push('Breast ultrasound', 'Mammogram');
    if (hasNippleDischarge) investigations.push('Ductogram or MRI breast');
    if (hasBreastFhx) investigations.push('BRCA risk assessment');
  }

  // --- Pancreatic cancer ---
  const hasJaundice = cc.includes('jaundice') || /jaundice|yellow/i.test(all);

  criteria.push({
    rule: 'Age >=40 with jaundice',
    met: age >= 40 && hasJaundice,
    guideline: 'NICE NG12 1.10.1',
  });

  criteria.push({
    rule: 'Unexplained weight loss with new-onset back or epigastric pain',
    met: hasWeightLoss && /back pain|epigastric/i.test(all),
    guideline: 'NICE NG12 1.10.2',
  });

  if (criteria.some(c => c.met && (c.rule.includes('jaundice') || c.rule.includes('epigastric pain')))) {
    cancerType = cancerType ?? 'pancreatic';
    investigations.push('CT pancreas protocol', 'LFTs', 'CA 19-9');
    if (hasJaundice) investigations.push('MRCP or ERCP');
  }

  const metCriteria = criteria.filter(c => c.met);
  let referralUrgency: CancerScreenResult['referralUrgency'] = 'none';
  if (metCriteria.length > 0) {
    referralUrgency = 'two_week_wait';
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
  const all = [
    ...input.chiefComplaints,
    ...input.symptoms,
    ...Object.values(input.responses).flat(),
  ].join(' ');

  const referrals: ReferralRecommendation[] = [];
  const seenSpecialties = new Set<string>();

  for (const { pattern, specialty, reason, urgency } of INTERNAL_MEDICINE_PATTERNS) {
    if (pattern.test(all) && !seenSpecialties.has(specialty)) {
      seenSpecialties.add(specialty);
      referrals.push({ specialty, reason, urgency, isPrimarilySurgical: false });
    }
  }

  return referrals;
}
