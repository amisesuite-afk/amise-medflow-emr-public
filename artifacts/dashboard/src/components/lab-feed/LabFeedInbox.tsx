import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { formatEct } from '@/lib/report-import-save';

/**
 * Results that arrived from the laboratory feed (Migration 96, POST /api/lab-feed/inbound):
 *   - "New results": filed to a patient on an exact MRN + date-of-birth match, status "Received
 *     — awaiting clinician review". Reviewing marks the result reviewed (audit-logged, by name).
 *   - "To reconcile": reports that did not match exactly one patient. A nurse, doctor or admin
 *     chooses the patient by hand, with the laboratory's identity and the patient's side by side;
 *     any mismatch must be confirmed. Never matched automatically on a name.
 * Nurse / doctor / admin only (the API refuses front desk).
 */

interface Analyte {
  name: string; value: string; unit: string; ref?: string; flag?: string;
  abnormal?: boolean; critical?: boolean; note?: string; practice_range?: string; issues?: string[];
}

interface FeedResult {
  id: string; patient_id: string; test_name: string; collected_at: string | null; reported_at: string | null;
  created_at: string; performing_lab: string | null; analytes: Analyte[] | null; is_abnormal: boolean;
  is_critical: boolean; notes: string | null;
  patient: { full_name: string | null; mrn: string | null; date_of_birth: string | null } | null;
}

interface FeedObservation { label: string; valueText: string; unit: string; referenceRange: string; abnormalFlags: string[] }

interface QueueItem {
  id: string; lab_id: string; reason: string; reason_text: string; received_mrn: string | null;
  received_family_name: string | null; received_given_name: string | null; received_dob: string | null;
  received_sex: string | null; test_name: string; collected_at: string | null; created_at: string;
  observations: FeedObservation[] | null; is_critical: boolean; is_abnormal: boolean;
}

interface Candidate {
  id: string; full_name: string | null; mrn: string | null; date_of_birth: string | null; sex: string | null;
  matches: { mrn: boolean; dob: boolean; name: boolean };
}

