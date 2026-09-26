/**
 * Chief complaint (+ optional system / specialty group) → symptom type → history frame.
 *
 * Deterministic keyword rules, twinned in Swift (HistoryFrameClassifier in
 * ios/AmiseMedFlow/Services/HistoryFrames.swift; the rule data is generated into
 * HistoryFrameData.swift). Both run ios/AmiseMedFlowTests/Resources/HistoryFrameVectors.json.
 *
 * Algorithm (keep the Swift twin identical):
 *   1. Lower-case the complaint. A keyword matches at a word start (the previous character is not
 *      a letter or digit); "abc*" is a prefix, otherwise the next character must not be a letter
 *      or digit either. Its position is the first such match.
 *   2. A rule matches at the earliest position of any keyword, unless an `unless` keyword matches.
 *   3. Primary = lowest tier, then earliest position, then rule order.
 *   4. Variant (pain region, lump site …) = the variant rule with the earliest keyword; else the
 *      system default (pain only), else the type's default variant.
 *   5. Secondary = the other matched types (tiers 1–2), earliest first, one frame per type. Pain
 *      is a secondary symptom only with a region of its own ("vomiting and abdominal pain"); in
 *      "wound pain" or "painful lump" the pain belongs to the primary symptom.
 *   6. Nothing matched: the general frame (fallback).
 */

import type { ClassifierRule, FrameChoice, SymptomType, VariantRule } from './types';

