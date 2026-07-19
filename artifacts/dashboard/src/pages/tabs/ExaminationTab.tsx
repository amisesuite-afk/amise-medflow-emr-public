import { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import NarrativeInput from '@/components/NarrativeInput';
import SmartTextarea from '@/components/SmartTextarea';
import AnatomicalSketch from '@/components/AnatomicalSketch';
import ExamPhotoPanel from '@/components/ExamPhotoPanel';
import WoundAssessmentCard from '@/components/WoundAssessmentCard';
import ExamGuidePanel from '@/components/ExamGuidePanel';
import { computeRankedDifferentials } from '@/lib/symptom-inference';

// Systems always shown regardless of clinical context
const CORE_SYSTEM_KEYS = new Set(['general', 'abdomen']);

function matchesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some(n => h.includes(n));
}

function computeVisibleSystems(
  comorbidities: string[],
  pmhNotes: string,
  surgicalHistory: string[],
  symptoms: string[],
  leadingDxId: string | null,
): Set<string> {
  const visible = new Set<string>(CORE_SYSTEM_KEYS);
  const pmh = [...comorbidities, pmhNotes].join(' ').toLowerCase();
  const sx = symptoms.join(' ').toLowerCase();
  const hasSurgHx = surgicalHistory.length > 0;

  if (
    matchesAny(pmh, ['hypertension', 'cardiac', 'heart', 'atrial', 'angina', 'coronary', 'ihd', 'pacemaker', 'valve', 'cardiomyopathy']) ||
    matchesAny(sx, ['chest pain', 'chest tightness', 'palpitation', 'syncope'])
  ) visible.add('cardiovascular');

  if (
    matchesAny(pmh, ['asthma', 'copd', 'lung', 'respiratory', 'emphysema', 'smoking', 'tuberculosis']) ||
    matchesAny(sx, ['shortness of breath', 'dyspnoea', 'cough', 'haemoptysis', 'breathless'])
  ) visible.add('respiratory');

  if (
    matchesAny(pmh, ['breast', 'mastectomy', 'lumpectomy']) ||
    matchesAny(sx, ['breast', 'nipple', 'lump'])
  ) visible.add('breast');

  if (
    hasSurgHx ||
    matchesAny(pmh, ['diabetes', 'diabetic', 'ulcer', 'wound', 'gangrene', 'pressure sore']) ||
    matchesAny(sx, ['wound', 'ulcer', 'sore'])
  ) visible.add('wound');

  if (
    matchesAny(pmh, ['stroke', 'tia', 'epilepsy', 'seizure', 'neuropathy', 'parkinson', 'dementia', 'multiple sclerosis', 'migraine']) ||
    matchesAny(sx, ['headache', 'dizziness', 'confusion', 'weakness', 'numbness', 'seizure', 'vertigo'])
  ) visible.add('neurological');

  if (
    matchesAny(pmh, ['peripheral arterial', 'peripheral vascular', 'dvt', 'varicose', 'diabetes', 'diabetic', 'vascular disease']) ||
    matchesAny(sx, ['leg pain', 'leg swelling', 'calf', 'claudication', 'ankle swelling', 'limb ischaemia'])
  ) visible.add('extremities');

  if (leadingDxId) {
    for (const f of DX_EXAM_FOCUS[leadingDxId] ?? []) visible.add(f.system);
  }

  return visible;
}

interface ExamSystem {
  key: string;
  label: string;
  reportLabel: string;
  icon: string;
  chips: string[];
  legacyKey: 'examGeneral' | 'examCardio' | 'examResp' | 'examAbdomen' | 'examBreast' | 'examWound' | 'examNeuro' | 'examExtremities';
  normalProse: string;
}

