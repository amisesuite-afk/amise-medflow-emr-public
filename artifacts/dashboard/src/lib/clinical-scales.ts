/**
 * Validated clinical decision rule calculators.
 * All functions are pure and deterministic — no AI involved.
 *
 * Scales included:
 *   1.  Alvarado (appendicitis probability)
 *   2.  HEART (chest pain 6-week MACE risk)
 *   3.  Wells PE (pulmonary embolism probability)
 *   4.  ABCD2 (TIA → 2-day stroke risk)
 *   5.  TG18 Cholangitis severity
 *   6.  ASGE CBD stone probability
 *   7.  Tokyo Guidelines Cholecystitis (TG18-X)
 *   8.  Glasgow-Blatchford (upper GI bleed)
 *   9.  RCRI (pre-operative cardiac risk)
 *   10. Pre-Rockall (GI bleed mortality)
 *   11. Ranson's Criteria (pancreatitis)
 *   12. ISS / NISS (trauma)
 *   13. Burns: Rule of Nines, Parkland, Baux
 *   14. P-POSSUM (surgical mortality/morbidity)
 *   15. MUST (malnutrition screening)
 *   16. Caprini (VTE risk)
 *   17. STOP-BANG (OSA pre-operative screening)
 *   18. Clinical Frailty Scale (CFS)
 *   19. ECOG Performance Status
 *   20. PHQ-9 (depression screening)
 *   21. GAD-7 (generalised anxiety screening)
 *   22. GERD-Q (gastro-oesophageal reflux disease questionnaire)
 *   23. Child-Pugh score (liver disease surgical risk)
 *   24. Apfel PONV score (post-operative nausea and vomiting)
 *   25. MELD / MELD-Na (end-stage liver disease severity)
 *   26. CHA₂DS₂-VASc (AF stroke risk / anticoagulation)
 *   27. HAS-BLED (bleeding risk on anticoagulation)
 *   28. qSOFA (quick SOFA — bedside sepsis screen)
 *   29. ASA Physical Status Classification (pre-operative risk)
 *   30. BISAP (bedside index of severity in acute pancreatitis)
 *   31. Forrest Classification (endoscopic peptic ulcer bleeding stigmata)
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

// ── ISS / NISS (ATLS 11 / AIS 2015) ─────────────────────────────────────────

export type IssRegion = 'headNeck' | 'face' | 'thorax' | 'abdomen' | 'extremities' | 'external';

export const ISS_REGIONS: { key: IssRegion; label: string }[] = [
  { key: 'headNeck',    label: 'Head and Neck' },
  { key: 'face',        label: 'Face' },
  { key: 'thorax',      label: 'Thorax (Chest)' },
  { key: 'abdomen',     label: 'Abdomen / Pelvic Contents' },
  { key: 'extremities', label: 'Extremities / Bony Pelvis' },
  { key: 'external',    label: 'External (Skin / Soft Tissue)' },
];

export const AIS_LABELS: Record<number, string> = {
  0: '0 — No injury',
  1: '1 — Minor',
  2: '2 — Moderate',
  3: '3 — Serious',
  4: '4 — Severe',
  5: '5 — Critical',
  6: '6 — Unsurvivable',
};

/** ISS = sum of squares of top-3 DIFFERENT-region AIS; any AIS 6 → 75. */
export function issScore(ais: Record<string, number>): number {
  const vals = ISS_REGIONS.map(r => ais[r.key] ?? 0);
  if (vals.some(v => v === 6)) return 75;
  return [...vals].sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v * v, 0);
}

/** NISS = sum of squares of 3 highest AIS regardless of region. */
export function nissScore(ais: Record<string, number>): number {
  const vals = Object.values(ais);
  if (vals.some(v => v === 6)) return 75;
  return [...vals].sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v * v, 0);
}

export function interpretIss(iss: number): { label: string; color: string } {
  if (iss === 0) return { label: 'No injury',       color: '#6b7280' };
  if (iss <= 8)  return { label: 'Minor',            color: '#16a34a' };
  if (iss <= 15) return { label: 'Moderate',         color: '#ca8a04' };
  if (iss <= 24) return { label: 'Serious',          color: '#ea580c' };
  if (iss <= 40) return { label: 'Severe',           color: '#dc2626' };
  if (iss <= 74) return { label: 'Critical',         color: '#9f1239' };
  return          { label: 'Unsurvivable (ISS 75)', color: '#450a0a' };
}

// ── Burns: Rule of Nines ─────────────────────────────────────────────────────

export type BurnRegionKey =
  | 'headNeck'
  | 'chestAnterior' | 'abdomenAnterior'
  | 'upperBackPosterior' | 'lowerBackPosterior'
  | 'leftArmAnterior' | 'leftArmPosterior'
  | 'rightArmAnterior' | 'rightArmPosterior'
  | 'leftThighAnterior' | 'leftThighPosterior'
  | 'leftLegAnterior' | 'leftLegPosterior'
  | 'rightThighAnterior' | 'rightThighPosterior'
  | 'rightLegAnterior' | 'rightLegPosterior'
  | 'perineum';

export const BURN_REGIONS: { key: BurnRegionKey; label: string; percent: number; group: string }[] = [
  { key: 'headNeck',           label: 'Head and Neck',         percent: 9,   group: 'Head' },
  { key: 'chestAnterior',      label: 'Chest (anterior)',       percent: 9,   group: 'Trunk' },
  { key: 'abdomenAnterior',    label: 'Abdomen (anterior)',     percent: 9,   group: 'Trunk' },
  { key: 'upperBackPosterior', label: 'Upper Back (posterior)', percent: 9,   group: 'Trunk' },
  { key: 'lowerBackPosterior', label: 'Lower Back / Buttocks',  percent: 9,   group: 'Trunk' },
  { key: 'leftArmAnterior',    label: 'Left Arm (anterior)',    percent: 4.5, group: 'Left Arm' },
  { key: 'leftArmPosterior',   label: 'Left Arm (posterior)',   percent: 4.5, group: 'Left Arm' },
  { key: 'rightArmAnterior',   label: 'Right Arm (anterior)',   percent: 4.5, group: 'Right Arm' },
  { key: 'rightArmPosterior',  label: 'Right Arm (posterior)',  percent: 4.5, group: 'Right Arm' },
  { key: 'leftThighAnterior',  label: 'Left Thigh (anterior)',  percent: 4.5, group: 'Left Leg' },
  { key: 'leftThighPosterior', label: 'Left Thigh (posterior)', percent: 4.5, group: 'Left Leg' },
  { key: 'leftLegAnterior',    label: 'Left Leg/Foot (ant.)',   percent: 4.5, group: 'Left Leg' },
  { key: 'leftLegPosterior',   label: 'Left Leg/Foot (post.)',  percent: 4.5, group: 'Left Leg' },
  { key: 'rightThighAnterior', label: 'Right Thigh (anterior)', percent: 4.5, group: 'Right Leg' },
  { key: 'rightThighPosterior',label: 'Right Thigh (posterior)',percent: 4.5, group: 'Right Leg' },
  { key: 'rightLegAnterior',   label: 'Right Leg/Foot (ant.)',  percent: 4.5, group: 'Right Leg' },
  { key: 'rightLegPosterior',  label: 'Right Leg/Foot (post.)', percent: 4.5, group: 'Right Leg' },
  { key: 'perineum',           label: 'Perineum',               percent: 1,   group: 'Perineum' },
];

export type BurnDegree = '1st' | 'SPT' | 'DPT' | 'FT' | '4th';

export const BURN_DEGREE_LABELS: Record<BurnDegree, string> = {
  '1st': '1st — Superficial (erythema, NOT counted in TBSA)',
  'SPT': '2nd Superficial Partial (blistering, wet, painful)',
  'DPT': '2nd Deep Partial (pale/mottled, reduced sensation)',
  'FT':  '3rd Full Thickness (leathery, insensate)',
  '4th': '4th degree (FT + underlying bone/tendon)',
};

/** TBSA from burn region map. Excludes 1st-degree burns. */
export function calcTbsa(regions: Record<string, { affected: boolean; degree: string }>): number {
  return BURN_REGIONS.reduce((sum, r) => {
    const entry = regions[r.key];
    if (!entry?.affected || entry.degree === '1st') return sum;
    return sum + r.percent;
  }, 0);
}

