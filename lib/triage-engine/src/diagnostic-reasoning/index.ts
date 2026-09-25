/**
 * Diagnostic reasoning layer (deterministic; no AI). Platform-neutral core shared by the
 * dashboard adapter (artifacts/dashboard/src/lib/diagnostic-reasoning.ts, PANE) and mirrored in
 * Swift (ios/AmiseMedFlow/Services/DiagnosticReasoningCore.swift, ZebraCheck.swift,
 * LongitudinalPatterns.swift).
 */
export * from './core';
export * from './zebra-rules';
export * from './zebras';
export * from './longitudinal';
