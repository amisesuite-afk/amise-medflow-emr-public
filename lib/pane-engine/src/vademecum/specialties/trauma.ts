import { registerModule } from '../registry.js';

registerModule({
  specialty: 'trauma',
  system: 'multisystem',
  diseases: [
    {
      id: 'blunt_abdominal_trauma', label: 'Blunt Abdominal Trauma', icd10: 'S39.92XA', prior: 0.03,
      features: { abdominal_tenderness: 0.85, guarding: 0.70, haemodynamic_instability: 0.55, mechanism_blunt: 0.95, haematuria: 0.30, nausea_vomiting: 0.50 },
    },
    {
      id: 'penetrating_abdominal_trauma', label: 'Penetrating Abdominal Trauma', icd10: 'S31.609A', prior: 0.02,
      features: { abdominal_tenderness: 0.90, guarding: 0.80, haemodynamic_instability: 0.60, mechanism_blunt: 0.05, nausea_vomiting: 0.55 },
    },
    {
      id: 'traumatic_brain_injury', label: 'Traumatic Brain Injury', icd10: 'S09.90XA', prior: 0.04,
      features: { loss_of_consciousness: 0.70, gcs_drop: 0.75, headache: 0.80, vomiting_post_trauma: 0.60, pupil_asymmetry: 0.35, mechanism_blunt: 0.85 },
    },
    {
      id: 'rib_fractures', label: 'Rib Fractures', icd10: 'S29.009A', prior: 0.05,
      features: { chest_wall_tenderness: 0.90, pleuritic_chest_pain: 0.80, paradoxical_breathing: 0.40, mechanism_blunt: 0.90, dyspnoea_pe: 0.65 },
    },
    {
      id: 'pneumothorax_traumatic', label: 'Traumatic Pneumothorax', icd10: 'S27.0XXA', prior: 0.04,
      features: { chest_wall_tenderness: 0.70, pleuritic_chest_pain: 0.75, dyspnoea_pe: 0.90, haemodynamic_instability: 0.40, mechanism_blunt: 0.80 },
    },
    {
      id: 'haemothorax', label: 'Haemothorax', icd10: 'S27.1XXA', prior: 0.03,
      features: { chest_wall_tenderness: 0.65, dyspnoea_pe: 0.85, haemodynamic_instability: 0.60, mechanism_blunt: 0.75, pleuritic_chest_pain: 0.60 },
    },
    {
      id: 'splenic_laceration', label: 'Splenic Laceration', icd10: 'S36.039A', prior: 0.03,
      features: { lif_pain: 0.60, haemodynamic_instability: 0.65, kehr_sign: 0.50, guarding: 0.70, mechanism_blunt: 0.90, abdominal_tenderness: 0.80 },
    },
    {
      id: 'thermal_burn_major', label: 'Major Thermal Burn (>20% TBSA)', icd10: 'T31.30', prior: 0.02,
      features: { burn_wound: 0.99, tbsa_significant: 0.95, inhalation_injury: 0.40, singed_eyebrows: 0.50, haemodynamic_instability: 0.45 },
    },
    {
      id: 'thermal_burn_minor', label: 'Minor Thermal Burn (<20% TBSA)', icd10: 'T30.0', prior: 0.03,
      features: { burn_wound: 0.99, erythema_burn: 0.85, blistering: 0.65, tbsa_significant: 0.05 },
    },
    {
      id: 'electrical_burn', label: 'Electrical Burn / Electrocution Injury', icd10: 'T75.4XXA', prior: 0.01,
      features: { burn_wound: 0.85, haemodynamic_instability: 0.40, loss_of_consciousness: 0.45, haematuria: 0.35 },
    },
  ],
  features: [
    { id: 'mechanism_blunt',       label: 'Blunt mechanism of injury',       question: 'Was the injury caused by blunt force (RTA, fall, assault)?', category: 'sign' },
    { id: 'loss_of_consciousness', label: 'Loss of consciousness',           question: 'Was there loss of consciousness at the time of injury?', category: 'symptom' },
    { id: 'gcs_drop',              label: 'Reduced GCS (<15)',               question: 'Is the current GCS less than 15?', category: 'sign' },
    { id: 'pupil_asymmetry',       label: 'Unequal pupils (anisocoria)',     question: 'Are the pupils unequal in size or reactivity?', category: 'sign' },
    { id: 'vomiting_post_trauma',  label: 'Vomiting after head injury',      question: 'Has the patient vomited since the injury?', category: 'symptom' },
    { id: 'haemodynamic_instability', label: 'Haemodynamic instability',    question: 'Is the patient haemodynamically unstable (SBP <90 or HR >120)?', category: 'sign' },
    { id: 'haematuria',            label: 'Haematuria',                      question: 'Is there blood in the urine?', category: 'sign' },
    { id: 'paradoxical_breathing', label: 'Paradoxical chest wall movement', question: 'Is there paradoxical (inward) chest movement on inspiration?', category: 'sign' },
    { id: 'kehr_sign',             label: 'Kehr\'s sign (left shoulder tip pain)', question: 'Is there left shoulder tip pain on lying flat / Trendelenburg?', category: 'sign' },
    { id: 'burn_wound',            label: 'Burn wound present',              question: 'Is there a visible burn wound?', category: 'sign' },
    { id: 'tbsa_significant',      label: 'TBSA ≥20%',                       question: 'Does the estimated burn area cover 20% or more of body surface?', category: 'sign' },
    { id: 'inhalation_injury',     label: 'Inhalation injury signs',         question: 'Are there signs of inhalation injury (singed nasal hair, hoarse voice, sooty sputum, stridor)?', category: 'sign' },
    { id: 'singed_eyebrows',       label: 'Singed eyebrows / nasal hair',    question: 'Are the eyebrows or nasal hair singed?', category: 'sign' },
    { id: 'erythema_burn',         label: 'Erythema (superficial burn)',      question: 'Is the burn area erythematous and painful without blistering?', category: 'sign' },
    { id: 'blistering',            label: 'Blistering (partial thickness)',   question: 'Are there blisters at the burn site?', category: 'sign' },
    { id: 'abdominal_tenderness',  label: 'Abdominal tenderness on palpation', question: 'Is there tenderness on abdominal palpation?', category: 'sign' },
    { id: 'guarding',              label: 'Abdominal guarding / rigidity',   question: 'Is there guarding or rigidity of the abdominal wall?', category: 'sign' },
    { id: 'chest_wall_tenderness', label: 'Chest wall tenderness',           question: 'Is there focal tenderness over the chest wall / ribs?', category: 'sign' },
    { id: 'headache',              label: 'Post-traumatic headache',         question: 'Does the patient have a headache following the injury?', category: 'symptom' },
  ],
});
