import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import IcdPicker from '@/components/IcdPicker';
import CptPicker from '@/components/CptPicker';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { getCdsSuggestions } from '@/lib/clinical-cds';

const DIFFERENTIAL_PROMPTS: Record<string, string[]> = {
  'ercp_workup': ['Choledocholithiasis', 'Cholangiocarcinoma', 'Pancreatic head carcinoma', 'Primary sclerosing cholangitis', 'Acute cholangitis', 'Acute hepatitis'],
  'breast':      ['Fibroadenoma', 'Fibrocystic change', 'Breast carcinoma', 'Phyllodes tumour', 'Mastitis / abscess', 'Fat necrosis', 'Ductal carcinoma in situ'],
  'post_op':     ['Surgical site infection', 'Wound dehiscence', 'Intra-abdominal collection', 'Anastomotic leak', 'Pulmonary embolism', 'Deep vein thrombosis', 'Ileus / obstruction'],
  'diabetic_foot':['Diabetic foot ulcer (Wagner grade?)', 'Necrotising fasciitis', 'Osteomyelitis', 'Peripheral arterial disease', 'Cellulitis', 'Abscess'],
  'new_consult': ['Acute appendicitis', 'Cholecystitis', 'Diverticulitis', 'Bowel obstruction', 'Hernia (complicated)', 'Peptic ulcer disease', 'Pancreatitis'],
};

const URGENCY_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  urgent:   { bg: '#fff1f2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444' },
  relevant: { bg: '#fffbeb', border: '#fcd34d', color: '#78350f', dot: '#f59e0b' },
  consider: { bg: '#f0fdf4', border: '#86efac', color: '#14532d', dot: '#22c55e' },
};

function MicButton({ listening, supported, onToggle }: { listening: boolean; supported: boolean; onToggle: () => void }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={listening ? 'Stop dictation' : 'Dictate'}
      style={{
        background: listening ? '#ef4444' : '#f9fafb',
        border: `1px solid ${listening ? '#ef4444' : '#d1d5db'}`,
        borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
        color: listening ? '#fff' : '#6b7280', fontSize: 13, lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      {listening ? '⏹ Stop' : '🎙 Dictate'}
    </button>
  );
}

export default function AssessmentTab() {
  const {
    assessment, setAssessment,
    differentials, setDifferentials,
    triageResult,
    symptoms, examFindings, vitals, investigationResults,
    comorbidities, age, sex, isPostOp, procedureData, rosFindings,
  } = useAppContext();

  const apptType = triageResult.appointmentType;
  const ddxSuggestions = DIFFERENTIAL_PROMPTS[apptType] || DIFFERENTIAL_PROMPTS['new_consult'];

  const assessmentMic = useSpeechInput();
  const differentialsMic = useSpeechInput();

  const cdsSuggestions = getCdsSuggestions({
    symptoms,
    examFindings,
    vitals,
    investigationResults,
    comorbidities,
    assessment,
    rosFindings,
    age,
    sex,
    isPostOp,
    procedureData,
  });

  return (
    <div className="gap-y">

      {/* CDS suggestions — only shown when there are triggered rules */}
      {cdsSuggestions.length > 0 && (
        <CollapsibleCard title={`Clinical Decision Support — ${cdsSuggestions.length} active suggestion${cdsSuggestions.length > 1 ? 's' : ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cdsSuggestions.map(s => {
              const style = URGENCY_STYLE[s.urgency];
              return (
                <div
                  key={s.scaleKey}
                  style={{
                    background: style.bg,
                    border: `1px solid ${style.border}`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <span style={{ color: style.dot, fontSize: 10, marginTop: 3 }}>●</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: style.color }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.triggerReason}</div>
                    {s.needsLabs && !s.labsPresent && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>
                        Add lab results in Investigations to complete this score
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: style.color, background: style.border, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                  }}>
                    {s.categoryTag}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
            Navigate to the <strong>Scales</strong> tab to complete and score each tool.
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard title="Working diagnosis / assessment">
        <div className="fld">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ margin: 0 }}>Primary assessment</label>
            <MicButton
              listening={assessmentMic.listening}
              supported={assessmentMic.supported}
              onToggle={() => {
                if (assessmentMic.listening) {
                  assessmentMic.stop();
                } else {
                  assessmentMic.start(text => setAssessment(assessment ? `${assessment} ${text}` : text));
                }
              }}
            />
          </div>
          <textarea
            value={assessment}
            onChange={e => setAssessment(e.target.value)}
            placeholder="Most likely diagnosis, clinical impression, and reasoning…"
            style={{ minHeight: 100 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Differential diagnoses">
        <div className="fld">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ margin: 0 }}>Differentials (free text or use prompts below)</label>
            <MicButton
              listening={differentialsMic.listening}
              supported={differentialsMic.supported}
              onToggle={() => {
                if (differentialsMic.listening) {
                  differentialsMic.stop();
                } else {
                  differentialsMic.start(text => setDifferentials(differentials ? `${differentials}\n${text}` : text));
                }
              }}
            />
          </div>
          <textarea
            value={differentials}
            onChange={e => setDifferentials(e.target.value)}
            placeholder="1. …\n2. …\n3. …"
            style={{ minHeight: 80 }}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="section-head">Suggested for {apptType.replace(/_/g, ' ')}</div>
          <div className="chips compact">
            {ddxSuggestions.map(d => (
              <button
                key={d}
                type="button"
                className="chip"
                onClick={() => setDifferentials(differentials ? `${differentials}\n${d}` : d)}
              >
                + {d}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Investigations ordered / results" defaultOpen={false}>
        <div className="fld">
          <label>Lab / imaging results or requests</label>
          <textarea
            placeholder="FBC: Hb 9.2, WBC 14.3, CRP 180…&#10;USS abdomen: CBD 12mm, multiple gallstones…"
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="ICD-10 codes" defaultOpen={false}>
        <IcdPicker />
      </CollapsibleCard>

      <CollapsibleCard title="CPT procedure codes" defaultOpen={false}>
        <CptPicker />
      </CollapsibleCard>
    </div>
  );
}
