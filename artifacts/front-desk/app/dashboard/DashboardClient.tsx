'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { ConversationThread, TriageLevel } from '@/types';
import ThreadCard from '@/components/ThreadCard';
import DraftApproval from '@/components/DraftApproval';
import TriageBadge from '@/components/TriageBadge';
import { sortThreads, triageColor } from '@/lib/triage';

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

interface Props {
  initialThreads: ConversationThread[];
  secret: string;
  mode: string;
}

export default function DashboardClient({ initialThreads, secret, mode }: Props) {
  const [threads, setThreads]   = useState<ConversationThread[]>(initialThreads);
  const [selected, setSelected] = useState<ConversationThread | null>(null);
  const [adHocMsg, setAdHocMsg] = useState('');
  const [sending, setSending]   = useState(false);
  const clock = useLiveClock();

  const sorted = sortThreads(threads);

  // Supabase Realtime
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    const channel = sb
      .channel('thread-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_threads' },
        payload => {
          const row = payload.new as ConversationThread;
          setThreads(prev => {
            const idx = prev.findIndex(t => t.id === row.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return next;
            }
            return [row, ...prev];
          });
          // Update selected if it matches
          setSelected(prev => (prev?.id === row.id ? row : prev));
        },
      )
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, []);

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
    } finally {
      setSending(false);
    }
  }, [selected, adHocMsg, secret]);

  // Triage counts
  const counts: Record<TriageLevel, number> = { EMERGENT: 0, URGENT: 0, ROUTINE: 0, INFO: 0 };
  threads.forEach(t => { counts[t.triage_level]++; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #374151', flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#0d9488' }}>Amise Front Desk</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>AI Intake · Saint Lucia</div>
        <div style={{ flex: 1 }} />
        {/* Triage counts */}
        {(['EMERGENT', 'URGENT', 'ROUTINE', 'INFO'] as TriageLevel[]).map(l =>
          counts[l] > 0 ? (
            <span
              key={l}
              style={{
                fontSize: 11, fontWeight: 700, color: triageColor(l),
                background: `${triageColor(l)}22`,
                border: `1px solid ${triageColor(l)}44`,
                borderRadius: 10, padding: '2px 8px',
              }}
            >
              {l} {counts[l]}
            </span>
          ) : null,
        )}
        <div style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{clock} ECT</div>
        <span
          style={{
            fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
            background: mode === 'dry_run' ? '#422006' : '#14532d',
            color: mode === 'dry_run' ? '#fbbf24' : '#34d399',
            border: `1px solid ${mode === 'dry_run' ? '#fbbf2444' : '#34d39944'}`,
          }}
        >
          {mode === 'dry_run' ? '⚗ DRY RUN' : '● LIVE'}
        </span>
      </header>

      {/* Body */}
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
            <ThreadCard
              key={t.id}
              thread={t}
              selected={selected?.id === t.id}
              onClick={() => setSelected(t)}
            />
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
                  // System messages render as staff-only triage/info panels
                  if (m.role === 'system') {
                    const isTriage = m.meta?.type === 'triage_result';
                    const isSlots  = m.meta?.type === 'appointment_slots';
                    const acuity   = isTriage ? (m.meta as { type: 'triage_result'; payload: { acuity: string; score: number } }).payload.acuity : null;
                    const acuityColors: Record<string, string> = { urgent: '#ef4444', priority: '#f97316', review: '#fbbf24', routine: '#34d399' };
                    const color = acuity ? (acuityColors[acuity] ?? '#6b7280') : '#6b7280';
                    return (
                      <div key={i} style={{
                        padding: '6px 10px', borderRadius: 4,
                        background: '#0f172a',
                        border: `1px solid ${isSlots ? '#0d948844' : color + '44'}`,
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

                  // Patient / assistant bubbles
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'patient' ? 'flex-start' : 'flex-end' }}>
                      <div
                        style={{
                          maxWidth: '75%', padding: '8px 12px',
                          borderRadius: m.role === 'patient' ? '4px 16px 16px 4px' : '16px 4px 4px 16px',
                          background: m.role === 'patient' ? '#1e293b' : '#0d948822',
                          border: `1px solid ${m.role === 'patient' ? '#374151' : '#0d948844'}`,
                          fontSize: 13, color: '#e2e8f0', lineHeight: 1.5,
                        }}
                      >
                        <div style={{ marginBottom: 2, fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{m.role}</div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                        <div style={{ marginTop: 4, fontSize: 9, color: '#4b5563' }}>
                          {m.timestamp
                            ? new Date(m.timestamp).toLocaleTimeString('en-LC', {
                                timeZone: 'America/St_Lucia',
                                hour12: true,
                                hour: '2-digit',
                                minute: '2-digit',
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
                    thread={selected}
                    secret={secret}
                    onAction={() =>
                      setSelected(prev => (prev ? { ...prev, status: 'resolved', draft_reply: null } : null))
                    }
                  />
                </div>
              )}

              {/* Ad-hoc send */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #374151', display: 'flex', gap: 8, flexShrink: 0 }}>
                <input
                  type="text"
                  value={adHocMsg}
                  onChange={e => setAdHocMsg(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendAdHoc();
                    }
                  }}
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
    </div>
  );
}
