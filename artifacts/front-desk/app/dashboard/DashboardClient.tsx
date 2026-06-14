'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { ConversationThread, TriageLevel } from '@/types';
import type { BookingRow, DocumentReviewRow } from '@/lib/supabase';
import ThreadCard from '@/components/ThreadCard';
import DraftApproval from '@/components/DraftApproval';
import TriageBadge from '@/components/TriageBadge';
import { sortThreads, triageColor } from '@/lib/triage';
import { decodeTrack } from '@/lib/scheduling';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function useLiveClock(): string {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('en-LC', {
        timeZone: 'America/St_Lucia',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const TRACK_COLORS: Record<string, string> = {
  routine:  '#34d399',
  referral: '#60a5fa',
  urgent:   '#f97316',
};

const STATUS_LABEL: Record<string, string> = {
  pending:           'Pending',
  staff_confirmed:   'Confirmed',
  patient_confirmed: 'Auto-confirmed',
  declined:          'Declined',
  lapsed:            'Lapsed',
};

interface Props {
  initialThreads:  ConversationThread[];
  initialBookings: BookingRow[];
  initialDocuments: DocumentReviewRow[];
  secret: string;
  mode:   string;
}

const FLAG_SEVERITY_COLORS: Record<string, string> = {
  info:      '#60a5fa',
  attention: '#fbbf24',
  urgent:    '#f97316',
};

export default function DashboardClient({
  initialThreads, initialBookings, initialDocuments, secret, mode,
}: Props) {
  const [tab,      setTab]     = useState<'messaging' | 'bookings' | 'documents'>('messaging');
  const [threads,  setThreads] = useState<ConversationThread[]>(initialThreads);
  const [bookings, setBookings]= useState<BookingRow[]>(initialBookings);
  const [documents, setDocuments] = useState<DocumentReviewRow[]>(initialDocuments);
  const [selected, setSelected]= useState<ConversationThread | null>(null);
  const [adHocMsg, setAdHocMsg]= useState('');
  const [sending,  setSending] = useState(false);
  const [urgentLoading, setUrgentLoading] = useState<Record<string, boolean>>({});
  const [urgentMsg,     setUrgentMsg]     = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [migrateOpen,    setMigrateOpen]    = useState<Record<string, boolean>>({});
  const [migrateType,    setMigrateType]    = useState<Record<string, string>>({});
  const [migrateLoading, setMigrateLoading] = useState<Record<string, boolean>>({});
  const [migrateMsg,     setMigrateMsg]     = useState<Record<string, string>>({});
  const clock = useLiveClock();

  const sorted = sortThreads(threads);

  // Supabase Realtime — threads
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    const sb      = createClient(SUPABASE_URL, SUPABASE_ANON);
    const channel = sb
      .channel('thread-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_threads' }, payload => {
        const row = payload.new as ConversationThread;
        setThreads(prev => {
          const idx = prev.findIndex(t => t.id === row.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
          return [row, ...prev];
        });
        setSelected(prev => (prev?.id === row.id ? row : prev));
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, []);

  // Supabase Realtime — bookings
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    const sb      = createClient(SUPABASE_URL, SUPABASE_ANON);
    const channel = sb
      .channel('booking-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, payload => {
        const row = payload.new as BookingRow;
        setBookings(prev => {
          const idx = prev.findIndex(b => b.id === row.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
          return [row, ...prev];
        });
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, []);

  // Supabase Realtime — uploaded documents / AI extraction updates
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    const sb      = createClient(SUPABASE_URL, SUPABASE_ANON);
    const channel = sb
      .channel('document-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, payload => {
        const row = payload.new as DocumentReviewRow;
        setDocuments(prev => {
          const idx = prev.findIndex(d => d.id === row.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], ...row }; return next; }
          return [row, ...prev];
        });
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, []);

  async function markReviewed(documentId: string) {
    setReviewing(prev => ({ ...prev, [documentId]: true }));
    try {
      const r = await fetch('/api/documents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ documentId, staffId: 'nurse' }),
      });
      if (r.ok) {
        const now = new Date().toISOString();
        setDocuments(prev => prev.map(d =>
          d.id === documentId ? { ...d, staff_reviewed_at: now, staff_reviewed_by: 'nurse' } : d,
        ));
      }
    } finally {
      setReviewing(prev => ({ ...prev, [documentId]: false }));
    }
  }

  // On-demand "old system" migration — staff attach a patient's historic
  // paper/PDF records while handling a pending request or upcoming encounter
  // (never a bulk import). Reuses the same triage-only AI extraction pipeline
  // as portal uploads; results land in the Documents review tab.
  async function attachHistoricRecord(bookingId: string, file: File) {
    setMigrateLoading(prev => ({ ...prev, [bookingId]: true }));
    setMigrateMsg(prev => ({ ...prev, [bookingId]: '' }));
    try {
      const form = new FormData();
      form.set('bookingId', bookingId);
      form.set('documentType', migrateType[bookingId] ?? 'other');
      form.set('file', file);

      const r = await fetch('/api/documents/migrate', {
        method: 'POST',
        headers: { 'x-internal-secret': secret },
        body: form,
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (d.success) {
        setMigrateMsg(prev => ({ ...prev, [bookingId]: 'Attached — queued for AI extraction' }));
        setMigrateOpen(prev => ({ ...prev, [bookingId]: false }));
      } else {
        setMigrateMsg(prev => ({ ...prev, [bookingId]: d.error ?? 'Could not attach the file' }));
      }
    } catch {
      setMigrateMsg(prev => ({ ...prev, [bookingId]: 'Network error' }));
    } finally {
      setMigrateLoading(prev => ({ ...prev, [bookingId]: false }));
    }
  }

  const sendAdHoc = useCallback(async () => {
    if (!selected || !adHocMsg.trim()) return;
    setSending(true);
    try {
      await fetch('/api/nurse/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ threadId: selected.id, message: adHocMsg.trim(), nurseId: 'nurse' }),
      });
      setAdHocMsg('');
    } finally { setSending(false); }
  }, [selected, adHocMsg, secret]);

  async function scheduleUrgent(bookingId: string) {
    setUrgentLoading(prev => ({ ...prev, [bookingId]: true }));
    setUrgentMsg(prev => ({ ...prev, [bookingId]: '' }));
    try {
      const r = await fetch('/api/booking/urgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify({ bookingId, nurseId: 'nurse' }),
      });
      const d = await r.json() as { success?: boolean; slot?: string; error?: string; fallback?: string };
      if (d.success) {
        setUrgentMsg(prev => ({ ...prev, [bookingId]: `Confirmed: ${d.slot ?? ''}` }));
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, status: 'staff_confirmed' } : b,
        ));
      } else {
        setUrgentMsg(prev => ({ ...prev, [bookingId]: d.error ?? 'Error' }));
      }
    } catch {
      setUrgentMsg(prev => ({ ...prev, [bookingId]: 'Network error' }));
    } finally {
      setUrgentLoading(prev => ({ ...prev, [bookingId]: false }));
    }
  }

  const counts: Record<TriageLevel, number> = { EMERGENT: 0, URGENT: 0, ROUTINE: 0, INFO: 0 };
  threads.forEach(t => { counts[t.triage_level]++; });

  const pendingBookings  = bookings.filter(b => b.status === 'pending');
  const urgentBookings   = pendingBookings.filter(b => b.triage_acuity === 'urgent');
  const docsNeedingReview = documents.filter(d => d.ai_flags && !d.staff_reviewed_at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #374151', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#0d9488' }}>Amise Front Desk</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>AI Intake · Saint Lucia</div>
        <div style={{ flex: 1 }} />

        {/* Urgent booking alert */}
        {urgentBookings.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#f97316',
            background: '#f9731622', border: '1px solid #f9731644',
            borderRadius: 10, padding: '2px 8px', cursor: 'pointer',
          }} onClick={() => setTab('bookings')}>
            ⚠ {urgentBookings.length} urgent booking{urgentBookings.length > 1 ? 's' : ''}
          </span>
        )}

        {/* Flagged-document alert */}
        {docsNeedingReview.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#fbbf24',
            background: '#fbbf2422', border: '1px solid #fbbf2444',
            borderRadius: 10, padding: '2px 8px', cursor: 'pointer',
          }} onClick={() => setTab('documents')}>
            📄 {docsNeedingReview.length} document{docsNeedingReview.length > 1 ? 's' : ''} flagged
          </span>
        )}

        {(['EMERGENT', 'URGENT', 'ROUTINE', 'INFO'] as TriageLevel[]).map(l =>
          counts[l] > 0 ? (
            <span key={l} style={{
              fontSize: 11, fontWeight: 700, color: triageColor(l),
              background: `${triageColor(l)}22`, border: `1px solid ${triageColor(l)}44`,
              borderRadius: 10, padding: '2px 8px',
            }}>
              {l} {counts[l]}
            </span>
          ) : null,
        )}

        <a href="/book" target="_blank" rel="noopener" style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 10,
          background: '#0d948822', border: '1px solid #0d948844',
          color: '#5eead4', textDecoration: 'none', fontWeight: 600,
        }}>
          + Book online
        </a>

        <div style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{clock} ECT</div>

        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
          background: mode === 'dry_run' ? '#422006' : '#14532d',
          color: mode === 'dry_run' ? '#fbbf24' : '#34d399',
          border: `1px solid ${mode === 'dry_run' ? '#fbbf2444' : '#34d39944'}`,
        }}>
          {mode === 'dry_run' ? '⚗ DRY RUN' : '● LIVE'}
        </span>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#1e293b', borderBottom: '1px solid #374151', padding: '0 20px', flexShrink: 0 }}>
        {(['messaging', 'bookings', 'documents'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent',
              color: tab === t ? '#0d9488' : '#6b7280', fontWeight: tab === t ? 700 : 400,
              fontSize: 13, cursor: 'pointer',
              borderBottom: `2px solid ${tab === t ? '#0d9488' : 'transparent'}`,
              textTransform: 'capitalize',
            }}
          >
            {t === 'messaging'
              ? `Messaging${sorted.length ? ` (${sorted.length})` : ''}`
              : t === 'bookings'
              ? `Bookings${pendingBookings.length ? ` (${pendingBookings.length} pending)` : ''}`
              : `Documents${docsNeedingReview.length ? ` (${docsNeedingReview.length} flagged)` : ''}`}
          </button>
        ))}
      </div>

      {/* ── MESSAGING TAB ── */}
      {tab === 'messaging' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Thread list */}
          <aside style={{ width: 320, flexShrink: 0, padding: '12px 10px', overflowY: 'auto', borderRight: '1px solid #374151' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              {sorted.length} thread{sorted.length !== 1 ? 's' : ''} (24 h)
            </div>
            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4b5563' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🩺</div>
                <div style={{ fontWeight: 600 }}>All quiet</div>
                <div style={{ fontSize: 11 }}>No active threads</div>
              </div>
            )}
            {sorted.map(t => (
              <ThreadCard key={t.id} thread={t} selected={selected?.id === t.id} onClick={() => setSelected(t)} />
            ))}
          </aside>

          {/* Thread detail */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selected ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>←</div>
                  <div style={{ fontWeight: 600 }}>Select a thread</div>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #374151', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  <TriageBadge level={selected.triage_level} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.patient_name ?? 'Anonymous'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{selected.chief_complaint ?? 'Complaint not yet recorded'}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280' }}>
                    Status: <b style={{ color: '#94a3b8' }}>{selected.status}</b>
                    &nbsp;·&nbsp;{selected.channel.toUpperCase()}
                    {selected.intake_complete && (
                      <span style={{ marginLeft: 8, color: '#34d399' }}>✓ Intake complete</span>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selected.messages.map((m, i) => {
                    if (m.role === 'system') {
                      const isTriage = m.meta?.type === 'triage_result';
                      const isSlots  = m.meta?.type === 'appointment_slots';
                      const acuity   = isTriage ? (m.meta as { type: 'triage_result'; payload: { acuity: string } }).payload.acuity : null;
                      const acuityColors: Record<string, string> = { urgent: '#ef4444', priority: '#f97316', review: '#fbbf24', routine: '#34d399' };
                      const color = acuity ? (acuityColors[acuity] ?? '#6b7280') : '#6b7280';
                      return (
                        <div key={i} style={{
                          padding: '6px 10px', borderRadius: 4,
                          background: '#0f172a', border: `1px solid ${isSlots ? '#0d948844' : color + '44'}`,
                          fontSize: 11, color: isSlots ? '#5eead4' : color,
                        }}>
                          <span style={{ fontWeight: 700, marginRight: 6 }}>
                            {isTriage ? 'TRIAGE' : isSlots ? 'SLOTS' : 'SYSTEM'}
                          </span>
                          {m.content}
                          <span style={{ marginLeft: 8, color: '#4b5563', fontSize: 9 }}>staff only</span>
                        </div>
                      );
                    }
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: m.role === 'patient' ? 'flex-start' : 'flex-end' }}>
                        <div style={{
                          maxWidth: '75%', padding: '8px 12px',
                          borderRadius: m.role === 'patient' ? '4px 16px 16px 4px' : '16px 4px 4px 16px',
                          background: m.role === 'patient' ? '#1e293b' : '#0d948822',
                          border: `1px solid ${m.role === 'patient' ? '#374151' : '#0d948844'}`,
                          fontSize: 13, color: '#e2e8f0', lineHeight: 1.5,
                        }}>
                          <div style={{ marginBottom: 2, fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{m.role}</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                          <div style={{ marginTop: 4, fontSize: 9, color: '#4b5563' }}>
                            {m.timestamp
                              ? new Date(m.timestamp).toLocaleTimeString('en-LC', {
                                  timeZone: 'America/St_Lucia', hour12: true, hour: '2-digit', minute: '2-digit',
                                })
                              : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {selected.messages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#4b5563', fontSize: 13 }}>No messages yet</div>
                  )}
                </div>

                {/* Draft approval */}
                {selected.status === 'pending_approval' && selected.draft_reply && (
                  <div style={{ padding: '0 16px', flexShrink: 0 }}>
                    <DraftApproval
                      thread={selected} secret={secret}
                      onAction={() => setSelected(prev => (prev ? { ...prev, status: 'resolved', draft_reply: null } : null))}
                    />
                  </div>
                )}

                {/* Ad-hoc send */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #374151', display: 'flex', gap: 8, flexShrink: 0 }}>
                  <input
                    type="text"
                    value={adHocMsg}
                    onChange={e => setAdHocMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendAdHoc(); } }}
                    placeholder="Send a message as nurse…"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: '#1e293b', border: '1px solid #374151', color: '#e2e8f0', fontSize: 13 }}
                  />
                  <button
                    onClick={() => void sendAdHoc()}
                    disabled={sending || !adHocMsg.trim()}
                    style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}
                  >
                    {sending ? '…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* ── BOOKINGS TAB ── */}
      {tab === 'bookings' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Appointment bookings (7 days)
            </div>
            <div style={{ flex: 1 }} />
            <a href="/book" target="_blank" rel="noopener" style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 6,
              background: '#0d9488', color: '#fff', textDecoration: 'none', fontWeight: 700,
            }}>
              Open booking page
            </a>
          </div>

          {bookings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#4b5563' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
              <div style={{ fontWeight: 600 }}>No bookings in the last 7 days</div>
            </div>
          )}

          {/* Sort: urgent pending first, then referral, then routine */}
          {[...bookings]
            .sort((a, b) => {
              const priority = (b: BookingRow) =>
                b.triage_acuity === 'urgent' ? 3 : b.triage_acuity === 'priority' ? 2 : 1;
              const pd = priority(b) - priority(a);
              if (pd !== 0) return pd;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map(booking => {
              const track       = decodeTrack(booking.reason);
              const trackColor  = TRACK_COLORS[track] ?? '#6b7280';
              const statusLabel = STATUS_LABEL[booking.status] ?? booking.status;
              const isLoading   = urgentLoading[booking.id];
              const msg         = urgentMsg[booking.id];
              const canUrgent   = booking.status === 'pending' && track !== 'routine';
              const isActionable = booking.status === 'pending';

              return (
                <div key={booking.id} style={{
                  marginBottom: 12, padding: '14px 16px', borderRadius: 8,
                  background: '#1e293b', border: `1px solid ${isActionable ? trackColor + '44' : '#374151'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: trackColor,
                          background: trackColor + '22', border: `1px solid ${trackColor}44`,
                          borderRadius: 8, padding: '1px 7px', textTransform: 'uppercase',
                        }}>
                          {track}
                        </span>
                        <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>
                          {booking.appointment_type?.replace(/_/g, ' ')}
                        </span>
                        <span style={{
                          marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                          color: booking.status === 'patient_confirmed' || booking.status === 'staff_confirmed' ? '#34d399' : '#6b7280',
                        }}>
                          {statusLabel}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{booking.patient_name}</div>
                      {booking.patient_phone && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{booking.patient_phone}</div>
                      )}
                      {booking.reason && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>
                          {booking.reason}
                        </div>
                      )}
                      {booking.notes && (
                        <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 3 }}>{booking.notes}</div>
                      )}
                      {booking.confirmed_slot && (
                        <div style={{ fontSize: 11, color: '#34d399', marginTop: 4 }}>
                          Slot: {new Date(booking.confirmed_slot).toLocaleString('en-LC', {
                            timeZone: 'America/St_Lucia', dateStyle: 'medium', timeStyle: 'short',
                          })}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                        {new Date(booking.created_at).toLocaleString('en-LC', {
                          timeZone: 'America/St_Lucia', dateStyle: 'short', timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Staff actions */}
                  {isActionable && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        onClick={() => void scheduleUrgent(booking.id)}
                        disabled={isLoading}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: canUrgent ? '#f97316' : '#0d9488',
                          color: '#fff', fontWeight: 700, fontSize: 12,
                          opacity: isLoading ? 0.6 : 1,
                        }}
                      >
                        {isLoading ? '…' : canUrgent ? 'Schedule urgent slot' : 'Auto-schedule'}
                      </button>
                      {msg && (
                        <span style={{ fontSize: 12, color: msg.startsWith('Confirmed') ? '#34d399' : '#f87171' }}>
                          {msg}
                        </span>
                      )}
                    </div>
                  )}

                  {/* On-demand "old system" migration — attach historic records
                      while this patient is pending or coming in for an encounter */}
                  {!['lapsed', 'cancelled', 'declined'].includes(booking.status) && (
                    <div style={{ marginTop: 8 }}>
                      {!migrateOpen[booking.id] ? (
                        <button
                          onClick={() => setMigrateOpen(prev => ({ ...prev, [booking.id]: true }))}
                          style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: 'transparent', color: '#94a3b8',
                            border: '1px solid #374151', cursor: 'pointer',
                          }}
                        >
                          📎 Attach old records
                        </button>
                      ) : (
                        <div style={{
                          marginTop: 4, padding: '10px 12px', borderRadius: 6,
                          background: '#0f172a', border: '1px solid #374151',
                          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
                        }}>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>Attach a scan for {booking.patient_name}:</span>
                          <select
                            value={migrateType[booking.id] ?? 'other'}
                            onChange={e => setMigrateType(prev => ({ ...prev, [booking.id]: e.target.value }))}
                            style={{
                              fontSize: 11, padding: '3px 6px', borderRadius: 4,
                              background: '#1e293b', color: '#cbd5e1', border: '1px solid #374151',
                            }}
                          >
                            <option value="lab_report">Lab report</option>
                            <option value="imaging_report">Imaging report</option>
                            <option value="referral_letter">Referral letter</option>
                            <option value="surgical_report">Surgical report</option>
                            <option value="discharge_summary">Discharge summary</option>
                            <option value="prescription">Prescription</option>
                            <option value="clinical_photo">Clinical photo</option>
                            <option value="other">Other</option>
                          </select>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            disabled={migrateLoading[booking.id]}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) void attachHistoricRecord(booking.id, f);
                              e.target.value = '';
                            }}
                            style={{ fontSize: 11, color: '#94a3b8', maxWidth: 220 }}
                          />
                          <label
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: migrateLoading[booking.id] ? 'default' : 'pointer',
                              background: '#1e293b', color: '#5eead4', border: '1px solid #374151',
                            }}
                          >
                            📷 Camera
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={migrateLoading[booking.id]}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void attachHistoricRecord(booking.id, f);
                                e.target.value = '';
                              }}
                              style={{ display: 'none' }}
                            />
                          </label>
                          <button
                            onClick={() => setMigrateOpen(prev => ({ ...prev, [booking.id]: false }))}
                            style={{ fontSize: 11, color: '#6b7280', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                          {migrateLoading[booking.id] && <span style={{ fontSize: 11, color: '#5eead4' }}>Uploading…</span>}
                        </div>
                      )}
                      {migrateMsg[booking.id] && (
                        <div style={{
                          marginTop: 4, fontSize: 11,
                          color: migrateMsg[booking.id].startsWith('Attached') ? '#34d399' : '#f87171',
                        }}>
                          {migrateMsg[booking.id]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === 'documents' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Patient-uploaded documents
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
            AI extraction transcribes facts and surfaces only what the document itself marks as out-of-range or urgent —
            it never diagnoses or interprets. Review and acknowledge before anything informs the chart.
          </div>

          {documents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#4b5563' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 600 }}>No documents uploaded yet</div>
            </div>
          )}

          {documents.map(doc => {
            let extracted: { documentSummary?: string; reportDate?: string | null; extractedFacts?: Array<{ label: string; value: string; unit?: string | null; referenceRange?: string | null; markedAbnormal?: boolean }> } | null = null;
            let flags: Array<{ type: string; label: string; severity: string; detail: string }> = [];
            try { extracted = doc.ai_extracted_data ? JSON.parse(doc.ai_extracted_data) : null; } catch { /* leave null */ }
            try { flags = doc.ai_flags ? JSON.parse(doc.ai_flags) : []; } catch { /* leave empty */ }

            const reviewed   = !!doc.staff_reviewed_at;
            const isFlagged  = flags.length > 0;
            const isLoading  = reviewing[doc.id];
            const borderTone = isFlagged && !reviewed ? '#fbbf2444' : '#374151';

            return (
              <div key={doc.id} style={{
                marginBottom: 12, padding: '14px 16px', borderRadius: 8,
                background: '#1e293b', border: `1px solid ${borderTone}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {doc.view_url && doc.mime_type?.startsWith('image/') && (
                    <a href={doc.view_url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                      <img
                        src={doc.view_url}
                        alt={doc.title}
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #374151' }}
                      />
                    </a>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#5eead4',
                        background: '#0d948822', border: '1px solid #0d948844',
                        borderRadius: 8, padding: '1px 7px', textTransform: 'uppercase',
                      }}>
                        {doc.document_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase' }}>
                        {doc.ai_extraction_status === 'done' ? 'AI reviewed'
                          : doc.ai_extraction_status === 'processing' ? 'Extracting…'
                          : doc.ai_extraction_status === 'failed' ? 'Extraction failed'
                          : doc.ai_extraction_status === 'skipped' ? 'Not extractable'
                          : 'Queued'}
                      </span>
                      {reviewed && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#34d399' }}>✓ Acknowledged</span>
                      )}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>{doc.patient_name ?? 'Unmatched patient'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {doc.title}
                      {doc.view_url && (
                        <a href={doc.view_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#5eead4' }}>
                          View document ↗
                        </a>
                      )}
                    </div>
                    {extracted?.documentSummary && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>{extracted.documentSummary}</div>
                    )}

                    {!!extracted?.extractedFacts?.length && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {extracted.extractedFacts.map((f, i) => (
                          <div key={i} style={{ fontSize: 11, color: f.markedAbnormal ? '#fbbf24' : '#6b7280' }}>
                            {f.markedAbnormal ? '● ' : '· '}
                            <span style={{ color: '#cbd5e1' }}>{f.label}</span>: {f.value}{f.unit ? ` ${f.unit}` : ''}
                            {f.referenceRange ? ` (ref: ${f.referenceRange})` : ''}
                            {f.markedAbnormal ? ' — marked on document' : ''}
                          </div>
                        ))}
                      </div>
                    )}

                    {!!flags.length && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {flags.map((flag, i) => {
                          const color = FLAG_SEVERITY_COLORS[flag.severity] ?? '#6b7280';
                          return (
                            <div key={i} style={{
                              fontSize: 11, color, padding: '5px 8px', borderRadius: 4,
                              background: `${color}15`, border: `1px solid ${color}33`,
                            }}>
                              <span style={{ fontWeight: 700, marginRight: 6, textTransform: 'uppercase' }}>{flag.label}</span>
                              {flag.detail}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>
                      Uploaded {new Date(doc.created_at).toLocaleString('en-LC', {
                        timeZone: 'America/St_Lucia', dateStyle: 'short', timeStyle: 'short',
                      })}
                      {doc.ai_extraction_at && ` · AI pass ${new Date(doc.ai_extraction_at).toLocaleString('en-LC', {
                        timeZone: 'America/St_Lucia', dateStyle: 'short', timeStyle: 'short',
                      })}`}
                    </div>
                  </div>
                </div>

                {isFlagged && !reviewed && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => void markReviewed(doc.id)}
                      disabled={isLoading}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 12,
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? '…' : 'Acknowledge'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
