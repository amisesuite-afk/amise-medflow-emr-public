import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0: priors are PRIOR_TIER tiers (priors.ts); features not listed are neutral
// (feature base rate). Sensitivities: Alvarado 1986 and Andersson 2004 (appendicitis); Trowbridge
// et al., JAMA 2003 "Does this patient have acute cholecystitis?" (cholecystitis); TG18 (biliary
// infection); WSES 2017/2020 (obstruction, diverticulitis). Values are approximations of the
// published ranges and need sign-off.
registerModule({
  specialty: 'general_surgery',
  system: 'abdominal',
  diseases: [
    {
      id: 'appendicitis', label: 'Acute Appendicitis', icd10: 'K35.80', prior: T.frequent, course: 'acute',
      features: { rlq_pain: 0.90, pain_migration: 0.50, periumbilical_pain: 0.45, fever: 0.67, anorexia: 0.68, nausea_vomiting: 0.75, rebound_tenderness: 0.63, elevated_wbc: 0.80, pain_worse_movement: 0.70, abdominal_tenderness: 0.90, guarding: 0.45, diarrhoea: 0.15 },
    },
    {
      id: 'cholecystitis', label: 'Acute Cholecystitis', icd10: 'K81.0', prior: T.frequent, course: 'acute',
      // Trowbridge 2003: RUQ pain sens ≈ 0.81, Murphy sens ≈ 0.65, fever ≈ 0.35–0.55, vomiting ≈ 0.7
      features: { ruq_pain: 0.85, epigastric_pain: 0.35, fatty_food_trigger: 0.45, postprandial_pain: 0.35, murphy_sign: 0.65, fever: 0.50, nausea_vomiting: 0.70, jaundice: 0.15, us_gallstones: 0.95, elevated_wbc: 0.70, shoulder_tip_pain: 0.30, pain_worse_movement: 0.40, abdominal_tenderness: 0.90, pleuritic_chest_pain: 0.10 },
    },
    {
      id: 'peptic_ulcer', label: 'Peptic Ulcer Disease', icd10: 'K27.9', prior: T.frequent, course: 'subacute',
      features: { epigastric_pain: 0.80, nocturnal_pain: 0.55, antacid_relief: 0.60, postprandial_pain: 0.35, nsaid_use: 0.45, nausea_vomiting: 0.50, haematemesis: 0.20, melaena: 0.15, heartburn: 0.30, episodic_pain: 0.45 },
    },
    {
      id: 'pancreatitis', label: 'Acute Pancreatitis', icd10: 'K85.9', prior: T.uncommon, course: 'acute',
      features: { epigastric_pain: 0.80, radiation_to_back: 0.65, nausea_vomiting: 0.80, fever: 0.40, elevated_amylase: 0.90, elevated_wbc: 0.65, alcohol_use: 0.35, relief_sitting_forward: 0.30, sudden_onset: 0.40, tachycardia: 0.40, abdominal_tenderness: 0.90, us_gallstones: 0.40 },
    },
    {
      id: 'cholangitis', label: 'Acute Cholangitis', icd10: 'K83.0', prior: T.uncommon, course: 'acute',
      features: { ruq_pain: 0.75, fever: 0.90, jaundice: 0.70, rigors: 0.70, nausea_vomiting: 0.60, us_gallstones: 0.80, elevated_wbc: 0.85, dark_urine: 0.60, tachycardia: 0.50, hypotension: 0.15, confusion: 0.15 },
    },
    {
      id: 'gord', label: 'GORD / Reflux Oesophagitis', icd10: 'K21.0', prior: T.common, course: 'chronic',
      features: { heartburn: 0.85, epigastric_pain: 0.55, nocturnal_pain: 0.40, antacid_relief: 0.75, dysphagia: 0.20, nausea_vomiting: 0.25, regurgitation: 0.60, worse_lying_flat: 0.45, chest_pain_oesophageal: 0.30, episodic_pain: 0.50 },
    },
    {
      id: 'diverticulitis', label: 'Acute Diverticulitis', icd10: 'K57.30', prior: T.frequent, course: 'acute',
      features: { lif_pain: 0.85, fever: 0.65, change_bowel_habit: 0.50, diarrhoea: 0.25, constipation: 0.30, nausea_vomiting: 0.40, elevated_wbc: 0.70, rebound_tenderness: 0.40, abdominal_tenderness: 0.95, pain_worse_movement: 0.50, suprapubic_pain: 0.20 },
    },
    {
      id: 'inguinal_hernia', label: 'Inguinal / Femoral Hernia', icd10: 'K40.90', prior: T.frequent, course: 'any',
      features: { groin_swelling: 0.90, groin_pain: 0.55, colicky_pain: 0.15, nausea_vomiting: 0.15, hernia_irreducible: 0.20, rlq_pain: 0.15, groin_lump_reducible: 0.75, cough_impulse: 0.70, worse_straining: 0.45, scrotal_swelling: 0.20 },
    },
    {
      id: 'colorectal_cancer', label: 'Colorectal Cancer', icd10: 'C18.9', prior: T.uncommon, course: 'chronic',
      // NICE NG12: change in bowel habit, rectal bleeding, IDA, weight loss, abdominal mass
      features: { change_bowel_habit: 0.70, melaena: 0.10, pr_bleeding: 0.45, weight_loss: 0.50, anorexia: 0.40, lif_pain: 0.20, abdominal_pain: 0.45, anaemia: 0.45, fatigue: 0.40, abdominal_mass: 0.15, progressive_course: 0.50, positive_fit: 0.80, tenesmus: 0.15 },
    },
    {
      id: 'bowel_obstruction', label: 'Bowel Obstruction', icd10: 'K56.60', prior: T.uncommon, course: 'acute',
      features: { colicky_pain: 0.80, abdominal_distension: 0.90, absolute_constipation: 0.80, nausea_vomiting: 0.85, bilious_vomiting: 0.45, tinkling_bowel_sounds: 0.70, previous_surgery: 0.55, visible_peristalsis: 0.45, periumbilical_pain: 0.35, diffuse_abdominal_pain: 0.40, abdominal_tenderness: 0.70 },
    },
  ],
  features: [
    // ── Abdominal pain location ─────────────────────────────────────────────
    { id: 'abdominal_pain', label: 'Abdominal pain', question: 'Is there abdominal pain?', category: 'symptom', baseRate: 0.20 },
    { id: 'rlq_pain', label: 'RLQ / right iliac fossa pain', question: 'Is the pain localised to the right lower quadrant / right iliac fossa?', category: 'symptom', baseRate: 0.03 },
    { id: 'ruq_pain', label: 'RUQ pain / biliary colic', question: 'Is there right upper quadrant pain or biliary colic?', category: 'symptom', baseRate: 0.03 },
    { id: 'epigastric_pain', label: 'Epigastric pain', question: 'Is the predominant pain in the epigastrium (upper central abdomen)?', category: 'symptom', baseRate: 0.06 },
    { id: 'lif_pain', label: 'LIF / left iliac fossa pain', question: 'Is the pain localised to the left lower quadrant / left iliac fossa?', category: 'symptom', baseRate: 0.03 },
    { id: 'luq_pain', label: 'LUQ / left upper quadrant pain', question: 'Is the pain in the left upper quadrant?', category: 'symptom', baseRate: 0.02 },
    { id: 'periumbilical_pain', label: 'Periumbilical / central abdominal pain', question: 'Is the pain central, around the umbilicus?', category: 'symptom', baseRate: 0.03 },
    { id: 'diffuse_abdominal_pain', label: 'Diffuse / generalised abdominal pain', question: 'Is the abdominal pain diffuse or generalised?', category: 'symptom', baseRate: 0.04 },
    { id: 'radiation_to_back', label: 'Radiation to back', question: 'Does the pain radiate through to the back?', category: 'symptom', baseRate: 0.04 },
    { id: 'shoulder_tip_pain', label: 'Shoulder-tip pain / radiation to the shoulder', question: 'Does the pain radiate to the shoulder tip?', category: 'symptom', baseRate: 0.02 },
    // ── Pain character and course ───────────────────────────────────────────
    { id: 'pain_migration', label: 'Pain migration (periumbilical → RIF)', question: 'Did the pain start centrally / around the navel and migrate to the right lower abdomen?', category: 'symptom', baseRate: 0.02 },
    { id: 'colicky_pain', label: 'Colicky / wave-like pain', question: 'Is the pain colicky or wave-like rather than constant?', category: 'symptom', baseRate: 0.06 },
    { id: 'episodic_pain', label: 'Episodic / intermittent pain', question: 'Does the pain come in discrete episodes with pain-free intervals?', category: 'symptom', baseRate: 0.15 },
    { id: 'sudden_onset', label: 'Sudden onset (seconds to minutes)', question: 'Did the symptoms start suddenly, within seconds to minutes?', category: 'symptom', baseRate: 0.10 },
    { id: 'acute_onset', label: 'Recent onset (within 7 days)', question: 'Did the symptoms start within the last 7 days?', category: 'history', baseRate: 0.40 },
    { id: 'chronic_course', label: 'Symptoms for a month or more', question: 'Have the symptoms been present for a month or more?', category: 'history', baseRate: 0.30 },
    { id: 'progressive_course', label: 'Progressive / worsening over time', question: 'Have the symptoms been steadily progressing over weeks?', category: 'history', baseRate: 0.15 },
    { id: 'pain_worse_movement', label: 'Pain worse on movement / coughing', question: 'Is the pain worse on movement, coughing or going over bumps?', category: 'symptom', baseRate: 0.12 },
    { id: 'postprandial_pain', label: 'Pain after eating', question: 'Does the pain come on after eating?', category: 'symptom', baseRate: 0.06 },
    { id: 'worse_lying_flat', label: 'Worse lying flat', question: 'Are the symptoms worse lying flat?', category: 'symptom', baseRate: 0.05 },
    { id: 'worse_straining', label: 'Worse on straining / lifting', question: 'Are the symptoms worse on straining or lifting?', category: 'symptom', baseRate: 0.05 },
    { id: 'relief_sitting_forward', label: 'Relieved by sitting forward', question: 'Is the pain eased by sitting forward?', category: 'symptom', baseRate: 0.02 },
    // ── Upper GI ───────────────────────────────────────────────────────────
    { id: 'heartburn', label: 'Heartburn / acid regurgitation', question: 'Is there heartburn or acid coming up into the throat?', category: 'symptom', baseRate: 0.08 },
    { id: 'dysphagia', label: 'Dysphagia', question: 'Is there any difficulty swallowing?', category: 'symptom', baseRate: 0.02 },
    { id: 'haematemesis', label: 'Haematemesis', question: 'Has there been haematemesis or coffee-ground vomiting?', category: 'symptom', baseRate: 0.01 },
    { id: 'melaena', label: 'Melaena', question: 'Is there melaena (black tarry stool)?', category: 'symptom', baseRate: 0.01 },
    { id: 'bilious_vomiting', label: 'Bilious (green) vomiting', question: 'Is the vomit green (bile-stained)?', category: 'symptom', baseRate: 0.01 },
    // ── Systemic ───────────────────────────────────────────────────────────
    { id: 'fever', label: 'Fever', question: 'Does the patient have a documented or reported fever (>38°C)?', category: 'sign', baseRate: 0.08 },
    { id: 'rigors', label: 'Rigors / chills', question: 'Has the patient had rigors or shaking chills?', category: 'symptom', baseRate: 0.03 },
    { id: 'nausea_vomiting', label: 'Nausea / vomiting', question: 'Is there associated nausea or vomiting?', category: 'symptom', baseRate: 0.12 },
    { id: 'anorexia', label: 'Anorexia / loss of appetite', question: 'Has the patient lost their appetite since symptoms began?', category: 'symptom', baseRate: 0.08 },
    { id: 'weight_loss', label: 'Unintentional weight loss', question: 'Has there been unintentional weight loss in recent months?', category: 'symptom', baseRate: 0.05 },
    { id: 'change_bowel_habit', label: 'Change in bowel habit', question: 'Is there a recent change in bowel habit (frequency, consistency, or alternating constipation/diarrhoea)?', category: 'symptom', baseRate: 0.05 },
    { id: 'diarrhoea', label: 'Diarrhoea', question: 'Is there diarrhoea (loose stools, 3 or more a day)?', category: 'symptom', baseRate: 0.05 },
    { id: 'constipation', label: 'Constipation', question: 'Is the patient constipated?', category: 'symptom', baseRate: 0.06 },
    // ── Signs ──────────────────────────────────────────────────────────────
    { id: 'rebound_tenderness', label: 'Rebound tenderness', question: 'Is there rebound tenderness on examination?', category: 'sign', baseRate: 0.02 },
    { id: 'murphy_sign', label: "Murphy's sign", question: "Is Murphy's sign positive (RUQ tenderness with inspiratory arrest)?", category: 'sign', baseRate: 0.01 },
    { id: 'groin_swelling', label: 'Groin / abdominal wall swelling', question: 'Is there a visible or palpable swelling in the groin or abdominal wall?', category: 'sign', baseRate: 0.02 },
    { id: 'groin_pain', label: 'Groin pain', question: 'Is there pain in the groin?', category: 'symptom', baseRate: 0.02 },
    { id: 'jaundice', label: 'Jaundice', question: 'Is there clinical jaundice, yellow sclera, or dark urine?', category: 'sign', baseRate: 0.02 },
    { id: 'abdominal_mass', label: 'Abdominal mass', question: 'Is there a palpable abdominal mass?', category: 'sign', baseRate: 0.01 },
    // ── History ────────────────────────────────────────────────────────────
    { id: 'fatty_food_trigger', label: 'Fatty food trigger', question: 'Are symptoms triggered or worsened by fatty or greasy food?', category: 'history', baseRate: 0.03 },
    { id: 'nocturnal_pain', label: 'Nocturnal pain', question: 'Does pain wake the patient from sleep at night?', category: 'symptom', baseRate: 0.05 },
    { id: 'antacid_relief', label: 'Antacid relief', question: 'Does the pain improve with antacids?', category: 'history', baseRate: 0.04 },
    { id: 'nsaid_use', label: 'Regular NSAID use', question: 'Is the patient taking regular NSAIDs (ibuprofen, diclofenac, etc.)?', category: 'history', baseRate: 0.08 },
    { id: 'hernia_irreducible', label: 'Hernia irreducible', question: 'Is the swelling irreducible (cannot be pushed back)?', category: 'sign', baseRate: 0.01 },
    // ── Bowel obstruction ───────────────────────────────────────────────────
    { id: 'abdominal_distension', label: 'Abdominal distension', question: 'Is the abdomen visibly distended?', category: 'sign', baseRate: 0.05 },
    { id: 'absolute_constipation', label: 'Absolute constipation', question: 'Is there absolute constipation (no flatus or faeces)?', category: 'symptom', baseRate: 0.01 },
    { id: 'tinkling_bowel_sounds', label: 'High-pitched / tinkling bowel sounds', question: 'Are bowel sounds high-pitched or tinkling on auscultation?', category: 'sign', baseRate: 0.01 },
    { id: 'previous_surgery', label: 'Previous abdominal surgery', question: 'Has the patient had previous abdominal or pelvic surgery?', category: 'history', baseRate: 0.20 },
    { id: 'visible_peristalsis', label: 'Visible peristalsis', question: 'Is visible peristalsis present on inspection?', category: 'sign', baseRate: 0.005 },
    // ── Hernia extras ──────────────────────────────────────────────────────
    { id: 'groin_lump_reducible', label: 'Reducible groin lump', question: 'Is the groin lump reducible (disappears on lying down or gentle pressure)?', category: 'sign', baseRate: 0.01 },
    { id: 'cough_impulse', label: 'Cough impulse', question: 'Is there a cough impulse at the swelling?', category: 'sign', baseRate: 0.01 },
    // ── Investigations ─────────────────────────────────────────────────────
    { id: 'elevated_wbc', label: 'Elevated WBC', question: 'Is the white cell count elevated on FBC?', category: 'investigation', baseRate: 0.10 },
    { id: 'elevated_amylase', label: 'Elevated amylase / lipase', question: 'Is serum amylase or lipase elevated (>3× upper limit of normal)?', category: 'investigation', baseRate: 0.01 },
    { id: 'us_gallstones', label: 'USS showing gallstones', question: 'Has an ultrasound shown gallstones or thickened gallbladder wall?', category: 'investigation', baseRate: 0.05 },
    { id: 'anaemia', label: 'Anaemia (low haemoglobin)', question: 'Is the haemoglobin low (anaemia)?', category: 'investigation', baseRate: 0.08 },
    { id: 'positive_fit', label: 'Positive faecal immunochemical test (FIT)', question: 'Is the FIT positive (≥ 10 µg Hb/g)?', category: 'investigation', baseRate: 0.02 },
    // ── Colorectal ─────────────────────────────────────────────────────────
    { id: 'pr_bleeding', label: 'PR bleeding', question: 'Is there fresh rectal bleeding per rectum?', category: 'symptom', baseRate: 0.03 },
  ],
});