const EXAM_SYSTEMS: ExamSystem[] = [
  {
    key: 'general',
    label: 'General',
    reportLabel: 'General',
    icon: '👤',
    legacyKey: 'examGeneral',
    normalProse: 'Well-appearing and comfortable at rest. Haemodynamically stable. Afebrile. No pallor, jaundice, cyanosis, or peripheral oedema. No acute distress.',
    chips: ['Well-nourished', 'Cachectic', 'Pale', 'Jaundiced', 'Cyanosed', 'Oedematous', 'Diaphoretic', 'In distress', 'Alert and oriented', 'GCS < 15'],
  },
  {
    key: 'cardiovascular',
    label: 'Cardiovascular',
    reportLabel: 'Cardiovascular',
    icon: '❤️',
    legacyKey: 'examCardio',
    normalProse: 'Heart sounds I and II present and normal. No murmurs, rubs, or gallops audible. JVP not elevated. Peripheral pulses present and equal bilaterally. Capillary refill time less than two seconds. No peripheral oedema.',
    chips: ['S1+S2 normal', 'Murmur present', 'Tachycardia', 'Bradycardia', 'Irregular rhythm', 'JVP elevated', 'Peripheral oedema', 'Peripheral pulses absent', 'Capillary refill > 2s'],
  },
  {
    key: 'respiratory',
    label: 'Respiratory',
    reportLabel: 'Respiratory',
    icon: '🫁',
    legacyKey: 'examResp',
    normalProse: 'Chest clear to auscultation bilaterally with equal air entry. No wheeze, crackles, or pleural rub. Respiratory rate and pattern normal. Trachea central. Percussion note resonant throughout.',
    chips: ['Clear to auscultation', 'Crackles (L)', 'Crackles (R)', 'Wheeze', 'Reduced breath sounds (L)', 'Reduced breath sounds (R)', 'Dull to percussion', 'Pleural rub', 'Trachea deviated'],
  },
  {
    key: 'abdomen',
    label: 'Abdomen',
    reportLabel: 'Abdomen',
    icon: '🔵',
    legacyKey: 'examAbdomen',
    normalProse: 'Abdomen soft and non-tender on palpation. No guarding, rigidity, or rebound tenderness. Bowel sounds present and normal. No hepatosplenomegaly or palpable masses. Hernial orifices intact. No shifting dullness or fluid thrill.',
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
    reportLabel: 'Breast',
    icon: '🔍',
    legacyKey: 'examBreast',
    normalProse: "No visible skin changes, peau d'orange, or nipple retraction. No nipple discharge. No palpable masses on bimanual examination of either breast. No cervical, supraclavicular, or axillary lymphadenopathy.",
    chips: [
      'No mass', 'Mass (L)', 'Mass (R)', 'Hard', 'Soft', 'Mobile', 'Fixed',
      'Skin tethering', "Peau d'orange", 'Nipple inversion', 'Nipple discharge',
      'Axillary nodes palpable', 'Erythema / warmth',
    ],
  },
  {
    key: 'wound',
    label: 'Wound / Diabetic foot',
    reportLabel: 'Wound',
    icon: '🩹',
    legacyKey: 'examWound',
    normalProse: 'Wound healing by primary intention. No surrounding erythema, induration, swelling, or purulent discharge. Wound edges well-approximated. Sutures/staples intact. No features of wound dehiscence or infection.',
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
    reportLabel: 'Neurological',
    icon: '🧠',
    legacyKey: 'examNeuro',
    normalProse: 'Alert and oriented in time, place, and person. GCS 15/15. No focal neurological deficit. Cranial nerves grossly intact. Motor power and sensation preserved in all four limbs. Coordination intact. Reflexes symmetrical.',
    chips: ['GCS 15', 'GCS < 15', 'Oriented', 'Confused', 'Focal deficit', 'Weakness (L)', 'Weakness (R)', 'Sensory loss', 'No focal deficit'],
  },
  {
    key: 'extremities',
    label: 'Extremities',
    reportLabel: 'Extremities',
    icon: '🦵',
    legacyKey: 'examExtremities',
    normalProse: 'Peripheral pulses palpable bilaterally including dorsalis pedis and posterior tibial. No peripheral oedema. Calves soft and non-tender bilaterally. No features of peripheral arterial disease. Skin warm and well-perfused.',
    chips: ['Pulses present', 'DP absent', 'PT absent', 'Femoral reduced', 'Varicose veins', 'DVT signs', 'Oedema present', 'Wound present', 'Healthy skin'],
  },
];

// Key examination findings to look for per leading differential
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

