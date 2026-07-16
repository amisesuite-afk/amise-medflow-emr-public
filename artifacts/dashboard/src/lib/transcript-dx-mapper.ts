/**
 * transcript-dx-mapper.ts
 *
 * Maps clinical transcript text to pane-engine feature IDs using keyword matching,
 * and detects pathognomonic findings for immediate flagging.
 */

export interface ObservedFeature {
  featureId: string;
  observed: boolean; // true = present, false = absent (negated)
}

export interface PathognomicMatch {
  finding: string;      // the text that triggered it
  diseaseId: string;
  diseaseLabel: string;
  icd10: string;
  specificity: 'high' | 'definitive';
}

// ── Keyword map: feature ID → phrases that indicate PRESENCE ─────────────────

export const FEATURE_KEYWORD_MAP: Record<string, string[]> = {
  // ── Pain locations ─────────────────────────────────────────────────────────
  rlq_pain: [
    'right lower quadrant', 'rlq', 'right iliac fossa', 'rif pain',
    'right iliac', 'right lower abdominal', 'right lower abdomen',
    'right groin pain', 'periumbilical then right',
  ],
  ruq_pain: [
    'right upper quadrant', 'ruq', 'biliary colic', 'right hypochondrium',
    'right upper abdominal', 'right upper abdomen', 'right subcostal',
    'right side pain', 'hepatic pain',
  ],
  epigastric_pain: [
    'epigastric', 'epigastrium', 'upper central', 'mid-epigastric',
    'midepigastric', 'pit of stomach', 'upper abdominal pain', 'upper abdomen',
    'central abdominal', 'central upper', 'stomach pain',
  ],
  lif_pain: [
    'left iliac fossa', 'lif', 'left lower quadrant', 'llq',
    'left lower abdominal', 'left lower abdomen', 'left iliac',
    'sigmoid pain', 'left groin pain',
  ],
  pelvic_pain: [
    'pelvic pain', 'lower pelvic', 'suprapubic pain', 'suprapubic',
    'hypogastric pain', 'hypogastric', 'lower abdominal pain',
    'pelvic pressure', 'deep pelvic',
  ],
  radiation_to_back: [
    'radiation to back', 'radiates to back', 'radiating to back',
    'back radiation', 'goes to back', 'through to back',
    'radiation to the back', 'penetrating through to back',
  ],
  pain_migration: [
    'migration of pain', 'migrated', 'migrating pain', 'moved to',
    'shifted to', 'pain shifted', 'started centrally', 'periumbilical then',
    'moved from umbilicus', 'classical migration',
  ],
  colicky_pain: [
    'colicky', 'colic', 'crampy', 'cramp-like', 'colicky pain',
    'intermittent pain', 'spasmodic', 'waves of pain', 'come in waves',
    'waxing and waning',
  ],
  nocturnal_pain: [
    'nocturnal pain', 'night pain', 'wakes at night', 'wakes from sleep',
    'woken by pain', 'nocturnal', 'nighttime pain', 'waking at night',
  ],
  anal_pain: [
    'anal pain', 'anorectal pain', 'perianal pain', 'rectal pain',
    'pain on defecation', 'pain when passing stool', 'proctalgia',
    'painful defecation', 'pain around anus',
  ],

  // ── Constitutional / GI symptoms ──────────────────────────────────────────
  fever: [
    'fever', 'pyrexia', 'temperature', 'febrile', 'temp above 38',
    '38 degrees', 'pyrexial', 'high temperature', 'raised temperature',
    'elevated temperature', 'temp of 38', 'temp 38', '39 degrees',
    '40 degrees', 'feverish', 'hyperpyrexia',
  ],
  rigors: [
    'rigors', 'shaking chills', 'chills', 'shivering', 'shakes',
    'uncontrollable shaking', 'rigoring',
  ],
  nausea_vomiting: [
    'nausea', 'vomiting', 'nausea and vomiting', 'nauseated', 'vomited',
    'sick', 'feeling sick', 'retching', 'emesis', 'throwing up',
    'vomits', 'nauseous',
  ],
  anorexia: [
    'anorexia', 'loss of appetite', 'no appetite', 'poor appetite',
    'decreased appetite', 'not eating', 'reduced appetite', 'off food',
    'not hungry', 'aversion to food',
  ],
  weight_loss: [
    'weight loss', 'losing weight', 'lost weight', 'unintentional weight loss',
    'unexplained weight loss', 'weight has dropped', 'lost kg', 'lost kilograms',
    'weight reduction', 'cachexia', 'wasting',
  ],
  fatigue: [
    'fatigue', 'tiredness', 'tired', 'lethargy', 'lethargic', 'exhaustion',
    'exhausted', 'malaise', 'weakness', 'low energy', 'no energy',
    'fatigued', 'easily tired',
  ],
  heartburn: [
    'heartburn', 'acid reflux', 'reflux', 'burning in chest', 'burning sensation',
    'acid regurgitation', 'waterbrash', 'sour taste', 'pyrosis', 'gerd',
    'gord', 'burning behind sternum', 'burning retrosternal',
  ],
  dysphagia: [
    'dysphagia', 'difficulty swallowing', 'trouble swallowing', 'swallowing difficulty',
    'cannot swallow', 'food sticking', 'food getting stuck', 'odynophagia',
  ],
  dysphagia_solids: [
    'dysphagia to solids', 'difficulty swallowing solids', 'solids sticking',
    'solid food sticking', 'cannot swallow solids', 'progressive dysphagia',
    'dysphagia worse with solids',
  ],
  haematemesis: [
    'haematemesis', 'hematemesis', 'vomiting blood', 'blood in vomit',
    'bloody vomit', 'coffee ground vomit', 'coffee grounds', 'vomited blood',
  ],
  melaena: [
    'melaena', 'melena', 'black stool', 'tarry stool', 'dark stool',
    'black tarry', 'tarry stools', 'black stools', 'dark tarry',
  ],
  change_bowel_habit: [
    'change in bowel habit', 'changed bowel habit', 'change in bowel',
    'altered bowel habit', 'bowel habit change', 'bowels changed',
    'change in stool pattern', 'alternating constipation and diarrhoea',
    'alternating bowel', 'constipation and diarrhoea',
  ],
  pr_bleeding: [
    'pr bleeding', 'rectal bleeding', 'blood per rectum', 'blood in stool',
    'bleeding rectally', 'blood on paper', 'haematochezia', 'hematochezia',
    'bright red blood rectally', 'fresh blood rectally', 'blood in bowel',
    'bleeding from back passage',
  ],
  tenesmus: [
    'tenesmus', 'feeling of incomplete evacuation', 'incomplete emptying',
    'feeling of not finishing', 'urgency to defecate', 'constant urge to open bowels',
  ],
  absolute_constipation: [
    'absolute constipation', 'no bowels', 'no flatus', 'not passing flatus',
    'not passing wind', 'no stool no flatus', 'obstipation', 'not opening bowels',
    'failed to pass stool', 'unable to open bowels',
  ],
  abdominal_distension: [
    'abdominal distension', 'distended abdomen', 'bloated abdomen', 'bloating',
    'swollen abdomen', 'abdomen distended', 'belly swollen', 'abdominal swelling',
    'tummy swollen', 'swelling of abdomen',
  ],
  steatorrhoea: [
    'steatorrhoea', 'steatorrhea', 'fatty stools', 'pale stools', 'greasy stools',
    'oily stools', 'stools float', 'floating stools', 'malabsorption',
  ],
  dark_urine: [
    'dark urine', 'dark coloured urine', 'brown urine', 'cola urine',
    'tea coloured urine', 'cola coloured urine', 'dark coloured water',
    'urine dark', 'bilirubinuria',
  ],
  pruritus: [
    'pruritus', 'itching', 'itch', 'generalised itching', 'pruritic',
    'scratching', 'itchy skin', 'generalised itch',
  ],
  mucus_pr: [
    'mucus per rectum', 'mucus in stool', 'mucous stool', 'slime in stool',
    'mucusy stool', 'jelly-like stool', 'mucus rectally',
  ],
  vaginal_discharge: [
    'vaginal discharge', 'per vaginal discharge', 'pv discharge',
    'discharge per vagina', 'vaginal secretion', 'abnormal discharge',
  ],
  dyspareunia: [
    'dyspareunia', 'painful intercourse', 'pain during sex', 'pain on intercourse',
    'pain with sex', 'pain during intercourse', 'painful sex',
  ],
  postcoital_bleeding: [
    'postcoital bleeding', 'post coital bleeding', 'bleeding after sex',
    'blood after intercourse', 'bleeding during intercourse',
  ],
  abnormal_uterine_bleeding: [
    'abnormal uterine bleeding', 'irregular periods', 'irregular bleeding',
    'intermenstrual bleeding', 'heavy periods', 'menorrhagia',
    'abnormal menstrual bleeding', 'metrorrhagia',
  ],
  missed_period: [
    'missed period', 'missed periods', 'no period', 'amenorrhoea',
    'amenorrhea', 'last menstrual period', 'period stopped', 'periods stopped',
    'late period',
  ],

  // ── Examination signs ──────────────────────────────────────────────────────
  murphy_sign: [
    "murphy's sign", 'murphy sign', 'positive murphy', 'murphys',
    'murphy positive', 'murphys sign positive', "positive murphy's",
  ],
  rebound_tenderness: [
    'rebound tenderness', 'rebound', 'guarding', 'peritonism', 'peritoneal signs',
    'peritoneal irritation', 'board-like abdomen', 'rigidity', 'abdominal rigidity',
    'involuntary guarding',
  ],
  jaundice: [
    'jaundice', 'jaundiced', 'icteric', 'yellow skin', 'yellow sclerae',
    'yellow eyes', 'scleral icterus', 'icterus', 'yellow discolouration',
  ],
  groin_swelling: [
    'groin swelling', 'groin lump', 'inguinal swelling', 'inguinal lump',
    'swelling in groin', 'lump in groin', 'femoral swelling', 'femoral lump',
  ],
  abdominal_tenderness: [
    'abdominal tenderness', 'tender abdomen', 'tenderness abdomen',
    'tender on palpation', 'tenderness on palpation', 'localised tenderness',
    'diffuse tenderness', 'epigastric tenderness', 'rlq tenderness',
  ],
  tinkling_bowel_sounds: [
    'tinkling bowel sounds', 'high pitched bowel sounds', 'hyperactive bowel sounds',
    'tinkling', 'obstructive bowel sounds', 'metallic bowel sounds',
  ],
  visible_peristalsis: [
    'visible peristalsis', 'visible peristaltic waves', 'peristaltic waves',
    'peristalsis visible',
  ],
  groin_lump_reducible: [
    'reducible hernia', 'reducible lump', 'reduces on lying down', 'reduces spontaneously',
    'reducible groin', 'lump reduces',
  ],
  cough_impulse: [
    'cough impulse', 'positive cough impulse', 'impulse on coughing',
    'expansile cough impulse',
  ],
  hernia_irreducible: [
    'irreducible hernia', 'irreducible', 'cannot reduce', 'incarcerated',
    'incarcerated hernia', 'does not reduce', 'failed reduction',
  ],
  hernia_compressible: [
    'compressible hernia', 'soft hernia', 'compressible lump', 'compressible',
  ],
  umbilical_swelling: [
    'umbilical hernia', 'umbilical swelling', 'umbilical lump', 'paraumbilical',
    'para-umbilical hernia', 'swelling at umbilicus',
  ],
  perianal_swelling: [
    'perianal swelling', 'perianal lump', 'perianal mass', 'swelling around anus',
    'perianal abscess', 'anal lump',
  ],
  prolapse_pr: [
    'rectal prolapse', 'prolapse per rectum', 'prolapsing rectum', 'rectal prolapsing',
    'prolapse on straining',
  ],
  discharge_perianal: [
    'perianal discharge', 'fistula discharge', 'anal fistula', 'fistula-in-ano',
    'discharge from anus', 'anal discharge', 'perianal fistula',
  ],
  adnexal_tenderness: [
    'adnexal tenderness', 'adnexal mass', 'cervical excitation', 'cervical motion tenderness',
    'cmt positive', 'adnexal', 'ovarian tenderness', 'pelvic tenderness',
  ],
  neck_lump: [
    'neck lump', 'neck swelling', 'thyroid swelling', 'thyroid nodule', 'goitre',
    'goiter', 'neck mass', 'lump in neck', 'anterior neck',
  ],
  hoarseness: [
    'hoarseness', 'hoarse voice', 'voice change', 'dysphonia', 'husky voice',
    'voice hoarse', 'changed voice', 'vocal change',
  ],
  heat_intolerance: [
    'heat intolerance', 'intolerant to heat', 'cannot tolerate heat',
    'sweating', 'excessive sweating', 'feeling hot', 'heat sensitivity',
  ],
  palpitations_thyroid: [
    'palpitations', 'heart racing', 'fast heart', 'tachycardia', 'tremor',
    'fine tremor', 'hand tremor', 'trembling hands',
  ],

  // ── History ────────────────────────────────────────────────────────────────
  fatty_food_trigger: [
    'fatty food', 'fat intolerance', 'after fatty meals', 'fatty meal',
    'fried food trigger', 'greasy food', 'fat trigger', 'worse with fat',
    'aggravated by fat', 'precipitated by fatty', 'following fatty',
  ],
  antacid_relief: [
    'antacid relief', 'relieved by antacids', 'antacids help', 'antacids relieve',
    'better with antacids', 'improved with antacids', 'gaviscon helps',
    'omeprazole helps', 'relieved by omeprazole',
  ],
  nsaid_use: [
    'nsaid', 'ibuprofen', 'naproxen', 'diclofenac', 'aspirin', 'indomethacin',
    'anti-inflammatory', 'non-steroidal', 'nsaids', 'taking ibuprofen',
    'on ibuprofen', 'voltaren',
  ],
  previous_surgery: [
    'previous surgery', 'prior surgery', 'past surgery', 'previous operation',
    'prior operation', 'had surgery', 'surgical history', 'previous abdominal surgery',
    'previous laparotomy', 'previous appendicectomy',
  ],
  previous_repair: [
    'previous repair', 'prior repair', 'hernia repair', 'previous hernia repair',
    'had repair', 'mesh repair', 'prior herniorrhaphy',
  ],
  hypercalcaemia_symptoms: [
    'hypercalcaemia', 'hypercalcemia', 'raised calcium', 'high calcium', 'bones stones groans',
    'kidney stones', 'renal calculi', 'constipation and confusion', 'polyuria',
  ],
  hypertension_symptom: [
    'hypertension', 'high blood pressure', 'htn', 'raised blood pressure',
    'hypertensive', 'blood pressure high', 'on antihypertensives',
  ],

  // ── Investigations ─────────────────────────────────────────────────────────
  elevated_wbc: [
    'elevated white cell count', 'raised white cell count', 'leucocytosis', 'leukocytosis',
    'wbc elevated', 'white cells up', 'raised wbc', 'elevated wbc',
    'neutrophilia', 'raised neutrophils', 'high white count',
  ],
  elevated_amylase: [
    'elevated amylase', 'raised amylase', 'high amylase', 'amylase elevated',
    'amylase up', 'raised lipase', 'elevated lipase', 'high lipase',
    'lipase raised',
  ],
  us_gallstones: [
    'gallstones', 'cholelithiasis', 'stones in gallbladder', 'calculi in gallbladder',
    'ultrasound gallstones', 'us gallstones', 'gallstones on ultrasound',
    'echogenic foci gallbladder', 'acoustic shadowing gallbladder',
  ],

  // ── Trauma ─────────────────────────────────────────────────────────────────
  mechanism_blunt: [
    'blunt trauma', 'blunt injury', 'motor vehicle accident', 'mva', 'rta',
    'road traffic accident', 'fell from', 'fall from', 'pedestrian struck',
    'assault', 'kicked', 'punched abdomen', 'blunt abdominal trauma',
  ],
  loss_of_consciousness: [
    'loss of consciousness', 'loc', 'unconscious', 'lost consciousness', 'blacked out',
    'found unconscious', 'brief loss', 'transient loss of consciousness',
  ],
  gcs_drop: [
    'gcs drop', 'reduced gcs', 'gcs decreased', 'gcs below', 'low gcs',
    'altered consciousness', 'confusion', 'altered mental status',
  ],
  pupil_asymmetry: [
    'pupil asymmetry', 'unequal pupils', 'anisocoria', 'blown pupil',
    'dilated pupil', 'fixed dilated pupil', 'unequal pupil',
  ],
  vomiting_post_trauma: [
    'vomiting after injury', 'vomiting post trauma', 'vomited after accident',
    'post-traumatic vomiting', 'vomiting following head injury',
  ],
  haemodynamic_instability: [
    'haemodynamic instability', 'haemodynamically unstable', 'hypotension',
    'hypotensive', 'shock', 'systolic below 90', 'low blood pressure',
    'tachycardia and hypotension', 'compensated shock',
  ],
  haematuria: [
    'haematuria', 'hematuria', 'blood in urine', 'frank haematuria',
    'microscopic haematuria', 'blood in urine', 'red urine', 'pink urine',
    'gross haematuria',
  ],
  paradoxical_breathing: [
    'paradoxical breathing', 'paradoxical chest movement', 'flail chest',
    'chest wall paradox', 'flail segment',
  ],
  kehr_sign: [
    'kehr sign', "kehr's sign", 'left shoulder tip pain', 'referred left shoulder pain',
    'shoulder tip pain', 'left shoulder pain', 'left diaphragmatic irritation',
  ],
  burn_wound: [
    'burn', 'burned', 'burning injury', 'scald', 'scalded', 'thermal injury',
    'flame burn', 'chemical burn', 'electrical burn',
  ],
  tbsa_significant: [
    'tbsa', 'total body surface area', 'large burn', 'extensive burn',
    'significant burn', 'tbsa over 10', 'major burn', 'tbsa more than',
  ],
  inhalation_injury: [
    'inhalation injury', 'smoke inhalation', 'inhaled smoke', 'carbon monoxide',
    'carbonaceous sputum', 'stridor', 'upper airway burn',
  ],
  singed_eyebrows: [
    'singed eyebrows', 'singed eyelashes', 'singed nasal hair', 'singed nasal hairs',
    'facial burns', 'facial singed',
  ],
  erythema_burn: [
    'erythema', 'erythematous burn', 'superficial burn', 'first degree burn',
    'superficial partial thickness', 'first-degree', 'redness burn',
  ],
  blistering: [
    'blistering', 'blisters', 'blister', 'bullae', 'bullous', 'partial thickness burn',
    'second degree burn', 'second-degree burn', 'dermis exposed',
  ],
};

