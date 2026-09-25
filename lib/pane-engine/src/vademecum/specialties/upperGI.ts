import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Sources: NICE NG12 (2015,
// 2021) — dysphagia at any age, or ≥ 55 with weight loss and upper abdominal pain / reflux /
// dyspepsia → urgent OGD; BSG 2019 (Barrett's); ESGE 2021 / NICE CG141 (2012) upper GI bleeding
// (haematemesis, melaena, shock); Baveno VII (2022) variceal bleeding (cirrhosis, alcohol);
// ESGE 2016 foreign body / food bolus (acute complete dysphagia, drooling, retrosternal
// discomfort; EoE in young atopic men); WSES 2019 Boerhaave (vomiting → chest pain, subcutaneous
// emphysema — Mackler's triad); WSES 2020 perforated peptic ulcer (sudden severe epigastric →
// generalised pain, rigidity, NSAIDs/steroids, free gas).
registerModule({
  specialty: 'upper_gi',
  system: 'upper_gastrointestinal',
  diseases: [
    {
      id: 'barretts_oesophagus', label: "Barrett's Oesophagus", icd10: 'K22.70', prior: T.uncommon, course: 'chronic',
      features: { heartburn: 0.80, regurgitation: 0.60, dysphagia_progressive: 0.10, chest_pain_oesophageal: 0.30 },
    },
    {
      id: 'oesophageal_carcinoma', label: 'Oesophageal Carcinoma', icd10: 'C15.9', prior: T.rare, course: 'chronic',
      features: { dysphagia: 0.95, dysphagia_progressive: 0.85, dysphagia_solids: 0.70, weight_loss: 0.80, odynophagia: 0.30, regurgitation: 0.40, anorexia: 0.60, haematemesis: 0.10, hoarseness: 0.10, anaemia: 0.30, progressive_course: 0.80 },
    },
    {
      id: 'gastric_carcinoma', label: 'Gastric Carcinoma', icd10: 'C16.9', prior: T.rare, course: 'chronic',
      features: { weight_loss: 0.80, epigastric_pain: 0.65, anorexia: 0.70, early_satiety: 0.50, nausea_vomiting: 0.45, haematemesis: 0.10, melaena: 0.20, dysphagia: 0.20, anaemia: 0.45, fatigue: 0.40, progressive_course: 0.60, abdominal_mass: 0.10 },
    },
    {
      id: 'hiatus_hernia', label: 'Hiatus Hernia', icd10: 'K44.9', prior: T.frequent, course: 'chronic',
      features: { heartburn: 0.80, regurgitation: 0.70, chest_pain_oesophageal: 0.35, worse_lying_flat: 0.40, nausea_vomiting: 0.20, dysphagia: 0.15, postprandial_pain: 0.30 },
    },
    {
      id: 'achalasia', label: 'Achalasia', icd10: 'K22.0', prior: T.veryRare, course: 'chronic',
      features: { dysphagia: 0.98, dysphagia_liquids: 0.70, dysphagia_progressive: 0.60, regurgitation: 0.80, chest_pain_oesophageal: 0.40, weight_loss: 0.50, aspiration_symptoms: 0.35 },
    },
    {
      id: 'oesophageal_perforation', label: 'Oesophageal Perforation (Boerhaave)', icd10: 'K22.3', prior: T.veryRare, course: 'acute',
      features: { chest_pain_oesophageal: 0.85, chest_pain: 0.85, severe_vomiting_before_pain: 0.75, nausea_vomiting: 0.80, dyspnoea: 0.50, epigastric_pain: 0.40, fever: 0.40, tachycardia: 0.70, tachypnoea: 0.50, subcutaneous_emphysema: 0.30, crepitus_soft_tissue: 0.20, odynophagia: 0.35, pleuritic_chest_pain: 0.30, diaphoresis: 0.35, back_pain: 0.30, sudden_onset: 0.60, severe_pain: 0.70, alcohol_use: 0.40, hypotension: 0.25, radiation_to_back: 0.35, elevated_wbc: 0.60 },
    },
    {
      id: 'mallory_weiss', label: 'Mallory-Weiss Tear', icd10: 'K22.6', prior: T.rare, course: 'acute',
      features: { haematemesis: 0.90, nausea_vomiting: 0.90, severe_vomiting_before_pain: 0.60, epigastric_pain: 0.30, alcohol_use: 0.50, melaena: 0.05 },
    },
    {
      id: 'gastritis', label: 'Acute / Chronic Gastritis', icd10: 'K29.70', prior: T.common, course: 'subacute',
      features: { epigastric_pain: 0.80, nausea_vomiting: 0.55, heartburn: 0.40, haematemesis: 0.05, melaena: 0.03, nsaid_use: 0.35, alcohol_use: 0.25, postprandial_pain: 0.30 },
    },
    {
      id: 'upper_gi_bleed', label: 'Upper GI Haemorrhage (Peptic Ulcer / Non-variceal)', icd10: 'K92.2', prior: T.uncommon, course: 'acute',
      // ESGE 2021: haematemesis and/or melaena; NSAID, antiplatelet, anticoagulant use
      features: { pr_bleeding: 0.10, pallor: 0.40, haematemesis: 0.70, melaena: 0.75, epigastric_pain: 0.40, nausea_vomiting: 0.50, nsaid_use: 0.35, anticoagulant_use: 0.25, antiplatelet_use: 0.30, alcohol_use: 0.20, tachycardia: 0.45, hypotension: 0.20, syncope: 0.15, anaemia: 0.60, raised_urea: 0.60, dizziness: 0.30 },
    },
    {
      id: 'variceal_bleed', label: 'Oesophageal Variceal Haemorrhage (Portal Hypertension)', icd10: 'I85.11', prior: T.rare, course: 'acute',
      features: { pallor: 0.40, haematemesis: 0.90, melaena: 0.55, known_liver_disease: 0.80, alcohol_use: 0.65, jaundice: 0.35, ascites: 0.50, tachycardia: 0.60, hypotension: 0.35, confusion: 0.15, anaemia: 0.60, thrombocytopenia: 0.55, spider_naevi: 0.35 },
    },
    {
      id: 'perforated_peptic_ulcer', label: 'Perforated Peptic Ulcer / Perforated Viscus', icd10: 'K27.5', prior: T.rare, course: 'acute',
      features: { epigastric_pain: 0.70, diffuse_abdominal_pain: 0.70, sudden_onset: 0.85, guarding: 0.85, rebound_tenderness: 0.60, abdominal_tenderness: 0.95, pain_worse_movement: 0.80, free_gas: 0.75, nsaid_use: 0.40, steroid_use: 0.15, nausea_vomiting: 0.50, tachycardia: 0.65, fever: 0.35, hypotension: 0.25, shoulder_tip_pain: 0.25, elevated_wbc: 0.70 },
    },
    {
      id: 'food_bolus', label: 'Oesophageal Food Bolus Obstruction', icd10: 'T18.128A', prior: T.rare, course: 'acute',
      features: { dysphagia: 0.98, complete_dysphagia: 0.85, drooling: 0.60, chest_pain_oesophageal: 0.50, regurgitation: 0.60, sudden_onset: 0.80, recurrent_bolus: 0.40, atopy: 0.30 },
    },
    {
      id: 'gastric_outlet_obstruction', label: 'Gastric Outlet Obstruction', icd10: 'K31.1', prior: T.rare, course: 'subacute',
      features: { vomiting_effortless: 0.85, nausea_vomiting: 0.95, undigested_food_vomit: 0.70, early_satiety: 0.60, epigastric_pain: 0.55, weight_loss: 0.65, anorexia: 0.55, abdominal_distension: 0.35, succussion_splash: 0.40 },
    },
    {
      id: 'oesophageal_stricture', label: 'Oesophageal Stricture (Benign)', icd10: 'K22.2', prior: T.rare, course: 'chronic',
      features: { dysphagia: 0.95, dysphagia_progressive: 0.70, dysphagia_solids: 0.70, odynophagia: 0.30, heartburn: 0.60, regurgitation: 0.45, weight_loss: 0.20 },
    },
    {
      id: 'dumping_syndrome', label: 'Dumping Syndrome (Post-gastrectomy)', icd10: 'K91.1', prior: T.veryRare, course: 'chronic',
      features: { nausea_vomiting: 0.60, postprandial_pain: 0.60, diaphoresis: 0.40, palpitations: 0.40, diarrhoea: 0.40, previous_surgery: 0.98 },
    },
  ],
  features: [
    { id: 'upper_gi_bleeding', label: 'Upper GI bleeding (haematemesis or melaena)', question: 'Is there haematemesis or melaena?', category: 'symptom', baseRate: 0.015 },
    { id: 'dysphagia_progressive', label: 'Progressive dysphagia', question: 'Is there progressive difficulty swallowing (solids first, then liquids)?', category: 'symptom', baseRate: 0.005 },
    { id: 'dysphagia_liquids', label: 'Dysphagia to liquids as well as solids', question: 'Is there difficulty swallowing liquids as well as solids from the start?', category: 'symptom', baseRate: 0.003 },
    { id: 'complete_dysphagia', label: 'Complete dysphagia (cannot swallow saliva)', question: 'Is the patient unable to swallow anything, including saliva?', category: 'symptom', baseRate: 0.001 },
    { id: 'drooling', label: 'Drooling / spitting saliva', question: 'Is the patient drooling or spitting out saliva?', category: 'sign', baseRate: 0.002 },
    { id: 'recurrent_bolus', label: 'Previous food bolus episodes', question: 'Has food stuck before?', category: 'history', baseRate: 0.003 },
    { id: 'atopy', label: 'Atopy (asthma, eczema, hay fever)', question: 'Does the patient have asthma, eczema or hay fever?', category: 'history', baseRate: 0.15 },
    { id: 'odynophagia', label: 'Odynophagia (painful swallowing)', question: 'Is there pain on swallowing?', category: 'symptom', baseRate: 0.01 },
    { id: 'regurgitation', label: 'Regurgitation of food / fluid', question: 'Is there effortless regurgitation of food or fluid (not acid reflux)?', category: 'symptom', baseRate: 0.03 },
    { id: 'chest_pain_oesophageal', label: 'Retrosternal / oesophageal chest pain', question: 'Is there retrosternal or mid-chest pain, non-cardiac in character?', category: 'symptom', baseRate: 0.01 },
    { id: 'vomiting_effortless', label: 'Effortless / projectile vomiting', question: 'Is there effortless or projectile vomiting of food or bile?', category: 'symptom', baseRate: 0.01 },
    { id: 'undigested_food_vomit', label: 'Vomiting undigested food eaten hours earlier', question: 'Does the vomit contain undigested food eaten hours or days earlier?', category: 'symptom', baseRate: 0.003 },
    { id: 'succussion_splash', label: 'Succussion splash', question: 'Is there a succussion splash?', category: 'sign', baseRate: 0.002 },
    { id: 'severe_vomiting_before_pain', label: 'Forceful vomiting / retching before the pain or bleed', question: 'Did forceful vomiting or retching come before the pain or bleeding?', category: 'history', baseRate: 0.01 },
    { id: 'aspiration_symptoms', label: 'Aspiration / nocturnal cough', question: 'Is there nocturnal cough, choking, or recurrent aspiration pneumonia?', category: 'symptom', baseRate: 0.01 },
    { id: 'subcutaneous_emphysema', label: 'Subcutaneous emphysema (neck / chest)', question: 'Is there crepitus or subcutaneous emphysema in the neck or chest wall?', category: 'sign', baseRate: 0.002 },
    { id: 'free_gas', label: 'Free gas / pneumoperitoneum on imaging', question: 'Does imaging show free intraperitoneal gas?', category: 'investigation', baseRate: 0.003 },
    { id: 'alcohol_use', label: 'Significant alcohol use', question: 'Is there a history of significant alcohol use?', category: 'history', baseRate: 0.10 },
    { id: 'ascites', label: 'Ascites', question: 'Is there ascites (shifting dullness, fluid thrill)?', category: 'sign', baseRate: 0.01 },
    { id: 'spider_naevi', label: 'Stigmata of chronic liver disease', question: 'Are there spider naevi, palmar erythema or other stigmata of chronic liver disease?', category: 'sign', baseRate: 0.01 },
    { id: 'thrombocytopenia', label: 'Low platelet count', question: 'Is the platelet count low?', category: 'investigation', baseRate: 0.03 },
    { id: 'raised_urea', label: 'Raised urea', question: 'Is the urea raised?', category: 'investigation', baseRate: 0.08 },
    { id: 'antiplatelet_use', label: 'Antiplatelet use (aspirin, clopidogrel, ticagrelor)', question: 'Is the patient taking aspirin or another antiplatelet?', category: 'history', baseRate: 0.10 },
    { id: 'anticoagulant_use', label: 'Anticoagulant use (warfarin, DOAC)', question: 'Is the patient taking warfarin or a DOAC?', category: 'history', baseRate: 0.05 },
    { id: 'steroid_use', label: 'Systemic corticosteroid use', question: 'Is the patient taking oral or IV corticosteroids?', category: 'history', baseRate: 0.03 },
  ],
});
