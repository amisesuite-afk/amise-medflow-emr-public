/**
 * History frame definitions (rule set "history-frames", clinical-content/registry.json).
 *
 * Wording is standard history-taking terminology (Macleod's Clinical Examination; BTS/ERS cough
 * duration bands: acute < 3 weeks, subacute 3–8 weeks, chronic > 8 weeks; MRC dyspnoea scale;
 * NICE NG12 for the suspected-cancer features). Every frame is listed for the surgeon's sign-off
 * in docs/clinical-validation/changes/history-by-complaint.md.
 *
 * Rules for editing (lint:history-frames enforces them):
 *   - No comma, "·" or "→" in a label (the web stores multi-select answers comma-joined).
 *   - Every chip maps to a diagnosis-engine feature on both platforms, or is listed in
 *     record-only.ts for that platform.
 *   - Two chips that cannot both be true are not both selectable in one multi-select question
 *     (EXCLUDES below).
 *   - Pain labels that vignettes and stored encounters use stay, or get an alias.
 *   - After a change run gen:history-frames (regenerates the Swift twin and, with --record-only,
 *     the record-only table) and lint:history-frames.
 */

import { RECORD_ONLY } from './record-only';
import type { FrameDimension, FrameOption, HistoryFrame, Platform } from './types';

export const HISTORY_FRAMES_VERSION = '1.0.0';

// ── Helpers ────────────────────────────────────────────────────────────────────

type Opt = string | FrameOption;
const o = (label: string, x: Omit<FrameOption, 'label'> = {}): FrameOption => ({ label, ...x });
const opts = (list: Opt[]): FrameOption[] => list.map(l => (typeof l === 'string' ? { label: l } : l));

function d(
  id: string, title: string, question: string, icon: string, multiSelect: boolean, options: Opt[],
  extra: Partial<Pick<FrameDimension, 'key' | 'webKey'>> = {},
): FrameDimension {
  return { id, title, question, icon, multiSelect, options: opts(options), ...extra };
}

const I = {
  onset: 'clock', site: 'mappin', character: 'waveform.path', radiation: 'arrow.up.right.and.arrow.down.left',
  assoc: 'list.bullet', timing: 'chart.line.uptrend.xyaxis', worse: 'arrow.up.circle', better: 'arrow.down.circle',
  severity: 'speedometer', pattern: 'repeat', risk: 'exclamationmark.shield', size: 'arrow.up.left.and.arrow.down.right',
  drop: 'drop', skin: 'hand.raised', lungs: 'lungs', calendar: 'calendar',
};

// ── Shared dimensions ──────────────────────────────────────────────────────────

/** Pain onset: the chip labels iOS has always used (vignettes and stored encounters use them). */
const PAIN_ONSET: Opt[] = [
  'Today', 'Yesterday',
  '2–3 days ago', '4–7 days ago',
  '1–4 weeks ago', '1–6 months ago',
  'Over a year', 'Sudden', 'Gradual',
];

const SEVERITY = d('severity', 'Severity', 'How severe (0–10)?', I.severity, false,
  ['Mild (1–3/10)', 'Moderate (4–6/10)', 'Severe (7–9/10)', 'Worst (10/10)']);

/** Pattern (single) and timing (multi) share the iOS key "timing". */
const PAIN_PATTERN = d('pattern', 'Pattern', 'Constant or does it come and go?', I.pattern, false,
  ['Constant', 'Intermittent', 'Episodic'], { key: 'timing', webKey: 'pattern' });

const onsetDim = (options: Opt[] = PAIN_ONSET, question = 'When did it start?') =>
  d('onset', 'Onset', question, I.onset, false, options);

/** Duration for non-pain symptoms (web key "duration": acute / chronic course). */
const DURATION = (options: Opt[]) => d('duration', 'Duration', 'How long has it been present?', I.calendar, false, options);

const GENERIC_DURATION: Opt[] = [
  'Hours', 'Days',
  '1–4 weeks', '1–6 months',
  'Over 6 months',
];

// ── Pain (SOCRATES) by region ──────────────────────────────────────────────────

interface PainRegionSpec {
  region: string; label: string; sample: string; iosPools: string[];
  site: Opt[]; character: Opt[]; radiation: Opt[]; associations: Opt[]; timing: Opt[];
  exacerbating: Opt[]; relieving: Opt[]; onset?: Opt[];
  /** Headache: the database stores the headache site under "character". */
  siteKey?: string;
  /** Web answer key of the site (default "site"; SITE_RULES do not cover every region). */
  siteWebKey?: string;
  aliases?: HistoryFrame['aliases'];
}

function painFrame(s: PainRegionSpec): HistoryFrame {
  return {
    id: `pain.${s.region}`, type: 'pain', variant: s.region,
    label: `Pain — ${s.label}`, title: 'SOCRATES',
    dimensions: [
      onsetDim(s.onset ?? PAIN_ONSET),
      d('site', 'Site', 'Where exactly?', I.site, true, s.site,
        { ...(s.siteKey ? { key: s.siteKey } : {}), ...(s.siteWebKey ? { webKey: s.siteWebKey } : {}) }),
      d('character', 'Character', 'What is the pain like?', I.character, true, s.character),
      d('radiation', 'Radiation', 'Does the pain spread anywhere?', I.radiation, false, s.radiation),
      d('associations', 'Associations', 'Associated symptoms?', I.assoc, true, s.associations),
      PAIN_PATTERN,
      d('timing', 'Timing', 'When is it present or worse?', I.timing, true, s.timing),
      d('exacerbating', 'Exacerbating', 'What makes it worse?', I.worse, true, s.exacerbating),
      d('relieving', 'Relieving', 'What makes it better?', I.better, true, s.relieving),
      SEVERITY,
    ],
    secondaryDims: ['site', 'character'],
    aliases: s.aliases,
    iosPools: s.iosPools,
    sampleComplaint: s.sample,
  };
}

