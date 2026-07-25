import { Router } from 'express';
import { google } from 'googleapis';
import { findSlots, formatSlotForDisplay, fetchUpcomingEvents, AvailableSlot } from '../lib/calendar';
import { SLOT_RULES, AppointmentType, SlotRule, Location } from '@workspace/triage-engine';
import { requireAuth } from '../middlewares/auth';
import { requireCronSecret, sb } from '../lib/supabase.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../lib/logger.js';

// Resolves correctly in both ts-node (src/routes/) and esbuild bundle (dist/)
const CACHE_PATH = join(process.cwd(), 'src/data/calendar-cache.json');
const CACHE_KEY = 'combined';

const router = Router();

function generateMockSlots(
  appointmentType: AppointmentType,
  rule: SlotRule,
  max = 3,
  fromDate: Date = new Date(),
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const twoHoursFromNow = new Date(fromDate.getTime() + 2 * 60 * 60_000);
  const cursor = new Date(fromDate);
  cursor.setSeconds(0, 0);

  const [startH, startM] = rule.windowStart.split(':').map(Number);

  while (slots.length < max && cursor.getTime() < fromDate.getTime() + 60 * 86400_000) {
    const dow = cursor.getDay();
    if (rule.days.includes(dow)) {
      const slotStart = new Date(cursor);
      slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + rule.durationMin * 60_000);
      if (slotStart > twoHoursFromNow) {
        slots.push({ start: slotStart, end: slotEnd, location: rule.location as Location, appointmentType });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}

router.get('/api/scheduling/slots', async (req, res) => {
  const type = req.query.type as AppointmentType;
  const max = Math.min(Number(req.query.max ?? 6), 20);
  const lookahead = Math.min(Number(req.query.lookahead ?? 21), 60);

  if (!type || !SLOT_RULES[type]) {
    res.status(400).json({ error: 'Invalid or missing appointment type', valid: Object.keys(SLOT_RULES) });
    return;
  }

  try {
    const slots = await findSlots(type, { max, lookaheadDays: lookahead });
    const result = slots.map(s => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      location: s.location,
      appointmentType: s.appointmentType,
      display: formatSlotForDisplay(s),
    }));
    res.json({ slots: result, rule: SLOT_RULES[type] });
  } catch {
    const rule = SLOT_RULES[type];
    const mockSlots = generateMockSlots(type, rule, max);
    const result = mockSlots.map(s => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      location: s.location,
      appointmentType: s.appointmentType,
      display: formatSlotForDisplay(s),
    }));
    res.json({ slots: result, rule, mock: true });
  }
});

// ── /api/scheduling/sync ─────────────────────────────────────────────────────
// Fetches live events from Google Calendar and persists them in Supabase
// (calendar_event_cache table). The JSON file is kept as a local fallback.

async function syncCalendarCache(): Promise<{ synced: boolean; eventCount?: number; syncedAt?: string; error?: string }> {
  try {
    const events = await fetchUpcomingEvents(45);
    const calendarId = process.env.CALENDAR_ID_RODNEY_BAY ?? 'amisesuite@gmail.com';
    const fetchedAt = new Date().toISOString();

    // Primary: persist to Supabase calendar_event_cache
    try {
      const { error: upsertErr } = await sb()
        .from('calendar_event_cache')
        .upsert({
          calendar_key: CACHE_KEY,
          calendar_id: calendarId,
          fetched_at: fetchedAt,
          time_zone: 'America/St_Lucia',
          events,
          updated_at: fetchedAt,
        }, { onConflict: 'calendar_key' });
      if (upsertErr) logger.warn({ err: upsertErr.message }, '[calendar-sync] Supabase upsert failed');
    } catch (sbErr) {
      logger.warn({ err: sbErr }, '[calendar-sync] Supabase unavailable, using file fallback');
    }

    // Fallback: write to JSON file (survives Render container restart gap)
    try {
      writeFileSync(CACHE_PATH, JSON.stringify({ calendarId, fetchedAt, timeZone: 'America/St_Lucia', events }, null, 2), 'utf-8');
    } catch {
      // Non-fatal: file write may fail in read-only container environments
    }

    return { synced: true, eventCount: events.length, syncedAt: fetchedAt };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { synced: false, error: msg };
  }
}

router.post('/api/scheduling/sync', requireAuth, async (_req, res) => {
  res.json(await syncCalendarCache());
});

router.post('/api/cron/calendar-sync', async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  res.json(await syncCalendarCache());
});

