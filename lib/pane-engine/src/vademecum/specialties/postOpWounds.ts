import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Every node here needs recent
// surgery (`recent_surgery`, within ~30 days; the feature mapper records it as absent when the
// record gives no operation). Sources: NICE NG125 (2019, 2020 update) surgical site infection;
// ERAS / NELA; WSES 2017 (anastomotic leak: fever, tachycardia, peritonism, rising CRP day 3–5 —
// often occult in the elderly); BTS/NICE HAP (post-operative pneumonia: cough, fever, hypoxia,
// crackles days 2–5); post-thyroidectomy neck haematoma (airway emergency — BAETS / DAS 2014).
registerModule({
  specialty: 'post_op',
  system: 'postoperative',
  diseases: [
    {
      id: 'surgical_site_infection', label: 'Surgical Site Infection (SSI)', icd10: 'T81.40XA', prior: T.uncommon, course: 'acute',
      features: { wound_erythema: 0.90, wound_discharge: 0.75, wound_pain: 0.80, postop_fever: 0.50, elevated_wbc: 0.60, previous_surgery: 0.99, recent_surgery: 0.97, wound_dehiscence_sign: 0.20 },
    },
    {
      id: 'wound_dehiscence', label: 'Wound Dehiscence / Burst Abdomen', icd10: 'T81.31XA', prior: T.rare, course: 'acute',
      features: { wound_dehiscence_sign: 0.99, wound_erythema: 0.50, wound_discharge: 0.65, postop_fever: 0.30, previous_surgery: 0.99, recent_surgery: 0.97 },
    },
    {
      id: 'anastomotic_leak', label: 'Anastomotic Leak', icd10: 'K91.89', prior: T.rare, course: 'acute',
      features: { postop_fever: 0.60, tachycardia: 0.75, abdominal_tenderness: 0.75, guarding: 0.50, diffuse_abdominal_pain: 0.50, elevated_wbc: 0.75, raised_crp: 0.85, previous_surgery: 0.99, recent_surgery: 0.98, bowel_resection: 0.90, haemodynamic_instability: 0.30, hypotension: 0.25, confusion: 0.20, abdominal_distension: 0.40, ileus_signs: 0.40, tachypnoea: 0.40 },
    },
    {
      // WSES 2017 management of intra-abdominal infections (Sartelli et al., World J Emerg Surg
      // 2017): swinging fever, pain, ileus and rising CRP days 5–10 after surgery; CT confirms.
      id: 'postop_collection', label: 'Post-operative Intra-abdominal Collection / Abscess / Bile Leak', icd10: 'K65.1', prior: T.rare, course: 'acute',
      features: { postop_fever: 0.75, abdominal_tenderness: 0.60, elevated_wbc: 0.75, raised_crp: 0.85, previous_surgery: 0.99, recent_surgery: 0.97, tachycardia: 0.50, rigors: 0.30, abdominal_pain: 0.70, shoulder_tip_pain: 0.15, nausea_vomiting: 0.35, ileus_signs: 0.25 },
    },
    {
      id: 'postop_seroma', label: 'Post-operative Seroma', icd10: 'T81.89XA', prior: T.uncommon, course: 'subacute',
      features: { wound_seroma: 0.90, wound_discharge: 0.40, wound_erythema: 0.10, previous_surgery: 0.99, recent_surgery: 0.95, postop_fever: 0.05 },
    },
    {
      id: 'postop_haematoma', label: 'Post-operative Haematoma (incl. Neck Haematoma after Thyroidectomy)', icd10: 'T81.0XXA', prior: T.uncommon, course: 'acute',
      features: { wound_seroma: 0.70, wound_swelling: 0.90, wound_erythema: 0.30, wound_pain: 0.60, wound_discharge: 0.20, previous_surgery: 0.99, recent_surgery: 0.98, postop_fever: 0.10, neck_surgery: 0.35, stridor: 0.15, dyspnoea: 0.20, anticoagulant_use: 0.25 },
    },
    {
      id: 'ileus_postop', label: 'Post-operative Ileus', icd10: 'K56.0', prior: T.uncommon, course: 'acute',
      features: { abdominal_distension: 0.85, nausea_vomiting: 0.80, ileus_signs: 0.85, absent_bowel_sounds: 0.70, absolute_constipation: 0.75, previous_surgery: 0.99, recent_surgery: 0.98, postop_fever: 0.10 },
    },
    {
      id: 'adhesion_obstruction', label: 'Small Bowel Obstruction — Adhesions', icd10: 'K56.50', prior: T.uncommon, course: 'acute',
      features: { colicky_pain: 0.80, abdominal_distension: 0.85, absolute_constipation: 0.75, nausea_vomiting: 0.80, bilious_vomiting: 0.40, previous_surgery: 0.95, tinkling_bowel_sounds: 0.60, absent_bowel_sounds: 0.20, periumbilical_pain: 0.35 },
    },
    {
      id: 'incisional_hernia_early', label: 'Early Incisional Hernia / Fascial Disruption', icd10: 'K43.0', prior: T.rare, course: 'acute',
      features: { wound_dehiscence_sign: 0.60, previous_surgery: 0.99, recent_surgery: 0.95, abdominal_distension: 0.40, hernia_irreducible: 0.30, wound_seroma: 0.50, incisional_swelling: 0.70 },
    },
  ],
  features: [
    { id: 'recent_surgery', label: 'Operation within the last 30 days', question: 'Has the patient had an operation in the last 30 days?', category: 'history', baseRate: 0.03 },
    { id: 'bowel_resection', label: 'Bowel resection / anastomosis', question: 'Did the operation include a bowel resection or anastomosis?', category: 'history', baseRate: 0.01 },
    { id: 'neck_surgery', label: 'Recent neck surgery (thyroid / parathyroid)', question: 'Was the operation on the neck (thyroid / parathyroid)?', category: 'history', baseRate: 0.005 },
    { id: 'wound_erythema', label: 'Wound erythema / warmth / induration', question: 'Is there erythema, warmth, or induration around the surgical wound?', category: 'sign', baseRate: 0.01 },
    { id: 'wound_pain', label: 'Wound pain', question: 'Is the surgical wound painful?', category: 'symptom', baseRate: 0.01 },
    { id: 'wound_swelling', label: 'Swelling at the operation site', question: 'Is there swelling at the operation site?', category: 'sign', baseRate: 0.01 },
    { id: 'wound_discharge', label: 'Wound discharge (purulent or serous)', question: 'Is there discharge (purulent, serous, or faeculent) from the wound?', category: 'sign', baseRate: 0.01 },
    { id: 'wound_dehiscence_sign', label: 'Wound edge separation / dehiscence', question: 'Are the wound edges separating or has the wound opened?', category: 'sign', baseRate: 0.002 },
    { id: 'wound_seroma', label: 'Fluctuant wound swelling (seroma / haematoma)', question: 'Is there a fluctuant swelling at or adjacent to the surgical wound?', category: 'sign', baseRate: 0.005 },
    { id: 'postop_fever', label: 'Post-operative fever (>38°C)', question: 'Is there fever >38°C in the post-operative period?', category: 'sign', baseRate: 0.005 },
    { id: 'absent_bowel_sounds', label: 'Absent bowel sounds', question: 'Are bowel sounds absent on auscultation of the abdomen?', category: 'sign', baseRate: 0.01 },
    { id: 'ileus_signs', label: 'Not passing flatus / not tolerating diet after surgery', question: 'Is the patient not passing flatus or not tolerating diet after surgery?', category: 'symptom', baseRate: 0.005 },
    { id: 'raised_crp', label: 'Raised / rising CRP', question: 'Is the CRP raised or rising?', category: 'investigation', baseRate: 0.10 },
  ],
});
