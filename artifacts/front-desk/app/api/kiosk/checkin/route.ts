import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase';
import { createSession, getNextQuestion } from '@workspace/triage-engine/apcq';

export const runtime = 'nodejs';

const TEMPLATE_KEY = 'general_screening';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json() as { name?: string; dob?: string | null };
  const name = body.name?.trim();
  const dob = body.dob?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
  }

  const sb = getServiceClient();

  try {
    // Resolve active template
    const { data: template, error: tmplErr } = await sb
      .from('questionnaire_templates')
      .select('id')
      .eq('name', TEMPLATE_KEY)
      .eq('is_active', true)
      .single();

    if (tmplErr || !template) {
      return NextResponse.json(
        { error: 'Check-in unavailable — template not configured. Please see a staff member.' },
        { status: 503 },
      );
    }

    // Create an anonymous patient record for this visit
    const { data: patient, error: patErr } = await sb
      .from('patients')
      .insert({
        full_name: name,
        date_of_birth: dob,
      })
      .select('id')
      .single();

    const patientId: string | null = patErr ? null : (patient?.id ?? null);

    // Create questionnaire session
    const sessionToken = randomBytes(16).toString('hex');
    const { data: session, error: sessErr } = await sb
      .from('questionnaire_sessions')
      .insert({
        template_id: template.id,
        mode: 'screening',
        status: 'in_progress',
        delivery_method: 'kiosk',
        session_token: sessionToken,
        patient_id: patientId,
        consent_given: false,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessErr || !session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 502 });
    }

    // Initialise engine to get first question
    const state = createSession({ sessionId: session.id, templateKey: TEMPLATE_KEY, mode: 'screening' });
    const firstQuestion = getNextQuestion(state);
    const totalEstimated = state.queuedKeys.length;

    return NextResponse.json(
      { token: sessionToken, sessionId: session.id, firstQuestion, totalEstimated },
      { status: 201 },
    );
  } catch (err) {
    console.error('[kiosk/checkin]', err);
    return NextResponse.json({ error: 'Unexpected error — please see a staff member.' }, { status: 500 });
  }
}
