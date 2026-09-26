// lifestyle-practices.ts
// Structured social / lifestyle history (ritual fasting, complementary therapies, sleep and
// shift work), clinician-facing safety prompts, and evidence-graded non-drug plan suggestions.
//
// Source: the practice owner's evidence briefing (Dr Dawit Daniel Kabiye, Sept 2026) — §4
// (habits and rituals), §6 (hands-on and device therapies), §8 (verdict table) and the matching
// §10 references. Clinical content only; none of this is shown to patients.
//
// Web twin of ios/AmiseMedFlow/Services/LifestylePractices.swift. The content lives once, as
// data: clinical-content/rules/lifestyle-practices.json (schema
// clinical-content/schemas/lifestyle-practices.schema.json) holds the labels, thresholds (age ≥ 65,
// sleep < 6 h, BMI ≥ 30), matcher terms and regex patterns, and every prompt, plan-line, source,
// practice, evidence-grade and reason string. iOS reads the same file. Change the JSON, not a
// platform copy; `lint:shared-content` validates it and checks these types and the Swift Codable
// structs against the schema. The rule logic below (which finding raises which prompt or
// suggestion) is mirrored in the Swift file: the test vectors in
// artifacts/dashboard/src/lib/__tests__/lifestyle-practices.test.ts are ported one for one in
// ios/AmiseMedFlowTests/LifestylePracticesTests.swift — change both files and both test files in
// the same PR, and bump the JSON `version` with the registry entry `lifestyle-practices`
// (clinical-content/registry.json).
//
// Safety rules (CLAUDE.md, hazard H-10, "Central diagnosis radiation"):
//   - Deterministic. Nothing here writes to the record: prompts are dismissible and a plan line
//     is added only when the clinician taps it.
//   - No text tells anyone to take, hold, stop or adjust a named medicine. "Medication review
//     recommended" is the limit.
//   - Matching is negation-aware ("no diabetes" never triggers a diabetes prompt).
//
// Pure: no I/O, no React.

import rawLifestylePractices from '../../../clinical-content/rules/lifestyle-practices.json';
import { containsAnyAffirmed, joinClauses, testAffirmed } from './negation';

// ── Shared content (clinical-content/rules/lifestyle-practices.json) ─────────────────────────

/** Grade labels from the briefing's verdict table (§8) and §6. */
export type EvidenceGrade = 'Works' | 'Modest' | 'Mixed' | 'No benefit shown';

export interface LifestyleThresholds { olderAdultAge: number; shortSleepHours: number; obesityBMI: number }
export interface LifestyleLabels {
  fasting: Record<string, string>;
  fastingStatus: Record<string, string>;
  therapies: Record<string, string>;
}
export interface LifestylePatterns { diabetes: string[]; insulin: string[]; sulfonylurea: string[]; depression: string[] }
export interface LifestyleTerms {
  falls: string[];
  backPain: string[];
  neckPain: string[];
  osteoarthritis: string[];
  headache: string[];
  anxiety: string[];
  obesity: string[];
  hypertension: string[];
  lipid: string[];
  cardiovascular: string[];
  cupping: string[];
  detox: string[];
  ivDrip: string[];
}
export interface LifestylePromptTexts { fastingInsulin: string; fastingDiabetes: string; fastingPeriop: string; nightShiftSleep: string }
export interface LifestylePromptSources { idfDar: string; briefingFasting: string; briefingSleep: string }
export interface LifestyleSources {
  taiChi: string;
  yoga: string;
  mbct: string;
  slowBreathing: string;
  acupuncture: string;
  timeRestricted: string;
  cuppingDetox: string;
  ivDrips: string;
}
export interface LifestylePlanLines {
  taiChi: string;
  yoga: string;
  mbct: string;
  slowBreathing: string;
  acupuncture: string;
  timeRestricted: string;
  timeRestrictedDiabetesNote: string;
  cupping: string;
  detox: string;
  ivDrips: string;
}
export interface LifestyleSuggestionText { practice: string; evidence: EvidenceGrade }
export interface LifestyleReasons {
  fallsOrFrailty: string;
  postOperativeRehabilitation: string;
  backPain: string;
  depression: string;
  anxiety: string;
  anxietyProcedure: string;
  chronicPain: string;
  obesity: string;
  cupping: string;
  detox: string;
  ivDrips: string;
}

