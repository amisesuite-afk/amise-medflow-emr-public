import { registerModule } from '../registry.js';

registerModule({
  specialty: 'general_surgery',
  system: 'abdominal',
  diseases: [
    {
      id: 'appendicitis', label: 'Acute Appendicitis', icd10: 'K35.80', prior: 0.08,
      features: { rlq_pain: 0.90, pain_migration: 0.50, fever: 0.67, anorexia: 0.68, nausea_vomiting: 0.75, rebound_tenderness: 0.63, elevated_wbc: 0.80 },
    },
    {
      id: 'cholecystitis', label: 'Acute Cholecystitis', icd10: 'K81.0', prior: 0.15,
      features: { ruq_pain: 0.85, fatty_food_trigger: 0.60, murphy_sign: 0.65, fever: 0.55, nausea_vomiting: 0.70, jaundice: 0.15, us_gallstones: 0.95, elevated_wbc: 0.70 },
    },
    {
      id: 'peptic_ulcer', label: 'Peptic Ulcer Disease', icd10: 'K27.9', prior: 0.10,
      features: { epigastric_pain: 0.80, nocturnal_pain: 0.55, antacid_relief: 0.60, nsaid_use: 0.45, nausea_vomiting: 0.50, haematemesis: 0.20, melaena: 0.15 },
    },
    {
      id: 'pancreatitis', label: 'Acute Pancreatitis', icd10: 'K85.9', prior: 0.05,
      features: { epigastric_pain: 0.80, radiation_to_back: 0.65, nausea_vomiting: 0.80, fever: 0.50, elevated_amylase: 0.90, elevated_wbc: 0.65 },
    },
    {
      id: 'cholangitis', label: 'Acute Cholangitis', icd10: 'K83.0', prior: 0.04,
      features: { ruq_pain: 0.75, fever: 0.90, jaundice: 0.70, rigors: 0.70, nausea_vomiting: 0.60, us_gallstones: 0.80, elevated_wbc: 0.85 },
    },
    {
      id: 'gord', label: 'GORD / Reflux Oesophagitis', icd10: 'K21.0', prior: 0.12,
      features: { heartburn: 0.85, epigastric_pain: 0.55, nocturnal_pain: 0.50, antacid_relief: 0.75, dysphagia: 0.25, nausea_vomiting: 0.40 },
    },
    {
      id: 'diverticulitis', label: 'Acute Diverticulitis', icd10: 'K57.30', prior: 0.06,
      features: { lif_pain: 0.80, fever: 0.65, change_bowel_habit: 0.55, nausea_vomiting: 0.40, elevated_wbc: 0.70, rebound_tenderness: 0.40 },
    },
    {
      id: 'inguinal_hernia', label: 'Inguinal / Femoral Hernia', icd10: 'K40.90', prior: 0.07,
      features: { groin_swelling: 0.90, colicky_pain: 0.40, nausea_vomiting: 0.35, hernia_irreducible: 0.45, rlq_pain: 0.30, groin_lump_reducible: 0.75, cough_impulse: 0.70 },
    },
    {
      id: 'colorectal_cancer', label: 'Colorectal Cancer', icd10: 'C18.9', prior: 0.03,
      features: { change_bowel_habit: 0.70, melaena: 0.35, weight_loss: 0.60, anorexia: 0.50, lif_pain: 0.30, elevated_wbc: 0.35, pr_bleeding: 0.55 },
    },
    {
      id: 'bowel_obstruction', label: 'Bowel Obstruction', icd10: 'K56.60', prior: 0.04,
      features: { colicky_pain: 0.80, abdominal_distension: 0.90, absolute_constipation: 0.85, nausea_vomiting: 0.85, tinkling_bowel_sounds: 0.70, previous_surgery: 0.55, visible_peristalsis: 0.45 },
    },
  ],
  features: [
    // ── Abdominal pain location ─────────────────────────────────────────────
    { id: 'rlq_pain', label: 'RLQ / right iliac fossa pain', question: 'Is the pain localised to the right lower quadrant / right iliac fossa?', category: 'symptom' },
    { id: 'ruq_pain', label: 'RUQ pain / biliary colic', question: 'Is there right upper quadrant pain or biliary colic?', category: 'symptom' },
    { id: 'epigastric_pain', label: 'Epigastric pain', question: 'Is the predominant pain in the epigastrium (upper central abdomen)?', category: 'symptom' },
    { id: 'lif_pain', label: 'LIF / left iliac fossa pain', question: 'Is the pain localised to the left lower quadrant / left iliac fossa?', category: 'symptom' },
    { id: 'radiation_to_back', label: 'Radiation to back', question: 'Does the pain radiate through to the back?', category: 'symptom' },
    // ── Pain character ──────────────────────────────────────────────────────
    { id: 'pain_migration', label: 'Pain migration (periumbilical → RIF)', question: 'Did the pain start centrally / around the navel and migrate to the right lower abdomen?', category: 'symptom' },
    { id: 'colicky_pain', label: 'Colicky / wave-like pain', question: 'Is the pain colicky or wave-like rather than constant?', category: 'symptom' },
    // ── Upper GI ───────────────────────────────────────────────────────────
    { id: 'heartburn', label: 'Heartburn / acid regurgitation', question: 'Is there heartburn or acid coming up into the throat?', category: 'symptom' },
    { id: 'dysphagia', label: 'Dysphagia', question: 'Is there any difficulty swallowing?', category: 'symptom' },
    { id: 'haematemesis', label: 'Haematemesis', question: 'Has there been haematemesis or coffee-ground vomiting?', category: 'symptom' },
    { id: 'melaena', label: 'Melaena', question: 'Is there melaena (black tarry stool)?', category: 'symptom' },
    // ── Systemic ───────────────────────────────────────────────────────────
    { id: 'fever', label: 'Fever', question: 'Does the patient have a documented or reported fever (>38°C)?', category: 'sign' },
    { id: 'rigors', label: 'Rigors / chills', question: 'Has the patient had rigors or shaking chills?', category: 'symptom' },
    { id: 'nausea_vomiting', label: 'Nausea / vomiting', question: 'Is there associated nausea or vomiting?', category: 'symptom' },
    { id: 'anorexia', label: 'Anorexia / loss of appetite', question: 'Has the patient lost their appetite since symptoms began?', category: 'symptom' },
    { id: 'weight_loss', label: 'Unintentional weight loss', question: 'Has there been unintentional weight loss in recent months?', category: 'symptom' },
    { id: 'change_bowel_habit', label: 'Change in bowel habit', question: 'Is there a recent change in bowel habit (frequency, consistency, or alternating constipation/diarrhoea)?', category: 'symptom' },
    // ── Signs ──────────────────────────────────────────────────────────────
    { id: 'rebound_tenderness', label: 'Rebound tenderness', question: 'Is there rebound tenderness on examination?', category: 'sign' },
    { id: 'murphy_sign', label: "Murphy's sign", question: "Is Murphy's sign positive (RUQ tenderness with inspiratory arrest)?", category: 'sign' },
    { id: 'groin_swelling', label: 'Groin / abdominal wall swelling', question: 'Is there a visible or palpable swelling in the groin or abdominal wall?', category: 'sign' },
    { id: 'jaundice', label: 'Jaundice', question: 'Is there clinical jaundice, yellow sclera, or dark urine?', category: 'sign' },
    // ── History ────────────────────────────────────────────────────────────
    { id: 'fatty_food_trigger', label: 'Fatty food trigger', question: 'Are symptoms triggered or worsened by fatty or greasy food?', category: 'history' },
    { id: 'nocturnal_pain', label: 'Nocturnal pain', question: 'Does pain wake the patient from sleep at night?', category: 'symptom' },
    { id: 'antacid_relief', label: 'Antacid relief', question: 'Does the pain improve with antacids?', category: 'history' },
    { id: 'nsaid_use', label: 'Regular NSAID use', question: 'Is the patient taking regular NSAIDs (ibuprofen, diclofenac, etc.)?', category: 'history' },
    { id: 'hernia_irreducible', label: 'Hernia irreducible', question: 'Is the swelling irreducible (cannot be pushed back)?', category: 'sign' },
    // ── New: bowel obstruction ──────────────────────────────────────────────
    { id: 'abdominal_distension', label: 'Abdominal distension', question: 'Is the abdomen visibly distended?', category: 'sign' },
    { id: 'absolute_constipation', label: 'Absolute constipation', question: 'Is there absolute constipation (no flatus or faeces)?', category: 'symptom' },
    { id: 'tinkling_bowel_sounds', label: 'High-pitched / tinkling bowel sounds', question: 'Are bowel sounds high-pitched or tinkling on auscultation?', category: 'sign' },
    { id: 'previous_surgery', label: 'Previous abdominal surgery', question: 'Has the patient had previous abdominal or pelvic surgery?', category: 'history' },
    { id: 'visible_peristalsis', label: 'Visible peristalsis', question: 'Is visible peristalsis present on inspection?', category: 'sign' },
    // ── Hernia extras ──────────────────────────────────────────────────────
    { id: 'groin_lump_reducible', label: 'Reducible groin lump', question: 'Is the groin lump reducible (disappears on lying down or gentle pressure)?', category: 'sign' },
    { id: 'cough_impulse', label: 'Cough impulse', question: 'Is there a cough impulse at the swelling?', category: 'sign' },
    // ── Investigations ─────────────────────────────────────────────────────
    { id: 'elevated_wbc', label: 'Elevated WBC', question: 'Is the white cell count elevated on FBC?', category: 'investigation' },
    { id: 'elevated_amylase', label: 'Elevated amylase / lipase', question: 'Is serum amylase or lipase elevated (>3× upper limit of normal)?', category: 'investigation' },
    { id: 'us_gallstones', label: 'USS showing gallstones', question: 'Has an ultrasound shown gallstones or thickened gallbladder wall?', category: 'investigation' },
    // ── Colorectal ─────────────────────────────────────────────────────────
    { id: 'pr_bleeding', label: 'PR bleeding', question: 'Is there fresh rectal bleeding per rectum?', category: 'symptom' },
  ],
});
