/**
 * Re-seeds the PANE posterior from the whole consultation, exactly as HpiTab.reseedPane does
 * (priors with age, sex and pregnancy context, then every chief-complaint entry's features with the
 * record context). Called when examination-sign chips change on the Exam step or a decision rule is
 * recorded, so the differential, the reasoning panel and the rest follow the new evidence at once.
 */
import { DISEASES, FEATURES, applyModifiers, initPaneState, updatePosterior } from '@workspace/pane-engine';
import type { PaneState } from '@workspace/pane-engine';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from './socrates-to-features';
import type { ConsultationSnapshot } from './socrates-to-features';
import { currentComplaintText } from './visit-continuity-web';

interface CcEntry { complaint: string; answers: Record<string, string> }

const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

export function paneStateFromConsultation(
  snapshot: Partial<ConsultationSnapshot> & { procedureData?: Record<string, unknown> | null },
): PaneState {
  const age = parseInt(String(snapshot.age ?? ''), 10) || null;
  const diseases = applyModifiers(DISEASES, age, snapshot.sex ?? 'unknown', undefined, { pregnancyPossible: !!snapshot.pregnancyPossible });
  let state = initPaneState(diseases);
  const ctx = paneContextFromConsultation(snapshot);
  const cc = snapshot.procedureData?.['cc'];
  const entries: CcEntry[] = Array.isArray(cc) && cc.length
    ? (cc as CcEntry[]).filter(e => e && typeof e.complaint === 'string')
    : [{ complaint: currentComplaintText({ procedureData: snapshot.procedureData, symptoms: snapshot.symptoms, freeText: snapshot.freeText }), answers: {} }];
  for (const entry of entries) {
    const features = extractFeaturesFromSocrates(entry.complaint, entry.answers ?? {}, ctx);
    for (const [featureId, present] of Object.entries(features)) {
      if (FEATURE_IDS.has(featureId)) state = updatePosterior(state, diseases, featureId, present);
    }
  }
  return state;
}
