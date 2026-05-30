import type { DiseaseNode } from '../types.js';

// Sources: EHS guidelines 2018, NICE NG189 2021.
export const inguinalHernia: DiseaseNode = {
  id: 'inguinal_hernia',
  label: 'Inguinal / Femoral Hernia',
  icd10: 'K40.90',
  prior: 0.07,
  features: {
    groin_swelling:      0.90,
    colicky_pain:        0.40,
    nausea_vomiting:     0.35,
    hernia_irreducible:  0.45,
    rlq_pain:            0.30,
  },
};
