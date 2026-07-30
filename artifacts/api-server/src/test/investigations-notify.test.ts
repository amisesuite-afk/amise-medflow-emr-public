/**
 * Integration tests for investigation review and patient-notification endpoints.
 * All external dependencies (Supabase, workflow-tasks, audit, Claude) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'staff-uuid' } }, error: null });

vi.mock('../lib/supabase.js', () => ({
  sb:               () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
  getSupabaseAdmin: () => ({ from: mockFrom, auth: { getUser: mockGetUser } }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockReturnValue(true),
  getStaffUserId:   vi.fn().mockResolvedValue('staff-uuid'),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/workflow-tasks.js', () => ({
  createWorkflowTask:  vi.fn().mockResolvedValue('task-id'),
  resolveWorkflowTask: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/gmail.js', () => ({
  sendOrDraft: vi.fn().mockResolvedValue({ messageId: 'mock-msg' }),
}));

vi.mock('./portal.js', () => ({
  extractDocumentInsights: vi.fn().mockResolvedValue({}),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
    };
  },
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: investigationsRouter } = await import('../routes/investigations.js');

const app = express();
app.use(express.json());
app.use(investigationsRouter);

// ── Chain-builder helper ──────────────────────────────────────────────────────

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const returnSelf = () => obj;
  obj.select      = vi.fn(returnSelf);
  obj.insert      = vi.fn(returnSelf);
  obj.update      = vi.fn(returnSelf);
  obj.upsert      = vi.fn(returnSelf);
  obj.eq          = vi.fn(returnSelf);
  obj.neq         = vi.fn(returnSelf);
  obj.in          = vi.fn(returnSelf);
  obj.not         = vi.fn(returnSelf);
  obj.like        = vi.fn(returnSelf);
  obj.order       = vi.fn(returnSelf);
  obj.limit       = vi.fn(returnSelf);
  obj.gte         = vi.fn(returnSelf);
  obj.lt          = vi.fn(returnSelf);
  obj.maybeSingle = vi.fn().mockResolvedValue(termResult);
  obj.single      = vi.fn().mockResolvedValue(termResult);
  (obj as any).then = (
    res: (v: unknown) => unknown,
    rej: (e: unknown) => unknown,
  ) => Promise.resolve(termResult).then(res as any, rej as any);
  return obj;
}

beforeEach(() => vi.clearAllMocks());

// ── POST /api/investigations/review/:id ───────────────────────────────────────

describe('POST /api/investigations/review/:id', () => {
  it('returns 400 when table is missing from body', async () => {
    const res = await request(app)
      .post('/api/investigations/review/result-1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/table/i);
  });

  it('returns 400 when table has an invalid value', async () => {
    const res = await request(app)
      .post('/api/investigations/review/result-1')
      .send({ table: 'patients' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when record is not found', async () => {
    mockFrom.mockReturnValue(mkChain({ data: null, error: null }));

    const res = await request(app)
      .post('/api/investigations/review/nonexistent')
      .send({ table: 'investigation_results' });
    expect(res.status).toBe(404);
  });

  it('marks a lab result as reviewed and returns acknowledged_at', async () => {
    const existing = {
      id: 'result-1', status: 'resulted',
      patient_id: 'pat-1', encounter_id: 'enc-1',
      is_abnormal: false, is_critical: false,
      test_name: 'FBC', order_type: null, body_area: null,
    };
    // Call 1: maybeSingle fetch
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    // Call 2: update
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/investigations/review/result-1')
      .send({ table: 'investigation_results', actionTaken: 'Reviewed. No action required.' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('result-1');
    expect(res.body.status).toBe('reviewed');
    expect(res.body).toHaveProperty('acknowledged_at');
  });

  it('auto-creates inform_patient task for abnormal result', async () => {
    const { createWorkflowTask } = await import('../lib/workflow-tasks.js');

    const existing = {
      id: 'result-2', status: 'resulted',
      patient_id: 'pat-1', encounter_id: 'enc-1',
      is_abnormal: true, is_critical: false,
      test_name: 'LFTs', order_type: null, body_area: null,
    };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/investigations/review/result-2')
      .send({ table: 'investigation_results' });

    expect(res.status).toBe(200);
    expect(createWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type:   'inform_patient',
        patient_id:  'pat-1',
        encounter_id: 'enc-1',
        source_id:   'result-2',
        priority:    'high',
      }),
    );
  });

  it('auto-creates urgent inform_patient task for critical result', async () => {
    const { createWorkflowTask } = await import('../lib/workflow-tasks.js');

    const existing = {
      id: 'result-3', status: 'resulted',
      patient_id: 'pat-2', encounter_id: 'enc-2',
      is_abnormal: true, is_critical: true,
      test_name: 'Troponin', order_type: null, body_area: null,
    };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    await request(app)
      .post('/api/investigations/review/result-3')
      .send({ table: 'investigation_results' });

    expect(createWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'urgent' }),
    );
  });

  it('does NOT create inform_patient task for normal result', async () => {
    const { createWorkflowTask } = await import('../lib/workflow-tasks.js');

    const existing = {
      id: 'result-4', status: 'resulted',
      patient_id: 'pat-1', encounter_id: 'enc-1',
      is_abnormal: false, is_critical: false,
      test_name: 'CRP', order_type: null, body_area: null,
    };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    await request(app)
      .post('/api/investigations/review/result-4')
      .send({ table: 'investigation_results' });

    const informCalls = (createWorkflowTask as ReturnType<typeof vi.fn>).mock.calls
      .filter(([arg]: [{ task_type: string }]) => arg.task_type === 'inform_patient');
    expect(informCalls).toHaveLength(0);
  });

  it('works for imaging_orders table', async () => {
    const existing = {
      id: 'img-1', status: 'reported',
      patient_id: 'pat-1', encounter_id: 'enc-1',
      is_abnormal: false, is_critical: false,
      test_name: null, order_type: 'CT Abdomen', body_area: 'Abdomen',
    };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/investigations/review/img-1')
      .send({ table: 'imaging_orders' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reviewed');
  });

  it('resolves the review_result workflow task', async () => {
    const { resolveWorkflowTask } = await import('../lib/workflow-tasks.js');

    const existing = {
      id: 'result-5', status: 'resulted',
      patient_id: 'pat-1', encounter_id: 'enc-1',
      is_abnormal: false, is_critical: false,
      test_name: 'FBC', order_type: null, body_area: null,
    };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    await request(app)
      .post('/api/investigations/review/result-5')
      .send({ table: 'investigation_results' });

    expect(resolveWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({ task_type: 'review_result', source_id: 'result-5' }),
    );
  });
});

// ── POST /api/investigations/notify-patient/:id ───────────────────────────────

describe('POST /api/investigations/notify-patient/:id', () => {
  it('returns 400 when table is missing', async () => {
    const res = await request(app)
      .post('/api/investigations/notify-patient/result-1')
      .send({ method: 'phone' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/table/i);
  });

  it('returns 400 when method is missing', async () => {
    const res = await request(app)
      .post('/api/investigations/notify-patient/result-1')
      .send({ table: 'investigation_results' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/method/i);
  });

  it('returns 400 when method is blank', async () => {
    const res = await request(app)
      .post('/api/investigations/notify-patient/result-1')
      .send({ table: 'investigation_results', method: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when record is not found', async () => {
    mockFrom.mockReturnValue(mkChain({ data: null, error: null }));

    const res = await request(app)
      .post('/api/investigations/notify-patient/nonexistent')
      .send({ table: 'investigation_results', method: 'phone' });
    expect(res.status).toBe(404);
  });

  it('records notification and returns patient_notified_at', async () => {
    const existing = { id: 'result-1', patient_id: 'pat-1', encounter_id: 'enc-1' };
    // Call 1: fetch record
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    // Call 2: update notification fields
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/investigations/notify-patient/result-1')
      .send({ table: 'investigation_results', method: 'phone' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('result-1');
    expect(res.body).toHaveProperty('patient_notified_at');
    expect(res.body.notification_method).toBe('phone');
  });

  it('resolves inform_patient workflow task after notification', async () => {
    const { resolveWorkflowTask } = await import('../lib/workflow-tasks.js');

    const existing = { id: 'result-6', patient_id: 'pat-1', encounter_id: 'enc-1' };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    await request(app)
      .post('/api/investigations/notify-patient/result-6')
      .send({ table: 'investigation_results', method: 'whatsapp' });

    expect(resolveWorkflowTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type:  'inform_patient',
        source_id:  'result-6',
      }),
    );
  });

  it('works for imaging_orders table', async () => {
    const existing = { id: 'img-1', patient_id: 'pat-1', encounter_id: 'enc-1' };
    mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/investigations/notify-patient/img-1')
      .send({ table: 'imaging_orders', method: 'sms' });

    expect(res.status).toBe(200);
    expect(res.body.notification_method).toBe('sms');
  });

  it('accepts all valid notification methods', async () => {
    const methods = ['phone', 'sms', 'whatsapp', 'in_person', 'letter'];
    for (const method of methods) {
      const existing = { id: `r-${method}`, patient_id: 'pat-1', encounter_id: 'enc-1' };
      mockFrom.mockReturnValueOnce(mkChain({ data: existing, error: null }));
      mockFrom.mockReturnValueOnce(mkChain({ error: null }));

      const res = await request(app)
        .post(`/api/investigations/notify-patient/r-${method}`)
        .send({ table: 'investigation_results', method });
      expect(res.status).toBe(200);
      expect(res.body.notification_method).toBe(method);
    }
  });
});