const PAIN_FRAMES: HistoryFrame[] = [
  painFrame({
    region: 'abdomen', label: 'abdomen', sample: 'Abdominal pain',
    iosPools: ['abdominalPain', 'acuteAbdominalPain', 'rightIliacFossaPain', 'biliaryColic', 'acutePancreatitis',
      'renalColic', 'renalUrolithiasis', 'smallBowelObstruction', 'intestinalObstruction', 'groinPain', 'refluxGERD',
      'upperGIDisease', 'pelvicPain', 'paediatricAbdomen', 'mesentericVascular', 'hepatobiliaryAcute', 'coreConditions'],
    // The nine regions plus loin and groin.
    site: ['RUQ', 'Epigastric', 'LUQ', 'Right flank', 'Periumbilical', 'Left flank', 'RLQ', 'Suprapubic', 'LLQ',
      'Loin', 'Groin', 'Diffuse'],
    character: ['Colicky', 'Sharp', 'Stabbing', 'Dull', 'Aching', 'Burning', 'Gnawing', 'Cramping', 'Tearing',
      'Bloating', 'Pulling'],
    radiation: ['No radiation', 'Back', 'Right shoulder', 'Left shoulder', 'Loin to groin', 'Groin', 'Chest'],
    associations: ['Nausea', 'Vomiting', 'Anorexia', 'Fever', 'Rigors', 'Jaundice', 'Distension', 'Diarrhoea',
      'Constipation', 'Rectal bleeding', 'Melaena', 'Haematemesis', 'Change in bowel habit', 'Weight loss',
      'Heartburn', 'Dysphagia', 'Dysuria', 'Haematuria'],
    timing: ['Progressive', 'Post-prandial', 'Nocturnal'],
    exacerbating: ['Movement', 'Coughing', 'Deep breathing', 'Eating', 'Fatty food', 'Lying flat', 'Straining',
      'Alcohol', 'NSAIDs'],
    relieving: ['Rest', 'Lying motionless', 'Sitting forward', 'Antacids', 'Analgesics', 'Eating', 'Vomiting',
      'Defaecation', 'Fasting', 'Nothing'],
    aliases: [
      { key: 'site', legacy: 'Right side', current: 'Right flank' },
      { key: 'site', legacy: 'Left side', current: 'Left flank' },
      { key: 'site', legacy: 'Right loin', current: 'Loin' },
      { key: 'site', legacy: 'Left loin', current: 'Loin' },
      { key: 'site', legacy: 'Perineal', current: '' },
      { key: 'site', legacy: 'Chest', current: '' },
      { key: 'timing', legacy: 'Worse over time', current: 'Progressive' },
    ],
  }),
  painFrame({
    region: 'chest', label: 'chest', sample: 'Chest pain',
    iosPools: ['chestPain', 'chestWallPain', 'refluxGERD', 'pulmonaryEmbolism', 'venousThromboEmbolism', 'pleural',
      'aorticConditions', 'upperGIDisease', 'oesophagogastricSurgical', 'coreConditions'],
    site: ['Central chest', 'Retrosternal', 'Left chest', 'Right chest', 'Left lateral chest wall',
      'Right lateral chest wall', 'Epigastric', 'Interscapular'],
    character: ['Crushing / pressure', 'Tightness', 'Sharp', 'Stabbing', 'Burning', 'Tearing', 'Pleuritic', 'Aching'],
    radiation: ['No radiation', 'Left arm', 'Right arm', 'Jaw', 'Neck', 'Back', 'Left shoulder', 'Epigastric'],
    associations: ['Shortness of breath', 'Diaphoresis', 'Nausea', 'Vomiting', 'Palpitations', 'Dizziness / syncope',
      'Cough', 'Haemoptysis', 'Fever', 'Calf swelling'],
    timing: ['Progressive', 'Nocturnal', 'Post-prandial'],
    exacerbating: ['Exertion', 'Deep breathing', 'Coughing', 'Lying flat', 'Movement', 'Palpation', 'Eating',
      'Cold air', 'Stress'],
    relieving: ['Rest', 'GTN / nitrates', 'Sitting forward', 'Sitting up', 'Antacids', 'Analgesics', 'Nothing'],
    aliases: [
      { key: 'site', legacy: 'Chest', current: 'Central chest' },
      { key: 'site', legacy: 'Right shoulder', current: '' },
      { key: 'site', legacy: 'Left shoulder', current: '' },
      { key: 'site', legacy: 'Jaw', current: '' },
      { key: 'site', legacy: 'Left arm', current: '' },
      { key: 'character', legacy: 'Pressure', current: 'Crushing / pressure' },
      { key: 'associations', legacy: 'Pleuritic pain', current: 'Pleuritic' },
      { key: 'relieving', legacy: 'GTN spray', current: 'GTN / nitrates' },
      { key: 'timing', legacy: 'Worse over time', current: 'Progressive' },
    ],
  }),
  painFrame({
    region: 'head', label: 'headache', sample: 'Headache',
    iosPools: ['headache', 'neurosurgicalHead', 'coreConditions'],
    siteKey: 'character',
    site: ['Frontal', 'Temporal', 'Occipital', 'Vertex', 'Unilateral', 'Bilateral', 'Orbital / retro-orbital', 'Face'],
    onset: [...PAIN_ONSET, 'Thunderclap'],
    character: ['Throbbing / pulsating', 'Pressure / band-like', 'Stabbing', 'Dull ache', 'Electric shock',
      'Excruciating'],
    radiation: ['No radiation', 'Neck', 'Shoulders', 'Behind the eye'],
    associations: ['Nausea / vomiting', 'Photophobia', 'Phonophobia', 'Visual aura', 'Neck stiffness', 'Fever',
      'Jaw claudication', 'Scalp tenderness', 'Visual loss', 'Lacrimation', 'Focal neurological deficit',
      'Loss of consciousness', 'Seizure'],
    timing: ['Worst on waking', 'Woken from sleep', 'Progressive', 'Circadian clustering'],
    exacerbating: ['Coughing / straining', 'Lying flat', 'Bending forward', 'Bright light', 'Movement', 'Alcohol',
      'Stress'],
    relieving: ['Rest', 'Sleep', 'Dark quiet room', 'Paracetamol / simple analgesia', 'Nothing'],
    aliases: [{ key: 'timing', legacy: 'Worse over time', current: 'Progressive' }],
  }),
  painFrame({
    region: 'neck', siteWebKey: 'neck_site', label: 'neck / throat', sample: 'Neck pain',
    iosPools: ['headNeckSurgical', 'soreThroat', 'earComplaint', 'oralComplaint', 'parotidSalivary', 'neckLump',
      'thyroidPathology', 'coreConditions'],
    site: ['Anterior neck', 'Posterior neck', 'Right side of neck', 'Left side of neck', 'Throat', 'Submandibular',
      'Thyroid region', 'Ear'],
    character: ['Sharp', 'Aching', 'Burning', 'Throbbing', 'Stiffness'],
    radiation: ['No radiation', 'Ear', 'Jaw', 'Shoulder', 'Arm', 'Occiput'],
    associations: ['Sore throat', 'Fever', 'Dysphagia', 'Odynophagia', 'Hoarseness', 'Neck swelling', 'Trismus',
      'Headache', 'Arm numbness or weakness'],
    timing: ['Progressive', 'Worse in the morning'],
    exacerbating: ['Swallowing', 'Neck movement', 'Eating'],
    relieving: ['Rest', 'Analgesics', 'Nothing'],
  }),
  painFrame({
    region: 'back', siteWebKey: 'back_site', label: 'back', sample: 'Back pain',
    iosPools: ['backPain', 'spinalEmergency', 'spinalNeurosurgical', 'aorticConditions', 'renalColic', 'coreConditions'],
    site: ['Cervical', 'Thoracic', 'Lumbar', 'Sacral', 'Coccygeal', 'Paraspinal'],
    character: ['Aching', 'Sharp', 'Stabbing', 'Burning', 'Tearing', 'Colicky', 'Stiffness'],
    radiation: ['No radiation', 'Down leg below knee', 'Down both legs', 'Buttock', 'Groin', 'Abdomen',
      'Around the chest wall'],
    associations: ['Leg weakness', 'Leg numbness', 'Saddle anaesthesia', 'Urinary retention', 'Faecal incontinence',
      'Fever', 'Weight loss'],
    timing: ['Progressive', 'Nocturnal', 'Morning stiffness'],
    exacerbating: ['Movement', 'Bending', 'Lifting', 'Coughing / sneezing', 'Prolonged standing', 'Sitting'],
    relieving: ['Rest', 'Movement / exercise', 'Lying flat', 'Analgesics', 'NSAIDs', 'Nothing'],
    aliases: [{ key: 'timing', legacy: 'Worse over time', current: 'Progressive' }],
  }),
  painFrame({
    region: 'limb', siteWebKey: 'limb_site', label: 'limb', sample: 'Leg pain',
    iosPools: ['vascularSurgical', 'acuteLimbIschaemia', 'peripheralVascular', 'venousThromboEmbolism',
      'necrotizingInfection', 'necroSoftTissue', 'orthopaedicTrauma', 'coreConditions'],
    site: ['Thigh', 'Calf', 'Lower leg', 'Foot', 'Buttock', 'Upper arm', 'Forearm', 'Hand', 'Whole limb'],
    character: ['Aching', 'Cramping', 'Burning', 'Sharp', 'Throbbing', 'Heaviness'],
    radiation: ['No radiation', 'Down the limb', 'Up the limb'],
    associations: ['Intermittent claudication', 'Rest pain', 'Cold limb', 'Pallor', 'Paraesthesia', 'Paralysis',
      'Calf swelling', 'Calf tenderness', 'Redness', 'Leg ulcer', 'Fever'],
    timing: ['Progressive', 'Nocturnal'],
    exacerbating: ['Exertion', 'Walking', 'Weight bearing', 'Prolonged standing', 'Elevation', 'Movement'],
    relieving: ['Rest', 'Elevation', 'Hanging the leg down', 'Analgesics', 'Nothing'],
  }),
  painFrame({
    region: 'breast', label: 'breast', sample: 'Breast pain',
    iosPools: ['breastLump', 'breastDisease', 'coreConditions'],
    site: ['Upper outer (right)', 'Upper outer (left)', 'Upper inner (right)', 'Upper inner (left)',
      'Lower outer (right)', 'Lower outer (left)', 'Lower inner (right)', 'Lower inner (left)', 'Central / areola',
      'Axilla (right)', 'Axilla (left)', 'Bilateral'],
    character: ['Aching', 'Burning', 'Sharp', 'Heaviness', 'Tender'],
    radiation: ['No radiation', 'Axilla', 'Arm'],
    associations: ['Lump', 'Nipple discharge', 'Skin redness', 'Swelling', 'Fever', 'Breastfeeding'],
    timing: ['Cyclical variation', 'Non-cyclical', 'Premenstrual'],
    exacerbating: ['Movement', 'Touch', 'Before periods'],
    relieving: ['Supportive bra', 'Analgesics', 'Nothing'],
  }),
  painFrame({
    region: 'perineal', label: 'anal / perineal', sample: 'Anal pain',
    iosPools: ['perianal', 'anorectaColonBenign', 'pilonidalDisease', 'anorectalFunctional', 'rectalProlapse',
      'gynaecologyGeneral', 'coreConditions'],
    site: ['Perianal', 'Anal canal', 'Rectum', 'Posterior midline', 'Anterior midline', 'Left lateral', 'Right lateral',
      'Perineum', 'Natal cleft'],
    character: ['Sharp', 'Throbbing', 'Aching', 'Burning', 'Stabbing'],
    radiation: ['No radiation', 'Buttock', 'Genitalia'],
    associations: ['Rectal bleeding', 'Pruritus ani', 'Perianal discharge', 'Protrusion / prolapse', 'Swelling',
      'Fever', 'Constipation', 'Soiling', 'Mucus discharge', 'Tenesmus'],
    timing: ['Post-defaecation pain', 'Progressive'],
    exacerbating: ['Defaecation', 'Sitting', 'Straining', 'Walking'],
    relieving: ['Warm bath / sitz bath', 'Analgesics', 'Lying down', 'Nothing'],
    aliases: [
      { key: 'site', legacy: 'Perineal', current: 'Perineum' },
      { key: 'site', legacy: 'Anterior', current: 'Anterior midline' },
      { key: 'associations', legacy: 'Pain on defaecation', current: 'Defaecation' },
    ],
  }),
  painFrame({
    region: 'joint', siteWebKey: 'joint_site', label: 'joint', sample: 'Joint pain',
    iosPools: ['jointPain', 'rheumatology', 'orthopaedicTrauma', 'sportsMedicine', 'coreConditions'],
    site: ['Knee', 'Hip', 'Shoulder', 'Ankle', 'Wrist', 'Elbow', 'Small joints of hands', 'Big toe', 'Multiple joints'],
    character: ['Aching', 'Sharp', 'Throbbing', 'Stiffness', 'Burning'],
    radiation: ['No radiation', 'Down the limb', 'Referred to the knee'],
    associations: ['Swelling', 'Redness / warmth', 'Fever', 'Locking', 'Giving way', 'Rash', 'Red eye',
      'Bowel symptoms', 'Recent infection', 'Trauma'],
    timing: ['Morning stiffness', 'Worse at end of day', 'Nocturnal', 'Episodic flares', 'Progressive'],
    exacerbating: ['Weight bearing', 'Movement', 'Rest', 'Alcohol'],
    relieving: ['Rest', 'Exercise', 'NSAIDs', 'Analgesics', 'Nothing'],
  }),
  painFrame({
    region: 'genital', siteWebKey: 'genital_site', label: 'testis / scrotum', sample: 'Testicular pain',
    iosPools: ['scrotalTesticular', 'urologicalEmergency', 'urologicalSurgical', 'coreConditions'],
    site: ['Right testis', 'Left testis', 'Scrotum', 'Penis', 'Groin', 'Bilateral'],
    character: ['Sharp', 'Aching', 'Dragging', 'Throbbing', 'Colicky'],
    radiation: ['No radiation', 'Groin', 'Lower abdomen', 'Loin'],
    associations: ['Swelling', 'Nausea', 'Vomiting', 'Fever', 'Dysuria', 'Urethral discharge', 'Redness'],
    timing: ['Progressive', 'Previous similar episode'],
    exacerbating: ['Walking', 'Standing', 'Movement'],
    relieving: ['Elevation', 'Lying down', 'Analgesics', 'Nothing'],
  }),
];

