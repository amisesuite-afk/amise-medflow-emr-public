import { useAppContext, type RosFinding } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

type RosStatus = RosFinding['status'];

interface RosSystem {
  key: string;
  label: string;
  icon: string;
  symptoms: string[];
}

const ROS_SYSTEMS: RosSystem[] = [
  {
    key: 'constitutional',
    label: 'Constitutional',
    icon: '🌡',
    symptoms: ['Fever', 'Chills / rigors', 'Night sweats', 'Weight loss (unintentional)', 'Weight gain', 'Fatigue / malaise', 'Anorexia', 'Generalised weakness', 'Diaphoresis'],
  },
  {
    key: 'heent',
    label: 'HEENT',
    icon: '👁',
    symptoms: ['Headache', 'Visual loss / blurring', 'Double vision', 'Photophobia', 'Eye redness / discharge', 'Hearing loss', 'Tinnitus', 'Ear pain', 'Nasal discharge', 'Epistaxis', 'Sore throat', 'Hoarse voice', 'Dysphagia', 'Neck swelling / mass'],
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular',
    icon: '❤️',
    symptoms: ['Chest pain', 'Palpitations', 'Syncope / near-syncope', 'Exertional dyspnoea', 'Orthopnoea', 'PND', 'Leg swelling', 'Claudication', 'Rest pain'],
  },
  {
    key: 'respiratory',
    label: 'Respiratory',
    icon: '🫁',
    symptoms: ['Shortness of breath', 'Cough', 'Haemoptysis', 'Wheeze', 'Chest tightness', 'Pleuritic chest pain', 'Nocturnal symptoms', 'Snoring / sleep apnoea'],
  },
  {
    key: 'gastrointestinal',
    label: 'Gastrointestinal',
    icon: '🔵',
    symptoms: ['Abdominal pain', 'Nausea', 'Vomiting', 'Haematemesis', 'Heartburn / GORD', 'Dysphagia', 'Jaundice', 'Diarrhoea', 'Constipation', 'Change in bowel habit', 'Rectal bleeding', 'Melaena', 'Bloating', 'Anorexia / early satiety'],
  },
  {
    key: 'genitourinary',
    label: 'Genitourinary',
    icon: '💧',
    symptoms: ['Dysuria', 'Haematuria', 'Urinary frequency', 'Nocturia', 'Urinary retention', 'Poor stream', 'Loin pain', 'Renal colic', 'Vaginal discharge', 'Abnormal bleeding', 'Pelvic pain'],
  },
  {
    key: 'musculoskeletal',
    label: 'Musculoskeletal',
    icon: '🦴',
    symptoms: ['Joint pain', 'Joint swelling', 'Morning stiffness', 'Back pain', 'Lower back pain', 'Neck pain', 'Muscle pain / cramps', 'Limb weakness', 'Limited ROM'],
  },
  {
    key: 'skin',
    label: 'Skin / Integumentary',
    icon: '🩺',
    symptoms: ['Rash', 'Pruritus', 'Skin lesion / mole change', 'Bruising', 'Wound / ulcer', 'Hair loss', 'Nail changes', 'Skin colour change'],
  },
  {
    key: 'neurological',
    label: 'Neurological',
    icon: '🧠',
    symptoms: ['Headache', 'Dizziness / vertigo', 'Syncope', 'Seizure', 'Confusion', 'Memory loss', 'Speech difficulty', 'Focal weakness', 'Sensory loss / numbness', 'Neck stiffness', 'Tremor', 'Unsteady gait'],
  },
  {
    key: 'psychiatric',
    label: 'Psychiatric',
    icon: '💬',
    symptoms: ['Anxiety', 'Low mood / depression', 'Insomnia', 'Panic attacks', 'Hallucinations', 'Suicidal ideation', 'Social withdrawal', 'Poor concentration'],
  },
  {
    key: 'endocrine',
    label: 'Endocrine / Metabolic',
    icon: '⚗️',
    symptoms: ['Polydipsia (excessive thirst)', 'Polyuria', 'Heat / cold intolerance', 'Neck swelling (thyroid)', 'Hair / skin / nail changes', 'Weight change', 'Hypoglycaemia episodes'],
  },
];

