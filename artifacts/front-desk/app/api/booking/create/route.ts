import { NextRequest, NextResponse } from 'next/server';
import { createBookingRequest, logAudit } from '@/lib/supabase';
import { createCalendarEvent, LOCATION_LABELS } from '@/lib/calendar';
import { sendSms, sendWhatsApp } from '@/lib/twilio';
import { sendConfirmationEmail } from '@/lib/email';
import { TRACK_CONFIG, encodeReason, BOOKING_DISCLAIMER, type BookingTrack } from '@/lib/scheduling';

export const runtime = 'nodejs';

// Patients often type their number without the country code (e.g. "758 285
// 7626" or "17582857626") even though the field is labelled "+1 758 …".
// Twilio rejects anything that isn't E.164, which previously bubbled up as
// an unhandled exception (surfaced to the patient as a generic "Network
// error"). Normalise to E.164 — defaulting to the +1 (Saint Lucia) country
// code — before it ever reaches Twilio or the database.
function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function routineConfirmation(
  patientName: string,
  slot: { display: string; location: string },
): string {
  const firstName = patientName.split(' ')[0];
  const locLabel  = LOCATION_LABELS[slot.location] ?? slot.location;
  return [
    `Good day ${firstName},`,
    ``,
    `Your appointment with Dr Kabiye has been confirmed:`,
    `Date & time: ${slot.display}`,
    `Location: ${locLabel}`,
    ``,
    `Please arrive 10 minutes early with a valid photo ID.`,
    `For enquiries: Tapion Hospital 459-2227 / 284-0557.`,
    ``,
    `Front Desk, Amise Medical Services`,
    ``,
    `— Appointment scheduling only. Not medical advice. —`,
  ].join('\n');
}

function referralAcknowledgement(patientName: string): string {
  const firstName = patientName.split(' ')[0];
  return [
    `Good day ${firstName},`,
    ``,
    `Thank you for contacting Amise Medical Services.`,
    `Your referral appointment request has been received and will be arranged within 24 hours. You will receive a confirmation via this number.`,
    ``,
    `For urgent concerns, please contact your referring doctor or call Tapion Hospital on 459-2227 / 284-0557.`,
    ``,
    `Front Desk, Amise Medical Services`,
    ``,
    `— Appointment scheduling only. Not medical advice. —`,
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as {
    track: BookingTrack;
    appointmentType: string;
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    patientDob?: string;
    reason?: string;
    referralDoctor?: string;
    referralPractice?: string;
    selectedSlot?: {
      start: string;
      end: string;
      location: string;
      appointmentType: string;
      display: string;
    };
  };

  const {
    track, appointmentType, patientName, patientEmail,
    patientDob, reason, referralDoctor, referralPractice, selectedSlot,
  } = body;

  if (!patientName?.trim() || !body.patientPhone?.trim() || !track || !appointmentType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const patientPhone = toE164(body.patientPhone);

  const cfg = TRACK_CONFIG[track] ?? TRACK_CONFIG['routine'];

  const encodedReason = encodeReason(
    track,
    reason?.trim() ?? '',
    referralDoctor?.trim(),
    referralPractice?.trim(),
  );

  // Determine status and slot
  let bookingStatus = 'pending';
  let confirmedSlot: string | null = null;
  let googleEventId: string | null = null;

  // Routine: auto-confirm if a slot was selected
  if (track === 'routine' && selectedSlot) {
    const eventResult = await createCalendarEvent({
      appointmentType: selectedSlot.appointmentType,
      location:        selectedSlot.location,
      start:           new Date(selectedSlot.start),
      end:             new Date(selectedSlot.end),
      patientName,
      patientPhone,
      reason:          reason?.trim(),
    });

    if (eventResult) {
      googleEventId = eventResult.eventId;
      confirmedSlot = selectedSlot.start;
      bookingStatus = 'patient_confirmed';
    }
    // If calendar fails for routine: still create the request as pending
  }

  // Preferred slot for referral (staff confirms later)
  const preferredSlot = !confirmedSlot && selectedSlot ? selectedSlot.start : null;

  // Create booking row
  const row = await createBookingRequest({
    patient_name:     patientName,
    patient_email:    patientEmail?.trim() || null,
    patient_phone:    patientPhone,
    appointment_type: appointmentType,
    location:         selectedSlot?.location ?? '',
    preferred_slot:   preferredSlot,
    reason:           encodedReason,
    triage_acuity:    cfg.acuity,
    status:           bookingStatus,
    notes:            referralDoctor
      ? `Referring: ${referralDoctor}${referralPractice ? ', ' + referralPractice : ''}`
      : null,
    confirmed_slot:   confirmedSlot,
    google_event_id:  googleEventId,
  });

  await logAudit(row.id, 'online_booking_created', 'patient', {
    track,
    appointment_type: appointmentType,
    auto_confirmed:   bookingStatus === 'patient_confirmed',
  });

  // Send patient notification
  const isWhatsApp = patientPhone.toLowerCase().startsWith('whatsapp:');
  const send = isWhatsApp ? sendWhatsApp : sendSms;

  // The booking row is already saved at this point — a notification failure
  // (bad number, Twilio outage, etc.) shouldn't turn into a 500 that tells
  // the patient their request never went through.
  try {
    if (track === 'routine' && bookingStatus === 'patient_confirmed' && selectedSlot) {
      await send(patientPhone, routineConfirmation(patientName, selectedSlot));
    } else {
      // Referral or routine without confirmed slot
      await send(patientPhone, referralAcknowledgement(patientName));
    }
  } catch (err) {
    console.error('[booking/create] Failed to send patient notification:', err);
  }

  // Send email with full procedure instructions (non-blocking)
  if (patientEmail?.trim()) {
    void sendConfirmationEmail({
      to:              patientEmail.trim(),
      patientName,
      appointmentType,
      slot:            (track === 'routine' && bookingStatus === 'patient_confirmed' && selectedSlot)
        ? { display: selectedSlot.display, location: selectedSlot.location }
        : null,
      track,
      isConfirmed:     bookingStatus === 'patient_confirmed',
    }).catch(console.error);
  }

  // Notify staff of referral (non-blocking)
  const nurseWa = process.env.NURSE_ALERT_WHATSAPP;
  if (nurseWa && track !== 'routine') {
    const staffAlert = [
      `NEW ${track.toUpperCase()} BOOKING — ${patientName}`,
      `Type: ${appointmentType.replace(/_/g, ' ')}`,
      encodedReason,
      `Phone: ${patientPhone}`,
      `Review: ${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'dashboard'}/dashboard`,
    ].join('\n');
    void sendWhatsApp(nurseWa, staffAlert).catch(console.error);
  }

  return NextResponse.json({
    id:             row.id,
    status:         bookingStatus,
    autoConfirmed:  bookingStatus === 'patient_confirmed',
    googleEventId,
    disclaimer:     BOOKING_DISCLAIMER,
  });
}
