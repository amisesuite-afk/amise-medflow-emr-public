import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';

// POST /api/staff/lab-alert/[id]
// Staff marks a lab booking's result as ready for notification.
// Sets result_alert_pending = true; the API server cron picks it up and sends the email.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const sb = getServiceClient();

  const { data: row, error: fetchErr } = await sb
    .from('appointment_requests')
    .select('id, patient_name, appointment_type, result_alert_email, result_alert_sent_at')
    .eq('id', id)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
  }

  if (!row.result_alert_email) {
    return NextResponse.json({ error: 'No result alert email configured for this booking.' }, { status: 400 });
  }

  if (row.result_alert_sent_at) {
    return NextResponse.json({ message: 'Alert already sent.', sent_at: row.result_alert_sent_at });
  }

  const { error: updateErr } = await sb
    .from('appointment_requests')
    .update({ result_alert_pending: true })
    .eq('id', id);

  if (updateErr) {
    console.error('lab-alert update error', updateErr);
    return NextResponse.json({ error: 'Failed to queue alert.' }, { status: 500 });
  }

  return NextResponse.json({
    message: `Result alert queued for ${row.result_alert_email}. Will be sent on next cron run.`,
  });
}
