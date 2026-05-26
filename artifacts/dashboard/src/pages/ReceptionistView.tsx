import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
import { savePatientFull } from '@/lib/db';
import type { Sex } from '@/lib/adaptive-triage';

export default function ReceptionistView() {
  const {
    patientName, setPatientName,
    age, setAge,
    sex, setSex,
    dob, setDob,
    phone, setPhone,
    address, setAddress,
    quarter, setQuarter,
    referredBy, setReferredBy,
    insuranceProvider, setInsuranceProvider,
    policyNumber, setPolicyNumber,
    nhiNumber, setNhiNumber,
    preAuthStatus, setPreAuthStatus,
    clearPatient,
    currentSite, setCurrentSite,
    preVisitStatus, setPreVisitStatus,
    patientId, setPatientId,
  } = useAppContext();

  const { profile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleCheckIn() {
    setSaving(true);
    setSaveError(null);
    const { patient, error } = await savePatientFull({
      full_name: patientName, age, dob, sex, phone,
      address, referredBy, insuranceProvider,
      policyNumber, nhiNumber, preAuthStatus,
    });
    setSaving(false);
    if (error) {
      // If Supabase not configured (demo mode) — proceed anyway
      if (error.includes('not configured')) {
        setPreVisitStatus('registered');
        return;
      }
      setSaveError(error);
      return;
    }
    if (patient) setPatientId(patient.id);
    setPreVisitStatus('registered');
  }

  function handleNewPatient() {
    clearPatient();
    setSaveError(null);
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="app-header" style={{ gridColumn: 'unset' }}>
        <span className="header-brand">Amise Medical Services</span>

        {/* Site selector pill */}
        <div className="mode-toggle" style={{ marginLeft: 8 }}>
          {SITE_CODES.map(code => (
            <button
              key={code}
              type="button"
              className={currentSite === code ? 'active' : ''}
              onClick={() => setCurrentSite(code)}
            >
              {SITE_LABELS[code]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* User chip */}
        <div className="user-chip">
          <span className="user-chip__name">{profile?.full_name ?? 'Staff'}</span>
          <span className="user-chip__role">
            {profile?.role ? ROLE_LABELS[profile.role] : 'Front Desk'}
          </span>
          <button
            type="button"
            className="user-chip__logout"
            onClick={() => void signOut()}
            title="Sign out"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* Scrollable body */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Status banner */}
          {(preVisitStatus === 'registered' || preVisitStatus === 'vitals_done') && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#166534',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              Patient registered — awaiting nurse
            </div>
          )}

          {/* Card 1: Patient details */}
          <CollapsibleCard title="Patient Details">
            <div className="form-grid cols-2" style={{ gap: 12 }}>
              <div className="fld" style={{ gridColumn: '1 / -1' }}>
                <label>Full name</label>
                <input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="e.g. Marie Joseph"
                  style={{ fontSize: 15, padding: '10px 11px' }}
                />
              </div>

              <div className="fld">
                <label>Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld">
                <label>Age</label>
                <input
                  inputMode="numeric"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder="e.g. 57"
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld">
                <label>Sex</label>
                <select
                  value={sex}
                  onChange={e => setSex(e.target.value as Sex)}
                  style={{ padding: '10px 11px' }}
                >
                  <option value="unknown">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="fld">
                <label>Phone</label>
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (758) XXX-XXXX"
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld" style={{ gridColumn: '1 / -1' }}>
                <label>Community / Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => { setAddress(e.target.value); setQuarter(''); }}
                  placeholder="e.g. Rodney Bay, Gros Islet…"
                  style={{ padding: '10px 11px' }}
                />
                {quarter && (
                  <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Quarter: {quarter}
                  </span>
                )}
              </div>

              <div className="fld" style={{ gridColumn: '1 / -1' }}>
                <label>Referred by</label>
                <input
                  type="text"
                  value={referredBy}
                  onChange={e => setReferredBy(e.target.value)}
                  placeholder="Doctor or facility name…"
                  style={{ padding: '10px 11px' }}
                />
              </div>
            </div>
          </CollapsibleCard>

          {/* Card 2: Insurance & billing */}
          <CollapsibleCard title="Insurance &amp; Billing">
            <div className="form-grid cols-2" style={{ gap: 12 }}>
              <div className="fld" style={{ gridColumn: '1 / -1' }}>
                <label>Insurance provider</label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={e => setInsuranceProvider(e.target.value)}
                  placeholder="e.g. SAGICOR, CLICO, S&P…"
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld">
                <label>Policy number</label>
                <input
                  type="text"
                  value={policyNumber}
                  onChange={e => setPolicyNumber(e.target.value)}
                  placeholder="Policy / member ID"
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld">
                <label>NHI number</label>
                <input
                  type="text"
                  value={nhiNumber}
                  onChange={e => setNhiNumber(e.target.value)}
                  placeholder="NHI / NHIA number"
                  style={{ padding: '10px 11px' }}
                />
              </div>

              <div className="fld" style={{ gridColumn: '1 / -1' }}>
                <label>Pre-authorisation status</label>
                <select
                  value={preAuthStatus}
                  onChange={e => setPreAuthStatus(e.target.value)}
                  style={{ padding: '10px 11px' }}
                >
                  <option value="">Not required</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
            </div>
          </CollapsibleCard>

          {/* Action row */}
          {saveError && (
            <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12, marginBottom: 4 }}>
              Save failed: {saveError} — record saved locally only.
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              onClick={handleNewPatient}
              style={{
                padding: '11px 22px',
                borderRadius: 8,
                border: '1.5px solid var(--accent)',
                background: 'transparent',
                color: 'var(--accent)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              + New Patient
            </button>

            <button
              type="button"
              onClick={() => void handleCheckIn()}
              disabled={!patientName.trim() || saving}
              style={{
                padding: '11px 28px',
                borderRadius: 8,
                border: 'none',
                background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed',
                transition: 'background .15s',
              }}
            >
              {saving ? 'Saving…' : 'Check In ✓'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
