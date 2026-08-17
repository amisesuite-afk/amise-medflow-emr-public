import { useAppContext, type Section, type TopSection, type VitalsState } from '@/context/AppContext';

function getAdaptivePath(
  symptoms: string[],
  vitals: VitalsState,
): { topSection: TopSection; section: Section; label: string; hint: string } | null {
  const sbp  = parseFloat(vitals.systolicBp);
  const spo2 = parseFloat(vitals.spo2);
  const hr   = parseFloat(vitals.heartRate);
  const temp = parseFloat(vitals.temperatureC);

  // Red-flag vitals override complaint-based routing
  if (
    (Number.isFinite(sbp)  && sbp  < 90)  ||
    (Number.isFinite(spo2) && spo2 < 92)  ||
    (Number.isFinite(hr)   && hr   > 140) ||
    (Number.isFinite(temp) && temp > 38.5 && Number.isFinite(hr) && hr > 100)
  ) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'Abnormal vital signs — begin with acuity scoring and red-flag assessment.' };
  }

  const TRAUMA_KEYWORDS = ['Major trauma', 'RTA / MVA', 'Stab / penetrating wound', 'Fall from height', 'Assault', 'Burns'];
  if (symptoms.some(s => TRAUMA_KEYWORDS.includes(s))) {
    return { topSection: 'trauma', section: 'examination', label: 'ATLS Survey', hint: 'Trauma patient — proceed directly to ATLS primary survey (ABCDE).' };
  }

  if (symptoms.some(s => s === 'Pre-operative visit')) {
    return { topSection: 'procedures', section: 'procedures', label: 'Pre-Op', hint: 'Pre-operative workup — verify investigations, consent, and anaesthetic review.' };
  }
  if (symptoms.some(s => s === 'Post-operative review')) {
    return { topSection: 'procedures', section: 'procedures', label: 'Post-Op', hint: 'Post-operative review — assess wound, drain output, and analgesic ladder.' };
  }
  if (symptoms.includes('Breast lump')) {
    return { topSection: 'consultation', section: 'examination', label: 'Breast Exam', hint: 'Breast lump — targeted breast examination: quadrant, size, mobility, lymph nodes.' };
  }
  if (symptoms.includes('Wound concern')) {
    return { topSection: 'consultation', section: 'examination', label: 'Wound Exam', hint: 'Wound concern — assess for dehiscence, infection, or seroma.' };
  }
  if (symptoms.includes('Follow-up')) {
    return { topSection: 'consultation', section: 'assessment', label: 'Assessment', hint: 'Follow-up — review previous plan, update problem list, and adjust management.' };
  }
  if (symptoms.some(s => ['Chest pain', 'Shortness of breath'].includes(s))) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'Cardiorespiratory complaint — acuity first, then ROS and examination.' };
  }
  if (symptoms.some(s => ['Jaundice', 'Abdominal pain', 'Rectal bleeding', 'Nausea / vomiting'].includes(s))) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: 'GI complaint — start with pain characterisation and triage scoring.' };
  }
  if (symptoms.length > 0) {
    return { topSection: 'consultation', section: 'triage', label: 'Triage', hint: `${symptoms.join(', ')} — begin with history and acuity scoring.` };
  }
  return null;
}

/** Pre-visit status banner for doctor/admin: shows once a nurse has registered the
 * patient or recorded vitals, with an adaptive suggestion for where to start the
 * consultation once vitals are in. Self-hides once the doctor moves past pre-visit. */
export default function PreVisitStatusBanner() {
  const { preVisitStatus, symptoms, vitals, setTopSection, setActiveSection } = useAppContext();

  if (preVisitStatus === 'registered') {
    return (
      <div style={{ margin: '0 0 12px', padding: '10px 16px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>⏳</span>
        Patient registered — awaiting nurse vitals
      </div>
    );
  }

  if (preVisitStatus === 'vitals_done') {
    const path = getAdaptivePath(symptoms, vitals);
    return (
      <div style={{ margin: '0 0 12px', padding: '12px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 16 }}>✓</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ color: '#166534', fontWeight: 700, fontSize: 13 }}>
            Vitals recorded — patient ready for consultation
          </div>
          {path && (
            <div style={{ color: '#166534', fontSize: 12, marginTop: 2, opacity: 0.85 }}>
              {path.hint}
            </div>
          )}
        </div>
        {path && (
          <button
            type="button"
            onClick={() => { setTopSection(path.topSection); setActiveSection(path.section); }}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: '#166534', color: '#fff',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Go to {path.label} →
          </button>
        )}
      </div>
    );
  }

  return null;
}