// ── Cough ──────────────────────────────────────────────────────────────────────

const COUGH: HistoryFrame = {
  id: 'cough', type: 'cough', label: 'Cough', title: 'Cough history', sampleComplaint: 'Cough',
  iosPools: ['cough', 'shortnessOfBreath', 'pleural', 'thoracicSurgical', 'rhinosinusitis', 'coreConditions'],
  dimensions: [
    // BTS 2006 / ERS 2020: acute < 3 weeks, subacute 3–8 weeks, chronic > 8 weeks.
    d('duration', 'Duration', 'How long has the cough been present?', I.calendar, false, [
      'Acute under 3 weeks',
      o('Subacute 3–8 weeks', { value: '>3 weeks — subacute 3–8 weeks' }),
      o('Chronic over 8 weeks', { value: '>3 weeks — chronic over 8 weeks' }),
    ], { key: 'timing' }),
    d('character', 'Character', 'Dry or productive?', I.character, false, ['Dry cough', 'Productive cough'],
      { webKey: 'cough_character' }),
    d('sputum', 'Sputum', 'Sputum colour and volume?', I.drop, true, [
      'Clear or white sputum', 'Purulent green or yellow sputum', 'Rusty sputum', 'Pink frothy sputum',
      'Large volume daily', 'Foul-smelling sputum',
    ], { key: 'associations', webKey: 'sputum' }),
    d('haemoptysis', 'Haemoptysis', 'Any blood coughed up?', I.drop, false, [
      'Haemoptysis — streaks', 'Haemoptysis — frank blood', 'Haemoptysis — large volume',
    ], { key: 'associations', webKey: 'haemoptysis' }),
    d('timing', 'Timing', 'When is it worse?', I.timing, true, [
      'Nocturnal', 'Early morning', 'Progressive', 'Post-viral',
    ], { webKey: 'cough_timing' }),
    d('triggers', 'Triggers', 'What brings it on?', I.worse, true, [
      o('Lying flat', { key: 'timing', value: 'Worse lying flat' }),
      o('After meals', { key: 'timing', value: 'Post-prandial — after meals' }),
      o('Exercise', { key: 'exacerbating' }),
      o('Cold air', { key: 'exacerbating' }),
      o('Allergens', { key: 'exacerbating' }),
    ], { webKey: 'cough_triggers' }),
    d('relieving', 'Relieving', 'What helps?', I.better, true, [
      'Bronchodilator', 'Antihistamine', 'PPI / antacid', o('Stopping the ACE inhibitor', { value: 'Stop ACEi' }),
      'Nothing',
    ], { webKey: 'cough_relief' }),
    d('exposure', 'Medicines and exposures', 'ACE inhibitor, smoking, TB contact, travel?', I.risk, true, [
      o('Started after an ACE inhibitor', { key: 'timing', value: 'After starting ACEi' }),
      'Current or ex-smoker', 'TB contact', 'Recent travel', 'Occupational dust or asbestos',
    ], { key: 'history', webKey: 'cough_exposure' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Fever', 'Breathlessness', 'Wheeze', 'Chest pain', 'Weight loss', 'Night sweats', 'Hoarseness',
      'Heartburn / reflux', o('Post-nasal drip', { key: 'character', value: 'Post-nasal drip sensation' }),
      'Nasal discharge',
    ], { webKey: 'cough_assoc' }),
  ],
  secondaryDims: ['character', 'haemoptysis'],
};

// ── Dyspnoea ───────────────────────────────────────────────────────────────────

const DYSPNOEA: HistoryFrame = {
  id: 'dyspnoea', type: 'dyspnoea', label: 'Breathlessness', title: 'Breathlessness history',
  sampleComplaint: 'Shortness of breath',
  iosPools: ['shortnessOfBreath', 'heartFailure', 'cardiacFailure', 'pulmonaryEmbolism', 'venousThromboEmbolism',
    'pleural', 'cough', 'arrhythmia', 'coreConditions'],
  dimensions: [
    d('onset', 'Onset', 'How quickly did it come on?', I.onset, false, [
      'Sudden', 'Rapid — over hours', 'Over days', 'Gradual over weeks to months',
    ]),
    // MRC dyspnoea scale (Fletcher 1959; NICE NG115).
    d('exertion', 'Exercise tolerance', 'MRC dyspnoea grade?', I.lungs, false, [
      o('MRC 1 — strenuous exercise only', { value: 'Exertion — MRC 1 strenuous exercise only' }),
      o('MRC 2 — hurrying or a slight hill', { value: 'Exertion — MRC 2 hurrying or a slight hill' }),
      o('MRC 3 — slower than peers on the level', { value: 'Exertion — MRC 3 slower than peers on the level' }),
      o('MRC 4 — stops after 100 m', { value: 'Exertion — MRC 4 stops after 100 m' }),
      o('MRC 5 — breathless dressing or housebound', { value: 'Exertion — MRC 5 breathless dressing or housebound' }),
      'At rest',
    ], { key: 'exacerbating', webKey: 'dyspnoea_exertion' }),
    d('orthopnoea', 'Orthopnoea / PND', 'Breathless lying flat or waking at night?', I.timing, true, [
      'Orthopnoea', 'Paroxysmal nocturnal dyspnoea', 'Needs 3 pillows to sleep',
    ], { key: 'associations', webKey: 'orthopnoea' }),
    d('timing', 'Pattern', 'Episodic or progressive?', I.pattern, true, ['Episodic', 'Progressive', 'Nocturnal'],
      { webKey: 'dyspnoea_timing' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      o('Wheeze', { key: 'character' }), 'Chest pain', 'Pleuritic chest pain', 'Palpitations',
      'Ankle swelling / pitting oedema', 'Cough', 'Haemoptysis', 'Fever', 'Calf swelling', 'Weight loss',
      'Night sweats', 'Stridor', 'Syncope',
    ], { webKey: 'dyspnoea_assoc' }),
    d('triggers', 'Triggers', 'What brings it on?', I.worse, true, [
      o('Allergens', { key: 'exacerbating' }), o('Cold air', { key: 'exacerbating' }),
      o('Dust or fumes', { key: 'exacerbating' }), o('Viral infection', { key: 'exacerbating' }),
    ], { webKey: 'dyspnoea_triggers' }),
    d('relieving', 'Relieving', 'What helps?', I.better, true, ['Rest', 'Bronchodilator', 'Sitting up', 'Nothing'],
      { webKey: 'dyspnoea_relief' }),
    d('risk', 'Risk factors', 'Smoking, immobility, travel?', I.risk, true, [
      'Current or ex-smoker', 'Recent surgery or immobility', 'Long-haul travel', 'Oestrogen — pill or HRT',
    ], { key: 'history', webKey: 'dyspnoea_risk' }),
  ],
  secondaryDims: ['exertion', 'orthopnoea'],
};

// ── Lump / swelling ────────────────────────────────────────────────────────────

interface LumpSpec {
  variant: string; label: string; sample: string; iosPools: string[];
  site: Opt[]; extra: FrameDimension[]; associations: Opt[];
  aliases?: HistoryFrame['aliases'];
}

const LUMP_DURATION = d('onset', 'Duration', 'When was it first noticed?', I.onset, false, [
  'Days', 'Weeks', 'Months',
  'Years', 'Sudden',
]);

const LUMP_SIZE = d('size', 'Size change', 'Has it changed in size?', I.size, false, [
  'Rapid growth', 'Slow growth', 'Stable', 'Fluctuates in size', 'Getting smaller',
], { key: 'associations', webKey: 'lump_size' });

const LUMP_CONSISTENCY = d('character', 'Consistency', 'What does it feel like?', I.character, true, [
  'Soft', 'Firm', 'Hard', 'Rubbery', 'Smooth', 'Irregular', 'Fluctuant', 'Pulsatile', 'Matted', 'Mobile', 'Fixed',
], { webKey: 'lump_character' });

const LUMP_TENDERNESS = d('tenderness', 'Tenderness', 'Painful or tender?', I.character, false, [
  'Painless', 'Tender', 'Painful at times',
], { key: 'character', webKey: 'lump_tenderness' });

const LUMP_SKIN = d('skin', 'Overlying skin', 'Skin over the lump?', I.skin, true, [
  'No skin change', 'Redness', 'Tethered to skin', 'Punctum', 'Ulcerated', 'Discharging',
], { key: 'associations', webKey: 'lump_skin' });

const LUMP_SYSTEMIC = d('systemic', 'Systemic symptoms', 'Fever, weight loss, night sweats?', I.assoc, true, [
  'Fever', 'Weight loss', 'Night sweats', 'Fatigue', 'Pruritus',
], { key: 'associations', webKey: 'lump_systemic' });

