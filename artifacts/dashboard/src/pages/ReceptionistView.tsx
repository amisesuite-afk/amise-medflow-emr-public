import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import { savePatientFull } from '@/lib/db';
import type { Sex } from '@workspace/triage-engine';
import BookingInboxTab from './tabs/BookingInboxTab';
import QuestionnaireManagerTab from './tabs/QuestionnaireManagerTab';
import { SL_COMMUNITIES } from '@/data/st-lucia';

type ReceptionistTab = 'checkin' | 'inbox' | 'questionnaire';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

export default function ReceptionistView() {
  const {
    patientName, setPatientName,
    age, setAge,
    sex, setSex,
    dob, setDob,
    phone, setPhone,
    email, setEmail,
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
  const [saved, setSaved] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<'sent' | 'error' | null>(null);
  const [activeTab, setActiveTab] = useState<ReceptionistTab>('checkin');
  const [pendingCount, setPendingCount] = useState(0);
  const [referringProviders, setReferringProviders] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl('/api/admin/referring-providers'), { headers: await staffAuthHeaders() });
        if (r.ok) {
          const d = await r.json() as { providers: { name: string; provider_type: string; active: boolean }[] };
          const names = (d.providers ?? [])
            .filter(p => p.provider_type === 'referring_doctor' && p.active)
            .map(p => p.name)
            .sort((a, b) => a.localeCompare(b));
          setReferringProviders(names);
        }
      } catch { /* ignore — falls back to free text */ }
    })();
  }, []);

  const fetchPendingCount = useCallback(async () => {
    try {
      const r = await fetch(apiUrl('/api/booking/requests?status=pending'), { headers: await staffAuthHeaders() });
      if (r.ok) {
        const d = await r.json() as { requests: unknown[] };
        setPendingCount((d.requests ?? []).length);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchPendingCount();
    const t = setInterval(() => void fetchPendingCount(), 60_000);
    return () => clearInterval(t);
  }, [fetchPendingCount]);

  async function handleCheckIn() {
    setSaving(true);
    setSaveError(null);
    const { patient, error } = await savePatientFull({
      full_name: patientName, age, dob, sex, phone, email,
      address, quarter, referredBy, insuranceProvider,
      policyNumber, nhiNumber, preAuthStatus,
    });
    setSaving(false);
    if (error) {
      if (error.includes('not configured')) {
        setSavedName(patientName);
        setPreVisitStatus('registered');
        setSaved(true);
        return;
      }
      setSaveError(error);
      return;
    }
    if (patient) setPatientId(patient.id);
    setSavedName(patientName);
    setPreVisitStatus('registered');
    setSaved(true);
  }

  function handleNewPatient() {
    setSaved(false);
    setSavedName('');
    setInviteResult(null);
    clearPatient();
    setSaveError(null);
  }

  async function handleInvitePortal() {
    if (!patientId || !email.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const r = await fetch(apiUrl('/api/patient/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patient_id: patientId, email: email.trim() }),
      });
      setInviteResult(r.ok ? 'sent' : 'error');
    } catch {
      setInviteResult('error');
    } finally {
      setInviting(false);
    }
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

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: 900, margin: '0 auto' }}>
          {([
            { id: 'checkin',       label: 'Check-In' },
            { id: 'inbox',        label: 'Booking Inbox', badge: pendingCount },
            { id: 'questionnaire', label: 'Questionnaire' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 18px', border: 'none', background: 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #0d9488' : '2px solid transparent',
                color: activeTab === tab.id ? '#0d9488' : '#6b7280',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
              {'badge' in tab && tab.badge > 0 && (
                <span style={{
                  minWidth: 18, height: 18, borderRadius: 99, padding: '0 5px',
                  background: '#f59e0b', color: '#fff',
                  fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Booking Inbox */}
      {activeTab === 'inbox' && (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <BookingInboxTab />
        </main>
      )}

      {/* Tab: Questionnaire */}
      {activeTab === 'questionnaire' && (
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px' }}>
          <QuestionnaireManagerTab />
        </main>
      )}

      {/* Tab: Check-In */}
      {activeTab === 'checkin' && (
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Success state ── */}
          {saved && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 18, padding: '48px 24px 40px', textAlign: 'center',
              background: '#f0fdf4', borderRadius: 14, border: '1px solid #86efac',
            }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 30, color: '#fff' }}>✓</span>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#166534', marginBottom: 4 }}>
                  Checked In Successfully
                </div>
                <div style={{ fontSize: 15, color: '#374151' }}>
                  <strong>{savedName || 'Patient'}</strong> has been registered and is awaiting the nurse.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleNewPatient}
                  style={{
                    marginTop: 6,
                    padding: '13px 34px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--accent)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}
                >
                  + Register Next Patient
                </button>

                {/* Portal invite */}
                {email.trim() && patientId && inviteResult === null && (
                  <button
                    type="button"
                    onClick={() => void handleInvitePortal()}
                    disabled={inviting}
                    style={{
                      padding: '11px 24px',
                      borderRadius: 10,
                      border: '1.5px solid #0d9488',
                      background: 'transparent',
                      color: '#0d9488',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: inviting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {inviting ? 'Sending…' : '📧 Invite to Patient Portal'}
                  </button>
                )}
                {inviteResult === 'sent' && (
                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                    ✓ Portal invite sent to {email}
                  </div>
                )}
                {inviteResult === 'error' && (
                  <div style={{ fontSize: 13, color: '#dc2626' }}>
                    Invite failed — check API server or try again.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Streamlined registration form ── */}
          {!saved && (
            <div style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
              padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {/* Row 1: Name (full width) */}
              <div className="fld">
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Full name</label>
                <input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="e.g. Marie Joseph"
                  autoFocus
                  style={{ fontSize: 16, padding: '11px 12px', borderRadius: 8 }}
                />
              </div>

              {/* Row 2: DOB · Age · Sex · Phone — all in one line */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr 1fr', gap: 8 }}>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>DOB</label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Age</label>
                  <input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="57" style={{ padding: '8px 8px', fontSize: 13, textAlign: 'center' }} />
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Sex</label>
                  <select value={sex} onChange={e => setSex(e.target.value as Sex)} style={{ padding: '8px 6px', fontSize: 13 }}>
                    <option value="unknown">—</option>
                    <option value="male">M</option>
                    <option value="female">F</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Phone</label>
                  <input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (758) XXX-XXXX" style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
              </div>

              {/* Row 3: Email · Community — split */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Email <span style={{ color: '#9ca3af' }}>(portal)</span></label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@example.com" style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Community / Address</label>
                  <input
                    type="text" list="sl-communities" value={address}
                    onChange={e => {
                      const val = e.target.value;
                      setAddress(val);
                      const match = SL_COMMUNITIES.find(c => c.community.toLowerCase() === val.toLowerCase());
                      setQuarter(match ? match.quarter : '');
                    }}
                    placeholder="e.g. Rodney Bay"
                    style={{ padding: '8px 8px', fontSize: 13 }}
                  />
                  <datalist id="sl-communities">
                    {SL_COMMUNITIES.map(c => (
                      <option key={`${c.quarter}-${c.community}`} value={c.community}>{c.quarter}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Row 4: Referred by · Insurance — split */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Referred by</label>
                  <input
                    type="text" list="referring-doctors" value={referredBy}
                    onChange={e => setReferredBy(e.target.value)}
                    placeholder="Doctor or facility…"
                    style={{ padding: '8px 8px', fontSize: 13 }}
                  />
                  <datalist id="referring-doctors">
                    {referringProviders.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Insurance</label>
                  <input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="SAGICOR, CLICO…" style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
              </div>

              {/* Row 5: Policy · NHI · Pre-auth — compact row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Policy #</label>
                  <input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Member ID" style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>NHI #</label>
                  <input type="text" value={nhiNumber} onChange={e => setNhiNumber(e.target.value)} placeholder="NHI number" style={{ padding: '8px 8px', fontSize: 13 }} />
                </div>
                <div className="fld">
                  <label style={{ fontSize: 10 }}>Pre-auth</label>
                  <select value={preAuthStatus} onChange={e => setPreAuthStatus(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                    <option value="">N/A</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>
              {quarter && <span style={{ fontSize: 10, color: '#6b7280' }}>Quarter: {quarter}</span>}
            </div>
          )}

          {/* Action row — only shown when registering */}
          {!saved && saveError && (
            <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              Save failed: {saveError} — record saved locally only.
            </div>
          )}
          {!saved && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-start', paddingTop: 8, paddingLeft: 2 }}>
              <button
                type="button"
                onClick={() => void handleCheckIn()}
                disabled={!patientName.trim() || saving}
                style={{
                  padding: '14px 36px',
                  borderRadius: 10,
                  border: 'none',
                  background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 17,
                  minHeight: 48,
                  cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed',
                  transition: 'background .15s',
                }}
              >
                {saving ? 'Saving...' : 'Check In'}
              </button>
              <button
                type="button"
                onClick={handleNewPatient}
                style={{
                  padding: '14px 24px',
                  borderRadius: 10,
                  border: '1.5px solid #d1d5db',
                  background: 'transparent',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: 15,
                  minHeight: 48,
                  cursor: 'pointer',
                }}
              >
                Clear form
              </button>
            </div>
          )}
        </div>
      </main>
      )}
    </div>
  );
}
