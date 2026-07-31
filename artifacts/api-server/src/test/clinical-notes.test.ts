import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  getStaffUserId:   vi.fn().mockResolvedValue('staff-uuid'),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

const { default: clinicalNotesRouter } = await import('../routes/clinical-notes.js');
const app = express();
app.use(express.json());
app.use(clinicalNotesRouter);

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select      = vi.fn(self);
  obj.insert      = vi.fn(self);
  obj.update      = vi.fn(self);
  obj.eq          = vi.fn(self);
  obj.not         = vi.fn(self);
  obj.in          = vi.fn(self);
  obj.order       = vi.fn(self);
  obj.limit       = vi.fn(self);
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

beforeEach(() => vi.clearAllMocks());

// ── POST /api/clinical-notes ──────────────────────────────────────────────────

describe('POST /api/clinical-notes', () => {
  it('returns 400 when patientId is missing', async () => {
    const res = await request(app).post('/api/clinical-notes')
      .send({ content: 'Patient presents with pain.' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/patientId/i);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(app).post('/api/clinical-notes')
      .send({ patientId: 'pat-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content/i);
  });

  it('returns 400 for invalid noteType', async () => {
    const res = await request(app).post('/api/clinical-notes')
      .send({ patientId: 'pat-1', content: 'Note.', noteType: 'twitter_post' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/noteType/i);
  });

  it('creates a note with status=draft and returns 201', async () => {
    const row = {
      id: 'note-1', note_type: 'soap', status: 'draft',
      content: 'S: chest pain.', signed_by: null, signed_at: null,
      ai_assisted: false, created_at: '2026-07-31T10:00:00Z',
    };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    const res = await request(app).post('/api/clinical-notes')
      .send({ patientId: 'pat-1', content: 'S: chest pain.', noteType: 'soap' });
    expect(res.status).toBe(201);
    expect(res.body.note.id).toBe('note-1');
    expect(res.body.note.status).toBe('draft');
  });

  it('defaults noteType to "other" when not provided', async () => {
    const row = { id: 'note-2', note_type: 'other', status: 'draft', content: 'Note.', ai_assisted: false, created_at: '2026-07-31T10:00:00Z' };
    mockFrom.mockReturnValueOnce(mkChain(ok(row)));
    const res = await request(app).post('/api/clinical-notes')
      .send({ patientId: 'pat-1', content: 'Note.' });
    expect(res.status).toBe(201);
    expect(res.body.note.note_type).toBe('other');
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB error')));
    const res = await request(app).post('/api/clinical-notes')
      .send({ patientId: 'pat-1', content: 'Note.', noteType: 'progress' });
    expect(res.status).toBe(502);
  });
});

// ── GET /api/clinical-notes/patient/:patientId ────────────────────────────────

describe('GET /api/clinical-notes/patient/:patientId', () => {
  it('returns notes list', async () => {
    const notes = [
      { id: 'note-1', encounter_id: 'enc-1', note_type: 'soap', status: 'draft',
        content: 'S: pain.', signed_by: null, signed_at: null, ai_assisted: false, created_at: '2026-07-31T10:00:00Z' },
    ];
    mockFrom.mockReturnValueOnce(mkChain(ok(notes)));
    const res = await request(app).get('/api/clinical-notes/patient/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].id).toBe('note-1');
  });

  it('returns empty array when no notes', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/clinical-notes/patient/pat-1');
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValueOnce(mkChain(err('DB error')));
    const res = await request(app).get('/api/clinical-notes/patient/pat-1');
    expect(res.status).toBe(502);
  });

  it('passes encounterId filter when query param provided', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok([])));
    const res = await request(app).get('/api/clinical-notes/patient/pat-1?encounterId=enc-42');
    expect(res.status).toBe(200);
    const chain = mockFrom.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith('encounter_id', 'enc-42');
  });
});

// ── PATCH /api/clinical-notes/:id ────────────────────────────────────────────

describe('PATCH /api/clinical-notes/:id', () => {
  it('returns 400 for invalid status', async () => {
    const res = await request(app).patch('/api/clinical-notes/note-1').send({ status: 'published' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 404 when note not found', async () => {
    mockFrom.mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/clinical-notes/note-1').send({ content: 'Updated.' });
    expect(res.status).toBe(404);
  });

  it('sets signed_by and signed_at when status=signed', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'note-1', patient_id: 'pat-1', status: 'draft' })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/clinical-notes/note-1').send({ status: 'signed' });
    expect(res.status).toBe(200);
    expect(res.body.signed_by).toBe('staff-uuid');
    expect(res.body.signed_at).toBeDefined();
  });

  it('updates content and returns patch', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'note-1', patient_id: 'pat-1', status: 'draft' })))
      .mockReturnValueOnce(mkChain(ok(null)));
    const res = await request(app).patch('/api/clinical-notes/note-1').send({ content: 'Revised note.' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('note-1');
    expect(res.body.content).toBe('Revised note.');
  });

  it('returns 502 on DB update error', async () => {
    mockFrom
      .mockReturnValueOnce(mkChain(ok({ id: 'note-1', patient_id: 'pat-1', status: 'draft' })))
      .mockReturnValueOnce(mkChain(err('update failed')));
    const res = await request(app).patch('/api/clinical-notes/note-1').send({ content: 'Note.' });
    expect(res.status).toBe(502);
  });
});
