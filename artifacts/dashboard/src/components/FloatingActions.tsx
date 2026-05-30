import { useState } from 'react';
import { Save } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { saveNewPatient, createEncounter } from '@/lib/db';
import { DEMO_MODE } from '@/context/AuthContext';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';

export default function FloatingActions() {
  const {
    clearPatient,
    patientName, age, sex, dob, phone,
    patientId, setPatientId,
    encounterId, setEncounterId,
    symptoms, triageResult,
    currentSite,
  } = useAppContext();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  function handleNew() {
    if (patientName && !window.confirm(`Clear all data for "${patientName}" and start a new patient?`)) return;
    clearPatient();
  }

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

  async function handleSave() {
    if (!patientName.trim()) {
      showToast('Enter a patient name before saving.', 'error');
      return;
    }

    if (DEMO_MODE) {
      handleSaveDemo();
      return;
    }

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
      showToast(`Patient "${patient.full_name}" saved and encounter opened.`, 'success');
    } finally {
      setSaving(false);
    }
  }

  // Show "Save patient" only when there's a name but no DB record yet
  const showSave = Boolean(patientName.trim()) && !patientId;
  // Disable "New patient" while saving to prevent race
  const newDisabled = saving;

  return (
    <div className="floating-actions" role="toolbar" aria-label="Patient actions">
      <button
        className="fa-btn fa-btn--secondary"
        onClick={handleNew}
        disabled={newDisabled}
        title="Clear form and start a new patient"
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
        <span className="fa-saved-badge fa-saved-badge--enc" title={`Encounter ID: ${encounterId}`}>✓ Encounter open</span>
      )}
    </div>
  );
}