const api = (path: string) => `${getApiOrigin()}${path}`;

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; data: T }> {
  const res = await fetch(api(path), {
    method: init?.method ?? 'GET',
    headers: { ...(await staffAuthHeaders()), ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

const when = (iso: string | null, fallback: string) => formatEct(Date.parse(iso ?? fallback));

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', background: 'var(--surface)' };
const btn: React.CSSProperties = { fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' };
const primary: React.CSSProperties = { ...btn, background: '#0f172a', color: '#fff', border: '1px solid #0f172a' };

function AnalyteChips({ analytes }: { analytes: Analyte[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {analytes.map((a, i) => (
        <span
          key={i}
          title={[a.ref ? `Lab range ${a.ref}` : '', a.practice_range ? `Practice range ${a.practice_range}` : '', a.note ?? '', (a.issues ?? []).join(', ')].filter(Boolean).join(' · ')}
          style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace',
            background: a.critical ? '#fee2e2' : a.abnormal ? '#fef3c7' : '#f8fafc',
            color: a.critical ? '#b91c1c' : a.abnormal ? '#92400e' : '#475569',
            border: `1px solid ${a.critical ? '#fca5a5' : a.abnormal ? '#fcd34d' : '#e2e8f0'}`,
          }}
        >
          {a.critical ? '⚠ ' : ''}{a.name}: <b>{a.value}</b>{a.unit ? ` ${a.unit}` : ''}{a.flag ? ` ${a.flag}` : ''}
          {a.issues && a.issues.length > 0 ? ' ⓘ' : ''}
        </span>
      ))}
    </div>
  );
}

function ResultCard({ r, onReviewed }: { r: FeedResult; onReviewed: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function review() {
    setBusy(true); setErr(null);
    const { status, data } = await call<{ error?: string }>(`/api/lab-feed/results/${r.id}/review`, { method: 'POST', body: { actionTaken: note } });
    setBusy(false);
    if (status === 200) onReviewed();
    else setErr(data.error ?? `Could not mark reviewed (${status})`);
  }
  return (
    <div style={{ ...card, borderColor: r.is_critical ? '#fca5a5' : r.is_abnormal ? '#fcd34d' : 'var(--border)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        {r.is_critical && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#b91c1c', borderRadius: 4, padding: '1px 6px' }}>CRITICAL</span>}
        <b style={{ fontSize: 13 }}>{r.patient?.full_name ?? 'Patient'}</b>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.patient?.mrn ?? ''}{r.patient?.date_of_birth ? ` · DOB ${r.patient.date_of_birth}` : ''}</span>
        <span style={{ fontSize: 12, marginLeft: 'auto', color: 'var(--muted)' }}>{r.test_name} · collected {when(r.collected_at, r.created_at)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
        Received — awaiting clinician review{r.performing_lab ? ` · ${r.performing_lab}` : ''}
      </div>
      <AnalyteChips analytes={r.analytes ?? []} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
        <input
          value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
          placeholder="Action taken (optional)" aria-label="Action taken"
          style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
        />
        <button type="button" style={primary} disabled={busy} onClick={() => void review()}>{busy ? '…' : 'Mark reviewed'}</button>
      </div>
      {err && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

function QueueCard({ q, onResolved }: { q: QueueItem; onResolved: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pending, setPending] = useState<{ candidate: Candidate; mismatches: string[] } | null>(null);
  const [checked, setChecked] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function findPatients() {
    setBusy(true); setErr(null);
    const { status, data } = await call<{ candidates?: Candidate[]; error?: string }>(`/api/lab-feed/reconcile/${q.id}/candidates`);
    setBusy(false);
    if (status === 200) setCandidates(data.candidates ?? []);
    else setErr(data.error ?? `Could not search (${status})`);
  }

  async function match(c: Candidate, confirmMismatch: boolean) {
    setBusy(true); setErr(null);
    const { status, data } = await call<{ error?: string; needsConfirmation?: boolean; mismatches?: string[] }>(
      `/api/lab-feed/reconcile/${q.id}/match`, { method: 'POST', body: { patientId: c.id, confirmMismatch } });
    setBusy(false);
    if (status === 200) { onResolved(); return; }
    if (status === 409 && data.needsConfirmation) { setPending({ candidate: c, mismatches: data.mismatches ?? [] }); setChecked(false); return; }
    setErr(data.error ?? `Could not file (${status})`);
  }

  async function dismiss() {
    setBusy(true); setErr(null);
    const { status, data } = await call<{ error?: string }>(`/api/lab-feed/reconcile/${q.id}/dismiss`, { method: 'POST', body: { reason } });
    setBusy(false);
    if (status === 200) onResolved();
    else setErr(data.error ?? `Could not dismiss (${status})`);
  }

  const tick = (ok: boolean) => <span style={{ color: ok ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>;
  const obs = q.observations ?? [];
  return (
    <div style={{ ...card, borderColor: q.is_critical ? '#fca5a5' : '#c7d2fe' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        {q.is_critical && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: '#b91c1c', borderRadius: 4, padding: '1px 6px' }}>CRITICAL</span>}
        <b style={{ fontSize: 13 }}>{q.test_name}</b>
        <span style={{ fontSize: 11, color: '#4338ca' }}>{q.reason_text}</span>
        <span style={{ fontSize: 11, marginLeft: 'auto', color: 'var(--muted)' }}>received {when(q.created_at, q.created_at)} · {q.lab_id}</span>
      </div>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        As sent by the laboratory: <b>{[q.received_given_name, q.received_family_name].filter(Boolean).join(' ') || 'no name'}</b>
        {' · '}DOB {q.received_dob ?? 'not sent'} · MRN {q.received_mrn ?? 'not sent'}{q.received_sex ? ` · ${q.received_sex}` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
        {obs.map((o, i) => (
          <span key={i} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            {o.label}: <b>{o.valueText}</b>{o.unit ? ` ${o.unit}` : ''}{o.abnormalFlags.length ? ` ${o.abnormalFlags.join(',')}` : ''}
          </span>
        ))}
      </div>

      {candidates === null && !dismissing && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button type="button" style={primary} disabled={busy} onClick={() => void findPatients()}>Find the patient</button>
          <button type="button" style={btn} disabled={busy} onClick={() => setDismissing(true)}>Not our patient / test message…</button>
        </div>
      )}

      {candidates !== null && !pending && (
        <div style={{ marginTop: 8 }}>
          {candidates.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No patient has this MRN or date of birth. Register the patient first, then search again.</div>}
          {candidates.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ flex: 1 }}><b>{c.full_name ?? '—'}</b> · MRN {c.mrn ?? '—'} · DOB {c.date_of_birth ?? '—'}{c.sex ? ` · ${c.sex}` : ''}</span>
              <span>MRN {tick(c.matches.mrn)} DOB {tick(c.matches.dob)} Name {tick(c.matches.name)}</span>
              <button type="button" style={btn} disabled={busy} onClick={() => void match(c, false)}>File to this patient</button>
            </div>
          ))}
          <button type="button" style={{ ...btn, marginTop: 6 }} onClick={() => setCandidates(null)}>Cancel</button>
        </div>
      )}

      {pending && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: '#fff7ed', border: '1px solid #fdba74', fontSize: 12 }}>
          <b>{pending.candidate.full_name}</b> does not match the laboratory's {pending.mismatches.map(m => (m === 'mrn' ? 'MRN' : 'date of birth')).join(' and ')}.
          Check the report and the patient before filing it — a result on the wrong record is dangerous.
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />
            I have checked the identity: this report belongs to this patient.
          </label>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button type="button" style={primary} disabled={!checked || busy} onClick={() => void match(pending.candidate, true)}>File it</button>
            <button type="button" style={btn} onClick={() => setPending(null)}>Back</button>
          </div>
        </div>
      )}

      {dismissing && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input
            value={reason} onChange={e => setReason(e.target.value)} maxLength={500} aria-label="Reason"
            placeholder="Reason (e.g. not a patient of this practice)"
            style={{ flex: 1, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
          />
          <button type="button" style={primary} disabled={busy || reason.trim().length < 3} onClick={() => void dismiss()}>Dismiss</button>
          <button type="button" style={btn} onClick={() => setDismissing(false)}>Cancel</button>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

export default function LabFeedInbox({ onCounts }: { onCounts?: (c: { results: number; reconcile: number; critical: number }) => void }) {
  const [results, setResults] = useState<FeedResult[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const countsRef = useRef(onCounts);
  countsRef.current = onCounts;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { status, data } = await call<{ available?: boolean; results?: FeedResult[]; reconcile?: QueueItem[]; error?: string }>('/api/lab-feed/inbox');
      if (status !== 200) { setError(data.error ?? `Could not load (${status})`); return; }
      setAvailable(data.available !== false);
      setResults(data.results ?? []);
      setQueue(data.reconcile ?? []);
      countsRef.current?.({
        results: (data.results ?? []).length, reconcile: (data.reconcile ?? []).length,
        critical: (data.results ?? []).filter(r => r.is_critical).length + (data.reconcile ?? []).filter(q => q.is_critical).length,
      });
    } catch (e) {
      setError((e as Error)?.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!available) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        Results from the laboratory feed will appear here after the database update (Migration 96).
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
      <section>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
          To reconcile ({queue.length}) — match to a patient first
        </div>
        {queue.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{loading ? 'Loading…' : 'Nothing to match.'}</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{queue.map(q => <QueueCard key={q.id} q={q} onResolved={() => void load()} />)}</div>}
      </section>
      <section>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
          New results ({results.length}) — received, awaiting clinician review
        </div>
        {results.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{loading ? 'Loading…' : 'No new results from the laboratory.'}</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{results.map(r => <ResultCard key={r.id} r={r} onReviewed={() => void load()} />)}</div>}
      </section>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        Flags use the practice reference ranges (Settings → Reference ranges) and never lower the laboratory's own flag.
        To use a result in a consultation, open the patient: Investigations → Lab and imaging reports on file → Use in this consultation.
      </div>
    </div>
  );
}
