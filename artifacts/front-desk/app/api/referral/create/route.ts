import { NextRequest, NextResponse } from 'next/server';
import { createBookingRequest, logAudit } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';
import { sendConfirmationEmail } from '@/lib/email';
import type { BookingTrack } from '@/lib/scheduling';

export const runtime = 'nodejs';

interface ReferralBody {
  // Referring provider
  referrerName: string;
  referrerPractice: string;
  referrerPhone: string;
  referrerEmail: string;
  referrerRegNumber?: string;
  // Patient
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail?: string;
  patientNic?: string;
  // Referral
  appointmentType: string;
  priority: 'routine' | 'priority' | 'urgent';
  clinicalReason: string;
  investigations?: string;
  medications?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ReferralBody;
  try {
    body = (await req.json()) as ReferralBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // 1. Validate required fields
  const required: (keyof ReferralBody)[] = [
    'referrerName', 'referrerPractice', 'referrerPhone', 'referrerEmail',
    'patientName', 'patientDob', 'patientPhone',
    'appointmentType', 'priority', 'clinicalReason',
  ];
  const missing = required.filter(k => !body[k] || String(body[k]).trim() === '');
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}.` },
      { status: 400 },
    );
  }

  const { priority } = body;
  if (!['routine', 'priority', 'urgent'].includes(priority)) {
    return NextResponse.json({ error: 'Invalid priority value.' }, { status: 400 });
  }

  // 2. Generate referral ID
  const referralId = `REF-${Date.now().toString(36).toUpperCase()}`;

  // 3 & 4. Map priority to BookingTrack and triage_acuity
  const track: BookingTrack = priority === 'urgent' ? 'urgent' : 'referral';
  const triage_acuity: string = priority === 'urgent' ? 'urgent' : 'priority';

  // 5. Encode notes: combine referrer info, investigations, medications
  const noteLines: string[] = [
    `GP REFERRAL`,
    `Referring Doctor: ${body.referrerName}`,
    `Practice/Hospital: ${body.referrerPractice}`,
    `Referrer Phone: ${body.referrerPhone}`,
    `Referrer Email: ${body.referrerEmail}`,
  ];
  if (body.referrerRegNumber) noteLines.push(`Registration No: ${body.referrerRegNumber}`);
  if (body.patientDob) noteLines.push(`Patient DOB: ${body.patientDob}`);
  if (body.patientNic) noteLines.push(`Patient NIC/Passport: ${body.patientNic}`);
  if (body.investigations?.trim()) {
    noteLines.push('', 'INVESTIGATIONS DONE:', body.investigations.trim());
  }
  if (body.medications?.trim()) {
    noteLines.push('', 'CURRENT MEDICATIONS:', body.medications.trim());
  }
  noteLines.push('', `Referral ID: ${referralId}`, `Priority: ${priority.toUpperCase()}`);
  const notes = noteLines.join('\n');

  // 6. Create booking request
  let row;
  try {
    row = await createBookingRequest({
      patient_name:     body.patientName.trim(),
      patient_email:    body.patientEmail?.trim() ?? null,
      patient_phone:    body.patientPhone.trim(),
      appointment_type: body.appointmentType,
      location:         '',
      preferred_slot:   null,
      reason:           `[GP REFERRAL: ${body.referrerName} / ${body.referrerPractice}] ${body.clinicalReason.trim()}`,
      triage_acuity,
      status:           'pending',
      notes,
      confirmed_slot:   null,
      google_event_id:  null,
    });
  } catch (err) {
    console.error('[referral/create] createBookingRequest failed:', err);
    return NextResponse.json({ error: 'Failed to save referral. Please try again.' }, { status: 500 });
  }

  // 7. Log audit
  await logAudit(row.id, 'gp_referral_received', body.referrerEmail, {
    priority,
    appointmentType: body.appointmentType,
    referralId,
  }).catch(console.error);

  // 8. Staff WhatsApp alert (non-blocking)
  const nurseWhatsApp = process.env.NURSE_ALERT_WHATSAPP;
  if (nurseWhatsApp) {
    const alertLines = [
      `NEW GP REFERRAL — ${priority.toUpperCase()}`,
      `Patient: ${body.patientName}`,
      `Referred by: ${body.referrerName} (${body.referrerPractice})`,
      `Type: ${body.appointmentType}`,
      `Reason: ${body.clinicalReason.slice(0, 200)}`,
      `Referral ID: ${referralId}`,
      `Booking ID: ${row.id}`,
    ].join('\n');
    sendWhatsApp(nurseWhatsApp, alertLines).catch(console.error);
  }

  // 9. Patient confirmation email (non-blocking)
  if (body.patientEmail?.trim()) {
    sendConfirmationEmail({
      to:              body.patientEmail.trim(),
      patientName:     body.patientName.trim(),
      appointmentType: body.appointmentType,
      slot:            null,
      track,
      isConfirmed:     false,
    }).catch(console.error);
  }

  // 10. Return success
  return NextResponse.json({
    success:   true,
    referralId,
    bookingId: row.id,
    message:   'Referral received. Our team will contact the patient within the priority timeframe.',
  });
}
