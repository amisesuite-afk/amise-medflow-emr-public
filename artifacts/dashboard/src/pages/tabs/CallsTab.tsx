import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { errMsg } from '@/lib/err';
import { fmtPhone } from '@/lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientRef {
  first_name: string | null;
  last_name: string | null;
}

interface CallLog {
  id: string;
  caller_number: string | null;
  patient_id: string | null;
  patients?: PatientRef | null;
  direction: string;
  source: string;
  status: string;
  audio_path: string | null;
  duration_s: number | null;
  practice_line: string | null;
  staff_notes: string | null;
  transcript: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

type CallsView = 'queue' | 'log';

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

function fmtDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    timeZone: 'America/St_Lucia',
    day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function patientName(c: CallLog): string | null {
  if (!c.patients) return null;
  const { first_name, last_name } = c.patients;
  const parts = [first_name, last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CallsTab() {
  const { profile } = useAuth();
  const userRole = profile?.role ?? 'front_desk';

  const [view, setView]             = useState<CallsView>('queue');
  const [calls, setCalls]           = useState<CallLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<CallLog | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Detail panel state
  const [signedUrl, setSignedUrl]   = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [notes, setNotes]           = useState('');
  const [reviewing, setReviewing]   = useState(false);
  const [reviewOk, setReviewOk]     = useState(false);
  const [reviewErr, setReviewErr]   = useState<string | null>(null);

  // Log-view filters
  const [filterDir, setFilterDir]   = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]     = useState('');
  const [filterPractice, setFilterPractice] = useState('');

  const load = useCallback(async () => {
    try {
      let url: string;
      if (view === 'queue') {
        url = apiUrl('/api/calls/unresolved');
      } else {
        const params = new URLSearchParams({ limit: '200' });
        if (filterDir)      params.set('direction', filterDir);
        if (filterPractice) params.set('practice_line', filterPractice);
        if (filterFrom)     params.set('from', new Date(filterFrom + 'T00:00:00-04:00').toISOString());
        if (filterTo)       params.set('to',   new Date(filterTo   + 'T23:59:59-04:00').toISOString());
        url = apiUrl(`/api/calls/audit?${params}`);
      }
      const r = await fetch(url, { headers: await staffAuthHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { calls: CallLog[] };
      setCalls(d.calls ?? []);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [view, filterDir, filterFrom, filterTo, filterPractice]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (view !== 'queue') return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load, view]);

  // When selected changes — load signed URL and pre-fill notes
  useEffect(() => {
    setSignedUrl(null);
    setReviewOk(false);
    setReviewErr(null);
    if (!selected) return;
    setNotes(selected.staff_notes ?? '');
    if (!selected.audio_path) return;
    setAudioLoading(true);
    let ignore = false;
    staffAuthHeaders().then(headers =>
      fetch(apiUrl(`/api/calls/${selected.id}/signed-audio-url`), { headers })
    ).then(async r => {
      if (!r.ok) return;
      const d = await r.json() as { signedUrl?: string };
      if (!ignore && d.signedUrl) setSignedUrl(d.signedUrl);
    }).catch(() => {/* audio unavailable — non-fatal */})
    .finally(() => { if (!ignore) setAudioLoading(false); });
    return () => { ignore = true; };
  }, [selected?.id]);

  async function handleReview() {
    if (!selected) return;
    setReviewing(true);
    setReviewErr(null);
    try {
      const r = await fetch(apiUrl(`/api/calls/${selected.id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setReviewOk(true);
      await load();
      setTimeout(() => { setSelected(null); setReviewOk(false); }, 1500);
    } catch (e) {
      setReviewErr(errMsg(e));
    } finally {
      setReviewing(false);
    }
  }

  const unreviewed = calls.filter(c => !c.reviewed_at).length;

  // ── Tab style helper ──────────────────────────────────────────────────────

  const TAB = (active: boolean) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? '#0d9488' : '#6b7280', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
    cursor: 'pointer',
  });

  // ── Log view ──────────────────────────────────────────────────────────────

  const logView = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Filters */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Direction</div>
          <select
            value={filterDir}
            onChange={e => setFilterDir(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
          >
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Practice line</div>
          <select
            value={filterPractice}
            onChange={e => setFilterPractice(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
          >
            <option value="">All</option>
            <option value="Tapion">Tapion</option>
            <option value="Rodney Bay">Rodney Bay</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>From date</div>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>To date</div>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }}
          />
        </div>
        <button
          onClick={() => void load()}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, cursor: 'pointer' }}
        >
          Apply
        </button>
        {(filterDir || filterFrom || filterTo || filterPractice) && (
          <button
            onClick={() => { setFilterDir(''); setFilterFrom(''); setFilterTo(''); setFilterPractice(''); }}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>
          {calls.length} record{calls.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center' }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 20 }}>
            <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>
              {error} <button onClick={() => void load()} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Retry</button>
            </div>
          </div>
        ) : calls.length === 0 ? (
          <div style={{ padding: '40px', color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>No call records found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Time', 'Caller', 'Patient', 'Dir', 'Duration', 'Line', 'Status', 'Reviewed', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map(c => {
                const pName = patientName(c);
                return (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'default' }}
                  >
                    <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDateTime(c.created_at)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{fmtPhone(c.caller_number) || '—'}</td>
                    <td style={{ padding: '8px 12px', color: pName ? '#111827' : '#9ca3af' }}>{pName ?? 'Unknown'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                        background: c.direction === 'inbound' ? '#eff6ff' : '#fff7ed',
                        color: c.direction === 'inbound' ? '#1d4ed8' : '#c2410c',
                        border: `1px solid ${c.direction === 'inbound' ? '#93c5fd' : '#fed7aa'}`,
                      }}>
                        {c.direction === 'inbound' ? '↓ IN' : '↑ OUT'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDuration(c.duration_s)}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{c.practice_line ?? '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{c.status}</td>
                    <td style={{ padding: '8px 12px', color: c.reviewed_at ? '#15803d' : '#9ca3af', whiteSpace: 'nowrap' }}>
                      {c.reviewed_at ? `✓ ${fmtDateTime(c.reviewed_at)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.staff_notes ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Queue view (master-detail) ────────────────────────────────────────────

  const queueList = loading ? (
    <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center' }}>Loading…</div>
  ) : error ? (
    <div style={{ padding: 20 }}>
      <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>
        {error} <button onClick={() => void load()} style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      </div>
    </div>
  ) : calls.length === 0 ? (
    <div style={{ padding: '40px 20px', color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
      No unreviewed calls. All clear ✓
    </div>
  ) : (
    <div style={{ flex: 1 }}>
      {calls.map(c => {
        const isSelected = selected?.id === c.id;
        const pName = patientName(c);
        const ageMs = Date.now() - new Date(c.created_at).getTime();
        const hoursOld = ageMs / 3_600_000;
        const isOld = hoursOld > 4;
        return (
          <button
            key={c.id}
            onClick={() => setSelected(isSelected ? null : c)}
            style={{
              width: '100%', textAlign: 'left', padding: '12px 18px',
              borderBottom: '1px solid #f3f4f6', background: isSelected ? '#f0fdf4' : '#fff',
              border: 'none', cursor: 'pointer',
              borderLeft: `3px solid ${isSelected ? '#16a34a' : isOld ? '#f59e0b' : 'transparent'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1 }}>
                {fmtPhone(c.caller_number) || 'Unknown caller'}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                background: c.direction === 'inbound' ? '#eff6ff' : '#fff7ed',
                color: c.direction === 'inbound' ? '#1d4ed8' : '#c2410c',
                border: `1px solid ${c.direction === 'inbound' ? '#93c5fd' : '#fed7aa'}`,
              }}>
                {c.direction === 'inbound' ? '↓ IN' : '↑ OUT'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: pName ? '#374151' : '#9ca3af', marginBottom: 3 }}>
              {pName ?? 'Patient not matched'}
              {c.practice_line && <span style={{ color: '#9ca3af' }}> · {c.practice_line}</span>}
            </div>
            <div style={{ fontSize: 11, color: isOld ? '#b45309' : '#9ca3af' }}>
              {timeAgo(c.created_at)} · {fmtDuration(c.duration_s)}
            </div>
          </button>
        );
      })}
    </div>
  );

  const detailPanel = selected ? (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 2 }}>
            {fmtPhone(selected.caller_number) || 'Unknown caller'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {fmtDateTime(selected.created_at)} · {fmtDuration(selected.duration_s)}
            {selected.practice_line ? ` · ${selected.practice_line}` : ''}
          </div>
        </div>
        <button
          onClick={() => setSelected(null)}
          style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
        >
          ✕
        </button>
      </div>

      {/* Patient match */}
      <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Patient match</div>
        {patientName(selected) ? (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{patientName(selected)}</div>
        ) : (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>No patient record matched this number</div>
        )}
      </div>

      {/* Audio player */}
      {selected.audio_path && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Recording</div>
          {audioLoading ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading audio…</div>
          ) : signedUrl ? (
            <audio
              controls
              src={signedUrl}
              style={{ width: '100%', borderRadius: 8 }}
            />
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Audio unavailable</div>
          )}
        </div>
      )}

      {/* Transcript */}
      {selected.transcript && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>Transcript (AI)</div>
          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {selected.transcript}
          </div>
        </div>
      )}

      {/* Staff notes */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>Staff notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Action taken, callback details, patient message…"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      {/* Mark reviewed */}
      {reviewErr && (
        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
          {reviewErr}
        </div>
      )}
      {reviewOk && (
        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
          ✓ Marked as reviewed
        </div>
      )}
      {!selected.reviewed_at ? (
        <button
          onClick={() => void handleReview()}
          disabled={reviewing || reviewOk}
          style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none',
            background: reviewing || reviewOk ? '#9ca3af' : '#0d9488',
            color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: reviewing || reviewOk ? 'not-allowed' : 'pointer',
          }}
        >
          {reviewing ? 'Saving…' : reviewOk ? '✓ Done' : 'Mark as Reviewed'}
        </button>
      ) : (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
          ✓ Reviewed {fmtDateTime(selected.reviewed_at)}
        </div>
      )}

      {/* Quick-call link */}
      {selected.caller_number && (
        <div style={{ marginTop: 14 }}>
          <a
            href={`tel:${selected.caller_number}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
          >
            📞 Call back
          </a>
        </div>
      )}
    </div>
  ) : null;

  const queueView = (
    <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Left list */}
      <div style={{
        width: selected ? 300 : '100%',
        flexShrink: 0,
        borderRight: selected ? '1px solid #e5e7eb' : 'none',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* List header */}
        <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Unreviewed Calls</div>
              <div style={{ fontSize: 11, color: unreviewed > 0 ? '#b45309' : '#6b7280', marginTop: 1 }}>
                {unreviewed > 0 ? `${unreviewed} needing review` : 'All calls reviewed'}
                {lastRefresh && (
                  <span style={{ marginLeft: 8, color: '#9ca3af' }}>
                    Updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => void load()}
              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>
        </div>
        {queueList}
      </div>

      {/* Right detail */}
      {detailPanel}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', paddingLeft: 8, flexShrink: 0, background: '#fafafa' }}>
        <button onClick={() => { setView('queue'); setSelected(null); }} style={TAB(view === 'queue')}>
          Review Queue{unreviewed > 0 && view === 'queue' ? ` (${unreviewed})` : ''}
        </button>
        <button onClick={() => { setView('log'); setSelected(null); }} style={TAB(view === 'log')}>
          Call Log
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'queue' ? queueView : logView}
      </div>
    </div>
  );
}
