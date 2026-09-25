import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Sources: EAU Urolithiasis 2024
// (renal colic; an obstructed infected kidney needs urgent decompression); EAU Urological
// Infections 2024 and NICE NG111 (2018) pyelonephritis — loin pain, fever, rigors, dysuria,
// renal-angle tenderness; Bent et al., JAMA 2002 "Does this woman have an acute uncomplicated
// UTI?" (dysuria + frequency without discharge LR+ ≈ 24); EAU Paediatric Urology 2024 / BAUS
// testicular torsion (sudden severe testicular pain, vomiting, absent cremasteric reflex, high-
// riding testis; do not delay exploration for imaging); NICE CKS / BAUS retention.
const M = { sex: 'male' as const };
registerModule({
  specialty: 'urology',
  system: 'genitourinary',
  diseases: [
    {
      id: 'renal_colic', label: 'Renal Colic / Urolithiasis', icd10: 'N20.0', prior: T.frequent, course: 'acute',
      features: { loin_pain: 0.90, haematuria: 0.75, nausea_vomiting: 0.60, colicky_pain: 0.80, sudden_onset: 0.50, fever: 0.05, radiation_to_groin: 0.65, restless_writhing: 0.50, renal_angle_tenderness: 0.40, pain_worse_movement: 0.05 },
    },
    {
      id: 'pyelonephritis', label: 'Acute Pyelonephritis / Upper Urinary Tract Infection', icd10: 'N10', prior: T.uncommon, course: 'acute',
      features: { loin_pain: 0.80, fever: 0.80, rigors: 0.50, dysuria: 0.60, frequency_urgency: 0.55, nausea_vomiting: 0.50, renal_angle_tenderness: 0.75, haematuria: 0.30, positive_urinalysis: 0.90, elevated_wbc: 0.70, tachycardia: 0.45, suprapubic_pain: 0.25 },
    },
    {
      id: 'infected_obstructed_kidney', label: 'Infected Obstructed Kidney (Pyonephrosis / Obstructive Urosepsis)', icd10: 'N13.6', prior: T.rare, course: 'acute',
      features: { loin_pain: 0.85, fever: 0.85, rigors: 0.55, colicky_pain: 0.40, hydronephrosis: 0.90, known_stone: 0.60, tachycardia: 0.65, hypotension: 0.30, positive_urinalysis: 0.80, elevated_wbc: 0.80, renal_angle_tenderness: 0.70, nausea_vomiting: 0.55 },
    },
    {
      id: 'haematuria_investigation', label: 'Haematuria (Investigation)', icd10: 'R31.9', prior: T.uncommon, course: 'any',
      features: { haematuria: 0.95, visible_haematuria: 0.60, dysuria: 0.15, frequency_urgency: 0.20, loin_pain: 0.20 },
    },
    {
      id: 'bladder_carcinoma', label: 'Bladder Carcinoma (Urothelial)', icd10: 'C67.9', prior: T.rare, course: 'chronic',
      // NICE NG12: ≥ 45 with unexplained visible haematuria; smoking is the main risk factor
      features: { haematuria: 0.90, visible_haematuria: 0.80, painless_haematuria: 0.70, dysuria: 0.25, frequency_urgency: 0.35, weight_loss: 0.20, loin_pain: 0.10, smoker: 0.60, progressive_course: 0.40 },
    },
    {
      id: 'bph', label: 'Benign Prostatic Hyperplasia (BPH)', icd10: 'N40.0', prior: T.frequent, course: 'chronic', applicability: M,
      features: { prostate_symptoms: 0.90, frequency_urgency: 0.70, nocturia: 0.80, haematuria: 0.10, urinary_retention_symptoms: 0.15, loin_pain: 0.05 },
    },
    {
      id: 'urinary_retention', label: 'Urinary Retention (Acute / Chronic)', icd10: 'R33.9', prior: T.uncommon, course: 'acute',
      features: { urinary_retention_symptoms: 0.95, palpable_bladder: 0.85, prostate_symptoms: 0.55, suprapubic_pain: 0.70, frequency_urgency: 0.25, overflow_incontinence: 0.25, hydronephrosis: 0.20, anticholinergic_or_opioid: 0.20 },
    },
    {
      id: 'uti', label: 'Urinary Tract Infection (Cystitis / UTI)', icd10: 'N39.0', prior: T.common, course: 'acute',
      features: { dysuria: 0.90, frequency_urgency: 0.85, suprapubic_pain: 0.40, fever: 0.15, loin_pain: 0.10, haematuria: 0.30, positive_urinalysis: 0.90, nausea_vomiting: 0.10, confusion: 0.05 },
    },
    {
      id: 'testicular_torsion', label: 'Testicular Torsion', icd10: 'N44.00', prior: T.rare, course: 'acute', applicability: M,
      features: { testicular_pain: 0.98, scrotal_swelling: 0.60, sudden_onset: 0.80, nausea_vomiting: 0.65, fever: 0.10, absent_cremasteric: 0.90, high_riding_testis: 0.60, abdominal_pain: 0.25, groin_pain: 0.30, dysuria: 0.03, urethral_discharge: 0.02 },
    },
    {
      id: 'epididymo_orchitis', label: 'Epididymo-orchitis', icd10: 'N45.3', prior: T.uncommon, course: 'acute', applicability: M,
      features: { testicular_pain: 0.90, scrotal_swelling: 0.85, fever: 0.50, dysuria: 0.45, urethral_discharge: 0.35, elevated_wbc: 0.60, sudden_onset: 0.15, absent_cremasteric: 0.10 },
    },
    {
      id: 'hydrocele', label: 'Hydrocele', icd10: 'N43.3', prior: T.uncommon, course: 'chronic', applicability: M,
      features: { scrotal_swelling: 0.95, testicular_pain: 0.10, testicular_mass: 0.20 },
    },
    {
      id: 'testicular_cancer', label: 'Testicular Cancer (Germ Cell Tumour)', icd10: 'C62.90', prior: T.veryRare, course: 'chronic', applicability: M,
      features: { testicular_mass: 0.90, scrotal_swelling: 0.60, testicular_pain: 0.25, weight_loss: 0.15, gynecomastia_sign: 0.10 },
    },
  ],
  features: [
    { id: 'loin_pain', label: 'Loin / flank pain', question: 'Is there pain in the loin, flank, or costovertebral angle?', category: 'symptom', baseRate: 0.03 },
    { id: 'renal_angle_tenderness', label: 'Renal-angle tenderness', question: 'Is there renal-angle (costovertebral) tenderness?', category: 'sign', baseRate: 0.01 },
    { id: 'restless_writhing', label: 'Restless / writhing with pain', question: 'Is the patient restless and unable to lie still with the pain?', category: 'sign', baseRate: 0.01 },
    { id: 'dysuria', label: 'Dysuria (burning on micturition)', question: 'Is there pain, burning, or discomfort during urination?', category: 'symptom', baseRate: 0.03 },
    { id: 'frequency_urgency', label: 'Urinary frequency and urgency', question: 'Is there increased urinary frequency or urgency to void?', category: 'symptom', baseRate: 0.05 },
    { id: 'nocturia', label: 'Nocturia', question: 'Does the patient get up at night to pass urine?', category: 'symptom', baseRate: 0.08 },
    { id: 'positive_urinalysis', label: 'Urinalysis positive for nitrites / leucocytes', question: 'Is the urine dipstick positive for nitrites or leucocytes?', category: 'investigation', baseRate: 0.05 },
    { id: 'urinary_retention_symptoms', label: 'Inability to pass urine / incomplete emptying', question: 'Is the patient unable to pass urine despite the urge, or emptying incompletely?', category: 'symptom', baseRate: 0.01 },
    { id: 'palpable_bladder', label: 'Palpable / distended bladder', question: 'Is the bladder palpable or is there a large post-void residual?', category: 'sign', baseRate: 0.005 },
    { id: 'overflow_incontinence', label: 'Overflow incontinence / dribbling', question: 'Is there overflow incontinence or constant dribbling?', category: 'symptom', baseRate: 0.01 },
    { id: 'anticholinergic_or_opioid', label: 'Anticholinergic or opioid medicine', question: 'Is the patient on an anticholinergic or opioid?', category: 'history', baseRate: 0.05 },
    { id: 'hydronephrosis', label: 'Hydronephrosis on imaging', question: 'Does imaging show hydronephrosis?', category: 'investigation', baseRate: 0.005 },
    { id: 'known_stone', label: 'Known or imaged urinary stone', question: 'Is there a known or imaged ureteric / renal stone?', category: 'history', baseRate: 0.01 },
    { id: 'prostate_symptoms', label: 'LUTS (hesitancy, poor stream, nocturia)', question: 'Are there lower urinary tract symptoms: hesitancy, poor stream, post-micturition dribble, or nocturia?', category: 'symptom', baseRate: 0.05 },
    { id: 'visible_haematuria', label: 'Visible (frank) haematuria', question: 'Is the blood in the urine visible?', category: 'symptom', baseRate: 0.01 },
    { id: 'painless_haematuria', label: 'Painless visible haematuria', question: 'Is the visible haematuria painless?', category: 'symptom', baseRate: 0.003 },
    { id: 'testicular_pain', label: 'Testicular pain (acute or chronic)', question: 'Is there unilateral or bilateral testicular pain?', category: 'symptom', baseRate: 0.01 },
    { id: 'scrotal_swelling', label: 'Scrotal swelling', question: 'Is there swelling of the scrotum?', category: 'sign', baseRate: 0.01 },
    { id: 'testicular_mass', label: 'Testicular mass / hard lump', question: 'Is there a hard, irregular, or non-tender mass within the body of the testis?', category: 'sign', baseRate: 0.002 },
    { id: 'absent_cremasteric', label: 'Absent cremasteric reflex', question: 'Is the cremasteric reflex absent on the affected side?', category: 'sign', baseRate: 0.002 },
    { id: 'high_riding_testis', label: 'High-riding / horizontal-lie testis', question: 'Is the testis high-riding or lying horizontally?', category: 'sign', baseRate: 0.001 },
    { id: 'urethral_discharge', label: 'Urethral / penile discharge', question: 'Is there urethral discharge?', category: 'symptom', baseRate: 0.01 },
    { id: 'radiation_to_groin', label: 'Pain radiating to groin / genitalia', question: 'Does the pain radiate to the groin, labia, or testis?', category: 'symptom', baseRate: 0.02 },
    { id: 'gynecomastia_sign', label: 'Gynaecomastia (in male patient)', question: 'Is there bilateral or unilateral gynaecomastia in a male patient?', category: 'sign', baseRate: 0.01 },
    { id: 'suprapubic_pain', label: 'Suprapubic / lower abdominal pain', question: 'Is there suprapubic or lower abdominal pain or discomfort?', category: 'symptom', baseRate: 0.03 },
  ],
});
