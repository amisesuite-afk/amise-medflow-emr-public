import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { usePathway } from '@/lib/usePathway';

/** Prompts a switch to inpatient encounter mode when an outpatient encounter's
 * triage acuity is urgent and a high-confidence pathway match is active.
 * Dismissible per-encounter-view — never auto-switches the encounter mode. */
export default function AdmissionEscalationBanner() {
  const { encounterMode, setEncounterMode, triageResult } = useAppContext();
  const { activePathway, matchedPathways } = usePathway();
  const topMatchScore = matchedPathways[0]?.score ?? 0;
  const highConfidence = topMatchScore >= 15 && activePathway !== null;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || encounterMode !== 'outpatient' || triageResult.acuity !== 'urgent' || !highConfidence || !activePathway) {
    return null;
  }

  return (
    <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <span style={{ fontSize: 16 }}>🏥</span>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ color: '#991b1b', fontWeight: 700, fontSize: 13 }}>
          Admission criteria may be met
        </div>
        <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 2 }}>
          Urgent acuity + {activePathway.name} — consider switching to inpatient encounter.
        </div>
      </div>
      <button
        type="button"
        onClick={() => { setEncounterMode('inpatient'); setDismissed(true); }}
        style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#991b1b', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        Switch to Inpatient
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
      >
        Dismiss
      </button>
    </div>
  );
}
