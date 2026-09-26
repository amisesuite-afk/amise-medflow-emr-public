/**
 * DISABLE_AI kill switch (compliance G-8 / action A-20).
 *
 * With DISABLE_AI=true, no Anthropic client method may be called — from any
 * route — and each route must degrade gracefully (503 with a clear message, or
 * its deterministic fallback), never crash. The Anthropic SDK is mocked so the
 * test can prove no request method was invoked; a positive control proves the
 * mock actually sees calls when AI is enabled, so the "not called" assertions
 * aren't vacuous.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const sdk = vi.hoisted(() => {
  const create = vi.fn();
  const stream = vi.fn();
  const countTokens = vi.fn();
  const constructed: unknown[] = [];
  return { create, stream, countTokens, constructed };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: sdk.create, stream: sdk.stream, countTokens: sdk.countTokens };
    constructor(opts: unknown) { sdk.constructed.push(opts); }
  },
}));

// Any DB access in these tests is unexpected — the AI check comes first.
const dbTouched = vi.fn();
function chain(): unknown {
  return new Proxy(() => undefined, {
    get: (_t, prop) => {
      if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res);
      dbTouched(prop);
      return chain();
    },
    apply: () => chain(),
  });
}

vi.mock('../lib/supabase.js', () => ({
  sb:                () => chain(),
  getSupabaseAdmin:  () => chain(),
  requireStaffAuth:  vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockReturnValue(true),
  getStaffUserId:    vi.fn().mockResolvedValue('staff-uuid'),
  audit:             vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../middlewares/auth.js', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../lib/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/gmail.js', () => ({ sendOrDraft: vi.fn().mockResolvedValue({ messageId: 'mock' }) }));
vi.mock('../lib/workflow-tasks.js', () => ({
  createWorkflowTask:  vi.fn().mockResolvedValue('task-id'),
  resolveWorkflowTask: vi.fn().mockResolvedValue(undefined),
}));

// ── App ───────────────────────────────────────────────────────────────────────

const gate = await import('../lib/ai-gate.js');
const claude = await import('../lib/claude.js');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use((await import('../routes/ai-consult.js')).default);
app.use((await import('../routes/mm-cases.js')).default);
app.use((await import('../routes/narrative.js')).default);
app.use((await import('../routes/voice.js')).default);
app.use((await import('../routes/discharge-summary.js')).default);
app.use((await import('../routes/procedure-report.js')).default);
app.use((await import('../routes/previsit.js')).default);
app.use((await import('../routes/summary.js')).default);
app.use((await import('../routes/investigations.js')).default);
app.use((await import('../routes/portal.js')).default);
app.use((await import('../routes/questionnaire.js')).default);
app.use('/api/generate-letter', (await import('../routes/generate-letter.js')).default);
app.use('/api/generate-endoscopy-report', (await import('../routes/generate-endoscopy-report.js')).default);
app.use('/api/generate-operative-note', (await import('../routes/generate-operative-note.js')).default);
app.use('/api/suggest-codes', (await import('../routes/suggest-codes.js')).default);
app.use('/api/document-scan', (await import('../routes/document-scan.js')).default);

const PATIENT = { name: 'Test Patient', age: '50', sex: 'female', dob: '1975-01-01' };
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Representative request per gated route: [method, path, body]. */
const GATED_503: Array<[string, string, Record<string, unknown>]> = [
  ['post', '/api/ai-consult',                         { patientContext: { age: 50 }, consultationType: 'general' }],
  ['post', '/api/ai/edit-note',                       { section: 'plan', currentText: 'x', instruction: 'shorten' }],
  ['post', '/api/ai/fill-document',                   { docType: 'referral', patientName: 'Test Patient' }],
  ['post', '/api/ai/drug-interactions',               { drugs: [{ drugName: 'a' }, { drugName: 'b' }] }],
  ['post', '/api/mm-cases/case-1/analysis',           {}],
  ['post', '/api/narrative/parse',                    { section: 'pmh', text: 'hypertension' }],
  ['post', '/api/voice/segment',                      { transcript: 'patient reports pain' }],
  ['post', '/api/ai/discharge-summary',               { patient: PATIENT }],
  ['post', '/api/ai/procedure-report',                { type: 'colonoscopy', data: {} }],
  ['post', '/api/previsit/ai-format',                 { patientId: 'p-1' }],
  ['post', '/api/ai/refine',                          { text: 'note' }],
  ['post', '/api/investigations/extract-results',     { dataBase64: PNG_1PX, mimeType: 'image/png' }],
  ['post', '/api/investigations/scan-referral',       { content: 'Dear Dr', contentType: 'text' }],
  ['post', '/api/patient/intake-summary',             { intake_id: 'i-1' }],
  ['post', '/api/patient/documents/doc-1/extract',    {}],
  ['post', '/api/generate-letter',                    { patient: PATIENT, letterType: 'referral' }],
  ['post', '/api/generate-endoscopy-report',          { patient: PATIENT, procedureType: 'ogd', fields: {} }],
  ['post', '/api/generate-operative-note',            { patient: PATIENT, procedure: 'lap chole' }],
  ['post', '/api/suggest-codes',                      { assessment: 'gallstones' }],
  ['post', '/api/document-scan',                      { imageBase64: PNG_1PX, mimeType: 'image/png' }],
];

function expectNoAnthropicCalls() {
  expect(sdk.create).not.toHaveBeenCalled();
  expect(sdk.stream).not.toHaveBeenCalled();
  expect(sdk.countTokens).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DISABLE_AI = 'true';
});
afterEach(() => {
  delete process.env.DISABLE_AI;
  delete process.env.DISABLE_TRANSCRIPTION;
});

// ── Gate semantics ────────────────────────────────────────────────────────────

