/**
 * Preventive screening engine (asymptomatic, age/sex/risk-based screening and surveillance).
 *
 * Web port of the iOS `ScreeningEngine` (ios/AmiseMedFlow/Views/Consultation/PathwayData.swift),
 * brought up to current guidance (SURGEON-DECISIONS G2.19, 2026-09-25). Rule set chosen for this
 * practice: USPSTF as the primary source; ACG 2021 and the US Multi-Society Task Force (US MSTF)
 * for colonoscopy start ages, family history and post-polypectomy intervals; ACR 2023 / NCCN 2024
 * for high-risk breast imaging; ADA 2024 for diabetes; NICE NG136 for out-of-office BP
 * confirmation. Every citation is unverified until the surgeon checks it; each rule names its
 * source next to it.
 *
 * Suggestions only: nothing here orders a test. The dashboard shows each item as a dismissible
 * prompt and the clinician confirms it. Deterministic; no AI, no network.
 *
 * Free text is read with the shared negation-aware matcher (../negation.ts), whole-word:
 * "No family history of bowel cancer" and "Non-smoker" do not count.
 *
 * iOS twin: `ScreeningEngine` in ios/AmiseMedFlow/Views/Consultation/PathwayData.swift follows
 * these rows and wording from structured toggles (docs/clinical-validation/changes/
 * ios-screening-parity.md lists the differences that remain). Change both together.
 */

import { containsAffirmed, joinClauses } from '../negation';

/** Rule-set version (clinical-content/registry.json `preventive-screening`). Bump with a changelog entry. */
export const PREVENTIVE_SCREENING_VERSION = '1.0.1';

export type PreventiveSex = 'male' | 'female' | 'other' | 'unknown';
export type SmokingStatus = 'current' | 'former' | 'never' | 'unknown';

export interface PreventiveScreeningInput {
  age: number | null;
  sex: PreventiveSex;
  /** Pregnant, or pregnancy not excluded: ionising-imaging lines carry a pregnancy caveat. */
  pregnancyPossible?: boolean;
  /**
   * Structured past medical / surgical history, one entry per item. Entries that start with
   * "Family history" / "FHx" are read as family history.
   */
  pastHistory: string[];
  /** Clinician free text (assessment, notes): polyp findings, hysterectomy, carrier status, last colonoscopy. */
  notes?: string[];
  /** Family history chips and notes. */
  familyHistory: string[];
  /** Smoking / toxic-habit entries, e.g. "Ex-smoker (30 pack-years)", "Smoker (15/day)". */
  toxicHabits?: string[];
  bmi?: number | null;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  /** Names of results already on file (e.g. "HbA1c", "Lipid profile"); that screen is not repeated. */
  resultNames?: string[];
  /** 'emergency' suppresses routine screening (offer it at an elective visit instead). */
  setting?: 'outpatient' | 'emergency';
}

export interface PreventiveAction {
  text: string;
  /** Investigation to add when the clinician confirms (dashboard investigation list name). */
  investigation?: string;
  /** Plan line to add when the clinician confirms. */
  plan?: string;
}

export type PreventiveTopic =
  | 'colorectal' | 'breast' | 'cervical' | 'prostate' | 'aaa' | 'lung' | 'tobacco' | 'bbv'
  | 'diabetes' | 'blood-pressure' | 'cardiovascular' | 'gastric' | 'osteoporosis';

export interface PreventiveItem {
  id: string;
  topic: PreventiveTopic;
  /** One-line card text. */
  title: string;
  /** Why it applies to this patient. */
  finding: string;
  rationale: string;
  /** Source(s), e.g. "USPSTF 2021". */
  guideline: string;
  priority: 'routine' | 'priority';
  highRisk: boolean;
  actions: PreventiveAction[];
  followUpDays?: number;
}

// ── Text helpers ──────────────────────────────────────────────────────────────

const FAMILY_ENTRY = /^\s*(family history|family hx|fhx|fh)\b/i;
const FAMILY_WORDS = /\b(family|fhx|fdr|mother|father|mum|mom|dad|sister|brother|son|daughter|parent|sibling|aunt|uncle|grand(mother|father|parent)|cousin|niece|nephew|relative)s?\b/i;

function affirmed(text: string, re: RegExp): boolean {
  return containsAffirmed(text, re);
}