// ── Negation prefixes ─────────────────────────────────────────────────────────

export const NEGATION_PREFIXES: string[] = [
  'no ',
  'not ',
  'without ',
  'absent ',
  'denies ',
  'negative for ',
  'no evidence of ',
  'no signs of ',
  'denying ',
  'nil ',
  'no history of ',
  'never ',
  'no complaint of ',
  'not complaining of ',
  'no report of ',
];

// ── Feature extraction ────────────────────────────────────────────────────────

/**
 * Extract observed features (present or absent) from a clinical transcript.
 * Only features for which at least one keyword was found are returned.
 */
export function extractFeaturesFromTranscript(text: string): ObservedFeature[] {
  const lower = text.toLowerCase();
  const results: ObservedFeature[] = [];
  const seen = new Set<string>();

  for (const [featureId, keywords] of Object.entries(FEATURE_KEYWORD_MAP)) {
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;

      // Check for negation in the 40 characters before the match
      const windowStart = Math.max(0, idx - 40);
      const pre = lower.slice(windowStart, idx);
      const negated = NEGATION_PREFIXES.some(prefix => pre.includes(prefix));

      if (!seen.has(featureId)) {
        results.push({ featureId, observed: !negated });
        seen.add(featureId);
      }
      break; // first matching keyword wins for this feature
    }
  }

  return results;
}

