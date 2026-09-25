import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — diabetic emergencies (one tier above UK rates for the Caribbean diabetes
// burden, priors.ts). Approximate sensitivities, to be signed off:
//  - DKA (incl. euglycaemic DKA on SGLT2 inhibitors): JBDS-IP DKA guideline (2023); ADA 2024
//    hyperglycaemic crises consensus (Umpierrez et al., Diabetes Care 2024) — ketones ≥ 3.0 mmol/L,
//    pH < 7.3 / bicarbonate < 15; polyuria, thirst, vomiting, abdominal pain (≈ 46 % —
//    Umpierrez & Freire, J Crit Care 2002), Kussmaul breathing; ≈ 10 % euglycaemic (glucose
//    < 11); MHRA 2020 SGLT2 alert. May be the first presentation of diabetes.
//  - HHS: JBDS-IP HHS guideline (2022) — glucose ≥ 30 mmol/L, osmolality ≥ 320, no significant
//    ketonaemia; profound dehydration, confusion; older people with type 2 diabetes.
//  - Hypoglycaemia: JBDS-IP hypoglycaemia guideline (2022) — glucose < 4.0 mmol/L; insulin or
//    sulfonylurea; confusion, sweating, focal deficit (stroke mimic), seizure.
registerModule({
  specialty: 'metabolic',
  system: 'endocrine_metabolic',
  diseases: [
    {
      id: 'dka', label: 'Diabetic Ketoacidosis (DKA, incl. Euglycaemic DKA)', icd10: 'E10.10', prior: T.uncommon, course: 'acute',
      features: { polyuria_polydipsia: 0.70, nausea_vomiting: 0.75, abdominal_pain: 0.45, diffuse_abdominal_pain: 0.20, epigastric_pain: 0.15, hyperglycaemia: 0.85, ketonaemia: 0.98, metabolic_acidosis: 0.95, kussmaul: 0.45, tachypnoea: 0.55, tachycardia: 0.65, dehydration: 0.60, confusion: 0.20, lethargy: 0.30, known_diabetes: 0.80, sglt2_inhibitor: 0.10, weight_loss: 0.30, fatigue: 0.50, fever: 0.15, hypotension: 0.10 },
    },
    {
      id: 'hhs', label: 'Hyperosmolar Hyperglycaemic State (HHS)', icd10: 'E11.00', prior: T.uncommon, course: 'acute',
      features: { very_high_glucose: 0.95, hyperglycaemia: 0.99, polyuria_polydipsia: 0.70, dehydration: 0.85, confusion: 0.60, gcs_drop: 0.20, lethargy: 0.40, known_diabetes: 0.70, fatigue: 0.50, tachycardia: 0.50, hypotension: 0.20, ketonaemia: 0.10, metabolic_acidosis: 0.15, nausea_vomiting: 0.30, fever: 0.20, raised_creatinine: 0.60, seizure: 0.05, focal_weakness: 0.05 },
    },
    {
      id: 'hypoglycaemia', label: 'Hypoglycaemia', icd10: 'E16.2', prior: T.uncommon, course: 'acute',
      features: { low_glucose: 0.97, known_diabetes: 0.90, insulin_or_sulfonylurea: 0.85, confusion: 0.60, diaphoresis: 0.50, anxiety_tremor: 0.35, palpitations: 0.25, dizziness: 0.30, focal_weakness: 0.10, speech_disturbance: 0.15, seizure: 0.10, gcs_drop: 0.25, known_ckd: 0.20, sudden_onset: 0.50, syncope: 0.10 },
    },
  ],
  features: [
    { id: 'known_diabetes', label: 'Known diabetes', question: 'Does the patient have diabetes?', category: 'history', baseRate: 0.12 },
    { id: 'polyuria_polydipsia', label: 'Polyuria / excessive thirst', question: 'Is there excessive thirst or passing large volumes of urine?', category: 'symptom', baseRate: 0.02 },
    { id: 'hyperglycaemia', label: 'Glucose ≥ 11.1 mmol/L', question: 'Is the blood glucose 11.1 mmol/L or higher?', category: 'investigation', baseRate: 0.05 },
    { id: 'very_high_glucose', label: 'Glucose ≥ 30 mmol/L', question: 'Is the blood glucose 30 mmol/L or higher?', category: 'investigation', baseRate: 0.003 },
    { id: 'low_glucose', label: 'Glucose < 4.0 mmol/L', question: 'Is the blood glucose below 4.0 mmol/L?', category: 'investigation', baseRate: 0.005 },
    { id: 'ketonaemia', label: 'Blood ketones ≥ 3.0 mmol/L (or urine ketones ++ or more)', question: 'Are blood ketones 3.0 mmol/L or higher?', category: 'investigation', baseRate: 0.005 },
    { id: 'metabolic_acidosis', label: 'Metabolic acidosis (pH < 7.3 or bicarbonate < 15)', question: 'Does the blood gas show metabolic acidosis?', category: 'investigation', baseRate: 0.01 },
    { id: 'kussmaul', label: 'Deep sighing (Kussmaul) breathing / ketotic breath', question: 'Is there deep, sighing (Kussmaul) breathing or a ketotic smell?', category: 'sign', baseRate: 0.002 },
    { id: 'sglt2_inhibitor', label: 'SGLT2 inhibitor (gliflozin) use', question: 'Is the patient taking an SGLT2 inhibitor (dapagliflozin, empagliflozin, canagliflozin)?', category: 'history', baseRate: 0.02 },
    { id: 'insulin_or_sulfonylurea', label: 'Insulin or sulfonylurea use', question: 'Is the patient taking insulin or a sulfonylurea (gliclazide, glibenclamide, glimepiride)?', category: 'history', baseRate: 0.05 },
  ],
});
