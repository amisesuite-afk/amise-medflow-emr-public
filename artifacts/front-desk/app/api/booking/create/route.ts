import { NextRequest, NextResponse } from 'next/server';
import { createBookingRequest, logAudit } from '@/lib/supabase';
import { sendSms, sendWhatsApp } from '@/lib/twilio';
import { sendConfirmationEmail } from '@/lib/email';
import { TRACK_CONFIG, encodeReason, BOOKING_DISCLAIMER, type BookingTrack } from '@/lib/scheduling';

import { API_BASE as API } from '@/lib/constants';

export const runtime = 'nodejs';

// Shown to the patient when something unexpected blows up the request
// (Supabase outage, missing env var, etc.) — gives them a way to reach the
// office instead of the previous unhelpful generic "Network error".
const FALLBACK_ERROR = 'We could not process your request online. Please call us at 758-284-0557 / 758-720-7111 and our front desk will book your appointment by phone.';

// Mints a pre-consult questionnaire link via api-server's privileged
// provisioning endpoint, so the patient can complete it before their visit
// without a separate staff follow-up. api-server stays the sole owner of
// session_token generation — front-desk only asks for a finished link.
// Best-effort: a failure here must never block booking confirmation.
async function provisionQuestionnaire(): Promise<{ url: string | null; session_id: string | null }> {
  const staffToken = process.env.CRON_SECRET;
  if (!staffToken) return { url: null, session_id: null };

  try {
    const r = await fetch(`${API}/api/questionnaire/provision-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-staff-token': staffToken },
      body: JSON.stringify({}),
    });
    if (!r.ok) {
      console.error(`[booking/create] questionnaire link provisioning failed: HTTP ${r.status}`);
      return { url: null, session_id: null };
    }
    const d = await r.json() as { url?: string; session_id?: string };
    return { url: d.url ?? null, session_id: d.session_id ?? null };
  } catch (err) {
    console.error('[booking/create] questionnaire link provisioning failed:', err);
    return { url: null, session_id: null };
  }
}

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

function bookingAcknowledgement(patientName: string, questionnaireUrl: string | null): string {
  const firstName = patientName.split(' ')[0];
  return [
    `Good day ${firstName},`,
    ``,
    `Thank you for contacting Amise Medical Services.`,
    `Your appointment request has been received. Our front desk team will review availability and contact you to confirm a date and time.`,
    ...(questionnaireUrl ? [
      ``,
      `While you wait, you can get a head start by completing your pre-visit questionnaire: ${questionnaireUrl}`,
    ] : []),
    ``,
    `Medical emergency? Call emergency services or go to the nearest emergency room — do not wait for a callback.`,
    ``,
    `Front Desk, Amise Medical Services`,
    ``,
    `— Appointment scheduling only. Not medical advice. —`,
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    track: BookingTrack;
    appointmentType: string;
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    patientDob?: string;
    reason?: string;
    referralDoctor?: string;
    referralPractice?: string;
    preferences?: string;
  };

  try {
    body = await req.json();
  } catch (err) {
    console.error('[booking/create] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    track, appointmentType, patientName, patientEmail,
    patientDob, reason, referralDoctor, referralPractice, preferences,
  } = body;

  if (!patientName?.trim() || !body.patientPhone?.trim() || !track || !appointmentType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const rawPhoneDigits = body.patientPhone.replace(/\D/g, '');
  if (rawPhoneDigits.length < 10 || rawPhoneDigits.length > 15) {
    return NextResponse.json(
      { error: 'Please enter a valid phone number with at least 10 digits (e.g. +1 758 284-0557).' },
      { status: 400 },
    );
  }

  if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  if (patientDob) {
    const today = new Date().toISOString().split('T')[0];
    if (patientDob < '1900-01-01' || patientDob > today) {
      return NextResponse.json({ error: 'Please enter a valid date of birth.' }, { status: 400 });
    }
  }

  const patientPhone = toE164(body.patientPhone);

  const cfg = TRACK_CONFIG[track] ?? TRACK_CONFIG['routine'];

  const encodedReason = encodeReason(
    track,
    reason?.trim() ?? '',
    referralDoctor?.trim(),
    referralPractice?.trim(),
  );

  try {
    // Provision questionnaire link first so session_id can be stored on the booking row
    const { url: questionnaireUrl, session_id: questionnaireSessionId } = await provisionQuestionnaire();

    // All web bookings go to pending — front desk reviews calendar and assigns slot
    const notesLines: string[] = [];
    if (referralDoctor) {
      notesLines.push(`Referring: ${referralDoctor}${referralPractice ? ', ' + referralPractice : ''}`);
    }
    if (preferences) {
      notesLines.push(`Preferences: ${preferences}`);
    }

    const row = await createBookingRequest({
      patient_name:              patientName,
      patient_email:             patientEmail?.trim() || null,
      patient_phone:             patientPhone,
      appointment_type:          appointmentType,
      location:                  '',
      preferred_slot:            null,
      reason:                    encodedReason,
      triage_acuity:             cfg.acuity,
      status:                    'pending',
      notes:                     notesLines.length > 0 ? notesLines.join(' | ') : null,
      confirmed_slot:            null,
      google_event_id:           null,
      source:                    'web',
      questionnaire_session_id:  questionnaireSessionId,
    });

    await logAudit(row.id, 'online_booking_created', 'patient', {
      track,
      appointment_type: appointmentType,
      preferences,
      questionnaire_session_id: questionnaireSessionId,
    }).catch(err => console.error('[booking/create] audit log failed:', err));

    const isWhatsApp = patientPhone.toLowerCase().startsWith('whatsapp:');
    const send = isWhatsApp ? sendWhatsApp : sendSms;

    try {
      await send(patientPhone, bookingAcknowledgement(patientName, questionnaireUrl));
    } catch (err) {
      console.error('[booking/create] Failed to send patient notification:', err);
    }

    if (patientEmail?.trim()) {
      void sendConfirmationEmail({
        to:              patientEmail.trim(),
        patientName,
        appointmentType,
        slot:            null,
        track,
        isConfirmed:     false,
      }).catch(console.error);
    }

    // Notify staff of new booking (non-blocking)
    const nurseWa = process.env.NURSE_ALERT_WHATSAPP;
    if (nurseWa) {
      const staffAlert = [
        `NEW ${track.toUpperCase()} BOOKING — ${patientName}`,
        `Type: ${appointmentType.replace(/_/g, ' ')}`,
        encodedReason,
        `Phone: ${patientPhone}`,
        ...(preferences ? [`Preferences: ${preferences}`] : []),
        ...(process.env.NEXT_PUBLIC_DASHBOARD_URL ? [`Review: ${process.env.NEXT_PUBLIC_DASHBOARD_URL}`] : []),
      ].join('\n');
      void sendWhatsApp(nurseWa, staffAlert).catch(console.error);
    }

    return NextResponse.json({
      id:         row.id,
      status:     'pending',
      disclaimer: BOOKING_DISCLAIMER,
    });
  } catch (err) {
    console.error('[booking/create] Unhandled error creating booking:', err, {
      track, appointmentType, patientDob: !!patientDob,
    });
    return NextResponse.json({ error: FALLBACK_ERROR }, { status: 500 });
  }
}
