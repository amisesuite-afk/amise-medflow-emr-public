/**
 * Decision support (score → action, result → action, treatment thresholds) — types.
 *
 * The content (treatment-decisions.json) is shared with iOS byte for byte
 * (ios/AmiseMedFlow/Resources/TreatmentDecisions.json); the Swift twin of this module is
 * ios/AmiseMedFlow/Services/BayesianDecisionEngine+Treatment*.swift. Both run the same test
 * vectors (ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json). Change both together.
 */

/** [low, point, high]. */
export type Triple = [number, number, number];

export type Evidence = 'guideline' | 'moderate' | 'low' | 'estimate';
export type ActionLevel = 'low' | 'moderate' | 'high' | 'critical';
export type AddAs = 'plan' | 'test';

export type OptionKind =
  | 'operation' | 'procedure' | 'endoscopy' | 'antibiotic' | 'anticoagulant' | 'thrombolysis'
  | 'admission' | 'prophylaxis-drug' | 'prophylaxis-mechanical';

export type FactorId =
  | 'age65to79' | 'age80plus' | 'cfs5to6' | 'cfs7plus' | 'asa3' | 'asa4plus'
  | 'egfr30to59' | 'egfrBelow30' | 'anticoagulated' | 'doacOnly' | 'antiplatelet' | 'hasBled3plus'
  | 'pregnant' | 'penicillinAllergy' | 'diabetes' | 'immunosuppressed' | 'bmi40plus'
  | 'news2High' | 'shock' | 'recentSurgery21d' | 'appendicolith' | 'predictedSeverePancreatitis'
  | 'mechanicalValve' | 'recentVte3m';

export interface SourceInfo { citation: string; year: number; fromMemory: boolean }

export interface ScoreBand {
  min: number;
  max: number;
  requires?: 'redParameter';
  band: string;
  level: ActionLevel;
  action: string;
  addAs: AddAs;
  /** Event probability for this band (pre-test probability or baseline risk). */
  risk?: Triple;
  sources: string[];
  evidence: Evidence;
}

export interface ScoreActionSet {
  score: string;
  label: string;
  chip: string;
  riskLabel?: string;
  bands: ScoreBand[];
}

export type LabAnalyte = 'lipase' | 'amylase' | 'troponin' | 'lactate' | 'potassium' | 'haemoglobin';

export interface ResultRule {
  id: string;
  analyte: LabAnalyte;
  unit: string;
  /** Threshold = ulnMultiple × upper limit of normal (input or content default). */
  ulnMultiple?: number;
  /** Strictly above the threshold (troponin above the URL). */
  strictLower?: boolean;
  lower?: number;
  upperExclusive?: number;
  label: string;
  thresholdText: string;
  action: string;
  addAs: AddAs;
  level: ActionLevel;
  diagnosisHint?: string;
  /** Not shown when this rule id fired too (amylase after lipase). */
  supersededBy?: string;
  sources: string[];
}

export interface Modifier {
  id: string;
  factor: FactorId;
  label: string;
  reason: string;
  sources: string[];
  evidence: Evidence;
  /** Applies to options of these kinds (global modifiers). */
  kinds?: OptionKind[];
  /** Applies to these option ids (decision modifiers). */
  options?: string[];
  /** Odds ratio applied to the harm, [low, point, high]. */
  harmOR?: Triple;
  /** Multiplier applied to the benefit. */
  benefitX?: Triple;
  /** Absolute amount added to the benefit. */
  benefitAdd?: Triple;
  /** The option is not for this patient. */
  exclude?: boolean;
  /** Only for options whose usual regimen contains this allergy class. */
  requiresAllergyClass?: string;
}

export interface TreatmentOption {
  id: string;
  label: string;
  kind: OptionKind;
  planLine: string;
  observeText: string;
  /** Net benefit in the diseased (absolute), [low, point, high]. */
  benefit: Triple;
  /** Harm in the non-diseased (absolute), [low, point, high]. */
  harm: Triple;
  sources: string[];
  evidence: Evidence;
  addAs: AddAs;
  allergyClasses?: string[];
  note?: string;
  /** Default true: extra harm from a modifier also lowers the net benefit in the diseased. */
  harmInDiseased?: boolean;
}