// ── Pathognomonic patterns ────────────────────────────────────────────────────

const PATHOGNOMONIC_PATTERNS: Array<{
  regex: RegExp;
  diseaseId: string;
  diseaseLabel: string;
  icd10: string;
  specificity: 'high' | 'definitive';
}> = [
  { regex: /murphy'?s sign\s+positive/i, diseaseId: 'cholecystitis', diseaseLabel: 'Acute Cholecystitis', icd10: 'K81.0', specificity: 'high' },
  { regex: /charcot'?s triad/i, diseaseId: 'cholangitis', diseaseLabel: 'Acute Cholangitis', icd10: 'K83.0', specificity: 'definitive' },
  { regex: /cullen'?s sign/i, diseaseId: 'pancreatitis', diseaseLabel: 'Haemorrhagic Pancreatitis', icd10: 'K85.1', specificity: 'high' },
  { regex: /grey turner'?s?/i, diseaseId: 'pancreatitis', diseaseLabel: 'Haemorrhagic Pancreatitis', icd10: 'K85.1', specificity: 'high' },
  { regex: /rovsing'?s sign/i, diseaseId: 'appendicitis', diseaseLabel: 'Acute Appendicitis', icd10: 'K35.80', specificity: 'high' },
  { regex: /psoas sign/i, diseaseId: 'appendicitis', diseaseLabel: 'Acute Appendicitis', icd10: 'K35.80', specificity: 'high' },
  { regex: /obturator sign/i, diseaseId: 'appendicitis', diseaseLabel: 'Acute Appendicitis', icd10: 'K35.80', specificity: 'high' },
  { regex: /courvoisier'?s? (law|sign|gallbladder)/i, diseaseId: 'pancreatic_carcinoma', diseaseLabel: 'Pancreatic Carcinoma', icd10: 'C25.9', specificity: 'high' },
  { regex: /kehr'?s sign/i, diseaseId: '_other_', diseaseLabel: 'Haemoperitoneum / Splenic Injury', icd10: 'S36.029A', specificity: 'high' },
  { regex: /virchow'?s node/i, diseaseId: 'colorectal_cancer', diseaseLabel: 'Upper GI / Abdominal Malignancy', icd10: 'C80.1', specificity: 'high' },
  { regex: /sister mary joseph/i, diseaseId: 'colorectal_cancer', diseaseLabel: 'Peritoneal Metastasis', icd10: 'C80.0', specificity: 'high' },
  { regex: /trousseau'?s sign/i, diseaseId: 'parathyroid_adenoma', diseaseLabel: 'Hypocalcaemia (parathyroid)', icd10: 'E20.9', specificity: 'high' },
  { regex: /blumer'?s shelf/i, diseaseId: 'colorectal_cancer', diseaseLabel: 'Peritoneal Malignancy', icd10: 'C80.0', specificity: 'high' },
  { regex: /positive murphy/i, diseaseId: 'cholecystitis', diseaseLabel: 'Acute Cholecystitis', icd10: 'K81.0', specificity: 'high' },
];

/**
 * Detect pathognomonic findings in a transcript.
 * Returns deduplicated matches, most specific first.
 */
export function detectPathognomonic(text: string): PathognomicMatch[] {
  const seen = new Set<string>();
  const matches: PathognomicMatch[] = [];

  for (const pattern of PATHOGNOMONIC_PATTERNS) {
    const match = text.match(pattern.regex);
    if (!match) continue;
    if (seen.has(pattern.diseaseId)) continue;
    seen.add(pattern.diseaseId);
    matches.push({
      finding: match[0],
      diseaseId: pattern.diseaseId,
      diseaseLabel: pattern.diseaseLabel,
      icd10: pattern.icd10,
      specificity: pattern.specificity,
    });
  }

  // Definitive findings first, then high
  return matches.sort((a, b) =>
    a.specificity === b.specificity ? 0 : a.specificity === 'definitive' ? -1 : 1,
  );
}
