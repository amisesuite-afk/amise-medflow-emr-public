import { NextRequest, NextResponse } from 'next/server';
import { markDocumentReviewed } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { documentId, staffId } = (await req.json()) as { documentId?: string; staffId?: string };
  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  await markDocumentReviewed(documentId, staffId ?? null);
  return NextResponse.json({ success: true });
}
