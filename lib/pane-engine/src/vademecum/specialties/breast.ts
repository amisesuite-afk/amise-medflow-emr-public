import { registerModule } from '../registry.js';

registerModule({
  specialty: 'breast',
  system: 'breast',
  diseases: [
    {
      id: 'fibroadenoma', label: 'Fibroadenoma', icd10: 'D24', prior: 0.04,
      features: { breast_lump: 0.95, cyclical_breast_pain: 0.30, skin_dimpling: 0.05, axillary_nodes: 0.05, nipple_discharge: 0.05 },
    },
    {
      id: 'fibrocystic_change', label: 'Fibrocystic Breast Disease', icd10: 'N60.19', prior: 0.05,
      features: { breast_lump: 0.70, cyclical_breast_pain: 0.85, nipple_discharge: 0.25, axillary_nodes: 0.10, skin_dimpling: 0.05 },
    },
    {
      id: 'invasive_ductal_carcinoma', label: 'Invasive Ductal Carcinoma', icd10: 'C50.919', prior: 0.02,
      features: { breast_lump: 0.90, skin_dimpling: 0.45, axillary_nodes: 0.50, nipple_discharge: 0.20, weight_loss: 0.30, cyclical_breast_pain: 0.15 },
    },
    {
      id: 'dcis', label: 'Ductal Carcinoma In Situ (DCIS)', icd10: 'D05.10', prior: 0.01,
      features: { breast_lump: 0.40, nipple_discharge: 0.35, skin_dimpling: 0.20, axillary_nodes: 0.10 },
    },
    {
      id: 'phyllodes_tumour', label: 'Phyllodes Tumour', icd10: 'D48.60', prior: 0.005,
      features: { breast_lump: 0.95, skin_dimpling: 0.25, axillary_nodes: 0.15, cyclical_breast_pain: 0.10 },
    },
    {
      id: 'mastitis', label: 'Mastitis', icd10: 'N61.0', prior: 0.03,
      features: { breast_lump: 0.50, fever: 0.70, elevated_wbc: 0.70, post_lactation: 0.70, cyclical_breast_pain: 0.20, skin_dimpling: 0.10 },
    },
    {
      id: 'breast_abscess', label: 'Breast Abscess', icd10: 'N61.1', prior: 0.02,
      features: { breast_lump: 0.85, fever: 0.80, elevated_wbc: 0.85, post_lactation: 0.60, skin_dimpling: 0.30, nipple_discharge: 0.30 },
    },
    {
      id: 'fat_necrosis_breast', label: 'Fat Necrosis of Breast', icd10: 'N64.1', prior: 0.01,
      features: { breast_lump: 0.85, skin_dimpling: 0.45, previous_surgery: 0.50, cyclical_breast_pain: 0.15 },
    },
    {
      id: 'duct_ectasia', label: 'Duct Ectasia / Nipple Papilloma', icd10: 'N60.49', prior: 0.02,
      features: { nipple_discharge: 0.85, breast_lump: 0.35, cyclical_breast_pain: 0.25, skin_dimpling: 0.10 },
    },
    {
      id: 'gynaecomastia', label: 'Gynaecomastia', icd10: 'N62', prior: 0.02,
      features: { breast_lump: 0.90, cyclical_breast_pain: 0.40, nipple_discharge: 0.10 },
    },
  ],
  features: [
    { id: 'breast_lump', label: 'Breast lump / mass', question: 'Is there a palpable breast lump or mass?', category: 'sign' },
    { id: 'nipple_discharge', label: 'Nipple discharge', question: 'Is there spontaneous or expressible nipple discharge?', category: 'sign' },
    { id: 'skin_dimpling', label: 'Skin dimpling / tethering', question: 'Is there skin dimpling, tethering, or peau d\'orange of the breast?', category: 'sign' },
    { id: 'axillary_nodes', label: 'Axillary lymphadenopathy', question: 'Are axillary lymph nodes palpable or enlarged?', category: 'sign' },
    { id: 'cyclical_breast_pain', label: 'Cyclical breast pain', question: 'Is breast pain cyclical, worse in the premenstrual phase?', category: 'symptom' },
    { id: 'post_lactation', label: 'Post-partum / lactating', question: 'Is the patient currently breastfeeding or recently post-partum?', category: 'history' },
  ],
});
