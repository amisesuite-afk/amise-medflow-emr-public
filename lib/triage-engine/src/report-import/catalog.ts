// The analytes the lab-report importer recognises, the names they are saved under, and the units
// the rest of the app expects. TypeScript port of ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift:
// same keys, names, aliases, units, conversion factors and "never silently convert an ambiguous
// unit" rules. `pnpm --filter @workspace/scripts run lint:report-import-parity` fails the build
// when the two drift. Pure and deterministic (no network, no AI).
//
// Saved names are chosen so that a reader doing substring matching on the lowercased name reads
// each as its own analyte only ("Fasting glucose" contains "ast", "HbA1c" contains "hb",
// "Lactate dehydrogenase" contains "lactate", "Direct bilirubin" contains "bilirubin").
//
// Units: values the scores read are stored in the unit the app assumes (µmol/L creatinine,
// mmol/L urea and glucose, g/dL Hb, g/L albumin, ...). A printed unit with an exact factor is
// converted and the original kept in the result text; an ambiguous or unexpected unit is never
// converted: the row is flagged and left unticked for the clinician.

// MARK: - Unit spellings

/** Applied in order by `normaliseUnit` (after lowercasing). */
export const UNIT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['µ', 'u'], ['μ', 'u'], ['×', 'x'], ['⁹', '9'], ['³', '3'], ['¹', '1'], ['²', '2'],
  ['⁶', '6'], ['\u00A0', ''], [' ', ''], ['\t', ''], ['^', ''], ['*', ''],
  ['10e', '10'], ['cumm', 'ul'], ['cmm', 'ul'], ['mm3', 'ul'],
];

export const UNIT_SYNONYMS: Readonly<Record<string, string>> = {
  'gm/dl': 'g/dl', 'g%': 'g/dl', 'gm%': 'g/dl', 'mg%': 'mg/dl',
  'mcg/l': 'ug/l', 'mcg/dl': 'ug/dl', 'mcmol/l': 'umol/l',
  'iu/l': 'u/l', 'units/l': 'u/l',
  'sec': 's', 'secs': 's', 'seconds': 's', 'second': 's',
  'mm/hr': 'mm/h', 'mm/1sthr': 'mm/h', 'mm/1sth': 'mm/h', 'mm/hour': 'mm/h',
  'uiu/ml': 'miu/l', 'uu/ml': 'miu/l', 'mu/l': 'miu/l',
  '103/ul': '109/l', 'k/ul': '109/l', 'thou/ul': '109/l', 'k/mm3': '109/l',
  '106/ul': '1012/l', 'm/ul': '1012/l', 'mill/ul': '1012/l', 'mil/ul': '1012/l',
  'ng/ml': 'ug/l', 'pg/ml': 'ng/l', 'u/ml': 'ku/l',
  'ml/min/1.73': 'ml/min/1.73m2', 'ml/min/1.73m': 'ml/min/1.73m2',
  'cells/ul': '/ul',
  'ratio': '',
};

/** Every unit spelling (normalised) the parser treats as a unit when it stands alone. */
export const KNOWN_UNITS: ReadonlySet<string> = new Set([
  '109/l', '1012/l', '/ul', 'g/dl', 'g/l', 'mg/dl', 'mg/l', 'ug/l', 'ng/l', 'ug/dl',
  'mmol/l', 'umol/l', 'nmol/l', 'pmol/l', 'meq/l', 'mmol/mol', 'u/l', 'ku/l', 'miu/l',
  'iu/ml', '%', 'fl', 'pg', 's', 'mm/h', 'ml/min/1.73m2', 'ml/min', 'l/l',
  'ug/lfeu', 'mg/lfeu', 'ug/mlfeu', 'ng/mlfeu', 'mg/mmol', 'mosm/kg', 'g/24h', 'ug/ml',
  '/hpf', '/lpf', 'cells/hpf',
]);

/**
 * Comparison form of a printed unit: lowercase, no spaces, µ/μ → u, superscripts → digits,
 * exponent markers dropped ("x10^9/L" → "109/l"), common synonyms folded.
 */
