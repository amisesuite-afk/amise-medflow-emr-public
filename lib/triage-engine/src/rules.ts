import { testAffirmed } from './negation';

export const RULES_VERSION = '1.4.0';

export type AppointmentType =
  | 'new_consult'
  | 'follow_up'
  | 'post_op'
  | 'ercp_workup'
  | 'ercp'
  | 'breast'
  | 'telephone'
  | 'diabetic_foot';

export type Location = 'rodney_bay' | 'tapion' | 'remote';

export interface SlotRule {
  durationMin: number;
  location: Location;
  days: number[];
  windowStart: string;
  windowEnd: string;
  bufferAfterMin: number;
  maxPerSession: number;
}

export const SLOT_RULES: Record<AppointmentType, SlotRule> = {
  new_consult: {
    durationMin: 45,
    location: 'rodney_bay',
    days: [1, 4, 5],
    windowStart: '10:00',
    windowEnd: '17:00',
    bufferAfterMin: 5,
    maxPerSession: 8,
  },
  follow_up: {
    durationMin: 15,
    location: 'rodney_bay',
    days: [2, 4],
    windowStart: '09:00',
    windowEnd: '12:00',
    bufferAfterMin: 5,
    maxPerSession: 12,
  },
  post_op: {
    durationMin: 20,
    location: 'tapion',
    days: [2, 4],
    windowStart: '09:00',
    windowEnd: '12:00',
    bufferAfterMin: 5,
    maxPerSession: 6,
  },
  ercp_workup: {
    // The ERCP procedure itself at Tapion Hospital, under general anaesthesia
    // (Dr Kabiye's decision) — not a consultation. Duration matches the `ercp`
    // procedure slot below. Days/window/max are unchanged from the old
    // consultation slot pending the surgeon's confirmation: a 90-min slot in
    // the Monday 14:00–16:00 window fits one booking per session.
    durationMin: 90,
    location: 'tapion',
    days: [1],
    windowStart: '14:00',
    windowEnd: '16:00',
    bufferAfterMin: 10,
    maxPerSession: 4,
  },
  ercp: {
    // Procedure at Tapion Hospital — booked manually, not via the AI intake
    durationMin: 90,
    location: 'tapion',
    days: [],
    windowStart: '08:00',
    windowEnd: '12:00',
    bufferAfterMin: 15,
    maxPerSession: 4,
  },
  breast: {
    durationMin: 45,
    location: 'rodney_bay',
    days: [3],
    windowStart: '14:00',
    windowEnd: '17:00',
    bufferAfterMin: 15,
    maxPerSession: 4,
  },
  telephone: {
    durationMin: 15,
    location: 'remote',
    days: [1, 2, 3, 4, 5],
    windowStart: '08:00',
    windowEnd: '16:00',
    bufferAfterMin: 5,
    maxPerSession: 8,
  },
  diabetic_foot: {
    durationMin: 30,
    location: 'rodney_bay',
    days: [1, 3, 5],
    windowStart: '10:00',
    windowEnd: '14:00',
    bufferAfterMin: 10,
    maxPerSession: 4,
  },
};

