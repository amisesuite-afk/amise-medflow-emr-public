export interface SymptomBranch {
  question: string;
  options: string[];
}

export const SYMPTOM_BRANCHES: Record<string, SymptomBranch[]> = {
  'abdominal pain': [
    { question: 'Location', options: ['RUQ', 'RLQ', 'LUQ', 'LLQ', 'Epigastric', 'Periumbilical', 'Diffuse', 'Suprapubic'] },
    { question: 'Onset / duration', options: ['Sudden', 'Gradual', '< 6 hours', '6–24 hours', '1–3 days', '> 3 days', 'Episodic'] },
    { question: 'Character', options: ['Colicky', 'Constant', 'Sharp', 'Dull', 'Burning', 'Cramping'] },
    { question: 'Radiation', options: ['Back', 'Shoulder tip', 'Groin', 'Loin', 'Chest', 'No radiation'] },
    { question: 'Severity', options: ['Mild (1–3)', 'Moderate (4–6)', 'Severe (7–9)', 'Worst ever (10)'] },
    { question: 'Associated', options: ['Nausea', 'Vomiting', 'Fever', 'Diarrhoea', 'Constipation', 'Anorexia', 'PR bleeding', 'Distension', 'Jaundice', 'Rigors'] },
    { question: 'Timing', options: ['Continuous', 'Intermittent / colicky', 'Post-meal', 'Nocturnal', 'Worsening over time', 'Improving'] },
    { question: 'Triggers', options: ['Movement', 'Eating / drinking', 'Deep breathing', 'Coughing', 'Lying flat', 'Fatty meal'] },
    { question: 'Relief', options: ['Analgesia', 'Rest', 'Nil by mouth', 'Antacids', 'Fetal position', 'Leaning forward', 'Vomiting', 'Nothing helps'] },
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
  'nausea': [
    { question: 'Severity', options: ['Mild', 'Moderate', 'Severe — unable to eat', 'Constant'] },
    { question: 'Associated', options: ['Vomiting', 'Abdominal pain', 'Fever', 'Diarrhoea', 'Headache', 'Dizziness', 'Weight loss'] },
    { question: 'Timing', options: ['Post-meal', 'Morning (pregnancy?)', 'Continuous', 'Episodic', 'Related to medications', 'After movement'] },
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
  'headache': [
    { question: 'Location', options: ['Frontal', 'Temporal (L)', 'Temporal (R)', 'Occipital', 'Vertex', 'Hemicranial', 'Generalised'] },
    { question: 'Character', options: ['Throbbing / pulsating', 'Pressure / band-like', 'Stabbing / lancinating', 'Dull ache', 'Thunderclap (sudden worst-ever)'] },
    { question: 'Associated', options: ['Nausea / vomiting', 'Photophobia', 'Phonophobia', 'Visual aura', 'Neck stiffness', 'Fever', 'Worsened by movement', 'Facial pain', 'Watering eye'] },
    { question: 'Pattern', options: ['First / worst ever', 'Recurrent episodes', 'Constant', 'Progressive worsening', 'Morning headache', 'Wakes from sleep', 'Worsened by lying flat'] },
  ],
  'dizziness': [
    { question: 'Type', options: ['True vertigo (room spinning)', 'Lightheadedness / pre-syncope', 'Disequilibrium', 'Presyncope on standing'] },
    { question: 'Trigger', options: ['Positional (BPPV?)', 'Spontaneous', 'On standing', 'With head movement', 'Continuous'] },
    { question: 'Associated', options: ['Hearing loss', 'Tinnitus', 'Nausea / vomiting', 'Palpitations', 'Unsteady gait', 'Ear fullness', 'Facial numbness'] },
  ],
  'back pain': [
    { question: 'Location', options: ['Cervical (neck)', 'Thoracic (upper back)', 'Lumbar (lower back)', 'Sacral', 'Coccygeal'] },
    { question: 'Radiation', options: ['Down leg (sciatica)', 'To groin', 'To arm / shoulder', 'Bilateral legs', 'No radiation'] },
    { question: 'Red flags', options: ['Bladder / bowel dysfunction', 'Saddle anaesthesia', 'Progressive weakness', 'Night pain', 'Known malignancy', 'IV drug use', 'Fever'] },
    { question: 'Character', options: ['Mechanical (better with rest)', 'Inflammatory (worse at rest)', 'Colicky', 'Constant', 'Sharp', 'Dull ache'] },
  ],
  'lower back pain': [
    { question: 'Radiation', options: ['Down leg (sciatica)', 'To groin / testicle', 'Bilateral', 'No radiation'] },
    { question: 'Red flags', options: ['Bladder / bowel dysfunction', 'Saddle anaesthesia', 'Progressive weakness', 'Night sweats', 'Weight loss', 'Known cancer'] },
    { question: 'Character', options: ['Mechanical (better with rest)', 'Constant', 'Colicky (renal colic?)', 'Worse at night'] },
  ],
  'joint pain': [
    { question: 'Which joint', options: ['Knee', 'Hip', 'Shoulder', 'Ankle', 'Wrist', 'Elbow', 'Small hand joints', 'Multiple joints'] },
    { question: 'Characteristics', options: ['Swollen', 'Hot / erythematous', 'Morning stiffness > 1 hr', 'Worse with activity', 'Locked', 'Giving way', 'Bilateral / symmetrical'] },
    { question: 'Associated', options: ['Fever', 'Rash', 'Eye involvement', 'Bowel symptoms', 'Skin psoriasis', 'Recent infection', 'Trauma'] },
  ],
  'rash': [
    { question: 'Distribution', options: ['Face', 'Trunk', 'Limbs', 'Generalised', 'Flexural', 'Sun-exposed areas', 'Palms and soles', 'Dermatomal (unilateral strip)'] },
    { question: 'Character', options: ['Maculopapular', 'Vesicular / blistering', 'Urticarial (wheals)', 'Purpuric (non-blanching)', 'Scaly / plaque', 'Erosions / ulcers'] },
    { question: 'Associated', options: ['Pruritus', 'Fever', 'Joint pain', 'Recent medication', 'Recent illness', 'Contact exposure'] },
  ],
  'syncope': [
    { question: 'Setting', options: ['Prolonged standing', 'On exertion', 'Sudden emotional trigger', 'On standing from lying', 'During micturition / defaecation', 'No identifiable trigger'] },
    { question: 'Features', options: ['Warning (sweating / nausea)', 'No warning', 'Witnessed convulsions', 'Tongue bite', 'Incontinence', 'Rapid recovery', 'Prolonged confusion after'] },
    { question: 'Associated', options: ['Palpitations', 'Chest pain', 'Shortness of breath', 'Headache afterwards'] },
  ],
  'pelvic pain': [
    { question: 'Timing', options: ['Cyclical (related to period)', 'Constant', 'Mid-cycle', 'Post-coital', 'With urination', 'With bowel movement'] },
    { question: 'Associated', options: ['Vaginal discharge', 'Abnormal bleeding', 'Fever', 'Urinary symptoms', 'Bowel symptoms', 'Shoulder tip pain'] },
  ],
};