export function normaliseUnit(raw: string): string {
  let s = raw.toLowerCase();
  for (const [from, to] of UNIT_REPLACEMENTS) s = s.split(from).join(to);
  if (s.startsWith('x')) s = s.slice(1);
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1);
  return Object.prototype.hasOwnProperty.call(UNIT_SYNONYMS, s) ? UNIT_SYNONYMS[s] : s;
}

// MARK: - Analyte

/** A band of correct values that a score's magnitude-based unit guess reads wrongly. */
export interface LabMisreadRule {
  below: number | null;
  above: number | null;
  message: string;
}

export function misreadApplies(rule: LabMisreadRule, value: number): boolean {
  if (rule.below !== null && value < rule.below) return true;
  if (rule.above !== null && value > rule.above) return true;
  return false;
}

export interface LabAnalyte {
  /** Stable id, e.g. "haemoglobin". */
  key: string;
  /** The name the value is saved under. */
  name: string;
  /** Printed labels (lowercase) matched at the start of a result line; longest wins. */
  aliases: string[];
  /** Unit the app's consumers expect, as displayed; null = stored as reported. */
  appUnit: string | null;
  /** Normalised spellings of `appUnit` (factor 1). */
  unitAliases: string[];
  /** Normalised unit → factor to `appUnit`. */
  conversions: Record<string, number>;
  /** Normalised unit → why it is never converted. */
  ambiguousUnits: Record<string, string>;
  /** A missing unit leaves the row unticked (the value could be in either unit). */
  unitRequired: boolean;
  /** Physiologically possible range in `appUnit` (inclusive); outside it the row is unticked. */
  plausible: readonly [number, number] | null;
  /** Where a score's own unit guess misreads a correct value. */
  misread: LabMisreadRule | null;
  /** Decimals for a converted value. */
  decimals: number;
  /** Words after the label that make it another analyte ("Hb A1c" → hba1c). */
  qualifierRemaps: ReadonlyArray<{ word: string; key: string }>;
}

interface AnalyteOptions {
  unit?: string;
  unitAliases?: string[];
  conversions?: Record<string, number>;
  ambiguous?: Record<string, string>;
  unitRequired?: boolean;
  plausible?: readonly [number, number];
  misread?: LabMisreadRule;
  decimals?: number;
  remaps?: ReadonlyArray<readonly [string, string]>;
}

function a(key: string, name: string, aliases: string[], o: AnalyteOptions = {}): LabAnalyte {
  return {
    key, name, aliases,
    appUnit: o.unit ?? null,
    unitAliases: o.unitAliases ?? [],
    conversions: o.conversions ?? {},
    ambiguousUnits: o.ambiguous ?? {},
    unitRequired: o.unitRequired ?? false,
    plausible: o.plausible ?? null,
    misread: o.misread ?? null,
    decimals: o.decimals ?? 1,
    qualifierRemaps: (o.remaps ?? []).map(([word, k]) => ({ word, key: k })),
  };
}

const rule = (below: number | null, above: number | null, message: string): LabMisreadRule =>
  ({ below, above, message });

// Unit families
const countPer9 = ['109/l'];
const perMicrolitre: Record<string, number> = { '/ul': 0.001 };
const mmol = ['mmol/l', 'meq/l'];
const enzyme = ['u/l'];

