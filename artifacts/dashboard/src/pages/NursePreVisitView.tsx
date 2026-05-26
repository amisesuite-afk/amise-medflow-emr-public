import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
import type { VitalSigns } from '@/lib/adaptive-triage';

const VITAL_FIELDS: { key: keyof VitalSigns; label: string; unit: string; placeholder: string }[] = [
  { key: 'systolicBp',      label: 'SBP',        unit: 'mmHg',        placeholder: '120' },
  { key: 'diastolicBp',     label: 'DBP',        unit: 'mmHg',        placeholder: '80'  },
  { key: 'heartRate',       label: 'HR',         unit: 'bpm',         placeholder: '88'  },
  { key: 'temperatureC',    label: 'Temperature', unit: '°C',          placeholder: '37.0' },
  { key: 'respiratoryRate', label: 'RR',         unit: 'breaths/min', placeholder: '16'  },
  { key: 'spo2',            label: 'SpO₂',       unit: '%',           placeholder: '98'  },
  { key: 'glucoseMmol',     label: 'Blood glucose', unit: 'mmol/L',   placeholder: '6.4' },
];

const CHIEF_COMPLAINTS = [
  'Abdominal pain',
  'Nausea / vomiting',
  'Fever / chills',
  'Jaundice',
  'Rectal bleeding',
  'Change in bowel habit',
  'Heartburn / reflux',
  'Swallowing difficulty',
  'Weight loss',
  'Breast lump',
  'Wound concern',
  'Leg swelling',
  'Shortness of breath',
  'Chest pain',
  'Pre-operative visit',
  'Post-operative review',
  'Follow-up',
];

