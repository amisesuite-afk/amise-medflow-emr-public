// lifestyle-practices.ts
// Structured social / lifestyle history (ritual fasting, complementary therapies, sleep and
// shift work), clinician-facing safety prompts, and evidence-graded non-drug plan suggestions.
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, Sept 2026) — §4
// (habits and rituals), §6 (hands-on and device therapies), §8 (verdict table) and the matching
// §10 references. Clinical content only; none of this is shown to patients.
//
// Web twin of ios/AmiseMedFlow/Services/LifestylePractices.swift.
// DRIFT NOTE: the value lists, labels, matcher terms, thresholds (age ≥ 65, sleep < 6 h,
// BMI ≥ 30) and every prompt / plan-line string must stay identical to the Swift file. The test
// vectors in artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts are ported one for
// one in ios/AmiseMedFlowTests/LifestylePracticesTests.swift — change both files and both test
// files in the same PR, and bump LIFESTYLE_PRACTICES_VERSION with the registry entry
// `lifestyle-practices` (clinical-content/registry.json).
//
// Safety rules (CLAUDE.md, hazard H-10, "Central diagnosis radiation"):
//   - Deterministic. Nothing here writes to the record: prompts are dismissible and a plan line
//     is added only when the clinician taps it.
//   - No text tells anyone to take, hold, stop or adjust a named medicine. "Medication review
//     recommended" is the limit.
//   - Matching is negation-aware ("no diabetes" never triggers a diabetes prompt).
//
// Pure: no I/O, no React.

import { containsAnyAffirmed, joinClauses, testAffirmed } from './negation';

/** Bump with any rule or wording change; mirrored in clinical-content/registry.json. */
export const LIFESTYLE_PRACTICES_VERSION = '0.1.0';

// ── Stored record ────────────────────────────────────────────────────────────────────────────
// Stored as the `lifestyle` key of patients.pathway_data_json on both platforms (iOS PathwayData
// .lifestyle; web lib/lifestyle-history-db.ts). JSON keys are the property names below.

export const FASTING_PRACTICES = [
  'none', 'ramadan', 'orthodox_lent', 'daniel_fast', 'time_restricted', 'other',
] as const;
export type FastingPractice = typeof FASTING_PRACTICES[number];

export const FASTING_LABELS: Record<FastingPractice, string> = {
  none: 'None',
  ramadan: 'Ramadan',
  orthodox_lent: 'Orthodox or Lent fasting',
  daniel_fast: 'Daniel Fast',
  time_restricted: 'Time-restricted eating / intermittent fasting',
  other: 'Other',
};

export const FASTING_STATUSES = ['current', 'planned', 'not_currently'] as const;
export type FastingStatus = typeof FASTING_STATUSES[number];

export const FASTING_STATUS_LABELS: Record<FastingStatus, string> = {
  current: 'Currently fasting',
  planned: 'Fast planned',
  not_currently: 'Not currently fasting',
};

export const COMPLEMENTARY_THERAPIES = [
  'acupuncture', 'cupping', 'yoga', 'tai_chi', 'mindfulness', 'slow_breathing',
  'detox_cleanse', 'iv_vitamin_drips', 'other',
] as const;
export type ComplementaryTherapy = typeof COMPLEMENTARY_THERAPIES[number];

export const THERAPY_LABELS: Record<ComplementaryTherapy, string> = {
  acupuncture: 'Acupuncture',
  cupping: 'Cupping',
  yoga: 'Yoga',
  tai_chi: 'Tai chi',
  mindfulness: 'Mindfulness / meditation',
  slow_breathing: 'Slow-breathing practice',
  detox_cleanse: 'Detox or cleanse programmes',
  iv_vitamin_drips: 'IV vitamin drips',
  other: 'Other',
};

export interface LifestyleHistory {
  /** Empty = not recorded. 'none' is exclusive (the clinician recorded "does not fast"). */
  fasting: FastingPractice[];
  /** Free text for 'other'. */
  fastingOther: string;
  fastingStatus: FastingStatus | null;
  /** When the next fast is planned (free text, e.g. "Ramadan, February"). */
  fastingWhen: string;
  therapies: ComplementaryTherapy[];
  /** Free text for 'other'. */
  therapiesOther: string;
  /** null = not recorded. */
  nightShift: boolean | null;
  /** Usual hours of sleep a night; null = not recorded. */
  sleepHours: number | null;
}

