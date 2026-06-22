/**
 * POST /api/booking/urgent
 * Staff-only endpoint. Finds the earliest available slot for a patient,
 * using a squeeze slot if no normal slot exists in the next 48 h.
 * Never leaves an urgent patient without an option.
 * Does NOT divert to ER — that is for EMERGENT (life-threatening) cases only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBookingRequest, logAudit } from '@/lib/supabase';
import { findUrgentSlot, createCalendarEvent, LOCATION_LABELS } from '@/lib/calendar';
import { sendSms, sendWhatsApp } from '@/lib/twilio';
import { sendConfirmationEmail } from '@/lib/email';

export const runtime = 'nodejs';

function urgentConfirmation(
  patientName: string,
  slot: { display: string; location: string },
): string {
  const firstName = patientName.split(' ')[0];
  const locLabel  = LOCATION_LABELS[slot.location] ?? slot.location;
  return [
    `Good day ${firstName},`,
    ``,
    `Your priority appointment with Dr Kabiye has been arranged:`,
    `Date & time: ${slot.display}`,
    `Location: ${locLabel}`,
    ``,
    `Please arrive 10 minutes early with a valid photo ID and any relevant medical records or referral letters.`,
    `For urgent questions: Tapion Hospital 459-2227 / 284-0557.`,
    ``,
    `Front Desk, Amise Medical Services`,
    ``,
    `— Appointment scheduling only. Not medical advice. —`,
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { bookingId, nurseId, overrideSlot } = await req.json() as {
    bookingId: string;
    nurseId: string;
    overrideSlot?: {
      start: string;
      end: string;
      location: string;
      appointmentType: string;
      display: string;
    };
  };

  try {
    const booking = await getBookingById(bookingId);
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Find the priority slot (or use staff override)
    const slot = overrideSlot ?? await findUrgentSlot(booking.appointment_type);

    if (!slot) {
      // Absolute fallback — should not happen given squeeze logic, but defend
      await logAudit(bookingId, 'urgent_slot_not_found', `nurse:${nurseId}`, {});
      return NextResponse.json({
        error: 'No slot found even with squeeze. Please arrange a telephone review immediately and contact the patient directly.',
        fallback: 'telephone_review',
      }, { status: 200 });
    }

    const slotStartIso = typeof slot.start === 'string' ? slot.start : slot.start.toISOString();

    // Create calendar event — must succeed before confirmation is sent
    const eventResult = await createCalendarEvent({
      appointmentType: slot.appointmentType,
      location:        slot.location,
      start:           new Date(slotStartIso),
      end:             new Date(typeof slot.end === 'string' ? slot.end : slot.end.toISOString()),
      patientName:     booking.patient_name,
      patientPhone:    booking.patient_phone ?? '',
      reason:          booking.reason ?? undefined,
    });

    if (!eventResult) {
      return NextResponse.json({
        error: 'Calendar write failed — appointment not confirmed.',
      }, { status: 502 });
    }

    // Persist
    await updateBookingRequest(bookingId, {
      status:          'staff_confirmed',
      confirmed_slot:  slotStartIso,
      google_event_id: eventResult.eventId,
      triage_acuity:   'urgent',
      notes:           `Urgent slot confirmed by nurse:${nurseId}`,
    });

    await logAudit(bookingId, 'urgent_slot_confirmed', `nurse:${nurseId}`, {
      slot:            slot.display,
      calendar_event:  eventResult.eventId,
    });

    // Send confirmation via WhatsApp/SMS
    const phone = booking.patient_phone ?? '';
    if (phone) {
      const msg        = urgentConfirmation(booking.patient_name, slot);
      const isWhatsApp = phone.toLowerCase().startsWith('whatsapp:');
      await (isWhatsApp ? sendWhatsApp : sendSms)(phone, msg);
    }

    // Send email with full procedure instructions (non-blocking)
    const email = (booking as { patient_email?: string | null }).patient_email;
    if (email) {
      void sendConfirmationEmail({
        to:              email,
        patientName:     booking.patient_name,
        appointmentType: booking.appointment_type,
        slot:            { display: slot.display, location: slot.location },
        track:           'urgent',
        isConfirmed:     true,
      }).catch(console.error);
    }

    return NextResponse.json({
      success:        true,
      slot:           slot.display,
      googleEventId:  eventResult.eventId,
    });
  } catch (err) {
    console.error('[booking/urgent] Unhandled error:', err);
    return NextResponse.json({ error: 'Failed to confirm urgent slot. Please arrange a telephone review and contact the patient directly.' }, { status: 500 });
  }
}