/** Analytes a score, a lab panel or bowel prep reads: unit-handled. */
export const SCORE_ANALYTES: LabAnalyte[] = [
  a('wbc', 'WBC',
    ['wbc', 'wcc', 'white blood cell count', 'white blood cells', 'white blood cell',
      'white cell count', 'white cells', 'total white cell count', 'total leucocyte count',
      'total leukocyte count', 'leucocyte count', 'leukocyte count', 'leucocytes',
      'leukocytes', 'tlc'],
    { unit: '×10⁹/L', unitAliases: countPer9, conversions: perMicrolitre,
      ambiguous: { 'g/l': '“G/L” may mean giga/L or grams/L' },
      unitRequired: true, plausible: [0.05, 600],
      misread: rule(null, 100, 'Scores treat a WBC above 100 as cells/µL and divide it by 1000.'),
      decimals: 1 }),
  a('haemoglobin', 'Haemoglobin', ['haemoglobin', 'hemoglobin', 'hgb', 'hb'],
    { unit: 'g/dL', unitAliases: ['g/dl'], conversions: { 'g/l': 0.1 },
      ambiguous: { 'mmol/l': 'Hb in mmol/L is not converted here' },
      unitRequired: true, plausible: [1, 25],
      misread: rule(null, 20, 'Scores treat an Hb above 20 as g/L and divide it by 10.'),
      decimals: 1,
      remaps: [['a1c', 'hba1c'], ['glyc', 'hba1c']] }),
  a('platelets', 'Platelets', ['platelets', 'platelet count', 'platelet', 'plt', 'plts'],
    { unit: '×10⁹/L', unitAliases: countPer9, conversions: perMicrolitre,
      ambiguous: { 'g/l': '“G/L” may mean giga/L or grams/L' },
      unitRequired: true, plausible: [1, 3000], decimals: 0 }),
  a('crp', 'CRP',
    ['crp', 'c-reactive protein', 'c reactive protein', 'hs-crp', 'hscrp', 'hs crp',
      'high sensitivity crp', 'c-reactive protein (crp)'],
    { unit: 'mg/L', unitAliases: ['mg/l'], conversions: { 'mg/dl': 10 },
      unitRequired: true, plausible: [0, 800], decimals: 0 }),
  a('sodium', 'Sodium', ['sodium', 'na', 'na+'],
    { unit: 'mmol/L', unitAliases: mmol, plausible: [90, 200], decimals: 0 }),
  a('potassium', 'Potassium', ['potassium', 'k', 'k+'],
    { unit: 'mmol/L', unitAliases: mmol, plausible: [1, 12], decimals: 1 }),
  a('urea', 'Urea', ['urea', 'blood urea', 'serum urea'],
    { unit: 'mmol/L', unitAliases: ['mmol/l'],
      ambiguous: { 'mg/dl': '“Urea” in mg/dL may be urea or BUN, which convert differently' },
      unitRequired: true, plausible: [0.3, 150],
      misread: rule(null, 50, 'Scores treat a urea above 50 as BUN mg/dL and divide it by 2.8.'),
      decimals: 1 }),
  a('bun', 'Urea', ['bun', 'blood urea nitrogen', 'urea nitrogen', 'urea nitrogen (bun)'],
    { unit: 'mmol/L', unitAliases: ['mmol/l'], conversions: { 'mg/dl': 0.357 },
      unitRequired: true, plausible: [0.3, 150],
      misread: rule(null, 50, 'Scores treat a urea above 50 as BUN mg/dL and divide it by 2.8.'),
      decimals: 1 }),
  a('creatinine', 'Creatinine', ['creatinine', 'creat', 'serum creatinine', 'creatinine, serum'],
    { unit: 'µmol/L', unitAliases: ['umol/l'], conversions: { 'mg/dl': 88.4 },
      unitRequired: true, plausible: [5, 3000],
      misread: rule(15, null, 'Scores treat a creatinine below 15 as mg/dL and multiply it by 88.'),
      decimals: 0 }),
  a('egfr', 'eGFR',
    ['egfr', 'e-gfr', 'estimated gfr', 'egfr (ckd-epi)', 'egfr ckd-epi', 'gfr (estimated)',
      'estimated glomerular filtration rate'],
    { unit: 'mL/min/1.73m²', unitAliases: ['ml/min/1.73m2', 'ml/min'],
      plausible: [0, 200], decimals: 0 }),
  a('glucose', 'Glucose',
    ['glucose', 'blood glucose', 'plasma glucose', 'serum glucose', 'fasting glucose',
      'fasting blood glucose', 'fasting plasma glucose', 'random glucose',
      'random blood glucose', 'random plasma glucose', 'glucose (fasting)',
      'glucose (random)', 'glucose, fasting', 'glucose, random', 'blood sugar',
      'fasting blood sugar', 'random blood sugar', 'fbs', 'fbg', 'fpg', 'rbs', 'rbg'],
    { unit: 'mmol/L', unitAliases: ['mmol/l'], conversions: { 'mg/dl': 0.0555 },
      unitRequired: true, plausible: [0.5, 120],
      misread: rule(null, 30, 'Scores treat a glucose above 30 as mg/dL and divide it by 18 — check glucose in any score by hand.'),
      decimals: 1 }),
  a('hba1c', 'A1c (glycated)',
    ['hba1c', 'hb a1c', 'hb-a1c', 'hba1c (ngsp)', 'haemoglobin a1c', 'hemoglobin a1c',
      'glycated haemoglobin', 'glycated hemoglobin', 'glycosylated haemoglobin',
      'glycosylated hemoglobin', 'a1c'],
    { unit: '%', unitAliases: ['%'],
      ambiguous: { 'mmol/mol': 'IFCC mmol/mol is not converted to %' },
      unitRequired: true, plausible: [3, 25], decimals: 1 }),
  a('bilirubin', 'Bilirubin',
    ['total bilirubin', 'bilirubin total', 'bilirubin, total', 'bilirubin (total)',
      't. bilirubin', 't bilirubin', 't.bilirubin', 'serum bilirubin', 'tbil', 't.bil',
      'bilirubin'],
    { unit: 'µmol/L', unitAliases: ['umol/l'], conversions: { 'mg/dl': 17.1 },
      unitRequired: true, plausible: [0, 1000],
      misread: rule(5, null, 'Scores treat a bilirubin below 5 as mg/dL and multiply it by 17.'),
      decimals: 0,
      remaps: [['unconjugated', 'bilirubinIndirect'], ['indirect', 'bilirubinIndirect'],
        ['conjugated', 'bilirubinDirect'], ['direct', 'bilirubinDirect']] }),
  a('alt', 'ALT',
    ['alt', 'alt (sgpt)', 'sgpt', 'sgpt (alt)', 'alat', 'alanine aminotransferase',
      'alanine transaminase', 'alanine aminotransferase (alt)'],
    { unit: 'U/L', unitAliases: enzyme, plausible: [0, 30000], decimals: 0 }),
  a('ast', 'AST',
    ['ast', 'ast (sgot)', 'sgot', 'sgot (ast)', 'asat', 'aspartate aminotransferase',
      'aspartate transaminase', 'aspartate aminotransferase (ast)'],
    { unit: 'U/L', unitAliases: enzyme, plausible: [0, 30000], decimals: 0 }),
  a('alp', 'ALP',
    ['alp', 'alkaline phosphatase', 'alk phos', 'alk. phos', 'alk phosphatase',
      'alkaline phosphatase (alp)'],
    { unit: 'U/L', unitAliases: enzyme, plausible: [0, 10000], decimals: 0 }),
  a('albumin', 'Albumin', ['albumin', 'serum albumin', 'alb'],
    { unit: 'g/L', unitAliases: ['g/l'], conversions: { 'g/dl': 10 },
      unitRequired: true, plausible: [5, 70],
      misread: rule(10, null, 'Scores treat an albumin below 10 as g/dL and multiply it by 10.'),
      decimals: 0 }),
  a('calcium', 'Calcium', ['calcium', 'total calcium', 'calcium total', 'calcium, total',
    'serum calcium', 'ca'],
  { unit: 'mmol/L', unitAliases: ['mmol/l'], conversions: { 'mg/dl': 0.2495, 'meq/l': 0.5 },
    unitRequired: true, plausible: [0.5, 5.5],
    misread: rule(null, 4.99, 'Scores treat a calcium of 5 or more as mg/dL and divide it by 4.'),
    decimals: 2,
    remaps: [['ionised', 'calciumIonised'], ['ionized', 'calciumIonised'],
      ['adjusted', 'calciumAdjusted'], ['corrected', 'calciumAdjusted'],
      ['19-9', 'ca199'], ['15-3', 'ca153']] }),
  a('magnesium', 'Magnesium', ['magnesium', 'serum magnesium', 'mg', 'mg++', 'mg2+'],
    { unit: 'mmol/L', unitAliases: ['mmol/l'], conversions: { 'mg/dl': 0.4114, 'meq/l': 0.5 },
      unitRequired: true, plausible: [0.1, 5], decimals: 2 }),
  a('amylase', 'Amylase', ['amylase', 'serum amylase', 'amylase, serum', 'amylase (serum)'],
    { unit: 'U/L', unitAliases: enzyme, plausible: [0, 20000], decimals: 0 }),
  a('lipase', 'Lipase', ['lipase', 'serum lipase'],
    { unit: 'U/L', unitAliases: enzyme, plausible: [0, 50000], decimals: 0 }),
  a('ldh', 'LDH', ['ldh', 'ld', 'lactate dehydrogenase', 'lactic dehydrogenase',
    'lactate dehydrogenase (ldh)'],
  { unit: 'U/L', unitAliases: enzyme, plausible: [0, 30000], decimals: 0 }),
  a('lactate', 'Lactate', ['lactate', 'lactic acid', 'blood lactate', 'venous lactate',
    'arterial lactate', 'plasma lactate'],
  { unit: 'mmol/L', unitAliases: ['mmol/l'], conversions: { 'mg/dl': 0.111 },
    unitRequired: true, plausible: [0, 30], decimals: 1 }),
  a('troponinI', 'Troponin I',
    ['troponin i', 'trop i', 'tni', 'ctni', 'hs troponin i', 'hs-troponin i',
      'high sensitivity troponin i', 'hs-tni', 'hstni', 'cardiac troponin i'],
    { unit: 'ng/L', unitAliases: ['ng/l'], conversions: { 'ug/l': 1000 },
      unitRequired: true, plausible: [0, 200000], decimals: 0 }),
  a('troponinT', 'Troponin T',
    ['troponin t', 'trop t', 'tnt', 'ctnt', 'hs troponin t', 'hs-troponin t',
      'high sensitivity troponin t', 'hs-tnt', 'hstnt', 'cardiac troponin t'],
    { unit: 'ng/L', unitAliases: ['ng/l'], conversions: { 'ug/l': 1000 },
      unitRequired: true, plausible: [0, 200000], decimals: 0 }),
  a('troponin', 'Troponin', ['troponin', 'hs troponin', 'high sensitivity troponin'],
    { unit: 'ng/L', unitAliases: ['ng/l'], conversions: { 'ug/l': 1000 },
      unitRequired: true, plausible: [0, 200000], decimals: 0 }),
  a('inr', 'INR', ['inr', 'pt-inr', 'pt inr', 'pt/inr', 'inr ratio',
    'international normalised ratio', 'international normalized ratio'],
  { unit: '', unitAliases: [''], plausible: [0.5, 20], decimals: 1 }),
  a('dDimer', 'D-dimer', ['d-dimer', 'd dimer', 'ddimer', 'd-dimer (feu)'],
    { unit: 'µg/L FEU', unitAliases: ['ug/lfeu', 'ng/mlfeu'],
      conversions: { 'mg/lfeu': 1000, 'ug/mlfeu': 1000 },
      ambiguous: { 'ug/l': 'D-dimer without FEU/DDU is not converted',
        'mg/l': 'D-dimer without FEU/DDU is not converted',
        'ug/ml': 'D-dimer without FEU/DDU is not converted' },
      unitRequired: true, plausible: [0, 200000], decimals: 0 }),
  a('esr', 'ESR', ['esr', 'erythrocyte sedimentation rate', 'sed rate'],
    { unit: 'mm/h', unitAliases: ['mm/h'], plausible: [0, 200], decimals: 0 }),
];

