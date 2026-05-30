import { NextRequest, NextResponse } from 'next/server';
import { getThread, logAudit } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { threadId, message, nurseId } = (await req.json()) as {
    threadId: string; message: string; nurseId: string;
  };

  const thread = await getThread(threadId);
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

  await sendWhatsApp(thread.patient_identifier, message);
  await logAudit(threadId, 'nurse_message_sent', `nurse:${nurseId}`, { message });

  return NextResponse.json({ success: true });
}
