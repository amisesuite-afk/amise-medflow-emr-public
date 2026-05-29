import type { DiseaseNode } from '../types.js';

// Likelihoods calibrated to surgical OPD acute-abdominal-pain presentations.
// Sources: Alvarado 1986, Andersson 2004, Di Saverio 2020 (WSES guidelines).
export const appendicitis: DiseaseNode = {
  id: 'appendicitis',
  label: 'Acute Appendicitis',
  icd10: 'K35.80',
  prior: 0.08,
  features: {
    rlq_pain:            0.90,
    pain_migration:      0.50,
    fever:               0.67,
    anorexia:            0.68,
    nausea_vomiting:     0.75,
    rebound_tenderness:  0.63,
    elevated_wbc:        0.80,
  },
};
