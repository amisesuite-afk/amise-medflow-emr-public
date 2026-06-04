import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, SITE_LABELS, SITE_CODES } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
import WheelPicker from '@/components/WheelPicker';
import { createEncounter, saveVitals, saveSymptoms, saveAllergyFreeText } from '@/lib/db';
import type { VitalSigns } from '@workspace/triage-engine';

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
  { key: 'systolicBp',      label: 'SBP',    unit: 'mmHg',   placeholder: '120', min: 60,  max: 260, step: 1,   decimals: 0, defaultVal: 120, normalRange: [90,  140] },
  { key: 'diastolicBp',     label: 'DBP',    unit: 'mmHg',   placeholder: '80',  min: 40,  max: 160, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  90]  },
  { key: 'heartRate',       label: 'HR',     unit: 'bpm',    placeholder: '88',  min: 30,  max: 220, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  100] },
  { key: 'temperatureC',    label: 'Temp',   unit: '°C',     placeholder: '37.0',min: 34.0,max: 43.0,step: 0.1, decimals: 1, defaultVal: 37.0,normalRange: [36.1,37.5]},
  { key: 'respiratoryRate', label: 'RR',     unit: '/min',   placeholder: '16',  min: 8,   max: 60,  step: 1,   decimals: 0, defaultVal: 16,  normalRange: [12,  20]  },
  { key: 'spo2',            label: 'SpO₂',   unit: '%',      placeholder: '98',  min: 70,  max: 100, step: 1,   decimals: 0, defaultVal: 98,  normalRange: [95,  100] },
  { key: 'glucoseMmol',     label: 'BGL',    unit: 'mmol/L', placeholder: '6.4', min: 1.0, max: 35.0,step: 0.1, decimals: 1, defaultVal: 6.0, normalRange: [4.0, 7.8] },
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
    patientId, encounterId, setEncounterId,
  } = useAppContext();

  const { profile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleMarkReady() {
    setSaving(true);
    setSaveError(null);
    let eid = encounterId;

    if (patientId) {
      // Create or reuse encounter
      if (!eid) {
        const { encounter, error } = await createEncounter({
          patient_id:       patientId,
          chief_complaint:  symptoms.join(', ') || freeText || undefined,
          site:             currentSite,
        });
        if (error && !error.includes('not configured')) {
          setSaveError(error);
          setSaving(false);
          setPreVisitStatus('vitals_done');
          return;
        }
        if (encounter) {
          eid = encounter.id;
          setEncounterId(encounter.id);
        }
      }

      if (eid) {
        await saveVitals({
          encounter_id: eid, patient_id: patientId,
          ...vitals, weightKg, heightCm,
        });
        await saveSymptoms(eid, patientId, symptoms, freeText);
        if (allergies.trim()) await saveAllergyFreeText(patientId, allergies);
      }
    }

    setSaving(false);
    setPreVisitStatus('vitals_done');
  }

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
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 10px' }}>
              Scroll wheel to set value · or type directly below each wheel
            </p>
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 14, minWidth: 'max-content' }}>
                {VITAL_FIELDS.map(({ key, label, unit, placeholder, min, max, step, decimals, defaultVal, normalRange }) => {
                  const val = vitals[key];
                  const isAbnormal = val.trim() !== '' && Number.isFinite(parseFloat(val)) &&
                    (parseFloat(val) < normalRange[0] || parseFloat(val) > normalRange[1]);
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 82 }}>
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
                          width: 74,
                          fontSize: 13,
                          padding: '5px 6px',
                          textAlign: 'center',
                          borderRadius: 6,
                          border: `1.5px solid ${isAbnormal ? '#fca5a5' : '#d1d5db'}`,
                          background: isAbnormal ? '#fff5f5' : 'var(--bg)',
                          color: isAbnormal ? '#dc2626' : 'var(--ink)',
                          outline: 'none',
                        }}
                      />

                      <span style={{
                        fontSize: 9, color: isAbnormal ? '#dc2626' : 'var(--muted)',
                        fontWeight: isAbnormal ? 700 : 400,
                      }}>
                        {isAbnormal ? '⚠ ' : ''}{unit}
                      </span>
                    </div>
                  );
                })}
              </div>
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
          {saveError && (
            <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              Save failed: {saveError} — status saved locally only.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => void handleMarkReady()}
              disabled={!hasAnyVital || saving}
              style={{
                padding: '13px 32px',
                borderRadius: 8,
                border: 'none',
                background: hasAnyVital && !saving ? 'var(--accent)' : '#9ca3af',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15,
                cursor: hasAnyVital && !saving ? 'pointer' : 'not-allowed',
                transition: 'background .15s',
              }}
            >
              {saving ? 'Saving…' : 'Mark Ready for Doctor ✓'}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
