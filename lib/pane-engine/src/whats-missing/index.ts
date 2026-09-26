/**
 * "What's missing" — one ranked strip of the missing inputs the engines already know about, and
 * the score auto-fill from the record. See engine.ts, record-fill.ts, decision-probe.ts.
 */
export { WHATS_MISSING_RULES, WHATS_MISSING_VERSION } from './rules.js';
export type { MissingRules, MissingGroupRule } from './rules.js';
export { whatsMissing, whatsMissingLines, termIn, termsFound, joinParts } from './engine.js';
export { scoreRecordFill, filledValue, normaliseLabs, recordBmi, missingObservations, FILLABLE_SCORES } from './record-fill.js';
export type { NormalisedLabs } from './record-fill.js';
export { decisionGaps } from './decision-probe.js';
export type * from './types.js';
