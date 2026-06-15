import { NextRequest, NextResponse } from 'next/server';
import { updateProcedurePrepDraft, logAudit } from '@/lib/supabase';

export const runtime = 'nodejs';

const ACTION_TO_STATUS = {
  approve: 'approved',
  reject:  'rejected',
  sent:    'sent',
} as const;

type Action = keyof typeof ACTION_TO_STATUS;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: { draftId: string; nurseId: string; action: Action; threadId?: string | null };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[nurse/procedure-prep/review] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { draftId, nurseId, action, threadId } = body;

  const status = ACTION_TO_STATUS[action];
  if (!draftId || !status) {
    return NextResponse.json({ error: 'draftId and a valid action are required' }, { status: 400 });
  }

  try {
    await updateProcedurePrepDraft(draftId, {
      status,
      reviewed_by: `nurse:${nurseId}`,
      reviewed_at: new Date().toISOString(),
    });

    if (threadId) {
      await logAudit(threadId, `procedure_prep_draft_${status}`, `nurse:${nurseId}`, { draftId });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[nurse/procedure-prep/review] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not update this draft. Please try again.' }, { status: 500 });
  }
}
