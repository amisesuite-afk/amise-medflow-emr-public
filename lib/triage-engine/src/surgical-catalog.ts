/**
 * Comprehensive surgical procedure catalog for Dr Kabiye's outpatient
 * general and endoscopic surgery practice (Amise Medical Services, Saint Lucia).
 *
 * Contains CPT-coded procedure definitions with pre-op requirements,
 * post-op care, ICD-10 indications, complications, and cross-references.
 *
 * Consumed by both the Vite frontend (dashboard) and esbuild backend
 * (API server) via the shared `@workspace/triage-engine` package.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurgicalProcedure {
  code: string;
  name: string;
  category:
    | 'general'
    | 'endoscopy'
    | 'breast'
    | 'colorectal'
    | 'hepatobiliary'
    | 'vascular'
    | 'anorectal'
    | 'skin'
    | 'other';
  complexity: 'minor' | 'intermediate' | 'major' | 'complex';
  anaesthesia: string[];
  typicalDuration: string;
  preOpRequirements: string[];
  postOpCare: string[];
  commonIndications: string[];
  complications: string[];
  relatedProcedures: string[];
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const SURGICAL_CATALOG: SurgicalProcedure[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL SURGERY
  // ═══════════════════════════════════════════════════════════════════════════

  // 1
  {
    code: '44950',
    name: 'Appendectomy, open',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC, BMP, urinalysis',
      'PT/INR if on anticoagulants',
      'CT abdomen/pelvis with contrast (if diagnosis uncertain)',
      'Type and screen',
      'ECG if age >40',
      'CXR if age >50 or cardiopulmonary history',
      'NPO 8 hours (emergency: proceed regardless)',
      'IV access and fluid resuscitation',
      'Informed consent',
    ],
    postOpCare: [
      'Clear liquids day 1, advance diet as tolerated',
      'IV antibiotics → oral antibiotics (5-7 day course if perforated)',
      'Wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 4-6 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever >38.5°C, increasing pain, wound drainage',
    ],
    commonIndications: [
      'K35.80',  // Unspecified acute appendicitis without abscess
      'K35.89',  // Other acute appendicitis without abscess
      'K35.20',  // Acute appendicitis with generalised peritonitis without abscess
      'K35.30',  // Acute appendicitis with localised peritonitis without abscess
      'K36',     // Other appendicitis (chronic)
    ],
    complications: [
      'Surgical site infection',
      'Intra-abdominal abscess',
      'Ileus / small bowel obstruction',
      'Wound dehiscence',
      'Stump appendicitis',
      'Bleeding',
    ],
    relatedProcedures: ['44970', '49000'],
  },

  // 2
  {
    code: '44970',
    name: 'Appendectomy, laparoscopic',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP, urinalysis',
      'PT/INR if on anticoagulants',
      'CT abdomen/pelvis with contrast (if diagnosis uncertain)',
      'Type and screen',
      'ECG if age >40',
      'CXR if age >50 or cardiopulmonary history',
      'Pregnancy test (females of childbearing age)',
      'NPO 8 hours (emergency: proceed regardless)',
      'IV access and fluid resuscitation',
      'Informed consent',
    ],
    postOpCare: [
      'Clear liquids day 0, advance diet as tolerated',
      'Oral antibiotics (5-7 day course if perforated)',
      'Port site wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 2-4 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever >38.5°C, increasing pain, wound drainage, port site hernia signs',
    ],
    commonIndications: [
      'K35.80',
      'K35.89',
      'K35.20',
      'K35.30',
      'K36',
    ],
    complications: [
      'Surgical site infection',
      'Intra-abdominal abscess',
      'Trocar site hernia',
      'Ileus',
      'Conversion to open',
      'Bleeding',
    ],
    relatedProcedures: ['44950', '49320'],
  },

  // 3
  {
    code: '47600',
    name: 'Cholecystectomy, open',
    category: 'hepatobiliary',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-120 min',
    preOpRequirements: [
      'CBC, BMP, LFTs (AST, ALT, ALP, bilirubin)',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'RUQ ultrasound',
      'MRCP if suspected choledocholithiasis',
      'ECG if age >40',
      'CXR',
      'NPO 8 hours',
      'Informed consent',
    ],
    postOpCare: [
      'Clear liquids day 1, advance to low-fat diet',
      'Wound check day 5-7',
      'Drain output monitoring (if drain placed)',
      'DVT prophylaxis (compression stockings, early ambulation)',
      'Activity: no heavy lifting >15 lbs for 6 weeks',
      'LFTs at 2 week follow-up if pre-op values abnormal',
      'Follow-up 2 weeks',
      'Return precautions: jaundice, fever, bile leak signs (persistent drainage)',
    ],
    commonIndications: [
      'K80.20',  // Calculus of gallbladder without cholecystitis
      'K80.00',  // Calculus of gallbladder with acute cholecystitis without obstruction
      'K80.10',  // Calculus of gallbladder with chronic cholecystitis without obstruction
      'K81.0',   // Acute cholecystitis
      'K81.1',   // Chronic cholecystitis
      'K82.1',   // Hydrops of gallbladder
    ],
    complications: [
      'Bile duct injury',
      'Bile leak',
      'Retained common bile duct stones',
      'Surgical site infection',
      'Bleeding',
      'Subhepatic abscess',
      'Post-cholecystectomy syndrome',
    ],
    relatedProcedures: ['47562', '47563', '43260', '43262'],
  },

  // 4
  {
    code: '47562',
    name: 'Cholecystectomy, laparoscopic',
    category: 'hepatobiliary',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC, BMP, LFTs (AST, ALT, ALP, bilirubin)',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'RUQ ultrasound',
      'MRCP if suspected choledocholithiasis',
      'ECG if age >40',
      'Pregnancy test (females of childbearing age)',
      'NPO 8 hours',
      'Informed consent',
    ],
    postOpCare: [
      'Clear liquids day 0, advance to low-fat diet over 1 week',
      'Port site wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 2-4 weeks',
      'Follow-up 2 weeks',
      'Return precautions: jaundice, fever, increasing abdominal pain, wound drainage',
    ],
    commonIndications: [
      'K80.20',
      'K80.00',
      'K80.10',
      'K81.0',
      'K81.1',
      'K82.A1',  // Gallbladder dyskinesia
    ],
    complications: [
      'Bile duct injury',
      'Bile leak',
      'Retained CBD stones',
      'Port site infection',
      'Trocar site hernia',
      'Conversion to open',
      'Shoulder pain (referred from diaphragmatic irritation)',
    ],
    relatedProcedures: ['47600', '47563', '43260', '43262'],
  },

  // 5
  {
    code: '47563',
    name: 'Cholecystectomy, laparoscopic with intraoperative cholangiography',
    category: 'hepatobiliary',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-120 min',
    preOpRequirements: [
      'CBC, BMP, LFTs (AST, ALT, ALP, bilirubin)',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'RUQ ultrasound',
      'MRCP if LFTs abnormal or CBD dilated',
      'ECG if age >40',
      'NPO 8 hours',
      'Fluoroscopy availability confirmed',
      'Informed consent',
    ],
    postOpCare: [
      'Clear liquids day 0, advance to low-fat diet over 1 week',
      'Port site wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 2-4 weeks',
      'LFTs at follow-up if pre-op values abnormal',
      'Follow-up 2 weeks',
      'Return precautions: jaundice, fever, increasing abdominal pain',
    ],
    commonIndications: [
      'K80.50',  // Calculus of bile duct without cholangitis or cholecystitis
      'K80.00',
      'K80.20',
      'K83.1',   // Obstruction of bile duct
    ],
    complications: [
      'Bile duct injury',
      'Bile leak',
      'Retained CBD stones',
      'Contrast reaction',
      'Port site infection',
      'Conversion to open',
    ],
    relatedProcedures: ['47562', '47600', '43262', '43264'],
  },

  // 6
  {
    code: '49505',
    name: 'Inguinal hernia repair, open (initial, unilateral)',
    category: 'general',
    complexity: 'intermediate',
    anaesthesia: ['general', 'regional', 'local'],
    typicalDuration: '45-75 min',
    preOpRequirements: [
      'CBC, BMP',
      'ECG if age >40',
      'CXR if age >50 or cardiopulmonary history',
      'Urinalysis (rule out urinary retention as contributing factor)',
      'NPO 8 hours',
      'Informed consent (include mesh discussion)',
    ],
    postOpCare: [
      'Ice to groin 20 min on/off for 48 hours',
      'Scrotal support if male',
      'Wound check day 5-7',
      'Activity: no heavy lifting >10 lbs for 4-6 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, wound drainage, scrotal swelling, urinary retention',
    ],
    commonIndications: [
      'K40.90',  // Unilateral inguinal hernia without obstruction or gangrene
      'K40.91',  // Unilateral inguinal hernia without obstruction or gangrene, recurrent
      'K40.20',  // Bilateral inguinal hernia without obstruction or gangrene
    ],
    complications: [
      'Chronic groin pain',
      'Wound infection',
      'Mesh infection',
      'Seroma / haematoma',
      'Urinary retention',
      'Testicular ischaemia (rare)',
      'Recurrence',
    ],
    relatedProcedures: ['49650', '49585', '49560'],
  },

  // 7
  {
    code: '49650',
    name: 'Inguinal hernia repair, laparoscopic (initial, unilateral)',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC, BMP',
      'ECG if age >40',
      'CXR if age >50 or cardiopulmonary history',
      'Pregnancy test (females of childbearing age)',
      'NPO 8 hours',
      'Informed consent (include mesh discussion, TEP vs TAPP)',
    ],
    postOpCare: [
      'Port site wound check day 3-5',
      'Ice to groin as needed for 48 hours',
      'Activity: no heavy lifting >10 lbs for 2-4 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, increasing groin pain, port site drainage, urinary retention',
    ],
    commonIndications: [
      'K40.90',
      'K40.91',
      'K40.20',
    ],
    complications: [
      'Chronic groin pain',
      'Port site infection',
      'Seroma',
      'Trocar site hernia',
      'Bladder injury',
      'Vascular injury (inferior epigastric)',
      'Recurrence',
    ],
    relatedProcedures: ['49505', '49653'],
  },

  // 8
  {
    code: '49585',
    name: 'Umbilical hernia repair',
    category: 'general',
    complexity: 'intermediate',
    anaesthesia: ['general', 'local'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'ECG if age >40',
      'NPO 8 hours',
      'CT abdomen if large or complex defect suspected',
      'Informed consent (mesh vs primary suture discussion)',
    ],
    postOpCare: [
      'Wound check day 5-7',
      'Abdominal binder for 4-6 weeks',
      'Activity: no heavy lifting >10 lbs for 4-6 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, wound drainage, recurrent bulge',
    ],
    commonIndications: [
      'K42.9',   // Umbilical hernia without obstruction or gangrene
      'K42.0',   // Umbilical hernia with obstruction, without gangrene
    ],
    complications: [
      'Wound infection',
      'Seroma',
      'Mesh infection',
      'Recurrence',
      'Chronic pain',
    ],
    relatedProcedures: ['49505', '49560'],
  },

  // 9
  {
    code: '49560',
    name: 'Incisional hernia repair, open (initial)',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '90-180 min',
    preOpRequirements: [
      'CBC, BMP, albumin, pre-albumin',
      'PT/INR',
      'Type and screen',
      'CT abdomen/pelvis (assess defect size, loss of domain)',
      'ECG',
      'CXR',
      'Pulmonary function tests if large hernia',
      'Nutritional optimisation (albumin >3.0)',
      'Smoking cessation >4 weeks',
      'BMI optimisation (<40 preferred)',
      'NPO 8 hours',
      'Informed consent (mesh, component separation discussion)',
    ],
    postOpCare: [
      'Abdominal binder for 6-8 weeks',
      'DVT prophylaxis (enoxaparin or compression devices)',
      'Drain output monitoring (if drains placed)',
      'Wound check day 5-7',
      'Activity: no heavy lifting >15 lbs for 8-12 weeks',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: fever, wound drainage, recurrent bulge, respiratory distress',
    ],
    commonIndications: [
      'K43.9',   // Ventral hernia without obstruction or gangrene
      'K43.2',   // Incisional hernia without obstruction or gangrene
    ],
    complications: [
      'Wound infection',
      'Mesh infection',
      'Seroma',
      'Wound dehiscence',
      'Recurrence',
      'Chronic pain',
      'Skin necrosis',
      'Respiratory compromise (if large defect closure)',
    ],
    relatedProcedures: ['49653', '49585', '49505'],
  },

  // 10
  {
    code: '49653',
    name: 'Incisional hernia repair, laparoscopic (initial)',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-150 min',
    preOpRequirements: [
      'CBC, BMP, albumin',
      'PT/INR',
      'Type and screen',
      'CT abdomen/pelvis (assess defect size and contents)',
      'ECG if age >40',
      'CXR',
      'NPO 8 hours',
      'Informed consent (mesh placement, conversion risk)',
    ],
    postOpCare: [
      'Abdominal binder for 4-6 weeks',
      'DVT prophylaxis',
      'Port site wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 6-8 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, increasing pain, port site drainage, recurrent bulge',
    ],
    commonIndications: [
      'K43.9',
      'K43.2',
    ],
    complications: [
      'Enterotomy (bowel injury)',
      'Seroma',
      'Mesh infection',
      'Port site hernia',
      'Recurrence',
      'Chronic pain',
      'Conversion to open',
    ],
    relatedProcedures: ['49560', '49320'],
  },

  // 11
  {
    code: '49550',
    name: 'Femoral hernia repair, open (initial)',
    category: 'general',
    complexity: 'intermediate',
    anaesthesia: ['general', 'regional', 'local'],
    typicalDuration: '45-75 min',
    preOpRequirements: [
      'CBC, BMP',
      'ECG if age >40',
      'CXR if age >50',
      'CT or ultrasound if diagnosis uncertain',
      'NPO 8 hours',
      'Informed consent',
    ],
    postOpCare: [
      'Wound check day 5-7',
      'DVT prophylaxis (compression stockings)',
      'Activity: no heavy lifting >10 lbs for 4-6 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, wound drainage, groin swelling, leg swelling',
    ],
    commonIndications: [
      'K41.90',  // Unilateral femoral hernia without obstruction or gangrene
      'K41.30',  // Unilateral femoral hernia with obstruction, without gangrene
    ],
    complications: [
      'Wound infection',
      'Femoral vein injury',
      'DVT',
      'Recurrence',
      'Chronic pain',
      'Bowel injury (if incarcerated)',
    ],
    relatedProcedures: ['49505', '49650'],
  },

  // 12
  {
    code: '19301',
    name: 'Partial mastectomy / lumpectomy',
    category: 'breast',
    complexity: 'intermediate',
    anaesthesia: ['general', 'local', 'sedation'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'Bilateral mammography',
      'Breast ultrasound',
      'Core needle biopsy with pathology result',
      'Wire / seed localisation (if non-palpable lesion)',
      'ECG if age >40',
      'CXR if malignancy confirmed',
      'Tumour markers if indicated (CA 15-3)',
      'NPO 8 hours',
      'Informed consent (margins, re-excision risk, radiation discussion)',
    ],
    postOpCare: [
      'Supportive bra 24/7 for 2 weeks',
      'Wound check day 5-7',
      'Drain care instructions (if drain placed)',
      'Activity: no heavy lifting >5 lbs on operative side for 2 weeks',
      'Pathology follow-up for final margins at 1-2 weeks',
      'Oncology referral if malignant (radiation, systemic therapy)',
      'Follow-up 2 weeks',
      'Return precautions: fever, increasing swelling, wound drainage, haematoma',
    ],
    commonIndications: [
      'C50.919',  // Malignant neoplasm of unspecified site of unspecified female breast
      'C50.911',  // Malignant neoplasm of unspecified site of right female breast
      'C50.912',  // Malignant neoplasm of unspecified site of left female breast
      'D05.90',   // Unspecified type of carcinoma in situ of unspecified breast
      'N60.01',   // Solitary cyst of right breast
    ],
    complications: [
      'Haematoma',
      'Seroma',
      'Wound infection',
      'Positive margins requiring re-excision',
      'Breast asymmetry',
      'Chronic pain',
    ],
    relatedProcedures: ['19303', '19120', '38525'],
  },

  // 13
  {
    code: '19303',
    name: 'Simple / total mastectomy',
    category: 'breast',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '90-150 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR',
      'Type and screen',
      'Bilateral mammography',
      'Breast MRI (if indicated)',
      'Core needle biopsy with pathology result',
      'Metastatic workup (CT chest/abdomen/pelvis, bone scan if indicated)',
      'ECG',
      'CXR',
      'NPO 8 hours',
      'Multidisciplinary team discussion',
      'Genetic counselling referral if indicated (BRCA)',
      'Informed consent (reconstruction options, SLNB)',
    ],
    postOpCare: [
      'Drain care: empty and record output twice daily',
      'Drain removal when output <30 ml/24 hours',
      'Supportive garment / surgical bra',
      'DVT prophylaxis x 28 days',
      'Range-of-motion exercises starting day 3-5',
      'Activity: no heavy lifting >5 lbs on operative side for 4-6 weeks',
      'Pathology follow-up for staging at 1-2 weeks',
      'Oncology referral for adjuvant therapy',
      'Follow-up 1 week (drain check), 2 weeks, 6 weeks',
      'Return precautions: fever, wound breakdown, haematoma, flap necrosis',
    ],
    commonIndications: [
      'C50.919',
      'C50.911',
      'C50.912',
      'D05.10',   // Intraductal carcinoma in situ of right breast
      'Z40.01',   // Prophylactic mastectomy
    ],
    complications: [
      'Seroma',
      'Wound infection',
      'Flap necrosis',
      'Haematoma',
      'Lymphoedema',
      'Chronic pain / post-mastectomy pain syndrome',
      'Shoulder dysfunction',
    ],
    relatedProcedures: ['19301', '19120', '38525'],
  },

  // 14
  {
    code: '19120',
    name: 'Excisional breast biopsy',
    category: 'breast',
    complexity: 'minor',
    anaesthesia: ['local', 'sedation'],
    typicalDuration: '20-45 min',
    preOpRequirements: [
      'CBC',
      'Mammography and/or ultrasound',
      'Wire / seed localisation (if non-palpable)',
      'Previous FNA or core biopsy results',
      'NPO 6 hours (if sedation)',
      'Informed consent',
    ],
    postOpCare: [
      'Supportive bra for 1 week',
      'Wound check day 5-7',
      'Ice application for 48 hours',
      'Activity: no heavy lifting >5 lbs for 1-2 weeks',
      'Pathology follow-up at 1 week',
      'Follow-up 1-2 weeks',
      'Return precautions: increasing swelling, wound drainage, fever',
    ],
    commonIndications: [
      'N63.10',   // Unspecified lump in the right breast
      'N63.20',   // Unspecified lump in the left breast
      'R92.1',    // Mammographic calcification found on diagnostic imaging of breast
      'R92.8',    // Other abnormal findings on diagnostic imaging of breast
      'D24.1',    // Benign neoplasm of right breast
      'D24.2',    // Benign neoplasm of left breast
    ],
    complications: [
      'Haematoma',
      'Wound infection',
      'Seroma',
      'Breast asymmetry / contour defect',
      'Incomplete excision',
    ],
    relatedProcedures: ['19301', '19303', '38525'],
  },

  // 15
  {
    code: '38525',
    name: 'Sentinel lymph node biopsy, open, deep axillary',
    category: 'breast',
    complexity: 'intermediate',
    anaesthesia: ['general'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'Confirmed breast malignancy with pathology',
      'Lymphoscintigraphy or blue dye injection planned',
      'ECG if age >40',
      'NPO 8 hours',
      'Informed consent (lymphoedema risk, false-negative rate)',
    ],
    postOpCare: [
      'Wound check day 5-7',
      'Drain care if placed',
      'Activity: no heavy lifting >5 lbs on operative side for 2 weeks',
      'Range-of-motion exercises',
      'Pathology follow-up for node status at 1 week',
      'Follow-up 2 weeks',
      'Return precautions: arm swelling, fever, wound drainage',
    ],
    commonIndications: [
      'C50.919',
      'C50.911',
      'C50.912',
      'C77.3',    // Secondary malignant neoplasm of axillary lymph nodes
    ],
    complications: [
      'Lymphoedema',
      'Seroma',
      'Wound infection',
      'Nerve injury (intercostobrachial, long thoracic)',
      'Allergic reaction to blue dye',
      'Shoulder stiffness',
    ],
    relatedProcedures: ['19301', '19303', '38500'],
  },

  // 16
  {
    code: '60240',
    name: 'Total thyroidectomy',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '90-180 min',
    preOpRequirements: [
      'CBC, BMP, calcium, phosphate',
      'TSH, free T4, free T3',
      'Thyroglobulin, anti-thyroid antibodies',
      'Calcitonin (if MTC suspected)',
      'Thyroid ultrasound with nodule mapping',
      'FNA cytology (Bethesda classification)',
      'CT neck (if substernal extension or compressive symptoms)',
      'Vocal cord assessment (indirect laryngoscopy)',
      'ECG',
      'NPO 8 hours',
      'Informed consent (RLN injury, hypoparathyroidism)',
    ],
    postOpCare: [
      'Serial calcium monitoring: 6h, 12h, 24h post-op',
      'Calcium and vitamin D supplementation (prophylactic)',
      'Voice assessment post-op',
      'Wound check day 3-5 (Steri-strips)',
      'Levothyroxine initiation (weight-based dosing)',
      'TSH check at 6 weeks',
      'Pathology follow-up for staging at 1-2 weeks',
      'Follow-up 1 week, 6 weeks',
      'Return precautions: perioral tingling, hand/foot spasms (hypocalcaemia), voice change, neck swelling, dyspnoea',
    ],
    commonIndications: [
      'C73',      // Malignant neoplasm of thyroid gland
      'E04.2',    // Nontoxic multinodular goitre
      'E05.00',   // Thyrotoxicosis with diffuse goitre (Graves)
      'D34',      // Benign neoplasm of thyroid gland
      'E04.1',    // Nontoxic single thyroid nodule
    ],
    complications: [
      'Recurrent laryngeal nerve injury (hoarseness)',
      'Hypoparathyroidism (transient or permanent)',
      'Hypocalcaemia',
      'Post-operative haematoma (airway compromise)',
      'Wound infection',
      'Seroma',
      'Hypothyroidism (expected, managed with levothyroxine)',
    ],
    relatedProcedures: ['60220'],
  },

  // 17
  {
    code: '60220',
    name: 'Hemithyroidectomy / thyroid lobectomy',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-120 min',
    preOpRequirements: [
      'CBC, BMP, calcium',
      'TSH, free T4',
      'Thyroid ultrasound',
      'FNA cytology (Bethesda classification)',
      'Vocal cord assessment (indirect laryngoscopy)',
      'ECG if age >40',
      'NPO 8 hours',
      'Informed consent (RLN injury risk, possible completion thyroidectomy)',
    ],
    postOpCare: [
      'Calcium monitoring 6h and 24h post-op',
      'Voice assessment post-op',
      'Wound check day 3-5',
      'TSH check at 6 weeks (may need levothyroxine)',
      'Pathology follow-up for final diagnosis at 1-2 weeks',
      'Follow-up 1 week, 6 weeks',
      'Return precautions: perioral tingling, voice change, neck swelling, dyspnoea',
    ],
    commonIndications: [
      'E04.1',    // Nontoxic single thyroid nodule
      'D34',      // Benign neoplasm of thyroid gland
      'E05.10',   // Thyrotoxicosis with toxic single nodule
      'C73',      // Malignant neoplasm of thyroid gland (low-risk, <4cm)
    ],
    complications: [
      'Recurrent laryngeal nerve injury',
      'Transient hypocalcaemia',
      'Post-operative haematoma',
      'Wound infection',
      'Hypothyroidism (20-30% may need levothyroxine)',
      'Need for completion thyroidectomy',
    ],
    relatedProcedures: ['60240'],
  },

  // 18
  {
    code: '44120',
    name: 'Small bowel resection, single segment',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '90-180 min',
    preOpRequirements: [
      'CBC, BMP, albumin',
      'PT/INR',
      'Type and crossmatch (2 units pRBC)',
      'CT abdomen/pelvis with contrast',
      'ECG',
      'CXR',
      'NPO (NG decompression if obstructed)',
      'IV fluid resuscitation',
      'Foley catheter',
      'Informed consent (stoma possibility)',
    ],
    postOpCare: [
      'NG tube until return of bowel function',
      'Clear liquids when bowel sounds return, advance slowly',
      'DVT prophylaxis x 28 days',
      'Wound check day 5-7',
      'Monitor for anastomotic leak (tachycardia, fever, peritonitis)',
      'Activity: no heavy lifting >15 lbs for 6-8 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, abdominal distension, nausea/vomiting, wound drainage',
    ],
    commonIndications: [
      'K56.69',   // Other intestinal obstruction
      'K56.50',   // Intestinal adhesions with obstruction
      'K63.1',    // Perforation of intestine (nontraumatic)
      'K50.00',   // Crohn disease of small intestine without complications
      'C17.9',    // Malignant neoplasm of small intestine, unspecified
    ],
    complications: [
      'Anastomotic leak',
      'Surgical site infection',
      'Ileus',
      'Small bowel obstruction (adhesions)',
      'Short bowel syndrome (if extensive resection)',
      'Wound dehiscence',
      'Bleeding',
    ],
    relatedProcedures: ['44005', '49000', '44143'],
  },

  // 19
  {
    code: '44005',
    name: 'Lysis of adhesions (enterolysis / adhesiolysis)',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-180 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR',
      'Type and screen',
      'CT abdomen/pelvis with contrast (transition point)',
      'ECG',
      'CXR',
      'NPO (NG decompression if obstructed)',
      'IV fluid resuscitation and electrolyte correction',
      'Foley catheter',
      'Informed consent (bowel resection may be required)',
    ],
    postOpCare: [
      'NG tube until return of bowel function',
      'Clear liquids when flatus passes, advance slowly',
      'DVT prophylaxis',
      'Wound check day 5-7',
      'Early ambulation',
      'Activity: no heavy lifting >15 lbs for 6-8 weeks',
      'Follow-up 2 weeks',
      'Return precautions: recurrent obstruction symptoms, fever, wound drainage',
    ],
    commonIndications: [
      'K56.50',   // Intestinal adhesions with obstruction
      'K56.52',   // Intestinal adhesions with partial obstruction
      'K66.0',    // Peritoneal adhesions
    ],
    complications: [
      'Inadvertent enterotomy',
      'Recurrent adhesive obstruction',
      'Surgical site infection',
      'Ileus',
      'Wound dehiscence',
      'Bleeding',
    ],
    relatedProcedures: ['49000', '44120'],
  },

  // 20
  {
    code: '38100',
    name: 'Splenectomy, total',
    category: 'general',
    complexity: 'complex',
    anaesthesia: ['general'],
    typicalDuration: '90-180 min',
    preOpRequirements: [
      'CBC with differential, reticulocyte count',
      'BMP, LFTs',
      'PT/INR, PTT',
      'Type and crossmatch (2-4 units pRBC)',
      'Peripheral blood smear',
      'CT abdomen with contrast (spleen size, accessory spleens)',
      'Vaccinations: pneumococcal (PCV13 + PPSV23), meningococcal (MenACWY + MenB), Hib — ideally 2 weeks pre-op',
      'ECG',
      'CXR',
      'NPO 8 hours',
      'Informed consent (OPSI risk, lifelong antibiotic considerations)',
    ],
    postOpCare: [
      'Platelet count monitoring daily (post-splenectomy thrombocytosis)',
      'DVT prophylaxis (aspirin if platelets >1,000,000)',
      'Drain output monitoring if placed',
      'Clear liquids day 1, advance as tolerated',
      'Wound check day 5-7',
      'Vaccination completion if not done pre-op (2 weeks post-op)',
      'MedicAlert bracelet / card for asplenic state',
      'Annual influenza vaccination',
      'Prophylactic penicillin V discussion (especially paediatric)',
      'Activity: no heavy lifting >15 lbs for 6-8 weeks',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: fever (medical emergency in asplenic patients), LUQ pain, shortness of breath',
    ],
    commonIndications: [
      'D73.1',    // Hypersplenism
      'D69.3',    // Immune thrombocytopenic purpura (ITP)
      'D58.0',    // Hereditary spherocytosis
      'S36.09XA', // Splenic injury (trauma)
      'C96.4',    // Sarcoma of dendritic cells (splenic)
    ],
    complications: [
      'Post-operative bleeding',
      'Subphrenic abscess',
      'Pancreatic injury / pancreatic fistula',
      'Atelectasis / pleural effusion',
      'Post-splenectomy thrombocytosis',
      'Overwhelming post-splenectomy infection (OPSI)',
      'Portal vein thrombosis',
    ],
    relatedProcedures: ['49000'],
  },

  // 21
  {
    code: '49000',
    name: 'Exploratory laparotomy',
    category: 'general',
    complexity: 'major',
    anaesthesia: ['general'],
    typicalDuration: '60-180 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR, PTT',
      'Type and crossmatch (2-4 units pRBC)',
      'LFTs, lipase',
      'Lactate',
      'CT abdomen/pelvis with contrast (if stable)',
      'ECG',
      'CXR or erect abdominal X-ray (free air)',
      'Urinary catheter',
      'IV access (2 large-bore)',
      'Broad-spectrum antibiotics',
      'NPO (emergency: proceed regardless)',
      'Informed consent (stoma, bowel resection, findings-dependent)',
    ],
    postOpCare: [
      'NG tube until bowel function returns',
      'Clear liquids when bowel sounds return',
      'DVT prophylaxis',
      'Wound check day 5-7',
      'Drain monitoring (if placed)',
      'Activity: no heavy lifting >15 lbs for 6-8 weeks',
      'Follow-up 2 weeks',
      'Return precautions: fever, wound dehiscence, increasing pain, abdominal distension',
    ],
    commonIndications: [
      'R10.0',    // Acute abdomen
      'K63.1',    // Perforation of intestine
      'K56.69',   // Other intestinal obstruction
      'S36.90XA', // Unspecified injury of unspecified intra-abdominal organ
      'K65.9',    // Peritonitis, unspecified
    ],
    complications: [
      'Surgical site infection',
      'Wound dehiscence / evisceration',
      'Ileus',
      'Adhesion formation',
      'Incisional hernia',
      'DVT / PE',
      'Organ injury',
    ],
    relatedProcedures: ['44005', '44120', '49320'],
  },

  // 22
  {
    code: '11042',
    name: 'Wound debridement, subcutaneous tissue',
    category: 'skin',
    complexity: 'minor',
    anaesthesia: ['local'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'CBC (if infection suspected)',
      'BMP (diabetic patients)',
      'HbA1c (diabetic patients)',
      'Wound culture (if infected)',
      'Wound measurements and photography',
      'Vascular assessment (ABI if lower extremity)',
      'Informed consent',
    ],
    postOpCare: [
      'Wound packing and dressing changes (daily or every other day)',
      'Wound care instructions for patient/carer',
      'Antibiotics if cellulitis present',
      'Optimise glycaemic control (diabetics)',
      'Offloading (if diabetic foot wound)',
      'Follow-up 1 week',
      'Return precautions: spreading redness, fever, increasing drainage, foul odour',
    ],
    commonIndications: [
      'L89.90',   // Pressure ulcer, unspecified
      'L97.919',  // Non-pressure chronic ulcer of unspecified part of lower leg
      'E11.621',  // Type 2 diabetes mellitus with foot ulcer
      'T81.4XXA', // Infection following a procedure, initial encounter
    ],
    complications: [
      'Bleeding',
      'Pain',
      'Wound infection',
      'Delayed healing',
      'Need for repeat debridement',
    ],
    relatedProcedures: ['11043', '10060'],
  },

  // 23
  {
    code: '11043',
    name: 'Wound debridement, muscle and/or fascia',
    category: 'skin',
    complexity: 'intermediate',
    anaesthesia: ['local', 'regional', 'general'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'HbA1c (diabetic patients)',
      'Wound culture',
      'Wound measurements and photography',
      'Vascular assessment (ABI if lower extremity)',
      'X-ray (to rule out osteomyelitis if chronic wound)',
      'MRI if deep tissue infection or osteomyelitis suspected',
      'Type and screen (if extensive)',
      'Informed consent (possible skin graft/flap)',
    ],
    postOpCare: [
      'Negative-pressure wound therapy (VAC) or wet-to-dry dressings',
      'IV or oral antibiotics as indicated',
      'Wound care nursing referral',
      'Nutritional optimisation (protein, vitamins A and C)',
      'Offloading / non-weight-bearing if lower extremity',
      'Follow-up 3-5 days',
      'Return precautions: expanding erythema, systemic sepsis signs, crepitus',
    ],
    commonIndications: [
      'M72.6',    // Necrotising fasciitis
      'L89.90',
      'L97.919',
      'E11.621',
      'T79.3XXA', // Post-traumatic wound infection
    ],
    complications: [
      'Bleeding',
      'Further tissue loss',
      'Incomplete debridement',
      'Need for serial debridements',
      'Osteomyelitis',
      'Amputation (severe cases)',
    ],
    relatedProcedures: ['11042', '10061'],
  },

  // 24
  {
    code: '10060',
    name: 'Incision and drainage of abscess, simple',
    category: 'skin',
    complexity: 'minor',
    anaesthesia: ['local'],
    typicalDuration: '10-20 min',
    preOpRequirements: [
      'Wound culture (send at time of I&D)',
      'CBC if systemic infection suspected',
      'BMP, HbA1c if diabetic',
      'Informed consent',
    ],
    postOpCare: [
      'Wound packing with iodoform gauze (packing changes daily)',
      'Oral antibiotics (if cellulitis, immunocompromised, or MRSA risk)',
      'Warm compresses',
      'Follow-up 2-3 days for packing change / wound check',
      'Return precautions: fever, increasing redness, recurrence',
    ],
    commonIndications: [
      'L02.91',   // Cutaneous abscess, unspecified
      'L02.211',  // Cutaneous abscess of abdominal wall
      'L02.411',  // Cutaneous abscess of right upper limb
      'L02.511',  // Cutaneous abscess of right lower limb
      'L02.11',   // Cutaneous abscess of neck
    ],
    complications: [
      'Recurrence',
      'Incomplete drainage',
      'Wound infection',
      'Scarring',
      'Fistula formation',
    ],
    relatedProcedures: ['10061', '46060'],
  },

  // 25
  {
    code: '10061',
    name: 'Incision and drainage of abscess, complicated',
    category: 'skin',
    complexity: 'intermediate',
    anaesthesia: ['local', 'sedation', 'general'],
    typicalDuration: '20-45 min',
    preOpRequirements: [
      'CBC, BMP',
      'Wound culture (send at time of I&D)',
      'Blood cultures if systemically septic',
      'HbA1c if diabetic',
      'Ultrasound if deep abscess suspected',
      'CT if perianal or deep-seated',
      'NPO if sedation/general planned',
      'Informed consent',
    ],
    postOpCare: [
      'Wound packing and daily dressing changes',
      'IV then oral antibiotics',
      'Wound care nursing referral if complex',
      'Follow-up 2-3 days',
      'Return precautions: fever, expanding erythema, systemic sepsis signs',
    ],
    commonIndications: [
      'L02.91',
      'L02.31',   // Cutaneous abscess of buttock
      'L05.01',   // Pilonidal cyst with abscess
      'K61.0',    // Anal abscess
      'K61.1',    // Rectal abscess
    ],
    complications: [
      'Recurrence',
      'Fistula formation',
      'Bacteraemia / sepsis',
      'Necrotising fasciitis (rare)',
      'Incomplete drainage requiring re-operation',
    ],
    relatedProcedures: ['10060', '46060', '11042'],
  },

  // 26
  {
    code: '11400',
    name: 'Excision, benign lesion, trunk/arms/legs, ≤0.5 cm',
    category: 'skin',
    complexity: 'minor',
    anaesthesia: ['local'],
    typicalDuration: '10-20 min',
    preOpRequirements: [
      'Clinical assessment and documentation of lesion',
      'Dermatoscopy if available',
      'Informed consent (scar, recurrence)',
    ],
    postOpCare: [
      'Wound care: keep dry 24-48 hours, then gentle cleansing',
      'Suture removal 7-14 days (site-dependent)',
      'Pathology follow-up at 1-2 weeks',
      'Sun protection for scar',
      'Follow-up 2 weeks',
      'Return precautions: wound infection signs, bleeding',
    ],
    commonIndications: [
      'D22.5',    // Melanocytic naevi of trunk
      'D23.5',    // Other benign neoplasm of skin of trunk
      'L82.1',    // Other seborrhoeic keratosis
      'L72.0',    // Epidermal cyst
      'D17.1',    // Benign lipomatous neoplasm of skin and subcutaneous tissue of trunk
    ],
    complications: [
      'Wound infection',
      'Bleeding / haematoma',
      'Scar hypertrophy / keloid',
      'Recurrence',
      'Nerve injury (sensory)',
    ],
    relatedProcedures: ['11402', '11600'],
  },

  // 27
  {
    code: '11600',
    name: 'Excision, malignant lesion, trunk/arms/legs, ≤0.5 cm',
    category: 'skin',
    complexity: 'minor',
    anaesthesia: ['local'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'Biopsy-confirmed malignancy with pathology report',
      'Clinical measurement and photography',
      'Mark surgical margins (per NCCN guidelines)',
      'Consider sentinel lymph node biopsy if melanoma >0.8 mm Breslow',
      'Informed consent (margins, re-excision risk)',
    ],
    postOpCare: [
      'Wound care: keep dry 24-48 hours',
      'Suture removal 7-14 days (site-dependent)',
      'Pathology follow-up for margin status at 1-2 weeks',
      'Dermatology follow-up for skin surveillance',
      'Sun protection',
      'Follow-up 2 weeks',
      'Return precautions: wound infection signs, bleeding',
    ],
    commonIndications: [
      'C44.509',  // Unspecified malignant neoplasm of skin of trunk
      'C43.59',   // Malignant melanoma of other part of trunk
      'C44.319',  // Basal cell carcinoma of skin, other parts of face
      'C44.529',  // Squamous cell carcinoma of skin of trunk
    ],
    complications: [
      'Positive margins requiring re-excision',
      'Wound infection',
      'Bleeding / haematoma',
      'Scar hypertrophy / keloid',
      'Local recurrence',
      'Nerve injury',
    ],
    relatedProcedures: ['11400', '38525', '38500'],
  },

  // 28
  {
    code: '11402',
    name: 'Excision, benign lesion, trunk/arms/legs, 1.1-2.0 cm',
    category: 'skin',
    complexity: 'minor',
    anaesthesia: ['local'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'Clinical assessment and documentation of lesion',
      'Dermatoscopy if available',
      'Mark excision margins',
      'Informed consent',
    ],
    postOpCare: [
      'Wound care: keep dry 24-48 hours, then gentle cleansing',
      'Suture removal 7-14 days (site-dependent)',
      'Pathology follow-up at 1-2 weeks',
      'Sun protection for scar',
      'Follow-up 2 weeks',
      'Return precautions: wound infection signs, bleeding',
    ],
    commonIndications: [
      'D22.5',
      'D23.5',
      'L72.0',
      'D17.1',
      'L82.1',
    ],
    complications: [
      'Wound infection',
      'Bleeding / haematoma',
      'Scar hypertrophy / keloid',
      'Recurrence',
      'Dog-ear deformity',
    ],
    relatedProcedures: ['11400', '11600'],
  },

  // 29
  {
    code: '49320',
    name: 'Diagnostic laparoscopy',
    category: 'general',
    complexity: 'intermediate',
    anaesthesia: ['general'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR',
      'LFTs',
      'CT abdomen/pelvis (if indicated)',
      'Pregnancy test (females of childbearing age)',
      'ECG if age >40',
      'CXR if age >50',
      'NPO 8 hours',
      'Informed consent (conversion to open, findings-dependent further procedures)',
    ],
    postOpCare: [
      'Clear liquids day 0, advance as tolerated',
      'Port site wound check day 3-5',
      'Activity: no heavy lifting >10 lbs for 2 weeks',
      'Follow-up 2 weeks with pathology/biopsy results',
      'Return precautions: fever, increasing pain, port site drainage, shoulder tip pain persisting >48 hours',
    ],
    commonIndications: [
      'R10.9',    // Unspecified abdominal pain
      'R10.0',    // Acute abdomen
      'R19.00',   // Intra-abdominal and pelvic swelling, mass, and lump, unspecified site
      'K66.0',    // Peritoneal adhesions
      'C78.6',    // Secondary malignant neoplasm of peritoneum (staging)',
    ],
    complications: [
      'Trocar site injury (bowel, vascular)',
      'Port site infection',
      'Port site hernia',
      'Shoulder tip pain',
      'Gas embolism (rare)',
      'Conversion to open',
    ],
    relatedProcedures: ['49000', '44970', '47562'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDOSCOPY
  // ═══════════════════════════════════════════════════════════════════════════

  // 30
  {
    code: '43239',
    name: 'Oesophagogastroduodenoscopy (EGD) with biopsy',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'PT/INR if on anticoagulants',
      'Hold anticoagulants per guideline (warfarin 5 days, DOACs 48 hours)',
      'NPO 8 hours (solids), 2 hours (clear liquids)',
      'Informed consent (bleeding, perforation)',
      'Escort arranged for sedation recovery',
    ],
    postOpCare: [
      'NPO 1 hour post-procedure, then clear liquids, advance as tolerated',
      'No driving for 24 hours (if sedation)',
      'Resume anticoagulants per protocol',
      'Pathology follow-up at 1-2 weeks',
      'Follow-up 2-4 weeks with biopsy results',
      'Return precautions: haematemesis, melaena, severe abdominal pain, fever',
    ],
    commonIndications: [
      'K21.0',    // Gastro-oesophageal reflux disease with oesophagitis
      'K25.9',    // Gastric ulcer, unspecified
      'K29.70',   // Gastritis, unspecified, without bleeding
      'R13.10',   // Dysphagia, unspecified
      'K22.70',   // Barrett oesophagus without dysplasia
      'R11.2',    // Nausea with vomiting, unspecified
    ],
    complications: [
      'Bleeding (biopsy site)',
      'Perforation',
      'Aspiration',
      'Adverse sedation reaction',
      'Sore throat',
    ],
    relatedProcedures: ['43235', '43249', '43247', '43255'],
  },

  // 31
  {
    code: '43235',
    name: 'Oesophagogastroduodenoscopy (EGD), diagnostic',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation'],
    typicalDuration: '10-20 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'NPO 8 hours (solids), 2 hours (clear liquids)',
      'Informed consent',
      'Escort arranged for sedation recovery',
    ],
    postOpCare: [
      'NPO 1 hour post-procedure, then clear liquids',
      'No driving for 24 hours (if sedation)',
      'Follow-up 2-4 weeks',
      'Return precautions: haematemesis, melaena, severe abdominal pain',
    ],
    commonIndications: [
      'K21.0',
      'K25.9',
      'R13.10',
      'R10.13',   // Epigastric pain
      'K30',      // Functional dyspepsia
      'R11.2',
    ],
    complications: [
      'Perforation (rare for diagnostic)',
      'Aspiration',
      'Adverse sedation reaction',
      'Sore throat',
    ],
    relatedProcedures: ['43239', '43249', '43247'],
  },

  // 32
  {
    code: '43249',
    name: 'EGD with balloon dilation of oesophagus',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation', 'general'],
    typicalDuration: '20-40 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR',
      'Barium swallow or prior EGD documenting stricture',
      'NPO 8 hours',
      'Informed consent (perforation risk, repeat dilation may be needed)',
      'Escort arranged for sedation recovery',
    ],
    postOpCare: [
      'NPO 2 hours, then clear liquids, soft diet for 24-48 hours',
      'Gastrografin swallow if perforation concern',
      'No driving for 24 hours',
      'Follow-up 4-6 weeks',
      'Return precautions: chest pain, subcutaneous emphysema, fever, haematemesis',
    ],
    commonIndications: [
      'K22.2',    // Oesophageal obstruction (stricture)
      'K20.9',    // Oesophagitis, unspecified
      'T28.6XXA', // Corrosive injury of oesophagus (stricture sequela)
      'R13.10',
    ],
    complications: [
      'Oesophageal perforation',
      'Bleeding',
      'Aspiration',
      'Recurrent stricture',
      'Bacteraemia',
    ],
    relatedProcedures: ['43235', '43239'],
  },

  // 33
  {
    code: '43247',
    name: 'EGD with foreign body removal',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation', 'general'],
    typicalDuration: '15-45 min',
    preOpRequirements: [
      'CBC',
      'X-ray neck/chest/abdomen (locate foreign body, assess perforation)',
      'CT if sharp object or perforation suspected',
      'NPO (emergency: proceed regardless)',
      'Informed consent (perforation, mucosal injury)',
      'Escort arranged',
    ],
    postOpCare: [
      'NPO 1-2 hours, then clear liquids if no mucosal injury',
      'CXR post-procedure if concern for perforation',
      'Soft diet for 24-48 hours',
      'Follow-up 1-2 weeks',
      'Return precautions: chest pain, fever, haematemesis, dysphagia',
    ],
    commonIndications: [
      'T18.108A', // Unspecified foreign body in oesophagus causing other injury, initial encounter
      'T18.100A', // Unspecified foreign body in oesophagus causing compression of trachea, initial encounter
      'T18.2XXA', // Foreign body in stomach, initial encounter
    ],
    complications: [
      'Oesophageal perforation',
      'Mucosal laceration',
      'Bleeding',
      'Aspiration',
      'Incomplete removal requiring surgery',
    ],
    relatedProcedures: ['43235', '43239'],
  },

  // 34
  {
    code: '43255',
    name: 'EGD with control of bleeding',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation', 'general'],
    typicalDuration: '20-60 min',
    preOpRequirements: [
      'CBC, BMP, LFTs',
      'PT/INR, PTT',
      'Type and crossmatch (2-4 units pRBC)',
      'IV access (2 large-bore)',
      'Active resuscitation (fluids, blood products)',
      'PPI infusion initiated',
      'NPO (emergency: proceed regardless)',
      'Informed consent',
      'Anaesthesia standby for airway protection',
    ],
    postOpCare: [
      'ICU or high-dependency monitoring for 24-48 hours',
      'IV PPI infusion for 72 hours',
      'Serial haemoglobin checks (6h, 12h, 24h)',
      'NPO 24 hours, then clear liquids if stable',
      'Resume anticoagulants per gastroenterology guidance',
      'Follow-up EGD in 6-8 weeks (ulcer healing)',
      'H. pylori testing and eradication if positive',
      'Return precautions: recurrent haematemesis, melaena, dizziness, syncope',
    ],
    commonIndications: [
      'K92.0',    // Haematemesis
      'K92.1',    // Melaena
      'K25.0',    // Acute gastric ulcer with haemorrhage
      'K26.0',    // Acute duodenal ulcer with haemorrhage
      'K22.11',   // Ulcer of oesophagus with bleeding
      'I85.01',   // Oesophageal varices with bleeding
    ],
    complications: [
      'Re-bleeding',
      'Perforation',
      'Aspiration',
      'Failed haemostasis requiring surgery or interventional radiology',
      'Adverse sedation reaction',
    ],
    relatedProcedures: ['43239', '43235'],
  },

  // 35
  {
    code: '45378',
    name: 'Colonoscopy, diagnostic',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation'],
    typicalDuration: '20-45 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'PT/INR if on anticoagulants',
      'Bowel preparation (split-dose PEG solution or equivalent)',
      'Clear liquid diet day before',
      'Hold iron supplements 5 days before',
      'Hold anticoagulants per guideline',
      'NPO 8 hours',
      'Informed consent',
      'Escort arranged for sedation recovery',
    ],
    postOpCare: [
      'Light diet post-procedure, advance as tolerated',
      'No driving for 24 hours',
      'Expect mild bloating and cramping (1-2 hours)',
      'Resume anticoagulants per protocol',
      'Follow-up 2-4 weeks',
      'Screening interval per findings (10 years if normal)',
      'Return precautions: rectal bleeding, severe abdominal pain, fever',
    ],
    commonIndications: [
      'Z12.11',   // Encounter for screening for malignant neoplasm of colon
      'K92.1',    // Melaena
      'D50.0',    // Iron deficiency anaemia secondary to blood loss
      'R19.5',    // Other faecal abnormalities (positive FIT/FOBT)
      'Z86.010',  // Personal history of colonic polyps
    ],
    complications: [
      'Perforation',
      'Bleeding',
      'Post-polypectomy syndrome (rare, if incidental polypectomy)',
      'Adverse sedation reaction',
      'Incomplete examination',
    ],
    relatedProcedures: ['45380', '45385', '45381'],
  },

  // 36
  {
    code: '45380',
    name: 'Colonoscopy with biopsy',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation'],
    typicalDuration: '20-45 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'PT/INR if on anticoagulants',
      'Bowel preparation (split-dose PEG solution)',
      'Clear liquid diet day before',
      'Hold anticoagulants per guideline',
      'NPO 8 hours',
      'Informed consent (bleeding, perforation)',
      'Escort arranged for sedation recovery',
    ],
    postOpCare: [
      'Light diet post-procedure, advance as tolerated',
      'No driving for 24 hours',
      'Resume anticoagulants per protocol',
      'Pathology follow-up at 1-2 weeks',
      'Follow-up 2-4 weeks with biopsy results',
      'Return precautions: rectal bleeding, severe abdominal pain, fever',
    ],
    commonIndications: [
      'K51.90',   // Ulcerative colitis, unspecified, without complications
      'K50.90',   // Crohn disease, unspecified, without complications
      'K52.9',    // Noninfective gastroenteritis and colitis, unspecified
      'R19.5',
      'D50.0',
    ],
    complications: [
      'Bleeding (biopsy site)',
      'Perforation',
      'Adverse sedation reaction',
      'Incomplete examination',
    ],
    relatedProcedures: ['45378', '45385', '45381'],
  },

  // 37
  {
    code: '45385',
    name: 'Colonoscopy with polypectomy (snare technique)',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'PT/INR',
      'Bowel preparation (split-dose PEG solution)',
      'Clear liquid diet day before',
      'Hold anticoagulants: warfarin 5 days, clopidogrel 7 days, DOACs 48 hours',
      'Hold aspirin per risk stratification',
      'NPO 8 hours',
      'Informed consent (bleeding, perforation, incomplete removal)',
      'Escort arranged',
    ],
    postOpCare: [
      'Clear liquids for 24 hours, then advance to regular diet',
      'No heavy lifting or strenuous activity for 1 week',
      'No driving for 24 hours',
      'Resume anticoagulants per protocol (typically 1-7 days post, risk-dependent)',
      'Pathology follow-up at 1-2 weeks',
      'Surveillance interval per pathology (adenoma: 3-5 years)',
      'Follow-up 2-4 weeks',
      'Return precautions: rectal bleeding, severe abdominal pain, fever, dizziness',
    ],
    commonIndications: [
      'K63.5',    // Polyp of colon
      'D12.6',    // Benign neoplasm of colon, unspecified
      'D12.3',    // Benign neoplasm of transverse colon
      'Z86.010',
      'Z12.11',
    ],
    complications: [
      'Post-polypectomy bleeding (immediate or delayed up to 14 days)',
      'Perforation',
      'Post-polypectomy syndrome (serosal burn)',
      'Incomplete polyp removal',
      'Adverse sedation reaction',
    ],
    relatedProcedures: ['45378', '45380', '45381'],
  },

  // 38
  {
    code: '45381',
    name: 'Colonoscopy with submucosal injection',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation'],
    typicalDuration: '25-50 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'PT/INR if on anticoagulants',
      'Bowel preparation (split-dose PEG solution)',
      'Hold anticoagulants per guideline',
      'NPO 8 hours',
      'Informed consent',
      'Escort arranged',
    ],
    postOpCare: [
      'Light diet post-procedure',
      'No driving for 24 hours',
      'Resume anticoagulants per protocol',
      'Follow-up 2-4 weeks',
      'Return precautions: rectal bleeding, abdominal pain, fever',
    ],
    commonIndications: [
      'K63.5',
      'K92.1',
      'D12.6',
    ],
    complications: [
      'Bleeding',
      'Perforation',
      'Injection site reaction',
      'Adverse sedation reaction',
    ],
    relatedProcedures: ['45385', '45380', '45378'],
  },

  // 39
  {
    code: '43260',
    name: 'ERCP, diagnostic',
    category: 'endoscopy',
    complexity: 'major',
    anaesthesia: ['general', 'sedation'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP, LFTs (AST, ALT, ALP, GGT, bilirubin)',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'MRCP or abdominal ultrasound',
      'ECG',
      'NPO 8 hours',
      'Allergy assessment (contrast, antibiotics)',
      'Informed consent (pancreatitis, bleeding, perforation)',
    ],
    postOpCare: [
      'NPO 4-6 hours, then clear liquids if no abdominal pain',
      'Lipase at 2-4 hours post-procedure',
      'IV fluids (aggressive hydration, Lactated Ringer preferred)',
      'Rectal indomethacin (prophylaxis for post-ERCP pancreatitis)',
      'Monitor for pancreatitis: pain, nausea, lipase elevation',
      'Follow-up 1-2 weeks',
      'Return precautions: severe epigastric pain, fever, jaundice, haematemesis',
    ],
    commonIndications: [
      'K83.1',    // Obstruction of bile duct
      'K80.50',   // Calculus of bile duct without cholangitis
      'K83.09',   // Other cholangitis
      'K86.1',    // Other chronic pancreatitis
      'C24.0',    // Malignant neoplasm of extrahepatic bile duct
    ],
    complications: [
      'Post-ERCP pancreatitis (5-10%)',
      'Bleeding',
      'Cholangitis',
      'Perforation (duodenal or bile duct)',
      'Adverse sedation reaction',
    ],
    relatedProcedures: ['43262', '43264', '43274'],
  },

  // 40
  {
    code: '43262',
    name: 'ERCP with sphincterotomy',
    category: 'endoscopy',
    complexity: 'major',
    anaesthesia: ['general', 'sedation'],
    typicalDuration: '30-75 min',
    preOpRequirements: [
      'CBC, BMP, LFTs',
      'Lipase/amylase',
      'PT/INR (must be <1.5)',
      'Type and screen',
      'MRCP or abdominal ultrasound',
      'ECG',
      'Hold anticoagulants: warfarin 5 days (bridge if high risk), clopidogrel 7 days',
      'NPO 8 hours',
      'Informed consent (pancreatitis, bleeding, perforation)',
    ],
    postOpCare: [
      'NPO 4-6 hours, then clear liquids if no abdominal pain',
      'Lipase at 2-4 hours post-procedure',
      'IV fluids (aggressive hydration)',
      'Rectal indomethacin (post-ERCP pancreatitis prophylaxis)',
      'Resume anticoagulants in 3-7 days (risk-dependent)',
      'Follow-up 1-2 weeks',
      'Return precautions: severe epigastric pain, fever/rigors, jaundice, melaena',
    ],
    commonIndications: [
      'K80.50',
      'K83.1',
      'K83.09',
      'K91.5',    // Post-cholecystectomy syndrome
      'K85.1',    // Biliary acute pancreatitis
    ],
    complications: [
      'Post-ERCP pancreatitis',
      'Bleeding (sphincterotomy site)',
      'Cholangitis',
      'Perforation',
      'Recurrent stone formation',
    ],
    relatedProcedures: ['43260', '43264', '43274', '47562'],
  },

  // 41
  {
    code: '43264',
    name: 'ERCP with stone removal',
    category: 'endoscopy',
    complexity: 'major',
    anaesthesia: ['general', 'sedation'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC, BMP, LFTs',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'MRCP (stone confirmation and anatomy)',
      'ECG',
      'Hold anticoagulants per guideline',
      'NPO 8 hours',
      'Informed consent (pancreatitis, incomplete clearance, stent placement)',
    ],
    postOpCare: [
      'NPO 4-6 hours, then clear liquids',
      'Lipase at 2-4 hours post-procedure',
      'IV fluids (aggressive hydration)',
      'Rectal indomethacin prophylaxis',
      'Stent removal planning (if temporary stent placed)',
      'Follow-up 1-2 weeks',
      'LFTs at follow-up',
      'Return precautions: severe epigastric pain, fever/rigors, jaundice, melaena',
    ],
    commonIndications: [
      'K80.50',
      'K80.40',   // Calculus of bile duct with cholecystitis without obstruction
      'K80.30',   // Calculus of bile duct with cholangitis, unspecified, without obstruction
      'K85.1',
    ],
    complications: [
      'Post-ERCP pancreatitis',
      'Retained stones',
      'Bleeding',
      'Perforation',
      'Basket impaction',
      'Cholangitis',
    ],
    relatedProcedures: ['43262', '43260', '43274', '47563'],
  },

  // 42
  {
    code: '43274',
    name: 'ERCP with biliary stent placement',
    category: 'endoscopy',
    complexity: 'major',
    anaesthesia: ['general', 'sedation'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC, BMP, LFTs',
      'Lipase/amylase',
      'PT/INR',
      'Type and screen',
      'MRCP or CT abdomen (define stricture / obstruction)',
      'Tumour markers (CA 19-9 if malignant obstruction suspected)',
      'ECG',
      'NPO 8 hours',
      'Informed consent (pancreatitis, stent migration, occlusion)',
    ],
    postOpCare: [
      'NPO 4-6 hours, then clear liquids',
      'Lipase at 2-4 hours',
      'IV fluids',
      'Monitor bilirubin trend (should decrease within 48-72 hours)',
      'Stent exchange scheduling if plastic stent (every 3 months)',
      'Oncology referral if malignant obstruction',
      'Follow-up 1-2 weeks, then per stent exchange schedule',
      'Return precautions: fever/rigors (cholangitis), jaundice recurrence, abdominal pain',
    ],
    commonIndications: [
      'K83.1',
      'C24.0',    // Malignant neoplasm of extrahepatic bile duct
      'C25.0',    // Malignant neoplasm of head of pancreas
      'K83.09',
      'K80.50',
    ],
    complications: [
      'Post-ERCP pancreatitis',
      'Stent migration',
      'Stent occlusion',
      'Cholangitis',
      'Perforation',
      'Bleeding',
    ],
    relatedProcedures: ['43260', '43262', '43264'],
  },

  // 43
  {
    code: '45330',
    name: 'Flexible sigmoidoscopy, diagnostic',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation', 'local'],
    typicalDuration: '10-20 min',
    preOpRequirements: [
      'CBC',
      'Fleet enema x 2 (morning of procedure)',
      'No full bowel preparation required',
      'Hold anticoagulants per guideline (if biopsy anticipated)',
      'Informed consent',
      'Escort arranged if sedation used',
    ],
    postOpCare: [
      'Resume normal diet immediately',
      'Mild bloating expected (1-2 hours)',
      'Follow-up 2-4 weeks',
      'Return precautions: rectal bleeding, abdominal pain, fever',
    ],
    commonIndications: [
      'K62.5',    // Haemorrhage of anus and rectum
      'R19.5',
      'K51.90',
      'Z12.11',
    ],
    complications: [
      'Perforation (rare)',
      'Bleeding',
      'Vasovagal reaction',
      'Incomplete examination',
    ],
    relatedProcedures: ['45331', '45378'],
  },

  // 44
  {
    code: '45331',
    name: 'Flexible sigmoidoscopy with biopsy',
    category: 'endoscopy',
    complexity: 'minor',
    anaesthesia: ['sedation', 'local'],
    typicalDuration: '10-25 min',
    preOpRequirements: [
      'CBC',
      'PT/INR if on anticoagulants',
      'Fleet enema x 2 (morning of procedure)',
      'Hold anticoagulants per guideline',
      'Informed consent (bleeding, perforation)',
      'Escort arranged if sedation used',
    ],
    postOpCare: [
      'Resume normal diet immediately',
      'Small amount of rectal bleeding is normal (24 hours)',
      'Pathology follow-up at 1-2 weeks',
      'Resume anticoagulants per protocol',
      'Follow-up 2-4 weeks',
      'Return precautions: persistent rectal bleeding, abdominal pain, fever',
    ],
    commonIndications: [
      'K62.5',
      'K51.90',
      'K50.10',   // Crohn disease of large intestine without complications
      'K62.1',    // Rectal polyp
    ],
    complications: [
      'Bleeding (biopsy site)',
      'Perforation',
      'Vasovagal reaction',
    ],
    relatedProcedures: ['45330', '45380'],
  },

  // 45
  {
    code: '43246',
    name: 'Percutaneous endoscopic gastrostomy (PEG) tube placement',
    category: 'endoscopy',
    complexity: 'intermediate',
    anaesthesia: ['sedation', 'general'],
    typicalDuration: '20-40 min',
    preOpRequirements: [
      'CBC, BMP, albumin',
      'PT/INR',
      'Nutritional assessment',
      'Speech and swallow evaluation',
      'CXR (pre-procedure)',
      'Assess abdominal wall (no prior surgery at site ideally)',
      'Discuss goals of care / advance directives',
      'Prophylactic antibiotics (cefazolin)',
      'NPO 8 hours',
      'Informed consent (buried bumper, peritonitis, aspiration)',
    ],
    postOpCare: [
      'NPO 24 hours, then start tube feeds slowly',
      'PEG site care: keep dry, clean with saline daily',
      'External bolster positioning (1-2 cm from skin)',
      'Head of bed elevated ≥30° during and 1 hour after feeds',
      'PEG tube flushing (30 ml water before and after each feed)',
      'Dietitian consultation for feeding regimen',
      'Follow-up 1 week (PEG site check), then 4 weeks',
      'Return precautions: PEG site erythema/drainage, abdominal pain, fever, tube dislodgement',
    ],
    commonIndications: [
      'R13.10',   // Dysphagia
      'R13.19',   // Other dysphagia
      'R63.3',    // Feeding difficulties
      'I63.9',    // Cerebral infarction, unspecified (post-stroke dysphagia)
      'C15.9',    // Malignant neoplasm of oesophagus, unspecified (palliation)
    ],
    complications: [
      'Peristomal wound infection',
      'Buried bumper syndrome',
      'Tube dislodgement',
      'Aspiration pneumonia',
      'Peritonitis',
      'Gastrocolic fistula',
      'Bleeding',
    ],
    relatedProcedures: ['43235', '43239'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANORECTAL
  // ═══════════════════════════════════════════════════════════════════════════

  // 46
  {
    code: '46260',
    name: 'Haemorrhoidectomy, internal and external',
    category: 'anorectal',
    complexity: 'intermediate',
    anaesthesia: ['general', 'regional'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC',
      'PT/INR if on anticoagulants',
      'Anoscopy / proctoscopy (confirm grade and location)',
      'Colonoscopy (if age >45 or red flag symptoms, to rule out proximal pathology)',
      'Fleet enema morning of surgery',
      'NPO 8 hours',
      'Informed consent (pain, bleeding, stenosis, incontinence)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily starting day 1',
      'High-fibre diet and stool softeners (docusate)',
      'Adequate hydration (≥2 litres/day)',
      'Analgesics: multimodal (paracetamol, NSAIDs, topical lidocaine/metronidazole)',
      'Laxatives to avoid constipation',
      'Wound check 1 week',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: heavy rectal bleeding, urinary retention, fever, inability to pass stool',
    ],
    commonIndications: [
      'K64.8',    // Other haemorrhoids
      'K64.1',    // Second degree haemorrhoids
      'K64.2',    // Third degree haemorrhoids
      'K64.3',    // Fourth degree haemorrhoids
      'K64.4',    // Residual haemorrhoidal skin tags
    ],
    complications: [
      'Post-operative pain (significant)',
      'Urinary retention',
      'Bleeding (primary or secondary)',
      'Anal stenosis',
      'Faecal incontinence',
      'Wound infection',
      'Recurrence',
    ],
    relatedProcedures: ['46947', '46080'],
  },

  // 47
  {
    code: '46947',
    name: 'Haemorrhoidopexy (stapled / PPH)',
    category: 'anorectal',
    complexity: 'intermediate',
    anaesthesia: ['general', 'regional'],
    typicalDuration: '30-45 min',
    preOpRequirements: [
      'CBC',
      'PT/INR if on anticoagulants',
      'Anoscopy / proctoscopy',
      'Colonoscopy (if indicated by age or symptoms)',
      'Fleet enema morning of surgery',
      'NPO 8 hours',
      'Informed consent (recurrence, urgency, staple line complications)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily',
      'High-fibre diet and stool softeners',
      'Analgesics (typically less pain than excisional haemorrhoidectomy)',
      'Avoid straining',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: rectal bleeding, pelvic pain, fever, urinary retention',
    ],
    commonIndications: [
      'K64.2',
      'K64.3',
      'K64.8',
    ],
    complications: [
      'Recurrence (higher than excisional)',
      'Staple line bleeding',
      'Urinary retention',
      'Pelvic sepsis (rare but serious)',
      'Rectal stenosis',
      'Chronic proctalgia',
      'Recto-vaginal fistula (rare)',
    ],
    relatedProcedures: ['46260'],
  },

  // 48
  {
    code: '46080',
    name: 'Lateral internal sphincterotomy',
    category: 'anorectal',
    complexity: 'minor',
    anaesthesia: ['local', 'regional', 'general'],
    typicalDuration: '10-20 min',
    preOpRequirements: [
      'Clinical diagnosis of chronic anal fissure (>6 weeks, failed conservative therapy)',
      'Anorectal examination (confirm hypertonic sphincter)',
      'CBC',
      'NPO 8 hours (if sedation/general)',
      'Informed consent (incontinence risk, incomplete healing)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily',
      'High-fibre diet and stool softeners',
      'Adequate hydration',
      'Topical wound care',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: persistent bleeding, incontinence to flatus/stool, fever',
    ],
    commonIndications: [
      'K60.1',    // Chronic anal fissure
      'K60.0',    // Acute anal fissure
      'K60.2',    // Anal fissure, unspecified
    ],
    complications: [
      'Faecal incontinence (minor: flatus, soiling)',
      'Non-healing fissure',
      'Perianal abscess / fistula',
      'Bleeding',
      'Keyhole deformity',
    ],
    relatedProcedures: ['46260', '46060'],
  },

  // 49
  {
    code: '46270',
    name: 'Fistulotomy, subcutaneous',
    category: 'anorectal',
    complexity: 'minor',
    anaesthesia: ['local', 'regional', 'general'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'CBC',
      'Anorectal examination (define fistula tract, identify internal opening)',
      'MRI pelvis (if recurrent or complex fistula suspected)',
      'Examination under anaesthesia (may be combined)',
      'NPO 8 hours (if sedation/general)',
      'Informed consent (recurrence, incontinence)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily',
      'Wound packing if needed',
      'High-fibre diet and stool softeners',
      'Daily wound care until healed (4-8 weeks)',
      'Follow-up 2 weeks, then monthly until healed',
      'Return precautions: recurrent abscess, increasing pain, incontinence',
    ],
    commonIndications: [
      'K60.3',    // Anal fistula
      'K60.5',    // Anorectal fistula
      'K61.0',    // Anal abscess (with fistula)',
    ],
    complications: [
      'Recurrence',
      'Faecal incontinence',
      'Delayed wound healing',
      'Bleeding',
      'Anal stenosis',
    ],
    relatedProcedures: ['46275', '46060'],
  },

  // 50
  {
    code: '46275',
    name: 'Fistulotomy, intersphincteric',
    category: 'anorectal',
    complexity: 'intermediate',
    anaesthesia: ['regional', 'general'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC',
      'MRI pelvis (define tract anatomy, Parks classification)',
      'Anorectal examination / examination under anaesthesia',
      'Anorectal manometry (if concern for pre-existing sphincter weakness)',
      'NPO 8 hours',
      'Informed consent (recurrence, incontinence, staged procedures)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily',
      'Wound packing / dressing changes',
      'High-fibre diet and stool softeners',
      'Pain management (paracetamol, NSAIDs)',
      'Follow-up 2 weeks, then monthly until healed',
      'Return precautions: recurrent abscess, incontinence, persistent drainage',
    ],
    commonIndications: [
      'K60.3',
      'K60.5',
      'K61.0',
    ],
    complications: [
      'Recurrence',
      'Faecal incontinence (higher risk than subcutaneous)',
      'Delayed wound healing',
      'Bleeding',
      'Need for staged repair (seton placement)',
    ],
    relatedProcedures: ['46270', '46060'],
  },

  // 51
  {
    code: '46060',
    name: 'Incision and drainage, perianal abscess',
    category: 'anorectal',
    complexity: 'minor',
    anaesthesia: ['local', 'regional', 'general'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'CBC',
      'BMP, HbA1c (diabetic patients)',
      'Culture (send at time of I&D)',
      'CT pelvis or MRI (if deep / ischiorectal abscess suspected)',
      'NPO if sedation/general planned',
      'Informed consent (fistula formation, recurrence)',
    ],
    postOpCare: [
      'Sitz baths 3-4 times daily',
      'Wound packing and daily dressing changes',
      'Antibiotics if cellulitis, immunocompromised, or prosthetic valves',
      'High-fibre diet and stool softeners',
      'Follow-up 3-5 days (wound check), then 2 weeks',
      'Monitor for fistula development (40-50% risk)',
      'Return precautions: recurrent swelling/pain, fever, inability to pass stool',
    ],
    commonIndications: [
      'K61.0',    // Anal abscess
      'K61.1',    // Rectal abscess
      'K61.2',    // Anorectal abscess
      'K61.31',   // Horseshoe abscess
      'K61.39',   // Other ischiorectal abscess
    ],
    complications: [
      'Fistula formation (40-50%)',
      'Recurrence',
      'Incomplete drainage',
      'Bacteraemia / sepsis',
      'Necrotising fasciitis (rare)',
    ],
    relatedProcedures: ['46270', '46275', '10061'],
  },

  // 52
  {
    code: '11770',
    name: 'Pilonidal cyst excision, simple',
    category: 'anorectal',
    complexity: 'minor',
    anaesthesia: ['local', 'regional'],
    typicalDuration: '20-40 min',
    preOpRequirements: [
      'CBC',
      'Clinical assessment of extent (number of pits, sinuses)',
      'Shave natal cleft hair pre-op',
      'NPO 6 hours (if sedation)',
      'Informed consent (recurrence, wound healing time)',
    ],
    postOpCare: [
      'Wound packing and daily dressing changes (if left open)',
      'Sitz baths / wound irrigation',
      'Shave or depilate natal cleft (reduce recurrence)',
      'Activity: avoid prolonged sitting for 2-4 weeks',
      'Follow-up 1 week, then weekly until healed (4-8 weeks if open technique)',
      'Return precautions: increasing pain, fever, wound drainage, recurrence',
    ],
    commonIndications: [
      'L05.91',   // Pilonidal cyst without abscess
      'L05.01',   // Pilonidal cyst with abscess
      'L05.02',   // Pilonidal sinus with abscess
    ],
    complications: [
      'Recurrence (10-30%)',
      'Wound infection',
      'Delayed wound healing',
      'Bleeding',
      'Chronic sinus formation',
    ],
    relatedProcedures: ['11772', '10060'],
  },

  // 53
  {
    code: '11772',
    name: 'Pilonidal cyst excision, complicated (extensive)',
    category: 'anorectal',
    complexity: 'intermediate',
    anaesthesia: ['regional', 'general'],
    typicalDuration: '45-90 min',
    preOpRequirements: [
      'CBC',
      'BMP',
      'MRI if deep or complex disease suspected',
      'Mark extent of disease pre-op',
      'Shave natal cleft',
      'NPO 8 hours',
      'Informed consent (flap reconstruction options, recurrence, wound healing)',
    ],
    postOpCare: [
      'Wound care: VAC therapy or daily dressing changes (if open)',
      'Drain management (if flap reconstruction)',
      'Sitz baths when wound allows',
      'Activity: avoid sitting for 3-4 weeks, no heavy lifting',
      'Natal cleft hair removal (laser or shaving) to reduce recurrence',
      'Follow-up 1 week, then weekly until healed',
      'Return precautions: wound breakdown, fever, increasing drainage',
    ],
    commonIndications: [
      'L05.91',
      'L05.01',
      'L05.92',   // Pilonidal sinus without abscess
      'L05.02',
    ],
    complications: [
      'Recurrence',
      'Wound dehiscence',
      'Flap necrosis (if flap reconstruction)',
      'Wound infection',
      'Chronic non-healing wound',
      'Scarring / disfigurement',
    ],
    relatedProcedures: ['11770', '10061'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER
  // ═══════════════════════════════════════════════════════════════════════════

  // 54
  {
    code: '36556',
    name: 'Central venous catheter insertion, non-tunneled',
    category: 'vascular',
    complexity: 'intermediate',
    anaesthesia: ['local'],
    typicalDuration: '20-40 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR, PTT',
      'Type and screen (if coagulopathic)',
      'Ultrasound guidance equipment available',
      'CXR (baseline)',
      'Sterile barrier precautions (full drape)',
      'Informed consent (pneumothorax, bleeding, infection, air embolism)',
    ],
    postOpCare: [
      'Post-procedure CXR (confirm position, rule out pneumothorax)',
      'Line dressing per institutional protocol (transparent, changed every 7 days)',
      'Daily line assessment (infection signs)',
      'Flush and aspirate per protocol',
      'Catheter removal when no longer needed (minimise dwell time)',
      'Follow-up as per inpatient or outpatient protocol',
      'Return precautions: shortness of breath, line site erythema/swelling, fever',
    ],
    commonIndications: [
      'Z96.82',   // Presence of other vascular implants and grafts (access)
      'R57.1',    // Hypovolaemic shock (resuscitation access)
      'E87.1',    // Hypo-osmolality and hyponatraemia (TPN access)
      'Z49.01',   // Encounter for fitting and adjustment of extracorporeal dialysis catheter
    ],
    complications: [
      'Pneumothorax',
      'Arterial puncture',
      'Haematoma',
      'Air embolism',
      'Catheter-related bloodstream infection (CRBSI)',
      'Venous thrombosis',
      'Catheter malposition',
    ],
    relatedProcedures: ['32551'],
  },

  // 55
  {
    code: '32551',
    name: 'Chest tube / thoracostomy tube insertion',
    category: 'other',
    complexity: 'intermediate',
    anaesthesia: ['local', 'sedation'],
    typicalDuration: '15-30 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR',
      'CXR or CT chest (confirm indication, locate collection)',
      'Ultrasound (for effusion localisation)',
      'Type and screen (if haemothorax)',
      'Pulse oximetry and cardiac monitoring',
      'Informed consent (bleeding, infection, organ injury)',
    ],
    postOpCare: [
      'CXR post-insertion (confirm position, lung re-expansion)',
      'Chest drain on underwater seal or suction (-20 cmH2O)',
      'Monitor output volume and character hourly initially',
      'Daily CXR',
      'Respiratory physiotherapy (incentive spirometry)',
      'Drain removal when output <200 ml/24h, no air leak, lung expanded',
      'DVT prophylaxis',
      'Follow-up CXR 24h after removal',
      'Return precautions: increasing dyspnoea, chest pain, drain dislodgement, subcutaneous emphysema',
    ],
    commonIndications: [
      'J93.9',    // Pneumothorax, unspecified
      'J93.0',    // Spontaneous tension pneumothorax
      'J94.0',    // Chylous effusion
      'J91.0',    // Malignant pleural effusion
      'S27.0XXA', // Traumatic pneumothorax, initial encounter
      'J90',      // Pleural effusion, not elsewhere classified
    ],
    complications: [
      'Tube malposition',
      'Re-expansion pulmonary oedema',
      'Intercostal vessel bleeding',
      'Organ injury (lung, diaphragm, liver, spleen)',
      'Empyema / infection',
      'Subcutaneous emphysema',
      'Persistent air leak',
    ],
    relatedProcedures: ['36556'],
  },

  // 56
  {
    code: '31600',
    name: 'Tracheostomy, planned',
    category: 'other',
    complexity: 'major',
    anaesthesia: ['general', 'local'],
    typicalDuration: '30-60 min',
    preOpRequirements: [
      'CBC, BMP',
      'PT/INR, PTT',
      'Type and crossmatch (2 units pRBC)',
      'CT neck (if anatomy uncertain or prior surgery)',
      'Thyroid function (if thyroid enlargement)',
      'ECG',
      'Flexible laryngoscopy (assess subglottic anatomy)',
      'NPO 8 hours (elective)',
      'Informed consent (bleeding, tracheal stenosis, decannulation timeline)',
    ],
    postOpCare: [
      'Humidified air/oxygen via tracheostomy collar',
      'Suction as needed (inner cannula cleaning every 4-8 hours)',
      'First tracheostomy tube change at 5-7 days (by surgeon)',
      'Stoma care: clean with saline, change tracheostomy ties daily',
      'Cuff pressure monitoring (≤25 cmH2O)',
      'Speech and swallow therapy referral',
      'Decannulation protocol when appropriate',
      'Emergency kit at bedside (spare tube, tracheal dilators)',
      'Follow-up 1 week, then 2 weeks',
      'Return precautions: tube dislodgement, bleeding, respiratory distress, stoma infection',
    ],
    commonIndications: [
      'J96.01',   // Acute respiratory failure with hypoxia
      'J95.00',   // Tracheostomy complication, unspecified (revision)
      'C32.9',    // Malignant neoplasm of larynx, unspecified
      'G12.21',   // Amyotrophic lateral sclerosis (prolonged ventilation)
      'J44.1',    // Chronic obstructive pulmonary disease with acute exacerbation (prolonged intubation)',
    ],
    complications: [
      'Bleeding (immediate or delayed)',
      'Tube dislodgement / false passage',
      'Tracheal stenosis',
      'Tracheo-innominate artery fistula (rare, life-threatening)',
      'Stomal infection',
      'Pneumothorax / pneumomediastinum',
      'Tracheomalacia',
      'Difficulty with decannulation',
    ],
    relatedProcedures: ['32551'],
  },

  // 57
  {
    code: '38500',
    name: 'Lymph node biopsy, open, superficial',
    category: 'other',
    complexity: 'minor',
    anaesthesia: ['local', 'sedation'],
    typicalDuration: '20-40 min',
    preOpRequirements: [
      'CBC with differential',
      'BMP, LDH, uric acid',
      'CXR',
      'Ultrasound of lymph node region',
      'CT (if staging required)',
      'Previous FNA or core biopsy results (if available)',
      'NPO 6 hours (if sedation)',
      'Informed consent (scarring, nerve injury, incomplete diagnosis)',
    ],
    postOpCare: [
      'Wound check day 5-7',
      'Ice application for 48 hours',
      'Activity: avoid strenuous use of affected area for 1-2 weeks',
      'Pathology / flow cytometry follow-up at 1 week',
      'Haematology / oncology referral per pathology',
      'Follow-up 1-2 weeks',
      'Return precautions: wound infection, persistent drainage, new lymphadenopathy',
    ],
    commonIndications: [
      'R59.1',    // Generalised enlarged lymph nodes
      'R59.0',    // Localised enlarged lymph nodes
      'C85.90',   // Non-Hodgkin lymphoma, unspecified (suspected)
      'C81.90',   // Hodgkin lymphoma, unspecified (suspected)
      'B20',      // HIV disease (staging)
    ],
    complications: [
      'Wound infection',
      'Bleeding / haematoma',
      'Nerve injury (marginal mandibular, accessory nerve)',
      'Seroma',
      'Lymph leak / lymphocoele',
      'Scar hypertrophy',
    ],
    relatedProcedures: ['38525', '11400'],
  },

  // 58
  {
    code: '44143',
    name: 'Colectomy, partial, with end-colostomy (Hartmann procedure)',
    category: 'colorectal',
    complexity: 'complex',
    anaesthesia: ['general'],
    typicalDuration: '120-240 min',
    preOpRequirements: [
      'CBC, BMP, albumin',
      'PT/INR, PTT',
      'Type and crossmatch (2-4 units pRBC)',
      'LFTs, lactate',
      'CT abdomen/pelvis with contrast',
      'ECG',
      'CXR',
      'Stoma site marking by enterostomal therapist',
      'IV fluid resuscitation',
      'Broad-spectrum antibiotics',
      'Foley catheter',
      'NPO (emergency: proceed regardless)',
      'Informed consent (stoma, anastomotic considerations, reversal discussion)',
    ],
    postOpCare: [
      'NG tube until bowel function returns',
      'Clear liquids when stoma functioning, advance slowly',
      'Stoma care education (pouching, skin care)',
      'Enterostomal therapy nurse follow-up',
      'DVT prophylaxis x 28 days',
      'Wound check day 5-7',
      'Drain monitoring (if placed)',
      'Activity: no heavy lifting >15 lbs for 8-12 weeks',
      'Pathology follow-up for staging if malignancy',
      'Oncology referral if indicated',
      'Hartmann reversal discussion at 3-6 months (if appropriate)',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: fever, stoma ischaemia (dark colour), no stoma output >24 hours, wound dehiscence',
    ],
    commonIndications: [
      'K57.20',   // Diverticulitis of large intestine with perforation and abscess without bleeding
      'K63.1',    // Perforation of intestine
      'C18.7',    // Malignant neoplasm of sigmoid colon
      'C18.9',    // Malignant neoplasm of colon, unspecified
      'K56.69',   // Other intestinal obstruction (obstructing tumour)
      'S36.509A', // Unspecified injury of sigmoid colon, initial encounter
    ],
    complications: [
      'Surgical site infection',
      'Intra-abdominal abscess',
      'Rectal stump leak / blow-out',
      'Stoma complications (retraction, prolapse, parastomal hernia, necrosis)',
      'Wound dehiscence',
      'DVT / PE',
      'Ileus',
      'Ureteral injury',
      'Anastomotic complications at reversal',
    ],
    relatedProcedures: ['44204', '44120', '49000'],
  },

  // 59
  {
    code: '44204',
    name: 'Laparoscopic colectomy, partial, with anastomosis',
    category: 'colorectal',
    complexity: 'complex',
    anaesthesia: ['general'],
    typicalDuration: '120-240 min',
    preOpRequirements: [
      'CBC, BMP, albumin',
      'PT/INR',
      'Type and crossmatch (2 units pRBC)',
      'CEA (if malignancy)',
      'CT abdomen/pelvis with contrast',
      'Colonoscopy with tattoo marking of lesion',
      'ECG',
      'CXR',
      'Mechanical bowel preparation (split-dose PEG)',
      'Oral antibiotics (neomycin + metronidazole, per ERAS protocol)',
      'Stoma site marking (in case of conversion or protective stoma)',
      'Pregnancy test (females of childbearing age)',
      'NPO 8 hours',
      'Informed consent (conversion to open, stoma, anastomotic leak)',
    ],
    postOpCare: [
      'Enhanced Recovery After Surgery (ERAS) protocol',
      'Clear liquids day 0-1, advance to regular diet by day 2-3',
      'Early ambulation (day 0)',
      'DVT prophylaxis x 28 days',
      'Multimodal analgesia (minimise opioids)',
      'Port site wound check day 3-5',
      'Monitor for anastomotic leak (tachycardia, fever, peritonitis)',
      'Foley removal day 1-2',
      'Activity: no heavy lifting >10 lbs for 6-8 weeks',
      'Pathology follow-up for staging at 1-2 weeks',
      'Oncology referral if indicated',
      'CEA monitoring and surveillance colonoscopy per guidelines',
      'Follow-up 2 weeks, then 6 weeks',
      'Return precautions: fever, increasing abdominal pain, wound drainage, no flatus/stool >72 hours',
    ],
    commonIndications: [
      'C18.0',    // Malignant neoplasm of caecum
      'C18.2',    // Malignant neoplasm of ascending colon
      'C18.7',    // Malignant neoplasm of sigmoid colon
      'K57.30',   // Diverticulosis of large intestine without perforation or abscess without bleeding
      'D12.6',    // Benign neoplasm of colon, unspecified (large polyps not amenable to endoscopic removal)
    ],
    complications: [
      'Anastomotic leak',
      'Surgical site infection',
      'Ileus',
      'Port site hernia',
      'Conversion to open',
      'Bleeding',
      'Ureteral injury',
      'DVT / PE',
      'Wound dehiscence',
    ],
    relatedProcedures: ['44143', '44120', '49320'],
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Search procedures by name, CPT code, category, or indication (ICD-10).
 * Case-insensitive substring match across multiple fields.
 */
export function searchProcedures(query: string): SurgicalProcedure[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return SURGICAL_CATALOG.filter((p) => {
    // Match against code
    if (p.code.toLowerCase().includes(q)) return true;
    // Match against name
    if (p.name.toLowerCase().includes(q)) return true;
    // Match against category
    if (p.category.toLowerCase().includes(q)) return true;
    // Match against ICD-10 indication codes
    if (p.commonIndications.some((ind) => ind.toLowerCase().includes(q))) return true;
    // Match against complications
    if (p.complications.some((c) => c.toLowerCase().includes(q))) return true;
    // Match against pre-op requirements
    if (p.preOpRequirements.some((r) => r.toLowerCase().includes(q))) return true;

    return false;
  });
}

/**
 * Look up a single procedure by its CPT code (exact match).
 */
export function getProcedureByCode(code: string): SurgicalProcedure | undefined {
  return SURGICAL_CATALOG.find((p) => p.code === code);
}

/**
 * Return all procedures belonging to a given category.
 */
export function getProceduresByCategory(category: string): SurgicalProcedure[] {
  const cat = category.toLowerCase().trim();
  return SURGICAL_CATALOG.filter((p) => p.category === cat);
}
