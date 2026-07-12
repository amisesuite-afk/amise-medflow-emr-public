import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

// ─── API types ───────────────────────────────────────────────────────────────

interface Analyte {
  name: string;
  value: string;
  unit: string;
  ref: string;
  abnormal: boolean;
  critical: boolean;
}

interface LabResult {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  test_name: string;
  test_category: string;
  result_value: string | null;
  analytes: Analyte[] | null;
  is_abnormal: boolean;
  is_critical: boolean;
  status: string;
  reported_at: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  action_taken?: string | null;
}

interface ImagingOrder {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  order_type: string;
  body_area: string | null;
  clinical_indication: string | null;
  urgency: string;
  status: string;
  report_received_at: string | null;
  report_text: string | null;
  radiologist: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  action_taken?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const URGENCY_STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
  stat:    { bg: '#fef2f2', fg: '#b91c1c', bd: '#fca5a5' },
  urgent:  { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
  routine: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1' },
};

const CAT_LABEL: Record<string, string> = {
  haematology: 'Haem', biochemistry: 'Biochem', cardiac: 'Cardiac',
  urine: 'Urine', stool: 'Stool', other: 'Other',
};

// ─── Patient name cache ───────────────────────────────────────────────────────

async function fetchPatientNames(ids: string[]): Promise<Map<string, string>> {
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase
    .from('patients')
    .select('id, full_name')
    .in('id', ids);
  const m = new Map<string, string>();
  for (const r of ((data ?? []) as Array<{ id: string; full_name: string | null }>)) {
    if (r.full_name) m.set(r.id, r.full_name);
  }
  return m;
}

// ─── Acknowledge inline form ──────────────────────────────────────────────────

function AcknowledgeForm({
  saving,
  onConfirm,
  onSkip,
  onCancel,
}: {
  saving: boolean;
  onConfirm: (text: string | null) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [actionText, setActionText] = useState('');

  return (
    <div style={{
      marginTop: 8,
      padding: '10px 11px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 7,
    }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>
        Action taken (optional)
      </label>
      <textarea
        value={actionText}
        onChange={e => setActionText(e.target.value)}
        placeholder="e.g. Contacted patient, GP notified, repeat test ordered…"
        rows={2}
        disabled={saving}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 12,
          padding: '6px 8px',
          borderRadius: 5,
          border: '1px solid var(--border)',
          background: saving ? '#f8fafc' : 'var(--bg, #fff)',
          color: 'var(--fg)',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 7, alignItems: 'center' }}>
        <button
          onClick={() => onConfirm(actionText.trim() || null)}
          disabled={saving}
          style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: '1px solid #16a34a', background: saving ? '#dcfce7' : '#16a34a', color: '#fff',
          }}
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: '1px solid #d1d5db', background: 'var(--surface)', color: '#374151',
          }}
        >
          Skip
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: 'none', background: 'none', color: 'var(--muted)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Reviewed badge ───────────────────────────────────────────────────────────

function ReviewedBadge({ acknowledgedAt, actionTaken }: { acknowledgedAt?: string | null; actionTaken?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 700, color: '#16a34a',
        padding: '3px 8px', borderRadius: 4,
        background: '#dcfce7', border: '1px solid #86efac',
        alignSelf: 'flex-start',
      }}>
        ✓ Reviewed{acknowledgedAt ? ` · ${relTime(acknowledgedAt)}` : ''}
      </span>
      {actionTaken && (
        <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 2 }}>
          Action: <span style={{ color: 'var(--fg)' }}>{actionTaken}</span>
        </div>
      )}
    </div>
  );
}

// ─── Lab result card ─────────────────────────────────────────────────────────

