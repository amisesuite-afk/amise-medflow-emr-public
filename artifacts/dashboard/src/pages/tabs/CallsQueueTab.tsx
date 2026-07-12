/**
 * CallsQueueTab — front-desk view of unresolved inbound calls / voice notes.
 *
 * Polls GET /api/calls/unresolved and lets staff either:
 *   A) Link the call to an existing patient (type-ahead search)
 *   B) Register a new patient on the spot (name + phone + email → auto MRN)
 *
 * Phone, email, and name are the three identity anchors; the auto-generated
 * MRN (AM-YYYYnnnn) is the future health-card identifier.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getApiOrigin } from '@/lib/api-origin';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CallLog {
  id:            string;
  caller_number: string | null;
  caller_email:  string | null;
  source:        string;
  direction:     string;
  transcript:    string | null;
  duration_s:    number | null;
  practice_line: string | null;
  created_at:    string;
}

interface PracticeLine { label: string; whatsapp: boolean; }

interface PatientHit { id: string; full_name: string; mrn: string | null; phone: string | null; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_ICON: Record<string, string> = {
  phone:       '📞',
  whatsapp:    '💬',
  patient_app: '📱',
  ambient:     '🎙',
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
  const [calls, setCalls]             = useState<CallLog[]>([]);
  const [lines, setLines]             = useState<PracticeLine[]>([]);
  const [filterLine, setFilterLine]   = useState<string>('');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [resolving, setResolving]     = useState<string | null>(null); // call log id
  const [expanded, setExpanded]       = useState<string | null>(null);

  const apiOrigin = getApiOrigin();
  const url = (path: string) => apiOrigin ? `${apiOrigin}${path}` : path;

  const fetchQueue = useCallback(async () => {
    try {
      const headers = await staffAuthHeaders();
      const qs = filterLine ? `?practice_line=${encodeURIComponent(filterLine)}` : '';
      const r  = await fetch(url(`/api/calls/unresolved${qs}`), { headers });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json() as { calls: CallLog[]; practice_lines: PracticeLine[] };
      setCalls(data.calls);
      setLines(data.practice_lines ?? []);
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
            Call Queue
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            {calls.length} unresolved · phone, email, or name identifies the patient
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Line filter */}
          {lines.length > 0 && (
            <select
              value={filterLine}
              onChange={e => setFilterLine(e.target.value)}
              style={{
                background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7,
                color: '#e2e8f0', fontSize: 12, padding: '5px 10px', cursor: 'pointer',
              }}
            >
              <option value=''>All lines</option>
              {lines.map(l => (
                <option key={l.label} value={l.label}>
                  {l.whatsapp ? '💬 ' : '📞 '}{l.label}
                </option>
              ))}
            </select>
          )}
          <button
            type='button'
            onClick={() => void fetchQueue()}
            style={{
              padding: '5px 12px', borderRadius: 7, border: '1px solid #1e3a5f',
              background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {calls.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', border: '1px dashed #1e3a5f', borderRadius: 10,
          color: '#475569', fontSize: 13,
        }}>
          No unresolved calls — all caught up.
        </div>
      )}

      {/* Call list */}
      {calls.map(call => (
        <CallCard
          key={call.id}
          call={call}
          expanded={expanded === call.id}
          onToggle={() => setExpanded(expanded === call.id ? null : call.id)}
          isResolving={resolving === call.id}
          apiUrl={url}
          onResolved={() => {
            setResolving(null);
            setCalls(prev => prev.filter(c => c.id !== call.id));
          }}
          onResolveStart={() => setResolving(call.id)}
          onResolveCancel={() => setResolving(null)}
        />
      ))}
    </div>
  );
}

// ── CallCard ──────────────────────────────────────────────────────────────────

interface CardProps {
  call:           CallLog;
  expanded:       boolean;
  onToggle:       () => void;
  isResolving:    boolean;
  apiUrl:         (path: string) => string;
  onResolved:     () => void;
  onResolveStart: () => void;
  onResolveCancel:() => void;
}

