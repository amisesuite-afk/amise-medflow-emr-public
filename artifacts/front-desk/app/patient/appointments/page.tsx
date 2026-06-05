'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

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

// ─── Component ────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';
const TODAY = new Date().toISOString().slice(0, 10);

type Filter = 'upcoming' | 'past' | 'all';

export default function AppointmentsPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
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

      const { data } = await query.limit(50);
      setAppointments(data ?? []);
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
          </div>
        ))
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.7 }}>
        To reschedule or cancel, please call Tapion Hospital:<br />
        459-2227 · 284-0557
      </p>
    </div>
  );
}
