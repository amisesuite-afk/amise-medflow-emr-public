/**
 * Health-check and observability route tests.
 * Verifies /api/healthz, /api/healthz/env, and correlation-ID middleware.
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { correlationId } from '../middlewares/correlation.js';

vi.mock('../lib/supabase.js', () => ({
  sb:                () => ({ from: vi.fn(), auth: { getUser: vi.fn() } }),
  getSupabaseAdmin:  () => ({ from: vi.fn(), auth: { getUser: vi.fn() } }),
  requireStaffAuth:  vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockImplementation((req, res) => {
    if (req.headers['x-cron-secret'] === 'test-cron-secret') return true;
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }),
  audit: vi.fn().mockResolvedValue(undefined),
}));

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
    const correlationHeader = 'test-correlation-id-123';
    const res = await request(app)
      .get('/api/healthz')
      .set('x-correlation-id', correlationHeader);
    expect(res.headers['x-correlation-id']).toBe(correlationHeader);
  });

  it('generates a UUID correlation-id when none is provided', async () => {
    const res = await request(app).get('/api/healthz');
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

// ── GET /api/healthz/env ──────────────────────────────────────────────────────

describe('GET /api/healthz/env', () => {
  it('returns 401 without cron secret', async () => {
    const res = await request(app).get('/api/healthz/env');
    expect(res.status).toBe(401);
  });

  it('returns env check payload with correct cron secret', async () => {
    const res = await request(app).get('/api/healthz/env').set(CRON);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mode');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('supabase');
    expect(res.body.services).toHaveProperty('anthropic');
  });
});
