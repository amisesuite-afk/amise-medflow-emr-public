import { NextRequest, NextResponse } from 'next/server';
import { updateThread, logAudit } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: { threadId: string; nurseId: string; editedReply: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[nurse/reject] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { threadId, nurseId, editedReply } = body;

  try {
    await updateThread(threadId, { draft_reply: editedReply, status: 'pending_approval' });
    await logAudit(threadId, 'draft_edited', `nurse:${nurseId}`, { editedReply });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[nurse/reject] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not save the edited reply. Please try again.' }, { status: 500 });
  }
}
