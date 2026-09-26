/**
 * Suggested investigations (UX review C3).
 *
 * Choosing a chief complaint, answering SOCRATES chips or a shifting differential used to write
 * tests straight into `orderedInvestigations` / `radiologyRequests` — the note then listed
 * "Investigations ordered" the clinician never ordered. Those sources now produce SUGGESTIONS:
 * the Labs and Imaging steps list them, badged "Suggested for <complaint>", and only the items
 * the clinician ticks are ordered. Nothing here writes to the record.
 */
import { getMatrixByName } from '@/lib/cc-matrices';
import { adaptInvestigationForPatient } from '@workspace/pane-engine';
import type { PlanPatientContext } from '@workspace/pane-engine';
import type { SeededInvestigation } from '@/lib/plan-builder';
import { isImagingInvestigation, parseImagingToRequest, imagingAlreadyRequested } from '@/lib/imaging-utils';
import { isAlreadyOrdered } from '@/lib/investigation-merge';

export type InvestigationKind = 'lab' | 'imaging';
export type InvestigationUrgency = 'stat' | 'urgent' | 'routine';

export interface SuggestedInvestigation {
  label: string;
  kind: InvestigationKind;
  urgency: InvestigationUrgency;
  /** Why it is suggested, e.g. "Biliary colic" or "Acute cholecystitis (leading differential)". */
  suggestedFor: string[];
  /** Patient-specific caveat (pregnancy, child, contrast allergy — plan-safety filter), or null. */
  caveat: string | null;
}

interface RadiologyLike { modality: string; anatomicalRegion: string; clinicalQuestion?: string }

export interface SuggestionInput {
  /** Chief complaint names (procedureData.cc[].complaint). */
  complaints: string[];
  /**
   * Tests seeded from the diagnosis — `seedInvestigations()` in plan-builder.ts: the confirmed
   * diagnosis, else the leading differential only, adapted to the patient on record.
   */
  seeded?: SeededInvestigation[];
  /** The patient on record: the complaint's imaging gets the same pregnancy / child caveats. */
  patient?: PlanPatientContext | null;
  orderedInvestigations: string[];
  radiologyRequests: RadiologyLike[];
}

const URGENCY_RANK: Record<InvestigationUrgency, number> = { stat: 0, urgent: 1, routine: 2 };

function alreadyOrdered(label: string, kind: InvestigationKind, input: SuggestionInput): boolean {
  if (kind === 'imaging') return imagingAlreadyRequested(input.radiologyRequests, parseImagingToRequest(label));
  return isAlreadyOrdered(label, input.orderedInvestigations);
}

/**
 * Suggestions for the current complaints and differential, minus anything already ordered.
 * Complaint suggestions come first (in the complaint's own order), then differential ones by
 * urgency. The same test from two sources is listed once with both reasons.
 */
export function suggestInvestigations(input: SuggestionInput): SuggestedInvestigation[] {
  const out: SuggestedInvestigation[] = [];
  const add = (label: string, urgency: InvestigationUrgency, reason: string, caveat: string | null) => {
    const kind: InvestigationKind = isImagingInvestigation(label) ? 'imaging' : 'lab';
    if (alreadyOrdered(label, kind, input)) return;
    const dup = out.find(s => s.kind === kind && (s.label.toLowerCase() === label.toLowerCase() || isAlreadyOrdered(label, [s.label])));
    if (dup) {
      if (!dup.suggestedFor.includes(reason)) dup.suggestedFor.push(reason);
      if (URGENCY_RANK[urgency] < URGENCY_RANK[dup.urgency]) dup.urgency = urgency;
      if (!dup.caveat && caveat) dup.caveat = caveat;
      return;
    }
    out.push({ label, kind, urgency, suggestedFor: [reason], caveat });
  };
  const complaintCaveat = (label: string): string | null => {
    if (!input.patient) return null;
    const adapted = adaptInvestigationForPatient({ label, urgency: 'routine' }, input.patient).label;
    return adapted === label ? null : adapted.slice(label.length).replace(/^\s*—\s*/, '').trim() || null;
  };

  for (const complaint of input.complaints) {
    const name = complaint.trim();
    if (!name) continue;
    const tpl = getMatrixByName(name);
    const reason = tpl.id === 'other_surgical' ? name : tpl.name;
    for (const l of [...tpl.labs, ...tpl.imaging]) {
      const label = l.trim();
      if (label) add(label, 'routine', reason, complaintCaveat(label));
    }
  }

  const seeded = [...(input.seeded ?? [])].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
  for (const i of seeded) add(i.label, i.urgency, i.reason, i.caveat);

  return out;
}

/**
 * The explicit "Order ticked" action: returns the new ordered lists with only the ticked
 * suggestions added (labs → orderedInvestigations, imaging → radiology requests).
 */
export function orderTickedSuggestions<R extends RadiologyLike>(
  ticked: SuggestedInvestigation[],
  current: { orderedInvestigations: string[]; radiologyRequests: R[] },
  makeRequest: (s: SuggestedInvestigation) => R,
): { orderedInvestigations: string[]; radiologyRequests: R[] } {
  const labs = ticked.filter(s => s.kind === 'lab' && !isAlreadyOrdered(s.label, current.orderedInvestigations)).map(s => s.label);
  const imaging: R[] = [];
  for (const s of ticked.filter(x => x.kind === 'imaging')) {
    const req = makeRequest(s);
    if (!imagingAlreadyRequested([...current.radiologyRequests, ...imaging], req)) imaging.push(req);
  }
  return {
    orderedInvestigations: [...current.orderedInvestigations, ...labs],
    radiologyRequests: [...current.radiologyRequests, ...imaging],
  };
}
