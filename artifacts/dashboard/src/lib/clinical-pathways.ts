/**
 * Symptom-triggered decision-support pathways (differentials, red flags,
 * suggested labs/imaging, referral routing) for PathwaySuggestions and
 * InvestigationsTab — deliberately separate from @workspace/triage-engine's
 * CLINICAL_PATHWAYS (EMR-section-completion guidance keyed off APCQ symptom
 * codes, consumed via usePathway()). Both were previously named
 * `CLINICAL_PATHWAYS`, which risked a future import grabbing the wrong one —
 * renamed to make the split unambiguous. They are genuinely different
 * registries for different purposes, not a copy of the same data.
 */
export interface ClinicalPathway {
  id: string;
  title: string;
  trigger: (symptoms: string[], details: Record<string, string[]>) => boolean;
  urgency: 'urgent' | 'priority' | 'routine';
  suggestedDiagnoses: string[];
  redFlags: string[];
  labsImaging: string[];
  referral: string;
  note?: string;
}

export const DECISION_SUPPORT_PATHWAYS: ClinicalPathway[] = [
  {
    id: 'cholangitis',
    title: 'Acute cholangitis (Charcot\'s triad)',
    trigger: (symptoms, details) =>
      symptoms.includes('jaundice') &&
      (details['jaundice']?.includes('Fever') || details['jaundice']?.includes('Rigors')),
    urgency: 'urgent',
    suggestedDiagnoses: ['Acute suppurative cholangitis', 'CBD calculus with cholangitis'],
    redFlags: [
      'Reynold\'s pentad (shock + confusion) = septic cholangitis — emergency',
      'IV antibiotics + urgent biliary decompression required',
    ],
    labsImaging: ['FBC', 'Blood cultures × 2', 'Bilirubin + LFTs', 'CRP', 'Coagulation screen', 'USS biliary', 'MRCP or CT abdomen'],
    referral: 'Emergency surgical / ERCP team',
    note: 'IV piperacillin-tazobactam. Urgent ERCP or surgical decompression.',
  },
  {
    id: 'cbd_obstruction',
    title: 'CBD obstruction / Obstructive jaundice',
    trigger: (symptoms) =>
      symptoms.includes('jaundice') &&
      (symptoms.includes('dark urine') || symptoms.includes('pale stool')),
    urgency: 'priority',
    suggestedDiagnoses: ['CBD calculus', 'Cholangiocarcinoma', 'Head of pancreas carcinoma', 'Choledochal cyst', 'Biliary stricture'],
    redFlags: [
      'Fever + rigors + jaundice = Charcot\'s triad → urgent cholangitis',
      'Painless progressive jaundice + weight loss → pancreatic / bile duct malignancy',
    ],
    labsImaging: ['Bilirubin (total + direct)', 'LFTs (AST, ALT, GGT, ALP)', 'FBC', 'Coagulation screen', 'CA 19-9', 'USS abdomen', 'MRCP'],
    referral: 'ERCP / HPB Surgery',
    note: 'If Charcot\'s triad present (jaundice + fever + RUQ pain), treat as urgent cholangitis and escalate immediately.',
  },
  {
    id: 'upper_gi_bleed',
    title: 'Upper GI haemorrhage',
    trigger: (symptoms) =>
      symptoms.includes('black stool') ||
      (symptoms.includes('vomiting') && symptoms.includes('black stool')),
    urgency: 'urgent',
    suggestedDiagnoses: ['Peptic ulcer disease', 'Oesophageal varices', 'Mallory-Weiss tear', 'Gastric carcinoma', 'Angiodysplasia'],
    redFlags: [
      'Haemodynamic instability → emergency resuscitation',
      'Melaena + syncope or presyncope = massive bleed',
      'Glasgow-Blatchford score ≥ 6 = high risk, admit',
    ],
    labsImaging: ['FBC (Hb)', 'Coagulation screen', 'Group & crossmatch', 'LFTs', 'Renal function', 'Urgent OGD (within 24h)'],
    referral: 'Urgent surgical / gastroenterology review',
    note: 'Risk-stratify with Glasgow-Blatchford score. Nil by mouth, IV access × 2, fluid resuscitation. OGD within 24h or emergency if haemodynamically unstable.',
  },
  {
    id: 'lower_gi_bleed',
    title: 'Lower GI bleeding / Colorectal pathway',
    trigger: (symptoms) => symptoms.includes('rectal bleeding'),
    urgency: 'priority',
    suggestedDiagnoses: ['Haemorrhoids', 'Colorectal carcinoma', 'Diverticular disease', 'IBD (Crohn\'s / UC)', 'Angiodysplasia', 'Anal fissure'],
    redFlags: [
      'Massive PR bleeding + haemodynamic instability = emergency',
      'Age > 50 + change in bowel habit + rectal bleeding = urgent cancer referral (2WW)',
      'Blood mixed with stool + mucus + weight loss = sinister',
    ],
    labsImaging: ['FBC (Hb)', 'CEA (age > 50 / weight loss)', 'Iron studies', 'CRP', 'Flexible sigmoidoscopy / colonoscopy', 'CT colonography (if unfit for scope)'],
    referral: 'Colorectal surgery / 2-week wait cancer pathway',
    note: 'Distinguish haemorrhoidal (fresh, separate from stool, no systemic features) from sinister (mixed with stool, altered habit, weight loss, age > 50).',
  },
  {
    id: 'dysphagia_pathway',
    title: 'Dysphagia — oesophageal / gastric pathway',
    trigger: (symptoms) => symptoms.includes('dysphagia'),
    urgency: 'priority',
    suggestedDiagnoses: ['Oesophageal carcinoma', 'Gastric carcinoma', 'Achalasia', 'Peptic stricture', 'Oesophagitis / GORD', 'Pharyngeal pouch'],
    redFlags: [
      'Progressive solid-then-liquid dysphagia + weight loss = carcinoma until proven otherwise',
      'Odynophagia + hoarse voice = advanced / invasive disease',
      'Rapid deterioration in swallowing',
    ],
    labsImaging: ['FBC', 'LFTs', 'CEA', 'CA 19-9', 'OGD + biopsy', 'CT chest / abdomen / pelvis', 'PET-CT (if confirmed malignancy)'],
    referral: 'Upper GI surgery / Oncology MDT',
    note: 'Urgent OGD within 2 weeks if red-flag dysphagia. Full staging CT before surgical planning. Dietitian review for nutritional support.',
  },
  {
    id: 'breast_lump',
    title: 'Breast lump — triple assessment pathway',
    trigger: (symptoms) => symptoms.includes('breast lump'),
    urgency: 'priority',
    suggestedDiagnoses: ['Breast carcinoma', 'Fibroadenoma', 'Breast cyst', 'Fat necrosis', 'Phyllodes tumour', 'Breast abscess'],
    redFlags: [
      'Hard, fixed, irregular lump = carcinoma until proven otherwise',
      'Skin tethering, peau d\'orange, nipple inversion',
      'Axillary lymphadenopathy',
      'Inflammatory breast cancer: erythema + warmth + rapid enlargement',
    ],
    labsImaging: ['Clinical exam (triple assessment)', 'USS breast (all ages)', 'Mammogram (≥ 35 yrs)', 'Core biopsy / FNA', 'MRI breast (BRCA / dense breast / local staging)'],
    referral: 'Breast surgery / triple assessment clinic',
    note: 'Any discrete lump in a woman ≥ 35 requires mammogram. USS + core biopsy for high-suspicion lumps in younger patients. Triple assessment = clinical + imaging + pathology.',
  },
  {
    id: 'breast_nipple',
    title: 'Nipple discharge — biliary duct pathway',
    trigger: (symptoms) => symptoms.includes('nipple discharge'),
    urgency: 'routine',
    suggestedDiagnoses: ['Intraductal papilloma', 'Ductal carcinoma in situ (DCIS)', 'Galactorrhoea (prolactinoma)', 'Duct ectasia'],
    redFlags: [
      'Bloodstained unilateral single-duct discharge = intraductal papilloma or DCIS',
      'Mass + discharge = carcinoma until proven otherwise',
    ],
    labsImaging: ['USS breast', 'Mammogram (if ≥ 35)', 'Prolactin + TFTs (if bilateral milky)', 'Ductoscopy / microdochectomy if indicated'],
    referral: 'Breast surgery',
    note: 'Bloodstained or unilateral spontaneous discharge requires formal surgical assessment and imaging.',
  },
  {
    id: 'weight_loss_malignancy',
    title: 'Unexplained weight loss — malignancy screen',
    trigger: (symptoms) => symptoms.includes('weight loss'),
    urgency: 'priority',
    suggestedDiagnoses: ['GI malignancy (colorectal, gastric, pancreatic)', 'Lymphoma', 'Lung carcinoma', 'Occult infection (TB, HIV)', 'Hyperthyroidism', 'Diabetes mellitus'],
    redFlags: [
      '> 10 kg unintentional loss in < 6 months',
      'Night sweats + weight loss + lymphadenopathy = haematological malignancy',
      'Anorexia + abdominal mass + weight loss = urgent CT',
    ],
    labsImaging: ['FBC', 'CRP', 'ESR', 'LFTs', 'Renal function', 'CEA', 'CA 19-9', 'CA-125 (F)', 'PSA (M)', 'TFTs', 'CT chest / abdomen / pelvis', 'OGD + colonoscopy if GI symptoms'],
    referral: 'General surgery / Oncology MDT',
    note: 'Unintentional weight loss > 5% body weight in 6 months requires investigation. Urgent CT if associated GI red flags.',
  },
  {
    id: 'acute_cholecystitis',
    title: 'Gallstone disease / Acute cholecystitis',
    trigger: (symptoms, details) =>
      symptoms.includes('abdominal pain') &&
      (details['abdominal pain']?.includes('RUQ') || details['abdominal pain']?.includes('Radiation to shoulder tip')),
    urgency: 'priority',
    suggestedDiagnoses: ['Acute cholecystitis', 'Biliary colic', 'CBD calculus', 'Gallstone pancreatitis', 'Mirizzi syndrome'],
    redFlags: [
      'Murphy\'s sign positive = acute cholecystitis',
      'Jaundice + RUQ pain = CBD stone / cholangitis',
      'Amylase > 1000 = gallstone pancreatitis',
    ],
    labsImaging: ['FBC', 'CRP', 'LFTs + bilirubin', 'Amylase / lipase', 'Renal function', 'USS gallbladder + CBD', 'MRCP if CBD dilation'],
    referral: 'General / HPB surgery',
    note: 'Laparoscopic cholecystectomy — same admission if fit, or elective 4–6 weeks after acute episode. Low-fat diet in interim.',
  },
  {
    id: 'acute_abdomen',
    title: 'Acute abdomen — surgical emergency',
    trigger: (symptoms, details) =>
      symptoms.includes('abdominal pain') &&
      symptoms.includes('fever after surgery'),
    urgency: 'urgent',
    suggestedDiagnoses: ['Acute appendicitis', 'Bowel perforation', 'Diverticulitis with perforation', 'Ischaemic colitis', 'Post-op complication'],
    redFlags: [
      'Peritonism (board-like rigidity, guarding, rebound) = surgical emergency',
      'Free air on erect CXR = perforation',
      'Post-op fever day 3–5 = anastomotic leak / collection',
    ],
    labsImaging: ['FBC', 'CRP', 'LFTs', 'Amylase / lipase', 'Lactate', 'Group & save', 'Erect CXR', 'USS abdomen', 'CT abdomen / pelvis (IV contrast)'],
    referral: 'Emergency surgery',
    note: 'Nil by mouth, IV access, analgesia, IV antibiotics. CT abdomen is gold standard. Surgical review within 1 hour if peritonitic.',
  },
  {
    id: 'hernia_complications',
    title: 'Hernia — obstruction / strangulation',
    trigger: (symptoms, details) =>
      symptoms.includes('hernia') &&
      (details['hernia']?.includes('Irreducible') || details['hernia']?.includes("Can't assess")),
    urgency: 'urgent',
    suggestedDiagnoses: ['Obstructed hernia', 'Strangulated hernia', 'Richter\'s hernia', 'Sliding hernia'],
    redFlags: [
      'Irreducible + tender = strangulated — emergency surgery',
      'Absent cough impulse + firmness = obstruction',
      'Erythema of overlying skin = impending necrosis',
    ],
    labsImaging: ['FBC', 'CRP', 'Renal function', 'Lactate', 'Group & save', 'Erect AXR / CXR', 'CT abdomen (if diagnosis uncertain)'],
    referral: 'Emergency surgery',
    note: 'Do NOT attempt to reduce a tender irreducible hernia. Emergency surgical assessment required immediately.',
  },
  {
    id: 'diabetic_foot',
    title: 'Diabetic foot — infection / ischaemia',
    trigger: (symptoms) => symptoms.includes('diabetic foot infection'),
    urgency: 'priority',
    suggestedDiagnoses: ['Diabetic foot infection', 'Osteomyelitis', 'Peripheral arterial disease', 'Neuropathic ulcer', 'Charcot neuroarthropathy'],
    redFlags: [
      'Wet gangrene / necrotising fasciitis = surgical emergency',
      'Fever + systemic sepsis = IV antibiotics + urgent surgical debridement',
      'Absent foot pulses = critical limb ischaemia',
    ],
    labsImaging: ['FBC', 'CRP', 'HbA1c', 'Blood cultures (if febrile)', 'Wound swab', 'Foot X-ray (osteomyelitis)', 'MRI foot (if osteomyelitis suspected)', 'Ankle-Brachial Index (ABI)'],
    referral: 'Vascular surgery / orthopaedics / diabetic foot team',
    note: 'SINBAD / Wagner classification. MDT approach: vascular, orthopaedic, endocrinology, dietitian, podiatry.',
  },
];

export function getActivePathways(
  symptoms: string[],
  symptomDetails: Record<string, string[]>,
): ClinicalPathway[] {
  return DECISION_SUPPORT_PATHWAYS.filter(p => p.trigger(symptoms, symptomDetails));
}