/** Stored as reported: nothing in the app reads these as numbers. */
export const OTHER_ANALYTES: LabAnalyte[] = [
  a('neutrophils', 'Neutrophils', ['neutrophils', 'neutrophil count', 'neutrophil',
    'absolute neutrophil count', 'anc', 'neut', 'polymorphs',
    'segmented neutrophils', 'granulocytes']),
  a('lymphocytes', 'Lymphocytes', ['lymphocytes', 'lymphocyte count', 'lymphocyte', 'lymph', 'lym']),
  a('monocytes', 'Monocytes', ['monocytes', 'monocyte count', 'monocyte', 'mono']),
  a('eosinophils', 'Eosinophils', ['eosinophils', 'eosinophil count', 'eosinophil', 'eos']),
  a('basophils', 'Basophils', ['basophils', 'basophil count', 'basophil', 'baso']),
  a('haematocrit', 'Haematocrit', ['haematocrit', 'hematocrit', 'hct', 'pcv', 'packed cell volume']),
  a('rbc', 'Red cell count', ['rbc', 'red blood cell count', 'red blood cells', 'red cell count',
    'erythrocytes', 'erythrocyte count']),
  a('mcv', 'MCV', ['mcv', 'mean cell volume', 'mean corpuscular volume']),
  a('mch', 'MCH', ['mch', 'mean cell haemoglobin', 'mean cell hemoglobin',
    'mean corpuscular haemoglobin', 'mean corpuscular hemoglobin']),
  a('mchc', 'MCHC', ['mchc', 'mean cell haemoglobin concentration',
    'mean cell hemoglobin concentration',
    'mean corpuscular haemoglobin concentration',
    'mean corpuscular hemoglobin concentration']),
  a('rdw', 'RDW', ['rdw', 'rdw-cv', 'rdw cv', 'red cell distribution width']),
  a('chloride', 'Chloride', ['chloride', 'cl', 'cl-']),
  a('bicarbonate', 'Bicarbonate', ['bicarbonate', 'hco3', 'hco3-', 'total co2', 'tco2', 'co2']),
  a('ggt', 'GGT', ['ggt', 'gamma gt', 'gamma-gt', 'gamma glutamyl transferase',
    'gamma-glutamyl transferase', 'gamma glutamyltransferase', 'ggtp', 'γgt']),
  a('bilirubinDirect', 'Direct bili (conjugated)',
    ['direct bilirubin', 'bilirubin direct', 'bilirubin, direct', 'bilirubin (direct)',
      'conjugated bilirubin', 'bilirubin conjugated', 'd. bilirubin', 'd bilirubin', 'dbil']),
  a('bilirubinIndirect', 'Indirect bili (unconjugated)',
    ['indirect bilirubin', 'bilirubin indirect', 'bilirubin, indirect', 'bilirubin (indirect)',
      'unconjugated bilirubin', 'bilirubin unconjugated', 'ibil']),
  a('totalProtein', 'Total protein', ['total protein', 'protein total', 'protein, total',
    'total proteins', 'serum protein']),
  a('globulin', 'Globulin', ['globulin', 'globulins']),
  a('calciumAdjusted', 'Corrected Ca',
    ['adjusted calcium', 'corrected calcium', 'calcium (adjusted)', 'calcium (corrected)',
      'calcium adjusted', 'calcium corrected', 'calcium, adjusted', 'calcium, corrected',
      'adj calcium', 'adj. calcium', 'corr calcium', 'corr. calcium']),
  a('calciumIonised', 'Ionised Ca',
    ['ionised calcium', 'ionized calcium', 'calcium ionised', 'calcium ionized',
      'calcium, ionised', 'calcium, ionized', 'ionised ca', 'ionized ca', 'ica', 'ca++', 'ca2+']),
  a('phosphate', 'Phosphate', ['phosphate', 'phosphorus', 'inorganic phosphate',
    'phosphate (inorganic)', 'phos', 'po4']),
  a('uricAcid', 'Uric acid', ['uric acid', 'urate', 'serum uric acid']),
  a('ck', 'Creatine kinase', ['creatine kinase', 'creatine phosphokinase', 'ck', 'cpk', 'ck total']),
  a('procalcitonin', 'Procalcitonin', ['procalcitonin', 'pct']),
  a('pt', 'Prothrombin time', ['prothrombin time', 'prothrombin time (pt)', 'pro time',
    'protime', 'pt'],
  { remaps: [['inr', 'inr']] }),
  a('aptt', 'APTT', ['aptt', 'ptt', 'activated partial thromboplastin time',
    'partial thromboplastin time', 'a.p.t.t.']),
  a('fibrinogen', 'Fibrinogen', ['fibrinogen']),
  a('tsh', 'TSH', ['tsh', 'thyroid stimulating hormone', 'thyroid-stimulating hormone', 'thyrotropin']),
  a('ft4', 'Free T4', ['free t4', 'ft4', 'free thyroxine', 't4 free', 't4, free']),
  a('ft3', 'Free T3', ['free t3', 'ft3', 'free triiodothyronine', 't3 free', 't3, free']),
  a('ferritin', 'Ferritin', ['ferritin', 'serum ferritin']),
  a('iron', 'Iron', ['iron', 'serum iron', 'fe']),
  a('tibc', 'TIBC', ['tibc', 'total iron binding capacity']),
  a('b12', 'Vitamin B12', ['vitamin b12', 'vit b12', 'b12', 'cobalamin']),
  a('folate', 'Folate', ['folate', 'serum folate', 'folic acid', 'red cell folate']),
  a('cea', 'CEA', ['cea', 'carcinoembryonic antigen']),
  a('ca199', 'CA 19-9', ['ca 19-9', 'ca19-9', 'ca 19.9', 'ca19.9', 'ca 199', 'ca199',
    'carbohydrate antigen 19-9']),
  a('ca125', 'CA-125', ['ca 125', 'ca-125', 'ca125']),
  a('ca153', 'CA 15-3', ['ca 15-3', 'ca15-3', 'ca 15.3', 'ca15.3']),
  a('psa', 'PSA', ['psa', 'total psa', 'psa total', 'psa, total', 'prostate specific antigen',
    'prostate-specific antigen']),
  a('freePsa', 'Free PSA', ['free psa', 'psa free', 'psa, free', 'fpsa']),
  a('afp', 'AFP', ['afp', 'alpha fetoprotein', 'alpha-fetoprotein', 'a-fetoprotein']),
  a('cholesterol', 'Total cholesterol', ['total cholesterol', 'cholesterol total',
    'cholesterol, total', 'cholesterol', 't. cholesterol']),
  a('hdl', 'HDL cholesterol', ['hdl cholesterol', 'hdl-cholesterol', 'hdl-c', 'hdl']),
  a('ldl', 'LDL cholesterol', ['ldl cholesterol', 'ldl-cholesterol', 'ldl-c',
    'ldl (calculated)', 'ldl calculated', 'ldl']),
  a('triglycerides', 'Triglycerides', ['triglycerides', 'triglyceride', 'trig', 'tg']),
];

