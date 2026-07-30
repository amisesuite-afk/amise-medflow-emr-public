/**
 * FHIR R4 export endpoints — read-only, staff-auth required.
 *
 * Individual resources (by id):
 *   GET /api/fhir/Patient/:id
 *   GET /api/fhir/Encounter/:id
 *
 * Search bundles (by query param):
 *   GET /api/fhir/Observation?patient=<id>&encounter=<id>
 *   GET /api/fhir/MedicationRequest?patient=<id>
 *   GET /api/fhir/AllergyIntolerance?patient=<id>
 *   GET /api/fhir/DiagnosticReport?patient=<id>&encounter=<id>
 *
 * Content-Type is application/fhir+json as per the FHIR spec.
 */
import { Router } from 'express';
import { getSupabaseAdmin, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';
import { logAudit } from '../lib/audit.js';

const router = Router();
const FHIR_SERVER = process.env.API_BASE_URL ?? 'https://api.amisemedflow.com';

// ── shared bundle helpers ─────────────────────────────────────────────────────

function fhirBundle(resources: unknown[]): unknown {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map(r => ({
      fullUrl: `${FHIR_SERVER}/fhir/${(r as Record<string, string>).resourceType}/${(r as Record<string, string>).id}`,
      resource: r,
    })),
  };
}