const STATUS_OPTS: { value: RosStatus; label: string; color: string }[] = [
  { value: 'normal',    label: 'Normal',    color: '#059669' },
  { value: 'positive',  label: 'Positive ▾', color: '#dc2626' },
  { value: 'negative',  label: 'Negative',  color: '#d97706' },
  { value: 'not-asked', label: 'N/A',       color: '#9ca3af' },
];

const BLANK: RosFinding = { status: 'not-asked', details: [], notes: '' };

export default function RosTab() {
  const { rosFindings, setRosFindings } = useAppContext();

  function getSystem(key: string): RosFinding {
    return rosFindings[key] ?? BLANK;
  }

  function setStatus(key: string, status: RosStatus) {
    const prev = getSystem(key);
    setRosFindings({
      ...rosFindings,
      [key]: { ...prev, status, details: status === 'positive' ? prev.details : [] },
    });
  }

  function toggleDetail(key: string, sym: string) {
    const prev = getSystem(key);
    const details = prev.details.includes(sym)
      ? prev.details.filter(d => d !== sym)
      : [...prev.details, sym];
    setRosFindings({ ...rosFindings, [key]: { ...prev, details } });
  }

  function setNotes(key: string, notes: string) {
    const prev = getSystem(key);
    setRosFindings({ ...rosFindings, [key]: { ...prev, notes } });
  }

  const positiveCount = ROS_SYSTEMS.filter(s => (rosFindings[s.key]?.status ?? 'not-asked') === 'positive').length;
  const normalCount   = ROS_SYSTEMS.filter(s => (rosFindings[s.key]?.status ?? 'not-asked') === 'normal').length;
  const reviewedCount = ROS_SYSTEMS.filter(s => (rosFindings[s.key]?.status ?? 'not-asked') !== 'not-asked').length;

  return (
    <div className="gap-y">
      <CollapsibleCard
        title="Review of Systems"
        badge={`${reviewedCount}/${ROS_SYSTEMS.length} reviewed · ${positiveCount} positive · ${normalCount} normal`}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
          Mark each system as Normal, Positive (expand to select symptoms), Negative, or Not Asked.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ROS_SYSTEMS.map(system => {
            const finding = getSystem(system.key);
            const isPositive = finding.status === 'positive';

            return (
              <div key={system.key} style={{
                border: '1px solid',
                borderColor: isPositive ? '#fca5a5' : '#e5e7eb',
                borderRadius: 8,
                overflow: 'hidden',
                background: isPositive ? '#fff5f5' : '#fff',
              }}>
                {/* System header row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: isPositive ? '#fee2e2' : '#f9fafb',
                  borderBottom: (isPositive || finding.status !== 'not-asked') ? '1px solid #e5e7eb' : 'none',
                }}>
                  <span style={{ fontSize: 14, minWidth: 22 }}>{system.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: '#1f2937' }}>
                    {system.label}
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {STATUS_OPTS.map(opt => {
                      const active = finding.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(system.key, opt.value)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            border: `1px solid ${active ? opt.color : '#d1d5db'}`,
                            background: active ? opt.color : '#f9fafb',
                            color: active ? '#fff' : '#374151',
                            fontSize: 11,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Positive details expansion */}
                {isPositive && (
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Symptoms reported:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {system.symptoms.map(sym => {
                        const on = finding.details.includes(sym);
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => toggleDetail(system.key, sym)}
                            style={{
                              padding: '3px 10px',
                              borderRadius: 12,
                              border: on ? '1px solid #dc2626' : '1px solid #d1d5db',
                              background: on ? '#dc2626' : '#f9fafb',
                              color: on ? '#fff' : '#374151',
                              fontSize: 12,
                              fontWeight: on ? 600 : 400,
                              cursor: 'pointer',
                            }}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={finding.notes}
                      onChange={e => setNotes(system.key, e.target.value)}
                      placeholder={`Additional ${system.label.toLowerCase()} details…`}
                      style={{ fontSize: 12, minHeight: 40, resize: 'vertical' }}
                    />
                  </div>
                )}

                {/* Negative — show notes field too */}
                {finding.status === 'negative' && (
                  <div style={{ padding: '8px 12px' }}>
                    <textarea
                      value={finding.notes}
                      onChange={e => setNotes(system.key, e.target.value)}
                      placeholder={`Notes on negative findings (${system.label.toLowerCase()})…`}
                      style={{ fontSize: 12, minHeight: 36, resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleCard>
    </div>
  );
}
