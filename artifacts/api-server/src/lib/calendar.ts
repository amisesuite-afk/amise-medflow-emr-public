import { google, calendar_v3 } from 'googleapis';
import {
  SLOT_RULES, EXCLUSIONS, AppointmentType, Location,
  isPublicHoliday,
} from '@workspace/triage-engine';

const TZ = 'America/St_Lucia';
const ECT_OFFSET_MS = -4 * 60 * 60_000; // UTC-4, no DST

function getDayECT(d: Date): number {
  return new Date(d.getTime() + ECT_OFFSET_MS).getDay();
}

function getAuth() {
  // OAuth2 path — personal account (amisesuite@gmail.com), no service account needed
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob'
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return client;
  }
  // Service account fallback
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      'No Google credentials. Set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON.'
    );
  }
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    subject: process.env.GMAIL_USER,
  });
}

function getCalendar() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

export function calendarIdFor(location: Location): string {
  switch (location) {
    case 'rodney_bay': return process.env.CALENDAR_ID_RODNEY_BAY!;
    case 'tapion':     return process.env.CALENDAR_ID_TAPION_ERCP!;
    case 'remote':     return process.env.CALENDAR_ID_RODNEY_BAY!;
    default:           return process.env.CALENDAR_ID_RODNEY_BAY!;
  }
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  location: Location;
  appointmentType: AppointmentType;
}