export const CLASSIFIER_RULES: ClassifierRule[] = [
  // Tier 1 — lumps and swellings (a "painful lump" is a lump).
  { type: 'breast', tier: 1, keywords: ['breast lump*', 'lump in the breast', 'breast mass*', 'breast swelling*',
    'breast change*', 'breast skin', 'breast discharge', 'nipple*', 'areola*', 'axilla*', 'axillary lump*',
    'gynaecomastia', 'gynecomastia'] },
  // Any other breast complaint is a breast history; breast pain (mastalgia) is a pain history.
  { type: 'breast', tier: 1, keywords: ['breast*'], unless: ['pain', 'pains', 'ache', 'aching', 'mastalgia'] },
  { type: 'lump', tier: 1, keywords: ['lump*', 'mass', 'masses', 'swelling*', 'swollen', 'hernia*', 'lymphadenopathy',
    'lymph node*', 'node', 'nodes', 'nodule*', 'goitre', 'goiter', 'lipoma*', 'cyst', 'cysts', 'hydrocele',
    'varicocele', 'oedema', 'edema', 'lymphoedema', 'bulge', 'varicose'],
    unless: ['breast*', 'nipple*', 'axilla*', 'ovarian cyst*', 'abdominal distension', 'joint*', 'wound*'] },
  // A scrotal complaint without pain is a swelling; "testicular pain" is pain.
  { type: 'lump', tier: 2, keywords: ['scrot*', 'testic*', 'testis', 'testes'], unless: ['pain', 'pains', 'ache', 'aching'] },
  // Tier 2 — symptoms. Position decides between two of them ("cough with chest pain" is a cough).
  { type: 'bleeding', tier: 2, keywords: ['bleed*', 'blood', 'haematemesis', 'hematemesis', 'melaena', 'melena',
    'haematochezia', 'hematochezia', 'haematuria', 'hematuria', 'black stool*', 'tarry stool*', 'coffee ground*',
    'coffee-ground*', 'bruising', 'menorrhagia', 'haemorrhage', 'hemorrhage', 'epistaxis', 'nosebleed*'],
    unless: ['blood pressure', 'blood sugar*', 'blood glucose', 'blood test*', 'sputum', 'haemoptysis', 'hemoptysis'] },
  { type: 'cough', tier: 2, keywords: ['cough*', 'haemoptysis', 'hemoptysis', 'sputum', 'phlegm', 'tb', 'tuberculosis'] },
  { type: 'dyspnoea', tier: 2, keywords: ['breathless*', 'shortness of breath', 'short of breath', 'sob', 'dyspnoea',
    'dyspnea', 'wheez*', 'asthma', 'copd', 'orthopnoea', 'difficulty breathing', 'respiratory distress', 'stridor',
    'heart failure'] },
  { type: 'dysphagia', tier: 2, keywords: ['dysphagia', 'swallow*', 'odynophagia', 'food stick*', 'food bolus',
    'regurgitation'] },
  { type: 'jaundice', tier: 2, keywords: ['jaund*', 'yellow*', 'icter*', 'ercp', 'bile duct*', 'cholangitis',
    'choledocholithiasis', 'dark urine', 'pale stool*'] },
  { type: 'vomiting', tier: 2, keywords: ['vomit*', 'nausea', 'emesis', 'retching', 'hyperemesis'] },
  { type: 'bowel', tier: 2, keywords: ['bowel habit*', 'bowel obstruct*', 'diarrhoea', 'diarrhea', 'constipat*',
    'loose stool*', 'bloating', 'bloated', 'distension', 'obstipation', 'faecal incontinence', 'fecal incontinence',
    'tenesmus', 'colorectal cancer', 'colorectal malignan*', 'colon cancer', 'rectal cancer', 'inflammatory bowel',
    'colitis', 'crohn*', 'incomplete evacuation', 'faecal urgency', 'mucus', 'prolapse*'] },
  { type: 'urinary', tier: 2, keywords: ['urin*', 'dysuria', 'frequency', 'nocturia', 'luts', 'retention', 'hesitancy',
    'prostat*', 'uti', 'cystitis', 'incontinence', 'bladder'],
    unless: ['faecal incontinence', 'fecal incontinence'] },
  { type: 'palpitations', tier: 2, keywords: ['palpitation*', 'arrhythmia*', 'atrial fibrillation', 'heart racing',
    'racing heart', 'irregular heartbeat', 'tachycardia'] },
  { type: 'syncope', tier: 2, keywords: ['syncop*', 'presyncop*', 'faint*', 'collapse*', 'blackout*', 'black out',
    'passed out', 'loss of consciousness'] },
  { type: 'neuro', tier: 2, keywords: ['weakness', 'weak', 'paralys*', 'hemipar*', 'numb*', 'tingl*', 'paraesthesi*',
    'pins and needles', 'dizz*', 'vertigo', 'giddy', 'light-headed*', 'lightheaded*', 'stroke', 'tia', 'facial droop',
    'slurred speech', 'speech', 'unsteady*'],
    unless: ['generalised weakness', 'generalized weakness'] },
  { type: 'fever', tier: 2, keywords: ['fever*', 'febrile', 'pyrexi*', 'rigor*', 'temperature', 'sepsis', 'septic',
    'dengue', 'leptospir*', 'typhoid', 'malaria', 'chikungunya', 'infection*', 'sweat*'] },
  { type: 'skin', tier: 2, keywords: ['skin*', 'mole*', 'rash*', 'lesion*', 'ulcer*', 'wound*', 'cellulitis',
    'abscess*', 'melanoma', 'eczema', 'psoriasis', 'urticaria', 'hives', 'itch*', 'pruritus', 'acne', 'burn', 'burns',
    'bite', 'bites', 'diabetic foot', 'infected foot', 'pilonidal', 'surgical site', 'incision', 'boil*', 'alopecia',
    'hair loss', 'nail*', 'pigment*', 'blister*', 'dermatitis', 'petechiae', 'purpura'],
    unless: ['peptic ulcer*', 'mouth ulcer*'] },
  { type: 'weight_loss', tier: 2, keywords: ['weight loss', 'losing weight', 'lost weight', 'cachexia', 'anorexia',
    'failure to thrive', 'loss of appetite'] },
  { type: 'fatigue', tier: 2, keywords: ['fatigue*', 'tired*', 'lethargy', 'lethargic', 'exhaust*', 'malaise',
    'anaemia', 'anemia', 'low energy', 'generalised weakness', 'generalized weakness'] },
  { type: 'pain', tier: 2, keywords: ['pain', 'pains', 'ache', 'aches', 'aching', 'headache*', 'migraine*', 'colic',
    'colicky', 'cramp*', 'sore', 'soreness', 'tenderness', 'angina', 'sciatica', 'mastalgia', 'dysmenorrh*',
    'dyspareunia', 'claudication', 'peripheral arterial', 'heartburn', 'reflux', 'indigestion', 'dyspepsia',
    'haemorrhoid*', 'hemorrhoid*', 'piles', 'fissure*', 'perianal', 'appendicitis', 'cholecystitis', 'pancreatitis',
    'diverticulitis', 'gallstone*', 'gord', 'gerd', 'tightness', 'perforat*', 'mesenteric', 'anastomotic',
    'cold foot', 'cold leg', 'cold limb', 'cold extremit*', 'stiffness', 'joint swelling', 'swollen joint*'] },
  // Tier 3 — administrative visits: the general frame, unless a symptom is named.
  { type: 'general', tier: 3, keywords: ['follow-up', 'follow up', 'review', 'screening', 'check-up', 'check up',
    'pre-operative', 'preoperative', 'pre-op', 'assessment', 'other', 'endoscopy', 'ogd', 'colonoscopy',
    'gastroscopy', 'surveillance', 'admin*', 'second opinion', 'results', 'sick note', 'prescription*', 'insurance'] },
];

