import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ToastProvider';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  patient_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  mode: string | null;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  view:             { bg: '#eff6ff', fg: '#2563eb' },
  create:           { bg: '#f0fdf4', fg: '#16a34a' },
  update:           { bg: '#fefce8', fg: '#92400e' },
  delete:           { bg: '#fef2f2', fg: '#dc2626' },
  approve:          { bg: '#f0fdf4', fg: '#15803d' },
  reject:           { bg: '#fef2f2', fg: '#b91c1c' },
  export:           { bg: '#faf5ff', fg: '#7c3aed' },
  sign:             { bg: '#f0f9ff', fg: '#0369a1' },
  amend:            { bg: '#fff7ed', fg: '#c2410c' },
  ai_call:          { bg: '#faf5ff', fg: '#6d28d9' },
  ai_approve:       { bg: '#f0fdf4', fg: '#166534' },
  ai_reject:        { bg: '#fef2f2', fg: '#991b1b' },
  state_transition: { bg: '#f0f9ff', fg: '#0c4a6e' },
  task_resolve:     { bg: '#f0fdf4', fg: '#14532d' },
  task_dismiss:     { bg: '#f1f5f9', fg: '#475569' },
  login:            { bg: '#f0fdf4', fg: '#166534' },
  logout:           { bg: '#f1f5f9', fg: '#64748b' },
  access_denied:    { bg: '#fef2f2', fg: '#dc2626' },
};

const ACTIONS = [
  'view','create','update','delete','approve','reject','export',
  'sign','amend','ai_call','ai_approve','ai_reject',
  'state_transition','task_resolve','task_dismiss',
  'login','logout','access_denied',
];

const RESOURCE_TYPES = [
  'patient','encounter','clinical_note','investigation_result','imaging_order',
  'document','ai_proposal','clinical_state','workflow_task','referral',
  'invoice','appointment','user','system','voice_transcript',
  'call_record','patient_message','letter','prescription',
];

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('en-LC', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function actionStyle(action: string) {
  return ACTION_STYLE[action] ?? { bg: '#f1f5f9', fg: '#475569' };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AuditLogTab() {
  const { showToast } = useToast();

  const [entries, setEntries]       = useState<AuditEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Filters
  const [action, setAction]             = useState('');
  const [resourceType, setResourceType] = useState('');
  const [patientId, setPatientId]       = useState('');
  const [userEmail, setUserEmail]       = useState('');
  const [from, setFrom]                 = useState('');
  const [to, setTo]                     = useState('');
  const [offset, setOffset]             = useState(0);
  const LIMIT = 50;

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (resetOffset = false) => {
    const off = resetOffset ? 0 : offset;
    if (resetOffset) setOffset(0);

    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (action)       params.set('action', action);
      if (resourceType) params.set('resourceType', resourceType);
      if (patientId.trim()) params.set('patientId', patientId.trim());
      if (from) params.set('from', new Date(from).toISOString());
      if (to)   params.set('to',   new Date(to).toISOString());

      const resp = await fetch(`/api/audit-log?${params.toString()}`, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json() as { entries: AuditEntry[] };
      setEntries(json.entries);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') showToast('Failed to load audit log', 'error');
    } finally {
      setLoading(false);
    }
  }, [action, resourceType, patientId, from, to, offset, showToast]);

  useEffect(() => { void load(); }, [load]);

  function prev() { setOffset(o => Math.max(0, o - LIMIT)); }
  function next() { setOffset(o => o + LIMIT); }

  return (
    <div style={{ padding: '16px', maxWidth: 1000 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Audit Log</h2>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>All access and modification events — admin view only</p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontSize: 13 }}
        >
          {loading ? '…' : '↺ Refresh'}
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={action} onChange={e => { setAction(e.target.value); void load(true); }}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={resourceType} onChange={e => { setResourceType(e.target.value); void load(true); }}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
          <option value="">All resources</option>
          {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <input
          placeholder="Patient ID (UUID)"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void load(true); }}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: 200 }}
        />

        <input type="date" value={from} onChange={e => { setFrom(e.target.value); void load(true); }}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
        <input type="date" value={to} onChange={e => { setTo(e.target.value); void load(true); }}
          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />

        {(action || resourceType || patientId || from || to) && (
          <button onClick={() => { setAction(''); setResourceType(''); setPatientId(''); setFrom(''); setTo(''); void load(true); }}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading && entries.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>No audit entries found.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Timestamp', 'User', 'Action', 'Resource', 'Patient', 'IP', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const as = actionStyle(e.action);
                  const isExp = expanded === e.id;
                  return [
                    <tr key={e.id}
                      style={{ borderBottom: '1px solid #f3f4f6', cursor: e.details ? 'pointer' : 'default' }}
                      onClick={() => e.details && setExpanded(isExp ? null : e.id)}
                    >
                      <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtDatetime(e.created_at)}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.user_email ?? e.user_id?.slice(0, 8) ?? '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: as.bg, color: as.fg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {e.action}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {e.resource_type ?? '—'}
                        {e.resource_id && <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 4 }}>…{e.resource_id.slice(-6)}</span>}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}>
                        {e.patient_id ? `…${e.patient_id.slice(-8)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 11 }}>{e.ip_address ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#9ca3af', fontSize: 12 }}>{e.details ? (isExp ? '▲' : '▼') : ''}</td>
                    </tr>,
                    isExp && e.details ? (
                      <tr key={`${e.id}-detail`} style={{ background: '#f8fafc' }}>
                        <td colSpan={7} style={{ padding: '10px 16px' }}>
                          <pre style={{ fontSize: 12, color: '#374151', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify(e.details, null, 2)}
                          </pre>
                          {e.user_agent && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>UA: {e.user_agent}</div>
                          )}
                          {e.mode && (
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>Mode: {e.mode}</div>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: '#6b7280' }}>
            <span>{offset + 1}–{offset + entries.length} entries</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={prev} disabled={offset === 0}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: offset === 0 ? 'default' : 'pointer', color: offset === 0 ? '#d1d5db' : '#374151' }}>
                ← Prev
              </button>
              <button onClick={next} disabled={entries.length < LIMIT}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: entries.length < LIMIT ? 'default' : 'pointer', color: entries.length < LIMIT ? '#d1d5db' : '#374151' }}>
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