function CallCard({ call, expanded, onToggle, isResolving, apiUrl, onResolved, onResolveStart, onResolveCancel }: CardProps) {
  return (
    <div style={{
      background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Summary row */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <span style={{ fontSize: 18 }}>{SOURCE_ICON[call.source] ?? '📞'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            {call.caller_number ?? call.caller_email ?? 'Unknown caller'}
            {call.practice_line && (
              <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: '#64748b',
                letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                · {call.practice_line}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
            {fmtTime(call.created_at)}
            {call.duration_s ? ` · ${fmtDuration(call.duration_s)}` : ''}
            {call.transcript ? ` · "${call.transcript.slice(0, 60)}${call.transcript.length > 60 ? '…' : ''}"` : ''}
          </div>
        </div>
        <button
          type='button'
          onClick={e => { e.stopPropagation(); onResolveStart(); }}
          style={{
            padding: '5px 14px', borderRadius: 7, border: 'none',
            background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Resolve
        </button>
        <span style={{ color: '#475569', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded transcript */}
      {expanded && call.transcript && (
        <div style={{
          padding: '0 16px 14px', borderTop: '1px solid #0d1b2e',
          fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.7, color: '#94a3b8',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#475569',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, paddingTop: 10 }}>
            Transcript
          </div>
          {call.transcript}
        </div>
      )}

      {/* Resolve panel */}
      {isResolving && (
        <ResolvePanel
          call={call}
          apiUrl={apiUrl}
          onResolved={onResolved}
          onCancel={onResolveCancel}
        />
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
  const [mode, setMode]         = useState<'search' | 'new'>('search');
  const [query, setQuery]       = useState('');
  const [hits, setHits]         = useState<PatientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // New patient fields
  const [newName,  setNewName]  = useState('');
  const [newPhone, setNewPhone] = useState(call.caller_number ?? '');
  const [newEmail, setNewEmail] = useState(call.caller_email  ?? '');
  const [newDob,   setNewDob]   = useState('');
  const [newSex,   setNewSex]   = useState('unknown');
  const [staffNotes, setStaffNotes] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) { setHits([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const headers = await staffAuthHeaders();
        const r = await fetch(
          apiUrl(`/api/patients/search?q=${encodeURIComponent(query)}&limit=8`),
          { headers },
        );
        if (r.ok) {
          const d = await r.json() as { patients?: PatientHit[] };
          setHits(d.patients ?? []);
        }
      } finally {
        setSearching(false);
      }
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
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
            full_name:     newName.trim(),
            phone:         newPhone.trim() || undefined,
            email:         newEmail.trim() || undefined,
            date_of_birth: newDob  || undefined,
            sex:           newSex  || undefined,
          },
          staff_notes: staffNotes || undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json() as { error?: string }).error ?? 'Resolve failed');
      onResolved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
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
    <div style={{
      borderTop: '2px solid #0d9488', background: '#060e1a',
      padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['search', 'new'] as const).map(m => (
          <button key={m} type='button' onClick={() => setMode(m)}
            style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: 'none',
              background: mode === m ? '#0d9488' : '#0d1b2e',
              color: mode === m ? '#fff' : '#64748b',
            }}>
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
            <label style={labelStyle}>Search by name, MRN, or phone</label>
            <input
              style={inputStyle}
              placeholder='e.g. Marie Joseph or AM-2026…'
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          {searching && <div style={{ fontSize: 12, color: '#475569' }}>Searching…</div>}
          {hits.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{p.full_name}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {p.mrn ?? 'No MRN'} {p.phone ? `· ${p.phone}` : ''}
                </div>
              </div>
              <button type='button' onClick={() => void linkExisting(p.id)} disabled={saving}
                style={{
                  padding: '4px 12px', borderRadius: 7, border: 'none',
                  background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
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
          <div style={{
            padding: '8px 12px', background: '#0d1b2e', borderRadius: 7,
            fontSize: 11, color: '#475569', border: '1px dashed #1e3a5f',
          }}>
            A health record number (MRN) will be auto-generated: <strong style={{ color: '#0d9488' }}>AM-{new Date().getFullYear()}XXXX</strong>
          </div>
          <button type='button' onClick={() => void createAndLink()} disabled={saving || !newName.trim()}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: saving || !newName.trim() ? '#1e3a5f' : '#0d9488',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'wait' : 'pointer',
            }}>
            {saving ? 'Registering…' : 'Register & link'}
          </button>
        </div>
      )}

      {/* Staff notes (both modes) */}
      <div>
        <label style={labelStyle}>Staff notes (optional)</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 48 }}
          value={staffNotes}
          onChange={e => setStaffNotes(e.target.value)}
          placeholder='Any context about this call…'
        />
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
