/**
 * Patient-safety adaptation of a management protocol (clinical validation 2026-09, SURGEON-DECISIONS
 * A12–A14, A22, C5, C7, G2.1–G2.6, G2.11, G2.12, G2.18).
 *
 * The management protocols are written for a generic adult. Before a protocol is shown in the Plan
 * tab, the Assessment management panel or the Prescriptions protocol queue, it is adapted to the
 * patient on record:
 *
 *   - allergy cross-check, class-aware (penicillin → co-amoxiclav, piperacillin-tazobactam,
 *     amoxicillin …): a step or medication that contains an allergen is withheld and replaced by a
 *     labelled line naming what was withheld and the protocol's allergy alternative (BNF);
 *   - pregnancy: DOACs and warfarin withheld (LMWH instead — RCOG GTG 37a/37b 2015), NSAIDs withheld
 *     from 20 weeks or when the gestation is not recorded (FDA Drug Safety Communication 2020; BNF),
 *     other drugs the BNF says to avoid in pregnancy withheld, ionising imaging annotated (ACOG
 *     Committee Opinion 723, 2017) and an obstetric line added (ACOG Committee Opinion 775, 2019);
 *   - under 16: adult doses replaced by "weight-based — calculate per BNFc" (no paediatric number is
 *     invented) and adult-only hernia techniques withheld; infants flagged for paediatric referral;
 *   - operative plans: a VTE prophylaxis line (NICE NG89 2018) with renal dose caution (BNF), and
 *     procedure-specific advice for anticoagulants (BRIDGE 2015, PAUSE 2019, ACCP 2022,
 *     BSG/ESGE 2021), antiplatelets and coronary stents (ESC/ESAIC 2022), SGLT2 inhibitors (CPOC
 *     2021), other diabetes medicines (CPOC 2021), long-term steroids (AAGBI/SfE 2020) and
 *     anaesthetic hazards (latex, malignant hyperthermia, suxamethonium apnoea, obstructive sleep
 *     apnoea);
 *   - active bleeding on an anticoagulant: bleeding-specific reversal advice instead of the
 *     elective interruption plan (BSG/ESGE 2021; BSH).
 *
 * Everything here is deterministic text matching and CLINICIAN-FACING only (hazard H-10): nothing
 * is sent to a patient. Every line is a suggestion the surgeon reviews before the plan is signed.
 */

import type {
  InvestigationItem, ManagementProtocol, ManagementStep, PatientCondition, ProtocolMedication,
} from './types.js';

export const PLAN_SAFETY_VERSION = '1.0.0';

// ── Patient context ───────────────────────────────────────────────────────────────────────────

export type PregnancyStatus = 'pregnant' | 'possible' | 'not-pregnant' | 'postpartum' | 'unknown';

export interface PlanPatientContext {
  ageYears?: number | null;
  sex?: string | null;
  /** The dashboard's "pregnancy possible" tick (female patients). */
  pregnancyPossible?: boolean;
  /** Recorded pregnancy status when the caller has one; otherwise it is read from the text. */
  pregnancy?: { status: PregnancyStatus; gestationWeeks?: number | null } | null;
  /** Recorded allergies, free text ("Penicillin (anaphylaxis)", "Latex"). */
  allergies?: string[];
  /** Current medicines (names, optionally with doses). */
  medications?: string[];
  /** Past medical history chips / free text. */
  comorbidities?: string[];
  /** The clinician's assessment / working diagnosis text (used for the planned procedure). */
  assessment?: string;
  /** Other free text: HPI, PMH notes, surgical history. */
  freeText?: string;
  /** eGFR or creatinine clearance, mL/min. */
  egfr?: number | null;
}

export interface AdaptOptions {
  /** True when the plan being built includes operative / procedural steps. Default: protocol has 'surgical' steps. */
  operative?: boolean;
}

export type SafetyKind =
  | 'allergy' | 'pregnancy' | 'paediatric' | 'vte' | 'anticoagulation' | 'antiplatelet'
  | 'diabetes' | 'steroid' | 'anaesthetic' | 'immunosuppression' | 'renal' | 'haemodynamics'
  | 'frailty' | 'surgical-risk' | 'hormonal';

export interface SafetyNote {
  kind: SafetyKind;
  severity: 'critical' | 'warning' | 'info';
  text: string;
}

export interface AdaptedProtocol extends ManagementProtocol {
  /** Patient-specific lines to show above the plan (sorted: critical first). */
  safetyNotes: SafetyNote[];
  /** What was withheld and why (plan steps and protocol medications). */
  withheld: { item: string; reason: string; from: 'step' | 'medication' }[];
}

// ── Text helpers ─────────────────────────────────────────────────────────────────────────────

function lower(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word (letters/digits boundary) regex for a term; hyphen and space variants allowed. */
function termRe(term: string): RegExp {
  const body = escapeRe(term.toLowerCase()).replace(/\\-|\s+/g, '[-\\s]?');
  return new RegExp(`(^|[^a-z0-9])${body}(?=$|[^a-z0-9])`, 'i');
}

const NEGATION_BEFORE = /\b(?:avoid|avoiding|no|not|never|without|stop|stopped|withhold|withheld|hold|omit|contraindicated|except|instead of|rather than|nor|allergic to|non)\b[^.;:]{0,30}$/;
/** "penicillin allergy", "NSAID-induced", "non-penicillin": the drug is named but not given. */
const NOT_GIVEN_AFTER = /^[\s-]*(?:allerg\w*|hypersensitiv\w*|sensitiv\w*|intoleran\w*|induced|associated|related|exposure|history|free\b)/;

/** First affirmed (not "avoid X" / "no X" / "X allergy") mention of any term; returns the term or null. */
function affirmedMention(text: string, terms: readonly string[]): string | null {
  const t = lower(text);
  for (const term of terms) {
    const re = new RegExp(termRe(term).source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const idx = m.index + m[1].length;
      const end = idx + (m[0].length - m[1].length);
      if (NEGATION_BEFORE.test(t.slice(Math.max(0, idx - 40), idx))) continue;
      if (NOT_GIVEN_AFTER.test(t.slice(end, end + 16))) continue;
      return term;
    }
  }
  return null;
}

function anyMention(text: string, terms: readonly string[]): string | null {
  const t = lower(text);
  for (const term of terms) if (termRe(term).test(t)) return term;
  return null;
}

/** All affirmed terms from a list found in the text. */
function affirmedMentions(text: string, terms: readonly string[]): string[] {
  const out: string[] = [];
  for (const term of terms) if (affirmedMention(text, [term])) out.push(term);
  // "amoxiclav" inside "co-amoxiclav", "piperacillin" inside "piperacillin-tazobactam": name it once.
  return out.filter(t => !out.some(o => o !== t && o.includes(t)));
}

const NEGATED_FINDING = /(?:\b(?:no|not|denies|without|negative for|ruled out|excluded|cannot|could not)\b|\bcan'?t\b|\bcouldn'?t\b)[^.;]{0,25}$/;

/** Affirmed clinical finding in free text (simple negation window, same clause). */
function findingPresent(text: string, re: RegExp): boolean {
  const t = lower(text);
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(t)) !== null) {
    const before = t.slice(Math.max(0, m.index - 35), m.index);
    if (!NEGATED_FINDING.test(before)) return true;
  }
  return false;
}

// ── Allergy classes (BNF) ───────────────────────────────────────────────────────────────────

export interface AllergyClass {
  id: string;
  label: string;
  /** Words in the recorded allergy that select this class. */
  triggers: string[];
  /** Drug names withheld when this class is recorded. */
  members: string[];
  /** Related drugs that stay but carry a caution line. */
  caution?: { members: string[]; text: string };
  /** Generic alternative when the protocol names none. */
  alternative: string;
}

const PENICILLINS = [
  'penicillin', 'penicillins', 'amoxicillin', 'amoxycillin', 'co-amoxiclav', 'amoxiclav', 'augmentin',
  'flucloxacillin', 'ampicillin', 'piperacillin', 'piperacillin-tazobactam', 'pip-tazo', 'tazocin',
  'benzylpenicillin', 'phenoxymethylpenicillin', 'temocillin', 'pivmecillinam',
];
const CEPHALOSPORINS = [
  'cephalosporin', 'cephalosporins', 'cefuroxime', 'ceftriaxone', 'cefalexin', 'cephalexin', 'cefazolin',
  'cefotaxime', 'ceftazidime', 'cefixime', 'cefaclor', 'cefradine', 'cefepime',
];
const CARBAPENEMS = ['carbapenem', 'meropenem', 'imipenem', 'ertapenem'];
const NSAIDS = [
  'nsaid', 'nsaids', 'ibuprofen', 'diclofenac', 'naproxen', 'ketorolac', 'celecoxib', 'parecoxib',
  'etoricoxib', 'mefenamic acid', 'indometacin', 'indomethacin',
];
const OPIOIDS = ['morphine', 'codeine', 'oxycodone', 'tramadol', 'pethidine', 'fentanyl', 'dihydrocodeine', 'diamorphine'];
const HEPARINS = ['heparin', 'unfractionated heparin', 'lmwh', 'enoxaparin', 'dalteparin', 'tinzaparin'];

