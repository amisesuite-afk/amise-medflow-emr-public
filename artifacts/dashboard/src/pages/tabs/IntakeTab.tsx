import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useAppContext } from '@/context/AppContext';

const ClinicalScoresPanel = lazy(() => import('@/components/ClinicalScoresPanel'));
function ClinicalScoresPanelLazy() {
  return <Suspense fallback={null}><ClinicalScoresPanel /></Suspense>;
}
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import PatientPhotoCapture from '@/components/PatientPhotoCapture';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { Sex } from '@workspace/triage-engine';
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

interface ReferralScanResult {
  visitType?: string | null;
  chiefComplaint?: string | null;
  hpi?: string | null;
  medications?: string | null;
  surgicalHistory?: string | null;
  pmh?: string | null;
  referredBy?: string | null;
  referralDate?: string | null;
  referralDx?: string | null;
  referralSummary?: string | null;
  labs?: string[];
  imaging?: string[];
  patientName?: string | null;
  age?: string | null;
  sex?: string | null;
}

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}



export default function IntakeTab() {
  const {
    patientName, setPatientName,
    age, setAge, sex, setSex, dob, setDob, phone, setPhone,
    address, setAddress, quarter, setQuarter,
    referredBy, setReferredBy,
    freeText, setFreeText,
    triageResult,
    weightKg, setWeightKg,
    heightCm, setHeightCm,
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
    visitType, setVisitType,
    encounterType,
    setMedicationsText,
    setSurgicalNotes,
    setPmhNotes,
    orderedInvestigations, setOrderedInvestigations,
    setTopSection,
    setExtractedLabs,
    traumaData, setTraumaData,
  } = useAppContext();

  // Visit-type context flags — drive card ordering and conditional sections
  const isEmergency = visitType === 'urgent' || encounterType === 'major_emergency';
  const isErcp = visitType === 'ercp';
  const hasVisitChecklist = !!visitType && visitType !== 'ercp';

  // Card visual order — CSS flex `order` property.
  // Emergency: triage banner → vitals → CC → identity → referral
  // ERCP:      referral → ERCP checklist → vitals → CC → identity
  // Default:   identity → referral → CC → vitals → scores → triage
  type CardKey = 'triage' | 'abcde' | 'identity' | 'referral' | 'ercp_checklist' | 'visit_checklist';
  function cardOrder(k: CardKey): number {
    if (isEmergency) {
      const map: Record<CardKey, number> = { triage: 0, abcde: 1, identity: 2, referral: 3, visit_checklist: 4, ercp_checklist: 10 };
      return map[k];
    }
    if (isErcp) {
      const map: Record<CardKey, number> = { referral: 1, ercp_checklist: 2, identity: 3, triage: 8, abcde: 9, visit_checklist: 10 };
      return map[k];
    }
    const map: Record<CardKey, number> = { identity: 1, referral: 2, visit_checklist: 3, triage: 7, ercp_checklist: 10, abcde: 11 };
    return map[k];
  }

  // Referral detail — stored in procedureData['referral'] to avoid context bloat
  interface ReferralData { date: string; dx: string; summary: string }
  const referralData = (procedureData['referral'] as ReferralData | undefined) ?? { date: '', dx: '', summary: '' };
  function setReferral(patch: Partial<ReferralData>) {
    setProcedureData({ ...procedureData, referral: { ...referralData, ...patch } });
  }

  const [checkedIn, setCheckedIn] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

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

  // ── Referral document AI scan ─────────────────────────────────────────────
  const [scanMode, setScanMode] = useState<'paste' | 'file'>('paste');
  const [scanText, setScanText] = useState('');
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanFileB64, setScanFileB64] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReferralScanResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleScanFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setScanFileB64(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  }

  async function runReferralScan() {
    if (scanning) return;
    const hasContent = scanMode === 'paste' ? scanText.trim().length > 0 : !!scanFile;
    if (!hasContent) { showToast('Attach a file or paste text first', 'error'); return; }
    setScanning(true);
    setScanResult(null);
    try {
      const body = scanMode === 'paste'
        ? { content: scanText.trim(), contentType: 'text' }
        : { content: scanFileB64, contentType: 'image_base64', mimeType: scanFile!.type };
      const r = await fetch(apiUrl('/api/investigations/scan-referral'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const { extracted } = await r.json() as { extracted: ReferralScanResult };
      setScanResult(extracted);
    } catch {
      showToast('Scan failed — check the document and try again', 'error');
    } finally {
      setScanning(false);
    }
  }

  function applyExtracted() {
    if (!scanResult) return;
    if (scanResult.visitType) setVisitType(scanResult.visitType);
    if (scanResult.chiefComplaint) setFreeText(scanResult.chiefComplaint);
    if (scanResult.hpi) setHpiNotes(scanResult.hpi);
    if (scanResult.medications) setMedicationsText(scanResult.medications);
    if (scanResult.surgicalHistory) setSurgicalNotes(scanResult.surgicalHistory);
    if (scanResult.pmh) setPmhNotes(scanResult.pmh);
    if (scanResult.referredBy) { setReferredBy(scanResult.referredBy); setReferralQuery(scanResult.referredBy); }
    if (scanResult.labs?.length) setOrderedInvestigations([...new Set([...orderedInvestigations, ...scanResult.labs])]);
    setProcedureData({
      ...procedureData,
      referral: {
        date: scanResult.referralDate ?? referralData.date,
        dx: scanResult.referralDx ?? referralData.dx,
        summary: scanResult.referralSummary ?? referralData.summary,
      },
    });
    if (scanResult.patientName && !patientName.trim()) setPatientName(scanResult.patientName);
    if (scanResult.age && !age.trim()) setAge(scanResult.age);
    if (scanResult.sex && sex === 'unknown') setSex(scanResult.sex as Sex);
    // Apply extracted lab values — feeds clinical scoring tools
    const el = (scanResult as Record<string, unknown>).extracted_labs as Record<string, number | null> | null;
    if (el && typeof el === 'object') {
      const numeric: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(el)) {
        if (v !== null && v !== undefined && typeof v === 'number') numeric[k] = v;
      }
      if (Object.keys(numeric).length > 0) setExtractedLabs(numeric);
    }
    showToast('Referral data applied to EMR', 'success');
    setScanResult(null);
    setScanText('');
    setScanFile(null);
    setScanFileB64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
      <div style={{ order: cardOrder('identity') }}>
      <CollapsibleCard title="Patient identity &amp; registration" badge={triageResult.missingCriticalFields.length > 0 ? `${triageResult.missingCriticalFields.length} missing` : undefined} badgeVariant={triageResult.missingCriticalFields.length > 0 ? 'warn' : 'default'} defaultOpen={!isEmergency}>
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
          {/* Next of kin — same row as phone in the 4-col grid */}
          <div className="fld">
            <label>NOK name</label>
            <input type="text" value={nokName} onChange={e => setNokName(e.target.value)} placeholder="e.g. Jean Joseph" />
          </div>
          <div className="fld">
            <label>NOK relationship</label>
            <select value={nokRelation} onChange={e => setNokRelation(e.target.value)}>
              <option value="">— Select —</option>
              {['Spouse','Partner','Parent','Child','Sibling','Grandparent','Aunt/Uncle','Friend','Guardian','Carer','Other'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>NOK phone</label>
            <input inputMode="tel" type="tel" value={nokTel} onChange={e => setNokTel(e.target.value)} placeholder="+1 (758) XXX-XXXX" />
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

        {/* ── INPATIENT ADMISSION — inline, only when admission mode is on ── */}
        {encounterMode === 'inpatient' && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 9,
            background: 'rgba(245,158,11,0.05)',
            border: '1.5px solid rgba(245,158,11,0.35)',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 800, color: '#b45309',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
            }}>
              🏥 Inpatient admission details
            </div>
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
                <input value={admittingSurgeon} onChange={e => setAdmittingSurgeon(e.target.value)} placeholder="Dr Dawit Daniel Kabiye, MD, DM" />
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
          </div>
        )}
      </CollapsibleCard>

      </div>{/* end identity wrapper */}

      {/* ── 1b. REFERRAL / REPORT AI SCAN ──────────────────────────────────── */}
      <div style={{ order: cardOrder('referral') }}>
      <CollapsibleCard title="Referral letter / reports" defaultOpen={!isEmergency}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleScanFileChange}
          style={{ display: 'none' }}
        />

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['paste', 'file'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setScanMode(m)}
              style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                background: scanMode === m ? '#0d9488' : '#f3f4f6',
                color: scanMode === m ? '#fff' : '#374151',
                border: scanMode === m ? '1.5px solid #0d9488' : '1.5px solid #e5e7eb',
              }}
            >
              {m === 'paste' ? '📋 Paste text' : '📎 Attach image / PDF'}
            </button>
          ))}
        </div>

        {/* Input area */}
        {scanMode === 'paste' ? (
          <textarea
            value={scanText}
            onChange={e => setScanText(e.target.value)}
            placeholder="Paste the referral letter or clinical summary here — AI will extract CC, visit type, HPI, medications, surgical history, PMH, and investigation requests automatically…"
            style={{
              width: '100%', minHeight: 100, boxSizing: 'border-box',
              padding: '8px 10px', fontSize: 12, borderRadius: 7,
              border: '1.5px solid #e5e7eb', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '6px 16px', borderRadius: 7, border: '1.5px solid #d1d5db',
                background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Browse…
            </button>
            <span style={{ fontSize: 12, color: scanFile ? '#0f766e' : '#9ca3af' }}>
              {scanFile ? `✓ ${scanFile.name}` : 'No file chosen — image or PDF of referral letter'}
            </span>
          </div>
        )}

        {/* Parse button */}
        {((scanMode === 'paste' && scanText.trim()) || (scanMode === 'file' && scanFile)) && (
          <button
            type="button"
            onClick={() => void runReferralScan()}
            disabled={scanning}
            style={{
              marginTop: 10, padding: '7px 18px', borderRadius: 8, border: 'none',
              background: scanning ? '#9ca3af' : '#0d9488',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: scanning ? 'wait' : 'pointer',
            }}
          >
            {scanning ? '⏳ Reading document…' : '🤖 AI Parse & Auto-fill →'}
          </button>
        )}

        {/* Extracted data preview */}
        {scanResult && (
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: '#f0fdfa', border: '1.5px solid #0d9488',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#0f766e',
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
            }}>
              ✓ Extracted — review before applying
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginBottom: 10 }}>
              {scanResult.visitType && (
                <span style={{ fontSize: 11 }}>
                  <strong>Visit type: </strong>
                  <span style={{ background: '#0d9488', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: 11 }}>
                    {VISIT_TYPES.find(vt => vt.id === scanResult.visitType)?.label ?? scanResult.visitType}
                  </span>
                </span>
              )}
              {scanResult.referredBy && <span style={{ fontSize: 11 }}><strong>From:</strong> {scanResult.referredBy}</span>}
              {scanResult.referralDate && <span style={{ fontSize: 11 }}><strong>Date:</strong> {scanResult.referralDate}</span>}
              {scanResult.referralDx && <span style={{ fontSize: 11 }}><strong>Dx:</strong> {scanResult.referralDx}</span>}
              {scanResult.patientName && <span style={{ fontSize: 11 }}><strong>Patient:</strong> {scanResult.patientName}{scanResult.age ? `, ${scanResult.age}y` : ''}{scanResult.sex && scanResult.sex !== 'unknown' ? ` ${scanResult.sex}` : ''}</span>}
            </div>

            {scanResult.chiefComplaint && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>CC: </span>
                <span style={{ fontSize: 12 }}>{scanResult.chiefComplaint}</span>
              </div>
            )}
            {scanResult.hpi && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>HPI: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>
                  {scanResult.hpi.length > 240 ? `${scanResult.hpi.slice(0, 240)}…` : scanResult.hpi}
                </span>
              </div>
            )}
            {scanResult.medications && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Meds: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{scanResult.medications}</span>
              </div>
            )}
            {scanResult.pmh && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>PMH: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{scanResult.pmh}</span>
              </div>
            )}
            {scanResult.surgicalHistory && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Surgical Hx: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{scanResult.surgicalHistory}</span>
              </div>
            )}
            {!!scanResult.labs?.length && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Labs: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{scanResult.labs.join(', ')}</span>
              </div>
            )}
            {!!scanResult.imaging?.length && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Imaging: </span>
                <span style={{ fontSize: 12, color: '#4b5563' }}>{scanResult.imaging.join(', ')}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={applyExtracted}
                style={{
                  padding: '6px 18px', borderRadius: 7, border: 'none',
                  background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✓ Apply to EMR
              </button>
              <button
                type="button"
                onClick={() => setScanResult(null)}
                style={{
                  padding: '6px 14px', borderRadius: 7,
                  border: '1px solid #d1d5db', background: 'transparent',
                  color: '#6b7280', fontSize: 12, cursor: 'pointer',
                }}
              >
                ✕ Dismiss
              </button>
            </div>
          </div>
        )}
      </CollapsibleCard>
      </div>{/* end referral wrapper */}

      {/* ── ERCP PRE-PROCEDURE CHECKLIST — only shown when visitType === 'ercp' ── */}
      {isErcp && (
        <div style={{ order: cardOrder('ercp_checklist') }}>
        <ErpcChecklist
          data={(procedureData['ercp_checklist'] as ErpcChecklistData | undefined) ?? defaultErpcData()}
          onChange={d => setProcedureData({ ...procedureData, ercp_checklist: d })}
        />
        </div>
      )}

      {/* ── Visit-type-specific intake questionnaire — all non-ERCP types ── */}
      {hasVisitChecklist && (
        <div style={{ order: cardOrder('visit_checklist') }}>
          <VisitChecklist
            visitType={visitType!}
            data={(procedureData[`${visitType!}_checklist`] as Record<string, unknown> | undefined) ?? {}}
            onChange={d => setProcedureData({ ...procedureData, [`${visitType!}_checklist`]: d })}
          />
        </div>
      )}

      {/* ── Patient message — pre-populates Consultation CC and HPI ── */}
      {/* CC selection, duration, pain score, vitals → Consultation tabs  */}
      <CollapsibleCard title="Patient message / notes" defaultOpen={!!freeText}>
        <div className="fld">
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Paste patient WhatsApp message, email, or referral text here — pre-fills the Consultation CC and HPI automatically…"
            style={{ minHeight: 80 }}
          />
          {freeText.trim() && (
            <span style={{ fontSize: 11, color: '#0d9488', marginTop: 4, display: 'block' }}>
              ✓ Will auto-populate Consultation CC and HPI when doctor opens the case
            </span>
          )}
        </div>
      </CollapsibleCard>

      {/* ── ABCDE Quick Primary Survey — major_emergency encounters only ─────── */}
      {encounterType === 'major_emergency' && (
        <div style={{ order: cardOrder('abcde') }}>
          <CollapsibleCard title="ABCDE Primary Survey" badge="Quick" badgeVariant="warn" defaultOpen>
            {(() => {
              function abcdeGet(letter: string, field: string): string {
                return (traumaData.abcde[letter] as Record<string, string> | undefined)?.[field] ?? '';
              }
              function abcdeSet(letter: string, field: string, value: string) {
                setTraumaData(prev => ({
                  ...prev,
                  abcde: { ...prev.abcde, [letter]: { ...(prev.abcde[letter] ?? {}), [field]: value } },
                }));
              }

              const gcsE = parseInt(abcdeGet('D', 'gcsE') || '0') || 0;
              const gcsV = parseInt(abcdeGet('D', 'gcsV') || '0') || 0;
              const gcsM = parseInt(abcdeGet('D', 'gcsM') || '0') || 0;
              const gcsTotal = (gcsE && gcsV && gcsM) ? gcsE + gcsV + gcsM : null;

              const rowStyle: React.CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 0', borderBottom: '1px solid var(--border, #f1f5f9)',
              };
              const badge = (letter: string, color: string) => (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%', background: color,
                  color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0,
                }}>{letter}</span>
              );
              const titleStyle: React.CSSProperties = {
                fontSize: 11, fontWeight: 700, color: '#374151',
                width: 84, flexShrink: 0,
              };
              const sel = (
                letter: string, field: string, options: string[], placeholder: string,
                { flex = 1 }: { flex?: number } = {},
              ) => (
                <select
                  value={abcdeGet(letter, field)}
                  onChange={e => abcdeSet(letter, field, e.target.value)}
                  style={{ fontSize: 12, flex, minWidth: 0 }}
                >
                  <option value="">{placeholder}</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              );

              const abnormalA = !!abcdeGet('A', 'airwayStatus') && abcdeGet('A', 'airwayStatus') !== 'Patent';
              const abnormalB = !!abcdeGet('B', 'airEntry') && abcdeGet('B', 'airEntry') !== 'Bilateral equal';
              const abnormalC = !!abcdeGet('C', 'haemorrhage') && abcdeGet('C', 'haemorrhage') !== 'None obvious';
              const abnormalD = gcsTotal !== null && gcsTotal < 15;
              const criticalCount = [abnormalA, abnormalB, abnormalC, abnormalD].filter(Boolean).length;

              return (
                <div style={{ paddingTop: 2 }}>
                  <div style={rowStyle}>
                    {badge('A', '#dc2626')}
                    <span style={titleStyle}>Airway</span>
                    {sel('A', 'airwayStatus', ['Patent', 'Noisy / Partially obstructed', 'Obstructed', 'Secured — ETT', 'Secured — LMA', 'Surgical airway (cric)'], 'Airway status')}
                    {sel('A', 'cSpine', ['Hard collar applied', 'Cleared clinically (NEXUS / CCR)', 'Cleared radiologically', 'Not immobilised'], 'C-spine')}
                  </div>
                  <div style={rowStyle}>
                    {badge('B', '#f97316')}
                    <span style={titleStyle}>Breathing</span>
                    {sel('B', 'airEntry', ['Bilateral equal', 'Reduced — left', 'Reduced — right', 'Absent — left', 'Absent — right'], 'Air entry')}
                    {sel('B', 'o2Delivery', ['None', 'Nasal prongs', 'Face mask', 'NRB mask (15 L/min)', 'BVM ventilation', 'Mechanically ventilated'], 'O₂ delivery')}
                  </div>
                  <div style={rowStyle}>
                    {badge('C', '#ef4444')}
                    <span style={titleStyle}>Circulation</span>
                    {sel('C', 'haemorrhage', ['None obvious', 'External — controlled', 'External — uncontrolled', 'Internal — suspected', 'External + internal'], 'Haemorrhage')}
                    {sel('C', 'ivAccess', ['None', '1 × peripheral IV', '2 × peripheral IV', 'Intraosseous (IO)', 'Central venous access'], 'IV access')}
                  </div>
                  <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 6 }}>
                    {badge('D', '#8b5cf6')}
                    <span style={titleStyle}>Disability</span>
                    {sel('D', 'pupils', ['Equal and reactive (PERLA)', 'Unequal', 'Fixed and dilated — bilateral', 'Fixed and dilated — left', 'Fixed and dilated — right', 'Sluggish reaction'], 'Pupils')}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: '#6b7280', marginRight: 2 }}>GCS:</span>
                      {(['E', 'V', 'M'] as const).map(axis => {
                        const maxVal = axis === 'E' ? 4 : axis === 'V' ? 5 : 6;
                        return (
                          <select
                            key={axis}
                            value={abcdeGet('D', `gcs${axis}`)}
                            onChange={e => abcdeSet('D', `gcs${axis}`, e.target.value)}
                            style={{ fontSize: 12, width: 50 }}
                          >
                            <option value="">{axis}?</option>
                            {Array.from({ length: maxVal }, (_, i) => String(i + 1)).map(v => (
                              <option key={v} value={v}>{axis}{v}</option>
                            ))}
                          </select>
                        );
                      })}
                      {gcsTotal !== null && (
                        <span style={{
                          fontSize: 12, fontWeight: 700, marginLeft: 4,
                          color: gcsTotal < 9 ? '#dc2626' : gcsTotal < 13 ? '#ea580c' : '#16a34a',
                        }}>= {gcsTotal}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    {badge('E', '#0ea5e9')}
                    <span style={titleStyle}>Exposure</span>
                    {sel('E', 'hypothermia', ['None (>35°C)', 'Mild (32–35°C)', 'Moderate (28–32°C)', 'Severe (<28°C)'], 'Temperature')}
                    {sel('E', 'logRoll', ['Not yet performed', 'Completed — no spinal tenderness', 'Completed — spinal tenderness noted', 'Contraindicated'], 'Log roll')}
                  </div>
                  {criticalCount > 0 && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 7,
                      background: '#fff1f2', border: '1px solid #fecdd3',
                      fontSize: 11, color: '#7f1d1d', fontWeight: 600,
                    }}>
                      ⚠ {criticalCount} abnormal finding{criticalCount !== 1 ? 's' : ''} — complete full primary survey in the Trauma tab
                    </div>
                  )}
                </div>
              );
            })()}
          </CollapsibleCard>
        </div>
      )}

      {/* Clinical scores moved to Consultation → Assessment tab only */}

      {/* ── Compact triage summary — driven by intake data above ── */}
      <div style={{ order: cardOrder('triage') }}>
      {(() => {
        const r = triageResult;
        if (!r.acuity || r.acuity === 'routine') return null;
        const ACUITY_STYLE: Record<string, { bg: string; border: string; badge: string; text: string }> = {
          urgent:   { bg: '#fff1f2', border: '#fecdd3', badge: '#dc2626', text: '#7f1d1d' },
          priority: { bg: '#fff7ed', border: '#fed7aa', badge: '#ea580c', text: '#7c2d12' },
          review:   { bg: '#fefce8', border: '#fef08a', badge: '#ca8a04', text: '#713f12' },
        };
        const s = ACUITY_STYLE[r.acuity] ?? ACUITY_STYLE.review;
        const ACTION_LABELS: Record<string, string> = {
          emergency_now:    'Escalate now — emergency pathway',
          same_day_call:    'Same-day clinical call',
          priority_24_48h:  'Priority review in 24–48 hours',
          routine_booking:  'Routine booking',
        };
        return (
          <div style={{
            borderRadius: 10, border: `1px solid ${s.border}`,
            background: s.bg, padding: '12px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ flexShrink: 0 }}>
              <span style={{
                display: 'inline-block', borderRadius: 6,
                background: s.badge, color: '#fff',
                fontWeight: 800, fontSize: 11, letterSpacing: '0.07em',
                padding: '3px 9px', textTransform: 'uppercase',
              }}>
                {r.acuity} · {r.score}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.text, marginBottom: r.reasons.length ? 4 : 0 }}>
                {ACTION_LABELS[r.recommendedAction] ?? r.recommendedAction}
              </div>
              {r.reasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.reasons.map(reason => (
                    <span key={reason} style={{ fontSize: 11, color: s.text, background: s.border, borderRadius: 4, padding: '1px 7px' }}>
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </div>{/* end triage wrapper */}

    </div>
  );
}

// ── ERCP Pre-procedure Checklist ─────────────────────────────────────────────

export interface ErpcChecklistData {
  // Consent
  consentSigned: boolean;
  consentDate: string;
  // Coagulation / anticoagulation
  inrChecked: boolean;
  inrValue: string;
  anticoagulantHeld: boolean;
  anticoagulantDetails: string;
  // Fasting
  fastingHours: string;
  ivAccessInserted: boolean;
  // Allergies
  contrastAllergyReviewed: boolean;
  latexAllergyReviewed: boolean;
  // Antibiotics
  prophylacticAntibioticsGiven: boolean;
  antibioticDetails: string;
  // PEP prophylaxis (ESGE Grade A)
  indomethacinGiven: boolean;
  // Pre-op imaging / labs
  liverFunctionChecked: boolean;
  bilirubin: string;
  alkPhos: string;
  plateletCount: string;
  amylaseBaseline: string;
  mrcp: boolean;
  ultrasound: boolean;
  // Indication
  indication: string;
  // Anaesthesia
  anaesthesiaType: string;
  // Theatre checklist
  fluoroscopyAvailable: boolean;
  cSprayGiven: boolean;
  glucagonAvailable: boolean;
  // Notes
  notes: string;
}

function defaultErpcData(): ErpcChecklistData {
  return {
    consentSigned: false, consentDate: '',
    inrChecked: false, inrValue: '', anticoagulantHeld: false, anticoagulantDetails: '',
    fastingHours: '', ivAccessInserted: false,
    contrastAllergyReviewed: false, latexAllergyReviewed: false,
    prophylacticAntibioticsGiven: false, antibioticDetails: '',
    indomethacinGiven: false,
    liverFunctionChecked: false, bilirubin: '', alkPhos: '', plateletCount: '', amylaseBaseline: '', mrcp: false, ultrasound: false,
    indication: '', anaesthesiaType: 'sedation',
    fluoroscopyAvailable: false, cSprayGiven: false, glucagonAvailable: false,
    notes: '',
  };
}

const ERCP_ANAESTHESIA = [
  { value: 'sedation',  label: 'Conscious sedation' },
  { value: 'ga',        label: 'General anaesthesia' },
  { value: 'mac',       label: 'MAC / deep sedation' },
];

const ERCP_INDICATIONS = [
  'Choledocholithiasis', 'Cholangitis', 'Biliary stricture', 'Pancreatic duct pathology',
  'Biliary leak', 'Sphincterotomy / stenting', 'Tissue sampling', 'Other',
];

function ErpcChecklist({
  data: d,
  onChange,
}: {
  data: ErpcChecklistData;
  onChange: (next: ErpcChecklistData) => void;
}) {
  function set<K extends keyof ErpcChecklistData>(k: K, v: ErpcChecklistData[K]) {
    onChange({ ...d, [k]: v });
  }

  const missingCount = [
    !d.consentSigned,
    !d.inrChecked,
    !d.ivAccessInserted,
    !d.contrastAllergyReviewed,
    !d.fluoroscopyAvailable,
    !d.fastingHours,
    !d.indication,
    !d.indomethacinGiven,
  ].filter(Boolean).length;

  return (
    <CollapsibleCard
      title="ERCP pre-procedure checklist"
      badge={missingCount > 0 ? `${missingCount} incomplete` : 'Ready'}
      badgeVariant={missingCount > 0 ? 'warn' : 'default'}
      defaultOpen
    >
      {/* ── Indication ── */}
      <div className="fld">
        <label>Indication</label>
        <select value={d.indication} onChange={e => set('indication', e.target.value)}>
          <option value="">— Select —</option>
          {ERCP_INDICATIONS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div className="form-grid cols-2" style={{ marginTop: 10 }}>
        {/* ── Anaesthesia ── */}
        <div className="fld">
          <label>Anaesthesia type</label>
          <select value={d.anaesthesiaType} onChange={e => set('anaesthesiaType', e.target.value)}>
            {ERCP_ANAESTHESIA.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {/* ── Fasting ── */}
        <div className="fld">
          <label>Fasting duration (hours)</label>
          <input
            type="number" inputMode="numeric" min={0} max={72} step={1}
            value={d.fastingHours}
            onChange={e => set('fastingHours', e.target.value)}
            placeholder="e.g. 6"
          />
        </div>
      </div>

      {/* ── Consent ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Consent
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.consentSigned} onChange={e => set('consentSigned', e.target.checked)} />
            Signed consent obtained
          </label>
        </div>
        {d.consentSigned && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Consent date</label>
            <input type="date" value={d.consentDate} onChange={e => set('consentDate', e.target.value)} />
          </div>
        )}
      </div>

      {/* ── Coagulation ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Coagulation / Anticoagulation
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.inrChecked} onChange={e => set('inrChecked', e.target.checked)} />
            INR checked
          </label>
          <label>
            <input type="checkbox" checked={d.anticoagulantHeld} onChange={e => set('anticoagulantHeld', e.target.checked)} />
            Anticoagulant held / bridged
          </label>
        </div>
        <div className="form-grid cols-2" style={{ marginTop: 6 }}>
          <div className="fld">
            <label>INR value</label>
            <input
              type="number" inputMode="decimal" step={0.1} min={0} max={10}
              value={d.inrValue}
              onChange={e => set('inrValue', e.target.value)}
              placeholder="e.g. 1.1"
              className={d.inrValue && parseFloat(d.inrValue) > 1.5 ? 'warn' : ''}
            />
          </div>
          <div className="fld">
            <label>Anticoagulant details</label>
            <input value={d.anticoagulantDetails} onChange={e => set('anticoagulantDetails', e.target.value)} placeholder="e.g. Warfarin held ×5 days" />
          </div>
        </div>
      </div>

      {/* ── Liver function / imaging ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Pre-procedure investigations
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.liverFunctionChecked} onChange={e => set('liverFunctionChecked', e.target.checked)} />
            LFTs checked
          </label>
          <label>
            <input type="checkbox" checked={d.mrcp} onChange={e => set('mrcp', e.target.checked)} />
            MRCP reviewed
          </label>
          <label>
            <input type="checkbox" checked={d.ultrasound} onChange={e => set('ultrasound', e.target.checked)} />
            USS reviewed
          </label>
        </div>
        <div className="form-grid cols-2" style={{ marginTop: 6 }}>
          <div className="fld">
            <label>Bilirubin (µmol/L)</label>
            <input
              type="number" inputMode="decimal" step={1} min={0}
              value={d.bilirubin}
              onChange={e => set('bilirubin', e.target.value)}
              placeholder="e.g. 42"
              className={d.bilirubin && parseFloat(d.bilirubin) > 200 ? 'danger' : d.bilirubin && parseFloat(d.bilirubin) > 40 ? 'warn' : ''}
            />
          </div>
          <div className="fld">
            <label>ALP (U/L)</label>
            <input
              type="number" inputMode="decimal" step={1} min={0}
              value={d.alkPhos}
              onChange={e => set('alkPhos', e.target.value)}
              placeholder="e.g. 185"
              className={d.alkPhos && parseFloat(d.alkPhos) > 400 ? 'warn' : ''}
            />
          </div>
          <div className="fld">
            <label>Platelet count (×10⁹/L)</label>
            <input
              type="number" inputMode="decimal" step={1} min={0}
              value={d.plateletCount}
              onChange={e => set('plateletCount', e.target.value)}
              placeholder="e.g. 180"
              className={d.plateletCount && parseFloat(d.plateletCount) < 50 ? 'danger' : d.plateletCount && parseFloat(d.plateletCount) < 100 ? 'warn' : ''}
            />
          </div>
          <div className="fld">
            <label>Amylase baseline (U/L)</label>
            <input
              type="number" inputMode="decimal" step={1} min={0}
              value={d.amylaseBaseline}
              onChange={e => set('amylaseBaseline', e.target.value)}
              placeholder="e.g. 54"
            />
          </div>
        </div>
      </div>

      {/* ── Allergies ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Allergy review
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.contrastAllergyReviewed} onChange={e => set('contrastAllergyReviewed', e.target.checked)} />
            Contrast allergy reviewed
          </label>
          <label>
            <input type="checkbox" checked={d.latexAllergyReviewed} onChange={e => set('latexAllergyReviewed', e.target.checked)} />
            Latex allergy reviewed
          </label>
        </div>
      </div>

      {/* ── Antibiotics ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Prophylactic antibiotics
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.prophylacticAntibioticsGiven} onChange={e => set('prophylacticAntibioticsGiven', e.target.checked)} />
            Prophylactic antibiotics given
          </label>
        </div>
        {d.prophylacticAntibioticsGiven && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Antibiotic / dose / route</label>
            <input value={d.antibioticDetails} onChange={e => set('antibioticDetails', e.target.value)} placeholder="e.g. Co-amoxiclav 1.2 g IV" />
          </div>
        )}
      </div>

      {/* ── PEP prophylaxis — ESGE Grade A ── */}
      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(14,165,233,0.06)', border: '1px solid #bae6fd' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          PEP Prophylaxis — ESGE Grade A
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.indomethacinGiven} onChange={e => set('indomethacinGiven', e.target.checked)} />
            Rectal indomethacin 100 mg given
          </label>
        </div>
        <div style={{ fontSize: 11, color: '#0369a1', marginTop: 5, lineHeight: 1.45 }}>
          ESGE Grade A — reduces post-ERCP pancreatitis risk in all patients unless contraindicated (NSAID allergy, renal impairment, active peptic ulcer disease).
        </div>
      </div>

      {/* ── Theatre readiness ── */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Theatre / equipment readiness
        </div>
        <div className="check-row">
          <label>
            <input type="checkbox" checked={d.ivAccessInserted} onChange={e => set('ivAccessInserted', e.target.checked)} />
            IV access confirmed
          </label>
          <label>
            <input type="checkbox" checked={d.fluoroscopyAvailable} onChange={e => set('fluoroscopyAvailable', e.target.checked)} />
            Fluoroscopy / C-arm available
          </label>
          <label>
            <input type="checkbox" checked={d.cSprayGiven} onChange={e => set('cSprayGiven', e.target.checked)} />
            Throat spray given
          </label>
          <label>
            <input type="checkbox" checked={d.glucagonAvailable} onChange={e => set('glucagonAvailable', e.target.checked)} />
            Glucagon available
          </label>
        </div>
      </div>

      {/* ── Free notes ── */}
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Pre-procedure notes</label>
        <textarea
          value={d.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Additional pre-procedure notes or concerns…"
          style={{ minHeight: 60 }}
        />
      </div>
    </CollapsibleCard>
  );
}

// ─── Visit-type-specific intake checklists ────────────────────────────────────

// ── New Consult ───────────────────────────────────────────────────────────────
interface NewConsultData {
  referralUrgency: string;
  indication: string;
  referralQuestion: string;
  prevDocumentsReviewed: boolean;
  prevInvestigationsReviewed: boolean;
  insuranceVerified: boolean;
  insuranceDetails: string;
  notes: string;
}
function defaultNewConsult(): NewConsultData {
  return { referralUrgency: '', indication: '', referralQuestion: '', prevDocumentsReviewed: false, prevInvestigationsReviewed: false, insuranceVerified: false, insuranceDetails: '', notes: '' };
}
function NewConsultChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: NewConsultData = { ...defaultNewConsult(), ...(raw as Partial<NewConsultData> ?? {}) };
  function set<K extends keyof NewConsultData>(k: K, v: NewConsultData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.referralUrgency, !d.indication].filter(Boolean).length;
  return (
    <CollapsibleCard title="First consult — intake questionnaire" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="fld">
        <label>Referral urgency</label>
        <select value={d.referralUrgency} onChange={e => set('referralUrgency', e.target.value)}>
          <option value="">— Select —</option>
          {['Routine', '2-week wait (cancer pathway)', 'Urgent (within 2 weeks)', 'Same day / Emergency'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Indication / referring diagnosis</label>
        <input value={d.indication} onChange={e => set('indication', e.target.value)} placeholder="e.g. Right inguinal hernia, query appendicitis, new breast lump…" />
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Specific question from referrer</label>
        <input value={d.referralQuestion} onChange={e => set('referralQuestion', e.target.value)} placeholder="e.g. Please assess and advise on operative management…" />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Pre-consultation preparation
        </div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.prevDocumentsReviewed} onChange={e => set('prevDocumentsReviewed', e.target.checked)} />Prior letters / documents reviewed</label>
          <label><input type="checkbox" checked={d.prevInvestigationsReviewed} onChange={e => set('prevInvestigationsReviewed', e.target.checked)} />Prior investigations reviewed</label>
          <label><input type="checkbox" checked={d.insuranceVerified} onChange={e => set('insuranceVerified', e.target.checked)} />Insurance / funding verified</label>
        </div>
        {d.insuranceVerified && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Insurance / authorisation details</label>
            <input value={d.insuranceDetails} onChange={e => set('insuranceDetails', e.target.value)} placeholder="e.g. CLICO auth #12345, pre-approved for consultation" />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Admin notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Any other admin or clinical context relevant to this referral…" style={{ minHeight: 60 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Follow-up ─────────────────────────────────────────────────────────────────
interface FollowUpData {
  lastVisitDate: string;
  lastVisitOutcome: string;
  pendingResults: string;
  changesSinceLastVisit: string;
  patientConcerns: string;
  notes: string;
}
function defaultFollowUp(): FollowUpData {
  return { lastVisitDate: '', lastVisitOutcome: '', pendingResults: '', changesSinceLastVisit: '', patientConcerns: '', notes: '' };
}
function FollowUpChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: FollowUpData = { ...defaultFollowUp(), ...(raw as Partial<FollowUpData> ?? {}) };
  function set<K extends keyof FollowUpData>(k: K, v: FollowUpData[K]) { onChange({ ...d, [k]: v }); }
  return (
    <CollapsibleCard title="Follow-up — intake questionnaire" defaultOpen>
      <div className="form-grid cols-2">
        <div className="fld">
          <label>Last visit date</label>
          <input type="date" value={d.lastVisitDate} onChange={e => set('lastVisitDate', e.target.value)} />
        </div>
        <div className="fld">
          <label>Last visit outcome / plan</label>
          <input value={d.lastVisitOutcome} onChange={e => set('lastVisitOutcome', e.target.value)} placeholder="e.g. Watchful waiting, repeat USS in 3 months" />
        </div>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Pending results (labs / imaging not yet reviewed)</label>
        <input value={d.pendingResults} onChange={e => set('pendingResults', e.target.value)} placeholder="e.g. CT abdomen ordered, histology from 28 June biopsy" />
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Changes / new symptoms since last visit</label>
        <textarea value={d.changesSinceLastVisit} onChange={e => set('changesSinceLastVisit', e.target.value)} placeholder="Any new or worsening symptoms since the last appointment…" style={{ minHeight: 60 }} />
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Patient concerns for today's visit</label>
        <input value={d.patientConcerns} onChange={e => set('patientConcerns', e.target.value)} placeholder="e.g. Worried about pathology result, pain not improving" />
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Admin notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Scheduling notes, insurance, transport requirements…" style={{ minHeight: 40 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Post-op Review ────────────────────────────────────────────────────────────
interface PostOpData {
  procedurePerformed: string;
  procedureDate: string;
  woundStatus: string;
  drainPresent: boolean;
  drainOutput: string;
  bowelFunctionRestored: boolean;
  histoResultAvailable: boolean;
  histoResult: string;
  notes: string;
}
function defaultPostOp(): PostOpData {
  return { procedurePerformed: '', procedureDate: '', woundStatus: '', drainPresent: false, drainOutput: '', bowelFunctionRestored: false, histoResultAvailable: false, histoResult: '', notes: '' };
}
function PostOpChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: PostOpData = { ...defaultPostOp(), ...(raw as Partial<PostOpData> ?? {}) };
  function set<K extends keyof PostOpData>(k: K, v: PostOpData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.procedurePerformed, !d.procedureDate, !d.woundStatus].filter(Boolean).length;
  const daysPostOp = d.procedureDate
    ? Math.max(0, Math.floor((new Date().setHours(0,0,0,0) - new Date(d.procedureDate).setHours(0,0,0,0)) / 86_400_000))
    : null;
  return (
    <CollapsibleCard title="Post-op review — intake questionnaire" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="form-grid cols-2">
        <div className="fld">
          <label>Procedure performed</label>
          <input value={d.procedurePerformed} onChange={e => set('procedurePerformed', e.target.value)} placeholder="e.g. Laparoscopic cholecystectomy" />
        </div>
        <div className="fld">
          <label>Date of surgery</label>
          <input type="date" value={d.procedureDate} onChange={e => set('procedureDate', e.target.value)} />
          {daysPostOp !== null && (
            <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'block' }}>
              Day {daysPostOp} post-operative
            </span>
          )}
        </div>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Wound status</label>
        <select value={d.woundStatus} onChange={e => set('woundStatus', e.target.value)}>
          <option value="">— Select —</option>
          {['Healing well', 'Seroma', 'Superficial wound infection', 'Deep surgical site infection', 'Wound dehiscence', 'Wound open / packing', 'Not yet assessed'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Recovery status
        </div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.bowelFunctionRestored} onChange={e => set('bowelFunctionRestored', e.target.checked)} />Bowel function restored</label>
          <label><input type="checkbox" checked={d.drainPresent} onChange={e => set('drainPresent', e.target.checked)} />Surgical drain in situ</label>
          <label><input type="checkbox" checked={d.histoResultAvailable} onChange={e => set('histoResultAvailable', e.target.checked)} />Histology result available</label>
        </div>
        {d.drainPresent && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Drain output (volume / character)</label>
            <input value={d.drainOutput} onChange={e => set('drainOutput', e.target.value)} placeholder="e.g. 30 mL/day, serous" />
          </div>
        )}
        {d.histoResultAvailable && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Histology result summary</label>
            <textarea value={d.histoResult} onChange={e => set('histoResult', e.target.value)} placeholder="e.g. Chronic cholecystitis with cholesterol polyps — no malignancy" style={{ minHeight: 50 }} />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Admin / clinical notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Suture removal, district nurse, GP notification, outstanding results…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── OGD ───────────────────────────────────────────────────────────────────────
const OGD_INDICATIONS = [
  'Dyspepsia unresponsive to treatment', 'Dysphagia / odynophagia', 'Upper GI bleed / haematemesis',
  'Iron-deficiency anaemia', 'Unexplained weight loss', 'Reflux — further assessment',
  "Barrett's surveillance", 'Coeliac screen / duodenal biopsy',
  'Gastric ulcer — surveillance', 'H. pylori CLO test', 'Other',
];
interface OgdData {
  indication: string;
  fastingHours: string;
  fastingCompliant: boolean;
  ivAccessInserted: boolean;
  anticoagulantReviewed: boolean;
  anticoagulantDetails: string;
  allergyReviewed: boolean;
  consentSigned: boolean;
  consentDate: string;
  sedationType: string;
  cSprayGiven: boolean;
  scopeAvailable: boolean;
  biopsyForcepsAvailable: boolean;
  notes: string;
}
function defaultOgd(): OgdData {
  return { indication: '', fastingHours: '', fastingCompliant: false, ivAccessInserted: false, anticoagulantReviewed: false, anticoagulantDetails: '', allergyReviewed: false, consentSigned: false, consentDate: '', sedationType: 'throat_spray', cSprayGiven: false, scopeAvailable: false, biopsyForcepsAvailable: false, notes: '' };
}
function OgdChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: OgdData = { ...defaultOgd(), ...(raw as Partial<OgdData> ?? {}) };
  function set<K extends keyof OgdData>(k: K, v: OgdData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.indication, !d.fastingHours, !d.consentSigned, !d.allergyReviewed, !d.scopeAvailable].filter(Boolean).length;
  return (
    <CollapsibleCard title="OGD — pre-procedure checklist" badge={missing > 0 ? `${missing} incomplete` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="fld">
        <label>Indication</label>
        <select value={d.indication} onChange={e => set('indication', e.target.value)}>
          <option value="">— Select —</option>
          {OGD_INDICATIONS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="form-grid cols-2" style={{ marginTop: 8 }}>
        <div className="fld">
          <label>Fasting duration (hours)</label>
          <input type="number" inputMode="numeric" min={0} max={24} value={d.fastingHours} onChange={e => set('fastingHours', e.target.value)} placeholder="e.g. 6" />
          {d.fastingHours && parseFloat(d.fastingHours) < 6 && (
            <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>⚠ Minimum 6 h solids / 2 h clear fluids</span>
          )}
        </div>
        <div className="fld">
          <label>Sedation / anaesthesia</label>
          <select value={d.sedationType} onChange={e => set('sedationType', e.target.value)}>
            <option value="throat_spray">Throat spray only</option>
            <option value="sedation">Conscious sedation (midazolam)</option>
            <option value="mac">MAC / deep sedation</option>
            <option value="ga">General anaesthesia</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Pre-procedure checks
        </div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.consentSigned} onChange={e => set('consentSigned', e.target.checked)} />Signed consent obtained</label>
          <label><input type="checkbox" checked={d.allergyReviewed} onChange={e => set('allergyReviewed', e.target.checked)} />Allergy status reviewed</label>
          <label><input type="checkbox" checked={d.anticoagulantReviewed} onChange={e => set('anticoagulantReviewed', e.target.checked)} />Anticoagulants reviewed</label>
          <label><input type="checkbox" checked={d.fastingCompliant} onChange={e => set('fastingCompliant', e.target.checked)} />Fasting confirmed by patient</label>
          <label><input type="checkbox" checked={d.ivAccessInserted} onChange={e => set('ivAccessInserted', e.target.checked)} />IV access in situ</label>
          <label><input type="checkbox" checked={d.cSprayGiven} onChange={e => set('cSprayGiven', e.target.checked)} />Throat spray given</label>
          <label><input type="checkbox" checked={d.scopeAvailable} onChange={e => set('scopeAvailable', e.target.checked)} />Gastroscope available &amp; checked</label>
          <label><input type="checkbox" checked={d.biopsyForcepsAvailable} onChange={e => set('biopsyForcepsAvailable', e.target.checked)} />Biopsy forceps available</label>
        </div>
        {d.anticoagulantReviewed && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Anticoagulant details (if any)</label>
            <input value={d.anticoagulantDetails} onChange={e => set('anticoagulantDetails', e.target.value)} placeholder="e.g. Warfarin held ×5 days, INR 1.2 — or — Not on anticoagulants" />
          </div>
        )}
        {d.consentSigned && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Consent date</label>
            <input type="date" value={d.consentDate} onChange={e => set('consentDate', e.target.value)} />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Pre-procedure notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes or concerns…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Colonoscopy ───────────────────────────────────────────────────────────────
const COL_INDICATIONS = [
  'Colorectal cancer screening', 'Polyp surveillance', 'Change in bowel habit', 'Rectal bleeding',
  'Iron-deficiency anaemia', 'IBD — assessment', 'IBD — surveillance',
  'Diverticular disease', 'Lower GI bleed', 'Incomplete colonoscopy follow-up', 'Other',
];
const PREP_AGENTS = ['Moviprep (PEG)', 'Klean-Prep (PEG)', 'Picolax / Picoprep', 'Fleet Phospho-Soda', 'Dulcolax + low-residue diet', 'Other'];
interface ColonoscopyData {
  indication: string;
  prepAgent: string;
  prepCompleted: boolean;
  prepQuality: string;
  lowResidueDiet: boolean;
  fastingHours: string;
  fastingCompliant: boolean;
  ivAccessInserted: boolean;
  anticoagulantReviewed: boolean;
  anticoagulantDetails: string;
  consentSigned: boolean;
  consentDate: string;
  sedationType: string;
  diathermyAvailable: boolean;
  notes: string;
}
function defaultColonoscopy(): ColonoscopyData {
  return { indication: '', prepAgent: '', prepCompleted: false, prepQuality: '', lowResidueDiet: false, fastingHours: '', fastingCompliant: false, ivAccessInserted: false, anticoagulantReviewed: false, anticoagulantDetails: '', consentSigned: false, consentDate: '', sedationType: 'sedation', diathermyAvailable: false, notes: '' };
}
function ColonoscopyChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: ColonoscopyData = { ...defaultColonoscopy(), ...(raw as Partial<ColonoscopyData> ?? {}) };
  function set<K extends keyof ColonoscopyData>(k: K, v: ColonoscopyData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.indication, !d.prepAgent, !d.consentSigned, !d.fastingHours].filter(Boolean).length;
  return (
    <CollapsibleCard title="Colonoscopy — pre-procedure checklist" badge={missing > 0 ? `${missing} incomplete` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="fld">
        <label>Indication</label>
        <select value={d.indication} onChange={e => set('indication', e.target.value)}>
          <option value="">— Select —</option>
          {COL_INDICATIONS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="form-grid cols-2" style={{ marginTop: 8 }}>
        <div className="fld">
          <label>Bowel prep agent</label>
          <select value={d.prepAgent} onChange={e => set('prepAgent', e.target.value)}>
            <option value="">— Select —</option>
            {PREP_AGENTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Patient-reported prep quality</label>
          <select value={d.prepQuality} onChange={e => set('prepQuality', e.target.value)}>
            <option value="">— Unknown —</option>
            {['Excellent (clear yellow fluid)', 'Good (only clear fluid)', 'Fair (some solid visible)', 'Poor (significant solid/brown)', 'Not yet completed'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Fasting duration (hours)</label>
          <input type="number" inputMode="numeric" min={0} max={24} value={d.fastingHours} onChange={e => set('fastingHours', e.target.value)} placeholder="e.g. 4" />
        </div>
        <div className="fld">
          <label>Sedation / anaesthesia</label>
          <select value={d.sedationType} onChange={e => set('sedationType', e.target.value)}>
            <option value="sedation">Conscious sedation</option>
            <option value="mac">MAC / deep sedation</option>
            <option value="ga">General anaesthesia</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Pre-procedure checks</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.prepCompleted} onChange={e => set('prepCompleted', e.target.checked)} />Bowel prep completed</label>
          <label><input type="checkbox" checked={d.lowResidueDiet} onChange={e => set('lowResidueDiet', e.target.checked)} />Low-residue diet followed (day before)</label>
          <label><input type="checkbox" checked={d.fastingCompliant} onChange={e => set('fastingCompliant', e.target.checked)} />Fasting confirmed by patient</label>
          <label><input type="checkbox" checked={d.consentSigned} onChange={e => set('consentSigned', e.target.checked)} />Signed consent obtained</label>
          <label><input type="checkbox" checked={d.anticoagulantReviewed} onChange={e => set('anticoagulantReviewed', e.target.checked)} />Anticoagulants reviewed</label>
          <label><input type="checkbox" checked={d.ivAccessInserted} onChange={e => set('ivAccessInserted', e.target.checked)} />IV access in situ</label>
          <label><input type="checkbox" checked={d.diathermyAvailable} onChange={e => set('diathermyAvailable', e.target.checked)} />Diathermy / polypectomy kit available</label>
        </div>
        {d.anticoagulantReviewed && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Anticoagulant details (if any)</label>
            <input value={d.anticoagulantDetails} onChange={e => set('anticoagulantDetails', e.target.value)} placeholder="e.g. Apixaban held ×48 h — or — Not on anticoagulants" />
          </div>
        )}
        {d.consentSigned && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Consent date</label>
            <input type="date" value={d.consentDate} onChange={e => set('consentDate', e.target.value)} />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Pre-procedure notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional prep notes, patient concerns, theatre requests…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Breast Clinic ─────────────────────────────────────────────────────────────
interface BreastData {
  presentingFeature: string;
  side: string;
  durationWeeks: string;
  mammogramDone: boolean;
  mammogramDate: string;
  mammogramResult: string;
  ussDone: boolean;
  ussResult: string;
  familyHistoryBC: boolean;
  brcaKnown: boolean;
  brcaType: string;
  hrtOcp: boolean;
  priorBiopsy: boolean;
  priorBiopsyResult: string;
  tripleAssessmentComplete: boolean;
  notes: string;
}
function defaultBreast(): BreastData {
  return { presentingFeature: '', side: '', durationWeeks: '', mammogramDone: false, mammogramDate: '', mammogramResult: '', ussDone: false, ussResult: '', familyHistoryBC: false, brcaKnown: false, brcaType: '', hrtOcp: false, priorBiopsy: false, priorBiopsyResult: '', tripleAssessmentComplete: false, notes: '' };
}
function BreastChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: BreastData = { ...defaultBreast(), ...(raw as Partial<BreastData> ?? {}) };
  function set<K extends keyof BreastData>(k: K, v: BreastData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.presentingFeature, !d.side].filter(Boolean).length;
  return (
    <CollapsibleCard title="Breast clinic — intake questionnaire" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="form-grid cols-2">
        <div className="fld">
          <label>Presenting feature</label>
          <select value={d.presentingFeature} onChange={e => set('presentingFeature', e.target.value)}>
            <option value="">— Select —</option>
            {['Lump / mass', 'Breast pain', 'Nipple discharge', 'Skin change / dimpling', 'Nipple retraction / inversion', 'Screen-detected / incidental', 'Follow-up / surveillance'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Side</label>
          <select value={d.side} onChange={e => set('side', e.target.value)}>
            <option value="">— Select —</option>
            {['Left', 'Right', 'Both', 'N/A (systemic / screen)'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Duration (weeks)</label>
          <input type="number" inputMode="numeric" min={0} value={d.durationWeeks} onChange={e => set('durationWeeks', e.target.value)} placeholder="e.g. 6" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Imaging</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.mammogramDone} onChange={e => set('mammogramDone', e.target.checked)} />Mammogram performed</label>
          <label><input type="checkbox" checked={d.ussDone} onChange={e => set('ussDone', e.target.checked)} />USS breast performed</label>
          <label><input type="checkbox" checked={d.tripleAssessmentComplete} onChange={e => set('tripleAssessmentComplete', e.target.checked)} />Triple assessment complete</label>
        </div>
        {d.mammogramDone && (
          <div className="form-grid cols-2" style={{ marginTop: 6 }}>
            <div className="fld">
              <label>Mammogram date</label>
              <input type="date" value={d.mammogramDate} onChange={e => set('mammogramDate', e.target.value)} />
            </div>
            <div className="fld">
              <label>Mammogram result / BI-RADS</label>
              <input value={d.mammogramResult} onChange={e => set('mammogramResult', e.target.value)} placeholder="e.g. BI-RADS 4 — suspicious calcifications" />
            </div>
          </div>
        )}
        {d.ussDone && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>USS result</label>
            <input value={d.ussResult} onChange={e => set('ussResult', e.target.value)} placeholder="e.g. 18 mm hypoechoic lesion, irregular margins, left UOQ" />
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Risk factors</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.familyHistoryBC} onChange={e => set('familyHistoryBC', e.target.checked)} />1st-degree family history of breast cancer</label>
          <label><input type="checkbox" checked={d.brcaKnown} onChange={e => set('brcaKnown', e.target.checked)} />Known BRCA mutation</label>
          <label><input type="checkbox" checked={d.hrtOcp} onChange={e => set('hrtOcp', e.target.checked)} />Current / recent HRT or OCP</label>
          <label><input type="checkbox" checked={d.priorBiopsy} onChange={e => set('priorBiopsy', e.target.checked)} />Prior breast biopsy</label>
        </div>
        {d.brcaKnown && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>BRCA type</label>
            <select value={d.brcaType} onChange={e => set('brcaType', e.target.value)}>
              <option value="">— Unknown —</option>
              {['BRCA1', 'BRCA2', 'Other (PALB2 / CHEK2 / ATM)', 'Awaiting result'].map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        {d.priorBiopsy && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Prior biopsy result</label>
            <input value={d.priorBiopsyResult} onChange={e => set('priorBiopsyResult', e.target.value)} placeholder="e.g. Fibroadenoma, ADH, LCIS" />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Additional notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Cosmetic concerns, family support, transport, language needs…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Telephone ─────────────────────────────────────────────────────────────────
interface TelephoneData {
  callReason: string;
  urgency: string;
  outcome: string;
  outcomeDetails: string;
  callbackRequired: boolean;
  callbackDate: string;
  notes: string;
}
function defaultTelephone(): TelephoneData {
  return { callReason: '', urgency: '', outcome: '', outcomeDetails: '', callbackRequired: false, callbackDate: '', notes: '' };
}
function TelephoneChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: TelephoneData = { ...defaultTelephone(), ...(raw as Partial<TelephoneData> ?? {}) };
  function set<K extends keyof TelephoneData>(k: K, v: TelephoneData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.callReason, !d.outcome].filter(Boolean).length;
  return (
    <CollapsibleCard title="Telephone consultation — intake record" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="fld">
        <label>Reason for call</label>
        <textarea value={d.callReason} onChange={e => set('callReason', e.target.value)} placeholder="Brief description of why the patient / referrer is calling…" style={{ minHeight: 60 }} />
      </div>
      <div className="form-grid cols-2" style={{ marginTop: 8 }}>
        <div className="fld">
          <label>Urgency</label>
          <select value={d.urgency} onChange={e => set('urgency', e.target.value)}>
            <option value="">— Select —</option>
            {['Routine — non-urgent query', 'Moderately urgent — review within 24–48 h', 'Urgent — same-day review required', 'Emergency — referred to ER'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Outcome / action taken</label>
          <select value={d.outcome} onChange={e => set('outcome', e.target.value)}>
            <option value="">— Select —</option>
            {['Advice given — no further action', 'Follow-up appointment booked', 'Referred to ER / Emergency services', 'Prescription issued', 'Investigation ordered', 'Callback needed — await further info', 'Escalated to Dr Kabiye'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Outcome details</label>
        <textarea value={d.outcomeDetails} onChange={e => set('outcomeDetails', e.target.value)} placeholder="Summary of advice given, appointment arranged, or actions taken…" style={{ minHeight: 50 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="check-row">
          <label><input type="checkbox" checked={d.callbackRequired} onChange={e => set('callbackRequired', e.target.checked)} />Callback required</label>
        </div>
        {d.callbackRequired && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Callback by (date)</label>
            <input type="date" value={d.callbackDate} onChange={e => set('callbackDate', e.target.value)} />
          </div>
        )}
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Additional notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Any further context or follow-up instructions…" style={{ minHeight: 40 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Diabetic Foot ─────────────────────────────────────────────────────────────
const WAGNER_GRADES = [
  '0 — No open lesion; pre/post-ulcerative',
  '1 — Superficial ulcer (skin / subcutaneous)',
  '2 — Deep ulcer (tendon, capsule, or bone)',
  '3 — Ulcer with osteomyelitis or abscess',
  '4 — Forefoot / partial foot gangrene',
  '5 — Whole foot / extensive gangrene',
];
interface DiabeticFootData {
  woundSite: string;
  wagnerGrade: string;
  woundSizeCm: string;
  infectionPresent: boolean;
  infectionSeverity: string;
  abpiDone: boolean;
  abpiValue: string;
  pulsesPalpable: boolean;
  vascularReferralNeeded: boolean;
  neuropathyAssessed: boolean;
  monofilamentLoss: boolean;
  offloadingDevice: string;
  boneInvolvementSuspected: boolean;
  xrayOrdered: boolean;
  mriOrdered: boolean;
  hba1c: string;
  crp: string;
  wcc: string;
  notes: string;
}
function defaultDiabeticFoot(): DiabeticFootData {
  return { woundSite: '', wagnerGrade: '', woundSizeCm: '', infectionPresent: false, infectionSeverity: '', abpiDone: false, abpiValue: '', pulsesPalpable: false, vascularReferralNeeded: false, neuropathyAssessed: false, monofilamentLoss: false, offloadingDevice: '', boneInvolvementSuspected: false, xrayOrdered: false, mriOrdered: false, hba1c: '', crp: '', wcc: '', notes: '' };
}
function DiabeticFootChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const d: DiabeticFootData = { ...defaultDiabeticFoot(), ...(raw as Partial<DiabeticFootData> ?? {}) };
  function set<K extends keyof DiabeticFootData>(k: K, v: DiabeticFootData[K]) { onChange({ ...d, [k]: v }); }
  const missing = [!d.woundSite, !d.wagnerGrade].filter(Boolean).length;
  return (
    <CollapsibleCard title="Diabetic foot — intake assessment" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div className="form-grid cols-2">
        <div className="fld">
          <label>Wound site</label>
          <select value={d.woundSite} onChange={e => set('woundSite', e.target.value)}>
            <option value="">— Select —</option>
            {['Toe / digit', 'Forefoot / metatarsal heads', 'Heel', 'Dorsum of foot', 'Plantar / sole', 'Multiple sites', 'Whole foot'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Wagner grade</label>
          <select value={d.wagnerGrade} onChange={e => set('wagnerGrade', e.target.value)}>
            <option value="">— Select —</option>
            {WAGNER_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Wound dimensions</label>
          <input value={d.woundSizeCm} onChange={e => set('woundSizeCm', e.target.value)} placeholder="e.g. 3 × 2 cm, depth 0.5 cm" />
        </div>
        <div className="fld">
          <label>Offloading device</label>
          <select value={d.offloadingDevice} onChange={e => set('offloadingDevice', e.target.value)}>
            <option value="">— Select —</option>
            {['None', 'Total contact cast (TCC)', 'Removable CAM walker', 'Half-shoe / heel relief shoe', 'Custom insole / footwear', 'Wheelchair / non-weight-bearing', 'Bed rest'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Infection</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.infectionPresent} onChange={e => set('infectionPresent', e.target.checked)} />Infection present</label>
        </div>
        {d.infectionPresent && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Infection severity (IDSA / IWGDF)</label>
            <select value={d.infectionSeverity} onChange={e => set('infectionSeverity', e.target.value)}>
              <option value="">— Select —</option>
              {['Mild (local, ≤ 2 cm, no systemic signs)', 'Moderate (> 2 cm / deep, no systemic signs)', 'Severe (systemic inflammatory response present)'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Vascular assessment</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.pulsesPalpable} onChange={e => set('pulsesPalpable', e.target.checked)} />Pedal pulses palpable (DP + PT)</label>
          <label><input type="checkbox" checked={d.abpiDone} onChange={e => set('abpiDone', e.target.checked)} />ABPI measured</label>
          <label><input type="checkbox" checked={d.vascularReferralNeeded} onChange={e => set('vascularReferralNeeded', e.target.checked)} />Vascular referral required</label>
        </div>
        {d.abpiDone && (
          <div className="fld" style={{ marginTop: 6 }}>
            <label>ABPI value</label>
            <input type="number" inputMode="decimal" step={0.01} min={0} max={2} value={d.abpiValue} onChange={e => set('abpiValue', e.target.value)} placeholder="e.g. 0.85"
              className={d.abpiValue && parseFloat(d.abpiValue) < 0.5 ? 'danger' : d.abpiValue && parseFloat(d.abpiValue) < 0.8 ? 'warn' : ''} />
            {d.abpiValue && parseFloat(d.abpiValue) < 0.5 && <span style={{ fontSize: 11, color: '#dc2626', marginTop: 2, display: 'block' }}>⚠ Critical ischaemia — urgent vascular review</span>}
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Neuropathy &amp; imaging</div>
        <div className="check-row">
          <label><input type="checkbox" checked={d.neuropathyAssessed} onChange={e => set('neuropathyAssessed', e.target.checked)} />Neuropathy assessed</label>
          <label><input type="checkbox" checked={d.monofilamentLoss} onChange={e => set('monofilamentLoss', e.target.checked)} />10 g monofilament sensation lost</label>
          <label><input type="checkbox" checked={d.boneInvolvementSuspected} onChange={e => set('boneInvolvementSuspected', e.target.checked)} />Bone involvement suspected (probe-to-bone +ve)</label>
          <label><input type="checkbox" checked={d.xrayOrdered} onChange={e => set('xrayOrdered', e.target.checked)} />X-ray of foot ordered</label>
          <label><input type="checkbox" checked={d.mriOrdered} onChange={e => set('mriOrdered', e.target.checked)} />MRI foot ordered</label>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Bloods</div>
        <div className="form-grid cols-2">
          <div className="fld">
            <label>HbA1c (%)</label>
            <input type="number" inputMode="decimal" step={0.1} value={d.hba1c} onChange={e => set('hba1c', e.target.value)} placeholder="e.g. 9.2"
              className={d.hba1c && parseFloat(d.hba1c) > 10 ? 'danger' : d.hba1c && parseFloat(d.hba1c) > 8 ? 'warn' : ''} />
          </div>
          <div className="fld">
            <label>CRP (mg/L)</label>
            <input type="number" inputMode="decimal" step={1} value={d.crp} onChange={e => set('crp', e.target.value)} placeholder="e.g. 48"
              className={d.crp && parseFloat(d.crp) > 100 ? 'danger' : d.crp && parseFloat(d.crp) > 20 ? 'warn' : ''} />
          </div>
          <div className="fld">
            <label>WCC (×10⁹/L)</label>
            <input type="number" inputMode="decimal" step={0.1} value={d.wcc} onChange={e => set('wcc', e.target.value)} placeholder="e.g. 14.2"
              className={d.wcc && parseFloat(d.wcc) > 20 ? 'danger' : d.wcc && parseFloat(d.wcc) > 11 ? 'warn' : ''} />
          </div>
        </div>
      </div>
      <div className="fld" style={{ marginTop: 10 }}>
        <label>Additional notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="MDT referrals, diabetes team, podiatry, tissue viability nurse, social needs…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Urgent Referral ───────────────────────────────────────────────────────────
const URGENT_RED_FLAGS = [
  'Unintentional weight loss',
  'Progressive dysphagia',
  'Haematemesis / melaena',
  'Iron-deficiency anaemia (new)',
  'New-onset rectal bleeding (age > 40)',
  'Change in bowel habit (> 6 weeks)',
  'Palpable abdominal mass',
  'New painless jaundice',
  'Unexplained abdominal pain (age > 55)',
  'Haematuria (unexplained)',
  'Rapidly expanding lump / lymphadenopathy',
  'Suspected testicular / ovarian torsion',
];
interface UrgentData {
  redFlags: string[];
  timeToSymptoms: string;
  referralSource: string;
  referralUrgency: string;
  workingDx: string;
  investigationsDone: string;
  recommendedAction: string;
  notes: string;
}
function defaultUrgent(): UrgentData {
  return { redFlags: [], timeToSymptoms: '', referralSource: '', referralUrgency: '', workingDx: '', investigationsDone: '', recommendedAction: '', notes: '' };
}
function UrgentChecklist({ data: raw, onChange }: { data: unknown; onChange: (d: unknown) => void }) {
  const rawTyped = raw as Partial<UrgentData> | null | undefined;
  const d: UrgentData = { ...defaultUrgent(), ...rawTyped, redFlags: rawTyped?.redFlags ?? [] };
  function set<K extends keyof UrgentData>(k: K, v: UrgentData[K]) { onChange({ ...d, [k]: v }); }
  function toggleFlag(flag: string) {
    const next = d.redFlags.includes(flag) ? d.redFlags.filter(f => f !== flag) : [...d.redFlags, flag];
    set('redFlags', next);
  }
  const missing = [!d.referralSource, !d.referralUrgency, !d.recommendedAction].filter(Boolean).length;
  return (
    <CollapsibleCard title="Urgent referral — intake checklist" badge={missing > 0 ? `${missing} required` : 'Ready'} badgeVariant={missing > 0 ? 'warn' : 'default'} defaultOpen>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Red flag symptoms present</div>
        <div className="check-row" style={{ flexWrap: 'wrap' }}>
          {URGENT_RED_FLAGS.map(flag => (
            <label key={flag}>
              <input type="checkbox" checked={d.redFlags.includes(flag)} onChange={() => toggleFlag(flag)} />
              {flag}
            </label>
          ))}
        </div>
        {d.redFlags.length > 0 && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 7, background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 11, color: '#7f1d1d', fontWeight: 600 }}>
            ⚠ {d.redFlags.length} red flag{d.redFlags.length !== 1 ? 's' : ''} identified — expedited review required
          </div>
        )}
      </div>
      <div className="form-grid cols-2">
        <div className="fld">
          <label>Referral source</label>
          <select value={d.referralSource} onChange={e => set('referralSource', e.target.value)}>
            <option value="">— Select —</option>
            {['Emergency Department', 'GP / Family physician', 'Self-referral', 'Other specialist', 'Inter-hospital transfer', 'Community health centre'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Referral urgency required</label>
          <select value={d.referralUrgency} onChange={e => set('referralUrgency', e.target.value)}>
            <option value="">— Select —</option>
            {['Same day / Emergency', '24 hours', '48 hours', '2-week wait (cancer pathway)', '4 weeks'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="fld">
          <label>Duration of symptoms</label>
          <input value={d.timeToSymptoms} onChange={e => set('timeToSymptoms', e.target.value)} placeholder="e.g. 3 weeks, 5 months" />
        </div>
        <div className="fld">
          <label>Working diagnosis / query</label>
          <input value={d.workingDx} onChange={e => set('workingDx', e.target.value)} placeholder="e.g. ? colorectal cancer, ? acute cholecystitis" />
        </div>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Investigations already performed</label>
        <input value={d.investigationsDone} onChange={e => set('investigationsDone', e.target.value)} placeholder="e.g. FBC — Hb 8.4, USS abdomen — gallstones, CEA 12" />
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Recommended action</label>
        <select value={d.recommendedAction} onChange={e => set('recommendedAction', e.target.value)}>
          <option value="">— Select —</option>
          {['Book urgent outpatient clinic', 'Direct to Emergency Room', 'Admit under surgical team', 'Phone triage by Dr Kabiye', 'Await further investigations', 'Refer to another speciality'].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="fld" style={{ marginTop: 8 }}>
        <label>Additional notes</label>
        <textarea value={d.notes} onChange={e => set('notes', e.target.value)} placeholder="Any other relevant clinical or social context…" style={{ minHeight: 50 }} />
      </div>
    </CollapsibleCard>
  );
}

// ── Visit checklist dispatcher ────────────────────────────────────────────────
function VisitChecklist({ visitType, data, onChange }: {
  visitType: string;
  data: unknown;
  onChange: (d: unknown) => void;
}) {
  switch (visitType) {
    case 'new_consult':    return <NewConsultChecklist data={data} onChange={onChange} />;
    case 'follow_up':     return <FollowUpChecklist data={data} onChange={onChange} />;
    case 'post_op':       return <PostOpChecklist data={data} onChange={onChange} />;
    case 'endoscopy_ogd': return <OgdChecklist data={data} onChange={onChange} />;
    case 'endoscopy_col': return <ColonoscopyChecklist data={data} onChange={onChange} />;
    case 'breast':        return <BreastChecklist data={data} onChange={onChange} />;
    case 'telephone':     return <TelephoneChecklist data={data} onChange={onChange} />;
    case 'diabetic_foot': return <DiabeticFootChecklist data={data} onChange={onChange} />;
    case 'urgent':        return <UrgentChecklist data={data} onChange={onChange} />;
    default: return null;
  }
}
