import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import AnatomicalSketch from '@/components/AnatomicalSketch';
import ExamPhotoPanel from '@/components/ExamPhotoPanel';

interface ExamSystem {
  key: string;
  label: string;
  icon: string;
  chips: string[];
  legacyKey: 'examGeneral' | 'examCardio' | 'examResp' | 'examAbdomen' | 'examBreast' | 'examWound' | 'examNeuro' | 'examExtremities';
}

const EXAM_SYSTEMS: ExamSystem[] = [
  {
    key: 'general',
    label: 'General',
    icon: '👤',
    legacyKey: 'examGeneral',
    chips: ['Well-nourished', 'Cachectic', 'Pale', 'Jaundiced', 'Cyanosed', 'Oedematous', 'Diaphoretic', 'In distress', 'Alert and oriented', 'GCS < 15'],
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular',
    icon: '❤️',
    legacyKey: 'examCardio',
    chips: ['S1+S2 normal', 'Murmur present', 'Tachycardia', 'Bradycardia', 'Irregular rhythm', 'JVP elevated', 'Peripheral oedema', 'Peripheral pulses absent', 'Capillary refill > 2s'],
  },
  {
    key: 'respiratory',
    label: 'Respiratory',
    icon: '🫁',
    legacyKey: 'examResp',
    chips: ['Clear to auscultation', 'Crackles (L)', 'Crackles (R)', 'Wheeze', 'Reduced breath sounds (L)', 'Reduced breath sounds (R)', 'Dull to percussion', 'Pleural rub', 'Trachea deviated'],
  },
  {
    key: 'abdomen',
    label: 'Abdomen',
    icon: '🔵',
    legacyKey: 'examAbdomen',
    chips: [
      'Soft', 'Distended', 'Tender RUQ', 'Tender RLQ', 'Tender LUQ', 'Tender LLQ',
      'Epigastric tenderness', 'Diffuse tenderness', 'Guarding', 'Rigidity', 'Rebound tenderness',
      "Murphy's sign +", "Rovsing's sign +", 'Bowel sounds absent', 'Bowel sounds hyperactive',
      'Hepatomegaly', 'Splenomegaly', 'Mass palpable', 'Hernia present', 'PR: blood',
    ],
  },
  {
    key: 'breast',
    label: 'Breast / Local',
    icon: '🔍',
    legacyKey: 'examBreast',
    chips: [
      'No mass', 'Mass (L)', 'Mass (R)', 'Hard', 'Soft', 'Mobile', 'Fixed',
      'Skin tethering', "Peau d'orange", 'Nipple inversion', 'Nipple discharge',
      'Axillary nodes palpable', 'Erythema / warmth',
    ],
  },
  {
    key: 'wound',
    label: 'Wound / Diabetic foot',
    icon: '🩹',
    legacyKey: 'examWound',
    chips: [
      'Granulating', 'Sloughy', 'Necrotic', 'Dry gangrene', 'Wet gangrene',
      'Cellulitis', 'Abscess', 'Osteomyelitis suspected',
      'Exposed tendon', 'Exposed bone', 'Pulses absent', 'Sensation reduced',
      'Malodorous', 'Undermining present',
    ],
  },
  {
    key: 'neurological',
    label: 'Neurological',
    icon: '🧠',
    legacyKey: 'examNeuro',
    chips: ['GCS 15', 'GCS < 15', 'Oriented', 'Confused', 'Focal deficit', 'Weakness (L)', 'Weakness (R)', 'Sensory loss', 'No focal deficit'],
  },
  {
    key: 'extremities',
    label: 'Extremities',
    icon: '🦵',
    legacyKey: 'examExtremities',
    chips: ['Pulses present', 'DP absent', 'PT absent', 'Femoral reduced', 'Varicose veins', 'DVT signs', 'Oedema present', 'Wound present', 'Healthy skin'],
  },
];


export default function ExaminationTab() {
  const ctx = useAppContext();
  const { examFindings, setExamFindings, examNotes, setExamNotes, anatomicalFindings, examPhotos } = ctx;

  const legacySetterMap: Record<string, (v: string) => void> = {
    general: ctx.setExamGeneral,
    cardiovascular: ctx.setExamCardio,
    respiratory: ctx.setExamResp,
    abdomen: ctx.setExamAbdomen,
    breast: ctx.setExamBreast,
    wound: ctx.setExamWound,
    neurological: ctx.setExamNeuro,
    extremities: ctx.setExamExtremities,
  };

  function toggleChip(systemKey: string, chip: string) {
    const current = examFindings[systemKey] ?? [];
    const next = current.includes(chip)
      ? current.filter(c => c !== chip)
      : [...current, chip];

    setExamFindings({ ...examFindings, [systemKey]: next });

    // Also update legacy string field for SummaryTab compatibility
    const setter = legacySetterMap[systemKey];
    if (setter) setter(next.join(', '));
  }

  function updateNote(systemKey: string, note: string) {
    setExamNotes({ ...examNotes, [systemKey]: note });
    // Merge chips + note into legacy string
    const chips = examFindings[systemKey] ?? [];
    const setter = legacySetterMap[systemKey];
    if (setter) {
      const parts: string[] = [];
      if (chips.length) parts.push(chips.join(', '));
      if (note.trim()) parts.push(note.trim());
      setter(parts.join('. '));
    }
  }

  const systemsWithData = EXAM_SYSTEMS.filter(s =>
    (examFindings[s.key]?.length ?? 0) > 0 || (examNotes[s.key]?.trim())
  ).length;

  return (
    <div className="gap-y">
      <CollapsibleCard title="Anatomical findings" badge={anatomicalFindings.length > 0 ? `${anatomicalFindings.length} zones` : undefined}>
        <AnatomicalSketch />
      </CollapsibleCard>

      <CollapsibleCard
        title="Clinical photographs"
        badge={examPhotos.length > 0 ? `${examPhotos.length} / 5` : undefined}
      >
        <ExamPhotoPanel />
      </CollapsibleCard>

      <CollapsibleCard
        title="Examination findings"
        badge={`${systemsWithData} / ${EXAM_SYSTEMS.length} systems`}
      >
        <div className="exam-grid">
          {EXAM_SYSTEMS.map(system => {
            const selected = examFindings[system.key] ?? [];
            const note = examNotes[system.key] ?? '';

            return (
              <div key={system.key} className="exam-field">
                <label>{system.icon} {system.label}</label>

                {/* Chip row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {system.chips.map(chip => {
                    const isOn = selected.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleChip(system.key, chip)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 14,
                          border: isOn ? '1px solid #0d9488' : '1px solid #d1d5db',
                          background: isOn ? '#0d9488' : '#f9fafb',
                          color: isOn ? '#fff' : '#374151',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: isOn ? 600 : 400,
                          transition: 'all 0.12s',
                        }}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>

                {/* Free text notes */}
                <textarea
                  value={note}
                  onChange={e => updateNote(system.key, e.target.value)}
                  placeholder={`Additional ${system.label.toLowerCase()} findings…`}
                  style={{ fontSize: 13, minHeight: 48, resize: 'vertical' }}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleCard>
    </div>
  );
}