/** clinical-content/rules/lifestyle-practices.json (checked against its schema by lint:shared-content). */
export interface LifestyleContent {
  id: string;
  version: string;
  thresholds: LifestyleThresholds;
  labels: LifestyleLabels;
  patterns: LifestylePatterns;
  terms: LifestyleTerms;
  promptText: LifestylePromptTexts;
  promptSources: LifestylePromptSources;
  sources: LifestyleSources;
  planLines: LifestylePlanLines;
  suggestions: Record<string, LifestyleSuggestionText>;
  reasons: LifestyleReasons;
}

const CONTENT = rawLifestylePractices as unknown as LifestyleContent;

/** The JSON `version`; bump with any rule or wording change, with the registry entry. */
export const LIFESTYLE_PRACTICES_VERSION: string = CONTENT.version;

// ── Stored record ────────────────────────────────────────────────────────────────────────────
// Stored as the `lifestyle` key of patients.pathway_data_json on both platforms (iOS PathwayData
// .lifestyle; web lib/lifestyle-history-db.ts). JSON keys are the property names below.

export const FASTING_PRACTICES = [
  'none', 'ramadan', 'orthodox_lent', 'daniel_fast', 'time_restricted', 'other',
] as const;
export type FastingPractice = typeof FASTING_PRACTICES[number];

/** Display labels (JSON `labels.fasting`; its keys are FASTING_PRACTICES, in order — tested). */
export const FASTING_LABELS = CONTENT.labels.fasting as Record<FastingPractice, string>;

export const FASTING_STATUSES = ['current', 'planned', 'not_currently'] as const;
export type FastingStatus = typeof FASTING_STATUSES[number];

/** Display labels (JSON `labels.fastingStatus`; keys are FASTING_STATUSES, in order — tested). */
export const FASTING_STATUS_LABELS = CONTENT.labels.fastingStatus as Record<FastingStatus, string>;

export const COMPLEMENTARY_THERAPIES = [
  'acupuncture', 'cupping', 'yoga', 'tai_chi', 'mindfulness', 'slow_breathing',
  'detox_cleanse', 'iv_vitamin_drips', 'other',
] as const;
export type ComplementaryTherapy = typeof COMPLEMENTARY_THERAPIES[number];

/** Display labels (JSON `labels.therapies`; keys are COMPLEMENTARY_THERAPIES, in order — tested). */
export const THERAPY_LABELS = CONTENT.labels.therapies as Record<ComplementaryTherapy, string>;

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

/** Thresholds (JSON `thresholds`) — listed for surgeon sign-off (docs/clinical-validation/changes/lifestyle-practices.md). */
export const OLDER_ADULT_AGE: number = CONTENT.thresholds.olderAdultAge;
export const SHORT_SLEEP_HOURS: number = CONTENT.thresholds.shortSleepHours;
export const OBESITY_BMI: number = CONTENT.thresholds.obesityBMI;

// Terms (JSON `terms`, `patterns`). Regex source strings are shared verbatim with Swift
// (NSRegularExpression, ICU), so they must be valid in both engines.
const DIABETES_PATTERNS = CONTENT.patterns.diabetes;
const INSULIN_PATTERNS = CONTENT.patterns.insulin;
const SULFONYLUREA_PATTERNS = CONTENT.patterns.sulfonylurea;
const FALLS_TERMS = CONTENT.terms.falls;
const BACK_PAIN_TERMS = CONTENT.terms.backPain;
const NECK_PAIN_TERMS = CONTENT.terms.neckPain;
const OSTEOARTHRITIS_TERMS = CONTENT.terms.osteoarthritis;
const HEADACHE_TERMS = CONTENT.terms.headache;
const DEPRESSION_PATTERNS = CONTENT.patterns.depression;
const ANXIETY_TERMS = CONTENT.terms.anxiety;
const OBESITY_TERMS = CONTENT.terms.obesity;
const HYPERTENSION_TERMS = CONTENT.terms.hypertension;
const LIPID_TERMS = CONTENT.terms.lipid;
const CARDIOVASCULAR_TERMS = CONTENT.terms.cardiovascular;

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

