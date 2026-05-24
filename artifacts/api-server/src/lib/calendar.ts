import { google, calendar_v3 } from 'googleapis';
import {
  SLOT_RULES, EXCLUSIONS, AppointmentType, Location,
  isPublicHoliday,
} from '@workspace/triage-engine';

const TZ = 'America/St_Lucia';

function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set');
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
    case 'castries':   return process.env.CALENDAR_ID_CASTRIES!;
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
    const dow = cursor.getDay();

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
    if (!ex.days?.includes(start.getDay())) continue;
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
  const locLabel = ({ rodney_bay: 'Rodney Bay', castries: 'Castries', tapion: 'Tapion Hospital', remote: 'Telephone' } as Record<string, string>)[slot.location];
  return {
    day: dayNames[slot.start.getDay()],
    date: `${slot.start.getDate()} ${monthNames[slot.start.getMonth()]} ${slot.start.getFullYear()}`,
    time: `${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`,
    location: locLabel,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