/** Parkland formula with elapsed-time adjustment. */
export function parklandFormula(
  weightKg: number,
  tbsa: number,
  burnTimeIso: string,
  nowIso: string = new Date().toISOString(),
): { total: number; first8h: number; next16h: number; hoursElapsed: number; rateNow: number; rateNext16h: number; warning: string } {
  const total     = 4 * weightKg * tbsa;
  const half      = total / 2;
  const rateNext16h = half / 16;

  if (!burnTimeIso) {
    return { total, first8h: half, next16h: half, hoursElapsed: 0, rateNow: half / 8, rateNext16h, warning: '' };
  }

  const elapsed = Math.max(0, (new Date(nowIso).getTime() - new Date(burnTimeIso).getTime()) / 3_600_000);

  if (elapsed >= 8) {
    return { total, first8h: half, next16h: half, hoursElapsed: elapsed, rateNow: 0, rateNext16h,
      warning: `⚠ First 8-hour window elapsed (${elapsed.toFixed(1)} h). Give second half at ${rateNext16h.toFixed(0)} mL/hr over next 16 h.` };
  }

  const remaining = Math.max(0, 8 - elapsed);
  const delivered = (elapsed / 8) * half;
  const stillNeeded = Math.max(0, half - delivered);
  const rateNow = remaining > 0 ? stillNeeded / remaining : 0;

  return {
    total, first8h: half, next16h: half, hoursElapsed: elapsed,
    rateNow, rateNext16h,
    warning: elapsed > 0.1
      ? `${elapsed.toFixed(1)} h elapsed. Remaining first-8h volume: ${stillNeeded.toFixed(0)} mL in ${remaining.toFixed(1)} h = ${rateNow.toFixed(0)} mL/hr.`
      : '',
  };
}

/** Revised Baux score = age + TBSA + 17 (if inhalation injury). */
export function bauxScore(age: number, tbsa: number, inhalation = false): number {
  return age + tbsa + (inhalation ? 17 : 0);
}

export function interpretBaux(score: number): { label: string; color: string } {
  if (score < 40)  return { label: 'Minor',              color: '#16a34a' };
  if (score < 71)  return { label: 'Moderate',           color: '#ca8a04' };
  if (score < 101) return { label: 'Severe',             color: '#dc2626' };
  return            { label: 'Critical / Lethal',        color: '#7f1d1d' };
}

// ── P-POSSUM (Portsmouth-POSSUM) ─────────────────────────────────────────────
// Ref: Prytherch et al., Br J Surg 1998;85:1217-1220.
// Predicts 30-day mortality and morbidity from physiological + operative scores.

export interface PpossumlPhysInputs {
  age:             1 | 2 | 4 | 8;   // <60=1, 60-69=2, 70-79=4, ≥80=8
  cardiac:         1 | 2 | 4 | 8;   // no failure=1, controlled HF=2, oedema/warfarin=4, raised JVP/cardiomegaly=8
  respiratory:     1 | 2 | 4 | 8;   // no dyspnoea=1, exertional/mild COPD=2, limiting/moderate COPD=4, rest/severe COPD=8
  ecg:             1 | 4 | 8;       // normal=1, AF 60-90=4, other change=8
  systolicBp:      1 | 2 | 4 | 8;   // 110-130=1, 131-170 or 100-109=2, ≥171 or 90-99=4, <90=8
  pulse:           1 | 2 | 4 | 8;   // 50-80=1, 81-100 or 40-49=2, 101-120=4, ≥121 or <40=8
  gcs:             1 | 2 | 4 | 8;   // 15=1, 12-14=2, 9-11=4, ≤8=8
  haematocrit:     1 | 2 | 4;       // ≥36%=1, 26-35%=2, ≤25%=4
  wbc:             1 | 2 | 4;       // 4-10=1, 10.1-20 or 3.1-3.9=2, ≥20.1 or ≤3=4
  urea:            1 | 2 | 4 | 8;   // <7.5=1, 7.6-10=2, 10.1-15=4, >15=8
  sodium:          1 | 2 | 4 | 8;   // ≥136=1, 131-135=2, 126-130=4, ≤125=8
  potassium:       1 | 2 | 4 | 8;   // 3.5-5.0=1, 3.2-3.4 or 5.1-5.3=2, 2.9-3.1 or 5.4-5.9=4, ≤2.8 or ≥6.0=8
}

export interface PpossumlOpInputs {
  severity:        1 | 2 | 4 | 8;   // minor=1, moderate=2, major=4, major+=8
  procedures:      1 | 4 | 8;       // 1=1, 2=4, >2=8
  bloodLoss:       1 | 2 | 4 | 8;   // <100mL=1, 101-500=2, 501-999=4, ≥1000=8
  soiling:         1 | 2 | 4 | 8;   // none=1, minor=2, local pus=4, free pus/blood/stool=8
  malignancy:      1 | 2 | 4 | 8;   // no/no nodes=1, primary only=2, lymph nodes=4, distant mets=8
  urgency:         1 | 4 | 8;       // elective=1, emergency (resus possible)=4, emergency (resus impossible)=8
}

export function ppossumlPhysScore(i: PpossumlPhysInputs): number {
  return i.age + i.cardiac + i.respiratory + i.ecg + i.systolicBp +
         i.pulse + i.gcs + i.haematocrit + i.wbc + i.urea + i.sodium + i.potassium;
}

export function ppossumlOpScore(i: PpossumlOpInputs): number {
  return i.severity + i.procedures + i.bloodLoss + i.soiling + i.malignancy + i.urgency;
}

export function ppossumlPredict(physScore: number, opScore: number): { mortality: number; morbidity: number } {
  const logMort = -9.065 + (0.1692 * physScore) + (0.1550 * opScore);
  const logMorb = -5.91  + (0.1612 * physScore) + (0.1248 * opScore);
  const mortality  = (1 / (1 + Math.exp(-logMort))) * 100;
  const morbidity  = (1 / (1 + Math.exp(-logMorb))) * 100;
  return { mortality, morbidity };
}

export function interpretPpossuml(physScore: number, opScore: number): ScaleResult {
  const { mortality, morbidity } = ppossumlPredict(physScore, opScore);
  const color = mortality < 2 ? 'green' : mortality < 10 ? 'amber' : 'red';
  const evidence = 'Prytherch et al., Br J Surg 1998;85:1217-1220. P-POSSUM Portsmouth modification.';
  return {
    score: physScore + opScore,
    band:  `P-POSSUM — Phys ${physScore} / Op ${opScore}`,
    color,
    description: `Predicted 30-day mortality: ${mortality.toFixed(1)}% · Predicted morbidity: ${morbidity.toFixed(1)}%`,
    action: mortality < 2
      ? 'Low predicted risk. Proceed with planned surgery. Standard peri-operative care.'
      : mortality < 5
      ? 'Moderate risk. Discuss risk/benefit with patient. Optimise co-morbidities. Consider HDU post-op.'
      : mortality < 10
      ? 'Elevated risk. Full informed consent documentation. Consider ICU booking. Anaesthetic pre-assessment essential. Multi-disciplinary review.'
      : 'High risk. Senior surgeon involvement. ICU booking. Formal risk discussion with patient and family. Consider non-operative alternatives.',
    evidence,
  };
}

// ── MUST (Malnutrition Universal Screening Tool) ──────────────────────────────
// Ref: BAPEN (2003). Simple 3-criterion nutritional risk screen.

export interface MustInputs {
  bmiScore:        0 | 1 | 2;  // BMI >20=0, 18.5-20=1, <18.5=2
  weightLossScore: 0 | 1 | 2;  // unintentional loss: <5%=0, 5-10%=1, >10%=2
  acuteDiseaseScore: 0 | 2;    // acutely ill + no nutrition >5d: no=0, yes=2
}

export function mustScore(i: MustInputs): number {
  return i.bmiScore + i.weightLossScore + i.acuteDiseaseScore;
}

