/**
 * Check-In tab — embedded in the main EMR for front_desk and admin roles.
 * Contains the four-step patient check-in flow (search → register → encounter
 * gate → encounter open) without ReceptionistView's full-page shell.
 */
import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import {
  searchPatients, savePatientFull, uploadPatientPhoto,
  createEncounter, getLatestOpenEncounter,
  type PatientListRow,
} from '@/lib/db';
import type { Sex } from '@workspace/triage-engine';
import { SL_COMMUNITIES } from '@/data/st-lucia';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const QUEUE_KEY = 'amise-patients-v1';
function pushToQueue(entry: { id: string; full_name: string; age?: string; sex?: string; dob?: string; phone?: string }) {
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
  const b = new Date(dob);
  const n = new Date();
  const y = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  return String(m < 0 || (m === 0 && n.getDate() < b.getDate()) ? y - 1 : y);
}

function fmtDob(dob: string | null): string {
  if (!dob) return '';
  return new Date(dob).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

type Step = 'search' | 'new-form' | 'patient-ready' | 'encounter-open';

const NOK_RELATIONS = ['Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Grandparent', 'Aunt/Uncle', 'Friend', 'Guardian', 'Carer', 'Other'];

function PatientChip({ p, onSelect }: { p: PatientListRow; onSelect: () => void }) {
  const a = calcAge(p.date_of_birth);
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
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>👤</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name ?? '—'}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {[p.sex && p.sex !== 'unknown' ? p.sex.charAt(0).toUpperCase() : null, a ? `${a} y` : null, p.phone].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', flexShrink: 0 }}>Select →</span>
    </button>
  );
}

