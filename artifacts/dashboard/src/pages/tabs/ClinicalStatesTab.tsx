import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';

// ── Types ────────────────────────────────────────────────────────────────────

type StateStatus =
  | 'proposed' | 'active' | 'suspected' | 'confirmed'
  | 'improving' | 'worsening' | 'stable'
  | 'pending_investigation' | 'pending_treatment' | 'pending_review'
  | 'resolved' | 'ruled_out' | 'entered_in_error';

type StateType =
  | 'diagnosis' | 'symptom' | 'finding'
  | 'risk_factor' | 'complication' | 'functional_status' | 'other';

interface ClinicalState {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  problem_id: string | null;
  state_type: StateType;
  title: string;
  description: string | null;
  icd10_code: string | null;
  status: StateStatus;
  severity: 'mild' | 'moderate' | 'severe' | 'critical' | null;
  urgency: 'elective' | 'soon' | 'urgent' | 'emergency' | null;
  confidence: 'low' | 'moderate' | 'high' | 'definite' | null;
  evidence_level: string | null;
  source_references: unknown[];
  onset_date: string | null;
  resolution_date: string | null;
  review_date: string | null;
  closure_criteria: string | null;
  next_required_action: string | null;
  created_at: string;
  updated_at: string;
}

interface Transition {
  id: string;
  from_status: string;
  to_status: string;
  transitioned_by: string | null;
  transitioned_at: string;
  reason: string | null;
  notes: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TRANSITIONS: Record<string, string[]> = {
  proposed:              ['suspected', 'active', 'ruled_out'],
  suspected:             ['confirmed', 'active', 'ruled_out', 'pending_investigation'],
  active:                ['improving', 'worsening', 'stable', 'confirmed', 'pending_investigation', 'pending_treatment', 'pending_review', 'resolved'],
  confirmed:             ['improving', 'worsening', 'stable', 'pending_investigation', 'pending_treatment', 'pending_review', 'resolved'],
  improving:             ['stable', 'resolved', 'worsening', 'active'],
  worsening:             ['stable', 'pending_investigation', 'pending_treatment', 'pending_review', 'resolved'],
  stable:                ['improving', 'worsening', 'pending_review', 'resolved'],
  pending_investigation: ['active', 'confirmed', 'suspected', 'resolved', 'ruled_out'],
  pending_treatment:     ['active', 'confirmed', 'improving', 'resolved'],
  pending_review:        ['active', 'confirmed', 'stable', 'resolved'],
  resolved:              ['active'],
  ruled_out:             [],
};

const STATUS_STYLE: Record<StateStatus, { bg: string; fg: string; border: string }> = {
  proposed:              { bg: '#f8fafc', fg: '#475569', border: '#cbd5e1' },
  suspected:             { bg: '#fefce8', fg: '#854d0e', border: '#fde047' },
  active:                { bg: '#eff6ff', fg: '#1d4ed8', border: '#93c5fd' },
  confirmed:             { bg: '#f0f9ff', fg: '#0369a1', border: '#38bdf8' },
  improving:             { bg: '#f0fdf4', fg: '#15803d', border: '#86efac' },
  worsening:             { bg: '#fef2f2', fg: '#dc2626', border: '#fca5a5' },
  stable:                { bg: '#f0fdf4', fg: '#166534', border: '#4ade80' },
  pending_investigation: { bg: '#faf5ff', fg: '#6d28d9', border: '#c4b5fd' },
  pending_treatment:     { bg: '#fff7ed', fg: '#c2410c', border: '#fdba74' },
  pending_review:        { bg: '#fefce8', fg: '#92400e', border: '#fcd34d' },
  resolved:              { bg: '#f1f5f9', fg: '#64748b', border: '#cbd5e1' },
  ruled_out:             { bg: '#f1f5f9', fg: '#9ca3af', border: '#e5e7eb' },
  entered_in_error:      { bg: '#f1f5f9', fg: '#9ca3af', border: '#e5e7eb' },
};

const SEVERITY_STYLE: Record<string, string> = {
  mild:     '#16a34a',
  moderate: '#d97706',
  severe:   '#dc2626',
  critical: '#7c3aed',
};

const TYPE_ICON: Record<StateType, string> = {
  diagnosis:        '🔍',
  symptom:          '💬',
  finding:          '📋',
  risk_factor:      '⚠️',
  complication:     '🚨',
  functional_status:'🏃',
  other:            '📌',
};

const ACTIVE_STATUSES = new Set(['proposed', 'suspected', 'active', 'confirmed', 'improving', 'worsening', 'stable', 'pending_investigation', 'pending_treatment', 'pending_review']);

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-LC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClinicalStatesTab() {
  const { patientId, encounterId: ctxEncounterId } = useAppContext();
  const { showToast } = useToast();

  const [states, setStates]           = useState<ClinicalState[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [transitions, setTransitions] = useState<Record<string, Transition[]>>({});
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`/api/clinical-states?patientId=${patientId}`, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json() as { states: ClinicalState[] };
      setStates(json.states);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') showToast('Failed to load clinical states', 'error');
    } finally {
      setLoading(false);
    }
  }, [patientId, showToast]);

  useEffect(() => { void load(); }, [load]);

  async function loadTransitions(stateId: string) {
    if (transitions[stateId]) return;
    try {
      const resp = await fetch(`/api/clinical-states/${stateId}`);
      if (!resp.ok) return;
      const json = await resp.json() as { state: ClinicalState; transitions: Transition[] };
      setTransitions(t => ({ ...t, [stateId]: json.transitions }));
    } catch { /* non-fatal */ }
  }

  async function doTransition(stateId: string, toStatus: string, reason?: string) {
    setTransitioning(stateId);
    try {
      const resp = await fetch(`/api/clinical-states/${stateId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus, reason }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast(`Status → ${statusLabel(toStatus)}`, 'success');
      setTransitions(t => { const copy = { ...t }; delete copy[stateId]; return copy; });
      await load();
    } catch {
      showToast('Transition failed', 'error');
    } finally {
      setTransitioning(null);
    }
  }

  async function doDelete(stateId: string) {
    if (!confirm('Mark this state as entered in error?')) return;
    try {
      await fetch(`/api/clinical-states/${stateId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Entered in error by clinician' }),
      });
      showToast('State removed', 'success');
      await load();
    } catch {
      showToast('Failed to remove state', 'error');
    }
  }

  const active   = states.filter(s => ACTIVE_STATUSES.has(s.status));
  const resolved = states.filter(s => !ACTIVE_STATUSES.has(s.status));

  // Sort active: worsening first, then by severity, then created_at
  const severityRank: Record<string, number> = { critical: 0, severe: 1, moderate: 2, mild: 3 };
  const statusRank: Record<string, number> = {
    worsening: 0, pending_investigation: 1, pending_treatment: 2,
    pending_review: 3, confirmed: 4, active: 5, suspected: 6,
    stable: 7, improving: 8, proposed: 9,
  };
  const sorted = [...active].sort((a, b) => {
    const sa = (statusRank[a.status] ?? 10);
    const sb2 = (statusRank[b.status] ?? 10);
    if (sa !== sb2) return sa - sb2;
    const ra = (severityRank[a.severity ?? ''] ?? 4);
    const rb = (severityRank[b.severity ?? ''] ?? 4);
    return ra - rb;
  });

  if (!patientId) {
    return <div style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>Select a patient to view clinical states.</div>;
  }

  return (
    <div style={{ padding: '16px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Clinical States</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>
            {active.length} active · {resolved.length} resolved
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 13 }}
          >
            {loading ? '…' : '↺'}
          </button>
          <button
            onClick={() => setShowCreate(c => !c)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            + Add state
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateStateForm
          patientId={patientId}
          encounterId={ctxEncounterId ?? null}
          onCreated={async () => { setShowCreate(false); await load(); }}
          onCancel={() => setShowCreate(false)}
          showToast={showToast}
        />
      )}

      {/* Active states */}
      {loading && states.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading…</div>
      ) : sorted.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>
          No active clinical states recorded.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(state => (
            <StateCard
              key={state.id}
              state={state}
              transitions={transitions[state.id]}
              isExpanded={expanded === state.id}
              isTransitioning={transitioning === state.id}
              onExpand={async () => {
                const next = expanded === state.id ? null : state.id;
                setExpanded(next);
                if (next) await loadTransitions(next);
              }}
              onTransition={doTransition}
              onDelete={doDelete}
            />
          ))}
        </div>
      )}

      {/* Resolved toggle */}
      {resolved.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowResolved(r => !r)}
            style={{ fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            {showResolved ? '▾' : '▸'} {resolved.length} resolved / ruled out
          </button>
          {showResolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, opacity: 0.75 }}>
              {resolved.map(state => (
                <StateCard
                  key={state.id}
                  state={state}
                  transitions={transitions[state.id]}
                  isExpanded={expanded === state.id}
                  isTransitioning={transitioning === state.id}
                  onExpand={async () => {
                    const next = expanded === state.id ? null : state.id;
                    setExpanded(next);
                    if (next) await loadTransitions(next);
                  }}
                  onTransition={doTransition}
                  onDelete={doDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── StateCard ────────────────────────────────────────────────────────────────

function StateCard({
  state,
  transitions,
  isExpanded,
  isTransitioning,
  onExpand,
  onTransition,
  onDelete,
}: {
  state: ClinicalState;
  transitions?: Transition[];
  isExpanded: boolean;
  isTransitioning: boolean;
  onExpand: () => Promise<void>;
  onTransition: (id: string, to: string, reason?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [selectedTo, setSelectedTo] = useState('');
  const [reason, setReason]         = useState('');
  const ss = STATUS_STYLE[state.status] ?? STATUS_STYLE.proposed;
  const allowed = TRANSITIONS[state.status] ?? [];
  const isTerminal = allowed.length === 0;

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${ss.border}`,
      background: 'var(--surface, #fff)',
      overflow: 'hidden',
    }}>
      {/* Main row */}
      <div
        onClick={() => void onExpand()}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>{TYPE_ICON[state.state_type]}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{state.title}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20,
              background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}`,
            }}>
              {statusLabel(state.status)}
            </span>
            {state.severity && (
              <span style={{ fontSize: 11, fontWeight: 600, color: SEVERITY_STYLE[state.severity] ?? '#374151' }}>
                {state.severity}
              </span>
            )}
            {state.icd10_code && (
              <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{state.icd10_code}</span>
            )}
          </div>

          {state.description && !isExpanded && (
            <div style={{ fontSize: 13, color: '#374151', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {state.description}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 12, color: '#9ca3af' }}>
            {state.onset_date && <span>Onset {fmtDate(state.onset_date)}</span>}
            {state.review_date && <span>Review {fmtDate(state.review_date)}</span>}
            {state.resolution_date && <span>Resolved {fmtDate(state.resolution_date)}</span>}
            {!state.onset_date && <span>Added {fmtDate(state.created_at)}</span>}
          </div>
        </div>

        <span style={{ color: '#9ca3af', fontSize: 14, marginTop: 2, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${ss.border}`, padding: '14px 14px 14px 44px', background: 'var(--surface-alt, #fafafa)' }}>

          {state.description && (
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>{state.description}</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px 16px', marginBottom: 12 }}>
            {state.urgency    && <Meta label="Urgency"    value={state.urgency} />}
            {state.confidence && <Meta label="Confidence" value={state.confidence} />}
            {state.evidence_level && <Meta label="Evidence"   value={state.evidence_level.replace(/_/g,' ')} />}
            {state.next_required_action && <Meta label="Next action" value={state.next_required_action} />}
            {state.closure_criteria && <Meta label="Closure criteria" value={state.closure_criteria} />}
          </div>

          {/* Transition history */}
          {transitions && transitions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {transitions.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{fmtDate(t.transitioned_at)}</span>
                    <span style={{ color: '#d1d5db' }}>·</span>
                    <span style={{ color: '#6b7280' }}>{statusLabel(t.from_status)}</span>
                    <span style={{ color: '#9ca3af' }}>→</span>
                    <span style={{ fontWeight: 600 }}>{statusLabel(t.to_status)}</span>
                    {t.reason && <span style={{ color: '#6b7280' }}>— {t.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transition control */}
          {!isTerminal && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <select
                value={selectedTo}
                onChange={e => setSelectedTo(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
              >
                <option value="">— Transition to —</option>
                {allowed.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              {selectedTo && (
                <input
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: 180 }}
                />
              )}
              {selectedTo && (
                <button
                  disabled={isTransitioning}
                  onClick={() => { void onTransition(state.id, selectedTo, reason || undefined); setSelectedTo(''); setReason(''); }}
                  style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {isTransitioning ? '…' : 'Apply'}
                </button>
              )}
            </div>
          )}

          {/* Error / remove */}
          <button
            onClick={() => void onDelete(state.id)}
            style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Mark as entered in error
          </button>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

// ── CreateStateForm ───────────────────────────────────────────────────────────

type ShowToast = (msg: string, type: 'success' | 'error' | 'info') => void;

function CreateStateForm({
  patientId, encounterId,
  onCreated, onCancel, showToast,
}: {
  patientId: string;
  encounterId: string | null;
  onCreated: () => Promise<void>;
  onCancel: () => void;
  showToast: ShowToast;
}) {
  const [stateType, setStateType] = useState<StateType>('diagnosis');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [icd10, setIcd10]         = useState('');
  const [severity, setSeverity]   = useState('');
  const [urgency, setUrgency]     = useState('');
  const [confidence, setConf]     = useState('');
  const [onsetDate, setOnset]     = useState('');
  const [reviewDate, setReview]   = useState('');
  const [nextAction, setNext]     = useState('');
  const [saving, setSaving]       = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/clinical-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId, encounterId,
          stateType, title: title.trim(),
          description: description.trim() || null,
          icd10Code: icd10.trim() || null,
          severity: severity || null, urgency: urgency || null,
          confidence: confidence || null,
          onsetDate: onsetDate || null, reviewDate: reviewDate || null,
          nextRequiredAction: nextAction.trim() || null,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast('Clinical state added', 'success');
      await onCreated();
    } catch {
      showToast('Failed to add state', 'error');
    } finally {
      setSaving(false);
    }
  }

  const sel = (v: string, onChange: (s: string) => void, opts: string[], label: string) => (
    <label style={{ fontSize: 12, color: '#374151' }}>
      {label}
      <select
        value={v}
        onChange={e => onChange(e.target.value)}
        style={{ display: 'block', width: '100%', padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }}
      >
        <option value="">—</option>
        {opts.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g,' ')}</option>)}
      </select>
    </label>
  );

  return (
    <form
      onSubmit={e => void submit(e)}
      style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16, background: '#f9fafb' }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New clinical state</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {sel(stateType, s => setStateType(s as StateType),
          ['diagnosis','symptom','finding','risk_factor','complication','functional_status','other'],
          'Type')}
        {sel(severity, setSeverity, ['mild','moderate','severe','critical'], 'Severity')}
        {sel(urgency, setUrgency, ['elective','soon','urgent','emergency'], 'Urgency')}
        {sel(confidence, setConf, ['low','moderate','high','definite'], 'Confidence')}
      </div>

      <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 10 }}>
        Title *
        <input
          required value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Right inguinal hernia"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: '#374151' }}>
          ICD-10 (optional)
          <input value={icd10} onChange={e => setIcd10(e.target.value)} placeholder="K40.9"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: '#374151' }}>
          Onset date
          <input type="date" value={onsetDate} onChange={e => setOnset(e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: '#374151' }}>
          Review date
          <input type="date" value={reviewDate} onChange={e => setReview(e.target.value)}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 12, color: '#374151' }}>
          Next required action
          <input value={nextAction} onChange={e => setNext(e.target.value)} placeholder="e.g. USS abdomen"
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13 }} />
        </label>
      </div>

      <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 12 }}>
        Description (optional)
        <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 3, fontSize: 13, resize: 'vertical' }} />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving || !title.trim()}
          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {saving ? 'Saving…' : 'Add state'}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
