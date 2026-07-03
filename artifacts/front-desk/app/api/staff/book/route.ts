import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { APPOINTMENT_TYPES } from '@/lib/scheduling';

export const runtime = 'nodejs';

interface StaffBookingPayload {
  category: 'consult' | 'surgery' | 'anaesthesia' | 'lab';
  patient_name: string;
  patient_dob?: string;
  patient_phone?: string;
  patient_email?: string;
  // Consult
  consult_type?: string;
  consult_track?: string;
  consult_date?: string;
  consult_notes?: string;
  // Surgery
  surgery_procedure?: string;
  surgery_location?: string;
  surgery_priority?: 'elective' | 'urgent' | 'emergency';
  surgery_duration_min?: number;
  surgery_anaesthetist?: string;
  surgery_date?: string;
  also_book_anaesthesia?: boolean;
  surgery_notes?: string;
  // Anaesthesia
  asa_class?: string;
  linked_procedure?: string;
  anaesthesia_date?: string;
  anaesthesia_notes?: string;
  // Lab
  lab_tests?: string[];
  lab_fasting?: boolean;
  lab_external?: string;
  lab_date?: string;
  result_alert_email?: string;
  lab_notes?: string;
}

function buildReason(payload: StaffBookingPayload): string {
  switch (payload.category) {
    case 'consult':
      return [
        `[STAFF/${(payload.consult_track ?? 'routine').toUpperCase()}]`,
        payload.consult_notes?.trim(),
      ].filter(Boolean).join(' ');

    case 'surgery':
      return [
        `[STAFF/SURGERY/${(payload.surgery_priority ?? 'elective').toUpperCase()}]`,
        payload.surgery_procedure,
        payload.surgery_duration_min ? `(${payload.surgery_duration_min} min)` : null,
        payload.surgery_anaesthetist ? `Anaesthetist: ${payload.surgery_anaesthetist}` : null,
        payload.surgery_notes?.trim(),
      ].filter(Boolean).join(' — ');

    case 'anaesthesia':
      return [
        `[STAFF/ANAESTHESIA]`,
        payload.asa_class ? `ASA ${payload.asa_class}` : null,
        payload.linked_procedure,
        payload.anaesthesia_notes?.trim(),
      ].filter(Boolean).join(' — ');

    case 'lab':
      return [
        `[STAFF/LAB${payload.lab_fasting ? '/FASTING' : ''}]`,
        (payload.lab_tests ?? []).join(', '),
        payload.lab_external ? `Lab: ${payload.lab_external}` : null,
        payload.result_alert_email ? `Alert: ${payload.result_alert_email}` : null,
        payload.lab_notes?.trim(),
      ].filter(Boolean).join(' — ');
  }
}

function apptTypeAndLocation(payload: StaffBookingPayload): { appointment_type: string; location: string } {
  switch (payload.category) {
    case 'consult': {
      const key = payload.consult_type ?? 'new_consult';
      const cfg = APPOINTMENT_TYPES[key];
      return { appointment_type: key, location: cfg?.location ?? 'rodney_bay' };
    }
    case 'surgery':
      return { appointment_type: 'surgery_theatre', location: payload.surgery_location ?? 'tapion' };
    case 'anaesthesia':
      return { appointment_type: 'anaesthesia_preassessment', location: 'tapion' };
    case 'lab':
      if (payload.lab_tests?.includes('Histology / biopsy'))
        return { appointment_type: 'lab_histology', location: 'tapion' };
      if (payload.lab_fasting)
        return { appointment_type: 'lab_fasting', location: 'rodney_bay' };
      if (payload.lab_tests?.some(t => t.includes('Urine')))
        return { appointment_type: 'lab_urine', location: 'rodney_bay' };
      return { appointment_type: 'lab_collection', location: 'rodney_bay' };
  }
}

function preferredSlot(payload: StaffBookingPayload): string | null {
  const d =
    payload.category === 'consult'     ? payload.consult_date :
    payload.category === 'surgery'     ? payload.surgery_date :
    payload.category === 'anaesthesia' ? payload.anaesthesia_date :
    payload.category === 'lab'         ? payload.lab_date : undefined;
  return d ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let payload: StaffBookingPayload;
  try {
    payload = (await req.json()) as StaffBookingPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.patient_name?.trim()) {
    return NextResponse.json({ error: 'patient_name is required' }, { status: 400 });
  }

  const { appointment_type, location } = apptTypeAndLocation(payload);
  const reason = buildReason(payload);
  const preferred_slot = preferredSlot(payload);

  const sb = getServiceClient();

  const hasLabAlert = payload.category === 'lab' && !!payload.result_alert_email?.trim();

  const { data: row, error } = await sb
    .from('appointment_requests')
    .insert({
      patient_name:          payload.patient_name.trim(),
      patient_email:         payload.patient_email?.trim() || null,
      patient_phone:         payload.patient_phone?.trim() || null,
      patient_dob:           payload.patient_dob?.trim() || null,
      appointment_type,
      location,
      preferred_slot,
      reason,
      triage_acuity:         payload.surgery_priority === 'emergency' ? 'emergency' :
                             payload.surgery_priority === 'urgent'    ? 'urgent' :
                             payload.consult_track   === 'urgent'     ? 'urgent' : 'routine',
      status:                'staff_pending',
      source:                'staff',
      result_alert_email:    hasLabAlert ? payload.result_alert_email!.trim() : null,
      result_alert_pending:  false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('staff/book insert error', error);
    return NextResponse.json({ error: 'Failed to create booking.' }, { status: 500 });
  }

  // If surgery + also_book_anaesthesia, create a linked pre-assessment row
  if (payload.category === 'surgery' && payload.also_book_anaesthesia) {
    await sb.from('appointment_requests').insert({
      patient_name:     payload.patient_name.trim(),
      patient_email:    payload.patient_email?.trim() || null,
      patient_phone:    payload.patient_phone?.trim() || null,
      appointment_type: 'anaesthesia_preassessment',
      location:         'tapion',
      preferred_slot:   null,
      reason:           `[STAFF/ANAESTHESIA] Pre-assessment for: ${payload.surgery_procedure ?? 'planned surgery'} (linked to booking ${row.id})`,
      triage_acuity:    'routine',
      status:           'staff_pending',
      source:           'staff',
    });
  }

  return NextResponse.json({
    id: row.id,
    message: `Booking created${payload.also_book_anaesthesia ? ' (+ anaesthesia pre-assessment)' : ''}.`,
  });
}
