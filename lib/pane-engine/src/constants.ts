/**
 * Version of the pane-engine disease model (diseases, priors, feature likelihoods, prior
 * modifiers, stopping rules). Registered in clinical-content/registry.json
 * (`pane-engine-disease-model`): bump it, and the registry, with a changelog entry whenever the
 * model content changes.
 */
export const PANE_MODEL_VERSION = '1.0.2';

/** Stop asking when the leading posterior exceeds this threshold */
export const CONVERGENCE_THRESHOLD = 0.85;

/** Hard cap on the number of questions per session */
export const MAX_QUESTIONS = 8;

/**
 * Background rate of a finding in a disease that does not model it, for features that declare
 * no `baseRate` of their own. It stands for P(finding | not caused by this disease) in an
 * undifferentiated outpatient population, so an unmodelled finding is neutral (likelihood ratio
 * 1 against the background). Before 1.0.0 every unmodelled finding counted at 0.30, which let
 * high-prior surgical diseases absorb findings they do not cause (clinval C6).
 */
export const DEFAULT_BASE_RATE = 0.05;

/** @deprecated Use DEFAULT_BASE_RATE (kept for existing imports). */
export const DEFAULT_SENSITIVITY = DEFAULT_BASE_RATE;

/** Floor and ceiling of any single likelihood, so no one finding can zero a disease. */
export const MIN_LIKELIHOOD = 0.005;
export const MAX_LIKELIHOOD = 0.995;
