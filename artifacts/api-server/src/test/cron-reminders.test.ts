// H-09a/b: the 24h reminder email in POST /api/cron/reminders must obey MODE
// and must quarantine a Claude-drafted body that contains forbidden content.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const h = vi.hoisted(() => ({
  gmailSend:   vi.fn(),
  gmailDraft:  vi.fn(),
  draftReply:  vi.fn(),
  audit:       vi.fn(),
  fromQueue:   [] as unknown[],
}));

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: class { setCredentials() {} }, JWT: class {} },
    gmail: () => ({ users: { messages: { send: h.gmailSend }, drafts: { create: h.gmailDraft } } }),
  },
}));

// Each sb().from() call pops the next canned result; the chain is thenable.
function chain(result: unknown) {
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'in', 'gte', 'lte', 'eq', 'is', 'not', 'update', 'order', 'limit']) {
    obj[m] = vi.fn(() => obj);
  }
  (obj as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return obj;
}
const fakeSb = { from: vi.fn(() => chain(h.fromQueue.shift() ?? { data: [], error: null })) };

vi.mock('../lib/supabase.js', () => ({
  sb: () => fakeSb,
  getSupabaseAdmin: () => fakeSb,
  audit: h.audit,
  requireCronSecret: () => true,
}));

vi.mock('../lib/claude.js', () => ({ draftReply: h.draftReply }));

vi.mock('../lib/calendar.js', () => ({
  formatSlotForDisplay: () => ({ day: 'Thursday', date: '1 October', time: '9:00 AM', location: 'Tapion Hospital' }),
  fetchAllEventsForDate: vi.fn().mockResolvedValue([]),
}));

const { default: cronRouter } = await import('../routes/cron.js');
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as unknown as { log: unknown }).log = { info() {}, warn() {}, error() {} };
  next();
});
app.use(cronRouter);

const PATIENT_EMAIL = 'marie@example.com';
const STAFF_EMAIL = 'frontdesk@example.com';

function appt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-0001-aaaa',
    patient_name: 'Marie Dupont',
    patient_email: PATIENT_EMAIL,
    patient_phone: null,
    appointment_type: 'colonoscopy',
    location: 'tapion',
    confirmed_slot: new Date(Date.now() + 20 * 3600_000).toISOString(),
    reminder_sent_at: new Date().toISOString(), // 48h SMS already done
    prep_sms_sent: false,
    status: 'staff_confirmed',
    ...overrides,
  };
}

function queueReminderRun() {
  h.fromQueue.push(
    { data: [appt()], error: null },           // upcoming appointments
    { data: [{ id: 'appt-0001-aaaa' }], error: null }, // prep_sms_sent claim
    { data: [], error: null },                 // post-visit query
  );
}

function decodedRaw(call: unknown[]): string {
  const req = call[0] as { requestBody: { raw?: string; message?: { raw: string } } };
  const raw = req.requestBody.raw ?? req.requestBody.message!.raw;
  return Buffer.from(raw, 'base64url').toString('utf-8');
}

const SAFE_DRAFT = { subject: 'Your appointment', body: 'Dear Marie, this is a reminder of your appointment.', safe: true, violations: [] };