// ── /api/scheduling/upcoming ─────────────────────────────────────────────────
// Returns events from the local calendar cache (calendar-cache.json).
// The cache is populated from the real amisesuite@gmail.com Google Calendar.
// Optionally filter to a specific date with ?date=YYYY-MM-DD (ECT).

interface CachedEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  type: string;
}

interface CalendarCache {
  calendarId: string;
  fetchedAt: string;
  timeZone: string;
  events: CachedEvent[];
}

function loadCacheFromFile(): CalendarCache | null {
  try {
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw) as CalendarCache;
  } catch {
    return null;
  }
}

async function loadCache(): Promise<CalendarCache | null> {
  // Primary: Supabase
  try {
    const { data } = await sb()
      .from('calendar_event_cache')
      .select('calendar_id, fetched_at, time_zone, events')
      .eq('calendar_key', CACHE_KEY)
      .maybeSingle();
    if (data) {
      return {
        calendarId: data.calendar_id as string,
        fetchedAt:  data.fetched_at as string,
        timeZone:   data.time_zone as string,
        events:     (data.events ?? []) as CachedEvent[],
      };
    }
  } catch {
    // Fall through to file
  }
  return loadCacheFromFile();
}

router.get('/api/scheduling/upcoming', requireAuth, async (req, res) => {
  const cache = await loadCache();
  if (!cache) {
    res.status(503).json({ error: 'Calendar cache not available' });
    return;
  }

  const dateFilter = req.query.date as string | undefined;
  const daysAhead = Math.min(Number(req.query.days ?? 14), 60);
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 86400_000);

  let events = cache.events.filter(e => {
    const start = new Date(e.start);
    return start >= now && start < cutoff;
  });

  if (dateFilter) {
    events = events.filter(e => e.start.startsWith(dateFilter));
  }

  res.json({ events, fetchedAt: cache.fetchedAt, calendarId: cache.calendarId });
});

// ── /api/scheduling/book-followup ────────────────────────────────────────────
// Creates a Google Calendar follow-up event directly from the EMR Plan tab.
// The event is placed at 09:00–09:30 ECT on the requested date.

router.post('/api/scheduling/book-followup', requireAuth, async (req, res) => {
  const {
    patientId,
    patientName,
    followUpDate, // YYYY-MM-DD
    followUpNotes,
    visitType,
  } = req.body as {
    patientId?: string;
    patientName: string;
    followUpDate: string;
    followUpNotes?: string;
    visitType?: string;
  };

  if (!patientName || !followUpDate) {
    res.status(400).json({ error: 'patientName and followUpDate are required' });
    return;
  }

  // Validate ISO date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)) {
    res.status(400).json({ error: 'followUpDate must be YYYY-MM-DD' });
    return;
  }

  // Require at least one Google credential set
  const hasOAuth =
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const hasServiceAccount = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!hasOAuth && !hasServiceAccount) {
    res.status(503).json({
      error:
        'Google Calendar is not configured. Set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON.',
    });
    return;
  }

  try {
    // Build auth — OAuth2 preferred (personal account), JWT service account fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let auth: any;
    if (hasOAuth) {
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob',
      );
      client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
      auth = client;
    } else {
      const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as {
        client_email: string;
        private_key: string;
      };
      auth = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/calendar'],
        subject: process.env.GMAIL_USER,
      });
    }

    const calendarId = process.env.CALENDAR_ID_RODNEY_BAY ?? 'primary';
    const cal = google.calendar({ version: 'v3', auth });

    // 09:00–09:30 ECT (UTC-4) on the requested date
    const [year, month, day] = followUpDate.split('-').map(Number);
    const startUTC = new Date(Date.UTC(year, month - 1, day, 13, 0, 0)); // 09:00 ECT = 13:00 UTC
    const endUTC   = new Date(Date.UTC(year, month - 1, day, 13, 30, 0)); // 09:30 ECT = 13:30 UTC

    const descParts: string[] = [];
    if (followUpNotes?.trim()) descParts.push(followUpNotes.trim());
    if (patientId)  descParts.push(`Patient ID: ${patientId}`);
    if (visitType)  descParts.push(`Visit type: ${visitType}`);
    descParts.push('\nBooked from Amise MedFlow EMR — Plan tab.');

    const { data } = await cal.events.insert({
      calendarId,
      requestBody: {
        summary: `Follow-up: ${patientName}`,
        description: descParts.join('\n'),
        start: { dateTime: startUTC.toISOString(), timeZone: 'America/St_Lucia' },
        end:   { dateTime: endUTC.toISOString(),   timeZone: 'America/St_Lucia' },
      },
    });

    res.json({
      eventId:    data.id,
      eventLink:  data.htmlLink ?? null,
      calendarId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
