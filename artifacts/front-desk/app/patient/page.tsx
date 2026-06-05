'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient, PatientProfile } from '@/lib/patient-supabase';

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  location: string | null;
}

const TEAL = '#0d9488';

function formatDate(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-LC', { day: 'numeric' }),
    month: d.toLocaleDateString('en-LC', { month: 'short' }).toUpperCase(),
  };
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    scheduled: { label: 'Scheduled', color: '#1e40af', bg: '#dbeafe' },
    confirmed:  { label: 'Confirmed', color: '#065f46', bg: '#d1fae5' },
    pending:    { label: 'Pending',   color: '#92400e', bg: '#fef3c7' },
  };
  const cfg = map[status] ?? { label: status, color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {cfg.label}
    </span>
  );
}

interface NavCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  accent?: string;
}

function NavCard({ icon, title, subtitle, onClick, accent = TEAL }: NavCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '16px 20px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        marginBottom: 10,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: `${accent}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{subtitle}</div>
      </div>
      <span style={{ color: '#cbd5e1', fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}

export default function PatientDashboardPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      const [{ data: profileData }, { data: apptData }] = await Promise.all([
        sb.from('patients').select('*').single(),
        sb
          .from('appointments')
          .select('id, appointment_date, appointment_time, appointment_type, status, location')
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

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void loadData();
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
      <p style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 4 }}>Good day, {firstName}.</p>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>Welcome to your Amise Medical patient portal.</p>

      {/* ── Upcoming Appointments ── */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Upcoming Appointments
      </p>

      {upcoming.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          No upcoming appointments on record.
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {upcoming.map(appt => {
            const d = formatDate(appt.appointment_date);
            return (
              <div key={appt.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ minWidth: 44, textAlign: 'center', background: '#f1f5f9', borderRadius: 8, padding: '8px 4px', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: TEAL, lineHeight: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 2 }}>{d.month}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{appt.appointment_type}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>
                    {appt.appointment_time ? appt.appointment_time.slice(0, 5) + ' AST' : 'Time TBC'}
                    {appt.location ? ` · ${appt.location}` : ''}
                  </div>
                  {statusBadge(appt.status)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Self-Service ── */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        My Information
      </p>

      <NavCard
        icon="👤"
        title="My Profile"
        subtitle="Update your contact details, next of kin, and health basics"
        onClick={() => router.push('/patient/profile')}
      />
      <NavCard
        icon="📋"
        title="Pre-Visit Questionnaire"
        subtitle="Tell us about your current symptoms before your consultation"
        onClick={() => router.push('/patient/intake')}
      />
      <NavCard
        icon="📁"
        title="My Documents"
        subtitle="Upload referral letters, test results, and medical reports"
        onClick={() => router.push('/patient/documents')}
      />

      {/* ── Records & Appointments ── */}
      <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, marginTop: 28 }}>
        Health Records
      </p>

      <NavCard
        icon="🩺"
        title="Medical Summary"
        subtitle="View your medications, allergies, and referrals on record"
        onClick={() => router.push('/patient/records')}
        accent="#6366f1"
      />
      <NavCard
        icon="📅"
        title="All Appointments"
        subtitle="See your full appointment history"
        onClick={() => router.push('/patient/appointments')}
        accent="#6366f1"
      />

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