export interface DecisionTest {
  label: string;
  sensitivity: number;
  specificity: number;
  harm: number;
  sources: string[];
}

export interface DecisionMatch {
  diseaseIds: string[];
  icd10: string[];
  keywords: string[];
  excludeKeywords: string[];
}

export interface DecisionDef {
  id: string;
  label: string;
  type: 'diagnosis' | 'risk';
  match: DecisionMatch;
  test?: DecisionTest;
  /** Diagnosis decisions: pre-test probability from this score's band. */
  pretestScore?: string;
  /** Risk decisions: the probability is this score's band risk. */
  riskScore?: string;
  /** Risk decisions shown only when this score is recorded. */
  triggerScore?: string;
  trigger?: 'anticoagulatedWithProcedure';
  baselineRisk?: Triple;
  riskFactors?: { factor: FactorId; risk: Triple; label: string }[];
  riskLabel?: string;
  options: TreatmentOption[];
  modifiers: Modifier[];
}

export interface DecisionContent {
  version: string;
  status: string;
  defaults: {
    confirmedFloor: number;
    minEngineProbability: number;
    maxDecisions: number;
    uln: Record<'lipase' | 'amylase' | 'troponin', number>;
    ulnNote: string;
  };
  sources: Record<string, SourceInfo>;
  scoreActions: ScoreActionSet[];
  resultActions: ResultRule[];
  modifiers: Modifier[];
  decisions: DecisionDef[];
  missingInputs: Record<string, { label: string; effect: string }>;
}

// ── Inputs ──────────────────────────────────────────────────────────────────────────────────

export type DecisionPregnancy = 'pregnant' | 'not-pregnant' | 'possible' | 'unknown';

export interface DecisionPatient {
  ageYears: number | null;
  sex: 'male' | 'female' | 'unknown';
  /** Clinical Frailty Scale 1–9. */
  cfs: number | null;
  /** ASA physical status 1–6. */
  asa: number | null;
  /** eGFR / CrCl mL/min. */
  egfr: number | null;
  bmi: number | null;
  news2: number | null;
  /** Latest systolic BP, mmHg. */
  sbp: number | null;
  anticoagulant: 'vka' | 'doac' | 'none' | null;
  antiplatelet: boolean;
  hasBled: number | null;
  pregnancy: DecisionPregnancy;
  /** planSafety / PlanSafetyFilter allergy class ids ('penicillin', 'nsaid', …). */
  allergyClasses: string[];
  diabetes: boolean;
  immunosuppressed: boolean;
  /** Days since the last operation (null = none recorded). */
  recentSurgeryDays: number | null;
  /** An operation or procedure is planned (read from the assessment). */
  procedurePlanned: boolean;
  appendicolith: boolean;
  mechanicalValve: boolean;
  recentVte3m: boolean;
}

export interface DecisionDiagnosis {
  name: string;
  /** Engine disease id (web PANE id; iOS none). */
  id?: string | null;
  icd10?: string | null;
  /** Posterior 0–1 from the diagnosis engine (null when unknown). */
  probability: number | null;
  /** Confirmed by the clinician (locked working diagnosis / recorded ICD code). */
  confirmed: boolean;
}

export interface DecisionScore {
  key: string;
  value: number;
  /** calculator = clinician-completed form; record = computed from the record; autofill. */
  source: 'calculator' | 'record' | 'autofill';
  /** NEWS2: a single parameter scored 3. */
  redParameter?: boolean;
}

export type DecisionLabs = Partial<Record<LabAnalyte, number>>;

