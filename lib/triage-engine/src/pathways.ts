/**
 * Clinical pathway registry for Dr Kabiye's outpatient general and
 * endoscopic surgery practice. Each pathway maps a chief complaint to the
 * EMR sections that must (or should) be completed, the specific items to
 * focus on in each section, suggested investigations, differentials,
 * red-flag symptoms, and focused exam areas.
 *
 * Consumed by the dashboard (Vite) and API server (esbuild) via the
 * shared `@workspace/triage-engine` package.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PathwaySectionId =
  | 'pmh'
  | 'surgical'
  | 'medications'
  | 'allergies'
  | 'examination'
  | 'investigations'
  | 'radiology'
  | 'assessment'
  | 'ros';

export type PathwaySpecialty =
  | 'general_surgery'
  | 'endoscopy'
  | 'breast'
  | 'colorectal'
  | 'hepatobiliary'
  | 'vascular'
  | 'wellness'
  | 'emergency';

export interface PathwayField {
  /** Maps to an EMR section id. */
  section: PathwaySectionId;
  /** Must be completed before the encounter can be finalised. */
  required: boolean;
  /** Specific items to prompt for in this section. */
  focus: string[];
  /** Guidance text for the clinician. */
  prompt?: string;
}

export interface PathwayDefinition {
  /** Unique pathway code (kebab-case). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Clinical specialty grouping. */
  specialty: PathwaySpecialty;
  /** Symptom strings (from the APCQ / triage engine) that activate this pathway. */
  triggerSymptoms: string[];
  /** Free-text keywords / phrases that match. */
  triggerKeywords: string[];
  /** EMR section ids that must be completed. */
  requiredSections: PathwaySectionId[];
  /** Sections shown but not required. */
  optionalSections: PathwaySectionId[];
  /** Per-section field guidance. */
  fields: PathwayField[];
  /** Lab panels and imaging to suggest. */
  suggestedInvestigations: string[];
  /** Differential diagnosis list. */
  differentials: string[];
  /** Symptoms that escalate urgency when present. */
  redFlagSymptoms: string[];
  /** Specific exam areas to focus on. */
  examFocus: string[];
}

// ---------------------------------------------------------------------------
// Pathway definitions
// ---------------------------------------------------------------------------