export const ALLERGY_CLASSES: AllergyClass[] = [
  {
    id: 'penicillin', label: 'penicillin',
    triggers: [...PENICILLINS, 'beta-lactam', 'β-lactam'],
    members: PENICILLINS,
    caution: {
      members: [...CEPHALOSPORINS, ...CARBAPENEMS],
      text: 'Penicillin allergy recorded: check the reaction type — after an immediate (anaphylactic) penicillin reaction avoid cephalosporins and carbapenems unless there is no alternative (BNF).',
    },
    alternative: 'Choose a non-penicillin regimen per local antimicrobial policy / microbiology advice (check the reaction type — BNF).',
  },
  {
    id: 'cephalosporin', label: 'cephalosporin', triggers: CEPHALOSPORINS, members: CEPHALOSPORINS,
    alternative: 'Choose a non-cephalosporin regimen per local antimicrobial policy / microbiology advice.',
  },
  {
    id: 'carbapenem', label: 'carbapenem', triggers: CARBAPENEMS, members: CARBAPENEMS,
    alternative: 'Choose a non-carbapenem regimen per microbiology advice.',
  },
  {
    id: 'macrolide', label: 'macrolide', triggers: ['macrolide', 'clarithromycin', 'erythromycin', 'azithromycin'],
    members: ['clarithromycin', 'erythromycin', 'azithromycin'],
    alternative: 'Choose a non-macrolide alternative per local policy.',
  },
  {
    id: 'fluoroquinolone', label: 'fluoroquinolone', triggers: ['quinolone', 'fluoroquinolone', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
    members: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
    alternative: 'Choose a non-quinolone alternative per local policy.',
  },
  {
    id: 'tetracycline', label: 'tetracycline', triggers: ['tetracycline', 'doxycycline', 'lymecycline', 'minocycline'],
    members: ['tetracycline', 'doxycycline', 'lymecycline', 'minocycline'],
    alternative: 'Choose a non-tetracycline alternative per local policy.',
  },
  {
    id: 'sulfonamide', label: 'sulfonamide', triggers: ['sulfa', 'sulpha', 'sulfonamide', 'sulphonamide', 'co-trimoxazole', 'sulfamethoxazole'],
    members: ['co-trimoxazole', 'sulfamethoxazole', 'sulfasalazine'],
    alternative: 'Choose a non-sulfonamide alternative per local policy.',
  },
  {
    id: 'nitroimidazole', label: 'metronidazole', triggers: ['metronidazole', 'tinidazole'], members: ['metronidazole', 'tinidazole'],
    alternative: 'Anaerobic cover without metronidazole per microbiology advice.',
  },
  {
    id: 'aminoglycoside', label: 'aminoglycoside', triggers: ['gentamicin', 'amikacin', 'tobramycin', 'aminoglycoside'],
    members: ['gentamicin', 'amikacin', 'tobramycin'],
    alternative: 'Choose a non-aminoglycoside alternative per local policy.',
  },
  {
    id: 'glycopeptide', label: 'glycopeptide', triggers: ['vancomycin', 'teicoplanin'], members: ['vancomycin', 'teicoplanin'],
    alternative: 'Choose an alternative per microbiology advice.',
  },
  {
    id: 'clindamycin', label: 'clindamycin', triggers: ['clindamycin'], members: ['clindamycin'],
    alternative: 'Choose an alternative per microbiology advice.',
  },
  {
    // BNF: NSAIDs are contra-indicated after hypersensitivity to aspirin or any other NSAID.
    id: 'nsaid', label: 'NSAID / aspirin', triggers: [...NSAIDS, 'aspirin'], members: [...NSAIDS, 'aspirin'],
    alternative: 'Paracetamol-based analgesia; no NSAID (BNF: contra-indicated after aspirin/NSAID hypersensitivity).',
  },
  {
    id: 'opioid', label: 'opioid', triggers: OPIOIDS, members: OPIOIDS,
    alternative: 'Check the reaction type (intolerance vs true allergy); choose an alternative analgesic with the anaesthetist/pharmacist.',
  },
  {
    id: 'heparin', label: 'heparin', triggers: [...HEPARINS, 'hit', 'heparin-induced thrombocytopenia'], members: HEPARINS,
    alternative: 'Heparin allergy / HIT: non-heparin anticoagulant (e.g. fondaparinux or argatroban) per haematology advice.',
  },
];

/** Allergy words that do not name a medicine class above but matter peri-operatively. */
const LATEX = ['latex'];
const CHLORHEXIDINE = ['chlorhexidine'];
const CONTRAST = ['contrast', 'iodinated contrast', 'iodine', 'radiocontrast', 'x-ray dye'];

export interface AllergyProfile {
  classes: AllergyClass[];
  /** Recorded allergy words that name a specific drug outside the classes. */
  otherDrugs: string[];
  latex: boolean;
  chlorhexidine: boolean;
  contrast: boolean;
  /** The first recorded allergy text per class id (for the withheld line). */
  recorded: Map<string, string>;
}

const NO_ALLERGY = /^(nkda|nka|none|nil|no known (drug )?allerg\w*|no allerg\w*)$/;

export function allergyProfile(allergies: readonly string[] | undefined): AllergyProfile {
  const profile: AllergyProfile = { classes: [], otherDrugs: [], latex: false, chlorhexidine: false, contrast: false, recorded: new Map() };
  for (const raw of allergies ?? []) {
    for (const part of raw.split(/[,;\n]+/)) {
      const a = lower(part).trim();
      if (!a || NO_ALLERGY.test(a)) continue;
      let matched = false;
      for (const cls of ALLERGY_CLASSES) {
        if (anyMention(a, cls.triggers)) {
          matched = true;
          if (!profile.classes.includes(cls)) profile.classes.push(cls);
          if (!profile.recorded.has(cls.id)) profile.recorded.set(cls.id, part.trim());
        }
      }
      if (anyMention(a, LATEX)) { profile.latex = true; matched = true; }
      if (anyMention(a, CHLORHEXIDINE)) { profile.chlorhexidine = true; matched = true; }
      if (anyMention(a, CONTRAST)) { profile.contrast = true; matched = true; }
      if (!matched) {
        // "Tramadol (rash)" → "tramadol"; food/animal allergies never match a drug name below.
        const name = a.replace(/\(.*?\)/g, '').replace(/\ballergy\b|\ballergic\b|\bintolerance\b|\banaphylaxis\b/g, '').trim();
        if (name.length >= 4) profile.otherDrugs.push(name);
      }
    }
  }
  return profile;
}

// ── Pregnancy ───────────────────────────────────────────────────────────────────────────────

const WORD_NUMBERS: Record<string, number> = {
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23, 'twenty-four': 24, 'twenty-five': 25,
  'twenty-six': 26, 'twenty-seven': 27, 'twenty-eight': 28, 'twenty-nine': 29, thirty: 30,
  'thirty-one': 31, 'thirty-two': 32, 'thirty-three': 33, 'thirty-four': 34, 'thirty-five': 35,
  'thirty-six': 36, 'thirty-seven': 37, 'thirty-eight': 38, 'thirty-nine': 39, forty: 40,
};

/** Gestational age in weeks written in the text ("22 weeks' gestation", "G2P1 at 30+2 weeks", "32/40"). */
export function gestationFromText(text: string): number | null {
  const t = lower(text).replace(/twenty\s+(one|two|three|four|five|six|seven|eight|nine)/g, 'twenty-$1')
    .replace(/thirty\s+(one|two|three|four|five|six|seven|eight|nine)/g, 'thirty-$1');
  const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORD_NUMBERS[s] ?? NaN);
  const ok = (n: number) => Number.isFinite(n) && n >= 4 && n <= 42;
  const N = '(\\d{1,2}|[a-z]+(?:-[a-z]+)?)';
  const patterns = [
    new RegExp(`\\b(\\d{1,2})(?:\\s*\\+\\s*\\d)?\\s*/\\s*40\\b`),
    new RegExp(`\\b${N}(?:\\s*\\+\\s*\\d)?\\s*weeks?['’]?\\s*(?:of\\s+)?(?:gestation|pregnan)`),
    new RegExp(`\\b(?:pregnan\\w*|gestation|g\\d+\\s*p\\d+)[^.;]{0,20}?\\b(?:at\\s+)?${N}(?:\\s*\\+\\s*\\d)?\\s*weeks?\\b(?!\\s+ago)`),
    new RegExp(`\\b(?:g\\d+|primigravida|multigravida|gravida\\s*\\d+)\\s+at\\s+${N}(?:\\s*\\+\\s*\\d)?\\s*weeks?\\b(?!\\s+ago)`),
  ];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const n = num(m[1]);
      if (ok(n)) return n;
    }
  }
  return null;
}

