import { NextRequest, NextResponse } from 'next/server';
import { createBookingRequest, logAudit } from '@/lib/supabase';
import type { BookingTrack } from '@/lib/scheduling';

export const runtime = 'nodejs';

// ── FHIR R4 Types (inline — no external FHIR library) ────────────────────────

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

interface FhirReference {
  reference?: string;
  display?: string;
}

interface FhirHumanName {
  use?: string;
  family?: string;
  given?: string[];
  text?: string;
}

interface FhirContactPoint {
  system?: string;
  value?: string;
  use?: string;
}

interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  name?: FhirHumanName[];
  birthDate?: string;
  telecom?: FhirContactPoint[];
}

interface FhirPractitioner {
  resourceType: 'Practitioner';
  id?: string;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
}

interface FhirServiceRequest {
  resourceType: 'ServiceRequest';
  id?: string;
  status: string;
  intent: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  requester?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  note?: Array<{ text: string }>;
  contained?: Array<FhirPatient | FhirPractitioner | { resourceType: string; [k: string]: unknown }>;
}

interface FhirBundle {
  resourceType: 'Bundle';
  entry?: Array<{ resource?: { resourceType: string; [k: string]: unknown } }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildHumanName(name?: FhirHumanName[]): string {
  if (!name || name.length === 0) return '';
  const n = name[0];
  if (n.text) return n.text;
  const parts: string[] = [];
  if (n.given && n.given.length > 0) parts.push(...n.given);
  if (n.family) parts.push(n.family);
  return parts.join(' ').trim();
}

function getTelecom(telecom: FhirContactPoint[] | undefined, system: string): string | undefined {
  return telecom?.find(t => t.system === system)?.value;
}

function fhirOperationOutcome(
  severity: 'information' | 'error' | 'warning',
  code: string,
  detailText: string,
  id?: string,
): object {
  return {
    resourceType: 'OperationOutcome',
    ...(id ? { id } : {}),
    issue: [
      {
        severity,
        code,
        details: { text: detailText },
      },
    ],
  };
}

const FHIR_CONTENT_TYPE = 'application/fhir+json';

function fhirResponse(body: object, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Content-Type': FHIR_CONTENT_TYPE },
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Check Content-Type
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/fhir+json') && !ct.includes('application/json')) {
    return fhirResponse(
      fhirOperationOutcome('error', 'invalid', 'Content-Type must be application/fhir+json or application/json.'),
      415,
    );
  }

