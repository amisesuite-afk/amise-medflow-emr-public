/**
 * FHIR R4 route tests.
 * requireStaffAuth is bypassed (always returns true).
 * All Supabase queries are mocked — no network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Supabase mock ─────────────────────────────────────────────────────────────

type QueryResult = { data: unknown; error: null | { message: string } };

function makeQuery(result: QueryResult) {
  const q: Record<string, unknown> & { _result: QueryResult } = {
    _result: result,
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  for (const m of ['select','update','insert','delete','upsert','eq','neq','in','not','order','limit']) {
    q[m] = vi.fn().mockReturnValue(q);
  }
  q['maybeSingle'] = vi.fn().mockResolvedValue(result);
  q['single']      = vi.fn().mockResolvedValue(result);
  return q;
}

const mockFrom = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  sb:               () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  getSupabaseAdmin: () => ({ from: mockFrom, auth: { getUser: vi.fn() } }),
  requireStaffAuth: vi.fn().mockResolvedValue(true),
  requireCronSecret: vi.fn().mockReturnValue(true),
  audit:            vi.fn().mockResolvedValue(undefined),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

const { default: fhirRouter } = await import('../routes/fhir.js');
const app = express();
app.use(express.json());
app.use(fhirRouter);

const AUTH = { 'x-staff-token': 'test-cron-secret' };

// ── helpers ───────────────────────────────────────────────────────────────────

const ok   = (data: unknown): QueryResult => ({ data, error: null });
const dbErr = (msg: string): QueryResult  => ({ data: null, error: { message: msg } });

const PATIENT = {
  id: 'pat-1', full_name: 'Alice Example', date_of_birth: '1980-05-10',
  sex: 'female', phone: '+1758555000', email: 'alice@example.com',
  mrn: 'MRN001', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
};

const ENCOUNTER = {
  id: 'enc-1', patient_id: 'pat-1', encounter_date: '2024-06-01',
  encounter_type: 'outpatient', chief_complaint: 'Abdominal pain',
  status: 'closed', site: 'Rodney Bay',
  created_at: '2024-06-01T08:00:00Z', updated_at: '2024-06-01T10:00:00Z',
};

const VITALS_ROW = {
  id: 'vit-1', encounter_id: 'enc-1', patient_id: 'pat-1',
  bp_systolic: 120, bp_diastolic: 80, heart_rate: 72, temperature_c: 37.0,
  oxygen_saturation: 99, respiratory_rate: 16, weight_kg: 65.0, height_cm: 165.0,
  bmi: null, glucose_mmol: 5.4, recorded_at: '2024-06-01T08:05:00Z',
};

const MEDICATION = {
  id: 'med-1', patient_id: 'pat-1', encounter_id: 'enc-1',
  drug_name: 'Omeprazole', dose: '20 mg', frequency: 'Once daily',
  route: 'oral', indication: 'GERD', start_date: '2024-06-01',
  status: 'active', created_at: '2024-06-01T00:00:00Z',
};

const ALLERGY = {
  id: 'all-1', patient_id: 'pat-1', allergen: 'Penicillin',
  reaction: 'Urticaria', severity: 'moderate', status: 'active',
  created_at: '2024-06-01T00:00:00Z',
};

const ASSESSMENT = {
  id: 'ass-1', patient_id: 'pat-1', encounter_id: 'enc-1',
  icd10_code: 'K80.2', diagnosis: 'Calculus of gallbladder without cholecystitis',
  notes: 'Ultrasound confirmed gallstones', created_at: '2024-06-01T09:00:00Z',
};

// ── GET /api/fhir/Patient/:id ─────────────────────────────────────────────────

describe('GET /api/fhir/Patient/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a FHIR R4 Patient with application/fhir+json content-type', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok(PATIENT)));
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));   // patient_identifiers

    const res = await request(app).get('/api/fhir/Patient/pat-1').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/fhir\+json/);
    expect(res.body.resourceType).toBe('Patient');
    expect(res.body.id).toBe('pat-1');
    expect(res.body.name[0].text).toBe('Alice Example');
    expect(res.body.gender).toBe('female');
    expect(res.body.birthDate).toBe('1980-05-10');
  });

  it('includes MRN identifier in identifier array', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok(PATIENT)));
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));

    const res = await request(app).get('/api/fhir/Patient/pat-1').set(AUTH);

    expect(res.body.identifier).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'MRN001', use: 'official' })])
    );
  });

  it('returns 404 OperationOutcome when patient not found', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok(null)));

    const res = await request(app).get('/api/fhir/Patient/missing').set(AUTH);

    expect(res.status).toBe(404);
    expect(res.body.resourceType).toBe('OperationOutcome');
    expect(res.body.issue[0].code).toBe('not-found');
  });

  it('returns 502 OperationOutcome on DB error', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(dbErr('connection reset')));

    const res = await request(app).get('/api/fhir/Patient/pat-1').set(AUTH);

    expect(res.status).toBe(502);
    expect(res.body.resourceType).toBe('OperationOutcome');
  });
});

// ── GET /api/fhir/Encounter/:id ───────────────────────────────────────────────

describe('GET /api/fhir/Encounter/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a FHIR R4 Encounter', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok(ENCOUNTER)));

    const res = await request(app).get('/api/fhir/Encounter/enc-1').set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Encounter');
    expect(res.body.id).toBe('enc-1');
    expect(res.body.status).toBe('finished');
    expect(res.body.subject.reference).toBe('Patient/pat-1');
    expect(res.body.location[0].location.display).toBe('Rodney Bay');
  });

  it('maps encounter status correctly', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok({ ...ENCOUNTER, status: 'open' })));
    const res = await request(app).get('/api/fhir/Encounter/enc-1').set(AUTH);
    expect(res.body.status).toBe('in-progress');
  });

  it('returns 404 when encounter not found', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok(null)));
    const res = await request(app).get('/api/fhir/Encounter/missing').set(AUTH);
    expect(res.status).toBe(404);
    expect(res.body.resourceType).toBe('OperationOutcome');
  });
});

// ── GET /api/fhir/Observation ─────────────────────────────────────────────────

describe('GET /api/fhir/Observation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Bundle of Observations for a patient', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([VITALS_ROW])));

    const res = await request(app)
      .get('/api/fhir/Observation?patient=pat-1')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    expect(res.body.type).toBe('searchset');
    expect(res.body.total).toBeGreaterThan(0);
    // One Observation per non-null vital field
    const codes = res.body.entry.map((e: { resource: { code: { coding: { code: string }[] } } }) => e.resource.code.coding[0].code);
    expect(codes).toContain('8480-6');   // systolic BP
    expect(codes).toContain('59408-5');  // SpO2
    expect(codes).not.toContain('39156-5'); // BMI is null → excluded
  });

  it('accepts encounter query param and strips resource prefix', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([VITALS_ROW])));

    const res = await request(app)
      .get('/api/fhir/Observation?encounter=Encounter/enc-1')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('returns 400 when neither patient nor encounter is provided', async () => {
    const res = await request(app).get('/api/fhir/Observation').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.resourceType).toBe('OperationOutcome');
  });

  it('returns empty Bundle when no vitals exist', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([])));
    const res = await request(app).get('/api/fhir/Observation?patient=pat-2').set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.entry).toHaveLength(0);
  });
});

// ── GET /api/fhir/MedicationRequest ──────────────────────────────────────────

describe('GET /api/fhir/MedicationRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Bundle of MedicationRequest resources', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([MEDICATION])));

    const res = await request(app)
      .get('/api/fhir/MedicationRequest?patient=pat-1')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    expect(res.body.total).toBe(1);

    const med = res.body.entry[0].resource;
    expect(med.resourceType).toBe('MedicationRequest');
    expect(med.status).toBe('active');
    expect(med.medicationCodeableConcept.text).toBe('Omeprazole');
    expect(med.reasonCode[0].text).toBe('GERD');
  });

  it('returns 400 when patient param is missing', async () => {
    const res = await request(app).get('/api/fhir/MedicationRequest').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.resourceType).toBe('OperationOutcome');
  });

  it('maps medication status: on_hold → on-hold', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([{ ...MEDICATION, status: 'on_hold' }])));
    const res = await request(app).get('/api/fhir/MedicationRequest?patient=pat-1').set(AUTH);
    expect(res.body.entry[0].resource.status).toBe('on-hold');
  });
});

// ── GET /api/fhir/AllergyIntolerance ─────────────────────────────────────────

describe('GET /api/fhir/AllergyIntolerance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Bundle of AllergyIntolerance resources', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([ALLERGY])));

    const res = await request(app)
      .get('/api/fhir/AllergyIntolerance?patient=pat-1')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);

    const allergy = res.body.entry[0].resource;
    expect(allergy.resourceType).toBe('AllergyIntolerance');
    expect(allergy.code.text).toBe('Penicillin');
    expect(allergy.criticality).toBe('unable-to-assess');  // moderate
    expect(allergy.reaction[0].manifestation[0].text).toBe('Urticaria');
  });

  it('maps life_threatening severity to criticality: high', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([{ ...ALLERGY, severity: 'life_threatening' }])));
    const res = await request(app).get('/api/fhir/AllergyIntolerance?patient=pat-1').set(AUTH);
    expect(res.body.entry[0].resource.criticality).toBe('high');
  });

  it('returns 400 when patient param is missing', async () => {
    const res = await request(app).get('/api/fhir/AllergyIntolerance').set(AUTH);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/fhir/DiagnosticReport ───────────────────────────────────────────

describe('GET /api/fhir/DiagnosticReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a Bundle of DiagnosticReport resources with ICD-10 codes', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([ASSESSMENT])));

    const res = await request(app)
      .get('/api/fhir/DiagnosticReport?patient=pat-1')
      .set(AUTH);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);

    const report = res.body.entry[0].resource;
    expect(report.resourceType).toBe('DiagnosticReport');
    expect(report.status).toBe('final');
    expect(report.code.coding[0].code).toBe('K80.2');
    expect(report.conclusion).toBe('Ultrasound confirmed gallstones');
    expect(report.subject.reference).toBe('Patient/pat-1');
  });

  it('falls back to text-only code when no ICD-10 code present', async () => {
    mockFrom.mockReturnValueOnce(makeQuery(ok([{ ...ASSESSMENT, icd10_code: null }])));
    const res = await request(app).get('/api/fhir/DiagnosticReport?encounter=enc-1').set(AUTH);
    expect(res.status).toBe(200);
    const report = res.body.entry[0].resource;
    expect(report.code.coding).toBeUndefined();
    expect(report.code.text).toBeTruthy();
  });

  it('returns 400 when neither patient nor encounter is provided', async () => {
    const res = await request(app).get('/api/fhir/DiagnosticReport').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.resourceType).toBe('OperationOutcome');
  });
});
