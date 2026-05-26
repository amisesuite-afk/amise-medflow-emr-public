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

// ─── Wagner Diabetic Foot Ulcer Grade ────────────────────────────────────────

export type WagnerGrade = 0 | 1 | 2 | 3 | 4 | 5;

export interface WagnerDescription {
  grade: WagnerGrade;
  label: string;
  description: string;
  management: string;
}

export const WAGNER_GRADES: WagnerDescription[] = [
  { grade: 0, label: 'Grade 0 — Pre-ulcerative', description: 'Intact skin. High-risk foot: callus, blisters, dry fissures, nail deformity.', management: 'Preventive podiatry. Custom footwear and pressure offloading. Glycaemic optimisation. Patient education. Monthly review.' },
  { grade: 1, label: 'Grade 1 — Superficial ulcer', description: 'Full-thickness skin loss. Ulcer through epidermis and dermis. No subcutaneous involvement.', management: 'Wound care (moist dressings). Offloading device (total contact cast / CROW boot). Weekly review. Glycaemic control. Exclude infection.' },
  { grade: 2, label: 'Grade 2 — Deep ulcer', description: 'Ulcer extends to tendon, joint capsule, or bone. No abscess or osteomyelitis.', management: 'Debridement and wound care. IV antibiotics if infection signs. Vascular assessment (ABI, Doppler). Consider admission. Surgical team review.' },
  { grade: 3, label: 'Grade 3 — Deep ulcer + infection', description: 'Deep ulcer with abscess, osteomyelitis, or septic arthritis.', management: 'ADMIT. IV broad-spectrum antibiotics (pip-tazo 4.5g TDS). Surgical drainage and debridement. X-ray ± MRI for osteomyelitis. Vascular surgery referral. MDT review.' },
  { grade: 4, label: 'Grade 4 — Forefoot gangrene', description: 'Gangrene limited to toes or forefoot.', management: 'Urgent surgical assessment. Vascular team — consider revascularisation. Debridement vs partial amputation. IV antibiotics. HDU monitoring.' },
  { grade: 5, label: 'Grade 5 — Whole foot gangrene', description: 'Extensive gangrene involving the whole foot.', management: 'Major amputation likely. Vascular surgery and surgical MDT. Discuss goals of care. Palliative care involvement if appropriate.' },
];

export function interpretWagner(grade: WagnerGrade): ScaleResult {
  const colors: Record<WagnerGrade, ScaleResult['color']> = { 0: 'green', 1: 'green', 2: 'amber', 3: 'red', 4: 'red', 5: 'red' };
  const w = WAGNER_GRADES[grade];
  return {
    score: grade,
    band: w.label,
    description: w.description,
    action: w.management,
    evidence: 'Wagner FW. The dysvascular foot: a system for diagnosis and treatment. Foot Ankle 1981.',
    color: colors[grade],
  };
}

// ─── NEWS2 ────────────────────────────────────────────────────────────────────

export interface News2Inputs {
  respiratoryRate: number | null;
  spo2: number | null;
  supplementalO2: boolean;
  systolicBp: number | null;
  heartRate: number | null;
  temperatureC: number | null;
  consciousnessAvpu: 'A' | 'C' | 'V' | 'P' | 'U';
}

