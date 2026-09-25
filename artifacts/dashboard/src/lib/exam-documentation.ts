/**
 * Examination documentation rules (UX review C2).
 *
 * Every system starts "not examined". A normal template is a one-tap suggestion the clinician
 * applies to one system at a time; nothing is ever pre-applied on opening the Exam step, and a
 * wound template is never applied as part of "All normal" (a wound exam only when the clinician
 * records one). The count and the note include only systems the clinician actually documented.
 */

export interface ExamState {
  findings: Record<string, string[]>;
  notes: Record<string, string>;
}

/** Systems that "All normal" must never fill: a wound exists only when the clinician says so. */
export const NEVER_BULK_NORMAL = new Set(['wound']);

/** A system is documented when it has at least one finding chip or some text, and is not omitted. */
export function isSystemDocumented(state: ExamState, key: string, omitted: Record<string, boolean> = {}): boolean {
  if (omitted[key]) return false;
  return (state.findings[key]?.length ?? 0) > 0 || !!state.notes[key]?.trim();
}

/** Number of systems the clinician documented (0 on a fresh encounter). */
export function countDocumentedSystems(keys: readonly string[], state: ExamState, omitted: Record<string, boolean> = {}): number {
  return keys.filter(k => isSystemDocumented(state, k, omitted)).length;
}

/** Apply the normal template to ONE system (explicit clinician tap). Other systems are untouched. */
export function applyNormalTemplate(state: ExamState, key: string, template: string): ExamState {
  return {
    notes: { ...state.notes, [key]: template },
    findings: { ...state.findings, [key]: [] },
  };
}

/** Systems an explicit "All normal" tap fills: the shown, not-omitted systems, never the wound. */
export function allNormalTargets(shownKeys: readonly string[], omitted: Record<string, boolean> = {}): string[] {
  return shownKeys.filter(k => !omitted[k] && !NEVER_BULK_NORMAL.has(k));
}

/** Legacy per-system fields the clinical note prints (AppContext exam* strings). */
export interface LegacyExamFields {
  examGeneral: string; examCardio: string; examResp: string; examAbdomen: string;
  examNeuro: string; examExtremities: string; examBreast: string; examWound: string;
}

/** Clinical-note examination lines: only systems with text, in the note's order. */
export function examNoteLines(f: LegacyExamFields): string[] {
  const rows: Array<[string, string]> = [
    ['General', f.examGeneral],
    ['Cardiovascular', f.examCardio],
    ['Respiratory', f.examResp],
    ['Abdomen', f.examAbdomen],
    ['Neurological', f.examNeuro],
    ['Extremities', f.examExtremities],
    ['Breast / Local', f.examBreast],
    ['Wound', f.examWound],
  ];
  return rows.filter(([, v]) => !!v?.trim()).map(([k, v]) => `${k}: ${v.trim()}`);
}
