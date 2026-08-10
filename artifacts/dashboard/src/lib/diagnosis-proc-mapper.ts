/**
 * Bayesian diagnosis-to-procedure mapper.
 *
 * For each known surgical/endoscopic procedure, specifies a set of diagnostic
 * keywords with weights. A simple log-linear scorer picks the best-matching
 * procedure above a confidence threshold.
 *
 * Outputs: periop antibiotic procedure ID, consent template ID, visit type ID,
 * and a human-readable procedure name — used to autopopulate the EMR when the
 * clinician enters a diagnosis in the Assessment field.
 */

export interface ProcMapping {
  procId: string;           // PerioperativeTab procedure ID (antibiotic prophylaxis)
  consentId: string;        // SurgicalConsentTab template ID
  visitTypeId: string;      // AppContext visitType
  procedureName: string;    // Human-readable procedure name for WHO checklist
  encounterType: 'surgical_consult' | 'endoscopy' | 'quick_consult';
  keywords: Array<{ term: string; weight: number }>;
  threshold: number;        // Minimum score to trigger autofill
}

export const PROC_MAPPINGS: ProcMapping[] = [
  // ── Hepatobiliary ───────────────────────────────────────────────────────
  {
    procId: 'lap_chole',
    consentId: 'lap_chole',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Laparoscopic cholecystectomy',
    encounterType: 'surgical_consult',
    threshold: 5,
    keywords: [
      { term: 'cholecystitis', weight: 12 },
      { term: 'cholelithiasis', weight: 11 },
      { term: 'gallstone', weight: 9 },
      { term: 'biliary colic', weight: 9 },
      { term: 'gallbladder stone', weight: 10 },
      { term: 'symptomatic gallstone', weight: 11 },
      { term: 'gallbladder', weight: 4 },
      { term: 'cholecystectomy', weight: 14 },
      { term: 'acalculous', weight: 8 },
      { term: 'empyema of gallbladder', weight: 10 },
      { term: 'mucocele', weight: 7 },
    ],
  },
  {
    procId: 'open_chole',
    consentId: 'lap_chole',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Open cholecystectomy',
    encounterType: 'surgical_consult',
    threshold: 12,
    keywords: [
      { term: 'open cholecystectomy', weight: 14 },
      { term: 'biliary peritonitis', weight: 10 },
      { term: 'bile duct injury', weight: 9 },
      { term: 'bile leak', weight: 7 },
    ],
  },

  // ── ERCP ────────────────────────────────────────────────────────────────
  {
    procId: 'ercp_therapeutic',
    consentId: 'ercp',
    visitTypeId: 'ercp',
    procedureName: 'ERCP',
    encounterType: 'endoscopy',
    threshold: 7,
    keywords: [
      { term: 'ercp', weight: 16 },
      { term: 'choledocholithiasis', weight: 13 },
      { term: 'cbd stone', weight: 13 },
      { term: 'common bile duct stone', weight: 13 },
      { term: 'biliary obstruction', weight: 8 },
      { term: 'obstructive jaundice', weight: 8 },
      { term: 'cholangitis', weight: 9 },
      { term: 'ascending cholangitis', weight: 10 },
      { term: 'biliary stricture', weight: 9 },
      { term: 'pancreatic duct', weight: 7 },
      { term: 'sphincterotomy', weight: 10 },
      { term: 'biliary stent', weight: 10 },
      { term: 'stone extraction', weight: 9 },
      { term: 'psc', weight: 7 },
      { term: 'primary sclerosing cholangitis', weight: 9 },
    ],
  },

  // ── Endoscopy — OGD ─────────────────────────────────────────────────────
  {
    procId: 'ogd',
    consentId: 'ogd',
    visitTypeId: 'endoscopy_ogd',
    procedureName: 'OGD (upper GI endoscopy)',
    encounterType: 'endoscopy',
    threshold: 6,
    keywords: [
      { term: 'ogd', weight: 16 },
      { term: 'gastroscopy', weight: 14 },
      { term: 'upper gi endoscopy', weight: 14 },
      { term: 'upper endoscopy', weight: 12 },
      { term: 'oesophagoscopy', weight: 12 },
      { term: "barrett's oesophagus", weight: 10 },
      { term: 'dysphagia', weight: 6 },
      { term: 'odynophagia', weight: 6 },
      { term: 'peptic ulcer', weight: 8 },
      { term: 'gastric ulcer', weight: 8 },
      { term: 'duodenal ulcer', weight: 8 },
      { term: 'upper gi bleed', weight: 9 },
      { term: 'haematemesis', weight: 9 },
      { term: 'varices', weight: 8 },
      { term: 'oesophageal varices', weight: 9 },
      { term: 'gord', weight: 6 },
      { term: 'gerd', weight: 6 },
      { term: 'gastro-oesophageal reflux', weight: 6 },
      { term: 'h. pylori', weight: 7 },
      { term: 'helicobacter', weight: 7 },
      { term: 'oesophageal cancer', weight: 10 },
      { term: 'gastric cancer', weight: 10 },
      { term: 'stomach cancer', weight: 10 },
      { term: 'peg', weight: 8 },
    ],
  },

  // ── Endoscopy — Colonoscopy ──────────────────────────────────────────────
  {
    procId: 'colonoscopy',
    consentId: 'colonoscopy',
    visitTypeId: 'endoscopy_col',
    procedureName: 'Colonoscopy',
    encounterType: 'endoscopy',
    threshold: 5,
    keywords: [
      { term: 'colonoscopy', weight: 16 },
      { term: 'colonic polyp', weight: 11 },
      { term: 'colon polyp', weight: 11 },
      { term: 'colorectal cancer screening', weight: 11 },
      { term: 'colorectal screening', weight: 10 },
      { term: 'surveillance colonoscopy', weight: 11 },
      { term: 'ibd', weight: 7 },
      { term: "crohn's disease", weight: 8 },
      { term: 'crohn\'s', weight: 8 },
      { term: 'ulcerative colitis', weight: 9 },
      { term: 'pr bleed', weight: 7 },
      { term: 'rectal bleeding', weight: 7 },
      { term: 'per rectal bleed', weight: 7 },
      { term: 'haematochezia', weight: 7 },
      { term: 'change in bowel habit', weight: 5 },
      { term: 'altered bowel habit', weight: 5 },
      { term: 'diverticular', weight: 6 },
      { term: 'diverticulosis', weight: 6 },
      { term: 'diverticulitis', weight: 6 },
      { term: 'sigmoid volvulus', weight: 8 },
      { term: 'polypectomy', weight: 10 },
      { term: 'iron deficiency', weight: 4 },
    ],
  },

  // ── Colorectal ───────────────────────────────────────────────────────────
  {
    procId: 'appendicectomy',
    consentId: 'appendicectomy',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Laparoscopic appendicectomy',
    encounterType: 'surgical_consult',
    threshold: 7,
    keywords: [
      { term: 'appendicitis', weight: 14 },
      { term: 'appendix', weight: 6 },
      { term: 'appendiceal', weight: 9 },
      { term: 'appendicectomy', weight: 14 },
      { term: 'appendectomy', weight: 14 },
      { term: 'perforated appendix', weight: 14 },
      { term: 'appendix mass', weight: 9 },
      { term: 'appendix abscess', weight: 10 },
    ],
  },
  {
    procId: 'colorectal_resection',
    consentId: 'anterior_resection',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Colorectal resection',
    encounterType: 'surgical_consult',
    threshold: 10,
    keywords: [
      { term: 'colorectal cancer', weight: 13 },
      { term: 'rectal cancer', weight: 13 },
      { term: 'rectal carcinoma', weight: 13 },
      { term: 'colon cancer', weight: 13 },
      { term: 'colon carcinoma', weight: 13 },
      { term: 'sigmoid cancer', weight: 13 },
      { term: 'sigmoid carcinoma', weight: 13 },
      { term: 'anterior resection', weight: 14 },
      { term: 'right hemicolectomy', weight: 13 },
      { term: 'left hemicolectomy', weight: 13 },
      { term: 'sigmoid colectomy', weight: 13 },
      { term: 'colonic resection', weight: 11 },
      { term: 'low anterior resection', weight: 14 },
      { term: 'hartmann', weight: 11 },
    ],
  },
  {
    procId: 'stoma_reversal',
    consentId: 'anterior_resection',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Stoma reversal / Hartmann\'s reversal',
    encounterType: 'surgical_consult',
    threshold: 10,
    keywords: [
      { term: 'stoma reversal', weight: 14 },
      { term: 'reversal of stoma', weight: 14 },
      { term: "hartmann's reversal", weight: 14 },
      { term: 'colostomy reversal', weight: 14 },
      { term: 'ileostomy reversal', weight: 14 },
      { term: 'loop ileostomy closure', weight: 13 },
      { term: 'defunctioning ileostomy closure', weight: 13 },
    ],
  },

  // ── Hernia ───────────────────────────────────────────────────────────────
  {
    procId: 'hernia_inguinal',
    consentId: 'hernia_repair',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Inguinal hernia repair',
    encounterType: 'surgical_consult',
    threshold: 5,
    keywords: [
      { term: 'inguinal hernia', weight: 13 },
      { term: 'femoral hernia', weight: 13 },
      { term: 'groin hernia', weight: 11 },
      { term: 'indirect hernia', weight: 10 },
      { term: 'direct hernia', weight: 10 },
      { term: 'hernia repair', weight: 7 },
      { term: 'tapp', weight: 8 },
      { term: 'tep', weight: 8 },
      { term: 'lichtenstein', weight: 9 },
      { term: 'hernia', weight: 3 },
    ],
  },
  {
    procId: 'hernia_ventral',
    consentId: 'hernia_repair',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Ventral hernia repair',
    encounterType: 'surgical_consult',
    threshold: 10,
    keywords: [
      { term: 'umbilical hernia', weight: 13 },
      { term: 'incisional hernia', weight: 13 },
      { term: 'ventral hernia', weight: 13 },
      { term: 'epigastric hernia', weight: 12 },
      { term: 'parastomal hernia', weight: 12 },
      { term: 'abdominal wall defect', weight: 9 },
      { term: 'diastasis recti', weight: 7 },
    ],
  },

  // ── Breast ───────────────────────────────────────────────────────────────
  {
    procId: 'breast',
    consentId: 'mastectomy',
    visitTypeId: 'breast',
    procedureName: 'Mastectomy',
    encounterType: 'surgical_consult',
    threshold: 8,
    keywords: [
      { term: 'breast cancer', weight: 12 },
      { term: 'breast carcinoma', weight: 12 },
      { term: 'dcis', weight: 10 },
      { term: 'ductal carcinoma', weight: 10 },
      { term: 'lobular carcinoma', weight: 10 },
      { term: 'mastectomy', weight: 14 },
      { term: 'modified radical mastectomy', weight: 14 },
      { term: 'simple mastectomy', weight: 14 },
      { term: 'total mastectomy', weight: 14 },
      { term: 'sentinel node', weight: 9 },
      { term: 'axillary clearance', weight: 9 },
    ],
  },
  {
    procId: 'breast',
    consentId: 'wle',
    visitTypeId: 'breast',
    procedureName: 'Wide local excision',
    encounterType: 'surgical_consult',
    threshold: 9,
    keywords: [
      { term: 'wide local excision', weight: 14 },
      { term: 'wle', weight: 12 },
      { term: 'lumpectomy', weight: 12 },
      { term: 'breast conservation', weight: 11 },
      { term: 'breast-conserving surgery', weight: 12 },
    ],
  },

  // ── Endocrine ────────────────────────────────────────────────────────────
  {
    procId: 'thyroid',
    consentId: 'thyroidectomy',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Thyroidectomy',
    encounterType: 'surgical_consult',
    threshold: 7,
    keywords: [
      { term: 'thyroid cancer', weight: 13 },
      { term: 'thyroid carcinoma', weight: 13 },
      { term: 'papillary thyroid', weight: 12 },
      { term: 'follicular thyroid', weight: 12 },
      { term: 'medullary thyroid', weight: 12 },
      { term: 'anaplastic thyroid', weight: 12 },
      { term: 'thyroid nodule', weight: 8 },
      { term: 'toxic nodule', weight: 8 },
      { term: 'goitre', weight: 7 },
      { term: 'goiter', weight: 7 },
      { term: 'thyroidectomy', weight: 14 },
      { term: 'hemithyroidectomy', weight: 13 },
      { term: 'hemi-thyroidectomy', weight: 13 },
      { term: 'hyperthyroidism', weight: 6 },
      { term: 'graves disease', weight: 8 },
      { term: 'graves\'', weight: 7 },
      { term: 'multinodular goitre', weight: 9 },
      { term: 'parathyroid', weight: 7 },
      { term: 'hyperparathyroidism', weight: 8 },
    ],
  },

  // ── Upper GI ─────────────────────────────────────────────────────────────
  {
    procId: 'upper_gi',
    consentId: 'ogd',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Upper GI surgery',
    encounterType: 'surgical_consult',
    threshold: 11,
    keywords: [
      { term: 'gastrectomy', weight: 13 },
      { term: 'oesophagectomy', weight: 13 },
      { term: 'oesophago-gastrectomy', weight: 13 },
      { term: 'ivor lewis', weight: 12 },
      { term: 'bariatric', weight: 10 },
      { term: 'sleeve gastrectomy', weight: 12 },
      { term: 'gastric bypass', weight: 12 },
      { term: 'roux-en-y', weight: 10 },
      { term: 'obesity surgery', weight: 10 },
      { term: 'fundoplication', weight: 11 },
      { term: 'nissen', weight: 10 },
    ],
  },

  // ── Hepatobiliary / Spleen ────────────────────────────────────────────────
  {
    procId: 'splenectomy',
    consentId: 'lap_chole',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Splenectomy',
    encounterType: 'surgical_consult',
    threshold: 10,
    keywords: [
      { term: 'splenectomy', weight: 14 },
      { term: 'splenic rupture', weight: 10 },
      { term: 'splenic laceration', weight: 10 },
      { term: 'itp', weight: 8 },
      { term: 'immune thrombocytopenia', weight: 9 },
      { term: 'splenomegaly', weight: 6 },
    ],
  },

  // ── General / Laparotomy ─────────────────────────────────────────────────
  {
    procId: 'laparotomy',
    consentId: 'lap_chole',
    visitTypeId: 'day_of_surgery',
    procedureName: 'Exploratory laparotomy',
    encounterType: 'surgical_consult',
    threshold: 10,
    keywords: [
      { term: 'laparotomy', weight: 14 },
      { term: 'exploratory laparotomy', weight: 14 },
      { term: 'bowel obstruction', weight: 8 },
      { term: 'small bowel obstruction', weight: 9 },
      { term: 'large bowel obstruction', weight: 9 },
      { term: 'peritonitis', weight: 9 },
      { term: 'perforation', weight: 7 },
      { term: 'hollow viscus perforation', weight: 10 },
      { term: 'ischaemic bowel', weight: 10 },
      { term: 'mesenteric ischaemia', weight: 10 },
    ],
  },

  // ── Diabetic foot ────────────────────────────────────────────────────────
  {
    procId: 'laparotomy',
    consentId: 'lap_chole',
    visitTypeId: 'diabetic_foot',
    procedureName: 'Diabetic foot assessment',
    encounterType: 'surgical_consult',
    threshold: 9,
    keywords: [
      { term: 'diabetic foot', weight: 13 },
      { term: 'diabetic foot ulcer', weight: 14 },
      { term: 'diabetic foot wound', weight: 14 },
      { term: 'charcot foot', weight: 12 },
      { term: 'amputation', weight: 8 },
      { term: 'toe amputation', weight: 10 },
      { term: 'ray amputation', weight: 11 },
      { term: 'below knee amputation', weight: 11 },
    ],
  },
];

export interface ProcSuggestion {
  procId: string;
  consentId: string;
  visitTypeId: string;
  procedureName: string;
  encounterType: 'surgical_consult' | 'endoscopy' | 'quick_consult';
  score: number;
}

/**
 * Score all procedure mappings against diagnosis text using weighted keyword
 * matching. Returns the highest-scoring match above its threshold, or null.
 *
 * Multiple entries for the same procId are supported (e.g. WLE vs mastectomy
 * both map to procId='breast' but different consentIds).
 */
export function scoreDiagnosis(text: string): ProcSuggestion | null {
  if (!text || text.trim().length < 4) return null;
  const lower = text.toLowerCase();

  let bestScore = 0;
  let best: ProcMapping | null = null;

  for (const mapping of PROC_MAPPINGS) {
    let score = 0;
    for (const kw of mapping.keywords) {
      if (lower.includes(kw.term)) score += kw.weight;
    }
    if (score >= mapping.threshold && score > bestScore) {
      bestScore = score;
      best = mapping;
    }
  }

  if (!best) return null;
  return {
    procId: best.procId,
    consentId: best.consentId,
    visitTypeId: best.visitTypeId,
    procedureName: best.procedureName,
    encounterType: best.encounterType,
    score: bestScore,
  };
}
