/** Stop asking when the leading posterior exceeds this threshold */
export const CONVERGENCE_THRESHOLD = 0.85;

/** Hard cap on the number of questions per session */
export const MAX_QUESTIONS = 8;

/**
 * Likelihood of a feature being present for a disease not explicitly modelling it.
 * Neutral-ish: won't strongly push the distribution in either direction.
 */
export const DEFAULT_SENSITIVITY = 0.30;
