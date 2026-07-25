import React, { useEffect, useState } from 'react';
import { submitPrevisit, getPrevisitData, type PrevisitPrefill } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MedicationRow {
  name: string;
  dose: string;
  frequency: string;
}

type RosValue = 'present' | 'absent' | 'not_asked';

interface PhotoEntry {
  id: string;
  dataUrl: string;
  context: string;
}

interface HomeVitals {
  bp_systolic: string;
  bp_diastolic: string;
  heart_rate: string;
  temperature_c: string;
  oxygen_saturation: string;
  weight_kg: string;
  glucose_mmol: string;
  measured_at: string;
}

interface PreVisitData {
  // Step 1
  chiefComplaint: string;
  // Step 2
  onset: string;
  duration: string;
  severity: number;
  character: string;
  location: string;
  radiation: boolean;
  radiationWhere: string;
  associatedSymptoms: string[];
  // Step 3
  alleviating: string;
  aggravating: string;
  // Step 4
  pmhConditions: string[];
  pmhOther: string;
  pmhList: string[];
  pmhInput: string;
  // Step 5
  medications: MedicationRow[];
  // Step 6
  surgicalHistoryItems: string[];
  surgicalHistoryInput: string;
  // Step 7
  allergies: string;
  // Step 8
  ros: Record<string, RosValue>;
  // Step 9
  photos: PhotoEntry[];
  // Step 10
  homeVitals: HomeVitals;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSOC_SYMPTOMS = [
  'Nausea',
  'Vomiting',
  'Fever',
  'Weight loss',
  'Appetite change',
  'Night sweats',
  'Fatigue',
  'Bleeding',
  'Other',
];

const PMH_CONDITIONS = [
  'Diabetes',
  'Hypertension',
  'Heart disease',
  'Asthma / COPD',
  'Thyroid disease',
  'Cancer',
  'Other',
];

const ROS_SYSTEMS: Record<string, string[]> = {
  GI: ['Nausea', 'Vomiting', 'Diarrhoea', 'Constipation', 'Abdominal pain', 'Bloating', 'Rectal bleeding', 'Heartburn'],
  Cardiovascular: ['Chest pain', 'Palpitations', 'Exertional breathlessness', 'Ankle swelling'],
  Respiratory: ['Cough', 'Shortness of breath', 'Wheezing', 'Coughing blood'],
  Urological: ['Painful urination', 'Urinary frequency', 'Blood in urine', 'Incontinence'],
  Neurological: ['Headache', 'Dizziness', 'Weakness', 'Numbness / tingling'],
  Skin: ['Rash', 'Jaundice', 'Wound changes', 'Itch'],
};

const PHOTO_CONTEXTS = ['Wound', 'Swelling', 'Rash', 'Scar', 'Other'];

const STORAGE_KEY_PREFIX = 'amise_previsit_';
const TOTAL_STEPS = 11;

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#0d1b2e',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
  border: '1px solid #1e3a5f',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#060e1a',
  border: '1px solid #1e3a5f',
  borderRadius: '8px',
  padding: '10px 12px',
  color: '#f1f5f9',
  fontSize: '15px',
  marginBottom: '10px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  color: '#94a3b8',
  marginBottom: '6px',
};

const questionTitle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#f1f5f9',
  marginBottom: '16px',
  lineHeight: 1.3,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(token: string) {
  return `${STORAGE_KEY_PREFIX}${token}`;
}

function defaultData(): PreVisitData {
  const ros: Record<string, RosValue> = {};
  for (const symptoms of Object.values(ROS_SYSTEMS)) {
    for (const s of symptoms) {
      ros[s] = 'not_asked';
    }
  }
  return {
    chiefComplaint: '',
    onset: '',
    duration: '',
    severity: 5,
    character: '',
    location: '',
    radiation: false,
    radiationWhere: '',
    associatedSymptoms: [],
    alleviating: '',
    aggravating: '',
    pmhConditions: [],
    pmhOther: '',
    pmhList: [],
    pmhInput: '',
    medications: [{ name: '', dose: '', frequency: '' }],
    surgicalHistoryItems: [],
    surgicalHistoryInput: '',
    allergies: '',
    ros,
    photos: [],
    homeVitals: {
      bp_systolic: '', bp_diastolic: '', heart_rate: '',
      temperature_c: '', oxygen_saturation: '', weight_kg: '',
      glucose_mmol: '', measured_at: '',
    },
  };
}