export function interpretMust(score: number): ScaleResult {
  const evidence = 'BAPEN Malnutrition Universal Screening Tool (MUST), 2003.';
  if (score === 0) return {
    score, band: 'MUST 0 — Low Risk', color: 'green',
    description: 'Low nutritional risk.',
    action: 'Routine clinical care. Repeat MUST in hospital every week, or monthly in the community.',
    evidence,
  };
  if (score === 1) return {
    score, band: 'MUST 1 — Medium Risk', color: 'amber',
    description: 'Medium nutritional risk.',
    action: 'Observe. Document dietary intake for 3 days. If adequate, little concern. If not adequate, clinical concern — act according to local policy. Repeat every week.',
    evidence,
  };
  return {
    score, band: `MUST ${score} — High Risk`, color: 'red',
    description: 'High nutritional risk.',
    action: 'Refer to dietitian or implement local nutrition support policy. Set goals, improve and increase nutritional intake. Monitor and review care plan every week. Consider nutritional supplementation or specialist input.',
    evidence,
  };
}

// ── Caprini VTE Risk Score ────────────────────────────────────────────────────
// Ref: Caprini JA, Dis Mon 2005;51:70-78. Updated 2010 model.

export interface CapriniInputs {
  // 1-point factors
  age41_60:            boolean;
  minorSurgery:        boolean;
  bmi25:               boolean;
  swollenLegs:         boolean;
  varicoseVeins:       boolean;
  pregnancy_postpartum: boolean;
  ocp_hrt:             boolean;
  sepsis_3m:           boolean;
  seriousLungDisease:  boolean;
  abnormalPfts:        boolean;
  acuteMI:             boolean;
  chf:                 boolean;
  ibd:                 boolean;
  conservativelyManaged: boolean;
  // 2-point factors
  age61_74:            boolean;
  arthroscopy:         boolean;
  malignancy:          boolean;
  majorSurgery60m:     boolean;
  laparoscopy60m:      boolean;
  bedRest3d:           boolean;
  immobilisingCast:    boolean;
  centralVenousAccess: boolean;
  // 3-point factors
  age75plus:           boolean;
  vteHistory:          boolean;
  familyHistoryVte:    boolean;
  factorVLeiden:       boolean;
  prothrombinG20210a:  boolean;
  lupusAnticoagulant:  boolean;
  elevatedAntiphospholipid: boolean;
  homocysteine:        boolean;
  hepInducedThrombocytopenia: boolean;
  otherCongenitalThrombophilia: boolean;
  // 5-point factors
  strokeUnder1m:       boolean;
  electiveLowerExtremityArthroplasty: boolean;
  hipPelvicFracture:   boolean;
  acuteSpinalCordInjury: boolean;
  multipleTrauma:      boolean;
}

export function capriniScore(i: CapriniInputs): number {
  let s = 0;
  // 1-point
  [i.age41_60, i.minorSurgery, i.bmi25, i.swollenLegs, i.varicoseVeins,
   i.pregnancy_postpartum, i.ocp_hrt, i.sepsis_3m, i.seriousLungDisease,
   i.abnormalPfts, i.acuteMI, i.chf, i.ibd, i.conservativelyManaged,
  ].forEach(v => { if (v) s += 1; });
  // 2-point
  [i.age61_74, i.arthroscopy, i.malignancy, i.majorSurgery60m,
   i.laparoscopy60m, i.bedRest3d, i.immobilisingCast, i.centralVenousAccess,
  ].forEach(v => { if (v) s += 2; });
  // 3-point
  [i.age75plus, i.vteHistory, i.familyHistoryVte, i.factorVLeiden,
   i.prothrombinG20210a, i.lupusAnticoagulant, i.elevatedAntiphospholipid,
   i.homocysteine, i.hepInducedThrombocytopenia, i.otherCongenitalThrombophilia,
  ].forEach(v => { if (v) s += 3; });
  // 5-point
  [i.strokeUnder1m, i.electiveLowerExtremityArthroplasty, i.hipPelvicFracture,
   i.acuteSpinalCordInjury, i.multipleTrauma,
  ].forEach(v => { if (v) s += 5; });
  return s;
}

export function interpretCaprini(score: number): ScaleResult {
  const evidence = 'Caprini JA, Dis Mon 2005;51:70-78. ACCP 9th Edition guidelines.';
  if (score === 0) return {
    score, band: 'Caprini 0 — Very Low Risk', color: 'green',
    description: 'VTE risk <0.5% without prophylaxis.',
    action: 'Early ambulation. No pharmacological prophylaxis required.',
    evidence,
  };
  if (score <= 2) return {
    score, band: `Caprini ${score} — Low Risk`, color: 'green',
    description: 'VTE risk ~1.5% without prophylaxis.',
    action: 'Mechanical prophylaxis (TED stockings / IPC). Encourage early ambulation.',
    evidence,
  };
  if (score <= 4) return {
    score, band: `Caprini ${score} — Moderate Risk`, color: 'amber',
    description: 'VTE risk ~3% without prophylaxis.',
    action: 'LMWH (enoxaparin 40 mg SC daily) or UFH 5000 IU TDS. Mechanical prophylaxis. Continue 7–10 days post-op.',
    evidence,
  };
  if (score <= 6) return {
    score, band: `Caprini ${score} — High Risk`, color: 'red',
    description: 'VTE risk ~6% without prophylaxis.',
    action: 'LMWH + mechanical prophylaxis. Extend prophylaxis 28 days in major abdominal/pelvic cancer surgery. Consider fondaparinux if LMWH contraindicated.',
    evidence,
  };
  return {
    score, band: `Caprini ${score} — Highest Risk`, color: 'red',
    description: 'VTE risk ≥6% without prophylaxis. Bleeding risk must be weighed.',
    action: 'LMWH + mechanical prophylaxis mandatory. Extended prophylaxis 28–35 days. Consider haematology review if multiple thrombophilia factors. Inferior vena cava filter if LMWH absolutely contraindicated.',
    evidence,
  };
}

// ── STOP-BANG — Obstructive Sleep Apnoea Pre-operative Screening ──────────────
// Ref: Chung F et al., Anesthesiology 2008;108(5):812-821.

export interface StopBangInputs {
  snoring: boolean;       // S: snores loudly
  tired: boolean;         // T: often tired / fatigued / sleepy during daytime
  observed: boolean;      // O: observed stopping breathing / choking / gasping in sleep
  pressure: boolean;      // P: high blood pressure (or being treated for it)
  bmiAbove35: boolean;    // B: BMI > 35 kg/m²
  ageAbove50: boolean;    // A: age > 50 years
  neckAbove40: boolean;   // N: neck circumference > 40 cm
  genderMale: boolean;    // G: gender = male
}

export function stopBangScore(i: StopBangInputs): number {
  return [
    i.snoring, i.tired, i.observed, i.pressure,
    i.bmiAbove35, i.ageAbove50, i.neckAbove40, i.genderMale,
  ].filter(Boolean).length;
}

export function interpretStopBang(score: number): ScaleResult {
  const evidence = 'Chung F et al., Anesthesiology 2008;108(5):812-821. Validated for pre-operative OSA screening.';
  if (score <= 2) return {
    score, band: `STOP-BANG ${score} — Low Risk`, color: 'green',
    description: 'Low risk of moderate/severe obstructive sleep apnoea.',
    action: 'Standard pre-operative assessment. No specific OSA precautions required unless clinical suspicion remains.',
    evidence,
  };
  if (score <= 4) return {
    score, band: `STOP-BANG ${score} — Intermediate Risk`, color: 'amber',
    description: 'Intermediate risk of moderate/severe OSA.',
    action: 'Inform anaesthetist of STOP-BANG score. Avoid post-operative opioids if possible. Continuous pulse oximetry post-op. Consider sleep study if elective surgery allows.',
    evidence,
  };
  return {
    score, band: `STOP-BANG ${score} — High Risk`, color: 'red',
    description: 'High risk of moderate/severe OSA.',
    action: 'Anaesthetic pre-assessment essential. Inform anaesthetist. ICU/HDU monitoring post-op. Avoid deep sedation. Apply CPAP if pre-diagnosed. Consider formal sleep study before elective surgery.',
    evidence,
  };
}

// ── Clinical Frailty Scale (CFS) — Rockwood ───────────────────────────────────
// Ref: Rockwood K et al., CMAJ 2005;173(5):489-495.