export default function CheckInTab() {
  const {
    patientName, setPatientName, age, setAge, sex, setSex,
    dob, setDob, phone, setPhone, email, setEmail,
    address, setAddress, quarter, setQuarter,
    referredBy, setReferredBy,
    insuranceProvider, setInsuranceProvider,
    policyNumber, setPolicyNumber, nhiNumber, setNhiNumber,
    preAuthStatus, setPreAuthStatus,
    occupation, setOccupation,
    nokName, setNokName, nokRelation, setNokRelation, nokTel, setNokTel,
    clearPatient, currentSite,
    patientId, setPatientId,
    encounterId, setEncounterId,
    patientPhoto, setPatientPhoto,
    setPreVisitStatus,
  } = useAppContext();

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientListRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [encounterStartedAt, setEncounterStartedAt] = useState<string | null>(null);
  const [encounterError, setEncounterError] = useState<string | null>(null);
  const [referringProviders, setReferringProviders] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<'sent' | 'error' | null>(null);

  // Load referring providers
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl('/api/admin/referring-providers'), { headers: await staffAuthHeaders() });
        if (r.ok) {
          const d = await r.json() as { providers: { name: string; provider_type: string; active: boolean }[] };
          setReferringProviders(
            (d.providers ?? []).filter(p => p.provider_type === 'referring_doctor' && p.active).map(p => p.name).sort()
          );
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const res = await searchPatients(searchQuery);
      setSearchResults(res);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function loadPatient(p: PatientListRow) {
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

  function handleReset() {
    clearPatient();
    setPatientPhoto('');
    setOccupation(''); setNokName(''); setNokRelation(''); setNokTel('');
    setSaveError(null); setEncounterError(null); setEncounterStartedAt(null);
    setInviteResult(null); setSearchQuery(''); setSearchResults([]);
    setStep('search');
  }

  async function handleCheckIn() {
    setSaving(true); setSaveError(null);
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
        pushToQueue({ id: localId, full_name: patientName, age, sex: sex !== 'unknown' ? sex : undefined, dob: dob || undefined, phone: phone || undefined });
        setPreVisitStatus('registered');
        setStep('patient-ready');
        return;
      }
      setSaveError(error); return;
    }
    if (patient) {
      setPatientId(patient.id);
      pushToQueue({ id: patient.id, full_name: patientName, age, sex: sex !== 'unknown' ? sex : undefined, dob: dob || undefined, phone: phone || undefined });
      if (patientPhoto?.startsWith('data:')) {
        void uploadPatientPhoto(patient.id, patientPhoto).then(url => { if (url) setPatientPhoto(url); });
      }
    }
    setPreVisitStatus('registered');
    setStep('patient-ready');
  }

  async function handleStartEncounter() {
    if (!patientId) return;
    setEncounterError(null);
    setEncounterId(null);
    const { encounter, error } = await createEncounter({ patient_id: patientId, site: currentSite });
    if (error) {
      if (error.includes('not configured')) {
        setEncounterId(`local-enc-${Date.now()}`);
        setEncounterStartedAt(new Date().toISOString());
        setStep('encounter-open');
        return;
      }
      setEncounterError(error); return;
    }
    if (encounter) setEncounterId(encounter.id);
    pushToQueue({ id: patientId, full_name: patientName });
    setEncounterStartedAt(new Date().toISOString());
    setStep('encounter-open');
  }

  async function handleContinueEncounter() {
    if (!patientId) return;
    const { encounterId: existingId } = await getLatestOpenEncounter(patientId);
    if (existingId) {
      setEncounterId(existingId);
      setEncounterStartedAt(new Date().toISOString());
      setStep('encounter-open');
    } else {
      await handleStartEncounter();
    }
  }

  async function handleInvite() {
    if (!patientId || !email.trim()) return;
    setInviting(true); setInviteResult(null);
    try {
      const r = await fetch(apiUrl('/api/patient/invite'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patient_id: patientId, email: email.trim() }),
      });
      setInviteResult(r.ok ? 'sent' : 'error');
    } catch { setInviteResult('error'); } finally { setInviting(false); }
  }

  const patientAge = age || calcAge(dob);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── STEP: search ── */}
      {step === 'search' && (
        <>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Patient Check-In</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Search a returning patient, or register a new one.</div>
          </div>

          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>🔍</span>
            <input
              type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone number…" autoFocus
              style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: 10, border: '2px solid #0d9488', fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
            />
            {searchLoading && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af' }}>Searching…</span>
            )}
          </div>

          {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e', fontSize: 13 }}>
              No patient found for <strong>"{searchQuery}"</strong>
            </div>
          )}

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {searchResults.length} patient{searchResults.length !== 1 ? 's' : ''} found
              </div>
              {searchResults.map(p => <PatientChip key={p.id} p={p} onSelect={() => loadPatient(p)} />)}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          </div>

          <button type="button" onClick={() => setStep('new-form')}
            style={{ padding: '14px 24px', borderRadius: 10, border: '2px dashed #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700, fontSize: 15, cursor: 'pointer', textAlign: 'center' }}>
            + Register New Patient
          </button>
        </>
      )}

      {/* ── STEP: new-form ── */}
      {step === 'new-form' && (
        <>
          <button type="button" onClick={handleReset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '2px 0', fontWeight: 600, alignSelf: 'flex-start' }}>
            ← Back to search
          </button>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>New Patient Registration</div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Photo strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ flexShrink: 0 }}>
                {patientPhoto
                  ? <img src={patientPhoto} alt="Patient" style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #0d9488' }} />
                  : <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👤</div>
                }
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => cameraRef.current?.click()}
                  style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', cursor: 'pointer' }}>📷 Camera</button>
                <button type="button" onClick={() => galleryRef.current?.click()}
                  style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 6, border: '1.5px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>🖼 Gallery</button>
                {patientPhoto && (
                  <button type="button" onClick={() => setPatientPhoto('')}
                    style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>✕</button>
                )}
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void resizeImageToBase64(f).then(b64 => { if (b64) setPatientPhoto(b64); }); e.target.value = ''; }} />
                <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) void resizeImageToBase64(f).then(b64 => { if (b64) setPatientPhoto(b64); }); e.target.value = ''; }} />
              </div>
            </div>

            {/* Name */}
            <div className="fld">
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Full name</label>
              <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Marie Joseph" autoFocus style={{ fontSize: 16, padding: '11px 12px', borderRadius: 8 }} />
            </div>

            {/* DOB · Age · Sex · Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.5fr 0.5fr 1fr', gap: 8 }}>
              <div className="fld"><label style={{ fontSize: 10 }}>Date of birth</label><input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>Age</label><input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="57" style={{ padding: '8px', fontSize: 13, textAlign: 'center' }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>Sex</label>
                <select value={sex} onChange={e => setSex(e.target.value as Sex)} style={{ padding: '8px 6px', fontSize: 13 }}>
                  <option value="unknown">—</option><option value="male">M</option><option value="female">F</option><option value="other">Other</option>
                </select>
              </div>
              <div className="fld"><label style={{ fontSize: 10 }}>Mobile phone</label><input inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (758) XXX-XXXX" style={{ padding: '8px', fontSize: 13 }} /></div>
            </div>

            {/* Email · Occupation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="fld"><label style={{ fontSize: 10 }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@example.com" style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>Occupation</label><input type="text" value={occupation} onChange={e => setOccupation(e.target.value)} placeholder="e.g. Teacher, Nurse…" style={{ padding: '8px', fontSize: 13 }} /></div>
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
                  <input type="text" list="sl-comm-ci" value={quarter} onChange={e => setQuarter(e.target.value)} placeholder="e.g. Rodney Bay" style={{ padding: '8px', fontSize: 13 }} />
                  <datalist id="sl-comm-ci">{SL_COMMUNITIES.map(c => <option key={`${c.quarter}-${c.community}`} value={c.community}>{c.quarter}</option>)}</datalist>
                </div>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10 }}>District / Quarter</label>
                  <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                    <option value="">— Select —</option>
                    {Array.from(new Set(SL_COMMUNITIES.map(c => c.quarter))).map(q => <option key={q} value={q}>{q}</option>)}
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
                <input type="text" list="ref-docs-ci" value={referredBy} onChange={e => setReferredBy(e.target.value)} placeholder="Doctor or facility…" style={{ padding: '8px', fontSize: 13 }} />
                <datalist id="ref-docs-ci">{referringProviders.map(n => <option key={n} value={n} />)}</datalist>
              </div>
              <div className="fld"><label style={{ fontSize: 10 }}>Insurance provider</label><input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="SAGICOR, CLICO…" style={{ padding: '8px', fontSize: 13 }} /></div>
            </div>

            {/* Policy · NHI · Pre-auth */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="fld"><label style={{ fontSize: 10 }}>Policy / Member #</label><input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Member ID" style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>NHI #</label><input type="text" value={nhiNumber} onChange={e => setNhiNumber(e.target.value)} placeholder="NHI number" style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>Pre-auth</label>
                <select value={preAuthStatus} onChange={e => setPreAuthStatus(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                  <option value="">N/A</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option>
                </select>
              </div>
            </div>
          </div>

          {saveError && (
            <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              Save failed: {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => void handleCheckIn()} disabled={!patientName.trim() || saving}
              style={{ flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none', background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af', color: '#fff', fontWeight: 800, fontSize: 16, minHeight: 48, cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Saving…' : 'Register Patient →'}
            </button>
            <button type="button" onClick={handleReset}
              style={{ padding: '14px 20px', borderRadius: 10, border: '1.5px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </>
      )}

      {/* ── STEP: patient-ready (encounter gate) ── */}
      {step === 'patient-ready' && (
        <>
          {/* Identity card */}
          <div style={{ background: '#fff', borderRadius: 14, border: '2px solid #0d9488', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flexShrink: 0 }}>
              {patientPhoto
                ? <img src={patientPhoto} alt={patientName} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid #0d9488' }} />
                : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>👤</div>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Patient Identified</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patientName || '—'}</div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
                {sex !== 'unknown' && <span style={{ textTransform: 'capitalize' }}>{sex}</span>}
                {patientAge && <span>{patientAge} y</span>}
                {dob && <span>b. {fmtDob(dob)}</span>}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
                {phone && <span>📱 {phone}</span>}
                {quarter && <span>📍 {quarter}</span>}
              </div>
            </div>
          </div>

          {/* Encounter gate */}
          <div style={{ background: '#0f172a', borderRadius: 12, border: '2px solid #0d9488', padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>▶ Encounter Gate</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
              Choose how to proceed for <strong style={{ color: '#e2e8f0' }}>{patientName || 'this patient'}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void handleStartEncounter()}
                style={{ flex: '1 1 180px', padding: '14px 18px', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                <span style={{ fontSize: 17 }}>▶</span>
                <span>Start New Encounter</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Opens a fresh clinical session</span>
              </button>
              <button type="button" onClick={() => void handleContinueEncounter()}
                style={{ flex: '1 1 180px', padding: '14px 18px', borderRadius: 10, border: '2px solid #334155', background: 'transparent', color: '#e2e8f0', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                <span style={{ fontSize: 17 }}>↩</span>
                <span>Continue Last Encounter</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>Resumes most recent open session</span>
              </button>
            </div>
            {encounterError && (
              <div style={{ marginTop: 10, padding: '7px 12px', borderRadius: 6, background: '#450a0a', color: '#fca5a5', fontSize: 12 }}>
                {encounterError}
              </div>
            )}
          </div>

          <button type="button" onClick={handleReset}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', padding: '2px 0', alignSelf: 'flex-start' }}>
            ← Different patient
          </button>
        </>
      )}

      {/* ── STEP: encounter-open ── */}
      {step === 'encounter-open' && (
        <>
          {/* Encounter banner */}
          <div style={{ background: '#0f172a', borderRadius: 12, border: '2px solid #0d9488', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: '#0d9488' }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>▶ Encounter Opened</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>{patientName || 'Patient'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                {sex !== 'unknown' && <span style={{ textTransform: 'capitalize' }}>{sex}</span>}
                {patientAge && <span>{patientAge} y</span>}
                {phone && <span>{phone}</span>}
                {quarter && <span>{quarter}</span>}
              </div>
              {encounterStartedAt && (
                <div style={{ fontSize: 11, color: '#5eead4', marginTop: 8, fontWeight: 700 }}>{fmtDateTime(encounterStartedAt)}</div>
              )}
              {encounterId && (
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2, fontFamily: 'monospace' }}>
                  enc: {encounterId.startsWith('local') ? 'offline' : encounterId.slice(0, 8) + '…'}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #0d9488, transparent)' }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Clinical session active</span>
            <div style={{ flex: 1, height: 2, background: 'linear-gradient(270deg, #0d9488, transparent)' }} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void handleInvite()} disabled={!email.trim() || inviting}
              style={{ flex: '1 1 160px', padding: '12px 18px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14, cursor: email.trim() ? 'pointer' : 'not-allowed', opacity: email.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 7 }}>
              📧 <span>{inviting ? 'Sending…' : 'Invite to Portal'}</span>
            </button>
          </div>
          {inviteResult === 'sent' && <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>✓ Invite sent to {email}</div>}
          {inviteResult === 'error' && <div style={{ fontSize: 13, color: '#dc2626' }}>Invite failed — check API or try again.</div>}

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
            <button type="button" onClick={handleReset}
              style={{ padding: '12px 24px', borderRadius: 10, border: '1.5px solid #0d9488', background: 'transparent', color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              + Check In Next Patient
            </button>
          </div>
        </>
      )}
    </div>
  );
}