export const LAB_ANALYTES: LabAnalyte[] = [...SCORE_ANALYTES, ...OTHER_ANALYTES];

const BY_KEY = new Map<string, LabAnalyte>();
for (const an of LAB_ANALYTES) if (!BY_KEY.has(an.key)) BY_KEY.set(an.key, an);

export function analyteForKey(key: string | null | undefined): LabAnalyte | null {
  if (key === null || key === undefined) return null;
  return BY_KEY.get(key) ?? null;
}

/** (alias, key), longest alias first, so "hb a1c" wins over "hb" and "direct bilirubin" over "bilirubin". */
export const ALIAS_INDEX: ReadonlyArray<{ alias: string; key: string }> = LAB_ANALYTES
  .flatMap(an => an.aliases.map(alias => ({ alias, key: an.key })))
  .map((e, i) => ({ ...e, i }))
  .sort((x, y) => (y.alias.length - x.alias.length) || (x.i - y.i))
  .map(({ alias, key }) => ({ alias, key }));

// MARK: - What the iOS app would read a name as

/**
 * Keyword lists iOS `Patient.latestLab(named:)` is called with (LabScoreKeywords in
 * LabAnalyteCatalog.swift, copied from the iOS score callers). Kept here so the parity tests
 * can reproduce the iOS checks; the web dashboard has its own readers
 * (artifacts/dashboard/src/lib/lab-reader-keywords.ts).
 */
