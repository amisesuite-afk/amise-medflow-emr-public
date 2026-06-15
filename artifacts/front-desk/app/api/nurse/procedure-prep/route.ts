import { NextRequest, NextResponse } from 'next/server';
import { listProcedurePrepDrafts, type ProcedurePrepDraftRow } from '@/lib/supabase';

export const runtime = 'nodejs';

const VALID_STATUSES: ProcedurePrepDraftRow['status'][] =
  ['pending_approval', 'approved', 'rejected', 'sent'];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get('status') ?? 'pending_approval';
  const status = VALID_STATUSES.includes(statusParam as ProcedurePrepDraftRow['status'])
    ? (statusParam as ProcedurePrepDraftRow['status'])
    : 'pending_approval';

  try {
    const drafts = await listProcedurePrepDrafts(status);
    return NextResponse.json({ drafts });
  } catch (err) {
    console.error('[nurse/procedure-prep] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not load procedure-prep drafts. Please try again.' }, { status: 500 });
  }
}
