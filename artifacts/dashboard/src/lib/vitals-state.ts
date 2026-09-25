/**
 * The encounter's current vital signs as held in AppContext (and its localStorage copy).
 * Pure module so it can be unit-tested without React.
 */
import type { VitalSigns } from '@workspace/triage-engine';

/**
 * The encounter's current vital signs, as entered (strings; '' = not recorded).
 * `avpu` ('' | 'A'…'U') and `onSupplementalO2` ('' | 'air' | 'o2') are the NEWS2 consciousness
 * and air/oxygen fields, saved to vitals.avpu / vitals.on_supplemental_o2 (Migration 91) and
 * read by every NEWS2 display.
 */
export type VitalsState = Record<keyof VitalSigns | 'avpu' | 'onSupplementalO2', string>;
export type VitalKey = keyof VitalsState;

export const EMPTY_VITALS: VitalsState = {
  systolicBp: '', diastolicBp: '', heartRate: '', temperatureC: '', respiratoryRate: '', spo2: '', glucoseMmol: '',
  avpu: '', onSupplementalO2: '',
};

/** Restores saved vitals, filling any field an older saved copy did not have with ''. */
export function restoreVitalsState(saved: unknown): VitalsState {
  const out: VitalsState = { ...EMPTY_VITALS };
  if (!saved || typeof saved !== 'object') return out;
  for (const k of Object.keys(EMPTY_VITALS) as VitalKey[]) {
    const v = (saved as Record<string, unknown>)[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
