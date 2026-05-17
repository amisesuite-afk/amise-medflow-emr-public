/**
 * Validated clinical decision rule calculators.
 * All functions are pure and deterministic — no AI involved.
 *
 * Scales included:
 *   1. Alvarado (appendicitis probability)
 *   2. HEART (chest pain 6-week MACE risk)
 *   3. Wells PE (pulmonary embolism probability)
 *   4. ABCD2 (TIA → 2-day stroke risk)
 *   5. TG18 Cholangitis severity
 *   6. ASGE CBD stone probability
 *   7. Tokyo Guidelines Cholecystitis (TG18-X)
 */

export interface ScaleResult {
  score: number;
  band: string;       // e.g. "HIGH", "Grade II"
  color: 'green' | 'amber' | 'red';
  description: string;
  action: string;
  evidence: string;
}

// ─── 1. Alvarado Score (appendicitis) ──────────────────────────────────────

export interface AlvaradoInputs {
  migratoryPain: boolean;       // RIF migration history
  anorexia: boolean;
  nausea: boolean;
  rifTenderness: boolean;       // 2 pts
  rebound: boolean;
  fever: boolean;               // auto: temp > 37.3°C
  wbcAbove10: boolean;          // 2 pts — WBC > 10,000
  leftShift: boolean;           // neutrophilia / bandaemia
}

export function alvaradoScore(i: AlvaradoInputs): number {
  return (
    (i.migratoryPain ? 1 : 0) +
    (i.anorexia ? 1 : 0) +
    (i.nausea ? 1 : 0) +
    (i.rifTenderness ? 2 : 0) +
    (i.rebound ? 1 : 0) +
    (i.fever ? 1 : 0) +
    (i.wbcAbove10 ? 2 : 0) +
    (i.leftShift ? 1 : 0)
  );
}

export function interpretAlvarado(score: number): ScaleResult {
  const evidence = 'Alvarado 1986; validated in tropical populations (Nanjundaiah 2010)';
  if (score <= 4) return {
    score, band: 'LOW RISK', color: 'green',
    description: 'Appendicitis unlikely.',
    action: 'Consider discharge with safety-net advice; reassess in 12–24h if pain persists.',
    evidence,
  };
  if (score <= 6) return {
    score, band: 'EQUIVOCAL', color: 'amber',
    description: 'Possible appendicitis — warrants further workup.',
    action: 'CT abdomen / USS appendix. Surgical review if score ≥ 6 or worsening.',
    evidence,
  };
  if (score <= 8) return {
    score, band: 'PROBABLE', color: 'amber',
    description: 'Probable appendicitis.',
    action: 'Urgent surgical review. IV fluids, analgesia. CT or proceed to theatre.',
    evidence,
  };
  return {
    score, band: 'HIGH PROBABILITY', color: 'red',
    description: 'Very likely appendicitis.',
    action: 'Urgent surgical review for likely appendicectomy. Prepare theatre.',
    evidence,
  };
}

// ─── 2. HEART Score (chest pain → 6-week MACE) ────────────────────────────

export interface HeartInputs {
  historyScore: 0 | 1 | 2;    // 0=slightly, 1=moderately, 2=highly suspicious
  ecgScore: 0 | 1 | 2;        // 0=normal, 1=non-specific changes, 2=significant ST changes
  age: number | null;
  riskFactorScore: 0 | 1 | 2; // 0=none, 1=1-2 RFs, 2=≥3 or known CAD/DM
  troponinScore: 0 | 1 | 2;   // 0=≤normal, 1=1–3×ULN, 2=>3×ULN
}

export function heartScore(i: HeartInputs): number {
  const ageScore =
    i.age == null ? 0 :
    i.age < 45 ? 0 :
    i.age < 65 ? 1 : 2;
  return i.historyScore + i.ecgScore + ageScore + i.riskFactorScore + i.troponinScore;
}

export function interpretHeart(score: number): ScaleResult {
  const evidence = 'Six et al., Eur Heart J 2010; validated externally ×12';
  if (score <= 3) return {
    score, band: 'LOW RISK', color: 'green',
    description: '< 2% 6-week MACE risk.',
    action: 'Early discharge possible with outpatient follow-up. No immediate intervention.',
    evidence,
  };
  if (score <= 6) return {
    score, band: 'MODERATE RISK', color: 'amber',
    description: '12–17% 6-week MACE risk.',
    action: 'Cardiology referral. Serial troponins, stress test or coronary imaging before discharge.',
    evidence,
  };
  return {
    score, band: 'HIGH RISK', color: 'red',
    description: '≥ 50% 6-week MACE risk.',
    action: 'Urgent cardiology review. Early invasive strategy (angiography). Do not discharge.',
    evidence,
  };
}

