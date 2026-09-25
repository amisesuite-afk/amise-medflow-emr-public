/**
 * Clinical validation — shared types.
 *
 * The vignette format is docs/clinical-validation/vignette.schema.json. The iOS harness
 * (ios/AmiseMedFlowTests/ClinicalValidation/) mirrors these shapes in Swift; keep the result
 * record (ClinvalResult) field names identical on both sides, because report.ts merges them.
 */

export type Platform = 'ios' | 'web';
export const PLATFORMS: Platform[] = ['ios', 'web'];

export type Severity = 'critical' | 'quality';
export type Level = 'routine' | 'priority' | 'urgent' | 'emergency';
export const LEVELS: Level[] = ['routine', 'priority', 'urgent', 'emergency'];

/** true = every platform; an array = only those platforms. */
export type PlatformFlag = boolean | Platform[];

export interface ExpectationBase {
  id: string;
  severity: Severity;
  platforms?: Platform[];
  knownGap?: PlatformFlag;
  knownGapNote?: string;
  unverified?: PlatformFlag;
  guidelineRefs?: string[];
  note?: string;
  proposedFix?: string;
}

export interface DxExpectation extends ExpectationBase {
  match: string[];
  unless?: string[];
  k?: number;
  source?: string;
}

export interface TextExpectation extends ExpectationBase {
  match: string[];
  unless?: string[];
  sources?: string[];
}

export interface ScoreRecommendedExpectation extends ExpectationBase {
  score: string;
}

export interface ScoreValueExpectation extends ExpectationBase {
  score: string;
  mode: 'calculator' | 'autofill';
  equals?: number;
  min?: number;
  max?: number;
}

export interface LevelExpectation extends ExpectationBase {
  atLeast?: Level;
  atMost?: Level;
}

export interface EqualsExpectation extends ExpectationBase {
  equals: string;
}

export interface Expected {
  differential?: { mustRankTopK?: DxExpectation[]; mustNotMiss?: DxExpectation[] };
  safety?: {
    emergencyLevel?: LevelExpectation;
    mustAlarm?: TextExpectation[];
    mustNotAlarm?: TextExpectation[];
    redFlags?: TextExpectation[];
  };
  scores?: { recommended?: ScoreRecommendedExpectation[]; values?: ScoreValueExpectation[] };
  investigations?: { mustInclude?: TextExpectation[]; mustExclude?: TextExpectation[] };
  management?: { mustInclude?: TextExpectation[]; mustExclude?: TextExpectation[] };
  pathway?: EqualsExpectation;
  dxVariant?: EqualsExpectation;
  /**
   * Diagnostic reasoning layer (web.reasoning / ios.reasoning): alerts, zebras, discriminators,
   * time-out, for / against / missing / doesn't fit, longitudinal lines. Filter with `sources`
   * (e.g. ["web.reasoning.alert", "ios.reasoning.alert"]).
   */
  reasoning?: { mustInclude?: TextExpectation[]; mustExclude?: TextExpectation[] };
}

export interface VitalsInput {
  minutesAgo?: number;
  heartRate?: number;
  systolicBp?: number;
  diastolicBp?: number;
  respiratoryRate?: number;
  temperatureC?: number;
  spo2?: number;
  avpu?: 'A' | 'C' | 'V' | 'P' | 'U';
  onSupplementalO2?: boolean;
  glucoseMmol?: number;
  weightKg?: number;
}

export interface LabInput {
  analyte: string;
  name: string;
  value?: number;
  unit?: string;
  resultText?: string;
  minutesAgo?: number;
}

export interface ImagingInput {
  name: string;
  modality: 'US' | 'CT' | 'MRI' | 'XR' | 'Endoscopy' | 'Other';
  region?: string;
  result: string;
  minutesAgo?: number;
}

export type ScoreForm = Record<string, boolean | number | string | string[]>;

export interface VignetteInputs {
  patient: {
    ageYears: number;
    sex: 'male' | 'female' | 'unspecified';
    pregnancy?: { status: 'not-applicable' | 'not-pregnant' | 'pregnant' | 'unknown'; gestationWeeks?: number };
    heightCm?: number;
    weightKg?: number;
  };
  encounter: {
    setting: 'outpatient' | 'inpatient' | 'emergency' | 'theatre' | 'endoscopy';
    visitType?: string;
    acuity?: Level;
    isPostOp?: boolean;
    postOpDays?: number;
  };
  chiefComplaint: string;
  hpi: string;
  socrates?: Partial<Record<'onset' | 'site' | 'character' | 'radiation' | 'associations' | 'timing' | 'exacerbating' | 'relieving' | 'severity', string[]>>;
  symptoms?: string[];
  negatives?: string[];
  exam?: Partial<Record<'general' | 'abdomen' | 'cardiovascular' | 'respiratory' | 'neuro' | 'msk' | 'skin' | 'other', string>>;
  vitals?: VitalsInput[];
  labs?: LabInput[];
  imaging?: ImagingInput[];
  comorbidities?: string[];
  surgicalHistory?: string[];
  medications?: { drug: string; dose?: string; frequency?: string; indication?: string }[];
  allergies?: { name: string; severity: 'Mild' | 'Moderate' | 'Severe'; reaction?: string }[];
  nkda?: boolean;
  socialHistory?: string;
  scoreForms?: Record<string, ScoreForm>;
  confirmedDiagnosis?: { name: string; icd10?: string; paneDiseaseId?: string; assessmentText?: string };
  platform?: {
    ios?: { socratesSelections?: Record<string, string[]>; specialtyHint?: string };
    web?: {
      ccTemplate?: string;
      socratesAnswers?: Record<string, string>;
      symptoms?: string[];
      symptomDetails?: Record<string, string[]>;
      examFindings?: Record<string, string[]>;
      paneAnswers?: Record<string, boolean>;
      toxicHabits?: string[];
      durationDays?: number;
      painScore?: number;
    };
  };
}

