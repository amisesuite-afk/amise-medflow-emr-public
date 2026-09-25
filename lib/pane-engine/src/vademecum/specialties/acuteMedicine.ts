import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — acute-medicine causes (clinval acutemed / endorenal clusters). Approximate
// sensitivities, to be signed off:
//  - Sepsis (source-agnostic, incl. neutropenic and post-splenectomy): NICE NG51 (2016, 2024
//    update); Sepsis-3 (Singer et al., JAMA 2016); Surviving Sepsis Campaign 2021 — tachycardia,
//    tachypnoea, hypotension, altered mentation, fever OR hypothermia (older people are often
//    afebrile), raised lactate; NICE CG151 (2012) neutropenic sepsis.
//  - Anaphylaxis: Resuscitation Council UK 2021 — sudden airway / breathing / circulation problem
//    with skin or mucosal changes after a trigger (drug, food, sting).
//  - Gastroenteritis / infective colitis: NICE CKS gastroenteritis (2023); IDSA 2017 infectious
//    diarrhoea.
//  - C. difficile: IDSA/SHEA 2021 and ESCMID 2021 — diarrhoea after antibiotics or
//    hospitalisation, fever, leucocytosis, distension (fulminant).
//  - AKI: KDIGO 2012; NICE NG148 (2019) — risk: hypovolaemia (diarrhoea, vomiting), ACE-i/ARB,
//    NSAIDs, diuretics, CKD, sepsis; oliguria.
//  - Hyperkalaemia: UK Kidney Association 2020 (moderate K⁺ ≥ 6.0, severe ≥ 6.5 mmol/L) — a
//    laboratory diagnosis; CKD, ACE-i/ARB, potassium-sparing diuretics.
//  - Hypercalcaemia: Society for Endocrinology emergency guidance, acute hypercalcaemia (2016) —
//    adjusted Ca > 2.6 (severe > 3.0) with polyuria, thirst, vomiting, constipation, confusion;
//    malignancy or hyperparathyroidism.
//  - Hyponatraemia: European clinical practice guideline on hyponatraemia (Spasovski et al.,
//    2014) — Na⁺ < 135 (severe < 125) with nausea, confusion, headache, seizures; thiazides,
//    SSRIs, post-operative hypotonic fluids.
registerModule({
  specialty: 'acute_medicine',
  system: 'systemic',
  diseases: [
    {
      id: 'sepsis', label: 'Sepsis / Septic Shock (source not yet identified; incl. neutropenic sepsis)', icd10: 'A41.9', prior: T.uncommon, course: 'acute',
      features: { fever: 0.65, hypothermia: 0.15, rigors: 0.40, tachycardia: 0.85, tachypnoea: 0.65, hypotension: 0.45, confusion: 0.40, gcs_drop: 0.10, raised_lactate: 0.55, elevated_wbc: 0.65, raised_crp: 0.80, neutropenia: 0.08, immunosuppression: 0.30, asplenia: 0.02, mottled_skin: 0.15, oliguria: 0.30, hypoxia: 0.35, dyspnoea: 0.40, fatigue: 0.50, nausea_vomiting: 0.30, lethargy: 0.35, poor_feeding: 0.15, non_blanching_rash: 0.04, pallor: 0.35,
        // Source mix (SSC 2021 / NICE NG51 cohorts: respiratory ≈ 40 %, urinary ≈ 20 %, abdominal ≈ 20 %, skin ≈ 10 %)
        cough: 0.40, productive_cough: 0.25, purulent_sputum: 0.15, crackles: 0.30, consolidation: 0.30, dysuria: 0.15, frequency_urgency: 0.15, positive_urinalysis: 0.30, abdominal_pain: 0.30, diarrhoea: 0.10, erythema_surrounding: 0.10 },
    },
    {
      id: 'anaphylaxis', label: 'Anaphylaxis', icd10: 'T78.2XXA', prior: T.rare, course: 'acute',
      features: { urticaria_angioedema: 0.85, allergen_exposure: 0.85, sudden_onset: 0.90, dyspnoea: 0.65, wheeze: 0.50, stridor: 0.25, hoarseness: 0.20, hypotension: 0.40, tachycardia: 0.70, dizziness: 0.30, syncope: 0.15, hypoxia: 0.30, nausea_vomiting: 0.30, abdominal_pain: 0.20, chest_tightness: 0.30, known_allergy: 0.50 },
    },
    {
      id: 'gastroenteritis', label: 'Acute Gastroenteritis / Infective Colitis', icd10: 'A09', prior: T.common, course: 'acute',
      features: { diarrhoea: 0.95, nausea_vomiting: 0.75, abdominal_pain: 0.60, colicky_pain: 0.35, diffuse_abdominal_pain: 0.30, periumbilical_pain: 0.20, fever: 0.40, dehydration: 0.40, bloody_diarrhoea: 0.15, sick_contacts: 0.30, myalgia: 0.20, tachycardia: 0.30, anorexia: 0.40 },
    },
    {
      id: 'cdiff_colitis', label: 'Clostridioides difficile Colitis (C. diff infection)', icd10: 'A04.72', prior: T.rare, course: 'acute',
      // Severe / fulminant CDI (IDSA/SHEA 2021): WCC > 15, creatinine > 133 µmol/L, hypotension, ileus, megacolon
      features: { cdiff_positive: 0.90, diarrhoea: 0.95, recent_antibiotics: 0.85, recent_hospitalisation: 0.55, ppi_use: 0.40, abdominal_pain: 0.55, diffuse_abdominal_pain: 0.30, colicky_pain: 0.30, fever: 0.50, elevated_wbc: 0.75, raised_creatinine: 0.35, abdominal_distension: 0.35, tympanic_abdomen: 0.10, bloody_diarrhoea: 0.10, pr_bleeding: 0.10, tachycardia: 0.50, hypotension: 0.12, raised_lactate: 0.15, confusion: 0.12, dehydration: 0.40, immunosuppression: 0.20, ulcerative_colitis_history: 0.08 },
    },
    {
      id: 'aki', label: 'Acute Kidney Injury (AKI)', icd10: 'N17.9', prior: T.uncommon, course: 'acute',
      features: { raised_creatinine: 0.95, oliguria: 0.45, dehydration: 0.45, diarrhoea: 0.25, nausea_vomiting: 0.35, nsaid_use: 0.30, acei_arb_use: 0.45, diuretic_use: 0.35, known_ckd: 0.30, confusion: 0.15, hyperkalaemia_lab: 0.25, fatigue: 0.30, hypotension: 0.20, raised_urea: 0.85 },
    },
    {
      id: 'hyperkalaemia', label: 'Hyperkalaemia', icd10: 'E87.5', prior: T.rare, course: 'acute',
      features: { hyperkalaemia_lab: 0.99, known_ckd: 0.60, acei_arb_use: 0.50, raised_creatinine: 0.70, hyperkalaemia_ecg: 0.35, bradycardia: 0.20, limb_weakness: 0.15, palpitations: 0.15, fatigue: 0.30 },
    },
    {
      id: 'hypercalcaemia', label: 'Hypercalcaemia (Malignancy / Hyperparathyroidism)', icd10: 'E83.52', prior: T.rare, course: 'subacute',
      features: { hypercalcaemia_lab: 0.99, hypercalcaemia_symptoms: 0.70, polyuria_polydipsia: 0.45, nausea_vomiting: 0.40, constipation: 0.45, confusion: 0.30, fatigue: 0.60, dehydration: 0.40, abdominal_pain: 0.20, bone_pain: 0.35, known_malignancy: 0.50, raised_creatinine: 0.35 },
    },
    {
      id: 'hyponatraemia', label: 'Hyponatraemia', icd10: 'E87.1', prior: T.rare, course: 'acute',
      features: { hyponatraemia_lab: 0.99, confusion: 0.50, nausea_vomiting: 0.40, headache: 0.30, seizure: 0.15, fatigue: 0.40, hyponatraemia_drug: 0.35, recent_surgery: 0.20, gcs_drop: 0.10 },
    },
  ],
  features: [
    { id: 'cdiff_positive', label: 'C. difficile toxin / GDH positive, or exposure on the unit', question: 'Is a C. difficile test positive, or is there C. difficile on the unit?', category: 'investigation', baseRate: 0.003 },
    { id: 'pallor', label: 'Pallor', question: 'Is the patient pale?', category: 'sign', baseRate: 0.05 },
    { id: 'confusion', label: 'Confusion / altered mental state', question: 'Is the patient newly confused or drowsy?', category: 'sign', baseRate: 0.03 },
    { id: 'lethargy', label: 'Lethargy / floppy / hard to rouse', question: 'Is the patient lethargic or difficult to rouse?', category: 'sign', baseRate: 0.02 },
    { id: 'hypothermia', label: 'Low temperature (< 36 °C)', question: 'Is the temperature below 36 °C?', category: 'sign', baseRate: 0.01 },
    { id: 'raised_lactate', label: 'Raised lactate (≥ 2 mmol/L)', question: 'Is the lactate 2 mmol/L or higher?', category: 'investigation', baseRate: 0.02 },
    { id: 'neutropenia', label: 'Neutropenia / recent chemotherapy', question: 'Is the patient neutropenic or within 6 weeks of chemotherapy?', category: 'history', baseRate: 0.003 },
    { id: 'immunosuppression', label: 'Immunosuppression (HIV, steroids, transplant, chemotherapy)', question: 'Is the patient immunosuppressed?', category: 'history', baseRate: 0.03 },
    { id: 'asplenia', label: 'Splenectomy / hyposplenism', question: 'Has the patient had a splenectomy?', category: 'history', baseRate: 0.002 },
    { id: 'mottled_skin', label: 'Mottled / ashen skin, cold peripheries', question: 'Is the skin mottled or ashen?', category: 'sign', baseRate: 0.003 },
    { id: 'oliguria', label: 'Reduced urine output', question: 'Has the urine output fallen?', category: 'symptom', baseRate: 0.01 },
    { id: 'dehydration', label: 'Dehydration / hypovolaemia', question: 'Is the patient clinically dehydrated?', category: 'sign', baseRate: 0.04 },
    { id: 'myalgia', label: 'Muscle aches', question: 'Are there generalised muscle aches?', category: 'symptom', baseRate: 0.03 },
    { id: 'urticaria_angioedema', label: 'Urticaria / angioedema (lip, tongue, face swelling)', question: 'Is there urticaria or swelling of the lips, tongue or face?', category: 'sign', baseRate: 0.005 },
    { id: 'allergen_exposure', label: 'Exposure to a likely allergen (drug, food, sting) minutes to hours before', question: 'Did symptoms start soon after a new drug, food or sting?', category: 'history', baseRate: 0.01 },
    { id: 'known_allergy', label: 'Known allergy', question: 'Is there a known allergy?', category: 'history', baseRate: 0.10 },
    { id: 'sick_contacts', label: 'Sick contacts / suspect food', question: 'Are others unwell, or was there suspect food?', category: 'history', baseRate: 0.02 },
    { id: 'recent_antibiotics', label: 'Antibiotics in the last 3 months', question: 'Has the patient had antibiotics in the last 3 months?', category: 'history', baseRate: 0.05 },
    { id: 'recent_hospitalisation', label: 'Recent hospital admission', question: 'Has the patient been in hospital recently?', category: 'history', baseRate: 0.04 },
    { id: 'ppi_use', label: 'Proton-pump inhibitor use', question: 'Is the patient on a PPI?', category: 'history', baseRate: 0.10 },
    { id: 'ulcerative_colitis_history', label: 'Known inflammatory bowel disease', question: 'Does the patient have IBD?', category: 'history', baseRate: 0.01 },
    { id: 'raised_creatinine', label: 'Raised creatinine', question: 'Is the creatinine raised above baseline?', category: 'investigation', baseRate: 0.05 },
    { id: 'acei_arb_use', label: 'ACE inhibitor / ARB use', question: 'Is the patient on an ACE inhibitor or ARB?', category: 'history', baseRate: 0.15 },
    { id: 'diuretic_use', label: 'Diuretic use', question: 'Is the patient on a diuretic?', category: 'history', baseRate: 0.08 },
    { id: 'known_ckd', label: 'Chronic kidney disease', question: 'Does the patient have chronic kidney disease?', category: 'history', baseRate: 0.05 },
    { id: 'hyperkalaemia_lab', label: 'Potassium ≥ 6.0 mmol/L', question: 'Is the potassium 6.0 mmol/L or higher?', category: 'investigation', baseRate: 0.003 },
    { id: 'hyperkalaemia_ecg', label: 'ECG changes of hyperkalaemia (peaked T, broad QRS)', question: 'Does the ECG show peaked T waves or broad QRS?', category: 'investigation', baseRate: 0.001 },
    { id: 'hypercalcaemia_lab', label: 'Adjusted calcium > 2.6 mmol/L', question: 'Is the adjusted calcium above 2.6 mmol/L?', category: 'investigation', baseRate: 0.003 },
    { id: 'hyponatraemia_lab', label: 'Sodium < 130 mmol/L', question: 'Is the sodium below 130 mmol/L?', category: 'investigation', baseRate: 0.01 },
    { id: 'hyponatraemia_drug', label: 'Thiazide / SSRI / carbamazepine use', question: 'Is the patient on a thiazide, SSRI or carbamazepine?', category: 'history', baseRate: 0.08 },
    { id: 'known_malignancy', label: 'Known cancer', question: 'Does the patient have a known cancer?', category: 'history', baseRate: 0.05 },
    { id: 'bone_pain', label: 'Bone pain', question: 'Is there bone pain?', category: 'symptom', baseRate: 0.02 },
  ],
});
