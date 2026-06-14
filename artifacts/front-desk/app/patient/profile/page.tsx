'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  nok_name: string | null;
  nok_relation: string | null;
  nok_phone: string | null;
  blood_group: string | null;
  height_cm: number | null;
  weight_kg: number | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';

// Common Saint Lucia districts/communities — offered as suggestions on the
// address field via <datalist> so patients can pick rather than type in full.
const SAINT_LUCIA_LOCALITIES = [
  'Castries', 'Gros Islet', 'Rodney Bay', 'Bois d’Orange', 'Choc Estate',
  'Babonneau', 'Marigot Bay', 'Anse La Raye', 'Canaries', 'Soufrière',
  'Choiseul', 'Laborie', 'Vieux Fort', 'Micoud', 'Dennery', 'Praslin',
  'Mon Repos', 'Desruisseaux',
];

const s = {
  pageTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: '#1e293b',
  } as React.CSSProperties,

  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 20,
  } as React.CSSProperties,

  sectionHeading: {
    fontSize: 13,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    marginBottom: 18,
    marginTop: 0,
  } as React.CSSProperties,

  row: {
    marginBottom: 18,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    marginBottom: 6,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    boxSizing: 'border-box' as const,
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    color: '#1e293b',
    background: '#fff',
    boxSizing: 'border-box' as const,
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2394a3b8' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 36,
    fontFamily: 'inherit',
  } as React.CSSProperties,

  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  } as React.CSSProperties,
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'amise-spin 0.8s linear infinite', display: 'block' }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [profile, setProfile] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Contact Details
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [address, setAddress] = useState('');

  // Next of Kin
  const [nokName,     setNokName]     = useState('');
  const [nokRelation, setNokRelation] = useState('');
  const [nokPhone,    setNokPhone]    = useState('');

  // Health Basics
  const [bloodGroup, setBloodGroup] = useState('');
  const [heightCm,   setHeightCm]   = useState('');
  const [weightKg,   setWeightKg]   = useState('');

  const populateFields = useCallback((row: PatientRow) => {
    setPhone(row.phone       ?? '');
    setEmail(row.email       ?? '');
    setAddress(row.address   ?? '');
    setNokName(row.nok_name       ?? '');
    setNokRelation(row.nok_relation ?? '');
    setNokPhone(row.nok_phone     ?? '');
    setBloodGroup(row.blood_group  ?? '');
    setHeightCm(row.height_cm != null ? String(row.height_cm) : '');
    setWeightKg(row.weight_kg != null ? String(row.weight_kg) : '');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      const { data, error: fetchErr } = await sb
        .from('patients')
        .select('*')
        .single();

      if (cancelled) return;

      if (fetchErr || !data) {
        // Right after sign-in the session can land before the Postgrest
        // client has the fresh JWT attached, so the RLS-gated query briefly
        // returns no rows — onAuthStateChange below retries once it settles.
        setSaveError('Unable to load your profile. Please try again shortly.');
        setLoading(false);
        return;
      }

      setProfile(data as PatientRow);
      populateFields(data as PatientRow);
      setSaveError(null);
      setLoading(false);
    }

    void load();
    const { data: { subscription } } = sb.auth.onAuthStateChange((ev, sess) => {
      if (ev === 'SIGNED_IN' && sess) void load();
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router, sb, populateFields]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || saving) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const { error: updateErr } = await sb
      .from('patients')
      .update({
        phone:        phone.trim()    || null,
        email:        email.trim()    || null,
        address:      address.trim()  || null,
        nok_name:     nokName.trim()  || null,
        nok_relation: nokRelation     || null,
        nok_phone:    nokPhone.trim() || null,
        blood_group:  bloodGroup      || null,
        height_cm:    heightCm        ? parseFloat(heightCm) : null,
        weight_kg:    weightKg        ? parseFloat(weightKg) : null,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (updateErr) {
      setSaveError('Your changes could not be saved. Please check your connection and try again.');
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>
        Loading your profile…
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes amise-spin { to { transform: rotate(360deg); } }
        .amise-input:focus { border-color: ${TEAL} !important; box-shadow: 0 0 0 3px rgba(13,148,136,0.12); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          type="button"
          onClick={() => router.push('/patient')}
          style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Back to portal"
        >
          ←
        </button>
        <h1 style={s.pageTitle}>My Profile</h1>
      </div>

      <form onSubmit={(e) => void handleSave(e)} noValidate>

        {/* ── Section 1: Contact Details ── */}
        <div style={s.card}>
          <p style={s.sectionHeading}>Contact Details</p>

          <div style={s.row}>
            <label style={s.label} htmlFor="prof-phone">Phone Number</label>
            <input
              id="prof-phone"
              className="amise-input"
              type="tel"
              style={s.input}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +1 758 123 4567"
              autoComplete="tel"
            />
          </div>

          <div style={s.row}>
            <label style={s.label} htmlFor="prof-email">Email Address</label>
            <input
              id="prof-email"
              className="amise-input"
              type="email"
              style={s.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. name@example.com"
              autoComplete="email"
            />
          </div>

          <div style={{ ...s.row, marginBottom: 0 }}>
            <label style={s.label} htmlFor="prof-address">Home Address</label>
            <input
              id="prof-address"
              className="amise-input"
              type="text"
              style={s.input}
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 12 Choc Estate, Castries"
              autoComplete="street-address"
              list="sl-localities"
            />
            <datalist id="sl-localities">
              {SAINT_LUCIA_LOCALITIES.map(loc => <option key={loc} value={loc} />)}
            </datalist>
          </div>
        </div>

        {/* ── Section 2: Emergency Contact / Next of Kin ── */}
        <div style={s.card}>
          <p style={s.sectionHeading}>Emergency Contact / Next of Kin</p>

          <div style={s.row}>
            <label style={s.label} htmlFor="nok-name">Full Name</label>
            <input
              id="nok-name"
              className="amise-input"
              type="text"
              style={s.input}
              value={nokName}
              onChange={e => setNokName(e.target.value)}
              placeholder="e.g. Marie Joseph"
              autoComplete="off"
            />
          </div>

          <div style={s.grid2}>
            <div>
              <label style={s.label} htmlFor="nok-relation">Relationship</label>
              <select
                id="nok-relation"
                className="amise-input"
                style={s.select}
                value={nokRelation}
                onChange={e => setNokRelation(e.target.value)}
              >
                <option value="">Select…</option>
                <option value="Spouse/Partner">Spouse / Partner</option>
                <option value="Parent">Parent</option>
                <option value="Child">Child</option>
                <option value="Sibling">Sibling</option>
                <option value="Friend">Friend</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={s.label} htmlFor="nok-phone">Phone Number</label>
              <input
                id="nok-phone"
                className="amise-input"
                type="tel"
                style={s.input}
                value={nokPhone}
                onChange={e => setNokPhone(e.target.value)}
                placeholder="e.g. +1 758 456 7890"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* ── Section 3: Health Basics ── */}
        <div style={s.card}>
          <p style={s.sectionHeading}>Health Basics</p>

          <div style={{ ...s.row, marginBottom: 18 }}>
            <label style={s.label} htmlFor="blood-group">Blood Group</label>
            <select
              id="blood-group"
              className="amise-input"
              style={s.select}
              value={bloodGroup}
              onChange={e => setBloodGroup(e.target.value)}
            >
              <option value="">Select…</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div style={{ ...s.grid2, marginBottom: 0 }}>
            <div>
              <label style={s.label} htmlFor="height-cm">Height (cm)</label>
              <input
                id="height-cm"
                className="amise-input"
                type="number"
                min={50}
                max={250}
                step={0.1}
                style={s.input}
                value={heightCm}
                onChange={e => setHeightCm(e.target.value)}
                placeholder="e.g. 170"
              />
            </div>
            <div>
              <label style={s.label} htmlFor="weight-kg">Weight (kg)</label>
              <input
                id="weight-kg"
                className="amise-input"
                type="number"
                min={1}
                max={500}
                step={0.1}
                style={s.input}
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="e.g. 72"
              />
            </div>
          </div>
        </div>

        {/* Error banner */}
        {saveError && (
          <div style={{
            padding: '12px 16px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            color: '#991b1b',
            fontSize: 14,
            marginBottom: 20,
          }}>
            {saveError}
          </div>
        )}

        {/* Save button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {saved ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 22px',
              background: '#d1fae5',
              color: '#065f46',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
            }}>
              Saved ✓
            </span>
          ) : (
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 28px',
                background: saving ? '#99f6e4' : TEAL,
                color: saving ? '#0f766e' : '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </form>

      {/* Footer note */}
      <p style={{
        marginTop: 28,
        padding: '16px 20px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        fontSize: 12,
        color: '#64748b',
        lineHeight: 1.7,
        margin: '28px 0 0',
      }}>
        Keeping your contact details up to date helps us reach you for appointment reminders
        and important updates. Your next of kin information is used only in cases of emergency.
      </p>
    </div>
  );
}