/** Values the old lump SOCRATES chips stored (exacerbating / relieving); shown as recorded. */
const LUMP_LEGACY: NonNullable<HistoryFrame['aliases']> = [
  { key: 'exacerbating', legacy: 'None', current: '' },
  { key: 'exacerbating', legacy: 'Straining / Valsalva', current: '' },
  { key: 'exacerbating', legacy: 'Standing', current: '' },
  { key: 'exacerbating', legacy: 'Eating', current: '' },
  { key: 'exacerbating', legacy: 'Stress / anxiety', current: '' },
  { key: 'relieving', legacy: 'Lying down', current: '' },
  { key: 'relieving', legacy: 'Manual reduction', current: '' },
  { key: 'relieving', legacy: 'Rest', current: '' },
  { key: 'relieving', legacy: 'Nothing', current: '' },
  { key: 'radiation', legacy: 'No radiation', current: '' },
];

function lumpFrame(s: LumpSpec): HistoryFrame {
  return {
    id: `lump.${s.variant}`, type: 'lump', variant: s.variant, label: `Lump — ${s.label}`,
    title: 'Lump / swelling history', sampleComplaint: s.sample, iosPools: s.iosPools,
    dimensions: [
      d('site', 'Site', 'Where is it?', I.site, true, s.site, { webKey: 'lump_site' }),
      LUMP_DURATION, LUMP_SIZE, LUMP_CONSISTENCY, LUMP_TENDERNESS,
      ...s.extra,
      LUMP_SKIN,
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, s.associations,
        { webKey: 'lump_assoc' }),
      LUMP_SYSTEMIC,
    ],
    secondaryDims: ['site', 'size'],
    aliases: [...(s.aliases ?? []), ...LUMP_LEGACY.filter(a => !(s.aliases ?? []).some(x => x.key === a.key && x.legacy === a.legacy))],
  };
}

const LUMP_FRAMES: HistoryFrame[] = [
  lumpFrame({
    variant: 'neck', label: 'neck', sample: 'Neck lump',
    iosPools: ['neckLump', 'thyroidPathology', 'thyroidNoduleAssessment', 'headNeckSurgical', 'parotidSalivary',
      'endocrineSurgical', 'haematologicalMalignancy', 'coreConditions'],
    site: ['Anterior triangle (right)', 'Anterior triangle (left)', 'Posterior triangle (right)',
      'Posterior triangle (left)', 'Midline', 'Submandibular', 'Submental', 'Parotid region', 'Thyroid (right lobe)',
      'Thyroid (left lobe)', 'Thyroid isthmus', 'Supraclavicular', 'Occipital', 'Diffuse neck'],
    extra: [
      d('movement', 'Movement', 'Moves on swallowing or tongue protrusion?', I.pattern, true, [
        'Moves on swallowing', 'Moves on tongue protrusion',
      ], { key: 'associations', webKey: 'lump_movement' }),
      d('nodes', 'Other nodes', 'Other lumps or nodes?', I.site, true, [
        'Multiple nodes', 'Axillary nodes', 'Inguinal nodes',
      ], { key: 'associations', webKey: 'lump_nodes' }),
    ],
    associations: ['Dysphagia', 'Hoarseness / voice change', 'Stridor', 'Shortness of breath', 'Sore throat',
      'Ear pain', 'Recent infection', 'Heat intolerance', 'Cold intolerance', 'Facial swelling'],
  }),
  lumpFrame({
    variant: 'hernia', label: 'groin / abdominal wall', sample: 'Groin lump',
    iosPools: ['hernia', 'groinSwelling', 'abdominalWallHernia', 'abdominalWallDefects', 'groinSportsHernia',
      'groinPain', 'coreConditions'],
    site: ['Right inguinal', 'Left inguinal', 'Right femoral', 'Left femoral', 'Umbilical', 'Paraumbilical',
      'Epigastric / linea alba', 'Incisional', 'Parastomal', 'Right scrotum', 'Left scrotum', 'Bilateral'],
    extra: [
      d('reducibility', 'Reducibility', 'Does it go back?', I.pattern, true, [
        'Cough impulse', 'Reducible', 'Reduces on lying down', 'Irreducible', 'Recently irreducible',
      ], { key: 'associations', webKey: 'reducibility' }),
    ],
    associations: ['Pain on straining', 'Vomiting', 'Constipation', 'Abdominal distension', 'Chronic cough',
      'Lower urinary tract symptoms', 'Heavy lifting'],
    aliases: [
      { key: 'exacerbating', legacy: 'Straining / Valsalva', current: 'Pain on straining' },
      { key: 'relieving', legacy: 'Manual reduction', current: 'Reducible' },
      { key: 'relieving', legacy: 'Lying down', current: 'Reduces on lying down' },
    ],
  }),
  lumpFrame({
    variant: 'scrotal', label: 'scrotum', sample: 'Scrotal swelling',
    iosPools: ['scrotalTesticular', 'urologicalSurgical', 'urologicalEmergency', 'coreConditions'],
    site: ['Right testis', 'Left testis', 'Right epididymis', 'Left epididymis', 'Right cord', 'Left cord',
      'Whole hemiscrotum', 'Bilateral'],
    extra: [
      d('transillumination', 'Transillumination', 'Can you get above it; does it transilluminate?', I.pattern, true, [
        'Transilluminates', 'Does not transilluminate', 'Can get above it', 'Cannot get above it',
        'Separate from the testis', 'Bag of worms',
      ], { key: 'associations', webKey: 'transillumination' }),
    ],
    associations: ['Pain', 'Heaviness / dragging', 'Dysuria', 'Urethral discharge', 'Trauma', 'Recent mumps'],
  }),
  lumpFrame({
    variant: 'abdominal', label: 'abdomen', sample: 'Abdominal mass',
    iosPools: ['abdominalPain', 'hepatobiliaryMalignancy', 'colorectalMalignancy', 'aorticConditions',
      'vascularSurgical', 'softTissueTumours', 'coreConditions'],
    site: ['RUQ', 'Epigastric', 'LUQ', 'Right flank', 'Periumbilical', 'Left flank', 'RLQ', 'Suprapubic', 'LLQ'],
    extra: [],
    associations: ['Abdominal pain', 'Early satiety', 'Change in bowel habit', 'Jaundice', 'Vomiting', 'Back pain',
      'Haematuria'],
  }),
  lumpFrame({
    variant: 'soft_tissue', label: 'skin / soft tissue', sample: 'Lump on the back',
    iosPools: ['softTissueTumours', 'skinLesion', 'woundInfection', 'necroSoftTissue', 'coreConditions'],
    site: ['Scalp', 'Face', 'Neck', 'Shoulder', 'Back', 'Chest wall', 'Abdominal wall', 'Arm', 'Forearm', 'Hand',
      'Thigh', 'Lower leg', 'Foot', 'Axilla', 'Groin', 'Perianal'],
    extra: [
      d('depth', 'Depth', 'Superficial or deep?', I.size, false, [
        'Subcutaneous', 'Deep to fascia', 'Size over 5 cm',
      ], { key: 'associations', webKey: 'lump_depth' }),
    ],
    associations: ['Previous similar lump', 'Trauma to the area', 'Cheese-like discharge', 'Numbness beyond the lump'],
  }),
];

/** Limb swelling (oedema): not a discrete lump; its own questions. */
const LIMB_SWELLING: HistoryFrame = {
  id: 'lump.limb_swelling', type: 'lump', variant: 'limb_swelling', label: 'Swelling — limb',
  title: 'Limb swelling history', sampleComplaint: 'Leg swelling',
  iosPools: ['venousThromboEmbolism', 'heartFailure', 'cardiacFailure', 'peripheralVascular', 'vascularSurgical',
    'chronicKidney', 'coreConditions'],
  dimensions: [
    d('site', 'Site', 'Which limb and how far?', I.site, true, [
      'Right leg', 'Left leg', 'Bilateral legs', 'Ankle only', 'To the knee', 'Whole leg', 'Arm',
    ], { webKey: 'swelling_site' }),
    d('onset', 'Onset', 'How quickly did it come on?', I.onset, false, ['Sudden', 'Over days', 'Gradual']),
    d('character', 'Character', 'What is the swelling like?', I.character, true, [
      'Pitting oedema', 'Non-pitting', 'Tender', 'Warm', 'Red',
    ], { key: 'associations', webKey: 'swelling_character' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Calf tenderness', 'Shortness of breath', 'Orthopnoea', 'Chest pain', 'Leg ulcer', 'Visible varicosities',
      'Weight gain', 'Fever',
    ], { webKey: 'swelling_assoc' }),
    d('risk', 'Risk factors', 'Recent immobility, surgery, cancer?', I.risk, true, [
      'Recent surgery or immobility', 'Long-haul travel', 'Active cancer', 'Previous DVT', 'Oestrogen — pill or HRT',
    ], { key: 'history', webKey: 'swelling_risk' }),
  ],
  secondaryDims: ['site', 'character'],
};

// ── Breast ─────────────────────────────────────────────────────────────────────

