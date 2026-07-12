import React, { useEffect, useState } from 'react';
import { savePassport } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MedicationRow {
  name: string;
  dose: string;
  frequency: string;
}

interface PassportData {
  name: string;
  dob: string;
  bloodGroup: string;
  sex: string;
  allergies: string;
  medications: MedicationRow[];
  conditions: string;
  surgicalHistory: string;
  emergencyName: string;
  emergencyPhone: string;
}

type SyncStatus = 'idle' | 'saving' | 'synced' | 'error';

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#0d1b2e',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
  border: '1px solid #1e3a5f',
};

const sectionTitle: React.CSSProperties = {
  color: '#0d9488',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '12px',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '4px',
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

const fieldGroup: React.CSSProperties = {
  marginBottom: '4px',
};

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

function storageKey(token: string): string {
  return `amise_passport_${token}`;
}

function defaultPassport(): PassportData {
  return {
    name: '',
    dob: '',
    bloodGroup: '',
    sex: '',
    allergies: '',
    medications: [{ name: '', dose: '', frequency: '' }],
    conditions: '',
    surgicalHistory: '',
    emergencyName: '',
    emergencyPhone: '',
  };
}

function loadFromStorage(token: string): PassportData {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (raw) return JSON.parse(raw) as PassportData;
  } catch {
    // ignore parse errors
  }
  return defaultPassport();
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

const PassportScreen: React.FC<Props> = ({ token }) => {
  const [data, setData] = useState<PassportData>(() => loadFromStorage(token));
  const [status, setStatus] = useState<SyncStatus>('idle');

  // Persist to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(storageKey(token), JSON.stringify(data));
  }, [data, token]);

  function set<K extends keyof PassportData>(key: K, value: PassportData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
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

  async function handleSync() {
    setStatus('saving');
    try {
      await savePassport(token, data as unknown as Record<string, unknown>);
      setStatus('synced');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 3000);
  }

  const syncLabel =
    status === 'saving'
      ? 'Syncing...'
      : status === 'synced'
        ? 'Synced!'
        : status === 'error'
          ? 'Sync failed — saved locally'
          : 'Saved locally';

  const syncColor =
    status === 'synced' ? '#22c55e' : status === 'error' ? '#f87171' : '#94a3b8';

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      {/* Header */}
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#f1f5f9',
          marginBottom: '4px',
        }}
      >
        Medical Passport
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
        Keep your health summary up to date. Saved to this device automatically.
      </p>

      {/* Personal */}
      <div style={card}>
        <div style={sectionTitle}>Personal Information</div>

        <div style={fieldGroup}>
          <label style={label}>Full name</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Your full name"
            value={data.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)}
          />
        </div>

        <div style={fieldGroup}>
          <label style={label}>Date of birth</label>
          <input
            style={inputStyle}
            type="date"
            value={data.dob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('dob', e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={fieldGroup}>
            <label style={label}>Blood group</label>
            <select
              style={{ ...inputStyle, marginBottom: 0 }}
              value={data.bloodGroup}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                set('bloodGroup', e.target.value)
              }
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g || 'Select...'}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldGroup}>
            <label style={label}>Sex</label>
            <select
              style={{ ...inputStyle, marginBottom: 0 }}
              value={data.sex}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set('sex', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>

      {/* Allergies */}
      <div style={card}>
        <div style={sectionTitle}>Allergies</div>
        <label style={label}>List any drug, food, or other allergies</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: 0 }}
          placeholder="e.g. Penicillin — rash, Latex — contact reaction"
          value={data.allergies}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            set('allergies', e.target.value)
          }
        />
      </div>

      {/* Medications */}
      <div style={card}>
        <div style={sectionTitle}>Current Medications</div>
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
      </div>

      {/* Medical conditions */}
      <div style={card}>
        <div style={sectionTitle}>Medical Conditions</div>
        <label style={label}>List any known medical conditions</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: 0 }}
          placeholder="e.g. Type 2 diabetes, Hypertension"
          value={data.conditions}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            set('conditions', e.target.value)
          }
        />
      </div>

      {/* Surgical history */}
      <div style={card}>
        <div style={sectionTitle}>Surgical History</div>
        <label style={label}>Previous operations or procedures</label>
        <textarea
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: 0 }}
          placeholder="e.g. Appendicectomy 2015, Hernia repair 2019"
          value={data.surgicalHistory}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            set('surgicalHistory', e.target.value)
          }
        />
      </div>

      {/* Emergency contact */}
      <div style={card}>
        <div style={sectionTitle}>Emergency Contact</div>
        <div style={fieldGroup}>
          <label style={label}>Contact name</label>
          <input
            style={inputStyle}
            type="text"
            placeholder="Full name"
            value={data.emergencyName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              set('emergencyName', e.target.value)
            }
          />
        </div>
        <div style={fieldGroup}>
          <label style={label}>Phone number</label>
          <input
            style={{ ...inputStyle, marginBottom: 0 }}
            type="tel"
            placeholder="+1 758 000 0000"
            value={data.emergencyPhone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              set('emergencyPhone', e.target.value)
            }
          />
        </div>
      </div>

      {/* Save & sync */}
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <div style={{ fontSize: '12px', color: syncColor, marginBottom: '10px' }}>
          {syncLabel}
        </div>
        <button
          onClick={() => void handleSync()}
          disabled={status === 'saving'}
          style={{
            backgroundColor: '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 32px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: status === 'saving' ? 'wait' : 'pointer',
            opacity: status === 'saving' ? 0.7 : 1,
            minWidth: '180px',
          }}
        >
          {status === 'saving' ? 'Syncing...' : 'Save & Sync'}
        </button>
      </div>
    </div>
  );
};

export default PassportScreen;
