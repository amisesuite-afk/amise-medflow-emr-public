import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient, chiefComplaint, specialty, responses, redFlags, summary, isComplete } = body;

    if (!patient?.fullName || !patient?.phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const sb = getServiceClient();
    if (!sb) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const ccLabels = (chiefComplaint ?? []).join(', ');
    const hasRedFlags = (redFlags ?? []).length > 0;
    const urgency = hasRedFlags
      ? redFlags.reduce((worst: string, rf: { severity: string }) => {
          const rank: Record<string, number> = { emergency: 4, urgent: 3, priority: 2, routine: 1 };
          return (rank[rf.severity] ?? 0) > (rank[worst] ?? 0) ? rf.severity : worst;
        }, 'routine')
      : 'routine';

    // Create appointment request (queued for staff)
    const { data: booking, error: bookingErr } = await sb
      .from('appointment_requests')
      .insert({
        patient_name: patient.fullName,
        patient_email: patient.email || null,
        patient_phone: patient.phone,
        appointment_type: specialty === 'endoscopy' ? 'ogd' : 'new_consult',
        location: 'rodney_bay',
        reason: ccLabels,
        triage_acuity: urgency,
        status: 'pending',
        notes: summary || null,
      })
      .select('id')
      .single();

    if (bookingErr) {
      console.error('[intake/submit] booking insert error:', bookingErr);
      return NextResponse.json({ error: 'Failed to save request' }, { status: 500 });
    }

    // Create questionnaire session record
    const sessionToken = crypto.randomUUID().replace(/-/g, '');
    const { error: sessionErr } = await sb
      .from('questionnaire_sessions')
      .insert({
        template_id: null,
        mode: 'screening',
        status: isComplete ? 'completed' : 'in_progress',
        delivery_method: 'web_intake',
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: isComplete ? new Date().toISOString() : null,
        red_flags_detected: redFlags ?? [],
        session_token: sessionToken,
      })
      .select('id')
      .single()
      .then(async (result) => {
        if (result.error || !result.data) return result;
        const sessionId = result.data.id;

        // Save individual responses
        const responseRows = (responses ?? []).map((r: {
          questionKey: string; questionText: string; answerValue: string | string[];
          answerDisplay: string; isRedFlag: boolean; sequenceNumber: number; answeredAt: string;
        }) => ({
          session_id: sessionId,
          question_key: r.questionKey,
          question_text: r.questionText,
          answer_value: Array.isArray(r.answerValue) ? JSON.stringify(r.answerValue) : r.answerValue,
          answer_display: r.answerDisplay,
          is_red_flag: r.isRedFlag,
          sequence_number: r.sequenceNumber,
          answered_at: r.answeredAt,
        }));

        if (responseRows.length > 0) {
          await sb.from('questionnaire_responses').insert(responseRows);
        }

        return result;
      });

    return NextResponse.json({
      ok: true,
      bookingId: booking?.id,
      urgency,
      hasRedFlags,
    });
  } catch (err) {
    console.error('[intake/submit] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