const BREAST: HistoryFrame = {
  id: 'breast', type: 'breast', label: 'Breast', title: 'Breast history', sampleComplaint: 'Breast lump',
  iosPools: ['breastLump', 'breastDisease', 'coreConditions'],
  dimensions: [
    d('site', 'Site', 'Which breast and quadrant?', I.site, true, [
      'Upper outer (right)', 'Upper outer (left)', 'Upper inner (right)', 'Upper inner (left)',
      'Lower outer (right)', 'Lower outer (left)', 'Lower inner (right)', 'Lower inner (left)', 'Central / areola',
      'Axilla (right)', 'Axilla (left)', 'Bilateral',
    ], { webKey: 'breast_site' }),
    LUMP_DURATION,
    d('character', 'Lump', 'What is the lump like?', I.character, true, [
      'Smooth', 'Irregular', 'Firm', 'Hard', 'Soft', 'Rubbery', 'Cystic', 'Mobile', 'Fixed to skin',
      'Fixed to muscle', 'Tender', 'Non-tender',
    ], { webKey: 'breast_character' }),
    d('size', 'Size change', 'Has it changed?', I.size, false, [
      'Rapid growth', 'Slow growth', 'Stable', 'Cyclical variation',
    ], { key: 'associations', webKey: 'breast_size' }),
    d('discharge', 'Nipple discharge', 'Any nipple discharge?', I.drop, true, [
      'Bloody discharge', 'Clear discharge', 'Milky discharge', 'Green-brown discharge', 'Purulent discharge',
      'Single duct', 'Spontaneous',
    ], { key: 'associations', webKey: 'nipple_discharge' }),
    d('skin', 'Skin and nipple', 'Skin or nipple change?', I.skin, true, [
      'Skin dimpling', 'Skin tethering', "Peau d'orange", 'Redness', 'Nipple inversion', 'Nipple eczema',
      'Ulceration',
    ], { key: 'associations', webKey: 'breast_skin' }),
    d('associations', 'Associated symptoms', 'Axilla and systemic?', I.assoc, true, [
      'Axillary lump', 'Breast pain', 'Arm swelling', 'Weight loss', 'Bone pain', 'Breathlessness', 'Fever',
      'Breastfeeding',
    ], { webKey: 'breast_assoc' }),
    d('risk', 'Risk factors', 'Family history and hormones?', I.risk, true, [
      'Family history of breast cancer', 'Previous breast cancer', 'BRCA carrier', 'HRT / OCP',
      'Previous chest radiotherapy',
    ], { key: 'history', webKey: 'breast_risk' }),
  ],
  secondaryDims: ['character', 'discharge'],
  aliases: [
    { key: 'associations', legacy: 'Skin changes / dimpling', current: 'Skin dimpling' },
    { key: 'associations', legacy: 'Mastalgia', current: 'Breast pain' },
    { key: 'associations', legacy: 'Cyclical changes', current: 'Cyclical variation' },
    { key: 'associations', legacy: 'Nipple discharge', current: '' },
    { key: 'radiation', legacy: 'No radiation', current: '' },
  ],
};

// ── Bleeding ───────────────────────────────────────────────────────────────────

const ANTICOAGULANTS = d('drugs', 'Anticoagulants', 'Blood thinners or NSAIDs?', I.risk, true, [
  'Anticoagulant', 'Antiplatelet', 'NSAIDs',
], { key: 'history', webKey: 'bleeding_drugs' });

const BLEED_VOLUME = d('volume', 'Volume', 'How much?', I.drop, false, [
  'Streaks or spotting', 'Moderate', 'Large with clots', 'Massive',
], { key: 'character', webKey: 'bleeding_volume' });

function bleedFrame(variant: string, label: string, sample: string, iosPools: string[], dims: FrameDimension[],
  secondaryDims: string[]): HistoryFrame {
  return {
    id: `bleeding.${variant}`, type: 'bleeding', variant, label: `Bleeding — ${label}`, title: 'Bleeding history',
    sampleComplaint: sample, iosPools, dimensions: dims, secondaryDims,
  };
}

const BLEEDING_FRAMES: HistoryFrame[] = [
  bleedFrame('rectal', 'rectal', 'Rectal bleeding',
    ['rectalBleeding', 'perianal', 'anorectaColonBenign', 'colorectalMalignancy', 'inflammatoryBowel',
      'inflammatoryBowelDisease', 'colonoscopyPathology', 'coreConditions'], [
      d('colour', 'Colour', 'What colour is the blood?', I.drop, false, [
        'Bright red', 'Dark red', 'Maroon', 'Black / melaena',
      ], { key: 'character', webKey: 'bleeding_colour' }),
      d('relation', 'Relation to stool', 'Where is the blood?', I.site, false, [
        'On the paper', 'In the pan — separate from stool', 'Mixed with stool', 'Coating the stool',
      ], { key: 'associations', webKey: 'bleeding_relation' }),
      BLEED_VOLUME,
      DURATION(GENERIC_DURATION),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Change in bowel habit', 'Weight loss', 'Anal pain', 'Pain on defaecation', 'Mucus', 'Tenesmus',
        'Protrusion / prolapse', 'Abdominal pain', 'Dizziness / syncope',
      ], { webKey: 'bleeding_assoc' }),
      ANTICOAGULANTS,
      d('risk', 'Risk factors', 'Family history?', I.risk, true, [
        'Family history of bowel cancer', 'Known inflammatory bowel disease', 'Known diverticular disease',
      ], { key: 'history', webKey: 'bleeding_risk' }),
    ], ['colour', 'relation']),
  bleedFrame('upper_gi', 'upper GI', 'Haematemesis',
    ['upperGIBleed', 'upperGIDisease', 'liverCirrhosisComplications', 'oesophagogastricSurgical', 'coreConditions'], [
      d('presentation', 'Presentation', 'Vomited blood or black stool?', I.drop, true, [
        'Haematemesis — fresh blood', 'Coffee-ground vomit', 'Melaena',
      ], { key: 'character', webKey: 'ugib_presentation' }),
      d('onset', 'Onset', 'What came before?', I.onset, false, ['After retching', 'Sudden', 'Over days']),
      BLEED_VOLUME,
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Epigastric pain', 'Dizziness / syncope', 'Dysphagia', 'Weight loss', 'Heartburn', 'Jaundice',
        'Abdominal distension',
      ], { webKey: 'bleeding_assoc' }),
      ANTICOAGULANTS,
      d('risk', 'Risk factors', 'Liver disease, alcohol, ulcer?', I.risk, true, [
        'Alcohol excess', 'Known liver disease or varices', 'Previous peptic ulcer', 'H. pylori',
      ], { key: 'history', webKey: 'bleeding_risk' }),
    ], ['presentation']),
  bleedFrame('urinary', 'haematuria', 'Haematuria',
    ['urinarySymptoms', 'urologicalSurgical', 'prostateCancer', 'renalUrolithiasis', 'urinaryTractInfection',
      'coreConditions'], [
      d('type', 'Haematuria', 'Visible or on dipstick?', I.drop, false, [
        'Visible haematuria', 'Non-visible haematuria',
      ], { key: 'associations', webKey: 'haematuria_type' }),
      d('stream', 'Timing in the stream', 'Start, end or throughout?', I.timing, false, [
        'Initial', 'Terminal', 'Throughout the stream',
      ], { key: 'associations', webKey: 'haematuria_stream' }),
      d('pain', 'Pain', 'Painless or painful?', I.character, false, [
        'Painless haematuria', 'Loin pain', 'Dysuria',
      ], { key: 'associations', webKey: 'haematuria_pain' }),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Clots', 'Frequency', 'Poor stream', 'Retention', 'Fever', 'Weight loss',
      ], { webKey: 'bleeding_assoc' }),
      ANTICOAGULANTS,
      d('risk', 'Risk factors', 'Smoking, occupation?', I.risk, true, [
        'Current or ex-smoker', 'Dye or rubber industry work', 'Recent catheter or instrumentation',
      ], { key: 'history', webKey: 'bleeding_risk' }),
    ], ['type', 'pain']),
  bleedFrame('vaginal', 'vaginal', 'Vaginal bleeding',
    ['vaginalBleeding', 'gynaecologyGeneral', 'obstetricComplications', 'acuteObstetricGynae', 'coreConditions'], [
      d('pattern', 'Pattern', 'When does it happen?', I.pattern, true, [
        'Postmenopausal bleeding', 'Intermenstrual bleeding', 'Postcoital bleeding', 'Heavy menstrual bleeding',
        'In pregnancy',
      ], { key: 'associations', webKey: 'pv_pattern' }),
      BLEED_VOLUME,
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Pelvic pain', 'Vaginal discharge', 'Dizziness / syncope', 'Weight loss', 'Missed period',
      ], { webKey: 'bleeding_assoc' }),
      ANTICOAGULANTS,
    ], ['pattern']),
  bleedFrame('general', 'other', 'Bruising / bleeding',
    ['coagulationDisorder', 'haematologicalMalignancy', 'epistaxis', 'anaemia', 'coreConditions'], [
      d('site', 'Site', 'Where is the bleeding?', I.site, true, [
        'Easy bruising', 'Nosebleeds', 'Gums', 'Rectal', 'Vomit', 'Urine', 'Heavy periods', 'After surgery or dental work',
      ], { webKey: 'bleeding_site' }),
      BLEED_VOLUME,
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Fatigue', 'Fever', 'Weight loss', 'Night sweats', 'Joint swelling',
      ], { webKey: 'bleeding_assoc' }),
      ANTICOAGULANTS,
      d('risk', 'Risk factors', 'Family history?', I.risk, true, [
        'Family history of bleeding disorder', 'Known liver disease',
      ], { key: 'history', webKey: 'bleeding_risk' }),
    ], ['site']),
];

// ── Bowel habit ────────────────────────────────────────────────────────────────

