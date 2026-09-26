// Real-outcomes loop (prediction snapshots, final diagnoses, calibration, proposed adjustments,
// de-identified research export). Imported as `@workspace/triage-engine/outcomes`.
// Pure and deterministic; no AI, no network. Nothing here changes an engine.
export * from './types';
export * from './codes';
export * from './stats';
export * from './calibration';
export * from './shrinkage';
export * from './deidentify';
