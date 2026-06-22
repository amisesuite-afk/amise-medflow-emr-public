import { NextRequest, NextResponse } from 'next/server';
import { getThread, updateThread, logAudit, createProcedurePrepDraft } from '@/lib/supabase';
import { sendWhatsApp, sendSms, checkForbidden } from '@/lib/twilio';
import { createCalendarEvent, LOCATION_LABELS } from '@/lib/calendar';
import { sendConfirmationEmail } from '@/lib/email';
import { isProcedurePrepEligible, draftProcedurePrepAdjustment } from '@/lib/claude';
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

  let body: {
    threadId: string;
    nurseId: string;
    draft?: string;
    selectedSlotIndex?: number;
  };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[nurse/approve] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { threadId, nurseId, draft: clientDraft, selectedSlotIndex } = body;

  try {
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
    try {
      if (thread.channel === 'sms') {
        await sendSms(thread.patient_identifier, finalMessage);
      } else {
        await sendWhatsApp(thread.patient_identifier, finalMessage);
      }
    } catch (err) {
      console.error('[nurse/approve] Failed to send patient message:', err);
      return NextResponse.json({
        error: 'Could not send the message to the patient (check their phone number). The appointment was not confirmed — please retry.',
      }, { status: 502 });
    }

    // Send email with full procedure instructions if we have an email address and a confirmed slot
    const threadEmail = thread.patient_email;
    if (threadEmail && calendarEventId) {
      const confirmedSlot = appointmentSlots?.[selectedSlotIndex ?? 0];
      void sendConfirmationEmail({
        to:              threadEmail,
        patientName:     thread.patient_name ?? 'Patient',
        appointmentType: confirmedSlot?.appointmentType ?? 'new_consult',
        slot:            confirmedSlot
          ? { display: confirmedSlot.display, location: confirmedSlot.location }
          : null,
        track:           'referral',
        isConfirmed:     true,
      }).catch(console.error);
    }

    // Queue a Claude-drafted, patient-specific procedure-prep flag (DM,
    // renal impairment, blood thinners) for clinical staff review. The
    // standard prep instructions above are unaffected — this runs in the
    // background and never blocks/delays the patient-facing confirmation.
    if (calendarEventId) {
      const confirmedSlot = appointmentSlots?.[selectedSlotIndex ?? 0];
      if (confirmedSlot && isProcedurePrepEligible(confirmedSlot.appointmentType)) {
        const patientMessages = thread.messages
          .filter(msg => msg.role === 'patient')
          .map(msg => msg.content);
        const firstName = thread.patient_name ? thread.patient_name.split(' ')[0] : null;

        void draftProcedurePrepAdjustment(confirmedSlot.appointmentType, firstName, patientMessages)
          .then(result => {
            if (!result.flagged || !result.body || !result.safe) {
              if (!result.safe) {
                console.warn('[nurse/approve] procedure-prep draft failed safety check:', result.violations);
              }
              return;
            }
            return createProcedurePrepDraft({
              thread_id:      threadId,
              procedure_type: confirmedSlot.appointmentType,
              patient_name:   thread.patient_name ?? null,
              draft_text:     result.body,
            }).then(() => undefined);
          })
          .catch(err => console.error('[nurse/approve] procedure-prep draft error:', err));
      }
    }

    await updateThread(threadId, { status: 'resolved', draft_reply: null });
    await logAudit(threadId, 'draft_approved', `nurse:${nurseId}`, {
      reply:              finalMessage,
      calendar_event_id:  calendarEventId,
      selected_slot:      selectedSlotIndex ?? null,
    });

    return NextResponse.json({ success: true, calendarEventId });
  } catch (err) {
    console.error('[nurse/approve] Unhandled error:', err);
    return NextResponse.json({ error: 'Something went wrong approving this reply. Please try again.' }, { status: 500 });
  }
}
