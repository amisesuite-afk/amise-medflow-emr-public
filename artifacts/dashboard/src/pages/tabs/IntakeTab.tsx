import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import PathwaySuggestions from '@/components/PathwaySuggestions';
import SmartSymptomPicker from '@/components/SmartSymptomPicker';
import { VitalSigns } from '@/lib/adaptive-triage';
import { SL_COMMUNITIES, SL_DOCTORS, formatSlPhone, isValidSlPhone } from '@/data/st-lucia';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';

const VITAL_KEYS: { key: keyof VitalSigns; label: string; placeholder: string }[] = [
  { key: 'systolicBp',     label: 'SBP',      placeholder: '120' },
  { key: 'diastolicBp',    label: 'DBP',      placeholder: '80'  },
  { key: 'heartRate',      label: 'HR',       placeholder: '88'  },
  { key: 'temperatureC',   label: 'Temp °C',  placeholder: '37.0'},
  { key: 'respiratoryRate',label: 'RR',       placeholder: '16'  },
  { key: 'spo2',           label: 'SpO₂ %',  placeholder: '98'  },
  { key: 'glucoseMmol',    label: 'RBS',      placeholder: '6.4' },
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
    currentSite,
  } = useAppContext();

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

  const filteredDoctors = referralQuery.trim().length === 0
    ? SL_DOCTORS.slice(0, 8)
    : SL_DOCTORS.filter(d =>
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
      {/* Patient demographics */}
      <CollapsibleCard title="Patient" badge={triageResult.missingCriticalFields.length > 0 ? `${triageResult.missingCriticalFields.length} missing` : undefined} badgeVariant={triageResult.missingCriticalFields.length > 0 ? 'warn' : 'default'}>
        <div className="form-grid">
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
            <select value={sex} onChange={e => setSex(e.target.value as any)}>
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
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                maxHeight: 220,
                overflowY: 'auto',
                marginTop: 2,
              }}>
                {filteredCommunities.map(c => (
                  <button
                    key={`${c.quarter}-${c.community}`}
                    type="button"
                    onMouseDown={() => selectCommunity(c)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '7px 12px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: 13,
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
            {referralOpen && filteredDoctors.length > 0 && referralQuery.trim().length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                maxHeight: 220,
                overflowY: 'auto',
                marginTop: 2,
              }}>
                {filteredDoctors.map(d => (
                  <button
                    key={d.name}
                    type="button"
                    onMouseDown={() => { setReferredBy(d.name); setReferralQuery(d.name); setReferralOpen(false); }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      padding: '7px 12px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{d.specialty} · {d.institution}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="fld">
            <label>Duration (days)</label>
            <input inputMode="numeric" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="e.g. 3" />
          </div>
          <div className="fld">
            <label>Pain score (0–10)</label>
            <input inputMode="numeric" value={painScore} onChange={e => setPainScore(e.target.value)} placeholder="0–10"
              className={painScore && Number(painScore) >= 8 ? 'danger' : painScore && Number(painScore) >= 5 ? 'warn' : ''} />
          </div>
        </div>
        <div className="check-row" style={{ marginTop: 10 }}>
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
              <input inputMode="numeric" value={postOpDays} onChange={e => setPostOpDays(e.target.value)} placeholder="days" />
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* Vital signs */}
      <CollapsibleCard title="Vital signs" badge={triageResult.vitalRedFlags.length > 0 ? `${triageResult.vitalRedFlags.length} alert` : 'optional'} badgeVariant={triageResult.vitalRedFlags.length > 0 ? 'danger' : 'default'}>
        <div className="form-grid cols-7">
          {VITAL_KEYS.map(({ key, label, placeholder }) => (
            <div className="fld" key={key}>
              <label>{label}</label>
              <input
                inputMode="decimal"
                value={vitals[key]}
                onChange={e => updateVital(key, e.target.value)}
                placeholder={placeholder}
                className={vitalClass(key, vitals[key])}
              />
            </div>
          ))}
        </div>
        {triageResult.vitalRedFlags.length > 0 && (
          <div className="vital-flags" style={{ marginTop: 8 }}>
            {triageResult.vitalRedFlags.map(f => (
              <span key={f.label} className={`vflag ${f.severity}`}>{f.label}: {f.value}</span>
            ))}
          </div>
        )}
      </CollapsibleCard>

      {/* Smart adaptive symptom picker + differential inference */}
      <CollapsibleCard
        title="Symptoms / reason for visit"
        badge={symptoms.length || undefined}
      >
        <SmartSymptomPicker />
      </CollapsibleCard>

      {/* Clinical pathway suggestions — shown when specific combos detected */}
      <PathwaySuggestions />

      {/* Free text */}
      <CollapsibleCard title="Patient message / notes" defaultOpen={false}>
        <div className="fld">
          <label>Patient message (paste or type)</label>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Paste patient email or WhatsApp message here…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>

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
