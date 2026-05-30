import { registerModule } from '../registry.js';

registerModule({
  specialty: 'endocrine',
  system: 'endocrine_neck',
  diseases: [
    {
      id: 'thyroid_nodule_benign', label: 'Benign Thyroid Nodule', icd10: 'D34', prior: 0.03,
      features: { neck_lump: 0.90, dysphagia: 0.20, hoarseness: 0.10, heat_intolerance: 0.15, palpitations_thyroid: 0.15 },
    },
    {
      id: 'thyroid_carcinoma', label: 'Thyroid Carcinoma', icd10: 'C73', prior: 0.01,
      features: { neck_lump: 0.90, hoarseness: 0.35, dysphagia: 0.25, weight_loss: 0.40, axillary_nodes: 0.30, dysphagia_solids: 0.30 },
    },
    {
      id: 'hyperthyroidism', label: 'Hyperthyroidism (Graves)', icd10: 'E05.90', prior: 0.02,
      features: { heat_intolerance: 0.85, palpitations_thyroid: 0.80, weight_loss: 0.65, fatigue: 0.55, neck_lump: 0.60, nausea_vomiting: 0.30 },
    },
    {
      id: 'hashimoto_thyroiditis', label: 'Hashimoto Thyroiditis', icd10: 'E06.3', prior: 0.02,
      features: { neck_lump: 0.70, fatigue: 0.80, weight_loss: 0.30, heat_intolerance: 0.10, dysphagia: 0.20 },
    },
    {
      id: 'primary_hyperparathyroidism', label: 'Primary Hyperparathyroidism', icd10: 'E21.0', prior: 0.01,
      features: { hypercalcaemia_symptoms: 0.80, fatigue: 0.70, nausea_vomiting: 0.55, epigastric_pain: 0.40, anorexia: 0.45, weight_loss: 0.30 },
    },
    {
      id: 'parathyroid_adenoma', label: 'Parathyroid Adenoma', icd10: 'D35.10', prior: 0.005,
      features: { neck_lump: 0.40, hypercalcaemia_symptoms: 0.85, fatigue: 0.65, epigastric_pain: 0.35, anorexia: 0.40 },
    },
    {
      id: 'adrenal_incidentaloma', label: 'Adrenal Incidentaloma', icd10: 'D44.10', prior: 0.01,
      features: { fatigue: 0.50, weight_loss: 0.30, epigastric_pain: 0.25, hypertension_symptom: 0.55, anorexia: 0.30 },
    },
    {
      id: 'neck_lymphadenopathy', label: 'Cervical Lymphadenopathy', icd10: 'R59.9', prior: 0.03,
      features: { neck_lump: 0.95, fever: 0.50, weight_loss: 0.40, fatigue: 0.45, hoarseness: 0.15 },
    },
    {
      id: 'salivary_gland_mass', label: 'Salivary Gland Mass', icd10: 'D11.9', prior: 0.01,
      features: { neck_lump: 0.85, dysphagia: 0.30, hoarseness: 0.10, pain_migration: 0.20, fatty_food_trigger: 0.40 },
    },
    {
      id: 'branchial_cyst', label: 'Branchial Cyst', icd10: 'Q18.0', prior: 0.005,
      features: { neck_lump: 0.95, fever: 0.30, hoarseness: 0.10, dysphagia: 0.15 },
    },
  ],
  features: [
    { id: 'neck_lump', label: 'Neck lump / mass', question: 'Is there a palpable lump or mass in the neck?', category: 'sign' },
    { id: 'hoarseness', label: 'Hoarseness / voice change', question: 'Is there hoarseness or change in voice quality?', category: 'symptom' },
    { id: 'heat_intolerance', label: 'Heat intolerance / sweating', question: 'Is there heat intolerance, excessive sweating, or feeling hot all the time?', category: 'symptom' },
    { id: 'palpitations_thyroid', label: 'Palpitations / tremor', question: 'Are there palpitations, tremor, or feeling of a racing heart?', category: 'symptom' },
    { id: 'hypercalcaemia_symptoms', label: 'Hypercalcaemia symptoms (bones, groans, moans)', question: 'Are there symptoms of hypercalcaemia — bone pain, constipation, confusion, polyuria?', category: 'symptom' },
    { id: 'dysphagia_solids', label: 'Dysphagia to solids', question: 'Is there difficulty swallowing solid food specifically (progressive)?', category: 'symptom' },
    { id: 'hypertension_symptom', label: 'Hypertension / headaches / sweating episodes', question: 'Is there resistant hypertension or paroxysmal headaches with sweating?', category: 'symptom' },
  ],
});