export const PAIN_REGION_RULES: VariantRule[] = [
  { variant: 'chest', keywords: ['chest', 'retrosternal', 'pleuritic', 'angina', 'heartburn', 'reflux', 'gord', 'gerd',
    'precordial', 'rib', 'ribs', 'sternum', 'sternal'] },
  { variant: 'head', keywords: ['head*', 'migraine*', 'temporal', 'occipital', 'facial pain', 'face', 'sinus*'] },
  { variant: 'neck', keywords: ['neck', 'throat', 'ear', 'ears', 'jaw', 'tooth', 'teeth', 'dental', 'thyroid'] },
  { variant: 'back', keywords: ['back', 'lumbar', 'sciatica', 'spine', 'spinal', 'thoracic', 'coccyx'] },
  { variant: 'breast', keywords: ['breast*', 'mastalgia', 'nipple*', 'axilla*'] },
  { variant: 'perineal', keywords: ['anal', 'anus', 'perianal', 'perine*', 'rectal', 'rectum', 'bottom', 'back passage',
    'haemorrhoid*', 'hemorrhoid*', 'piles', 'fissure*', 'fistula', 'pilonidal', 'vulv*', 'vagin*', 'dyspareunia'] },
  { variant: 'genital', keywords: ['testic*', 'testis', 'testes', 'scrot*', 'penile', 'penis'] },
  { variant: 'joint', keywords: ['joint*', 'knee*', 'hip', 'hips', 'shoulder*', 'ankle*', 'wrist*', 'elbow*', 'gout',
    'arthr*', 'stiffness'] },
  { variant: 'limb', keywords: ['leg', 'legs', 'calf', 'calves', 'thigh*', 'shin*', 'foot', 'feet', 'toe', 'toes', 'arm',
    'arms', 'forearm*', 'hand', 'hands', 'finger*', 'limb*', 'claudication', 'peripheral arterial', 'buttock*',
    'heel*', 'rest pain', 'bone', 'bones', 'muscle*', 'extremit*', 'cold foot', 'cold leg'] },
  { variant: 'abdomen', keywords: ['abdom*', 'tummy', 'belly', 'stomach', 'epigastr*', 'ruq', 'luq', 'rlq', 'llq', 'rif',
    'lif', 'iliac fossa', 'hypochondr*', 'periumbilical', 'umbilical', 'suprapubic', 'pelvic', 'pelvis', 'loin*',
    'flank*', 'groin*', 'inguinal', 'renal colic', 'ureteric', 'biliary', 'colic', 'appendic*', 'dyspepsia',
    'indigestion', 'dysmenorrh*', 'period pain*', 'menstrual', 'cholecyst*', 'pancreat*', 'diverticul*',
    'gallstone*', 'quadrant', 'right upper', 'left upper', 'right lower', 'left lower', 'mesenteric',
    'intra-abdominal', 'viscus', 'perforat*', 'anastomotic'] },
];

