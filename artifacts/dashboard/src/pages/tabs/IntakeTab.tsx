import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import PathwaySuggestions from '@/components/PathwaySuggestions';
import SmartSymptomPicker from '@/components/SmartSymptomPicker';
import PatientPhotoCapture from '@/components/PatientPhotoCapture';
import WheelPicker from '@/components/WheelPicker';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { Sex, VitalSigns } from '@workspace/triage-engine';
import { SL_COMMUNITIES, SL_DOCTORS, formatSlPhone, isValidSlPhone, type SlDoctor } from '@/data/st-lucia';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';

const VISIT_TYPES = [
  { id: 'new_consult',      label: 'First Consult' },
  { id: 'follow_up',        label: 'Follow-up' },
  { id: 'post_op',          label: 'Post-op Review' },
  { id: 'ercp',             label: 'ERCP' },
  { id: 'endoscopy_ogd',    label: 'OGD' },
  { id: 'endoscopy_col',    label: 'Colonoscopy' },
  { id: 'breast',           label: 'Breast Clinic' },
  { id: 'telephone',        label: 'Telephone' },
  { id: 'diabetic_foot',    label: 'Diabetic Foot' },
  { id: 'urgent',           label: 'Urgent Referral' },
] as const;

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

interface VitalField {
  key: keyof VitalSigns;
  label: string;
  unit: string;
  placeholder: string;
  min: number; max: number; step: number; decimals: number;
  defaultVal: number;
  normalRange: [number, number];
}

const VITAL_FIELDS: VitalField[] = [
  { key: 'systolicBp',      label: 'SBP',   unit: 'mmHg',   placeholder: '120', min: 60,  max: 260, step: 1,   decimals: 0, defaultVal: 120, normalRange: [90,  140] },
  { key: 'diastolicBp',     label: 'DBP',   unit: 'mmHg',   placeholder: '80',  min: 40,  max: 160, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  90]  },
  { key: 'heartRate',       label: 'P',     unit: 'bpm',    placeholder: '88',  min: 30,  max: 220, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  100] },
  { key: 'temperatureC',    label: 'T',     unit: '°C',     placeholder: '37.0',min: 34.0,max: 43.0,step: 0.1, decimals: 1, defaultVal: 37.0,normalRange: [36.1,37.5]},
  { key: 'respiratoryRate', label: 'R',     unit: '/min',   placeholder: '16',  min: 8,   max: 60,  step: 1,   decimals: 0, defaultVal: 16,  normalRange: [12,  20]  },
  { key: 'spo2',            label: 'SpO₂',  unit: '%',      placeholder: '98',  min: 70,  max: 100, step: 1,   decimals: 0, defaultVal: 98,  normalRange: [95,  100] },
  { key: 'glucoseMmol',     label: 'RBS',   unit: 'mmol/L', placeholder: '6.4', min: 1.0, max: 35.0,step: 0.1, decimals: 1, defaultVal: 6.0, normalRange: [4.0, 7.8] },
];

function vitalClass(key: keyof VitalSigns, raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return '';
  if (key === 'systolicBp' && n < 90) return 'danger';
  if (key === 'heartRate' && n > 120) return 'danger';
  if (key === 'respiratoryRate' && n > 24) return 'danger';
  if (key === 'temperatureC' && n >= 38) return 'warn';
  if (key === 'spo2' && n < 94) return 'danger';
  if (key === 'glucoseMmol' && (n < 3.5 || n > 20)) return 'danger';
  return '';
}

