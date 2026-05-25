import { Router } from 'express';
import { findSlots, formatSlotForDisplay, AvailableSlot } from '../lib/calendar';
import { SLOT_RULES, AppointmentType, SlotRule, Location } from '@workspace/triage-engine';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  cursor.setSeconds(0, 0, 0);

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

function loadCache(): CalendarCache | null {
  try {
    const raw = readFileSync(join(__dirname, '../data/calendar-cache.json'), 'utf-8');
    return JSON.parse(raw) as CalendarCache;
  } catch {
    return null;
  }
}

router.get('/api/scheduling/upcoming', (req, res) => {
  const cache = loadCache();
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

export default router;
