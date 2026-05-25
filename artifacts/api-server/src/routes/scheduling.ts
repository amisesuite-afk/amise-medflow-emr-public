import { Router } from 'express';
import { findSlots, formatSlotForDisplay, AvailableSlot } from '../lib/calendar';
import { SLOT_RULES, AppointmentType, SlotRule, Location } from '@workspace/triage-engine';

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

export default router;