export const CFS_LEVELS: { level: 1|2|3|4|5|6|7|8|9; label: string; description: string }[] = [
  { level: 1, label: 'Very Fit',            description: 'Robust, active, energetic and motivated. Exercise regularly. Among fittest for their age.' },
  { level: 2, label: 'Well',                description: 'No active disease symptoms but less fit than category 1. Occasionally active or exercises.' },
  { level: 3, label: 'Managing Well',       description: 'Medical problems well controlled, but not regularly active beyond routine walking.' },
  { level: 4, label: 'Vulnerable',          description: 'Not dependent but often slowed by symptoms. Complain of being "slowed up" or tired during the day.' },
  { level: 5, label: 'Mildly Frail',        description: 'Evident slowing, dependent on others for IADLs (finances, transport, heavy housework, medications).' },
  { level: 6, label: 'Moderately Frail',    description: 'Needs help with all outside activities and keeping house. Indoor: difficulty with stairs; help needed with bathing.' },
  { level: 7, label: 'Severely Frail',      description: 'Completely dependent for personal care from any cause (physical or cognitive). Stable, not at imminent risk of dying.' },
  { level: 8, label: 'Very Severely Frail', description: 'Completely dependent, approaching end of life. Typically cannot recover even from a minor illness.' },
  { level: 9, label: 'Terminally Ill',      description: 'Life expectancy < 6 months. Not otherwise evidently frail by above criteria.' },
];

export function interpretCfs(level: number): ScaleResult {
  const evidence = 'Rockwood K et al., CMAJ 2005;173(5):489-495. Validated for pre-operative frailty risk stratification.';
  if (level <= 3) return {
    score: level, band: `CFS ${level} — Not Frail`, color: 'green',
    description: 'No significant frailty. Perioperative risk not substantially elevated by frailty alone.',
    action: 'Standard pre-operative assessment. Manage other risk factors as per usual.',
    evidence,
  };
  if (level === 4) return {
    score: level, band: 'CFS 4 — Vulnerable', color: 'amber',
    description: 'Vulnerable — increased perioperative risk. Not dependent but symptoms limit activity.',
    action: 'Multidisciplinary pre-operative assessment. Prehabilitation if surgery is elective. Optimise nutrition, mobility, and medications. Geriatric input if appropriate.',
    evidence,
  };
  if (level <= 6) return {
    score: level, band: `CFS ${level} — Frail`, color: 'amber',
    description: 'Frail — significantly elevated perioperative mortality and morbidity risk.',
    action: 'Comprehensive geriatric assessment. Weigh risk vs benefit carefully. Prehabilitation, nutrition optimisation, polypharmacy review. HDU/ICU plan. Advance care planning discussion.',
    evidence,
  };
  return {
    score: level, band: `CFS ${level} — Severely Frail`, color: 'red',
    description: 'Severe frailty or terminal illness. Very high perioperative risk. Major surgery unlikely tolerated.',
    action: 'Goals-of-care discussion with patient and family essential. Consider non-operative alternatives or palliative management. Senior surgical and anaesthetic involvement. Formal advance care plan.',
    evidence,
  };
}

// ── ECOG Performance Status ───────────────────────────────────────────────────
// Ref: Oken MM et al., Am J Clin Oncol 1982;5:649-655.

export const ECOG_LEVELS: { level: 0|1|2|3|4; label: string; description: string }[] = [
  { level: 0, label: 'Fully Active',        description: 'Fully active, able to carry on all pre-disease activities without restriction.' },
  { level: 1, label: 'Restricted',          description: 'Restricted in physically strenuous activity but ambulatory; able to carry out light or sedentary work.' },
  { level: 2, label: 'Ambulatory',          description: 'Ambulatory and capable of all self-care but unable to carry out work activities; up and about > 50% of waking hours.' },
  { level: 3, label: 'Limited Self-care',   description: 'Capable of only limited self-care; confined to bed or chair > 50% of waking hours.' },
  { level: 4, label: 'Completely Disabled', description: 'Completely disabled; cannot carry on any self-care; totally confined to bed or chair.' },
];

export function interpretEcog(level: number): ScaleResult {
  const evidence = 'Oken MM et al., Am J Clin Oncol 1982;5:649-655. Eastern Cooperative Oncology Group performance scale.';
  if (level === 0) return {
    score: level, band: 'ECOG 0 — Fully Active', color: 'green',
    description: 'No functional limitation. Full treatment options available.',
    action: 'All treatment modalities appropriate. Standard surgical/oncological management.',
    evidence,
  };
  if (level === 1) return {
    score: level, band: 'ECOG 1 — Restricted', color: 'green',
    description: 'Minor functional limitation. Good candidate for most surgical interventions.',
    action: 'All treatment modalities generally appropriate. Minor dose/procedure modifications may be considered.',
    evidence,
  };
  if (level === 2) return {
    score: level, band: 'ECOG 2 — Ambulatory', color: 'amber',
    description: 'Moderate functional limitation. Increased surgical and post-operative risk.',
    action: 'Selected treatment approaches. Full risk/benefit discussion. Multidisciplinary team involvement. Enhanced recovery programme.',
    evidence,
  };
  if (level === 3) return {
    score: level, band: 'ECOG 3 — Limited Self-care', color: 'red',
    description: 'Significant functional limitation. Major surgery carries high risk.',
    action: 'Palliative or minimally invasive approaches preferred. MDT essential. Goals-of-care discussion. Avoid major elective surgery unless life-saving.',
    evidence,
  };
  return {
    score: level, band: 'ECOG 4 — Completely Disabled', color: 'red',
    description: 'Severe functional impairment. Very high surgical risk.',
    action: 'Palliative management strongly preferred. Surgical intervention rarely appropriate. Comprehensive goals-of-care discussion. Hospice referral if appropriate.',
    evidence,
  };
}

// ── PHQ-9 — Patient Health Questionnaire (Depression) ────────────────────────
// Ref: Kroenke K et al., J Gen Intern Med 2001;16(9):606-613.

export const PHQ9_QUESTIONS: string[] = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed; or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

export const LIKERT_OPTS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] as const;

export function phq9Score(answers: number[]): number {
  return answers.reduce((s, v) => s + (v ?? 0), 0);
}

export function interpretPhq9(score: number): ScaleResult {
  const evidence = 'Kroenke K et al., J Gen Intern Med 2001;16(9):606-613. Sensitivity 88%, specificity 88% at cut-off ≥10.';
  if (score <= 4) return {
    score, band: `PHQ-9 ${score} — None / Minimal`, color: 'green',
    description: 'Minimal depressive symptoms.',
    action: 'Routine monitoring. Reassess at follow-up. Safety net as standard.',
    evidence,
  };
  if (score <= 9) return {
    score, band: `PHQ-9 ${score} — Mild`, color: 'green',
    description: 'Mild depressive symptoms.',
    action: 'Watchful waiting. Discuss psychosocial stressors. Consider GP referral for talking therapy. Reassess in 4 weeks.',
    evidence,
  };
  if (score <= 14) return {
    score, band: `PHQ-9 ${score} — Moderate`, color: 'amber',
    description: 'Moderate depression.',
    action: 'Psychological treatment (CBT) or pharmacotherapy. Consider referral to mental health services. Review in 2–4 weeks. Assess suicide risk (Q9).',
    evidence,
  };
  if (score <= 19) return {
    score, band: `PHQ-9 ${score} — Moderately Severe`, color: 'red',
    description: 'Moderately severe depression.',
    action: 'Active treatment with antidepressant and/or psychotherapy. Refer to mental health services. Assess suicide risk (Q9) — urgent review if positive. Safety plan.',
    evidence,
  };
  return {
    score, band: `PHQ-9 ${score} — Severe`, color: 'red',
    description: 'Severe depression.',
    action: 'Immediate mental health referral. Combined antidepressant + psychotherapy. Assess suicide risk (Q9) urgently. Consider psychiatric admission if risk high.',
    evidence,
  };
}

// ── GAD-7 — Generalised Anxiety Disorder Scale ────────────────────────────────
// Ref: Spitzer RL et al., Arch Intern Med 2006;166(10):1092-1097.

export const GAD7_QUESTIONS: string[] = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];

