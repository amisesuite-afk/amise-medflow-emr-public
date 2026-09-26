import { decisionRuleByRecordKey } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import { recordedDecisionScores, withRecordedScore } from '@/lib/decision-support';
import { paneStateFromConsultation } from '@/lib/pane-reseed';

/**
 * "Use in decision support": records this calculator's value on the encounter
 * (encounters.clinical_scores → decisionScores) so the Plan-step decision support can show the
 * score's guideline action and use it in the treatment decisions. An explicit clinician tap —
 * a calculator result is never recorded by itself.
 *
 * A diagnostic decision rule (clinical-content/rules/decision-rules.json) is also PANE evidence:
 * recording it re-seeds the differential with the rule's band (evidence-exam 1.0.0).
 */
export default function RecordScoreButton({ scoreKey, value, redParameter = false }: { scoreKey: string; value: number | null; redParameter?: boolean }) {
  const app = useAppContext();
  const { clinicalScores, setClinicalScores, encounterStatus } = app;
  /** A diagnostic rule re-seeds the differential with its band; returns the scores to record. */
  const reseedWith = (next: Record<string, unknown>) => {
    if (decisionRuleByRecordKey(scoreKey)?.kind === 'diagnostic') app.setPaneState(paneStateFromConsultation({ ...app, clinicalScores: next }));
    return next;
  };
  if (value === null || !Number.isFinite(value)) return null;
  const recorded = recordedDecisionScores(clinicalScores)[scoreKey];
  const same = recorded?.value === value && (recorded?.redParameter ?? false) === redParameter;
  const locked = encounterStatus === 'closed';
  return (
    <button
      type="button"
      data-testid={`record-score-${scoreKey}`}
      disabled={same || locked}
      onClick={() => setClinicalScores(reseedWith(withRecordedScore(clinicalScores, scoreKey, value, new Date().toISOString(), redParameter)))}
      title="Record this score for the Plan-step decision support (its guideline action and the treatment decisions)."
      style={{
        marginTop: 6, padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700,
        border: same ? '1px solid #99f6e4' : 'none', background: same ? '#f0fdfa' : '#0d9488',
        color: same ? '#0f766e' : '#fff', cursor: same || locked ? 'default' : 'pointer',
      }}
    >
      {same ? `Recorded for decision support (${value})` : recorded ? `Update decision support (was ${recorded.value})` : 'Use in decision support'}
    </button>
  );
}
