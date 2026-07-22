/**
 * Clinical scoring engine — pure deterministic functions.
 * All thresholds from published guidelines: TG18, Ranson 1974/1982, BISAP 2008.
 * Inputs come from vitals (AppContext) + extractedLabs (referral/in-house results).
 */

// ── Extracted lab values ──────────────────────────────────────────────────────
export interface ExtractedLabs {
  wbc?: number | null;            // ×10⁹/L
  haemoglobin?: number | null;    // g/L
  platelets?: number | null;      // ×10⁹/L
  inr?: number | null;
  crp?: number | null;            // mg/L
  bilirubin_total?: number | null; // µmol/L
  bilirubin_direct?: number | null; // µmol/L
  alp?: number | null;            // IU/L  (ULN ~130)
  ggt?: number | null;            // IU/L  (ULN ~65 M / 45 F)
  ast?: number | null;            // IU/L  (ULN ~40)
  alt?: number | null;            // IU/L  (ULN ~40)
  albumin?: number | null;        // g/L   (LLN ~35)
  sodium?: number | null;         // mmol/L
  potassium?: number | null;      // mmol/L
  urea?: number | null;           // mmol/L  (BUN ×2.14 for mg/dL)
  creatinine?: number | null;     // µmol/L
  egfr?: number | null;           // mL/min/1.73m²
  glucose?: number | null;        // mmol/L
  hba1c?: number | null;          // mmol/mol
  amylase?: number | null;        // IU/L
  lipase?: number | null;         // IU/L
  ldh?: number | null;            // IU/L  (ULN ~250)
  calcium?: number | null;        // mmol/L
  pao2?: number | null;           // mmHg
  hct?: number | null;            // fraction 0–1 (e.g. 0.42)
  ca19_9?: number | null;
  cea?: number | null;
  afp?: number | null;
  source?: 'referral_letter' | 'in_house' | 'manual';
}

// ── Vitals subset used by scoring ─────────────────────────────────────────────
export interface ScoringVitals {
  temperatureC?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  systolicBp?: number | null;
  spo2?: number | null;
}

// ── Shared result shape ───────────────────────────────────────────────────────
export interface ScoreResult {
  score: number;
  grade: string;          // "I" / "II" / "III" / "mild" / "moderate" / "severe" / numeric
  label: string;          // human-readable classification
  colour: 'green' | 'amber' | 'red';
  criteria_met: string[];
  missing_inputs: string[]; // fields needed but not supplied
  complete: boolean;       // true if all required inputs are present
}