export function gad7Score(answers: number[]): number {
  return answers.reduce((s, v) => s + (v ?? 0), 0);
}

export function interpretGad7(score: number): ScaleResult {
  const evidence = 'Spitzer RL et al., Arch Intern Med 2006;166(10):1092-1097. Cut-off ≥10: sensitivity 89%, specificity 82%.';
  if (score <= 4) return {
    score, band: `GAD-7 ${score} — Minimal`, color: 'green',
    description: 'Minimal anxiety symptoms.',
    action: 'Routine clinical care. Reassess at follow-up.',
    evidence,
  };
  if (score <= 9) return {
    score, band: `GAD-7 ${score} — Mild`, color: 'green',
    description: 'Mild anxiety.',
    action: 'Watchful waiting. Psychoeducation. Consider self-help resources or brief counselling. Reassess in 4 weeks.',
    evidence,
  };
  if (score <= 14) return {
    score, band: `GAD-7 ${score} — Moderate`, color: 'amber',
    description: 'Moderate anxiety disorder likely.',
    action: 'CBT or other evidence-based psychological therapy. Consider pharmacotherapy (SSRI/SNRI). Refer to mental health services. Review in 2–4 weeks.',
    evidence,
  };
  return {
    score, band: `GAD-7 ${score} — Severe`, color: 'red',
    description: 'Severe anxiety disorder.',
    action: 'Active treatment essential. Combined CBT and pharmacotherapy. Urgent mental health referral. Assess for panic disorder, OCD, PTSD, and social anxiety. Safety plan.',
    evidence,
  };
}

// ── GERD-Q — Gastro-oesophageal Reflux Disease Questionnaire ─────────────────
// Ref: Jones R et al., Aliment Pharmacol Ther 2009;30(10):1030-1038.
// Validated for primary care and pre-endoscopy diagnosis of GORD.

export const GERDQ_QUESTIONS: { text: string; reversed: boolean }[] = [
  { text: 'How often did you have a burning feeling behind your breastbone (heartburn)?', reversed: false },
  { text: 'How often did you have stomach contents (liquid or food) moving upwards to your throat or mouth (regurgitation)?', reversed: false },
  { text: 'How often did you have a pain in the centre of the upper stomach area (epigastric pain)?', reversed: true },
  { text: 'How often did you have nausea?', reversed: true },
  { text: 'How often did you have difficulty getting a good night\'s sleep because of your heartburn or regurgitation?', reversed: false },
  { text: 'How often did you take additional medication for your heartburn or regurgitation, other than what the doctor told you to take?', reversed: false },
];

export const GERDQ_FREQ_OPTS = ['0 days', '1 day', '2–3 days', '4–7 days'] as const;

export function gerdqScore(answers: number[]): number {
  return GERDQ_QUESTIONS.reduce((s, q, i) => {
    const raw = answers[i] ?? 0;
    return s + (q.reversed ? (3 - raw) : raw);
  }, 0);
}

export function interpretGerdq(score: number): ScaleResult {
  const evidence = 'Jones R et al., Aliment Pharmacol Ther 2009;30(10):1030-1038. Cut-off ≥8: sensitivity 65%, specificity 71%.';
  if (score <= 7) return {
    score, band: `GERD-Q ${score} — GORD Unlikely`, color: 'green',
    description: 'Symptoms do not strongly suggest gastro-oesophageal reflux disease.',
    action: 'Consider functional dyspepsia, IBS, or other diagnosis. Test and treat for H. pylori if dyspepsia. Upper GI endoscopy if alarm features present.',
    evidence,
  };
  if (score <= 10) return {
    score, band: `GERD-Q ${score} — GORD Likely`, color: 'amber',
    description: 'Symptoms consistent with GORD. No significant impact on daily life.',
    action: 'Empirical trial of PPI (e.g. omeprazole 20 mg od) for 4–8 weeks. Lifestyle advice (weight loss, head-of-bed elevation, avoid trigger foods/alcohol/late meals). Review response.',
    evidence,
  };
  return {
    score, band: `GERD-Q ${score} — GORD Likely + Impact`, color: 'red',
    description: 'GORD likely with significant impact on quality of life and sleep.',
    action: 'PPI therapy (omeprazole 20–40 mg od for 4–8 weeks). Lifestyle modification. Endoscopy recommended — especially if alarm features, age >55, or inadequate PPI response. Consider 24-h pH/impedance if diagnosis uncertain.',
    evidence,
  };
}

// ── Child-Pugh Score — Liver Disease Surgical Risk ────────────────────────────
// Ref: Pugh RN et al., Br J Surg 1973;60(8):646-649. Modified Child-Turcotte-Pugh.

export interface ChildPughInputs {
  bilirubin:    1 | 2 | 3;   // µmol/L: <34=1, 34-50=2, >50=3
  albumin:      1 | 2 | 3;   // g/L: >35=1, 28-35=2, <28=3
  inr:          1 | 2 | 3;   // <1.7=1, 1.7-2.3=2, >2.3=3
  ascites:      1 | 2 | 3;   // absent=1, mild=2, severe=3
  encephalopathy: 1 | 2 | 3; // none=1, grade I-II=2, grade III-IV=3
}

export function childPughScore(i: ChildPughInputs): number {
  return i.bilirubin + i.albumin + i.inr + i.ascites + i.encephalopathy;
}

export function interpretChildPugh(score: number): ScaleResult {
  const evidence = 'Pugh RN et al., Br J Surg 1973;60(8):646-649. Modified Child-Turcotte-Pugh (CTP). Predicts peri-operative mortality in chronic liver disease.';
  if (score <= 6) return {
    score, band: `Child-Pugh A (score ${score}) — Well-compensated`, color: 'green',
    description: 'Well-compensated cirrhosis. Estimated operative mortality ≈ 10%.',
    action: 'Surgery generally feasible. Standard peri-operative optimisation. Hepatology review recommended. Correct coagulopathy pre-operatively. Monitor for decompensation post-op.',
    evidence,
  };
  if (score <= 9) return {
    score, band: `Child-Pugh B (score ${score}) — Significant impairment`, color: 'amber',
    description: 'Significantly impaired hepatic function. Estimated operative mortality ≈ 30%.',
    action: 'High surgical risk. Hepatology referral mandatory. Optimise nutrition, coagulopathy, and ascites pre-operatively. MELD score should also be calculated. Weigh risk vs benefit carefully with patient. Consider TIPS for refractory ascites before elective surgery.',
    evidence,
  };
  return {
    score, band: `Child-Pugh C (score ${score}) — Decompensated`, color: 'red',
    description: 'Decompensated cirrhosis. Estimated operative mortality ≈ 80%.',
    action: 'Major elective surgery contraindicated. Hepatology referral essential. Liver transplantation evaluation if appropriate. Palliative / minimal-access procedures only if surgery unavoidable. Full goals-of-care discussion.',
    evidence,
  };
}

// ── Apfel Score — Post-operative Nausea and Vomiting (PONV) ──────────────────
// Ref: Apfel CC et al., Anesthesiology 1999;91(3):693-700.

export interface ApfelInputs {
  femaleSex: boolean;           // female gender
  nonSmoker: boolean;           // non-smoker
  priorPonvOrMotionSickness: boolean; // history of PONV or motion sickness
  postopOpioids: boolean;       // post-operative opioid use expected
}

export const APFEL_RISK: { score: number; risk: number; label: string }[] = [
  { score: 0, risk: 10, label: '~10%' },
  { score: 1, risk: 21, label: '~21%' },
  { score: 2, risk: 39, label: '~39%' },
  { score: 3, risk: 61, label: '~61%' },
  { score: 4, risk: 79, label: '~79%' },
];

export function apfelScore(i: ApfelInputs): number {
  return [i.femaleSex, i.nonSmoker, i.priorPonvOrMotionSickness, i.postopOpioids].filter(Boolean).length;
}

