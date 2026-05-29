import type { DiseaseNode } from '../types.js';

// Sources: NICE NG151 2020, ACG colorectal cancer guidelines 2021.
export const colorectalCancer: DiseaseNode = {
  id: 'colorectal_cancer',
  label: 'Colorectal Cancer',
  icd10: 'C18.9',
  prior: 0.03,
  features: {
    change_bowel_habit: 0.70,
    melaena:            0.35,
    weight_loss:        0.60,
    anorexia:           0.50,
    lif_pain:           0.30,
    elevated_wbc:       0.35,
  },
};
