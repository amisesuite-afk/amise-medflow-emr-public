import { google, type calendar_v3 } from 'googleapis';
import { isPublicHoliday, SLOT_RULES } from '@workspace/triage-engine';

const TZ = 'America/St_Lucia';
const ECT_OFFSET_MS = -4 * 60 * 60_000; // UTC-4, no DST

// Return the day-of-week (0=Sun…6=Sat) in Eastern Caribbean Time, not the
// server's local timezone (Render runs UTC; getDay() there would be wrong).
function getDayECT(d: Date): number {
  return new Date(d.getTime() + ECT_OFFSET_MS).getDay();
}

export const LOCATION_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay (Providence Building)',
  tapion:     'Tapion (Dr Kabiye\'s Office)',
  remote:     'Telephone consultation',
};

function calendarIdFor(location: string): string {
  switch (location) {
    case 'rodney_bay': return process.env.CALENDAR_ID_RODNEY_BAY ?? '';
    case 'tapion':     return process.env.CALENDAR_ID_TAPION_ERCP ?? '';
    default:           return process.env.CALENDAR_ID_RODNEY_BAY ?? '';
  }
}

function getAuth() {
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }
  return null;
}

export interface FoundSlot {
  start: Date;
  end: Date;
  location: string;
  appointmentType: string;
  display: string;
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

function formatSlot(slot: { start: Date; location: string }): string {
  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthNames= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const { start } = slot;
  const hh = start.getHours().toString().padStart(2,'0');
  const mm = start.getMinutes().toString().padStart(2,'0');
  const loc = LOCATION_LABELS[slot.location] ?? slot.location;
  return `${dayNames[start.getDay()]} ${start.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()} at ${hh}:${mm} — ${loc}`;
}

export async function findSlotsInWindow(
  appointmentType: string,
  lookaheadDays: number,
  max = 3,
): Promise<FoundSlot[]> {
  return findSlots(appointmentType, max, lookaheadDays);
}

export async function findSlots(appointmentType: string, max = 3, lookaheadDays = 21): Promise<FoundSlot[]> {
  const auth = getAuth();
  if (!auth) return [];

  const rule = (SLOT_RULES as Record<string, typeof SLOT_RULES[keyof typeof SLOT_RULES]>)[appointmentType] ?? SLOT_RULES['new_consult'];
  const calId = calendarIdFor(rule.location);
  if (!calId) return [];

  const cal = google.calendar({ version: 'v3', auth });
  const fromDate = new Date();
  const lookaheadMs = lookaheadDays * 86400_000;
  const timeMax = new Date(fromDate.getTime() + lookaheadMs).toISOString();

  let busyEvents: { start: Date; end: Date }[] = [];
  try {
    const { data } = await cal.events.list({
      calendarId: calId,
      timeMin: fromDate.toISOString(),
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });
    busyEvents = (data.items ?? [])
      .filter(e => e.status !== 'cancelled')
      .flatMap(e => {
        const s  = e.start?.dateTime ?? e.start?.date;
        const en = e.end?.dateTime   ?? e.end?.date;
        if (!s || !en) return [];
        return [{ start: new Date(s), end: new Date(en) }];
      });
  } catch {
    // Calendar unavailable — return empty rather than blocking intake
    return [];
  }

  const slots: FoundSlot[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  const windowEnd = fromDate.getTime() + lookaheadMs;
  while (slots.length < max && cursor.getTime() < windowEnd) {
    if (rule.days.includes(getDayECT(cursor)) && !isPublicHoliday(cursor)) {
      const dayStart  = setTime(cursor, rule.windowStart);
      const dayEnd    = setTime(cursor, rule.windowEnd);
      const stepMin   = rule.durationMin + rule.bufferAfterMin;
      let t = new Date(dayStart);

      while (t.getTime() + rule.durationMin * 60_000 <= dayEnd.getTime()) {
        const slotEnd = new Date(t.getTime() + rule.durationMin * 60_000);
        if (t.getTime() > fromDate.getTime() && !overlapsBusy(t, slotEnd, busyEvents)) {
          const raw = { start: new Date(t), location: rule.location };
          slots.push({
            start:           new Date(t),
            end:             slotEnd,
            location:        rule.location,
            appointmentType,
            display:         formatSlot(raw),
          });
          if (slots.length >= max) break;
        }
        t = new Date(t.getTime() + stepMin * 60_000);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

/**
 * For URGENT patients: try normal slots in a 48-hour window first.
 * If none exist (schedule is full or no clinic day falls in that window),
 * create a squeeze slot at the end of the next clinic day rather than
 * leaving the patient without an option. Staff must still approve.
 */
export async function findUrgentSlot(appointmentType: string): Promise<FoundSlot | null> {
  // 1. Try any normal slot in next 48 h
  const quick = await findSlots(appointmentType, 1, 2);
  if (quick.length > 0) return quick[0];

  // 2. Squeeze: find next clinic day for this appointment type and
  //    add a slot after the last event on that day.
  const auth = getAuth();
  if (!auth) return null;

  const rule   = (SLOT_RULES as Record<string, typeof SLOT_RULES[keyof typeof SLOT_RULES]>)[appointmentType] ?? SLOT_RULES['new_consult'];
  const calId  = calendarIdFor(rule.location);
  if (!calId) return null;

  const cal      = google.calendar({ version: 'v3', auth });
  const fromDate = new Date();
  const cursor   = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  // Walk forward up to 14 days to find the next valid clinic day
  for (let d = 0; d < 14; d++) {
    if (rule.days.includes(getDayECT(cursor))) {
      const dayStart = setTime(cursor, rule.windowStart);
      const dayEnd   = setTime(cursor, rule.windowEnd);

      // Fetch events on this day
      let lastEnd = dayEnd;
      try {
        const { data } = await cal.events.list({
          calendarId: calId,
          timeMin:    dayStart.toISOString(),
          timeMax:    new Date(dayEnd.getTime() + 3 * 3600_000).toISOString(), // +3 h buffer
          singleEvents: true,
          orderBy:    'startTime',
          maxResults: 50,
        });
        for (const e of data.items ?? []) {
          if (e.status === 'cancelled') continue;
          const en = e.end?.dateTime ?? e.end?.date;
          if (en && new Date(en) > lastEnd) lastEnd = new Date(en);
        }
      } catch {
        lastEnd = dayEnd;
      }

      // Squeeze slot: 15 min after last event, capped at 19:00
      const squeezeStart = new Date(lastEnd.getTime() + 15 * 60_000);
      const squeezeEnd   = new Date(squeezeStart.getTime() + rule.durationMin * 60_000);
      const cap          = setTime(cursor, '19:00');

      if (squeezeEnd <= cap) {
        const raw = { start: squeezeStart, location: rule.location };
        return {
          start:           squeezeStart,
          end:             squeezeEnd,
          location:        rule.location,
          appointmentType,
          display:         formatSlot(raw) + ' (priority squeeze)',
        };
      }

      // Fall back to pre-clinic: 07:30 on the same day
      const preStart = setTime(cursor, '07:30');
      const preEnd   = new Date(preStart.getTime() + rule.durationMin * 60_000);
      if (preEnd <= dayStart) {
        const raw = { start: preStart, location: rule.location };
        return {
          start:           preStart,
          end:             preEnd,
          location:        rule.location,
          appointmentType,
          display:         formatSlot(raw) + ' (early priority)',
        };
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}

export interface CreateEventArgs {
  appointmentType: string;
  location: string;
  start: Date;
  end: Date;
  patientName: string;
  patientPhone: string;
  reason?: string;
}

export async function createCalendarEvent(
  args: CreateEventArgs,
): Promise<{ eventId: string; calendarId: string } | null> {
  const auth = getAuth();
  if (!auth) return null;

  const calId = calendarIdFor(args.location);
  if (!calId) return null;

  const cal = google.calendar({ version: 'v3', auth });
  const label = args.appointmentType.replace(/_/g, ' ');

  const event: calendar_v3.Schema$Event = {
    summary: `${args.patientName} — ${label}`,
    description:
      `Patient: ${args.patientName}\n` +
      `Phone: ${args.patientPhone}\n` +
      (args.reason ? `Reason: ${args.reason}\n` : '') +
      '\nBooked via Amise Front Desk.',
    start: { dateTime: args.start.toISOString(), timeZone: TZ },
    end:   { dateTime: args.end.toISOString(),   timeZone: TZ },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email',  minutes: 24 * 60 },
        { method: 'popup',  minutes: 60 },
      ],
    },
  };

  try {
    const { data } = await cal.events.insert({ calendarId: calId, requestBody: event });
    return { eventId: data.id!, calendarId: calId };
  } catch (err) {
    console.error('[calendar] createEvent error:', err);
    return null;
  }
}
