import { lazy, Suspense, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { allergyHeaderLabel, allergyStatus } from '@/lib/allergy-status';
import { CONSULT_TOOLS, type ConsultToolId } from '@/lib/consult-steps';

const ScalesTab           = lazy(() => import('@/pages/tabs/ScalesTab'));
const VitalsMonitoringTab = lazy(() => import('@/pages/tabs/VitalsMonitoringTab'));
const PrescriptionsTab    = lazy(() => import('@/pages/tabs/PrescriptionsTab'));
const ProgressNotesTab    = lazy(() => import('@/pages/tabs/ProgressNotesTab'));
const PatientTasksTab     = lazy(() => import('@/pages/tabs/PatientTasksTab'));

interface Props {
  tool: ConsultToolId | null;
  onClose: () => void;
}

/**
 * Side panel that opens a consultation tool (Scores, Vitals, Prescriptions, Notes, Tasks) over
 * the current step (UX review top-10 #10). The step underneath stays where it was: this panel
 * never changes the active step or section. Whose record it is stays visible at its top.
 */
export default function ConsultToolDrawer({ tool, onClose }: Props) {
  const { patientName, mrNumber, allergies } = useAppContext();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!tool) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tool, onClose]);

  if (!tool) return null;
  const meta = CONSULT_TOOLS.find(t => t.id === tool);
  const allergy = allergyStatus(allergies);

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`${meta?.label ?? 'Tool'} — ${patientName || 'patient'}`}
      data-testid="consult-tool-drawer"
      style={{
        position: 'fixed', top: 48, right: 0, bottom: 0, width: 560, maxWidth: '100vw',
        zIndex: 840, background: 'var(--bg, #fff)', borderLeft: '1px solid #cbd5e1',
        boxShadow: '-6px 0 28px rgba(15,23,42,.14)', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderBottom: '1px solid #e2e8f0', background: 'var(--accent-lt, #f0fdfa)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink, #0f172a)' }}>
            {meta?.icon} {meta?.label}
          </span>
          {/* Patient identity stays visible over the step (wrong-patient prevention). */}
          <span data-testid="consult-tool-patient" style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {patientName || 'Unnamed patient'}{mrNumber ? ` · ${mrNumber}` : ''}{' · '}
            <span style={{
              fontWeight: 700,
              color: allergy.kind === 'recorded' ? '#b91c1c' : allergy.kind === 'not_recorded' ? '#b45309' : '#475569',
            }}>
              {allergyHeaderLabel(allergies)}
            </span>
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>Opened over the current step — close to carry on where you were.</span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close and return to the step"
          data-testid="consult-tool-close"
          style={{ minWidth: 44, minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 8, background: 'var(--bg, #fff)', cursor: 'pointer', fontSize: 16, color: '#334155' }}
        >
          ✕
        </button>
      </div>
      <div style={{ overflowY: 'auto', padding: '12px 12px 24px', flex: 1 }}>
        <Suspense fallback={<div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}>
          <ErrorBoundary resetKeys={[tool]}>
            {tool === 'scales'        && <ScalesTab />}
            {tool === 'monitoring'    && <VitalsMonitoringTab />}
            {tool === 'prescriptions' && <PrescriptionsTab />}
            {tool === 'progress'      && <ProgressNotesTab />}
            {tool === 'tasks'         && <PatientTasksTab />}
          </ErrorBoundary>
        </Suspense>
      </div>
    </aside>
  );
}