export function interpretApfel(score: number): ScaleResult {
  const evidence = 'Apfel CC et al., Anesthesiology 1999;91(3):693-700. Validated for predicting PONV within 24 h after general anaesthesia.';
  const risk = APFEL_RISK[score]?.risk ?? 79;
  if (score <= 1) return {
    score, band: `Apfel ${score} — Low PONV Risk (${risk}%)`, color: 'green',
    description: `PONV risk approximately ${risk}%. Prophylaxis may not be routinely required.`,
    action: 'Consider single antiemetic if risk factors present. TIVA not required. Standard anaesthetic technique acceptable.',
    evidence,
  };
  if (score === 2) return {
    score, band: `Apfel ${score} — Moderate PONV Risk (${risk}%)`, color: 'amber',
    description: `PONV risk approximately ${risk}%. Multimodal prophylaxis recommended.`,
    action: 'Give 2 antiemetics from different classes (e.g. ondansetron 4 mg IV + dexamethasone 4 mg IV at induction). Minimise opioids (NSAIDs, paracetamol, regional techniques). Consider TIVA if high-risk surgery.',
    evidence,
  };
  return {
    score, band: `Apfel ${score} — High PONV Risk (${risk}%)`, color: 'red',
    description: `PONV risk approximately ${risk}%. Aggressive multimodal prophylaxis essential.`,
    action: 'Give ≥3 antiemetics (ondansetron + dexamethasone + scopolamine patch or droperidol). TIVA strongly recommended (avoids volatile anaesthetic trigger). Minimise opioids — regional/neuraxial anaesthesia if feasible. Discuss with anaesthetist pre-operatively.',
    evidence,
  };
}

// ── MELD / MELD-Na — End-stage Liver Disease Severity ────────────────────────
// Ref: Kamath PS et al., Hepatology 2001;33(2):464-470.
// MELD-Na ref: Kim WR et al., Hepatology 2008;48(4):1106-1111.

export function meldScore(bilirubinMgDl: number, inr: number, creatinineMgDl: number): number {
  const safeBili   = Math.max(bilirubinMgDl, 1);
  const safeInr    = Math.max(inr, 1);
  const safeCr     = Math.min(Math.max(creatinineMgDl, 1), 4); // capped at 4 mg/dL per UNOS
  const raw = 3.78 * Math.log(safeBili) + 11.2 * Math.log(safeInr) + 9.57 * Math.log(safeCr) + 6.43;
  return Math.round(Math.max(6, raw));
}

export function meldNaScore(meld: number, sodiumMmol: number): number {
  const na = Math.min(Math.max(sodiumMmol, 125), 137); // clamped 125-137
  return Math.round(meld + 1.32 * (137 - na) - 0.033 * meld * (137 - na));
}

export function interpretMeld(score: number): ScaleResult {
  const evidence = 'Kamath PS et al., Hepatology 2001;33(2):464-470. UNOS/OPTN liver allocation metric. Predicts 90-day waitlist mortality.';
  if (score < 10) return {
    score, band: `MELD ${score} — Low severity`, color: 'green',
    description: 'Low disease severity. Estimated 90-day mortality < 2% on waitlist.',
    action: 'Ongoing hepatology follow-up. Optimise comorbidities. Assess for varices and HCC surveillance. Elective surgery generally feasible with appropriate precautions.',
    evidence,
  };
  if (score < 20) return {
    score, band: `MELD ${score} — Moderate severity`, color: 'amber',
    description: 'Moderate liver disease severity. Estimated 90-day mortality 6–20%.',
    action: 'Hepatology co-management essential. Transplant evaluation if not already initiated. High surgical risk — avoid elective major surgery if possible. Optimise nutrition and ascites.',
    evidence,
  };
  if (score < 30) return {
    score, band: `MELD ${score} — High severity`, color: 'red',
    description: 'High severity. Estimated 90-day mortality 20–52%.',
    action: 'Urgent transplant evaluation. Elective surgery contraindicated. Emergency-only procedures with ICU-level perioperative care. Hepatology and anaesthetic input essential.',
    evidence,
  };
  return {
    score, band: `MELD ${score} — Very high / Critical`, color: 'red',
    description: 'Critical disease severity. Estimated 90-day mortality > 52%.',
    action: 'Highest-priority transplant listing. Surgery carries extreme risk. Intensive medical stabilisation. Goals-of-care discussion with patient and family.',
    evidence,
  };
}

// ── CHA₂DS₂-VASc — AF Stroke Risk / Anticoagulation Decision ─────────────────
// Ref: Lip GY et al., Chest 2010;137(2):263-272.
// ESC 2020 AF guidelines recommend anticoagulation for men ≥2, women ≥3.

export interface Chads2VascInputs {
  heartFailure:       boolean; // +1
  hypertension:       boolean; // +1
  age75plus:          boolean; // +2 (takes precedence over age65to74)
  diabetes:           boolean; // +1
  strokeOrTia:        boolean; // +2
  vascularDisease:    boolean; // +1 (prior MI, PAD, or aortic plaque)
  age65to74:          boolean; // +1 (only if NOT age75plus)
  femaleSex:          boolean; // +1 (modifier — doesn't independently confer risk)
}

export function chads2VascScore(i: Chads2VascInputs): number {
  let s = 0;
  if (i.heartFailure)    s += 1;
  if (i.hypertension)    s += 1;
  if (i.age75plus)       s += 2;
  else if (i.age65to74)  s += 1;
  if (i.diabetes)        s += 1;
  if (i.strokeOrTia)     s += 2;
  if (i.vascularDisease) s += 1;
  if (i.femaleSex)       s += 1;
  return s;
}

export function interpretChads2Vasc(score: number, femaleSex: boolean): ScaleResult {
  const evidence = 'Lip GYH et al., Chest 2010;137:263-272. ESC 2020 AF Guidelines (Hindricks G et al., Eur Heart J 2021;42:373-498).';
  // Female sex alone (score=1, female=true with only that point) = effectively score 0 for men
  // ESC: Men ≥2, Women ≥3 → anticoagulate; Men 1, Women 2 → consider
  const effectiveScore = femaleSex ? score - 1 : score; // net score excluding sex modifier

  if (effectiveScore <= 0) return {
    score, band: `CHA₂DS₂-VASc ${score} — Very low stroke risk`, color: 'green',
    description: 'Very low annual stroke risk. Anticoagulation not indicated.',
    action: 'No anticoagulation required. Reassess annually or if clinical status changes. Review CHA₂DS₂-VASc at each clinical encounter.',
    evidence,
  };
  if (effectiveScore === 1) return {
    score, band: `CHA₂DS₂-VASc ${score} — Low–moderate stroke risk`, color: 'amber',
    description: 'Low–moderate annual stroke risk (~1–2%/year). Anticoagulation may be considered after weighing stroke risk against bleeding risk (HAS-BLED).',
    action: 'Consider oral anticoagulation (DOAC preferred over warfarin). Calculate HAS-BLED score. Discuss risks and benefits with patient. Address modifiable bleeding risk factors before deciding.',
    evidence,
  };
  return {
    score, band: `CHA₂DS₂-VASc ${score} — Significant stroke risk`, color: 'red',
    description: `Significant annual stroke risk (~${score >= 5 ? '>6' : score >= 3 ? '3–4' : '2–3'}%/year). Oral anticoagulation strongly recommended unless absolute contraindication exists.`,
    action: 'Initiate oral anticoagulation (DOAC preferred: apixaban, rivaroxaban, or dabigatran). If valvular AF or mechanical valve — warfarin only. Calculate HAS-BLED — a high score should prompt correction of modifiable bleeding risks, not withholding anticoagulation. Refer to cardiology if uncertain.',
    evidence,
  };
}

// ── HAS-BLED — Bleeding Risk on Anticoagulation ───────────────────────────────
// Ref: Pisters R et al., Chest 2010;138(5):1093-1100.
// Used alongside CHA₂DS₂-VASc — high HAS-BLED prompts risk-factor correction, not withholding OAC.

export interface HasBledInputs {
  hypertensionUncontrolled: boolean; // SBP > 160 mmHg — +1
  renalDisease:             boolean; // dialysis / transplant / creatinine > 200 µmol/L — +1
  liverDisease:             boolean; // cirrhosis / bilirubin > 2× ULN / ALT/AST/ALP > 3× ULN — +1
  strokeHistory:            boolean; // +1
  bleedingHistory:          boolean; // prior major bleed or bleeding predisposition — +1
  labileInr:                boolean; // unstable/high INR or time-in-therapeutic-range < 60% — +1
  elderlyAge65:             boolean; // age ≥ 65 years — +1
  drugsOrAlcohol:           boolean; // antiplatelet / NSAIDs (1 pt) OR ≥8 alcohol drinks/week (1 pt); max 2 pts
  alcoholUse:               boolean; // ≥ 8 drinks / week (combined with drugs above for up to +2)
}

