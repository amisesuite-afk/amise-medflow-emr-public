import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';
import AnatomicalSketch from '@/components/AnatomicalSketch';
import ExamPhotoPanel from '@/components/ExamPhotoPanel';
import WoundAssessmentCard from '@/components/WoundAssessmentCard';
import ExamGuidePanel from '@/components/ExamGuidePanel';
import { computeRankedDifferentials } from '@/lib/symptom-inference';

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

// Key examination findings to look for per leading differential
// system key → chips that are most diagnostically relevant
const DX_EXAM_FOCUS: Record<string, { system: string; chips: string[] }[]> = {
  acute_cholecystitis:    [{ system: 'abdomen',        chips: ["Murphy's sign +", 'Tender RUQ', 'Guarding'] }],
  acute_cholangitis:      [{ system: 'abdomen',        chips: ['Tender RUQ', 'Guarding'] }, { system: 'general', chips: ['Jaundiced', 'In distress'] }],
  cbd_obstruction:        [{ system: 'general',        chips: ['Jaundiced'] }, { system: 'abdomen', chips: ['Tender RUQ', 'Hepatomegaly'] }],
  gallstone_pancreatitis: [{ system: 'abdomen',        chips: ['Epigastric tenderness', 'Guarding', 'Distended'] }],
  acute_appendicitis:     [{ system: 'abdomen',        chips: ['Tender RLQ', "Rovsing's sign +", 'Guarding', 'Rebound tenderness'] }],
  paed_appendicitis:      [{ system: 'abdomen',        chips: ['Tender RLQ', "Rovsing's sign +", 'Guarding', 'Rebound tenderness'] }],
  diverticulitis:         [{ system: 'abdomen',        chips: ['Tender LLQ', 'Guarding', 'Mass palpable'] }],
  perforated_peptic_ulcer:[{ system: 'abdomen',        chips: ['Rigidity', 'Diffuse tenderness', 'Rebound tenderness', 'Bowel sounds absent'] }],
  small_bowel_obstruction:[{ system: 'abdomen',        chips: ['Distended', 'Bowel sounds hyperactive', 'Tender RUQ', 'Tender RLQ'] }],
  large_bowel_obstruction:[{ system: 'abdomen',        chips: ['Distended', 'Bowel sounds absent', 'Mass palpable'] }],
  sigmoid_volvulus:       [{ system: 'abdomen',        chips: ['Distended', 'Bowel sounds absent', 'Tender LLQ'] }],
  aaa_symptomatic:        [{ system: 'abdomen',        chips: ['Mass palpable', 'Diffuse tenderness'] }, { system: 'extremities', chips: ['Pulses present', 'DP absent'] }],
  mesenteric_ischaemia:   [{ system: 'abdomen',        chips: ['Diffuse tenderness', 'Bowel sounds absent', 'Rigidity'] }],
  hernia_reducible:       [{ system: 'abdomen',        chips: ['Hernia present', 'Soft'] }],
  hernia_strangulated:    [{ system: 'abdomen',        chips: ['Hernia present', 'Guarding', 'In distress'] }],
  anal_fissure:           [{ system: 'abdomen',        chips: ['PR: blood'] }],
  perianal_abscess:       [{ system: 'wound',          chips: ['Abscess', 'Cellulitis'] }],
  pilonidal_abscess:      [{ system: 'wound',          chips: ['Abscess', 'Cellulitis'] }],
  fournier_gangrene:      [{ system: 'wound',          chips: ['Necrotic', 'Wet gangrene', 'Cellulitis', 'Malodorous'] }],
  breast_cancer:          [{ system: 'breast',         chips: ['Mass (L)', 'Mass (R)', 'Hard', 'Fixed', 'Skin tethering', 'Axillary nodes palpable'] }],
  fibroadenoma:           [{ system: 'breast',         chips: ['Mass (L)', 'Mass (R)', 'Soft', 'Mobile'] }],
  stroke_tia:             [{ system: 'neurological',   chips: ['Focal deficit', 'Weakness (L)', 'Weakness (R)', 'Sensory loss', 'GCS < 15'] }],
  meningitis:             [{ system: 'neurological',   chips: ['GCS < 15', 'Confused'] }, { system: 'general', chips: ['In distress'] }],
  paed_meningitis:        [{ system: 'neurological',   chips: ['GCS < 15', 'Confused'] }, { system: 'general', chips: ['In distress'] }],
  subarachnoid_haemorrhage:[{ system: 'neurological',  chips: ['GCS < 15', 'Confused'] }],
  stemi:                  [{ system: 'cardiovascular', chips: ['Tachycardia', 'Murmur present', 'Capillary refill > 2s'] }],
  heart_failure:          [{ system: 'cardiovascular', chips: ['JVP elevated', 'Peripheral oedema'] }, { system: 'respiratory', chips: ['Crackles (L)', 'Crackles (R)'] }],
  cardiac_tamponade:      [{ system: 'cardiovascular', chips: ['JVP elevated', 'Tachycardia'] }],
  pulmonary_embolism:     [{ system: 'respiratory',    chips: ['Reduced breath sounds (R)', 'Pleural rub'] }, { system: 'cardiovascular', chips: ['Tachycardia'] }],
  tension_pneumothorax:   [{ system: 'respiratory',    chips: ['Trachea deviated', 'Reduced breath sounds (L)', 'Reduced breath sounds (R)'] }],
  pneumonia:              [{ system: 'respiratory',    chips: ['Crackles (L)', 'Crackles (R)', 'Dull to percussion'] }],
  empyema_thoracis:       [{ system: 'respiratory',    chips: ['Dull to percussion', 'Reduced breath sounds (L)', 'Reduced breath sounds (R)'] }],
  lung_abscess:           [{ system: 'respiratory',    chips: ['Dull to percussion', 'Crackles (L)', 'Crackles (R)'] }],
  dvt:                    [{ system: 'extremities',    chips: ['DVT signs', 'Oedema present'] }],
  acute_limb_ischaemia:   [{ system: 'extremities',    chips: ['DP absent', 'PT absent', 'Femoral reduced'] }],
  peripheral_arterial_disease:[{ system: 'extremities',chips: ['DP absent', 'PT absent', 'Pulses present'] }],
  diabetic_foot:          [{ system: 'wound',          chips: ['Cellulitis', 'Abscess', 'Osteomyelitis suspected', 'Pulses absent', 'Sensation reduced'] }],
  necrotising_fasciitis:  [{ system: 'wound',          chips: ['Necrotic', 'Wet gangrene', 'Cellulitis', 'Malodorous'] }],
  hepatocellular_carcinoma:[{ system: 'abdomen',       chips: ['Hepatomegaly', 'Mass palpable'] }, { system: 'general', chips: ['Jaundiced', 'Cachectic'] }],
  pancreatic_cancer:      [{ system: 'abdomen',        chips: ['Mass palpable', 'Epigastric tenderness'] }, { system: 'general', chips: ['Jaundiced', 'Cachectic'] }],
  portal_hypertension:    [{ system: 'abdomen',        chips: ['Splenomegaly', 'Hepatomegaly', 'Distended'] }, { system: 'general', chips: ['Jaundiced'] }],
  aki:                    [{ system: 'general',        chips: ['Oedematous'] }, { system: 'cardiovascular', chips: ['JVP elevated', 'Peripheral oedema'] }],
  paed_intussusception:   [{ system: 'abdomen',        chips: ['Mass palpable', 'Tender RLQ', 'Distended', 'PR: blood'] }],
  pyloric_stenosis:       [{ system: 'abdomen',        chips: ['Mass palpable', 'Distended'] }],
  malrotation_volvulus:   [{ system: 'abdomen',        chips: ['Distended', 'Tender RUQ', 'Bowel sounds absent'] }],
  kawasaki:               [{ system: 'general',        chips: ['In distress'] }],
};

