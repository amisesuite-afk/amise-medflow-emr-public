import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { requireStaff } from '@/lib/staff-auth';

export const runtime = 'nodejs';

export interface PatientSearchResult {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
}

// Characters with meaning inside a PostgREST `.or()` filter string (`,`
// separates conditions, `()` group them, `"` and `\` quote/escape). Removing
// them stops a search term from injecting extra filter conditions.
function sanitiseSearchTerm(raw: string): string {
  return raw.replace(/[,()"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireStaff(req);
  if (auth.response) return auth.response;

  const q = sanitiseSearchTerm(req.nextUrl.searchParams.get('q') ?? '');
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