/** Pain without a named region: the specialty group's usual region, else the abdomen. */
export const PAIN_SYSTEM_DEFAULTS: Record<string, string> = {
  'Musculoskeletal': 'joint', 'Cardiovascular': 'chest', 'Cardiology': 'chest', 'Respiratory': 'chest',
  'Neurology': 'head', 'Neurosurgery': 'head', 'Dermatology': 'limb',
};

export const VARIANT_RULES: Partial<Record<SymptomType, { rules: VariantRule[]; fallback: string }>> = {
  pain: { rules: PAIN_REGION_RULES, fallback: 'abdomen' },
  lump: {
    fallback: 'soft_tissue',
    rules: [
      { variant: 'limb_swelling', keywords: ['oedema', 'edema', 'lymphoedema', 'leg swelling', 'swollen leg*',
        'swollen ankle*', 'ankle swelling', 'limb swelling', 'swollen limb*', 'arm swelling', 'swollen arm*',
        'varicose'] },
      { variant: 'hernia', keywords: ['groin', 'inguinal', 'femoral', 'hernia*', 'umbilical', 'paraumbilical',
        'incisional', 'ventral', 'parastomal', 'bulge'] },
      { variant: 'scrotal', keywords: ['scrot*', 'testic*', 'testis', 'testes', 'hydrocele', 'varicocele', 'epididym*',
        'penile'] },
      { variant: 'neck', keywords: ['neck', 'thyroid', 'goitre', 'goiter', 'lymph*', 'node', 'nodes', 'cervical',
        'submandibular', 'parotid', 'salivary', 'facial', 'jaw', 'supraclavicular'] },
      { variant: 'abdominal', keywords: ['abdom*', 'epigastric mass', 'liver', 'hepat*', 'spleen', 'pancrea*', 'kidney',
        'renal', 'pelvic mass', 'colon*', 'gastric', 'pulsatile'] },
    ],
  },
  bleeding: {
    fallback: 'general',
    rules: [
      { variant: 'upper_gi', keywords: ['haematemesis', 'hematemesis', 'melaena', 'melena', 'black stool*', 'tarry*',
        'coffee ground*', 'coffee-ground*', 'upper gi', 'vomit*'] },
      { variant: 'rectal', keywords: ['rectal', 'rectum', 'pr', 'per rectum', 'bottom', 'anal', 'anus',
        'haematochezia', 'hematochezia', 'piles', 'haemorrhoid*', 'hemorrhoid*', 'lower gi', 'stool*', 'bowel*',
        'back passage', 'toilet paper', 'wiping'] },
      { variant: 'urinary', keywords: ['haematuria', 'hematuria', 'urin*', 'bladder'] },
      { variant: 'vaginal', keywords: ['vagin*', 'pv', 'per vaginam', 'postmenopausal', 'intermenstrual',
        'postcoital', 'post-coital', 'post-menopausal', 'inter-menstrual', 'menorrhagia', 'heavy period*', 'uterine',
        'womb', 'period*'] },
    ],
  },
  neuro: {
    fallback: 'weakness',
    rules: [
      { variant: 'numbness', keywords: ['numb*', 'tingl*', 'paraesthesi*', 'pins and needles'] },
      { variant: 'dizziness', keywords: ['dizz*', 'vertigo', 'giddy', 'light-headed*', 'lightheaded*', 'unsteady*'] },
      { variant: 'weakness', keywords: ['weakness', 'weak', 'paralys*', 'hemipar*', 'stroke', 'tia', 'facial droop',
        'slurred speech', 'speech'] },
    ],
  },
  skin: {
    fallback: 'lesion',
    rules: [
      { variant: 'wound', keywords: ['wound*', 'ulcer*', 'cellulitis', 'abscess*', 'infection*', 'infected',
        'surgical site', 'incision', 'diabetic foot', 'pilonidal', 'boil*', 'burn', 'burns', 'bite', 'bites'] },
      { variant: 'rash', keywords: ['rash*', 'eczema', 'psoriasis', 'urticaria', 'hives', 'itch*', 'pruritus', 'acne',
        'alopecia', 'hair loss', 'nail*', 'pigmentation', 'blister*', 'dermatitis', 'petechiae', 'purpura',
        'discolouration'] },
      { variant: 'lesion', keywords: ['mole*', 'lesion*', 'melanoma', 'spot*', 'growth*', 'bcc', 'scc', 'naev*',
        'pigmented'] },
    ],
  },
};