function loadData(token: string): PreVisitData {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PreVisitData>;
      return { ...defaultData(), ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultData();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, selected, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      padding: '7px 12px',
      borderRadius: '20px',
      border: `1px solid ${selected ? '#0d9488' : '#1e3a5f'}`,
      backgroundColor: selected ? '#0d948820' : 'transparent',
      color: selected ? '#0d9488' : '#94a3b8',
      fontSize: '13px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

interface RosToggleProps {
  value: RosValue;
  onChange: (v: RosValue) => void;
}

const RosToggle: React.FC<RosToggleProps> = ({ value, onChange }) => {
  const options: { v: RosValue; label: string; color: string }[] = [
    { v: 'present', label: 'Yes', color: '#f87171' },
    { v: 'absent', label: 'No', color: '#22c55e' },
    { v: 'not_asked', label: '—', color: '#64748b' },
  ];
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: `1px solid ${value === o.v ? o.color : '#1e3a5f'}`,
            backgroundColor: value === o.v ? `${o.color}25` : 'transparent',
            color: value === o.v ? o.color : '#64748b',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

const PrefillBanner: React.FC = () => (
  <div
    style={{
      backgroundColor: '#0d2a2a',
      border: '1px solid #0d9488',
      borderRadius: '10px',
      padding: '10px 14px',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}
  >
    <span style={{ fontSize: '18px', flexShrink: 0 }}>✅</span>
    <p style={{ color: '#5eead4', fontSize: '13px', lineHeight: 1.4 }}>
      Some fields have been pre-filled from your clinic records — please review and update as needed.
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  token: string;
}

const PreVisitScreen: React.FC<Props> = ({ token }) => {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<PreVisitData>(() => loadData(token));
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<PrevisitPrefill | null>(null);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Fetch clinic record data to pre-populate the form (best-effort)
  useEffect(() => {
    getPrevisitData(token)
      .then(pf => {
        setPrefill(pf);
        // Only pre-populate on a fresh (empty) form so we don't clobber patient edits
        setData(prev => {
          const isBlank =
            !prev.chiefComplaint &&
            prev.medications.length === 1 && !prev.medications[0].name &&
            !prev.allergies &&
            prev.pmhConditions.length === 0 &&
            prev.pmhList.length === 0;
          if (!isBlank) return prev;

          // Match PMH diagnoses against known conditions list
          const matchedConditions = PMH_CONDITIONS.filter(c =>
            pf.pmh.some(d => d.toLowerCase().includes(c.toLowerCase()))
          );
          const unmatchedPmh = pf.pmh.filter(d =>
            !PMH_CONDITIONS.some(c => d.toLowerCase().includes(c.toLowerCase()))
          );
          const meds = pf.medications.length > 0
            ? pf.medications
            : [{ name: '', dose: '', frequency: '' }];

          setPrefillApplied(true);
          return {
            ...prev,
            chiefComplaint: pf.chiefComplaint || prev.chiefComplaint,
            allergies: pf.allergies || prev.allergies,
            medications: meds,
            pmhConditions: matchedConditions,
            pmhList: unmatchedPmh,
          };
        });
      })
      .catch(() => { /* prefill is best-effort */ });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist on every change
  useEffect(() => {
    localStorage.setItem(storageKey(token), JSON.stringify(data));
  }, [data, token]);

  function update<K extends keyof PreVisitData>(key: K, value: PreVisitData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(sym: string) {
    setData((prev) => {
      const has = prev.associatedSymptoms.includes(sym);
      return {
        ...prev,
        associatedSymptoms: has
          ? prev.associatedSymptoms.filter((s) => s !== sym)
          : [...prev.associatedSymptoms, sym],
      };
    });
  }

  function togglePmhCondition(cond: string) {
    setData((prev) => {
      const has = prev.pmhConditions.includes(cond);
      return {
        ...prev,
        pmhConditions: has
          ? prev.pmhConditions.filter((c) => c !== cond)
          : [...prev.pmhConditions, cond],
      };
    });
  }

  function setRos(symptom: string, value: RosValue) {
    setData((prev) => ({
      ...prev,
      ros: { ...prev.ros, [symptom]: value },
    }));
  }

  function updateHomeVital(field: keyof HomeVitals, value: string) {
    setData((prev) => ({ ...prev, homeVitals: { ...prev.homeVitals, [field]: value } }));
  }

  function addPmhItem() {
    const val = data.pmhInput.trim();
    if (!val) return;
    setData((prev) => ({
      ...prev,
      pmhList: [...prev.pmhList, val],
      pmhInput: '',
    }));
  }

  function removePmhItem(idx: number) {
    setData((prev) => ({
      ...prev,
      pmhList: prev.pmhList.filter((_, i) => i !== idx),
    }));
  }

  function addSurgicalItem() {
    const val = data.surgicalHistoryInput.trim();
    if (!val) return;
    setData((prev) => ({
      ...prev,
      surgicalHistoryItems: [...prev.surgicalHistoryItems, val],
      surgicalHistoryInput: '',
    }));
  }

  function removeSurgicalItem(idx: number) {
    setData((prev) => ({
      ...prev,
      surgicalHistoryItems: prev.surgicalHistoryItems.filter((_, i) => i !== idx),
    }));
  }

  function setMed(index: number, field: keyof MedicationRow, value: string) {
    setData((prev) => {
      const meds = prev.medications.map((m, i) =>
        i === index ? { ...m, [field]: value } : m,
      );
      return { ...prev, medications: meds };
    });
  }

  function addMed() {
    setData((prev) => ({
      ...prev,
      medications: [...prev.medications, { name: '', dose: '', frequency: '' }],
    }));
  }

  function removeMed(index: number) {
    setData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  }

  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      const entry: PhotoEntry = {
        id: `photo_${Date.now()}`,
        dataUrl,
        context: 'Wound',
      };
      setData((prev) => ({ ...prev, photos: [...prev.photos, entry] }));
    } catch {
      // ignore file read errors
    }
    // Reset so same file can be selected again
    e.target.value = '';
  }

  function updatePhotoContext(id: string, context: string) {
    setData((prev) => ({
      ...prev,
      photos: prev.photos.map((p) => (p.id === id ? { ...p, context } : p)),
    }));
  }

  function removePhoto(id: string) {
    setData((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitPrevisit(token, {
        cc: data.chiefComplaint,
        hpi_raw: {
          onset: data.onset,
          duration: data.duration,
          severity: data.severity,
          character: data.character,
          location: data.location,
          radiation: data.radiation,
          radiationWhere: data.radiationWhere,
          associatedSymptoms: data.associatedSymptoms,
          alleviating: data.alleviating,
          aggravating: data.aggravating,
        },
        pmh: {
          conditions: data.pmhConditions,
          other: data.pmhOther,
          list: data.pmhList,
        },
        medications: data.medications,
        surgical_history: data.surgicalHistoryItems,
        allergies: data.allergies,
        ros: data.ros,
        photos: data.photos.map((p) => ({ dataUrl: p.dataUrl, context: p.context })),
        home_vitals: data.homeVitals,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          padding: '32px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ fontSize: '48px' }}>✅</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9' }}>
          Questionnaire submitted
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '300px' }}>
          Thank you. Your care team will review your responses before your appointment.
        </p>
      </div>
    );
  }

  // ── Navigation bar ──────────────────────────────────────────────────────────

  const NavBar = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}
    >
      <button
        onClick={() => setStep((s) => Math.max(1, s - 1))}
        disabled={step === 1}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #1e3a5f',
          color: step === 1 ? '#334155' : '#f1f5f9',
          background: 'none',
          cursor: step === 1 ? 'default' : 'pointer',
          fontSize: '14px',
        }}
      >
        ← Back
      </button>

      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
        {step} / {TOTAL_STEPS}
      </span>

      {step < TOTAL_STEPS ? (
        <button
          onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#0d9488',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          Next →
        </button>
      ) : (
        <div style={{ width: '80px' }} />
      )}
    </div>
  );

  // ── Progress bar ────────────────────────────────────────────────────────────

  const ProgressBar = () => (
    <div
      style={{
        height: '4px',
        backgroundColor: '#1e3a5f',
        borderRadius: '2px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${(step / TOTAL_STEPS) * 100}%`,
          backgroundColor: '#0d9488',
          borderRadius: '2px',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      // ── Step 1: Chief complaint
      case 1:
        return (
          <div>
            <p style={questionTitle}>What is your main reason for this visit?</p>
            <textarea
              style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
              placeholder="Describe your main concern in your own words..."
              value={data.chiefComplaint}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('chiefComplaint', e.target.value)
              }
              autoFocus
            />
          </div>
        );

      // ── Step 2: Symptom details
      case 2:
        return (
          <div>
            <p style={questionTitle}>Tell us more about your symptoms</p>

            <label style={labelStyle}>When did it start?</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. 3 days ago, last week"
              value={data.onset}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update('onset', e.target.value)
              }
            />

            <label style={labelStyle}>How long has it been going on?</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. 2 weeks, ongoing for months"
              value={data.duration}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update('duration', e.target.value)
              }
            />

            <label style={labelStyle}>
              Severity right now: <strong style={{ color: '#f1f5f9' }}>{data.severity} / 10</strong>
            </label>
            <input
              style={{ width: '100%', accentColor: '#0d9488', marginBottom: '10px' }}
              type="range"
              min={0}
              max={10}
              step={1}
              value={data.severity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update('severity', Number(e.target.value))
              }
            />

            <label style={labelStyle}>Character</label>
            <select
              style={inputStyle}
              value={data.character}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                update('character', e.target.value)
              }
            >
              <option value="">Select...</option>
              {['Sharp', 'Dull', 'Burning', 'Aching', 'Pressure', 'Cramping', 'Other'].map(
                (c) => (
                  <option key={c} value={c.toLowerCase()}>
                    {c}
                  </option>
                ),
              )}
            </select>

            <label style={labelStyle}>Location (where is the pain / problem?)</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. upper right abdomen, chest"
              value={data.location}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                update('location', e.target.value)
              }
            />

            <label style={labelStyle}>Does it spread anywhere?</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {[
                { v: false, label: 'No' },
                { v: true, label: 'Yes' },
              ].map(({ v, label }) => (
                <button
                  key={String(v)}
                  onClick={() => update('radiation', v)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${data.radiation === v ? '#0d9488' : '#1e3a5f'}`,
                    backgroundColor: data.radiation === v ? '#0d948820' : 'transparent',
                    color: data.radiation === v ? '#0d9488' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {data.radiation && (
              <>
                <label style={labelStyle}>Where does it spread to?</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="e.g. right shoulder, back"
                  value={data.radiationWhere}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    update('radiationWhere', e.target.value)
                  }
                />
              </>
            )}

            <label style={labelStyle}>Associated symptoms (select all that apply)</label>
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}
            >
              {ASSOC_SYMPTOMS.map((sym) => (
                <Chip
                  key={sym}
                  label={sym}
                  selected={data.associatedSymptoms.includes(sym)}
                  onToggle={() => toggleSymptom(sym)}
                />
              ))}
            </div>
          </div>
        );

      // ── Step 3: Alleviating / aggravating
      case 3:
        return (
          <div>
            <p style={questionTitle}>What makes it better or worse?</p>
            <label style={labelStyle}>What makes it better?</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
              placeholder="e.g. rest, eating, pain medication"
              value={data.alleviating}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('alleviating', e.target.value)
              }
            />
            <label style={labelStyle}>What makes it worse?</label>
            <textarea
              style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', marginBottom: 0 }}
              placeholder="e.g. movement, fatty food, stress"
              value={data.aggravating}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('aggravating', e.target.value)
              }
            />
          </div>
        );

      // ── Step 4: Past medical history
      case 4:
        return (
          <div>
            <p style={questionTitle}>Past medical history</p>

            <label style={labelStyle}>Known conditions (tick all that apply)</label>
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}
            >
              {PMH_CONDITIONS.map((cond) => (
                <Chip
                  key={cond}
                  label={cond}
                  selected={data.pmhConditions.includes(cond)}
                  onToggle={() => togglePmhCondition(cond)}
                />
              ))}
            </div>

            <label style={labelStyle}>Other conditions not listed above</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                type="text"
                placeholder="Type condition and press Add"
                value={data.pmhInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  update('pmhInput', e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') addPmhItem();
                }}
              />
              <button
                onClick={addPmhItem}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0d9488',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                Add
              </button>
            </div>

            {data.pmhList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.pmhList.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#060e1a',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid #1e3a5f',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#f1f5f9' }}>{item}</span>
                    <button
                      onClick={() => removePmhItem(idx)}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 5: Current medications
      case 5:
        return (
          <div>
            <p style={questionTitle}>Current medications</p>
            <p style={{ ...labelStyle, marginBottom: '14px' }}>
              List all medications, supplements, and vitamins you are currently taking.
            </p>

            {data.medications.map((med, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#060e1a',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '8px',
                  border: '1px solid #1e3a5f',
                }}
              >
                <input
                  style={{ ...inputStyle, marginBottom: '6px' }}
                  type="text"
                  placeholder="Medication name"
                  value={med.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setMed(idx, 'name', e.target.value)
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <input
                    style={{ ...inputStyle, marginBottom: 0 }}
                    type="text"
                    placeholder="Dose (e.g. 10 mg)"
                    value={med.dose}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMed(idx, 'dose', e.target.value)
                    }
                  />
                  <input
                    style={{ ...inputStyle, marginBottom: 0 }}
                    type="text"
                    placeholder="Frequency"
                    value={med.frequency}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setMed(idx, 'frequency', e.target.value)
                    }
                  />
                </div>
                {data.medications.length > 1 && (
                  <button
                    onClick={() => removeMed(idx)}
                    style={{
                      marginTop: '8px',
                      color: '#f87171',
                      fontSize: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addMed}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px dashed #1e3a5f',
                borderRadius: '8px',
                color: '#0d9488',
                fontSize: '14px',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              + Add medication
            </button>

            <button
              onClick={() => {
                setData((prev) => ({ ...prev, medications: [] }));
              }}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              I take no medications
            </button>
          </div>
        );

      // ── Step 6: Surgical history
      case 6:
        return (
          <div>
            <p style={questionTitle}>Previous operations or procedures</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                type="text"
                placeholder="e.g. Appendicectomy 2018"
                value={data.surgicalHistoryInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  update('surgicalHistoryInput', e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') addSurgicalItem();
                }}
              />
              <button
                onClick={addSurgicalItem}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0d9488',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  flexShrink: 0,
                }}
              >
                Add
              </button>
            </div>

            {data.surgicalHistoryItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.surgicalHistoryItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#060e1a',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      border: '1px solid #1e3a5f',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#f1f5f9' }}>{item}</span>
                    <button
                      onClick={() => removeSurgicalItem(idx)}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                No surgeries added yet.
              </p>
            )}

            <button
              onClick={() => setStep(7)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              No previous operations
            </button>
          </div>
        );

      // ── Step 7: Allergies
      case 7:
        return (
          <div>
            <p style={questionTitle}>Do you have any allergies?</p>
            <label style={labelStyle}>
              List drug, food, or other allergies and their reactions
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', marginBottom: 0 }}
              placeholder="e.g. Penicillin — rash and hives; Latex — contact dermatitis; No known allergies"
              value={data.allergies}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                update('allergies', e.target.value)
              }
            />
          </div>
        );

      // ── Step 8: Review of systems
      case 8:
        return (
          <div>
            <p style={questionTitle}>Review of systems</p>
            <p style={{ ...labelStyle, marginBottom: '14px' }}>
              For each symptom, indicate if it is currently present, absent, or not discussed.
            </p>

            {Object.entries(ROS_SYSTEMS).map(([system, symptoms]) => (
              <div key={system} style={card}>
                <div
                  style={{
                    color: '#0d9488',
                    fontWeight: 600,
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '10px',
                  }}
                >
                  {system}
                </div>
                {symptoms.map((sym) => (
                  <div
                    key={sym}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '14px', color: '#cbd5e1', flex: 1 }}>{sym}</span>
                    <RosToggle
                      value={data.ros[sym] ?? 'not_asked'}
                      onChange={(v) => setRos(sym, v)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      // ── Step 9: Photos
      case 9:
        return (
          <div>
            <p style={questionTitle}>Photos (optional)</p>
            <p style={{ ...labelStyle, marginBottom: '14px' }}>
              Take or upload photos of wounds, swellings, or any relevant areas. This helps
              your surgeon review before your appointment.
            </p>

            <label
              htmlFor="photo-capture"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '20px',
                border: '2px dashed #1e3a5f',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '16px',
                color: '#0d9488',
                fontSize: '14px',
              }}
            >
              📷 Take or upload photo
              <input
                id="photo-capture"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => void handlePhotoCapture(e)}
                style={{ display: 'none' }}
              />
            </label>

            {data.photos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.photos.map((photo) => (
                  <div
                    key={photo.id}
                    style={{
                      backgroundColor: '#0d1b2e',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid #1e3a5f',
                    }}
                  >
                    <img
                      src={photo.dataUrl}
                      alt="Uploaded"
                      style={{
                        width: '100%',
                        maxHeight: '200px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginBottom: '10px',
                      }}
                    />
                    <label style={labelStyle}>Photo type</label>
                    <select
                      style={{ ...inputStyle, marginBottom: '8px' }}
                      value={photo.context}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        updatePhotoContext(photo.id, e.target.value)
                      }
                    >
                      {PHOTO_CONTEXTS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removePhoto(photo.id)}
                      style={{
                        color: '#f87171',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        padding: 0,
                      }}
                    >
                      Remove photo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // ── Step 10: Home vitals (patient self-measured)
      case 10: {
        const hv = data.homeVitals;
        const lastV = prefill?.lastVitals;
        return (
          <div>
            <p style={questionTitle}>Home vitals (optional)</p>
            <p style={{ ...labelStyle, marginBottom: '14px' }}>
              If you have a blood pressure monitor or scales at home, please enter your most recent readings. This helps your surgeon review your baseline before the appointment.
            </p>

            {lastV?.recorded_at && (
              <div style={{ ...card, borderColor: '#0d9488' }}>
                <p style={{ color: '#5eead4', fontSize: '12px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last recorded in clinic ({new Date(lastV.recorded_at).toLocaleDateString()})
                </p>
                <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.7 }}>
                  {lastV.bp_systolic && lastV.bp_diastolic ? `BP ${lastV.bp_systolic}/${lastV.bp_diastolic} mmHg · ` : ''}
                  {lastV.heart_rate ? `HR ${lastV.heart_rate} bpm · ` : ''}
                  {lastV.weight_kg ? `Wt ${lastV.weight_kg} kg` : ''}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={labelStyle}>Systolic BP (mmHg)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 120"
                  value={hv.bp_systolic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('bp_systolic', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Diastolic BP (mmHg)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 80"
                  value={hv.bp_diastolic}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('bp_diastolic', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Heart rate (bpm)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 72"
                  value={hv.heart_rate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('heart_rate', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Temperature (°C)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 36.8"
                  step="0.1"
                  value={hv.temperature_c}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('temperature_c', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Oxygen saturation (%)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 98"
                  value={hv.oxygen_saturation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('oxygen_saturation', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Weight (kg)</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 75.0"
                  step="0.1"
                  value={hv.weight_kg}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('weight_kg', e.target.value)}
                />
              </div>
            </div>

            <label style={labelStyle}>Blood glucose (mmol/L)</label>
            <input
              style={inputStyle}
              type="number"
              inputMode="decimal"
              placeholder="e.g. 5.4"
              step="0.1"
              value={hv.glucose_mmol}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('glucose_mmol', e.target.value)}
            />

            <label style={labelStyle}>When were these measured?</label>
            <input
              style={inputStyle}
              type="datetime-local"
              value={hv.measured_at}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHomeVital('measured_at', e.target.value)}
            />

            <button
              onClick={() => setStep(11)}
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '10px',
                border: 'none',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              Skip — no home readings available
            </button>
          </div>
        );
      }

      // ── Step 11: Review & submit
      case 11:
        return (
          <div>
            <p style={questionTitle}>Review & Submit</p>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>
                Chief complaint
              </p>
              <p style={{ color: '#f1f5f9', fontSize: '14px' }}>
                {data.chiefComplaint || <span style={{ color: '#64748b' }}>Not provided</span>}
              </p>
            </div>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>
                Symptom summary
              </p>
              <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
                Onset: {data.onset || '—'} &nbsp;·&nbsp; Duration: {data.duration || '—'} &nbsp;·&nbsp; Severity: {data.severity}/10
              </p>
              {data.location && (
                <p style={{ color: '#cbd5e1', fontSize: '13px' }}>Location: {data.location}</p>
              )}
              {data.associatedSymptoms.length > 0 && (
                <p style={{ color: '#cbd5e1', fontSize: '13px' }}>
                  Associated: {data.associatedSymptoms.join(', ')}
                </p>
              )}
            </div>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>
                Medical history
              </p>
              <p style={{ color: '#cbd5e1', fontSize: '13px' }}>
                {data.pmhConditions.length > 0
                  ? data.pmhConditions.join(', ')
                  : 'None selected'}
                {data.pmhList.length > 0 && ' + ' + data.pmhList.join(', ')}
              </p>
            </div>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>
                Medications
              </p>
              {data.medications.filter((m) => m.name.trim()).length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '13px' }}>None listed</p>
              ) : (
                data.medications
                  .filter((m) => m.name.trim())
                  .map((m, idx) => (
                    <p key={idx} style={{ color: '#cbd5e1', fontSize: '13px' }}>
                      {m.name} {m.dose} {m.frequency}
                    </p>
                  ))
              )}
            </div>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>
                Allergies
              </p>
              <p style={{ color: '#cbd5e1', fontSize: '13px' }}>
                {data.allergies || 'None stated'}
              </p>
            </div>

            <div style={card}>
              <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>Photos</p>
              <p style={{ color: '#cbd5e1', fontSize: '13px' }}>
                {data.photos.length} photo{data.photos.length !== 1 ? 's' : ''} attached
              </p>
            </div>

            {(data.homeVitals.bp_systolic || data.homeVitals.heart_rate || data.homeVitals.weight_kg) && (
              <div style={card}>
                <p style={{ color: '#0d9488', fontWeight: 600, marginBottom: '6px' }}>Home vitals</p>
                <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.7 }}>
                  {data.homeVitals.bp_systolic && data.homeVitals.bp_diastolic
                    ? `BP ${data.homeVitals.bp_systolic}/${data.homeVitals.bp_diastolic} mmHg · `
                    : ''}
                  {data.homeVitals.heart_rate ? `HR ${data.homeVitals.heart_rate} bpm · ` : ''}
                  {data.homeVitals.weight_kg ? `Wt ${data.homeVitals.weight_kg} kg` : ''}
                </p>
              </div>
            )}

            {submitError && (
              <div
                style={{
                  backgroundColor: '#1c0a0a',
                  border: '1px solid #f87171',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px',
                  color: '#f87171',
                  fontSize: '13px',
                }}
              >
                {submitError}
              </div>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#0d9488',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                marginTop: '8px',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Questionnaire'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#f1f5f9',
          marginBottom: '12px',
        }}
      >
        Pre-Visit Questionnaire
      </h1>
      <ProgressBar />
      <NavBar />
      {prefillApplied && [1, 4, 5, 7].includes(step) && <PrefillBanner />}
      {renderStep()}
      {step < TOTAL_STEPS && (
        <button
          onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#0d9488',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Continue →
        </button>
      )}
    </div>
  );
};

export default PreVisitScreen;
