import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';
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

    const sb = getClient();
    if (!sb) {
      console.error('[intake/submit] No Supabase credentials configured');
      return NextResponse.json({ error: 'Service temporarily unavailable. Please contact us on WhatsApp.' }, { status: 503 });
    }

    const ccLabels = (chiefComplaint ?? []).join(', ');
    const hasRedFlags = (redFlags ?? []).length > 0;
    const urgency = hasRedFlags
      ? redFlags.reduce((worst: string, rf: { severity: string }) => {
          const rank: Record<string, number> = { emergency: 4, urgent: 3, priority: 2, routine: 1 };
          return (rank[rf.severity] ?? 0) > (rank[worst] ?? 0) ? rf.severity : worst;
        }, 'routine')
      : 'routine';

    const referralNote = patient.referralType === 'doctor'
      ? `[REFERRAL] From: ${patient.referringDoctor || 'Unknown'} at ${patient.referringPractice || 'Unknown'}`
      : null;

    const notesLines = [referralNote, summary].filter(Boolean).join('\n\n');

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
        notes: notesLines || null,
      })
      .select('id')
      .single();

    if (bookingErr) {
      console.error('[intake/submit] booking insert error:', bookingErr.message, bookingErr.code);
      return NextResponse.json({
        error: 'Could not save your request. Please contact us on WhatsApp at 758-284-0557.',
      }, { status: 500 });
    }

    // Questionnaire session + responses (best-effort, don't fail the request)
    try {
      // Look up the general_screening template ID (required FK)
      const { data: template } = await sb
        .from('questionnaire_templates')
        .select('id')
        .eq('name', 'general_screening')
        .eq('is_active', true)
        .single();

      if (template?.id) {
        const sessionToken = crypto.randomUUID().replace(/-/g, '');
        const { data: session } = await sb
          .from('questionnaire_sessions')
          .insert({
            template_id: template.id,
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
          .single();

        if (session?.id && responses?.length > 0) {
          const rows = responses.map((r: {
            questionKey: string; questionText: string; answerValue: string | string[];
            answerDisplay: string; isRedFlag: boolean; sequenceNumber: number; answeredAt: string;
          }) => ({
            session_id: session.id,
            question_key: r.questionKey,
            question_text: r.questionText,
            answer_value: Array.isArray(r.answerValue) ? JSON.stringify(r.answerValue) : r.answerValue,
            answer_display: r.answerDisplay,
            is_red_flag: r.isRedFlag,
            sequence_number: r.sequenceNumber,
            answered_at: r.answeredAt,
          }));
          await sb.from('questionnaire_responses').insert(rows);
        }
      }
    } catch (e) {
      console.warn('[intake/submit] questionnaire session save failed (non-critical):', e);
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking?.id,
      urgency,
      hasRedFlags,
    });
  } catch (err) {
    console.error('[intake/submit] error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please contact us on WhatsApp at 758-284-0557.' }, { status: 500 });
  }
}
