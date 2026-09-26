/**
 * Decision support — score → action, result → action and the treatment decision layer
 * (Bayesian decision theory on top of the diagnosis engines). See engine.ts.
 */
import rawContent from '../../../../clinical-content/rules/treatment-decisions.json';
import type { DecisionContent } from './types.js';

/**
 * The shared clinical rule file clinical-content/rules/treatment-decisions.json, read by iOS too
 * (TreatmentDecisionContent.swift through SharedClinicalContent). lint:shared-content checks it
 * against its schema and against types.ts. Registered as `treatment-decision-support`.
 */
export const DECISION_CONTENT = rawContent as unknown as DecisionContent;
export const DECISION_CONTENT_VERSION: string = DECISION_CONTENT.version;

export {
  decisionSupport, evaluateDecisions, scoreActions, resultActions, activeFactors, thresholds, bandFor,
  pickScores, scoreBand, diagnosisMatches, keywordAt, formatPercent, formatValue, decisionSummaryLines, lowerFirst, factorLabel,
} from './engine.js';
export type * from './types.js';
export type { DecisionSummaryLine } from './engine.js';