export function news2Score(i: News2Inputs): number {
  let s = 0;
  if (i.respiratoryRate !== null) {
    if (i.respiratoryRate <= 8) s += 3;
    else if (i.respiratoryRate <= 11) s += 1;
    else if (i.respiratoryRate <= 20) s += 0;
    else if (i.respiratoryRate <= 24) s += 2;
    else s += 3;
  }
  if (i.spo2 !== null) {
    if (i.spo2 <= 91) s += 3;
    else if (i.spo2 <= 93) s += 2;
    else if (i.spo2 <= 95) s += 1;
  }
  if (i.supplementalO2) s += 2;
  if (i.systolicBp !== null) {
    if (i.systolicBp <= 90) s += 3;
    else if (i.systolicBp <= 100) s += 2;
    else if (i.systolicBp <= 110) s += 1;
    else if (i.systolicBp >= 220) s += 3;
  }
  if (i.heartRate !== null) {
    if (i.heartRate <= 40) s += 3;
    else if (i.heartRate <= 50) s += 1;
    else if (i.heartRate <= 90) s += 0;
    else if (i.heartRate <= 110) s += 1;
    else if (i.heartRate <= 130) s += 2;
    else s += 3;
  }
  if (i.consciousnessAvpu !== 'A') s += 3;
  if (i.temperatureC !== null) {
    if (i.temperatureC <= 35.0) s += 3;
    else if (i.temperatureC <= 36.0) s += 1;
    else if (i.temperatureC <= 38.0) s += 0;
    else if (i.temperatureC <= 39.0) s += 1;
    else s += 2;
  }
  return s;
}

export function interpretNews2(score: number): ScaleResult {
  if (score === 0) return { score, band: 'Score 0 — Low Risk', description: 'All parameters within normal range.', action: 'Routine assessment. Reassess within 12 hours.', evidence: 'Royal College of Physicians. NEWS2 (2017).', color: 'green' };
  if (score <= 4) return { score, band: `Score ${score} — Low Risk`, description: 'Minor physiological derangement.', action: 'Minimum 4–6 hourly monitoring. Consider increasing frequency if any single parameter scores 3.', evidence: 'Royal College of Physicians. NEWS2 (2017).', color: 'green' };
  if (score <= 6) return { score, band: `Score ${score} — Medium Risk`, description: 'Urgent clinical review required.', action: 'Urgent nurse/doctor review. Increase monitoring to at least hourly. Escalate to senior clinician.', evidence: 'Royal College of Physicians. NEWS2 (2017).', color: 'amber' };
  return { score, band: `Score ${score} — HIGH Risk`, description: 'Emergency response required.', action: 'EMERGENCY: Continuous monitoring. Immediate senior clinician review. Activate rapid response team. Consider ICU/HDU.', evidence: 'Royal College of Physicians. NEWS2 (2017).', color: 'red' };
}

// ─── CURB-65 ──────────────────────────────────────────────────────────────────

export interface Curb65Inputs {
  confusion: boolean;
  ureaMmolAbove7: boolean;
  respiratoryRateAbove30: boolean;
  bpLow: boolean;
  age65orAbove: boolean;
}

export function curb65Score(i: Curb65Inputs): number {
  return [i.confusion, i.ureaMmolAbove7, i.respiratoryRateAbove30, i.bpLow, i.age65orAbove].filter(Boolean).length;
}

export function interpretCurb65(score: number): ScaleResult {
  if (score <= 1) return { score, band: `CURB-65: ${score} — Low Risk`, description: '30-day mortality < 3%. Likely suitable for outpatient treatment.', action: 'Outpatient oral antibiotics. Safety-net advice. Return if not improving at 48h or any deterioration.', evidence: 'Lim et al., Thorax 2003. BTS guidelines.', color: 'green' };
  if (score === 2) return { score, band: 'CURB-65: 2 — Moderate Risk', description: '30-day mortality ~9%. Short-stay or closely supervised outpatient.', action: 'Consider admission for IV antibiotics and monitoring. Reassess at 24h.', evidence: 'Lim et al., Thorax 2003. BTS guidelines.', color: 'amber' };
  return { score, band: `CURB-65: ${score} — High Risk`, description: `30-day mortality ${score === 3 ? '~17%' : score === 4 ? '~42%' : '>50%'}. Severe pneumonia.`, action: 'Hospital admission. IV antibiotics (dual therapy). Consider ITU/HDU if score ≥ 4. Urgent senior review.', evidence: 'Lim et al., Thorax 2003. BTS guidelines.', color: 'red' };
}

// ─── Wells DVT Score ──────────────────────────────────────────────────────────

