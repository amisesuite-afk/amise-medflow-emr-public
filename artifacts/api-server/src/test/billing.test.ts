/**
 * Integration tests for billing API routes.
 * Supabase is fully mocked — no real DB connections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  sb:               () => ({ from: mockFrom }),
  getSupabaseAdmin: () => ({ from: mockFrom }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: billingRouter } = await import('../routes/billing.js');

const app = express();
app.use(express.json());
app.use(billingRouter);

// ── Chain-builder helper ──────────────────────────────────────────────────────

function mkChain(termResult: unknown) {
  const obj: Record<string, unknown> = {};
  const returnSelf = () => obj;
  obj.select      = vi.fn(returnSelf);
  obj.insert      = vi.fn(returnSelf);
  obj.update      = vi.fn(returnSelf);
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

// ── POST /api/billing/charge ──────────────────────────────────────────────────

describe('POST /api/billing/charge', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/billing/charge')
      .send({ encounterId: 'enc-1' }); // missing patientId, chargeCode, etc.
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('creates a charge and returns chargeId', async () => {
    mockFrom.mockReturnValue(mkChain({ data: { id: 'charge-abc' }, error: null }));

    const res = await request(app)
      .post('/api/billing/charge')
      .send({
        encounterId:       'enc-1',
        patientId:         'pat-1',
        chargeCode:        'C01',
        chargeDescription: 'New patient consultation',
        unitPriceXcd:      350,
        category:          'consultation',
      });

    expect(res.status).toBe(200);
    expect(res.body.chargeId).toBe('charge-abc');
    expect(res.body.status).toBe('pending');
  });

  it('returns 502 on DB error', async () => {
    mockFrom.mockReturnValue(mkChain({ data: null, error: { message: 'DB error' } }));

    const res = await request(app)
      .post('/api/billing/charge')
      .send({
        encounterId: 'enc-1', patientId: 'pat-1',
        chargeCode: 'C01', chargeDescription: 'Consult',
        unitPriceXcd: 200, category: 'consultation',
      });

    expect(res.status).toBe(502);
  });
});

// ── POST /api/billing/invoice/:encounterId ────────────────────────────────────

describe('POST /api/billing/invoice/:encounterId', () => {
  it('returns 404 when no pending charges exist', async () => {
    mockFrom.mockReturnValue(mkChain({ data: [], error: null }));

    const res = await request(app).post('/api/billing/invoice/enc-1');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No pending charges/);
  });

  it('generates invoice number and returns invoiceNumber', async () => {
    const charges = [
      { id: 'c1', charge_code: 'C01', charge_description: 'Consult', category: 'consultation',
        quantity: 1, unit_price_xcd: '350', discount_xcd: '0' },
    ];
    // Call 1: fetch pending charges
    mockFrom.mockReturnValueOnce(mkChain({ data: charges, error: null }));
    // Call 2: count existing invoices for today (to determine sequence)
    mockFrom.mockReturnValueOnce(mkChain({ count: 0, error: null }));
    // Call 3: update charges to invoiced
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app).post('/api/billing/invoice/enc-1');
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{8}-0001$/);
    expect(res.body.totalXcd).toBe(350);
    expect(res.body.chargeCount).toBe(1);
  });

  it('sequential invoice number increments when invoices already exist today', async () => {
    const charges = [
      { id: 'c2', charge_code: 'E01', charge_description: 'OGD', category: 'endoscopy',
        quantity: 1, unit_price_xcd: '1800', discount_xcd: '0' },
    ];
    mockFrom.mockReturnValueOnce(mkChain({ data: charges, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ count: 3, error: null })); // 3 existing → seq = 4
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app).post('/api/billing/invoice/enc-2');
    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{8}-0004$/);
  });
});

// ── POST /api/billing/payment/:invoiceNumber ──────────────────────────────────

describe('POST /api/billing/payment/:invoiceNumber', () => {
  it('returns 400 when paymentMethod is invalid', async () => {
    const res = await request(app)
      .post('/api/billing/payment/INV-20260730-0001')
      .send({ paymentMethod: 'bitcoin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paymentMethod/);
  });

  it('returns 404 when no invoiced charges found', async () => {
    mockFrom.mockReturnValue(mkChain({ data: [], error: null }));

    const res = await request(app)
      .post('/api/billing/payment/INV-20260730-0001')
      .send({ paymentMethod: 'cash' });
    expect(res.status).toBe(404);
  });

  it('records payment and returns paid status', async () => {
    const charges = [{ id: 'c1', status: 'invoiced' }, { id: 'c2', status: 'invoiced' }];
    mockFrom.mockReturnValueOnce(mkChain({ data: charges, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({ error: null })); // update to paid

    const res = await request(app)
      .post('/api/billing/payment/INV-20260730-0001')
      .send({ paymentMethod: 'card' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
    expect(res.body.paymentMethod).toBe('card');
    expect(res.body.chargeCount).toBe(2);
  });

  it('accepts all valid payment methods', async () => {
    const methods = ['cash', 'card', 'insurance', 'transfer', 'waived'];
    for (const method of methods) {
      mockFrom.mockReturnValueOnce(mkChain({ data: [{ id: 'c1', status: 'invoiced' }], error: null }));
      mockFrom.mockReturnValueOnce(mkChain({ error: null }));
      const res = await request(app)
        .post('/api/billing/payment/INV-TEST')
        .send({ paymentMethod: method });
      expect(res.status).toBe(200);
    }
  });
});

// ── GET /api/billing/encounter/:encounterId ───────────────────────────────────

describe('GET /api/billing/encounter/:encounterId', () => {
  it('returns charges with computed lineTotal and summary totals', async () => {
    const charges = [
      { id: 'c1', charge_code: 'C01', charge_description: 'Consult', category: 'consultation',
        quantity: 1, unit_price_xcd: '350', discount_xcd: '50', status: 'paid' },
      { id: 'c2', charge_code: 'E01', charge_description: 'OGD', category: 'endoscopy',
        quantity: 1, unit_price_xcd: '1800', discount_xcd: '0', status: 'invoiced' },
    ];
    mockFrom.mockReturnValue(mkChain({ data: charges, error: null }));

    const res = await request(app).get('/api/billing/encounter/enc-1');
    expect(res.status).toBe(200);
    expect(res.body.charges).toHaveLength(2);
    expect(res.body.subtotalXcd).toBe(2150);   // 350 + 1800
    expect(res.body.discountTotalXcd).toBe(50);
    expect(res.body.netTotalXcd).toBe(2100);
  });

  it('returns empty charges array and zero totals for new encounter', async () => {
    mockFrom.mockReturnValue(mkChain({ data: [], error: null }));

    const res = await request(app).get('/api/billing/encounter/enc-new');
    expect(res.status).toBe(200);
    expect(res.body.charges).toHaveLength(0);
    expect(res.body.netTotalXcd).toBe(0);
  });
});

// ── POST /api/billing/save-and-invoice/:encounterId ──────────────────────────

describe('POST /api/billing/save-and-invoice/:encounterId', () => {
  it('returns 400 when lines is missing', async () => {
    const res = await request(app)
      .post('/api/billing/save-and-invoice/enc-1')
      .send({ patientId: 'pat-1', lines: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when patientId is missing', async () => {
    const res = await request(app)
      .post('/api/billing/save-and-invoice/enc-1')
      .send({ lines: [{ chargeCode: 'C01', chargeDescription: 'Consult', unitPriceXcd: 350, category: 'consultation' }] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when a line item is missing required fields', async () => {
    const res = await request(app)
      .post('/api/billing/save-and-invoice/enc-1')
      .send({
        patientId: 'pat-1',
        lines: [{ chargeCode: 'C01', quantity: 1 }], // missing chargeDescription, unitPriceXcd, category
      });
    expect(res.status).toBe(400);
  });

  it('saves lines and returns invoiceNumber', async () => {
    // Call 1: insert line items
    mockFrom.mockReturnValueOnce(mkChain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null }));
    // Call 2: count today's invoices
    mockFrom.mockReturnValueOnce(mkChain({ count: 0, error: null }));
    // Call 3: update to invoiced
    mockFrom.mockReturnValueOnce(mkChain({ error: null }));

    const res = await request(app)
      .post('/api/billing/save-and-invoice/enc-1')
      .send({
        patientId: 'pat-1',
        lines: [
          { chargeCode: 'C01', chargeDescription: 'New consult', unitPriceXcd: 350, discountXcd: 0, quantity: 1, category: 'consultation' },
          { chargeCode: 'E01', chargeDescription: 'OGD diagnostic', unitPriceXcd: 1800, discountXcd: 0, quantity: 1, category: 'endoscopy' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.invoiceNumber).toMatch(/^INV-\d{8}-0001$/);
    expect(res.body.totalXcd).toBe(2150);
    expect(res.body.chargeCount).toBe(2);
  });
});

// ── GET /api/billing/receipt/:invoiceNumber ───────────────────────────────────

describe('GET /api/billing/receipt/:invoiceNumber', () => {
  it('returns 404 when invoice does not exist', async () => {
    mockFrom.mockReturnValue(mkChain({ data: [], error: null }));

    const res = await request(app).get('/api/billing/receipt/INV-NOTFOUND');
    expect(res.status).toBe(404);
  });

  it('returns receiptHtml for a valid invoice', async () => {
    const charges = [
      {
        id: 'c1', patient_id: 'pat-1', charge_code: 'C01',
        charge_description: 'New patient consultation', category: 'consultation',
        quantity: 1, unit_price_xcd: '350', discount_xcd: '0',
        status: 'paid', invoice_number: 'INV-20260730-0001',
        invoiced_at: '2026-07-30T10:00:00Z', paid_at: '2026-07-30T10:05:00Z',
        payment_method: 'cash',
      },
    ];
    // Call 1: fetch charges for invoice
    mockFrom.mockReturnValueOnce(mkChain({ data: charges, error: null }));
    // Call 2: fetch patient name
    mockFrom.mockReturnValueOnce(mkChain({
      data: { first_name: 'Jane', last_name: 'Doe', date_of_birth: '1980-01-01' },
      error: null,
    }));

    const res = await request(app).get('/api/billing/receipt/INV-20260730-0001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('receiptHtml');
    expect(typeof res.body.receiptHtml).toBe('string');
    expect(res.body.receiptHtml).toContain('INV-20260730-0001');
    expect(res.body.receiptHtml).toContain('Amise Medical Services');
    expect(res.body.receiptHtml).toContain('Jane Doe');
    expect(res.body.receiptHtml).toContain('350');
  });

  it('receipt includes PAID badge for fully paid invoice', async () => {
    const charges = [
      {
        id: 'c1', patient_id: 'pat-1', charge_code: 'C01',
        charge_description: 'Consult', category: 'consultation',
        quantity: 1, unit_price_xcd: '200', discount_xcd: '0',
        status: 'paid', invoice_number: 'INV-20260730-0002',
        invoiced_at: '2026-07-30T10:00:00Z', paid_at: '2026-07-30T10:10:00Z',
        payment_method: 'card',
      },
    ];
    mockFrom.mockReturnValueOnce(mkChain({ data: charges, error: null }));
    mockFrom.mockReturnValueOnce(mkChain({
      data: { first_name: 'John', last_name: 'Smith' },
      error: null,
    }));

    const res = await request(app).get('/api/billing/receipt/INV-20260730-0002');
    expect(res.status).toBe(200);
    expect(res.body.receiptHtml).toContain('PAID');
  });
});
