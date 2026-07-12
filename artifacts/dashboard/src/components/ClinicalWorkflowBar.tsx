import { useMemo } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { getMatrix } from '@/lib/cc-matrices';

const SECTION_LABELS: Partial<Record<Section, string>> = {
  triage: 'Triage', hpi: 'HPI', pmh: 'PMH', surgical: 'Surgical Hx',
  medications: 'Meds', allergies: 'Allergies', family_hx: 'Family Hx',
  toxic: 'Social', ros: 'ROS', examination: 'Exam', wounds: 'Wounds',
  investigations: 'Labs', blood_gas: 'ABG', radiology: 'Imaging',
  attachments: 'Files', assessment: 'Assessment', plan: 'Plan',
  procedures: 'Procedure', prescriptions: 'RX', dosing: 'Dosing',
  fluid_nutrition: 'Fluids', referring_providers: 'Referrals',
  progress: 'Notes', monitoring: 'Monitor', tasks: 'Tasks',
};

const SECTION_ICONS: Partial<Record<Section, string>> = {
  triage: '⚡', hpi: '📝', pmh: '🏥', surgical: '⚕️',
  medications: '💊', allergies: '⚠️', family_hx: '👨‍👩‍👧', toxic: '🚬',
  ros: '📋', examination: '🩺', wounds: '🩹',
  investigations: '🧪', blood_gas: '💨', radiology: '📡', attachments: '📎',
  assessment: '🎯', plan: '📄', procedures: '✂️',
  prescriptions: '💊', dosing: '💉', fluid_nutrition: '💧',
  referring_providers: '↗', progress: '📒', monitoring: '📊', tasks: '✓',
};

export default function ClinicalWorkflowBar() {
  const {
    activeCcKey, activeSection, setActiveSection,
    symptoms, freeText, vitals,
    hpiNotes, comorbidities,
    surgicalHistory, surgicalNotes,
    medications, medicationsText, allergies,
    familyHistory, familyHistoryNotes,
    toxicHabits, occupation, rosFindings,
    examGeneral, examCardio, examResp, examAbdomen,
    examNeuro, examExtremities, examBreast, examWound,
    orderedInvestigations, radiologyRequests, attachments,
    assessment, plan, progressNotes,
  } = useAppContext();

  const matrix = activeCcKey ? getMatrix(activeCcKey) : undefined;
  if (!matrix) return null;

  const steps = matrix.sections;

  const done = useMemo<Partial<Record<Section, boolean>>>(() => {
    const hasVitals = Object.values(vitals).some(v => v.trim());
    const hasExam = !!(examGeneral || examCardio || examResp || examAbdomen || examNeuro || examExtremities || examBreast || examWound);
    const hasRos = Object.values(rosFindings).some(f => f.status !== 'not-asked' || f.details.length > 0 || f.notes);
    return {
      triage:       symptoms.length > 0 || !!freeText.trim() || hasVitals,
      hpi:          !!hpiNotes.trim(),
      pmh:          comorbidities.length > 0,
      surgical:     surgicalHistory.length > 0 || !!surgicalNotes.trim(),
      medications:  medications.length > 0 || !!medicationsText.trim(),
      allergies:    !!allergies.trim(),
      family_hx:    familyHistory.length > 0 || !!familyHistoryNotes.trim(),
      toxic:        toxicHabits.length > 0 || !!occupation.trim(),
      ros:          hasRos,
      examination:  hasExam,
      investigations: orderedInvestigations.length > 0,
      radiology:    radiologyRequests.length > 0,
      attachments:  attachments.length > 0,
      assessment:   !!assessment.trim(),
      plan:         !!plan.trim(),
      progress:     progressNotes.length > 0,
    };
  }, [symptoms, freeText, vitals, hpiNotes, comorbidities, surgicalHistory, surgicalNotes,
    medications, medicationsText, allergies, familyHistory, familyHistoryNotes, toxicHabits,
    occupation, rosFindings, examGeneral, examCardio, examResp, examAbdomen, examNeuro,
    examExtremities, examBreast, examWound, orderedInvestigations, radiologyRequests,
    attachments, assessment, plan, progressNotes]);

  const completedCount = steps.filter(s => done[s]).length;
  const totalCount = steps.length;

  return (
    <div style={{
      background: 'var(--bg, #fff)',
      borderBottom: '1px solid #e5e7eb',
      padding: '6px 12px 8px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#6b7280',
        }}>
          {matrix.icon} {matrix.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: completedCount === totalCount ? '#16a34a' : '#0b8278',
          background: completedCount === totalCount ? '#f0fdf4' : '#f0fdfa',
          padding: '1px 7px', borderRadius: 10,
        }}>
          {completedCount}/{totalCount} done
        </span>
        {completedCount === totalCount && (
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>✓ Complete</span>
        )}
        {/* Progress bar */}
        <div style={{ flex: 1, height: 3, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', minWidth: 40, maxWidth: 120 }}>
          <div style={{
            height: '100%',
            width: `${Math.round((completedCount / totalCount) * 100)}%`,
            background: completedCount === totalCount ? '#16a34a' : '#0b8278',
            borderRadius: 4,
            transition: 'width .3s ease',
          }} />
        </div>
      </div>

      {/* Step pills */}
      <div style={{
        display: 'flex', gap: 4, overflowX: 'auto',
        scrollbarWidth: 'none', paddingBottom: 2,
      }}>
        {steps.map((section, idx) => {
          const isActive = section === activeSection;
          const isDone = !!done[section];

          const bg = isActive
            ? '#0b8278'
            : isDone
              ? '#dcfce7'
              : '#f3f4f6';
          const color = isActive
            ? '#fff'
            : isDone
              ? '#15803d'
              : '#374151';
          const border = isActive
            ? '1px solid #0b8278'
            : isDone
              ? '1px solid #bbf7d0'
              : '1px solid #e5e7eb';

          return (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              title={SECTION_LABELS[section] ?? section}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 8px',
                background: bg, color, border,
                borderRadius: 20, cursor: 'pointer',
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'background .15s, color .15s',
                lineHeight: 1.4,
              }}
            >
              {isDone && !isActive && (
                <span style={{ fontSize: 9, lineHeight: 1 }}>✓</span>
              )}
              {!isDone && !isActive && (
                <span style={{
                  fontSize: 9, color: '#9ca3af',
                  fontWeight: 700, lineHeight: 1,
                }}>
                  {idx + 1}
                </span>
              )}
              {isActive && (
                <span style={{ fontSize: 10, lineHeight: 1 }}>
                  {SECTION_ICONS[section] ?? '●'}
                </span>
              )}
              <span>{SECTION_LABELS[section] ?? section}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
