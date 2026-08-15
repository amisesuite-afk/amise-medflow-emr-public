import { useState, useEffect } from 'react';
import { staffAuthHeaders } from '@/lib/staff-auth';

interface DrugInput {
  drugName: string;
  dose?: string;
  frequency?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  mechanism: string;
}

/**
 * AI-backed interaction check (Claude, via /api/ai/drug-interactions) — a
 * supplementary second layer alongside the deterministic AllergyMedAlert /
 * DrugInteractionAlert components, which stay wired in separately as the
 * always-on baseline. On-demand only: never calls the API on its own, only
 * when the clinician clicks "Check for interactions". A stale result is
 * cleared (not left showing) if the drug list changes after a check.
 */
export default function AiInteractionCheck({ drugs }: { drugs: DrugInput[] }) {
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = drugs.map(d => d.drugName.toLowerCase().trim()).filter(Boolean).sort().join('|');

  // Clear a stale result once the underlying drug list changes — never show
  // a "no known interactions" verdict for a combination that isn't current.
  useEffect(() => {
    setChecked(false);
    setInteractions([]);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function checkNow() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/ai/drug-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ drugs }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { interactions: DrugInteraction[] };
      setInteractions(data.interactions ?? []);
      setChecked(true);
      setPanelOpen(true);
    } catch (err) {
      console.error('[AiInteractionCheck] drug interaction check failed:', err);
      setInteractions([]);
      setChecked(false);
      setError('Check failed — try again.');
    } finally {
      setLoading(false);
    }
  }

  if (drugs.filter(d => d.drugName.trim()).length < 2) return null;

  return (
    <div style={{
      borderRadius: 10,
      border: loading
        ? '1px solid #d1d5db'
        : interactions.length > 0
          ? `1px solid ${interactions.some(i => i.severity === 'major') ? '#fca5a5' : interactions.some(i => i.severity === 'moderate') ? '#fdba74' : '#fde68a'}`
          : checked ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
      background: loading
        ? '#f9fafb'
        : interactions.length > 0
          ? interactions.some(i => i.severity === 'major') ? '#fff5f5' : interactions.some(i => i.severity === 'moderate') ? '#fff7ed' : '#fefce8'
          : checked ? '#f0fdf4' : '#fafafa',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {!checked && !loading ? (
        /* Not yet checked — on-demand trigger, nothing fetched until clicked */
        <button
          type="button"
          onClick={() => void checkNow()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '10px 14px', border: 'none', background: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 14 }}>&#129504;</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>
            AI interaction check — not yet run
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#0f5fa8' }}>Check now →</span>
        </button>
      ) : (
        <>
          {/* Panel header */}
          <button
            type="button"
            onClick={() => setPanelOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 14px', border: 'none', background: 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            {loading ? (
              <span style={{ fontSize: 14 }}>&#8987;</span>
            ) : interactions.length > 0 ? (
              <span style={{ fontSize: 14 }}>&#9888;</span>
            ) : checked ? (
              <span style={{ fontSize: 14 }}>&#10003;</span>
            ) : null}
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>
              {loading
                ? 'Checking interactions…'
                : error
                  ? error
                  : interactions.length > 0
                    ? `Interaction warnings (${interactions.length})`
                    : 'No known interactions'}
            </span>
            {!loading && (
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {interactions.length > 0 ? (panelOpen ? 'Hide' : 'Show') : null}
              </span>
            )}
          </button>

          {/* Panel body */}
          {panelOpen && !loading && (
            <div style={{ padding: '0 14px 12px' }}>
              {interactions.length === 0 && checked && !error && (
                <p style={{ fontSize: 12, color: '#15803d', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>&#10003;</span> No clinically significant interactions detected between the listed medications.
                </p>
              )}
              {interactions.map((ix, idx) => {
                const severityColor =
                  ix.severity === 'major' ? { bg: '#fee2e2', badge: '#dc2626', border: '#fca5a5', label: 'MAJOR' }
                  : ix.severity === 'moderate' ? { bg: '#ffedd5', badge: '#ea580c', border: '#fdba74', label: 'MODERATE' }
                  : { bg: '#fef9c3', badge: '#ca8a04', border: '#fde68a', label: 'MINOR' };
                return (
                  <div
                    key={idx}
                    style={{
                      marginBottom: idx < interactions.length - 1 ? 8 : 0,
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: `1px solid ${severityColor.border}`,
                      background: severityColor.bg,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800,
                        background: severityColor.badge, color: '#fff', letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        {severityColor.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                        {ix.drug1} + {ix.drug2}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: '#374151', margin: '0 0 3px' }}>{ix.description}</p>
                    {ix.mechanism && (
                      <p style={{ fontSize: 10, color: '#6B7280', margin: 0, fontStyle: 'italic' }}>
                        Mechanism: {ix.mechanism}
                      </p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => void checkNow()}
                style={{
                  marginTop: interactions.length > 0 ? 8 : 6,
                  fontSize: 11, fontWeight: 700, color: '#0f5fa8',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Re-check →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