const BOWEL: HistoryFrame = {
  id: 'bowel', type: 'bowel', label: 'Bowel habit', title: 'Bowel habit history', sampleComplaint: 'Change in bowel habit',
  iosPools: ['bowelHabit', 'colorectalMalignancy', 'inflammatoryBowel', 'inflammatoryBowelDisease',
    'smallBowelObstruction', 'intestinalObstruction', 'anorectalFunctional', 'coreConditions'],
  dimensions: [
    d('change', 'Change', 'What has changed?', I.pattern, false, [
      'Looser or more frequent', 'Constipation', 'Alternating', 'Absolute constipation',
    ], { key: 'associations', webKey: 'bowel_change' }),
    DURATION(['Under 6 weeks', 'Over 6 weeks',
      'Over 6 months']),
    d('stool', 'Stool', 'What is the stool like?', I.drop, true, [
      'Watery', 'Blood mixed in', 'Mucus', 'Pale greasy stools', 'Black stools', 'Nocturnal diarrhoea',
    ], { key: 'associations', webKey: 'stool' }),
    d('frequency', 'Frequency', 'How many times a day?', I.timing, false, [
      '3–5 a day', '6–10 a day', 'Over 10 a day',
    ], { key: 'associations', webKey: 'bowel_frequency' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Abdominal pain', 'Bloating / distension', 'Weight loss', 'Fever', 'Vomiting', 'Urgency', 'Faecal incontinence',
      'Tenesmus', 'Rectal bleeding',
    ], { webKey: 'bowel_assoc' }),
    d('context', 'Context', 'Antibiotics, travel, contacts?', I.risk, true, [
      'Recent antibiotics', 'Recent travel', 'Sick contacts or suspect food', 'Recent hospital admission',
      'New medication', 'Family history of bowel cancer',
    ], { key: 'history', webKey: 'bowel_context' }),
  ],
  secondaryDims: ['change', 'stool'],
};

// ── Dysphagia ──────────────────────────────────────────────────────────────────

const DYSPHAGIA: HistoryFrame = {
  id: 'dysphagia', type: 'dysphagia', label: 'Dysphagia', title: 'Dysphagia history', sampleComplaint: 'Dysphagia',
  iosPools: ['dysphagia', 'oesophagogastricSurgical', 'upperGIDisease', 'refluxGERD', 'coreConditions'],
  dimensions: [
    d('type', 'Solids or liquids', 'Solids, liquids or both?', I.character, false, [
      'Solids only', 'Solids then liquids', 'Liquids more than solids', 'Both solids and liquids from the start',
    ], { key: 'exacerbating', webKey: 'dysphagia_type' }),
    d('course', 'Course', 'Progressive or intermittent?', I.pattern, false, ['Progressive', 'Intermittent', 'Constant'],
      { key: 'timing', webKey: 'dysphagia_course' }),
    d('site', 'Level', 'Where does food stick?', I.site, false, [
      'Throat', 'Upper neck', 'Mid-neck', 'Upper chest', 'Mid-chest', 'Lower chest / epigastric',
    ], { webKey: 'dysphagia_level' }),
    DURATION(['Under 4 weeks', '1–3 months',
      'Over 3 months']),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Weight loss', 'Odynophagia', 'Regurgitation', 'Food bolus episodes', 'Aspiration', 'Heartburn', 'Voice change',
      'Haematemesis', 'Melaena', 'Vomiting',
    ], { webKey: 'dysphagia_assoc' }),
    d('relieving', 'Relieving', 'What helps?', I.better, true, [
      'Small sips of water', 'Liquids only', 'Sitting upright', 'Nothing',
    ], { webKey: 'dysphagia_relief' }),
  ],
  secondaryDims: ['type', 'course'],
  aliases: [
    { key: 'exacerbating', legacy: 'Solids', current: 'Solids only' },
    { key: 'exacerbating', legacy: 'Liquids', current: 'Liquids more than solids' },
    { key: 'exacerbating', legacy: 'Both solids and liquids', current: 'Both solids and liquids from the start' },
    { key: 'exacerbating', legacy: 'Eating quickly', current: '' },
    { key: 'exacerbating', legacy: 'Stress', current: '' },
    { key: 'exacerbating', legacy: 'None', current: '' },
  ],
};

// ── Jaundice ───────────────────────────────────────────────────────────────────

const JAUNDICE: HistoryFrame = {
  id: 'jaundice', type: 'jaundice', label: 'Jaundice', title: 'Jaundice history', sampleComplaint: 'Jaundice',
  iosPools: ['jaundice', 'biliaryColic', 'hepatobiliaryAcute', 'hepatobiliaryMalignancy', 'pancreaticSurgical',
    'liverDisease', 'liverCirrhosisComplications', 'coreConditions'],
  dimensions: [
    d('pain', 'Pain', 'Painless or painful?', I.character, false, [
      'Painless', 'With RUQ pain', 'With colicky pain', 'With epigastric pain to the back',
    ], { key: 'character', webKey: 'jaundice_pain' }),
    DURATION(GENERIC_DURATION),
    d('urine', 'Urine and stools', 'Dark urine, pale stools, itch?', I.drop, true, [
      'Dark urine', 'Pale stools', 'Pruritus',
    ], { key: 'associations', webKey: 'jaundice_urine' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Fever', 'Rigors', 'Weight loss', 'Anorexia', 'Abdominal distension', 'Confusion', 'Nausea', 'Vomiting',
    ], { webKey: 'jaundice_assoc' }),
    d('history', 'History', 'Gallstones, alcohol, medicines?', I.risk, true, [
      'Known gallstones', 'Previous biliary surgery or ERCP', 'Alcohol excess', 'Recent travel', 'New medication',
      'Blood transfusion or injecting drug use', 'Known liver disease',
    ], { key: 'history', webKey: 'jaundice_history' }),
  ],
  secondaryDims: ['pain', 'urine'],
};

// ── Vomiting ───────────────────────────────────────────────────────────────────

const VOMITING: HistoryFrame = {
  id: 'vomiting', type: 'vomiting', label: 'Vomiting', title: 'Vomiting history', sampleComplaint: 'Vomiting',
  iosPools: ['nauseaVomiting', 'smallBowelObstruction', 'intestinalObstruction', 'upperGIDisease', 'coreConditions'],
  dimensions: [
    d('content', 'Content', 'What is brought up?', I.drop, true, [
      'Undigested food', 'Bilious', 'Fresh blood', 'Coffee-ground', 'Faeculent', 'Non-bilious',
    ], { key: 'character', webKey: 'vomit_content' }),
    d('pattern', 'Pattern', 'When and how?', I.pattern, true, [
      'Projectile', 'After meals', 'Early morning', 'Continuous', 'Episodic', 'Effortless',
    ], { key: 'timing', webKey: 'vomit_pattern' }),
    d('onset', 'Onset', 'When did it start?', I.onset, false, PAIN_ONSET),
    d('frequency', 'Frequency', 'How often?', I.timing, false, [
      'Once or twice', '3–5 times a day', 'More than 5 a day', 'Unable to keep fluids down',
    ], { key: 'associations', webKey: 'vomit_frequency' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Abdominal pain', 'Distension', 'Constipation', 'Diarrhoea', 'Fever', 'Headache', 'Vertigo', 'Weight loss',
      'Early satiety', 'Dizziness',
    ], { webKey: 'vomit_assoc' }),
    d('context', 'Context', 'Pregnancy, medicines, contacts?', I.risk, true, [
      'Possible pregnancy', 'New medication', 'Alcohol', 'Recent surgery', 'Sick contacts or suspect food',
      'Diabetes',
    ], { key: 'history', webKey: 'vomit_context' }),
  ],
  secondaryDims: ['content', 'pattern'],
};

// ── Fever ──────────────────────────────────────────────────────────────────────

const FEVER: HistoryFrame = {
  id: 'fever', type: 'fever', label: 'Fever', title: 'Fever history', sampleComplaint: 'Fever',
  iosPools: ['feverInfection', 'sepsisConditions', 'tropicalInfections', 'tropicalInfectious', 'bacteraemia',
    'paediatricFebrile', 'coreConditions'],
  dimensions: [
    DURATION(['Under 1 week', '1–3 weeks',
      'Over 3 weeks']),
    d('pattern', 'Pattern', 'Continuous or spikes?', I.pattern, true, [
      'Continuous', 'Intermittent spikes', 'Rigors', 'Night sweats',
    ], { key: 'associations', webKey: 'fever_pattern' }),
    d('temperature', 'Highest temperature', 'Highest recorded?', I.severity, false, [
      '37.5–37.9 °C', '38–38.9 °C', '39 °C or higher', 'Not measured',
    ], { key: 'associations', webKey: 'fever_temperature' }),
    d('source', 'Source', 'Symptoms pointing to a source?', I.site, true, [
      'Cough or sputum', 'Dysuria or frequency', 'Abdominal pain', 'Diarrhoea', 'Headache', 'Neck stiffness', 'Rash',
      'Joint pain', 'Wound redness or discharge', 'Sore throat', 'Jaundice',
    ], { key: 'associations', webKey: 'fever_source' }),
    d('exposure', 'Exposure', 'Travel, flood water, mosquitoes?', I.risk, true, [
      'Recent travel', 'Flood water or rat exposure', 'Mosquito bites', 'Sick contacts', 'Recent surgery',
      'Indwelling line or catheter', 'Immunosuppressed',
    ], { key: 'history', webKey: 'fever_exposure' }),
  ],
  secondaryDims: ['pattern', 'source'],
};

// ── Urinary ────────────────────────────────────────────────────────────────────

const URINARY: HistoryFrame = {
  id: 'urinary', type: 'urinary', label: 'Urinary', title: 'Urinary history', sampleComplaint: 'Urinary symptoms',
  iosPools: ['urinarySymptoms', 'urinaryRetention', 'urinaryTractInfection', 'prostateCancer', 'urologicalSurgical',
    'coreConditions'],
  dimensions: [
    d('storage', 'Storage symptoms', 'Frequency, urgency, nocturia?', I.timing, true, [
      'Frequency', 'Urgency', 'Nocturia', 'Urge incontinence',
    ], { key: 'associations', webKey: 'luts_storage' }),
    d('voiding', 'Voiding symptoms', 'Stream and emptying?', I.pattern, true, [
      'Hesitancy', 'Poor stream', 'Straining to void', 'Intermittent stream', 'Terminal dribbling',
      'Incomplete emptying',
    ], { key: 'associations', webKey: 'luts_voiding' }),
    d('pain', 'Dysuria and pain', 'Burning or pain?', I.character, true, [
      'Dysuria', 'Suprapubic pain', 'Loin pain',
    ], { key: 'associations', webKey: 'urinary_pain' }),
    d('retention', 'Retention', 'Able to pass urine?', I.drop, false, [
      'Unable to pass urine', 'Overflow incontinence',
    ], { key: 'associations', webKey: 'retention' }),
    DURATION(GENERIC_DURATION),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Visible haematuria', 'Fever', 'Urethral discharge', 'Weight loss', 'Bone pain', 'Constipation',
    ], { webKey: 'urinary_assoc' }),
  ],
  secondaryDims: ['storage', 'pain'],
};

