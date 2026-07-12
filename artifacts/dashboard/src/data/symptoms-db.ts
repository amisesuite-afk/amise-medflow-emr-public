export const SYMPTOM_GROUPS: { category: string; symptoms: string[] }[] = [
  {
    category: 'General',
    symptoms: ['fever', 'weight loss', 'weight gain', 'fatigue', 'anorexia', 'night sweats', 'malaise', 'rigors', 'drenching sweats', 'generalised weakness', 'loss of appetite', 'excessive thirst', 'excessive hunger', 'dehydration'],
  },
  {
    category: 'Neurological / Head',
    symptoms: ['headache', 'migraine', 'thunderclap headache', 'dizziness', 'vertigo', 'syncope', 'pre-syncope', 'seizure', 'confusion', 'memory loss', 'word-finding difficulty', 'speech difficulty', 'facial weakness', 'limb weakness', 'numbness', 'tingling', 'loss of consciousness', 'blackout', 'double vision', 'visual loss', 'visual aura', 'photophobia', 'neck stiffness', 'unsteady gait', 'tremor'],
  },
  {
    category: 'ENT / Head & Neck',
    symptoms: ['sore throat', 'ear pain', 'tinnitus', 'hearing loss', 'nasal discharge', 'epistaxis', 'hoarse voice', 'stridor', 'neck swelling', 'neck pain', 'facial pain', 'post-nasal drip', 'snoring', 'loss of smell', 'mouth ulcers', 'jaw pain'],
  },
  {
    category: 'Respiratory',
    symptoms: ['shortness of breath', 'cough', 'productive cough', 'dry cough', 'haemoptysis', 'wheeze', 'chest tightness', 'pleuritic chest pain', 'dyspnoea on exertion', 'orthopnoea', 'nocturnal dyspnoea', 'sleep apnoea'],
  },
  {
    category: 'Cardiovascular',
    symptoms: ['chest pain', 'palpitations', 'syncope', 'near-syncope', 'leg swelling', 'ankle oedema', 'bilateral leg oedema', 'claudication', 'rest pain', 'cold extremities', 'exertional chest tightness'],
  },
  {
    category: 'GI — Upper',
    symptoms: ['abdominal pain', 'nausea', 'vomiting', 'haematemesis', 'coffee-ground vomiting', 'dysphagia', 'odynophagia', 'heartburn', 'regurgitation', 'bloating', 'hiccups', 'epigastric pain', 'early satiety', 'indigestion', 'belching'],
  },
  {
    category: 'GI — Lower',
    symptoms: ['rectal bleeding', 'black stool', 'melaena', 'diarrhoea', 'constipation', 'change in bowel habit', 'tenesmus', 'mucus in stool', 'rectal pain', 'incomplete evacuation', 'flatulence', 'faecal urgency', 'faecal incontinence', 'perianal pain', 'anal discharge'],
  },
  {
    category: 'Biliary / Liver',
    symptoms: ['jaundice', 'dark urine', 'pale stool', 'pruritus', 'right upper quadrant pain', 'biliary colic', 'abdominal distension'],
  },
  {
    category: 'Breast',
    symptoms: ['breast lump', 'breast pain', 'nipple discharge', 'skin changes breast', 'breast swelling', 'axillary lump', 'breast asymmetry', 'nipple inversion', 'breast redness'],
  },
  {
    category: 'Hernia / Abdominal wall',
    symptoms: ['hernia', 'groin swelling', 'groin pain', 'umbilical swelling', 'incisional swelling', 'abdominal wall pain', 'lump in abdomen', 'scrotal swelling'],
  },
  {
    category: 'Post-op / Wound',
    symptoms: ['wound discharge', 'wound dehiscence', 'fever after surgery', 'wound pain', 'wound swelling', 'wound redness', 'suture problem', 'drain output change', 'post-op nausea', 'post-op fever'],
  },
  {
    category: 'Musculoskeletal',
    symptoms: ['joint pain', 'back pain', 'lower back pain', 'neck pain', 'shoulder pain', 'knee pain', 'hip pain', 'joint swelling', 'joint stiffness', 'morning stiffness', 'muscle pain', 'muscle weakness', 'limb pain', 'bone pain', 'ankle pain', 'wrist pain', 'elbow pain'],
  },
  {
    category: 'Urinary',
    symptoms: ['dysuria', 'haematuria', 'urinary frequency', 'nocturia', 'loin pain', 'urinary retention', 'poor urinary stream', 'hesitancy', 'incomplete bladder emptying', 'urinary incontinence', 'frothy urine', 'renal colic', 'suprapubic pain', 'penile discharge'],
  },
  {
    category: 'Gynaecological',
    symptoms: ['pelvic pain', 'irregular periods', 'menorrhagia', 'dysmenorrhoea', 'post-coital bleeding', 'vaginal discharge', 'vaginal bleeding', 'intermenstrual bleeding', 'amenorrhoea', 'dyspareunia', 'vulval pain', 'pelvic pressure'],
  },
  {
    category: 'Diabetic / Vascular',
    symptoms: ['diabetic foot infection', 'foot ulcer', 'leg ulcer', 'numbness feet', 'tingling feet', 'cold foot', 'poor wound healing', 'polyuria', 'polydipsia', 'hypoglycaemia episode', 'blurred vision (diabetes)', 'erectile dysfunction'],
  },
  {
    category: 'Skin / Dermatological',
    symptoms: ['rash', 'pruritus', 'skin lesion', 'ulcer', 'bruising', 'petechiae', 'purpura', 'hair loss', 'nail changes', 'cellulitis', 'abscess', 'cyst', 'lipoma', 'skin discolouration', 'eczema', 'psoriasis', 'pigmented lesion'],
  },
  {
    category: 'Mental health / Functional',
    symptoms: ['anxiety', 'depression', 'stress', 'insomnia', 'panic attacks', 'low mood', 'social withdrawal', 'poor concentration', 'fatigue (functional)', 'unexplained symptoms'],
  },
  {
    category: 'Administrative / Other',
    symptoms: ['admin enquiry', 'follow-up', 'second opinion', 'pre-op assessment', 'results review', 'wound check', 'medication review', 'sick note', 'referral follow-up', 'post-op review', 'annual review', 'prescription renewal', 'insurance report'],
  },
  {
    category: 'Anorectal / Abdominal wall',
    symptoms: ['perianal lump', 'rectal prolapse', 'pulsatile mass', 'lymphadenopathy', 'genital ulcer', 'penile swelling'],
  },
  {
    category: 'Paediatric / Neonatal',
    symptoms: [
      'inconsolable crying', 'poor feeding', 'failure to thrive', 'bilious vomiting',
      'neonatal jaundice', 'non-blanching rash', 'strawberry tongue',
      'limp', 'bow legs', 'delayed development', 'parental concern',
    ],
  },
];

export const ALL_SYMPTOMS_FLAT = SYMPTOM_GROUPS.flatMap(g => g.symptoms);
