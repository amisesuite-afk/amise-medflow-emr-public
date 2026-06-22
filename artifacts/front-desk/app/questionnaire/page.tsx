import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TEMPLATE_KEY = 'general_screening';

const unavailable = (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a',
    textAlign: 'center', padding: 24,
  }}>
    <p>The intake questionnaire is temporarily unavailable. Please contact us directly to book your appointment.</p>
  </div>
);

// Self-service entry point: creates a new anonymous questionnaire session
// and hands off to the token-based flow at /questionnaire/[token].
export default async function QuestionnaireStartPage() {
  const sb = getServiceClient();

  const { data: template, error: tmplErr } = await sb
    .from('questionnaire_templates')
    .select('id')
    .eq('name', TEMPLATE_KEY)
    .eq('is_active', true)
    .single();

  if (tmplErr || !template) return unavailable;

  const sessionToken = randomBytes(16).toString('hex');

  const { error: sessErr } = await sb
    .from('questionnaire_sessions')
    .insert({
      template_id: template.id,
      mode: 'screening',
      status: 'in_progress',
      delivery_method: 'kiosk',
      session_token: sessionToken,
      consent_given: false,
      started_at: new Date().toISOString(),
    });

  if (sessErr) return unavailable;

  redirect(`/questionnaire/${sessionToken}`);
}