/**
 * Pregnancy status for the plan: a recorded status wins; otherwise the free text ("22 weeks
 * pregnant", "postpartum", "pregnancy test negative") and the dashboard's "pregnancy possible"
 * tick are read. Only female patients (or sex not recorded) can be pregnant.
 */
export function pregnancyFor(ctx: PlanPatientContext): { status: PregnancyStatus; gestationWeeks: number | null } {
  const sex = lower(ctx.sex);
  if (sex === 'male') return { status: 'not-pregnant', gestationWeeks: null };
  const text = [ctx.assessment, ctx.freeText].filter(Boolean).join(' . ');
  const weeks = ctx.pregnancy?.gestationWeeks ?? gestationFromText(text);
  if (ctx.pregnancy && ctx.pregnancy.status !== 'unknown') {
    return { status: ctx.pregnancy.status, gestationWeeks: ctx.pregnancy.status === 'pregnant' ? weeks : null };
  }
  const t = lower(text);
  if (/\b(post-?partum|puerper\w*|after delivery|since delivery)\b/.test(t)) return { status: 'postpartum', gestationWeeks: null };
  if (/\bpregnancy test (?:is |was )?negative\b|\bnegative (?:urine |serum )?(?:pregnancy test|β-?hcg|b-?hcg|beta-?hcg|hcg)\b|\bnot pregnant\b/.test(t)) {
    return { status: 'not-pregnant', gestationWeeks: null };
  }
  const pregnantText = findingPresent(t, /\b(?:pregnant|in pregnancy|of pregnancy|weeks['’]? gestation|ectopic pregnancy|pregnancy of unknown location|g\d+\s*p\d+|primigravida|multigravida|\d{1,2}\s*\/\s*40)\b/);
  if (pregnantText || (weeks !== null && /\bpregnan|gestation/.test(t))) return { status: 'pregnant', gestationWeeks: weeks };
  if (ctx.pregnancyPossible) return { status: 'possible', gestationWeeks: null };
  return { status: 'unknown', gestationWeeks: null };
}

// ── Medicines on record ────────────────────────────────────────────────────────────────────

const VKA = ['warfarin', 'acenocoumarol', 'phenindione'];
const DOACS = ['apixaban', 'rivaroxaban', 'edoxaban', 'dabigatran'];
const P2Y12 = ['clopidogrel', 'prasugrel', 'ticagrelor'];
const ASPIRIN = ['aspirin'];
const SGLT2 = ['sglt2', 'sglt-2', 'empagliflozin', 'dapagliflozin', 'canagliflozin', 'ertugliflozin', 'sotagliflozin'];
const SULFONYLUREAS = ['gliclazide', 'glipizide', 'glimepiride', 'glibenclamide', 'tolbutamide', 'sulfonylurea', 'sulphonylurea'];
const METFORMIN = ['metformin'];
const INSULINS = ['insulin', 'glargine', 'detemir', 'degludec', 'lantus', 'levemir', 'tresiba', 'humulin', 'novomix', 'isophane', 'aspart', 'lispro', 'actrapid', 'novorapid'];
const STEROIDS = ['prednisolone', 'prednisone', 'hydrocortisone', 'dexamethasone', 'methylprednisolone', 'fludrocortisone'];
const IMMUNOSUPPRESSANTS = [
  'tacrolimus', 'ciclosporin', 'cyclosporine', 'mycophenolate', 'azathioprine', 'methotrexate', 'sirolimus',
  'adalimumab', 'infliximab', 'etanercept', 'vedolizumab', 'ustekinumab', 'tocilizumab', 'rituximab',
  'cyclophosphamide', 'chemotherapy', 'capecitabine', 'oxaliplatin', 'fluorouracil',
];
const BETA_BLOCKERS = ['bisoprolol', 'metoprolol', 'atenolol', 'carvedilol', 'propranolol', 'nebivolol', 'labetalol', 'sotalol'];

// ── Procedure context ───────────────────────────────────────────────────────────────────────

export type ProcedureKind = 'surgery' | 'endoscopy-high' | 'endoscopy-low' | 'none';

const HIGH_RISK_ENDOSCOPY = /\b(polypectomy|emr|endoscopic mucosal resection|esd|submucosal dissection|sphincterotomy|ampullectomy|dilat(?:ation|ion)|peg|gastrostomy|eus[- ]?(?:guided\s+)?(?:fna|fnb)|fine[- ]needle|cystgastrostomy|band ligation|variceal banding)\b/;
const LOW_RISK_ENDOSCOPY = /\b(ogd|gastroscopy|colonoscopy|sigmoidoscopy|endoscopy|oesophagogastroduodenoscopy|capsule endoscopy|enteroscopy|biliary stent\w*|ercp|eus)\b/;
const SURGERY_WORDS = /\b(\w+ectomy|\w+otomy|\w+plasty|repair|laparoscop\w*|laparotomy|resection|excision|anastomosis|herniotomy|herniorrhaphy|fundoplication|surgery|surgical|operation|operative|theatre)\b/;

/**
 * Wording that names surgery without planning it: "surgical review", "no surgery", "day 4 after
 * right hemicolectomy", "post-thyroidectomy".
 */
const NOT_A_PLANNED_OPERATION = new RegExp([
  String.raw`(?:surgical|surgery|surgeon)\s+(?:review|assessment|opinion|referral|team|input|consult\w*|on-call|clinic|follow-up)`,
  String.raw`(?:no|not for|without|avoid|declin\w*)\s+(?:\w+\s){0,2}?(?:surgery|operation|resection|repair)`,
  String.raw`(?:day\s+\d+\s+)?(?:after|following|since|post[- ]?op\w*\s+(?:from|after)?)\s+(?:an?\s+|the\s+|his\s+|her\s+)?(?:\w+[\s-]){0,3}?\w*(?:ectomy|otomy|plasty|repair|surgery|operation|resection|anastomosis)`,
  String.raw`post[- ]?\w*(?:ectomy|otomy|operative)`,
  String.raw`surgical (?:history|site infection)`,
].join('|'), 'g');

function operationWordsIn(text: string): boolean {
  return SURGERY_WORDS.test(lower(text).replace(NOT_A_PLANNED_OPERATION, ' '));
}

/**
 * True when the protocol's surgical-phase steps (limited to `allowedPhases` when given) describe an
 * operation or procedure — not only "senior surgical review".
 */
export function hasOperativeSteps(protocol: ManagementProtocol, allowedPhases?: readonly string[]): boolean {
  if (allowedPhases && !allowedPhases.includes('surgical')) return false;
  return protocol.management.some(st => st.phase === 'surgical'
    && (operationWordsIn(st.step) || HIGH_RISK_ENDOSCOPY.test(lower(st.step)) || LOW_RISK_ENDOSCOPY.test(lower(st.step))));
}

/** The planned procedure, read from the assessment text (not the history). */
export function procedureFor(protocol: ManagementProtocol, ctx: PlanPatientContext, operative: boolean): ProcedureKind {
  const a = lower(ctx.assessment).replace(NOT_A_PLANNED_OPERATION, ' ');
  if (HIGH_RISK_ENDOSCOPY.test(a)) return 'endoscopy-high';
  if (SURGERY_WORDS.test(a)) {
    // "diagnostic OGD ± biopsy" has no surgery word; "laparoscopic cholecystectomy" does.
    return 'surgery';
  }
  if (LOW_RISK_ENDOSCOPY.test(a)) return 'endoscopy-low';
  if (protocol.kind === 'procedure' || operative) return 'surgery';
  return 'none';
}

/** "low bleeding-risk procedure", "risk of bleeding", "bleeding history" — not active bleeding. */
const NOT_ACTIVE_BLEEDING = /\b(?:(?:low|high|moderate|increased|minimal)[- ])?bleed(?:ing)?[- ]risk\b|\brisk of (?:\w+ )?(?:bleed\w*|haemorrhag\w*|hemorrhag\w*)|\bbleeding (?:history|disorder|tendency|problems?)\b|\bpost[- ]?(?:polypectomy|procedure) bleed\w* risk\b/g;
/** Acute illness named in the assessment (steroid cover, SGLT2 stop, beta-blocker masking). */
const ACUTE_ILLNESS_TEXT = /\b(sepsis|septic|shock|hypotensi\w*|acute kidney injury|aki|ketoacidosis|dka|hhs|peritonitis|emergency|lactate\s*[4-9])\b/;

const BLEEDING_TEXT = /\b(haemoperitoneum|hemoperitoneum|haemorrhag\w*|hemorrhag\w*|bleed\w*|haematemesis|hematemesis|melaena|melena|haematochezia|haematoma|hematoma|haemothorax|hemothorax|haematuria|hematuria|intracranial|head injury|subdural|extradural)\b/;

// ── Coronary stent timing ──────────────────────────────────────────────────────────────────

const CORONARY_STENT = /\b(des|drug[- ]eluting|bare[- ]metal|pci|coronary stent\w*|coronary angioplasty|stent\w*(?=[^.;]{0,40}\b(?:coronary|cardiac|lad|rca|circumflex|nstemi|stemi|acs|mi|angina)\b)|(?:coronary|cardiac|lad|rca|nstemi|stemi|acs)[^.;]{0,40}\bstent\w*)\b/;
const ACS_TEXT = /\b(nstemi|stemi|acute coronary syndrome|acs|myocardial infarction|heart attack|unstable angina)\b/;

function stentInfo(text: string): { present: boolean; months: number | null; acs: boolean } {
  const t = lower(text);
  const m = CORONARY_STENT.exec(t);
  if (!m) return { present: false, months: null, acs: false };
  const window = t.slice(Math.max(0, m.index - 80), m.index + 120);
  let months: number | null = null;
  const tm = /\b(\d{1,2})\s*(months?|weeks?|days?)\b/.exec(window);
  if (tm) {
    const n = Number(tm[1]);
    months = tm[2].startsWith('month') ? n : tm[2].startsWith('week') ? n / 4.345 : n / 30.4;
  }
  return { present: true, months, acs: ACS_TEXT.test(window) || ACS_TEXT.test(t) };
}

// ── Adaptation ─────────────────────────────────────────────────────────────────────────────

const DOSE_RE = /\b\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(?:mg|g|mcg|micrograms?|µg|units?|iu|ml|l|litres?|liters?|mmol)\b(?!\s*\/\s*(?:kg|m²|m2|l\b|dl\b|min\b|mol\b))/gi;
const DOSE_TEST = new RegExp(DOSE_RE.source, 'i');
const PAEDIATRIC_DOSE = '[dose: weight-based — calculate per BNFc]';

const ADULT_HERNIA_TECHNIQUE = /\b(mesh|lichtenstein|tep|tapp|truss)\b/i;
const PAEDIATRIC_HERNIA_LINE = '⚠ CHILD (under 16): adult hernia technique withheld — paediatric inguinal hernia is repaired by open herniotomy (no mesh) by a paediatric surgeon; in infants repair promptly because of the incarceration risk.';

/** Drugs the BNF says to avoid in pregnancy that appear in protocol text (beyond anticoagulants/NSAIDs). */
const PREGNANCY_AVOID: { terms: string[]; reason: string }[] = [
  { terms: ['doxycycline', 'tetracycline', 'lymecycline', 'minocycline'], reason: 'tetracyclines are avoided in pregnancy (BNF)' },
  { terms: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'], reason: 'quinolones are avoided in pregnancy (BNF)' },
  { terms: ['methotrexate'], reason: 'methotrexate is contraindicated in pregnancy (BNF)' },
  { terms: ['ramipril', 'lisinopril', 'enalapril', 'perindopril', 'losartan', 'candesartan', 'valsartan'], reason: 'ACE inhibitors / ARBs are avoided in pregnancy (BNF)' },
  { terms: ['atorvastatin', 'simvastatin', 'rosuvastatin'], reason: 'statins are avoided in pregnancy (BNF)' },
  { terms: ['trimethoprim'], reason: 'trimethoprim is avoided in the first trimester (folate antagonist — BNF, NICE NG111)' },
];
const ANTICOAGULANTS_AVOID_IN_PREGNANCY = [...DOACS, ...VKA];

const IONISING_IMAGING = /\b(ct|ctpa|cect|cta|x-?ray|radiograph|cxr|axr|kub|ivu|fluoroscop\w*|contrast study|contrast swallow|contrast enema|barium|ercp|nuclear|v\/q|isotope|mammogra\w*)\b/i;

function conditionHolds(cond: PatientCondition | undefined, s: Signals): boolean {
  if (!cond) return true;
  switch (cond) {
    case 'pregnant': return s.pregnancy.status === 'pregnant';
    case 'not-pregnant': return s.pregnancy.status !== 'pregnant';
    case 'penicillin-allergy': return s.allergy.classes.some(c => c.id === 'penicillin');
    case 'no-penicillin-allergy': return !s.allergy.classes.some(c => c.id === 'penicillin');
    case 'under-16': return s.child;
    case 'adult': return !s.child;
    default: return true;
  }
}

interface Signals {
  age: number | null;
  child: boolean;
  infant: boolean;
  female: boolean;
  pregnancy: { status: PregnancyStatus; gestationWeeks: number | null };
  allergy: AllergyProfile;
  meds: string;
  history: string;
  text: string;
  assessment: string;
  renalImpairment: boolean;
  egfr: number | null;
}

function signalsFor(ctx: PlanPatientContext): Signals {
  const age = typeof ctx.ageYears === 'number' && Number.isFinite(ctx.ageYears) ? ctx.ageYears : null;
  const meds = lower((ctx.medications ?? []).join(' ; '));
  const history = lower([...(ctx.comorbidities ?? []), ctx.freeText ?? ''].join(' ; '));
  const text = lower([ctx.assessment ?? '', ...(ctx.comorbidities ?? []), ctx.freeText ?? ''].join(' ; '));
  const egfr = typeof ctx.egfr === 'number' && Number.isFinite(ctx.egfr) ? ctx.egfr : null;
  const renalImpairment = (egfr !== null && egfr < 30)
    || findingPresent(text, /\b(aki|acute kidney injury|anuri\w*|oligur\w*|solitary kidney|single kidney|ckd (?:stage )?(?:4|5|iv|v)\b|end-stage renal|esrf|eskd|dialysis|haemodialysis|hemodialysis)\b/);
  return {
    age,
    child: age !== null && age < 16,
    infant: age !== null && age < 1,
    female: lower(ctx.sex) === 'female',
    pregnancy: pregnancyFor(ctx),
    allergy: allergyProfile(ctx.allergies),
    meds,
    history,
    text,
    assessment: lower(ctx.assessment),
    renalImpairment,
    egfr,
  };
}

interface StepVerdict { text: string; withheld?: { item: string; reason: string } }

function allergyAlternative(protocol: ManagementProtocol, cls: AllergyClass): string {
  return protocol.allergyAlternatives?.[cls.id] ?? cls.alternative;
}

/** Applies the drug filters (allergy, pregnancy, renal, paediatric doses/templates) to one line of text. */
function adaptLine(line: string, protocol: ManagementProtocol, s: Signals): StepVerdict {
  // Allergy (class-aware), then other named drugs.
  for (const cls of s.allergy.classes) {
    const hits = affirmedMentions(line, cls.members);
    if (hits.length) {
      const recorded = s.allergy.recorded.get(cls.id) ?? cls.label;
      return {
        text: `⚠ ALLERGY — ${cls.label} allergy recorded (${recorded}): withheld (contains ${hits.join(', ')}). Alternative: ${allergyAlternative(protocol, cls)}`,
        withheld: { item: hits.join(', '), reason: `allergy: ${recorded}` },
      };
    }
  }
  for (const drug of s.allergy.otherDrugs) {
    if (affirmedMention(line, [drug])) {
      return {
        text: `⚠ ALLERGY — ${drug} recorded: withheld (contains ${drug}). Choose an alternative.`,
        withheld: { item: drug, reason: `allergy: ${drug}` },
      };
    }
  }

  const preg = s.pregnancy;
  if (preg.status === 'pregnant' && !protocol.pregnancySpecific) {
    const anticoag = affirmedMentions(line, ANTICOAGULANTS_AVOID_IN_PREGNANCY);
    if (anticoag.length) {
      return {
        text: `⚠ PREGNANCY: withheld (contains ${anticoag.join(', ')}) — DOACs and warfarin are contraindicated in pregnancy (warfarin is teratogenic). Use weight-adjusted LMWH for treatment and prophylaxis (RCOG Green-top 37a/37b, 2015).`,
        withheld: { item: anticoag.join(', '), reason: 'pregnancy' },
      };
    }
    const nsaid = affirmedMentions(line, NSAIDS);
    if (nsaid.length && (preg.gestationWeeks === null || preg.gestationWeeks >= 20)) {
      const when = preg.gestationWeeks === null ? 'gestation not recorded' : `${preg.gestationWeeks} weeks`;
      return {
        text: `⚠ PREGNANCY (${when}): withheld (contains ${nsaid.join(', ')}) — avoid NSAIDs from 20 weeks' gestation (FDA Drug Safety Communication 2020; BNF). Use paracetamol ± an opioid.`,
        withheld: { item: nsaid.join(', '), reason: 'pregnancy ≥ 20 weeks' },
      };
    }
    for (const rule of PREGNANCY_AVOID) {
      const hits = affirmedMentions(line, rule.terms);
      if (hits.length) {
        if (rule.terms.includes('trimethoprim') && preg.gestationWeeks !== null && preg.gestationWeeks >= 13) continue;
        return {
          text: `⚠ PREGNANCY: withheld (contains ${hits.join(', ')}) — ${rule.reason}. Choose a pregnancy-compatible alternative with the obstetric team / pharmacist.`,
          withheld: { item: hits.join(', '), reason: 'pregnancy' },
        };
      }
    }
  }

  if (s.renalImpairment) {
    const nsaid = affirmedMentions(line, NSAIDS);
    if (nsaid.length) {
      return {
        text: `⚠ RENAL: withheld (contains ${nsaid.join(', ')}) — NSAIDs contraindicated in AKI, severe CKD or a solitary obstructed kidney (NICE NG148 2019; BNF). Use paracetamol ± an opioid.`,
        withheld: { item: nsaid.join(', ') , reason: 'renal impairment' },
      };
    }
  }

  let text = line;
  if (preg.status === 'pregnant' && affirmedMention(line, ['ercp']) && !/fluoroscop/i.test(line)) {
    text += ' [Pregnancy: minimise fluoroscopy time and shield the fetus; obstetric involvement (ASGE 2012 endoscopy in pregnancy).]';
  }
  if (preg.status === 'possible' && !protocol.pregnancySpecific) {
    const risky = affirmedMentions(line, [...ANTICOAGULANTS_AVOID_IN_PREGNANCY, ...NSAIDS, ...PREGNANCY_AVOID.flatMap(r => r.terms)]);
    if (risky.length) text += ` [Pregnancy possible — β-HCG result required first; ${risky.join(', ')} to be avoided if pregnant.]`;
  }

  if (s.child) {
    if (ADULT_HERNIA_TECHNIQUE.test(line) && /hernia|herniorrhaphy|lichtenstein|tep|tapp|truss/i.test(`${line} ${protocol.label}`)) {
      return { text: PAEDIATRIC_HERNIA_LINE, withheld: { item: 'adult hernia technique', reason: 'under 16' } };
    }
    if (!protocol.paediatricDosing && DOSE_TEST.test(text)) text = text.replace(DOSE_RE, PAEDIATRIC_DOSE);
  }
  return { text };
}

function adaptInvestigation(inv: InvestigationItem, s: Signals): InvestigationItem {
  let label = inv.label;
  const ionising = inv.category === 'imaging-ct' || inv.category === 'imaging-xr' || IONISING_IMAGING.test(label);
  if (ionising && s.pregnancy.status === 'pregnant') {
    label += ' — pregnancy: only if ultrasound/MRI cannot answer the question; discuss dose with radiology (ACOG Committee Opinion 723, 2017)';
  } else if (ionising && s.pregnancy.status === 'possible') {
    label += ' — pregnancy possible: β-HCG result required first';
  }
  if (s.child && (inv.category === 'imaging-ct' || /\bct\b|\bcect\b/i.test(inv.label))) {
    label += ' — child: ultrasound first; CT only if ultrasound/MRI is non-diagnostic (ALARA; RCR iRefer)';
  }
  if (s.allergy.contrast && /contrast|cta\b|ctpa|angiogra|cect/i.test(inv.label)) {
    label += ' — contrast allergy recorded: discuss premedication or an alternative with radiology (ESUR 2018)';
  }
  return label === inv.label ? inv : { ...inv, label };
}

function adaptMedication(m: ProtocolMedication, protocol: ManagementProtocol, s: Signals, withheld: AdaptedProtocol['withheld']): ProtocolMedication | null {
  // The drug name alone is checked: an indication such as "alternative to co-amoxiclav" must not
  // withhold cefuroxime for a penicillin allergy.
  const v = adaptLine(m.drugName, protocol, s);
  if (v.withheld) {
    withheld.push({ item: `${m.drugName} (${m.indication})`, reason: v.withheld.reason, from: 'medication' });
    return null;
  }
  if (s.child && !protocol.paediatricDosing) {
    return { ...m, dose: 'Weight-based — calculate per BNFc', frequency: `${m.frequency} (confirm per BNFc)` };
  }
  return m;
}

// ── Peri-operative / peri-procedural lines ────────────────────────────────────────────────

function drugsPresent(meds: string, terms: readonly string[]): string[] {
  return terms.filter(t => termRe(t).test(meds));
}

function anticoagulationNotes(protocol: ManagementProtocol, s: Signals, procedure: ProcedureKind, bleeding: boolean, emergency = false): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const vka = drugsPresent(s.meds, VKA);
  const doac = drugsPresent(s.meds, DOACS);
  const p2y12 = drugsPresent(s.meds, P2Y12);
  const aspirin = drugsPresent(s.meds, ASPIRIN);
  const mechanicalValve = /\bmechanical\s+(?:heart\s+|mitral\s+|aortic\s+)?valve|\bmechanical\s+(?:mvr|avr)\b|metallic valve/.test(s.text);
  const stent = stentInfo(s.text);

  if (bleeding) {
    if (vka.length) {
      notes.push({
        kind: 'anticoagulation', severity: 'critical',
        text: `Anticoagulant-associated bleeding (${vka.join(', ')}): withhold ${vka[0]} and check the INR now. Major or life-threatening bleeding: reverse with IV vitamin K (phytomenadione) 5 mg plus four-factor prothrombin complex concentrate, dosed by INR and weight (BSH warfarin guideline; BSG/ESGE 2021). No heparin substitution while bleeding. Plan when to restart ${vka[0]} with the specialist once haemostasis is secure (BSG/ESGE 2021: about 7 days after GI bleeding; earlier if thrombotic risk is high).`,
      });
    }
    if (doac.length) {
      const d = doac[0];
      notes.push({
        kind: 'anticoagulation', severity: 'critical',
        text: `Anticoagulant-associated bleeding (${doac.join(', ')}): withhold ${d}; record the time of the last dose and check renal function. Major or life-threatening bleeding: reversal — ${d === 'dabigatran' ? 'idarucizumab' : 'andexanet alfa (where available) or prothrombin complex concentrate'}; seek haematology advice (BSG/ESGE 2021; BSH). No heparin substitution while bleeding. Plan when to restart the anticoagulant once haemostasis is secure.`,
      });
    }
    if (p2y12.length || aspirin.length) {
      notes.push({
        kind: 'antiplatelet', severity: 'warning',
        text: `Antiplatelet therapy (${[...p2y12, ...aspirin].join(', ')}) with bleeding: aspirin for secondary prevention should not be stopped routinely, or should be restarted as soon as haemostasis is achieved; withhold ${p2y12.length ? p2y12.join('/') : 'other antiplatelets'} and discuss with cardiology if there is a coronary stent or recent ACS (BSG/ESGE 2021; ESGE 2021 NVUGIH).`,
      });
    }
    return notes;
  }

  if (procedure === 'none') return notes;

  if (emergency && procedure === 'surgery') {
    if (vka.length) {
      notes.push({
        kind: 'anticoagulation', severity: 'critical',
        text: `Emergency surgery on ${vka[0]}: check the INR now; if surgery cannot wait, reverse with IV vitamin K plus four-factor prothrombin complex concentrate dosed by INR and weight (BSH warfarin guideline). No bridging; plan restart after surgery with the team.`,
      });
    }
    if (doac.length) {
      const d = doac[0];
      notes.push({
        kind: 'anticoagulation', severity: 'critical',
        text: d === 'dabigatran'
          ? 'Emergency surgery on dabigatran: record the time of the last dose and renal function; if surgery cannot wait, reverse with idarucizumab 5 g IV (ESC/ESAIC 2022). Plan restart after surgery.'
          : `Emergency surgery on ${d}: record the time of the last dose and renal function, and send an anti-Xa level where available; if surgery cannot be delayed and the drug is likely active, discuss reversal with prothrombin complex concentrate with haematology — andexanet alfa is licensed for life-threatening bleeding, not for surgery (ESC/ESAIC 2022). Plan restart after surgery.`,
      });
    }
    if (p2y12.length) {
      notes.push({ kind: 'antiplatelet', severity: 'warning', text: `${p2y12.join('/')} before emergency surgery: record the last dose; platelet transfusion only for bleeding; discuss with cardiology if there is a recent coronary stent (ESC/ESAIC 2022).` });
    }
    return notes;
  }

  const what = procedure === 'surgery' ? 'surgery' : procedure === 'endoscopy-high' ? 'this high-risk endoscopic procedure' : 'this low-risk endoscopic procedure';

  if (stent.present && (p2y12.length || aspirin.length || stent.months !== null)) {
    const window = stent.acs ? 12 : 6;
    const inWindow = stent.months === null ? (p2y12.length > 0 && aspirin.length > 0) : stent.months < window;
    if (inWindow && procedure !== 'endoscopy-low') {
      notes.push({
        kind: 'antiplatelet', severity: 'critical',
        text: `Recent coronary stent${stent.months !== null ? ` (about ${Math.round(stent.months)} months)` : ''}${stent.acs ? ' after an acute coronary syndrome' : ''}: defer elective ${procedure === 'surgery' ? 'surgery' : 'polypectomy / high-risk procedure'} until ${window} months after ${stent.acs ? 'the ACS' : 'elective PCI'} unless cardiology agrees; do not stop dual antiplatelet therapy without cardiology input (ESC/ESAIC 2022 non-cardiac surgery; BSG/ESGE 2021).`,
      });
    }
  }

  if (vka.length) {
    const v = vka[0];
    if (procedure === 'endoscopy-low') {
      notes.push({
        kind: 'anticoagulation', severity: 'warning',
        text: `${v} and ${what}: continue ${v}; check the INR in the week before and, if above the therapeutic range, reduce the dose and recheck (BSG/ESGE 2021). No bridging.`,
      });
    } else if (mechanicalValve) {
      notes.push({
        kind: 'anticoagulation', severity: 'critical',
        text: `${v} with a mechanical heart valve and ${what}: stop ${v} 5 days before; bridging with treatment-dose LMWH (or UFH) is indicated for a mechanical valve — plan with cardiology/haematology (ACC/AHA 2020 valvular heart disease; BSG/ESGE 2021). Check the INR the day before; resume ${v} the evening of the procedure or the next day if haemostasis is secure.`,
      });
    } else {
      notes.push({
        kind: 'anticoagulation', severity: 'warning',
        text: `${v} and ${what}: stop ${v} 5 days before; check the INR the day before (proceed when < 1.5). No bridging for most patients with atrial fibrillation (BRIDGE trial 2015; ACCP 2022 perioperative guideline); bridge with LMWH only for a mechanical valve, VTE within 3 months or a high-risk thrombophilia, with specialist advice. Resume ${v} the evening of the procedure or the next day at the usual dose if haemostasis is secure.`,
      });
    }
  }
  if (doac.length) {
    const d = doac[0];
    if (procedure === 'endoscopy-low') {
      notes.push({
        kind: 'anticoagulation', severity: 'warning',
        text: `${d} and ${what}: omit the morning dose on the day of the procedure (BSG/ESGE 2021). No bridging.`,
      });
    } else if (procedure === 'endoscopy-high') {
      notes.push({
        kind: 'anticoagulation', severity: 'warning',
        text: `${d} and ${what}: take the last dose 3 days before the procedure${d === 'dabigatran' ? ' (5 days before if CrCl 30–50 mL/min)' : ''}; restart 2–3 days after if haemostasis is secure (BSG/ESGE 2021). No bridging.`,
      });
    } else {
      notes.push({
        kind: 'anticoagulation', severity: 'warning',
        text: d === 'dabigatran'
          ? `dabigatran and surgery (PAUSE 2019): CrCl ≥ 50 mL/min — omit 1 day before a low-bleed-risk and 2 days before a high-bleed-risk operation; CrCl 30–50 — 2 and 4 days. Resume 1 day after low-risk and 2–3 days after high-risk surgery. No bridging, no routine pre-operative coagulation test (ACCP 2022).`
          : `${d} and surgery (PAUSE 2019): omit 1 day before a low-bleed-risk and 2 days before a high-bleed-risk operation (check renal function); resume 1 day after low-risk and 2–3 days after high-risk surgery. No bridging, no routine pre-operative coagulation test (ACCP 2022).`,
      });
    }
  }
  if (p2y12.length) {
    const p = p2y12[0];
    if (procedure === 'endoscopy-low') {
      notes.push({ kind: 'antiplatelet', severity: 'info', text: `${p} and ${what}: continue (BSG/ESGE 2021).` });
    } else if (procedure === 'endoscopy-high') {
      notes.push({
        kind: 'antiplatelet', severity: 'warning',
        text: `${p} and ${what}: if thrombotic risk is low, stop ${p} 7 days before and continue aspirin if prescribed; if there is a coronary stent within its high-risk window or other high thrombotic risk, liaise with cardiology first (BSG/ESGE 2021).`,
      });
    } else {
      notes.push({
        kind: 'antiplatelet', severity: 'warning',
        text: `${p} and surgery: if thrombotic risk allows, stop clopidogrel 5 days, ticagrelor 3–5 days or prasugrel 7 days before; continue aspirin; discuss with cardiology if there is a coronary stent or recent ACS (ESC/ESAIC 2022).`,
      });
    }
  }
  if (aspirin.length && !p2y12.length) {
    notes.push({
      kind: 'antiplatelet', severity: 'info',
      text: procedure === 'surgery'
        ? 'Low-dose aspirin for secondary prevention: usually continue through surgery unless the bleeding risk is prohibitive (e.g. intracranial, spinal) — ESC/ESAIC 2022.'
        : 'Low-dose aspirin: continue for endoscopic procedures (BSG/ESGE 2021); discuss for ESD, large colonic EMR (> 2 cm) or ampullectomy.',
    });
  }
  return notes;
}

function diabetesNotes(s: Signals, procedure: ProcedureKind, acuteIllness: boolean): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const sglt2 = drugsPresent(s.meds, SGLT2);
  if (sglt2.length) {
    if (acuteIllness) {
      notes.push({
        kind: 'diabetes', severity: 'critical',
        text: `SGLT2 inhibitor (${sglt2.join(', ')}) in acute illness: stop it now — risk of euglycaemic diabetic ketoacidosis; check blood ketones and a venous gas even if glucose is normal (MHRA 2016/2020; JBDS 2023).`,
      });
    }
    if (procedure !== 'none') {
      notes.push({
        kind: 'diabetes', severity: 'warning',
        text: `SGLT2 inhibitor (${sglt2.join(', ')}): withhold the day before and the day of the procedure (CPOC 2021; FDA labelling advises 3 days, 4 for ertugliflozin — surgeon to choose); check blood ketones before and after, even if glucose is normal; restart when eating and drinking normally.`,
      });
    }
  }
  if (procedure !== 'none') {
    const su = drugsPresent(s.meds, SULFONYLUREAS);
    if (su.length) {
      notes.push({ kind: 'diabetes', severity: 'info', text: `Sulfonylurea (${su.join(', ')}): omit on the day of the procedure; capillary glucose monitoring, target 6–12 mmol/L (CPOC 2021).` });
    }
    if (drugsPresent(s.meds, METFORMIN).length) {
      notes.push({ kind: 'diabetes', severity: 'info', text: 'Metformin: continue if only one meal is missed; omit if more than one meal will be missed, eGFR < 60 mL/min or IV contrast is planned (CPOC 2021).' });
    }
    const type1 = /\btype\s*(?:1|i)\s+diabet|\bt1dm\b|\biddm\b/.test(s.text);
    if (type1 || drugsPresent(s.meds, INSULINS).length) {
      notes.push({
        kind: 'diabetes', severity: 'warning',
        text: `${type1 ? 'Type 1 diabetes' : 'Insulin-treated diabetes'}: continue basal (long-acting) insulin — never omit it; give 80% of the usual dose the evening before and on the day; variable-rate IV insulin if more than one meal will be missed; capillary glucose and ketone monitoring; first on the list where possible (CPOC 2021).`,
      });
    }
  }
  return notes;
}

function steroidNote(s: Signals, procedure: ProcedureKind, acuteIllness: boolean): SafetyNote | null {
  const steroid = drugsPresent(s.meds, STEROIDS);
  if (!steroid.length || (procedure === 'none' && !acuteIllness)) return null;
  return {
    kind: 'steroid', severity: 'warning',
    text: `Long-term glucocorticoid (${steroid.join(', ')}): do not stop it. If ≥ 5 mg prednisolone (or equivalent) for > 4 weeks, give steroid cover — hydrocortisone 100 mg IV at induction or at the start of the acute illness, then 200 mg/24 h (infusion, or 50 mg IV/IM 6-hourly) while unwell or nil by mouth, then double the usual oral dose for 48 h (AAGBI/Society for Endocrinology 2020).`,
  };
}

function anaestheticNotes(s: Signals): SafetyNote[] {
  const notes: SafetyNote[] = [];
  if (s.allergy.latex) {
    notes.push({ kind: 'anaesthetic', severity: 'critical', text: 'Latex allergy: latex-free theatre, ward and equipment; schedule first on the list; alert the theatre team and anaesthetist (NAP6 2018).' });
  }
  if (s.allergy.chlorhexidine) {
    notes.push({ kind: 'anaesthetic', severity: 'critical', text: 'Chlorhexidine allergy: use an alternative skin preparation and chlorhexidine-free catheters, lines and lubricants; alert the theatre team (NAP6 2018; MHRA 2012).' });
  }
  if (/\bmalignant hyperthermia|\bmh[- ]?susceptib\w*|\bmhs\b/.test(s.text)) {
    notes.push({ kind: 'anaesthetic', severity: 'critical', text: 'Malignant hyperthermia susceptibility (personal or family history): trigger-free anaesthesia — avoid volatile agents and suxamethonium (TIVA); dantrolene immediately available; refer to the MH unit for testing if not done (AAGBI malignant hyperthermia guideline 2011; EMHG 2020).' });
  }
  if (/suxamethonium apnoea|suxamethonium apnea|scoline apnoea|succinylcholine apn\w*|butyrylcholinesterase|pseudocholinesterase|cholinesterase deficiency/.test(s.text)) {
    notes.push({ kind: 'anaesthetic', severity: 'critical', text: 'Suxamethonium apnoea history: avoid suxamethonium and mivacurium (e.g. rocuronium with sugammadex available); alert the anaesthetist; butyrylcholinesterase testing and family screening (RCoA guidance).' });
  }
  const stopBang = /stop-?bang\s*(?:score\s*)?(?:of\s*|=\s*|:\s*)?([0-8])/.exec(s.text);
  if (/\bosa\b|obstructive sleep ap/.test(s.text) || (stopBang && Number(stopBang[1]) >= 5)) {
    notes.push({ kind: 'anaesthetic', severity: 'warning', text: 'Known or suspected obstructive sleep apnoea (STOP-Bang ≥ 5): anaesthetic review before listing; bring CPAP; opioid-sparing analgesia; continuous pulse oximetry after surgery; consider a sleep study (SAMBA 2012; ASA 2014).' });
  }
  return notes;
}

function vteNote(protocol: ManagementProtocol, s: Signals, bleeding: boolean): SafetyNote | null {
  if (s.child) return null; // NICE NG89 covers people aged 16 and over.
  const anticoagulated = drugsPresent(s.meds, [...VKA, ...DOACS]).length > 0;
  const renal = s.egfr !== null && s.egfr < 30
    ? `eGFR/CrCl ${s.egfr} mL/min: enoxaparin 20 mg SC once daily or unfractionated heparin (BNF)`
    : /\b(dialysis|haemodialysis|hemodialysis|esrf|eskd)\b/.test(s.text)
      ? 'on dialysis: unfractionated heparin 5000 units SC 8–12-hourly or a renal-adjusted LMWH per the renal team (BNF)'
      : 'dose-adjust in renal impairment — CrCl < 30 mL/min: 20 mg once daily (BNF)';
  const parts: string[] = ['VTE prophylaxis (NICE NG89 2018): assess VTE and bleeding risk on admission and after surgery.'];
  if (bleeding) {
    parts.push('Active bleeding / high bleeding risk: mechanical prophylaxis (intermittent pneumatic compression) now; start LMWH once haemostasis is secure — reassess daily.');
  } else if (anticoagulated) {
    parts.push('On therapeutic anticoagulation: see the anticoagulation plan; while it is interrupted after surgery use mechanical prophylaxis and prophylactic-dose LMWH when bleeding risk allows.');
  } else {
    parts.push(`Mechanical prophylaxis (anti-embolism stockings or intermittent pneumatic compression) unless contraindicated (e.g. peripheral arterial disease), plus LMWH — e.g. enoxaparin 40 mg SC once daily, ${renal} — from 6–12 h after surgery if bleeding risk allows, for at least 7 days.`);
  }
  const cancer = protocol.cancer || /(^|\s)c\d\d/i.test(protocol.icd10Prefixes.join(' '));
  if (cancer) parts.push('Major abdominal or pelvic cancer surgery: extend pharmacological prophylaxis to 28 days after surgery.');
  if (s.pregnancy.status === 'pregnant') parts.push('Pregnant: LMWH dose by booking weight (RCOG Green-top 37a 2015).');
  return { kind: 'vte', severity: 'warning', text: parts.join(' ') };
}

function pregnancyNotes(protocol: ManagementProtocol, s: Signals, operative: boolean, imaging: boolean): SafetyNote[] {
  const notes: SafetyNote[] = [];
  const p = s.pregnancy;
  if (p.status === 'pregnant' && !protocol.pregnancySpecific) {
    const g = p.gestationWeeks === null ? 'gestation not recorded' : `${p.gestationWeeks} weeks`;
    const parts = [
      `Pregnant (${g}): involve the obstetric team now; fetal heart / CTG monitoring as the obstetric team advises (from viability, about 24 weeks).`,
    ];
    if (p.gestationWeeks === null || p.gestationWeeks >= 20) {
      parts.push('From 20 weeks: left lateral tilt or manual uterine displacement whenever supine (aortocaval compression); no NSAIDs.');
    }
    parts.push('Prefer ultrasound or MRI to CT where they answer the question; DOACs and warfarin (teratogenic) are contraindicated — LMWH if anticoagulation is needed.');
    if (operative && (p.gestationWeeks === null || (p.gestationWeeks >= 24 && p.gestationWeeks < 34))) {
      parts.push('If 24–34 weeks and preterm delivery is possible, the obstetric team to consider antenatal corticosteroids.');
    }
    parts.push('(ACOG Committee Opinions 775 (2019) and 723 (2017); RCOG Green-top 37a.)');
    notes.push({ kind: 'pregnancy', severity: 'critical', text: parts.join(' ') });
  } else if ((p.status === 'possible' || p.status === 'unknown') && s.female && s.age !== null && s.age >= 12 && s.age <= 55 && (operative || imaging)) {
    notes.push({
      kind: 'pregnancy', severity: 'warning',
      text: 'β-HCG: result required before surgery, ionising imaging or a drug that is unsafe in pregnancy — do not record it as negative without a result.',
    });
  }
  return notes;
}

function paediatricNotes(protocol: ManagementProtocol, s: Signals): SafetyNote[] {
  if (!s.child) return [];
  const notes: SafetyNote[] = [];
  if (!protocol.paediatricDosing) {
    notes.push({ kind: 'paediatric', severity: 'critical', text: `Under 16 (${s.age !== null && s.age < 1 ? `${Math.max(0, Math.round(s.age * 12))} months` : `${s.age} years`}): adult doses removed — all doses and fluid volumes are weight-based; calculate per BNFc (fluids per APLS). Paediatric vital-sign ranges apply.` });
  }
  if (s.infant) {
    notes.push({ kind: 'paediatric', severity: 'critical', text: 'Infant: recognise and redirect — same-day paediatric surgical / paediatric emergency assessment; adult templates do not apply.' });
  }
  return notes;
}

const FRAILTY_TEXT = /\b(frail\w*|cfs\s*[5-9]|clinical frailty scale\s*[5-9]|dementia|cognitive impairment|previous (?:post-?operative )?delirium|delirium)\b/;

/** Frailty or cognitive impairment with a procedure or acute illness (CPOC 2021; NICE CG103). */
function frailtyNote(s: Signals): SafetyNote | null {
  const m = FRAILTY_TEXT.exec(s.text);
  if (!(m && (s.age === null || s.age >= 65)) && !(s.age !== null && s.age >= 80)) return null;
  const what = m ? m[1] : `age ${s.age}`;
  return {
    kind: 'frailty', severity: 'warning',
    text: `Frailty / delirium risk (${what}${s.age !== null ? `, age ${s.age}` : ''}): delirium prevention and 4AT screening (NICE CG103); comprehensive geriatric assessment and elderly-medicine (geriatric) input; shared decision-making with goals of care and a treatment-escalation plan documented (CPOC 2021 perioperative care for people living with frailty).`,
  };
}

const EMERGENCY_SURGERY_TEXT = /\b(emergency (?:laparotomy|laparoscopy|surgery|operation|repair|resection|hartmann\w*)|laparotomy)\b/;

/** High-risk (emergency) general surgery: documented mortality risk (NELA; RCS 2018). */
function highRiskSurgeryNote(s: Signals, emergency: boolean): SafetyNote | null {
  if (!emergency || !EMERGENCY_SURGERY_TEXT.test(s.assessment)) return null;
  return {
    kind: 'surgical-risk', severity: 'warning',
    text: 'Emergency laparotomy / high-risk surgery: document the predicted mortality risk pre-operatively (NELA risk calculator or P-POSSUM); if ≥ 5%, consultant surgeon and anaesthetist present and planned post-operative critical care (NELA; RCS 2018 The Higher Risk General Surgical Patient). Age ≥ 65 or frail: elderly-medicine (geriatric) review.',
  };
}

const OESTROGEN = ['combined oral contraceptive', 'combined pill', 'cocp', 'coc', 'ethinylestradiol', 'oestrogen', 'estrogen', 'estradiol', 'hrt', 'hormone replacement'];
const VTE_TEXT = /\b(dvt|deep vein thrombosis|pulmonary embol\w*|\bpe\b|venous thrombo\w*|vte|mesenteric venous|cerebral venous)\b/;

/** Oestrogen-containing contraception / HRT with VTE or before major surgery (FSRH/UKMEC; NICE NG89). */
function oestrogenNote(protocol: ManagementProtocol, s: Signals, procedure: ProcedureKind): SafetyNote | null {
  const found = drugsPresent(s.meds, OESTROGEN);
  if (!found.length) return null;
  const vte = /thromb|embol/.test(protocol.diseaseId) || VTE_TEXT.test(s.assessment);
  if (vte) {
    return { kind: 'hormonal', severity: 'warning', text: `Oestrogen-containing contraceptive / HRT (${found.join(', ')}): a VTE risk factor — stop it and offer non-oestrogen contraception (FSRH/UKMEC 2016; NICE NG158).` };
  }
  if (procedure === 'surgery') {
    return { kind: 'hormonal', severity: 'info', text: `Oestrogen-containing contraceptive / HRT (${found.join(', ')}): consider stopping it 4 weeks before major elective surgery, with alternative contraception (NICE NG89).` };
  }
  return null;
}

function immunosuppressionNote(s: Signals, acuteIllness: boolean): SafetyNote | null {
  const drugs = drugsPresent(s.meds, [...IMMUNOSUPPRESSANTS, ...STEROIDS.filter(d => d !== 'fludrocortisone')]);
  const conditions = /\b(transplant\w*|hiv|aids|chemotherapy|neutropeni\w*|asplen\w*|splenectomy|immunosuppress\w*|immunocompromis\w*)\b/.exec(s.history);
  if (!drugs.length && !conditions) return null;
  const what = [...drugs, ...(conditions ? [conditions[1]] : [])].join(', ');
  const mtx = acuteIllness && drugs.includes('methotrexate')
    ? ' Withhold methotrexate during acute infection or AKI and restart with the prescribing specialist once recovered (BNF; BSR 2017 DMARD guideline).'
    : '';
  return {
    kind: 'immunosuppression', severity: 'warning',
    text: `Immunosuppressed (${what}): fever, peritonism and a raised white cell count may be blunted — lower threshold for imaging, senior review and escalation.${mtx}`,
  };
}

function betaBlockerNote(s: Signals): SafetyNote | null {
  const bb = drugsPresent(s.meds, BETA_BLOCKERS);
  if (!bb.length) return null;
  return {
    kind: 'haemodynamics', severity: 'info',
    text: `Beta-blocker (${bb.join(', ')}): tachycardia may be blunted — heart rate can under-read shock or sepsis (ATLS 10).`,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<SafetyNote['severity'], number> = { critical: 0, warning: 1, info: 2 };

/**
 * Adapts a protocol to the patient on record. Returns a protocol of the same shape (steps,
 * medications and investigations adapted, conditional branches resolved) plus the patient-specific
 * safety lines. Pure and deterministic.
 */
export function adaptProtocolForPatient(
  protocol: ManagementProtocol,
  ctx: PlanPatientContext,
  opts: AdaptOptions = {},
): AdaptedProtocol {
  const s = signalsFor(ctx);
  const withheld: AdaptedProtocol['withheld'] = [];
  const kind = protocol.kind ?? 'surgical';

  const management: ManagementStep[] = [];
  for (const step of protocol.management) {
    if (!conditionHolds(step.onlyIf, s)) continue;
    const v = adaptLine(step.step, protocol, s);
    if (v.withheld) withheld.push({ ...v.withheld, from: 'step' });
    // Two steps replaced by the same line (e.g. the paediatric hernia line) are shown once.
    if (v.text !== step.step && management.some(m => m.step === v.text)) continue;
    management.push(v.text === step.step ? step : { ...step, step: v.text });
  }

  const medications: ProtocolMedication[] = [];
  for (const m of protocol.medications ?? []) {
    if (!conditionHolds(m.onlyIf, s)) continue;
    const adapted = adaptMedication(m, protocol, s, withheld);
    if (adapted) medications.push(adapted);
  }

  // Key points are shown with the plan (ManagementPanel): same filters, e.g. an adult hernia
  // technique in a key point is replaced for a child, a withheld drug is flagged.
  const keyPoints = protocol.keyPoints.map(k => adaptLine(k, protocol, s).text);

  const investigations = protocol.investigations
    .filter(i => conditionHolds(i.onlyIf, s))
    .map(i => adaptInvestigation(i, s));

  const operative = opts.operative ?? hasOperativeSteps(protocol);
  const assessmentBleeding = findingPresent(lower(ctx.assessment).replace(NOT_ACTIVE_BLEEDING, ' '), BLEEDING_TEXT);
  const bleeding = kind === 'bleeding' || assessmentBleeding;
  const procedural = kind === 'surgical' || kind === 'procedure' || kind === 'bleeding';
  const procedure = kind === 'emergency' ? 'none' : procedureFor(protocol, ctx, procedural && operative);
  const acuteIllness = kind === 'emergency' || kind === 'bleeding'
    || protocol.management.some(st => st.phase === 'immediate')
    || findingPresent(lower(ctx.assessment), ACUTE_ILLNESS_TEXT);
  const imaging = investigations.some(i => i.category === 'imaging-ct' || i.category === 'imaging-xr' || IONISING_IMAGING.test(i.label));

  const notes: SafetyNote[] = [];
  notes.push(...paediatricNotes(protocol, s));
  notes.push(...pregnancyNotes(protocol, s, operative && procedural, imaging));
  for (const cls of s.allergy.classes) {
    if (cls.caution && [...management.map(m => m.step), ...medications.map(m => m.drugName)].some(t => affirmedMention(t, cls.caution!.members))) {
      notes.push({ kind: 'allergy', severity: 'warning', text: cls.caution.text });
    }
  }
  if (withheld.some(w => w.reason.startsWith('allergy'))) {
    const names = [...new Set(withheld.filter(w => w.reason.startsWith('allergy')).map(w => w.reason.replace('allergy: ', '')))];
    const classes = [...new Set(s.allergy.classes.filter(c => withheld.some(w => w.reason === `allergy: ${s.allergy.recorded.get(c.id) ?? c.label}`)).map(c => `${c.label} allergy`))];
    notes.push({ kind: 'allergy', severity: 'critical', text: `Allergy cross-check: ${withheld.filter(w => w.reason.startsWith('allergy')).length} item(s) withheld (${classes.length ? classes.join(', ') : 'recorded allergy'}: ${names.join('; ')}) — see the alternatives in the plan.` });
  }
  const emergencyText = findingPresent(lower(ctx.assessment), /\b(emergency|emergent|urgent (?:surgery|laparotomy|operation))\b/);
  notes.push(...anticoagulationNotes(protocol, s, procedure, bleeding && kind !== 'emergency', emergencyText));
  notes.push(...diabetesNotes(s, procedure, acuteIllness));
  const steroid = steroidNote(s, procedure, acuteIllness);
  if (steroid) notes.push(steroid);
  const anaesthetic = procedure !== 'none' ? anaestheticNotes(s) : [];
  notes.push(...anaesthetic);
  if ((procedure === 'surgery' && procedural) || (bleeding && procedural && operative)) {
    const vte = vteNote(protocol, s, bleeding);
    if (vte) notes.push(vte);
  }
  const redFlags = [...protocol.redFlags];
  const frail = procedure !== 'none' || acuteIllness ? frailtyNote(s) : null;
  if (frail) { notes.push(frail); redFlags.push(frail.text); }
  const highRisk = procedure === 'surgery' ? highRiskSurgeryNote(s, emergencyText) : null;
  if (highRisk) notes.push(highRisk);
  const oestrogen = oestrogenNote(protocol, s, procedure);
  if (oestrogen) { notes.push(oestrogen); if (oestrogen.severity !== 'info') redFlags.push(oestrogen.text); }
  const immuno = immunosuppressionNote(s, acuteIllness);
  if (immuno) { notes.push(immuno); redFlags.push(immuno.text); }
  if (acuteIllness) {
    const bb = betaBlockerNote(s);
    if (bb) { notes.push(bb); redFlags.push(bb.text); }
  }
  if (s.renalImpairment && withheld.some(w => w.reason === 'renal impairment')) {
    notes.push({ kind: 'renal', severity: 'warning', text: 'Renal impairment recorded: withhold NSAIDs (removed from this plan); review nephrotoxic and renally cleared drugs (NICE NG148 2019).' });
  }

  notes.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  // Critical patient-specific lines are red flags too (the ManagementPanel shows them once, in its
  // "for this patient" block).
  for (const n of notes) if (n.severity === 'critical' && !redFlags.includes(n.text)) redFlags.push(n.text);
  return { ...protocol, keyPoints: [...new Set(keyPoints)], management, medications, investigations, redFlags, safetyNotes: notes, withheld };
}

/**
 * Applies the same line filters (allergy, pregnancy, renal, paediatric) to free text that goes into
 * a plan next to protocol steps — e.g. a dx-variant plan prefix. Each line is adapted separately.
 */
export function adaptPlanText(text: string, protocol: ManagementProtocol, ctx: PlanPatientContext): string {
  const s = signalsFor(ctx);
  return text.split('\n').map(line => (line.trim() ? adaptLine(line, protocol, s).text : line)).join('\n');
}