// Build clinical examination prose from documented systems.
// Systems with no chips and no notes are omitted — standard reporting principle.
function buildExamProse(
  systems: ExamSystem[],
  examFindings: Record<string, string[]>,
  examNotes: Record<string, string>,
  omitted: Record<string, boolean>,
): string {
  const lines: string[] = [];
  for (const s of systems) {
    if (omitted[s.key]) continue;
    const chips = examFindings[s.key] ?? [];
    const note = examNotes[s.key]?.trim() ?? '';
    if (!chips.length && !note) continue;
    const parts: string[] = [];
    if (note) {
      parts.push(note);
    } else if (chips.length) {
      parts.push(chips.join('. '));
    }
    lines.push(`${s.reportLabel}: ${parts.join('. ')}.`);
  }
  if (!lines.length) return '';
  return 'On examination:\n' + lines.join('\n');
}

export default function ExaminationTab() {
  const ctx = useAppContext();
  const { examFindings, setExamFindings, examNotes, setExamNotes, anatomicalFindings, examPhotos,
          symptoms, symptomDetails, age, sex, comorbidities, pmhNotes, surgicalHistory } = ctx;

  // Local UI state — which systems are explicitly omitted (not examined)
  const [examOmit, setExamOmit] = useState<Record<string, boolean>>({});
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const [showAllSystems, setShowAllSystems] = useState(false);

  const ageNum = age ? Number(age) : null;

  const ranked = useMemo(
    () => computeRankedDifferentials({ symptoms, symptomDetails, age: ageNum, sex }),
    [symptoms, symptomDetails, ageNum, sex],
  );

  const leadingDxId = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].id : null,
    [ranked],
  );
  const leadingDxName = useMemo(
    () => (ranked[0]?.confidence ?? 0) >= 40 ? ranked[0].name : null,
    [ranked],
  );

  const focusMap = useMemo(() => {
    if (!leadingDxId) return {} as Record<string, string[]>;
    const focuses = DX_EXAM_FOCUS[leadingDxId] ?? [];
    const map: Record<string, string[]> = {};
    for (const f of focuses) map[f.system] = f.chips;
    return map;
  }, [leadingDxId]);

  const visibleSystemKeys = useMemo(
    () => computeVisibleSystems(comorbidities, pmhNotes, surgicalHistory, symptoms, leadingDxId),
    [comorbidities, pmhNotes, surgicalHistory, symptoms, leadingDxId],
  );

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

  // Auto-populate ONLY the systems relevant to this patient's presentation with
  // normalProse on first open. Systems outside visibleSystemKeys are "not examined"
  // and intentionally left blank — they are excluded from the final report.
  useEffect(() => {
    const pendingNotes: Record<string, string> = {};
    let hasChanges = false;
    for (const system of EXAM_SYSTEMS) {
      // Skip systems that aren't indicated for this patient — they're not examined
      if (!visibleSystemKeys.has(system.key)) continue;
      const hasNote = !!examNotes[system.key]?.trim();
      const hasChips = (examFindings[system.key]?.length ?? 0) > 0;
      if (!hasNote && !hasChips) {
        pendingNotes[system.key] = system.normalProse;
        const setter = legacySetterMap[system.key];
        if (setter) setter(system.normalProse);
        hasChanges = true;
      }
    }
    if (hasChanges) {
      setExamNotes({ ...examNotes, ...pendingNotes });
    }
  // Run once on mount — captures first-render visibleSystemKeys intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncLegacy(systemKey: string, chips: string[], note: string) {
    const setter = legacySetterMap[systemKey];
    if (!setter) return;
    const parts: string[] = [];
    if (note.trim()) parts.push(note.trim());
    else if (chips.length) parts.push(chips.join('. '));
    setter(parts.join('. '));
  }

  function toggleChip(systemKey: string, chip: string) {
    const current = examFindings[systemKey] ?? [];
    const next = current.includes(chip)
      ? current.filter(c => c !== chip)
      : [...current, chip];
    setExamFindings({ ...examFindings, [systemKey]: next });
    syncLegacy(systemKey, next, examNotes[systemKey] ?? '');
  }

  function updateNote(systemKey: string, note: string) {
    const next = { ...examNotes, [systemKey]: note };
    setExamNotes(next);
    syncLegacy(systemKey, examFindings[systemKey] ?? [], note);
  }

  function applyNormal(system: ExamSystem) {
    // Fills the note with standard normal prose and clears chip selection.
    const next = { ...examNotes, [system.key]: system.normalProse };
    setExamNotes(next);
    setExamFindings({ ...examFindings, [system.key]: [] });
    setExamOmit({ ...examOmit, [system.key]: false });
    syncLegacy(system.key, [], system.normalProse);
  }

  function toggleOmit(systemKey: string) {
    const next = !examOmit[systemKey];
    setExamOmit({ ...examOmit, [systemKey]: next });
    if (next) {
      // Clear any entered data when omitting
      const notes = { ...examNotes, [systemKey]: '' };
      const findings = { ...examFindings, [systemKey]: [] };
      setExamNotes(notes);
      setExamFindings(findings);
      syncLegacy(systemKey, [], '');
    }
  }

  const examReport = useMemo(
    () => buildExamProse(EXAM_SYSTEMS, examFindings, examNotes, examOmit),
    [examFindings, examNotes, examOmit],
  );

  const systemsWithData = EXAM_SYSTEMS.filter(s =>
    !examOmit[s.key] && ((examFindings[s.key]?.length ?? 0) > 0 || (examNotes[s.key]?.trim()))
  ).length;

  const omittedCount = EXAM_SYSTEMS.filter(s => examOmit[s.key]).length;

  async function copyReport() {
    if (!examReport) return;
    try {
      await navigator.clipboard.writeText(examReport);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 2000);
    } catch {
      // fallback: select text in textarea
    }
  }

  function handleExamParsed(data: Record<string, unknown>) {
    const keyMap: Array<{ aiKey: string; systemKey: string }> = [
      { aiKey: 'general',     systemKey: 'general'        },
      { aiKey: 'cardio',      systemKey: 'cardiovascular' },
      { aiKey: 'resp',        systemKey: 'respiratory'    },
      { aiKey: 'abdomen',     systemKey: 'abdomen'        },
      { aiKey: 'neuro',       systemKey: 'neurological'   },
      { aiKey: 'extremities', systemKey: 'extremities'    },
      { aiKey: 'breast',      systemKey: 'breast'         },
      { aiKey: 'wound',       systemKey: 'wound'          },
    ];
    const updatedNotes = { ...examNotes };
    keyMap.forEach(({ aiKey, systemKey }) => {
      const value = data[aiKey] as string | null | undefined;
      if (value?.trim()) {
        updatedNotes[systemKey] = value.trim();
        const setter = legacySetterMap[systemKey];
        if (setter) setter(value.trim());
      }
    });
    setExamNotes(updatedNotes);
  }

  return (
    <div className="gap-y">
      <NarrativeInput
        section="examination"
        placeholder="Dictate or paste the full clinical examination as you would document it — e.g. 'On general inspection patient appears comfortable at rest, no pallor or jaundice. Cardiovascular — heart sounds one and two present, no murmurs, JVP not elevated. Respiratory — clear to auscultation bilaterally. Abdomen — soft, mild tenderness in right iliac fossa, Rovsing's sign positive, guarding present, bowel sounds audible. Neurological — GCS 15, moving all limbs…'"
        onParsed={handleExamParsed}
        label="Dictate full examination — AI will populate per-system fields below"
        minHeight={130}
      />

      <ExamGuidePanel />

      {/* ── Examination report panel ── */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setReportVisible(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>📄 Examination Report</span>
            {systemsWithData > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#bbf7d0', borderRadius: 20, padding: '1px 8px' }}>
                {systemsWithData} system{systemsWithData !== 1 ? 's' : ''} documented
              </span>
            )}
            {omittedCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', borderRadius: 20, padding: '1px 8px' }}>
                {omittedCount} omitted
              </span>
            )}
          </div>
          <span style={{ color: '#16a34a', fontSize: 12 }}>{reportVisible ? '▲' : '▼ View report'}</span>
        </button>
        {reportVisible && (
          <div style={{ padding: '0 14px 14px' }}>
            {examReport ? (
              <>
                <pre style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: '#111827',
                  whiteSpace: 'pre-wrap',
                  background: '#fff',
                  border: '1px solid #d1fae5',
                  borderRadius: 6,
                  padding: '12px 14px',
                  margin: 0,
                }}>
                  {examReport}
                </pre>
                <button
                  type="button"
                  onClick={copyReport}
                  style={{
                    marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #16a34a',
                    background: reportCopied ? '#16a34a' : '#fff', color: reportCopied ? '#fff' : '#16a34a',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {reportCopied ? '✓ Copied' : 'Copy to clipboard'}
                </button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', margin: 0 }}>
                Use the ◎ Normal buttons or enter findings below to generate a clinical examination report. Systems left blank are omitted from the report.
              </p>
            )}
          </div>
        )}
      </div>

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
        badge={`${systemsWithData} / ${EXAM_SYSTEMS.length} documented`}
      >
        {/* Hidden-systems summary + toggle */}
        {(() => {
          const hiddenSystems = EXAM_SYSTEMS.filter(s =>
            !visibleSystemKeys.has(s.key) &&
            !(examFindings[s.key]?.length) &&
            !examNotes[s.key]?.trim() &&
            !examOmit[s.key]
          );
          if (hiddenSystems.length === 0 || showAllSystems) return null;
          return (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
              padding: '8px 12px', marginBottom: 10, gap: 10,
            }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                <strong>{hiddenSystems.length}</strong> system{hiddenSystems.length !== 1 ? 's' : ''} hidden —{' '}
                {hiddenSystems.map(s => s.label).join(', ')}
                {' '}(no relevant history)
              </span>
              <button
                type="button"
                onClick={() => setShowAllSystems(true)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: '1px solid #94a3b8',
                  background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                Show all systems
              </button>
            </div>
          );
        })()}
        {showAllSystems && (
          <div style={{ marginBottom: 10, textAlign: 'right' }}>
            <button
              type="button"
              onClick={() => setShowAllSystems(false)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid #94a3b8',
                background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Show relevant only
            </button>
          </div>
        )}
        <div className="exam-grid">
          {EXAM_SYSTEMS.filter(system => {
            if (showAllSystems) return true;
            const hasData = (examFindings[system.key]?.length ?? 0) > 0 || !!examNotes[system.key]?.trim();
            return visibleSystemKeys.has(system.key) || hasData || examOmit[system.key];
          }).map(system => {
            const selected = examFindings[system.key] ?? [];
            const note = examNotes[system.key] ?? '';
            const focusChips = focusMap[system.key] ?? [];
            const isFocused = focusChips.length > 0;
            const isOmitted = examOmit[system.key] ?? false;
            const hasContent = selected.length > 0 || note.trim().length > 0;

            return (
              <div
                key={system.key}
                className="exam-field"
                style={{
                  ...(isFocused && !isOmitted ? { borderLeft: '3px solid #f59e0b', paddingLeft: 8, background: '#fffbeb' } : {}),
                  ...(isOmitted ? { opacity: 0.4, pointerEvents: 'none' } : {}),
                }}
              >
                {/* System header with Normal / Omit controls */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: '#111827' }}>
                    {system.icon} {system.label}
                    {isFocused && leadingDxName && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '0px 5px' }}>
                        Key for {leadingDxName}
                      </span>
                    )}
                    {hasContent && !isOmitted && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />
                    )}
                  </label>
                  <div style={{ display: 'flex', gap: 5, pointerEvents: isOmitted ? 'auto' : 'auto' }}>
                    {/* ◎ Normal button */}
                    {!isOmitted && (
                      <button
                        type="button"
                        onClick={() => applyNormal(system)}
                        title={`Fill with standard normal prose for ${system.label}`}
                        style={{
                          padding: '3px 9px', borderRadius: 6, border: '1.5px solid #0d9488',
                          background: '#f0fdfa', color: '#0d9488', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        ◎ Normal
                      </button>
                    )}
                    {/* Not examined toggle — excluded from final report when active */}
                    <button
                      type="button"
                      onClick={() => toggleOmit(system.key)}
                      title={isOmitted ? 'Mark as examined' : 'Not examined — will be excluded from the clinical report'}
                      style={{
                        padding: '3px 9px', borderRadius: 6,
                        border: isOmitted ? '1.5px solid #9ca3af' : '1.5px solid #e5e7eb',
                        background: isOmitted ? '#e5e7eb' : '#f9fafb',
                        color: isOmitted ? '#374151' : '#9ca3af',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {isOmitted ? '↩ Restore' : 'Not examined'}
                    </button>
                  </div>
                </div>

                {!isOmitted && (
                  <>
                    {/* Chip row */}
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

                    {/* Free text — prose input with voice support */}
                    <SmartTextarea
                      value={note}
                      onChange={v => updateNote(system.key, v)}
                      placeholder={`${system.label} findings in clinical prose — or use ◎ Normal above`}
                      style={{ fontSize: 13, minHeight: 48, fontFamily: 'Georgia, serif' }}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <WoundAssessmentCard />
    </div>
  );
}
