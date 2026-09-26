/**
 * Which symptom questions the patient intake (app/patient/intake) asks, chosen from the complaint's
 * history-frames symptom type (@workspace/triage-engine/history-frames, the same classifier the
 * clinician's history uses): a lump or hernia gets lump questions, not a pain score; a pain
 * complaint keeps the pain questions. Administrative intake: the answers are recorded for staff,
 * no advice is given.
 */

import { classifyComplaint } from '@workspace/triage-engine/history-frames';

export type IntakeQuestionSet = 'pain' | 'lump' | 'other';

export interface IntakeSymptom {
  set: IntakeQuestionSet;
  /** History-frame variant: "hernia", "neck", "abdominal", "soft_tissue" … for a lump. */
  variant?: string;
  frameId: string;
}

/** The complaint as the patient chose it: its label and, when asked, the location / type label. */
export function intakeSymptom(complaintLabel: string, detailLabel = ''): IntakeSymptom {
  const choice = classifyComplaint([complaintLabel, detailLabel].filter(Boolean).join(' — '));
  const set: IntakeQuestionSet = choice.type === 'pain' ? 'pain' : choice.type === 'lump' ? 'lump' : 'other';
  return { set, variant: choice.variant, frameId: choice.frameId };
}