export interface WellsDvtInputs {
  activeCancer: boolean;           // 1 pt
  paralysisParesis: boolean;       // 1 pt — paralysis, paresis, or recent plaster immobilisation
  bedridden3Days: boolean;         // 1 pt — recently bedridden ≥3 days or major surgery <12 wks
  localTenderness: boolean;        // 1 pt — localised tenderness along deep venous system
  entireLegSwollen: boolean;       // 1 pt
  calfSwelling3cm: boolean;        // 1 pt — calf swelling >3 cm vs asymptomatic side
  pittingOedema: boolean;          // 1 pt — symptomatic leg only
  collateralVeins: boolean;        // 1 pt — non-varicose collateral superficial veins
  previousDvt: boolean;            // 1 pt — previously documented DVT
  alternativeDx: boolean;          // -2 pts — alternative diagnosis at least as likely
}

export function wellsDvtScore(i: WellsDvtInputs): number {
  return (
    (i.activeCancer ? 1 : 0) +
    (i.paralysisParesis ? 1 : 0) +
    (i.bedridden3Days ? 1 : 0) +
    (i.localTenderness ? 1 : 0) +
    (i.entireLegSwollen ? 1 : 0) +
    (i.calfSwelling3cm ? 1 : 0) +
    (i.pittingOedema ? 1 : 0) +
    (i.collateralVeins ? 1 : 0) +
    (i.previousDvt ? 1 : 0) +
    (i.alternativeDx ? -2 : 0)
  );
}

export function interpretWellsDvt(score: number): ScaleResult {
  const evidence = 'Wells et al., Lancet 1997; modified Wells 2003. Validated in Caribbean / tropical settings.';
  if (score <= 0) return {
    score, band: 'LOW PROBABILITY', color: 'green',
    description: 'DVT unlikely. D-dimer recommended to exclude.',
    action: 'D-dimer: if negative, DVT excluded. If positive, proceed to compression ultrasound.',
    evidence,
  };
  if (score <= 2) return {
    score, band: 'MODERATE PROBABILITY', color: 'amber',
    description: 'Moderate pre-test probability of DVT.',
    action: 'Compression duplex ultrasound. If negative and high clinical suspicion, repeat USS in 1 week. Anticoagulate while awaiting.',
    evidence,
  };
  return {
    score, band: 'HIGH PROBABILITY', color: 'red',
    description: 'High pre-test probability. DVT likely.',
    action: 'Compression duplex ultrasound urgently. Start therapeutic anticoagulation (LMWH) without waiting for USS result unless contraindicated.',
    evidence,
  };
}

// ─── Glasgow-Blatchford Score (pre-endoscopy GI bleed) ───────────────────────

export interface GlasgowBlatchfordInputs {
  ureaMmol: number | null;         // blood urea nitrogen (lab)
  haemoglobinMale: number | null;  // if male (g/dL, lab)
  haemoglobinFemale: number | null; // if female (g/dL, lab)
  isMale: boolean;
  systolicBp: number | null;       // auto from vitals
  heartRateAbove100: boolean;      // auto from vitals
  melaena: boolean;                // clinical
  syncope: boolean;                // clinical
  liverDisease: boolean;           // clinical history
  cardiacFailure: boolean;         // clinical history
}

export function glasgowBlatchfordScore(i: GlasgowBlatchfordInputs): number {
  let s = 0;
  // Blood urea
  if (i.ureaMmol !== null) {
    if (i.ureaMmol >= 25) s += 6;
    else if (i.ureaMmol >= 10) s += 4;
    else if (i.ureaMmol >= 8) s += 3;
    else if (i.ureaMmol >= 6.5) s += 2;
  }
  // Haemoglobin
  const hb = i.isMale ? i.haemoglobinMale : i.haemoglobinFemale;
  if (hb !== null) {
    if (i.isMale) {
      if (hb < 10) s += 6;
      else if (hb < 12) s += 3;
      else if (hb < 13) s += 1;
    } else {
      if (hb < 10) s += 6;
      else if (hb < 12) s += 1;
    }
  }
  // Systolic BP
  if (i.systolicBp !== null) {
    if (i.systolicBp < 90) s += 3;
    else if (i.systolicBp < 100) s += 2;
    else if (i.systolicBp < 110) s += 1;
  }
  if (i.heartRateAbove100) s += 1;
  if (i.melaena) s += 1;
  if (i.syncope) s += 2;
  if (i.liverDisease) s += 2;
  if (i.cardiacFailure) s += 2;
  return s;
}