const saved: Record<string, string | undefined> = {};
const KEYS = ['MODE', 'REMINDER_EMAIL_AUTO_SEND', 'STAFF_NOTIFY_EMAIL', 'DOCTOR_NOTIFY_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_JSON'];

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  vi.clearAllMocks();
  h.fromQueue.length = 0;
  h.gmailSend.mockResolvedValue({ data: { id: 'msg-1' } });
  h.gmailDraft.mockResolvedValue({ data: { id: 'draft-1' } });
  h.audit.mockResolvedValue(undefined);
  h.draftReply.mockResolvedValue(SAFE_DRAFT);
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'svc@test', private_key: 'k' });
  process.env.STAFF_NOTIFY_EMAIL = STAFF_EMAIL;
  delete process.env.REMINDER_EMAIL_AUTO_SEND;
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('POST /api/cron/reminders — 24h reminder email', () => {
  it('MODE=dry_run: nothing is sent or drafted (H-09a)', async () => {
    process.env.MODE = 'dry_run';
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});
    expect(res.status).toBe(200);
    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_skipped' });
    expect(h.gmailSend).not.toHaveBeenCalled();
    expect(h.gmailDraft).not.toHaveBeenCalled();
  });

  it('MODE=supervised: becomes a Gmail draft for staff review, not a send', async () => {
    process.env.MODE = 'supervised';
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});
    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_drafted' });
    expect(h.gmailDraft).toHaveBeenCalledTimes(1);
    expect(h.gmailSend).not.toHaveBeenCalled();
  });

  it('MODE=supervised + REMINDER_EMAIL_AUTO_SEND=true: sends directly (explicit opt-in)', async () => {
    process.env.MODE = 'supervised';
    process.env.REMINDER_EMAIL_AUTO_SEND = 'true';
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});
    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_sent' });
    expect(h.gmailSend).toHaveBeenCalledTimes(1);
    const raw = decodedRaw(h.gmailSend.mock.calls[0]);
    expect(raw).toContain(`To: ${PATIENT_EMAIL}`);
    expect(raw).toContain('PREPARATION INSTRUCTIONS');
    expect(raw).not.toMatch(/do not take[^.]*insulin/i);
  });

  it('REMINDER_EMAIL_AUTO_SEND does not lift dry_run', async () => {
    process.env.MODE = 'dry_run';
    process.env.REMINDER_EMAIL_AUTO_SEND = 'true';
    queueReminderRun();
    await request(app).post('/api/cron/reminders').send({});
    expect(h.gmailSend).not.toHaveBeenCalled();
    expect(h.gmailDraft).not.toHaveBeenCalled();
  });

  it('quarantines an AI body with forbidden content even if draftReply claimed it was safe (H-09b)', async () => {
    process.env.MODE = 'auto';
    h.draftReply.mockResolvedValue({
      subject: 'Your appointment',
      body: 'Dear Marie, your biopsy result shows nothing serious. The fee is $150.',
      safe: true, // simulate a missed check upstream — the route must screen itself
      violations: [],
    });
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});

    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_quarantined' });

    // Patient is never emailed; exactly one message goes to staff for review.
    expect(h.gmailDraft).not.toHaveBeenCalled();
    expect(h.gmailSend).toHaveBeenCalledTimes(1);
    const raw = decodedRaw(h.gmailSend.mock.calls[0]);
    const headers = raw.split('\r\n\r\n')[0];
    expect(headers).toContain(`To: ${STAFF_EMAIL}`);
    expect(headers).not.toContain(PATIENT_EMAIL);
    expect(raw).toContain('NOT sent to the patient');

    expect(h.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'skip',
      entityId: 'appt-0001-aaaa',
      payload: expect.objectContaining({ kind: 'email_24h', quarantined: true, violations: expect.arrayContaining([expect.any(String)]) }),
    }));
  });

  it('quarantines when draftReply itself flags the draft unsafe', async () => {
    process.env.MODE = 'auto';
    h.draftReply.mockResolvedValue({ subject: 'x', body: 'y', safe: false, violations: ['/\\bdiagnos/i'] });
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});
    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_quarantined' });
    const raw = decodedRaw(h.gmailSend.mock.calls[0]);
    expect(raw).toContain(`To: ${STAFF_EMAIL}`);
  });

  it('quarantine under dry_run: patient not emailed and staff alert also suppressed', async () => {
    process.env.MODE = 'dry_run';
    h.draftReply.mockResolvedValue({ subject: 'x', body: 'Take 500 mg now.', safe: false, violations: ['mg'] });
    queueReminderRun();
    const res = await request(app).post('/api/cron/reminders').send({});
    expect(res.body.results).toContainEqual({ id: 'appt-0001-aaaa', action: 'email_24h_quarantined' });
    expect(h.gmailSend).not.toHaveBeenCalled();
    expect(h.gmailDraft).not.toHaveBeenCalled();
  });
});
