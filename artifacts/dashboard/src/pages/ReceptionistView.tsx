import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
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
      const r = await fetch(apiUrl('/api/booking/requests?status=pending'));
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
      full_name: patientName, age, dob, sex, phone,
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
            </div>
          )}

          {/* ── Registration form — hidden after save ── */}
          {/* Card 1: Patient details */}
          {!saved && <CollapsibleCard title="Patient Details">
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
                  list="sl-communities"
                  value={address}
                  onChange={e => {
                    const val = e.target.value;
                    setAddress(val);
                    const match = SL_COMMUNITIES.find(c => c.community.toLowerCase() === val.toLowerCase());
                    setQuarter(match ? match.quarter : '');
                  }}
                  placeholder="e.g. Rodney Bay, Castries…"
                  style={{ padding: '10px 11px' }}
                />
                <datalist id="sl-communities">
                  {SL_COMMUNITIES.map(c => (
                    <option key={`${c.quarter}-${c.community}`} value={c.community}>
                      {c.quarter}
                    </option>
                  ))}
                </datalist>
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
                  list="referring-doctors"
                  value={referredBy}
                  onChange={e => setReferredBy(e.target.value)}
                  placeholder="Doctor or facility name…"
                  style={{ padding: '10px 11px' }}
                />
                <datalist id="referring-doctors">
                  {referringProviders.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>
          </CollapsibleCard>}

          {/* Card 2: Insurance & billing */}
          {!saved && <CollapsibleCard title="Insurance &amp; Billing">
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
          </CollapsibleCard>}

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
                  padding: '12px 30px',
                  borderRadius: 8,
                  border: 'none',
                  background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed',
                  transition: 'background .15s',
                }}
              >
                {saving ? 'Saving…' : 'Check In ✓'}
              </button>
              <button
                type="button"
                onClick={handleNewPatient}
                style={{
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: '1.5px solid #d1d5db',
                  background: 'transparent',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: 14,
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
