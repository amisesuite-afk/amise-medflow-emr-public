/**
 * Decision support — score → action, result → action and the treatment decision layer
 * (Bayesian decision theory on top of the diagnosis engines). See engine.ts.
 */
import rawContent from './treatment-decisions.json';
import type { DecisionContent } from './types.js';

/** The shared content (identical copy on iOS: ios/AmiseMedFlow/Resources/TreatmentDecisions.json). */
export const DECISION_CONTENT = rawContent as unknown as DecisionContent;
export const DECISION_CONTENT_VERSION: string = DECISION_CONTENT.version;

export {
  decisionSupport, evaluateDecisions, scoreActions, resultActions, activeFactors, thresholds, bandFor,
  pickScores, scoreBand, diagnosisMatches, keywordAt, formatPercent, formatValue,
} from './engine.js';
export type * from './types.js';
