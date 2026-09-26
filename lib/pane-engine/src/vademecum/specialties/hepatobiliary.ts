import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Biliary colic added from
// NICE CG188 (2014) — gallstone disease: episodic RUQ/epigastric pain after meals, no fever or
// raised inflammatory markers. Painless jaundice + weight loss → malignant obstruction (NICE NG12).
registerModule({
  specialty: 'hepatobiliary',
  system: 'hepatopancreaticobiliary',
  diseases: [
    {
      id: 'biliary_colic', label: 'Biliary Colic / Symptomatic Cholelithiasis', icd10: 'K80.20', prior: T.frequent, course: 'subacute',
      features: { ruq_pain: 0.80, epigastric_pain: 0.45, episodic_pain: 0.80, postprandial_pain: 0.50, fatty_food_trigger: 0.45, nausea_vomiting: 0.55, us_gallstones: 0.95, shoulder_tip_pain: 0.20, radiation_to_back: 0.20, colicky_pain: 0.30, fever: 0.03, elevated_wbc: 0.05, murphy_sign: 0.10 },
    },
    {
      id: 'choledocholithiasis', label: 'Choledocholithiasis', icd10: 'K80.50', prior: T.uncommon, course: 'acute',
      // Coexists with acute cholecystitis in ≈ 10–20 % (ESGE 2019 / BSG 2017 CBD stones)
      features: { ruq_pain: 0.75, jaundice: 0.70, fever: 0.25, nausea_vomiting: 0.60, us_gallstones: 0.80, elevated_wbc: 0.35, colicky_pain: 0.50, dark_urine: 0.65, dilated_cbd: 0.70, murphy_sign: 0.20, postprandial_pain: 0.30, fatty_food_trigger: 0.30, shoulder_tip_pain: 0.15, episodic_pain: 0.50 },
    },
    {
      id: 'cholangiocarcinoma', label: 'Cholangiocarcinoma', icd10: 'C22.1', prior: T.rare, course: 'chronic',
      features: { jaundice: 0.90, weight_loss: 0.75, anorexia: 0.70, ruq_pain: 0.40, dark_urine: 0.80, pruritus: 0.65, fever: 0.15, painless_jaundice: 0.60, dilated_cbd: 0.60, progressive_course: 0.60 },
    },
    {
      id: 'pancreatic_carcinoma', label: 'Pancreatic Carcinoma', icd10: 'C25.9', prior: T.rare, course: 'chronic',
      // NICE NG12: ≥ 40 with jaundice; ≥ 60 with weight loss + new-onset diabetes / back pain / abdominal pain
      features: { epigastric_pain: 0.55, jaundice: 0.60, weight_loss: 0.85, anorexia: 0.75, radiation_to_back: 0.45, back_pain: 0.35, dark_urine: 0.55, steatorrhoea: 0.30, painless_jaundice: 0.40, new_onset_diabetes: 0.20, dilated_cbd: 0.50, pruritus: 0.40, progressive_course: 0.60 },
    },
    {
      // Evidence-exam 1.0.0 (exam-signs.json): target of the chronic-liver-disease stigmata. Udell JA
      // et al., JAMA 2012 (RCE "Does this patient with liver disease have cirrhosis?"); EASL 2018
      // decompensated cirrhosis; Baveno VII (2022). Values are approximations for sign-off.
      id: 'cirrhosis', label: 'Cirrhosis / Chronic Liver Disease (Decompensated)', icd10: 'K74.60', prior: T.uncommon, course: 'chronic',
      features: { known_liver_disease: 0.80, alcohol_use: 0.55, jaundice: 0.45, ascites: 0.50, abdominal_distension: 0.50, bilateral_leg_oedema: 0.35, spider_naevi: 0.45, fatigue: 0.55, anorexia: 0.40, weight_loss: 0.25, confusion: 0.15, thrombocytopenia: 0.60, pruritus: 0.20, dark_urine: 0.30, haematemesis: 0.05, melaena: 0.05, fever: 0.10, progressive_course: 0.40 },
    },
    {
      id: 'hepatocellular_carcinoma', label: 'Hepatocellular Carcinoma', icd10: 'C22.0', prior: T.rare, course: 'chronic',
      features: { ruq_pain: 0.55, weight_loss: 0.75, anorexia: 0.70, jaundice: 0.35, abdominal_distension: 0.50, fever: 0.20, known_liver_disease: 0.80, abdominal_mass: 0.30 },
    },
    {
      id: 'primary_sclerosing_cholangitis', label: 'Primary Sclerosing Cholangitis', icd10: 'K83.01', prior: T.veryRare, course: 'chronic',
      features: { jaundice: 0.75, pruritus: 0.80, fever: 0.30, ruq_pain: 0.45, fatigue: 0.70, weight_loss: 0.40 },
    },
    {
      id: 'liver_abscess', label: 'Liver Abscess', icd10: 'K75.0', prior: T.rare, course: 'acute',
      // Amoebic: often young men, recent dysentery (≈ 20–30 %), travel (WSES 2020 / IDSA amoebiasis)
      features: { ruq_pain: 0.85, abdominal_tenderness: 0.85, fever: 0.90, rigors: 0.55, nausea_vomiting: 0.45, anorexia: 0.55, elevated_wbc: 0.90, raised_crp: 0.95, jaundice: 0.15, weight_loss: 0.35, pleuritic_chest_pain: 0.25, shoulder_tip_pain: 0.20, pain_worse_movement: 0.40, diarrhoea: 0.20, known_diabetes: 0.30, tachycardia: 0.55 },
    },
    {
      id: 'acute_hepatitis', label: 'Acute Hepatitis', icd10: 'B17.9', prior: T.uncommon, course: 'acute',
      features: { jaundice: 0.85, ruq_pain: 0.55, nausea_vomiting: 0.70, fever: 0.50, anorexia: 0.75, dark_urine: 0.80, fatigue: 0.80, myalgia: 0.40 },
    },
    {
      id: 'gallbladder_carcinoma', label: 'Gallbladder Carcinoma', icd10: 'C23', prior: T.veryRare, course: 'chronic',
      features: { ruq_pain: 0.70, jaundice: 0.45, weight_loss: 0.70, nausea_vomiting: 0.40, anorexia: 0.65, us_gallstones: 0.60 },
    },
    {
      id: 'sphincter_oddi_dysfunction', label: 'Sphincter of Oddi Dysfunction', icd10: 'K83.4', prior: T.veryRare, course: 'chronic',
      features: { epigastric_pain: 0.70, ruq_pain: 0.65, nausea_vomiting: 0.55, fatty_food_trigger: 0.50, elevated_amylase: 0.30, previous_surgery: 0.80, episodic_pain: 0.70 },
    },
    {
      id: 'biliary_stricture', label: 'Biliary Stricture', icd10: 'K83.1', prior: T.rare, course: 'chronic',
      features: { jaundice: 0.85, ruq_pain: 0.40, dark_urine: 0.80, pruritus: 0.60, previous_surgery: 0.55, weight_loss: 0.30, dilated_cbd: 0.70 },
    },
  ],
  features: [
    { id: 'dark_urine', label: 'Dark urine / pale stools', question: 'Is the urine dark (tea-coloured) or has pale stools been noted?', category: 'symptom', baseRate: 0.02 },
    { id: 'pruritus', label: 'Pruritus / generalised itch', question: 'Is there generalised pruritus (itching) without a skin rash?', category: 'symptom', baseRate: 0.03 },
    { id: 'steatorrhoea', label: 'Steatorrhoea / pale greasy stools', question: 'Are stools pale, greasy, or difficult to flush (steatorrhoea)?', category: 'symptom', baseRate: 0.01 },
    { id: 'fatigue', label: 'Significant fatigue', question: 'Is the patient experiencing significant fatigue or malaise?', category: 'symptom', baseRate: 0.12 },
    { id: 'painless_jaundice', label: 'Painless jaundice', question: 'Is the jaundice painless?', category: 'symptom', baseRate: 0.005 },
    { id: 'dilated_cbd', label: 'Dilated common bile duct on imaging', question: 'Does imaging show a dilated common bile duct?', category: 'investigation', baseRate: 0.01 },
    { id: 'known_liver_disease', label: 'Known cirrhosis / chronic liver disease', question: 'Is there known cirrhosis or chronic liver disease?', category: 'history', baseRate: 0.03 },
    { id: 'new_onset_diabetes', label: 'New-onset diabetes', question: 'Has diabetes been diagnosed in the last year?', category: 'history', baseRate: 0.01 },
  ],
});
