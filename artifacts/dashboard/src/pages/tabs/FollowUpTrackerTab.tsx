import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

interface PendingBooking {
  id: string;
  patient_name: string;
  patient_phone: string | null;
  appointment_type: string;
  status: string;
  triage_acuity: string | null;
  created_at: string;
  source: string | null;
}

interface CallItem {
  id: string;
  caller_number: string | null;
  status: string;
  direction: string | null;
  staff_notes: string | null;
  practice_line: string | null;
  created_at: string;
  transcription_status: string | null;
  transcript: string | null;
}

interface OpenEncounter {
  id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string;
  chief_complaint: string | null;
  status: string;
  patients: { full_name: string } | null;
}

export default function FollowUpTrackerTab() {
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [encounters, setEncounters] = useState<OpenEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setTopSection, setPatientId, setPatientName, setActiveSection } = useAppContext();
  const { profile } = useAuth();
  const userRole = profile?.role ?? 'front_desk';
  const isClinical = userRole === 'doctor' || userRole === 'nurse' || userRole === 'admin';

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      const [bRes, cRes, eRes] = await Promise.all([
        supabase
          .from('appointment_requests')
          .select('id, patient_name, patient_phone, appointment_type, status, triage_acuity, created_at, source')
          .in('status', ['pending', 'waitlisted'])
          .order('triage_acuity', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(50),

        supabase
          .from('call_logs')
          .select('id, caller_number, status, direction, staff_notes, practice_line, created_at, transcription_status, transcript')
          .in('status', ['voicemail', 'missed', 'callback_scheduled'])
          .order('created_at', { ascending: false })
          .limit(50),

        isClinical
          ? supabase
              .from('encounters')
              .select('id, patient_id, encounter_date, encounter_type, chief_complaint, status, patients(full_name)')
              .in('status', ['open', 'in_progress'])
              .gte('encounter_date', new Date(Date.now() - 30 * 86_400_000).toISOString())
              .order('encounter_date', { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (bRes.error) throw bRes.error;
      if (cRes.error) throw cRes.error;
      if (eRes.error) throw eRes.error;

      setBookings((bRes.data ?? []) as PendingBooking[]);
      setCalls((cRes.data ?? []) as CallItem[]);
      setEncounters((eRes.data ?? []) as OpenEncounter[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load follow-up items');
    } finally {
      setLoading(false);
    }
  }, [isClinical]);

  useEffect(() => { void load(); }, [load]);

  const totalCount = bookings.length + calls.length + encounters.length;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 860, margin: '0 auto' }}>
      <Header count={totalCount} onRefresh={load} />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          Loading…
        </div>
      ) : (
        <>
          <TrackerSection
            title="Pending Bookings"
            count={bookings.length}
            accent="#6366f1"
            onViewAll={() => setTopSection('booking_inbox')}
          >
            {bookings.length === 0
              ? <EmptyState text="No pending bookings — inbox clear" />
              : bookings.map(b => (
                <BookingCard
                  key={b.id}
                  item={b}
                  onOpen={() => setTopSection('booking_inbox')}
                />
              ))
            }
          </TrackerSection>

          <TrackerSection
            title="Outstanding Calls"
            count={calls.length}
            accent="#8b5cf6"
            onViewAll={() => setTopSection('calls_queue')}
          >
            {calls.length === 0
              ? <EmptyState text="No outstanding calls — queue clear" />
              : calls.map(c => (
                <CallCard
                  key={c.id}
                  item={c}
                  onOpen={() => setTopSection('calls_queue')}
                />
              ))
            }
          </TrackerSection>

          {isClinical && (
            <TrackerSection
              title="Open / Unsigned Encounters"
              count={encounters.length}
              accent="#0d9488"
            >
              {encounters.length === 0
                ? <EmptyState text="No open encounters in the past 30 days" />
                : encounters.map(e => (
                  <EncounterCard
                    key={e.id}
                    item={e}
                    onOpen={() => {
                      const name = e.patients?.full_name ?? 'Unknown patient';
                      setPatientId(e.patient_id);
                      setPatientName(name);
                      setTopSection('consultation');
                      setActiveSection('assessment');
                    }}
                  />
                ))
              }
            </TrackerSection>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ count, onRefresh }: { count: number; onRefresh: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink, #1e293b)' }}>
          Follow-up Tracker
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {count === 0
            ? 'All items resolved — nothing needs attention'
            : `${count} item${count !== 1 ? 's' : ''} need attention`}
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        style={{
          padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)',
          background: 'var(--surface, #fff)', color: '#64748b', fontSize: 12,
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Refresh
      </button>
    </div>
  );
}

function TrackerSection({
  title, count, accent, onViewAll, children,
}: {
  title: string; count: number; accent: string; onViewAll?: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink, #1e293b)', letterSpacing: '.02em' }}>
            {title}
          </span>
          {count > 0 && (
            <span style={{
              padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: `${accent}22`, color: accent,
            }}>
              {count}
            </span>
          )}
        </div>
        {onViewAll && count > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            style={{
              fontSize: 12, color: accent, fontWeight: 600,
              border: 'none', background: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            View all →
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface, #fff)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: 10, padding: '12px 14px',
    }}>
      {children}
    </div>
  );
}

function CardFooter({ time, label, onAction }: { time: string; label: string; onAction: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{relTime(time)}</span>
      <button
        type="button"
        onClick={onAction}
        style={{
          padding: '3px 10px', borderRadius: 6, border: 'none',
          background: '#0d948822', color: '#0d9488', fontWeight: 700,
          fontSize: 12, cursor: 'pointer',
        }}
      >
        {label} →
      </button>
    </div>
  );
}

function StatusBadge({ status, colour }: { status: string; colour: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: `${colour}22`, color: colour, flexShrink: 0,
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function AcuityBadge({ acuity }: { acuity: string | null }) {
  if (!acuity) return null;
  const c = acuity === 'urgent' ? '#ef4444'
    : acuity === 'priority' ? '#f97316'
    : acuity === 'review' ? '#eab308'
    : '#64748b';
  return (
    <span style={{ fontSize: 11, color: c, fontWeight: 700 }}>
      {acuity.toUpperCase()}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 10, border: '1px dashed var(--border, #e2e8f0)',
      textAlign: 'center', fontSize: 13, color: '#94a3b8',
    }}>
      {text}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, marginBottom: 16,
      background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
    }}>
      {message}
    </div>
  );
}

function BookingCard({ item: b, onOpen }: { item: PendingBooking; onOpen: () => void }) {
  const colour = statusColour(b.status);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #1e293b)', marginBottom: 2 }}>
            {b.patient_name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {b.appointment_type.replace(/_/g, ' ')}
            {b.patient_phone ? ` · ${b.patient_phone}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={b.status} colour={colour} />
          <AcuityBadge acuity={b.triage_acuity} />
        </div>
      </div>
      <CardFooter time={b.created_at} label="Open Inbox" onAction={onOpen} />
    </Card>
  );
}

function CallCard({ item: c, onOpen }: { item: CallItem; onOpen: () => void }) {
  const colour = statusColour(c.status);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #1e293b)', marginBottom: 2 }}>
            {c.caller_number ?? 'Unknown caller'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
            {c.practice_line ? ` · ${c.practice_line}` : ''}
            {c.staff_notes ? ` · ${c.staff_notes}` : ''}
          </div>
          {c.transcript && (
            <div style={{
              fontSize: 12, color: '#64748b', marginTop: 6,
              padding: '4px 8px', borderRadius: 6,
              background: 'var(--muted, #f8fafc)', borderLeft: '3px solid #8b5cf6',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {c.transcript}
            </div>
          )}
        </div>
        <StatusBadge status={c.status} colour={colour} />
      </div>
      <CardFooter time={c.created_at} label="Open Calls" onAction={onOpen} />
    </Card>
  );
}

function EncounterCard({ item: e, onOpen }: { item: OpenEncounter; onOpen: () => void }) {
  const name = e.patients?.full_name ?? 'Unknown patient';
  const colour = statusColour(e.status);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #1e293b)', marginBottom: 2 }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {e.encounter_type.replace(/_/g, ' ')}
            {e.chief_complaint ? ` · ${e.chief_complaint}` : ''}
          </div>
        </div>
        <StatusBadge status={e.status} colour={colour} />
      </div>
      <CardFooter time={e.encounter_date} label="Open Chart" onAction={onOpen} />
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusColour(s: string): string {
  const map: Record<string, string> = {
    pending: '#6366f1', waitlisted: '#0ea5e9',
    voicemail: '#8b5cf6', missed: '#ef4444',
    callback_scheduled: '#f97316', open: '#0d9488', in_progress: '#0d9488',
  };
  return map[s] ?? '#64748b';
}
