import { Router } from 'express';
import { getSupabaseAdmin, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { logAudit } from '../lib/audit.js';
import {
  fetchEventsForDate, updateEventDescription,
  formatOperatingListDescription, type TheatreCaseSummary,
} from '../lib/calendar.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSIONS_CONST = {
  morning:   { label: 'Morning list',   startHHMM: '08:30', durationMin: 270 },
  afternoon: { label: 'Afternoon list', startHHMM: '13:30', durationMin: 210 },
  full_day:  { label: 'Full day',       startHHMM: '08:30', durationMin: 480 },
  ercp:      { label: 'ERCP / Endo',   startHHMM: '08:30', durationMin: 240 },
} as const;

type SessionType = keyof typeof SESSIONS_CONST;

const LOCATION_LABELS: Record<string, string> = {
  tapion:      'Tapion Hospital Theatre',
  rodney_bay:  'Rodney Bay Day Surgery',
  tapion_ercp: 'Tapion ERCP / Endoscopy Suite',
};

/** Infer session_type from Google Calendar event start time and summary. */
function inferSessionType(startISO: string, summary: string): SessionType {
  const s = (summary ?? '').toLowerCase();
  if (/ercp|endoscop|colonoscop|gastroscop|endo list/.test(s)) return 'ercp';
  if (/full.?day|full day/.test(s)) return 'full_day';
  if (!startISO) return 'morning';
  const hour = new Date(startISO).getUTCHours() - 4; // rough ECT
  return hour >= 12 ? 'afternoon' : 'morning';
}

/** Infer location_key from calendar ID and summary. */
function inferLocation(calendarId: string, summary: string): string {
  const s = (summary ?? '').toLowerCase();
  if (/ercp|endo suite/.test(s)) return 'tapion_ercp';
  if (/rodney.?bay|day surgery/.test(s)) return 'rodney_bay';
  if (calendarId === process.env.CALENDAR_ID_TAPION_ERCP) return 'tapion_ercp';
  if (calendarId === process.env.CALENDAR_ID_RODNEY_BAY) return 'rodney_bay';
  return 'tapion';
}

