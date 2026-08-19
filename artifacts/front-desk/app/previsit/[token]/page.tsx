'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Pre-visit questionnaire — public, token-authenticated (no login). Staff
// generate the link via PatientLinkPanel in the dashboard (POST
// /api/previsit/create), which SMSes/copies a link to this page. Submission
// posts to POST /api/previsit/submit, keyed by the same opaque patient_token —
// there is no session or account involved.
//
// Field shapes here are deliberately matched 1:1 to previsit_submissions'
// documented column comments (previsit-submissions-migration.sql) and to what
// /api/previsit/ai-format actually reads — not to the older patient-app
// PreVisitScreen this was ported from, whose submit payload used different key
// names and value vocabularies (severity vs severity_0_10, present/absent vs
// positive/negative, pmh as an object vs a flat array) and never actually
// matched the real API contract.
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationRow {
  name: string;
  dose: string;
  frequency: string;
}

type RosValue = 'positive' | 'negative' | 'not_asked';

interface PhotoEntry {
  id: string;
  dataUrl: string;
  context: string;
}

interface FormData {
  chiefComplaint: string;
  onset: string;
  duration: string;
  severity: number;
  character: string;
  location: string;
  radiation: boolean;
  radiationWhere: string;
  associatedSymptoms: string[];
  alleviating: string;
  aggravating: string;
  pmhConditions: string[];
  pmhList: string[];
  pmhInput: string;
  medications: MedicationRow[];
  surgicalHistoryItems: string[];
  surgicalHistoryInput: string;
  allergies: string;
  ros: Record<string, RosValue>;
  photos: PhotoEntry[];
}

interface Prefill {
  allergies: string;
  medications: MedicationRow[];
  pmh: string[];
}

const ASSOC_SYMPTOMS = [
  'Nausea', 'Vomiting', 'Fever', 'Weight loss', 'Appetite change',
  'Night sweats', 'Fatigue', 'Bleeding', 'Other',
];

const PMH_CONDITIONS = [
  'Diabetes', 'Hypertension', 'Heart disease', 'Asthma / COPD',
  'Thyroid disease', 'Cancer', 'Other',
];

const ROS_SYSTEMS: Record<string, string[]> = {
  GI: ['Nausea', 'Vomiting', 'Diarrhoea', 'Constipation', 'Abdominal pain', 'Bloating', 'Rectal bleeding', 'Heartburn'],
  Cardiovascular: ['Chest pain', 'Palpitations', 'Exertional breathlessness', 'Ankle swelling'],
  Respiratory: ['Cough', 'Shortness of breath', 'Wheezing', 'Coughing blood'],
  Urological: ['Painful urination', 'Urinary frequency', 'Blood in urine', 'Incontinence'],
  Neurological: ['Headache', 'Dizziness', 'Weakness', 'Numbness / tingling'],
  Skin: ['Rash', 'Jaundice', 'Wound changes', 'Itch'],
};

const PHOTO_CONTEXTS = ['wound', 'swelling', 'rash', 'scar', 'other'];

const TOTAL_STEPS = 10;
const TEAL = '#0d9488';

function storageKey(token: string) {
  return `amise_previsit_${token}`;
}

function defaultData(): FormData {
  const ros: Record<string, RosValue> = {};
  for (const symptoms of Object.values(ROS_SYSTEMS)) {
    for (const s of symptoms) ros[s] = 'not_asked';
  }
  return {
    chiefComplaint: '', onset: '', duration: '', severity: 5, character: '',
    location: '', radiation: false, radiationWhere: '', associatedSymptoms: [],
    alleviating: '', aggravating: '', pmhConditions: [], pmhList: [], pmhInput: '',
    medications: [{ name: '', dose: '', frequency: '' }],
    surgicalHistoryItems: [], surgicalHistoryInput: '', allergies: '', ros, photos: [],
  };
}

