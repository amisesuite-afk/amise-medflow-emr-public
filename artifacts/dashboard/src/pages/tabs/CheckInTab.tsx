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
import PreVisitSummary from '@/components/PreVisitSummary';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const QUEUE_KEY = 'amise-patients-v1';

export { VISIT_TYPES, type VisitTypeId } from '@/lib/visit-types';
import { VISIT_TYPES } from '@/lib/visit-types';
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

// ── Intake clinical constants ──────────────────────────────────────────────────
const INTAKE_SYMPTOMS = [
  'Abdominal pain', 'Hernia / abdominal wall', 'Breast lump',
  'Rectal bleeding', 'Change in bowel habit', 'Dysphagia',
  'Reflux / heartburn', 'Jaundice', 'Unintentional weight loss',
  'Wound review', 'Skin lesion / lump', 'Thyroid / neck lump',
  'Haematuria', 'Nausea / vomiting', 'Anorectal symptoms',
  'Post-operative review', 'Pre-operative visit', 'Incidental finding',
];

const INTAKE_VITALS = [
  { key: 'systolicBp'      as const, label: 'SBP',   unit: 'mmHg',   placeholder: '120', danger: (v: number) => v > 160 || v < 90  },
  { key: 'diastolicBp'     as const, label: 'DBP',   unit: 'mmHg',   placeholder: '80',  danger: (v: number) => v > 100 || v < 60  },
  { key: 'heartRate'       as const, label: 'Pulse', unit: 'bpm',    placeholder: '72',  danger: (v: number) => v > 120 || v < 50   },
  { key: 'temperatureC'    as const, label: 'Temp',  unit: '°C',     placeholder: '37',  danger: (v: number) => v >= 38.5 || v < 36 },
  { key: 'respiratoryRate' as const, label: 'RR',    unit: '/min',   placeholder: '16',  danger: (v: number) => v > 24 || v < 10   },
  { key: 'spo2'            as const, label: 'SpO₂',  unit: '%',      placeholder: '98',  danger: (v: number) => v < 94              },
  { key: 'glucoseMmol'     as const, label: 'RBS',   unit: 'mmol/L', placeholder: '5.5', danger: (v: number) => v < 3.5 || v > 20  },
];

const INTAKE_COMORBIDITIES = [
  'Type 2 diabetes', 'Type 1 diabetes', 'Hypertension',
  'Ischaemic heart disease', 'Heart failure', 'Atrial fibrillation',
  'Chronic kidney disease', 'Dialysis', 'COPD / asthma',
  'Active cancer', 'DVT / PE history', 'Liver cirrhosis',
  'Immunosuppressed', 'Steroid use', 'Sickle cell disease', 'Pregnancy',
];

