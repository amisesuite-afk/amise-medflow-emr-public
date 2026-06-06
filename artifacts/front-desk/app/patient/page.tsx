'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient, PatientProfile } from '@/lib/patient-supabase';

const TEAL = '#0d9488';

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  appointment_time: string | null;
  appointment_type: string;
  status: string;
  location: string | null;
}

function fmtApptDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day:   d.toLocaleDateString('en-LC', { day: 'numeric' }),
    month: d.toLocaleDateString('en-LC', { month: 'short' }).toUpperCase(),
    full:  d.toLocaleDateString('en-LC', { weekday: 'short', day: 'numeric', month: 'long' }),
  };
}

const STATUS_DOT: Record<string, string> = {
  confirmed: '#10b981',
  scheduled: '#3b82f6',
  pending:   '#f59e0b',
};

export default function PatientDashboardPage() {
  const router = useRouter();
  const sb     = getPatientClient();

  const [profile,  setProfile]  = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      const [{ data: pData }, { data: aData }] = await Promise.all([
        sb.from('patients').select('*').single(),
        sb.from('appointments')
          .select('id, appointment_date, appointment_time, appointment_type, status, location')
          .gte('appointment_date', new Date().toISOString().slice(0, 10))
          .in('status', ['scheduled', 'confirmed', 'pending'])
          .order('appointment_date', { ascending: true })
          .limit(3),
      ]);

      setProfile(pData);
      setUpcoming(aData ?? []);
      setLoading(false);
    }

    void load();
    const { data: { subscription } } = sb.auth.onAuthStateChange((ev, sess) => {
      if (ev === 'SIGNED_IN' && sess) void load();
    });
    return () => subscription.unsubscribe();
  }, [router, sb]);

  async function signOut() {
    await sb.auth.signOut();
    router.replace('/patient/login');
  }

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>Loading your portal…</div>;
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div>

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
          Good day, {firstName}.
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
          Welcome to your Amise Medical portal.
        </p>
      </div>

      {/* Upcoming appointments */}
      <SectionHead>Upcoming appointments</SectionHead>

      {upcoming.length === 0 ? (
        <EmptyCard>
          <span>No upcoming appointments on record.</span>
          <button
            type="button"
            onClick={() => router.push('/patient/request')}
            style={{ marginTop: 10, fontSize: 13, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            Request a consultation →
          </button>
        </EmptyCard>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {upcoming.map(appt => {
            const d   = fmtApptDate(appt.appointment_date);
            const dot = STATUS_DOT[appt.status] ?? '#94a3b8';
            return (
              <div key={appt.id} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '14px 16px', marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                {/* Date block */}
                <div style={{
                  minWidth: 44, textAlign: 'center', flexShrink: 0,
                  background: '#f8fafc', borderRadius: 8, padding: '7px 4px',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: TEAL, lineHeight: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginTop: 2 }}>{d.month}</div>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {appt.appointment_type}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {appt.appointment_time ? appt.appointment_time.slice(0, 5) + ' AST' : 'Time TBC'}
                    {appt.location ? ` · ${appt.location}` : ''}
                  </div>
                </div>
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} title={appt.status} />
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <SectionHead>My portal</SectionHead>

      <ActionCard icon="📋" title="Pre-Visit Questionnaire" sub="Tell us about your symptoms before your visit"    onClick={() => router.push('/patient/intake')} />
      <ActionCard icon="👤" title="My Profile"              sub="Contact details, next of kin, health basics"      onClick={() => router.push('/patient/profile')} />
      <ActionCard icon="📁" title="My Documents"            sub="Upload referral letters and test results"         onClick={() => router.push('/patient/documents')} accent="#6366f1" />
      <ActionCard icon="🩺" title="Medical Summary"         sub="Medications, allergies, and referrals on file"    onClick={() => router.push('/patient/records')}  accent="#6366f1" />
      <ActionCard icon="📅" title="All Appointments"        sub="Full appointment history"                         onClick={() => router.push('/patient/appointments')} accent="#6366f1" />

      {/* Sign out */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
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

// ── Tiny presentational helpers ───────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      {children}
    </p>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', color: '#64748b', fontSize: 14, marginBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {children}
    </div>
  );
}

function ActionCard({ icon, title, sub, onClick, accent = TEAL }: {
  icon: string; title: string; sub: string; onClick: () => void; accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '14px 16px',
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        marginBottom: 10, cursor: 'pointer', textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${accent}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <span style={{ color: '#d1d5db', fontSize: 18, flexShrink: 0 }}>›</span>
    </button>
  );
}
