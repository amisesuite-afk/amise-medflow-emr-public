import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockFrom = vi.fn();
const mockSendSms = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/sms.js', () => ({
  sendSms: mockSendSms,
  toE164:  (raw: string) => raw.startsWith('+') ? raw : `+1758${raw.replace(/\D/g, '')}`,
}));

const { default: notifyRouter } = await import('../routes/notify.js');
const app = express();
app.use(express.json());
app.use(notifyRouter);

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.eq          = vi.fn(self);
  obj.maybeSingle = vi.fn().mockResolvedValue(termResult);
  obj.single      = vi.fn().mockResolvedValue(termResult);
  (obj as any).then = (
    res: (v: unknown) => unknown,
    rej: (e: unknown) => unknown,
  ) => Promise.resolve(termResult).then(res as any, rej as any);
  return obj;
}

const ok  = (data: unknown) => ({ data, error: null });
const err = (msg: string)   => ({ data: null, error: { message: msg } });

const PATIENT = { full_name: 'Marie Dupont', phone: '4567890' };

beforeEach(() => {
  vi.clearAllMocks();
  mockSendSms.mockResolvedValue({ action: 'skipped' });
});

// ── POST /api/notify/:patientId ────────────────────────────────────────────────

describe('POST /api/notify/:patientId', () => {
  it('returns 400 for missing template', async () => {
    const res = await request(app).post('/api/notify/pat-1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/template/i);
  });

  it('returns 400 for invalid template', async () => {
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'fax' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/template/i);
  });

  it('returns 404 when patient not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(404);
  });

  it('returns 404 on DB error fetching patient', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB down')));
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(404);
  });

  it('returns 422 when patient has no phone', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok({ full_name: 'Jane', phone: null })));
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/phone/i);
  });

  it('sends result_ready notification', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    mockSendSms.mockResolvedValueOnce({ action: 'sent', channel: 'sms' });
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('sent');
    expect(res.body.template).toBe('result_ready');
    expect(mockSendSms).toHaveBeenCalledOnce();
    const [args] = mockSendSms.mock.calls[0];
    expect(args.body).toContain('Marie');
    expect(args.body).toContain('results');
  });

  it('sends postop_checkin notification', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'postop_checkin' });
    expect(res.status).toBe(200);
    const [args] = mockSendSms.mock.calls[0];
    expect(args.body).toContain('Marie');
    expect(args.body).toContain('recovery');
  });

  it('sends appointment_reminder with data', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    const data = { day: 'Tuesday', date: '5 Aug 2026', time: '10:00 AM', location: 'Rodney Bay' };
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'appointment_reminder', data });
    expect(res.status).toBe(200);
    const [args] = mockSendSms.mock.calls[0];
    expect(args.body).toContain('Tuesday');
    expect(args.body).toContain('Rodney Bay');
  });

  it('sends general notification with custom message', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    const res = await request(app).post('/api/notify/pat-1').send({
      template: 'general',
      data: { message: 'Please call us before your visit.' },
    });
    expect(res.status).toBe(200);
    const [args] = mockSendSms.mock.calls[0];
    expect(args.body).toBe('Please call us before your visit.');
  });

  it('returns 400 for general template with empty message', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    const res = await request(app).post('/api/notify/pat-1').send({
      template: 'general',
      data: { message: '' },
    });
    expect(res.status).toBe(400);
  });

  it('returns skipped action in dry_run mode', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    mockSendSms.mockResolvedValueOnce({ action: 'skipped' });
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('skipped');
  });

  it('returns 502 on SMS send error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(PATIENT)));
    mockSendSms.mockRejectedValueOnce(new Error('Twilio error'));
    const res = await request(app).post('/api/notify/pat-1').send({ template: 'result_ready' });
    expect(res.status).toBe(502);
  });
});