// ── Neurological ───────────────────────────────────────────────────────────────

const NEURO_FRAMES: HistoryFrame[] = [
  {
    id: 'neuro.weakness', type: 'neuro', variant: 'weakness', label: 'Weakness', title: 'Weakness history',
    sampleComplaint: 'Weakness',
    iosPools: ['strokeTIA', 'spinalEmergency', 'spinalNeurosurgical', 'neurosurgicalHead', 'peripheralNeuropathy',
      'coreConditions'],
    dimensions: [
      d('distribution', 'Distribution', 'Where is the weakness?', I.site, false, [
        'One side — face arm and leg', 'One limb', 'Both legs', 'Proximal muscles', 'Generalised',
      ], { key: 'associations', webKey: 'weakness_distribution' }),
      d('onset', 'Onset', 'How did it start?', I.onset, false, ['Sudden', 'Over hours', 'Gradual']),
      d('course', 'Course', 'Since onset?', I.pattern, false, [
        'Resolved within 24 hours', 'Improving', 'Static', 'Progressive',
      ], { key: 'timing', webKey: 'weakness_course' }),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Speech disturbance', 'Facial droop', 'Visual loss', 'Diplopia', 'Numbness', 'Headache', 'Unsteadiness',
        'Urinary retention', 'Back pain', 'Seizure',
      ], { webKey: 'neuro_assoc' }),
    ],
    secondaryDims: ['distribution', 'onset'],
  },
  {
    id: 'neuro.numbness', type: 'neuro', variant: 'numbness', label: 'Numbness', title: 'Numbness history',
    sampleComplaint: 'Numbness and tingling',
    iosPools: ['peripheralNeuropathy', 'strokeTIA', 'spinalEmergency', 'backPain', 'coreConditions'],
    dimensions: [
      d('distribution', 'Distribution', 'Where is it numb?', I.site, true, [
        'Glove and stocking', 'One limb', 'One side of the body', 'Dermatomal', 'Saddle area', 'Hand — thumb and fingers',
      ], { key: 'associations', webKey: 'numbness_distribution' }),
      d('onset', 'Onset', 'How did it start?', I.onset, false, ['Sudden', 'Over hours', 'Gradual']),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Weakness', 'Burning pain', 'Back pain', 'Urinary retention', 'Unsteadiness', 'Worse at night',
      ], { webKey: 'neuro_assoc' }),
      d('risk', 'Risk factors', 'Diabetes, alcohol, B12?', I.risk, true, [
        'Diabetes', 'Alcohol excess', 'Low B12 or vegan diet', 'Chemotherapy',
      ], { key: 'history', webKey: 'numbness_risk' }),
    ],
    secondaryDims: ['distribution'],
  },
  {
    id: 'neuro.dizziness', type: 'neuro', variant: 'dizziness', label: 'Dizziness', title: 'Dizziness history',
    sampleComplaint: 'Dizziness',
    iosPools: ['dizzinessVertigo', 'syncope', 'earComplaint', 'strokeTIA', 'coreConditions'],
    dimensions: [
      d('character', 'Type', 'Spinning, light-headed or unsteady?', I.character, false, [
        'True vertigo — spinning', 'Lightheadedness', 'Unsteady on the feet',
      ], { webKey: 'dizziness_type' }),
      d('timing', 'Episode length', 'How long does an episode last?', I.timing, false, [
        'Brief — seconds', 'Episodic — minutes to hours', 'Continuous — days',
      ], { webKey: 'dizziness_duration' }),
      d('exacerbating', 'Triggers', 'What brings it on?', I.worse, true, [
        'Rolling over in bed', 'Looking up', 'Standing up', 'Head movement',
      ], { webKey: 'dizziness_triggers' }),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Hearing loss', 'Tinnitus', 'Aural fullness', 'Nausea', 'Diplopia', 'Dysarthria', 'Limb ataxia', 'Headache',
        'Palpitations', 'Chest pain',
      ], { webKey: 'dizziness_assoc' }),
    ],
    secondaryDims: ['character'],
  },
];

// ── Skin ───────────────────────────────────────────────────────────────────────

const SKIN_SITES: Opt[] = ['Face', 'Scalp', 'Neck', 'Shoulder', 'Back', 'Chest', 'Abdomen', 'Arm', 'Forearm', 'Hand',
  'Thigh', 'Lower leg', 'Foot'];

const SKIN_FRAMES: HistoryFrame[] = [
  {
    id: 'skin.lesion', type: 'skin', variant: 'lesion', label: 'Skin lesion', title: 'Skin lesion history',
    sampleComplaint: 'Skin lesion',
    iosPools: ['skinLesion', 'softTissueTumours', 'coreConditions'],
    dimensions: [
      d('site', 'Site', 'Where is it?', I.site, true, SKIN_SITES, { webKey: 'skin_site' }),
      LUMP_DURATION,
      d('change', 'Change (ABCDE)', 'Has it changed?', I.size, true, [
        'Asymmetry', 'Irregular border', 'Multiple colours', 'Diameter over 6 mm', 'Evolving',
      ], { key: 'associations', webKey: 'lesion_change' }),
      d('character', 'Appearance', 'What does it look like?', I.character, true, [
        'Pigmented', 'Non-pigmented', 'Raised', 'Flat', 'Rolled border', 'Crusting', 'Ulcerated', 'Bleeding', 'Itchy',
      ], { webKey: 'lesion_character' }),
      d('risk', 'Risk factors', 'Sun exposure, previous skin cancer?', I.risk, true, [
        'Sunburn history', 'Fair skin', 'Previous skin cancer', 'Family history of melanoma', 'Immunosuppressed',
      ], { key: 'history', webKey: 'lesion_risk' }),
      d('associations', 'Associated', 'Nodes or other lesions?', I.assoc, true, [
        'Regional lymphadenopathy', 'Satellite lesions', 'Weight loss',
      ], { webKey: 'lesion_assoc' }),
    ],
    secondaryDims: ['change', 'character'],
    aliases: [
      { key: 'exacerbating', legacy: 'Sun exposure', current: '' },
      { key: 'exacerbating', legacy: 'Trauma', current: '' },
      { key: 'exacerbating', legacy: 'None', current: '' },
      { key: 'relieving', legacy: 'None', current: '' },
      { key: 'relieving', legacy: 'Reducing sun exposure', current: '' },
      { key: 'radiation', legacy: 'No radiation', current: '' },
    ],
  },
  {
    id: 'skin.wound', type: 'skin', variant: 'wound', label: 'Wound / ulcer', title: 'Wound history',
    sampleComplaint: 'Wound problem',
    iosPools: ['woundInfection', 'surgicalSiteInfection', 'chronicWoundCare', 'chronicWoundManagement',
      'necrotizingInfection', 'necroSoftTissue', 'necrotisingSoftTissue', 'diabeticFoot', 'postOpComplications',
      'postOpReview', 'pilonidalDisease', 'coreConditions'],
    dimensions: [
      d('site', 'Site', 'Where is it?', I.site, true, [...SKIN_SITES, 'Surgical wound', 'Toe', 'Heel', 'Sole'],
        { webKey: 'skin_site' }),
      d('onset', 'Onset', 'When did it start?', I.onset, false, [
        'Days after surgery', 'Sudden', 'Days',
        'Weeks', 'Months',
      ]),
      d('appearance', 'Appearance', 'What does the wound look like?', I.skin, true, [
        'Wound erythema', 'Spreading redness', 'Wound swelling', 'Warmth', 'Serous discharge', 'Pus discharge',
        'Offensive smell', 'Wound opening', 'Necrotic tissue', 'Exposed bone or tendon',
      ], { key: 'associations', webKey: 'wound_appearance' }),
      d('pain', 'Pain', 'Painful?', I.character, false, [
        'Pain at site', 'Pain out of proportion', 'Painless',
      ], { key: 'associations', webKey: 'wound_pain' }),
      d('associations', 'Systemic', 'Fever or unwell?', I.assoc, true, ['Fever', 'Rigors', 'Feeling unwell'],
        { webKey: 'wound_assoc' }),
      d('risk', 'Risk factors', 'Diabetes, smoking, circulation?', I.risk, true, [
        'Diabetes', 'Current or ex-smoker', 'Steroids', 'Peripheral arterial disease', 'Venous disease',
      ], { key: 'history', webKey: 'wound_risk' }),
    ],
    secondaryDims: ['appearance'],
  },
  {
    id: 'skin.rash', type: 'skin', variant: 'rash', label: 'Rash', title: 'Rash history', sampleComplaint: 'Rash',
    iosPools: ['dermatologyRash', 'skinRash', 'allergyImmunology', 'coreConditions'],
    dimensions: [
      d('site', 'Distribution', 'Where is the rash?', I.site, true, [
        'Face', 'Trunk', 'Limbs', 'Generalised', 'Flexural', 'Sun-exposed areas', 'Palms and soles',
        'Dermatomal strip',
      ], { webKey: 'rash_site' }),
      d('onset', 'Onset', 'When did it start?', I.onset, false, PAIN_ONSET),
      d('character', 'Appearance', 'What does it look like?', I.character, true, [
        'Maculopapular', 'Vesicular / blistering', 'Urticarial wheals', 'Non-blanching purpura', 'Scaly plaques',
        'Erosions',
      ], { webKey: 'rash_character' }),
      d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
        'Itch', 'Fever', 'Joint pain', 'New medication', 'Recent illness', 'Mouth ulcers', 'Contact exposure',
      ], { webKey: 'rash_assoc' }),
    ],
    secondaryDims: ['character'],
  },
];

