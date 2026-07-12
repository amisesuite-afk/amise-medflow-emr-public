/**
 * LocalNarrator — client-side clinical NLP engine.
 *
 * Matches free-text narratives against preset chip options using:
 *   1. Direct substring match (normalised)
 *   2. Key-term extraction (significant words in chip label)
 *   3. Abbreviation + synonym expansion
 *   4. Learned terms from IndexedDB (via learnedTerms param)
 *
 * Returns matched chips + unmatched remainder as notes text.
 * Zero network calls — runs entirely in the browser in <5 ms.
 *
 * Confidence < 0.7 signals the caller to escalate to cloud Claude.
 */

export interface LocalParseResult {
  matched: string[];
  additional: string[];
  notes: string;
  confidence: number;
  source: 'local';
}

// ─────────────────────────────────────────────────────────────────────────────
// Abbreviation / synonym map → chip label substring
// Keys are lower-case; values are substrings that appear in chip labels.
// ─────────────────────────────────────────────────────────────────────────────

const ABBREV_MAP: Record<string, string[]> = {
  // PMH — comorbidities
  'htn':                   ['hypertension'],
  'high blood pressure':   ['hypertension'],
  'elevated bp':           ['hypertension'],
  't1dm':                  ['type 1 diabetes'],
  'type 1 dm':             ['type 1 diabetes'],
  'iddm':                  ['type 1 diabetes'],
  't2dm':                  ['type 2 diabetes'],
  'type 2 dm':             ['type 2 diabetes'],
  'niddm':                 ['type 2 diabetes'],
  'ihd':                   ['ischaemic heart disease'],
  'cad':                   ['ischaemic heart disease'],
  'coronary artery disease': ['ischaemic heart disease'],
  'mi':                    ['ischaemic heart disease'],
  'myocardial infarction': ['ischaemic heart disease'],
  'angina':                ['ischaemic heart disease'],
  'afib':                  ['atrial fibrillation'],
  'af':                    ['atrial fibrillation'],
  'hf':                    ['heart failure'],
  'chf':                   ['heart failure'],
  'cardiac failure':       ['heart failure'],
  'ckd':                   ['chronic kidney disease'],
  'renal failure':         ['chronic kidney disease'],
  'renal impairment':      ['chronic kidney disease'],
  'on dialysis':           ['dialysis'],
  'haemodialysis':         ['dialysis'],
  'hemodialysis':          ['dialysis'],
  'peritoneal dialysis':   ['dialysis'],
  'cva':                   ['stroke'],
  'tia':                   ['stroke', 'tia'],
  'transient ischaemic':   ['stroke', 'tia'],
  'copd':                  ['copd', 'asthma'],
  'emphysema':             ['copd'],
  'chronic bronchitis':    ['copd'],
  'asthma':                ['asthma'],
  'cancer':                ['active cancer', 'prior cancer'],
  'malignancy':            ['active cancer', 'prior cancer'],
  'carcinoma':             ['active cancer', 'prior cancer'],
  'chemo':                 ['chemotherapy'],
  'immunotherapy':         ['immunotherapy'],
  'steroid':               ['steroid'],
  'prednisolone':          ['steroid'],
  'prednisone':            ['steroid'],
  'immunosuppressed':      ['immunosuppressed'],
  'immunosuppression':     ['immunosuppressed'],
  'transplant':            ['immunosuppressed'],
  'cirrhosis':             ['liver cirrhosis'],
  'liver disease':         ['liver cirrhosis'],
  'hepb':                  ['hepatitis b'],
  'hepatitis b':           ['hepatitis b'],
  'hbv':                   ['hepatitis b'],
  'hepc':                  ['hepatitis c'],
  'hepatitis c':           ['hepatitis c'],
  'hcv':                   ['hepatitis c'],
  'hiv':                   ['hiv'],
  'aids':                  ['hiv'],
  'thyroid':               ['thyroid'],
  'hypothyroid':           ['thyroid'],
  'hyperthyroid':          ['thyroid'],
  'goitre':                ['thyroid'],
  'pvd':                   ['peripheral vascular disease'],
  'pad':                   ['peripheral vascular disease'],
  'peripheral vascular':   ['peripheral vascular disease'],
  'dvt':                   ['dvt'],
  'deep vein thrombosis':  ['dvt'],
  'pe ':                   ['dvt', 'pe'],
  'pulmonary embolism':    ['dvt', 'pe'],
  'obese':                 ['obesity'],
  'obesity':               ['obesity'],
  'overweight':            ['obesity'],
  'bmi >30':               ['obesity'],
  'osa':                   ['sleep apnoea'],
  'sleep apnea':           ['sleep apnoea'],
  'sleep apnoea':          ['sleep apnoea'],
  'cpap':                  ['sleep apnoea'],
  'depression':            ['anxiety', 'depression'],
  'anxiety':               ['anxiety', 'depression'],
  'mental health':         ['anxiety', 'depression'],
  'sickle cell':           ['sickle cell disease'],
  'hbs':                   ['sickle cell disease'],

  // Medications — generic + brand names → chip label
  'aspirin':               ['aspirin'],
  'asa':                   ['aspirin'],
  'clopidogrel':           ['clopidogrel'],
  'plavix':                ['clopidogrel'],
  'ticagrelor':            ['ticagrelor'],
  'brilinta':              ['ticagrelor'],
  'prasugrel':             ['prasugrel'],
  'effient':               ['prasugrel'],
  'warfarin':              ['warfarin'],
  'coumadin':              ['warfarin'],
  'rivaroxaban':           ['rivaroxaban'],
  'xarelto':               ['rivaroxaban'],
  'apixaban':              ['apixaban'],
  'eliquis':               ['apixaban'],
  'dabigatran':            ['dabigatran'],
  'pradaxa':               ['dabigatran'],
  'heparin':               ['heparin'],
  'enoxaparin':            ['enoxaparin'],
  'clexane':               ['enoxaparin'],
  'lovenox':               ['enoxaparin'],
  'insulin':               ['insulin'],
  'lantus':                ['insulin'],
  'novorapid':             ['insulin'],
  'humalog':               ['insulin'],
  'metformin':             ['metformin'],
  'glucophage':            ['metformin'],
  'gliclazide':            ['gliclazide'],
  'diamicron':             ['gliclazide'],
  'glibenclamide':         ['glibenclamide'],
  'daonil':                ['glibenclamide'],
  'empagliflozin':         ['sglt2'],
  'dapagliflozin':         ['sglt2'],
  'canagliflozin':         ['sglt2'],
  'jardiance':             ['sglt2'],
  'forxiga':               ['sglt2'],
  'sitagliptin':           ['dpp-4'],
  'linagliptin':           ['dpp-4'],
  'saxagliptin':           ['dpp-4'],
  'januvia':               ['dpp-4'],
  'ramipril':              ['ace inhibitor'],
  'lisinopril':            ['ace inhibitor'],
  'enalapril':             ['ace inhibitor'],
  'perindopril':           ['ace inhibitor'],
  'captopril':             ['ace inhibitor'],
  'losartan':              ['arb'],
  'valsartan':             ['arb'],
  'candesartan':           ['arb'],
  'irbesartan':            ['arb'],
  'olmesartan':            ['arb'],
  'atenolol':              ['beta-blocker'],
  'metoprolol':            ['beta-blocker'],
  'bisoprolol':            ['beta-blocker'],
  'carvedilol':            ['beta-blocker'],
  'propranolol':           ['beta-blocker'],
  'nebivolol':             ['beta-blocker'],
  'amlodipine':            ['calcium channel blocker'],
  'nifedipine':            ['calcium channel blocker'],
  'diltiazem':             ['calcium channel blocker'],
  'verapamil':             ['calcium channel blocker'],
  'felodipine':            ['calcium channel blocker'],
  'atorvastatin':          ['statin'],
  'rosuvastatin':          ['statin'],
  'simvastatin':           ['statin'],
  'pravastatin':           ['statin'],
  'lipitor':               ['statin'],
  'crestor':               ['statin'],
  'furosemide':            ['furosemide'],
  'frusemide':             ['furosemide'],
  'lasix':                 ['furosemide'],
  'spironolactone':        ['furosemide', 'diuretic'],
  'hydrochlorothiazide':   ['furosemide', 'diuretic'],
  'ibuprofen':             ['nsaid'],
  'diclofenac':            ['nsaid'],
  'naproxen':              ['nsaid'],
  'celecoxib':             ['nsaid'],
  'voltaren':              ['nsaid'],
  'omeprazole':            ['ppi'],
  'pantoprazole':          ['ppi'],
  'lansoprazole':          ['ppi'],
  'esomeprazole':          ['ppi'],
  'rabeprazole':           ['ppi'],
  'nexium':                ['ppi'],
  'ranitidine':            ['h2 blocker'],
  'famotidine':            ['h2 blocker'],
  'sertraline':            ['antidepressant'],
  'fluoxetine':            ['antidepressant'],
  'citalopram':            ['antidepressant'],
  'escitalopram':          ['antidepressant'],
  'venlafaxine':           ['antidepressant'],
  'duloxetine':            ['antidepressant'],
  'mirtazapine':           ['antidepressant'],
  'paroxetine':            ['antidepressant'],
  'amitriptyline':         ['antidepressant'],
  'haloperidol':           ['antipsychotic'],
  'olanzapine':            ['antipsychotic'],
  'risperidone':           ['antipsychotic'],
  'quetiapine':            ['antipsychotic'],
  'methotrexate':          ['methotrexate'],
  'azathioprine':          ['azathioprine'],
  'mycophenolate':         ['mycophenolate'],
  'ocp':                   ['ocp'],
  'oral contraceptive':    ['ocp'],
  'pill':                  ['ocp'],
  'hrt':                   ['hrt'],
  'hormone replacement':   ['hrt'],
  'herbal':                ['herbal'],
  'traditional medicine':  ['herbal'],

  // Allergies
  'penicillin':            ['penicillin'],
  'amoxicillin':           ['penicillin', 'amoxicillin'],
  'amoxil':                ['penicillin', 'amoxicillin'],
  'augmentin':             ['penicillin', 'amoxicillin'],
  'cephalosporin':         ['cephalosporins'],
  'keflex':                ['cephalosporins'],
  'cephalexin':            ['cephalosporins'],
  'sulfonamide':           ['sulfonamide'],
  'bactrim':               ['sulfonamide', 'bactrim'],
  'trimethoprim':          ['sulfonamide', 'bactrim'],
  'nkda':                  ['no known allergies'],
  'no known drug':         ['no known allergies'],
  'no allergies':          ['no known allergies'],
  'latex':                 ['latex'],
  'rubber':                ['latex'],
  'nickel':                ['nickel'],
  'nuts':                  ['nuts'],
  'peanut':                ['nuts'],
  'shellfish':             ['shellfish'],
  'seafood':               ['shellfish'],
  'eggs':                  ['eggs'],
  'contrast':              ['contrast dye'],
  'iodine':                ['contrast dye', 'iodine'],
  'chlorhexidine':         ['chlorhexidine'],
  'hibitane':              ['chlorhexidine'],
  'adhesive':              ['adhesive'],
  'plaster':               ['adhesive'],
  'codeine':               ['codeine'],
  'opioid':                ['codeine', 'opioid'],
  'morphine':              ['morphine'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase()
    .replace(/[()\/,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getKeyTerms(chip: string): string[] {
  const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'with', 'for', 'to', 'in', 'on', 'by', 'at', 'any']);
  return normalise(chip).split(' ').filter(w => w.length > 2 && !STOP.has(w));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core matcher
// ─────────────────────────────────────────────────────────────────────────────

function matchChipToText(chip: string, normText: string): boolean {
  const normChip = normalise(chip);

  // 1. Direct substring
  if (normText.includes(normChip)) return true;

  // 2. Key-term match (all significant words present)
  const terms = getKeyTerms(chip);
  if (terms.length > 0 && terms.every(t => normText.includes(t))) return true;

  // 3. Abbreviation / synonym map
  for (const [abbrev, targets] of Object.entries(ABBREV_MAP)) {
    if (!normText.includes(abbrev)) continue;
    if (targets.some(target => normChip.includes(normalise(target)))) return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface NarrativeParseOptions {
  section: 'pmh' | 'medications' | 'allergies' | 'examination' | string;
  chipOptions?: string[];
  learnedTerms?: Array<{ term: string; chipMatch: string }>;
}

export function localParse(text: string, opts: NarrativeParseOptions): LocalParseResult {
  const { chipOptions = [], learnedTerms = [] } = opts;
  const norm = normalise(text);

  const matched: string[] = [];

  for (const chip of chipOptions) {
    if (matched.includes(chip)) continue;

    // Standard matching
    if (matchChipToText(chip, norm)) {
      matched.push(chip);
      continue;
    }

    // Learned terms
    const learned = learnedTerms.find(lt => lt.chipMatch === chip);
    if (learned && norm.includes(normalise(learned.term))) {
      matched.push(chip);
    }
  }

  // Confidence: simple heuristic
  const wordCount = text.trim().split(/\s+/).length;
  const confidence = wordCount < 5
    ? 0.4                         // too short to be confident
    : matched.length > 0
      ? 0.85
      : 0.45;                     // nothing matched — probably needs cloud

  return {
    matched,
    additional: [],
    notes: text.trim(),
    confidence,
    source: 'local',
  };
}
