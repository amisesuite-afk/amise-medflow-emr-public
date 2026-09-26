export type {
  Feature, DiseaseNode, PaneState, RankedDiagnosis, DiseaseCourse, Applicability, PatientContext,
} from './types.js';
export {
  CONVERGENCE_THRESHOLD, DEFAULT_BASE_RATE, DEFAULT_SENSITIVITY, MAX_QUESTIONS, PANE_MODEL_VERSION,
} from './constants.js';
export { initPaneState, updatePosterior } from './engine/bayes.js';
export { featureLikelihood, baseRate, UMBRELLA_FEATURES } from './engine/likelihood.js';
export {
  nextBestQuestion, informationGain, isConverged, topDiagnoses, exportSummary,
  applyModifiers, PRIOR_MODIFIERS, SURGICAL_OPD_MODIFIERS, PREGNANCY_POSSIBLE_MULTIPLIER, isApplicable,
} from './engine/infoGain.js';
export type { PriorModifier } from './engine/infoGain.js';
export { DISEASES, FEATURES } from './vademecum/index.js';
export { getDiseaseSpecialty } from './vademecum/registry.js';
export { PRIOR_TIER } from './vademecum/priors.js';
export {
  getProtocol, getProtocolByIcd, getAllProtocols, resolveProtocol, normaliseIcd, MANAGEMENT_PROTOCOLS_VERSION,
  adaptProtocolForPatient, adaptPlanText, adaptInvestigationForPatient, allergyProfile, pregnancyFor, gestationFromText, procedureFor, hasOperativeSteps,
  ALLERGY_CLASSES, PLAN_SAFETY_VERSION, PAEDIATRIC_FLUID,
} from './management/index.js';
export type {
  ManagementProtocol, InvestigationItem, ManagementStep, ProtocolMedication, ProtocolKind, PatientCondition,
  PlanPatientContext, AdaptedProtocol, AdaptOptions, WithheldItem, SafetyNote, SafetyKind, PregnancyStatus, ProcedureKind, AllergyClass,
} from './management/index.js';
export {
  DECISION_CONTENT, DECISION_CONTENT_VERSION, decisionSupport, evaluateDecisions, scoreActions, resultActions,
  activeFactors, thresholds, bandFor, pickScores, scoreBand, diagnosisMatches, keywordAt, formatPercent, formatValue,
  decisionSummaryLines,
} from './decision/index.js';
export type {
  DecisionContent, DecisionInput, DecisionPatient, DecisionDiagnosis, DecisionScore, DecisionLabs, DecisionPregnancy,
  DecisionSupportResult, DecisionResult, OptionResult, ScoreActionCard, ResultActionCard, AppliedFactor, Band,
  LineFilter, FactorId, DecisionSummaryLine, Triple as DecisionTriple, SourceRef as DecisionSourceRef, LabAnalyte as DecisionLabAnalyte,
} from './decision/index.js';
