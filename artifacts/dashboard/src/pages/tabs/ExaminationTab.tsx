import { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import NarrativeInput from '@/components/NarrativeInput';
import SmartTextarea from '@/components/SmartTextarea';
import AnatomicalSketch from '@/components/AnatomicalSketch';
import ExamPhotoPanel from '@/components/ExamPhotoPanel';
import WoundAssessmentCard from '@/components/WoundAssessmentCard';
import ExamGuidePanel from '@/components/ExamGuidePanel';
import WheelPicker from '@/components/WheelPicker';
import { computeRankedDifferentials } from '@/lib/symptom-inference';

// Systems always shown regardless of clinical context
const CORE_SYSTEM_KEYS = new Set(['general', 'abdomen', 'cardiovascular', 'respiratory', 'extremities']);

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

  if (
    matchesAny(sx, ['anal', 'rectal', 'haemorrhoid', 'fissure', 'fistula', 'perianal', 'bowel habit', 'rectal bleed', 'constipation', 'diarrhoea', 'pr '])
  ) { visible.add('anal'); visible.add('perineal'); }

  if (
    matchesAny(sx, ['groin', 'hernia', 'scrotal', 'testicular', 'labial', 'genital', 'perineal', 'inguinal'])
  ) { visible.add('genital'); visible.add('perineal'); }

  if (
    matchesAny(sx, ['skin', 'rash', 'lesion', 'melanoma', 'mole', 'jaundice', 'itch']) ||
    matchesAny(pmh, ['melanoma', 'skin cancer', 'scc', 'bcc'])
  ) visible.add('skin');

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
  legacyKey?: 'examGeneral' | 'examCardio' | 'examResp' | 'examAbdomen' | 'examBreast' | 'examWound' | 'examNeuro' | 'examExtremities';
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
    key: 'respiratory',
    label: 'Respiratory',
    reportLabel: 'Respiratory',
    icon: '🫁',
    legacyKey: 'examResp',
    normalProse: 'Chest clear to auscultation bilaterally with equal air entry. No wheeze, crackles, or pleural rub. Respiratory rate and pattern normal. Trachea central. Percussion note resonant throughout.',
    chips: ['Clear to auscultation', 'Crackles (L)', 'Crackles (R)', 'Wheeze', 'Reduced breath sounds (L)', 'Reduced breath sounds (R)', 'Dull to percussion', 'Pleural rub', 'Trachea deviated'],
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
    key: 'perineal',
    label: 'Perineal',
    reportLabel: 'Perineal',
    icon: '🔎',
    normalProse: 'Perineum intact. No erythema, excoriation, skin tags, or fistula openings visible. No obvious swelling or discharge.',
    chips: ['Normal', 'Skin tags', 'Fissure', 'Fistula orifice', 'Erythema', 'Maceration', 'Excoriation', 'Discharge', 'Mass / swelling'],
  },
  {
    key: 'anal',
    label: 'Anal / Rectal',
    reportLabel: 'Anal',
    icon: '🩺',
    normalProse: 'Anus and perianal skin normal on inspection. Digital rectal examination: normal sphincter tone. No masses, tenderness, or blood on the examining glove. Prostate/cervix not assessed at this encounter.',
    chips: [
      'Normal inspection', 'External haemorrhoids', 'Internal haemorrhoids', 'Fissure', 'Fistula',
      'Perianal abscess', 'Prolapse', 'Normal sphincter tone', 'Reduced tone', 'Mass palpable',
      'Tenderness DRE', 'Blood on glove', 'Prostate enlarged', 'Prostate nodule',
    ],
  },
  {
    key: 'genital',
    label: 'Genital',
    reportLabel: 'Genital',
    icon: '🔍',
    normalProse: 'External genitalia normal. No herniae. Scrotal / labial examination: no masses, tenderness, or swelling.',
    chips: [
      'Normal', 'Inguinal hernia (L)', 'Inguinal hernia (R)', 'Testicular mass', 'Testicular tenderness',
      'Scrotal swelling', 'Varicocele', 'Hydrocele', 'Labial mass', 'Labial tenderness', 'Discharge',
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
    key: 'skin',
    label: 'Skin / Integument',
    reportLabel: 'Skin',
    icon: '🧴',
    normalProse: 'Skin intact. No rashes, lesions, ulceration, or hyperpigmentation. No jaundice, cyanosis, or pallor. No spider naevi or caput medusae.',
    chips: [
      'Normal', 'Rash', 'Lesion present', 'Pigmented lesion', 'Ulcer', 'Scar',
      'Jaundice', 'Pallor', 'Cyanosis', 'Spider naevi', 'Petechiae / purpura',
    ],
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
  anal_fissure:           [{ system: 'anal',           chips: ['Fissure', 'Tenderness DRE', 'Blood on glove'] }, { system: 'perineal', chips: ['Fissure', 'Erythema'] }],
  perianal_abscess:       [{ system: 'perineal',       chips: ['Mass / swelling', 'Erythema', 'Discharge'] }, { system: 'anal', chips: ['Perianal abscess'] }],
  pilonidal_abscess:      [{ system: 'perineal',       chips: ['Mass / swelling', 'Erythema', 'Discharge'] }],
  fournier_gangrene:      [{ system: 'perineal',       chips: ['Erythema', 'Discharge', 'Mass / swelling'] }, { system: 'wound', chips: ['Necrotic', 'Wet gangrene', 'Cellulitis', 'Malodorous'] }],
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

const VITAL_DISPLAY = [
  { key: 'systolicBp'      as const, label: 'SBP',   unit: 'mmHg',   danger: (v: number) => v > 160 || v < 90  },
  { key: 'diastolicBp'     as const, label: 'DBP',   unit: 'mmHg',   danger: (v: number) => v > 100 || v < 60  },
  { key: 'heartRate'       as const, label: 'P',     unit: 'bpm',    danger: (v: number) => v > 120 || v < 50   },
  { key: 'temperatureC'    as const, label: 'T',     unit: '°C',     danger: (v: number) => v >= 38.5 || v < 36 },
  { key: 'respiratoryRate' as const, label: 'R',     unit: '/min',   danger: (v: number) => v > 24 || v < 10   },
  { key: 'spo2'            as const, label: 'SpO₂',  unit: '%',      danger: (v: number) => v < 94              },
  { key: 'glucoseMmol'     as const, label: 'RBS',   unit: 'mmol/L', danger: (v: number) => v < 3.5 || v > 20  },
];

const VITAL_WHEEL_FIELDS = [
  { key: 'systolicBp'      as const, label: 'SBP',  unit: 'mmHg',   placeholder: '120', min: 60,  max: 260, step: 1,   decimals: 0, defaultVal: 120, normalRange: [90,  140] as [number,number] },
  { key: 'diastolicBp'     as const, label: 'DBP',  unit: 'mmHg',   placeholder: '80',  min: 40,  max: 160, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  90]  as [number,number] },
  { key: 'heartRate'       as const, label: 'P',    unit: 'bpm',    placeholder: '88',  min: 30,  max: 220, step: 1,   decimals: 0, defaultVal: 80,  normalRange: [60,  100] as [number,number] },
  { key: 'temperatureC'    as const, label: 'T',    unit: '°C',     placeholder: '37.0',min: 34,  max: 43,  step: 0.1, decimals: 1, defaultVal: 37,  normalRange: [36.1,37.5] as [number,number] },
  { key: 'respiratoryRate' as const, label: 'R',    unit: '/min',   placeholder: '16',  min: 8,   max: 60,  step: 1,   decimals: 0, defaultVal: 16,  normalRange: [12,  20]  as [number,number] },
  { key: 'spo2'            as const, label: 'SpO₂', unit: '%',      placeholder: '98',  min: 70,  max: 100, step: 1,   decimals: 0, defaultVal: 98,  normalRange: [95,  100] as [number,number] },
  { key: 'glucoseMmol'     as const, label: 'RBS',  unit: 'mmol/L', placeholder: '6.4', min: 1,   max: 35,  step: 0.1, decimals: 1, defaultVal: 6,   normalRange: [4,   7.8] as [number,number] },
];

export default function ExaminationTab() {
  const ctx = useAppContext();
  const { examFindings, setExamFindings, examNotes, setExamNotes, anatomicalFindings, examPhotos,
          symptoms, symptomDetails, age, sex, comorbidities, pmhNotes, surgicalHistory,
          vitals, updateVital,
          weightKg, setWeightKg, heightCm, setHeightCm,
          waistCm, setWaistCm, hipCm, setHipCm, muacCm, setMuacCm } = ctx;

  // Local UI state — which systems are explicitly omitted (not examined)
  const [examOmit, setExamOmit] = useState<Record<string, boolean>>({});
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [editVitals, setEditVitals] = useState(false);
  const [quickMode, setQuickMode]   = useState(true);
  const [allNormalApplied, setAllNormalApplied] = useState(false);

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
    const isAdding = !current.includes(chip);
    const next = isAdding
      ? [...current, chip]
      : current.filter(c => c !== chip);
    setExamFindings({ ...examFindings, [systemKey]: next });
    const currentNote = examNotes[systemKey]?.trim() ?? '';
    const system = EXAM_SYSTEMS.find(s => s.key === systemKey);
    const isNormalProse = !!system && currentNote === system.normalProse.trim();
    if (isAdding && isNormalProse) {
      setExamNotes({ ...examNotes, [systemKey]: '' });
      syncLegacy(systemKey, next, '');
    } else {
      syncLegacy(systemKey, next, currentNote);
    }
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

  function applyAllNormal() {
    const pendingNotes: Record<string, string> = { ...examNotes };
    const pendingFindings: Record<string, string[]> = { ...examFindings };
    for (const system of EXAM_SYSTEMS) {
      if (examOmit[system.key]) continue;
      const shown = showAllSystems ||
        visibleSystemKeys.has(system.key) ||
        (examFindings[system.key]?.length ?? 0) > 0 ||
        !!examNotes[system.key]?.trim();
      if (!shown) continue;
      pendingNotes[system.key] = system.normalProse;
      pendingFindings[system.key] = [];
      const setter = legacySetterMap[system.key];
      if (setter) setter(system.normalProse);
    }
    setExamNotes(pendingNotes);
    setExamFindings(pendingFindings);
    setAllNormalApplied(true);
    setTimeout(() => setAllNormalApplied(false), 2000);
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
        {/* ── Vitals panel (from intake / nurse — editable here) ── */}
        {(() => {
          const recorded = VITAL_DISPLAY.filter(v => vitals[v.key] && vitals[v.key] !== '');
          if (!recorded.length && !editVitals) return (
            <button
              type="button"
              onClick={() => setEditVitals(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, marginBottom: 12, cursor: 'pointer',
                border: '1px dashed #86efac', background: '#f0fdf4',
                fontSize: 12, color: '#15803d', fontWeight: 600,
              }}
            >
              + Add vitals
            </button>
          );
          return (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#166534', marginRight: 4 }}>Vitals</span>
                {recorded.map(v => {
                  const num = parseFloat(vitals[v.key]);
                  const bad = Number.isFinite(num) && v.danger(num);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setEditVitals(true)}
                      title="Tap to edit vitals"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '3px 9px', borderRadius: 6,
                        background: bad ? '#fef2f2' : '#fff',
                        border: `1px solid ${bad ? '#fca5a5' : '#d1fae5'}`,
                        minWidth: 44, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: '0.05em' }}>{v.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: bad ? '#dc2626' : '#166534', fontVariantNumeric: 'tabular-nums' }}>{vitals[v.key]}</span>
                      <span style={{ fontSize: 9, color: '#9ca3af' }}>{v.unit}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setEditVitals(e => !e)}
                  style={{
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto',
                    padding: '4px 10px', borderRadius: 5,
                    border: `1px solid #0d9488`,
                    background: editVitals ? '#0d9488' : 'transparent',
                    color: editVitals ? '#fff' : '#0d9488',
                  }}
                >
                  {editVitals ? '✓ Done' : '✎ Edit'}
                </button>
              </div>
              {editVitals && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #d1fae5' }}>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
                    Scroll wheel to set value · or type directly below each wheel
                  </p>
                  <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', minWidth: 'max-content' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {VITAL_WHEEL_FIELDS.map(({ key, label, unit, placeholder, min, max, step, decimals, defaultVal, normalRange }) => {
                          const val = vitals[key] ?? '';
                          const n = parseFloat(val);
                          const isAbnormal = val.trim() !== '' && Number.isFinite(n) && (n < normalRange[0] || n > normalRange[1]);
                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 52 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: isAbnormal ? '#dc2626' : '#6b7280' }}>
                                {label}
                              </span>
                              <WheelPicker value={val} onChange={v => updateVital(key, v)} min={min} max={max} step={step} decimals={decimals} defaultVal={defaultVal} normalRange={normalRange} />
                              <input inputMode="decimal" value={val} onChange={e => updateVital(key, e.target.value)} placeholder={placeholder}
                                style={{ width: 46, fontSize: 11, padding: '3px 4px', textAlign: 'center', borderRadius: 6, border: `1.5px solid ${isAbnormal ? '#fca5a5' : '#d1d5db'}`, background: isAbnormal ? '#fff5f5' : '#fff', color: isAbnormal ? '#dc2626' : '#166534', outline: 'none', fontVariantNumeric: 'tabular-nums' }}
                              />
                              <span style={{ fontSize: 9, color: isAbnormal ? '#dc2626' : '#9ca3af', fontWeight: isAbnormal ? 700 : 400 }}>
                                {isAbnormal ? '⚠ ' : ''}{unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ width: 1, background: '#e2e8f0', margin: '0 10px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { label: 'Wt',    unit: 'kg', value: weightKg, onChange: setWeightKg, min: 20,  max: 300, step: 0.5, decimals: 1, defaultVal: 70  },
                          { label: 'Ht',    unit: 'cm', value: heightCm, onChange: setHeightCm, min: 50,  max: 220, step: 1,   decimals: 0, defaultVal: 165 },
                          { label: 'Waist', unit: 'cm', value: waistCm,  onChange: setWaistCm,  min: 40,  max: 200, step: 0.5, decimals: 1, defaultVal: 88  },
                          { label: 'Hip',   unit: 'cm', value: hipCm,    onChange: setHipCm,    min: 40,  max: 200, step: 0.5, decimals: 1, defaultVal: 100 },
                          { label: 'MUAC',  unit: 'cm', value: muacCm,   onChange: setMuacCm,   min: 10,  max: 60,  step: 0.5, decimals: 1, defaultVal: 28  },
                        ].map(f => (
                          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 52 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280' }}>{f.label}</span>
                            <WheelPicker value={f.value} onChange={f.onChange} min={f.min} max={f.max} step={f.step} decimals={f.decimals} defaultVal={f.defaultVal} normalRange={[f.min, f.max]} />
                            <input inputMode="decimal" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.unit}
                              style={{ width: 46, fontSize: 11, padding: '3px 4px', textAlign: 'center', borderRadius: 6, border: '1.5px solid #d1d5db', background: '#fff', color: '#166534', outline: 'none' }}
                            />
                            <span style={{ fontSize: 9, color: '#9ca3af' }}>{f.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Mode toggle + All Normal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', border: '1px solid #374151', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setQuickMode(true)}
              style={{
                padding: '5px 14px', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: quickMode ? '#0d9488' : 'var(--surface, #1e2330)',
                color: quickMode ? '#fff' : '#94a3b8',
              }}
            >
              ⚡ Quick
            </button>
            <button
              type="button"
              onClick={() => setQuickMode(false)}
              style={{
                padding: '5px 14px', border: 'none', borderLeft: '1px solid #374151',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: !quickMode ? '#0d9488' : 'var(--surface, #1e2330)',
                color: !quickMode ? '#fff' : '#94a3b8',
              }}
            >
              Full
            </button>
          </div>
          <button
            type="button"
            onClick={applyAllNormal}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: `1.5px solid ${allNormalApplied ? '#166534' : '#0d9488'}`,
              background: allNormalApplied ? '#16a34a' : '#f0fdfa',
              color: allNormalApplied ? '#fff' : '#0d9488',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: 36,
            }}
          >
            {allNormalApplied ? '✓ All systems — Normal' : '◎ All Normal'}
          </button>
        </div>

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

        {/* Quick mode: compact chip grid — all systems visible at a glance */}
        {quickMode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {EXAM_SYSTEMS.filter(system => {
              if (showAllSystems) return true;
              const hasData = (examFindings[system.key]?.length ?? 0) > 0 || !!examNotes[system.key]?.trim();
              return visibleSystemKeys.has(system.key) || hasData || examOmit[system.key];
            }).map(system => {
              const selected    = examFindings[system.key] ?? [];
              const focusChips  = focusMap[system.key] ?? [];
              const isFocused   = focusChips.length > 0;
              const isOmitted   = examOmit[system.key] ?? false;
              const hasNote     = !!examNotes[system.key]?.trim();
              const isNormal    = selected.length === 0 && hasNote;

              return (
                <div
                  key={system.key}
                  style={{
                    border: `1px solid ${isFocused && !isOmitted ? '#f59e0b' : '#2d3748'}`,
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: isFocused && !isOmitted ? 'rgba(255,251,235,0.08)' : '#0f172a',
                    opacity: isOmitted ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                      color: isFocused && !isOmitted ? '#92400e' : '#e2e8f0',
                    }}>
                      {system.icon} {system.label}
                      {selected.length > 0 && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyNormal(system)}
                      disabled={isOmitted}
                      title="Mark as normal"
                      style={{
                        padding: '5px 10px', borderRadius: 5, cursor: isOmitted ? 'not-allowed' : 'pointer',
                        border: `1px solid ${isNormal ? '#0d9488' : '#475569'}`,
                        background: isNormal ? '#0d9488' : 'transparent',
                        color: isNormal ? '#fff' : '#0d9488',
                        fontSize: 11, fontWeight: 700,
                        minHeight: 30, minWidth: 60,
                      }}
                    >
                      {isNormal ? '✓ Nml' : '◎ Nml'}
                    </button>
                  </div>
                  {!isOmitted && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {isNormal && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#0d9488',
                          padding: '2px 8px', borderRadius: 10,
                          border: '1px solid #0d9488', background: 'rgba(13,148,136,0.12)',
                          whiteSpace: 'nowrap',
                        }}>
                          ✓ Normal
                        </span>
                      )}
                      {system.chips.map(chip => {
                        const isOn        = selected.includes(chip);
                        const isFocusChip = focusChips.includes(chip);
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => toggleChip(system.key, chip)}
                            style={{
                              padding: '3px 9px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                              border: isOn
                                ? '1px solid #0d9488'
                                : isFocusChip ? '1.5px solid #f59e0b' : '1px solid #374151',
                              background: isOn ? '#0d9488' : isFocusChip ? '#fffbeb' : '#1e293b',
                              color: isOn ? '#fff' : isFocusChip ? '#92400e' : '#94a3b8',
                              fontWeight: isOn || isFocusChip ? 600 : 400,
                              transition: 'all 0.1s',
                              minHeight: 28,
                            }}
                          >
                            {chip}
                            {isFocusChip && !isOn && <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.7 }}>●</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Full mode: per-system cards with prose textareas */}
        {!quickMode && (
          <div className="exam-grid">
            {EXAM_SYSTEMS.filter(system => {
              if (showAllSystems) return true;
              const hasData = (examFindings[system.key]?.length ?? 0) > 0 || !!examNotes[system.key]?.trim();
              return visibleSystemKeys.has(system.key) || hasData || examOmit[system.key];
            }).map(system => {
              const selected   = examFindings[system.key] ?? [];
              const note       = examNotes[system.key] ?? '';
              const focusChips = focusMap[system.key] ?? [];
              const isFocused  = focusChips.length > 0;
              const isOmitted  = examOmit[system.key] ?? false;
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
                    <div style={{ display: 'flex', gap: 5 }}>
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {system.chips.map(chip => {
                          const isOn        = selected.includes(chip);
                          const isFocusChip = focusChips.includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => toggleChip(system.key, chip)}
                              style={{
                                padding: '3px 10px', borderRadius: 14,
                                border: isOn
                                  ? '1px solid #0d9488'
                                  : isFocusChip ? '1.5px solid #f59e0b' : '1px solid #d1d5db',
                                background: isOn ? '#0d9488' : isFocusChip ? '#fffbeb' : '#f9fafb',
                                color: isOn ? '#fff' : isFocusChip ? '#92400e' : '#374151',
                                fontSize: 12, cursor: 'pointer',
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
        )}
      </CollapsibleCard>

      <WoundAssessmentCard />
    </div>
  );
}
