import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { DISEASES, applyModifiers, topDiagnoses } from '@workspace/pane-engine';
import { parseImagingToRequest } from '@/lib/imaging-utils';
import {
  suggestInvestigations, orderTickedSuggestions,
  type InvestigationKind, type SuggestedInvestigation,
} from '@/lib/investigation-suggestions';

interface CCEntry { complaint: string; answers: Record<string, string> }

const URGENCY_STYLE: Record<SuggestedInvestigation['urgency'], { color: string; label: string }> = {
  stat:    { color: '#b91c1c', label: 'STAT' },
  urgent:  { color: '#b45309', label: 'urgent' },
  routine: { color: '#64748b', label: 'routine' },
};

/**
 * Suggested (not ordered) investigations for the current chief complaint(s) and the leading
 * differentials. The clinician ticks what to order; only ticked items reach the record
 * (UX review C3, CLAUDE.md human authority: never order without explicit approval).
 */
export default function SuggestedInvestigationsPanel({ kind }: { kind: InvestigationKind }) {
  const {
    procedureData, paneState, age, sex, encounterStatus,
    orderedInvestigations, setOrderedInvestigations,
    radiologyRequests, setRadiologyRequests,
  } = useAppContext();
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const complaints = ((procedureData['cc'] as CCEntry[] | undefined) ?? []).map(e => e.complaint);

  const differentials = useMemo(() => {
    if (!paneState || Object.keys(paneState.answered ?? {}).length === 0) return [];
    const diseases = applyModifiers(DISEASES, parseInt(age, 10) || null, sex);
    return topDiagnoses(paneState, diseases, 3).map(r => ({ id: r.disease.id, label: r.disease.label }));
  }, [paneState, age, sex]);

  const suggestions = useMemo(
    () => suggestInvestigations({ complaints, differentials, orderedInvestigations, radiologyRequests })
      .filter(s => s.kind === kind),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(complaints), differentials, orderedInvestigations, radiologyRequests, kind],
  );

  if (suggestions.length === 0) return null;
  const locked = encounterStatus === 'closed';
  const tickedItems = suggestions.filter(s => ticked.has(s.label));

  function toggle(label: string) {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }

  function orderTicked() {
    if (!tickedItems.length || locked) return;
    const next = orderTickedSuggestions(
      tickedItems,
      { orderedInvestigations, radiologyRequests },
      s => parseImagingToRequest(s.label, s.urgency, s.suggestedFor[0]),
    );
    if (next.orderedInvestigations.length !== orderedInvestigations.length) setOrderedInvestigations(next.orderedInvestigations);
    if (next.radiologyRequests.length !== radiologyRequests.length) setRadiologyRequests(next.radiologyRequests);
    setTicked(new Set());
  }

  // Group by the first reason so each block carries its "Suggested for …" badge.
  const groups = new Map<string, SuggestedInvestigation[]>();
  for (const s of suggestions) {
    const key = s.suggestedFor[0] ?? 'Suggested';
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  return (
    <div
      data-testid={`suggested-investigations-${kind}`}
      style={{ border: '1px dashed #0d9488', borderRadius: 10, padding: '10px 14px', background: 'rgba(13,148,136,0.04)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Suggested {kind === 'lab' ? 'investigations' : 'imaging'}
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Not ordered — tick the ones you want, then order them.
        </span>
      </div>
      {[...groups.entries()].map(([reason, items]) => (
        <div key={reason} style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: '#0f766e',
            background: '#ccfbf1', border: '1px solid #99f6e4', borderRadius: 999, padding: '1px 8px', marginBottom: 5,
          }}>
            Suggested for {reason}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.map(s => (
              <label key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink, #111827)', cursor: locked ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ticked.has(s.label)}
                  disabled={locked}
                  onChange={() => toggle(s.label)}
                  aria-label={`Order ${s.label}`}
                />
                <span>{s.label}</span>
                <span style={{ fontSize: 10, color: URGENCY_STYLE[s.urgency].color }}>({URGENCY_STYLE[s.urgency].label})</span>
                {s.suggestedFor.length > 1 && (
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>also: {s.suggestedFor.slice(1).join(', ')}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={orderTicked}
        disabled={!tickedItems.length || locked}
        style={{
          marginTop: 4, padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700,
          background: tickedItems.length && !locked ? '#0d9488' : '#cbd5e1',
          color: '#fff', cursor: tickedItems.length && !locked ? 'pointer' : 'default',
        }}
      >
        Order ticked ({tickedItems.length})
      </button>
    </div>
  );
}
