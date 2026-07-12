import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import {
  savePatientFull, uploadPatientPhoto,
  searchPatients, listPatients,
  createEncounter, getLatestOpenEncounter,
  type PatientListRow,
} from '@/lib/db';
import type { Sex } from '@workspace/triage-engine';
import BookingInboxTab from './tabs/BookingInboxTab';
import QuestionnaireManagerTab from './tabs/QuestionnaireManagerTab';
import { SL_COMMUNITIES } from '@/data/st-lucia';

const QUEUE_KEY = 'amise-patients-v1';

function pushToTodayQueue(entry: { id: string; full_name: string; age?: string; sex?: string; dob?: string; phone?: string }): void {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const all: Array<Record<string, string>> = raw ? JSON.parse(raw) as Array<Record<string, string>> : [];
    const filtered = all.filter(p => p.id !== entry.id);
    filtered.push({ ...entry, savedAt: new Date().toISOString() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

function resizeImageToBase64(file: File, size = 320): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function calcAge(dob: string | null): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const now = new Date();
  const y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  return String(m < 0 || (m === 0 && now.getDate() < birth.getDate()) ? y - 1 : y);
}

function fmtDob(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-LC', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Encounter gate step ──────────────────────────────────────────────────────

type CheckInStep =
  | 'search'          // default: search bar + new patient button
  | 'new-form'        // new patient registration form
  | 'patient-ready'   // patient identified (from search or just registered), confirm + start encounter
  | 'encounter-open'; // encounter created, show divider + direct to questionnaire

type ReceptionistTab = 'checkin' | 'registry' | 'inbox' | 'questionnaire';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const NOK_RELATIONS = ['Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Aunt/Uncle', 'Friend', 'Guardian', 'Carer', 'Other'];

// ── Shared components ─────────────────────────────────────────────────────────

function PatientChip({ p, onSelect }: { p: PatientListRow; onSelect: () => void }) {
  const age = calcAge(p.date_of_birth);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        border: '1.5px solid #e5e7eb', background: '#fff',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color .12s, background .12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0d9488'; (e.currentTarget as HTMLElement).style.background = '#f0fdfa'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.background = '#fff'; }}
    >
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👤</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.full_name ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {[p.sex && p.sex !== 'unknown' ? p.sex.charAt(0).toUpperCase() : null, age ? `${age} y` : null, p.phone].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', flexShrink: 0 }}>Select →</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    occupation, setOccupation,
    nokName, setNokName,
    nokRelation, setNokRelation,
    nokTel, setNokTel,
    clearPatient,
    currentSite, setCurrentSite,
    preVisitStatus, setPreVisitStatus,
    patientId, setPatientId,
    encounterId, setEncounterId,
    patientPhoto, setPatientPhoto,
  } = useAppContext();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { profile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<'sent' | 'error' | null>(null);
  const [activeTab, setActiveTab] = useState<ReceptionistTab>('checkin');
  const [pendingCount, setPendingCount] = useState(0);
  const [referringProviders, setReferringProviders] = useState<string[]>([]);

  // Check-in flow state
  const [step, setStep] = useState<CheckInStep>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientListRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [encounterStartedAt, setEncounterStartedAt] = useState<string | null>(null);
  const [encounterError, setEncounterError] = useState<string | null>(null);

  // Registry state
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryRows, setRegistryRows] = useState<PatientListRow[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);

  // ── Referring providers ──────────────────────────────────────────────────
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
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Booking inbox pending count ─────────────────────────────────────────
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

  // ── Patient search (debounced) ───────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchPatients(searchQuery);
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Registry load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'registry') return;
    setRegistryLoading(true);
    void listPatients().then(res => {
      setRegistryRows(res.patients ?? []);
      setRegistryLoading(false);
    });
  }, [activeTab]);

  // ── Registry search (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'registry') return;
    if (!registryQuery.trim()) {
      setRegistryLoading(true);
      void listPatients().then(res => { setRegistryRows(res.patients ?? []); setRegistryLoading(false); });
      return;
    }
    const timer = setTimeout(async () => {
      setRegistryLoading(true);
      const results = await searchPatients(registryQuery);
      setRegistryRows(results);
      setRegistryLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [registryQuery, activeTab]);

  // ── Load a patient from search/registry into context ─────────────────────
  function loadPatientFromRow(p: PatientListRow) {
    clearPatient();
    setPatientId(p.id);
    setPatientName(p.full_name ?? '');
    setSex((p.sex as Sex) ?? 'unknown');
    setPhone(p.phone ?? '');
    setDob(p.date_of_birth ?? '');
    const a = calcAge(p.date_of_birth);
    if (a) setAge(a);
    setStep('patient-ready');
    setEncounterStartedAt(null);
    setEncounterError(null);
    setSearchQuery('');
    setSearchResults([]);
  }

  // ── Check-in: new patient registration ──────────────────────────────────
  async function handleCheckIn() {
    setSaving(true);
    setSaveError(null);
    const { patient, error } = await savePatientFull({
      full_name: patientName, age, dob, sex, phone, email,
      address, quarter, referredBy, insuranceProvider,
      policyNumber, nhiNumber, preAuthStatus,
      occupation, nokName, nokRelation, nokTel,
    });
    setSaving(false);
    if (error) {
      if (error.includes('not configured')) {
        const localId = `local_${Date.now()}`;
        setPatientId(localId);
        pushToTodayQueue({ id: localId, full_name: patientName, age, sex: sex !== 'unknown' ? sex : undefined, dob: dob || undefined, phone: phone || undefined });
        setPreVisitStatus('registered');
        setStep('patient-ready');
        return;
      }
      setSaveError(error);
      return;
    }
    if (patient) {
      setPatientId(patient.id);
      pushToTodayQueue({ id: patient.id, full_name: patientName, age, sex: sex !== 'unknown' ? sex : undefined, dob: dob || undefined, phone: phone || undefined });
      if (patientPhoto && patientPhoto.startsWith('data:')) {
        void uploadPatientPhoto(patient.id, patientPhoto).then(url => {
          if (url) setPatientPhoto(url);
        });
      }
    }
    setPreVisitStatus('registered');
    setStep('patient-ready');
  }

  // ── Encounter gate: open new encounter ───────────────────────────────────
  async function handleStartEncounter() {
    if (!patientId) return;
    setEncounterError(null);
    const pid = patientId;
    // Close any existing encounter first
    setEncounterId(null);
    const { encounter, error } = await createEncounter({ patient_id: pid, site: currentSite });
    if (error) {
      if (error.includes('not configured')) {
        // Offline: generate local encounter ID
        setEncounterId(`local-enc-${Date.now()}`);
        const now = new Date().toISOString();
        setEncounterStartedAt(now);
        pushToTodayQueue({ id: pid, full_name: patientName });
        setStep('encounter-open');
        return;
      }
      setEncounterError(error);
      return;
    }
    if (encounter) setEncounterId(encounter.id);
    pushToTodayQueue({ id: pid, full_name: patientName });
    const now = new Date().toISOString();
    setEncounterStartedAt(now);
    setStep('encounter-open');
  }

  // ── Encounter gate: continue last open encounter ─────────────────────────
  async function handleContinueEncounter() {
    if (!patientId) return;
    const { encounterId: existingId } = await getLatestOpenEncounter(patientId);
    if (existingId) {
      setEncounterId(existingId);
      const now = new Date().toISOString();
      setEncounterStartedAt(now);
      setStep('encounter-open');
    } else {
      // No open encounter — start a new one
      await handleStartEncounter();
    }
  }

  // ── Reset to search ───────────────────────────────────────────────────────
  function handleReset() {
    clearPatient();
    setPatientPhoto('');
    setOccupation('');
    setNokName(''); setNokRelation(''); setNokTel('');
    setSaveError(null);
    setEncounterError(null);
    setEncounterStartedAt(null);
    setInviteResult(null);
    setSearchQuery('');
    setSearchResults([]);
    setStep('search');
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const patientAge = age || calcAge(dob);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="app-header" style={{ gridColumn: 'unset' }}>
        <span className="header-brand">Amise Medical Services</span>

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

        {/* Active patient pill in header (visible when patient loaded) */}
        {patientId && step !== 'search' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 10px 4px 6px', borderRadius: 20,
            background: step === 'encounter-open' ? '#0f172a' : '#f0fdfa',
            border: `1.5px solid ${step === 'encounter-open' ? '#0d9488' : '#a7f3d0'}`,
          }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: step === 'encounter-open' ? '#0d9488' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              {step === 'encounter-open' ? '▶' : '👤'}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: step === 'encounter-open' ? '#5eead4' : '#065f46', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {patientName || 'Patient'}
            </span>
            {step === 'encounter-open' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#0d9488', letterSpacing: '0.04em' }}>ENCOUNTER OPEN</span>
            )}
          </div>
        )}

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
          >⏻</button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0, padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 0, maxWidth: 960, margin: '0 auto' }}>
          {([
            { id: 'checkin',       label: 'Check-In' },
            { id: 'registry',     label: 'Patient Registry' },
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
                transition: 'color 0.15s', whiteSpace: 'nowrap',
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

      {/* ── Tab: Booking Inbox ── */}
      {activeTab === 'inbox' && (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <BookingInboxTab />
        </main>
      )}

      {/* ── Tab: Questionnaire ── */}
      {activeTab === 'questionnaire' && (
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px' }}>
          <QuestionnaireManagerTab />
        </main>
      )}

      {/* ── Tab: Patient Registry ── */}
      {activeTab === 'registry' && (
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 32px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Patient Registry</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>All registered patients · click a row to load into check-in</div>
              </div>
              <button
                type="button"
                onClick={() => { setActiveTab('checkin'); handleReset(); setStep('new-form'); }}
                style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                + Register New Patient
              </button>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9ca3af' }}>🔍</span>
              <input
                type="search"
                value={registryQuery}
                onChange={e => setRegistryQuery(e.target.value)}
                placeholder="Search by name or phone…"
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {/* Patient table */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 2fr 2fr auto', gap: 0, padding: '8px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'Sex', 'Age', 'Phone', 'Registered', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 4px' }}>{h}</div>
                ))}
              </div>

              {registryLoading && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              )}

              {!registryLoading && registryRows.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  {registryQuery ? 'No patients match that search.' : 'No patients registered yet.'}
                </div>
              )}

              {!registryLoading && registryRows.map((p, idx) => {
                const a = calcAge(p.date_of_birth);
                const regDate = p.created_at
                  ? new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—';
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 2fr 2fr auto',
                      gap: 0, padding: '10px 16px', alignItems: 'center',
                      borderBottom: idx < registryRows.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: '#fff',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.full_name ?? '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', padding: '0 4px' }}>
                      {p.sex && p.sex !== 'unknown' ? p.sex.charAt(0).toUpperCase() : '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', padding: '0 4px' }}>
                      {a ? `${a} y` : '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', padding: '0 4px' }}>{p.phone ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', padding: '0 4px' }}>{regDate}</div>
                    <button
                      type="button"
                      onClick={() => { loadPatientFromRow(p); setActiveTab('checkin'); }}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Load →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* ── Tab: Check-In ── */}
      {activeTab === 'checkin' && (
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ════════════════════════════════════════════════════════════
                STEP: search
            ════════════════════════════════════════════════════════════ */}
            {step === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Heading */}
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Patient Check-In</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Search for a returning patient, or register a new one.</div>

                {/* Search bar */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: '#9ca3af' }}>🔍</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name or phone number…"
                    autoFocus
                    style={{ width: '100%', padding: '13px 14px 13px 44px', borderRadius: 10, border: '2px solid #0d9488', fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
                  />
                  {searchLoading && (
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>Searching…</span>
                  )}
                </div>

                {/* Search results */}
                {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                  <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
                    No existing patient found for <strong>"{searchQuery}"</strong>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 2 }}>
                      {searchResults.length} patient{searchResults.length !== 1 ? 's' : ''} found
                    </div>
                    {searchResults.map(p => (
                      <PatientChip key={p.id} p={p} onSelect={() => loadPatientFromRow(p)} />
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>

                {/* New patient button */}
                <button
                  type="button"
                  onClick={() => setStep('new-form')}
                  style={{
                    padding: '14px 24px', borderRadius: 10,
                    border: '2px dashed #0d9488', background: '#f0fdfa',
                    color: '#0d9488', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  + Register New Patient
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP: new-form
            ════════════════════════════════════════════════════════════ */}
            {step === 'new-form' && (
              <>
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => { handleReset(); setStep('search'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '2px 0', fontWeight: 600 }}
                >
                  ← Back to search
                </button>

                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>New Patient Registration</div>

                <div style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                  padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {/* Photo capture */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ flexShrink: 0 }}>
                      {patientPhoto ? (
                        <img src={patientPhoto} alt="Patient" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #0d9488', display: 'block' }} />
                      ) : (
                        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <span style={{ fontSize: 24, lineHeight: 1 }}>👤</span>
                          <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>PHOTO</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                        Patient photo <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => cameraInputRef.current?.click()}
                          style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', cursor: 'pointer' }}>
                          📷 Camera
                        </button>
                        <button type="button" onClick={() => galleryInputRef.current?.click()}
                          style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1.5px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>
                          🖼 Gallery / File
                        </button>
                        {patientPhoto && (
                          <button type="button" onClick={() => setPatientPhoto('')}
                            style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                            ✕ Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) void resizeImageToBase64(f).then(b64 => { if (b64) setPatientPhoto(b64); }); e.target.value = ''; }} />
                    <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) void resizeImageToBase64(f).then(b64 => { if (b64) setPatientPhoto(b64); }); e.target.value = ''; }} />
                  </div>

                  {/* Full name */}
                  <div className="fld">
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Full name</label>
                    <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Marie Joseph" autoFocus style={{ fontSize: 16, padding: '11px 12px', borderRadius: 8 }} />
                  </div>

                  {/* DOB · Age · Sex · Phone */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5fr 0.5fr 1fr', gap: 8 }}>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Date of birth</label>
                      <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Age</label>
                      <input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="57" style={{ padding: '8px', fontSize: 13, textAlign: 'center' }} />
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
                      <label style={{ fontSize: 10 }}>Mobile phone</label>
                      <input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (758) XXX-XXXX" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Email · Occupation */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Email <span style={{ color: '#9ca3af' }}>(patient portal)</span></label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@example.com" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Occupation</label>
                      <input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="e.g. Teacher, Nurse, Farmer…" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Address */}
                  <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>ADDRESS</div>
                    <div className="fld" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Street / house number</label>
                      <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 14 Choc Bay Lane" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Community / Village</label>
                        <input type="text" list="sl-communities" value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="e.g. Rodney Bay" style={{ padding: '8px', fontSize: 13 }} />
                        <datalist id="sl-communities">
                          {SL_COMMUNITIES.map(c => <option key={`${c.quarter}-${c.community}`} value={c.community}>{c.quarter}</option>)}
                        </datalist>
                      </div>
                      <div className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>District / Quarter</label>
                        <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                          <option value="">— Select district —</option>
                          {Array.from(new Set(SL_COMMUNITIES.map(c => c.quarter))).map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Next of kin */}
                  <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', letterSpacing: '0.06em' }}>NEXT OF KIN</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.7fr 1fr', gap: 8 }}>
                      <div className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Full name</label>
                        <input type="text" value={nokName} onChange={e => setNokName(e.target.value)} placeholder="e.g. Jean Joseph" style={{ padding: '8px', fontSize: 13 }} />
                      </div>
                      <div className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Relationship</label>
                        <select value={nokRelation} onChange={e => setNokRelation(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                          <option value="">— Select —</option>
                          {NOK_RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Contact phone</label>
                        <input inputMode="tel" type="tel" value={nokTel} onChange={e => setNokTel(e.target.value)} placeholder="+1 (758) XXX-XXXX" style={{ padding: '8px', fontSize: 13 }} />
                      </div>
                    </div>
                  </div>

                  {/* Referred by · Insurance */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Referred by</label>
                      <input type="text" list="referring-doctors" value={referredBy} onChange={e => setReferredBy(e.target.value)} placeholder="Doctor or facility…" style={{ padding: '8px', fontSize: 13 }} />
                      <datalist id="referring-doctors">
                        {referringProviders.map(name => <option key={name} value={name} />)}
                      </datalist>
                    </div>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Insurance provider</label>
                      <input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="SAGICOR, CLICO, CIBC…" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                  </div>

                  {/* Policy · NHI · Pre-auth */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Policy / Member #</label>
                      <input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Member ID" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>NHI #</label>
                      <input type="text" value={nhiNumber} onChange={e => setNhiNumber(e.target.value)} placeholder="NHI number" style={{ padding: '8px', fontSize: 13 }} />
                    </div>
                    <div className="fld">
                      <label style={{ fontSize: 10 }}>Pre-authorisation</label>
                      <select value={preAuthStatus} onChange={e => setPreAuthStatus(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                        <option value="">N/A</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Save error */}
                {saveError && (
                  <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                    Save failed: {saveError} — record saved locally only.
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => void handleCheckIn()}
                    disabled={!patientName.trim() || saving}
                    style={{
                      flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none',
                      background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af',
                      color: '#fff', fontWeight: 800, fontSize: 16, minHeight: 48,
                      cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {saving ? 'Saving…' : 'Register Patient →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleReset(); }}
                    style={{ padding: '14px 20px', borderRadius: 10, border: '1.5px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, minHeight: 48, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP: patient-ready — the encounter gate
            ════════════════════════════════════════════════════════════ */}
            {step === 'patient-ready' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Patient identity card */}
                <div style={{
                  background: '#fff', borderRadius: 14, border: '2px solid #0d9488',
                  padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 18,
                }}>
                  {/* Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    {patientPhoto ? (
                      <img src={patientPhoto} alt={patientName} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #0d9488' }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>👤</div>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>
                      Patient Identified
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {patientName || '—'}
                    </div>
                    <div style={{ fontSize: 13, color: '#374151', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
                      {sex !== 'unknown' && <span style={{ textTransform: 'capitalize' }}>{sex}</span>}
                      {patientAge && <span>{patientAge} y</span>}
                      {dob && <span>b. {fmtDob(dob)}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '0 12px' }}>
                      {phone && <span>📱 {phone}</span>}
                      {email && <span>✉ {email}</span>}
                      {quarter && <span>📍 {quarter}</span>}
                    </div>
                  </div>
                </div>

                {/* ─── ENCOUNTER GATE ─────────────────────────────────── */}
                <div style={{
                  background: '#0f172a', borderRadius: 12, border: '2px solid #0d9488',
                  padding: '20px 22px',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    ▶ Encounter Gate — Choose an action
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                    Select how to proceed. This marks the start of the clinical session for {patientName || 'this patient'}.
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => void handleStartEncounter()}
                      style={{
                        flex: '1 1 200px', padding: '16px 20px', borderRadius: 10,
                        border: 'none', background: '#0d9488', color: '#fff',
                        fontWeight: 800, fontSize: 15, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>▶</span>
                      <span>Start New Encounter</span>
                      <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Opens a fresh clinical session</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleContinueEncounter()}
                      style={{
                        flex: '1 1 200px', padding: '16px 20px', borderRadius: 10,
                        border: '2px solid #334155', background: 'transparent', color: '#e2e8f0',
                        fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>↩</span>
                      <span>Continue Last Encounter</span>
                      <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>Resumes most recent open session</span>
                    </button>
                  </div>

                  {encounterError && (
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: '#450a0a', color: '#fca5a5', fontSize: 12 }}>
                      Could not create encounter: {encounterError}
                    </div>
                  )}
                </div>

                {/* Different patient */}
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', padding: '4px 0', fontWeight: 500, alignSelf: 'flex-start' }}
                >
                  ← Different patient
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP: encounter-open — the divider
            ════════════════════════════════════════════════════════════ */}
            {step === 'encounter-open' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Encounter opened banner */}
                <div style={{
                  background: '#0f172a', borderRadius: 12, border: '2px solid #0d9488',
                  padding: '18px 22px', position: 'relative', overflow: 'hidden',
                }}>
                  {/* Decorative bar */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: '#0d9488' }} />
                  <div style={{ paddingLeft: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                      ▶ Encounter Opened
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                      {patientName || 'Patient'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 14px', fontSize: 12, color: '#94a3b8' }}>
                      {sex !== 'unknown' && <span style={{ textTransform: 'capitalize' }}>{sex}</span>}
                      {patientAge && <span>{patientAge} y</span>}
                      {phone && <span>{phone}</span>}
                      {quarter && <span>{quarter}</span>}
                    </div>
                    {encounterStartedAt && (
                      <div style={{ fontSize: 11, color: '#5eead4', marginTop: 8, fontWeight: 700 }}>
                        {fmtDateTime(encounterStartedAt)}
                      </div>
                    )}
                    {encounterId && (
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 2, fontFamily: 'monospace' }}>
                        enc: {encounterId.startsWith('local') ? 'offline' : encounterId.slice(0, 8) + '…'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Horizontal divider — the "clear point" */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #0d9488, #0d948800)' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Clinical session active
                  </span>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(270deg, #0d9488, #0d948800)' }} />
                </div>

                {/* Quick action buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('questionnaire')}
                    style={{
                      flex: '1 1 180px', padding: '13px 20px', borderRadius: 10,
                      border: 'none', background: '#0d9488', color: '#fff',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    📋 <span>Start Questionnaire</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleInvitePortal(); }}
                    disabled={!email.trim() || inviting}
                    style={{
                      flex: '1 1 180px', padding: '13px 20px', borderRadius: 10,
                      border: '1.5px solid #d1d5db', background: '#fff', color: '#374151',
                      fontWeight: 600, fontSize: 14,
                      cursor: email.trim() && !inviting ? 'pointer' : 'not-allowed',
                      opacity: email.trim() ? 1 : 0.5,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    📧 <span>{inviting ? 'Sending…' : 'Invite to Portal'}</span>
                  </button>
                </div>

                {inviteResult === 'sent' && (
                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Portal invite sent to {email}</div>
                )}
                {inviteResult === 'error' && (
                  <div style={{ fontSize: 13, color: '#dc2626' }}>Invite failed — check API server or try again.</div>
                )}

                {/* New patient button */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      padding: '12px 24px', borderRadius: 10,
                      border: '1.5px solid #0d9488', background: 'transparent',
                      color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    + Check In Next Patient
                  </button>
                </div>
              </div>
            )}

          </div>
        </main>
      )}
    </div>
  );
}