export function hasBledScore(i: HasBledInputs): number {
  let s = 0;
  if (i.hypertensionUncontrolled) s += 1;
  if (i.renalDisease)             s += 1;
  if (i.liverDisease)             s += 1;
  if (i.strokeHistory)            s += 1;
  if (i.bleedingHistory)          s += 1;
  if (i.labileInr)                s += 1;
  if (i.elderlyAge65)             s += 1;
  if (i.drugsOrAlcohol)           s += 1;
  if (i.alcoholUse)               s += 1;
  return Math.min(s, 9);
}

export function interpretHasBled(score: number): ScaleResult {
  const evidence = 'Pisters R et al., Chest 2010;138(5):1093-1100. ESC 2020 AF Guidelines recommend HAS-BLED to identify correctable bleeding risks — a high score should not withhold OAC but prompt risk-factor modification.';
  if (score <= 1) return {
    score, band: `HAS-BLED ${score} — Low bleeding risk`, color: 'green',
    description: 'Low annual major bleeding risk (~1–2%/year). Anticoagulation can be started with routine monitoring.',
    action: 'Proceed with anticoagulation per CHA₂DS₂-VASc recommendation. Annual review of bleeding risk factors. Educate patient on signs of bleeding.',
    evidence,
  };
  if (score === 2) return {
    score, band: `HAS-BLED ${score} — Moderate bleeding risk`, color: 'amber',
    description: 'Moderate annual major bleeding risk (~2–4%/year). Benefits of anticoagulation for stroke prevention likely outweigh bleeding risk at CHA₂DS₂-VASc ≥2.',
    action: 'Anticoagulate if stroke risk justifies. Address modifiable risk factors: control blood pressure, review concomitant NSAIDs/antiplatelets, optimise INR control (or switch to DOAC). More frequent follow-up. Patient education essential.',
    evidence,
  };
  return {
    score, band: `HAS-BLED ${score} — High bleeding risk`, color: 'red',
    description: `High annual major bleeding risk (≥4%/year). HAS-BLED ≥3 signals a need to correct modifiable bleeding risk factors — it should NOT by itself justify withholding anticoagulation if stroke risk is high.`,
    action: 'Identify and correct modifiable risk factors: treat hypertension, stop NSAIDs/antiplatelets if possible, stabilise INR (consider DOAC), address alcohol use, review renal and liver function. Use the lowest effective anticoagulant dose. Increased monitoring frequency. Consider haematology or cardiology input. Document risk-benefit discussion.',
    evidence,
  };
}

// ── qSOFA — Quick SOFA (Bedside Sepsis Screen) ───────────────────────────────
// Ref: Seymour CW et al., JAMA 2016;315(8):762-774.
// Score ≥ 2 → high risk of organ dysfunction — initiate sepsis workup / response.

export function qSofaScore(alteredMentalStatus: boolean, respiratoryRatePerMin: number | null, systolicBpMmHg: number | null): number {
  let s = 0;
  if (alteredMentalStatus)                                s += 1;
  if (respiratoryRatePerMin !== null && respiratoryRatePerMin >= 22)  s += 1;
  if (systolicBpMmHg !== null && systolicBpMmHg <= 100)              s += 1;
  return s;
}

export function interpretQsofa(score: number): ScaleResult {
  const evidence = 'Seymour CW et al., JAMA 2016;315(8):762-774. Sepsis-3 Task Force. qSOFA is a bedside screening tool — does not replace full SOFA for ICU scoring.';
  if (score === 0) return {
    score, band: 'qSOFA 0 — Low probability of organ dysfunction', color: 'green',
    description: 'Low likelihood of sepsis-related organ dysfunction at this time.',
    action: 'Continue monitoring. Reassess if clinical status changes. Consider infection source investigation if clinically suspected.',
    evidence,
  };
  if (score === 1) return {
    score, band: 'qSOFA 1 — Intermediate concern', color: 'amber',
    description: 'One criterion met. Monitor closely for deterioration. Infection should be actively considered.',
    action: 'Assess for source of infection. Check lactate, FBC, CRP, blood cultures if clinically indicated. Increase observation frequency. Reassess within 30–60 minutes.',
    evidence,
  };
  return {
    score, band: `qSOFA ${score} — High risk of sepsis / organ dysfunction`, color: 'red',
    description: '≥2 criteria met. High risk of sepsis with organ dysfunction. Immediate senior review required.',
    action: 'Activate Sepsis 6 / sepsis bundle within 1 hour: blood cultures × 2, IV antibiotics, IV fluids, urine output monitoring, lactate, high-flow O₂. Urgent senior/intensivist review. Consider ICU escalation. Identify and control source of infection.',
    evidence,
  };
}

// ── ASA Physical Status Classification ───────────────────────────────────────
// Ref: ASA House of Delegates, October 2014 (updated 2020).
// Used on every operative patient — documents anaesthetic/surgical risk.

export type AsaClass = 1 | 2 | 3 | 4 | 5 | 6;

export interface AsaLevelInfo {
  class: AsaClass;
  label: string;
  description: string;
  examples: string;
  mortalityApprox: string;
}

export const ASA_LEVELS: AsaLevelInfo[] = [
  {
    class: 1,
    label: 'ASA I — Normal healthy patient',
    description: 'No organic, physiological, or psychiatric disturbance. Excludes very young and very old.',
    examples: 'Healthy, non-smoking, no or minimal alcohol use.',
    mortalityApprox: '< 0.1%',
  },
  {
    class: 2,
    label: 'ASA II — Mild systemic disease',
    description: 'Mild disease without substantive functional limitations.',
    examples: 'Current smoker, social alcohol drinker, pregnancy, obesity (BMI 30–40), well-controlled DM/HTN/asthma, mild lung disease.',
    mortalityApprox: '0.3%',
  },
  {
    class: 3,
    label: 'ASA III — Severe systemic disease',
    description: 'Substantive functional limitations; ≥1 moderate to severe disease.',
    examples: 'Poorly controlled DM/HTN, COPD, morbid obesity (BMI ≥ 40), active hepatitis, alcohol dependence, implanted pacemaker, moderate EF reduction, ESRD on regular dialysis, premature infant PCA < 60 wk, history (> 3 months) of MI, CVA, TIA, CAD/stents.',
    mortalityApprox: '1.4%',
  },
  {
    class: 4,
    label: 'ASA IV — Severe systemic disease, constant threat to life',
    description: 'Severe systemic disease that is a constant threat to life.',
    examples: 'Recent (< 3 months) MI, CVA, TIA or CAD/stents, ongoing cardiac ischaemia or severe valve dysfunction, severe EF reduction, sepsis, DIC, ARD, ESRD not undergoing regularly scheduled dialysis.',
    mortalityApprox: '7.8%',
  },
  {
    class: 5,
    label: 'ASA V — Moribund patient',
    description: 'Moribund patient not expected to survive without the operation.',
    examples: 'Ruptured abdominal/thoracic aneurysm, massive trauma, intracranial bleed with mass effect, ischaemic bowel facing significant cardiac pathology or multi-organ/system dysfunction.',
    mortalityApprox: '9.4%',
  },
  {
    class: 6,
    label: 'ASA VI — Brain-dead organ donor',
    description: 'A declared brain-dead patient whose organs are being removed for donor purposes.',
    examples: 'Organ procurement surgery.',
    mortalityApprox: 'N/A',
  },
];

