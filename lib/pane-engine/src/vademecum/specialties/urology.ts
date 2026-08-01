import { registerModule } from '../registry.js';

registerModule({
  specialty: 'urology',
  system: 'genitourinary',
  diseases: [
    {
      id: 'renal_colic', label: 'Renal Colic / Urolithiasis', icd10: 'N20.0', prior: 0.04,
      features: { loin_pain: 0.95, haematuria: 0.80, nausea_vomiting: 0.70, colicky_pain: 0.90, fever: 0.20, radiation_to_groin: 0.70 },
    },
    {
      id: 'haematuria_investigation', label: 'Haematuria (Investigation)', icd10: 'R31.9', prior: 0.02,
      features: { haematuria: 0.95, dysuria: 0.30, frequency_urgency: 0.40, loin_pain: 0.30, weight_loss: 0.20 },
    },
    {
      id: 'bladder_carcinoma', label: 'Bladder Carcinoma', icd10: 'C67.9', prior: 0.01,
      features: { haematuria: 0.85, dysuria: 0.50, frequency_urgency: 0.55, weight_loss: 0.35, loin_pain: 0.20 },
    },
    {
      id: 'bph', label: 'Benign Prostatic Hyperplasia (BPH)', icd10: 'N40.0', prior: 0.05,
      features: { prostate_symptoms: 0.90, frequency_urgency: 0.80, haematuria: 0.20, urinary_retention_symptoms: 0.30, loin_pain: 0.10 },
    },
    {
      id: 'urinary_retention', label: 'Acute Urinary Retention', icd10: 'R33.9', prior: 0.03,
      features: { urinary_retention_symptoms: 0.99, prostate_symptoms: 0.60, suprapubic_pain: 0.80, frequency_urgency: 0.30 },
    },
    {
      id: 'uti', label: 'Urinary Tract Infection (UTI)', icd10: 'N39.0', prior: 0.05,
      features: { dysuria: 0.90, frequency_urgency: 0.85, fever: 0.45, loin_pain: 0.35, haematuria: 0.40, nausea_vomiting: 0.30 },
    },
    {
      id: 'testicular_torsion', label: 'Testicular Torsion', icd10: 'N44.00', prior: 0.01,
      features: { testicular_pain: 0.98, scrotal_swelling: 0.80, nausea_vomiting: 0.70, fever: 0.25, absent_cremasteric: 0.80 },
    },
    {
      id: 'epididymo_orchitis', label: 'Epididymo-orchitis', icd10: 'N45.3', prior: 0.02,
      features: { testicular_pain: 0.90, scrotal_swelling: 0.85, fever: 0.65, dysuria: 0.55, elevated_wbc: 0.70 },
    },
    {
      id: 'hydrocele', label: 'Hydrocele', icd10: 'N43.3', prior: 0.02,
      features: { scrotal_swelling: 0.95, testicular_pain: 0.15, testicular_mass: 0.35 },
    },
    {
      id: 'testicular_cancer', label: 'Testicular Cancer (Germ Cell Tumour)', icd10: 'C62.90', prior: 0.004,
      features: { testicular_mass: 0.90, scrotal_swelling: 0.70, testicular_pain: 0.40, weight_loss: 0.25, gynecomastia_sign: 0.20 },
    },
  ],
  features: [
    { id: 'loin_pain', label: 'Loin / flank pain', question: 'Is there pain in the loin, flank, or costovertebral angle?', category: 'symptom' },
    { id: 'dysuria', label: 'Dysuria (burning on micturition)', question: 'Is there pain, burning, or discomfort during urination?', category: 'symptom' },
    { id: 'frequency_urgency', label: 'Urinary frequency and urgency', question: 'Is there increased urinary frequency or urgency to void?', category: 'symptom' },
    { id: 'urinary_retention_symptoms', label: 'Inability to pass urine', question: 'Is the patient unable to pass urine despite the urge (acute retention)?', category: 'symptom' },
    { id: 'prostate_symptoms', label: 'LUTS (hesitancy, poor stream, nocturia)', question: 'Are there lower urinary tract symptoms: hesitancy, poor stream, post-micturition dribble, or nocturia?', category: 'symptom' },
    { id: 'testicular_pain', label: 'Testicular pain (acute or chronic)', question: 'Is there unilateral or bilateral testicular pain?', category: 'symptom' },
    { id: 'scrotal_swelling', label: 'Scrotal swelling', question: 'Is there swelling of the scrotum?', category: 'sign' },
    { id: 'testicular_mass', label: 'Testicular mass / hard lump', question: 'Is there a hard, irregular, or non-tender mass within the body of the testis?', category: 'sign' },
    { id: 'absent_cremasteric', label: 'Absent cremasteric reflex', question: 'Is the cremasteric reflex absent on the affected side?', category: 'sign' },
    { id: 'radiation_to_groin', label: 'Pain radiating to groin / genitalia', question: 'Does the pain radiate to the groin, labia, or testis?', category: 'symptom' },
    { id: 'gynecomastia_sign', label: 'Gynaecomastia (in male patient)', question: 'Is there bilateral or unilateral gynaecomastia in a male patient?', category: 'sign' },
    { id: 'suprapubic_pain', label: 'Suprapubic / lower abdominal pain', question: 'Is there suprapubic or lower abdominal pain or discomfort?', category: 'symptom' },
  ],
});
