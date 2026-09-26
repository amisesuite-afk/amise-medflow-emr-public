import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). NICE NG12 (2015, 2021 update)
// breast criteria; ABS 2019 (best practice diagnostic guidelines for patients presenting with
// breast symptoms). Sex handled by modifiers.ts (≈ 1 % of breast cancer is in men) and by
// `applicability` for gynaecomastia.
registerModule({
  specialty: 'breast',
  system: 'breast',
  diseases: [
    {
      id: 'fibroadenoma', label: 'Fibroadenoma', icd10: 'D24', prior: T.frequent, course: 'chronic',
      features: { breast_lump: 0.95, cyclical_breast_pain: 0.20, breast_lump_mobile: 0.85, skin_dimpling: 0.02, axillary_nodes: 0.03, nipple_discharge: 0.03, breast_lump_hard: 0.05 },
    },
    {
      id: 'fibrocystic_change', label: 'Fibrocystic Breast Disease / Cyclical Mastalgia', icd10: 'N60.19', prior: T.frequent, course: 'chronic',
      features: { breast_lump: 0.50, breast_pain: 0.85, cyclical_breast_pain: 0.85, nipple_discharge: 0.15, axillary_nodes: 0.05, skin_dimpling: 0.02 },
    },
    {
      id: 'invasive_ductal_carcinoma', label: 'Breast Carcinoma (Invasive Ductal / Lobular)', icd10: 'C50.919', prior: T.uncommon, course: 'chronic',
      features: { breast_lump: 0.90, breast_lump_hard: 0.70, skin_dimpling: 0.40, nipple_inversion: 0.30, axillary_nodes: 0.45, nipple_discharge: 0.10, bloody_nipple_discharge: 0.08, weight_loss: 0.15, cyclical_breast_pain: 0.05, breast_redness: 0.10, breast_lump_mobile: 0.15 },
    },
    {
      id: 'dcis', label: 'Ductal Carcinoma In Situ (DCIS)', icd10: 'D05.10', prior: T.rare, course: 'chronic',
      features: { breast_lump: 0.30, nipple_discharge: 0.35, bloody_nipple_discharge: 0.30, skin_dimpling: 0.10, axillary_nodes: 0.05 },
    },
    {
      id: 'phyllodes_tumour', label: 'Phyllodes Tumour', icd10: 'D48.60', prior: T.veryRare, course: 'chronic',
      features: { breast_lump: 0.95, breast_lump_mobile: 0.70, rapid_growth: 0.60, skin_dimpling: 0.15, axillary_nodes: 0.10 },
    },
    {
      id: 'mastitis', label: 'Mastitis', icd10: 'N61.0', prior: T.uncommon, course: 'acute',
      features: { breast_lump: 0.40, breast_pain: 0.85, breast_redness: 0.90, fever: 0.60, elevated_wbc: 0.60, post_lactation: 0.70 },
    },
    {
      id: 'breast_abscess', label: 'Breast Abscess', icd10: 'N61.1', prior: T.uncommon, course: 'acute',
      features: { breast_lump: 0.85, breast_pain: 0.90, breast_redness: 0.85, fever: 0.70, elevated_wbc: 0.80, post_lactation: 0.45, nipple_discharge: 0.25, swelling_fluctuant_soft: 0.60, smoker: 0.40 },
    },
    {
      id: 'fat_necrosis_breast', label: 'Fat Necrosis of Breast', icd10: 'N64.1', prior: T.rare, course: 'chronic',
      features: { breast_lump: 0.85, breast_lump_hard: 0.50, skin_dimpling: 0.30, previous_surgery: 0.40, breast_trauma: 0.50 },
    },
    {
      id: 'duct_ectasia', label: 'Duct Ectasia / Intraductal Papilloma', icd10: 'N60.49', prior: T.uncommon, course: 'chronic',
      features: { nipple_discharge: 0.85, bloody_nipple_discharge: 0.35, breast_lump: 0.25, nipple_inversion: 0.25, cyclical_breast_pain: 0.10, smoker: 0.40 },
    },
    {
      id: 'gynaecomastia', label: 'Gynaecomastia', icd10: 'N62', prior: T.uncommon, course: 'chronic', applicability: { sex: 'male' },
      features: { breast_lump: 0.90, breast_pain: 0.40, bilateral_breast: 0.60, nipple_discharge: 0.03, breast_lump_hard: 0.05 },
    },
  ],
  features: [
    { id: 'breast_lump', label: 'Breast lump / mass', question: 'Is there a palpable breast lump or mass?', category: 'sign', baseRate: 0.01 },
    { id: 'breast_lump_hard', label: 'Hard / irregular / fixed breast lump', question: 'Is the breast lump hard, irregular or fixed?', category: 'sign', baseRate: 0.002 },
    { id: 'breast_lump_mobile', label: 'Smooth, mobile breast lump', question: 'Is the lump smooth and mobile?', category: 'sign', baseRate: 0.005 },
    { id: 'breast_pain', label: 'Breast pain (mastalgia)', question: 'Is there breast pain?', category: 'symptom', baseRate: 0.01 },
    { id: 'breast_redness', label: 'Breast redness / warmth', question: 'Is the breast red, hot or inflamed?', category: 'sign', baseRate: 0.005 },
    { id: 'nipple_discharge', label: 'Nipple discharge', question: 'Is there spontaneous or expressible nipple discharge?', category: 'sign', baseRate: 0.005 },
    { id: 'bloody_nipple_discharge', label: 'Blood-stained single-duct nipple discharge', question: 'Is the nipple discharge blood-stained or from a single duct?', category: 'sign', baseRate: 0.001 },
    { id: 'nipple_inversion', label: 'New nipple inversion / retraction', question: 'Is there new nipple inversion or retraction?', category: 'sign', baseRate: 0.002 },
    { id: 'skin_dimpling', label: 'Skin dimpling / tethering', question: 'Is there skin dimpling, tethering, or peau d\'orange of the breast?', category: 'sign', baseRate: 0.002 },
    { id: 'axillary_nodes', label: 'Axillary lymphadenopathy', question: 'Are axillary lymph nodes palpable or enlarged?', category: 'sign', baseRate: 0.01 },
    { id: 'cyclical_breast_pain', label: 'Cyclical breast pain', question: 'Is breast pain cyclical, worse in the premenstrual phase?', category: 'symptom', baseRate: 0.005 },
    { id: 'post_lactation', label: 'Post-partum / lactating', question: 'Is the patient currently breastfeeding or recently post-partum?', category: 'history', baseRate: 0.02 },
    { id: 'bilateral_breast', label: 'Bilateral, symmetrical breast findings', question: 'Are the breast findings bilateral and symmetrical?', category: 'sign', baseRate: 0.005 },
    { id: 'rapid_growth', label: 'Rapidly enlarging lump', question: 'Has the lump enlarged rapidly over weeks?', category: 'symptom', baseRate: 0.005 },
    { id: 'breast_trauma', label: 'Recent breast trauma', question: 'Was there recent trauma to the breast?', category: 'history', baseRate: 0.005 },
  ],
});