function calcBmi(weightKg: string, heightCm: string): { value: number; label: string; color: string } | null {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (!w || !h || h < 50) return null;
  const bmi = w / Math.pow(h / 100, 2);
  if (bmi < 18.5) return { value: bmi, label: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { value: bmi, label: 'Normal',      color: '#16a34a' };
  if (bmi < 30)   return { value: bmi, label: 'Overweight',  color: '#ca8a04' };
  return           { value: bmi, label: 'Obese',             color: '#dc2626' };
}

export default function NursePreVisitView() {
  const {
    patientName,
    age,
    sex,
    dob,
    vitals,
    updateVital,
    weightKg, setWeightKg,
    heightCm, setHeightCm,
    symptoms,
    toggleSymptom,
    freeText, setFreeText,
    allergies, setAllergies,
    medicationsText, setMedicationsText,
    currentSite, setCurrentSite,
    preVisitStatus, setPreVisitStatus,
  } = useAppContext();

  const { profile, signOut } = useAuth();

  const hasPatient = patientName.trim().length > 0;
  const hasAnyVital = Object.values(vitals).some(v => v.trim().length > 0);

  const bmi = calcBmi(weightKg, heightCm);

  const sexLabel = sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : sex === 'other' ? 'Other' : '—';

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="app-header" style={{ gridColumn: 'unset' }}>
        <span className="header-brand" style={{ fontSize: 10 }}>
          Pre-visit Assessment — Amise Medical Services
        </span>

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
          <span className="user-chip__name">{profile?.full_name ?? 'Nurse'}</span>
          <span className="user-chip__role">
            {profile?.role ? ROLE_LABELS[profile.role] : 'Nurse'}
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
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Patient banner */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: hasPatient ? '#e4f5f2' : '#f8f9fa',
            border: `1px solid ${hasPatient ? '#0b8278' : '#d1d5db'}`,
          }}>
            {hasPatient ? (
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>{patientName}</span>
                {age && (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Age: <strong style={{ color: 'var(--ink)' }}>{age}</strong></span>
                )}
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Sex: <strong style={{ color: 'var(--ink)' }}>{sexLabel}</strong></span>
                {dob && (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>DOB: <strong style={{ color: 'var(--ink)' }}>{dob}</strong></span>
                )}
              </div>
            ) : (
              <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 13 }}>
                No patient registered — ask reception to register first
              </span>
            )}
          </div>

          {/* Vitals ready status banner */}
          {preVisitStatus === 'vitals_done' && (
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
              Vitals recorded — patient ready for doctor
            </div>
          )}

          {/* Card 1: Vital signs */}
          <CollapsibleCard title="Vital Signs">
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {VITAL_FIELDS.map(({ key, label, unit, placeholder }) => (
                <div className="fld" key={key}>
                  <label>{label}</label>
                  <input
                    inputMode="decimal"
                    value={vitals[key]}
                    onChange={e => updateVital(key, e.target.value)}
                    placeholder={placeholder}
                    style={{ fontSize: 16, padding: '10px 11px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 1 }}>{unit}</span>
                </div>
              ))}
            </div>
          </CollapsibleCard>

          {/* Card 2: Measurements */}
          <CollapsibleCard title="Measurements">
            <div className="form-grid cols-2" style={{ gap: 12 }}>
              <div className="fld">
                <label>Weight (kg)</label>
                <input
                  inputMode="decimal"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  placeholder="e.g. 72"
                  style={{ fontSize: 16, padding: '10px 11px', textAlign: 'center' }}
                />
              </div>
              <div className="fld">
                <label>Height (cm)</label>
                <input
                  inputMode="decimal"
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  placeholder="e.g. 165"
                  style={{ fontSize: 16, padding: '10px 11px', textAlign: 'center' }}
                />
              </div>
            </div>

            {bmi && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: `${bmi.color}15`,
                border: `1px solid ${bmi.color}40`,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}>
                <span style={{ fontWeight: 900, fontSize: 18, color: bmi.color }}>BMI {bmi.value.toFixed(1)}</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#fff',
                  background: bmi.color,
                  padding: '3px 10px',
                  borderRadius: 999,
                }}>
                  {bmi.label}
                </span>
              </div>
            )}
          </CollapsibleCard>

          {/* Card 3: Chief complaint */}
          <CollapsibleCard title="Chief Complaint">
            {/* Horizontally scrollable chip row */}
            <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', minWidth: 'max-content' }}>
                {CHIEF_COMPLAINTS.map(complaint => (
                  <button
                    key={complaint}
                    type="button"
                    className={`chip${symptoms.includes(complaint) ? ' on' : ''}`}
                    onClick={() => toggleSymptom(complaint)}
                    style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: 13 }}
                  >
                    {complaint}
                  </button>
                ))}
              </div>
            </div>

            <div className="fld" style={{ marginTop: 12 }}>
              <label>Additional notes</label>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Any additional details about the presenting complaint…"
                style={{ minHeight: 80, padding: '10px 11px', fontSize: 13 }}
              />
            </div>
          </CollapsibleCard>

          {/* Card 4: Allergies */}
          <CollapsibleCard title="Allergies">
            <div className="fld">
              <label>Known allergies</label>
              <textarea
                value={allergies}
                onChange={e => setAllergies(e.target.value)}
                placeholder="NKDA / Penicillin — rash / Latex…"
                style={{ minHeight: 80, padding: '10px 11px', fontSize: 13 }}
              />
            </div>
          </CollapsibleCard>

          {/* Card 5: Current medications */}
          <CollapsibleCard title="Current Medications">
            <div className="fld">
              <label>Medications list</label>
              <textarea
                value={medicationsText}
                onChange={e => setMedicationsText(e.target.value)}
                placeholder="Metformin 500mg BD, Atorvastatin 20mg nocte…"
                style={{ minHeight: 100, padding: '10px 11px', fontSize: 13 }}
              />
            </div>
          </CollapsibleCard>

          {/* Bottom action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => setPreVisitStatus('vitals_done')}
              disabled={!hasAnyVital}
              style={{
                padding: '13px 32px',
                borderRadius: 8,
                border: 'none',
                background: hasAnyVital ? 'var(--accent)' : '#9ca3af',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                cursor: hasAnyVital ? 'pointer' : 'not-allowed',
                transition: 'background .15s',
              }}
            >
              Mark Ready for Doctor ✓
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
