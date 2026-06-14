'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  prescribed_date: string | null;
  status: string;
  prescribing_doctor: string | null;
  notes: string | null;
}

interface Allergy {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: string | null;
  diagnosed_date: string | null;
}

interface Referral {
  id: string;
  referral_date: string;
  specialty: string | null;
  referred_to: string | null;
  reason: string | null;
  status: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';

const s = {
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    marginTop: 32,
    marginBottom: 12,
  } as React.CSSProperties,

  row: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px 18px',
    marginBottom: 10,
  } as React.CSSProperties,

  pill: (color: string, bg: string) => ({
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color,
    background: bg,
    borderRadius: 5,
    padding: '2px 7px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SeverityPill({ severity }: { severity: string | null }) {
  const cfg: Record<string, [string, string]> = {
    mild:     ['#065f46', '#d1fae5'],
    moderate: ['#92400e', '#fef3c7'],
    severe:   ['#991b1b', '#fee2e2'],
    unknown:  ['#374151', '#f3f4f6'],
  };
  const key = severity?.toLowerCase() ?? 'unknown';
  const [color, bg] = cfg[key] ?? cfg['unknown'];
  return <span style={s.pill(color, bg)}>{severity ?? 'Unknown'}</span>;
}

function MedStatusPill({ status }: { status: string }) {
  const cfg: Record<string, [string, string]> = {
    active:      ['#065f46', '#d1fae5'],
    discontinued: ['#374151', '#f3f4f6'],
    on_hold:     ['#92400e', '#fef3c7'],
    completed:   ['#374151', '#f3f4f6'],
  };
  const [color, bg] = cfg[status] ?? ['#374151', '#f3f4f6'];
  return <span style={s.pill(color, bg)}>{status.replace('_', ' ')}</span>;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-LC', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllMeds, setShowAllMeds] = useState(false);

  // Records are gated — patient must explicitly request to view them
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }
      setLoading(false);
    })();
  }, [router, sb]);

  async function handleRequestSummary() {
    setFetching(true);
    const [
      { data: medsData },
      { data: allergiesData },
      { data: referralsData },
    ] = await Promise.all([
      sb
        .from('medications')
        .select('id, medication_name, dosage, frequency, prescribed_date, status, prescribing_doctor, notes')
        .order('status', { ascending: true })
        .order('medication_name', { ascending: true }),
      sb
        .from('allergies')
        .select('id, allergen, reaction, severity, diagnosed_date')
        .order('severity', { ascending: false }),
      sb
        .from('referrals')
        .select('id, referral_date, specialty, referred_to, reason, status')
        .order('referral_date', { ascending: false })
        .limit(10),
    ]);

    setMedications(medsData ?? []);
    setAllergies(allergiesData ?? []);
    setReferrals(referralsData ?? []);
    setFetching(false);
    setSummaryRequested(true);
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const activeMeds = medications.filter(m => m.status === 'active');
  const otherMeds  = medications.filter(m => m.status !== 'active');
  const visibleMeds = showAllMeds ? medications : activeMeds;

  if (!summaryRequested) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => router.push('/patient')}
            style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            aria-label="Back"
          >←</button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Medical Summary</h1>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🩺</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#1e293b' }}>View your medical summary</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            Your summary includes your medications on record, known allergies, and referral history.
            This information is for your personal reference only.
          </p>
          <button
            type="button"
            onClick={() => void handleRequestSummary()}
            disabled={fetching}
            style={{
              padding: '14px 32px',
              background: fetching ? '#99f6e4' : '#0d9488',
              color: fetching ? '#0f766e' : '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: fetching ? 'default' : 'pointer',
            }}
          >
            {fetching ? 'Loading your records…' : 'View My Medical Summary'}
          </button>
          <p style={{ marginTop: 20, fontSize: 12, color: '#94a3b8' }}>
            Records are loaded fresh each time. For clinical decisions, always consult your doctor.
          </p>
        </div>
      </div>
    );
  }

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
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>My Records</h1>
      </div>

      {/* ── Allergies ── */}
      <p style={s.sectionTitle}>Allergies</p>

      {allergies.length === 0 ? (
        <div style={{ ...s.row, color: '#64748b', fontSize: 14 }}>No known allergies on record.</div>
      ) : (
        allergies.map(a => (
          <div key={a.id} style={s.row}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{a.allergen}</span>
              <SeverityPill severity={a.severity} />
            </div>
            {a.reaction && (
              <div style={{ fontSize: 13, color: '#64748b' }}>Reaction: {a.reaction}</div>
            )}
            {a.diagnosed_date && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Noted {formatDate(a.diagnosed_date)}</div>
            )}
          </div>
        ))
      )}

      {/* ── Medications ── */}
      <p style={s.sectionTitle}>
        Medications
        {otherMeds.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAllMeds(v => !v)}
            style={{ marginLeft: 12, fontSize: 11, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}
          >
            {showAllMeds ? 'Show active only' : `Show all (${medications.length})`}
          </button>
        )}
      </p>

      {visibleMeds.length === 0 ? (
        <div style={{ ...s.row, color: '#64748b', fontSize: 14 }}>No active medications on record.</div>
      ) : (
        visibleMeds.map(med => (
          <div key={med.id} style={s.row}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{med.medication_name}</span>
              <MedStatusPill status={med.status} />
            </div>
            {med.dosage && (
              <div style={{ fontSize: 13, color: '#475569' }}>
                {med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}
              </div>
            )}
            {med.prescribing_doctor && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Prescribed by {med.prescribing_doctor}
                {med.prescribed_date ? ` · ${formatDate(med.prescribed_date)}` : ''}
              </div>
            )}
            {med.notes && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
                {med.notes}
              </div>
            )}
          </div>
        ))
      )}

      {/* ── Referrals ── */}
      {referrals.length > 0 && (
        <>
          <p style={s.sectionTitle}>Recent Referrals</p>
          {referrals.map(r => (
            <div key={r.id} style={s.row}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  {r.specialty ?? 'Specialist Referral'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatDate(r.referral_date)}</span>
              </div>
              {r.referred_to && (
                <div style={{ fontSize: 13, color: '#475569' }}>Referred to: {r.referred_to}</div>
              )}
              {r.reason && (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{r.reason}</div>
              )}
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: 32, padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#475569' }}>Important Notice</p>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
          This summary is for your personal reference only. It may not reflect recent changes.
          For clinical decisions, always consult your doctor. In an emergency call 911 or visit
          the nearest emergency department.
        </p>
      </div>
    </div>
  );
}
