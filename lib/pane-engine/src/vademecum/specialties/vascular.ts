import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral).
//  - AAA (symptomatic / ruptured): ESVS 2024 AAA guideline, NICE NG156 (2020). Triad of
//    abdominal/back pain, pulsatile mass, hypotension is present in only ≈ 50 %; commonly
//    mislabelled renal colic in men > 60.
//  - Acute mesenteric ischaemia: ESVS 2017 / WSES 2022 — pain out of proportion to signs, AF or
//    vascular disease, lactate, older age.
//  - Acute limb ischaemia: ESVS 2020 — the 6 Ps (pain, pallor, pulselessness, perishing cold,
//    paraesthesia, paralysis); embolic (AF) or thrombotic (PAD).
//  - PE: ESC 2019 PE guideline; PIOPED II (Stein et al., Am J Med 2007): dyspnoea ≈ 73–80 %,
//    pleuritic pain ≈ 44–66 %, tachycardia ≈ 25–30 %, haemoptysis ≈ 13 %, syncope ≈ 10 %.
//  - DVT: NICE NG158 (2020) / Wells DVT.
//  - Superficial thrombophlebitis: NICE CKS 2022 / ESVS 2021 venous thrombosis guideline.
//  - Femoral artery (pseudo)aneurysm: pulsatile groin mass, often after arterial puncture or in
//    people who inject drugs (ESVS 2020 / ESVS 2024).
registerModule({
  specialty: 'vascular',
  system: 'vascular_peripheral',
  diseases: [
    {
      id: 'peripheral_arterial_disease', label: 'Peripheral Arterial Disease', icd10: 'I73.9', prior: T.uncommon, course: 'chronic',
      features: { claudication: 0.85, rest_pain: 0.40, absent_pulses: 0.80, skin_ulceration: 0.30, smoker: 0.70, known_diabetes: 0.40, vascular_risk: 0.80 },
    },
    {
      id: 'aortic_aneurysm', label: 'Abdominal Aortic Aneurysm (Symptomatic / Ruptured)', icd10: 'I71.9', prior: T.rare, course: 'acute',
      features: { abdominal_pain: 0.70, back_pain: 0.65, loin_pain: 0.40, epigastric_pain: 0.30, radiation_to_back: 0.50, pulsatile_mass: 0.60, hypotension: 0.40, syncope: 0.25, tachycardia: 0.45, sudden_onset: 0.60, absent_pulses: 0.20, nausea_vomiting: 0.25, vascular_risk: 0.80, smoker: 0.75, known_aaa: 0.40, pain_out_of_proportion: 0.20 },
    },
    {
      id: 'aortoenteric_fistula', label: 'Aorto-enteric Fistula (after aortic graft)', icd10: 'K63.2', prior: T.veryRare, course: 'acute',
      // Herald bleed after aortic graft; graft infection gives fever and back pain (ESVS 2020 vascular graft infection)
      features: { aortic_graft: 0.95, previous_surgery: 0.95, haematemesis: 0.45, melaena: 0.60, pr_bleeding: 0.30, anaemia: 0.60, raised_urea: 0.50, epigastric_pain: 0.30, hypotension: 0.30, back_pain: 0.35, fever: 0.40, raised_crp: 0.60, tachycardia: 0.50, pallor: 0.40, vascular_risk: 0.90, antiplatelet_use: 0.40, known_aaa: 0.60 },
    },
    {
      id: 'mesenteric_ischaemia', label: 'Acute Mesenteric Ischaemia', icd10: 'K55.0', prior: T.rare, course: 'acute',
      features: { pallor: 0.20, mesenteric_ct_signs: 0.80, abdominal_pain: 0.95, pain_out_of_proportion: 0.75, periumbilical_pain: 0.45, diffuse_abdominal_pain: 0.45, sudden_onset: 0.55, nausea_vomiting: 0.60, diarrhoea: 0.35, pr_bleeding: 0.20, irregular_pulse: 0.45, known_af: 0.45, vascular_risk: 0.70, raised_lactate: 0.70, elevated_wbc: 0.75, tachycardia: 0.60, hypotension: 0.25, postprandial_pain: 0.25, abdominal_tenderness: 0.50 },
    },
    {
      id: 'acute_limb_ischaemia', label: 'Acute Limb Ischaemia (Arterial Embolism / Thrombosis)', icd10: 'I74.3', prior: T.rare, course: 'acute',
      features: { limb_pain: 0.90, cold_limb: 0.85, pale_limb: 0.75, absent_pulses: 0.90, limb_numbness: 0.60, limb_weakness: 0.40, sudden_onset: 0.65, irregular_pulse: 0.40, known_af: 0.40, claudication: 0.30, vascular_risk: 0.70 },
    },
    {
      id: 'deep_vein_thrombosis', label: 'Deep Vein Thrombosis', icd10: 'I82.409', prior: T.uncommon, course: 'acute',
      features: { leg_swelling: 0.90, unilateral_leg_swelling: 0.85, calf_tenderness: 0.75, limb_pain: 0.70, previous_surgery: 0.20, recent_immobility: 0.35, fever: 0.10, erythema_surrounding: 0.25, known_malignancy: 0.15, oestrogen_use: 0.15 },
    },
    {
      id: 'superficial_thrombophlebitis', label: 'Superficial Vein Thrombosis / Thrombophlebitis', icd10: 'I80.00', prior: T.uncommon, course: 'acute',
      features: { tender_cord: 0.90, varicosities: 0.70, erythema_surrounding: 0.70, limb_pain: 0.70, leg_swelling: 0.25, calf_tenderness: 0.30 },
    },
    {
      id: 'varicose_veins', label: 'Varicose Veins', icd10: 'I83.90', prior: T.frequent, course: 'chronic',
      features: { varicosities: 0.95, leg_swelling: 0.40, calf_tenderness: 0.10, skin_ulceration: 0.10, skin_pigmentation: 0.30, leg_aching: 0.60 },
    },
    {
      id: 'chronic_venous_insufficiency', label: 'Chronic Venous Insufficiency', icd10: 'I87.2', prior: T.uncommon, course: 'chronic',
      features: { leg_swelling: 0.90, bilateral_leg_oedema: 0.50, varicosities: 0.65, skin_pigmentation: 0.75, skin_ulceration: 0.45, calf_tenderness: 0.20 },
    },
    {
      id: 'arterial_ulcer', label: 'Arterial Ulcer', icd10: 'I70.249', prior: T.rare, course: 'chronic',
      features: { skin_ulceration: 0.95, claudication: 0.60, rest_pain: 0.60, absent_pulses: 0.85, leg_swelling: 0.10, smoker: 0.60, known_diabetes: 0.40 },
    },
    {
      id: 'venous_ulcer', label: 'Venous / Leg Ulcer', icd10: 'I87.319', prior: T.uncommon, course: 'chronic',
      features: { skin_ulceration: 0.95, varicosities: 0.65, leg_swelling: 0.80, skin_pigmentation: 0.75, calf_tenderness: 0.20 },
    },
    {
      id: 'lymphoedema', label: 'Lymphoedema', icd10: 'I89.0', prior: T.rare, course: 'chronic',
      features: { leg_swelling: 0.95, skin_pigmentation: 0.30, varicosities: 0.10, previous_surgery: 0.40 },
    },
    {
      id: 'pulmonary_embolism', label: 'Pulmonary Embolism', icd10: 'I26.99', prior: T.uncommon, course: 'acute',
      features: { dyspnoea: 0.80, dyspnoea_pe: 0.65, pleuritic_chest_pain: 0.50, chest_pain_pressure: 0.10, tachycardia: 0.35, tachypnoea: 0.50, hypoxia: 0.55, haemoptysis: 0.12, syncope: 0.12, hypotension: 0.08, leg_swelling: 0.25, unilateral_leg_swelling: 0.25, calf_tenderness: 0.20, previous_surgery: 0.25, recent_immobility: 0.35, known_malignancy: 0.15, oestrogen_use: 0.15, sudden_onset: 0.50, fever: 0.15, cough: 0.20 },
    },
    {
      id: 'raynauds_phenomenon', label: "Raynaud's Phenomenon", icd10: 'I73.00', prior: T.rare, course: 'chronic',
      features: { colour_change_digits: 0.95, cold_limb: 0.40 },
    },
    {
      id: 'femoral_artery_aneurysm', label: 'Femoral Artery Aneurysm / Pseudoaneurysm', icd10: 'I72.4', prior: T.veryRare, course: 'any',
      features: { groin_swelling: 0.90, pulsatile_mass: 0.85, groin_pain: 0.50, arterial_puncture: 0.40, injecting_drug_use: 0.25, vascular_risk: 0.50, hernia_irreducible: 0.40, cough_impulse: 0.03, groin_lump_reducible: 0.03 },
    },
  ],
  features: [
    { id: 'claudication', label: 'Intermittent claudication', question: 'Is there leg pain on walking that is relieved by rest (intermittent claudication)?', category: 'symptom', baseRate: 0.02 },
    { id: 'rest_pain', label: 'Rest pain (ischaemic)', question: 'Is there ischaemic rest pain in the foot, especially at night or hanging the limb down?', category: 'symptom', baseRate: 0.005 },
    { id: 'leg_swelling', label: 'Leg / ankle swelling', question: 'Is there leg or ankle swelling (unilateral or bilateral)?', category: 'sign', baseRate: 0.05 },
    { id: 'unilateral_leg_swelling', label: 'Unilateral leg swelling', question: 'Is the leg swelling on one side only?', category: 'sign', baseRate: 0.01 },
    { id: 'bilateral_leg_oedema', label: 'Bilateral ankle / leg oedema', question: 'Is there bilateral pitting ankle or leg oedema?', category: 'sign', baseRate: 0.03 },
    { id: 'calf_tenderness', label: 'Calf tenderness', question: 'Is there calf tenderness on palpation or dorsiflexion?', category: 'sign', baseRate: 0.01 },
    { id: 'limb_pain', label: 'Limb pain', question: 'Is there pain in an arm or leg?', category: 'symptom', baseRate: 0.05 },
    { id: 'leg_aching', label: 'Aching / heavy legs', question: 'Do the legs ache or feel heavy, worse at the end of the day?', category: 'symptom', baseRate: 0.03 },
    { id: 'cold_limb', label: 'Cold limb', question: 'Is the limb cold compared with the other side?', category: 'sign', baseRate: 0.005 },
    { id: 'pale_limb', label: 'Pale / mottled limb', question: 'Is the limb pale, white or mottled?', category: 'sign', baseRate: 0.003 },
    { id: 'limb_numbness', label: 'Numbness / paraesthesia of a limb', question: 'Is there numbness or pins and needles in the limb?', category: 'symptom', baseRate: 0.02 },
    { id: 'absent_pulses', label: 'Absent / reduced peripheral pulses', question: 'Are peripheral pulses absent or reduced on examination?', category: 'sign', baseRate: 0.01 },
    { id: 'skin_ulceration', label: 'Skin ulceration / non-healing wound', question: 'Is there a skin ulcer or non-healing wound on the leg or foot?', category: 'sign', baseRate: 0.01 },
    { id: 'varicosities', label: 'Visible varicosities', question: 'Are there visible tortuous varicose veins on the leg?', category: 'sign', baseRate: 0.03 },
    { id: 'tender_cord', label: 'Tender, red, cord-like superficial vein', question: 'Is there a tender, red, cord-like superficial vein?', category: 'sign', baseRate: 0.003 },
    { id: 'skin_pigmentation', label: 'Skin pigmentation / haemosiderin', question: 'Is there skin pigmentation, haemosiderin staining, or lipodermatosclerosis on the lower leg?', category: 'sign', baseRate: 0.02 },
    { id: 'pulsatile_mass', label: 'Pulsatile abdominal / groin mass', question: 'Is there a pulsatile mass in the abdomen or groin?', category: 'sign', baseRate: 0.002 },
    { id: 'pleuritic_chest_pain', label: 'Pleuritic chest pain', question: 'Is there pleuritic chest pain (sharp, worse on inspiration)?', category: 'symptom', baseRate: 0.02 },
    { id: 'dyspnoea_pe', label: 'Sudden dyspnoea / breathlessness', question: 'Is there sudden onset dyspnoea or unexplained breathlessness?', category: 'symptom', baseRate: 0.02 },
    { id: 'colour_change_digits', label: 'Colour change of digits (white/blue/red)', question: 'Is there episodic colour change of fingers or toes (white → blue → red)?', category: 'sign', baseRate: 0.005 },
    { id: 'pain_out_of_proportion', label: 'Pain out of proportion to examination findings', question: 'Is the pain severe but the examination findings unimpressive (pain out of proportion)?', category: 'sign', baseRate: 0.005 },
    { id: 'mesenteric_ct_signs', label: 'CT: mesenteric vessel occlusion / pneumatosis / portal venous gas', question: 'Does CT show mesenteric vessel occlusion, pneumatosis or portal venous gas?', category: 'investigation', baseRate: 0.001 },
    { id: 'known_af', label: 'Known atrial fibrillation', question: 'Does the patient have known atrial fibrillation?', category: 'history', baseRate: 0.03 },
    { id: 'known_aaa', label: 'Known abdominal aortic aneurysm', question: 'Is there a known abdominal aortic aneurysm?', category: 'history', baseRate: 0.005 },
    { id: 'aortic_graft', label: 'Previous aortic graft / EVAR', question: 'Has the patient had an aortic graft or EVAR?', category: 'history', baseRate: 0.002 },
    { id: 'vascular_risk', label: 'Vascular risk factors (smoking, diabetes, hypertension, hyperlipidaemia, IHD)', question: 'Does the patient have vascular risk factors or known arterial disease?', category: 'history', baseRate: 0.30 },
    { id: 'recent_immobility', label: 'Recent immobility / long-haul travel', question: 'Has there been recent immobility, hospitalisation or long-haul travel?', category: 'history', baseRate: 0.05 },
    { id: 'oestrogen_use', label: 'Oestrogen (combined pill / HRT) use', question: 'Is the patient taking a combined oral contraceptive or HRT?', category: 'history', baseRate: 0.05 },
    { id: 'arterial_puncture', label: 'Recent arterial puncture / catheterisation', question: 'Has there been a recent femoral arterial puncture (angiography, line)?', category: 'history', baseRate: 0.005 },
    { id: 'injecting_drug_use', label: 'Injecting drug use', question: 'Does the patient inject drugs?', category: 'history', baseRate: 0.005 },
  ],
});
