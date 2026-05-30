import type { DiseaseNode } from '../types.js';

// Sources: ASCRS practice parameters 2020, WSES guidelines 2020.
export const diverticulitis: DiseaseNode = {
  id: 'diverticulitis',
  label: 'Acute Diverticulitis',
  icd10: 'K57.30',
  prior: 0.06,
  features: {
    lif_pain:           0.80,
    fever:              0.65,
    change_bowel_habit: 0.55,
    nausea_vomiting:    0.40,
    elevated_wbc:       0.70,
    rebound_tenderness: 0.40,
  },
};
