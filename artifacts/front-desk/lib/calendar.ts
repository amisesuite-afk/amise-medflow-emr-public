import { google, type calendar_v3 } from 'googleapis';

const TZ = 'America/St_Lucia';

const SLOT_RULES: Record<string, {
  durationMin: number;
  location: string;
  days: number[];
  windowStart: string;
  windowEnd: string;
  bufferAfterMin: number;
}> = {
  new_consult:   { durationMin: 45, location: 'rodney_bay', days: [1, 4, 5], windowStart: '10:00', windowEnd: '17:00', bufferAfterMin: 5  },
  follow_up:     { durationMin: 15, location: 'castries',   days: [2, 4],    windowStart: '09:00', windowEnd: '12:00', bufferAfterMin: 5  },
  post_op:       { durationMin: 20, location: 'castries',   days: [2, 4],    windowStart: '09:00', windowEnd: '12:00', bufferAfterMin: 5  },
  ercp_workup:   { durationMin: 30, location: 'rodney_bay', days: [1],       windowStart: '14:00', windowEnd: '16:00', bufferAfterMin: 10 },
  breast:        { durationMin: 45, location: 'rodney_bay', days: [3],       windowStart: '14:00', windowEnd: '17:00', bufferAfterMin: 15 },
  telephone:     { durationMin: 15, location: 'remote',     days: [1,2,3,4,5],windowStart: '08:00', windowEnd: '16:00', bufferAfterMin: 5  },
  diabetic_foot: { durationMin: 30, location: 'rodney_bay', days: [1, 3, 5], windowStart: '10:00', windowEnd: '14:00', bufferAfterMin: 10 },
};

export const LOCATION_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay (Providence Building)',
  castries:   'Castries',
  tapion:     'Tapion Hospital',
  remote:     'Telephone consultation',
};

function calendarIdFor(location: string): string {
  switch (location) {
    case 'rodney_bay': return process.env.CALENDAR_ID_RODNEY_BAY ?? '';
    case 'castries':   return process.env.CALENDAR_ID_CASTRIES ?? '';
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

export async function findSlots(appointmentType: string, max = 3): Promise<FoundSlot[]> {
  const auth = getAuth();
  if (!auth) return [];

  const rule = SLOT_RULES[appointmentType] ?? SLOT_RULES['new_consult'];
  const calId = calendarIdFor(rule.location);
  if (!calId) return [];

  const cal = google.calendar({ version: 'v3', auth });
  const fromDate = new Date();
  const lookaheadMs = 21 * 86400_000;
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

  while (slots.length < max && cursor.getTime() < fromDate.getTime() + lookaheadMs) {
    if (rule.days.includes(cursor.getDay())) {
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
