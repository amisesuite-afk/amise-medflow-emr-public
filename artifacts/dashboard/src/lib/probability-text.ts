/**
 * Probability text that never claims certainty. Medicine is probabilistic: an engine posterior is
 * shown as "<1%" rather than "0%" and ">99%" rather than "100%" (surgeon, 2026-09-26:
 * "Medicine is probabilistic, no 100 percent"; docs/clinical-validation/SURGEON-DECISIONS.md I3).
 * Same rule as `fmtPct` in lib/triage-engine/src/diagnostic-reasoning/core.ts; iOS twin
 * ios/AmiseMedFlow/Services/ProbabilityText.swift (the same cases in both tests). Display only:
 * bar widths and thresholds keep the raw number.
 */

/** From a fraction (0–1), e.g. a PANE posterior. */
export function probabilityText(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  if (p >= 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}

/** From a whole percent (0–100), as the iOS engine and stored snapshots hold it. */
export function percentText(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return probabilityText(value / 100);
}
