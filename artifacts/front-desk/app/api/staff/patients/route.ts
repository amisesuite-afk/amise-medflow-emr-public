import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export interface PatientSearchResult {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  const sb = getServiceClient();

  // Search by name, phone, or email — ilike is case-insensitive
  const { data, error } = await sb
    .from('patients')
    .select('id, full_name, phone, email, date_of_birth')
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order('full_name')
    .limit(10);

  if (error) {
    console.error('staff/patients search error', error);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }

  return NextResponse.json({ patients: (data ?? []) as PatientSearchResult[] });
}