/** Accept bare UUID or "ResourceType/<uuid>" reference. */
function extractId(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  const parts = ref.split('/');
  return parts[parts.length - 1] || undefined;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function sexToFhir(sex: string | null): string {
  switch (sex) {
    case 'male':   return 'male';
    case 'female': return 'female';
    case 'other':  return 'other';
    default:       return 'unknown';
  }
}

function encounterStatusToFhir(status: string): string {
  switch (status) {
    case 'open':        return 'in-progress';
    case 'in_progress': return 'in-progress';
    case 'closed':      return 'finished';
    case 'cancelled':   return 'cancelled';
    default:            return 'unknown';
  }
}

function encounterClassCode(type: string): { system: string; code: string; display: string } {
  switch (type) {
    case 'inpatient':  return { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP',  display: 'inpatient encounter' };
    case 'emergency':  return { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'EMER', display: 'emergency' };
    case 'telehealth': return { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR',   display: 'virtual' };
    default:           return { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB',  display: 'ambulatory' };
  }
}

function identifierSystemUri(system: string): string {
  switch (system) {
    case 'mrn':       return `${FHIR_SERVER}/fhir/NamingSystem/mrn`;
    case 'nhi':       return 'urn:oid:2.16.840.1.113883.4.1'; // US NHI example; adapt as needed
    case 'insurance': return `${FHIR_SERVER}/fhir/NamingSystem/insurance`;
    case 'fhir':      return 'http://hl7.org/fhir/NamingSystem/fhir-id';
    default:          return `${FHIR_SERVER}/fhir/NamingSystem/${system}`;
  }
}

// ── GET /api/fhir/Patient/:id ─────────────────────────────────────────────────

router.get('/api/fhir/Patient/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params as { id: string };
  const supa = getSupabaseAdmin();

  try {
    const { data: pt, error: ptErr } = await supa
      .from('patients')
      .select('id, full_name, date_of_birth, sex, phone, email, mrn, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (ptErr) {
      res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: ptErr.message }] });
      return;
    }
    if (!pt) {
      res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Patient not found' }] });
      return;
    }

    const { data: identifiers } = await supa
      .from('patient_identifiers')
      .select('system, value, issuer, is_primary')
      .eq('patient_id', id);

    const fhirIdentifiers = [
      // Core MRN from patients.mrn (canonical)
      pt.mrn ? { use: 'official', system: identifierSystemUri('mrn'), value: pt.mrn } : null,
      // Structured identifiers from patient_identifiers table
      ...(identifiers ?? []).map((i: Record<string, unknown>) => ({
        use: i.is_primary ? 'official' : 'secondary',
        system: identifierSystemUri(i.system as string),
        value: i.value as string,
        assigner: i.issuer ? { display: i.issuer as string } : undefined,
      })),
    ].filter(Boolean);

    const telecoms: Array<{ system: string; value: string; use: string }> = [];
    if (pt.phone) telecoms.push({ system: 'phone', value: pt.phone as string, use: 'mobile' });
    if (pt.email) telecoms.push({ system: 'email', value: pt.email as string, use: 'home' });

    const patient = {
      resourceType: 'Patient',
      id: pt.id,
      meta: {
        versionId: '1',
        lastUpdated: pt.updated_at ?? pt.created_at,
        profile: ['http://hl7.org/fhir/R4/StructureDefinition/Patient'],
      },
      identifier: fhirIdentifiers,
      name: [{ use: 'official', text: pt.full_name }],
      ...(telecoms.length ? { telecom: telecoms } : {}),
      ...(pt.sex ? { gender: sexToFhir(pt.sex as string) } : {}),
      ...(pt.date_of_birth ? { birthDate: pt.date_of_birth } : {}),
    };

    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(patient);
    logger.info({ patientId: id }, '[fhir] Patient exported');
    void logAudit(req, 'export', 'patient', id, id, { format: 'fhir_r4', resource: 'Patient' });
  } catch (err) {
    logger.error({ err }, '[fhir] Patient export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

// ── GET /api/fhir/Encounter/:id ───────────────────────────────────────────────

router.get('/api/fhir/Encounter/:id', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const { id } = req.params as { id: string };
  const supa = getSupabaseAdmin();

  try {
    const { data: enc, error: encErr } = await supa
      .from('encounters')
      .select('id, patient_id, encounter_date, encounter_type, chief_complaint, status, site, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (encErr) {
      res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: encErr.message }] });
      return;
    }
    if (!enc) {
      res.status(404).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-found', diagnostics: 'Encounter not found' }] });
      return;
    }

    const encounter = {
      resourceType: 'Encounter',
      id: enc.id,
      meta: {
        versionId: '1',
        lastUpdated: enc.updated_at ?? enc.created_at,
        profile: ['http://hl7.org/fhir/R4/StructureDefinition/Encounter'],
      },
      status: encounterStatusToFhir(enc.status as string),
      class: encounterClassCode(enc.encounter_type as string),
      type: enc.chief_complaint
        ? [{ text: enc.chief_complaint }]
        : undefined,
      subject: {
        reference: `Patient/${enc.patient_id}`,
        type: 'Patient',
      },
      period: {
        start: enc.encounter_date,
      },
      ...(enc.site ? {
        location: [{
          location: { display: enc.site as string },
          status: 'completed',
        }],
      } : {}),
    };

    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(encounter);
    logger.info({ encounterId: id }, '[fhir] Encounter exported');
  } catch (err) {
    logger.error({ err }, '[fhir] Encounter export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

// ── GET /api/fhir/Observation ─────────────────────────────────────────────────
// Vital signs from the vitals table, coded with LOINC.
// Query: ?patient=<uuid> and/or ?encounter=<uuid>

const VITAL_LOINC: Record<string, { code: string; display: string; unit: string }> = {
  bp_systolic:       { code: '8480-6',  display: 'Systolic blood pressure',       unit: 'mm[Hg]'  },
  bp_diastolic:      { code: '8462-4',  display: 'Diastolic blood pressure',      unit: 'mm[Hg]'  },
  heart_rate:        { code: '8867-4',  display: 'Heart rate',                    unit: '/min'    },
  temperature_c:     { code: '8310-5',  display: 'Body temperature',              unit: 'Cel'     },
  oxygen_saturation: { code: '59408-5', display: 'Oxygen saturation',             unit: '%'       },
  respiratory_rate:  { code: '9279-1',  display: 'Respiratory rate',              unit: '/min'    },
  weight_kg:         { code: '29463-7', display: 'Body weight',                   unit: 'kg'      },
  height_cm:         { code: '8302-2',  display: 'Body height',                   unit: 'cm'      },
  bmi:               { code: '39156-5', display: 'Body mass index (BMI) [Ratio]', unit: 'kg/m2'   },
  glucose_mmol:      { code: '2339-0',  display: 'Glucose [Mass/volume] in Blood', unit: 'mmol/L' },
};

function vitalsToObservations(vitals: Record<string, unknown>[]): unknown[] {
  const obs: unknown[] = [];
  for (const v of vitals) {
    for (const [field, loinc] of Object.entries(VITAL_LOINC)) {
      const value = v[field];
      if (value == null) continue;
      obs.push({
        resourceType: 'Observation',
        id: `${v.id as string}-${field}`,
        meta: { profile: ['http://hl7.org/fhir/R4/StructureDefinition/vitalsigns'] },
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{ system: 'http://loinc.org', code: loinc.code, display: loinc.display }],
          text: loinc.display,
        },
        subject: { reference: `Patient/${v.patient_id as string}` },
        encounter: { reference: `Encounter/${v.encounter_id as string}` },
        effectiveDateTime: v.recorded_at,
        valueQuantity: {
          value: Number(value),
          unit: loinc.unit,
          system: 'http://unitsofmeasure.org',
          code: loinc.unit,
        },
      });
    }
  }
  return obs;
}

