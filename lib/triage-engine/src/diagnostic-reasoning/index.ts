/**
 * Diagnostic reasoning layer (deterministic; no AI). Platform-neutral core and adapter rules shared
 * by the dashboard adapter (artifacts/dashboard/src/lib/diagnostic-reasoning.ts, PANE) and mirrored
 * in Swift (ios/AmiseMedFlow/Services/DiagnosticReasoningCore.swift, DiagnosticReasoningRules.swift,
 * ZebraCheck.swift, LongitudinalPatterns.swift). Rules: clinical-content/rules/diagnostic-reasoning-rules.json
 * and zebra-rules.json.
 */
export * from './reasoning-rules';
export * from './core';
export * from './families';
export * from './adapter-rules';
export * from './zebra-rules';
export * from './zebras';
export * from './longitudinal';