function loadData(token: string): FormData {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (raw) return { ...defaultData(), ...(JSON.parse(raw) as Partial<FormData>) };
  } catch { /* ignore */ }
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

// ── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = { backgroundColor: '#0d1b2e', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #1e3a5f' };
const inputStyle: React.CSSProperties = { width: '100%', backgroundColor: '#060e1a', border: '1px solid #1e3a5f', borderRadius: 8, padding: '10px 12px', color: '#f1f5f9', fontSize: 15, marginBottom: 10 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 };
const questionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, lineHeight: 1.3 };

function Chip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        padding: '7px 12px', borderRadius: 20, border: `1px solid ${selected ? TEAL : '#1e3a5f'}`,
        backgroundColor: selected ? `${TEAL}20` : 'transparent', color: selected ? TEAL : '#94a3b8',
        fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function RosToggle({ value, onChange }: { value: RosValue; onChange: (v: RosValue) => void }) {
  const options: { v: RosValue; label: string; color: string }[] = [
    { v: 'positive', label: 'Yes', color: '#f87171' },
    { v: 'negative', label: 'No', color: '#22c55e' },
    { v: 'not_asked', label: '—', color: '#64748b' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: `1px solid ${value === o.v ? o.color : '#1e3a5f'}`,
            backgroundColor: value === o.v ? `${o.color}25` : 'transparent', color: value === o.v ? o.color : '#64748b',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PrefillBanner() {
  return (
    <div style={{ backgroundColor: '#0d2a2a', border: `1px solid ${TEAL}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
      <p style={{ color: '#5eead4', fontSize: 13, lineHeight: 1.4 }}>
        Some fields have been pre-filled from your clinic records — please review and update as needed.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PreVisitPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [linkStatus, setLinkStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(() => defaultData());
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setData(loadData(token));

    fetch(`${API_BASE}/api/previsit/prefill/${token}`)
      .then(async r => {
        if (r.status === 404) { setLinkStatus('invalid'); return; }
        setLinkStatus('valid');
        if (!r.ok) return;
        const pf = await r.json() as Prefill;

        setData(prev => {
          const isBlank = !prev.chiefComplaint && prev.medications.length === 1 && !prev.medications[0].name
            && !prev.allergies && prev.pmhConditions.length === 0 && prev.pmhList.length === 0;
          if (!isBlank) return prev;

          const matchedConditions = PMH_CONDITIONS.filter(c => pf.pmh.some(d => d.toLowerCase().includes(c.toLowerCase())));
          const unmatchedPmh = pf.pmh.filter(d => !PMH_CONDITIONS.some(c => d.toLowerCase().includes(c.toLowerCase())));
          const meds = pf.medications.length > 0 ? pf.medications : [{ name: '', dose: '', frequency: '' }];

          if (pf.allergies || meds[0]?.name || matchedConditions.length || unmatchedPmh.length) {
            setPrefillApplied(true);
          }
          return { ...prev, allergies: pf.allergies || prev.allergies, medications: meds, pmhConditions: matchedConditions, pmhList: unmatchedPmh };
        });
      })
      .catch(() => setLinkStatus('valid')); // prefill is best-effort; don't block the form on a network blip
  }, [token]);

  useEffect(() => {
    if (linkStatus === 'valid') localStorage.setItem(storageKey(token), JSON.stringify(data));
  }, [data, token, linkStatus]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }));
  }
  function toggleSymptom(sym: string) {
    setData(prev => ({ ...prev, associatedSymptoms: prev.associatedSymptoms.includes(sym) ? prev.associatedSymptoms.filter(s => s !== sym) : [...prev.associatedSymptoms, sym] }));
  }
  function togglePmhCondition(cond: string) {
    setData(prev => ({ ...prev, pmhConditions: prev.pmhConditions.includes(cond) ? prev.pmhConditions.filter(c => c !== cond) : [...prev.pmhConditions, cond] }));
  }
  function setRos(symptom: string, value: RosValue) {
    setData(prev => ({ ...prev, ros: { ...prev.ros, [symptom]: value } }));
  }
  function addPmhItem() {
    const val = data.pmhInput.trim();
    if (!val) return;
    setData(prev => ({ ...prev, pmhList: [...prev.pmhList, val], pmhInput: '' }));
  }
  function removePmhItem(idx: number) {
    setData(prev => ({ ...prev, pmhList: prev.pmhList.filter((_, i) => i !== idx) }));
  }
  function addSurgicalItem() {
    const val = data.surgicalHistoryInput.trim();
    if (!val) return;
    setData(prev => ({ ...prev, surgicalHistoryItems: [...prev.surgicalHistoryItems, val], surgicalHistoryInput: '' }));
  }
  function removeSurgicalItem(idx: number) {
    setData(prev => ({ ...prev, surgicalHistoryItems: prev.surgicalHistoryItems.filter((_, i) => i !== idx) }));
  }
  function setMed(index: number, field: keyof MedicationRow, value: string) {
    setData(prev => ({ ...prev, medications: prev.medications.map((m, i) => i === index ? { ...m, [field]: value } : m) }));
  }
  function addMed() {
    setData(prev => ({ ...prev, medications: [...prev.medications, { name: '', dose: '', frequency: '' }] }));
  }
  function removeMed(index: number) {
    setData(prev => ({ ...prev, medications: prev.medications.filter((_, i) => i !== index) }));
  }
  async function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setData(prev => ({ ...prev, photos: [...prev.photos, { id: `photo_${Date.now()}`, dataUrl, context: 'wound' }] }));
    } catch { /* ignore file read errors */ }
    e.target.value = '';
  }
  function updatePhotoContext(id: string, context: string) {
    setData(prev => ({ ...prev, photos: prev.photos.map(p => p.id === id ? { ...p, context } : p) }));
  }
  function removePhoto(id: string) {
    setData(prev => ({ ...prev, photos: prev.photos.filter(p => p.id !== id) }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`${API_BASE}/api/previsit/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_token: token,
          cc: data.chiefComplaint,
          hpi_raw: {
            onset: data.onset,
            duration: data.duration,
            severity_0_10: data.severity,
            character: data.character,
            location: data.location,
            radiation: data.radiation ? data.radiationWhere : '',
            associated_symptoms: data.associatedSymptoms,
            alleviating: data.alleviating,
            aggravating: data.aggravating,
          },
          pmh: [...data.pmhConditions, ...data.pmhList],
          medications: data.medications.filter(m => m.name.trim()),
          surgical_history: data.surgicalHistoryItems,
          allergies: data.allergies,
          ros: data.ros,
          photos: data.photos.map(p => ({ url: p.dataUrl, context: p.context, uploaded_at: new Date().toISOString() })),
        }),
      });
      const body = await r.json() as { error?: string };
      if (!r.ok) throw new Error(body.error ?? 'Submission failed');
      localStorage.removeItem(storageKey(token));
      setSubmitted(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / invalid link states ────────────────────────────────────────

  if (linkStatus === 'checking') {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <p style={{ color: '#94a3b8', fontSize: 15 }}>Loading your questionnaire…</p>
      </div>
    );
  }

  if (linkStatus === 'invalid') {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <p style={{ color: '#f87171', fontSize: 15, textAlign: 'center', maxWidth: 320 }}>
          This link has expired or is no longer valid. Please contact the clinic for a new link.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a', padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Questionnaire submitted</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 300 }}>
          Thank you. Your care team will review your responses before your appointment.
        </p>
      </div>
    );
  }

  // ── Step content ─────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <p style={questionTitle}>What is your main reason for this visit?</p>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              placeholder="Describe your main concern in your own words..."
              value={data.chiefComplaint}
              onChange={e => update('chiefComplaint', e.target.value)}
              autoFocus
            />
          </div>
        );

      case 2:
        return (
          <div>
            <p style={questionTitle}>Tell us more about your symptoms</p>

            <label style={labelStyle}>When did it start?</label>
            <input style={inputStyle} type="text" placeholder="e.g. 3 days ago, last week" value={data.onset} onChange={e => update('onset', e.target.value)} />

            <label style={labelStyle}>How long has it been going on?</label>
            <input style={inputStyle} type="text" placeholder="e.g. 2 weeks, ongoing for months" value={data.duration} onChange={e => update('duration', e.target.value)} />

            <label style={labelStyle}>Severity right now: <strong style={{ color: '#f1f5f9' }}>{data.severity} / 10</strong></label>
            <input style={{ width: '100%', accentColor: TEAL, marginBottom: 10 }} type="range" min={0} max={10} step={1} value={data.severity} onChange={e => update('severity', Number(e.target.value))} />

            <label style={labelStyle}>Character</label>
            <select style={inputStyle} value={data.character} onChange={e => update('character', e.target.value)}>
              <option value="">Select...</option>
              {['Sharp', 'Dull', 'Burning', 'Aching', 'Pressure', 'Cramping', 'Other'].map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>

            <label style={labelStyle}>Location (where is the pain / problem?)</label>
            <input style={inputStyle} type="text" placeholder="e.g. upper right abdomen, chest" value={data.location} onChange={e => update('location', e.target.value)} />

            <label style={labelStyle}>Does it spread anywhere?</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[{ v: false, label: 'No' }, { v: true, label: 'Yes' }].map(({ v, label }) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => update('radiation', v)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${data.radiation === v ? TEAL : '#1e3a5f'}`, backgroundColor: data.radiation === v ? `${TEAL}20` : 'transparent', color: data.radiation === v ? TEAL : '#94a3b8', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {data.radiation && (
              <>
                <label style={labelStyle}>Where does it spread to?</label>
                <input style={inputStyle} type="text" placeholder="e.g. right shoulder, back" value={data.radiationWhere} onChange={e => update('radiationWhere', e.target.value)} />
              </>
            )}

            <label style={labelStyle}>Associated symptoms (select all that apply)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {ASSOC_SYMPTOMS.map(sym => <Chip key={sym} label={sym} selected={data.associatedSymptoms.includes(sym)} onToggle={() => toggleSymptom(sym)} />)}
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <p style={questionTitle}>What makes it better or worse?</p>
            <label style={labelStyle}>What makes it better?</label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder="e.g. rest, eating, pain medication" value={data.alleviating} onChange={e => update('alleviating', e.target.value)} />
            <label style={labelStyle}>What makes it worse?</label>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', marginBottom: 0 }} placeholder="e.g. movement, fatty food, stress" value={data.aggravating} onChange={e => update('aggravating', e.target.value)} />
          </div>
        );

      case 4:
        return (
          <div>
            <p style={questionTitle}>Past medical history</p>

            <label style={labelStyle}>Known conditions (tick all that apply)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PMH_CONDITIONS.map(cond => <Chip key={cond} label={cond} selected={data.pmhConditions.includes(cond)} onToggle={() => togglePmhCondition(cond)} />)}
            </div>

            <label style={labelStyle}>Other conditions not listed above</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                type="text"
                placeholder="Type condition and press Add"
                value={data.pmhInput}
                onChange={e => update('pmhInput', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPmhItem(); }}
              />
              <button type="button" onClick={addPmhItem} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', backgroundColor: TEAL, color: '#fff', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>Add</button>
            </div>

            {data.pmhList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.pmhList.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#060e1a', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e3a5f' }}>
                    <span style={{ fontSize: 14, color: '#f1f5f9' }}>{item}</span>
                    <button type="button" onClick={() => removePmhItem(idx)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div>
            <p style={questionTitle}>Current medications</p>
            <p style={{ ...labelStyle, marginBottom: 14 }}>List all medications, supplements, and vitamins you are currently taking.</p>

            {data.medications.map((med, idx) => (
              <div key={idx} style={{ backgroundColor: '#060e1a', borderRadius: 8, padding: 10, marginBottom: 8, border: '1px solid #1e3a5f' }}>
                <input style={{ ...inputStyle, marginBottom: 6 }} type="text" placeholder="Medication name" value={med.name} onChange={e => setMed(idx, 'name', e.target.value)} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Dose (e.g. 10 mg)" value={med.dose} onChange={e => setMed(idx, 'dose', e.target.value)} />
                  <input style={{ ...inputStyle, marginBottom: 0 }} type="text" placeholder="Frequency" value={med.frequency} onChange={e => setMed(idx, 'frequency', e.target.value)} />
                </div>
                {data.medications.length > 1 && (
                  <button type="button" onClick={() => removeMed(idx)} style={{ marginTop: 8, color: '#f87171', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Remove</button>
                )}
              </div>
            ))}

            <button type="button" onClick={addMed} style={{ width: '100%', padding: 10, border: '1px dashed #1e3a5f', borderRadius: 8, color: TEAL, fontSize: 14, background: 'none', cursor: 'pointer' }}>+ Add medication</button>
            <button type="button" onClick={() => setData(prev => ({ ...prev, medications: [] }))} style={{ width: '100%', marginTop: 8, padding: 10, border: 'none', borderRadius: 8, color: '#94a3b8', fontSize: 13, background: 'none', cursor: 'pointer' }}>I take no medications</button>
          </div>
        );

      case 6:
        return (
          <div>
            <p style={questionTitle}>Previous operations or procedures</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                type="text"
                placeholder="e.g. Appendicectomy 2018"
                value={data.surgicalHistoryInput}
                onChange={e => update('surgicalHistoryInput', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSurgicalItem(); }}
              />
              <button type="button" onClick={addSurgicalItem} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', backgroundColor: TEAL, color: '#fff', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>Add</button>
            </div>

            {data.surgicalHistoryItems.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.surgicalHistoryItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#060e1a', borderRadius: 8, padding: '8px 12px', border: '1px solid #1e3a5f' }}>
                    <span style={{ fontSize: 14, color: '#f1f5f9' }}>{item}</span>
                    <button type="button" onClick={() => removeSurgicalItem(idx)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: 13 }}>No surgeries added yet.</p>
            )}
          </div>
        );

      case 7:
        return (
          <div>
            <p style={questionTitle}>Do you have any allergies?</p>
            <label style={labelStyle}>List drug, food, or other allergies and their reactions</label>
            <textarea
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', marginBottom: 0 }}
              placeholder="e.g. Penicillin — rash and hives; Latex — contact dermatitis; No known allergies"
              value={data.allergies}
              onChange={e => update('allergies', e.target.value)}
            />
          </div>
        );

      case 8:
        return (
          <div>
            <p style={questionTitle}>Review of systems</p>
            <p style={{ ...labelStyle, marginBottom: 14 }}>For each symptom, indicate if it is currently present, absent, or not discussed.</p>
            {Object.entries(ROS_SYSTEMS).map(([system, symptoms]) => (
              <div key={system} style={card}>
                <div style={{ color: TEAL, fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{system}</div>
                {symptoms.map(sym => (
                  <div key={sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, color: '#cbd5e1', flex: 1 }}>{sym}</span>
                    <RosToggle value={data.ros[sym] ?? 'not_asked'} onChange={v => setRos(sym, v)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      case 9:
        return (
          <div>
            <p style={questionTitle}>Photos (optional)</p>
            <p style={{ ...labelStyle, marginBottom: 14 }}>Take or upload photos of wounds, swellings, or any relevant areas. This helps your surgeon review before your appointment.</p>

            <label htmlFor="photo-capture" style={{ display: 'block', textAlign: 'center', padding: 20, border: '2px dashed #1e3a5f', borderRadius: 12, cursor: 'pointer', marginBottom: 16, color: TEAL, fontSize: 14 }}>
              📷 Take or upload photo
              <input id="photo-capture" type="file" accept="image/*" capture="environment" onChange={e => void handlePhotoCapture(e)} style={{ display: 'none' }} />
            </label>

            {data.photos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.photos.map(photo => (
                  <div key={photo.id} style={{ backgroundColor: '#0d1b2e', borderRadius: 10, padding: 12, border: '1px solid #1e3a5f' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.dataUrl} alt="Uploaded" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
                    <label style={labelStyle}>Photo type</label>
                    <select style={{ ...inputStyle, marginBottom: 8 }} value={photo.context} onChange={e => updatePhotoContext(photo.id, e.target.value)}>
                      {PHOTO_CONTEXTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => removePhoto(photo.id)} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>Remove photo</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 10:
        return (
          <div>
            <p style={questionTitle}>Review & Submit</p>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Chief complaint</p>
              <p style={{ color: '#f1f5f9', fontSize: 14 }}>{data.chiefComplaint || <span style={{ color: '#64748b' }}>Not provided</span>}</p>
            </div>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Symptom summary</p>
              <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
                Onset: {data.onset || '—'} &nbsp;·&nbsp; Duration: {data.duration || '—'} &nbsp;·&nbsp; Severity: {data.severity}/10
              </p>
              {data.location && <p style={{ color: '#cbd5e1', fontSize: 13 }}>Location: {data.location}</p>}
              {data.associatedSymptoms.length > 0 && <p style={{ color: '#cbd5e1', fontSize: 13 }}>Associated: {data.associatedSymptoms.join(', ')}</p>}
            </div>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Medical history</p>
              <p style={{ color: '#cbd5e1', fontSize: 13 }}>
                {[...data.pmhConditions, ...data.pmhList].join(', ') || 'None selected'}
              </p>
            </div>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Medications</p>
              {data.medications.filter(m => m.name.trim()).length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>None listed</p>
              ) : (
                data.medications.filter(m => m.name.trim()).map((m, idx) => (
                  <p key={idx} style={{ color: '#cbd5e1', fontSize: 13 }}>{m.name} {m.dose} {m.frequency}</p>
                ))
              )}
            </div>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Allergies</p>
              <p style={{ color: '#cbd5e1', fontSize: 13 }}>{data.allergies || 'None stated'}</p>
            </div>

            <div style={card}>
              <p style={{ color: TEAL, fontWeight: 600, marginBottom: 6 }}>Photos</p>
              <p style={{ color: '#cbd5e1', fontSize: 13 }}>{data.photos.length} photo{data.photos.length !== 1 ? 's' : ''} attached</p>
            </div>

            {submitError && (
              <div style={{ backgroundColor: '#1c0a0a', border: '1px solid #f87171', borderRadius: 8, padding: 12, marginBottom: 12, color: '#f87171', fontSize: 13 }}>
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', backgroundColor: TEAL, color: '#fff', fontSize: 16, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1, marginTop: 8 }}
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
    <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 24px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>Pre-Visit Questionnaire</h1>

        <div style={{ height: 4, backgroundColor: '#1e3a5f', borderRadius: 2, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: TEAL, borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #1e3a5f', color: step === 1 ? '#334155' : '#f1f5f9', background: 'none', cursor: step === 1 ? 'default' : 'pointer', fontSize: 14 }}
          >
            ← Back
          </button>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{step} / {TOTAL_STEPS}</span>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: TEAL, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              Next →
            </button>
          ) : <div style={{ width: 80 }} />}
        </div>

        {prefillApplied && [1, 4, 5, 7].includes(step) && <PrefillBanner />}
        {renderStep()}

        {step < TOTAL_STEPS && (
          <button
            type="button"
            onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}
            style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 12, border: 'none', backgroundColor: TEAL, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