export function interpretAsa(asaClass: AsaClass, emergency: boolean): ScaleResult {
  const level = ASA_LEVELS.find(l => l.class === asaClass)!;
  const eSuffix = emergency ? 'E' : '';
  const evidence = 'American Society of Anesthesiologists Physical Status Classification System (2014, updated 2020). Saklad M, Anesthesiology 1941;2:281-284.';
  const colorMap: Record<AsaClass, ScaleResult['color']> = { 1: 'green', 2: 'green', 3: 'amber', 4: 'red', 5: 'red', 6: 'red' };
  return {
    score: asaClass,
    band: `ASA ${asaClass}${eSuffix} — ${level.label.split('—')[1].trim()}`,
    color: colorMap[asaClass],
    description: `${level.description}${emergency ? ' Emergency surgery — operative mortality approximately 3× higher than elective.' : ''} Approximate perioperative mortality: ${level.mortalityApprox}.`,
    action: asaClass <= 2
      ? `Proceed with standard anaesthetic and surgical care. Document ASA ${asaClass}${eSuffix} in operative note and consent form. Routine postoperative monitoring.`
      : asaClass === 3
      ? `Optimise comorbidities pre-operatively where possible. Anaesthetic pre-assessment required. Senior surgeon and anaesthetist involvement. Enhanced monitoring and recovery facilities. Document ASA ${asaClass}${eSuffix}.`
      : `High-risk patient — multidisciplinary pre-operative assessment. ICU/HDU bed reservation recommended. Consultant anaesthetist involvement. Senior surgeon only. Document ASA ${asaClass}${eSuffix}. Detailed consent including risk of perioperative death. Consider goals-of-care discussion.`,
    evidence,
  };
}

// ── BISAP — Bedside Index of Severity in Acute Pancreatitis ─────────────────
// Ref: Wu BU et al., Am J Gastroenterol 2009;104(4):966-971.
// Validated for in-hospital mortality prediction at 24 h; simpler than Ranson's.

export interface BisapInputs {
  bunAbove25:          boolean; // BUN > 25 mg/dL (8.9 mmol/L)
  impairedMentalStatus: boolean; // GCS < 15 / disorientation / lethargy
  sirs:                boolean; // ≥ 2 SIRS criteria present
  ageAbove60:          boolean; // age > 60 years
  pleuralEffusion:     boolean; // pleural effusion on imaging
}

export function bisapScore(i: BisapInputs): number {
  return [i.bunAbove25, i.impairedMentalStatus, i.sirs, i.ageAbove60, i.pleuralEffusion]
    .filter(Boolean).length;
}

export function interpretBisap(score: number): ScaleResult {
  const evidence = 'Wu BU et al., Am J Gastroenterol 2009;104(4):966-971. Validated against Ranson\'s in multiple prospective cohorts.';
  if (score <= 1) return {
    score, band: `BISAP ${score} — Mild pancreatitis`, color: 'green',
    description: 'Low predicted in-hospital mortality (< 1%). Likely mild acute pancreatitis.',
    action: 'IV fluid resuscitation (lactated Ringer\'s preferred over normal saline), early oral feeding when tolerated, analgesics. Standard ward monitoring. No routine ICU needed. Reassess at 24 and 48 h. Investigate aetiology (gallstones, alcohol, lipids, medications).',
    evidence,
  };
  if (score === 2) return {
    score, band: `BISAP ${score} — Moderate pancreatitis`, color: 'amber',
    description: 'Moderate predicted mortality (~2%). Increased risk of organ failure and local complications.',
    action: 'Aggressive IV resuscitation. Step-up to HDU or closely monitored ward. Gastroenterology or surgical review. Monitor urine output, renal function, haematocrit, CRP at 24–48 h. CT with contrast (CECT) if no clinical improvement at 48–72 h. Nutritional support — early enteral feeding preferred.',
    evidence,
  };
  return {
    score, band: `BISAP ${score} — Severe pancreatitis`, color: 'red',
    description: `High predicted in-hospital mortality (score 3: ~5–6%; score 4: ~13%; score 5: ~22%). Severe acute pancreatitis — expect organ failure and/or local complications.`,
    action: 'ICU admission. Aggressive fluid resuscitation with close haemodynamic monitoring. Urgent CECT pancreas at 72 h (or sooner if clinical deterioration). Surgical and gastroenterology involvement. Nutritional support via nasojejunal tube. Antibiotics only if infected necrosis suspected. ERCP within 24 h if cholangitis or CBD obstruction. Monitor for ARDS, AKI, abdominal compartment syndrome.',
    evidence,
  };
}

// ── Forrest Classification — Endoscopic Peptic Ulcer Bleeding Stigmata ───────
// Ref: Forrest JA et al., Lancet 1974;2(7877):394-397. Updated in ACG/ESGE guidelines.
// Essential classification for any endoscopic GI bleed workup.

export type ForrestClass = 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'IIc' | 'III';

export interface ForrestLevelInfo {
  class: ForrestClass;
  label: string;
  description: string;
  rebleedRisk: string;
  management: string;
}

export const FORREST_LEVELS: ForrestLevelInfo[] = [
  {
    class: 'Ia',
    label: 'Ia — Active arterial spurting',
    description: 'Active pulsatile arterial haemorrhage from the ulcer base.',
    rebleedRisk: '55–90%',
    management: 'Endoscopic haemostasis required (dual therapy: adrenaline injection + thermal or mechanical method). Repeat endoscopy at 24 h if haemostasis uncertain. High-dose PPI infusion (80 mg bolus → 8 mg/h for 72 h). Interventional radiology or surgical back-up on standby.',
  },
  {
    class: 'Ib',
    label: 'Ib — Active oozing',
    description: 'Non-pulsatile active bleeding — continuous ooze from the ulcer.',
    rebleedRisk: '55%',
    management: 'Endoscopic haemostasis required (as for Ia). High-dose PPI infusion. Monitor in HDU/ICU. Blood transfusion threshold Hb < 80 g/L (restrictive strategy).',
  },
  {
    class: 'IIa',
    label: 'IIa — Non-bleeding visible vessel (NBVV)',
    description: 'Adherent clot has separated or was not present — pigmented protuberance in ulcer base. Sentinel clot.',
    rebleedRisk: '43%',
    management: 'Endoscopic haemostasis strongly recommended. High-dose PPI infusion × 72 h, then oral PPI. Close inpatient monitoring × 48–72 h.',
  },
  {
    class: 'IIb',
    label: 'IIb — Adherent clot',
    description: 'Adherent organised clot overlying the ulcer base, not dislodged by vigorous irrigation.',
    rebleedRisk: '22%',
    management: 'Controversial — consider clot removal and treat underlying stigmata if NBVV found underneath. High-dose PPI infusion × 72 h. Close monitoring. Endoscopic therapy if clot is removed and active vessel found.',
  },
  {
    class: 'IIc',
    label: 'IIc — Flat pigmented spot (haematin)',
    description: 'Flat black or red haematin spot in ulcer base — no raised vessel, no clot.',
    rebleedRisk: '10%',
    management: 'Endoscopic therapy NOT required. Oral high-dose PPI. Can consider early discharge with close outpatient follow-up if clinically stable and low-risk Rockall score. HP testing and NSAID review.',
  },
  {
    class: 'III',
    label: 'III — Clean base / fibrin',
    description: 'Clean ulcer base with fibrin slough — no active bleeding, no vessel, no clot, no haematin.',
    rebleedRisk: '5%',
    management: 'Endoscopic therapy NOT required. Oral PPI twice daily. Suitable for early discharge in clinically stable low-risk patients (Rockall ≤ 2). H. pylori testing mandatory. Stop NSAIDs/aspirin if possible, or add PPI if aspirin must continue.',
  },
];

export function interpretForrest(cls: ForrestClass): ScaleResult {
  const level = FORREST_LEVELS.find(l => l.class === cls)!;
  const evidence = 'Forrest JAH et al., Lancet 1974;2(7877):394-397. ESGE Guideline: Gralnek IM et al., Endoscopy 2021;53(3):300-332. ACG Clinical Guideline: Laine L et al., Am J Gastroenterol 2012;107(3):345-360.';
  const highRisk = cls === 'Ia' || cls === 'Ib' || cls === 'IIa';
  const moderate  = cls === 'IIb';
  return {
    score: 0,
    band: `Forrest ${cls} — ${level.label.split('—')[1].trim()}`,
    color: highRisk ? 'red' : moderate ? 'amber' : 'green',
    description: `${level.description} Re-bleeding risk: ${level.rebleedRisk}.`,
    action: level.management,
    evidence,
  };
}