export async function findSlots(
  appointmentType: AppointmentType,
  options: { lookaheadDays?: number; max?: number; fromDate?: Date } = {}
): Promise<AvailableSlot[]> {
  const rule = SLOT_RULES[appointmentType];
  const lookaheadDays = options.lookaheadDays ?? 21;
  const max = options.max ?? 3;
  const fromDate = options.fromDate ?? new Date();

  const calId = calendarIdFor(rule.location);
  const cal = getCalendar();

  const timeMin = fromDate.toISOString();
  const timeMax = new Date(fromDate.getTime() + lookaheadDays * 86400_000).toISOString();

  const { data } = await cal.events.list({
    calendarId: calId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  });

  const busy: { start: Date; end: Date }[] = (data.items || [])
    .filter(e => e.status !== 'cancelled')
    .map(e => {
      const startValue = e.start?.dateTime ?? e.start?.date;
      const endValue = e.end?.dateTime ?? e.end?.date;
      if (!startValue || !endValue) return null;
      return { start: new Date(startValue), end: new Date(endValue) };
    })
    .filter((event): event is { start: Date; end: Date } => event !== null);

  const slots: AvailableSlot[] = [];
  const cursor = new Date(fromDate);
  cursor.setSeconds(0, 0);

  while (slots.length < max && cursor.getTime() < new Date(timeMax).getTime()) {
    const dow = getDayECT(cursor);

    if (rule.days.includes(dow) && !isPublicHoliday(cursor)) {
      const dayStart = setTime(cursor, rule.windowStart);
      const dayEnd   = setTime(cursor, rule.windowEnd);
      const stepMin = rule.durationMin + rule.bufferAfterMin;
      let t = new Date(dayStart);

      while (t.getTime() + rule.durationMin * 60_000 <= dayEnd.getTime()) {
        const slotEnd = new Date(t.getTime() + rule.durationMin * 60_000);
        if (!overlapsBusy(t, slotEnd, busy) && !overlapsExclusion(t, slotEnd) && t.getTime() > fromDate.getTime()) {
          slots.push({ start: new Date(t), end: slotEnd, location: rule.location, appointmentType });
          if (slots.length >= max) break;
        }
        t = new Date(t.getTime() + stepMin * 60_000);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}

function setTime(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function overlapsBusy(start: Date, end: Date, busy: { start: Date; end: Date }[]): boolean {
  return busy.some(b => start < b.end && end > b.start);
}

function overlapsExclusion(start: Date, end: Date): boolean {
  for (const ex of EXCLUSIONS) {
    if (!ex.days?.includes(getDayECT(start))) continue;
    if (ex.allDay) return true;
    if (!ex.startTime || !ex.endTime) continue;
    const exStart = setTime(start, ex.startTime);
    const exEnd = setTime(start, ex.endTime);
    if (start < exEnd && end > exStart) return true;
  }
  return false;
}

export interface CreateEventArgs {
  appointmentType: AppointmentType;
  location: Location;
  start: Date;
  end: Date;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  reason?: string;
}

export async function createEvent(args: CreateEventArgs): Promise<{ eventId: string; calendarId: string }> {
  const calId = calendarIdFor(args.location);
  const cal = getCalendar();

  const event: calendar_v3.Schema$Event = {
    summary: `${args.patientName} — ${labelFor(args.appointmentType)}`,
    description:
      `Patient: ${args.patientName}\n` +
      `Email: ${args.patientEmail}\n` +
      (args.patientPhone ? `Phone: ${args.patientPhone}\n` : '') +
      (args.reason ? `Reason: ${args.reason}\n` : '') +
      `\nBooked by Amise Front Desk AI.`,
    start: { dateTime: args.start.toISOString(), timeZone: TZ },
    end:   { dateTime: args.end.toISOString(),   timeZone: TZ },
    attendees: [{ email: args.patientEmail, displayName: args.patientName }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const { data } = await cal.events.insert({
    calendarId: calId,
    requestBody: event,
    sendUpdates: 'all',
  });

  return { eventId: data.id!, calendarId: calId };
}

function labelFor(t: AppointmentType): string {
  return ({
    new_consult:   'New consultation',
    follow_up:     'Follow-up',
    post_op:       'Post-op review',
    ercp_workup:   'ERCP work-up',
    ercp:          'ERCP procedure',
    breast:        'Breast clinic',
    telephone:     'Telephone review',
    diabetic_foot: 'Diabetic foot clinic',
  } as Record<AppointmentType, string>)[t];
}

export function formatSlotForDisplay(slot: AvailableSlot): { day: string; date: string; time: string; location: string } {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const locLabel = ({ rodney_bay: 'Rodney Bay', tapion: 'Tapion Hospital', remote: 'Telephone' } as Record<string, string>)[slot.location];
  const ect = new Date(slot.start.getTime() + ECT_OFFSET_MS);
  return {
    day: dayNames[ect.getDay()],
    date: `${ect.getDate()} ${monthNames[ect.getMonth()]} ${ect.getFullYear()}`,
    time: `${pad(ect.getHours())}:${pad(ect.getMinutes())}`,
    location: locLabel,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;   // ISO string
  end: string;     // ISO string
  type: 'clinic' | 'theatre' | 'endoscopy' | 'break' | 'other';
}

export async function fetchUpcomingEvents(daysAhead = 30): Promise<CalendarEvent[]> {
  const cal = getCalendar();
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 86400_000).toISOString();

  const calIds = [
    process.env.CALENDAR_ID_RODNEY_BAY,
    process.env.CALENDAR_ID_TAPION_ERCP,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const events: CalendarEvent[] = [];

  for (const calId of calIds) {
    const { data } = await cal.events.list({
      calendarId: calId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });
    for (const e of data.items ?? []) {
      if (!e.id || seen.has(e.id) || e.status === 'cancelled') continue;
      seen.add(e.id);
      const startVal = e.start?.dateTime ?? e.start?.date ?? '';
      const endVal   = e.end?.dateTime   ?? e.end?.date   ?? '';
      const summary  = e.summary ?? '(No title)';
      events.push({
        id: e.id,
        summary,
        start: startVal,
        end:   endVal,
        type:  classifyEvent(summary),
      });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

// ── Theatre list helpers ──────────────────────────────────────────────────────

export interface CalendarEventFull extends CalendarEvent {
  calendarId: string;
}

/** Fetch ALL non-cancelled, non-break events from all three calendars for a given ECT date (YYYY-MM-DD).
 *  Used by the daily summary to surface every appointment — clinic, theatre, and endoscopy. */
export async function fetchAllEventsForDate(dateStr: string): Promise<CalendarEventFull[]> {
  const [y, m, d] = dateStr.split('-').map(Number);
  const timeMin = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).toISOString();   // midnight ECT = 04:00 UTC
  const timeMax = new Date(Date.UTC(y, m - 1, d + 1, 4, 0, 0)).toISOString();

  const cal = getCalendar();
  const calIds = [
    process.env.CALENDAR_ID_RODNEY_BAY,
    process.env.CALENDAR_ID_CASTRIES,
    process.env.CALENDAR_ID_TAPION_ERCP,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const events: CalendarEventFull[] = [];

  for (const calId of calIds) {
    let data;
    try {
      ({ data } = await cal.events.list({
        calendarId: calId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      }));
    } catch {
      continue; // skip unavailable calendars gracefully
    }
    for (const e of data.items ?? []) {
      if (!e.id || seen.has(e.id) || e.status === 'cancelled') continue;
      seen.add(e.id);
      const summary  = e.summary ?? '(No title)';
      const type     = classifyEvent(summary);
      if (type === 'break') continue;
      const startVal = e.start?.dateTime ?? e.start?.date ?? '';
      const endVal   = e.end?.dateTime   ?? e.end?.date   ?? '';
      events.push({ id: e.id, summary, start: startVal, end: endVal, type, calendarId: calId });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

/** Fetch only theatre/endoscopy events for a specific ECT date (YYYY-MM-DD). */
export async function fetchEventsForDate(dateStr: string): Promise<CalendarEventFull[]> {
  const [y, m, d] = dateStr.split('-').map(Number);
  // ECT is UTC-4; midnight ECT = 04:00 UTC
  const timeMin = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(y, m - 1, d + 1, 4, 0, 0)).toISOString();

  const cal = getCalendar();
  const calIds = [
    process.env.CALENDAR_ID_RODNEY_BAY,
    process.env.CALENDAR_ID_TAPION_ERCP,
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const events: CalendarEventFull[] = [];

  for (const calId of calIds) {
    const { data } = await cal.events.list({
      calendarId: calId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });
    for (const e of data.items ?? []) {
      if (!e.id || seen.has(e.id) || e.status === 'cancelled') continue;
      seen.add(e.id);
      const startVal = e.start?.dateTime ?? e.start?.date ?? '';
      const endVal   = e.end?.dateTime   ?? e.end?.date   ?? '';
      const summary  = e.summary ?? '(No title)';
      const type = classifyEvent(summary);
      if (type !== 'theatre' && type !== 'endoscopy') continue;
      events.push({ id: e.id, summary, start: startVal, end: endVal, type, calendarId: calId });
    }
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

/** Patch the description of an existing Google Calendar event. */
export async function updateEventDescription(
  calendarId: string,
  eventId: string,
  description: string,
): Promise<void> {
  const cal = getCalendar();
  await cal.events.patch({ calendarId, eventId, requestBody: { description } });
}

export interface TheatreCaseSummary {
  patientName: string; procedure: string; durationMin: number;
  position?: string | null; anaesthetic?: string | null;
  equipment?: string[] | null; antibiotics?: string | null; notes?: string | null;
}

/** Build a plain-text operating list for embedding in the Google Calendar event description. */
export function formatOperatingListDescription(
  cases: TheatreCaseSummary[],
  sessionStartHHMM: string,
  location: string,
  date: string,
): string {
  if (cases.length === 0) return 'Operating list published — no cases added yet.';

  const lines: string[] = [
    `AMISE MEDICAL SERVICES — OPERATING LIST`,
    `${date}  ·  ${location}`,
    `Surgeon: Mr Dawit Daniel Kabiye MD DM`,
    '',
  ];

  let curMin = (() => {
    const [h, m] = sessionStartHHMM.split(':').map(Number);
    return h * 60 + (m ?? 0);
  })();

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const endMin = curMin + c.durationMin;
    const fmt = (n: number) =>
      `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    lines.push(`Case ${i + 1}  ${fmt(curMin)}–${fmt(endMin)} (${c.durationMin} min)`);
    lines.push(`  Patient:   ${c.patientName}`);
    lines.push(`  Procedure: ${c.procedure}`);
    if (c.position)   lines.push(`  Position:  ${c.position}`);
    if (c.anaesthetic) lines.push(`  Anaesth:   ${c.anaesthetic}`);
    if (c.equipment?.length) lines.push(`  Equipment: ${c.equipment.join(', ')}`);
    const abx = c.antibiotics;
    if (abx && abx !== 'None' && abx !== 'None routine')
      lines.push(`  Prophy:    ${abx}`);
    if (c.notes) lines.push(`  Notes:     ${c.notes}`);
    lines.push('');
    curMin = endMin + 15; // 15-min turnover
  }

  lines.push(`${cases.length} case${cases.length !== 1 ? 's' : ''}`);
  lines.push(`Published ${new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia' })}`);
  return lines.join('\n');
}

function classifyEvent(summary: string): CalendarEvent['type'] {
  const s = summary.toLowerCase();
  if (/theatre|\bhernia repair\b|\bla theatre\b|rectal.*excision|excision.*ga|excision.*la|laparotomy|cholecystectomy|appendicectomy|colostomy/.test(s)) return 'theatre';
  if (/endoscop|colonoscop|ercp|gastroscop|deep sedation/.test(s)) return 'endoscopy';
  if (/^\s*lunch(\s|$)|^\s*break\s*$/.test(s.trim())) return 'break';
  return 'clinic';
}