/** Convert HH:MM string to minutes since midnight. */
function hhmm(iso: string): string {
  if (!iso) return '08:30';
  const d = new Date(iso);
  const h = d.getUTCHours() - 4; // ECT = UTC-4
  const m = d.getUTCMinutes();
  const h2 = ((h % 24) + 24) % 24;
  return `${String(h2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── GET /api/theatre/sessions?date=YYYY-MM-DD ─────────────────────────────────
// Reads Google Calendar for theatre/endoscopy events on that date, upserts
// theatre_sessions rows, then returns each session with its persisted cases.
router.get('/api/theatre/sessions', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const dateStr = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Fetch Google Calendar events for this date
    let calEvents: Awaited<ReturnType<typeof fetchEventsForDate>> = [];
    try {
      calEvents = await fetchEventsForDate(dateStr);
    } catch (calErr) {
      // Calendar unavailable — fall back to DB-only sessions
      logger.warn({ calErr }, '[theatre] calendar fetch failed, falling back to DB only');
    }

    // Upsert a theatre_sessions row for each calendar event
    for (const ev of calEvents) {
      const sessionType = inferSessionType(ev.start, ev.summary);
      const locationKey = inferLocation(ev.calendarId, ev.summary);
      const { error: upsertErr } = await supa.from('theatre_sessions').upsert({
        google_event_id:    ev.id,
        google_calendar_id: ev.calendarId,
        session_date:       dateStr,
        session_type:       sessionType,
        location_key:       locationKey,
        cal_start_time:     ev.start || null,
        cal_end_time:       ev.end   || null,
        cal_summary:        ev.summary,
      }, { onConflict: 'google_event_id', ignoreDuplicates: false });
      if (upsertErr) logger.warn({ err: upsertErr, eventId: ev.id }, '[theatre/sessions] calendar event upsert failed');
    }

    // Fetch all sessions for this date (calendar-sourced + manually created)
    const { data: sessions, error: sErr } = await supa
      .from('theatre_sessions')
      .select('*')
      .eq('session_date', dateStr)
      .neq('status', 'cancelled')
      .order('cal_start_time', { ascending: true });

    if (sErr) throw sErr;

    // Fetch all cases for these sessions
    const sessionIds = (sessions ?? []).map(s => s.id as string);
    const { data: allCases, error: cErr } = sessionIds.length
      ? await supa.from('theatre_cases').select('*').in('session_id', sessionIds).order('sort_order')
      : { data: [], error: null };

    if (cErr) throw cErr;

    type CaseRow = NonNullable<typeof allCases>[number];
    const casesBySession = new Map<string, CaseRow[]>();
    for (const c of allCases ?? []) {
      const sid = c.session_id as string;
      if (!casesBySession.has(sid)) casesBySession.set(sid, []);
      casesBySession.get(sid)!.push(c);
    }

    const result = (sessions ?? []).map(s => ({
      ...s,
      startHHMM:   s.cal_start_time ? hhmm(s.cal_start_time as string) : SESSIONS_CONST[(s.session_type as SessionType) ?? 'morning'].startHHMM,
      locationLabel: LOCATION_LABELS[s.location_key as string] ?? s.location_key,
      sessionLabel:  SESSIONS_CONST[(s.session_type as SessionType) ?? 'morning'].label,
      capacityMin:   SESSIONS_CONST[(s.session_type as SessionType) ?? 'morning'].durationMin,
      cases: (casesBySession.get(s.id as string) ?? []).map(c => ({
        id:          c.id,
        sessionId:   c.session_id,
        patientName: c.patient_name,
        procedure:   c.procedure,
        durationMin: c.duration_min,
        position:    c.position,
        anaesthetic: c.anaesthetic,
        equipment:   c.equipment ?? [],
        antibiotics: c.antibiotics,
        notes:       c.notes,
        procGroup:   c.proc_group,
        sortOrder:   c.sort_order,
      })),
    }));

    res.json({ sessions: result });
  } catch (err) {
    logger.error({ err }, '[theatre/sessions] GET error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── POST /api/theatre/sessions — create a manual session ──────────────────────
router.post('/api/theatre/sessions', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { date, sessionType, locationKey } = req.body as {
    date: string; sessionType: SessionType; locationKey: string;
  };
  if (!date || !sessionType || !locationKey) {
    res.status(400).json({ error: 'date, sessionType, locationKey required' });
    return;
  }
  try {
    const supa = getSupabaseAdmin();
    const { data, error } = await supa.from('theatre_sessions').insert({
      session_date: date, session_type: sessionType, location_key: locationKey,
    }).select('*').single();
    if (error) throw error;
    void logAudit(req, 'create', 'appointment', data.id as string, undefined, { entityType: 'theatre_session', date, sessionType, locationKey });
    res.json({ session: data });
  } catch (err) {
    logger.error({ err }, '[theatre/sessions] POST error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── POST /api/theatre/sessions/:id/cases — add a case ─────────────────────────
router.post('/api/theatre/sessions/:id/cases', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params as { id: string };
  const {
    patientName, procedure, durationMin, position, anaesthetic,
    equipment, antibiotics, notes, procGroup, sortOrder,
  } = req.body as {
    patientName: string; procedure: string; durationMin?: number;
    position?: string; anaesthetic?: string; equipment?: string[];
    antibiotics?: string; notes?: string; procGroup?: string; sortOrder?: number;
  };

  if (!patientName?.trim() || !procedure?.trim()) {
    res.status(400).json({ error: 'patientName and procedure required' });
    return;
  }

  try {
    const supa = getSupabaseAdmin();

    // Verify session exists
    const { data: session, error: sErr } = await supa
      .from('theatre_sessions').select('id').eq('id', id).single();
    if (sErr || !session) { res.status(404).json({ error: 'Session not found' }); return; }

    // Get current max sort_order for this session
    const { data: last } = await supa
      .from('theatre_cases').select('sort_order')
      .eq('session_id', id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const nextOrder = sortOrder ?? ((last?.sort_order as number ?? -1) + 1);

    const { data: newCase, error: cErr } = await supa.from('theatre_cases').insert({
      session_id:  id,
      patient_name: patientName.trim(),
      procedure:   procedure.trim(),
      duration_min: durationMin ?? 60,
      position:    position ?? null,
      anaesthetic: anaesthetic ?? null,
      equipment:   equipment ?? [],
      antibiotics: antibiotics ?? null,
      notes:       notes?.trim() ?? null,
      proc_group:  procGroup ?? 'other',
      sort_order:  nextOrder,
    }).select('*').single();

    if (cErr) throw cErr;

    void logAudit(req, 'create', 'appointment', newCase.id as string, undefined, { entityType: 'theatre_case', sessionId: id, patientName, procedure });

    res.json({
      case: {
        id: newCase.id, sessionId: newCase.session_id,
        patientName: newCase.patient_name, procedure: newCase.procedure,
        durationMin: newCase.duration_min, position: newCase.position,
        anaesthetic: newCase.anaesthetic, equipment: newCase.equipment ?? [],
        antibiotics: newCase.antibiotics, notes: newCase.notes,
        procGroup: newCase.proc_group, sortOrder: newCase.sort_order,
      },
    });
  } catch (err) {
    logger.error({ err }, '[theatre/cases] POST error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── PUT /api/theatre/cases/:caseId — update a case ────────────────────────────
router.put('/api/theatre/cases/:caseId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { caseId } = req.params as { caseId: string };
  const patch = req.body as Partial<{
    patientName: string; procedure: string; durationMin: number;
    position: string; anaesthetic: string; equipment: string[];
    antibiotics: string; notes: string; procGroup: string;
  }>;
  try {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from('theatre_cases').update({
      ...(patch.patientName  !== undefined && { patient_name:  patch.patientName }),
      ...(patch.procedure    !== undefined && { procedure:     patch.procedure }),
      ...(patch.durationMin  !== undefined && { duration_min:  patch.durationMin }),
      ...(patch.position     !== undefined && { position:      patch.position }),
      ...(patch.anaesthetic  !== undefined && { anaesthetic:   patch.anaesthetic }),
      ...(patch.equipment    !== undefined && { equipment:     patch.equipment }),
      ...(patch.antibiotics  !== undefined && { antibiotics:   patch.antibiotics }),
      ...(patch.notes        !== undefined && { notes:         patch.notes }),
      ...(patch.procGroup    !== undefined && { proc_group:    patch.procGroup }),
      updated_at: new Date().toISOString(),
    }).eq('id', caseId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[theatre/cases] PUT error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── DELETE /api/theatre/cases/:caseId ─────────────────────────────────────────
router.delete('/api/theatre/cases/:caseId', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { caseId } = req.params as { caseId: string };
  try {
    const supa = getSupabaseAdmin();
    const { error } = await supa.from('theatre_cases').delete().eq('id', caseId);
    if (error) throw error;
    void logAudit(req, 'delete', 'appointment', caseId, undefined, { entityType: 'theatre_case' });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[theatre/cases] DELETE error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── PUT /api/theatre/sessions/:id/cases/reorder ───────────────────────────────
router.put('/api/theatre/sessions/:id/cases/reorder', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params as { id: string };
  const { order } = req.body as { order: { id: string; sortOrder: number }[] };
  if (!Array.isArray(order)) { res.status(400).json({ error: 'order array required' }); return; }
  try {
    const supa = getSupabaseAdmin();
    await Promise.all(
      order.map(({ id: caseId, sortOrder }) =>
        supa.from('theatre_cases').update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
          .eq('id', caseId).eq('session_id', id),
      ),
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[theatre/cases] reorder error');
    res.status(502).json({ error: errStr(err) });
  }
});

// ── POST /api/theatre/sessions/:id/publish ────────────────────────────────────
// Builds the formatted operating list and patches the Google Calendar event.
router.post('/api/theatre/sessions/:id/publish', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;
  const { id } = req.params as { id: string };

  try {
    const supa = getSupabaseAdmin();

    const { data: session, error: sErr } = await supa
      .from('theatre_sessions')
      .select('*, theatre_cases(*)')
      .eq('id', id)
      .single();
    if (sErr || !session) { res.status(404).json({ error: 'Session not found' }); return; }

    // Sort cases by sort_order
    const rawCases = ((session as { theatre_cases?: unknown[] }).theatre_cases ?? []) as Array<Record<string, unknown>>;
    const sortedCases = [...rawCases].sort(
      (a, b) => (a.sort_order as number) - (b.sort_order as number),
    );

    const caseSummaries: TheatreCaseSummary[] = sortedCases.map(c => ({
      patientName: c.patient_name as string,
      procedure:   c.procedure as string,
      durationMin: c.duration_min as number,
      position:    c.position as string | null,
      anaesthetic: c.anaesthetic as string | null,
      equipment:   c.equipment as string[] | null,
      antibiotics: c.antibiotics as string | null,
      notes:       c.notes as string | null,
    }));

    const sessionType = (session.session_type as keyof typeof SESSIONS_CONST) ?? 'morning';
    const startHHMM = session.cal_start_time
      ? hhmm(session.cal_start_time as string)
      : SESSIONS_CONST[sessionType].startHHMM;
    const locLabel = LOCATION_LABELS[session.location_key as string] ?? (session.location_key as string);
    const dateLabel = new Date(session.session_date as string).toLocaleDateString('en-LC', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'America/St_Lucia',
    });

    const description = formatOperatingListDescription(caseSummaries, startHHMM, locLabel, dateLabel);

    // Patch Google Calendar event if linked
    const calId  = session.google_calendar_id as string | null;
    const evId   = session.google_event_id as string | null;
    if (calId && evId) {
      try {
        await updateEventDescription(calId, evId, description);
      } catch (calErr) {
        logger.warn({ calErr }, '[theatre/publish] calendar patch failed — marking published in DB anyway');
      }
    }

    // Update status in DB
    const userId = (req as unknown as { userId?: string }).userId ?? null;
    const { error: publishErr } = await supa.from('theatre_sessions').update({
      status: 'published',
      published_at: new Date().toISOString(),
      ...(userId ? { published_by: userId } : {}),
    }).eq('id', id);
    if (publishErr) throw publishErr;

    void logAudit(req, 'update', 'appointment', id, undefined, { entityType: 'theatre_session', action: 'publish', calendarUpdated: !!(calId && evId) });
    res.json({ ok: true, calendarUpdated: !!(calId && evId), description });
  } catch (err) {
    logger.error({ err }, '[theatre/sessions] publish error');
    res.status(502).json({ error: errStr(err) });
  }
});

export default router;