router.get('/api/fhir/Observation', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const patientId   = extractId(req.query['patient']   as string | undefined);
  const encounterId = extractId(req.query['encounter'] as string | undefined);

  if (!patientId && !encounterId) {
    res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'Either patient or encounter query parameter is required' }] });
    return;
  }

  const supa = getSupabaseAdmin();
  try {
    let query = supa.from('vitals').select('*');
    if (patientId)   query = query.eq('patient_id', patientId);
    if (encounterId) query = query.eq('encounter_id', encounterId);
    const { data, error } = await query.order('recorded_at', { ascending: false });
    if (error) throw new Error(error.message);

    const resources = vitalsToObservations((data ?? []) as Record<string, unknown>[]);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirBundle(resources));
    logger.info({ patientId, encounterId, count: resources.length }, '[fhir] Observation bundle exported');
  } catch (err) {
    logger.error({ err }, '[fhir] Observation export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

// ── GET /api/fhir/MedicationRequest ──────────────────────────────────────────
// Query: ?patient=<uuid>

function medicationStatus(status: string): string {
  switch (status) {
    case 'active':    return 'active';
    case 'stopped':   return 'stopped';
    case 'completed': return 'completed';
    case 'on_hold':   return 'on-hold';
    default:          return 'unknown';
  }
}

router.get('/api/fhir/MedicationRequest', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const patientId = extractId(req.query['patient'] as string | undefined);
  if (!patientId) {
    res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient query parameter is required' }] });
    return;
  }

  const supa = getSupabaseAdmin();
  try {
    const { data, error } = await supa
      .from('medications')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const resources = ((data ?? []) as Record<string, unknown>[]).map(m => {
      const dosage: Record<string, unknown> = {};
      if (m.route)     dosage['route']  = { text: m.route };
      if (m.frequency) dosage['timing'] = { code: { text: m.frequency } };
      if (m.dose)      dosage['doseAndRate'] = [{ doseQuantity: { unit: m.dose } }];

      return {
        resourceType: 'MedicationRequest',
        id: m.id,
        meta: { profile: ['http://hl7.org/fhir/R4/StructureDefinition/MedicationRequest'] },
        status: medicationStatus(m.status as string),
        intent: 'order',
        medicationCodeableConcept: { text: m.drug_name },
        subject: { reference: `Patient/${m.patient_id as string}` },
        ...(m.encounter_id ? { encounter: { reference: `Encounter/${m.encounter_id as string}` } } : {}),
        ...(m.start_date   ? { authoredOn: m.start_date } : {}),
        ...(m.indication   ? { reasonCode: [{ text: m.indication }] } : {}),
        ...(Object.keys(dosage).length ? { dosageInstruction: [dosage] } : {}),
      };
    });

    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirBundle(resources));
    logger.info({ patientId, count: resources.length }, '[fhir] MedicationRequest bundle exported');
  } catch (err) {
    logger.error({ err }, '[fhir] MedicationRequest export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

// ── GET /api/fhir/AllergyIntolerance ─────────────────────────────────────────
// Query: ?patient=<uuid>

function allergenCriticality(severity: string | null | undefined): string {
  switch (severity) {
    case 'life_threatening':
    case 'severe':   return 'high';
    case 'mild':     return 'low';
    default:         return 'unable-to-assess';
  }
}

router.get('/api/fhir/AllergyIntolerance', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const patientId = extractId(req.query['patient'] as string | undefined);
  if (!patientId) {
    res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'patient query parameter is required' }] });
    return;
  }

  const supa = getSupabaseAdmin();
  try {
    const { data, error } = await supa
      .from('allergies')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const resources = ((data ?? []) as Record<string, unknown>[]).map(a => {
      const clinicalCode = a.status === 'active' ? 'active' : a.status === 'resolved' ? 'resolved' : 'inactive';
      const fhirSeverity = a.severity === 'life_threatening' ? 'severe' : (a.severity ?? 'mild') as string;
      return {
        resourceType: 'AllergyIntolerance',
        id: a.id,
        meta: { profile: ['http://hl7.org/fhir/R4/StructureDefinition/AllergyIntolerance'] },
        clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: clinicalCode }] },
        criticality: allergenCriticality(a.severity as string | null),
        code: { text: a.allergen },
        patient: { reference: `Patient/${a.patient_id as string}` },
        recordedDate: a.created_at,
        ...(a.reaction ? { reaction: [{ manifestation: [{ text: a.reaction }], severity: fhirSeverity }] } : {}),
      };
    });

    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirBundle(resources));
    logger.info({ patientId, count: resources.length }, '[fhir] AllergyIntolerance bundle exported');
  } catch (err) {
    logger.error({ err }, '[fhir] AllergyIntolerance export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

// ── GET /api/fhir/DiagnosticReport ───────────────────────────────────────────
// Maps assessments (ICD-10 coded diagnoses) to FHIR DiagnosticReport.
// Query: ?patient=<uuid> and/or ?encounter=<uuid>

router.get('/api/fhir/DiagnosticReport', async (req, res) => {
  if (!(await requireStaffAuth(req, res))) return;

  const patientId   = extractId(req.query['patient']   as string | undefined);
  const encounterId = extractId(req.query['encounter'] as string | undefined);

  if (!patientId && !encounterId) {
    res.status(400).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'required', diagnostics: 'Either patient or encounter query parameter is required' }] });
    return;
  }

  const supa = getSupabaseAdmin();
  try {
    let query = supa.from('assessments').select('*');
    if (patientId)   query = query.eq('patient_id', patientId);
    if (encounterId) query = query.eq('encounter_id', encounterId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const resources = ((data ?? []) as Record<string, unknown>[]).map(a => ({
      resourceType: 'DiagnosticReport',
      id: a.id,
      meta: { profile: ['http://hl7.org/fhir/R4/StructureDefinition/DiagnosticReport'] },
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] }],
      code: a.icd10_code
        ? { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: a.icd10_code, display: a.diagnosis ?? a.icd10_code }], text: a.diagnosis ?? a.icd10_code }
        : { text: (a.diagnosis as string | null) ?? 'Assessment' },
      subject:   { reference: `Patient/${a.patient_id as string}` },
      encounter: { reference: `Encounter/${a.encounter_id as string}` },
      effectiveDateTime: a.created_at,
      issued: a.created_at,
      ...(a.notes ? { conclusion: a.notes } : {}),
    }));

    res.setHeader('Content-Type', 'application/fhir+json');
    res.json(fhirBundle(resources));
    logger.info({ patientId, encounterId, count: resources.length }, '[fhir] DiagnosticReport bundle exported');
  } catch (err) {
    logger.error({ err }, '[fhir] DiagnosticReport export error');
    res.status(502).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception', diagnostics: errStr(err) }] });
  }
});

export default router;
