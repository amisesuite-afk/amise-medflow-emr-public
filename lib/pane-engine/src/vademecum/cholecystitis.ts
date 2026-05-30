import type { DiseaseNode } from '../types.js';

// Likelihoods calibrated to surgical OPD biliary presentations.
// Sources: Trowbridge 2003 (Murphy's sign), TG18 guidelines, EASL 2016.
export const cholecystitis: DiseaseNode = {
  id: 'cholecystitis',
  label: 'Acute Cholecystitis',
  icd10: 'K81.0',
  prior: 0.15,
  features: {
    ruq_pain:           0.85,
    fatty_food_trigger: 0.60,
    murphy_sign:        0.65,
    fever:              0.55,
    nausea_vomiting:    0.70,
    jaundice:           0.15,
    us_gallstones:      0.95,
    elevated_wbc:       0.70,
  },
};
