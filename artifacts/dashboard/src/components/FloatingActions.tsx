import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { saveNewPatient, createEncounter, closeEncounter } from '@/lib/db';
import { DEMO_MODE } from '@/context/AuthContext';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';

// ── New patient quick-create modal ────────────────────────────────────────────

interface NewPatientModalProps {
  currentSite: string;
  onClose: () => void;
  onCreated: (patientId: string, encounterId: string | null, name: string, age: string, sex: string, phone: string) => void;
}

function NewPatientModal({ currentSite, onClose, onCreated }: NewPatientModalProps) {
  const [name, setName]   = useState('');
  const [age,  setAge]    = useState('');
  const [sex,  setSex]    = useState('unknown');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleCreate() {
    if (!name.trim()) { showToast('Patient name is required.', 'error'); return; }
    setSaving(true);
    try {
      const { patient, error: patErr } = await saveNewPatient({ full_name: name.trim(), age, sex, phone });
      if (patErr || !patient) {
        showToast(`Could not create patient: ${patErr ?? 'unknown error'}`, 'error');
        return;
      }
      const { encounter, error: encErr } = await createEncounter({ patient_id: patient.id, site: currentSite as import('@/lib/supabase').SiteCode });
      if (encErr) {
        showToast(`Patient created, but could not open encounter: ${encErr}`, 'error');
        onCreated(patient.id, null, name.trim(), age, sex, phone);
        return;
      }
      onCreated(patient.id, encounter?.id ?? null, name.trim(), age, sex, phone);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9100,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px 24px 20px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
      }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>👤</div>
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
          New Patient
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Enter basic details to register the patient and open an encounter.
        </p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Full name *</div>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
            placeholder="e.g. Jane Celestin"
            style={inputStyle}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Age</div>
            <input
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 45"
              type="number"
              min="0" max="130"
              style={inputStyle}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Sex</div>
            <select
              value={sex}
              onChange={e => setSex(e.target.value)}
              style={{ ...inputStyle, background: '#fff' }}
            >
              <option value="unknown">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Phone</div>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. +1 758 …"
            type="tel"
            style={inputStyle}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={saving || !name.trim()}
          style={{
            display: 'block', width: '100%', padding: '13px 16px',
            borderRadius: 10, border: 'none',
            background: name.trim() && !saving ? '#0d9488' : '#94a3b8',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: name.trim() && !saving ? 'pointer' : 'not-allowed',
            marginBottom: 10, transition: 'background 0.15s',
          }}
        >
          {saving ? '⏳ Creating…' : '✓ Create Patient & Open Encounter'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            display: 'block', width: '100%', padding: '8px',
            borderRadius: 8, border: 'none', background: 'none',
            color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Encounter close modal ─────────────────────────────────────────────────────

interface CloseModalProps {
  patientName: string;
  onHold: () => void;
  onSign: () => void;
  onCancel: () => void;
  signing: boolean;
}

function EncounterCloseModal({ patientName, onHold, onSign, onCancel, signing }: CloseModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '24px 24px 20px',
        maxWidth: 400, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.24)',
      }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>📋</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
          Encounter in progress
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          <strong style={{ color: '#0f172a' }}>{patientName || 'This patient'}</strong> has an open encounter.
          All documentation is auto-saved. Choose how to proceed before continuing.
        </p>

        {/* Hold option */}
        <button
          type="button"
          onClick={onHold}
          style={{
            display: 'block', width: '100%', padding: '13px 16px',
            borderRadius: 10, border: '2px solid #e2e8f0',
            background: '#f8fafc', color: '#0f172a',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            textAlign: 'left', marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 800 }}>⏸ Hold encounter</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 2 }}>
            Save and return to this patient later — encounter stays open
          </div>
        </button>

        {/* Sign & close option */}
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          style={{
            display: 'block', width: '100%', padding: '13px 16px',
            borderRadius: 10, border: '2px solid #0d9488',
            background: '#f0fdfa', color: '#0d9488',
            fontSize: 13, fontWeight: 700, cursor: signing ? 'not-allowed' : 'pointer',
            textAlign: 'left', marginBottom: 16,
            opacity: signing ? 0.7 : 1,
          }}
        >
          <div style={{ fontWeight: 800 }}>{signing ? '⏳ Signing…' : '✓ Sign & close encounter'}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#0d9488', marginTop: 2, opacity: 0.8 }}>
            Mark consultation complete — generates the final document
          </div>
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            display: 'block', width: '100%', padding: '8px',
            borderRadius: 8, border: 'none', background: 'none',
            color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel — stay with this patient
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FloatingActions() {
  const {
    clearPatient,
    patientName, age, sex, dob, phone,
    patientId, setPatientId,
    setPatientName, setAge, setSex, setPhone,
    encounterId, setEncounterId,
    symptoms, triageResult,
    currentSite,
    assessment, icdCodes,
    setTopSection, setActiveSection,
  } = useAppContext();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [signing, setSigning] = useState(false);

  // ── Demo save ──────────────────────────────────────────────────────────────

  function handleSaveDemo() {
    try {
      const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
      const existing: Array<Record<string, unknown>> = raw ? JSON.parse(raw) as Array<Record<string, unknown>> : [];
      const newRecord = {
        id: crypto.randomUUID(),
        full_name: patientName.trim(),
        age, sex, dob, phone,
        site: currentSite,
        acuity: triageResult.acuity,
        score: triageResult.score,
        savedAt: new Date().toISOString(),
      };
      const idx = existing.findIndex(p => (p as { full_name?: string }).full_name?.toLowerCase() === patientName.trim().toLowerCase());
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...newRecord, id: existing[idx].id as string };
        setPatientId(existing[idx].id as string);
      } else {
        existing.push(newRecord);
        setPatientId(newRecord.id);
      }
      localStorage.setItem(DEMO_PATIENTS_KEY, JSON.stringify(existing));
      showToast(`Patient "${patientName.trim()}" saved to local registry.`, 'success');
    } catch {
      showToast('Could not save patient to local registry.', 'error');
    }
  }

  // ── Save new patient ───────────────────────────────────────────────────────

  async function handleSave() {
    if (!patientName.trim()) {
      showToast('Enter a patient name before saving.', 'error');
      return;
    }
    if (DEMO_MODE) { handleSaveDemo(); return; }

    setSaving(true);
    try {
      const { patient, error: patErr } = await saveNewPatient({ full_name: patientName, age, sex, phone });
      if (patErr || !patient) {
        showToast(`Failed to save patient: ${patErr ?? 'unknown error'}`, 'error');
        return;
      }
      const chiefComplaint = symptoms.length > 0 ? symptoms.join(', ') : undefined;
      const { encounter, error: encErr } = await createEncounter({
        patient_id: patient.id,
        chief_complaint: chiefComplaint,
        site: currentSite,
      });
      if (encErr || !encounter) {
        setPatientId(patient.id);
        showToast(`Patient saved, but could not create encounter: ${encErr ?? 'unknown error'}`, 'error');
        return;
      }
      setPatientId(patient.id);
      setEncounterId(encounter.id);
      showToast(`Patient "${patient.full_name}" saved — encounter open.`, 'success');
    } finally {
      setSaving(false);
    }
  }

  // ── New patient request ────────────────────────────────────────────────────

  function handleNew() {
    if (DEMO_MODE) {
      // Demo mode: just clear state as before (no Supabase modal)
      if (encounterId) {
        setShowModal(true);
      } else if (patientName) {
        if (window.confirm(`Clear data for "${patientName}" and start a new patient?`)) {
          clearPatient();
        }
      } else {
        clearPatient();
      }
      return;
    }
    if (encounterId) {
      setShowModal(true);
    } else if (patientName) {
      if (window.confirm(`Clear data for "${patientName}" and start a new patient?`)) {
        clearPatient();
        setShowNewPatient(true);
      }
    } else {
      clearPatient();
      setShowNewPatient(true);
    }
  }

  function handlePatientCreated(pid: string, eid: string | null, name: string, ageStr: string, sexVal: string, phoneVal: string) {
    setShowNewPatient(false);
    setPatientId(pid);
    if (eid) setEncounterId(eid);
    setPatientName(name);
    if (ageStr) setAge(ageStr);
    if (sexVal && sexVal !== 'unknown') setSex(sexVal as Parameters<typeof setSex>[0]);
    if (phoneVal) setPhone(phoneVal);
    setTopSection('consultation');
    setActiveSection('triage');
    showToast(`Patient "${name}" created — encounter open.`, 'success');
  }

  // ── Hold encounter ─────────────────────────────────────────────────────────
  // Data is already in Supabase via auto-save. "Hold" just clears local state
  // so the surgeon can move to a new patient — the encounter remains open in DB.

  function handleHold() {
    setShowModal(false);
    clearPatient();
    showToast('Encounter held — documentation saved. Resume via Patient Search.', 'info');
  }

  // ── Sign & close encounter ─────────────────────────────────────────────────

  async function handleSign() {
    if (!encounterId) { setShowModal(false); clearPatient(); return; }

    // D5: Require assessment + at least one ICD code before closing
    if (!assessment.trim()) {
      showToast('Please document an assessment before closing this encounter.', 'error');
      return;
    }
    if (icdCodes.length === 0) {
      showToast('Please add at least one ICD-10 code before closing this encounter.', 'error');
      return;
    }

    setSigning(true);
    try {
      if (!DEMO_MODE) {
        const { error } = await closeEncounter(encounterId);
        if (error) {
          showToast(`Could not close encounter: ${error}`, 'error');
          return;
        }
      }
      setShowModal(false);
      clearPatient();
      showToast('Encounter signed and closed. Ready for next patient.', 'success');
    } finally {
      setSigning(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const showSave = Boolean(patientName.trim()) && !patientId;
  const newDisabled = saving;

  return (
    <>
      {showModal && (
        <EncounterCloseModal
          patientName={patientName}
          onHold={handleHold}
          onSign={() => void handleSign()}
          onCancel={() => setShowModal(false)}
          signing={signing}
        />
      )}
      {showNewPatient && (
        <NewPatientModal
          currentSite={currentSite}
          onClose={() => setShowNewPatient(false)}
          onCreated={handlePatientCreated}
        />
      )}

      <div className="floating-actions" role="toolbar" aria-label="Patient actions">
        <button
          className="fa-btn fa-btn--secondary"
          onClick={handleNew}
          disabled={newDisabled}
          title={encounterId ? 'Hold or close current encounter before starting a new patient' : 'Clear form and start a new patient'}
        >
          <span className="fa-icon">＋</span>
          <span className="fa-label">New patient</span>
        </button>

        {showSave && (
          <button
            className={`fa-btn fa-btn--save${saving ? ' fa-btn--loading' : ''}`}
            onClick={() => void handleSave()}
            disabled={saving}
            title="Save this patient to the database"
          >
            {saving
              ? <><span className="fa-spinner" /> <span className="fa-label">Saving…</span></>
              : <><Save size={14} strokeWidth={2} /> <span className="fa-label">Save patient</span></>
            }
          </button>
        )}

        {patientId && !encounterId && (
          <span className="fa-saved-badge" title={`Patient ID: ${patientId}`}>✓ Saved</span>
        )}
        {patientId && encounterId && (
          <button
            className="fa-saved-badge fa-saved-badge--enc"
            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
            onClick={() => setShowModal(true)}
            title="Encounter in progress — tap to hold or sign off"
          >
            ● In progress
          </button>
        )}
      </div>
    </>
  );
}