function sentences(texts: string[]): string[] {
  return texts
    .flatMap(t => (t ?? '').split(/(?<=[.;!?])\s+|\n+/))
    .map(s => s.trim())
    .filter(Boolean);
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, solitary: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

// ── Smoking ───────────────────────────────────────────────────────────────────

export interface SmokingHistory {
  status: SmokingStatus;
  packYears: number | null;
  yearsSinceQuit: number | null;
}

/** Smoking status from toxic-habit entries (and past history). "Non-smoker"/"Never smoked" = never. */
export function readSmoking(entries: string[]): SmokingHistory {
  const text = joinClauses(entries);
  let status: SmokingStatus = 'unknown';
  const former = affirmed(text, /\b(ex-?smoker|former smoker|previous smoker|past smoker|quit smoking|stopped smoking|gave up smoking|smoked \d+ (pack-years|years)[^.]{0,20}\b(quit|stopped))\b/i);
  const current = affirmed(text, /\b(smoker|smokes|smoking|cigarettes?|tobacco|cigars?|vapes?)\b/i);
  if (former) status = 'former';
  else if (current) status = 'current';
  else if (/\b(non-?smoker|never smoked|never a smoker|does not smoke|doesn't smoke|no smoking|nil smoking)\b/i.test(text)) status = 'never';
  const py = text.match(/(\d+(?:\.\d+)?)\s*(?:pack[- ]?years?|py)\b/i);
  const quit = text.match(/\b(?:quit|stopped|gave up)\b[^.\d]{0,20}(\d{1,2})\s*(?:years?|yrs?)\s*ago\b/i)
    ?? text.match(/\b(?:quit|stopped|gave up)\b[^.\d]{0,12}(\d{1,2})\s*(?:years?|yrs?)\b/i);
  return {
    status,
    packYears: py ? parseFloat(py[1]) : null,
    yearsSinceQuit: quit ? parseInt(quit[1], 10) : null,
  };
}

/** BMI from free text ("BMI 31", "Obesity (BMI 31)"); obesity/overweight words when no number. */
export function readBmi(texts: string[]): number | null {
  const text = joinClauses(texts);
  const m = text.match(/\bbmi\s*(?:of|=|:|is)?\s*(\d{2}(?:\.\d+)?)/i);
  if (m) return parseFloat(m[1]);
  if (affirmed(text, /\b(morbid(ly)? obes\w*|obes(e|ity))\b/i)) return 30;
  if (affirmed(text, /\boverweight\b/i)) return 25;
  return null;
}

// ── Family history ────────────────────────────────────────────────────────────

export type FamilyCancer =
  | 'colorectal' | 'advanced-adenoma' | 'endometrial' | 'ovarian' | 'breast' | 'gastric'
  | 'prostate' | 'pancreatic' | 'other-lynch';

export interface FamilyCancerEntry {
  cancer: FamilyCancer;
  firstDegree: boolean;
  ageAtDiagnosis: number | null;
}

export interface FamilyRisk {
  cancers: FamilyCancerEntry[];
  /** Lynch syndrome / MMR variant named in a relative. */
  lynchNamed: boolean;
  /** BRCA / PALB2 variant named in a relative. */
  brcaNamed: boolean;
  diabetesFdr: boolean;
}

const CANCER_WORD = '(cancer|carcinoma|adenocarcinoma|malignan\\w*|tumou?r)';
const FAMILY_CANCER_PATTERNS: Array<[FamilyCancer, RegExp]> = [
  ['advanced-adenoma', /\b(advanced adenoma|advanced (colonic |bowel )?polyp|high[- ]risk (colonic |bowel )?polyp)s?\b/i],
  ['colorectal', new RegExp(`\\b((colorectal|colon|colonic|bowel|rectal|rectum|caecal|cecal|sigmoid) ${CANCER_WORD}|crc)\\b`, 'i')],
  ['endometrial', new RegExp(`\\b(endometri(al|um)|womb|uterine|uterus) ${CANCER_WORD}`, 'i')],
  ['ovarian', new RegExp(`\\b(ovar(y|ian)) ${CANCER_WORD}`, 'i')],
  ['breast', new RegExp(`\\bbreast ${CANCER_WORD}`, 'i')],
  ['gastric', new RegExp(`\\b((gastric|stomach) ${CANCER_WORD}|gastric adenocarcinoma)`, 'i')],
  ['prostate', new RegExp(`\\bprostat(e|ic) ${CANCER_WORD}`, 'i')],
  ['pancreatic', new RegExp(`\\bpancrea(s|tic) ${CANCER_WORD}`, 'i')],
  ['other-lynch', new RegExp(`\\b(small bowel|small intestin\\w*|ureter\\w*|renal pelvis|urothelial|biliary|bile duct|sebaceous) ${CANCER_WORD}`, 'i')],
];
const FIRST_DEGREE = /\b(mother|father|mum|mom|dad|sister|brother|son|daughter|parent|sibling|fdr|first[- ]degree)s?\b/i;
const SECOND_DEGREE = /\b(aunt|uncle|grand(mother|father|parent)|cousin|niece|nephew|half[- ](sister|brother)|second[- ]degree|sdr)s?\b/i;

/**
 * Family history from chips/notes plus "Family history: …" entries in the past history. A chip
 * with no relative named ("Colorectal cancer") is taken as a first-degree relative, age unknown.
 */
export function readFamilyRisk(familyHistory: string[], pastHistory: string[] = []): FamilyRisk {
  const entries = [...familyHistory, ...pastHistory.filter(e => FAMILY_ENTRY.test(e))];
  const cancers: FamilyCancerEntry[] = [];
  let lynchNamed = false;
  let brcaNamed = false;
  let diabetesFdr = false;
  for (const entry of entries) {
    // One entry may name several relatives: "sister colon cancer at 48; mother womb cancer at 55".
    for (const part of entry.split(/;|\n/)) {
      const p = part.trim();
      if (!p) continue;
      const second = SECOND_DEGREE.test(p) && !FIRST_DEGREE.test(p);
      const ageM = p.match(/\b(?:at|aged?|age|diagnosed at)\s*(\d{2})\b/i) ?? p.match(/\((?:[a-z\s]+,\s*)?(\d{2})\)/i);
      const ageAtDiagnosis = ageM ? parseInt(ageM[1], 10) : null;
      for (const [cancer, re] of FAMILY_CANCER_PATTERNS) {
        if (affirmed(p, re)) {
          cancers.push({ cancer, firstDegree: !second, ageAtDiagnosis });
          if (cancer === 'advanced-adenoma') break; // "advanced adenoma" is not also colorectal cancer
        }
      }
      if (affirmed(p, /\b(lynch|hnpcc|mlh1|msh2|msh6|pms2|epcam)\b/i)) lynchNamed = true;
      if (affirmed(p, /\b(brca ?[12]?|palb2)\b/i)) brcaNamed = true;
      if (!second && affirmed(p, /\b(diabet\w*|t2dm|t1dm)\b/i) && !/\bgestational\b/i.test(p)) diabetesFdr = true;
    }
  }
  return { cancers, lynchNamed, brcaNamed, diabetesFdr };
}

// ── Personal history ──────────────────────────────────────────────────────────

export interface PersonalRisk {
  lynchCarrier: boolean;
  lynchGene: string | null;
  brcaCarrier: boolean;
  /** Total hysterectomy (cervix removed). Subtotal / supracervical keeps the cervix. */
  totalHysterectomy: boolean;
  cervicalHighGradeHistory: boolean;
  priorColorectalCancer: boolean;
  knownDiabetes: boolean;
  prediabetes: boolean;
  priorGestationalDiabetes: boolean;
  knownHypertension: boolean;
  knownCardiovascularDisease: boolean;
  knownHiv: boolean;
  knownHepatitisB: boolean;
  knownHepatitisC: boolean;
  knownAaa: boolean;
  pcos: boolean;
  /** Last colonoscopy reported normal, and how long ago (null = not stated). */
  normalColonoscopyYearsAgo: number | null;
}

/**
 * Personal risk. Diagnoses (diabetes, hypertension, CVD, BBV) are read from the structured past
 * history only, never from the assessment text ("screen for diabetes" is not a diagnosis).
 * Carrier status, hysterectomy and colonoscopy findings are also read from the notes.
 */
export function readPersonalRisk(pastHistory: string[], notes: string[] = [], age: number | null = null): PersonalRisk {
  const own = pastHistory.filter(e => !FAMILY_ENTRY.test(e));
  const ownText = joinClauses(own);
  const noteSentences = sentences(notes).filter(s => !FAMILY_WORDS.test(s));
  const allText = joinClauses([...own, ...noteSentences]);
  const has = (re: RegExp, text = ownText) => affirmed(text, re);
  const ownEntry = (re: RegExp, exclude?: RegExp) => own.some(e => affirmed(e, re) && !(exclude && exclude.test(e)));

  const LYNCH = /\b(lynch( syndrome)?|hnpcc|mlh1|msh2|msh6|pms2|epcam)\b/i;
  const lynchCarrier = ownEntry(LYNCH, FAMILY_WORDS)
    || noteSentences.some(s => affirmed(s, /\b((lynch syndrome|hnpcc)[^.]{0,25}\b(carrier|mlh1|msh2|msh6|pms2|epcam|confirmed|known)|(mlh1|msh2|msh6|pms2|epcam)[^.]{0,25}\b(carrier|pathogenic|variant))\b/i));
  const geneM = allText.match(/\b(mlh1|msh2|msh6|pms2|epcam)\b/i);
  const BRCA = /\b(brca ?[12]?|palb2)\b[^.]{0,30}\b(carrier|pathogenic|variant|mutation|positive)\b|\b(carrier|pathogenic variant)[^.]{0,20}\b(brca ?[12]?|palb2)\b/i;
  const NOT_CARRIER = /\b(negative|not detected|no (pathogenic )?variant|pending|family|fhx|mother|father|sister|brother|aunt|relative)\b/i;
  const brcaCarrier = ownEntry(/\b(brca ?[12]?|palb2)\b/i, NOT_CARRIER) || noteSentences.some(s => affirmed(s, BRCA) && !NOT_CARRIER.test(s));

  // Sentences about relatives ("Her mother had a hysterectomy") are skipped.
  const hystSentences = sentences([...own, ...notes]).filter(s => !FAMILY_WORDS.test(s) && affirmed(s, /\bhysterectomy\b/i));
  const totalHysterectomy = hystSentences.some(s => !/\b(subtotal|supra-?cervical|partial)\b|cervix (retained|conserved|preserved|left in situ)/i.test(s));

  const colonoscopy = readLastNormalColonoscopy([...own, ...noteSentences], age);

  return {
    lynchCarrier,
    lynchGene: lynchCarrier && geneM ? geneM[1].toUpperCase() : null,
    brcaCarrier,
    totalHysterectomy,
    cervicalHighGradeHistory: has(/\b(cin ?(2|3|ii|iii)|cervical (cancer|carcinoma)|hsil|high[- ]grade (cervical|squamous intraepithelial) (lesion|dysplasia)|adenocarcinoma in situ)\b/i, allText),
    priorColorectalCancer: ownEntry(/\b((colorectal|colon|colonic|rectal|caecal|cecal|sigmoid) (cancer|carcinoma|adenocarcinoma)|crc)\b/i, /\b(screen\w*|family|fhx|risk|suspected|exclude)\b/i),
    knownDiabetes: ownEntry(/\b(diabet\w*|t[12]dm|dm ?(type )?[12]|iddm|niddm)\b/i, /\b(gestational|gdm|pre-?diabet\w*|impaired|borderline|insipidus|screen\w*|family|fhx)\b/i),
    prediabetes: has(/\b(pre-?diabet\w*|impaired fasting (glucose|glycaemia)|impaired glucose tolerance)\b/i),
    priorGestationalDiabetes: has(/\b(gestational diabetes|gdm)\b/i),
    knownHypertension: ownEntry(/\b(hypertension|hypertensive|htn|high blood pressure)\b/i, /\b(pulmonary|portal|intracranial|gestational|pre-?eclampsia|family|fhx)\b/i),
    knownCardiovascularDisease: ownEntry(/\b(myocardial infarction|heart attack|nstemi|stemi|coronary|angina|cabg|pci|coronary stent|stroke|tia|transient ischaemic|peripheral arter\w*|peripheral vascular|ischaemic heart|ihd|cad|cardiovascular disease)\b/i, FAMILY_WORDS),
    knownHiv: ownEntry(/\bhiv\b/i, /\b(screen\w*|test\w*|negative|exposure|pep|prep|family)\b/i),
    knownHepatitisB: ownEntry(/\b(hepatitis b|hep b|hbv|hbsag positive)\b/i, /\b(vaccin\w*|immuni[sz]\w*|immune|screen\w*|family)\b/i),
    knownHepatitisC: ownEntry(/\b(hepatitis c|hep c|hcv)\b/i, /\b(screen\w*|family)\b/i),
    knownAaa: ownEntry(/\b(abdominal aortic aneurysm|aaa|aortic aneurysm)\b/i, FAMILY_WORDS),
    pcos: has(/\b(pcos|polycystic ovar\w*)\b/i),
    normalColonoscopyYearsAgo: colonoscopy,
  };
}

/** Years since a colonoscopy reported normal ("Colonoscopy 4 years ago — normal", "normal colonoscopy at 71"). */
function readLastNormalColonoscopy(texts: string[], age: number | null): number | null {
  for (const s of sentences(texts)) {
    if (!affirmed(s, /\bcolonoscop\w*/i)) continue;
    if (!/\b(normal|clear|no (polyps?|abnormality|pathology))\b/i.test(s)) continue;
    if (/\b(polyp|adenoma|cancer|carcinoma|colitis|diverticul)\w*/i.test(s.replace(/no (polyps?|abnormality|pathology)/gi, ''))) continue;
    const ago = s.match(/(\d{1,2})\s*(?:years?|yrs?)\s*ago/i);
    if (ago) return parseInt(ago[1], 10);
    const atAge = s.match(/\b(?:at|aged?|age)\s*(\d{2})\b/i);
    if (atAge && age !== null) {
      const years = age - parseInt(atAge[1], 10);
      if (years >= 0) return years;
    }
  }
  return null;
}

// ── Post-polypectomy surveillance (US MSTF 2020, Gupta et al.) ────────────────

export type PolypHistology = 'adenoma' | 'serrated' | 'hyperplastic' | 'traditional-serrated' | 'unknown';

export interface PolypFindings {
  count: number | null;
  maxSizeMm: number | null;
  histology: PolypHistology;
  villous: boolean;
  highGradeDysplasia: boolean;
  serratedDysplasia: boolean;
  piecemeal: boolean;
  /** Invasive cancer in a polyp: not a surveillance question (MDT). */
  malignant: boolean;
}

const NON_COLONIC = /\b(gall ?bladder|gastric|stomach|fundic|duoden\w*|nasal|endometri\w*|cervical|uterine|vocal|parathyroid|thyroid|adrenal|pituitary|hepat\w*|liver|pleomorphic|renal|kidney|pancrea\w*|salivary|parotid)\b/i;
const COLONIC = /\b(colon\w*|colorectal|rectal|rectum|sigmoid|caecum|caecal|cecum|cecal|ascending|descending|transverse|hepatic flexure|splenic flexure|polypectomy|emr|endoscopic mucosal resection|tubular|tubulovillous|villous|serrated|hyperplastic)\b/i;

/**
 * Colorectal polyp findings from colonoscopy/histology text. Returns null when no colorectal
 * polyp is documented (non-colonic polyps and adenomas — gallbladder, gastric, parathyroid… — are
 * ignored).
 */
export function parsePolypFindings(texts: string[]): PolypFindings | null {
  const all = sentences(texts);
  // Colorectal context in the sentence itself, or elsewhere in the same record ("Three adenomas,
  // one ≥ 10 mm. … surveillance colonoscopy at 3 years").
  const colonicRecord = all.some(s => COLONIC.test(s) && !NON_COLONIC.test(s));
  const relevant = all.filter(s =>
    affirmed(s, /\b(polyps?|adenomas?|laterally spreading (lesion|tumou?r)|lst)\b/i)
    && (COLONIC.test(s) || colonicRecord) && !NON_COLONIC.test(s)
    && !/villous atrophy/i.test(s));
  if (!relevant.length) return null;
  const text = relevant.join(' ');
  const lower = text.toLowerCase();

  let count: number | null = null;
  const countRe = /\b(\d{1,2}|a|an|one|single|solitary|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:(?:small|diminutive|sessile|pedunculated|flat|tubular|tubulovillous|villous|hyperplastic|serrated|sessile serrated|adenomatous|colonic|rectal|further)\s+){0,3}(polyps?|adenomas?|lesions?)\b/gi;
  for (let m = countRe.exec(lower); m; m = countRe.exec(lower)) {
    const before = lower.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(no|other|further)\s*$/.test(before)) continue;
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUMBERS[m[1]] ?? null;
    if (n !== null) count = Math.max(count ?? 0, n);
  }

  let maxSizeMm: number | null = null;
  const sizeRe = /(<|less than|under|below|up to|≤)?\s*(\d+(?:\.\d+)?)\s*(mm|cm)\b/gi;
  for (let m = sizeRe.exec(text); m; m = sizeRe.exec(text)) {
    let mm = parseFloat(m[2]) * (m[3].toLowerCase() === 'cm' ? 10 : 1);
    if (m[1] && /<|less than|under|below/i.test(m[1])) mm -= 0.1; // "< 10 mm"
    maxSizeMm = Math.max(maxSizeMm ?? 0, mm);
  }

  const villous = /\b(tubulovillous|villous)\b/i.test(text);
  const highGradeDysplasia = affirmed(text, /\bhigh[- ]grade dysplasia\b|\bhgd\b/i);
  const tsa = /\btraditional serrated\b|\btsa\b/i.test(text);
  const ssl = /\bsessile serrated\b|\bssl\b|\bssp\b|\bssa\b/i.test(text);
  const hyperplastic = /\bhyperplastic\b/i.test(text);
  const adenoma = /\b(tubular|tubulovillous|villous|adenoma(tous)?s?)\b/i.test(text);
  const histology: PolypHistology = tsa ? 'traditional-serrated' : ssl ? 'serrated' : adenoma ? 'adenoma' : hyperplastic ? 'hyperplastic' : 'unknown';
  return {
    count,
    maxSizeMm,
    histology,
    villous,
    highGradeDysplasia,
    serratedDysplasia: ssl && affirmed(text, /\bdysplasia\b/i) && !/\bno dysplasia\b/i.test(text),
    piecemeal: affirmed(text, /\bpiecemeal\b/i),
    malignant: affirmed(text, /\b(invasive (cancer|carcinoma|adenocarcinoma)|malignant polyp|adenocarcinoma (in|within) (a |the )?polyp)\b/i),
  };
}

export interface SurveillancePlan {
  /** Plan text, e.g. "Next colonoscopy in 7–10 years". */
  interval: string;
  basis: string;
  /** True when the next colonoscopy is sooner than routine screening (≤ 5 years). */
  earlySurveillance: boolean;
}

/** US MSTF 2020 (Gupta et al., Gastroenterology/GIE/AJG 2020) surveillance interval from findings. */
export function polypSurveillanceInterval(f: PolypFindings): SurveillancePlan {
  const size = f.maxSizeMm;
  const n = f.count;
  if (f.piecemeal && (size === null || size >= 20)) {
    return {
      interval: 'Site-check colonoscopy at 6 months, then 1 year after that, then 3 years later',
      basis: 'piecemeal EMR of a lesion ≥ 20 mm',
      earlySurveillance: true,
    };
  }
  if (f.histology === 'adenoma' || (f.histology === 'unknown' && (f.villous || f.highGradeDysplasia))) {
    if (n !== null && n > 10) return { interval: 'Colonoscopy in 1 year; refer for genetic assessment (> 10 adenomas)', basis: '> 10 adenomas', earlySurveillance: true };
    if ((size !== null && size >= 10) || f.villous || f.highGradeDysplasia) {
      return { interval: 'Next colonoscopy in 3 years', basis: 'adenoma ≥ 10 mm, villous histology or high-grade dysplasia', earlySurveillance: true };
    }
    if (n !== null && n >= 5) return { interval: 'Next colonoscopy in 3 years', basis: '5–10 adenomas < 10 mm', earlySurveillance: true };
    if (n !== null && n >= 3) return { interval: 'Next colonoscopy in 3–5 years', basis: '3–4 tubular adenomas < 10 mm', earlySurveillance: true };
    if (n !== null && size !== null) {
      return { interval: 'Next colonoscopy in 7–10 years — no early surveillance colonoscopy needed', basis: '1–2 tubular adenomas < 10 mm', earlySurveillance: false };
    }
  }
  if (f.histology === 'traditional-serrated') return { interval: 'Next colonoscopy in 3 years', basis: 'traditional serrated adenoma', earlySurveillance: true };
  if (f.histology === 'serrated') {
    if ((size !== null && size >= 10) || f.serratedDysplasia) return { interval: 'Next colonoscopy in 3 years', basis: 'sessile serrated lesion ≥ 10 mm or with dysplasia', earlySurveillance: true };
    if (n !== null && n >= 5) return { interval: 'Next colonoscopy in 3 years', basis: '5–10 sessile serrated lesions < 10 mm', earlySurveillance: true };
    if (n !== null && n >= 3) return { interval: 'Next colonoscopy in 3–5 years', basis: '3–4 sessile serrated lesions < 10 mm', earlySurveillance: true };
    if (n !== null && size !== null) return { interval: 'Next colonoscopy in 5–10 years', basis: '1–2 sessile serrated lesions < 10 mm', earlySurveillance: false };
  }
  if (f.histology === 'hyperplastic' && size !== null) {
    if (size >= 10) return { interval: 'Next colonoscopy in 3–5 years', basis: 'hyperplastic polyp ≥ 10 mm', earlySurveillance: true };
    return { interval: 'Return to routine screening: next colonoscopy in 10 years', basis: 'hyperplastic polyps < 10 mm', earlySurveillance: false };
  }
  return {
    interval: 'Surveillance interval per the colonoscopy and histology report (number, size, histology, completeness of resection)',
    basis: 'findings not fully documented — US MSTF 2020 table',
    earlySurveillance: false,
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

function hasResult(names: string[] | undefined, re: RegExp): boolean {
  return (names ?? []).some(n => re.test(n));
}

/**
 * Screening and surveillance due for this patient. Returns [] when age is unknown or in an
 * emergency encounter.
 */
export function preventiveScreeningItems(input: PreventiveScreeningInput): PreventiveItem[] {
  const age = input.age;
  if (age === null || !Number.isFinite(age) || age < 0) return [];
  if (input.setting === 'emergency') return [];

  const female = input.sex === 'female';
  const male = input.sex === 'male';
  const notes = input.notes ?? [];
  const personal = readPersonalRisk(input.pastHistory, notes, age);
  const family = readFamilyRisk(input.familyHistory, input.pastHistory);
  const smoking = readSmoking([...(input.toxicHabits ?? []), ...input.pastHistory.filter(e => !FAMILY_ENTRY.test(e))]);
  const bmi = input.bmi ?? readBmi([...input.pastHistory, ...notes]);
  const pregnancyNote = input.pregnancyPossible ? ' Confirm not pregnant first (defer ionising imaging in pregnancy).' : '';
  const out: PreventiveItem[] = [];
  const add = (item: PreventiveItem) => { if (!out.some(x => x.id === item.id)) out.push(item); };

  // ── Colorectal ─────────────────────────────────────────────────────────────
  const crcRelatives = family.cancers.filter(c => (c.cancer === 'colorectal' || c.cancer === 'advanced-adenoma') && c.firstDegree);
  const crcAny = family.cancers.filter(c => c.cancer === 'colorectal');
  const lynchSpectrum = family.cancers.filter(c => ['colorectal', 'endometrial', 'ovarian', 'gastric', 'other-lynch'].includes(c.cancer));
  const youngestCrc = crcRelatives.reduce<number | null>((m, c) => (c.ageAtDiagnosis === null ? m : m === null ? c.ageAtDiagnosis : Math.min(m, c.ageAtDiagnosis)), null);
  // NCCN 2024 / revised Bethesda: CRC in a relative < 50, ≥ 2 Lynch-spectrum cancers in the family
  // (at least one colorectal or endometrial), or Lynch named in a relative → genetics assessment.
  const lynchFamilyFeatures = family.lynchNamed
    || crcAny.some(c => c.ageAtDiagnosis !== null && c.ageAtDiagnosis < 50)
    || (lynchSpectrum.length >= 2 && lynchSpectrum.some(c => c.cancer === 'colorectal' || c.cancer === 'endometrial'));
  // The patient's own polyps only: sentences about relatives ("father had colon polyps") are skipped.
  const polyps = parsePolypFindings(
    sentences([...input.pastHistory.filter(e => !FAMILY_ENTRY.test(e)), ...notes]).filter(s => !FAMILY_WORDS.test(s)),
  );

  if (age >= 18 && !personal.priorColorectalCancer) {
    if (personal.lynchCarrier) {
      // BSG/ACPGBI/UKCGG 2019 (Monahan, Gut 2020): 2-yearly colonoscopy from 25 (MLH1, MSH2) or
      // 35 (MSH6, PMS2). NCCN 2024: every 1–2 years from 20–25 (MLH1/MSH2/EPCAM), 30–35 (MSH6/PMS2).
      // Aspirin: NICE NG151 (2020) / CAPP2 — dose is the clinician's decision (not stated here).
      const gene = personal.lynchGene;
      const lateGene = gene === 'MSH6' || gene === 'PMS2';
      const startAge = lateGene ? 35 : 25;
      const actions: PreventiveAction[] = [];
      if (age >= startAge) {
        actions.push({ text: 'Surveillance colonoscopy (every 2 years)', investigation: 'Colonoscopy', plan: '• Lynch syndrome surveillance: colonoscopy every 2 years (BSG/ACPGBI/UKCGG 2019) — book now if the last one was more than 2 years ago.' });
      }
      actions.push({ text: 'Discuss daily aspirin for cancer prevention (NICE NG151; CAPP2) — dose and bleeding risk per clinician', plan: '• Aspirin chemoprevention discussed (Lynch syndrome, NICE NG151).' });
      if (female) actions.push({ text: 'Endometrial / ovarian cancer risk — gynaecology review', plan: '• Refer gynaecology — Lynch syndrome endometrial/ovarian risk management (NCCN 2024).' });
      actions.push({ text: 'Hereditary cancer (genetics) service follow-up; cascade testing of relatives', plan: '• Clinical genetics / hereditary cancer service follow-up — cascade testing of relatives.' });
      add({
        id: 'screen_crc_lynch', topic: 'colorectal', priority: 'priority', highRisk: true,
        title: `Lynch syndrome${gene ? ` (${gene})` : ''} — colonoscopy every 2 years`,
        finding: `Lynch syndrome carrier${gene ? ` (${gene})` : ''} — hereditary colorectal cancer risk`,
        rationale: `Colonoscopy every 2 years from age ${startAge}${lateGene ? '' : ' (MLH1/MSH2/EPCAM)'}; ${age < startAge ? `due from age ${startAge}` : 'confirm the date of the last colonoscopy — surveillance is overdue if more than 2 years ago'}.${female ? ' Endometrial and ovarian risk to be addressed with gynaecology.' : ''} Aspirin for cancer prevention to be discussed.`,
        guideline: 'BSG/ACPGBI/UKCGG 2019; NCCN 2024; NICE NG151 2020',
        actions,
        followUpDays: 30,
      });
    } else if (polyps && !polyps.malignant) {
      const s = polypSurveillanceInterval(polyps);
      add({
        id: 'screen_crc_polyp_surveillance', topic: 'colorectal', priority: s.earlySurveillance ? 'priority' : 'routine', highRisk: s.earlySurveillance,
        title: `Post-polypectomy surveillance — ${s.interval}`,
        finding: `Colorectal polyps removed: ${s.basis}`,
        rationale: `US Multi-Society Task Force 2020 post-polypectomy intervals: ${s.interval.toLowerCase()} (${s.basis}).${age >= 76 ? ' Age 76 or over: continue surveillance only if health and life expectancy justify it.' : ''}`,
        guideline: 'US MSTF 2020',
        actions: [
          { text: s.interval, plan: `• Post-polypectomy surveillance: ${s.interval} (US MSTF 2020 — ${s.basis}).` },
        ],
      });
    } else {
      const fdrCount = crcRelatives.length;
      const increasedRisk = fdrCount >= 2 || crcRelatives.some(c => c.ageAtDiagnosis === null || c.ageAtDiagnosis < 60);
      if (fdrCount > 0) {
        // ACG 2021 (Shaukat) / US MSTF 2017 (Rex): one FDR with CRC or advanced adenoma < 60, or
        // ≥ 2 FDRs at any age → colonoscopy from 40, or 10 years before the youngest affected
        // relative, every 5 years. One FDR ≥ 60 → start at 40 with average-risk options/intervals.
        const startAge = Math.min(40, youngestCrc !== null ? youngestCrc - 10 : 40);
        const ageUnknown = crcRelatives.some(c => c.ageAtDiagnosis === null);
        const detail = increasedRisk
          ? `colonoscopy from age ${startAge} (40, or 10 years before the youngest affected relative), repeated every 5 years${ageUnknown ? ' — if the relative was diagnosed at 60 or over, start at 40 with average-risk intervals' : ''}`
          : 'start at 40 with average-risk options and intervals (FIT every year or colonoscopy every 10 years)';
        const riskLabel = increasedRisk ? 'Increased-risk family history' : 'One first-degree relative diagnosed at 60 or over';
        if (age > 75) {
          // Handled by the 76–85 individualised item below.
        } else if (age >= startAge) {
          add({
            id: 'screen_crc_family_history', topic: 'colorectal', priority: 'priority', highRisk: true,
            title: `${increasedRisk ? "Colonoscopy" : "Colorectal screening from 40"} — family history of colorectal cancer (${fdrCount} first-degree relative${fdrCount > 1 ? "s" : ""})`,
            finding: `First-degree family history of colorectal cancer${youngestCrc !== null ? ` (youngest at ${youngestCrc})` : ''}`,
            rationale: `${riskLabel}: ${detail}.`,
            guideline: 'ACG 2021; US MSTF 2017',
            actions: [
              { text: `Colonoscopy — ${increasedRisk ? 'every 5 years' : 'from 40, average-risk interval'}`, investigation: increasedRisk ? 'Colonoscopy' : undefined, plan: `• Colorectal screening (family history): ${detail} (ACG 2021).` },
            ],
            followUpDays: 30,
          });
        } else {
          add({
            id: 'screen_crc_family_history', topic: 'colorectal', priority: 'routine', highRisk: true,
            title: `Colorectal screening due from age ${startAge} (family history)`,
            finding: 'First-degree family history of colorectal cancer',
            rationale: `${riskLabel}: ${detail}.`,
            guideline: 'ACG 2021; US MSTF 2017',
            actions: [{ text: `Plan colonoscopy from age ${startAge}`, plan: `• Family history of colorectal cancer: colonoscopy from age ${startAge} (ACG 2021).` }],
          });
        }
      }
      if (lynchFamilyFeatures) {
        add({
          id: 'screen_crc_lynch_genetics', topic: 'colorectal', priority: 'priority', highRisk: true,
          title: 'Family history suggests Lynch syndrome — genetics referral',
          finding: 'Family history with Lynch features (colorectal cancer < 50, or several Lynch-spectrum cancers)',
          rationale: 'Colorectal cancer in a relative under 50, or colorectal/endometrial with other Lynch-spectrum cancers in the family: request the affected relative\'s tumour mismatch repair (MMR/MSI) result and refer for clinical genetics assessment (germline testing).',
          guideline: 'NCCN 2024 (Genetic/Familial High-Risk Assessment: Colorectal); revised Bethesda criteria',
          actions: [
            { text: 'Request the relative\'s tumour MMR immunohistochemistry / MSI result', plan: '• Request affected relative\'s tumour mismatch repair (MMR/MSI) result — Lynch syndrome assessment.' },
            { text: 'Refer clinical genetics — Lynch syndrome assessment', plan: '• Refer clinical genetics — suspected Lynch syndrome family (NCCN 2024).' },
          ],
          followUpDays: 90,
        });
      }
      {
        if (fdrCount === 0 && age >= 45 && age <= 75) {
          const upToDate = personal.normalColonoscopyYearsAgo !== null && personal.normalColonoscopyYearsAgo < 10;
          add({
            id: 'screen_crc_average', topic: 'colorectal', priority: 'routine', highRisk: false,
            title: upToDate
              ? `Colorectal screening up to date — normal colonoscopy ${personal.normalColonoscopyYearsAgo} years ago`
              : 'Colorectal cancer screening — FIT every year or colonoscopy every 10 years',
            finding: `Age ${age} — average risk`,
            rationale: upToDate
              ? `Normal colonoscopy ${personal.normalColonoscopyYearsAgo} years ago: next screening colonoscopy due 10 years after it (USPSTF 2021).`
              : `USPSTF 2021: screen adults 45–75 (grade ${age < 50 ? 'B' : 'A'}). Options: FIT every year, or colonoscopy every 10 years (also FIT-DNA every 1–3 years, CT colonography or flexible sigmoidoscopy every 5 years).`,
            guideline: 'USPSTF 2021; ACG 2021',
            actions: upToDate
              ? [{ text: 'Record the date of the next screening colonoscopy', plan: `• Colorectal screening up to date (normal colonoscopy ${personal.normalColonoscopyYearsAgo} years ago) — next due at 10 years (USPSTF 2021).` }]
              : [
                  { text: 'Discuss options: FIT every year, or colonoscopy every 10 years', plan: '• Colorectal cancer screening offered (USPSTF 2021, age 45–75): FIT every year or colonoscopy every 10 years — choice documented.' },
                ],
            followUpDays: upToDate ? undefined : 30,
          });
        } else if (age >= 76 && age <= 85) {
          // USPSTF 2021 grade C: selectively offer at 76–85; no routine screening over 85.
          add({
            id: 'screen_crc_individualised', topic: 'colorectal', priority: 'routine', highRisk: false,
            title: 'Colorectal screening at 76–85 — individualised decision',
            finding: `Age ${age}`,
            rationale: 'USPSTF 2021 (grade C): at 76–85 screening is selective — weigh overall health, life expectancy, prior screening results and the patient\'s preference. Not recommended over 85.',
            guideline: 'USPSTF 2021',
            actions: [{ text: 'Discuss whether further screening is worthwhile', plan: '• Colorectal screening at 76–85: individualised decision (overall health, life expectancy, prior screening) — USPSTF 2021 grade C.' }],
          });
        }
      }
    }
  }

  // ── Breast ─────────────────────────────────────────────────────────────────
  if (female && age >= 18) {
    const breastFamily = family.cancers.some(c => c.cancer === 'breast' || c.cancer === 'ovarian') || family.brcaNamed;
    if (personal.brcaCarrier) {
      // NCCN 2024 (Genetic/Familial High-Risk Assessment: Breast, Ovarian, Pancreatic) and ACR 2023:
      // annual breast MRI from 25; annual mammography added from 30 (to 75). Risk-reducing surgery:
      // discuss RRM; RRSO at 35–40 (BRCA1) or 40–45 (BRCA2) once childbearing is complete.
      add({
        id: 'screen_breast_high_risk', topic: 'breast', priority: 'priority', highRisk: true,
        title: 'BRCA carrier — annual breast MRI and high-risk service',
        finding: 'Pathogenic BRCA variant carrier',
        rationale: `High-risk surveillance: annual breast MRI from 25${age >= 30 ? ', with annual mammography from 30' : ' (annual mammography added from 30)'}. Discuss risk-reducing mastectomy and risk-reducing salpingo-oophorectomy (RRSO 35–40 for BRCA1, 40–45 for BRCA2, after childbearing). Refer to the high-risk / family history service.`,
        guideline: 'NCCN 2024; ACR 2023',
        actions: [
          ...(age >= 25 ? [{ text: 'Annual breast MRI (contrast-enhanced)', investigation: 'MRI breast (annual high-risk screening)', plan: '• Annual breast MRI — BRCA carrier high-risk surveillance (NCCN 2024 / ACR 2023).' }] : []),
          ...(age >= 30 && age <= 75 ? [{ text: 'Annual mammography (from 30)', plan: '• Annual mammography from 30 — BRCA carrier (NCCN 2024).' }] : []),
          { text: 'Discuss risk-reducing mastectomy and risk-reducing salpingo-oophorectomy', plan: '• Discuss risk-reducing mastectomy and risk-reducing salpingo-oophorectomy (NCCN 2024).' },
          { text: 'Refer high-risk breast / clinical genetics (family history) service', plan: '• Refer high-risk breast / clinical genetics service — BRCA carrier.' },
        ],
        followUpDays: 60,
      });
    } else if (breastFamily && age >= 25) {
      // USPSTF 2019 (BRCA-related cancer): familial risk assessment tool, genetic counselling if
      // positive. ACR 2023: annual MRI (from 25–30) and mammography (from 30) if lifetime risk ≥ 20%.
      add({
        id: 'screen_breast_family_history', topic: 'breast', priority: 'priority', highRisk: true,
        title: 'Family history of breast / ovarian cancer — risk assessment and genetic counselling',
        finding: `Family history of breast or ovarian cancer${family.brcaNamed ? ' (BRCA variant in the family)' : ''}`,
        rationale: 'USPSTF 2019: use a familial risk assessment tool (e.g. Ontario FHAT, Manchester score, Pedigree Assessment Tool) and refer for genetic counselling if positive. If the estimated lifetime breast cancer risk is ≥ 20%, annual MRI plus mammography from 30 (ACR 2023).',
        guideline: 'USPSTF 2019; ACR 2023',
        actions: [
          { text: 'Familial risk assessment tool', plan: '• Familial breast/ovarian risk assessment (e.g. Manchester score / Ontario FHAT) — USPSTF 2019.' },
          { text: 'Genetic counselling if the risk tool is positive', plan: '• Refer clinical genetics (genetic counselling) if familial risk assessment positive — USPSTF 2019.' },
          { text: 'Enhanced imaging if lifetime risk ≥ 20% (annual MRI + mammography from 30)', plan: '• If lifetime breast cancer risk ≥ 20%: annual breast MRI + mammography from 30 (ACR 2023).' },
        ],
        followUpDays: 90,
      });
    }
    if (!personal.brcaCarrier && age >= 40 && age <= 74) {
      // USPSTF 2024 (grade B): biennial screening mammography 40–74.
      add({
        id: 'screen_breast', topic: 'breast', priority: 'routine', highRisk: false,
        title: 'Screening mammogram every 2 years (age 40–74)',
        finding: `${age}-year-old woman`,
        rationale: `USPSTF 2024 (grade B): biennial screening mammography from 40 to 74. Confirm the date of the last mammogram; due if more than 2 years ago.${input.pregnancyPossible ? ' Defer screening mammography during pregnancy.' : ''}`,
        guideline: 'USPSTF 2024',
        actions: [
          { text: 'Confirm date of last mammogram', plan: '• Document date of last screening mammogram.' },
          { text: 'Arrange screening mammogram if due (every 2 years)', plan: '• Screening mammogram every 2 years (biennial, USPSTF 2024, age 40–74).' },
        ],
      });
    }
  }

  // ── Cervical ───────────────────────────────────────────────────────────────
  // USPSTF 2018: cytology every 3 years at 21–29; at 30–65 primary hrHPV every 5 years (or
  // co-testing every 5, or cytology every 3). WHO 2021: HPV DNA primary screening from 30 (from 25,
  // every 3–5 years, for women living with HIV). Not after total hysterectomy for benign disease
  // without CIN2+ history (USPSTF grade D); not over 65 after adequate negative screening (grade D).
  if (female && age >= 21 && age <= 65 && !(personal.totalHysterectomy && !personal.cervicalHighGradeHistory)) {
    const hpv = age >= 30 || (personal.knownHiv && age >= 25);
    add({
      id: 'screen_cervical', topic: 'cervical', priority: 'routine', highRisk: personal.knownHiv || personal.cervicalHighGradeHistory,
      title: hpv ? 'Cervical screening — primary HPV test every 5 years' : 'Cervical screening — cytology every 3 years',
      finding: `${age}-year-old woman${personal.totalHysterectomy ? ' (hysterectomy with CIN2+ history — screening continues)' : ''}`,
      rationale: hpv
        ? `Primary high-risk HPV test every 5 years (USPSTF 2018, age 30–65; WHO 2021). Co-testing every 5 years or cytology every 3 years if HPV testing is not available.${personal.knownHiv ? ' Living with HIV: every 3 years from 25 (WHO 2021).' : ''}`
        : 'Cervical cytology every 3 years at 21–29 (USPSTF 2018).',
      guideline: 'USPSTF 2018; WHO 2021',
      actions: [
        { text: 'Confirm date and result of the last cervical screen', plan: '• Document date and result of last cervical screening test.' },
        hpv
          ? { text: 'Primary HPV test (clinician- or self-collected) if due', investigation: 'HPV test (primary high-risk HPV)', plan: '• Cervical screening: primary HPV test every 5 years (USPSTF 2018 / WHO 2021); cytology every 3 years if HPV testing unavailable.' }
          : { text: 'Cervical cytology if due', investigation: 'Cervical cytology', plan: '• Cervical screening: cytology every 3 years (USPSTF 2018, age 21–29).' },
      ],
    });
  }

  // ── Prostate ───────────────────────────────────────────────────────────────
  // USPSTF 2018: 55–69 individual decision after discussing benefits and harms (grade C); ≥ 70 do
  // not screen (grade D). Higher risk (family history of prostate cancer, BRCA): American Cancer
  // Society 2023 suggests the discussion from 45 — earlier start needs the surgeon's sign-off.
  if (male) {
    const prostateFamily = family.cancers.some(c => c.cancer === 'prostate' && c.firstDegree) || family.brcaNamed || personal.brcaCarrier;
    const start = prostateFamily ? 45 : 55;
    if (age >= start && age <= 69) {
      add({
        id: 'screen_prostate', topic: 'prostate', priority: 'routine', highRisk: prostateFamily,
        title: 'PSA screening — shared decision (age 55–69)',
        finding: `${age}-year-old man${prostateFamily ? ' — higher risk (family history / BRCA)' : ''}`,
        rationale: `USPSTF 2018 (grade C): at 55–69 the decision to have PSA screening is individual — discuss the small reduction in prostate cancer deaths against false positives, biopsy, overdiagnosis and treatment effects. Men of African-Caribbean ancestry and men with a family history are at higher risk.${prostateFamily && age < 55 ? ' Discussion from 45 for higher risk (American Cancer Society 2023).' : ''} Not recommended from 70.`,
        guideline: prostateFamily && age < 55 ? 'USPSTF 2018; ACS 2023' : 'USPSTF 2018',
        actions: [
          { text: 'Shared decision-making: benefits and harms of PSA screening', plan: '• PSA screening discussed (USPSTF 2018): benefits and harms explained; patient\'s informed decision documented.' },
          { text: 'Order a PSA only if the patient chooses screening after the discussion' },
        ],
      });
    }
  }

  // ── Abdominal aortic aneurysm ──────────────────────────────────────────────
  // USPSTF 2019 (grade B): one-time ultrasound for men 65–75 who have ever smoked.
  if (male && age >= 65 && age <= 75 && (smoking.status === 'current' || smoking.status === 'former') && !personal.knownAaa) {
    add({
      id: 'screen_aaa', topic: 'aaa', priority: 'routine', highRisk: false,
      title: 'One-time abdominal aortic ultrasound (AAA screening)',
      finding: `Man aged ${age} who has smoked`,
      rationale: 'USPSTF 2019 (grade B): one-time ultrasound screening for abdominal aortic aneurysm in men 65–75 who have ever smoked.',
      guideline: 'USPSTF 2019',
      actions: [{ text: 'Abdominal aortic ultrasound (once)', plan: '• One-time abdominal aortic ultrasound — AAA screening (USPSTF 2019: men 65–75 who have ever smoked).' }],
    });
  }

  // ── Lung ───────────────────────────────────────────────────────────────────
  // USPSTF 2021 (grade B): annual LDCT at 50–80 with ≥ 20 pack-years, current smoker or quit
  // within 15 years. Unknown pack-years / quit date: prompt to document them.
  if (age >= 50 && age <= 80 && (smoking.status === 'current' || smoking.status === 'former')) {
    const pyOk = smoking.packYears === null || smoking.packYears >= 20;
    const quitOk = smoking.status === 'current' || smoking.yearsSinceQuit === null || smoking.yearsSinceQuit <= 15;
    if (pyOk && quitOk) {
      add({
        id: 'screen_lung_ldct', topic: 'lung', priority: 'routine', highRisk: true,
        title: 'Lung cancer screening — annual low-dose CT chest',
        finding: `Age ${age}, ${smoking.status === 'current' ? 'current smoker' : 'former smoker'}${smoking.packYears !== null ? `, ${smoking.packYears} pack-years` : ''}`,
        rationale: `USPSTF 2021 (grade B): annual low-dose CT at 50–80 with ≥ 20 pack-years who smoke now or quit within 15 years, after a shared decision-making discussion.${pregnancyNote}`,
        guideline: 'USPSTF 2021',
        actions: [
          { text: 'Confirm pack-years (≥ 20) and years since quitting (≤ 15)', plan: '• Document pack-years and years since quitting — LDCT eligibility (USPSTF 2021).' },
          { text: 'Annual low-dose CT chest after shared decision-making', plan: '• Annual low-dose CT chest — lung cancer screening (USPSTF 2021: age 50–80, ≥ 20 pack-years, smoking now or quit within 15 years).' },
        ],
      });
    }
  }

  // ── Tobacco ────────────────────────────────────────────────────────────────
  // USPSTF 2021 (grade A): advise stopping; behavioural support + pharmacotherapy for non-pregnant
  // adults; behavioural support in pregnancy (pharmacotherapy evidence insufficient).
  if (age >= 18 && smoking.status === 'current') {
    add({
      id: 'screen_tobacco_cessation', topic: 'tobacco', priority: 'routine', highRisk: true,
      title: 'Smoking cessation — advice, support and pharmacotherapy',
      finding: 'Current smoker',
      rationale: input.pregnancyPossible
        ? 'USPSTF 2021: advise stopping and offer behavioural support; in pregnancy behavioural interventions are recommended (evidence for pharmacotherapy is insufficient).'
        : 'USPSTF 2021 (grade A): advise stopping; offer behavioural support and pharmacotherapy (nicotine replacement, varenicline or bupropion).',
      guideline: 'USPSTF 2021',
      actions: [{ text: 'Smoking cessation advice and support', plan: '• Smoking cessation: advice given; behavioural support and pharmacotherapy offered (USPSTF 2021).' }],
    });
  }

  // ── Blood-borne viruses ────────────────────────────────────────────────────
  // HCV: USPSTF 2020 (grade B) once at 18–79. HBV: CDC 2023 once for all adults ≥ 18 with the
  // triple panel (USPSTF 2020 recommends risk-based screening; the universal CDC option is used —
  // needs sign-off). HIV: USPSTF 2019 (grade A) at 15–65, and all pregnant women.
  {
    const bbv: PreventiveAction[] = [];
    const viruses: string[] = [];
    if (age >= 18 && age <= 79 && !personal.knownHepatitisC) {
      viruses.push('hepatitis C');
      bbv.push({ text: 'Hepatitis C antibody (once in adulthood, USPSTF 2020)', investigation: 'Hepatitis C Antibody' });
    }
    if (age >= 18 && !personal.knownHepatitisB) {
      viruses.push('hepatitis B');
      bbv.push({ text: 'Hepatitis B triple panel: HBsAg, anti-HBs, total anti-HBc (once, CDC 2023)', investigation: 'HBsAg (Hepatitis B)' });
      bbv.push({ text: 'Anti-HBs and total anti-HBc', investigation: 'Anti-HBs + total anti-HBc' });
    }
    if (((age >= 15 && age <= 65) || input.pregnancyPossible) && !personal.knownHiv) {
      viruses.push('HIV');
      bbv.push({ text: 'HIV test (at least once, USPSTF 2019)', investigation: 'HIV Combo (4th gen)' });
    }
    if (bbv.length) {
      if (age >= 18 && !personal.knownHepatitisB && age <= 59) {
        bbv.push({ text: 'Hepatitis B vaccination if not immune (ACIP 2022: adults 19–59)', plan: '• Hepatitis B vaccination if serology shows no immunity (ACIP 2022).' });
      }
      add({
        id: 'screen_bbv', topic: 'bbv', priority: 'routine', highRisk: false,
        title: `Blood-borne virus screening — ${viruses.join(', ')} (once in adulthood)`,
        finding: `Age ${age} — confirm whether already tested`,
        rationale: `Once-in-adulthood screening unless already done: ${[
          viruses.includes('hepatitis C') ? 'hepatitis C antibody (USPSTF 2020, 18–79)' : '',
          viruses.includes('hepatitis B') ? 'hepatitis B triple panel (CDC 2023, all adults)' : '',
          viruses.includes('HIV') ? 'HIV (USPSTF 2019, 15–65 and in pregnancy)' : '',
        ].filter(Boolean).join('; ')}. Repeat if risk continues.`,
        guideline: 'USPSTF 2020; CDC 2023; USPSTF 2019',
        actions: bbv,
        followUpDays: 14,
      });
    }
  }

  // ── Diabetes ───────────────────────────────────────────────────────────────
  // ADA Standards of Care 2024 §2: test all adults from 35; earlier with BMI ≥ 25 plus a risk
  // factor (first-degree relative, hypertension, CVD, PCOS, HIV, high-risk ethnicity); women with
  // previous gestational diabetes lifelong at least every 3 years; prediabetes yearly; else every
  // 3 years.
  const glycaemicOnFile = hasResult(input.resultNames, /hba1c|glycated|glucose|\bfbg\b|\bfpg\b|ogtt/i);
  if (age >= 18 && !personal.knownDiabetes && !glycaemicOnFile) {
    const riskFactor = family.diabetesFdr || personal.knownHypertension || personal.knownCardiovascularDisease || personal.pcos || personal.knownHiv;
    const overweight = bmi !== null && bmi >= 25;
    const reasons: string[] = [];
    if (age >= 35) reasons.push(`age ${age}`);
    if (overweight && riskFactor) reasons.push(`BMI ${bmi !== null && bmi >= 30 ? '≥ 30' : '≥ 25'} with a risk factor`);
    if (personal.priorGestationalDiabetes) reasons.push('previous gestational diabetes');
    if (personal.prediabetes) reasons.push('prediabetes (test yearly)');
    if (reasons.length) {
      add({
        id: 'screen_diabetes', topic: 'diabetes', priority: 'routine', highRisk: age < 35,
        title: 'Diabetes screening — HbA1c or fasting plasma glucose',
        finding: `Diabetes screening: ${reasons.join(', ')}`,
        rationale: 'ADA Standards of Care 2024: screen all adults from 35, and earlier with overweight/obesity plus a risk factor or previous gestational diabetes. Repeat every 3 years if normal (yearly with prediabetes).',
        guideline: 'ADA 2024',
        actions: [
          { text: 'HbA1c (or fasting plasma glucose)', investigation: 'HbA1c' },
          { text: 'Repeat every 3 years if normal; yearly if prediabetes', plan: '• Diabetes screening (ADA 2024): HbA1c or fasting glucose; repeat every 3 years if normal, yearly if prediabetes.' },
        ],
        followUpDays: 14,
      });
    }
  }

  // ── Blood pressure ─────────────────────────────────────────────────────────
  // USPSTF 2021 (grade A): screen adults with office BP and confirm outside the clinic before
  // diagnosis. NICE NG136 (2019, updated 2023): clinic BP 140/90–179/119 → ABPM (HBPM if ABPM
  // unsuitable), target-organ assessment (urine ACR, U&E/eGFR, HbA1c, lipids, ECG, fundi) and CV
  // risk. ≥ 180/120 is handled by the hypertensive-urgency prompts, not here.
  const sbp = input.systolicBp ?? null;
  const dbp = input.diastolicBp ?? null;
  const raised = (sbp !== null && sbp >= 140 && sbp < 180) || (dbp !== null && dbp >= 90 && dbp < 120);
  const severe = (sbp !== null && sbp >= 180) || (dbp !== null && dbp >= 120);
  if (age >= 18 && raised && !severe && !personal.knownHypertension) {
    add({
      id: 'screen_bp_confirm', topic: 'blood-pressure', priority: 'routine', highRisk: false,
      title: `Raised clinic BP ${sbp ?? '—'}/${dbp ?? '—'} — confirm with ambulatory or home BP monitoring`,
      finding: `Clinic BP ${sbp ?? '—'}/${dbp ?? '—'} mmHg, no hypertension on record`,
      rationale: `Confirm outside the clinic before diagnosing hypertension (USPSTF 2021; NICE NG136): ambulatory BP monitoring (ABPM), or home BP monitoring (HBPM) if ABPM is unsuitable. Assess target-organ damage and 10-year cardiovascular risk.${input.pregnancyPossible ? ' If pregnant, use the pregnancy hypertension pathway (NICE NG133) instead.' : ''}`,
      guideline: 'USPSTF 2021; NICE NG136',
      actions: [
        { text: 'Ambulatory BP monitoring (or home BP monitoring)', plan: '• Confirm hypertension with ambulatory BP monitoring (ABPM) or home BP monitoring (HBPM) — NICE NG136.' },
        {
          text: 'Urine albumin:creatinine ratio',
          investigation: 'Urine Albumin:Creatinine Ratio',
          plan: '• Target-organ and risk assessment (NICE NG136): urine albumin:creatinine ratio, U&E/eGFR, HbA1c, lipid profile, 12-lead ECG, fundoscopy.',
        },
        { text: 'U&E / eGFR', investigation: 'Urea & Electrolytes (U&E)' },
        { text: 'HbA1c, lipid profile, ECG and fundoscopy' },
        // Age 40–75 without CVD: the 10-year risk line comes from the cardiovascular-risk item below.
        ...(age >= 40 && age <= 75 && !personal.knownCardiovascularDisease ? [] : [
          { text: 'Estimate 10-year cardiovascular risk (Pooled Cohort Equations / QRISK3)', plan: '• Estimate 10-year cardiovascular risk (ASCVD Pooled Cohort Equations or QRISK3).' },
        ]),
      ],
      followUpDays: 14,
    });
  }

  // ── Cardiovascular risk / lipids ───────────────────────────────────────────
  // USPSTF 2022: adults 40–75 without CVD — estimate 10-year risk (Pooled Cohort Equations);
  // statin if ≥ 1 risk factor and 10-year risk ≥ 10% (grade B), selectively at 7.5–10% (grade C).
  if (age >= 40 && age <= 75 && !personal.knownCardiovascularDisease) {
    const lipidsOnFile = hasResult(input.resultNames, /lipid|cholesterol|\bldl\b|\bhdl\b|triglycer/i);
    add({
      id: 'screen_cv_risk', topic: 'cardiovascular', priority: 'routine', highRisk: smoking.status === 'current',
      title: 'Cardiovascular risk — lipid profile and 10-year risk estimate',
      finding: `Age ${age}, no cardiovascular disease on record`,
      rationale: 'USPSTF 2022: estimate 10-year cardiovascular (ASCVD) risk with the Pooled Cohort Equations; discuss a statin if ≥ 1 risk factor (dyslipidaemia, diabetes, hypertension, smoking) and 10-year risk ≥ 10%.',
      guideline: 'USPSTF 2022; ACC/AHA 2019',
      actions: [
        ...(lipidsOnFile ? [] : [{ text: 'Lipid profile', investigation: 'Lipid Profile' }]),
        { text: 'Calculate 10-year cardiovascular risk', plan: '• Calculate 10-year cardiovascular (ASCVD) risk — statin discussion if ≥ 10% with a risk factor (USPSTF 2022).' },
      ],
    });
  }

  // ── Gastric: H. pylori in first-degree relatives of gastric cancer ─────────
  // Maastricht VI/Florence consensus 2022; ACG 2024 H. pylori guideline: test-and-treat first-degree
  // relatives of people with gastric cancer; confirm eradication.
  if (age >= 18 && family.cancers.some(c => c.cancer === 'gastric' && c.firstDegree)) {
    add({
      id: 'screen_hpylori_gastric_fdr', topic: 'gastric', priority: 'routine', highRisk: true,
      title: 'H. pylori test-and-treat — first-degree relative with gastric cancer',
      finding: 'First-degree relative with gastric cancer',
      rationale: 'Maastricht VI/Florence 2022 and ACG 2024: test first-degree relatives of gastric cancer patients for H. pylori with a non-invasive test (urea breath test or stool antigen, off PPI for 2 weeks); eradicate if positive and confirm eradication. Alarm symptoms need endoscopy instead.',
      guideline: 'Maastricht VI/Florence 2022; ACG 2024',
      actions: [
        { text: 'H. pylori stool antigen or urea breath test (off PPI 2 weeks)', investigation: 'H. pylori Antigen' },
        { text: 'Eradicate if positive and confirm eradication', plan: '• H. pylori test-and-treat (FDR gastric cancer): eradicate if positive, then test to confirm eradication (Maastricht VI 2022).' },
      ],
      followUpDays: 21,
    });
  }

  // ── Osteoporosis ───────────────────────────────────────────────────────────
  // USPSTF 2018 (grade B): bone density testing for women ≥ 65 (and younger post-menopausal women
  // at increased risk by a risk tool such as FRAX).
  if (female && age >= 65) {
    add({
      id: 'screen_osteoporosis', topic: 'osteoporosis', priority: 'routine', highRisk: false,
      title: 'DXA bone density — osteoporosis screening (women ≥ 65)',
      finding: `Woman aged ${age}`,
      rationale: 'USPSTF 2018 (grade B): screen women 65 and over for osteoporosis with bone density (DXA) to prevent fractures.',
      guideline: 'USPSTF 2018',
      actions: [
        { text: 'DXA scan — hip and spine T-score', plan: '• DXA bone density scan — osteoporosis screening (USPSTF 2018, women ≥ 65).' },
        { text: 'Fracture risk estimate (FRAX)', plan: '• Estimate 10-year fracture risk (FRAX).' },
      ],
    });
  }

  return out;
}
