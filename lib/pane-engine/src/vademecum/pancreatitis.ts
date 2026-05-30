import type { DiseaseNode } from '../types.js';

// Sources: Revised Atlanta Classification 2012, IAP/APA guidelines 2013.
export const pancreatitis: DiseaseNode = {
  id: 'pancreatitis',
  label: 'Acute Pancreatitis',
  icd10: 'K85.9',
  prior: 0.05,
  features: {
    epigastric_pain:     0.80,
    radiation_to_back:   0.65,
    nausea_vomiting:     0.80,
    fever:               0.50,
    elevated_amylase:    0.90,
    elevated_wbc:        0.65,
  },
};
