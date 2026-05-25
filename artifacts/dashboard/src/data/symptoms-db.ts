export const SYMPTOM_GROUPS: { category: string; symptoms: string[] }[] = [
  { category: 'General', symptoms: ['fever', 'weight loss', 'fatigue', 'anorexia', 'night sweats', 'malaise', 'rigors', 'drenching sweats'] },
  { category: 'GI — Upper', symptoms: ['abdominal pain', 'nausea', 'vomiting', 'haematemesis', 'dysphagia', 'odynophagia', 'heartburn', 'regurgitation', 'bloating', 'hiccups', 'epigastric pain'] },
  { category: 'GI — Lower', symptoms: ['rectal bleeding', 'black stool', 'diarrhoea', 'constipation', 'change in bowel habit', 'tenesmus', 'mucus in stool', 'rectal pain', 'incomplete evacuation', 'flatulence'] },
  { category: 'Biliary / Liver', symptoms: ['jaundice', 'dark urine', 'pale stool', 'pruritus', 'right upper quadrant pain', 'biliary colic'] },
  { category: 'Breast', symptoms: ['breast lump', 'breast pain', 'nipple discharge', 'skin changes breast', 'breast swelling', 'axillary lump'] },
  { category: 'Hernia / Abdominal wall', symptoms: ['hernia', 'groin swelling', 'groin pain', 'umbilical swelling', 'incisional swelling', 'abdominal wall pain'] },
  { category: 'Post-op / Wound', symptoms: ['wound discharge', 'wound dehiscence', 'fever after surgery', 'wound pain', 'wound swelling', 'wound redness'] },
  { category: 'Respiratory', symptoms: ['shortness of breath', 'cough', 'haemoptysis', 'wheeze', 'pleuritic chest pain', 'dyspnoea on exertion'] },
  { category: 'Cardiovascular', symptoms: ['chest pain', 'palpitations', 'syncope', 'leg swelling', 'claudication', 'rest pain'] },
  { category: 'Diabetic / Vascular', symptoms: ['diabetic foot infection', 'foot ulcer', 'leg ulcer', 'numbness feet', 'tingling feet', 'cold foot'] },
  { category: 'Urinary', symptoms: ['dysuria', 'haematuria', 'frequency', 'nocturia', 'loin pain', 'urinary retention', 'poor stream'] },
  { category: 'Systemic / Other', symptoms: ['admin enquiry', 'follow-up', 'second opinion', 'pre-op assessment', 'results review', 'wound check'] },
];

export const ALL_SYMPTOMS_FLAT = SYMPTOM_GROUPS.flatMap(g => g.symptoms);