export default function ExaminationTab() {
  const ctx = useAppContext();
  const { examFindings, setExamFindings, examNotes, setExamNotes, anatomicalFindings, examPhotos,
          symptoms, symptomDetails, age, sex } = ctx;

  const ageNum = age ? Number(age) : null;

  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );

  // Leading dx with ≥40% confidence
  const leadingDxId = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].id : null,
    [ranked],
  );
  const leadingDxName = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].name : null,
    [ranked],
  );

  // Build a map: systemKey → focused chips for current leading dx
  const focusMap = useMemo(() => {
    if (!leadingDxId) return {} as Record<string, string[]>;
    const focuses = DX_EXAM_FOCUS[leadingDxId] ?? [];
    const map: Record<string, string[]> = {};
    for (const f of focuses) map[f.system] = f.chips;
    return map;
  }, [leadingDxId]);

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
    const setter = legacySetterMap[systemKey];
    if (setter) setter(next.join(', '));
  }

  function updateNote(systemKey: string, note: string) {
    setExamNotes({ ...examNotes, [systemKey]: note });
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
      <ExamGuidePanel />
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
            const focusChips = focusMap[system.key] ?? [];
            const isFocused = focusChips.length > 0;

            return (
              <div
                key={system.key}
                className="exam-field"
                style={isFocused ? { borderLeft: '3px solid #f59e0b', paddingLeft: 8, background: '#fffbeb' } : undefined}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {system.icon} {system.label}
                  {isFocused && leadingDxName && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '0px 5px' }}>
                      Key for {leadingDxName}
                    </span>
                  )}
                </label>

                {/* Chip row — focused chips shown with amber highlight */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {system.chips.map(chip => {
                    const isOn = selected.includes(chip);
                    const isFocusChip = focusChips.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleChip(system.key, chip)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 14,
                          border: isOn
                            ? '1px solid #0d9488'
                            : isFocusChip
                              ? '1.5px solid #f59e0b'
                              : '1px solid #d1d5db',
                          background: isOn ? '#0d9488' : isFocusChip ? '#fffbeb' : '#f9fafb',
                          color: isOn ? '#fff' : isFocusChip ? '#92400e' : '#374151',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: isOn || isFocusChip ? 600 : 400,
                          transition: 'all 0.12s',
                        }}
                      >
                        {chip}
                        {isFocusChip && !isOn && <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.7 }}>●</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Free text notes — now SmartTextarea with voice + dot-phrase */}
                <SmartTextarea
                  value={note}
                  onChange={v => updateNote(system.key, v)}
                  placeholder={`Additional ${system.label.toLowerCase()} findings… (🎤 voice · .${system.key === 'abdomen' ? 'abdnml' : system.key === 'cardiovascular' ? 'cvsnml' : system.key === 'respiratory' ? 'rsnml' : 'nml'} to expand)`}
                  style={{ fontSize: 13, minHeight: 48 }}
                />
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <WoundAssessmentCard />
    </div>
  );
}
