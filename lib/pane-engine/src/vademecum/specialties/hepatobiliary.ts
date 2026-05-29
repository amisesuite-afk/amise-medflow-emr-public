import { registerModule } from '../registry.js';

registerModule({
  specialty: 'hepatobiliary',
  system: 'hepatopancreaticobiliary',
  diseases: [
    {
      id: 'choledocholithiasis', label: 'Choledocholithiasis', icd10: 'K80.50', prior: 0.05,
      features: { ruq_pain: 0.75, jaundice: 0.70, fever: 0.35, nausea_vomiting: 0.60, us_gallstones: 0.80, elevated_wbc: 0.40, colicky_pain: 0.60, dark_urine: 0.65 },
    },
    {
      id: 'cholangiocarcinoma', label: 'Cholangiocarcinoma', icd10: 'C22.1', prior: 0.01,
      features: { jaundice: 0.90, weight_loss: 0.75, anorexia: 0.70, ruq_pain: 0.50, dark_urine: 0.80, pruritus: 0.65, fever: 0.20 },
    },
    {
      id: 'pancreatic_carcinoma', label: 'Pancreatic Carcinoma', icd10: 'C25.9', prior: 0.01,
      features: { epigastric_pain: 0.65, jaundice: 0.70, weight_loss: 0.85, anorexia: 0.80, radiation_to_back: 0.55, dark_urine: 0.65, steatorrhoea: 0.40 },
    },
    {
      id: 'hepatocellular_carcinoma', label: 'Hepatocellular Carcinoma', icd10: 'C22.0', prior: 0.01,
      features: { ruq_pain: 0.60, weight_loss: 0.80, anorexia: 0.75, jaundice: 0.40, abdominal_distension: 0.50, fever: 0.30 },
    },
    {
      id: 'primary_sclerosing_cholangitis', label: 'Primary Sclerosing Cholangitis', icd10: 'K83.01', prior: 0.01,
      features: { jaundice: 0.75, pruritus: 0.80, fever: 0.40, ruq_pain: 0.45, fatigue: 0.70, weight_loss: 0.40 },
    },
    {
      id: 'liver_abscess', label: 'Liver Abscess', icd10: 'K75.0', prior: 0.02,
      features: { ruq_pain: 0.85, fever: 0.95, rigors: 0.65, nausea_vomiting: 0.60, elevated_wbc: 0.95, jaundice: 0.25, weight_loss: 0.40 },
    },
    {
      id: 'acute_hepatitis', label: 'Acute Hepatitis', icd10: 'B17.9', prior: 0.02,
      features: { jaundice: 0.85, ruq_pain: 0.55, nausea_vomiting: 0.70, fever: 0.50, anorexia: 0.75, dark_urine: 0.80, fatigue: 0.80 },
    },
    {
      id: 'gallbladder_carcinoma', label: 'Gallbladder Carcinoma', icd10: 'C23', prior: 0.005,
      features: { ruq_pain: 0.75, jaundice: 0.45, weight_loss: 0.70, nausea_vomiting: 0.50, anorexia: 0.65, us_gallstones: 0.60 },
    },
    {
      id: 'sphincter_oddi_dysfunction', label: 'Sphincter of Oddi Dysfunction', icd10: 'K83.4', prior: 0.01,
      features: { epigastric_pain: 0.70, ruq_pain: 0.65, nausea_vomiting: 0.55, fatty_food_trigger: 0.60, elevated_amylase: 0.40 },
    },
    {
      id: 'biliary_stricture', label: 'Biliary Stricture', icd10: 'K83.1', prior: 0.01,
      features: { jaundice: 0.85, ruq_pain: 0.50, dark_urine: 0.80, pruritus: 0.60, previous_surgery: 0.55, weight_loss: 0.35 },
    },
  ],
  features: [
    { id: 'dark_urine', label: 'Dark urine / tea-coloured', question: 'Is the urine dark (tea-coloured) or has pale stools been noted?', category: 'symptom' },
    { id: 'pruritus', label: 'Pruritus / generalised itch', question: 'Is there generalised pruritus (itching) without a skin rash?', category: 'symptom' },
    { id: 'steatorrhoea', label: 'Steatorrhoea / pale greasy stools', question: 'Are stools pale, greasy, or difficult to flush (steatorrhoea)?', category: 'symptom' },
    { id: 'fatigue', label: 'Significant fatigue', question: 'Is the patient experiencing significant fatigue or malaise?', category: 'symptom' },
  ],
});