// ── Helper ────────────────────────────────────────────────────────────────────
function n(v: number | null | undefined): number | null {
  return v ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKYO GUIDELINES 2018 — ACUTE CHOLANGITIS
// ═══════════════════════════════════════════════════════════════════════════════
export interface TokyoCholangitisInputs {
  // A — Systemic inflammation
  fever_or_chills: boolean;        // temp ≥38 °C or chills
  wbc_abnormal?: boolean;          // WBC >10 or <4 ×10⁹/L (auto-computed from labs)
  crp_elevated?: boolean;          // CRP ≥1 mg/dL = ≥10 mg/L (auto-computed)
  // B — Cholestasis
  jaundice?: boolean;              // bilirubin ≥34 µmol/L (2 mg/dL) or clinical
  liver_enzymes_elevated?: boolean; // ALP/GGT/AST/ALT >1.5× ULN (auto-computed)
  // C — Imaging
  biliary_dilatation: boolean;
  biliary_cause_on_imaging: boolean; // stone, stricture, stent visible
  // Severity modifiers (Grade II/III)
  high_fever?: boolean;            // ≥39 °C
  age_over_75?: boolean;
  bilirubin_high?: boolean;        // ≥85 µmol/L (5 mg/dL)
  albumin_low?: boolean;           // <0.7× LLN (~<24.5 g/L)
  // Grade III — organ dysfunction flags
  organ_dysfunction?: Array<'cardiovascular' | 'neurological' | 'respiratory' | 'renal' | 'hepatic' | 'haematological'>;
}

export function scoreTokyoCholangitis(
  inputs: Partial<TokyoCholangitisInputs>,
  labs: ExtractedLabs,
  vitals: ScoringVitals,
): ScoreResult {
  const missing: string[] = [];

  // Auto-derive from labs where possible
  const wbcAbnormal = n(labs.wbc) !== null
    ? (labs.wbc! > 10 || labs.wbc! < 4)
    : inputs.wbc_abnormal ?? null;
  if (wbcAbnormal === null) missing.push('WBC');

  const crpElevated = n(labs.crp) !== null
    ? labs.crp! >= 10    // ≥10 mg/L = ≥1 mg/dL
    : inputs.crp_elevated ?? null;
  if (crpElevated === null) missing.push('CRP');

  const tempC = n(vitals.temperatureC);
  const feverFromVitals = tempC !== null ? tempC >= 38.0 : null;
  const fever = inputs.fever_or_chills || (feverFromVitals === true);
  const highFever = inputs.high_fever || (tempC !== null && tempC >= 39.0);
  const ageMod = inputs.age_over_75 ?? false;

  const bilirubin = n(labs.bilirubin_total);
  const jaundice = bilirubin !== null
    ? bilirubin >= 34
    : inputs.jaundice ?? null;
  if (jaundice === null) missing.push('Bilirubin');
  const bilirubinHigh = bilirubin !== null ? bilirubin >= 85 : inputs.bilirubin_high ?? false;

  const alkphosULN = 130; const ggtULN = 65; const astULN = 40; const altULN = 40;
  const enzymeElevated = (labs.alp && labs.alp > alkphosULN * 1.5)
    || (labs.ggt && labs.ggt > ggtULN * 1.5)
    || (labs.ast && labs.ast > astULN * 1.5)
    || (labs.alt && labs.alt > altULN * 1.5)
    || inputs.liver_enzymes_elevated;

  const albumin = n(labs.albumin);
  const albuminLow = albumin !== null ? albumin < 24.5 : inputs.albumin_low ?? false;

  // Criterion sets
  const A = fever || wbcAbnormal === true || crpElevated === true;
  const B = jaundice === true || enzymeElevated;
  const C = inputs.biliary_dilatation || inputs.biliary_cause_on_imaging;

  const criteriaMet: string[] = [];
  if (fever || feverFromVitals) criteriaMet.push('A1 fever/chills');
  if (wbcAbnormal) criteriaMet.push('A2 WBC abnormal');
  if (crpElevated) criteriaMet.push('A3 CRP elevated');
  if (jaundice) criteriaMet.push('B1 jaundice/hyperbilirubinaemia');
  if (enzymeElevated) criteriaMet.push('B2 liver enzymes elevated');
  if (inputs.biliary_dilatation) criteriaMet.push('C1 biliary dilatation');
  if (inputs.biliary_cause_on_imaging) criteriaMet.push('C2 causative finding on imaging');

  // Diagnosis requires A + C (B supports but not required for diagnosis)
  const diagnosed = A && C;

  if (!diagnosed) {
    return {
      score: 0, grade: '—', label: 'Criteria not met for cholangitis diagnosis',
      colour: 'green', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  // Severity grading
  const orgDys = inputs.organ_dysfunction ?? [];
  if (orgDys.length > 0) {
    return {
      score: 3, grade: 'III', label: 'Severe cholangitis — organ dysfunction',
      colour: 'red', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  const gradeIIMod = [highFever, ageMod, bilirubinHigh, albuminLow].filter(Boolean).length;
  if (gradeIIMod >= 2) {
    return {
      score: 2, grade: 'II', label: 'Moderate cholangitis — early biliary drainage recommended',
      colour: 'amber', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  return {
    score: 1, grade: 'I', label: 'Mild cholangitis — antibiotics ± elective drainage',
    colour: 'green', criteria_met: criteriaMet,
    missing_inputs: missing, complete: missing.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKYO GUIDELINES 2018 — ACUTE CHOLECYSTITIS
// ═══════════════════════════════════════════════════════════════════════════════
export interface TokyoCholecystitisInputs {
  murphy_sign: boolean;
  ruq_pain_mass_tenderness: boolean;
  fever?: boolean;
  wbc_abnormal?: boolean;          // auto-derived
  crp_elevated?: boolean;          // auto-derived
  // Imaging (US/CT)
  us_wall_thickening?: boolean;    // >4 mm
  us_pericholecystic_fluid?: boolean;
  us_gb_enlargement?: boolean;     // >8 cm long or >4 cm wide
  us_echo_slurry?: boolean;
  us_non_enhanced_area?: boolean;  // CT gangrenous/ischaemic
  organ_dysfunction?: Array<'cardiovascular' | 'neurological' | 'respiratory' | 'renal' | 'hepatic' | 'haematological'>;
}

export function scoreTokyoCholecystitis(
  inputs: Partial<TokyoCholecystitisInputs>,
  labs: ExtractedLabs,
  vitals: ScoringVitals,
): ScoreResult {
  const missing: string[] = [];

  const wbcAbnormal = n(labs.wbc) !== null
    ? (labs.wbc! > 10 || labs.wbc! < 4)
    : inputs.wbc_abnormal ?? null;
  if (wbcAbnormal === null) missing.push('WBC');

  const crpElevated = n(labs.crp) !== null
    ? labs.crp! >= 10
    : inputs.crp_elevated ?? null;
  if (crpElevated === null) missing.push('CRP');

  const tempC = n(vitals.temperatureC);
  const fever = inputs.fever || (tempC !== null && tempC >= 38.0);

  const localA = inputs.murphy_sign || inputs.ruq_pain_mass_tenderness;
  const systemicB = fever || wbcAbnormal === true || crpElevated === true;
  const imagingC = inputs.us_wall_thickening || inputs.us_pericholecystic_fluid
    || inputs.us_gb_enlargement || inputs.us_echo_slurry || inputs.us_non_enhanced_area;

  const criteriaMet: string[] = [];
  if (inputs.murphy_sign) criteriaMet.push('A1 Murphy\'s sign');
  if (inputs.ruq_pain_mass_tenderness) criteriaMet.push('A1 RUQ pain/mass/tenderness');
  if (fever) criteriaMet.push('B1 fever');
  if (wbcAbnormal) criteriaMet.push('B2 WBC abnormal');
  if (crpElevated) criteriaMet.push('B3 CRP elevated');
  if (imagingC) criteriaMet.push('C characteristic imaging findings');

  if (!localA || !systemicB) {
    return {
      score: 0, grade: '—', label: 'Criteria not met for cholecystitis diagnosis',
      colour: 'green', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  const orgDys = inputs.organ_dysfunction ?? [];
  if (orgDys.length > 0) {
    return {
      score: 3, grade: 'III', label: 'Severe cholecystitis — urgent surgery or drainage',
      colour: 'red', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  // Grade II: elevated WBC >18, palpable tender mass, >72h, marked local inflammation
  if (wbcAbnormal && (labs.wbc && labs.wbc > 18)) {
    return {
      score: 2, grade: 'II', label: 'Moderate cholecystitis — early laparoscopic cholecystectomy',
      colour: 'amber', criteria_met: criteriaMet,
      missing_inputs: missing, complete: missing.length === 0,
    };
  }

  return {
    score: 1, grade: 'I', label: 'Mild cholecystitis — elective laparoscopic cholecystectomy',
    colour: 'green', criteria_met: criteriaMet,
    missing_inputs: missing, complete: missing.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RANSON'S CRITERIA — ACUTE PANCREATITIS
// ═══════════════════════════════════════════════════════════════════════════════
export type RansonAetiology = 'gallstone' | 'alcohol';

export interface RansonAdmissionInputs {
  aetiology: RansonAetiology;
  age?: number | null;
  wbc?: number | null;          // ×10⁹/L — auto-derived from labs
  glucose_mmol?: number | null; // auto-derived from labs
  ldh?: number | null;          // IU/L — auto-derived
  ast?: number | null;          // IU/L — auto-derived
}

export interface Ranson48hInputs {
  urea_rise_mmol?: number | null; // rise in BUN from admission (mmol/L)
  pao2_mmhg?: number | null;      // auto-derived from labs
  base_deficit?: number | null;   // mEq/L (negative = deficit)
  sequestration_litres?: number | null;
  hct_fall_fraction?: number | null; // absolute fall e.g. 0.10 = 10%
  calcium_mmol?: number | null;   // auto-derived
}

export interface RansonResult {
  admission_score: number;
  total_score: number | null;   // null if 48h data not yet available
  admission_criteria: string[];
  h48_criteria: string[];
  severity: 'mild' | 'moderate' | 'severe';
  predicted_mortality: string;
  colour: 'green' | 'amber' | 'red';
  missing_inputs: string[];
}

export function scoreRanson(
  admission: Partial<RansonAdmissionInputs>,
  h48: Partial<Ranson48hInputs> | null,
  labs: ExtractedLabs,
): RansonResult {
  const missing: string[] = [];
  const ae = admission.aetiology ?? 'gallstone';

  // Admission thresholds differ by aetiology
  const ageThresh    = ae === 'gallstone' ? 70 : 55;
  const wbcThresh    = ae === 'gallstone' ? 18 : 16;
  const glucThresh   = ae === 'gallstone' ? 12.2 : 11.1;
  const ldhThresh    = ae === 'gallstone' ? 400 : 350;

  const age     = n(admission.age);
  const wbc     = n(labs.wbc ?? admission.wbc);
  const glucose = n(labs.glucose ?? admission.glucose_mmol);
  const ldh     = n(labs.ldh ?? admission.ldh);
  const ast     = n(labs.ast ?? admission.ast);

  if (age === null) missing.push('Age');
  if (wbc === null) missing.push('WBC');
  if (glucose === null) missing.push('Blood glucose');
  if (ldh === null) missing.push('LDH');
  if (ast === null) missing.push('AST');

  const admCrit: string[] = [];
  let admScore = 0;

  if (age !== null && age > ageThresh)       { admScore++; admCrit.push(`Age >${ageThresh}`); }
  if (wbc !== null && wbc > wbcThresh)       { admScore++; admCrit.push(`WBC >${wbcThresh}`); }
  if (glucose !== null && glucose > glucThresh) { admScore++; admCrit.push(`Glucose >${glucThresh} mmol/L`); }
  if (ldh !== null && ldh > ldhThresh)       { admScore++; admCrit.push(`LDH >${ldhThresh} IU/L`); }
  if (ast !== null && ast > 250)             { admScore++; admCrit.push('AST >250 IU/L'); }

  if (!h48) {
    const col = admScore < 2 ? 'green' : admScore < 3 ? 'amber' : 'red';
    return {
      admission_score: admScore, total_score: null,
      admission_criteria: admCrit, h48_criteria: [],
      severity: admScore < 3 ? 'mild' : 'severe',
      predicted_mortality: admScore < 3 ? '<1%' : admScore < 5 ? '10–20%' : '>40%',
      colour: col, missing_inputs: missing,
    };
  }

  const calcium = n(labs.calcium ?? h48.calcium_mmol);
  const pao2    = n(labs.pao2 ?? h48.pao2_mmhg);
  const urea    = n(h48.urea_rise_mmol);
  const hctFall = n(h48.hct_fall_fraction);
  const baseD   = n(h48.base_deficit);
  const seq     = n(h48.sequestration_litres);

  if (calcium === null) missing.push('Calcium at 48h');
  if (pao2 === null) missing.push('PaO₂ at 48h');

  const h48Crit: string[] = [];
  let h48Score = 0;

  if (urea !== null && urea > 1.8)     { h48Score++; h48Crit.push('BUN rise >1.8 mmol/L'); }
  if (pao2 !== null && pao2 < 60)      { h48Score++; h48Crit.push('PaO₂ <60 mmHg'); }
  if (baseD !== null && baseD > 4)     { h48Score++; h48Crit.push('Base deficit >4 mEq/L'); }
  if (seq !== null && seq > 6)         { h48Score++; h48Crit.push('Fluid sequestration >6 L'); }
  if (hctFall !== null && hctFall > 0.10) { h48Score++; h48Crit.push('Haematocrit fall >10%'); }
  if (calcium !== null && calcium < 2.0)  { h48Score++; h48Crit.push('Calcium <2.0 mmol/L'); }

  const total = admScore + h48Score;
  const severity = total < 3 ? 'mild' : total < 6 ? 'moderate' : 'severe';
  const mortality = total < 3 ? '<1%' : total < 5 ? '10–20%' : total < 7 ? '20–40%' : '>40%';
  const colour = total < 3 ? 'green' : total < 5 ? 'amber' : 'red';

  return {
    admission_score: admScore, total_score: total,
    admission_criteria: admCrit, h48_criteria: h48Crit,
    severity, predicted_mortality: mortality,
    colour, missing_inputs: missing,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BISAP SCORE — ACUTE PANCREATITIS
// ═══════════════════════════════════════════════════════════════════════════════
export interface BisapInputs {
  age?: number | null;
  gcs?: number | null;
  pleural_effusion?: boolean;
}

export interface BisapResult {
  score: number;
  items: string[];
  mortality_risk: string;
  colour: 'green' | 'amber' | 'red';
  missing_inputs: string[];
}

export function scoreBisap(
  inputs: Partial<BisapInputs>,
  labs: ExtractedLabs,
  vitals: ScoringVitals,
): BisapResult {
  const missing: string[] = [];
  const items: string[] = [];
  let score = 0;

  // BUN >8.9 mmol/L (>25 mg/dL)
  const urea = n(labs.urea);
  if (urea !== null) {
    if (urea > 8.9) { score++; items.push('BUN elevated (>8.9 mmol/L)'); }
  } else { missing.push('BUN/Urea'); }

  // Impaired mental status
  const gcs = n(inputs.gcs);
  if (gcs !== null) {
    if (gcs < 15) { score++; items.push('Impaired mental status (GCS <15)'); }
  } else { missing.push('GCS'); }

  // SIRS ≥2 criteria
  const temp = n(vitals.temperatureC);
  const hr   = n(vitals.heartRate);
  const rr   = n(vitals.respiratoryRate);
  const wbc  = n(labs.wbc);
  let sirsCount = 0;
  if (temp !== null && (temp > 38 || temp < 36)) sirsCount++;
  if (hr !== null && hr > 90) sirsCount++;
  if (rr !== null && rr > 20) sirsCount++;
  if (wbc !== null && (wbc > 12 || wbc < 4)) sirsCount++;
  if (temp !== null || hr !== null || rr !== null || wbc !== null) {
    if (sirsCount >= 2) { score++; items.push(`SIRS (${sirsCount}/4 criteria)`); }
  } else { missing.push('Vitals for SIRS'); }

  // Age >60
  const age = n(inputs.age);
  if (age !== null) {
    if (age > 60) { score++; items.push('Age >60'); }
  } else { missing.push('Age'); }

  // Pleural effusion
  if (inputs.pleural_effusion === true) { score++; items.push('Pleural effusion on imaging'); }

  const mortality = score === 0 ? '<1%' : score === 1 ? '<2%' : score === 2 ? '~2%'
    : score === 3 ? '~5%' : '≥14%';
  const colour = score <= 1 ? 'green' : score <= 2 ? 'amber' : 'red';

  return { score, items, mortality_risk: mortality, colour, missing_inputs: missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERCP — POST-ERCP PANCREATITIS (PEP) RISK
// ═══════════════════════════════════════════════════════════════════════════════
export interface ErpRiskInputs {
  // Patient risk factors
  female?: boolean;
  age_under_50?: boolean;
  suspected_sod?: boolean;        // sphincter of Oddi dysfunction
  prior_pep?: boolean;            // prior post-ERCP pancreatitis
  recurrent_pancreatitis?: boolean;
  normal_bilirubin?: boolean;     // auto-derived: bilirubin <17 µmol/L
  non_dilated_duct?: boolean;     // CBD <6 mm on imaging
  // Procedure factors (estimated pre-ERCP or entered post-procedure)
  precut_sphincterotomy?: boolean;
  balloon_dilation_intact_sphincter?: boolean;
  pancreatic_sphincterotomy?: boolean;
  difficult_cannulation?: boolean; // >10 min or >3 attempts
  trainee_operator?: boolean;
  contrast_into_pancreatic_duct?: boolean;
  // Protective factors
  pancreatic_stent_placed?: boolean;
  rectal_indomethacin_given?: boolean;
}

export interface PepRiskResult {
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';
  risk_factors: string[];
  protective_factors: string[];
  prophylaxis_recommendation: string;
  colour: 'green' | 'amber' | 'red';
}

export function scorePepRisk(inputs: Partial<ErpRiskInputs>, labs: ExtractedLabs): PepRiskResult {
  const riskFactors: string[] = [];
  const protective: string[] = [];
  let score = 0;

  // Patient factors
  if (inputs.female)                  { score += 1; riskFactors.push('Female sex'); }
  if (inputs.age_under_50)            { score += 1; riskFactors.push('Age <50'); }
  if (inputs.suspected_sod)           { score += 2; riskFactors.push('Suspected SOD'); }
  if (inputs.prior_pep)               { score += 2; riskFactors.push('Prior post-ERCP pancreatitis'); }
  if (inputs.recurrent_pancreatitis)  { score += 1; riskFactors.push('Recurrent pancreatitis'); }

  // Auto-derive normal bilirubin from labs
  const normalBili = labs.bilirubin_total !== null && labs.bilirubin_total !== undefined
    ? labs.bilirubin_total < 17
    : inputs.normal_bilirubin;
  if (normalBili)                     { score += 1; riskFactors.push('Normal bilirubin'); }
  if (inputs.non_dilated_duct)        { score += 1; riskFactors.push('Non-dilated bile duct'); }

  // Procedure factors
  if (inputs.difficult_cannulation)       { score += 2; riskFactors.push('Difficult cannulation'); }
  if (inputs.precut_sphincterotomy)       { score += 1; riskFactors.push('Precut sphincterotomy'); }
  if (inputs.balloon_dilation_intact_sphincter) { score += 2; riskFactors.push('Balloon dilation of intact sphincter'); }
  if (inputs.pancreatic_sphincterotomy)   { score += 1; riskFactors.push('Pancreatic sphincterotomy'); }
  if (inputs.contrast_into_pancreatic_duct) { score += 1; riskFactors.push('Contrast into pancreatic duct'); }
  if (inputs.trainee_operator)            { score += 1; riskFactors.push('Trainee operator'); }

  // Protective
  if (inputs.pancreatic_stent_placed)     { score -= 2; protective.push('Pancreatic stent placed'); }
  if (inputs.rectal_indomethacin_given)   { score -= 2; protective.push('Rectal indomethacin given'); }

  let risk_level: PepRiskResult['risk_level'];
  let prophylaxis: string;
  let colour: 'green' | 'amber' | 'red';

  if (score <= 1) {
    risk_level = 'low'; colour = 'green';
    prophylaxis = 'Standard ERCP care. Consider rectal indomethacin per local protocol.';
  } else if (score <= 3) {
    risk_level = 'moderate'; colour = 'amber';
    prophylaxis = 'Rectal indomethacin 100 mg before/immediately after procedure recommended.';
  } else if (score <= 5) {
    risk_level = 'high'; colour = 'red';
    prophylaxis = 'Rectal indomethacin + consider prophylactic pancreatic stent. Ensure senior operator.';
  } else {
    risk_level = 'very_high'; colour = 'red';
    prophylaxis = 'Rectal indomethacin + pancreatic stent strongly recommended. Discuss risk/benefit with patient. Senior operator essential.';
  }

  return { risk_level, risk_factors: riskFactors, protective_factors: protective, prophylaxis_recommendation: prophylaxis, colour };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEWS2 — NATIONAL EARLY WARNING SCORE 2 (emergency fast-track)
// ═══════════════════════════════════════════════════════════════════════════════
export interface News2Result {
  score: number;
  clinical_risk: 'low' | 'low_medium' | 'medium' | 'high';
  response: string;
  colour: 'green' | 'amber' | 'red';
  breakdown: Record<string, number>;
}

export function scoreNews2(vitals: ScoringVitals, spo2Scale2 = false): News2Result {
  const breakdown: Record<string, number> = {};
  let total = 0;

  // Respiratory rate
  const rr = n(vitals.respiratoryRate);
  if (rr !== null) {
    const s = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
    breakdown['RR'] = s; total += s;
  }

  // SpO2 (Scale 1 — no hypercapnic resp failure)
  const spo2 = n(vitals.spo2);
  if (spo2 !== null && !spo2Scale2) {
    const s = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
    breakdown['SpO₂'] = s; total += s;
  }

  // Systolic BP
  const sbp = n(vitals.systolicBp);
  if (sbp !== null) {
    const s = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
    breakdown['SBP'] = s; total += s;
  }

  // Pulse
  const hr = n(vitals.heartRate);
  if (hr !== null) {
    const s = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
    breakdown['HR'] = s; total += s;
  }

  // Temperature
  const temp = n(vitals.temperatureC);
  if (temp !== null) {
    const s = temp <= 35.0 ? 3 : temp <= 36.0 ? 1 : temp <= 38.0 ? 0 : temp <= 39.0 ? 1 : 2;
    breakdown['Temp'] = s; total += s;
  }

  let clinical_risk: News2Result['clinical_risk'];
  let response: string;
  let colour: 'green' | 'amber' | 'red';

  if (total <= 4 && !Object.values(breakdown).some(v => v === 3)) {
    clinical_risk = 'low'; colour = 'green';
    response = 'Minimum 12-hourly observations.';
  } else if (total <= 4) {
    clinical_risk = 'low_medium'; colour = 'amber';
    response = 'Inform nurse. Increase frequency of monitoring.';
  } else if (total <= 6) {
    clinical_risk = 'medium'; colour = 'amber';
    response = 'Urgent review by clinician. Increase monitoring.';
  } else {
    clinical_risk = 'high'; colour = 'red';
    response = 'Emergency review immediately. Consider critical care.';
  }

  return { score: total, clinical_risk, response, colour, breakdown };
}
