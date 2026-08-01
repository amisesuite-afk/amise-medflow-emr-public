import { registerModule } from '../registry.js';

registerModule({
  specialty: 'upper_gi',
  system: 'upper_gastrointestinal',
  diseases: [
    {
      id: 'barretts_oesophagus', label: "Barrett's Oesophagus", icd10: 'K22.70', prior: 0.02,
      features: { heartburn: 0.80, regurgitation: 0.70, dysphagia_progressive: 0.30, weight_loss: 0.15, chest_pain_oesophageal: 0.40 },
    },
    {
      id: 'oesophageal_carcinoma', label: 'Oesophageal Carcinoma', icd10: 'C15.9', prior: 0.01,
      features: { dysphagia_progressive: 0.95, weight_loss: 0.85, odynophagia: 0.65, regurgitation: 0.55, anorexia: 0.70, haematemesis: 0.25 },
    },
    {
      id: 'gastric_carcinoma', label: 'Gastric Carcinoma', icd10: 'C16.9', prior: 0.01,
      features: { weight_loss: 0.80, epigastric_pain: 0.70, anorexia: 0.75, nausea_vomiting: 0.65, haematemesis: 0.30, melaena: 0.35, dysphagia_progressive: 0.25 },
    },
    {
      id: 'hiatus_hernia', label: 'Hiatus Hernia', icd10: 'K44.9', prior: 0.05,
      features: { heartburn: 0.85, regurgitation: 0.80, chest_pain_oesophageal: 0.55, nausea_vomiting: 0.40, dysphagia_progressive: 0.25 },
    },
    {
      id: 'achalasia', label: 'Achalasia', icd10: 'K22.0', prior: 0.01,
      features: { dysphagia_progressive: 0.90, regurgitation: 0.85, chest_pain_oesophageal: 0.60, weight_loss: 0.55, aspiration_symptoms: 0.45 },
    },
    {
      id: 'oesophageal_perforation', label: 'Oesophageal Perforation (Boerhaave)', icd10: 'K22.3', prior: 0.003,
      features: { chest_pain_oesophageal: 0.90, vomiting_effortless: 0.80, dyspnoea_pe: 0.65, fever: 0.60, subcutaneous_emphysema: 0.55 },
    },
    {
      id: 'mallory_weiss', label: 'Mallory-Weiss Tear', icd10: 'K22.6', prior: 0.02,
      features: { haematemesis: 0.90, nausea_vomiting: 0.85, vomiting_effortless: 0.70, epigastric_pain: 0.40, alcohol_use: 0.55 },
    },
    {
      id: 'gastritis', label: 'Acute / Chronic Gastritis', icd10: 'K29.70', prior: 0.05,
      features: { epigastric_pain: 0.80, nausea_vomiting: 0.70, heartburn: 0.60, haematemesis: 0.20, melaena: 0.15, nsaid_use: 0.45 },
    },
    {
      id: 'upper_gi_bleed', label: 'Upper GI Haemorrhage', icd10: 'K92.2', prior: 0.03,
      features: { haematemesis: 0.85, melaena: 0.75, epigastric_pain: 0.50, nausea_vomiting: 0.55, nsaid_use: 0.40, alcohol_use: 0.35 },
    },
    {
      id: 'gastric_outlet_obstruction', label: 'Gastric Outlet Obstruction', icd10: 'K31.1', prior: 0.01,
      features: { vomiting_effortless: 0.90, epigastric_pain: 0.70, weight_loss: 0.65, anorexia: 0.60, nausea_vomiting: 0.75 },
    },
    {
      id: 'oesophageal_stricture', label: 'Oesophageal Stricture (Benign)', icd10: 'K22.2', prior: 0.02,
      features: { dysphagia_progressive: 0.85, odynophagia: 0.45, heartburn: 0.65, regurgitation: 0.55, weight_loss: 0.30 },
    },
    {
      id: 'dumping_syndrome', label: 'Dumping Syndrome (Post-gastrectomy)', icd10: 'K91.1', prior: 0.01,
      features: { nausea_vomiting: 0.70, epigastric_pain: 0.60, weight_loss: 0.55, previous_surgery: 0.95 },
    },
  ],
  features: [
    { id: 'dysphagia_progressive', label: 'Progressive dysphagia', question: 'Is there progressive difficulty swallowing (solids first, then liquids)?', category: 'symptom' },
    { id: 'odynophagia', label: 'Odynophagia (painful swallowing)', question: 'Is there pain on swallowing?', category: 'symptom' },
    { id: 'regurgitation', label: 'Regurgitation of food / fluid', question: 'Is there effortless regurgitation of food or fluid (not acid reflux)?', category: 'symptom' },
    { id: 'chest_pain_oesophageal', label: 'Retrosternal / oesophageal chest pain', question: 'Is there retrosternal or mid-chest pain, non-cardiac in character?', category: 'symptom' },
    { id: 'vomiting_effortless', label: 'Effortless / projectile vomiting', question: 'Is there effortless or projectile vomiting of food or bile?', category: 'symptom' },
    { id: 'aspiration_symptoms', label: 'Aspiration / nocturnal cough', question: 'Is there nocturnal cough, choking, or recurrent aspiration pneumonia?', category: 'symptom' },
    { id: 'subcutaneous_emphysema', label: 'Subcutaneous emphysema (neck / chest)', question: 'Is there crepitus or subcutaneous emphysema in the neck or chest wall?', category: 'sign' },
    { id: 'alcohol_use', label: 'Significant alcohol use', question: 'Is there a history of significant alcohol use?', category: 'history' },
  ],
});
