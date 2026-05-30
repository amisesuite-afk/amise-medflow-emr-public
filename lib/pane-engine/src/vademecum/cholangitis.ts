import type { DiseaseNode } from '../types.js';

// Sources: TG18 Tokyo Guidelines, EASL 2016 clinical practice guidelines.
export const cholangitis: DiseaseNode = {
  id: 'cholangitis',
  label: 'Acute Cholangitis',
  icd10: 'K83.0',
  prior: 0.04,
  features: {
    ruq_pain:      0.75,
    fever:         0.90,
    jaundice:      0.70,
    rigors:        0.70,
    nausea_vomiting: 0.60,
    us_gallstones: 0.80,
    elevated_wbc:  0.85,
  },
};
