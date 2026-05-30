import { NextRequest, NextResponse } from 'next/server';
import { getThread, updateThread, logAudit } from '@/lib/supabase';
import { sendWhatsApp, sendSms, checkForbidden } from '@/lib/twilio';
import { createCalendarEvent, LOCATION_LABELS } from '@/lib/calendar';
import type { AppointmentSlot } from '@/types';

export const runtime = 'nodejs';

function buildAppointmentConfirmation(
  patientName: string | null,
  slot: AppointmentSlot,
): string {
  const firstName = patientName ? patientName.split(' ')[0] : null;
  const greeting  = firstName ? `Good day ${firstName},` : 'Good day,';
  const locLabel  = LOCATION_LABELS[slot.location] ?? slot.location;

  return [
    greeting,
    '',
    'Your appointment with Dr Kabiye has been confirmed:',
    `Date & time: ${slot.display}`,
    `Location: ${locLabel}`,
    '',
    'Please arrive 10 minutes early with a valid photo ID. For urgent enquiries, please call Tapion Hospital on 459-2227 / 284-0557.',
    '',
    'Front Desk, Amise Medical Services',
  ].join('\n');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await req.json() as {
    threadId: string;
    nurseId: string;
    draft?: string;
    selectedSlotIndex?: number;
  };
  const { threadId, nurseId, draft: clientDraft, selectedSlotIndex } = body;

  const thread = await getThread(threadId);
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

  // Find appointment slots stored by intake handler
  let appointmentSlots: AppointmentSlot[] | null = null;
  for (const msg of thread.messages) {
    if (msg.role === 'system' && msg.meta?.type === 'appointment_slots') {
      appointmentSlots = msg.meta.payload;
    }
  }

  // Resolve the final message text (client draft takes precedence over DB draft)
  let finalMessage = (clientDraft ?? thread.draft_reply ?? '').trim();
  if (!finalMessage) {
    return NextResponse.json({ error: 'No message to send' }, { status: 400 });
  }

  // Safety check — must pass before sending
  if (checkForbidden(finalMessage)) {
    await logAudit(threadId, 'draft_blocked_forbidden', `nurse:${nurseId}`, { draft: finalMessage });
    return NextResponse.json({ error: 'Message contains forbidden content and cannot be sent' }, { status: 422 });
  }

  let calendarEventId: string | null = null;

  // Create calendar event when a slot is selected
  if (appointmentSlots && appointmentSlots.length > 0) {
    const slotIndex = selectedSlotIndex ?? 0;
    const slot = appointmentSlots[slotIndex];

    if (slot) {
      const eventResult = await createCalendarEvent({
        appointmentType: slot.appointmentType,
        location:        slot.location,
        start:           new Date(slot.start),
        end:             new Date(slot.end),
        patientName:     thread.patient_name ?? 'Patient',
        patientPhone:    thread.patient_identifier,
        reason:          thread.chief_complaint ?? undefined,
      });

      if (!eventResult) {
        // No appointment without a confirmed calendar write
        return NextResponse.json({
          error: 'Calendar write failed — appointment not confirmed. Please try again or contact Google Calendar admin.',
        }, { status: 502 });
      }

      calendarEventId = eventResult.eventId;

      // Override the message with the canonical appointment confirmation
      finalMessage = buildAppointmentConfirmation(thread.patient_name, slot);

      // Safety check on confirmation message
      if (checkForbidden(finalMessage)) {
        return NextResponse.json({ error: 'Confirmation message contains forbidden content' }, { status: 422 });
      }
    }
  }

  // Dispatch via the patient's channel
  if (thread.channel === 'sms') {
    await sendSms(thread.patient_identifier, finalMessage);
  } else {
    await sendWhatsApp(thread.patient_identifier, finalMessage);
  }

  await updateThread(threadId, { status: 'resolved', draft_reply: null });
  await logAudit(threadId, 'draft_approved', `nurse:${nurseId}`, {
    reply:              finalMessage,
    calendar_event_id:  calendarEventId,
    selected_slot:      selectedSlotIndex ?? null,
  });

  return NextResponse.json({ success: true, calendarEventId });
}
