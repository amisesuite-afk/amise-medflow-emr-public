/**
 * The Exam step follows the complaint's history frame (evidence-exam).
 *
 * The history step already classifies each chief complaint into a symptom type and frame
 * (@workspace/triage-engine/history-frames classifyComplaint, or the clinician's frame switch
 * stored on the complaint entry). The Exam step reuses that classification instead of a second
 * one: clinical-content/rules/exam-signs.json "frames" maps each frame to the examination systems
 * to show, the iOS primary examination region, and the presentation tags whose high-yield signs
 * and decision rules are offered. A cough therefore gets chest signs, a lump its local signs.
 */
import { classifyComplaint } from '@workspace/triage-engine/history-frames';
import { examSystemsFor } from '@workspace/pane-engine';

interface CcEntryLike { complaint?: unknown; frame?: unknown }

/**
 * History frame ids of the consultation's complaints, primary first: each complaint entry's
 * chosen frame (or its classified frame) and the frames of the other symptoms it names. With no
 * complaint entries, the fallback complaint text is classified.
 */
export function complaintFrameIds(procedureData: Record<string, unknown> | null | undefined, fallbackComplaint = ''): string[] {
  const out: string[] = [];
  const add = (id: string) => { if (id && !out.includes(id)) out.push(id); };
  const cc = procedureData?.['cc'];
  const entries = Array.isArray(cc) ? (cc as CcEntryLike[]).filter(e => typeof e?.complaint === 'string' && e.complaint.trim()) : [];
  for (const e of entries) {
    const choice = classifyComplaint(e.complaint as string);
    add(typeof e.frame === 'string' && e.frame ? e.frame : choice.frameId);
    for (const id of choice.secondary) add(id);
  }
  if (!entries.length && fallbackComplaint.trim()) {
    const choice = classifyComplaint(fallbackComplaint);
    add(choice.frameId);
    for (const id of choice.secondary) add(id);
  }
  return out;
}

/** Web examination systems the complaint's frames call for (added to the always-shown core systems). */
export function frameExamSystems(frameIds: string[]): Set<string> {
  return examSystemsFor(frameIds);
}