export function interpretGlasgowBlatchford(score: number): ScaleResult {
  const evidence = 'Blatchford et al., Lancet 2000. Validated for pre-endoscopy risk stratification of UGIB.';
  if (score === 0) return {
    score, band: 'Score 0 — Very Low Risk', color: 'green',
    description: 'Very low risk of requiring intervention. Safe for outpatient management.',
    action: 'Outpatient management appropriate. Arrange elective OGD. Clear safety-net advice.',
    evidence,
  };
  if (score <= 2) return {
    score, band: `Score ${score} — Low Risk`, color: 'green',
    description: 'Low risk of requiring blood transfusion or endoscopic intervention.',
    action: 'Early outpatient endoscopy or 24-h assessment ward. Avoid immediate admission if clinically stable.',
    evidence,
  };
  if (score <= 6) return {
    score, band: `Score ${score} — Moderate Risk`, color: 'amber',
    description: 'Moderate risk. Likely to need endoscopic intervention.',
    action: 'Admit for urgent endoscopy within 24 hours. IV access, cross-match, resuscitate as needed.',
    evidence,
  };
  return {
    score, band: `Score ${score} — High Risk`, color: 'red',
    description: 'High risk of requiring transfusion, endoscopic therapy, or surgery.',
    action: 'Immediate resuscitation. Urgent OGD within 12h. Senior surgical review. Activate major haemorrhage protocol if haemodynamically unstable.',
    evidence,
  };
}

// ─── Revised Cardiac Risk Index (RCRI) — Pre-operative ───────────────────────

export interface RcriInputs {
  highRiskSurgery: boolean;      // intraperitoneal, intrathoracic, or suprainguinal vascular
  ischemicHeartDisease: boolean; // Hx of MI, positive stress test, angina, nitrate use, Q waves
  congestiveHeartFailure: boolean;
  cerebrovascularDisease: boolean; // Hx of stroke or TIA
  insulinDependentDiabetes: boolean;
  creatinineAbove177: boolean;   // serum Cr > 177 µmol/L (2 mg/dL)
}

export function rcriScore(i: RcriInputs): number {
  return [
    i.highRiskSurgery, i.ischemicHeartDisease, i.congestiveHeartFailure,
    i.cerebrovascularDisease, i.insulinDependentDiabetes, i.creatinineAbove177,
  ].filter(Boolean).length;
}

export function interpretRcri(score: number): ScaleResult {
  const evidence = 'Lee et al., Circulation 1999. Endorsed by ACC/AHA guidelines for pre-operative cardiac risk.';
  if (score === 0) return {
    score, band: 'RCRI 0 — Very Low Risk', color: 'green',
    description: 'Major cardiac event risk < 1%. Proceed with planned surgery.',
    action: 'No additional cardiac workup required. Standard pre-operative assessment sufficient.',
    evidence,
  };
  if (score === 1) return {
    score, band: 'RCRI 1 — Low Risk', color: 'green',
    description: 'Major cardiac event risk ~1%.',
    action: 'Proceed with planned surgery. Optimise modifiable risk factors. Consider pre-op ECG.',
    evidence,
  };
  if (score === 2) return {
    score, band: 'RCRI 2 — Moderate Risk', color: 'amber',
    description: 'Major cardiac event risk ~7%.',
    action: 'Consider cardiology referral for high-risk patients. Optimise medical therapy. Beta-blocker if indicated. Peri-operative monitoring.',
    evidence,
  };
  return {
    score, band: `RCRI ${score} — High Risk`, color: 'red',
    description: `Major cardiac event risk ${score === 3 ? '~11%' : '>15%'}.`,
    action: 'Cardiology referral recommended. Consider further non-invasive testing. Weigh surgical risk vs benefit. Discuss with patient.',
    evidence,
  };
}

