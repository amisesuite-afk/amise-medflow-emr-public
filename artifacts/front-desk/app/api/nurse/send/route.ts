import { NextRequest, NextResponse } from 'next/server';
import { getThread, logAudit } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: { threadId: string; message: string; nurseId: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[nurse/send] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { threadId, message, nurseId } = body;

  try {
    const thread = await getThread(threadId);
    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    try {
      await sendWhatsApp(thread.patient_identifier, message);
    } catch (err) {
      console.error('[nurse/send] Failed to send WhatsApp message:', err);
      return NextResponse.json({
        error: 'Could not send the message to the patient (check their phone number). Please try again.',
      }, { status: 502 });
    }

    await logAudit(threadId, 'nurse_message_sent', `nurse:${nurseId}`, { message });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[nurse/send] Unhandled error:', err);
    return NextResponse.json({ error: 'Something went wrong sending this message. Please try again.' }, { status: 500 });
  }
}