export interface DecisionInput {
  patient: DecisionPatient;
  diagnoses: DecisionDiagnosis[];
  scores: DecisionScore[];
  /** haemoglobin in g/L; enzymes U/L; troponin ng/L; lactate, potassium mmol/L. */
  labs: DecisionLabs;
  /** Upper limits of normal from the local laboratory (defaults in the content). */
  uln?: Partial<Record<'lipase' | 'amylase' | 'troponin', number>>;
}

/** The platform's plan-safety line filter (planSafety adaptPlanText / PlanSafetyFilter.adaptLine). */
export type LineFilter = (line: string) => { text: string; withheld: boolean };

// ── Outputs ─────────────────────────────────────────────────────────────────────────────────

export type Band = 'observe' | 'test' | 'treat' | 'not-for-patient' | 'unknown';

export interface SourceRef { id: string; citation: string; year: number; fromMemory: boolean }

export interface ScoreActionCard {
  id: string;
  score: string;
  scoreLabel: string;
  chip: string;
  value: number;
  scoreSource: DecisionScore['source'];
  band: string;
  level: ActionLevel;
  action: string;
  withheld: boolean;
  addAs: AddAs;
  evidence: Evidence;
  sources: SourceRef[];
}

export interface ResultActionCard {
  id: string;
  analyte: LabAnalyte;
  label: string;
  chip: string;
  value: number;
  unit: string;
  thresholdText: string;
  action: string;
  withheld: boolean;
  addAs: AddAs;
  level: ActionLevel;
  diagnosisHint: string | null;
  sources: SourceRef[];
}

export type FactorEffect = 'excluded' | 'harm-up' | 'harm-down' | 'benefit-up' | 'benefit-down';

export interface AppliedFactor {
  modifierId: string;
  factor: FactorId;
  label: string;
  effect: FactorEffect;
  reason: string;
  /** Change of the headline (treat) threshold this factor caused, in probability units. */
  thresholdShift: number;
  /** Change of the net expected benefit at the current probability. */
  netShift: number;
  evidence: Evidence;
  sources: SourceRef[];
}

export interface OptionResult {
  id: string;
  label: string;
  kind: OptionKind;
  band: Band;
  /** Bands reached across the evidence range (pessimistic, point, optimistic), in order. */
  bandRange: Band[];
  borderline: boolean;
  /** Headline treat threshold (test-treatment threshold when a test exists), with range. */
  treatThreshold: Triple;
  /** Observe/test threshold when a useful test exists, with range; null otherwise. */
  testThreshold: Triple | null;
  benefit: Triple;
  harm: Triple;
  expectedBenefit: Triple;
  expectedHarm: Triple;
  net: Triple;
  rank: number | null;
  excludedReason: string | null;
  /** The plan-safety filter withheld the plan line (its replacement text). */
  withheldText: string | null;
  factors: AppliedFactor[];
  topFactors: AppliedFactor[];
  /** "Frailty CFS 7 and ASA IV raised the harm of … (treat threshold 13% → 64%)". */
  factorSummary: string | null;
  planLine: string;
  observeText: string;
  /** The line "Add" puts in the plan / test list for the current band. */
  suggestedLine: string | null;
  suggestedAddAs: AddAs | null;
  evidence: Evidence;
  lowEvidence: boolean;
  fromMemory: boolean;
  sources: SourceRef[];
  note: string | null;
}

export interface DecisionResult {
  id: string;
  label: string;
  type: 'diagnosis' | 'risk';
  diagnosisName: string;
  probability: number | null;
  probabilitySource: 'confirmed' | 'score' | 'engine' | 'risk' | 'none';
  probabilityLabel: string;
  chip: string;
  test: { label: string; sensitivity: number; specificity: number; sources: SourceRef[] } | null;
  options: OptionResult[];
  missing: string[];
}

export interface DecisionSupportResult {
  contentVersion: string;
  scoreActions: ScoreActionCard[];
  resultActions: ResultActionCard[];
  decisions: DecisionResult[];
  /** Factors active for this patient (ids), for display and tests. */
  activeFactors: FactorId[];
}
