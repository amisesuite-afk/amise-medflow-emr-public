import { Router } from 'express';
import { findSlots, formatSlotForDisplay } from '../lib/calendar';
import { SLOT_RULES, AppointmentType } from '@workspace/triage-engine';

const router = Router();

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
  } catch (err) {
    res.status(503).json({ error: 'Calendar service unavailable', detail: String(err) });
  }
});

export default router;
