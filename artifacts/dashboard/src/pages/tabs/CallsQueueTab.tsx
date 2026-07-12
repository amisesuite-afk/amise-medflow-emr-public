/**
 * CallsQueueTab — front-desk call queue with voicemail, callback tracking, and audit.
 *
 * Tabs: All unresolved | Voicemail | Callback queue | Audit
 * Each call can be:
 *   - Resolved → linked to existing or new patient (auto MRN: AM-YYYYnnnn)
 *   - Scheduled for callback
 *   - Marked as called back
 *   - Dismissed
 *
 * Phone + email + name are the three identity anchors.
 * Auto-refreshes every 30 s; push notification fires on new voicemail.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getApiOrigin } from '@/lib/api-origin';

// ── Types ─────────────────────────────────────────────────────────────────────

type CallStatus =
  | 'pending' | 'answered' | 'voicemail' | 'missed'
  | 'callback_scheduled' | 'called_back' | 'dismissed';

interface CallLog {
  id:            string;
  caller_number: string | null;
  caller_email:  string | null;
  source:        string;
  direction:     string;
  transcript:    string | null;
  duration_s:    number | null;
  practice_line: string | null;
  status:        CallStatus;
  audio_path:    string | null;
  callback_at:   string | null;
  staff_notes:   string | null;
  created_at:    string;
}

interface PracticeLine { label: string; whatsapp: boolean; }

interface PatientHit { id: string; full_name: string; mrn: string | null; phone: string | null; }

interface AuditData {
  total: number; answered: number; voicemail: number; missed: number;
  callback_scheduled: number; called_back: number; dismissed: number; pending: number;
  by_line: Array<{ label: string } & Omit<AuditData, 'by_line'>>;
}

type ViewTab = 'all' | 'voicemail' | 'callbacks' | 'audit';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  phone: '📞', whatsapp: '💬', patient_app: '📱', ambient: '🎙',
};

const STATUS_COLOR: Record<CallStatus, string> = {
  pending:            '#94a3b8',
  answered:           '#10b981',
  voicemail:          '#f59e0b',
  missed:             '#ef4444',
  callback_scheduled: '#3b82f6',
  called_back:        '#10b981',
  dismissed:          '#475569',
};

const STATUS_LABEL: Record<CallStatus, string> = {
  pending:            'Pending',
  answered:           'Answered',
  voicemail:          'Voicemail',
  missed:             'Missed',
  callback_scheduled: 'Callback due',
  called_back:        'Called back',
  dismissed:          'Dismissed',
};

function fmtDuration(s: number | null): string {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'America/St_Lucia',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CallsQueueTab() {
  const [calls, setCalls]           = useState<CallLog[]>([]);
  const [lines, setLines]           = useState<PracticeLine[]>([]);
  const [audit, setAudit]           = useState<AuditData | null>(null);
  const [filterLine, setFilterLine] = useState('');
  const [view, setView]             = useState<ViewTab>('all');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [resolving, setResolving]   = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const prevCountRef                = useRef(0);

  const apiOrigin = getApiOrigin();
  const url = (path: string) => apiOrigin ? `${apiOrigin}${path}` : path;

  const fetchQueue = useCallback(async () => {
    try {
      const headers = await staffAuthHeaders();
      const qs = filterLine ? `?practice_line=${encodeURIComponent(filterLine)}` : '';

      // Fetch unresolved queue and audit in parallel
      const [queueRes, auditRes] = await Promise.all([
        fetch(url(`/api/calls/unresolved${qs}`), { headers }),
        fetch(url('/api/calls/audit'), { headers }),
      ]);

      if (queueRes.ok) {
        const d = await queueRes.json() as { calls: CallLog[]; practice_lines: PracticeLine[] };
        const incoming = d.calls ?? [];
        // Browser notification on new voicemails
        const newVoicemails = incoming.filter(c => c.status === 'voicemail').length;
        if (newVoicemails > prevCountRef.current && Notification.permission === 'granted') {
          new Notification('Amise MedFlow — New voicemail', {
            body: `${newVoicemails} voicemail${newVoicemails > 1 ? 's' : ''} waiting in call queue`,
            icon: '/favicon.svg',
          });
        }
        prevCountRef.current = newVoicemails;
        setCalls(incoming);
        setLines(d.practice_lines ?? []);
      }

      if (auditRes.ok) {
        setAudit(await auditRes.json() as AuditData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call queue');
    } finally {
      setLoading(false);
    }
  }, [filterLine]);

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const t = setInterval(() => void fetchQueue(), 30_000);
    return () => clearInterval(t);
  }, [fetchQueue]);

  // Request notification permission on first load
  useEffect(() => {
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  async function updateStatus(callId: string, status: CallStatus, callbackAt?: string) {
    const headers = await staffAuthHeaders();
    await fetch(url(`/api/calls/${callId}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ status, callback_at: callbackAt }),
    });
    setCalls(prev => prev.map(c => c.id === callId ? { ...c, status } : c));
  }

  const visibleCalls = calls.filter(c => {
    if (view === 'voicemail')  return c.status === 'voicemail';
    if (view === 'callbacks')  return c.status === 'callback_scheduled';
    return true;
  });

  if (loading) return (
    <div style={{ padding: 32, color: '#64748b', fontSize: 14 }}>Loading call queue…</div>
  );

  if (error) return (
    <div style={{ padding: 24, background: '#1a0000', border: '1px solid #ef4444', borderRadius: 10, color: '#fca5a5', fontSize: 13 }}>
      {error}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Audit summary bar ── */}
      {audit && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
          gap: 8,
        }}>
          {([
            ['Total', audit.total,              '#94a3b8'],
            ['Answered', audit.answered,         '#10b981'],
            ['Voicemail', audit.voicemail,        '#f59e0b'],
            ['Missed', audit.missed,              '#ef4444'],
            ['Callbacks', audit.callback_scheduled,'#3b82f6'],
            ['Called Back', audit.called_back,    '#10b981'],
          ] as [string, number, string][]).map(([label, count, color]) => (
            <div key={label} style={{
              background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 9,
              padding: '10px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                {count}
              </div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Header + controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'voicemail', 'callbacks', 'audit'] as ViewTab[]).map(t => (
            <button key={t} type='button' onClick={() => setView(t)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: 'none',
                background: view === t ? '#0d9488' : '#0d1b2e',
                color: view === t ? '#fff' : '#64748b',
              }}>
              {t === 'all' ? `All (${calls.length})` :
               t === 'voicemail' ? `🎙 Voicemail (${calls.filter(c => c.status === 'voicemail').length})` :
               t === 'callbacks' ? `📲 Callbacks (${calls.filter(c => c.status === 'callback_scheduled').length})` :
               '📊 Audit'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {lines.length > 0 && (
            <select value={filterLine} onChange={e => setFilterLine(e.target.value)}
              style={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7,
                color: '#e2e8f0', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>
              <option value=''>All lines</option>
              {lines.map(l => (
                <option key={l.label} value={l.label}>{l.whatsapp ? '💬 ' : '📞 '}{l.label}</option>
              ))}
            </select>
          )}
          <button type='button' onClick={() => void fetchQueue()}
            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #1e3a5f',
              background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
            ↻
          </button>
        </div>
      </div>

      {/* ── Audit detail view ── */}
      {view === 'audit' && audit && (
        <AuditPanel audit={audit} />
      )}

      {/* ── Call list ── */}
      {view !== 'audit' && (
        <>
          {visibleCalls.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', border: '1px dashed #1e3a5f',
              borderRadius: 10, color: '#475569', fontSize: 13 }}>
              {view === 'voicemail' ? 'No voicemails waiting.' :
               view === 'callbacks' ? 'No callbacks scheduled.' :
               'No unresolved calls — all caught up.'}
            </div>
          )}

          {visibleCalls.map(call => (
            <CallCard
              key={call.id}
              call={call}
              expanded={expanded === call.id}
              onToggle={() => setExpanded(expanded === call.id ? null : call.id)}
              isResolving={resolving === call.id}
              apiUrl={url}
              onResolved={() => { setResolving(null); setCalls(prev => prev.filter(c => c.id !== call.id)); }}
              onResolveStart={() => setResolving(call.id)}
              onResolveCancel={() => setResolving(null)}
              onStatusChange={(s, at) => void updateStatus(call.id, s, at)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── AuditPanel ────────────────────────────────────────────────────────────────

function AuditPanel({ audit }: { audit: AuditData }) {
  const answerRate = audit.total > 0
    ? Math.round((audit.answered / audit.total) * 100)
    : 0;
  const vmRate = audit.total > 0
    ? Math.round((audit.voicemail / audit.total) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Rate summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Answer rate (30 days)</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: answerRate >= 80 ? '#10b981' : answerRate >= 60 ? '#f59e0b' : '#ef4444' }}>
            {answerRate}%
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            {audit.answered} answered · {audit.missed} missed · {audit.total} total
          </div>
        </div>
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Voicemail pickup rate</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b' }}>{vmRate}%</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            {audit.voicemail} voicemails · {audit.called_back} called back
          </div>
        </div>
      </div>

      {/* Per-line breakdown */}
      <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #0d1b2e',
          fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          By practice line
        </div>
        {audit.by_line.map(line => (
          <div key={line.label} style={{
            display: 'grid', gridTemplateColumns: '120px repeat(5, 1fr)',
            gap: 8, padding: '10px 16px', borderBottom: '1px solid #060e1a',
            alignItems: 'center', fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{line.label}</div>
            <Stat label='Total' value={line.total} color='#94a3b8' />
            <Stat label='Answered' value={line.answered} color='#10b981' />
            <Stat label='Voicemail' value={line.voicemail} color='#f59e0b' />
            <Stat label='Missed' value={line.missed} color='#ef4444' />
            <Stat label='Callbacks' value={line.callback_scheduled} color='#3b82f6' />
          </div>
        ))}
      </div>

      {/* Callback funnel */}
      <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#475569',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Callback funnel
        </div>
        {([
          ['Voicemails received',  audit.voicemail,           '#f59e0b'],
          ['Callbacks scheduled',  audit.callback_scheduled,  '#3b82f6'],
          ['Callbacks completed',  audit.called_back,         '#10b981'],
          ['Dismissed',            audit.dismissed,            '#475569'],
        ] as [string, number, string][]).map(([label, count, color]) => {
          const pct = audit.voicemail > 0 ? Math.round((count / audit.voicemail) * 100) : 0;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 130, fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{label}</div>
              <div style={{ flex: 1, background: '#060e1a', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <div style={{ width: 32, textAlign: 'right', fontSize: 12, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

// ── CallCard ──────────────────────────────────────────────────────────────────

interface CardProps {
  call:            CallLog;
  expanded:        boolean;
  onToggle:        () => void;
  isResolving:     boolean;
  apiUrl:          (path: string) => string;
  onResolved:      () => void;
  onResolveStart:  () => void;
  onResolveCancel: () => void;
  onStatusChange:  (s: CallStatus, callbackAt?: string) => void;
}

function CallCard({ call, expanded, onToggle, isResolving, apiUrl, onResolved, onResolveStart, onResolveCancel, onStatusChange }: CardProps) {
  const [showCallbackPicker, setShowCallbackPicker] = useState(false);
  const [callbackAt, setCallbackAt] = useState('');

  const statusColor = STATUS_COLOR[call.status] ?? '#94a3b8';

  return (
    <div style={{ background: '#0a1628', border: `1px solid ${call.status === 'voicemail' ? '#f59e0b44' : '#1e3a5f'}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={onToggle}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{SOURCE_ICON[call.source] ?? '📞'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {call.caller_number ?? call.caller_email ?? 'Unknown caller'}
            {call.practice_line && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {call.practice_line}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 800, color: statusColor,
              background: `${statusColor}22`, padding: '1px 6px', borderRadius: 6 }}>
              {STATUS_LABEL[call.status]}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {fmtTime(call.created_at)}
            {call.duration_s ? ` · ${fmtDuration(call.duration_s)}` : ''}
            {call.callback_at ? ` · Callback: ${fmtTime(call.callback_at)}` : ''}
            {call.transcript ? ` · "${call.transcript.slice(0, 50)}${call.transcript.length > 50 ? '…' : ''}"` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {/* Action buttons */}
          {call.status === 'voicemail' && (
            <button type='button'
              onClick={e => { e.stopPropagation(); setShowCallbackPicker(!showCallbackPicker); }}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none',
                background: '#1e3a8a', color: '#93c5fd', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              📲 Callback
            </button>
          )}
          {call.status === 'callback_scheduled' && (
            <button type='button'
              onClick={e => { e.stopPropagation(); onStatusChange('called_back'); }}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none',
                background: '#064e3b', color: '#6ee7b7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✓ Called back
            </button>
          )}
          {(call.status === 'voicemail' || call.status === 'missed' || call.status === 'pending') && (
            <button type='button'
              onClick={e => { e.stopPropagation(); onResolveStart(); }}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Resolve
            </button>
          )}
          {call.status !== 'dismissed' && call.status !== 'answered' && call.status !== 'called_back' && (
            <button type='button'
              onClick={e => { e.stopPropagation(); onStatusChange('dismissed'); }}
              style={{ padding: '4px 8px', borderRadius: 7, border: '1px solid #1e3a5f',
                background: 'transparent', color: '#475569', fontSize: 11, cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
        <span style={{ color: '#475569', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Callback scheduler */}
      {showCallbackPicker && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}
          onClick={e => e.stopPropagation()}>
          <input type='datetime-local' value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
            style={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7,
              color: '#e2e8f0', fontSize: 12, padding: '5px 8px', flex: 1 }} />
          <button type='button'
            onClick={() => { onStatusChange('callback_scheduled', callbackAt || undefined); setShowCallbackPicker(false); }}
            style={{ padding: '5px 14px', borderRadius: 7, border: 'none',
              background: '#1e3a8a', color: '#93c5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Schedule
          </button>
        </div>
      )}

      {/* Voicemail audio player */}
      {expanded && call.audio_path && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Voicemail recording
          </div>
          <audio controls style={{ width: '100%', height: 36 }} src={call.audio_path} />
        </div>
      )}

      {/* Transcript */}
      {expanded && call.transcript && (
        <div style={{ padding: '0 16px 14px', borderTop: call.audio_path ? '1px solid #060e1a' : 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#475569',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingTop: call.audio_path ? 10 : 0 }}>
            Transcript
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.7, color: '#94a3b8' }}>
            {call.transcript}
          </div>
        </div>
      )}

      {/* Resolve panel */}
      {isResolving && (
        <ResolvePanel call={call} apiUrl={apiUrl} onResolved={onResolved} onCancel={onResolveCancel} />
      )}
    </div>
  );
}

// ── ResolvePanel ──────────────────────────────────────────────────────────────

interface ResolvePanelProps {
  call:       CallLog;
  apiUrl:     (path: string) => string;
  onResolved: () => void;
  onCancel:   () => void;
}

function ResolvePanel({ call, apiUrl, onResolved, onCancel }: ResolvePanelProps) {
  const [mode, setMode]           = useState<'search' | 'new'>('search');
  const [query, setQuery]         = useState('');
  const [hits, setHits]           = useState<PatientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  const [newName,    setNewName]    = useState('');
  const [newPhone,   setNewPhone]   = useState(call.caller_number ?? '');
  const [newEmail,   setNewEmail]   = useState(call.caller_email  ?? '');
  const [newDob,     setNewDob]     = useState('');
  const [newSex,     setNewSex]     = useState('unknown');
  const [staffNotes, setStaffNotes] = useState(call.staff_notes ?? '');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setHits([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const headers = await staffAuthHeaders();
        const r = await fetch(apiUrl(`/api/patients/search?q=${encodeURIComponent(query)}&limit=8`), { headers });
        if (r.ok) {
          const d = await r.json() as { patients?: PatientHit[] };
          setHits(d.patients ?? []);
        }
      } finally { setSearching(false); }
    }, 300);
  }, [query]);

  async function linkExisting(patientId: string) {
    setSaving(true); setErr(null);
    try {
      const headers = await staffAuthHeaders();
      const r = await fetch(apiUrl(`/api/calls/${call.id}/resolve`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ existing_patient_id: patientId, staff_notes: staffNotes || undefined }),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? 'Resolve failed');
      onResolved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function createAndLink() {
    if (!newName.trim()) { setErr('Full name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const headers = await staffAuthHeaders();
      const r = await fetch(apiUrl(`/api/calls/${call.id}/resolve`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          new_patient: {
            full_name: newName.trim(),
            phone:     newPhone.trim() || undefined,
            email:     newEmail.trim() || undefined,
            date_of_birth: newDob || undefined,
            sex:           newSex || undefined,
          },
          staff_notes: staffNotes || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? 'Resolve failed');
      onResolved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7,
    color: '#e2e8f0', fontSize: 13, padding: '7px 10px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#64748b',
    letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ borderTop: '2px solid #0d9488', background: '#060e1a', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['search', 'new'] as const).map(m => (
          <button key={m} type='button' onClick={() => setMode(m)}
            style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: 'none',
              background: mode === m ? '#0d9488' : '#0d1b2e',
              color: mode === m ? '#fff' : '#64748b' }}>
            {m === 'search' ? '🔍 Link existing patient' : '+ Register new patient'}
          </button>
        ))}
        <button type='button' onClick={onCancel}
          style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 7,
            border: '1px solid #1e3a5f', background: 'transparent', color: '#64748b',
            fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>

      {mode === 'search' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={labelStyle}>Search by name, MRN, phone, or email</label>
            <input style={inputStyle} placeholder='e.g. Marie Joseph or AM-2026…'
              value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          </div>
          {searching && <div style={{ fontSize: 12, color: '#475569' }}>Searching…</div>}
          {hits.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{p.full_name}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {p.mrn ?? 'No MRN'}{p.phone ? ` · ${p.phone}` : ''}
                </div>
              </div>
              <button type='button' onClick={() => void linkExisting(p.id)} disabled={saving}
                style={{ padding: '4px 12px', borderRadius: 7, border: 'none',
                  background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Link
              </button>
            </div>
          ))}
          {query.length >= 2 && !searching && hits.length === 0 && (
            <div style={{ fontSize: 12, color: '#475569' }}>
              No patients found — switch to "Register new patient" to create one.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Full name *</label>
              <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)}
                placeholder='Given name + surname' autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Phone (identity anchor)</label>
              <input style={inputStyle} value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder='+1 758 XXX XXXX' type='tel' />
            </div>
            <div>
              <label style={labelStyle}>Email (identity anchor)</label>
              <input style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder='patient@email.com' type='email' />
            </div>
            <div>
              <label style={labelStyle}>Date of birth</label>
              <input style={inputStyle} value={newDob} onChange={e => setNewDob(e.target.value)} type='date' />
            </div>
            <div>
              <label style={labelStyle}>Sex</label>
              <select style={inputStyle} value={newSex} onChange={e => setNewSex(e.target.value)}>
                <option value='unknown'>Not specified</option>
                <option value='male'>Male</option>
                <option value='female'>Female</option>
                <option value='other'>Other</option>
              </select>
            </div>
          </div>
          <div style={{ padding: '8px 12px', background: '#0d1b2e', borderRadius: 7,
            fontSize: 11, color: '#475569', border: '1px dashed #1e3a5f' }}>
            Health record number auto-generated: <strong style={{ color: '#0d9488' }}>AM-{new Date().getFullYear()}XXXX</strong>
          </div>
          <button type='button' onClick={() => void createAndLink()} disabled={saving || !newName.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none',
              background: saving || !newName.trim() ? '#1e3a5f' : '#0d9488',
              color: '#fff', fontSize: 13, fontWeight: 800,
              cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Registering…' : 'Register & link'}
          </button>
        </div>
      )}

      <div>
        <label style={labelStyle}>Staff notes (optional)</label>
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 48 }}
          value={staffNotes} onChange={e => setStaffNotes(e.target.value)}
          placeholder='Any context about this call…' />
      </div>

      {err && (
        <div style={{ background: '#1a0000', border: '1px solid #ef4444', borderRadius: 7,
          padding: '8px 12px', fontSize: 12, color: '#fca5a5' }}>
          {err}
        </div>
      )}
    </div>
  );
}
