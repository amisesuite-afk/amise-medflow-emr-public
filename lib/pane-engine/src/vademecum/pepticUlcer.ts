import type { DiseaseNode } from '../types.js';

// Likelihoods calibrated to surgical OPD GI/epigastric presentations.
// Sources: Talley 1988, Moayyedi 2017 (Cochrane), BSG PUD guidelines 2019.
export const pepticUlcer: DiseaseNode = {
  id: 'peptic_ulcer',
  label: 'Peptic Ulcer Disease',
  icd10: 'K27.9',
  prior: 0.10,
  features: {
    epigastric_pain: 0.80,
    nocturnal_pain:  0.55,
    antacid_relief:  0.60,
    nsaid_use:       0.45,
    nausea_vomiting: 0.50,
    haematemesis:    0.20,
    melaena:         0.15,
  },
};
