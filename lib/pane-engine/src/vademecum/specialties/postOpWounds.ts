import { registerModule } from '../registry.js';

registerModule({
  specialty: 'post_op',
  system: 'postoperative',
  diseases: [
    {
      id: 'surgical_site_infection', label: 'Surgical Site Infection (SSI)', icd10: 'T81.40XA', prior: 0.04,
      features: { wound_erythema: 0.90, wound_discharge: 0.80, postop_fever: 0.70, elevated_wbc: 0.75, previous_surgery: 0.99, wound_dehiscence_sign: 0.35 },
    },
    {
      id: 'wound_dehiscence', label: 'Wound Dehiscence / Burst Abdomen', icd10: 'T81.31XA', prior: 0.01,
      features: { wound_dehiscence_sign: 0.99, wound_erythema: 0.60, wound_discharge: 0.65, postop_fever: 0.45, previous_surgery: 0.99 },
    },
    {
      id: 'anastomotic_leak', label: 'Anastomotic Leak', icd10: 'K91.89', prior: 0.02,
      features: { postop_fever: 0.80, abdominal_tenderness: 0.75, guarding: 0.65, elevated_wbc: 0.80, previous_surgery: 0.99, haemodynamic_instability: 0.40 },
    },
    {
      id: 'postop_seroma', label: 'Post-operative Seroma', icd10: 'T81.89XA', prior: 0.05,
      features: { wound_seroma: 0.90, wound_discharge: 0.50, wound_erythema: 0.15, previous_surgery: 0.99, postop_fever: 0.05 },
    },
    {
      id: 'postop_haematoma', label: 'Post-operative Haematoma', icd10: 'T81.0XXA', prior: 0.03,
      features: { wound_seroma: 0.80, wound_erythema: 0.50, wound_discharge: 0.30, previous_surgery: 0.99, postop_fever: 0.25 },
    },
    {
      id: 'ileus_postop', label: 'Post-operative Ileus', icd10: 'K56.0', prior: 0.04,
      features: { abdominal_distension: 0.85, nausea_vomiting: 0.80, absent_bowel_sounds: 0.70, absolute_constipation: 0.75, previous_surgery: 0.99, postop_fever: 0.15 },
    },
    {
      id: 'adhesion_obstruction', label: 'Small Bowel Obstruction — Adhesions', icd10: 'K56.50', prior: 0.03,
      features: { colicky_pain: 0.80, abdominal_distension: 0.85, absolute_constipation: 0.80, nausea_vomiting: 0.75, previous_surgery: 0.90, tinkling_bowel_sounds: 0.70, absent_bowel_sounds: 0.30 },
    },
    {
      id: 'incisional_hernia_early', label: 'Early Incisional Hernia / Fascial Disruption', icd10: 'K43.0', prior: 0.02,
      features: { wound_dehiscence_sign: 0.70, previous_surgery: 0.99, abdominal_distension: 0.50, hernia_irreducible: 0.35, wound_seroma: 0.60 },
    },
  ],
  features: [
    { id: 'wound_erythema', label: 'Wound erythema / warmth / induration', question: 'Is there erythema, warmth, or induration around the surgical wound?', category: 'sign' },
    { id: 'wound_discharge', label: 'Wound discharge (purulent or serous)', question: 'Is there discharge (purulent, serous, or faeculent) from the wound?', category: 'sign' },
    { id: 'wound_dehiscence_sign', label: 'Wound edge separation / dehiscence', question: 'Are the wound edges separating or has the wound opened?', category: 'sign' },
    { id: 'wound_seroma', label: 'Fluctuant wound swelling (seroma / haematoma)', question: 'Is there a fluctuant swelling at or adjacent to the surgical wound?', category: 'sign' },
    { id: 'postop_fever', label: 'Post-operative fever (>38°C)', question: 'Is there fever >38°C in the post-operative period?', category: 'sign' },
    { id: 'absent_bowel_sounds', label: 'Absent bowel sounds', question: 'Are bowel sounds absent on auscultation of the abdomen?', category: 'sign' },
  ],
});