export function emptyLifestyleHistory(): LifestyleHistory {
  return {
    fasting: [], fastingOther: '', fastingStatus: null, fastingWhen: '',
    therapies: [], therapiesOther: '', nightShift: null, sleepHours: null,
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (typeof x === 'string' && (allowed as readonly string[]).includes(x) && !out.includes(x as T)) out.push(x as T);
  }
  return out;
}

/** Plausible usual sleep (0–24 h), else null. */
export function normaliseSleepHours(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 24) return null;
  return n;
}

/**
 * Tolerant decode of a stored record (unknown keys and values are ignored; a missing key reads
 * as "not recorded"), the same rules as the iOS Codable decoder.
 */
export function parseLifestyleHistory(raw: unknown): LifestyleHistory {
  const h = emptyLifestyleHistory();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return h;
  const o = raw as Record<string, unknown>;
  h.fasting = pick(o.fasting, FASTING_PRACTICES);
  if (h.fasting.includes('none') && h.fasting.length > 1) h.fasting = h.fasting.filter(f => f !== 'none');
  h.fastingOther = str(o.fastingOther);
  h.fastingStatus = typeof o.fastingStatus === 'string' && (FASTING_STATUSES as readonly string[]).includes(o.fastingStatus)
    ? o.fastingStatus as FastingStatus : null;
  h.fastingWhen = str(o.fastingWhen);
  h.therapies = pick(o.therapies, COMPLEMENTARY_THERAPIES);
  h.therapiesOther = str(o.therapiesOther);
  h.nightShift = typeof o.nightShift === 'boolean' ? o.nightShift : null;
  h.sleepHours = normaliseSleepHours(o.sleepHours);
  return h;
}

/** Toggle a fasting practice: 'none' clears the others and vice versa. */
export function toggleFasting(h: LifestyleHistory, f: FastingPractice): LifestyleHistory {
  const on = h.fasting.includes(f);
  let fasting: FastingPractice[];
  if (on) fasting = h.fasting.filter(x => x !== f);
  else if (f === 'none') fasting = ['none'];
  else fasting = [...h.fasting.filter(x => x !== 'none'), f];
  const next: LifestyleHistory = { ...h, fasting };
  if (!fasting.includes('other')) next.fastingOther = '';
  if (fasting.length === 0 || (fasting.length === 1 && fasting[0] === 'none')) {
    next.fastingStatus = null;
    next.fastingWhen = '';
  }
  return next;
}

export function toggleTherapy(h: LifestyleHistory, t: ComplementaryTherapy): LifestyleHistory {
  const on = h.therapies.includes(t);
  const therapies = on ? h.therapies.filter(x => x !== t) : [...h.therapies, t];
  return { ...h, therapies, therapiesOther: therapies.includes('other') ? h.therapiesOther : '' };
}

export function isLifestyleRecorded(h: LifestyleHistory): boolean {
  return h.fasting.length > 0 || h.therapies.length > 0 || h.nightShift !== null || h.sleepHours !== null;
}

/** Any fasting practice recorded (not 'none'). */
export function recordsFasting(h: LifestyleHistory): boolean {
  return h.fasting.some(f => f !== 'none');
}

const RELIGIOUS_FASTS: readonly FastingPractice[] = ['ramadan', 'orthodox_lent', 'daniel_fast', 'other'];

/** A religious or ritual fast is recorded (Ramadan, Orthodox/Lent, Daniel Fast, other). */
export function recordsReligiousFasting(h: LifestyleHistory): boolean {
  return h.fasting.some(f => RELIGIOUS_FASTS.includes(f));
}

/**
 * The recorded fast is current or planned. An unrecorded status counts (safety bias); only
 * "Not currently fasting" switches the fasting prompts off.
 */
export function fastingActiveOrPlanned(h: LifestyleHistory): boolean {
  return h.fastingStatus !== 'not_currently';
}

/** "Detox or cleanse programmes" recorded — for other modules (e.g. supplement / LFT prompts). */
export function usesDetoxOrCleanse(h: LifestyleHistory): boolean {
  return h.therapies.includes('detox_cleanse');
}