/** JSON `promptSources.idfDar`. */
export const IDF_DAR_SOURCE: string = CONTENT.promptSources.idfDar;
const BRIEFING_FASTING_SOURCE = CONTENT.promptSources.briefingFasting;
const BRIEFING_SLEEP_SOURCE = CONTENT.promptSources.briefingSleep;

/** JSON `promptText`. */
export const PROMPT_TEXT: Readonly<LifestylePromptTexts> = CONTENT.promptText;

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

/** JSON `sources`. */
export const SOURCES: Readonly<LifestyleSources> = CONTENT.sources;

/** JSON `planLines`. */
export const PLAN_LINES: Readonly<LifestylePlanLines> = CONTENT.planLines;

const REASONS = CONTENT.reasons;
const CUPPING_TEXT = CONTENT.terms.cupping;
const DETOX_TEXT = CONTENT.terms.detox;
const IV_DRIP_TEXT = CONTENT.terms.ivDrip;

/** A suggestion's display name and evidence grade (JSON `suggestions`) with its patient-specific fields. */
function suggestion(
  id: string, kind: LifestyleSuggestionKind, reason: string, planLine: string, source: string, alreadyUsed: boolean,
): LifestyleSuggestion {
  const text = CONTENT.suggestions[id];
  if (!text) throw new Error(`lifestyle-practices.json: no suggestions["${id}"]`);
  return { id, kind, practice: text.practice, evidence: text.evidence, reason, planLine, source, alreadyUsed };
}

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
    if (f.fallsOrFrailty) reasons.push(REASONS.fallsOrFrailty);
    if (f.olderAdult && ctx.procedureBooked) reasons.push(REASONS.postOperativeRehabilitation);
    out.push(suggestion('tai-chi', 'suggestion', reasons.join('; '), PLAN_LINES.taiChi, SOURCES.taiChi, uses('tai_chi')));
  }
  if (f.backPain) {
    out.push(suggestion('yoga', 'suggestion', REASONS.backPain, PLAN_LINES.yoga, SOURCES.yoga, uses('yoga')));
  }
  if (f.depression) {
    out.push(suggestion('mbct', 'suggestion', REASONS.depression, PLAN_LINES.mbct, SOURCES.mbct, uses('mindfulness')));
  }
  if (f.anxiety) {
    out.push(suggestion('slow-breathing', 'suggestion', ctx.procedureBooked ? REASONS.anxietyProcedure : REASONS.anxiety,
      PLAN_LINES.slowBreathing, SOURCES.slowBreathing, uses('slow_breathing')));
  }
  if (f.chronicPain) {
    out.push(suggestion('acupuncture', 'suggestion', REASONS.chronicPain, PLAN_LINES.acupuncture, SOURCES.acupuncture,
      uses('acupuncture')));
  }
  if (f.obesity) {
    const withNote = f.diabetes && f.insulinOrSulfonylurea;
    out.push(suggestion('time-restricted-eating', 'suggestion',
      ctx.bmi !== null && ctx.bmi >= OBESITY_BMI ? `BMI ${Math.round(ctx.bmi * 10) / 10} (≥ ${OBESITY_BMI})` : REASONS.obesity,
      withNote ? `${PLAN_LINES.timeRestricted} ${PLAN_LINES.timeRestrictedDiabetesNote}` : PLAN_LINES.timeRestricted,
      withNote ? `${SOURCES.timeRestricted} ${IDF_DAR_SOURCE}` : SOURCES.timeRestricted,
      h.fasting.includes('time_restricted')));
  }

  // "No benefit shown" information: only when the patient's record lists the practice.
  if (uses('cupping') || anyTerm(otherText, CUPPING_TEXT)) {
    out.push(suggestion('counsel-cupping', 'counsel', REASONS.cupping, PLAN_LINES.cupping, SOURCES.cuppingDetox, true));
  }
  if (usesDetoxOrCleanse(h) || anyTerm(otherText, DETOX_TEXT)) {
    out.push(suggestion('counsel-detox', 'counsel', REASONS.detox, PLAN_LINES.detox, SOURCES.cuppingDetox, true));
  }
  if (usesIvVitaminDrips(h) || anyTerm(otherText, IV_DRIP_TEXT)) {
    out.push(suggestion('counsel-iv-drips', 'counsel', REASONS.ivDrips, PLAN_LINES.ivDrips, SOURCES.ivDrips, true));
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
