import type { DiseaseNode } from '../types.js';

// Sources: Vakil 2006 (Montreal definition), BSG GORD guidelines 2019.
export const gord: DiseaseNode = {
  id: 'gord',
  label: 'GORD / Reflux Oesophagitis',
  icd10: 'K21.0',
  prior: 0.12,
  features: {
    heartburn:       0.85,
    epigastric_pain: 0.55,
    nocturnal_pain:  0.50,
    antacid_relief:  0.75,
    dysphagia:       0.25,
    nausea_vomiting: 0.40,
  },
};
