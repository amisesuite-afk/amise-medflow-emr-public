import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). BTA 2014 thyroid cancer
// guideline and ATA 2015 (nodules); ATA 2016 hyperthyroidism; NICE NG145 (2019) thyroid disease;
// Society for Endocrinology emergency guidance on acute hypercalcaemia (2016); Endocrine Society
// 2014 phaeochromocytoma/paraganglioma guideline (paroxysmal headache, sweating, palpitations
// with hypertension). Anaplastic thyroid carcinoma / primary thyroid lymphoma: rapidly enlarging
// hard goitre with compressive symptoms (stridor, dysphagia, hoarseness) in older patients
// (ATA 2021 anaplastic thyroid cancer guideline).
registerModule({
  specialty: 'endocrine',
  system: 'endocrine_neck',
  diseases: [
    {
      id: 'thyroid_nodule_benign', label: 'Benign Thyroid Nodule / Goitre', icd10: 'D34', prior: T.frequent, course: 'chronic',
      features: { neck_lump: 0.90, thyroid_swelling: 0.90, dysphagia: 0.15, hoarseness: 0.05, heat_intolerance: 0.10, palpitations_thyroid: 0.10 },
    },
    {
      id: 'thyroid_carcinoma', label: 'Thyroid Carcinoma (Differentiated)', icd10: 'C73', prior: T.rare, course: 'chronic',
      features: { neck_lump: 0.90, thyroid_swelling: 0.85, hoarseness: 0.25, dysphagia: 0.20, weight_loss: 0.15, cervical_nodes: 0.30, dysphagia_solids: 0.20, rapid_growth: 0.20 },
    },
    {
      id: 'anaplastic_thyroid', label: 'Anaplastic Thyroid Carcinoma / Thyroid Lymphoma', icd10: 'C73', prior: T.veryRare, course: 'subacute',
      features: { neck_lump: 0.95, thyroid_swelling: 0.90, rapid_growth: 0.90, stridor: 0.35, hoarseness: 0.50, dysphagia: 0.55, dyspnoea: 0.40, weight_loss: 0.40, cervical_nodes: 0.40, neck_pain: 0.30 },
    },
    {
      id: 'hyperthyroidism', label: 'Hyperthyroidism / Thyrotoxicosis (Graves, Toxic Nodule)', icd10: 'E05.90', prior: T.uncommon, course: 'subacute',
      features: { heat_intolerance: 0.85, palpitations_thyroid: 0.80, palpitations: 0.70, tachycardia: 0.60, weight_loss: 0.60, fatigue: 0.50, neck_lump: 0.55, thyroid_swelling: 0.60, diarrhoea: 0.25, irregular_pulse: 0.15, anxiety_tremor: 0.60 },
    },
    {
      id: 'hashimoto_thyroiditis', label: 'Hashimoto Thyroiditis / Hypothyroidism', icd10: 'E06.3', prior: T.uncommon, course: 'chronic',
      features: { neck_lump: 0.50, thyroid_swelling: 0.50, fatigue: 0.80, weight_gain: 0.50, constipation: 0.35, cold_intolerance: 0.50 },
    },
    {
      id: 'primary_hyperparathyroidism', label: 'Primary Hyperparathyroidism', icd10: 'E21.0', prior: T.rare, course: 'chronic',
      features: { hypercalcaemia_symptoms: 0.70, hypercalcaemia_lab: 0.95, fatigue: 0.60, nausea_vomiting: 0.30, constipation: 0.40, polyuria_polydipsia: 0.35, renal_stones_history: 0.25, bone_pain: 0.30, low_mood: 0.30 },
    },
    {
      id: 'parathyroid_adenoma', label: 'Parathyroid Adenoma', icd10: 'D35.10', prior: T.veryRare, course: 'chronic',
      features: { neck_lump: 0.15, hypercalcaemia_symptoms: 0.70, hypercalcaemia_lab: 0.95, fatigue: 0.55, constipation: 0.35, polyuria_polydipsia: 0.30 },
    },
    {
      id: 'phaeochromocytoma', label: 'Phaeochromocytoma / Paraganglioma', icd10: 'D35.00', prior: T.veryRare, course: 'chronic',
      features: { hypertension_symptom: 0.85, paroxysmal_episodes: 0.75, headache: 0.75, diaphoresis: 0.70, palpitations: 0.70, tachycardia: 0.50, severe_hypertension: 0.50, raised_bp: 0.85, anxiety_tremor: 0.40, adrenal_mass: 0.40, weight_loss: 0.20 },
    },
    {
      id: 'adrenal_incidentaloma', label: 'Adrenal Incidentaloma', icd10: 'D44.10', prior: T.rare, course: 'chronic',
      features: { adrenal_mass: 0.95, raised_bp: 0.40, hypertension_symptom: 0.20 },
    },
    {
      id: 'neck_lymphadenopathy', label: 'Cervical Lymphadenopathy', icd10: 'R59.9', prior: T.uncommon, course: 'any',
      features: { neck_lump: 0.95, cervical_nodes: 0.95, fever: 0.40, weight_loss: 0.30, night_sweats: 0.25, fatigue: 0.40, sore_throat: 0.30 },
    },
    {
      id: 'salivary_gland_mass', label: 'Salivary Gland Mass', icd10: 'D11.9', prior: T.rare, course: 'chronic',
      features: { neck_lump: 0.85, parotid_swelling: 0.80, facial_weakness: 0.05 },
    },
    {
      id: 'branchial_cyst', label: 'Branchial Cyst', icd10: 'Q18.0', prior: T.veryRare, course: 'chronic',
      features: { neck_lump: 0.95, anterior_triangle_lump: 0.90, fever: 0.20 },
    },
  ],
  features: [
    { id: 'neck_lump', label: 'Neck lump / mass', question: 'Is there a palpable lump or mass in the neck?', category: 'sign', baseRate: 0.01 },
    { id: 'thyroid_swelling', label: 'Thyroid swelling (moves on swallowing)', question: 'Is there a swelling of the thyroid that moves on swallowing?', category: 'sign', baseRate: 0.005 },
    { id: 'cervical_nodes', label: 'Cervical lymph nodes', question: 'Are there enlarged cervical lymph nodes?', category: 'sign', baseRate: 0.01 },
    { id: 'anterior_triangle_lump', label: 'Anterior-triangle lateral neck lump', question: 'Is the lump in the anterior triangle of the neck, anterior to sternocleidomastoid?', category: 'sign', baseRate: 0.002 },
    { id: 'parotid_swelling', label: 'Parotid / submandibular swelling', question: 'Is the swelling in the parotid or submandibular region?', category: 'sign', baseRate: 0.002 },
    { id: 'hoarseness', label: 'Hoarseness / voice change', question: 'Is there hoarseness or change in voice quality?', category: 'symptom', baseRate: 0.01 },
    { id: 'heat_intolerance', label: 'Heat intolerance / sweating', question: 'Is there heat intolerance, excessive sweating, or feeling hot all the time?', category: 'symptom', baseRate: 0.02 },
    { id: 'cold_intolerance', label: 'Cold intolerance', question: 'Is there cold intolerance?', category: 'symptom', baseRate: 0.02 },
    { id: 'weight_gain', label: 'Weight gain', question: 'Has there been unexplained weight gain?', category: 'symptom', baseRate: 0.03 },
    { id: 'palpitations_thyroid', label: 'Palpitations / tremor', question: 'Are there palpitations, tremor, or feeling of a racing heart?', category: 'symptom', baseRate: 0.03 },
    { id: 'anxiety_tremor', label: 'Tremor / anxiety', question: 'Is there a fine tremor or marked anxiety?', category: 'symptom', baseRate: 0.03 },
    { id: 'hypercalcaemia_symptoms', label: 'Hypercalcaemia symptoms (bones, groans, moans)', question: 'Are there symptoms of hypercalcaemia — bone pain, constipation, confusion, polyuria?', category: 'symptom', baseRate: 0.01 },
    { id: 'renal_stones_history', label: 'History of kidney stones', question: 'Has the patient had kidney stones before?', category: 'history', baseRate: 0.03 },
    { id: 'dysphagia_solids', label: 'Dysphagia to solids', question: 'Is there difficulty swallowing solid food specifically (progressive)?', category: 'symptom', baseRate: 0.01 },
    { id: 'hypertension_symptom', label: 'Hypertension / headaches / sweating episodes', question: 'Is there resistant hypertension or paroxysmal headaches with sweating?', category: 'symptom', baseRate: 0.02 },
    { id: 'paroxysmal_episodes', label: 'Paroxysmal spells (headache, sweating, palpitations)', question: 'Are there discrete spells of headache, sweating and palpitations?', category: 'symptom', baseRate: 0.005 },
    { id: 'adrenal_mass', label: 'Adrenal mass on imaging', question: 'Has imaging shown an adrenal mass?', category: 'investigation', baseRate: 0.003 },
    { id: 'sore_throat', label: 'Sore throat', question: 'Is there a sore throat?', category: 'symptom', baseRate: 0.03 },
    { id: 'low_mood', label: 'Low mood', question: 'Is the patient low in mood?', category: 'symptom', baseRate: 0.05 },
    { id: 'neck_pain', label: 'Neck pain', question: 'Is there neck pain?', category: 'symptom', baseRate: 0.02 },
  ],
});
