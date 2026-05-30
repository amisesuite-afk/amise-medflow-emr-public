import { registerModule } from '../registry.js';

registerModule({
  specialty: 'vascular',
  system: 'vascular_peripheral',
  diseases: [
    {
      id: 'peripheral_arterial_disease', label: 'Peripheral Arterial Disease', icd10: 'I73.9', prior: 0.03,
      features: { claudication: 0.85, rest_pain: 0.55, absent_pulses: 0.80, skin_ulceration: 0.45, leg_swelling: 0.20, weight_loss: 0.20 },
    },
    {
      id: 'aortic_aneurysm', label: 'Aortic Aneurysm', icd10: 'I71.9', prior: 0.01,
      features: { epigastric_pain: 0.55, radiation_to_back: 0.65, pulsatile_mass: 0.75, absent_pulses: 0.35, nausea_vomiting: 0.40 },
    },
    {
      id: 'deep_vein_thrombosis', label: 'Deep Vein Thrombosis', icd10: 'I82.409', prior: 0.03,
      features: { leg_swelling: 0.90, calf_tenderness: 0.80, previous_surgery: 0.45, fever: 0.30, skin_ulceration: 0.10 },
    },
    {
      id: 'varicose_veins', label: 'Varicose Veins', icd10: 'I83.90', prior: 0.05,
      features: { varicosities: 0.95, leg_swelling: 0.50, calf_tenderness: 0.30, skin_ulceration: 0.20, skin_pigmentation: 0.40 },
    },
    {
      id: 'chronic_venous_insufficiency', label: 'Chronic Venous Insufficiency', icd10: 'I87.2', prior: 0.03,
      features: { leg_swelling: 0.90, varicosities: 0.65, skin_pigmentation: 0.75, skin_ulceration: 0.55, calf_tenderness: 0.40 },
    },
    {
      id: 'arterial_ulcer', label: 'Arterial Ulcer', icd10: 'I70.249', prior: 0.02,
      features: { skin_ulceration: 0.95, claudication: 0.70, rest_pain: 0.65, absent_pulses: 0.85, leg_swelling: 0.15 },
    },
    {
      id: 'venous_ulcer', label: 'Venous / Leg Ulcer', icd10: 'I87.319', prior: 0.02,
      features: { skin_ulceration: 0.95, varicosities: 0.70, leg_swelling: 0.80, skin_pigmentation: 0.75, calf_tenderness: 0.45 },
    },
    {
      id: 'lymphoedema', label: 'Lymphoedema', icd10: 'I89.0', prior: 0.01,
      features: { leg_swelling: 0.95, skin_pigmentation: 0.40, varicosities: 0.15, previous_surgery: 0.40 },
    },
    {
      id: 'pulmonary_embolism', label: 'Pulmonary Embolism', icd10: 'I26.99', prior: 0.02,
      features: { leg_swelling: 0.40, calf_tenderness: 0.35, fever: 0.30, previous_surgery: 0.40, pleuritic_chest_pain: 0.65, dyspnoea_pe: 0.85 },
    },
    {
      id: 'raynauds_phenomenon', label: "Raynaud's Phenomenon", icd10: 'I73.00', prior: 0.01,
      features: { heat_intolerance: 0.10, pain_migration: 0.20, colour_change_digits: 0.95 },
    },
  ],
  features: [
    { id: 'claudication', label: 'Intermittent claudication', question: 'Is there leg pain on walking that is relieved by rest (intermittent claudication)?', category: 'symptom' },
    { id: 'rest_pain', label: 'Rest pain (ischaemic)', question: 'Is there ischaemic rest pain in the foot, especially at night or hanging the limb down?', category: 'symptom' },
    { id: 'leg_swelling', label: 'Leg / ankle swelling', question: 'Is there leg or ankle swelling (unilateral or bilateral)?', category: 'sign' },
    { id: 'calf_tenderness', label: 'Calf tenderness', question: 'Is there calf tenderness on palpation or dorsiflexion?', category: 'sign' },
    { id: 'absent_pulses', label: 'Absent / reduced peripheral pulses', question: 'Are peripheral pulses absent or reduced on examination?', category: 'sign' },
    { id: 'skin_ulceration', label: 'Skin ulceration / non-healing wound', question: 'Is there a skin ulcer or non-healing wound on the leg or foot?', category: 'sign' },
    { id: 'varicosities', label: 'Visible varicosities', question: 'Are there visible tortuous varicose veins on the leg?', category: 'sign' },
    { id: 'skin_pigmentation', label: 'Skin pigmentation / haemosiderin', question: 'Is there skin pigmentation, haemosiderin staining, or lipodermatosclerosis on the lower leg?', category: 'sign' },
    { id: 'pulsatile_mass', label: 'Pulsatile abdominal / groin mass', question: 'Is there a pulsatile mass in the abdomen or groin?', category: 'sign' },
    { id: 'pleuritic_chest_pain', label: 'Pleuritic chest pain', question: 'Is there pleuritic chest pain (sharp, worse on inspiration)?', category: 'symptom' },
    { id: 'dyspnoea_pe', label: 'Sudden dyspnoea / breathlessness', question: 'Is there sudden onset dyspnoea or unexplained breathlessness?', category: 'symptom' },
    { id: 'colour_change_digits', label: 'Colour change of digits (white/blue/red)', question: 'Is there episodic colour change of fingers or toes (white → blue → red)?', category: 'sign' },
  ],
});