// ── Weight loss, fatigue, palpitations, syncope, general ─────────────────────

const WEIGHT_LOSS: HistoryFrame = {
  id: 'weight_loss', type: 'weight_loss', label: 'Weight loss', title: 'Weight loss history',
  sampleComplaint: 'Unexplained weight loss',
  iosPools: ['weightLoss', 'colorectalMalignancy', 'oesophagogastricSurgical', 'haematologicalMalignancy',
    'nutritionDeficiency', 'coreConditions'],
  dimensions: [
    d('amount', 'Amount', 'How much?', I.severity, false, ['Under 5 kg', '5–10 kg', 'Over 10 kg', 'Over 5% in 6 months'],
      { key: 'associations', webKey: 'weight_amount' }),
    DURATION(['Under 1 month', '1–3 months',
      '3–6 months', 'Over 6 months']),
    d('intent', 'Intentional?', 'Trying to lose weight?', I.pattern, false, ['Unintentional', 'Intentional'],
      { key: 'associations', webKey: 'weight_intent' }),
    d('appetite', 'Appetite', 'Appetite?', I.pattern, false, ['Reduced appetite', 'Normal appetite', 'Increased appetite'],
      { key: 'associations', webKey: 'weight_appetite' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Night sweats', 'Fever', 'Dysphagia', 'Change in bowel habit', 'Abdominal pain', 'Cough', 'Polyuria / thirst',
      'Heat intolerance', 'Low mood', 'Fatigue',
    ], { webKey: 'weight_assoc' }),
  ],
  secondaryDims: ['amount', 'intent'],
};

const FATIGUE: HistoryFrame = {
  id: 'fatigue', type: 'fatigue', label: 'Fatigue', title: 'Fatigue history', sampleComplaint: 'Fatigue',
  iosPools: ['fatigue', 'anaemia', 'generalMedicine', 'sleepDisorders', 'coreConditions'],
  dimensions: [
    DURATION(['Under 2 weeks', 'Over 2 weeks', 'Over 6 months']),
    d('pattern', 'Pattern', 'What is it like?', I.pattern, true, [
      'Post-exertional malaise', 'Unrefreshing sleep', 'Worse in the morning', 'Daytime sleepiness',
    ], { key: 'associations', webKey: 'fatigue_pattern' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Pallor', 'Breathlessness', 'Weight loss', 'Weight gain', 'Cold intolerance', 'Polyuria', 'Low mood',
      'Witnessed apnoea', 'Night sweats', 'Heavy periods',
    ], { webKey: 'fatigue_assoc' }),
  ],
  secondaryDims: ['associations'],
};

const PALPITATIONS: HistoryFrame = {
  id: 'palpitations', type: 'palpitations', label: 'Palpitations', title: 'Palpitations history',
  sampleComplaint: 'Palpitations',
  iosPools: ['arrhythmia', 'chestPain', 'coreConditions'],
  dimensions: [
    d('onset', 'Onset and offset', 'How does it start and stop?', I.onset, false, [
      'Sudden onset and offset', 'Gradual',
    ], { webKey: 'palpitation_onset' }),
    d('rhythm', 'Rhythm', 'Regular or irregular?', I.character, false, [
      'Regular and fast', 'Irregular', 'Missed or extra beats',
    ], { key: 'associations', webKey: 'palpitation_rhythm' }),
    d('timing', 'Episode length', 'How long do episodes last?', I.timing, false, [
      'Seconds', 'Minutes', 'Hours', 'Continuous',
    ], { webKey: 'palpitation_duration' }),
    d('exacerbating', 'Triggers', 'What brings it on?', I.worse, true, [
      'Exertion', 'Caffeine or alcohol', 'Stress', 'Lying on the left side', 'No trigger',
    ], { webKey: 'palpitation_triggers' }),
    d('relieving', 'Termination', 'What stops it?', I.better, true, [
      'Vagal manoeuvre', 'Stops by itself', 'Nothing',
    ], { webKey: 'palpitation_relief' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Chest pain', 'Breathlessness', 'Dizziness', 'Syncope', 'Sweating', 'Anxiety', 'Heat intolerance',
    ], { webKey: 'palpitation_assoc' }),
  ],
  secondaryDims: ['rhythm'],
};

const SYNCOPE: HistoryFrame = {
  id: 'syncope', type: 'syncope', label: 'Collapse / syncope', title: 'Syncope history',
  sampleComplaint: 'Syncope',
  iosPools: ['syncope', 'dizzinessVertigo', 'arrhythmia', 'seizure', 'coreConditions'],
  dimensions: [
    d('setting', 'Setting', 'What was happening?', I.site, true, [
      'Prolonged standing', 'On exertion', 'Emotional trigger', 'On standing up', 'During micturition or defaecation',
      'Head turning or tight collar', 'Lying down', 'No trigger',
    ], { key: 'timing', webKey: 'syncope_setting' }),
    d('prodrome', 'Warning', 'Any warning?', I.onset, false, [
      'Prodrome — nausea sweating', 'No warning',
    ], { key: 'timing', webKey: 'syncope_prodrome' }),
    d('event', 'During the event', 'What did witnesses see?', I.assoc, true, [
      'Loss of consciousness', 'Jerking movements', 'Tongue bite', 'Incontinence', 'Pallor',
    ], { key: 'associations', webKey: 'syncope_event' }),
    d('recovery', 'Recovery', 'How quickly back to normal?', I.timing, false, [
      'Rapid full recovery', 'Prolonged confusion',
    ], { key: 'associations', webKey: 'syncope_recovery' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Palpitations before', 'Chest pain', 'Breathlessness', 'Headache',
    ], { webKey: 'syncope_assoc' }),
    d('risk', 'Risk factors', 'Heart disease, family history?', I.risk, true, [
      'Known heart disease', 'Family history of sudden death', 'Antihypertensives',
    ], { key: 'history', webKey: 'syncope_risk' }),
  ],
  secondaryDims: ['setting', 'prodrome'],
};

/** Default frame: onset, duration, course, severity, triggers, relievers, associated. */
const GENERAL: HistoryFrame = {
  id: 'general', type: 'general', label: 'General symptom', title: 'History of presenting complaint',
  sampleComplaint: 'Other',
  iosPools: ['*'],
  dimensions: [
    d('onset', 'Onset', 'When did it start?', I.onset, false, PAIN_ONSET),
    DURATION(GENERIC_DURATION),
    d('course', 'Course', 'Since onset?', I.pattern, false, ['Improving', 'Static', 'Progressive', 'Fluctuating'],
      { key: 'timing', webKey: 'course' }),
    d('severity', 'Severity', 'Effect on daily life?', I.severity, false, [
      'Mild', 'Moderate — limits activity', 'Severe — unable to work or sleep',
    ], { webKey: 'general_severity' }),
    d('triggers', 'Triggers', 'What makes it worse?', I.worse, true, [
      'Exertion', 'Eating', 'Stress', 'Movement', 'No trigger',
    ], { key: 'exacerbating', webKey: 'general_triggers' }),
    d('relieving', 'Relievers', 'What makes it better?', I.better, true, ['Rest', 'Analgesics', 'Nothing'],
      { webKey: 'general_relief' }),
    d('associations', 'Associated symptoms', 'Anything else?', I.assoc, true, [
      'Fever', 'Weight loss', 'Night sweats', 'Fatigue', 'Nausea', 'Pain',
    ], { webKey: 'general_assoc' }),
  ],
  secondaryDims: [],
};

/**
 * Chips that cannot both be true: selecting one clears the other in the same question ("*": every
 * other chip of the question).
 */
export const EXCLUDES: Record<string, string[]> = {
  'Nothing': ['*'], 'No radiation': ['*'], 'No skin change': ['*'], 'No trigger': ['*'],
  'Stops by itself': ['Nothing'],
  'Mobile': ['Fixed', 'Fixed to skin', 'Fixed to muscle'],
  'Tender': ['Non-tender', 'Painless'],
  'Pitting oedema': ['Non-pitting'],
  'Pigmented': ['Non-pigmented'],
  'Raised': ['Flat'],
  'Reducible': ['Irreducible', 'Recently irreducible'],
  'Reduces on lying down': ['Irreducible', 'Recently irreducible'],
  'Transilluminates': ['Does not transilluminate'],
  'Can get above it': ['Cannot get above it'],
};

function annotate(frames: HistoryFrame[]): HistoryFrame[] {
  return frames.map(f => ({
    ...f,
    dimensions: f.dimensions.map(dm => {
      const marks = RECORD_ONLY[`${f.id}/${dm.id}`] ?? {};
      return {
        ...dm,
        options: dm.options.map(op => {
          const recordOnly = (['ios', 'web'] as Platform[]).filter(p => marks[p]?.includes(op.label));
          const excludes = EXCLUDES[op.label];
          return {
            ...op,
            ...(recordOnly.length ? { recordOnly } : {}),
            ...(excludes ? { excludes } : {}),
          };
        }),
      };
    }),
  }));
}

export const HISTORY_FRAMES: HistoryFrame[] = annotate([
  ...PAIN_FRAMES, COUGH, DYSPNOEA, ...LUMP_FRAMES, LIMB_SWELLING, BREAST, ...BLEEDING_FRAMES, BOWEL, DYSPHAGIA,
  JAUNDICE, VOMITING, FEVER, URINARY, ...NEURO_FRAMES, ...SKIN_FRAMES, WEIGHT_LOSS, FATIGUE, PALPITATIONS, SYNCOPE,
  GENERAL,
]);