export interface Exclusion {
  description: string;
  days?: number[];
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

export const EXCLUSIONS: Exclusion[] = [
  { description: 'OR block — Tapion', days: [1, 3], startTime: '07:30', endTime: '12:00' },
  { description: 'MDT meeting & ward rounds', days: [5], startTime: '08:00', endTime: '12:00' },
  { description: 'Protected lunch', days: [1, 2, 3, 4, 5], startTime: '12:00', endTime: '13:30' },
  { description: 'Weekend — emergencies only', days: [0, 6], allDay: true },
];

export const PUBLIC_HOLIDAYS_SLU: string[] = [
  '2026-01-01',
  '2026-01-02',
  '2026-02-22',
  '2026-04-03',
  '2026-04-06',
  '2026-05-01',
  '2026-05-25',
  '2026-06-04',
  '2026-08-03',
  '2026-10-05',
  '2026-12-13',
  '2026-12-25',
  '2026-12-26',
];

export type Severity = 'urgent' | 'priority' | 'review';

export interface RedFlag {
  pattern: RegExp;
  reason: string;
  severity: Severity;
}

export const RED_FLAGS: RedFlag[] = [
  { pattern: /\b(bleed(ing)?|haematemesis|hematemesis|melaena|melena|rectal bleed|pr bleed|coughing up blood|vomiting blood)\b/i,
    reason: 'GI or other bleeding', severity: 'urgent' },
  { pattern: /\b(severe (abdominal |belly |stomach )?pain|acute abdomen|peritonitis|can'?t move|writhing)\b/i,
    reason: 'Acute abdominal pain', severity: 'urgent' },
  { pattern: /\b(jaundice|yellow(ing)? (of )?(eyes|skin)|dark urine|pale stool|clay(-| )?colou?red stool)\b/i,
    reason: 'Possible biliary obstruction', severity: 'urgent' },
  // "breathless" / "shortness of breath" are no longer a post-operative concern in every context:
  // adaptiveTriage grades breathlessness by physiology (SpO₂, RR, NEWS2) — v1.3.0.
  { pattern: /\b(after (my |the )?(surgery|operation|procedure)|post[- ]?op|wound (discharge|infected|opened|leaking|red|pus)|fever (after|since))\b/i,
    reason: 'Post-operative concern', severity: 'urgent' },
  // "cancer" in a relative's history or a screening request ("Father had stomach cancer",
  // "bowel cancer screening") is not a possible malignancy in this patient — v1.3.0.
  { pattern: /\b(new lump|growing lump|breast lump|weight loss|losing weight|night sweats|(?<!\b(?:father|mother|sister|brother|parent|parents|relative|relatives|family|aunt|uncle|grandmother|grandfather|cousin|friend|friends|daughter|son)\b[^.;\n]{0,40})cancer(?!\s+(screening|risk|check)))\b/i,
    reason: 'Possible malignancy', severity: 'priority' },
  { pattern: /\b(pregnant|pregnancy|expecting)\b/i,
    reason: 'Pregnancy mentioned — clinical review required', severity: 'review' },
  { pattern: /\b(suicid(e|al)|kill myself|self[- ]?harm|end (it|my life)|can'?t go on)\b/i,
    reason: 'Mental health crisis', severity: 'urgent' },
  { pattern: /\b(dosage|dose of|increase my (med|dose)|what (medication|tablet|pill)|my results|biopsy result|test result)\b/i,
    reason: 'Clinical query — defer to doctor', severity: 'review' },
  // Narrowed (SURGEON-DECISIONS E2, v1.3.0): chest pain radiating to the arm, jaw or neck, or
  // crushing / pressure-type chest pain. "radiating to" and "left arm" alone no longer count
  // (biliary pain "radiating to the back"; "lipoma left arm"). Other chest pain is a priority
  // flag below; the emergency layer (emergency-recognition.ts) adds ACS from ECG, troponin and
  // anginal equivalents (ESC 2023).
  { pattern: /\b(chest (pain|pressure|tightness|heaviness|discomfort)\b[^.;\n]{0,60}\b(radiat\w*|spread\w*|going|goes|shoot\w*)\b[^.;\n]{0,25}\b(arm|arms|jaw|neck)|crushing (central )?(chest )?pain|central crushing|chest (pressure|heaviness))\b/i,
    reason: 'Possible cardiac event', severity: 'urgent' },
  { pattern: /\b(chest pain|chest tightness|chest discomfort)\b/i,
    reason: 'Chest pain — 12-lead ECG to exclude a cardiac cause', severity: 'priority' },
  { pattern: /\b(fever|chills|rigors|confusion|collapse|fainting|syncope)\b/i,
    reason: 'Systemic red flag symptom', severity: 'priority' },
  { pattern: /\b(unable to pass stool|unable to pass gas|obstructed|strangulated|irreducible hernia|vomiting repeatedly)\b/i,
    reason: 'Possible obstruction or complicated hernia', severity: 'urgent' },
  // NICE NG19 (2015, updated 2019): a limb-threatening diabetic foot problem (gangrene, infection,
  // osteomyelitis, exposed bone) needs immediate referral; any other active foot problem (an ulcer
  // or wound) needs the foot protection / MDT service within 1 working day. "Spreading redness"
  // alone is cellulitis, not a diabetic-foot emergency (the emergency layer recognises NSTI and
  // sepsis) — v1.4.0.
  { pattern: /\b(gangrene|foot infection|infected (diabetic )?foot|osteomyelitis|exposed bone)\b/i,
    reason: 'Diabetic foot emergency', severity: 'urgent' },
  { pattern: /\b(diabetic foot|foot ulcer|foot wound)\b/i,
    reason: 'Diabetic foot problem — foot protection / MDT review within 1 working day (NICE NG19)', severity: 'priority' },
  { pattern: /\b(dysphagia|trouble swallowing|can'?t swallow|food sticking)\b/i,
    reason: 'Dysphagia — red flag symptom', severity: 'priority' },
  { pattern: /\b(haemoptysis|coughing blood|blood in sputum)\b/i,
    reason: 'Haemoptysis', severity: 'urgent' },
  // "No change in bowel habit" is a pertinent negative ("no change" is otherwise a pseudo-negation).
  { pattern: /\b((?<!\bno )change in bowel habit|rectal mass|blood in stool|mucus in stool)\b/i,
    reason: 'Lower GI red flag', severity: 'priority' },
];

export const FORBIDDEN_PATTERNS: RegExp[] = [
  // Fees / financial
  /\$\s*\d/,
  /\b(EC\$|XCD|USD)\s*\d/i,
  /\bfee[s]?\b.*\d/i,
  // Drug doses
  /\b(take|increase|decrease|stop)\s+\d+\s*mg\b/i,
  /\b\d+\s*mg\b/i,
  /\bmedication dose\b/i,
  // Diagnoses and result disclosure
  /\bdiagnos/i,
  /\b(your (biopsy|histology|test|blood|scan|x.ray) result|the result (is|shows|confirms))\b/i,
  /\b(you (have|may have|likely have) (cancer|tumou?r|malignancy))\b/i,
  /\b(i diagnose|i can confirm you have)\b/i,
  // Procedure-prep adjustments: never let a draft specify anticoagulant/diabetes
  // medication stop-timing, dose changes, or bowel-prep product substitutions —
  // those are clinical decisions for Dr Kabiye, not the assistant.
  /\b(stop|hold|discontinue|restart|resume)\b[^.]{0,40}\b(warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|lixiana|clopidogrel|plavix|ticagrelor|aspirin|heparin|enoxaparin|lovenox|insulin|metformin|gliclazide)\b/i,
  /\b(switch|change)\b[^.]{0,30}\b(insulin|dose|medication|prep)\b[^.]{0,20}\bto\b/i,
  /\b(use|take|switch to)\b[^.]{0,20}\b(golytely|moviprep|miralax|picolax|citromag|fleet|dulcolax|peglyte|pico.?salax)\b/i,
];

export interface PathwayPanel {
  id: string;
  title: string;
  severity: Severity;
  checklist: string[];
  contacts: string[];
  doctorNotes?: string;
}

export const PATHWAY_DEFINITIONS: Array<{
  id: string;
  title: string;
  severity: Severity;
  trigger: RegExp;
  compositeCheck?: (vitals: { sbp: number | null; hr: number | null; temp: number | null; spo2: number | null }) => boolean;
  checklist: string[];
  contacts: string[];
  doctorNotes?: string;
}> = [
  {
    id: 'cholangitis',
    title: 'Possible Cholangitis / Obstructive Jaundice',
    severity: 'urgent',
    trigger: /(jaundice|yellow eyes|yellow skin|dark urine|pale stool|cholangitis|biliary)/i,
    checklist: [
      "Charcot's triad: fever + jaundice + RUQ pain?",
      "Reynolds' pentad: + hypotension + confusion?",
      'LFTs, bilirubin, FBC, CRP, blood cultures stat',
      'Abdominal ultrasound',
      'NPO and IV access',
      'Contact biliary surgery / gastroenterology on-call',
    ],
    contacts: ['Tapion Hospital: 758-284-0557 / 758-720-7111', 'Dr Kabiye on-call'],
    doctorNotes: "If Reynolds' pentad: urgent ERCP vs PTC vs emergency surgery. Start IV antibiotics (piperacillin-tazobactam or meropenem + metronidazole).",
  },
  {
    id: 'gi_bleed',
    title: 'GI Bleed Pathway',
    severity: 'urgent',
    trigger: /(haematemesis|hematemesis|melaena|melena|rectal bleed|blood in stool|vomiting blood|black stool)/i,
    compositeCheck: (v) => v.sbp !== null && v.sbp < 100,
    checklist: [
      'Haemodynamic stability — BP, HR, SpO2',
      'Large-bore IV access x2, cross-match blood',
      'FBC, coagulation, LFTs, U+E stat',
      'Is patient on anticoagulants? (warfarin, NOAC)',
      'Previous PUD / varices / NSAID use?',
      'Call gastroenterology / surgery on-call',
      'Resuscitation — fluid / blood products',
    ],
    contacts: ['Tapion office (urgent): 758-284-0557'],
    doctorNotes: 'Blatchford score for risk stratification. Upper GI: IV PPI. Varices: terlipressin + antibiotics. Urgent endoscopy if haemodynamically unstable.',
  },
  {
    id: 'acute_abdomen',
    title: 'Acute Abdomen Pathway',
    severity: 'urgent',
    trigger: /(acute abdomen|peritonitis|severe abdominal pain|guarding|rigidity|board.?like)/i,
    checklist: [
      'Assess: guarding, rigidity, rebound tenderness',
      'Bowel sounds present?',
      'Erect CXR — free air under diaphragm?',
      'FBC, CRP, lipase, LFTs, lactate stat',
      'NPO, IV access, analgesia',
      'Surgical review urgently',
    ],
    contacts: ['Tapion Hospital: 758-284-0557 / 758-720-7111'],
    doctorNotes: 'Differential: perforation, ischaemia, obstruction, appendicitis, pancreatitis. CT abdomen/pelvis if stable and diagnosis unclear.',
  },
  {
    id: 'breast_lump',
    title: 'Breast Lump Pathway',
    severity: 'priority',
    trigger: /(breast lump|breast mass|new lump|nipple discharge|bloody nipple|skin tethering|nipple inversion)/i,
    checklist: [
      'Triple assessment: clinical exam + imaging + biopsy',
      'Mammogram + USS (age ≥ 40)',
      'USS alone (age < 40)',
      'Needle biopsy / FNA if indicated',
      'Family history of breast or ovarian cancer?',
      'Refer to breast clinic',
    ],
    contacts: ['Dr Kabiye breast clinic — Rodney Bay Wed PM'],
    doctorNotes: 'Urgent referral if: hard/fixed, skin change, nipple inversion, axillary nodes, bloody discharge, or age > 60.',
  },
  {
    id: 'diabetic_foot',
    title: 'Diabetic Foot Pathway',
    severity: 'urgent',
    trigger: /(diabetic foot|foot ulcer|foot wound|gangrene|foot infection|exposed bone|spreading redness)/i,
    checklist: [
      'Wagner grade wound classification (0-5)',
      'Peripheral pulses: DP + PT (manual + Doppler)',
      'Check sensation: monofilament / vibration',
      'Wound swab for culture',
      'FBC, CRP, HbA1c, glucose, wound X-ray',
      'Fever + spreading cellulitis → urgent surgery referral',
      'IV antibiotics if systemically unwell',
    ],
    contacts: ['Tapion office: 758-284-0557', 'Dr Kabiye surgical on-call'],
    doctorNotes: 'Wagner 3+: admit, IV antibiotics, vascular assessment, likely surgical debridement. PEDIS classification for research documentation.',
  },
  {
    id: 'chest_pain',
    title: 'Chest Pain Pathway',
    severity: 'urgent',
    // v1.3.0: "left arm", "jaw pain" and "cardiac" alone no longer open the chest pain pathway.
    trigger: /\b(chest pain|chest pressure|chest tightness|crushing (chest )?pain|tearing (chest |back )pain)\b/i,
    checklist: [
      'ECG within 10 minutes',
      'High-sensitivity troponin: ESC 2023 0 h/1 h (or 0 h/2 h) algorithm',
      'SpO2, BP both arms, IV access',
      'Aspirin loading dose 150–300 mg (ESC 2023) if ACS suspected and no contraindication — clinician decision',
      'POCUS if available',
      'Call cardiology / emergency services immediately if STEMI',
    ],
    contacts: ['Emergency services: 911', "Nearest emergency department: OKEU Hospital (Castries), St Jude's Hospital (Vieux Fort) or Tapion Hospital"],
    doctorNotes: 'HEART score for risk. STEMI → cath lab / thrombolysis. NSTEMI → dual antiplatelet, anticoagulation, early invasive strategy. Aortic dissection: CT angiography urgently.',
  },
];

export interface ReminderRule {
  kind: 'sms_48h' | 'email_24h' | 'sms_2h' | 'post_visit_24h';
  offsetMinutes: number;
  channel: 'sms' | 'email';
}

export const REMINDER_CASCADE: ReminderRule[] = [
  { kind: 'sms_48h',       offsetMinutes: -48 * 60, channel: 'sms' },
  { kind: 'email_24h',     offsetMinutes: -24 * 60, channel: 'email' },
  { kind: 'sms_2h',        offsetMinutes: -2 * 60,  channel: 'sms' },
  { kind: 'post_visit_24h', offsetMinutes: 24 * 60, channel: 'email' },
];

export function isPublicHoliday(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  return PUBLIC_HOLIDAYS_SLU.includes(iso);
}

/**
 * Red flags in free text. Negated mentions ("no bleeding", "denies chest pain", "no weight loss")
 * do not count — see negation.ts for the rule; uncertain negation keeps the flag.
 */
export function scanRedFlags(text: string): { flagged: boolean; matches: RedFlag[] } {
  const matches = RED_FLAGS.filter(rf => testAffirmed(rf.pattern, text));
  return { flagged: matches.length > 0, matches };
}

export function checkForbiddenContent(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(text)) violations.push(pat.toString());
  }
  return { safe: violations.length === 0, violations };
}
