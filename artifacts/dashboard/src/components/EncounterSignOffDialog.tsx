import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getMatrix } from '@/lib/cc-matrices';
import { computeSectionDone } from '@/lib/workflow-completion';
import { buildSignOffSummary, DEFAULT_SIGNOFF_STEPS } from '@/lib/encounter-signoff';

interface Props {
  open: boolean;
  completing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * In-app sign-off before an encounter is closed (UX review M8) — replaces the bare browser
 * confirm(). Lists what is still missing (undocumented steps, allergies not recorded, no
 * confirmed diagnosis); closing stays possible after the clinician ticks the review line and
 * taps "Sign & close encounter".
 */
export default function EncounterSignOffDialog({ open, completing, onCancel, onConfirm }: Props) {
  const ctx = useAppContext();
  const [reviewed, setReviewed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // UI state only (the review tick), reset each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setReviewed(false);
    dialogRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  const summary = useMemo(() => {
    const matrix = ctx.activeCcKey ? getMatrix(ctx.activeCcKey) : undefined;
    return buildSignOffSummary({
      steps: matrix?.sections ?? DEFAULT_SIGNOFF_STEPS,
      done: computeSectionDone(ctx),
      allergies: ctx.allergies,
      workingDiagnosis: ctx.workingDiagnosis,
      icdCodes: ctx.icdCodes,
    });
  }, [ctx]);

  if (!open) return null;
  const hasGaps = summary.gaps.length > 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signoff-title"
        tabIndex={-1}
        data-testid="encounter-signoff"
        style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '18px 20px', outline: 'none', color: '#0f172a' }}
      >
        <h2 id="signoff-title" style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>
          Review and sign — close encounter
        </h2>
        <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 12 }}>
          {ctx.patientName?.trim() || 'Patient'}{ctx.mrNumber ? ` · ${ctx.mrNumber}` : ''}
        </div>

        {hasGaps ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Still missing
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
              {summary.gaps.map(g => <li key={g.id}>{g.text}</li>)}
            </ul>
          </div>
        ) : (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#166534' }}>
            All pathway steps documented, allergy status recorded and a diagnosis confirmed.
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#334155', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} style={{ marginTop: 2 }} />
          <span>
            I have reviewed this encounter{hasGaps ? ' and want to close it with the gaps listed above' : ''}.
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Back to encounter
          </button>
          <button type="button" onClick={onConfirm} disabled={!reviewed || completing}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 800,
              background: reviewed && !completing ? '#0d9488' : '#94a3b8', color: '#fff',
              cursor: reviewed && !completing ? 'pointer' : 'not-allowed',
            }}>
            {completing ? 'Closing…' : 'Sign & close encounter'}
          </button>
        </div>
      </div>
    </div>
  );
}
