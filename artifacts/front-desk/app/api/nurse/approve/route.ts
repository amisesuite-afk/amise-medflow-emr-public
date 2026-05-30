import { NextRequest, NextResponse } from 'next/server';
import { getThread, updateThread, logAudit } from '@/lib/supabase';
import { sendWhatsApp } from '@/lib/twilio';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { threadId, nurseId } = (await req.json()) as { threadId: string; nurseId: string };
  const thread = await getThread(threadId);
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  if (!thread.draft_reply) return NextResponse.json({ error: 'No draft to approve' }, { status: 400 });

  await sendWhatsApp(thread.patient_identifier, thread.draft_reply);
  await updateThread(threadId, { status: 'resolved', draft_reply: null });
  await logAudit(threadId, 'draft_approved', `nurse:${nurseId}`, { reply: thread.draft_reply });

  return NextResponse.json({ success: true });
}