export const IOS_SCORE_KEYWORD_GROUPS: ReadonlyArray<{ key: string; keywords: string[] }> = [
  { key: 'wbc', keywords: ['wbc', 'white blood cell', 'white cell count', 'leucocyte', 'leukocyte'] },
  { key: 'urea', keywords: ['urea', 'blood urea', 'bun', 'blood urea nitrogen'] },
  { key: 'bilirubin', keywords: ['bilirubin'] },
  { key: 'sodium', keywords: ['sodium'] },
  { key: 'ldh', keywords: ['ldh', 'lactate dehydrogenase'] },
  { key: 'inr', keywords: ['inr', 'pt-inr'] },
  { key: 'haemoglobin', keywords: ['haemoglobin', 'hemoglobin', 'hgb', 'hb'] },
  { key: 'glucose', keywords: ['glucose', 'blood glucose', 'rbs', 'fasting glucose'] },
  { key: 'ast', keywords: ['ast', 'aspartate aminotransferase', 'aspartate transaminase'] },
  { key: 'egfr', keywords: ['egfr'] },
  { key: 'crp', keywords: ['crp', 'c-reactive protein', 'c reactive protein'] },
  { key: 'creatinine', keywords: ['creatinine'] },
  { key: 'calcium', keywords: ['calcium'] },
  { key: 'alt', keywords: ['alt', 'alanine aminotransferase'] },
  { key: 'albumin', keywords: ['albumin'] },
  { key: 'magnesium', keywords: ['magnesium'] },
];