/** "IV vitamin drips" recorded — for other modules. */
export function usesIvVitaminDrips(h: LifestyleHistory): boolean {
  return h.therapies.includes('iv_vitamin_drips');
}

/** "5", "5.5" (same output as Swift `%g` for these values). */
export function formatSleepHours(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * The SOAP background (social history) sentence(s), or null when nothing is recorded, e.g.
 * "Fasting: Ramadan (currently fasting). Complementary therapies: Acupuncture, Yoga. Night-shift
 * work; usual sleep 5 h a night."
 */
export function lifestyleSummary(h: LifestyleHistory): string | null {
  const sentences: string[] = [];

  if (h.fasting.length === 1 && h.fasting[0] === 'none') {
    sentences.push('No religious or ritual fasting.');
  } else if (recordsFasting(h)) {
    const names = h.fasting.filter(f => f !== 'none').map(f =>
      f === 'other' ? (h.fastingOther.trim() || 'Other fasting') : FASTING_LABELS[f]);
    let s = `Fasting: ${names.join(', ')}`;
    const when = h.fastingWhen.trim();
    if (h.fastingStatus === 'current') s += ' (currently fasting)';
    else if (h.fastingStatus === 'planned') s += when ? ` (next planned: ${when})` : ' (fast planned)';
    else if (h.fastingStatus === 'not_currently') s += ' (not currently fasting)';
    else if (when) s += ` (next planned: ${when})`;
    sentences.push(`${s}.`);
  }

  if (h.therapies.length > 0) {
    const names = h.therapies.map(t =>
      t === 'other' ? (h.therapiesOther.trim() || 'Other') : THERAPY_LABELS[t]);
    sentences.push(`Complementary therapies: ${names.join(', ')}.`);
  }

  const sleep: string[] = [];
  if (h.nightShift === true) sleep.push('Night-shift work');
  else if (h.nightShift === false) sleep.push('No night-shift work');
  if (h.sleepHours !== null) {
    sleep.push(sleep.length ? `usual sleep ${formatSleepHours(h.sleepHours)} h a night` : `Usual sleep ${formatSleepHours(h.sleepHours)} h a night`);
  }
  if (sleep.length) sentences.push(`${sleep.join('; ')}.`);

  return sentences.length ? sentences.join(' ') : null;
}

// ── Clinical context ─────────────────────────────────────────────────────────────────────────

export interface LifestyleContext {
  lifestyle: LifestyleHistory;
  /** null when the date of birth / age is not recorded. */
  ageYears: number | null;
  /** The clinician-confirmed working diagnosis (and its ICD label), if any. */
  diagnosisText: string;
  /** Problem list: comorbidities / PMH entries and PMH notes, one item per clause. */
  problemText: string;
  /** Chief complaint and presenting symptoms. */
  complaintText: string;
  /** Medication list (names as recorded). */
  medicationText: string;
  /** Latest BMI, or null. */
  bmi: number | null;
  /** A procedure or operation is booked, or this is a pre-operative / procedure visit. */
  procedureBooked: boolean;
}

/** Thresholds — listed for surgeon sign-off (docs/clinical-validation/changes/lifestyle-practices.md). */
export const OLDER_ADULT_AGE = 65;
export const SHORT_SLEEP_HOURS = 6;
export const OBESITY_BMI = 30;

// Terms. Regex source strings are shared verbatim with Swift (NSRegularExpression, ICU).
const DIABETES_PATTERNS = [
  String.raw`(?<!pre[- ])\bdiabet(?:es|ic)\b(?!\s+insipidus)`,
  String.raw`\bt[12]\s?dm\b`,
  String.raw`\bn?iddm\b`,
  String.raw`\btype\s*(?:1|2|i|ii)\s*dm\b`,
];
const INSULIN_PATTERNS = [
  String.raw`\binsulins?\b(?!\s+resist)`,
  String.raw`\b(?:glargine|detemir|degludec|lispro|glulisine|lantus|levemir|tresiba|toujeo|novorapid|humalog|apidra|humulin|novomix|mixtard|actrapid|insulatard|basaglar|fiasp)\b`,
  String.raw`\binsulin\s+aspart\b`,
];
const SULFONYLUREA_PATTERNS = [
  String.raw`\b(?:gliclazide|glibenclamide|glyburide|glimepiride|glipizide|tolbutamide|chlorpropamide|diamicron|amaryl|daonil)\b`,
  String.raw`\bsulph?onylureas?\b`,
  String.raw`\bsulfonylureas?\b`,
];
const FALLS_TERMS = [
  'falls', 'recurrent fall', 'mechanical fall', 'fall risk', 'history of fall', 'fear of falling',
  'frailty', 'frail', 'unsteady', 'poor balance', 'balance problem', 'balance impairment',
];
const BACK_PAIN_TERMS = [
  'low back pain', 'lower back pain', 'back pain', 'backache', 'lumbago', 'lumbar pain',
];
const NECK_PAIN_TERMS = ['neck pain', 'cervical spondylosis'];
const OSTEOARTHRITIS_TERMS = ['osteoarthritis', 'osteoarthrosis', 'degenerative joint disease'];
const HEADACHE_TERMS = ['chronic headache', 'migraine', 'tension headache', 'tension-type headache'];
const DEPRESSION_PATTERNS = [
  String.raw`(?<!\bst[- ])(?<!respiratory )(?<!segment )\bdepressi(?:on|ve)\b`,
  String.raw`\bmdd\b`,
];
const ANXIETY_TERMS = ['anxiety', 'anxious', 'panic attack', 'panic disorder'];
const OBESITY_TERMS = ['obesity', 'obese'];
const HYPERTENSION_TERMS = ['hypertension', 'hypertensive', 'high blood pressure', 'htn'];
const LIPID_TERMS = [
  'dyslipidaemia', 'dyslipidemia', 'hypercholesterolaemia', 'hypercholesterolemia',
  'hyperlipidaemia', 'hyperlipidemia', 'high cholesterol',
];
const CARDIOVASCULAR_TERMS = [
  'ischaemic heart disease', 'ischemic heart disease', 'ihd', 'coronary artery disease',
  'coronary heart disease', 'angina', 'myocardial infarction', 'heart attack', 'heart failure',
  'stroke', 'metabolic syndrome', 'peripheral arterial disease', 'peripheral vascular disease',
];

function anyPattern(text: string, patterns: readonly string[]): boolean {
  if (!text) return false;
  return patterns.some(p => testAffirmed(new RegExp(p, 'i'), text));
}

function anyTerm(text: string, terms: readonly string[]): boolean {
  if (!text) return false;
  return containsAnyAffirmed(text, terms, { wholeWord: true });
}

interface Findings {
  clinical: string;
  diabetes: boolean;
  insulinOrSulfonylurea: boolean;
  obesity: boolean;
  cardiometabolic: boolean;
  olderAdult: boolean;
  fallsOrFrailty: boolean;
  backPain: boolean;
  chronicPain: boolean;
  depression: boolean;
  anxiety: boolean;
}

function findings(ctx: LifestyleContext): Findings {
  const clinical = joinClauses([ctx.diagnosisText, ctx.problemText, ctx.complaintText]);
  const drugText = joinClauses([ctx.medicationText, ctx.problemText]);
  const diabetes = anyPattern(clinical, DIABETES_PATTERNS);
  const insulinOrSulfonylurea = anyPattern(drugText, INSULIN_PATTERNS) || anyPattern(drugText, SULFONYLUREA_PATTERNS);
  const obesity = (ctx.bmi !== null && ctx.bmi >= OBESITY_BMI) || anyTerm(clinical, OBESITY_TERMS);
  const cardiometabolic = diabetes || obesity || anyTerm(clinical, HYPERTENSION_TERMS)
    || anyTerm(clinical, LIPID_TERMS) || anyTerm(clinical, CARDIOVASCULAR_TERMS);
  const backPain = anyTerm(clinical, BACK_PAIN_TERMS);
  return {
    clinical,
    diabetes,
    insulinOrSulfonylurea,
    obesity,
    cardiometabolic,
    olderAdult: ctx.ageYears !== null && ctx.ageYears >= OLDER_ADULT_AGE,
    fallsOrFrailty: anyTerm(clinical, FALLS_TERMS),
    backPain,
    chronicPain: backPain || anyTerm(clinical, NECK_PAIN_TERMS) || anyTerm(clinical, OSTEOARTHRITIS_TERMS)
      || anyTerm(clinical, HEADACHE_TERMS),
    depression: anyPattern(clinical, DEPRESSION_PATTERNS),
    anxiety: anyTerm(clinical, ANXIETY_TERMS),
  };
}

// ── Safety prompts ───────────────────────────────────────────────────────────────────────────

export type LifestylePromptGrade = 'warning' | 'caution' | 'info';

export interface LifestylePrompt {
  id: string;
  grade: LifestylePromptGrade;
  text: string;
  source: string;
}

export const IDF_DAR_SOURCE =
  'IDF-DAR Diabetes and Ramadan: Practical Guidelines 2021 (cited in the practice evidence briefing, Sept 2026, §4)';
const BRIEFING_FASTING_SOURCE = 'Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 — Ramadan and Orthodox fasting';
const BRIEFING_SLEEP_SOURCE = 'Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 and §8 — sleep, circadian timing and protected rest';

export const PROMPT_TEXT = {
  fastingInsulin: 'Fasting with insulin/sulfonylurea: risk of hypoglycaemia and dehydration — pre-fast risk stratification and medication review recommended (IDF-DAR 2021).',
  fastingDiabetes: 'Fasting with diabetes: risk of hypoglycaemia and dehydration — pre-fast risk stratification recommended (IDF-DAR 2021).',
  fastingPeriop: 'Religious fast overlaps the pre-operative fast — check hydration and glucose plan.',
  nightShiftSleep: 'Night-shift work / short sleep is associated with metabolic, cardiovascular and mood disorders.',
} as const;

/**
 * Clinician-facing prompts, most serious first. Each is dismissible in the UI and changes
 * nothing by itself.
 */
export function lifestyleSafetyPrompts(ctx: LifestyleContext): LifestylePrompt[] {
  const h = ctx.lifestyle;
  const f = findings(ctx);
  const out: LifestylePrompt[] = [];
  const fastingNow = recordsFasting(h) && fastingActiveOrPlanned(h);

  if (fastingNow && f.diabetes) {
    out.push(f.insulinOrSulfonylurea
      ? { id: 'fasting-diabetes-insulin-su', grade: 'warning', text: PROMPT_TEXT.fastingInsulin, source: IDF_DAR_SOURCE }
      : { id: 'fasting-diabetes', grade: 'caution', text: PROMPT_TEXT.fastingDiabetes, source: IDF_DAR_SOURCE });
  }
  if (recordsReligiousFasting(h) && fastingActiveOrPlanned(h) && ctx.procedureBooked) {
    out.push({ id: 'fasting-perioperative', grade: 'caution', text: PROMPT_TEXT.fastingPeriop, source: BRIEFING_FASTING_SOURCE });
  }
  const shortSleep = h.sleepHours !== null && h.sleepHours < SHORT_SLEEP_HOURS;
  if ((h.nightShift === true || shortSleep) && f.cardiometabolic) {
    out.push({ id: 'night-shift-short-sleep', grade: 'info', text: PROMPT_TEXT.nightShiftSleep, source: BRIEFING_SLEEP_SOURCE });
  }
  return out;
}

// ── Non-drug plan suggestions ────────────────────────────────────────────────────────────────

/** Grade labels from the briefing's verdict table (§8) and §6. */
export type EvidenceGrade = 'Works' | 'Modest' | 'Mixed' | 'No benefit shown';

export type LifestyleSuggestionKind = 'suggestion' | 'counsel';

export interface LifestyleSuggestion {
  id: string;
  kind: LifestyleSuggestionKind;
  practice: string;
  evidence: EvidenceGrade;
  /** Why it is shown for this patient. */
  reason: string;
  /** The line added to the plan when the clinician taps it. */
  planLine: string;
  source: string;
  /** The patient already records this practice. */
  alreadyUsed: boolean;
}

export const SOURCES = {
  taiChi: 'Huang ZG et al. Tai Chi for fall prevention and balance improvement in older adults: systematic review and meta-analysis of RCTs. Front Public Health 2023 (24 RCTs; falls RR 0.76).',
  yoga: 'Saper RB et al. Yoga, physical therapy, or education for chronic low back pain: a randomized noninferiority trial. Ann Intern Med 2017;167:85-94.',
  mbct: 'Kuyken W et al. Efficacy of MBCT in prevention of depressive relapse: an individual patient data meta-analysis. JAMA Psychiatry 2016;73:565-74 (relapse HR 0.69).',
  slowBreathing: 'Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 and §8 — slow breathing (no primary reference listed).',
  acupuncture: 'Vickers AJ et al. Acupuncture for chronic pain: individual patient data meta-analysis. Arch Intern Med 2012; update J Pain 2018.',
  timeRestricted: 'Liu D et al. Calorie restriction with or without time-restricted eating in weight loss. N Engl J Med 2022;386:1495-1504.',
  cuppingDetox: 'Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §6 and §8 — cupping, detox teas, colon cleanses (no benefit).',
  ivDrips: 'Practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §6 — "biohacking" add-ons: IV vitamin drips (mixed).',
} as const;

export const PLAN_LINES = {
  taiChi: 'Non-drug: tai chi programme for balance and falls prevention (evidence: works — 24 RCTs, falls RR 0.76; Huang ZG et al. 2023).',
  yoga: 'Non-drug: structured yoga programme for chronic non-specific low back pain (evidence: works — non-inferior to physical therapy; Saper RB et al., Ann Intern Med 2017).',
  mbct: 'Referral option: mindfulness-based cognitive therapy (MBCT) for relapse prevention in recurrent depression (evidence: works — HR 0.69; Kuyken W et al., JAMA Psychiatry 2016).',
  slowBreathing: 'Non-drug: slow breathing (about 6 breaths a minute) for short-term anxiety relief, e.g. before the procedure — not a treatment for high blood pressure (evidence: modest).',
  acupuncture: 'Referral option: acupuncture for chronic pain (evidence: modest — small margin over sham; Vickers AJ et al., Arch Intern Med 2012).',
  timeRestricted: 'Non-drug: time-restricted eating as an adherence strategy for weight management — weight loss similar to calorie restriction (evidence: modest; Liu D et al., NEJM 2022).',
  timeRestrictedDiabetesNote: 'Diabetes on insulin/sulfonylurea: hypoglycaemia risk during fasting windows — pre-fast risk stratification and medication review recommended before starting (IDF-DAR 2021).',
  cupping: 'Discussed cupping: no reliable evidence of benefit beyond placebo.',
  detox: 'Discussed detox teas / colon cleanses: no reliable evidence of benefit; risks of dehydration, electrolyte disturbance and laxative dependence.',
  ivDrips: 'Discussed IV vitamin drips: little outcome evidence outside a specific medical indication; risks of infection and fluid overload.',
} as const;

const CUPPING_TEXT = ['cupping', 'hijama'];
const DETOX_TEXT = ['detox', 'cleanse', 'colon cleanse', 'colonic', 'colonic irrigation'];
const IV_DRIP_TEXT = ['iv drip', 'iv vitamin', 'vitamin drip', 'drip therapy', 'nad drip', 'myers cocktail'];

/**
 * Evidence-graded non-drug suggestions for this patient, in a fixed order. Nothing is added to
 * the plan until the clinician taps a suggestion.
 */
export function lifestylePlanSuggestions(ctx: LifestyleContext): LifestyleSuggestion[] {
  const h = ctx.lifestyle;
  const f = findings(ctx);
  const out: LifestyleSuggestion[] = [];
  const uses = (t: ComplementaryTherapy) => h.therapies.includes(t);
  const otherText = h.therapiesOther;

  if (f.olderAdult || f.fallsOrFrailty) {
    const reasons: string[] = [];
    if (f.olderAdult) reasons.push(`Age ${ctx.ageYears} (≥ ${OLDER_ADULT_AGE})`);
    if (f.fallsOrFrailty) reasons.push('falls or frailty recorded');
    if (f.olderAdult && ctx.procedureBooked) reasons.push('post-operative rehabilitation');
    out.push({
      id: 'tai-chi', kind: 'suggestion', practice: 'Tai chi', evidence: 'Works',
      reason: reasons.join('; '), planLine: PLAN_LINES.taiChi, source: SOURCES.taiChi,
      alreadyUsed: uses('tai_chi'),
    });
  }
  if (f.backPain) {
    out.push({
      id: 'yoga', kind: 'suggestion', practice: 'Yoga', evidence: 'Works',
      reason: 'Low back pain recorded (evidence is for chronic non-specific low back pain)',
      planLine: PLAN_LINES.yoga, source: SOURCES.yoga, alreadyUsed: uses('yoga'),
    });
  }
  if (f.depression) {
    out.push({
      id: 'mbct', kind: 'suggestion', practice: 'Mindfulness-based cognitive therapy (MBCT)', evidence: 'Works',
      reason: 'Depression recorded (evidence is for relapse prevention in recurrent depression)',
      planLine: PLAN_LINES.mbct, source: SOURCES.mbct, alreadyUsed: uses('mindfulness'),
    });
  }
  if (f.anxiety) {
    out.push({
      id: 'slow-breathing', kind: 'suggestion', practice: 'Slow breathing (about 6 breaths a minute)', evidence: 'Modest',
      reason: ctx.procedureBooked ? 'Anxiety recorded; procedure booked' : 'Anxiety recorded',
      planLine: PLAN_LINES.slowBreathing, source: SOURCES.slowBreathing, alreadyUsed: uses('slow_breathing'),
    });
  }
  if (f.chronicPain) {
    out.push({
      id: 'acupuncture', kind: 'suggestion', practice: 'Acupuncture', evidence: 'Modest',
      reason: 'Back or neck pain, osteoarthritis or chronic headache recorded (evidence is for chronic pain)',
      planLine: PLAN_LINES.acupuncture, source: SOURCES.acupuncture, alreadyUsed: uses('acupuncture'),
    });
  }
  if (f.obesity) {
    const withNote = f.diabetes && f.insulinOrSulfonylurea;
    out.push({
      id: 'time-restricted-eating', kind: 'suggestion', practice: 'Time-restricted eating', evidence: 'Modest',
      reason: ctx.bmi !== null && ctx.bmi >= OBESITY_BMI ? `BMI ${Math.round(ctx.bmi * 10) / 10} (≥ ${OBESITY_BMI})` : 'Obesity recorded',
      planLine: withNote ? `${PLAN_LINES.timeRestricted} ${PLAN_LINES.timeRestrictedDiabetesNote}` : PLAN_LINES.timeRestricted,
      source: withNote ? `${SOURCES.timeRestricted} ${IDF_DAR_SOURCE}` : SOURCES.timeRestricted,
      alreadyUsed: h.fasting.includes('time_restricted'),
    });
  }

  // "No benefit shown" information: only when the patient's record lists the practice.
  if (uses('cupping') || anyTerm(otherText, CUPPING_TEXT)) {
    out.push({
      id: 'counsel-cupping', kind: 'counsel', practice: 'Cupping', evidence: 'No benefit shown',
      reason: 'Cupping recorded', planLine: PLAN_LINES.cupping, source: SOURCES.cuppingDetox, alreadyUsed: true,
    });
  }
  if (usesDetoxOrCleanse(h) || anyTerm(otherText, DETOX_TEXT)) {
    out.push({
      id: 'counsel-detox', kind: 'counsel', practice: 'Detox teas and colon cleanses', evidence: 'No benefit shown',
      reason: 'Detox or cleanse programme recorded', planLine: PLAN_LINES.detox, source: SOURCES.cuppingDetox, alreadyUsed: true,
    });
  }
  if (usesIvVitaminDrips(h) || anyTerm(otherText, IV_DRIP_TEXT)) {
    out.push({
      id: 'counsel-iv-drips', kind: 'counsel', practice: 'IV vitamin drips', evidence: 'Mixed',
      reason: 'IV vitamin drips recorded', planLine: PLAN_LINES.ivDrips, source: SOURCES.ivDrips, alreadyUsed: true,
    });
  }
  return out;
}

/**
 * The plan after the clinician taps "Add": the line goes on its own line at the end; a line
 * already in the plan is not added twice.
 */
export function appendPlanLine(plan: string, line: string): string {
  const current = plan ?? '';
  if (current.includes(line)) return current;
  const trimmed = current.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n${line}` : line;
}
