import { NextRequest, NextResponse } from 'next/server';
import { updateThread, logAudit } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { threadId, nurseId, editedReply } = (await req.json()) as {
    threadId: string; nurseId: string; editedReply: string;
  };

  await updateThread(threadId, { draft_reply: editedReply, status: 'pending_approval' });
  await logAudit(threadId, 'draft_edited', `nurse:${nurseId}`, { editedReply });

  return NextResponse.json({ success: true });
}