/** Position of the first word-start match of `keyword` in lower-case `text`, or -1. */
export function keywordPosition(text: string, keyword: string): number {
  const prefix = keyword.endsWith('*');
  const k = prefix ? keyword.slice(0, -1) : keyword;
  if (!k) return -1;
  let from = 0;
  for (;;) {
    const i = text.indexOf(k, from);
    if (i < 0) return -1;
    const before = i === 0 ? '' : text[i - 1]!;
    const after = text[i + k.length] ?? '';
    const startOk = i === 0 || !isWordChar(before);
    const endOk = prefix || after === '' || !isWordChar(after);
    if (startOk && endOk) return i;
    from = i + 1;
  }
}

function isWordChar(c: string): boolean {
  return /[a-z0-9]/.test(c);
}

/** Earliest position of any keyword, or -1. */
export function firstPosition(text: string, keywords: string[]): number {
  let best = -1;
  for (const k of keywords) {
    const p = keywordPosition(text, k);
    if (p >= 0 && (best < 0 || p < best)) best = p;
  }
  return best;
}

export function frameIdFor(type: SymptomType, variant?: string): string {
  return variant ? `${type}.${variant}` : type;
}

function variantFor(type: SymptomType, text: string, system: string | undefined): string | undefined {
  const spec = VARIANT_RULES[type];
  if (!spec) return undefined;
  let best: { variant: string; pos: number } | null = null;
  for (const r of spec.rules) {
    const p = firstPosition(text, r.keywords);
    if (p >= 0 && (!best || p < best.pos)) best = { variant: r.variant, pos: p };
  }
  if (best) return best.variant;
  if (type === 'pain' && system && PAIN_SYSTEM_DEFAULTS[system]) return PAIN_SYSTEM_DEFAULTS[system];
  return spec.fallback;
}

/** Chief complaint → frame choice. `system` is the specialty group of a tapped CC chip, if any. */
export function classifyComplaint(complaint: string, system?: string): FrameChoice {
  const text = (complaint ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const matches: { rule: ClassifierRule; pos: number; order: number }[] = [];
  CLASSIFIER_RULES.forEach((rule, order) => {
    const pos = firstPosition(text, rule.keywords);
    if (pos < 0) return;
    if (rule.unless && firstPosition(text, rule.unless) >= 0) return;
    matches.push({ rule, pos, order });
  });
  if (!matches.length) {
    return { type: 'general', frameId: 'general', secondary: [], fallback: true };
  }
  matches.sort((a, b) => a.rule.tier - b.rule.tier || a.pos - b.pos || a.order - b.order);
  const primary = matches[0]!;
  const type = primary.rule.type;
  const variant = variantFor(type, text, system);
  const secondary: string[] = [];
  const seen = new Set<SymptomType>([type]);
  for (const m of [...matches].sort((a, b) => a.pos - b.pos || a.order - b.order)) {
    if (m.rule.tier === 3 || seen.has(m.rule.type)) continue;
    if (m.rule.type === 'pain' && !PAIN_REGION_RULES.some(r => firstPosition(text, r.keywords) >= 0)) continue;
    seen.add(m.rule.type);
    secondary.push(frameIdFor(m.rule.type, variantFor(m.rule.type, text, system)));
  }
  return { type, variant, frameId: frameIdFor(type, variant), secondary, fallback: false };
}
