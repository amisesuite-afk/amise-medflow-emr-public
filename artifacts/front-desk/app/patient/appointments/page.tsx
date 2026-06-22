'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';
import { API_BASE as API } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  location: string | null;
  notes: string | null;
  reason_for_visit: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-LC', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:  { label: 'Scheduled',  color: '#1e40af', bg: '#dbeafe' },
  confirmed:  { label: 'Confirmed',  color: '#065f46', bg: '#d1fae5' },
  pending:    { label: 'Pending',    color: '#92400e', bg: '#fef3c7' },
  cancelled:  { label: 'Cancelled',  color: '#991b1b', bg: '#fee2e2' },
  completed:  { label: 'Completed',  color: '#374151', bg: '#f3f4f6' },
  no_show:    { label: 'No Show',    color: '#7c3aed', bg: '#ede9fe' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      borderRadius: 5,
      padding: '3px 8px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {cfg.label}
    </span>
  );
}

// Self-service reschedule/cancel: lets a patient flag that they need a
// change, with staff contacting them to actually action it (assist mode).
// Requests inside the minimum-notice window are declined here in favour of
// calling the practice directly, mirroring the server-side check.
const MIN_NOTICE_HOURS = 48;

function ChangeRequestControl({
  appointment,
  pending,
  onSubmitted,
}: {
  appointment: Appointment;
  pending: { change_type: string } | undefined;
  onSubmitted: (appointmentId: string, changeType: 'reschedule' | 'cancel') => void;
}) {
  const sb = getPatientClient();
  const [expanded, setExpanded] = useState<'reschedule' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (['cancelled', 'attended', 'no_show'].includes(appointment.status)) return null;

  if (pending) {
    return (
      <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
        {pending.change_type === 'cancel' ? 'Cancellation' : 'Reschedule'} request sent — our team will be in touch.
      </div>
    );
  }

  const apptDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time ?? '00:00:00'}`);
  const hoursUntil = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil < MIN_NOTICE_HOURS) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
        Too soon to change online — please call 459-2227 · 284-0557.
      </div>
    );
  }

  async function submit() {
    if (!expanded) return;
    setSubmitting(true);
    setError(null);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setError('Please sign in again.'); setSubmitting(false); return; }
    try {
      const res = await fetch(`${API}/api/patient/appointments/${appointment.id}/request-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ change_type: expanded, reason: reason.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Could not submit your request. Please try again.');
        setSubmitting(false);
        return;
      }
      onSubmitted(appointment.id, expanded);
    } catch {
      setError('Could not submit your request. Please try again.');
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => { setExpanded('reschedule'); setReason(''); setError(null); }}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
        >
          Request Reschedule
        </button>
        <button
          type="button"
          onClick={() => { setExpanded('cancel'); setReason(''); setError(null); }}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: 'pointer' }}
        >
          Request Cancellation
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
        {expanded === 'cancel' ? 'Request cancellation' : 'Request reschedule'}
      </p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder={expanded === 'cancel' ? 'Reason (optional)' : 'Preferred new date/time, or reason (optional)'}
        rows={2}
        style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 13, borderRadius: 6, border: '1px solid #e2e8f0', resize: 'vertical', fontFamily: 'inherit' }}
      />
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void submit()}
          style={{ padding: '7px 14px', background: submitting ? '#99f6e4' : TEAL, color: submitting ? '#0f766e' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Sending…' : 'Send Request'}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(null); setError(null); }}
          style={{ padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';
const TODAY = new Date().toISOString().slice(0, 10);

type Filter = 'upcoming' | 'past' | 'all';

export default function AppointmentsPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [changeRequests, setChangeRequests] = useState<Record<string, { change_type: string }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('upcoming');

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      let query = sb
        .from('appointments')
        .select('id, appointment_date, appointment_time, appointment_type, status, location, notes, reason_for_visit')
        .order('appointment_date', { ascending: filter !== 'past' });

      if (filter === 'upcoming') {
        query = query.gte('appointment_date', TODAY).not('status', 'eq', 'cancelled');
      } else if (filter === 'past') {
        query = query.lt('appointment_date', TODAY);
      }

      const [{ data }, { data: changeReqs }] = await Promise.all([
        query.limit(50),
        sb.from('appointment_change_requests').select('appointment_id, change_type').eq('status', 'pending'),
      ]);

      setAppointments(data ?? []);
      setChangeRequests(Object.fromEntries((changeReqs ?? []).map(r => [r.appointment_id, { change_type: r.change_type }])));
      setLoading(false);
    })();
  }, [filter, router, sb]);

  const filterBtn = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => { setLoading(true); setFilter(f); }}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: filter === f ? `2px solid ${TEAL}` : '2px solid #e2e8f0',
        background: filter === f ? TEAL : '#fff',
        color: filter === f ? '#fff' : '#64748b',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push('/patient')}
          style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Back"
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Appointments</h1>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {filterBtn('upcoming', 'Upcoming')}
        {filterBtn('past', 'Past')}
        {filterBtn('all', 'All')}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 40, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : appointments.length === 0 ? (
        <div style={{ padding: '24px 20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#64748b', fontSize: 14 }}>
          No {filter === 'all' ? '' : filter} appointments found.
        </div>
      ) : (
        appointments.map(appt => (
          <div
            key={appt.id}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '18px 20px',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                {appt.appointment_type}
              </div>
              <StatusBadge status={appt.status} />
            </div>

            <div style={{ fontSize: 13, color: '#475569', marginBottom: appt.location || appt.notes ? 8 : 0 }}>
              {formatDate(appt.appointment_date)}
              {appt.appointment_time ? ` at ${appt.appointment_time.slice(0, 5)} AST` : ''}
            </div>

            {appt.location && (
              <div style={{ fontSize: 13, color: '#64748b' }}>
                📍 {appt.location}
              </div>
            )}

            {appt.reason_for_visit && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                {appt.reason_for_visit}
              </div>
            )}

            {appt.notes && (
              <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                {appt.notes}
              </div>
            )}

            {filter !== 'past' && (
              <ChangeRequestControl
                appointment={appt}
                pending={changeRequests[appt.id]}
                onSubmitted={(appointmentId, changeType) =>
                  setChangeRequests(prev => ({ ...prev, [appointmentId]: { change_type: changeType } }))
                }
              />
            )}
          </div>
        ))
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.7 }}>
        For anything urgent, or if online options don&apos;t work for you, call Tapion Hospital:<br />
        459-2227 · 284-0557
      </p>
    </div>
  );
}