describe('ai-gate semantics', () => {
  it('is disabled only when DISABLE_AI is exactly "true" (unchanged from ai-guard)', () => {
    for (const [value, enabled] of [['true', false], [undefined, true], ['false', true], ['1', true], ['TRUE', true], ['', true]] as const) {
      if (value === undefined) delete process.env.DISABLE_AI; else process.env.DISABLE_AI = value;
      expect(gate.isAiEnabled()).toBe(enabled);
    }
  });

  it('reads the variable at call time, not at import', () => {
    process.env.DISABLE_AI = 'true';
    expect(gate.isAiEnabled()).toBe(false);
    delete process.env.DISABLE_AI;
    expect(gate.isAiEnabled()).toBe(true);
  });

  it('DISABLE_AI or DISABLE_TRANSCRIPTION turns off transcription', () => {
    expect(gate.isTranscriptionEnabled()).toBe(false);          // DISABLE_AI=true
    delete process.env.DISABLE_AI;
    expect(gate.isTranscriptionEnabled()).toBe(true);
    process.env.DISABLE_TRANSCRIPTION = 'true';
    expect(gate.isTranscriptionEnabled()).toBe(false);
    expect(gate.isAiEnabled()).toBe(true);                      // Claude unaffected
  });

  it('the gated client refuses to send, even if a caller skips its own check', () => {
    const client = gate.createAnthropicClient();
    expect(() => client.messages.create({ model: 'm', max_tokens: 1, messages: [] })).toThrow(gate.AiDisabledError);
    expect(() => client.messages.stream({ model: 'm', max_tokens: 1, messages: [] })).toThrow(gate.AiDisabledError);
    expectNoAnthropicCalls();
  });

  it('the gated client passes through when enabled', async () => {
    delete process.env.DISABLE_AI;
    sdk.create.mockResolvedValueOnce({ content: [] });
    const client = gate.createAnthropicClient();
    await client.messages.create({ model: 'm', max_tokens: 1, messages: [] });
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

describe('DISABLE_AI=true — routes return 503 and never call Anthropic', () => {
  it.each(GATED_503)('%s %s', async (method, path, body) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path).send(body);
    expect(res.status).toBe(503);
    expect(res.body.disabled).toBe(true);
    expect(res.body.error).toMatch(/disabled/i);
    expectNoAnthropicCalls();
  });

  it('patient-facing vitals photo gets a patient-worded 503', async () => {
    const res = await request(app)
      .post('/api/questionnaire/session/tok-123/vitals-photo')
      .send({ dataBase64: PNG_1PX, mimeType: 'image/png' });
    expect(res.status).toBe(503);
    expect(res.body.disabled).toBe(true);
    expect(res.body.error).not.toMatch(/DISABLE_AI/);
    expect(dbTouched).not.toHaveBeenCalled();
    expectNoAnthropicCalls();
  });

  it('folder-watcher document extract is skipped, not failed', async () => {
    const res = await request(app).post('/api/documents/doc-1/extract').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, skipped: 'ai_disabled' });
    expectNoAnthropicCalls();
  });

  it('SOAP polish falls back to the deterministic formatter', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const res = await request(app).post('/api/soap/polish').send({ subjective: 'pain', objective: '', assessment: '', plan: '' });
    // Either the deterministic fallback (200) or a 400 on this minimal body —
    // what matters is that nothing reached Anthropic and it didn't 5xx.
    expect(res.status).toBeLessThan(500);
    expectNoAnthropicCalls();
  });
});

describe('DISABLE_AI=true — email intake helpers use their manual-review fallbacks', () => {
  it('classifyMessage returns an "unknown" classification for manual review', async () => {
    const c = await claude.classifyMessage('I need an appointment', 'Booking');
    expect(c.category).toBe('unknown');
    expect(c.confidence).toBe(0);
    expectNoAnthropicCalls();
  });

  it('draftReply returns a safe placeholder for staff to replace', async () => {
    const d = await claude.draftReply({ template: 'general_enquiry', patientFirstName: 'Ann' });
    expect(d.safe).toBe(true);
    expect(d.body).toMatch(/manually/);
    expectNoAnthropicCalls();
  });
});

describe('positive control — the mock does see calls when AI is enabled', () => {
  it('suggest-codes calls messages.create when DISABLE_AI is unset', async () => {
    delete process.env.DISABLE_AI;
    sdk.create.mockResolvedValueOnce({ content: [{ type: 'text', text: '{"icd10":[],"cpt":[]}' }] });
    await request(app).post('/api/suggest-codes').send({ assessment: 'gallstones' });
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });
});

// ── Static guard ──────────────────────────────────────────────────────────────

describe('every Anthropic client is created through lib/ai-gate.ts', () => {
  const srcDir = fileURLToPath(new URL('..', import.meta.url));
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name === 'test' ? [] : walk(p);
      return p.endsWith('.ts') ? [p] : [];
    });
  }

  it('no `new Anthropic(` outside lib/ai-gate.ts', () => {
    const offenders = walk(srcDir)
      .filter(f => relative(srcDir, f) !== join('lib', 'ai-gate.ts'))
      .filter(f => /new\s+Anthropic\s*\(/.test(readFileSync(f, 'utf8')))
      .map(f => relative(srcDir, f));
    expect(offenders).toEqual([]);
  });

  it('OpenAI is only called from call-recording.ts, which checks isTranscriptionEnabled()', () => {
    const callers = walk(srcDir)
      .filter(f => readFileSync(f, 'utf8').includes('api.openai.com'))
      .map(f => relative(srcDir, f));
    expect(callers).toEqual([join('routes', 'call-recording.ts')]);
    expect(readFileSync(join(srcDir, 'routes', 'call-recording.ts'), 'utf8')).toMatch(/isTranscriptionEnabled\(\)/);
  });
});
