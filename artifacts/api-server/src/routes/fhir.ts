/**
 * FHIR R4 export endpoints — read-only, staff-auth required.
 *
 * GET /api/fhir/Patient/:id   — returns a FHIR R4 Patient resource
 * GET /api/fhir/Encounter/:id — returns a FHIR R4 Encounter resource
 *
 * Content-Type is application/fhir+json as per the FHIR spec.
 * Identifiers sourced from the patient_identifiers table (Phase 6).
 */
import { Router } from 'express';
import { getSupabaseAdmin, requireStaffAuth } from '../lib/supabase.js';
import { logger, errStr } from '../lib/logger.js';

const router = Router();
const FHIR_SERVER = process.env.API_BASE_URL ?? 'https://api.amisemedflow.com';

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

    if (ptErr || !pt) {
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

    if (encErr || !enc) {
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

export default router;