export default function IntakeTab() {
  const {
    patientName, setPatientName,
    age, setAge, sex, setSex, dob, setDob, phone, setPhone,
    address, setAddress, quarter, setQuarter,
    referredBy, setReferredBy,
    durationDays, setDurationDays, painScore, setPainScore,
    isPostOp, setIsPostOp, postOpDays, setPostOpDays,
    pregnancyPossible, setPregnancyPossible,
    vitals, updateVital,
    symptoms,
    freeText, setFreeText,
    triageResult,
    weightKg, setWeightKg,
    heightCm, setHeightCm,
    waistCm, setWaistCm,
    hipCm, setHipCm,
    muacCm, setMuacCm,
    encounterMode,
    currentSite, setCurrentSite,
    mrNumber, setMrNumber,
    ward, setWard,
    dateAdmission, setDateAdmission,
    dateDischarge, setDateDischarge,
    bloodGroup, setBloodGroup,
    nokName, setNokName,
    nokRelation, setNokRelation,
    nokTel, setNokTel,
    admittingSurgeon, setAdmittingSurgeon,
    referringPhysician, setReferringPhysician,
    insuranceProvider, setInsuranceProvider,
    policyNumber, setPolicyNumber,
    procedureData, setProcedureData,
    hpiNotes, setHpiNotes,
    setTopSection,
  } = useAppContext();

  // Referral detail — stored in procedureData['referral'] to avoid context bloat
  interface ReferralData { date: string; dx: string; summary: string }
  const referralData = (procedureData['referral'] as ReferralData | undefined) ?? { date: '', dx: '', summary: '' };
  function setReferral(patch: Partial<ReferralData>) {
    setProcedureData({ ...procedureData, referral: { ...referralData, ...patch } });
  }

  const [checkedIn, setCheckedIn] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  function calcBmi(): { bmi: number; class: string; color: string; rec: string } | null {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    if (!w || !h || h < 50) return null;
    const bmi = w / Math.pow(h / 100, 2);
    if (bmi < 18.5) return { bmi, class: 'Underweight',    color: '#3b82f6', rec: 'Nutritional support pre-op. Increased wound healing risk.' };
    if (bmi < 25)   return { bmi, class: 'Normal',         color: '#16a34a', rec: 'Standard surgical risk.' };
    if (bmi < 30)   return { bmi, class: 'Overweight',     color: '#ca8a04', rec: 'Consider VTE prophylaxis. Monitor wound healing.' };
    if (bmi < 35)   return { bmi, class: 'Obese class I',  color: '#ea580c', rec: 'High VTE risk — LMWH + TED stockings. Difficult laparoscopic access. Prone to SSI.' };
    if (bmi < 40)   return { bmi, class: 'Obese class II', color: '#dc2626', rec: 'Very high anaesthetic risk. Airway assessment mandatory. Bariatric equipment required.' };
    return           { bmi, class: 'Obese class III',      color: '#7f1d1d', rec: 'Extreme surgical risk. Senior anaesthetic review required. HDU bed post-op.' };
  }

  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  // Address picker state
  const [addressQuery, setAddressQuery] = useState(address);
  const [addressOpen, setAddressOpen] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);

  const filteredCommunities = addressQuery.trim().length === 0
    ? SL_COMMUNITIES.slice(0, 10)
    : SL_COMMUNITIES.filter(c =>
        c.community.toLowerCase().includes(addressQuery.toLowerCase()) ||
        c.quarter.toLowerCase().includes(addressQuery.toLowerCase())
      ).slice(0, 10);

  function selectCommunity(c: { community: string; quarter: string }) {
    setAddress(c.community);
    setQuarter(c.quarter);
    setAddressQuery(c.community);
    setAddressOpen(false);
  }

  // Referral doctor picker state
  const [referralQuery, setReferralQuery] = useState(referredBy);
  const [referralOpen, setReferralOpen] = useState(false);
  const referralRef = useRef<HTMLDivElement>(null);
  const [referringDoctors, setReferringDoctors] = useState<SlDoctor[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl('/api/admin/referring-providers'), { headers: await staffAuthHeaders() });
        if (r.ok) {
          const d = await r.json() as { providers: { name: string; provider_type: string; notes: string | null; active: boolean }[] };
          const doctors = (d.providers ?? [])
            .filter(p => p.provider_type === 'referring_doctor' && p.active)
            .map(p => ({ name: p.name, specialty: 'Referring Doctor', institution: p.notes ?? '', phone: '' }));
          setReferringDoctors(doctors);
        }
      } catch { /* ignore — falls back to static list */ }
    })();
  }, []);

  const allDoctors = [...referringDoctors, ...SL_DOCTORS];

  const filteredDoctors = referralQuery.trim().length === 0
    ? allDoctors.slice(0, 8)
    : allDoctors.filter(d =>
        d.name.toLowerCase().includes(referralQuery.toLowerCase()) ||
        d.specialty.toLowerCase().includes(referralQuery.toLowerCase())
      ).slice(0, 8);

  // Phone validation
  const phoneValid = phone.trim().length === 0 ? null : isValidSlPhone(phone);

  function handlePhoneBlur() {
    if (phone.trim()) {
      const formatted = formatSlPhone(phone);
      if (formatted !== phone) setPhone(formatted);
    }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) setAddressOpen(false);
      if (referralRef.current && !referralRef.current.contains(e.target as Node)) setReferralOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync local query states when demographics arrive from check-in after mount
  useEffect(() => {
    if (address && !addressQuery.trim()) setAddressQuery(address);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (referredBy && !referralQuery.trim()) setReferralQuery(referredBy);
  }, [referredBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const visitType = (procedureData['visitType'] as string | undefined) ?? '';

  function savePatient() {
    if (!patientName.trim()) return;
    setSaving(true);
    try {
      const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
      const existing: Array<Record<string, unknown>> = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const newRecord = {
        id: crypto.randomUUID(),
        full_name: patientName.trim(),
        age,
        sex,
        dob,
        phone,
        site: currentSite,
        acuity: triageResult.acuity,
        score: triageResult.score,
        weightKg,
        heightCm,
        savedAt: new Date().toISOString(),
      };
      const idx = existing.findIndex(p => (p as { full_name?: string }).full_name?.toLowerCase() === patientName.trim().toLowerCase());
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...newRecord, id: existing[idx].id as string };
      } else {
        existing.push(newRecord);
      }
      localStorage.setItem(DEMO_PATIENTS_KEY, JSON.stringify(existing));
      showToast('Patient saved to local registry', 'success');
    } catch {
      showToast('Could not save patient', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gap-y">

      {/* ── 1. PATIENT IDENTITY & REGISTRATION ──────────────────────────────── */}
      <CollapsibleCard title="Patient identity &amp; registration" badge={triageResult.missingCriticalFields.length > 0 ? `${triageResult.missingCriticalFields.length} missing` : undefined} badgeVariant={triageResult.missingCriticalFields.length > 0 ? 'warn' : 'default'}>
        <PatientPhotoCapture />

        {/* Core demographics */}
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="fld">
            <label>Full name</label>
            <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Marie Joseph" />
          </div>
          <div className="fld">
            <label>Age</label>
            <input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} placeholder="e.g. 57" />
          </div>
          <div className="fld">
            <label>Sex</label>
            <select value={sex} onChange={e => setSex(e.target.value as Sex)}>
              <option value="unknown">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="fld">
            <label>Date of birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
          </div>
          <div className="fld">
            <label>Phone</label>
            <input
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="+1 (758) XXX-XXXX"
            />
            {phone.trim().length > 0 && (
              <span style={{ fontSize: 11, marginTop: 2, display: 'block', color: phoneValid ? '#16a34a' : '#b45309' }}>
                {phoneValid ? '✓ Valid St. Lucia number' : 'Format: +1 (758) XXX-XXXX'}
              </span>
            )}
          </div>
        </div>

        {/* Contact & administrative — collapsible */}
        <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setAdminOpen(o => !o)}
            style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 11px', fontSize: 11, color: '#6b7280', cursor: 'pointer', marginBottom: adminOpen ? 10 : 0 }}
          >
            {adminOpen ? '▲ Less' : '▼ Contact & admin details'}
          </button>
          {adminOpen && <div className="form-grid">
            {/* Address / community picker */}
            <div className="fld" ref={addressRef} style={{ position: 'relative' }}>
              <label>Community / Address</label>
              <input
                type="text"
                value={addressQuery}
                onChange={e => { setAddressQuery(e.target.value); setAddressOpen(true); }}
                onFocus={() => setAddressOpen(true)}
                placeholder="e.g. Rodney Bay, Gros Islet…"
              />
              {quarter && (
                <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'block' }}>
                  Quarter: {quarter}
                </span>
              )}
              {addressOpen && filteredCommunities.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2,
                }}>
                  {filteredCommunities.map(c => (
                    <button
                      key={`${c.quarter}-${c.community}`}
                      type="button"
                      onMouseDown={() => selectCommunity(c)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', width: '100%',
                        padding: '7px 12px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f3f4f6', fontSize: 13,
                      }}
                    >
                      <span>{c.community}</span>
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>{c.quarter}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Referred by */}
            <div className="fld" ref={referralRef} style={{ position: 'relative' }}>
              <label>Referred by</label>
              <input
                type="text"
                value={referralQuery}
                onChange={e => { setReferralQuery(e.target.value); setReferredBy(e.target.value); setReferralOpen(true); }}
                onFocus={() => setReferralOpen(true)}
                placeholder="Doctor or facility name…"
              />
              {referralOpen && filteredDoctors.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2,
                }}>
                  {filteredDoctors.map(d => (
                    <button
                      key={d.name}
                      type="button"
                      onMouseDown={() => { setReferredBy(d.name); setReferralQuery(d.name); setReferralOpen(false); }}
                      style={{
                        display: 'flex', flexDirection: 'column', width: '100%',
                        padding: '7px 12px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{d.specialty}{d.institution ? ` · ${d.institution}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="fld">
              <label>Insurance Provider</label>
              <input value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} placeholder="CLICO / GEL / Self-pay" />
            </div>
            <div className="fld">
              <label>Policy / NHI Number</label>
              <input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Policy number" />
            </div>
          </div>}
        </div>

        {/* ── Referral clinical details ── */}
        {referredBy.trim().length > 0 && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: 'rgba(30,58,138,0.06)', border: '1px solid #bfdbfe',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              📋 Referral details — from {referredBy}
            </div>
            <div className="form-grid cols-2" style={{ marginBottom: 10 }}>
              <div className="fld">
                <label>Referral date</label>
                <input
                  type="date"
                  value={referralData.date}
                  onChange={e => setReferral({ date: e.target.value })}
                />
              </div>
              <div className="fld">
                <label>Referring diagnosis / reason</label>
                <input
                  type="text"
                  value={referralData.dx}
                  onChange={e => setReferral({ dx: e.target.value })}
                  placeholder="e.g. Right inguinal hernia, query appendicitis…"
                />
              </div>
            </div>
            <div className="fld" style={{ marginBottom: 10 }}>
              <label>Clinical summary from referral letter</label>
              <textarea
                value={referralData.summary}
                onChange={e => setReferral({ summary: e.target.value })}
                placeholder="Paste or type the referring doctor's clinical summary, prior investigations, treatment history…"
                style={{ minHeight: 80 }}
              />
            </div>
            {referralData.summary.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const prefix = `[Referral from ${referredBy}${referralData.dx ? ` — ${referralData.dx}` : ''}]\n${referralData.summary}\n\n`;
                  setHpiNotes(hpiNotes ? prefix + hpiNotes : prefix);
                  showToast('Referral summary imported to HPI', 'success');
                }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: '#1d4ed8', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Import to HPI →
              </button>
            )}
          </div>
        )}

        {/* ── Front-desk check-in action ── */}
        <div style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 8,
          background: checkedIn ? 'rgba(16,185,129,0.08)' : 'rgba(15,118,110,0.06)',
          border: `1px solid ${checkedIn ? '#6ee7b7' : '#99f6e4'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {checkedIn ? (
            <>
              <span style={{ fontSize: 16 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>Patient checked in</div>
                <div style={{ fontSize: 11, color: '#047857' }}>{patientName || 'Patient'} is queued for Dr Kabiye's consultation.</div>
              </div>
              <button
                type="button"
                onClick={() => setTopSection('consultation')}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: '#0d9488', color: '#fff',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Open Consultation →
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>🪑</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e' }}>Front desk: patient ready</div>
                <div style={{ fontSize: 11, color: '#0d9488' }}>Check in and queue for Dr Kabiye once registration is complete.</div>
              </div>
              <button
                type="button"
                disabled={!patientName.trim()}
                onClick={() => { savePatient(); setCheckedIn(true); }}
                style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none',
                  background: patientName.trim() ? '#0d9488' : '#d1d5db',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  cursor: patientName.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ Check in &amp; Queue
              </button>
            </>
          )}
        </div>
      </CollapsibleCard>

      {/* ── 1b. VISIT CLASSIFICATION — staff fills before consultation ────── */}
      <CollapsibleCard title="Visit" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Visit type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Visit type</label>
            <select
              value={visitType}
              onChange={e => setProcedureData({ ...procedureData, visitType: e.target.value })}
              style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #0d9488', fontSize: 13, fontWeight: 600, background: '#f0fdfa', color: '#0f766e', cursor: 'pointer' }}
            >
              <option value="">— Select visit type —</option>
              {VISIT_TYPES.map(vt => (
                <option key={vt.id} value={vt.id}>{vt.label}</option>
              ))}
            </select>
          </div>

          {/* Scan document shortcut */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {hpiNotes.includes('[Referral')
                ? '📄 Referral letter imported to HPI'
                : 'Referral letter or previous reports available?'}
            </span>
            <button type="button" onClick={() => setTopSection('doc_scan')}
              style={{ padding: '5px 14px', borderRadius: 7, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              📄 Scan Document
            </button>
          </div>
        </div>
      </CollapsibleCard>

      {/* ── 2. CHIEF COMPLAINT / REASON FOR VISIT ───────────────────────────── */}
      <CollapsibleCard
        title="Chief complaint / reason for visit"
        badge={symptoms.length > 0 ? `${symptoms.length} symptom${symptoms.length !== 1 ? 's' : ''}` : undefined}
        badgeVariant={symptoms.length > 0 ? 'default' : undefined}
      >
        <SmartSymptomPicker />

        <div className="form-grid cols-2" style={{ marginTop: 12 }}>
          <div className="fld">
            <label>Duration of symptoms (days)</label>
            <input type="number" inputMode="numeric" min={0} step={1} value={durationDays} onChange={e => setDurationDays(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 3" />
          </div>
          <div className="fld">
            <label>Pain score (0–10)</label>
            <input type="number" inputMode="numeric" min={0} max={10} step={1} value={painScore}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setPainScore(v && Number(v) > 10 ? '10' : v); }}
              placeholder="0-10"
              className={painScore && Number(painScore) >= 8 ? 'danger' : painScore && Number(painScore) >= 5 ? 'warn' : ''} />
          </div>
        </div>

        <div className="check-row" style={{ marginTop: 8 }}>
          <label>
            <input type="checkbox" checked={isPostOp} onChange={e => setIsPostOp(e.target.checked)} />
            Post-op / recent procedure
          </label>
          <label>
            <input type="checkbox" checked={pregnancyPossible} onChange={e => setPregnancyPossible(e.target.checked)} />
            Pregnancy possible
          </label>
          {isPostOp && (
            <div className="inline-field">
              <span>Days since op:</span>
              <input type="number" inputMode="numeric" min={0} step={1} value={postOpDays} onChange={e => setPostOpDays(e.target.value.replace(/[^0-9]/g, ''))} placeholder="days" />
            </div>
          )}
        </div>

        <div className="fld" style={{ marginTop: 10 }}>
          <label>Patient message / additional notes</label>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Paste patient email or WhatsApp message here, or add presenting history notes…"
            style={{ minHeight: 80 }}
          />
        </div>
      </CollapsibleCard>

      {/* Clinical pathway suggestions — shown when specific combos detected */}
      <PathwaySuggestions />

      {/* ── 3. VITAL SIGNS ──────────────────────────────────────────────────── */}
      <CollapsibleCard title="Vital signs" badge={triageResult.vitalRedFlags.length > 0 ? `${triageResult.vitalRedFlags.length} alert` : 'optional'} badgeVariant={triageResult.vitalRedFlags.length > 0 ? 'danger' : 'default'}>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px' }}>
          Scroll wheel to set value · or type directly below each wheel
        </p>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', minWidth: 'max-content' }}>
            {/* Vital signs */}
            <div style={{ display: 'flex', gap: 10 }}>
              {VITAL_FIELDS.map(({ key, label, unit, placeholder, min, max, step, decimals, defaultVal, normalRange }) => {
                const val = vitals[key];
                const isAbnormal = val.trim() !== '' && Number.isFinite(parseFloat(val)) &&
                  (parseFloat(val) < normalRange[0] || parseFloat(val) > normalRange[1]);
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 78 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: isAbnormal ? '#dc2626' : 'var(--muted)',
                    }}>
                      {label}
                    </span>
                    <WheelPicker
                      value={val}
                      onChange={v => updateVital(key, v)}
                      min={min} max={max} step={step}
                      decimals={decimals}
                      defaultVal={defaultVal}
                      normalRange={normalRange}
                    />
                    <input
                      inputMode="decimal"
                      value={val}
                      onChange={e => updateVital(key, e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: 70, fontSize: 12, padding: '4px 5px', textAlign: 'center',
                        borderRadius: 6, border: `1.5px solid ${isAbnormal ? '#fca5a5' : '#d1d5db'}`,
                        background: isAbnormal ? '#fff5f5' : 'var(--bg)',
                        color: isAbnormal ? '#dc2626' : 'var(--ink)', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 9, color: isAbnormal ? '#dc2626' : 'var(--muted)', fontWeight: isAbnormal ? 700 : 400 }}>
                      {isAbnormal ? '⚠ ' : ''}{unit}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Separator */}
            <div style={{ width: 1, background: '#e2e8f0', margin: '0 16px', flexShrink: 0 }} />

            {/* Anthropometrics */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {[
                { label: 'Wt',    unit: 'kg', value: weightKg, onChange: setWeightKg, min: 20,  max: 300, step: 0.5, decimals: 1, defaultVal: 70  },
                { label: 'Ht',    unit: 'cm', value: heightCm, onChange: setHeightCm, min: 50,  max: 220, step: 1,   decimals: 0, defaultVal: 165 },
                { label: 'Waist', unit: 'cm', value: waistCm,  onChange: setWaistCm,  min: 40,  max: 200, step: 0.5, decimals: 1, defaultVal: 88  },
                { label: 'Hip',   unit: 'cm', value: hipCm,    onChange: setHipCm,    min: 40,  max: 200, step: 0.5, decimals: 1, defaultVal: 100 },
                { label: 'MUAC',  unit: 'cm', value: muacCm,   onChange: setMuacCm,   min: 10,  max: 60,  step: 0.5, decimals: 1, defaultVal: 28  },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 78 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {f.label}
                  </span>
                  <WheelPicker
                    value={f.value}
                    onChange={f.onChange}
                    min={f.min} max={f.max} step={f.step}
                    decimals={f.decimals} defaultVal={f.defaultVal}
                    normalRange={[f.min, f.max]}
                  />
                  <input
                    inputMode="decimal"
                    value={f.value}
                    onChange={e => f.onChange(e.target.value)}
                    placeholder={f.unit}
                    style={{
                      width: 70, fontSize: 12, padding: '4px 5px', textAlign: 'center',
                      borderRadius: 6, border: '1.5px solid #d1d5db',
                      background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>{f.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {triageResult.vitalRedFlags.length > 0 && (
          <div className="vital-flags" style={{ marginTop: 8 }}>
            {triageResult.vitalRedFlags.map(f => (
              <span key={f.label} className={`vflag ${f.severity}`}>{f.label}: {f.value}</span>
            ))}
          </div>
        )}
        {calcBmi() && (() => {
          const b = calcBmi()!;
          return (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${b.color}15`, border: `1px solid ${b.color}40`, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: b.color }}>BMI {b.bmi.toFixed(1)}</span>
              <span style={{ fontWeight: 600, color: b.color, fontSize: 13 }}>{b.class}</span>
              <span style={{ color: '#6b7280', fontSize: 12, flex: 1 }}>{b.rec}</span>
            </div>
          );
        })()}
        {(() => {
          const w = parseFloat(waistCm), h = parseFloat(hipCm), muac = parseFloat(muacCm);
          const items: React.ReactNode[] = [];
          if (w && h && h > 0) {
            const ratio = w / h;
            const sex_ = sex === 'female' ? 'female' : 'male';
            const highRisk = sex_ === 'male' ? ratio > 0.9 : ratio > 0.85;
            const color = highRisk ? '#dc2626' : '#16a34a';
            items.push(
              <span key="whr" style={{ fontWeight: 600, fontSize: 12, color }}>
                WHR {ratio.toFixed(2)} — {highRisk ? '⚠ High cardiovascular risk' : 'Normal'}
              </span>
            );
          }
          if (w) {
            const sex_ = sex === 'female' ? 'female' : 'male';
            const highWaist = sex_ === 'male' ? w >= 94 : w >= 80;
            const vHighWaist = sex_ === 'male' ? w >= 102 : w >= 88;
            const wColor = vHighWaist ? '#dc2626' : highWaist ? '#ea580c' : '#16a34a';
            items.push(
              <span key="waist" style={{ fontWeight: 600, fontSize: 12, color: wColor }}>
                Waist {w} cm — {vHighWaist ? '⚠ Very high metabolic risk' : highWaist ? 'Elevated metabolic risk' : 'Normal'}
              </span>
            );
          }
          if (muac) {
            const malnutrition = muac < 23.5;
            items.push(
              <span key="muac" style={{ fontWeight: 600, fontSize: 12, color: malnutrition ? '#dc2626' : '#374151' }}>
                MUAC {muac} cm{malnutrition ? ' — ⚠ Nutritional risk (pre-op assessment recommended)' : ''}
              </span>
            );
          }
          if (!items.length) return null;
          return (
            <div style={{ marginTop: 6, padding: '7px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              {items}
            </div>
          );
        })()}
      </CollapsibleCard>

      {/* ── 5. INPATIENT ADMISSION DETAILS ──────────────────────────────────── */}
      {encounterMode === 'inpatient' && (
        <CollapsibleCard title="Inpatient Admission Details" badge="Inpatient" badgeVariant="warn">
          <div className="form-grid">
            <div className="fld">
              <label>MR Number</label>
              <input value={mrNumber} onChange={e => setMrNumber(e.target.value)} placeholder="MR-2024-001" />
            </div>
            <div className="fld">
              <label>Blood Group</label>
              <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                <option value="">— select —</option>
                {['A+','A−','B+','B−','AB+','AB−','O+','O−'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Ward / Unit</label>
              <input value={ward} onChange={e => setWard(e.target.value)} placeholder="Surgical Ward B" />
            </div>
            <div className="fld">
              <label>Date of Admission</label>
              <input type="date" value={dateAdmission} onChange={e => setDateAdmission(e.target.value)} />
            </div>
            <div className="fld">
              <label>Date of Discharge</label>
              <input type="date" value={dateDischarge} onChange={e => setDateDischarge(e.target.value)} />
            </div>
            <div className="fld">
              <label>Admitting Surgeon</label>
              <input value={admittingSurgeon} onChange={e => setAdmittingSurgeon(e.target.value)} placeholder="Dr Dawit Daniel Kabiye" />
            </div>
            <div className="fld">
              <label>Referring Physician</label>
              <input value={referringPhysician} onChange={e => setReferringPhysician(e.target.value)} placeholder="Name / facility" />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 8 }}>
            <div className="fld">
              <label>Next of Kin</label>
              <input value={nokName} onChange={e => setNokName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="fld">
              <label>Relationship</label>
              <input value={nokRelation} onChange={e => setNokRelation(e.target.value)} placeholder="Spouse / Child / Sibling" />
            </div>
            <div className="fld">
              <label>NOK Contact</label>
              <input value={nokTel} onChange={e => setNokTel(e.target.value)} placeholder="+1 758 …" />
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Save patient to local registry */}
      {patientName.trim() && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <button
            className="summary-btn summary-btn--primary"
            onClick={savePatient}
            disabled={saving}
            style={{ height: 36, minWidth: 160 }}
          >
            {saving ? 'Saving…' : '💾 Save patient'}
          </button>
        </div>
      )}
    </div>
  );
}
