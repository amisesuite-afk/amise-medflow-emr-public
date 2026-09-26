import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — cardiovascular emergencies and mimics (added so medical causes compete with
// surgical ones on equal terms; clinval acutemed gap 1). Priors: priors.ts tiers; age/sex in
// engine/modifiers.ts. Unlisted features are neutral (feature base rate).
//
// Sensitivities are approximations of the published ranges, to be signed off:
//  - ACS: ESC 2023 ACS guideline (Byrne et al., Eur Heart J 2023) — atypical presentations
//    (epigastric pain, dyspnoea, fatigue, nausea) in women, older people and diabetes; Panju et
//    al., JAMA 1998 "Is this patient having a myocardial infarction?" — radiation to arm(s) LR+
//    2.3–7.1, diaphoresis LR+ ≈ 2, pleuritic / positional / reproducible pain LR ≈ 0.2–0.3.
//  - Aortic dissection: Klompas, JAMA 2002 (Rational Clinical Examination) and IRAD (Hagan et al.,
//    JAMA 2000) — sudden onset ≈ 85 %, tearing/ripping ≈ 40 %, pulse deficit ≈ 30 %, BP
//    difference between arms, focal neurology ≈ 15 %; ESC 2014 aortic diseases.
//  - Acute heart failure: ESC 2021 HF guideline; Wang et al., JAMA 2005 "Does this dyspneic
//    patient in the ED have CHF?" — PND, orthopnoea, oedema, raised JVP, crackles.
//  - AF: ESC 2024 AF guideline (AF-CARE) — palpitations, dyspnoea, dizziness; irregularly
//    irregular pulse; ECG confirms.
//  - Cardiac syncope: ESC 2018 syncope guideline — exertional or supine syncope, no prodrome,
//    palpitations before, structural heart disease / murmur, bradyarrhythmia or heart block.
//  - Hypertensive emergency: ESC/ESH 2018 and ESH 2023 hypertension guidelines; ESC Council on
//    Hypertension position document on hypertensive emergencies (2019) — BP ≥ 180/120 (the
//    feature mapper's `severe_hypertension`) with acute organ damage (encephalopathy, headache,
//    visual disturbance, chest pain, pulmonary oedema).
registerModule({
  specialty: 'cardiology',
  system: 'cardiovascular',
  diseases: [
    {
      id: 'acs', label: 'Acute Coronary Syndrome (STEMI / NSTEMI / Unstable Angina)', icd10: 'I21.9', prior: T.frequent, course: 'acute',
      features: { chest_pain: 0.80, chest_pain_pressure: 0.60, chest_tightness: 0.35, radiation_arm_jaw: 0.45, diaphoresis: 0.45, nausea_vomiting: 0.35, dyspnoea: 0.45, epigastric_pain: 0.15, fatigue: 0.25, dizziness: 0.15, sudden_onset: 0.40, exertional_symptoms: 0.35, pleuritic_chest_pain: 0.05, chest_wall_tenderness: 0.05, pain_worse_movement: 0.05, vascular_risk: 0.85, smoker: 0.45, known_diabetes: 0.30, known_heart_disease: 0.35, st_elevation: 0.35, raised_troponin: 0.85, bradycardia: 0.08, tachycardia: 0.25, hypotension: 0.08, pale_clammy: 0.40, pallor: 0.35 },
    },
    {
      id: 'aortic_dissection', label: 'Acute Aortic Dissection', icd10: 'I71.00', prior: T.rare, course: 'acute',
      features: { chest_pain: 0.73, back_pain: 0.55, radiation_to_back: 0.45, abdominal_pain: 0.30, epigastric_pain: 0.15, sudden_onset: 0.85, tearing_pain: 0.40, severe_pain: 0.80, absent_pulses: 0.30, bp_arm_difference: 0.30, focal_weakness: 0.12, syncope: 0.10, hypotension: 0.20, raised_bp: 0.55, known_hypertension: 0.70, diaphoresis: 0.30, heart_murmur: 0.25, pleuritic_chest_pain: 0.05, limb_pain: 0.10, vascular_risk: 0.75 },
    },
    {
      id: 'acute_heart_failure', label: 'Acute Heart Failure / Pulmonary Oedema', icd10: 'I50.9', prior: T.uncommon, course: 'acute',
      features: { pulmonary_oedema_cxr: 0.70, dyspnoea: 0.95, orthopnoea: 0.55, bilateral_leg_oedema: 0.55, leg_swelling: 0.60, raised_jvp: 0.45, crackles: 0.65, hypoxia: 0.55, tachypnoea: 0.60, tachycardia: 0.50, cough: 0.30, wheeze: 0.20, fatigue: 0.50, weight_gain: 0.25, known_heart_disease: 0.70, irregular_pulse: 0.25, raised_bp: 0.40, chest_pain: 0.15, fever: 0.05, exertional_symptoms: 0.50 },
    },
    {
      id: 'atrial_fibrillation', label: 'Atrial Fibrillation / Flutter', icd10: 'I48.91', prior: T.frequent, course: 'any',
      features: { palpitations: 0.65, irregular_pulse: 0.90, tachycardia: 0.65, dyspnoea: 0.40, dizziness: 0.25, chest_pain: 0.15, fatigue: 0.35, syncope: 0.05, hypotension: 0.08, af_on_ecg: 0.95, known_af: 0.40, known_heart_disease: 0.35, raised_bp: 0.45, alcohol_use: 0.15 },
    },
    {
      id: 'cardiac_syncope', label: 'Cardiac Syncope (Arrhythmia incl. Heart Block / Aortic Stenosis)', icd10: 'I49.9', prior: T.uncommon, course: 'acute',
      features: { syncope: 0.95, dizziness: 0.40, exertional_symptoms: 0.35, sudden_onset: 0.60, palpitations: 0.30, bradycardia: 0.35, heart_block_ecg: 0.30, heart_murmur: 0.35, known_heart_disease: 0.50, chest_pain: 0.20, dyspnoea: 0.30, hypotension: 0.15, injury_from_fall: 0.30 },
    },
    {
      id: 'hypertensive_emergency', label: 'Hypertensive Emergency / Malignant Hypertension', icd10: 'I16.1', prior: T.rare, course: 'acute',
      features: { severe_hypertension: 0.98, raised_bp: 0.99, headache: 0.60, visual_disturbance: 0.40, confusion: 0.35, nausea_vomiting: 0.35, seizure: 0.08, chest_pain: 0.20, dyspnoea: 0.30, focal_weakness: 0.10, known_hypertension: 0.80, gcs_drop: 0.10, papilloedema: 0.30 },
    },
  ],
  features: [
    { id: 'chest_pain', label: 'Chest pain', question: 'Is there chest pain?', category: 'symptom', baseRate: 0.04 },
    { id: 'chest_pain_pressure', label: 'Central crushing / pressure / heavy chest pain', question: 'Is the chest pain central and crushing, heavy or pressure-like?', category: 'symptom', baseRate: 0.01 },
    { id: 'chest_tightness', label: 'Chest tightness', question: 'Is there a feeling of tightness in the chest?', category: 'symptom', baseRate: 0.02 },
    { id: 'radiation_arm_jaw', label: 'Pain radiating to arm, jaw or neck', question: 'Does the pain radiate to the arm(s), jaw or neck?', category: 'symptom', baseRate: 0.01 },
    { id: 'diaphoresis', label: 'Sweating / diaphoresis', question: 'Is the patient sweating or clammy?', category: 'sign', baseRate: 0.03 },
    { id: 'pale_clammy', label: 'Pale and clammy', question: 'Is the patient pale and clammy?', category: 'sign', baseRate: 0.02 },
    { id: 'tearing_pain', label: 'Tearing / ripping pain', question: 'Is the pain tearing or ripping in character?', category: 'symptom', baseRate: 0.003 },
    { id: 'severe_pain', label: 'Severe / worst-ever pain', question: 'Is the pain severe — the worst the patient has had?', category: 'symptom', baseRate: 0.15 },
    { id: 'exertional_symptoms', label: 'Symptoms on exertion', question: 'Do the symptoms come on with exertion?', category: 'symptom', baseRate: 0.03 },
    { id: 'bp_arm_difference', label: 'BP difference between arms (> 20 mmHg)', question: 'Is there a systolic BP difference of more than 20 mmHg between the arms?', category: 'sign', baseRate: 0.002 },
    { id: 'heart_murmur', label: 'Heart murmur', question: 'Is there a heart murmur?', category: 'sign', baseRate: 0.03 },
    { id: 'raised_jvp', label: 'Raised JVP', question: 'Is the jugular venous pressure raised?', category: 'sign', baseRate: 0.01 },
    { id: 'crackles', label: 'Lung crackles / crepitations', question: 'Are there crackles on auscultation of the chest?', category: 'sign', baseRate: 0.03 },
    { id: 'palpitations', label: 'Palpitations', question: 'Are there palpitations?', category: 'symptom', baseRate: 0.03 },
    { id: 'irregular_pulse', label: 'Irregularly irregular pulse', question: 'Is the pulse irregularly irregular?', category: 'sign', baseRate: 0.02 },
    { id: 'syncope', label: 'Syncope / collapse', question: 'Has there been a collapse or loss of consciousness?', category: 'symptom', baseRate: 0.02 },
    { id: 'dizziness', label: 'Dizziness / light-headedness / pre-syncope', question: 'Is there dizziness or feeling faint?', category: 'symptom', baseRate: 0.05 },
    { id: 'injury_from_fall', label: 'Injury from the collapse', question: 'Was the patient injured by the fall?', category: 'sign', baseRate: 0.01 },
    { id: 'st_elevation', label: 'ST elevation / new LBBB on ECG', question: 'Does the ECG show ST elevation or new LBBB?', category: 'investigation', baseRate: 0.002 },
    { id: 'raised_troponin', label: 'Raised troponin', question: 'Is the troponin raised?', category: 'investigation', baseRate: 0.01 },
    { id: 'af_on_ecg', label: 'AF / flutter on ECG', question: 'Does the ECG show atrial fibrillation or flutter?', category: 'investigation', baseRate: 0.01 },
    { id: 'heart_block_ecg', label: 'Heart block / bradyarrhythmia on ECG', question: 'Does the ECG show heart block or a bradyarrhythmia?', category: 'investigation', baseRate: 0.002 },
    { id: 'papilloedema', label: 'Papilloedema / retinal haemorrhages', question: 'Is there papilloedema or retinal haemorrhage on fundoscopy?', category: 'sign', baseRate: 0.001 },
    { id: 'pulmonary_oedema_cxr', label: 'Chest X-ray: pulmonary oedema / cardiomegaly', question: 'Does the chest X-ray show pulmonary oedema or cardiomegaly?', category: 'investigation', baseRate: 0.01 },
    { id: 'known_heart_disease', label: 'Known heart disease (IHD, heart failure, valve disease)', question: 'Is there known ischaemic heart disease, heart failure or valve disease?', category: 'history', baseRate: 0.08 },
    { id: 'known_hypertension', label: 'Known hypertension', question: 'Does the patient have hypertension?', category: 'history', baseRate: 0.25 },
    { id: 'smoker', label: 'Smoker', question: 'Does the patient smoke?', category: 'history', baseRate: 0.20 },
    // ── Vital-sign features (derived by the feature mapper from recorded vitals) ──
    { id: 'tachycardia', label: 'Tachycardia (HR > 100, age-adjusted in children)', question: 'Is the heart rate above 100 (adult)?', category: 'sign', baseRate: 0.08 },
    { id: 'bradycardia', label: 'Bradycardia (HR < 50)', question: 'Is the heart rate below 50?', category: 'sign', baseRate: 0.02 },
    { id: 'hypotension', label: 'Hypotension / shock (SBP < 90)', question: 'Is the systolic BP below 90 mmHg?', category: 'sign', baseRate: 0.02 },
    { id: 'raised_bp', label: 'Raised blood pressure (≥ 140/90)', question: 'Is the BP 140/90 or higher?', category: 'sign', baseRate: 0.25 },
    { id: 'severe_hypertension', label: 'Severe hypertension (≥ 180/120; ≥ 160/110 in pregnancy)', question: 'Is the BP 180/120 or higher (160/110 in pregnancy)?', category: 'sign', baseRate: 0.02 },
  ],
});