// ─── Pre-endoscopy Rockall Score (clinical criteria only) ────────────────────

export interface PreRockallInputs {
  age: number | null;             // 0: <60 | 1: 60-79 | 2: ≥80
  haemodynamicShock: 'none' | 'tachycardia' | 'hypotension'; // 0 | 1 | 2
  comorbidity: 'none' | 'cardiac_renal' | 'liver_cancer'; // 0 | 2 | 3
}

export function preRockallScore(i: PreRockallInputs): number {
  let s = 0;
  if (i.age !== null) {
    if (i.age >= 80) s += 2;
    else if (i.age >= 60) s += 1;
  }
  if (i.haemodynamicShock === 'tachycardia') s += 1;
  else if (i.haemodynamicShock === 'hypotension') s += 2;
  if (i.comorbidity === 'cardiac_renal') s += 2;
  else if (i.comorbidity === 'liver_cancer') s += 3;
  return s;
}

export function interpretPreRockall(score: number): ScaleResult {
  const evidence = 'Rockall et al., Gut 1996. Pre-endoscopy score (clinical criteria only). Full Rockall adds endoscopic findings.';
  if (score <= 1) return {
    score, band: `Pre-Rockall ${score} — Low Risk`, color: 'green',
    description: 'Low risk of re-bleeding or death. Suitable for outpatient/early discharge pathway.',
    action: 'Early discharge or outpatient endoscopy appropriate. Clear safety-net instructions.',
    evidence,
  };
  if (score <= 3) return {
    score, band: `Pre-Rockall ${score} — Moderate Risk`, color: 'amber',
    description: 'Moderate risk. Inpatient endoscopy warranted.',
    action: 'Admit for urgent endoscopy. Resuscitate. Senior review.',
    evidence,
  };
  return {
    score, band: `Pre-Rockall ${score} — High Risk`, color: 'red',
    description: 'High risk of re-bleeding or in-hospital death.',
    action: 'Emergency endoscopy after resuscitation. Senior gastroenterology/surgical review. ICU consideration.',
    evidence,
  };
}

// ─── Ranson's Criteria (pancreatitis — at admission, clinical + basic labs) ──

export interface RansonAdmissionInputs {
  age55orAbove: boolean;          // clinical
  wbcAbove16: boolean;            // lab: WBC > 16,000
  glucoseAbove11: boolean;        // semi-lab: glucose > 11.1 mmol/L (blood glucose monitor)
  ldhAbove350: boolean;           // lab
  astAbove250: boolean;           // lab
}

export function ransonAdmissionScore(i: RansonAdmissionInputs): number {
  return [i.age55orAbove, i.wbcAbove16, i.glucoseAbove11, i.ldhAbove350, i.astAbove250].filter(Boolean).length;
}

export function interpretRansonAdmission(score: number): ScaleResult {
  const evidence = 'Ranson et al., Surg Gynecol Obstet 1974. Admission criteria only (full score requires 48h labs).';
  if (score <= 1) return {
    score, band: `Ranson ${score} — Low Severity`, color: 'green',
    description: 'Mild acute pancreatitis likely. Mortality < 1%.',
    action: 'IV fluids, analgesia, NPO. Monitor closely. Consider CT if clinical deterioration.',
    evidence,
  };
  if (score <= 2) return {
    score, band: `Ranson ${score} — Moderate`, color: 'amber',
    description: 'Moderate severity. Mortality ~15%.',
    action: 'Admit. IV fluids (aggressive early hydration). Monitor for local/systemic complications. Early CT consideration. HDU if available.',
    evidence,
  };
  return {
    score, band: `Ranson ${score} — Severe`, color: 'red',
    description: `Severe acute pancreatitis. Mortality ${score <= 4 ? '~40%' : '>50%'}.`,
    action: 'ICU admission. Aggressive fluid resuscitation. Early CT with contrast (>72h). Multidisciplinary team. Consider ERCP if gallstone pancreatitis.',
    evidence,
  };
}