// ─── 3. Wells PE Score ──────────────────────────────────────────────────────

export interface WellsPeInputs {
  dvtSigns: boolean;               // 3 pts
  altDiagnosisLessLikely: boolean; // 3 pts
  hrAbove100: boolean;             // 1.5 pts — auto: HR > 100
  immobilised: boolean;            // 1.5 pts — surgery/bed rest ≥3 days in past 4 weeks
  priorDvtPe: boolean;             // 1.5 pts
  haemoptysis: boolean;            // 1 pt
  cancer: boolean;                 // 1 pt
}

export function wellsPeScore(i: WellsPeInputs): number {
  return (
    (i.dvtSigns ? 3 : 0) +
    (i.altDiagnosisLessLikely ? 3 : 0) +
    (i.hrAbove100 ? 1.5 : 0) +
    (i.immobilised ? 1.5 : 0) +
    (i.priorDvtPe ? 1.5 : 0) +
    (i.haemoptysis ? 1 : 0) +
    (i.cancer ? 1 : 0)
  );
}

export function interpretWellsPe(score: number): ScaleResult {
  const evidence = 'Wells et al., Ann Intern Med 2001; PIOPED criteria';
  if (score <= 1) return {
    score, band: 'LOW', color: 'green',
    description: '~5% PE prevalence.',
    action: 'D-dimer testing appropriate. If negative, PE excluded. If positive, CT-PA.',
    evidence,
  };
  if (score <= 6) return {
    score, band: 'MODERATE', color: 'amber',
    description: '~20–30% PE prevalence.',
    action: 'CT pulmonary angiography (CTPA). D-dimer only if low clinical suspicion persists.',
    evidence,
  };
  return {
    score, band: 'HIGH', color: 'red',
    description: '~65–70% PE prevalence.',
    action: 'CT-PA immediately. Consider therapeutic anticoagulation while awaiting imaging.',
    evidence,
  };
}

// ─── 4. ABCD2 Score (TIA → 2-day stroke risk) ─────────────────────────────

export interface Abcd2Inputs {
  age: number | null;            // ≥60 = 1 pt
  sbp: number | null;            // ≥140 mmHg = 1 pt — auto from vitals
  clinicalFeatureScore: 0 | 1 | 2; // 0=other, 1=speech disturbance only, 2=unilateral weakness
  durationScore: 0 | 1 | 2;     // 0=<10min, 1=10–59min, 2=≥60min
  diabetes: boolean;             // 1 pt
}

export function abcd2Score(i: Abcd2Inputs): number {
  return (
    ((i.age ?? 0) >= 60 ? 1 : 0) +
    ((i.sbp ?? 0) >= 140 ? 1 : 0) +
    i.clinicalFeatureScore +
    i.durationScore +
    (i.diabetes ? 1 : 0)
  );
}

export function interpretAbcd2(score: number): ScaleResult {
  const evidence = 'Johnston et al., Lancet 2007; ABCD2 validation';
  if (score <= 3) return {
    score, band: 'LOW RISK', color: 'green',
    description: '~1% 2-day stroke risk.',
    action: 'Outpatient TIA clinic within 24–48h. Dual antiplatelet. MRI-DWI if available.',
    evidence,
  };
  if (score <= 5) return {
    score, band: 'MODERATE RISK', color: 'amber',
    description: '~4% 2-day stroke risk.',
    action: 'Urgent TIA assessment within 24h. Consider hospital admission for monitoring.',
    evidence,
  };
  return {
    score, band: 'HIGH RISK', color: 'red',
    description: '~8% 2-day stroke risk.',
    action: 'Admit and investigate urgently. MRI-DWI, carotid imaging, cardiac monitoring.',
    evidence,
  };
}

// ─── 5. TG18 Cholangitis Severity ──────────────────────────────────────────

export interface Tg18CholangitisInputs {
  fever: boolean;            // temp ≥ 38°C — auto from vitals
  wbcAbnormal: boolean;      // < 4k or > 12k
  age: number | null;        // ≥ 75 = moderate criterion
  bilirubinHighGrade2: boolean;   // bilirubin ≥ 85 µmol/L
  albuminLow: boolean;       // albumin < 0.7 × LLN (Grade II)
  organDysfunctionCv: boolean;    // hypotension requiring pressors
  organDysfunctionCns: boolean;   // altered consciousness
  organDysfunctionResp: boolean;  // PaO2/FiO2 < 300
  organDysfunctionRenal: boolean; // oliguria / Cr > 177 µmol/L
  organDysfunctionHepatic: boolean; // PT-INR > 1.5
  organDysfunctionHaem: boolean;  // platelets < 100k
}

