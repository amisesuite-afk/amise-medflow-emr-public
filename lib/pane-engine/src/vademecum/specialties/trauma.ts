import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). ATLS 10th ed. (2018); NICE
// NG232 (2023) head injury; British Burn Association referral criteria (2012) — adult ≥ 3 % TBSA
// partial thickness is a specialist-burns referral, so "major" here means ≥ 20 % TBSA (fluid
// resuscitation threshold for adults, ATLS / ANZBA EMSB).
// Every trauma node needs an injury mechanism: without one the finding-only overlap (headache,
// pleuritic pain, dyspnoea) must not rank trauma above medical causes.
registerModule({
  specialty: 'trauma',
  system: 'multisystem',
  diseases: [
    {
      id: 'blunt_abdominal_trauma', label: 'Blunt Abdominal Trauma', icd10: 'S39.92XA', prior: T.rare, course: 'acute',
      features: { abdominal_tenderness: 0.85, guarding: 0.60, haemodynamic_instability: 0.40, hypotension: 0.30, tachycardia: 0.50, mechanism_blunt: 0.98, trauma_mechanism: 0.99, haematuria: 0.25, nausea_vomiting: 0.40 },
    },
    {
      id: 'penetrating_abdominal_trauma', label: 'Penetrating Abdominal Trauma (Stab / Gunshot)', icd10: 'S31.609A', prior: T.rare, course: 'acute',
      features: { abdominal_tenderness: 0.85, guarding: 0.70, haemodynamic_instability: 0.45, hypotension: 0.35, tachycardia: 0.50, mechanism_penetrating: 0.98, trauma_mechanism: 0.99, evisceration: 0.25, nausea_vomiting: 0.40 },
    },
    {
      id: 'traumatic_brain_injury', label: 'Traumatic Brain Injury', icd10: 'S09.90XA', prior: T.uncommon, course: 'acute',
      features: { loss_of_consciousness: 0.60, gcs_drop: 0.60, confusion: 0.45, headache: 0.75, vomiting_post_trauma: 0.45, nausea_vomiting: 0.40, pupil_asymmetry: 0.20, mechanism_blunt: 0.90, head_injury: 0.98, trauma_mechanism: 0.99, anticoagulant_use: 0.15 },
    },
    {
      id: 'rib_fractures', label: 'Rib Fractures', icd10: 'S29.009A', prior: T.uncommon, course: 'acute',
      features: { chest_wall_tenderness: 0.90, pleuritic_chest_pain: 0.80, chest_pain: 0.95, paradoxical_breathing: 0.10, mechanism_blunt: 0.95, trauma_mechanism: 0.99, dyspnoea: 0.50 },
    },
    {
      id: 'pneumothorax_traumatic', label: 'Traumatic / Tension Pneumothorax', icd10: 'S27.0XXA', prior: T.rare, course: 'acute',
      features: { chest_wall_tenderness: 0.70, pleuritic_chest_pain: 0.70, dyspnoea: 0.90, dyspnoea_pe: 0.70, hypoxia: 0.60, tachycardia: 0.60, hypotension: 0.25, haemodynamic_instability: 0.30, reduced_breath_sounds: 0.80, tracheal_deviation: 0.20, mechanism_blunt: 0.80, trauma_mechanism: 0.99 },
    },
    {
      id: 'haemothorax', label: 'Haemothorax', icd10: 'S27.1XXA', prior: T.rare, course: 'acute',
      features: { chest_wall_tenderness: 0.65, dyspnoea: 0.85, hypoxia: 0.50, haemodynamic_instability: 0.45, hypotension: 0.35, tachycardia: 0.60, reduced_breath_sounds: 0.75, mechanism_blunt: 0.75, trauma_mechanism: 0.99, pleuritic_chest_pain: 0.55 },
    },
    {
      id: 'splenic_laceration', label: 'Splenic Laceration', icd10: 'S36.039A', prior: T.rare, course: 'acute',
      features: { luq_pain: 0.70, lif_pain: 0.20, haemodynamic_instability: 0.45, hypotension: 0.35, tachycardia: 0.60, kehr_sign: 0.40, shoulder_tip_pain: 0.40, guarding: 0.60, mechanism_blunt: 0.95, trauma_mechanism: 0.99, abdominal_tenderness: 0.80 },
    },
    {
      id: 'thermal_burn_major', label: 'Major Thermal Burn (≥ 20 % TBSA)', icd10: 'T31.20', prior: T.rare, course: 'acute',
      features: { burn_wound: 0.99, tbsa_significant: 0.95, inhalation_injury: 0.30, singed_eyebrows: 0.40, haemodynamic_instability: 0.30, tachycardia: 0.60 },
    },
    {
      id: 'thermal_burn_minor', label: 'Minor / Moderate Thermal Burn (< 20 % TBSA)', icd10: 'T30.0', prior: T.uncommon, course: 'acute',
      features: { burn_wound: 0.99, erythema_burn: 0.85, blistering: 0.65, tbsa_significant: 0.05 },
    },
    {
      id: 'electrical_burn', label: 'Electrical Burn / Electrocution Injury', icd10: 'T75.4XXA', prior: T.veryRare, course: 'acute',
      features: { burn_wound: 0.85, electrical_injury: 0.98, haemodynamic_instability: 0.20, loss_of_consciousness: 0.35, haematuria: 0.30, palpitations: 0.30 },
    },
  ],
  features: [
    { id: 'trauma_mechanism', label: 'Injury / trauma mechanism', question: 'Did the symptoms follow an injury (fall, collision, assault, stab)?', category: 'history', baseRate: 0.04 },
    { id: 'mechanism_blunt',       label: 'Blunt mechanism of injury',       question: 'Was the injury caused by blunt force (RTA, fall, assault)?', category: 'sign', baseRate: 0.03 },
    { id: 'mechanism_penetrating', label: 'Penetrating injury (stab / gunshot)', question: 'Was there a penetrating injury (stab or gunshot wound)?', category: 'sign', baseRate: 0.005 },
    { id: 'head_injury',           label: 'Head injury',                     question: 'Was there an injury to the head?', category: 'history', baseRate: 0.01 },
    { id: 'evisceration',          label: 'Evisceration',                    question: 'Is bowel or omentum protruding through a wound?', category: 'sign', baseRate: 0.001 },
    { id: 'loss_of_consciousness', label: 'Loss of consciousness',           question: 'Was there loss of consciousness?', category: 'symptom', baseRate: 0.01 },
    { id: 'gcs_drop',              label: 'Reduced GCS (<15) / responds only to voice, pain or unresponsive', question: 'Is the current GCS less than 15 (AVPU V, P or U)?', category: 'sign', baseRate: 0.01 },
    { id: 'pupil_asymmetry',       label: 'Unequal pupils (anisocoria)',     question: 'Are the pupils unequal in size or reactivity?', category: 'sign', baseRate: 0.003 },
    { id: 'vomiting_post_trauma',  label: 'Vomiting after head injury',      question: 'Has the patient vomited since the injury?', category: 'symptom', baseRate: 0.005 },
    { id: 'haemodynamic_instability', label: 'Haemodynamic instability',    question: 'Is the patient haemodynamically unstable (SBP <90 or HR >120)?', category: 'sign', baseRate: 0.01 },
    { id: 'haematuria',            label: 'Haematuria',                      question: 'Is there blood in the urine?', category: 'sign', baseRate: 0.02 },
    { id: 'paradoxical_breathing', label: 'Paradoxical chest wall movement', question: 'Is there paradoxical (inward) chest movement on inspiration?', category: 'sign', baseRate: 0.001 },
    { id: 'reduced_breath_sounds', label: 'Reduced breath sounds on one side', question: 'Are breath sounds reduced on one side?', category: 'sign', baseRate: 0.01 },
    { id: 'tracheal_deviation',    label: 'Tracheal deviation',              question: 'Is the trachea deviated?', category: 'sign', baseRate: 0.001 },
    { id: 'kehr_sign',             label: 'Kehr\'s sign (left shoulder tip pain)', question: 'Is there left shoulder tip pain on lying flat / Trendelenburg?', category: 'sign', baseRate: 0.003 },
    { id: 'burn_wound',            label: 'Burn wound present',              question: 'Is there a visible burn wound?', category: 'sign', baseRate: 0.01 },
    { id: 'electrical_injury',     label: 'Electrical injury / electrocution', question: 'Was there an electrical injury?', category: 'history', baseRate: 0.001 },
    { id: 'tbsa_significant',      label: 'TBSA ≥20%',                       question: 'Does the estimated burn area cover 20% or more of body surface?', category: 'sign', baseRate: 0.002 },
    { id: 'inhalation_injury',     label: 'Inhalation injury signs',         question: 'Are there signs of inhalation injury (singed nasal hair, hoarse voice, sooty sputum, stridor)?', category: 'sign', baseRate: 0.002 },
    { id: 'singed_eyebrows',       label: 'Singed eyebrows / nasal hair',    question: 'Are the eyebrows or nasal hair singed?', category: 'sign', baseRate: 0.001 },
    { id: 'erythema_burn',         label: 'Erythema (superficial burn)',      question: 'Is the burn area erythematous and painful without blistering?', category: 'sign', baseRate: 0.005 },
    { id: 'blistering',            label: 'Blistering (partial thickness)',   question: 'Are there blisters at the burn site?', category: 'sign', baseRate: 0.005 },
    { id: 'abdominal_tenderness',  label: 'Abdominal tenderness on palpation', question: 'Is there tenderness on abdominal palpation?', category: 'sign', baseRate: 0.10 },
    { id: 'guarding',              label: 'Abdominal guarding / rigidity',   question: 'Is there guarding or rigidity of the abdominal wall?', category: 'sign', baseRate: 0.02 },
    { id: 'chest_wall_tenderness', label: 'Chest wall tenderness',           question: 'Is there focal tenderness over the chest wall / ribs?', category: 'sign', baseRate: 0.01 },
    { id: 'headache',              label: 'Headache',                        question: 'Is there a headache?', category: 'symptom', baseRate: 0.05 },
  ],
});