  // 1. Parse body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fhirResponse(
      fhirOperationOutcome('error', 'invalid', 'Request body is not valid JSON.'),
      400,
    );
  }

  // 2. Extract ServiceRequest from Bundle or direct
  let serviceRequest: FhirServiceRequest | null = null;

  if (rawBody && typeof rawBody === 'object' && (rawBody as { resourceType?: string }).resourceType === 'Bundle') {
    const bundle = rawBody as FhirBundle;
    const entry = bundle.entry?.find(
      e => e.resource?.resourceType === 'ServiceRequest',
    );
    if (entry?.resource) {
      serviceRequest = entry.resource as unknown as FhirServiceRequest;
    }
  } else if (
    rawBody && typeof rawBody === 'object' &&
    (rawBody as { resourceType?: string }).resourceType === 'ServiceRequest'
  ) {
    serviceRequest = rawBody as FhirServiceRequest;
  }

  // 3. Validate ServiceRequest
  if (!serviceRequest) {
    return fhirResponse(
      fhirOperationOutcome('error', 'invalid', 'Request must contain a FHIR R4 ServiceRequest resource.'),
      400,
    );
  }

  if (serviceRequest.status === 'revoked' || serviceRequest.status === 'entered-in-error') {
    return fhirResponse(
      fhirOperationOutcome('error', 'business-rule', `ServiceRequest with status '${serviceRequest.status}' cannot be processed.`),
      422,
    );
  }

  // 4. Extract patient from contained or subject.display
  const contained = serviceRequest.contained ?? [];
  const containedPatient = contained.find(
    (r): r is FhirPatient => r.resourceType === 'Patient',
  ) as FhirPatient | undefined;

  const containedPractitioner = contained.find(
    (r): r is FhirPractitioner => r.resourceType === 'Practitioner',
  ) as FhirPractitioner | undefined;

  // 6. Build patient name
  const patientName = buildHumanName(containedPatient?.name) || serviceRequest.subject?.display || 'Unknown Patient';

  // 7. Build practitioner name
  const practitionerName = buildHumanName(containedPractitioner?.name) || serviceRequest.requester?.display || 'Unknown Provider';

  // 8. Map FHIR priority to internal priority
  const fhirPriority = serviceRequest.priority;
  let internalPriority: 'routine' | 'priority' | 'urgent';
  if (fhirPriority === 'stat' || fhirPriority === 'asap') {
    internalPriority = 'urgent';
  } else if (fhirPriority === 'urgent') {
    internalPriority = 'priority';
  } else {
    internalPriority = 'routine';
  }

  // 9. Extract clinical reason
  const clinicalReason =
    serviceRequest.reasonCode?.[0]?.text ??
    serviceRequest.reasonCode?.[0]?.coding?.[0]?.display ??
    serviceRequest.note?.[0]?.text ??
    'Referral via FHIR ServiceRequest';

  // 10. Extract patient phone and email from contained Patient telecom
  const patientPhone = getTelecom(containedPatient?.telecom, 'phone');
  const patientEmail = getTelecom(containedPatient?.telecom, 'email');
  const patientDob   = containedPatient?.birthDate ?? '';

  // 12. Extract referrer phone and email from contained Practitioner telecom
  const referrerPhone = getTelecom(containedPractitioner?.telecom, 'phone');
  const referrerEmail = getTelecom(containedPractitioner?.telecom, 'email') ?? 'fhir-integration@unknown';

  // 13. Generate referral ID
  const referralId = `FHIR-${Date.now().toString(36).toUpperCase()}`;

  // 14. Map priority to triage_acuity and BookingTrack
  const track: BookingTrack = internalPriority === 'urgent' ? 'urgent' : 'referral';
  const triage_acuity: string = internalPriority === 'urgent' ? 'urgent' : 'priority';

  // Build appointment type from code
  const appointmentType = serviceRequest.code?.coding?.[0]?.code ?? serviceRequest.code?.text ?? 'new_consult';

  // Build notes
  const noteLines: string[] = [
    'FHIR R4 GP REFERRAL',
    `Referring Practitioner: ${practitionerName}`,
  ];
  if (referrerPhone) noteLines.push(`Referrer Phone: ${referrerPhone}`);
  if (referrerEmail) noteLines.push(`Referrer Email: ${referrerEmail}`);
  if (patientDob)    noteLines.push(`Patient DOB: ${patientDob}`);
  if (serviceRequest.id) noteLines.push(`FHIR Resource ID: ${serviceRequest.id}`);
  noteLines.push('', `Referral ID: ${referralId}`, `Priority: ${internalPriority.toUpperCase()}`);

  // Add all notes from ServiceRequest
  if (serviceRequest.note && serviceRequest.note.length > 1) {
    noteLines.push('', 'ADDITIONAL NOTES:');
    serviceRequest.note.slice(1).forEach(n => noteLines.push(n.text));
  }

  const notes = noteLines.join('\n');

  // 15. Create booking request
  let row;
  try {
    row = await createBookingRequest({
      patient_name:     patientName,
      patient_email:    patientEmail ?? null,
      patient_phone:    patientPhone ?? '',
      appointment_type: appointmentType,
      location:         '',
      preferred_slot:   null,
      reason:           `[GP REFERRAL: ${practitionerName}] ${clinicalReason}`,
      triage_acuity,
      status:           'pending',
      notes,
      confirmed_slot:   null,
      google_event_id:  null,
    });
  } catch (err) {
    console.error('[referral/fhir] createBookingRequest failed:', err);
    return fhirResponse(
      fhirOperationOutcome('error', 'exception', 'Internal error saving referral. Please retry.'),
      500,
    );
  }

  // 16. Log audit
  await logAudit(row.id, 'fhir_referral_received', referrerEmail, {
    priority: internalPriority,
    fhirPriority,
    appointmentType,
    referralId,
    fhirStatus: serviceRequest.status,
  }).catch(console.error);

  // 17. Return FHIR OperationOutcome R4
  return fhirResponse(
    fhirOperationOutcome(
      'information',
      'informational',
      `Referral accepted. Booking ID: ${row.id}. Referral ID: ${referralId}.`,
      referralId,
    ),
    201,
  );
}
