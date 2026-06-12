import { NextRequest, NextResponse } from 'next/server';
import { markDocumentReviewed } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: { documentId?: string; staffId?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[documents/review] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { documentId, staffId } = body;
  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  try {
    await markDocumentReviewed(documentId, staffId ?? null);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[documents/review] Unhandled error:', err);
    return NextResponse.json({ error: 'Could not mark this document as reviewed. Please try again.' }, { status: 500 });
  }
}
