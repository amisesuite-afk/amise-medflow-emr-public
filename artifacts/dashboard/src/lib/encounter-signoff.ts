/**
 * Encounter sign-off summary (UX review M8): what is still missing before the encounter is
 * closed — undocumented steps, allergy status, an unconfirmed diagnosis. Shown in the in-app
 * sign-off dialog; closing stays possible after the clinician's explicit confirmation.
 */
import type { Section, WorkingDiagnosis } from '@/context/AppContext';
import { allergyStatus } from '@/lib/allergy-status';
import { isConfirmedDiagnosis } from '@/lib/diagnosis-suggestion';
import { SECTION_LABELS } from '@/lib/workflow-completion';

/** Optional steps: nothing is missing when they are empty (files, progress notes). */
export const OPTIONAL_SIGNOFF_STEPS: ReadonlySet<Section> = new Set<Section>(['attachments', 'progress']);

/** Steps checked when no chief-complaint pathway is active. */
export const DEFAULT_SIGNOFF_STEPS: Section[] = ['hpi', 'pmh', 'medications', 'allergies', 'examination', 'assessment', 'plan'];

export interface SignOffInput {
  /** The pathway's steps (chief-complaint matrix sections), or the default steps. */
  steps: readonly Section[];
  done: Partial<Record<Section, boolean>>;
  allergies: string;
  workingDiagnosis: WorkingDiagnosis | null;
  icdCodes: readonly string[];
}

export interface SignOffGap {
  id: 'undocumented' | 'allergies' | 'allergy_conflict' | 'diagnosis';
  text: string;
}

export function buildSignOffSummary(input: SignOffInput): { gaps: SignOffGap[]; undocumented: string[] } {
  // Only steps that have a documentation signal (Tasks, Monitor… have none) can be "missing";
  // optional steps (Files, Notes) never are. Allergies have their own line below.
  const undocumented = input.steps
    .filter(step => step !== 'allergies' && !OPTIONAL_SIGNOFF_STEPS.has(step) && step in input.done && !input.done[step])
    .map(step => SECTION_LABELS[step] ?? step);
  const gaps: SignOffGap[] = [];
  if (undocumented.length) {
    gaps.push({ id: 'undocumented', text: `Not documented: ${undocumented.join(', ')}` });
  }
  const allergy = allergyStatus(input.allergies);
  if (allergy.kind === 'not_recorded') gaps.push({ id: 'allergies', text: 'Allergies: not recorded' });
  if (allergy.kind === 'recorded' && allergy.conflictsWithNkda) {
    gaps.push({ id: 'allergy_conflict', text: 'Allergies: NKDA and an allergy are both recorded — reconcile' });
  }
  if (!isConfirmedDiagnosis(input.workingDiagnosis) && input.icdCodes.length === 0) {
    gaps.push({ id: 'diagnosis', text: 'No diagnosis confirmed' });
  }
  return { gaps, undocumented };
}
