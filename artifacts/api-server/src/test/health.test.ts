/**
 * Health-check and observability route tests.
 * Verifies /api/healthz, /api/healthz/env, /api/readyz, and correlation-ID middleware.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { correlationId } from '../middlewares/correlation.js';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  sb:               () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  getSupabaseAdmin: () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockImplementation((req: { headers: Record<string, string>; query?: Record<string, string> }, res: { status: (n: number) => { json: (v: unknown) => void } }) => {
    // Header-only — query param must not be accepted
    if (req.headers['x-cron-secret'] === 'test-cron-secret') return true;
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }),
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: healthRouter } = await import('../routes/health.js');

const app = express();
app.use(correlationId);
app.use(express.json());
app.use(healthRouter);

const CRON = { 'x-cron-secret': 'test-cron-secret' };

// ── GET /api/healthz ──────────────────────────────────────────────────────────

describe('GET /api/healthz', () => {
  it('returns { status: "ok" } without authentication', async () => {
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('echoes x-correlation-id header from caller', async () => {
    const res = await request(app)
      .get('/api/healthz')
      .set('x-correlation-id', 'caller-id-abc');
    expect(res.headers['x-correlation-id']).toBe('caller-id-abc');
  });

  it('generates a UUID correlation-id when none is provided', async () => {
    const res = await request(app).get('/api/healthz');
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

// ── GET /api/healthz/env ──────────────────────────────────────────────────────

describe('GET /api/healthz/env', () => {
  it('returns 401 without cron secret', async () => {
    const res = await request(app).get('/api/healthz/env');
    expect(res.status).toBe(401);
  });

  it('returns 401 when secret is passed as query param (not accepted)', async () => {
    // requireCronSecret must reject query-param delivery to avoid log leaks
    const res = await request(app).get('/api/healthz/env?secret=test-cron-secret');
    expect(res.status).toBe(401);
  });

  it('returns env check payload with correct header secret', async () => {
    const res = await request(app).get('/api/healthz/env').set(CRON);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode');
    expect(res.body.services).toHaveProperty('supabase');
    expect(res.body.services).toHaveProperty('anthropic');
  });
});

// ── GET /api/readyz ───────────────────────────────────────────────────────────

describe('GET /api/readyz', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 when Supabase probe succeeds', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await request(app).get('/api/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.supabase).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });

  it('returns 503 when Supabase probe returns an error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      limit:  vi.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } }),
    });

    const res = await request(app).get('/api/readyz');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body).toHaveProperty('detail');
  });
});
