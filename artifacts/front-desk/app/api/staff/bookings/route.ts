import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data, error } = await getServiceClient()
    .from('appointment_requests')
    .select('id, patient_name, appointment_type, location, preferred_slot, status, created_at, reason, result_alert_email, result_alert_pending, result_alert_sent_at')
    .eq('source', 'staff')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('staff/bookings query error', error);
    return NextResponse.json({ error: 'Failed to load bookings.' }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [] });
}