export function tg18CholangitisGrade(i: Tg18CholangitisInputs): 'I' | 'II' | 'III' {
  const organCount = [
    i.organDysfunctionCv,
    i.organDysfunctionCns,
    i.organDysfunctionResp,
    i.organDysfunctionRenal,
    i.organDysfunctionHepatic,
    i.organDysfunctionHaem,
  ].filter(Boolean).length;

  if (organCount >= 1) return 'III';

  const grade2Criteria = [
    i.wbcAbnormal,
    i.fever,
    (i.age ?? 0) >= 75,
    i.bilirubinHighGrade2,
    i.albuminLow,
  ].filter(Boolean).length;

  if (grade2Criteria >= 1) return 'II';
  return 'I';
}

export function interpretTg18Cholangitis(grade: 'I' | 'II' | 'III'): ScaleResult {
  const evidence = 'Tokyo Guidelines 2018 (TG18) — Kiriyama et al., J Hepatobiliary Pancreat Sci 2018';
  if (grade === 'I') return {
    score: 1, band: 'Grade I — MILD', color: 'green',
    description: 'Responds to initial antibiotic therapy. No organ dysfunction.',
    action: 'IV antibiotics (ceftriaxone 2g + metronidazole 500mg TDS). Monitor. ERCP if no improvement at 24–48h.',
    evidence,
  };
  if (grade === 'II') return {
    score: 2, band: 'Grade II — MODERATE', color: 'amber',
    description: 'Does not respond rapidly to initial treatment; local inflammation.',
    action: 'Early biliary drainage (ERCP within 24–48h). IV antibiotics. Cross-match. Review anticoagulants.',
    evidence,
  };
  return {
    score: 3, band: 'Grade III — SEVERE', color: 'red',
    description: 'Organ dysfunction present. Mortality >50% without urgent drainage.',
    action: 'URGENT ERCP within 24h (earlier if possible). ICU admission. Broad-spectrum antibiotics. Sepsis bundle.',
    evidence,
  };
}

// ─── 6. ASGE CBD Stone Probability ────────────────────────────────────────

export interface AsgeCbdInputs {
  cbdStoneOnUss: boolean;      // strong predictor
  cholangitisPresent: boolean; // strong predictor
  bilirubin: number | null;    // > 68.5 µmol/L (4 mg/dL) = predictor; strong if > 102.6 (6 mg/dL)
  cbdDilated: boolean;         // CBD > 6 mm
  lftsAbnormal: boolean;       // any LFT elevated
  ageAbove55: boolean;         // auto from age
}

export type AsgeProbability = 'HIGH' | 'INTERMEDIATE' | 'LOW';

export function asgeCbdProbability(i: AsgeCbdInputs): AsgeProbability {
  // Strong predictors
  if (i.cbdStoneOnUss || i.cholangitisPresent) return 'HIGH';
  const bilirubinHigh = (i.bilirubin ?? 0) > 68.5; // > 4 mg/dL (~68.5 µmol/L)
  if (bilirubinHigh && i.cbdDilated) return 'HIGH';

  // Intermediate predictors
  const intermediateCount = [
    i.lftsAbnormal,
    i.cbdDilated,
    i.ageAbove55,
    bilirubinHigh,
  ].filter(Boolean).length;
  if (intermediateCount >= 1) return 'INTERMEDIATE';

  return 'LOW';
}

export function interpretAsgeCbd(prob: AsgeProbability): ScaleResult {
  const evidence = 'ASGE Standards of Practice 2019 — Buxbaum et al., Gastrointest Endosc 2019';
  if (prob === 'HIGH') return {
    score: 3, band: 'HIGH PROBABILITY', color: 'red',
    description: 'CBD stone very likely (PPV ~96%).',
    action: 'Proceed directly to ERCP. Book within 24–72h. No need for MRCP first.',
    evidence,
  };
  if (prob === 'INTERMEDIATE') return {
    score: 2, band: 'INTERMEDIATE', color: 'amber',
    description: 'CBD stone possible (~33–65% probability).',
    action: 'MRCP or EUS first. If stone confirmed → ERCP. If negative → proceed to laparoscopic cholecystectomy.',
    evidence,
  };
  return {
    score: 1, band: 'LOW PROBABILITY', color: 'green',
    description: 'CBD stone unlikely (<10%).',
    action: 'No further CBD workup needed. Proceed to laparoscopic cholecystectomy if gallstones present.',
    evidence,
  };
}
