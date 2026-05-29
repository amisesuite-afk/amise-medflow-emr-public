import { registerModule } from '../registry.js';

registerModule({
  specialty: 'colorectal',
  system: 'lower_gi',
  diseases: [
    {
      id: 'haemorrhoids', label: 'Haemorrhoids', icd10: 'K64.9', prior: 0.06,
      features: { pr_bleeding: 0.90, anal_pain: 0.50, perianal_swelling: 0.60, prolapse_pr: 0.55, pruritus: 0.50, change_bowel_habit: 0.25 },
    },
    {
      id: 'anal_fissure', label: 'Anal Fissure', icd10: 'K60.2', prior: 0.03,
      features: { anal_pain: 0.95, pr_bleeding: 0.70, absolute_constipation: 0.40, perianal_swelling: 0.25, tenesmus: 0.30 },
    },
    {
      id: 'perianal_abscess', label: 'Perianal Abscess / Fistula', icd10: 'K61.0', prior: 0.03,
      features: { anal_pain: 0.90, perianal_swelling: 0.90, fever: 0.65, elevated_wbc: 0.70, discharge_perianal: 0.60, pr_bleeding: 0.20 },
    },
    {
      id: 'crohns_disease', label: "Crohn's Disease", icd10: 'K50.90', prior: 0.02,
      features: { lif_pain: 0.50, change_bowel_habit: 0.80, weight_loss: 0.65, fever: 0.45, pr_bleeding: 0.35, anorexia: 0.55, perianal_swelling: 0.30 },
    },
    {
      id: 'ulcerative_colitis', label: 'Ulcerative Colitis', icd10: 'K51.90', prior: 0.02,
      features: { pr_bleeding: 0.90, mucus_pr: 0.70, tenesmus: 0.65, lif_pain: 0.60, change_bowel_habit: 0.85, fever: 0.40, weight_loss: 0.40 },
    },
    {
      id: 'rectal_carcinoma', label: 'Rectal Carcinoma', icd10: 'C20', prior: 0.02,
      features: { pr_bleeding: 0.75, change_bowel_habit: 0.75, tenesmus: 0.55, weight_loss: 0.60, anorexia: 0.55, mucus_pr: 0.40, lif_pain: 0.30 },
    },
    {
      id: 'ischaemic_colitis', label: 'Ischaemic Colitis', icd10: 'K55.9', prior: 0.02,
      features: { lif_pain: 0.70, pr_bleeding: 0.80, change_bowel_habit: 0.60, nausea_vomiting: 0.45, fever: 0.40, elevated_wbc: 0.65 },
    },
    {
      id: 'rectal_prolapse', label: 'Rectal Prolapse', icd10: 'K62.3', prior: 0.01,
      features: { prolapse_pr: 0.95, pr_bleeding: 0.50, mucus_pr: 0.60, tenesmus: 0.45, change_bowel_habit: 0.40 },
    },
    {
      id: 'pilonidal_disease', label: 'Pilonidal Disease', icd10: 'L05.91', prior: 0.02,
      features: { perianal_swelling: 0.75, anal_pain: 0.80, discharge_perianal: 0.70, fever: 0.45, elevated_wbc: 0.40 },
    },
    {
      id: 'appendix_mass', label: 'Appendix Mass / Late Appendicitis', icd10: 'K35.3', prior: 0.02,
      features: { rlq_pain: 0.90, fever: 0.70, elevated_wbc: 0.80, anorexia: 0.65, nausea_vomiting: 0.60, abdominal_distension: 0.35, previous_surgery: 0.15 },
    },
  ],
  features: [
    { id: 'tenesmus', label: 'Tenesmus', question: 'Is there tenesmus (sensation of incomplete bowel emptying)?', category: 'symptom' },
    { id: 'anal_pain', label: 'Anal / perianal pain', question: 'Is there anal or perianal pain, especially on defaecation?', category: 'symptom' },
    { id: 'perianal_swelling', label: 'Perianal swelling / lump', question: 'Is there a visible or palpable perianal swelling or lump?', category: 'sign' },
    { id: 'mucus_pr', label: 'Mucus per rectum', question: 'Is there mucus discharge per rectum?', category: 'symptom' },
    { id: 'prolapse_pr', label: 'Rectal / anal prolapse', question: 'Is there tissue prolapsing through the anus, especially on straining?', category: 'sign' },
    { id: 'discharge_perianal', label: 'Perianal discharge / pus', question: 'Is there pus or discharge from the perianal area?', category: 'sign' },
  ],
});
