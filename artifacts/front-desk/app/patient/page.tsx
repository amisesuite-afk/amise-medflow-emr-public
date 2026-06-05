'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient, PatientProfile } from '@/lib/patient-supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  location: string | null;
  notes: string | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';

const s = {
  greeting: {
    fontSize: 22,
    fontWeight: 900,
    color: '#1e293b',
    marginBottom: 4,
  } as React.CSSProperties,

  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 32,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    marginBottom: 12,
  } as React.CSSProperties,

  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '20px 24px',
    marginBottom: 16,
  } as React.CSSProperties,

  apptCard: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  } as React.CSSProperties,

  apptDate: {
    minWidth: 52,
    textAlign: 'center' as const,
    background: '#f1f5f9',
    borderRadius: 8,
    padding: '8px 4px',
  } as React.CSSProperties,

  navLink: {
    display: 'block',
    padding: '14px 20px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    marginBottom: 10,
    color: '#1e293b',
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s',
  } as React.CSSProperties,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): { day: string; month: string; full: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-LC', { day: 'numeric' }),
    month: d.toLocaleDateString('en-LC', { month: 'short' }).toUpperCase(),
    full: d.toLocaleDateString('en-LC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    scheduled:  { label: 'Scheduled',  color: '#1e40af', bg: '#dbeafe' },
    confirmed:  { label: 'Confirmed',  color: '#065f46', bg: '#d1fae5' },
    pending:    { label: 'Pending',    color: '#92400e', bg: '#fef3c7' },
    cancelled:  { label: 'Cancelled',  color: '#991b1b', bg: '#fee2e2' },
    completed:  { label: 'Completed',  color: '#374151', bg: '#f3f4f6' },
  };
  const s = map[status] ?? { label: status, color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 5, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {s.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDashboardPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData(accessToken?: string) {
      // With implicit flow, the access token may arrive via onAuthStateChange
      // before getSession() is ready. Accept it either way.
      const { data: { session } } = await sb.auth.getSession();
      const activeSession = session ?? (accessToken ? { access_token: accessToken } : null);
      if (!activeSession) { router.replace('/patient/login'); return; }

      const [{ data: profileData }, { data: apptData }] = await Promise.all([
        sb.from('patients').select('*').single(),
        sb
          .from('appointments')
          .select('id, appointment_date, appointment_time, appointment_type, status, location, notes')
          .gte('appointment_date', new Date().toISOString().slice(0, 10))
          .in('status', ['scheduled', 'confirmed', 'pending'])
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true })
          .limit(3),
      ]);

      setProfile(profileData);
      setUpcoming(apptData ?? []);
      setLoading(false);
    }

    void loadData();

    // Catch the SIGNED_IN event from implicit flow hash tokens
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        void loadData(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [router, sb]);

  async function signOut() {
    await sb.auth.signOut();
    router.replace('/patient/login');
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>
        Loading your portal…
      </div>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div>
      {/* Greeting */}
      <p style={s.greeting}>Good day, {firstName}.</p>
      <p style={s.subtitle}>Welcome to your Amise Medical patient portal.</p>

      {/* Upcoming appointments */}
      <p style={s.sectionTitle}>Upcoming Appointments</p>

      {upcoming.length === 0 ? (
        <div style={{ ...s.card, color: '#64748b', fontSize: 14 }}>
          No upcoming appointments on record. Please contact us to schedule a visit.
        </div>
      ) : (
        <>
          {upcoming.map(appt => {
            const d = formatDate(appt.appointment_date);
            return (
              <div key={appt.id} style={s.apptCard}>
                <div style={s.apptDate}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: TEAL, lineHeight: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 2 }}>{d.month}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                    {appt.appointment_type}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    {appt.appointment_time ? appt.appointment_time.slice(0, 5) + ' AST' : 'Time TBC'}
                    {appt.location ? ` · ${appt.location}` : ''}
                  </div>
                  {statusBadge(appt.status)}
                </div>
              </div>
            );
          })}
          <a
            style={{ ...s.navLink, color: TEAL, fontSize: 13, textAlign: 'center', fontWeight: 600 }}
            onClick={() => router.push('/patient/appointments')}
          >
            View all appointments →
          </a>
        </>
      )}

      {/* Navigation */}
      <p style={{ ...s.sectionTitle, marginTop: 32 }}>My Health Records</p>

      <div
        style={s.navLink}
        onClick={() => router.push('/patient/records')}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') router.push('/patient/records'); }}
      >
        Medications, Allergies &amp; Vitals
        <span style={{ float: 'right', color: '#94a3b8', fontWeight: 400 }}>→</span>
      </div>

      <div
        style={s.navLink}
        onClick={() => router.push('/patient/appointments')}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') router.push('/patient/appointments'); }}
      >
        All Appointments
        <span style={{ float: 'right', color: '#94a3b8', fontWeight: 400 }}>→</span>
      </div>

      {/* Sign out */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => void signOut()}
          style={{ fontSize: 13, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