export const CLINICAL_PATHWAYS: PathwayDefinition[] = [

  // =========================================================================
  //  GENERAL SURGERY
  // =========================================================================

  {
    id: 'acute-abdomen',
    name: 'Acute Abdomen',
    specialty: 'general_surgery',
    triggerSymptoms: [
      'abdominal_pain', 'nausea_vomiting', 'blood_in_vomit_stool',
    ],
    triggerKeywords: [
      'acute abdomen', 'severe abdominal pain', 'peritonitis', 'guarding',
      'rigidity', 'board-like abdomen', 'rebound tenderness', 'appendicitis',
      'perforation', 'sbo', 'small bowel obstruction', 'cholecystitis',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'investigations'],
    optionalSections: ['surgical', 'ros', 'radiology'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous abdominal surgery', 'diabetes', 'anticoagulation', 'immunosuppression', 'renal disease'],
        prompt: 'Screen for conditions that alter surgical risk or presentation.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'steroids', 'NSAIDs', 'immunosuppressants', 'insulin', 'antihypertensives'],
        prompt: 'Anticoagulants and steroids may mask signs or complicate surgery.',
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'contrast allergy', 'latex'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'inspection — distension, scars, visible peristalsis',
          'auscultation — bowel sounds present/absent/tinkling',
          'palpation — guarding, rigidity, rebound, localised tenderness',
          'percussion — tympanic, shifting dullness',
          'DRE if indicated',
          'hernial orifices',
        ],
        prompt: 'Systematic abdominal exam. Note guarding/rigidity. Check hernial orifices.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'CRP', 'U&E', 'LFTs', 'lipase/amylase', 'lactate', 'blood group & save', 'urinalysis', 'pregnancy test (females of reproductive age)'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['erect CXR — free air', 'AXR — dilated loops/levels', 'CT abdomen-pelvis with IV contrast', 'USS abdomen'],
        prompt: 'Erect CXR to exclude pneumoperitoneum. CT if stable and diagnosis unclear.',
      },
      {
        section: 'ros',
        required: false,
        focus: ['constitutional — fever/chills/weight loss', 'GI — bowel habit, last flatus', 'urinary — dysuria/frequency'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'U&E', 'LFTs', 'Lipase', 'Lactate', 'Blood group & save',
      'Urinalysis', 'Pregnancy test', 'Erect CXR', 'AXR', 'CT abdomen-pelvis with IV contrast',
    ],
    differentials: [
      'Acute appendicitis', 'Acute cholecystitis', 'Perforated peptic ulcer',
      'Small bowel obstruction', 'Large bowel obstruction', 'Acute pancreatitis',
      'Mesenteric ischaemia', 'Diverticulitis', 'Ruptured AAA',
      'Ectopic pregnancy', 'Ovarian torsion', 'Renal colic',
    ],
    redFlagSymptoms: [
      'board-like rigidity', 'haemodynamic instability', 'absent bowel sounds',
      'fever with peritonism', 'free air on CXR', 'melaena', 'haematemesis',
    ],
    examFocus: [
      'Abdomen — systematic four-quadrant assessment',
      'Hernial orifices — inguinal and femoral',
      'DRE — mass, blood, tenderness',
      'Vital signs — haemodynamic stability',
    ],
  },

  {
    id: 'hernia',
    name: 'Hernia (Inguinal / Umbilical / Incisional / Femoral)',
    specialty: 'general_surgery',
    triggerSymptoms: ['abdominal_pain', 'lump_or_mass'],
    triggerKeywords: [
      'hernia', 'inguinal hernia', 'umbilical hernia', 'incisional hernia',
      'femoral hernia', 'groin lump', 'groin swelling', 'groin bulge',
      'belly button bulge', 'incisional bulge', 'reducible', 'irreducible',
      'strangulated', 'incarcerated',
    ],
    requiredSections: ['pmh', 'surgical', 'medications', 'allergies', 'examination'],
    optionalSections: ['investigations', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous hernia repair', 'obesity', 'chronic cough', 'BPH / straining', 'connective tissue disorder', 'ascites'],
        prompt: 'Identify predisposing factors for hernia recurrence or complications.',
      },
      {
        section: 'surgical',
        required: true,
        focus: ['previous hernia repairs and approach', 'mesh use', 'previous abdominal surgery'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'immunosuppressants', 'steroids'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'mesh/material reactions'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'standing and supine examination',
          'cough impulse',
          'reducibility',
          'size and location',
          'inguinal vs femoral — relation to pubic tubercle',
          'skin changes — discolouration, erythema',
          'contralateral groin',
          'abdominal exam for obstruction',
        ],
        prompt: 'Examine standing. Assess cough impulse, reducibility, and for signs of strangulation.',
      },
      {
        section: 'investigations',
        required: false,
        focus: ['USS groin/abdominal wall if diagnostic uncertainty', 'CT abdomen if complex/recurrent', 'FBC, U&E if surgical candidate'],
      },
      {
        section: 'ros',
        required: false,
        focus: ['GI — obstruction symptoms', 'urinary — straining, BPH'],
      },
    ],
    suggestedInvestigations: [
      'USS groin / abdominal wall', 'CT abdomen-pelvis (complex/recurrent)',
      'FBC', 'U&E', 'Coagulation screen',
    ],
    differentials: [
      'Inguinal hernia (direct/indirect)', 'Femoral hernia', 'Umbilical hernia',
      'Incisional hernia', 'Spigelian hernia', 'Lipoma of cord',
      'Inguinal lymphadenopathy', 'Saphena varix', 'Undescended testis',
      'Hydrocele', 'Epididymal cyst',
    ],
    redFlagSymptoms: [
      'irreducible lump', 'painful irreducible hernia', 'vomiting with hernia',
      'absent bowel sounds', 'erythema over hernia', 'tender tense swelling',
    ],
    examFocus: [
      'Groin — standing and supine, cough impulse',
      'Abdominal wall — all hernial orifices',
      'Abdomen — signs of obstruction',
      'Contralateral groin',
    ],
  },

  {
    id: 'gallbladder-disease',
    name: 'Gallbladder Disease (Biliary Colic / Cholecystitis / Choledocholithiasis)',
    specialty: 'general_surgery',
    triggerSymptoms: ['abdominal_pain', 'jaundice', 'nausea_vomiting'],
    triggerKeywords: [
      'gallstone', 'gall stone', 'biliary colic', 'cholecystitis',
      'choledocholithiasis', 'gallbladder', 'right upper quadrant pain',
      'ruq pain', 'murphy', 'postcholecystectomy',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'investigations', 'radiology'],
    optionalSections: ['surgical', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous biliary disease', 'diabetes', 'obesity', 'OCP/HRT use', 'haemolytic disease', 'Crohn\'s disease'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'OCP', 'statins', 'NSAIDs'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'contrast allergy'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'RUQ tenderness', 'Murphy\'s sign', 'jaundice', 'fever',
          'palpable gallbladder (Courvoisier\'s)', 'peritonism',
        ],
        prompt: 'Assess Murphy\'s sign. Look for jaundice. Palpable gallbladder → ?malignant obstruction.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'CRP', 'LFTs — bilirubin, ALP, GGT, AST, ALT', 'lipase/amylase', 'coagulation screen'],
      },
      {
        section: 'radiology',
        required: true,
        focus: ['USS abdomen — stones, wall thickness, CBD diameter', 'MRCP if dilated CBD or abnormal LFTs', 'CT if complications suspected'],
        prompt: 'USS first-line. MRCP for CBD stones. CT if perforation or abscess suspected.',
      },
      {
        section: 'surgical',
        required: false,
        focus: ['previous biliary surgery', 'previous ERCP', 'previous cholecystectomy'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'LFTs (total/direct bilirubin, ALP, GGT, AST, ALT)',
      'Lipase', 'Coagulation screen', 'USS abdomen', 'MRCP', 'Blood cultures (if febrile)',
    ],
    differentials: [
      'Biliary colic', 'Acute cholecystitis', 'Choledocholithiasis',
      'Cholangitis', 'Gallstone pancreatitis', 'Mirizzi syndrome',
      'Cholangiocarcinoma', 'Peptic ulcer disease', 'Hepatitis',
    ],
    redFlagSymptoms: [
      'Charcot\'s triad — fever + jaundice + RUQ pain',
      'Reynolds\' pentad — + hypotension + confusion',
      'palpable gallbladder with painless jaundice',
      'pancreatitis with gallstones',
    ],
    examFocus: [
      'RUQ — Murphy\'s sign, mass',
      'Jaundice — sclera, skin',
      'Abdomen — peritonism',
      'Vital signs — sepsis screen',
    ],
  },

  {
    id: 'breast-disease',
    name: 'Breast Lump / Breast Disease',
    specialty: 'breast',
    triggerSymptoms: ['breast_concern', 'lump_or_mass'],
    triggerKeywords: [
      'breast lump', 'breast mass', 'breast pain', 'nipple discharge',
      'bloody nipple', 'skin tethering', 'nipple inversion', 'nipple retraction',
      'peau d\'orange', 'areola', 'mastitis', 'breast abscess', 'fibroadenoma',
      'breast cancer', 'breast cyst', 'gynaecomastia',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['allergies', 'radiology', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'family history — breast/ovarian cancer, BRCA',
          'menstrual history — menarche, menopause',
          'parity and lactation history',
          'HRT/OCP use',
          'previous breast disease or biopsy',
          'previous radiation therapy',
        ],
        prompt: 'Detailed family history for BRCA risk. Hormonal exposure assessment.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['HRT', 'OCP', 'tamoxifen', 'aromatase inhibitors', 'anticoagulants'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'inspection — asymmetry, skin changes, nipple inversion',
          'palpation — lump size, consistency, mobility, fixity',
          'nipple — discharge (express), retraction',
          'axillary lymph nodes',
          'supraclavicular lymph nodes',
          'contralateral breast',
        ],
        prompt: 'Triple assessment: clinical exam + imaging + tissue diagnosis. Document lump size in cm, clock position, quadrant.',
      },
      {
        section: 'investigations',
        required: true,
        focus: [
          'mammogram (age ≥ 40)',
          'breast USS (age < 40 or as adjunct)',
          'FNA / core biopsy',
          'BIRADS classification',
        ],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['mammogram', 'breast USS', 'breast MRI (high-risk/BRCA)', 'ductogram if nipple discharge'],
      },
      {
        section: 'ros',
        required: false,
        focus: ['constitutional — weight loss, bone pain', 'respiratory — cough/dyspnoea (metastasis screen)'],
      },
    ],
    suggestedInvestigations: [
      'Mammogram', 'Breast USS', 'FNA / Core biopsy', 'FBC',
      'Breast MRI (if high-risk)', 'Ductogram', 'BRCA genetic testing (if family history)',
    ],
    differentials: [
      'Fibroadenoma', 'Breast cyst', 'Fibrocystic disease',
      'Breast carcinoma (invasive ductal/lobular)', 'DCIS', 'Phyllodes tumour',
      'Breast abscess', 'Fat necrosis', 'Intraductal papilloma',
      'Gynaecomastia (male)', 'Mastitis',
    ],
    redFlagSymptoms: [
      'hard fixed lump', 'skin tethering or peau d\'orange',
      'nipple inversion (new)', 'bloody nipple discharge',
      'axillary lymphadenopathy', 'rapid growth',
      'age > 60 with new lump',
    ],
    examFocus: [
      'Breast — bilateral inspection and palpation',
      'Axillae — lymphadenopathy',
      'Supraclavicular fossa',
      'Nipple — discharge on expression',
    ],
  },

  {
    id: 'thyroid-neck-mass',
    name: 'Thyroid / Neck Mass',
    specialty: 'general_surgery',
    triggerSymptoms: ['lump_or_mass'],
    triggerKeywords: [
      'thyroid', 'neck mass', 'neck lump', 'neck swelling', 'goitre', 'goiter',
      'thyroid nodule', 'thyroid cancer', 'multinodular', 'lymphadenopathy',
      'swollen glands', 'hoarse voice',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros', 'allergies'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'thyroid disease history', 'radiation exposure (childhood)',
          'family history — thyroid cancer, MEN syndrome',
          'hyper/hypothyroid symptoms',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['thyroxine', 'antithyroid drugs', 'amiodarone', 'lithium'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'neck inspection — swelling, asymmetry',
          'palpation — size, consistency, mobility, tenderness',
          'movement with swallowing',
          'cervical lymphadenopathy',
          'tracheal deviation',
          'retrosternal extension',
          'voice assessment',
        ],
        prompt: 'Assess lump mobility with swallowing (thyroid) vs tongue protrusion (thyroglossal). Palpate cervical nodes bilaterally.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['TSH', 'Free T4', 'Thyroid USS', 'FNA if TI-RADS 3+', 'Calcitonin (if MTC suspected)'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['thyroid USS with TI-RADS classification', 'CT neck/chest (retrosternal extension)', 'nuclear thyroid scan (hot/cold nodule)'],
      },
      {
        section: 'ros',
        required: false,
        focus: ['hyperthyroid symptoms — tremor, weight loss, palpitations', 'hypothyroid — fatigue, weight gain, cold intolerance', 'compressive — dysphagia, stridor'],
      },
    ],
    suggestedInvestigations: [
      'TSH', 'Free T4', 'Free T3', 'Thyroid USS with TI-RADS',
      'FNA cytology (Bethesda)', 'Calcitonin', 'Anti-TPO antibodies',
      'CT neck (if retrosternal or compressive)', 'Vocal cord assessment',
    ],
    differentials: [
      'Thyroid nodule (benign)', 'Multinodular goitre', 'Thyroid carcinoma (papillary/follicular/medullary)',
      'Thyroglossal cyst', 'Branchial cyst', 'Cervical lymphadenopathy',
      'Lymphoma', 'Reactive lymph node', 'Salivary gland tumour', 'Carotid body tumour',
    ],
    redFlagSymptoms: [
      'rapid growth', 'hoarse voice (recurrent laryngeal nerve)',
      'fixed/hard nodule', 'cervical lymphadenopathy',
      'stridor or dyspnoea', 'family history MEN/thyroid cancer',
    ],
    examFocus: [
      'Neck — thyroid palpation, movement with swallowing',
      'Cervical lymph nodes — all levels',
      'Voice — hoarseness',
      'Trachea — deviation',
    ],
  },

  {
    id: 'soft-tissue-mass',
    name: 'Soft Tissue Mass / Lipoma',
    specialty: 'general_surgery',
    triggerSymptoms: ['lump_or_mass'],
    triggerKeywords: [
      'lipoma', 'fatty lump', 'sebaceous cyst', 'epidermoid cyst',
      'soft tissue mass', 'subcutaneous lump', 'skin lump', 'cyst',
      'growing lump',
    ],
    requiredSections: ['examination'],
    optionalSections: ['pmh', 'medications', 'allergies', 'investigations', 'radiology'],
    fields: [
      {
        section: 'examination',
        required: true,
        focus: [
          'size in cm', 'location and depth (subcutaneous vs deep)',
          'consistency — soft/firm/hard', 'mobility — freely mobile vs fixed',
          'skin changes — punctum, tethering, discolouration',
          'transillumination', 'regional lymph nodes',
        ],
        prompt: 'Document size, depth, consistency, and fixity. Hard/fixed/rapidly growing lesions warrant urgent imaging.',
      },
      {
        section: 'pmh',
        required: false,
        focus: ['previous excisions', 'familial lipomatosis', 'neurofibromatosis'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['USS soft tissue (if deep or > 5cm)', 'MRI (if deep to fascia or rapid growth)', 'excision biopsy'],
        prompt: 'Refer for USS/MRI if > 5 cm, deep to fascia, rapidly growing, or firm/hard.',
      },
    ],
    suggestedInvestigations: [
      'USS soft tissue', 'MRI (if deep or > 5 cm)', 'Excision biopsy', 'FBC',
    ],
    differentials: [
      'Lipoma', 'Sebaceous/epidermoid cyst', 'Dermatofibroma', 'Neurofibroma',
      'Soft tissue sarcoma', 'Abscess', 'Ganglion', 'Lymph node',
    ],
    redFlagSymptoms: [
      'rapid growth', 'size > 5 cm', 'deep to fascia', 'hard/firm consistency',
      'fixity to underlying structures', 'pain at rest',
    ],
    examFocus: [
      'Lump — size, consistency, depth, mobility',
      'Skin — punctum, tethering',
      'Regional lymph nodes',
    ],
  },

  {
    id: 'wound-management',
    name: 'Wound Management (Acute / Chronic / SSI)',
    specialty: 'general_surgery',
    triggerSymptoms: ['post_op_concern'],
    triggerKeywords: [
      'wound', 'wound infection', 'surgical site infection', 'ssi',
      'wound dehiscence', 'wound not healing', 'chronic wound',
      'wound discharge', 'pus', 'wound opened', 'non-healing wound',
      'laceration', 'wound breakdown',
    ],
    requiredSections: ['surgical', 'medications', 'examination'],
    optionalSections: ['pmh', 'allergies', 'investigations'],
    fields: [
      {
        section: 'surgical',
        required: true,
        focus: ['type and date of surgery/injury', 'closure method — sutures/staples/glue', 'drain placement'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['current antibiotics', 'anticoagulants', 'steroids', 'immunosuppressants', 'diabetes medications'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'wound size — length × width × depth',
          'wound bed — granulation, slough, necrotic tissue',
          'edges — approximated, undermined, rolled',
          'surrounding skin — erythema, induration, cellulitis',
          'discharge — serous, purulent, haemoserous',
          'temperature',
          'photographic documentation',
        ],
        prompt: 'Document wound dimensions and describe wound bed. Mark erythema margins. Photo documentation.',
      },
      {
        section: 'pmh',
        required: false,
        focus: ['diabetes', 'PVD', 'immunosuppression', 'malnutrition', 'smoking', 'steroid use'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['wound swab MC&S', 'FBC', 'CRP', 'HbA1c (diabetics)', 'albumin/prealbumin (nutrition)', 'wound X-ray (foreign body/osteomyelitis)'],
      },
    ],
    suggestedInvestigations: [
      'Wound swab MC&S', 'FBC', 'CRP', 'HbA1c', 'Albumin',
      'Prealbumin', 'Wound X-ray', 'Blood glucose',
    ],
    differentials: [
      'Surgical site infection (superficial/deep/organ-space)',
      'Wound dehiscence', 'Seroma', 'Haematoma',
      'Incisional hernia', 'Foreign body',
      'Chronic non-healing wound', 'Pyoderma gangrenosum',
    ],
    redFlagSymptoms: [
      'spreading cellulitis', 'systemic sepsis', 'wound dehiscence with evisceration',
      'crepitus (necrotising fasciitis)', 'purulent discharge with fever',
    ],
    examFocus: [
      'Wound — dimensions, bed, edges, discharge',
      'Surrounding skin — erythema, warmth, induration',
      'Vital signs — temperature, haemodynamic status',
    ],
  },

  {
    id: 'anorectal',
    name: 'Anorectal (Haemorrhoids / Fissure / Fistula / Abscess)',
    specialty: 'general_surgery',
    triggerSymptoms: ['rectal_bleeding', 'abdominal_pain'],
    triggerKeywords: [
      'haemorrhoids', 'hemorrhoids', 'piles', 'anal fissure',
      'anal fistula', 'perianal abscess', 'anal abscess',
      'rectal bleeding', 'pr bleeding', 'painful defecation',
      'itch around anus', 'anal pain', 'pilonidal',
      'perianal discharge',
    ],
    requiredSections: ['pmh', 'examination'],
    optionalSections: ['medications', 'allergies', 'investigations', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous anorectal surgery', 'IBD (Crohn\'s / UC)', 'constipation history', 'childbirth history', 'anticoagulation'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'perianal inspection — skin tags, fissure, external haemorrhoids, fistula opening',
          'DRE — tone, mass, tenderness, blood on glove',
          'proctoscopy — internal haemorrhoids (grading)',
          'anoscopy if available',
          'abscess — fluctuance, erythema, tenderness',
        ],
        prompt: 'Left lateral position. Inspect before DRE. Grade haemorrhoids (I–IV). Assess fissure location (anterior vs posterior).',
      },
      {
        section: 'investigations',
        required: false,
        focus: ['FBC (anaemia)', 'colonoscopy (if age > 40 or alarm symptoms)', 'MRI pelvis (complex fistula)', 'EUA'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'Colonoscopy (if age > 40 or red flags)', 'MRI pelvis (fistula)',
      'Flexible sigmoidoscopy', 'Endo-anal USS',
    ],
    differentials: [
      'Haemorrhoids (internal/external)', 'Anal fissure', 'Perianal abscess',
      'Anal fistula', 'Pilonidal disease', 'Rectal prolapse',
      'Anal cancer', 'Condylomata', 'Pruritus ani',
      'Proctalgia fugax', 'Solitary rectal ulcer',
    ],
    redFlagSymptoms: [
      'change in bowel habit with bleeding', 'weight loss', 'age > 40 new rectal bleeding',
      'iron deficiency anaemia', 'perianal sepsis with systemic symptoms',
    ],
    examFocus: [
      'Perianal area — inspection, palpation',
      'DRE — tone, masses, tenderness',
      'Proctoscopy',
      'Abdomen — exclude mass',
    ],
  },

  {
    id: 'post-op-follow-up',
    name: 'Post-operative Follow-up (General)',
    specialty: 'general_surgery',
    triggerSymptoms: ['post_op_concern'],
    triggerKeywords: [
      'post-op', 'post op', 'postoperative', 'after surgery',
      'after operation', 'follow-up', 'follow up', 'review',
      'stitches', 'drain', 'staples', 'wound check',
    ],
    requiredSections: ['surgical', 'medications', 'examination'],
    optionalSections: ['pmh', 'allergies', 'investigations', 'ros'],
    fields: [
      {
        section: 'surgical',
        required: true,
        focus: ['procedure performed', 'date of surgery', 'intraoperative findings', 'histology results (if available)'],
        prompt: 'Review operative note and histology. Note any intraoperative complications.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['current analgesics', 'antibiotics', 'anticoagulants/DVT prophylaxis', 'laxatives', 'antiemetics'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'wound — healing, infection, discharge, dehiscence',
          'drain output — volume, colour',
          'mobility and function',
          'DVT screen — calf swelling, tenderness',
          'diet tolerance',
          'bowel function',
          'urinary function',
        ],
        prompt: 'Focus on wound, recovery milestones, and post-op complications (SSI, DVT, ileus).',
      },
      {
        section: 'investigations',
        required: false,
        focus: ['FBC', 'CRP', 'histology review', 'imaging if indicated'],
      },
      {
        section: 'ros',
        required: false,
        focus: ['fever', 'nausea/vomiting', 'bowel function', 'urinary function', 'mobility', 'pain control'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'U&E', 'Wound swab MC&S (if infected)',
      'Histology review', 'Imaging as clinically indicated',
    ],
    differentials: [
      'Normal post-operative recovery', 'Surgical site infection',
      'Wound dehiscence', 'Seroma', 'Haematoma',
      'DVT/PE', 'Post-operative ileus', 'Urinary retention',
      'Anastomotic leak', 'Incisional hernia',
    ],
    redFlagSymptoms: [
      'fever > 38°C', 'wound breakdown', 'purulent discharge',
      'unilateral leg swelling (DVT)', 'dyspnoea (PE)',
      'persistent vomiting (ileus/obstruction)', 'inability to pass urine',
    ],
    examFocus: [
      'Wound — healing, infection, discharge',
      'Abdomen — distension, tenderness, bowel sounds',
      'Calves — DVT screen',
      'Vital signs',
    ],
  },

  {
    id: 'skin-lesion',
    name: 'Skin Lesion / Excision',
    specialty: 'general_surgery',
    triggerSymptoms: ['lump_or_mass'],
    triggerKeywords: [
      'skin lesion', 'mole', 'changing mole', 'suspicious lesion',
      'skin cancer', 'melanoma', 'BCC', 'SCC', 'basal cell',
      'squamous cell', 'non-healing sore', 'excision',
      'biopsy skin', 'keratosis',
    ],
    requiredSections: ['examination'],
    optionalSections: ['pmh', 'medications', 'allergies', 'investigations'],
    fields: [
      {
        section: 'examination',
        required: true,
        focus: [
          'ABCDE criteria — asymmetry, border, colour, diameter, evolution',
          'size in mm',
          'location',
          'ulceration',
          'pigmentation pattern',
          'dermoscopy findings if available',
          'regional lymph nodes',
        ],
        prompt: 'Apply ABCDE criteria for melanoma risk. Document size, location, and any ulceration. Check regional nodes.',
      },
      {
        section: 'pmh',
        required: false,
        focus: ['previous skin cancers', 'sun exposure history', 'immunosuppression', 'family history melanoma', 'radiation history'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['excision biopsy with margins', 'punch biopsy', 'dermoscopy', 'sentinel lymph node biopsy (melanoma)'],
      },
    ],
    suggestedInvestigations: [
      'Excision biopsy', 'Punch biopsy', 'Dermoscopy',
      'Sentinel lymph node biopsy (melanoma)', 'CT staging (if malignant)',
    ],
    differentials: [
      'Melanoma', 'Basal cell carcinoma', 'Squamous cell carcinoma',
      'Actinic keratosis', 'Seborrhoeic keratosis', 'Dermatofibroma',
      'Pyogenic granuloma', 'Keratoacanthoma', 'Bowen\'s disease',
    ],
    redFlagSymptoms: [
      'rapidly changing lesion', 'ulceration', 'irregular borders',
      'multiple colours', 'diameter > 6 mm', 'new lesion in immunosuppressed patient',
    ],
    examFocus: [
      'Lesion — ABCDE assessment',
      'Regional lymph nodes',
      'Full skin survey if melanoma suspected',
    ],
  },

  {
    id: 'abdominal-wall-diastasis',
    name: 'Abdominal Wall / Diastasis Recti',
    specialty: 'general_surgery',
    triggerSymptoms: ['lump_or_mass'],
    triggerKeywords: [
      'diastasis', 'diastasis recti', 'abdominal wall',
      'abdominal bulge', 'rectus separation', 'midline bulge',
      'epigastric bulge', 'postpartum bulge',
    ],
    requiredSections: ['pmh', 'examination'],
    optionalSections: ['surgical', 'investigations', 'radiology'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['parity and obstetric history', 'previous abdominal surgery', 'obesity', 'connective tissue disorders'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'supine examination with head raise',
          'inter-recti distance in cm',
          'presence of associated hernia',
          'functional impairment',
          'abdominal wall symmetry',
        ],
        prompt: 'Measure inter-recti distance (IRD) at umbilicus, 3cm above and below. Assess for concomitant hernia.',
      },
      {
        section: 'investigations',
        required: false,
        focus: ['CT abdomen (if surgical repair considered)', 'USS abdominal wall'],
      },
    ],
    suggestedInvestigations: [
      'USS abdominal wall', 'CT abdomen (pre-operative planning)',
    ],
    differentials: [
      'Diastasis recti', 'Epigastric hernia', 'Umbilical hernia',
      'Incisional hernia', 'Rectus sheath haematoma',
    ],
    redFlagSymptoms: [
      'incarcerated hernia within diastasis', 'acute pain with mass',
    ],
    examFocus: [
      'Abdominal wall — head raise test, IRD measurement',
      'Hernial orifices',
    ],
  },

  // =========================================================================
  //  ENDOSCOPY
  // =========================================================================

  {
    id: 'upper-gi-endoscopy',
    name: 'Upper GI Endoscopy (Dyspepsia / GORD / Dysphagia)',
    specialty: 'endoscopy',
    triggerSymptoms: ['acid_reflux', 'difficulty_swallowing', 'abdominal_pain', 'nausea_vomiting'],
    triggerKeywords: [
      'dyspepsia', 'heartburn', 'reflux', 'gord', 'gerd',
      'acid reflux', 'indigestion', 'epigastric pain',
      'gastroscopy', 'ogd', 'endoscopy', 'dysphagia',
      'food sticking', 'trouble swallowing', 'odynophagia',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination'],
    optionalSections: ['investigations', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'H. pylori status', 'previous endoscopy and findings',
          'peptic ulcer history', 'Barrett\'s oesophagus',
          'NSAID use', 'alcohol history', 'smoking',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['PPIs', 'H2 blockers', 'NSAIDs', 'aspirin', 'anticoagulants', 'bisphosphonates'],
        prompt: 'Note PPI duration. Anticoagulant management for endoscopy.',
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'sedation reactions'],
      },
      {
        section: 'examination',
        required: true,
        focus: ['epigastric tenderness', 'anaemia signs', 'lymphadenopathy', 'abdominal mass', 'weight'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['FBC (anaemia)', 'H. pylori (stool antigen/breath test)', 'LFTs', 'Iron studies'],
      },
    ],
    suggestedInvestigations: [
      'OGD', 'FBC', 'H. pylori stool antigen / breath test',
      'LFTs', 'Iron studies', 'Coeliac screen (anti-tTG)',
    ],
    differentials: [
      'GORD', 'Peptic ulcer disease', 'H. pylori gastritis',
      'Oesophageal stricture', 'Barrett\'s oesophagus',
      'Oesophageal carcinoma', 'Gastric carcinoma',
      'Achalasia', 'Eosinophilic oesophagitis', 'Functional dyspepsia',
    ],
    redFlagSymptoms: [
      'dysphagia', 'weight loss', 'vomiting', 'GI bleeding',
      'anaemia', 'age > 55 with new dyspepsia', 'palpable mass',
    ],
    examFocus: [
      'Abdomen — epigastric tenderness, mass',
      'General — anaemia, weight loss, lymphadenopathy',
    ],
  },

  {
    id: 'colonoscopy-screening',
    name: 'Colonoscopy Screening',
    specialty: 'endoscopy',
    triggerSymptoms: ['general_screening'],
    triggerKeywords: [
      'colonoscopy screening', 'bowel screening', 'colon screening',
      'colorectal screening', 'fit test positive', 'fobt positive',
      'stool test positive', 'age screening colonoscopy',
    ],
    requiredSections: ['pmh', 'medications', 'allergies'],
    optionalSections: ['examination', 'investigations'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'family history colorectal cancer/polyps',
          'personal history of polyps',
          'IBD', 'Lynch syndrome/FAP',
          'previous colonoscopy and findings',
          'age — screening from 45-50',
        ],
        prompt: 'Assess family history and prior colonoscopy findings to determine surveillance interval.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'antiplatelets', 'iron supplements', 'diabetes medications (bowel prep)'],
        prompt: 'Anticoagulant management plan for procedure. Diabetes medication adjustment for bowel prep.',
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'bowel prep reactions', 'sedation reactions'],
      },
      {
        section: 'examination',
        required: false,
        focus: ['abdominal examination', 'DRE', 'weight', 'anaemia signs'],
      },
    ],
    suggestedInvestigations: [
      'Colonoscopy', 'FBC', 'Iron studies', 'FIT / FOBT',
      'Coagulation screen (if on anticoagulants)',
    ],
    differentials: [
      'Normal colon', 'Colonic polyps (adenomatous/hyperplastic)',
      'Diverticular disease', 'Colorectal carcinoma', 'IBD',
    ],
    redFlagSymptoms: [
      'rectal bleeding', 'change in bowel habit', 'weight loss',
      'iron deficiency anaemia', 'family history colorectal cancer',
    ],
    examFocus: [
      'Abdomen — mass',
      'DRE — rectal mass',
      'General — anaemia signs',
    ],
  },

  {
    id: 'colonoscopy-diagnostic',
    name: 'Colonoscopy Diagnostic (Rectal Bleeding / Bowel Habit Change / Iron Deficiency)',
    specialty: 'endoscopy',
    triggerSymptoms: ['rectal_bleeding', 'change_in_bowel_habit', 'weight_loss'],
    triggerKeywords: [
      'rectal bleeding', 'blood in stool', 'pr bleeding',
      'change in bowel habit', 'iron deficiency', 'anaemia',
      'colonoscopy', 'bowel cancer', 'colon cancer',
      'diagnostic colonoscopy', 'mucus in stool',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'investigations'],
    optionalSections: ['ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'rectal bleeding — character, volume, duration',
          'bowel habit change — nature and duration',
          'family history colorectal cancer',
          'IBD', 'previous polyps/colonoscopy',
          'weight loss', 'appetite change',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'antiplatelets', 'NSAIDs', 'iron supplements'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'sedation reactions', 'bowel prep reactions'],
      },
      {
        section: 'examination',
        required: true,
        focus: ['abdominal — mass, tenderness', 'DRE — rectal mass, blood, haemorrhoids', 'anaemia signs', 'lymphadenopathy', 'weight/BMI'],
        prompt: 'DRE is essential. Assess for palpable rectal mass. Check for anaemia signs.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'iron studies', 'CRP', 'CEA', 'LFTs', 'FIT/FOBT'],
      },
      {
        section: 'ros',
        required: false,
        focus: ['constitutional — weight loss, fatigue, night sweats', 'GI — full bowel review'],
      },
    ],
    suggestedInvestigations: [
      'Colonoscopy', 'FBC', 'Iron studies (ferritin, transferrin, TIBC)',
      'CRP', 'CEA', 'LFTs', 'FIT / FOBT', 'CT abdomen-pelvis (if CRC suspected)',
    ],
    differentials: [
      'Colorectal carcinoma', 'Colonic polyps', 'Diverticular disease',
      'Inflammatory bowel disease (Crohn\'s / UC)', 'Haemorrhoids',
      'Angiodysplasia', 'Ischaemic colitis', 'Radiation proctitis',
      'Solitary rectal ulcer', 'Irritable bowel syndrome',
    ],
    redFlagSymptoms: [
      'new rectal bleeding age > 40', 'iron deficiency anaemia',
      'weight loss', 'palpable rectal/abdominal mass',
      'family history colorectal cancer', 'change in bowel habit > 6 weeks',
    ],
    examFocus: [
      'Abdomen — mass, organomegaly',
      'DRE — rectal mass, blood',
      'General — anaemia, cachexia, lymphadenopathy',
    ],
  },

  {
    id: 'ercp',
    name: 'ERCP (Obstructive Jaundice / Bile Duct Stones / Pancreatic Duct)',
    specialty: 'endoscopy',
    triggerSymptoms: ['jaundice'],
    triggerKeywords: [
      'ercp', 'bile duct stone', 'choledocholithiasis', 'cbd stone',
      'obstructive jaundice', 'biliary stent', 'pancreatic duct',
      'bile duct stricture', 'sphincterotomy', 'mrcp',
      'dilated bile duct', 'cholangitis',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'investigations', 'radiology'],
    optionalSections: ['surgical', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'previous ERCP', 'previous cholecystectomy',
          'pancreatitis history', 'biliary surgery',
          'anticoagulation', 'contrast allergy',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants (management plan)', 'antiplatelets', 'insulin/diabetes drugs'],
        prompt: 'Anticoagulant/antiplatelet management critical for ERCP. Document bridging plan.',
      },
      {
        section: 'allergies',
        required: true,
        focus: ['contrast allergy', 'iodine', 'sedation reactions', 'antibiotic allergies'],
      },
      {
        section: 'examination',
        required: true,
        focus: ['jaundice', 'RUQ tenderness', 'palpable gallbladder', 'hepatomegaly', 'fever', 'Charcot\'s triad'],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['LFTs', 'bilirubin (total/direct)', 'FBC', 'CRP', 'coagulation screen', 'amylase/lipase', 'blood cultures (if febrile)'],
      },
      {
        section: 'radiology',
        required: true,
        focus: ['MRCP', 'USS abdomen — CBD diameter', 'CT abdomen (if mass suspected)', 'EUS'],
        prompt: 'MRCP to confirm ductal pathology before ERCP. USS for CBD diameter and stones.',
      },
    ],
    suggestedInvestigations: [
      'ERCP', 'LFTs', 'Bilirubin (total/direct)', 'FBC', 'CRP',
      'Coagulation screen (INR, APTT)', 'Amylase/Lipase',
      'Blood cultures', 'MRCP', 'USS abdomen', 'CT abdomen', 'EUS',
      'CA 19-9 (if malignancy suspected)',
    ],
    differentials: [
      'Choledocholithiasis', 'Cholangitis', 'Cholangiocarcinoma',
      'Pancreatic head carcinoma', 'Ampullary tumour',
      'Bile duct stricture (benign)', 'Chronic pancreatitis with ductal stricture',
      'Mirizzi syndrome', 'Biliary sludge',
    ],
    redFlagSymptoms: [
      'Charcot\'s triad', 'Reynolds\' pentad', 'painless progressive jaundice',
      'palpable gallbladder (Courvoisier\'s)', 'weight loss with jaundice',
    ],
    examFocus: [
      'Jaundice — depth',
      'RUQ — tenderness, mass, palpable gallbladder',
      'Vital signs — sepsis',
      'General — cachexia, lymphadenopathy',
    ],
  },

  {
    id: 'gi-bleeding',
    name: 'GI Bleeding (Upper and Lower)',
    specialty: 'endoscopy',
    triggerSymptoms: ['blood_in_vomit_stool', 'rectal_bleeding'],
    triggerKeywords: [
      'gi bleed', 'gi bleeding', 'gastrointestinal bleeding',
      'haematemesis', 'hematemesis', 'melaena', 'melena',
      'vomiting blood', 'black stool', 'blood in stool',
      'rectal bleed', 'pr bleed', 'coffee ground vomit',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['allergies', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'previous GI bleed', 'peptic ulcer disease', 'varices/liver disease',
          'NSAID use', 'anticoagulation', 'alcohol history',
          'H. pylori status', 'previous endoscopy',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'antiplatelets', 'NSAIDs', 'PPIs', 'steroids'],
        prompt: 'Critical to identify anticoagulant/NSAID use. Note last dose.',
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'haemodynamic status — BP, HR, postural drop',
          'abdominal — tenderness, peritonism, hepatomegaly, splenomegaly',
          'stigmata of chronic liver disease',
          'DRE — melaena, fresh blood',
          'pallor',
        ],
        prompt: 'Haemodynamic assessment first. Classify upper vs lower. Blatchford/Rockall scoring.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'U&E', 'LFTs', 'coagulation screen', 'cross-match', 'lactate', 'blood gas'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'U&E', 'LFTs', 'Coagulation screen (INR, APTT)',
      'Cross-match (2-4 units)', 'Lactate', 'Blood gas',
      'OGD (upper GI bleed)', 'Colonoscopy (lower GI bleed)',
      'CT angiography (if massive)', 'Group & save',
    ],
    differentials: [
      'Peptic ulcer (gastric/duodenal)', 'Oesophageal varices',
      'Mallory-Weiss tear', 'Oesophagitis', 'Gastric cancer',
      'Diverticular bleed', 'Angiodysplasia', 'Colorectal cancer',
      'Haemorrhoids', 'IBD', 'Ischaemic colitis', 'Aorto-enteric fistula',
    ],
    redFlagSymptoms: [
      'haemodynamic instability', 'syncope', 'massive haematemesis',
      'melaena with tachycardia', 'Hb < 70 g/L',
      'signs of chronic liver disease (variceal bleed)',
    ],
    examFocus: [
      'Haemodynamic status — BP, HR, postural',
      'Abdomen — liver, spleen, ascites',
      'DRE — stool colour',
      'Stigmata of liver disease',
    ],
  },

  {
    id: 'barretts-surveillance',
    name: "Barrett's Surveillance",
    specialty: 'endoscopy',
    triggerSymptoms: ['acid_reflux'],
    triggerKeywords: [
      'barrett', "barrett's", 'barretts', "barrett's oesophagus",
      'barrett surveillance', 'barrett follow-up', 'intestinal metaplasia',
      'dysplasia surveillance',
    ],
    requiredSections: ['pmh', 'medications', 'examination'],
    optionalSections: ['investigations', 'allergies'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'date and findings of previous OGD',
          'Barrett\'s segment length (Prague classification)',
          'dysplasia grade', 'previous ablation or EMR',
          'GORD symptom control', 'BMI',
        ],
        prompt: 'Review previous OGD reports and histology. Note Prague classification (C&M).',
      },
      {
        section: 'medications',
        required: true,
        focus: ['PPI (dose and compliance)', 'anticoagulants', 'aspirin'],
      },
      {
        section: 'examination',
        required: true,
        focus: ['weight/BMI', 'epigastric tenderness', 'anaemia signs'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['OGD with Seattle protocol biopsies', 'FBC', 'iron studies'],
      },
    ],
    suggestedInvestigations: [
      'OGD with Seattle protocol biopsies', 'FBC', 'Iron studies',
    ],
    differentials: [
      'Barrett\'s oesophagus without dysplasia', 'Low-grade dysplasia',
      'High-grade dysplasia', 'Intramucosal carcinoma',
      'Oesophageal adenocarcinoma', 'GORD without Barrett\'s',
    ],
    redFlagSymptoms: [
      'new dysphagia', 'weight loss', 'worsening reflux despite PPI',
      'GI bleeding', 'progression to high-grade dysplasia',
    ],
    examFocus: [
      'Weight/BMI',
      'Abdomen — epigastric',
      'General — anaemia, lymphadenopathy',
    ],
  },

  {
    id: 'foreign-body-ingestion',
    name: 'Foreign Body Ingestion / Food Bolus',
    specialty: 'endoscopy',
    triggerSymptoms: ['difficulty_swallowing'],
    triggerKeywords: [
      'foreign body', 'swallowed', 'food stuck', 'food bolus',
      'coin swallowed', 'bone stuck', 'fish bone', 'button battery',
      'food impaction', 'oesophageal obstruction',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'radiology'],
    optionalSections: ['investigations'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['known oesophageal stricture', 'eosinophilic oesophagitis', 'previous food impaction', 'Schatzki ring'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'sedation contraindications'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'sedation reactions'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'able to swallow saliva?',
          'drooling', 'subcutaneous emphysema (perforation)',
          'neck tenderness', 'abdominal signs',
        ],
        prompt: 'Assess airway. Can patient swallow saliva? Check for subcutaneous emphysema (perforation risk).',
      },
      {
        section: 'radiology',
        required: true,
        focus: ['lateral soft tissue neck X-ray', 'CXR', 'AXR (radiopaque FB)', 'CT neck/chest if perforation suspected'],
      },
    ],
    suggestedInvestigations: [
      'Lateral neck X-ray', 'CXR', 'AXR', 'CT neck/chest (if perforation suspected)',
      'OGD (therapeutic — removal)', 'FBC', 'CRP',
    ],
    differentials: [
      'Food bolus impaction', 'Foreign body (sharp/blunt)',
      'Button battery ingestion', 'Oesophageal stricture',
      'Eosinophilic oesophagitis', 'Oesophageal carcinoma', 'Oesophageal perforation',
    ],
    redFlagSymptoms: [
      'unable to swallow saliva', 'drooling', 'subcutaneous emphysema',
      'fever (perforation)', 'button battery (urgent removal)',
      'sharp object', 'respiratory compromise',
    ],
    examFocus: [
      'Airway assessment',
      'Neck — tenderness, crepitus',
      'Abdomen — peritonism',
    ],
  },

  // =========================================================================
  //  HEPATOBILIARY
  // =========================================================================

  {
    id: 'jaundice-workup',
    name: 'Jaundice Workup',
    specialty: 'hepatobiliary',
    triggerSymptoms: ['jaundice'],
    triggerKeywords: [
      'jaundice', 'yellow skin', 'yellow eyes', 'dark urine',
      'pale stool', 'clay coloured stool', 'icterus',
      'obstructive jaundice', 'cholestatic',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations', 'radiology'],
    optionalSections: ['allergies', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'onset and duration', 'pain vs painless jaundice',
          'dark urine, pale stools, pruritus',
          'alcohol history', 'hepatitis risk factors',
          'travel history', 'drug history (hepatotoxins)',
          'previous biliary surgery', 'blood transfusion history',
        ],
        prompt: 'Distinguish obstructive (surgical) from hepatocellular jaundice. Painless = ?malignancy.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['hepatotoxic drugs', 'herbal medicines', 'paracetamol', 'antibiotics', 'anticoagulants (coagulopathy)'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'jaundice depth — sclera, skin, sublingual',
          'liver — size, consistency, tenderness',
          'gallbladder — palpable (Courvoisier\'s sign)',
          'splenomegaly', 'ascites',
          'stigmata of chronic liver disease',
          'scratch marks (pruritus)',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: [
          'LFTs — bilirubin (total/direct), ALP, GGT, AST, ALT',
          'FBC', 'coagulation screen', 'albumin',
          'hepatitis serology (A, B, C)',
          'USS abdomen (first-line imaging)',
        ],
      },
      {
        section: 'radiology',
        required: true,
        focus: ['USS abdomen — bile ducts, liver, gallbladder', 'MRCP (if dilated ducts)', 'CT abdomen (if mass suspected)', 'EUS'],
      },
    ],
    suggestedInvestigations: [
      'LFTs', 'Bilirubin (total/direct)', 'FBC', 'Coagulation screen',
      'Albumin', 'Hepatitis A/B/C serology', 'USS abdomen',
      'MRCP', 'CT abdomen', 'EUS', 'CA 19-9', 'AFP',
      'Reticulocyte count (haemolysis screen)', 'Haptoglobin', 'LDH',
    ],
    differentials: [
      'Choledocholithiasis', 'Cholangiocarcinoma', 'Pancreatic head carcinoma',
      'Hepatitis (viral/alcoholic/drug-induced)', 'Cirrhosis',
      'Haemolytic anaemia', 'Gilbert\'s syndrome',
      'Primary biliary cholangitis', 'Primary sclerosing cholangitis',
      'Ampullary tumour', 'Liver metastases',
    ],
    redFlagSymptoms: [
      'painless progressive jaundice', 'palpable gallbladder',
      'weight loss', 'Charcot\'s triad (fever + jaundice + RUQ pain)',
      'coagulopathy', 'encephalopathy',
    ],
    examFocus: [
      'Jaundice — depth and distribution',
      'Liver — size, consistency',
      'Gallbladder — palpable',
      'Stigmata of chronic liver disease',
      'Ascites',
    ],
  },

  {
    id: 'liver-lesion',
    name: 'Liver Lesion / Hepatic Mass',
    specialty: 'hepatobiliary',
    triggerSymptoms: ['abdominal_pain', 'weight_loss'],
    triggerKeywords: [
      'liver mass', 'liver lesion', 'hepatic mass', 'liver tumour',
      'liver tumor', 'liver cyst', 'hcc', 'hepatocellular carcinoma',
      'liver metastasis', 'liver metastases', 'hepatomegaly',
      'liver abscess', 'focal liver lesion', 'incidental liver lesion',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations', 'radiology'],
    optionalSections: ['allergies', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'hepatitis B/C status', 'cirrhosis', 'alcohol history',
          'previous malignancy', 'OCP/steroid use',
          'metabolic syndrome/NAFLD', 'travel history',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['OCP', 'anabolic steroids', 'hepatotoxic drugs', 'anticoagulants'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'hepatomegaly — size, consistency, tenderness',
          'ascites', 'splenomegaly',
          'stigmata of chronic liver disease',
          'lymphadenopathy', 'jaundice',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['LFTs', 'AFP', 'CEA', 'CA 19-9', 'hepatitis B/C serology', 'FBC', 'coagulation', 'albumin'],
      },
      {
        section: 'radiology',
        required: true,
        focus: [
          'triple-phase CT liver or MRI liver with contrast',
          'USS abdomen', 'PET-CT if metastatic workup',
        ],
        prompt: 'Triple-phase CT or gadolinium-enhanced MRI for characterisation. Biopsy only if diagnosis uncertain and safe.',
      },
    ],
    suggestedInvestigations: [
      'LFTs', 'AFP', 'CEA', 'CA 19-9', 'Hepatitis B/C serology',
      'FBC', 'Coagulation screen', 'Albumin',
      'Triple-phase CT liver', 'MRI liver with contrast',
      'USS liver', 'PET-CT', 'Liver biopsy (if indicated)',
    ],
    differentials: [
      'Hepatocellular carcinoma', 'Liver metastases', 'Hepatic adenoma',
      'Focal nodular hyperplasia', 'Haemangioma', 'Simple cyst',
      'Liver abscess (pyogenic/amoebic)', 'Hydatid cyst',
      'Cholangiocarcinoma (intrahepatic)',
    ],
    redFlagSymptoms: [
      'known malignancy + new liver lesion', 'rapidly enlarging mass',
      'jaundice with liver mass', 'ascites with mass',
      'weight loss', 'rupture (acute abdomen + liver mass)',
    ],
    examFocus: [
      'Liver — hepatomegaly, consistency, tenderness',
      'Abdomen — ascites, splenomegaly',
      'Lymph nodes — supraclavicular (Virchow\'s)',
      'Stigmata of chronic liver disease',
    ],
  },

  {
    id: 'pancreatic-mass',
    name: 'Pancreatic Mass / Cyst',
    specialty: 'hepatobiliary',
    triggerSymptoms: ['jaundice', 'weight_loss', 'abdominal_pain'],
    triggerKeywords: [
      'pancreatic mass', 'pancreatic cyst', 'pancreatic cancer',
      'pancreatic tumour', 'pancreatic tumor', 'ampullary',
      'whipple', 'ipmn', 'mucinous cyst', 'serous cystadenoma',
      'pancreatic pseudocyst', 'neuroendocrine tumour',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations', 'radiology'],
    optionalSections: ['allergies', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'new-onset diabetes', 'chronic pancreatitis',
          'alcohol and smoking history', 'family history pancreatic cancer',
          'weight loss and duration', 'jaundice onset',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['diabetes medications (new-onset DM)', 'anticoagulants', 'pancreatic enzyme supplements'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'jaundice', 'epigastric mass', 'palpable gallbladder',
          'ascites', 'cachexia', 'Trousseau\'s sign (migratory thrombophlebitis)',
          'hepatomegaly',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['LFTs', 'CA 19-9', 'CEA', 'FBC', 'glucose/HbA1c', 'amylase/lipase', 'coagulation screen'],
      },
      {
        section: 'radiology',
        required: true,
        focus: [
          'CT pancreas protocol (triple-phase)',
          'MRI/MRCP',
          'EUS with FNA',
          'PET-CT (staging)',
        ],
        prompt: 'Pancreas-protocol CT for initial assessment. EUS+FNA for tissue diagnosis. MRCP for cystic lesions.',
      },
    ],
    suggestedInvestigations: [
      'CT pancreas protocol', 'MRI/MRCP', 'EUS with FNA',
      'LFTs', 'CA 19-9', 'CEA', 'FBC', 'HbA1c', 'Glucose',
      'Amylase/Lipase', 'Coagulation screen', 'PET-CT',
      'Cyst fluid analysis (CEA, amylase, cytology)',
    ],
    differentials: [
      'Pancreatic ductal adenocarcinoma', 'Ampullary carcinoma',
      'Neuroendocrine tumour (NET)', 'IPMN', 'Mucinous cystadenoma',
      'Serous cystadenoma', 'Pancreatic pseudocyst',
      'Chronic pancreatitis', 'Autoimmune pancreatitis',
      'Solid pseudopapillary tumour',
    ],
    redFlagSymptoms: [
      'painless progressive jaundice', 'new-onset diabetes',
      'rapid weight loss', 'back pain radiating through',
      'Trousseau\'s sign', 'palpable gallbladder',
    ],
    examFocus: [
      'Jaundice — depth',
      'Abdomen — epigastric mass, gallbladder, ascites',
      'General — cachexia, DVT signs',
      'Lymph nodes — left supraclavicular (Virchow\'s)',
    ],
  },

  // =========================================================================
  //  VASCULAR
  // =========================================================================

  {
    id: 'diabetic-foot',
    name: 'Diabetic Foot',
    specialty: 'vascular',
    triggerSymptoms: ['abdominal_pain'],
    triggerKeywords: [
      'diabetic foot', 'foot ulcer', 'foot wound', 'gangrene',
      'foot infection', 'osteomyelitis', 'exposed bone',
      'spreading redness', 'neuropathic ulcer', 'charcot foot',
      'diabetic wound', 'toe amputation',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros', 'allergies'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'diabetes type and duration', 'HbA1c',
          'neuropathy', 'retinopathy', 'nephropathy',
          'peripheral vascular disease', 'previous amputation',
          'previous ulcers', 'cardiac history',
        ],
        prompt: 'Full diabetic complications assessment. Document HbA1c and vascular status.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['insulin regimen', 'oral hypoglycaemics', 'anticoagulants', 'statins', 'antihypertensives', 'current antibiotics'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'Wagner grading (0-5)',
          'wound — size, depth, base, edges, discharge',
          'peripheral pulses — DP, PT (palpation and Doppler)',
          'ABPI if equipment available',
          'sensation — monofilament, vibration',
          'foot deformity — Charcot, claw toes, bunion',
          'interdigital spaces',
          'temperature of foot',
          'cellulitis extent — mark and date margin',
        ],
        prompt: 'Wagner grade the ulcer. Mark cellulitis margins. Assess pulses and sensation bilaterally.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'CRP', 'HbA1c', 'glucose', 'U&E', 'wound swab MC&S', 'foot X-ray (osteomyelitis)'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['foot X-ray', 'MRI foot (osteomyelitis)', 'arterial duplex', 'CT angiography (if revascularisation considered)'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'HbA1c', 'Glucose', 'U&E', 'Wound swab MC&S',
      'Foot X-ray', 'MRI foot (osteomyelitis)', 'Arterial duplex',
      'CT angiography', 'ABPI', 'Blood cultures (if septic)',
    ],
    differentials: [
      'Neuropathic ulcer', 'Ischaemic ulcer', 'Neuro-ischaemic ulcer',
      'Cellulitis', 'Osteomyelitis', 'Charcot neuroarthropathy',
      'Gangrene (wet/dry)', 'Necrotising fasciitis', 'Gout',
    ],
    redFlagSymptoms: [
      'spreading cellulitis with fever', 'wet gangrene',
      'exposed bone', 'crepitus (gas gangrene/necrotising fasciitis)',
      'systemically unwell', 'critical limb ischaemia (rest pain)',
    ],
    examFocus: [
      'Foot — ulcer assessment (Wagner), pulses, sensation',
      'Vascular — pedal pulses, capillary refill, temperature',
      'Neurological — monofilament, vibration, ankle reflexes',
      'Both feet — comparison',
    ],
  },

  {
    id: 'varicose-veins',
    name: 'Varicose Veins',
    specialty: 'vascular',
    triggerSymptoms: [],
    triggerKeywords: [
      'varicose veins', 'varicose', 'leg veins', 'spider veins',
      'venous ulcer', 'leg ulcer', 'venous insufficiency',
      'leg swelling', 'lipodermatosclerosis', 'venous eczema',
    ],
    requiredSections: ['pmh', 'examination'],
    optionalSections: ['medications', 'investigations', 'radiology'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'DVT history', 'previous varicose vein surgery',
          'family history', 'occupation (prolonged standing)',
          'pregnancies', 'leg ulcer history',
        ],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'distribution — GSV, SSV, both',
          'CEAP classification',
          'skin changes — eczema, pigmentation, lipodermatosclerosis',
          'ulceration',
          'oedema',
          'cough impulse at SFJ/SPJ',
          'tap test',
          'tourniquet test',
          'peripheral pulses (exclude arterial disease)',
        ],
        prompt: 'Examine standing. CEAP classification. Assess both legs. Check pulses to exclude arterial disease.',
      },
      {
        section: 'investigations',
        required: false,
        focus: ['venous duplex ultrasound', 'ABPI (if ulcer)', 'FBC (if ulcer)'],
      },
    ],
    suggestedInvestigations: [
      'Venous duplex ultrasound', 'ABPI', 'FBC', 'Iron studies (if ulcer)',
    ],
    differentials: [
      'Primary varicose veins (GSV/SSV)', 'Chronic venous insufficiency',
      'Venous ulcer', 'DVT', 'Arteriovenous malformation',
      'Lymphoedema', 'Lipodystrophy',
    ],
    redFlagSymptoms: [
      'acute DVT symptoms', 'bleeding varicose vein',
      'non-healing ulcer', 'rapidly worsening oedema',
    ],
    examFocus: [
      'Legs — standing examination, distribution, CEAP',
      'Skin — trophic changes, ulceration',
      'Peripheral pulses',
    ],
  },

  {
    id: 'pvd',
    name: 'Peripheral Vascular Disease',
    specialty: 'vascular',
    triggerSymptoms: [],
    triggerKeywords: [
      'peripheral vascular disease', 'pvd', 'pad', 'claudication',
      'leg pain walking', 'cold feet', 'cold foot', 'poor circulation',
      'rest pain', 'critical limb ischaemia', 'intermittent claudication',
      'absent pulses',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'cardiovascular risk factors — DM, HTN, smoking, dyslipidaemia',
          'claudication distance', 'rest pain',
          'previous vascular intervention',
          'coronary/cerebrovascular disease',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['antiplatelets', 'statins', 'antihypertensives', 'diabetes medications', 'cilostazol'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'peripheral pulses — femoral, popliteal, DP, PT',
          'capillary refill time',
          'skin — colour, temperature, hair loss, trophic changes',
          'ulceration',
          'Buerger\'s test (angle)',
          'bruits — femoral, aortic',
          'ABPI',
        ],
        prompt: 'Bilateral pulse assessment. ABPI if equipment available. Fontaine/Rutherford classification.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['ABPI', 'FBC', 'HbA1c', 'lipid profile', 'U&E', 'ECG'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['arterial duplex ultrasound', 'CT angiography', 'MR angiography'],
      },
    ],
    suggestedInvestigations: [
      'ABPI', 'Arterial duplex ultrasound', 'FBC', 'HbA1c',
      'Lipid profile', 'U&E', 'ECG', 'CT angiography',
      'MR angiography', 'Toe pressures', 'TcPO2',
    ],
    differentials: [
      'Atherosclerotic PAD', 'Buerger\'s disease', 'Popliteal entrapment',
      'Spinal stenosis (neurogenic claudication)', 'Compartment syndrome (chronic)',
      'DVT', 'Raynaud\'s disease', 'Vasculitis',
    ],
    redFlagSymptoms: [
      'rest pain', 'nocturnal pain relieved by dependency',
      'tissue loss / gangrene', 'acute limb ischaemia (6 Ps)',
      'critical ABPI < 0.5',
    ],
    examFocus: [
      'Peripheral pulses — bilateral comparison',
      'Feet — colour, temperature, trophic changes, ulcers',
      'ABPI measurement',
      'Buerger\'s test',
    ],
  },

  // =========================================================================
  //  WELLNESS / SCREENING
  // =========================================================================

  {
    id: 'new-patient-screening',
    name: 'New Patient Screening',
    specialty: 'wellness',
    triggerSymptoms: ['general_screening'],
    triggerKeywords: [
      'new patient', 'first visit', 'registration', 'initial consultation',
      'new consult', 'general screening',
    ],
    requiredSections: ['pmh', 'surgical', 'medications', 'allergies', 'examination', 'ros'],
    optionalSections: ['investigations'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'chronic diseases — DM, HTN, heart disease, asthma, COPD',
          'previous hospitalisation',
          'family history — cancer, heart disease, diabetes',
          'obstetric/gynaecological history (female)',
          'vaccination status',
        ],
        prompt: 'Comprehensive PMH for first visit. Document all active conditions and family history.',
      },
      {
        section: 'surgical',
        required: true,
        focus: ['all previous surgeries with dates', 'anaesthetic complications'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['complete medication list including OTC and supplements'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies with reaction type', 'food allergies', 'latex'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'general appearance', 'BMI', 'blood pressure',
          'cardiovascular — heart sounds', 'respiratory — breath sounds',
          'abdomen — organomegaly, masses, herniae',
          'lymph nodes',
        ],
      },
      {
        section: 'ros',
        required: true,
        focus: ['full systems review — constitutional, cardiovascular, respiratory, GI, GU, MSK, neurological, skin'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'U&E', 'LFTs', 'Glucose / HbA1c', 'Lipid profile',
      'Urinalysis', 'ECG (age > 40 or cardiac risk)',
    ],
    differentials: [],
    redFlagSymptoms: [
      'undiagnosed weight loss', 'new lump/mass',
      'undiagnosed rectal bleeding', 'new dysphagia',
    ],
    examFocus: [
      'General — BMI, blood pressure',
      'Cardiovascular — heart sounds',
      'Abdomen — organomegaly, herniae',
      'Full systems if first encounter',
    ],
  },

  {
    id: 'pre-op-assessment',
    name: 'Pre-operative Assessment',
    specialty: 'wellness',
    triggerSymptoms: [],
    triggerKeywords: [
      'pre-op', 'pre op', 'preoperative', 'pre-operative assessment',
      'fitness for surgery', 'asa', 'pre-admission', 'surgical fitness',
    ],
    requiredSections: ['pmh', 'surgical', 'medications', 'allergies', 'examination', 'investigations'],
    optionalSections: ['ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'cardiac history — IHD, heart failure, valvular, arrhythmia',
          'respiratory — asthma, COPD, sleep apnoea',
          'diabetes and control',
          'renal function',
          'liver disease',
          'exercise tolerance (METS)',
          'ASA classification',
        ],
        prompt: 'Assess ASA grade. Document METS equivalent. Identify conditions requiring optimisation before surgery.',
      },
      {
        section: 'surgical',
        required: true,
        focus: ['planned procedure', 'previous anaesthetic complications', 'difficult intubation history', 'previous surgeries'],
      },
      {
        section: 'medications',
        required: true,
        focus: [
          'anticoagulants — bridging plan',
          'antiplatelets', 'diabetes medications — peri-operative plan',
          'antihypertensives', 'inhalers', 'steroids',
          'MAOIs', 'herbal medicines',
        ],
        prompt: 'Anticoagulant bridging plan required. Diabetes medication peri-operative adjustment.',
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'latex', 'contrast', 'adhesive tape'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'airway — Mallampati, neck mobility, dentition',
          'cardiovascular — BP, murmurs, JVP',
          'respiratory — breath sounds, SpO2',
          'BMI',
          'venous access',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'U&E', 'coagulation screen', 'group & save', 'ECG', 'CXR (if indicated)', 'HbA1c (diabetics)', 'echocardiogram (if cardiac concerns)'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'U&E', 'Coagulation screen', 'Group & save',
      'ECG', 'CXR (if respiratory/cardiac disease)', 'HbA1c',
      'Echocardiogram (if indicated)', 'Spirometry (if COPD)',
      'Blood glucose', 'LFTs',
    ],
    differentials: [],
    redFlagSymptoms: [
      'exercise tolerance < 4 METS', 'recent MI/stroke',
      'decompensated heart failure', 'severe valvular disease',
      'uncontrolled diabetes (HbA1c > 69 mmol/mol)',
      'difficult airway history', 'family history MH',
    ],
    examFocus: [
      'Airway — Mallampati score, neck mobility, dentition',
      'Cardiovascular — BP, heart sounds, JVP',
      'Respiratory — breath sounds, SpO2',
      'BMI and body habitus',
    ],
  },

  {
    id: 'annual-health-check',
    name: 'Annual Health Check',
    specialty: 'wellness',
    triggerSymptoms: ['general_screening'],
    triggerKeywords: [
      'annual check', 'health check', 'yearly check', 'routine check',
      'wellness', 'preventive', 'check-up', 'checkup',
    ],
    requiredSections: ['pmh', 'medications', 'examination'],
    optionalSections: ['surgical', 'allergies', 'investigations', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'update on chronic conditions', 'new symptoms since last visit',
          'family history update', 'screening test status',
          'vaccination status', 'lifestyle — diet, exercise, smoking, alcohol',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['medication reconciliation', 'compliance', 'side effects'],
      },
      {
        section: 'examination',
        required: true,
        focus: ['BP', 'BMI', 'cardiovascular screen', 'abdominal — herniae, organomegaly', 'skin survey', 'DRE (age-appropriate)'],
      },
      {
        section: 'investigations',
        required: false,
        focus: ['FBC', 'glucose/HbA1c', 'lipid profile', 'U&E', 'LFTs', 'urinalysis', 'PSA (male > 50)', 'FIT/FOBT (> 45)'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'HbA1c / Fasting glucose', 'Lipid profile',
      'U&E', 'LFTs', 'Urinalysis', 'PSA (male > 50)',
      'FIT / FOBT (> 45)', 'ECG (> 40 with risk factors)',
    ],
    differentials: [],
    redFlagSymptoms: [
      'new unintentional weight loss', 'new lump', 'new rectal bleeding',
      'uncontrolled hypertension', 'undiagnosed diabetes symptoms',
    ],
    examFocus: [
      'BP and BMI',
      'Cardiovascular screen',
      'Abdomen — herniae, masses',
      'Age/sex-appropriate cancer screening',
    ],
  },

  {
    id: 'cancer-screening',
    name: 'Cancer Screening (Age/Sex Appropriate)',
    specialty: 'wellness',
    triggerSymptoms: ['general_screening', 'weight_loss'],
    triggerKeywords: [
      'cancer screening', 'colonoscopy screening', 'breast screening',
      'mammogram', 'psa', 'prostate screening', 'cervical screening',
      'fit test', 'fobt', 'cancer risk', 'family history cancer',
    ],
    requiredSections: ['pmh', 'examination'],
    optionalSections: ['medications', 'allergies', 'investigations'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'family history — all cancers (type, age at diagnosis, degree of relation)',
          'previous cancer diagnosis', 'previous screening results',
          'genetic testing (BRCA, Lynch)',
          'risk factors — smoking, alcohol, obesity, radiation exposure',
        ],
        prompt: 'Stratify cancer risk by age, sex, family history, and modifiable risk factors.',
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'breast exam (female > 30 or with risk factors)',
          'DRE / prostate (male > 50)',
          'lymph node survey',
          'abdominal — organomegaly',
          'skin — suspicious lesions',
          'thyroid',
        ],
      },
      {
        section: 'investigations',
        required: false,
        focus: [
          'FIT / FOBT (colorectal, > 45)',
          'colonoscopy (> 50 or family history)',
          'mammogram (female > 40)',
          'PSA (male > 50, discuss)',
          'FBC and iron studies',
        ],
      },
    ],
    suggestedInvestigations: [
      'FIT / FOBT', 'Colonoscopy', 'Mammogram', 'Breast USS',
      'PSA', 'FBC', 'Iron studies', 'CEA', 'CA 19-9',
      'Thyroid USS', 'CXR (high-risk smokers)',
    ],
    differentials: [],
    redFlagSymptoms: [
      'new unexplained weight loss', 'new lump/mass',
      'rectal bleeding', 'change in bowel habit',
      'dysphagia', 'postmenopausal bleeding',
      'haematuria', 'persistent hoarseness',
    ],
    examFocus: [
      'Breast examination',
      'DRE',
      'Lymph node survey',
      'Skin — moles/lesions',
      'Thyroid',
    ],
  },

  // =========================================================================
  //  COLORECTAL (additional)
  // =========================================================================

  {
    id: 'diverticular-disease',
    name: 'Diverticular Disease / Diverticulitis',
    specialty: 'colorectal',
    triggerSymptoms: ['abdominal_pain', 'rectal_bleeding', 'change_in_bowel_habit'],
    triggerKeywords: [
      'diverticulitis', 'diverticular disease', 'diverticulosis',
      'left iliac fossa pain', 'lif pain', 'sigmoid', 'diverticular abscess',
      'diverticular bleed',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros', 'allergies'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'previous episodes of diverticulitis',
          'previous CT findings', 'complications — abscess, fistula, stricture',
          'fibre intake and bowel habit',
          'immunosuppression', 'anticoagulation',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['antibiotics (current/previous)', 'NSAIDs', 'opioids', 'anticoagulants', 'immunosuppressants'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'LIF tenderness', 'localised vs diffuse peritonism',
          'mass (phlegmon/abscess)', 'fever',
          'DRE', 'abdominal distension',
        ],
        prompt: 'Localised LIF tenderness is typical. Look for mass (phlegmon). Diffuse peritonism → ?perforation.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'CRP', 'U&E', 'urinalysis', 'blood cultures (if febrile)'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['CT abdomen-pelvis with IV contrast (gold standard)', 'AXR', 'colonoscopy (6-8 weeks after resolution — to exclude CRC)'],
        prompt: 'CT in acute setting. Colonoscopy 6-8 weeks post-episode to exclude malignancy.',
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'U&E', 'Urinalysis', 'Blood cultures',
      'CT abdomen-pelvis', 'Colonoscopy (elective, post-resolution)',
    ],
    differentials: [
      'Acute diverticulitis (uncomplicated)', 'Diverticular abscess',
      'Diverticular perforation', 'Colorectal carcinoma',
      'IBD', 'Ischaemic colitis', 'Appendicitis (right-sided)',
      'Gynaecological (ovarian cyst, PID)', 'Urinary tract infection',
    ],
    redFlagSymptoms: [
      'diffuse peritonism (perforation)', 'sepsis', 'pneumoperitoneum',
      'large abscess', 'fistula (faeculuria, pneumaturia)',
      'recurrent episodes requiring surgery discussion',
    ],
    examFocus: [
      'Abdomen — LIF tenderness, mass, peritonism',
      'DRE',
      'Vital signs — sepsis screening',
    ],
  },

  {
    id: 'ibd-surgical',
    name: 'IBD — Surgical Complications (Crohn\'s / UC)',
    specialty: 'colorectal',
    triggerSymptoms: ['rectal_bleeding', 'abdominal_pain', 'change_in_bowel_habit', 'weight_loss'],
    triggerKeywords: [
      'crohn', "crohn's", 'ulcerative colitis', 'uc', 'ibd',
      'inflammatory bowel disease', 'stricture', 'fistula',
      'perianal crohn', 'toxic megacolon', 'colectomy',
    ],
    requiredSections: ['pmh', 'medications', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros', 'allergies', 'surgical'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: [
          'disease type (Crohn\'s / UC)', 'Montreal classification',
          'disease duration', 'previous flares and hospitalisations',
          'extra-intestinal manifestations', 'previous surgery',
        ],
      },
      {
        section: 'medications',
        required: true,
        focus: ['5-ASA', 'steroids', 'azathioprine/6-MP', 'biologics (infliximab, adalimumab)', 'methotrexate', 'antibiotics'],
        prompt: 'Document current biologic and immunosuppressive therapy. Note steroid history.',
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'abdominal — mass, tenderness, distension',
          'perianal — fistulae, abscess, skin tags',
          'stoma (if present)',
          'nutritional status — BMI, muscle wasting',
          'extra-intestinal — joints, skin, eyes',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'CRP', 'ESR', 'albumin', 'iron studies', 'faecal calprotectin', 'stool MC&S', 'U&E', 'LFTs'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['MRI small bowel (Crohn\'s)', 'MRI pelvis (perianal disease)', 'CT abdomen (acute)', 'colonoscopy with biopsies'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'ESR', 'Albumin', 'Iron studies', 'Faecal calprotectin',
      'Stool MC&S', 'U&E', 'LFTs', 'Vitamin B12 / folate',
      'MRI small bowel', 'MRI pelvis', 'Colonoscopy', 'CT abdomen (acute)',
    ],
    differentials: [
      'Crohn\'s disease — stricture', 'Crohn\'s — perianal disease',
      'UC — acute severe colitis', 'Toxic megacolon',
      'Colorectal carcinoma (on IBD background)',
      'Abscess', 'Fistula (entero-enteric, entero-vesical, entero-cutaneous)',
    ],
    redFlagSymptoms: [
      'toxic megacolon (dilated > 6 cm)', 'perforation',
      'massive haemorrhage', 'high-output fistula',
      'sepsis', 'malnutrition requiring parenteral nutrition',
    ],
    examFocus: [
      'Abdomen — mass, distension, tenderness',
      'Perianal — fistulae, abscess',
      'Nutritional status',
      'Extra-intestinal manifestations',
    ],
  },

  // =========================================================================
  //  EMERGENCY (pathway for ER-redirect CC triggers)
  // =========================================================================

  {
    id: 'chest-pain-emergency',
    name: 'Chest Pain — Emergency Redirect',
    specialty: 'emergency',
    triggerSymptoms: [],
    triggerKeywords: [
      'chest pain', 'crushing pain', 'left arm pain', 'jaw pain',
      'tearing pain', 'cardiac', 'heart attack', 'acs',
    ],
    requiredSections: ['examination'],
    optionalSections: ['pmh', 'medications'],
    fields: [
      {
        section: 'examination',
        required: true,
        focus: ['ECG', 'BP both arms', 'SpO2', 'auscultation'],
        prompt: 'This patient should be redirected to emergency services. If in clinic, ECG within 10 minutes.',
      },
    ],
    suggestedInvestigations: [
      'ECG', 'Troponin (0h and 3h)', 'CXR', 'D-dimer',
      'CT angiography (if dissection suspected)', 'ABG',
    ],
    differentials: [
      'Acute coronary syndrome (STEMI/NSTEMI)', 'Aortic dissection',
      'Pulmonary embolism', 'Tension pneumothorax',
      'Oesophageal rupture', 'Pericarditis',
    ],
    redFlagSymptoms: [
      'ST elevation', 'haemodynamic instability',
      'unequal arm BP (dissection)', 'hypoxia',
      'new murmur', 'pulseless',
    ],
    examFocus: [
      'ECG', 'BP both arms', 'Heart sounds', 'Lung fields',
    ],
  },

  {
    id: 'acute-limb-ischaemia',
    name: 'Acute Limb Ischaemia — Emergency',
    specialty: 'emergency',
    triggerSymptoms: [],
    triggerKeywords: [
      'acute limb ischaemia', 'pulseless leg', 'pulseless foot',
      'white leg', 'cold leg', 'blue foot', 'blue toe',
      'acute ischaemia', 'embolus leg',
    ],
    requiredSections: ['examination', 'investigations'],
    optionalSections: ['pmh', 'medications'],
    fields: [
      {
        section: 'examination',
        required: true,
        focus: [
          '6 Ps — pain, pallor, pulselessness, paraesthesia, paralysis, perishing cold',
          'capillary refill', 'Doppler signals',
          'sensation and motor function',
          'contralateral limb comparison',
        ],
        prompt: 'Urgent vascular surgical referral. Assess 6 Ps. Heparin bolus if no contraindication.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'coagulation screen', 'U&E', 'CK (if delayed)', 'ECG (AF source)', 'group & save'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'Coagulation screen', 'U&E', 'CK', 'Group & save',
      'ECG', 'CT angiography', 'Duplex USS',
    ],
    differentials: [
      'Arterial embolism (cardiac source)', 'Arterial thrombosis (atherosclerotic)',
      'Popliteal aneurysm thrombosis', 'Aortic dissection with limb malperfusion',
      'Compartment syndrome', 'DVT (phlegmasia)',
    ],
    redFlagSymptoms: [
      'paralysis (irreversible ischaemia)', 'mottled/fixed discolouration',
      'absent Doppler signal', 'compartment syndrome signs',
    ],
    examFocus: [
      '6 Ps assessment',
      'Doppler — arterial and venous signals',
      'Sensation and motor',
      'Contralateral comparison',
    ],
  },

  // =========================================================================
  //  ADDITIONAL GENERAL SURGERY
  // =========================================================================

  {
    id: 'appendicitis',
    name: 'Acute Appendicitis',
    specialty: 'general_surgery',
    triggerSymptoms: ['abdominal_pain', 'nausea_vomiting'],
    triggerKeywords: [
      'appendicitis', 'appendix', 'rlq pain',
      'right lower quadrant', 'right iliac fossa', 'rif pain',
      'mcburney', 'rovsing', 'periumbilical pain',
    ],
    requiredSections: ['pmh', 'medications', 'allergies', 'examination', 'investigations'],
    optionalSections: ['radiology', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous appendicectomy', 'pregnancy status (females)', 'immunosuppression'],
      },
      {
        section: 'medications',
        required: true,
        focus: ['anticoagulants', 'steroids', 'immunosuppressants'],
      },
      {
        section: 'allergies',
        required: true,
        focus: ['drug allergies', 'anaesthetic reactions'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'RIF/RLQ tenderness', 'McBurney\'s point',
          'Rovsing\'s sign', 'psoas sign', 'obturator sign',
          'rebound tenderness', 'guarding',
          'fever', 'tachycardia',
          'DRE if pelvic appendix suspected',
        ],
        prompt: 'Alvarado score components. Document rebound, guarding, Rovsing\'s. Pregnancy test in females.',
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC (leucocytosis)', 'CRP', 'urinalysis', 'pregnancy test', 'blood group & save'],
      },
      {
        section: 'radiology',
        required: false,
        focus: ['CT abdomen-pelvis (adults)', 'USS (children, pregnant)', 'AXR (less useful)'],
      },
    ],
    suggestedInvestigations: [
      'FBC', 'CRP', 'Urinalysis', 'Pregnancy test',
      'Blood group & save', 'CT abdomen-pelvis', 'USS (if paediatric/pregnant)',
    ],
    differentials: [
      'Acute appendicitis', 'Mesenteric lymphadenitis',
      'Meckel\'s diverticulitis', 'Crohn\'s ileitis',
      'Right ovarian cyst/torsion', 'Ectopic pregnancy',
      'Right ureteric colic', 'Caecal diverticulitis',
      'Caecal carcinoma',
    ],
    redFlagSymptoms: [
      'diffuse peritonism (perforation)', 'sepsis',
      'mass (appendix abscess)', 'pregnancy with RIF pain',
    ],
    examFocus: [
      'RIF — McBurney\'s point, rebound, guarding',
      'Rovsing\'s, psoas, obturator signs',
      'DRE if pelvic appendix',
      'Vital signs',
    ],
  },

  {
    id: 'bowel-obstruction',
    name: 'Bowel Obstruction (Small / Large)',
    specialty: 'general_surgery',
    triggerSymptoms: ['abdominal_pain', 'nausea_vomiting'],
    triggerKeywords: [
      'bowel obstruction', 'intestinal obstruction', 'sbo',
      'small bowel obstruction', 'large bowel obstruction', 'lbo',
      'volvulus', 'not passing gas', 'not passing stool',
      'distension', 'absolute constipation', 'obstructed',
    ],
    requiredSections: ['pmh', 'surgical', 'medications', 'examination', 'investigations', 'radiology'],
    optionalSections: ['allergies', 'ros'],
    fields: [
      {
        section: 'pmh',
        required: true,
        focus: ['previous abdominal surgery (adhesions)', 'hernia', 'malignancy', 'IBD', 'diverticular disease'],
      },
      {
        section: 'surgical',
        required: true,
        focus: ['all previous abdominal/pelvic operations', 'hernia repairs'],
        prompt: 'Adhesional SBO is the commonest cause. Detailed surgical history essential.',
      },
      {
        section: 'medications',
        required: true,
        focus: ['opioids (ileus)', 'anticholinergics', 'anticoagulants'],
      },
      {
        section: 'examination',
        required: true,
        focus: [
          'distension', 'bowel sounds — high-pitched/absent',
          'tenderness — localised vs diffuse',
          'peritonism (strangulation)',
          'hernial orifices', 'DRE — empty rectum, mass',
          'scars',
        ],
      },
      {
        section: 'investigations',
        required: true,
        focus: ['FBC', 'U&E', 'lactate', 'blood gas', 'group & save'],
      },
      {
        section: 'radiology',
        required: true,
        focus: ['AXR — dilated loops, air-fluid levels', 'CT abdomen with IV contrast — transition point, strangulation signs', 'water-soluble contrast (Gastrografin) study for SBO'],
        prompt: 'CT to identify transition point and exclude strangulation. Gastrografin challenge for adhesional SBO.',
      },
    ],
    suggestedInvestigations: [
      'FBC', 'U&E', 'Lactate', 'Blood gas', 'Group & save',
      'AXR', 'CT abdomen-pelvis with IV contrast',
      'Gastrografin follow-through (SBO)', 'CRP',
    ],
    differentials: [
      'Adhesional SBO', 'Incarcerated hernia', 'Malignant LBO',
      'Sigmoid volvulus', 'Caecal volvulus', 'Gallstone ileus',
      'Crohn\'s stricture', 'Paralytic ileus', 'Pseudo-obstruction (Ogilvie)',
    ],
    redFlagSymptoms: [
      'absent bowel sounds', 'peritonism (strangulation)',
      'elevated lactate', 'fever with obstruction',
      'unable to pass gas and stool (absolute constipation)',
      'tachycardia with obstruction',
    ],
    examFocus: [
      'Abdomen — distension, bowel sounds, tenderness',
      'Hernial orifices — all',
      'DRE — rectal mass, empty rectum',
      'Scars (adhesion risk)',
    ],
  },
];
