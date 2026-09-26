import { useMemo } from 'react';
import { DISEASES } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import { completionSnapshotFromApp } from '@/lib/outcomes-completion';
import { probabilityText } from '@/lib/probability-text';

const LABELS = new Map(DISEASES.map(d => [d.id, d.label]));

/**
 * Sign-off dialog line (outcomes loop): what is recorded, as codes, when the encounter closes, so
 * the engines' accuracy can be measured once the final diagnosis is known. Read-only; the
 * snapshot itself is built again at the moment of closing (Home.tsx completeEncounter).
 */
export default function CompletionSnapshotNote() {
  const app = useAppContext();
  const snap = useMemo(
    () => completionSnapshotFromApp(app, app.encounterId ?? '00000000-0000-4000-8000-000000000000'),
    [app],
  );
  if (!snap) return null;
  const leaders = snap.topDifferential.slice(0, 3)
    .map(d => `${(d.diseaseId && LABELS.get(d.diseaseId)) || d.icd10 || d.diseaseId}${d.probability !== null ? ` ${probabilityText(d.probability)}` : ''}`);
  const working = snap.workingIcd10 ?? snap.recordedIcd10[0] ?? null;
  return (
    <div data-testid="signoff-outcome-snapshot"
      style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
      <div style={{ fontWeight: 800, color: '#334155', marginBottom: 2 }}>Recorded for accuracy measurement (codes only)</div>
      <div>
        Engines' leading diagnoses: {leaders.length ? leaders.join(' · ') : 'none'}
        {working ? ` · your diagnosis ${working}` : ' · no confirmed ICD-10 code'}
      </div>
      {snap.expectsOutcome && (
        <div style={{ marginTop: 2 }}>
          A final diagnosis is expected ({snap.outcomeTriggers.join(' and ')}): record it under Final diagnosis once the result is back.
        </div>
      )}
    </div>
  );
}