export interface GuidelineRef {
  id: string;
  name: string;
  year: number;
  section: string;
  citation?: string;
  verified?: boolean;
}

export interface Vignette {
  schemaVersion: 1;
  id: string;
  condition: string;
  category: string;
  permutationOf: string | null;
  permutationLabel?: string;
  summary?: string;
  tags?: string[];
  inputs: VignetteInputs;
  expected: Expected;
  guideline: GuidelineRef[];
  rationale: string;
  authoring?: { author?: string; reviewedBy?: string; date?: string; notes?: string };
}

// ── Engine outputs (normalised, per platform) ────────────────────────────────

export interface DxItem { rank: number; name: string; id?: string; icd10?: string; score?: number }
export interface SourcedText { source: string; text: string }
export interface AlarmItem { source: string; title: string; detail: string; severity: string }
export interface ScoreValueItem {
  score: string;
  mode: 'calculator' | 'autofill';
  source: string;
  value: number | null;
  label?: string;
  pending?: string[];
}

export interface EngineOutputs {
  differentials: Record<string, DxItem[]>;
  alarms: AlarmItem[];
  redFlags: SourcedText[];
  emergencyLevel: { level: Level | null; raw: string; source: string } | null;
  recommendedScores: { source: string; score: string; raw: string }[];
  scoreValues: ScoreValueItem[];
  investigations: SourcedText[];
  management: SourcedText[];
  pathway: { value: string; reasons: string[] } | null;
  dxVariant: { value: string | null; group: string | null } | null;
  /**
   * Diagnostic reasoning lines, source '<platform>.reasoning.<part>' (part: alert, zebra,
   * discriminator, timeout, for, against, missing, doesntfit, longitudinal). Absent in results
   * produced before the reasoning layer existed (graded n/a).
   */
  reasoning?: SourcedText[];
  /**
   * Engine mode and content versions the run used, e.g. iOS
   * { bayesDatabase: 'fallback', databaseVersion: '…', databaseError: '…' }. Differential results
   * are only comparable between runs with the same mode.
   */
  engineInfo?: Record<string, string>;
  /** Harness observations (inputs that could not be mapped, engines not available, ...). */
  notes: string[];
}

export type ExpectationKind =
  | 'mustRankTopK' | 'mustNotMiss' | 'emergencyLevel' | 'mustAlarm' | 'mustNotAlarm' | 'redFlags'
  | 'scoreRecommended' | 'scoreValue' | 'investigationInclude' | 'investigationExclude'
  | 'managementInclude' | 'managementExclude' | 'pathway' | 'dxVariant'
  | 'reasoningInclude' | 'reasoningExclude';

export type ExpectationStatus = 'pass' | 'fail' | 'na';

export interface ExpectationResult {
  id: string;
  kind: ExpectationKind;
  severity: Severity;
  status: ExpectationStatus;
  detail: string;
  knownGap: boolean;
  unverified: boolean;
  /** critical + fail + not a known gap + verified: fails the test run. */
  blocking: boolean;
  /** Marked as a known gap / unverified on this platform but passed: update the vignette. */
  gapResolved: boolean;
  guidelineRefs: string[];
  note?: string;
  proposedFix?: string;
}

export interface ResultSummary {
  total: number;
  pass: number;
  fail: number;
  na: number;
  criticalFail: number;
  qualityFail: number;
  blocking: number;
  knownGapFail: number;
  unverifiedFail: number;
  gapResolved: number;
}

/** One line of clinval-ios.jsonl, and one entry of web-latest.json. */
export interface ClinvalResult {
  type: 'clinval-result';
  schemaVersion: 1;
  platform: Platform;
  vignetteId: string;
  condition: string;
  category: string;
  permutationOf: string | null;
  permutationLabel?: string;
  generatedAt: string;
  outputs: EngineOutputs;
  expectations: ExpectationResult[];
  summary: ResultSummary;
}

export interface WebResultsFile {
  type: 'clinval-web-results';
  generatedAt: string;
  harness: string;
  vignetteCount: number;
  results: ClinvalResult[];
  totals: ResultSummary;
}
