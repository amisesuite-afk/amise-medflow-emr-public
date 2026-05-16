export const RULES_VERSION = '1.1.0';

export type AppointmentType =
  | 'new_consult'
  | 'follow_up'
  | 'post_op'
  | 'ercp_workup'
  | 'ercp'
  | 'breast'
  | 'telephone';

export type Location = 'rodney_bay' | 'castries' | 'tapion' | 'remote';

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
    location: 'castries',
    days: [2, 4],
    windowStart: '09:00',
    windowEnd: '12:00',
    bufferAfterMin: 5,
    maxPerSession: 12,
  },
  post_op: {
    durationMin: 20,
    location: 'castries',
    days: [2, 4],
    windowStart: '09:00',
    windowEnd: '12:00',
    bufferAfterMin: 5,
    maxPerSession: 6,
  },
  ercp_workup: {
    durationMin: 30,
    location: 'rodney_bay',
    days: [1],
    windowStart: '14:00',
    windowEnd: '16:00',
    bufferAfterMin: 10,
    maxPerSession: 4,
  },
  ercp: {
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
    durationMin: 10,
    location: 'remote',
    days: [5],
    windowStart: '15:00',
    windowEnd: '16:30',
    bufferAfterMin: 0,
    maxPerSession: 8,
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
  { pattern: /\b(after (my |the )?(surgery|operation|procedure)|post[- ]?op|wound (discharge|infected|opened|leaking|red|pus)|fever (after|since)|breathless|shortness of breath)\b/i,
    reason: 'Post-operative concern', severity: 'urgent' },
  { pattern: /\b(new lump|growing lump|breast lump|weight loss|losing weight|night sweats|cancer)\b/i,
    reason: 'Possible malignancy', severity: 'priority' },
  { pattern: /\b(pregnant|pregnancy|expecting)\b/i,
    reason: 'Pregnancy mentioned — clinical review required', severity: 'review' },
  { pattern: /\b(suicid(e|al)|kill myself|self[- ]?harm|end (it|my life)|can'?t go on)\b/i,
    reason: 'Mental health crisis', severity: 'urgent' },
  { pattern: /\b(dosage|dose of|increase my (med|dose)|what (medication|tablet|pill)|my results|biopsy result|test result)\b/i,
    reason: 'Clinical query — defer to doctor', severity: 'review' },
  { pattern: /\b(chest pain|crushing pain|radiating to|left arm|jaw pain)\b/i,
    reason: 'Possible cardiac event', severity: 'urgent' },
  { pattern: /\b(fever|chills|rigors|confusion|collapse|fainting|syncope)\b/i,
    reason: 'Systemic red flag symptom', severity: 'priority' },
  { pattern: /\b(unable to pass stool|unable to pass gas|obstructed|strangulated|irreducible hernia|vomiting repeatedly)\b/i,
    reason: 'Possible obstruction or complicated hernia', severity: 'urgent' },
];

export const FORBIDDEN_PATTERNS: RegExp[] = [
  /\$\s*\d/,
  /\b(EC\$|XCD|USD)\s*\d/i,
  /\b(take|increase|decrease|stop)\s+\d+\s*mg\b/i,
  /\b(your (biopsy|histology|test|blood) result|the result (is|shows))\b/i,
  /\b(you (have|may have|likely have) (cancer|tumou?r|malignancy))\b/i,
  /\b(i diagnose|i can confirm you have)\b/i,
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

export function scanRedFlags(text: string): { flagged: boolean; matches: RedFlag[] } {
  const matches = RED_FLAGS.filter(rf => rf.pattern.test(text));
  return { flagged: matches.length > 0, matches };
}

export function checkForbiddenContent(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(text)) violations.push(pat.toString());
  }
  return { safe: violations.length === 0, violations };
}