export function iosScoreGroupsReadingName(name: string): string[] {
  const lower = name.toLowerCase();
  return IOS_SCORE_KEYWORD_GROUPS.filter(g => g.keywords.some(k => lower.includes(k))).map(g => g.key);
}

/** The iOS LabPanel field a resulted entry with this name fills (the if/else chain in LabPanel.parse). */
export function iosLabPanelField(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes('wbc') || n.includes('white cell') || n.includes('white blood') || n.includes('leucocyte') || n.includes('leukocyte')) return 'wbc';
  if (n.includes('haemoglobin') || n.includes('hemoglobin') || n === 'hb' || n === 'hgb' || n.startsWith('hb ')) return 'haemoglobin';
  if (n.includes('platelet')) return 'platelets';
  if (n.includes('crp') || n.includes('c-reactive')) return 'crp';
  if (n.includes('esr')) return 'esr';
  if (n.includes('sodium') || n === 'na') return 'sodium';
  if (n.includes('potassium') || n === 'k') return 'potassium';
  if (n.includes('creatinine') && !n.includes('egfr')) return 'creatinine';
  if (n.includes('urea') || n.includes('bun')) return 'urea';
  if (n.includes('bilirubin')) return 'bilirubin';
  if (n.includes('alt') || n.includes('alanine')) return 'alt';
  if (n.includes('ast') || n.includes('aspartate')) return 'ast';
  if (n.includes('alp') || n.includes('alkaline phosphatase')) return 'alp';
  if (n.includes('albumin')) return 'albumin';
  if ((n.includes('calcium') || n === 'ca') && !n.includes('bicarbonate')) return 'calcium';
  if (n.includes('amylase') && !n.includes('lipase')) return 'amylase';
  if (n.includes('lipase')) return 'lipase';
  if (n.includes('lactate')) return 'lactate';
  if (n.includes('d-dimer') || n.includes('ddimer') || n.includes('d dimer')) return 'dDimer';
  if (n.includes('troponin')) return 'troponin';
  if (n.includes('inr')) return 'inr';
  if (n.includes('glucose') && !n.includes('hba1c')) return 'glucose';
  if (n.includes('hba1c') || n.includes('haemoglobin a1c')) return 'hba1c';
  return null;
}

/** Reads a name the way something else in an app would: returns human labels, empty when nothing would. */
export type NameReaders = (name: string) => string[];

/** iOS LabPanelProbe.readers(ofName:): score keyword groups, then the LabPanel field. */
export const iosNameReaders: NameReaders = (name) => {
  const out = iosScoreGroupsReadingName(name);
  const f = iosLabPanelField(name);
  if (f !== null && !out.includes(f)) out.push(f);
  return out.map(k => analyteForKey(k)?.name ?? k);
};
