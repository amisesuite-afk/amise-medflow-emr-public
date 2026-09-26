/**
 * Disease-centred vademecum and hypothetico-deductive loop — phase 1, SHADOW ONLY.
 *
 * Not exported from the package root: nothing in production imports it. The clinical-validation
 * harness runs it beside PANE and the iOS engine (`clinval:web --engine vademecum`,
 * scripts/src/clinval/vademecum-shadow.ts). Import path: `@workspace/pane-engine/vademecum-loop`.
 * Content: clinical-content/vademecum/*.json. Plan: docs/VADEMECUM-PLAN.md; report:
 * docs/clinical-validation/VADEMECUM-PHASE1.md.
 */
export * from './types.js';
export { VADEMECUM_AREAS, VADEMECUM_FINDINGS, VADEMECUM_VERSION } from './content.js';
export {
  loadVademecum, bundledVademecum, resolveLink, criteriaFindings, decisionFor, diseaseThresholds, applies, demographicAnswers,
  evalCriteria, findingLabel,
} from './model.js';
export type { PatientInfo, ResolvedLink, LoadedDisease, Vademecum, Tri, CriteriaContext } from './model.js';
export {
  evaluate, displayList, scoreDisease, bandFor, seedCandidates, complaintAreas, questionsAt, questionGain, bestQuestion, runLoop, signFor,
  decidingFindings, deferredCantMiss, inPlayAt, LEVEL_QUESTION_BUDGET,
} from './loop.js';
export type {
  Band, LoopInput, CriteriaLevelStatus, CriteriaStatus, Contribution, DiseaseResult, Exclusion, Conflict, FinalDiagnosisPrompt,
  IncidentalWorkupOutput, Evaluation, SeedInput, CandidateSet, Question, StopReason, LoopStep, LoopRun, PendingWorkup,
} from './loop.js';
export { generateHistoryQuestions, generateExamSigns, generateInvestigations } from './generators.js';
export type { GeneratedChip, GeneratedQuestion, GeneratedSign, GeneratedInvestigation } from './generators.js';
export {
  findingsFromLabs, findingsFromText, findingsFromReport, findingsFromPane, findingsFromExamSigns, findingsFromScores, entryPointFindings,
} from './evidence.js';
export type { AnalyteResult, LabClassification, LabClassifier, TextMatcher } from './evidence.js';
