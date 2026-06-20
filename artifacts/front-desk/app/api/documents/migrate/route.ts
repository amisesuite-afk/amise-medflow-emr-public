import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, findOrCreatePatientForBooking, registerHistoricDocument } from '@/lib/supabase';

import { API_BASE as API } from '@/lib/constants';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = [
  'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
  'surgical_report', 'discharge_summary', 'prescription', 'insurance_form',
  'clinical_photo', 'other',
];

// POST /api/documents/migrate — staff-side, on-demand "old system" migration.
// While handling a pending request or an upcoming/in-progress encounter,
// staff can attach a patient's historic paper/PDF records here. The patient
// is matched (or created) from the booking's contact details, the file is
// stored under the matched patient, and the same triage-only AI extraction
// pass that runs for portal uploads is queued for it.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const form = await req.formData();
  const bookingId    = form.get('bookingId');
  const documentType = form.get('documentType');
  const file         = form.get('file');

  if (typeof bookingId !== 'string' || !bookingId) {
    return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF, JPEG, PNG, and WebP files are accepted.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is too large. Maximum size is 10 MB.' }, { status: 400 });
  }

  const docType = typeof documentType === 'string' && DOCUMENT_TYPES.includes(documentType) ? documentType : 'other';

  const booking = await getBookingById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    const patientId = await findOrCreatePatientForBooking(booking);
    const buffer    = Buffer.from(await file.arrayBuffer());

    const documentId = await registerHistoricDocument({
      patientId,
      documentType: docType,
      title:        file.name,
      fileName:     file.name,
      mimeType:     file.type,
      fileBuffer:   buffer,
    });

    // Fire-and-forget — the api-server owns the Claude extraction worker
    fetch(`${API}/api/patient/documents/${documentId}/extract`, { method: 'POST' }).catch(() => {});

    return NextResponse.json({ success: true, patient_id: patientId, document_id: documentId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not attach the document.' }, { status: 500 });
  }
}