const INTAKE_HABITS = ['Smoking', 'Ex-smoker', 'Alcohol use', 'Recreational drugs'];

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
    setTopSection,
    visitType, setVisitType,
    postOpDate, setPostOpDate,
    postOpReviewNum, setPostOpReviewNum,
    setIsPostOp, setPostOpDays,
    setEncounterType,
    freeText, setFreeText, durationDays, setDurationDays, painScore, setPainScore,
    symptoms, toggleSymptom, vitals, updateVital,
    allergies, setAllergies, comorbidities, toggleComorbidity,
    medicationsText, setMedicationsText, surgicalNotes, setSurgicalNotes,
    toxicHabits, toggleToxicHabit,
  } = useAppContext();

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientListRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [encounterStartedAt, setEncounterStartedAt] = useState<string | null>(null);
  const [encounterError, setEncounterError] = useState<string | null>(null);
  const [referringProviders, setReferringProviders] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<'sent' | 'error' | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<PatientListRow[] | null>(null);
  const [bypassDuplicate, setBypassDuplicate] = useState(false);
  const [openSec, setOpenSec] = useState({ cc: true, vitals: true, medical: false, social: false });
  // Visit-type is a required precondition to start the consultation — front desk is the
  // primary enforcement point (physician view has its own fail-safe gate if this is skipped).
  const [visitTypeMissing, setVisitTypeMissing] = useState(false);
  const visitTypeRef = useRef<HTMLSelectElement | null>(null);

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
    setDuplicateCandidates(null); setBypassDuplicate(false);
    setStep('search');
  }

  function normName(n: string) { return n.toLowerCase().trim().replace(/\s+/g, ' '); }
  function digitsOnly(s: string) { return s.replace(/\D/g, ''); }
  function isDuplicateCandidate(p: PatientListRow): boolean {
    const sameName = normName(p.full_name ?? '') === normName(patientName);
    const ph = phone.trim() ? digitsOnly(phone) : '';
    const pph = p.phone ? digitsOnly(p.phone) : '';
    const samePhone = ph.length >= 7 && pph.length >= 7 && ph === pph;
    return sameName || samePhone;
  }

  async function handleCheckIn(bypass = false) {
    setSaving(true); setSaveError(null);

    try {
    // Pre-save duplicate check (skip if user already confirmed bypass)
    if (!bypass && !bypassDuplicate && patientName.trim()) {
      const candidates = await searchPatients(patientName.trim());
      const matches = candidates.filter(isDuplicateCandidate);
      if (matches.length > 0) {
        setDuplicateCandidates(matches);
        return;
      }
    }

    const { patient, error } = await savePatientFull({
      full_name: patientName, age, dob, sex, phone, email,
      address, quarter, referredBy, insuranceProvider,
      policyNumber, nhiNumber, preAuthStatus,
      occupation, nokName, nokRelation, nokTel,
    });
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
    setBypassDuplicate(false);
    setPreVisitStatus('registered');
    setStep('patient-ready');
    } finally {
      setSaving(false);
    }
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

            {/* Expand / collapse secondary fields */}
            <button
              type="button"
              onClick={() => setDetailsOpen(o => !o)}
              style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}
            >
              {detailsOpen ? '▲ Less details' : '▼ Add address, NOK & insurance'}
            </button>

            {/* Address */}
            {detailsOpen && <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            </div>}

            {/* Next of kin */}
            {detailsOpen && <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            </div>}

            {/* Referred by · Insurance */}
            {detailsOpen && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="fld">
                <label style={{ fontSize: 10 }}>Referred by</label>
                <input type="text" list="ref-docs-ci" value={referredBy} onChange={e => setReferredBy(e.target.value)} placeholder="Doctor or facility…" style={{ padding: '8px', fontSize: 13 }} />
                <datalist id="ref-docs-ci">{referringProviders.map(n => <option key={n} value={n} />)}</datalist>
              </div>
              <div className="fld"><label style={{ fontSize: 10 }}>Insurance provider</label><input type="text" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="SAGICOR, CLICO…" style={{ padding: '8px', fontSize: 13 }} /></div>
            </div>}

            {/* Policy · NHI · Pre-auth */}
            {detailsOpen && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div className="fld"><label style={{ fontSize: 10 }}>Policy / Member #</label><input type="text" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Member ID" style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>NHI #</label><input type="text" value={nhiNumber} onChange={e => setNhiNumber(e.target.value)} placeholder="NHI number" style={{ padding: '8px', fontSize: 13 }} /></div>
              <div className="fld"><label style={{ fontSize: 10 }}>Pre-auth</label>
                <select value={preAuthStatus} onChange={e => setPreAuthStatus(e.target.value)} style={{ padding: '8px 6px', fontSize: 13 }}>
                  <option value="">N/A</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="declined">Declined</option>
                </select>
              </div>
            </div>}
          </div>

          {saveError && (
            <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              Save failed: {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => void handleCheckIn()} disabled={!patientName.trim() || saving}
              style={{ flex: 1, padding: '14px 24px', borderRadius: 10, border: 'none', background: patientName.trim() && !saving ? 'var(--accent)' : '#9ca3af', color: '#fff', fontWeight: 800, fontSize: 16, minHeight: 48, cursor: patientName.trim() && !saving ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Checking…' : 'Register Patient →'}
            </button>
            <button type="button" onClick={handleReset}
              style={{ padding: '14px 20px', borderRadius: 10, border: '1.5px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>

          {/* ── Duplicate-patient warning modal ── */}
          {duplicateCandidates && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.55)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 16,
            }}>
              <div style={{
                background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{ background: '#7f1d1d', padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Possible Duplicate Patient</div>
                    <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>
                      {duplicateCandidates.length} existing record{duplicateCandidates.length !== 1 ? 's' : ''} match
                      {duplicateCandidates.length !== 1 ? '' : 'es'} the name or phone you entered.
                      Select the existing patient, or confirm this is a different person.
                    </div>
                  </div>
                </div>

                {/* Existing matches */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {duplicateCandidates.map(p => {
                    const a = calcAge(p.date_of_birth);
                    return (
                      <button key={p.id} type="button"
                        onClick={() => { setDuplicateCandidates(null); loadPatient(p); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 10,
                          border: '2px solid #0d9488', background: '#f0fdfa',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                        }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.full_name ?? '—'}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {[p.sex && p.sex !== 'unknown' ? p.sex : null, a ? `${a} y` : null, p.date_of_birth ? `b. ${fmtDob(p.date_of_birth)}` : null, p.phone].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', flexShrink: 0 }}>Use This →</span>
                      </button>
                    );
                  })}
                </div>

                {/* Footer actions */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button"
                    onClick={() => {
                      setDuplicateCandidates(null);
                      setBypassDuplicate(true);
                      void handleCheckIn(true);
                    }}
                    style={{ flex: '1 1 180px', padding: '11px 16px', borderRadius: 9, border: '2px solid #dc2626', background: '#fff', color: '#dc2626', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    Register as New (Different Person)
                  </button>
                  <button type="button"
                    onClick={() => setDuplicateCandidates(null)}
                    style={{ padding: '11px 16px', borderRadius: 9, border: '1.5px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Back to Form
                  </button>
                </div>
              </div>
            </div>
          )}
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

          {/* Pre-visit clinical data */}
          {patientId && <PreVisitSummary patientId={patientId} />}

          {/* Visit Type selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                Visit type
              </label>
              <select
                ref={visitTypeRef}
                value={visitType ?? ''}
                onChange={e => {
                  const id = e.target.value;
                  setVisitType(id);
                  setVisitTypeMissing(false);
                  setIsPostOp(id === 'post_op');
                  if (id === 'ercp' || id === 'endoscopy_ogd' || id === 'endoscopy_col') {
                    setEncounterType('endoscopy');
                  } else if (id === 'urgent') {
                    setEncounterType('major_emergency');
                  } else if (id === 'post_op' || id === 'follow_up') {
                    setEncounterType('quick_consult');
                  } else {
                    setEncounterType('surgical_consult');
                  }
                }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: '#f0fdfa', color: '#0f766e', cursor: 'pointer',
                  border: visitTypeMissing ? '1.5px solid #dc2626' : '1.5px solid #0d9488',
                }}
              >
                <option value="">— Select visit type —</option>
                {VISIT_TYPES.map(vt => (
                  <option key={vt.id} value={vt.id}>{vt.icon} {vt.label}</option>
                ))}
              </select>
            </div>
            {visitTypeMissing && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
                Select a visit type before starting the consultation.
              </div>
            )}

            {/* Post-op date + review number */}
            {visitType === 'post_op' && (
              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', display: 'block', marginBottom: 3 }}>DATE OF OPERATION</label>
                  <input type="date" value={postOpDate} onChange={e => {
                    setPostOpDate(e.target.value);
                    if (e.target.value) {
                      const days = Math.round((Date.now() - new Date(e.target.value).getTime()) / 86400000);
                      setPostOpDays(String(days));
                    }
                  }} style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #c4b5fd', fontSize: 13, width: '100%' }} />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', display: 'block', marginBottom: 3 }}>REVIEW NUMBER</label>
                  <select value={postOpReviewNum} onChange={e => setPostOpReviewNum(Number(e.target.value))}
                    style={{ padding: '7px 10px', borderRadius: 7, border: '1.5px solid #c4b5fd', fontSize: 13, width: '100%' }}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={n}>{n === 1 ? '1st review' : n === 2 ? '2nd review' : n === 3 ? '3rd review' : `${n}th review`}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Clinical Intake ─────────────────────────────────────────────── */}

          {/* Reason for Visit */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpenSec(s => ({ ...s, cc: !s.cc }))}
              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15 }}>🩺</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827' }}>Reason for Visit</span>
              {symptoms.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#0d9488', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>{symptoms.length}</span>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{openSec.cc ? '▲' : '▼'}</span>
            </button>
            {openSec.cc && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INTAKE_SYMPTOMS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSymptom(s)}
                      style={{
                        padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: symptoms.includes(s) ? '1.5px solid #0d9488' : '1.5px solid #e5e7eb',
                        background: symptoms.includes(s) ? '#ccfbf1' : '#f9fafb',
                        color: symptoms.includes(s) ? '#0f766e' : '#374151',
                        transition: 'all .1s',
                      }}
                    >{s}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="fld" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>Duration (days)</label>
                    <input inputMode="numeric" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="e.g. 7" style={{ padding: '8px', fontSize: 13 }} />
                  </div>
                  <div className="fld" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>Pain score (0–10)</label>
                    <input inputMode="numeric" value={painScore} onChange={e => setPainScore(e.target.value)} placeholder="0–10" style={{ padding: '8px', fontSize: 13 }} />
                  </div>
                </div>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10 }}>Patient's own words</label>
                  <textarea
                    value={freeText} onChange={e => setFreeText(e.target.value)}
                    rows={2} placeholder="Brief description of the complaint…"
                    style={{ padding: '8px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Vitals */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpenSec(s => ({ ...s, vitals: !s.vitals }))}
              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15 }}>📊</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827' }}>Vitals</span>
              {INTAKE_VITALS.some(v => vitals[v.key]) && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#0d9488', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>
                  {INTAKE_VITALS.filter(v => vitals[v.key]).length} entered
                </span>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{openSec.vitals ? '▲' : '▼'}</span>
            </button>
            {openSec.vitals && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                  {INTAKE_VITALS.map(v => {
                    const val = vitals[v.key];
                    const isDanger = val ? v.danger(parseFloat(val)) : false;
                    return (
                      <div key={v.key} className="fld" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10, color: isDanger ? '#dc2626' : undefined }}>
                          {v.label} <span style={{ color: '#9ca3af', fontWeight: 400 }}>{v.unit}</span>
                        </label>
                        <input
                          inputMode="decimal"
                          value={val ?? ''}
                          onChange={e => updateVital(v.key, e.target.value)}
                          placeholder={v.placeholder}
                          style={{
                            padding: '8px', fontSize: 13, textAlign: 'center',
                            borderColor: isDanger ? '#dc2626' : undefined,
                            color: isDanger ? '#dc2626' : undefined,
                            fontWeight: isDanger ? 700 : undefined,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPreVisitStatus('vitals_done')}
                  style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  ✓ Mark vitals recorded
                </button>
              </div>
            )}
          </div>

          {/* Medical Screen */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpenSec(s => ({ ...s, medical: !s.medical }))}
              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15 }}>🏥</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827' }}>Medical Screen</span>
              {(comorbidities.length > 0 || allergies.trim()) && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>
                  {comorbidities.length > 0 ? `${comorbidities.length} PMH` : ''}{comorbidities.length > 0 && allergies.trim() ? ' · ' : ''}{allergies.trim() ? 'allergies' : ''}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{openSec.medical ? '▲' : '▼'}</span>
            </button>
            {openSec.medical && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>⚠ ALLERGIES & REACTIONS</label>
                  <textarea
                    value={allergies} onChange={e => setAllergies(e.target.value)}
                    rows={2} placeholder="Drugs, food, latex… NKDA"
                    style={{ padding: '8px', fontSize: 13, borderRadius: 8, border: '1.5px solid #fca5a5', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>PAST MEDICAL HISTORY</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {INTAKE_COMORBIDITIES.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleComorbidity(c)}
                        style={{
                          padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          border: comorbidities.includes(c) ? '1.5px solid #f59e0b' : '1.5px solid #e5e7eb',
                          background: comorbidities.includes(c) ? '#fef3c7' : '#f9fafb',
                          color: comorbidities.includes(c) ? '#92400e' : '#374151',
                          transition: 'all .1s',
                        }}
                      >{c}</button>
                    ))}
                  </div>
                </div>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>CURRENT MEDICATIONS</label>
                  <textarea
                    value={medicationsText} onChange={e => setMedicationsText(e.target.value)}
                    rows={2} placeholder="List current medications, doses, frequency…"
                    style={{ padding: '8px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="fld" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>SURGICAL / PROCEDURE HISTORY</label>
                  <textarea
                    value={surgicalNotes} onChange={e => setSurgicalNotes(e.target.value)}
                    rows={2} placeholder="Previous operations, procedures, anaesthetic issues…"
                    style={{ padding: '8px', fontSize: 13, borderRadius: 8, border: '1.5px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Social Screen */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpenSec(s => ({ ...s, social: !s.social }))}
              style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span style={{ fontSize: 15 }}>🌿</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827' }}>Social Screen</span>
              {toxicHabits.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, background: '#6b7280', color: '#fff', borderRadius: 20, padding: '2px 8px' }}>{toxicHabits.length}</span>
              )}
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{openSec.social ? '▲' : '▼'}</span>
            </button>
            {openSec.social && (
              <div style={{ padding: '0 16px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {INTAKE_HABITS.map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleToxicHabit(h)}
                      style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: toxicHabits.includes(h) ? '1.5px solid #6b7280' : '1.5px solid #e5e7eb',
                        background: toxicHabits.includes(h) ? '#f3f4f6' : '#f9fafb',
                        color: toxicHabits.includes(h) ? '#111827' : '#374151',
                        transition: 'all .1s',
                      }}
                    >{h}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary CTA — go straight to consultation. Visit type is required: without
              it, keep returning the user to the selector instead of navigating. */}
          <button
            type="button"
            onClick={() => {
              if (!visitType) {
                setVisitTypeMissing(true);
                visitTypeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                visitTypeRef.current?.focus();
                return;
              }
              setTopSection('consultation');
            }}
            style={{ width: '100%', padding: '14px 20px', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {visitType && visitType !== 'new_consult'
              ? `${VISIT_TYPES.find(v => v.id === visitType)?.icon} Start ${VISIT_TYPES.find(v => v.id === visitType)?.label} →`
              : 'Start Consultation →'}
          </button>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setTopSection('doc_scan')}
              style={{ flex: '1 1 160px', padding: '12px 18px', borderRadius: 10, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              📄 <span>Scan Document</span>
            </button>
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
