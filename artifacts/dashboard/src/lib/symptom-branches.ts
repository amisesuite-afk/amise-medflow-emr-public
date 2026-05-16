export interface SymptomBranch {
  question: string;
  options: string[];
}

export const SYMPTOM_BRANCHES: Record<string, SymptomBranch[]> = {
  'abdominal pain': [
    { question: 'Location', options: ['RUQ', 'RLQ', 'LUQ', 'LLQ', 'Epigastric', 'Periumbilical', 'Diffuse', 'Suprapubic'] },
    { question: 'Character', options: ['Colicky', 'Constant', 'Sharp', 'Dull', 'Burning', 'Cramping'] },
    { question: 'Associated', options: ['Vomiting', 'Fever', 'Diarrhoea', 'Constipation', 'Anorexia', 'Radiation to back', 'Radiation to shoulder tip'] },
  ],
  'jaundice': [
    { question: 'Features', options: ['Fever', 'Rigors', 'Dark urine', 'Pale stool', 'Pruritus', 'Abdominal pain', 'Weight loss'] },
    { question: 'History', options: ['Previous episodes', 'Prior ERCP', 'Known gallstones', 'Alcohol use', 'Known liver disease', 'Recent travel'] },
  ],
  'dark urine': [
    { question: 'Associated', options: ['Jaundice', 'Pale stool', 'Abdominal pain', 'Fever', 'Joint pain'] },
  ],
  'pale stool': [
    { question: 'Associated', options: ['Jaundice', 'Dark urine', 'Pruritus', 'Abdominal pain', 'Weight loss'] },
  ],
  'vomiting': [
    { question: 'Content', options: ['Food', 'Bile', 'Blood', 'Coffee grounds', 'Faeculent'] },
    { question: 'Pattern', options: ['Projectile', 'After meals', 'Continuous', 'Associated with pain', 'Multiple episodes daily'] },
  ],
  'rectal bleeding': [
    { question: 'Appearance', options: ['Fresh red', 'Dark red', 'Mixed with stool', 'Separate from stool', 'Massive'] },
    { question: 'Associated', options: ['Pain', 'Diarrhoea', 'Constipation', 'Weight loss', 'Known haemorrhoids'] },
  ],
  'black stool': [
    { question: 'Features', options: ['Tarry / melaena', 'Sticky', 'With blood', 'New onset', 'Ongoing'] },
    { question: 'Risk factors', options: ['NSAIDs', 'Aspirin', 'Anticoagulant', 'Alcohol', 'Prior PUD'] },
  ],
  'dysphagia': [
    { question: 'Type', options: ['Solids only', 'Liquids too', 'Progressive', 'Intermittent', 'Painful (odynophagia)'] },
    { question: 'Associated', options: ['Weight loss', 'Regurgitation', 'Heartburn', 'Coughing on eating', 'Hoarse voice'] },
  ],
  'weight loss': [
    { question: 'Amount', options: ['< 5 kg', '5–10 kg', '> 10 kg', 'Unintentional'] },
    { question: 'Timeframe', options: ['< 1 month', '1–3 months', '3–6 months', '> 6 months'] },
    { question: 'Associated', options: ['Night sweats', 'Anorexia', 'Fatigue', 'Abdominal mass', 'Altered bowel habit'] },
  ],
  'breast lump': [
    { question: 'Side', options: ['Left', 'Right', 'Both'] },
    { question: 'Character', options: ['Hard', 'Soft', 'Mobile', 'Fixed', 'Tender', 'Non-tender'] },
    { question: 'Duration', options: ['< 2 weeks', '2–6 weeks', '> 6 weeks', 'Months', 'Years'] },
    { question: 'Associated', options: ['Skin change', 'Skin tethering', 'Nipple inversion', 'Nipple discharge', 'Axillary lump', 'Arm oedema'] },
    { question: 'Risk factors', options: ['Family history', 'Prior breast cancer', 'HRT / OCP', 'Never breastfed', 'BRCA known'] },
  ],
  'breast pain': [
    { question: 'Type', options: ['Cyclical', 'Non-cyclical', 'Localised', 'Diffuse'] },
    { question: 'Associated', options: ['Lump', 'Nipple discharge', 'Skin changes', 'Axillary pain'] },
  ],
  'nipple discharge': [
    { question: 'Character', options: ['Bloody', 'Clear', 'Milky', 'Green / purulent', 'Spontaneous', 'Only on squeezing'] },
    { question: 'Side', options: ['Left', 'Right', 'Both', 'Single duct'] },
  ],
  'hernia': [
    { question: 'Location', options: ['Right groin', 'Left groin', 'Umbilical', 'Incisional', 'Femoral', 'Epigastric'] },
    { question: 'Reducibility', options: ['Easily reducible', 'Reducible with effort', 'Irreducible', "Can't assess"] },
    { question: 'Associated', options: ['Pain', 'Tenderness', 'Hard', 'Vomiting', "Can't pass gas", "Can't pass stool", 'Redness'] },
  ],
  'wound discharge': [
    { question: 'Type', options: ['Clear serous', 'Sanguineous', 'Purulent', 'Foul-smelling', 'Brown / faeculent'] },
    { question: 'Wound status', options: ['Wound opened', 'Dehiscence', 'Redness', 'Swelling', 'Induration', 'Wound intact'] },
    { question: 'Systemic', options: ['Fever', 'Rigors', 'Tachycardia', 'Generally unwell'] },
  ],
  'fever after surgery': [
    { question: 'Timing', options: ['Day 0–1', 'Day 2–3', 'Day 4–5', 'Day 5+', '> 2 weeks post-op'] },
    { question: 'Source suspected', options: ['Wound', 'Chest', 'UTI', 'DVT / PE', 'Collection / abscess', 'Unknown'] },
  ],
  'shortness of breath': [
    { question: 'Onset', options: ['Sudden', 'Gradual', 'Worsening on exertion', 'At rest', 'Nocturnal'] },
    { question: 'Associated', options: ['Chest pain', 'Wheeze', 'Cough', 'Haemoptysis', 'Oedema', 'Fever', 'Palpitations'] },
  ],
  'chest pain': [
    { question: 'Character', options: ['Crushing / pressure', 'Sharp / stabbing', 'Burning', 'Tearing / ripping', 'Pleuritic'] },
    { question: 'Radiation', options: ['Left arm', 'Jaw', 'Back / interscapular', 'Right arm', 'Epigastric', 'None'] },
    { question: 'Associated', options: ['Shortness of breath', 'Sweating', 'Nausea', 'Palpitations', 'Syncope', 'Fever'] },
  ],
  'diabetic foot infection': [
    { question: 'Wound type', options: ['Ulcer', 'Abscess', 'Cellulitis', 'Gangrene', 'Osteomyelitis suspected'] },
    { question: 'Location', options: ['Toe / digit', 'Forefoot', 'Heel', 'Dorsum', 'Sole', 'Multiple areas'] },
    { question: 'Associated', options: ['Fever', 'Spreading redness', 'Loss of sensation', 'Foul odour', 'Exposed bone / tendon', 'Purulent discharge', 'Poor peripheral pulses'] },
  ],
};