function LabCard({
  result, name, reviewing, onAcknowledge,
}: {
  result: LabResult;
  name: string;
  reviewing: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const isReviewed = result.status === 'reviewed' || !!result.acknowledged_at;
  const critBorder = result.is_critical ? '#dc2626' : result.is_abnormal ? '#d97706' : 'var(--border)';
  const critBg     = result.is_critical ? '#fef2f2' : result.is_abnormal ? '#fffbeb' : 'var(--surface)';

  return (
    <div style={{
      border: `1px solid ${critBorder}`,
      borderLeft: `3px solid ${critBorder}`,
      borderRadius: 8,
      background: critBg,
      padding: '11px 13px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{result.test_name}</span>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
          {CAT_LABEL[result.test_category] ?? result.test_category}
        </span>
        {result.is_critical && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#b91c1c', color: '#fff' }}>
            CRITICAL
          </span>
        )}
        {!result.is_critical && result.is_abnormal && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#d97706', color: '#fff' }}>
            ABNORMAL
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {relTime(result.reported_at ?? result.created_at)}
        </span>
      </div>

      {/* Patient + date */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: 'var(--fg)' }}>{name}</b>
        {result.reported_at && ` · ${dateLabel(result.reported_at)}`}
      </div>

      {/* Analytes */}
      {result.analytes && result.analytes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {result.analytes.map((a, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 4,
              background: a.critical ? '#fee2e2' : a.abnormal ? '#fef3c7' : 'var(--neu-bg, #f8fafc)',
              color: a.critical ? '#b91c1c' : a.abnormal ? '#92400e' : 'var(--muted)',
              border: `1px solid ${a.critical ? '#fca5a5' : a.abnormal ? '#fcd34d' : '#e2e8f0'}`,
              fontFamily: 'monospace',
            }}>
              {a.name}: <b>{a.value}</b>{a.unit ? ` ${a.unit}` : ''}{a.ref ? ` [${a.ref}]` : ''}{a.critical ? ' ⚠' : a.abnormal ? ' ↑' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Free-text result */}
      {result.result_value && (
        <div style={{ fontSize: 12, color: 'var(--fg)', marginBottom: 6, fontStyle: 'italic' }}>
          {result.result_value}
        </div>
      )}

      {/* Review / acknowledge area */}
      {isReviewed ? (
        <ReviewedBadge acknowledgedAt={result.acknowledged_at} actionTaken={result.action_taken} />
      ) : showForm ? (
        <AcknowledgeForm
          saving={reviewing}
          onConfirm={text => onAcknowledge(result.id, text)}
          onSkip={() => onAcknowledge(result.id, null)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
            border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600,
          }}
        >
          ✓ Mark reviewed
        </button>
      )}
    </div>
  );
}

// ─── Imaging order card ───────────────────────────────────────────────────────

function ImagingCard({
  order, name, reviewing, onAcknowledge,
}: {
  order: ImagingOrder;
  name: string;
  reviewing: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
}) {
  const urgStyle = URGENCY_STYLE[order.urgency] ?? URGENCY_STYLE.routine;
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const isReviewed = order.status === 'reviewed' || !!order.acknowledged_at;

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${urgStyle.bd}`,
      borderRadius: 8,
      background: 'var(--surface)',
      padding: '11px 13px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{order.order_type}</span>
        {order.body_area && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{order.body_area}</span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          background: urgStyle.bg, color: urgStyle.fg, border: `1px solid ${urgStyle.bd}`,
        }}>
          {order.urgency.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {relTime(order.report_received_at ?? order.created_at)}
        </span>
      </div>

      {/* Patient + date */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: 'var(--fg)' }}>{name}</b>
        {order.report_received_at && ` · ${dateLabel(order.report_received_at)}`}
        {order.radiologist && ` · ${order.radiologist}`}
      </div>

      {/* Indication */}
      {order.clinical_indication && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
          Indication: <span style={{ color: 'var(--fg)' }}>{order.clinical_indication}</span>
        </div>
      )}

      {/* Report — collapsible */}
      {order.report_text && (
        <div style={{ marginBottom: 6 }}>
          <button
            onClick={() => setExpanded(x => !x)}
            style={{ fontSize: 11, color: '#1d4ed8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
          >
            {expanded ? '▲ Hide report' : '▼ Show report'}
          </button>
          {expanded && (
            <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--fg)', lineHeight: 1.5, background: '#f8fafc', borderRadius: 5, padding: '8px 10px', border: '1px solid #e2e8f0' }}>
              {order.report_text}
            </pre>
          )}
        </div>
      )}

      {/* Review / acknowledge area */}
      {isReviewed ? (
        <ReviewedBadge acknowledgedAt={order.acknowledged_at} actionTaken={order.action_taken} />
      ) : showForm ? (
        <AcknowledgeForm
          saving={reviewing}
          onConfirm={text => onAcknowledge(order.id, text)}
          onSkip={() => onAcknowledge(order.id, null)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
            border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600,
          }}
        >
          ✓ Mark reviewed
        </button>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type TabId = 'labs' | 'imaging';
type Filter = 'all' | 'critical';

export default function ResultsInboxTab() {
  const [labResults, setLabResults]       = useState<LabResult[]>([]);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [names, setNames]                 = useState<Map<string, string>>(new Map());
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<TabId>('labs');
  const [filter, setFilter]               = useState<Filter>('all');
  const [reviewing, setReviewing]         = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await staffAuthHeaders();
      const res = await fetch(apiUrl('/api/investigations/pending'), { headers });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const body = await res.json() as { labResults: LabResult[]; imagingOrders: ImagingOrder[] };
      setLabResults(body.labResults ?? []);
      setImagingOrders(body.imagingOrders ?? []);

      // Resolve patient names
      const allIds = [
        ...new Set([
          ...(body.labResults ?? []).map(r => r.patient_id),
          ...(body.imagingOrders ?? []).map(r => r.patient_id),
        ]),
      ];
      const nameMap = await fetchPatientNames(allIds);
      setNames(nameMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 90_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  async function acknowledge(
    id: string,
    actionText: string | null,
    table: 'investigation_results' | 'imaging_orders',
  ) {
    if (!supabase) {
      setError('Supabase client not available');
      return;
    }
    setReviewing(s => new Set(s).add(id));
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        status: 'reviewed',
        acknowledged_at: now,
      };
      if (actionText !== null) payload.action_taken = actionText;

      const { error: sbErr } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id);

      if (sbErr) throw sbErr;

      // Update local state: mark item as reviewed so the reviewed badge is shown.
      // The item will disappear from the list on the next refresh (90 s) since
      // the pending endpoint no longer returns reviewed results.
      if (table === 'investigation_results') {
        setLabResults(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, status: 'reviewed', acknowledged_at: now, action_taken: actionText }
              : r,
          ),
        );
      } else {
        setImagingOrders(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, status: 'reviewed', acknowledged_at: now, action_taken: actionText }
              : r,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acknowledge failed');
    } finally {
      setReviewing(s => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  // Counts exclude already-reviewed items (reviewed in this session)
  const unreviewedLabCount  = labResults.filter(r => r.status !== 'reviewed' && !r.acknowledged_at).length;
  const unreviewedImgCount  = imagingOrders.filter(r => r.status !== 'reviewed' && !r.acknowledged_at).length;
  const criticalLabCount    = labResults.filter(r => r.is_critical && r.status !== 'reviewed' && !r.acknowledged_at).length;

  const filteredLabs = filter === 'critical'
    ? labResults.filter(r => r.is_critical)
    : labResults;

  const filteredImaging = imagingOrders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--fg)' }}>Results inbox</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            Unreviewed results across all patients
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {criticalLabCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#b91c1c', color: '#fff' }}>
              {criticalLabCount} critical
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: loading ? 'default' : 'pointer' }}
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Tab strip + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {(['labs', 'imaging'] as TabId[]).map(t => {
          const count = t === 'labs' ? unreviewedLabCount : unreviewedImgCount;
          const isActive = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
                border: isActive ? '1.5px solid #0f172a' : '1px solid var(--border)',
                background: isActive ? '#0f172a' : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t === 'labs' ? 'Lab results' : 'Imaging'}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10,
                  background: isActive ? '#fff3' : (t === 'labs' && criticalLabCount > 0 ? '#b91c1c' : '#94a3b8'),
                  color: '#fff',
                  minWidth: 16, textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {activeTab === 'labs' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['all', 'critical'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  border: filter === f ? '1.5px solid #0f172a' : '1px solid var(--border)',
                  background: filter === f ? '#0f172a' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--muted)', fontWeight: 600,
                }}
              >
                {f === 'all' ? 'All' : 'Critical only'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading && (unreviewedLabCount + unreviewedImgCount) === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>Loading…</div>
      ) : activeTab === 'labs' ? (
        filteredLabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
            {filter === 'critical' ? 'No critical results pending.' : 'No unreviewed lab results.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLabs.map(r => (
              <LabCard
                key={r.id}
                result={r}
                name={names.get(r.patient_id) ?? r.patient_id}
                reviewing={reviewing.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'investigation_results')}
              />
            ))}
          </div>
        )
      ) : (
        filteredImaging.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
            No unreviewed imaging reports.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredImaging.map(r => (
              <ImagingCard
                key={r.id}
                order={r}
                name={names.get(r.patient_id) ?? r.patient_id}
                reviewing={reviewing.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'imaging_orders')}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
