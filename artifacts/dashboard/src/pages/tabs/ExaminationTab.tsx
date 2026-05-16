import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

interface ExamField { key: keyof ReturnType<typeof useExamFields>; label: string; placeholder: string; icon: string; }

function useExamFields() {
  const {
    examGeneral, setExamGeneral,
    examCardio, setExamCardio,
    examResp, setExamResp,
    examAbdomen, setExamAbdomen,
    examNeuro, setExamNeuro,
    examExtremities, setExamExtremities,
    examBreast, setExamBreast,
    examWound, setExamWound,
  } = useAppContext();
  return {
    examGeneral: { value: examGeneral, set: setExamGeneral },
    examCardio: { value: examCardio, set: setExamCardio },
    examResp: { value: examResp, set: setExamResp },
    examAbdomen: { value: examAbdomen, set: setExamAbdomen },
    examNeuro: { value: examNeuro, set: setExamNeuro },
    examExtremities: { value: examExtremities, set: setExamExtremities },
    examBreast: { value: examBreast, set: setExamBreast },
    examWound: { value: examWound, set: setExamWound },
  };
}

const EXAM_SECTIONS = [
  { key: 'examGeneral',     label: 'General',             icon: '👤', placeholder: 'Appearance, BMI, hydration, pallor, jaundice, cyanosis, oedema, lymphadenopathy…' },
  { key: 'examCardio',      label: 'Cardiovascular',      icon: '❤️', placeholder: 'HR, rhythm, BP (both arms), JVP, heart sounds, murmurs, peripheral pulses, oedema…' },
  { key: 'examResp',        label: 'Respiratory',         icon: '🫁', placeholder: 'RR, SpO₂, expansion, percussion, breath sounds, added sounds, trachea position…' },
  { key: 'examAbdomen',     label: 'Abdomen',             icon: '🔵', placeholder: 'Inspection, tenderness, guarding, rigidity, rebound, organomegaly, hernia, bowel sounds, PR…' },
  { key: 'examNeuro',       label: 'Neurological',        icon: '🧠', placeholder: 'GCS, orientation, cranial nerves, power, sensation, reflexes, coordination, gait…' },
  { key: 'examExtremities', label: 'Extremities',         icon: '🦵', placeholder: 'Peripheral pulses, capillary refill, oedema, DVT signs, wounds, skin changes…' },
  { key: 'examBreast',      label: 'Breast / local area', icon: '🔍', placeholder: 'Mass description (size, shape, consistency, mobility, tenderness), skin, nipple, axilla…' },
  { key: 'examWound',       label: 'Wound / diabetic foot', icon: '🩹', placeholder: 'Wagner grade, wound dimensions, depth, base, slough, exudate, surrounding skin, pulses, sensation…' },
] as const;

export default function ExaminationTab() {
  const fields = useExamFields();
  const filledCount = EXAM_SECTIONS.filter(s => fields[s.key].value.trim()).length;

  return (
    <div className="gap-y">
      <CollapsibleCard title="Examination findings" badge={`${filledCount} / ${EXAM_SECTIONS.length} completed`}>
        <div className="exam-grid">
          {EXAM_SECTIONS.map(section => (
            <div key={section.key} className="exam-field">
              <label>{section.icon} {section.label}</label>
              <textarea
                value={fields[section.key].value}
                onChange={e => (fields[section.key] as any).set(e.target.value)}
                placeholder={section.placeholder}
              />
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  );
}
