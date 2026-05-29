export type { Feature, DiseaseNode, PaneState, RankedDiagnosis } from './types.js';
export { CONVERGENCE_THRESHOLD, DEFAULT_SENSITIVITY, MAX_QUESTIONS } from './constants.js';
export { initPaneState, updatePosterior } from './engine/bayes.js';
export { nextBestQuestion, isConverged, topDiagnoses } from './engine/infoGain.js';
export { DISEASES, FEATURES } from './vademecum/index.js';
