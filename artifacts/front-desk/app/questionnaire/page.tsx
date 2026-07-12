import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const TEMPLATE_KEY = 'general_screening';

function UnavailablePage({ reason }: { reason?: string }) {
  const isConfigError = reason === 'config';
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a',
      textAlign: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Amise Medical Services
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 12px', color: '#0f172a' }}>
          Questionnaire unavailable
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: '0 0 20px' }}>
          {isConfigError
            ? 'The intake system is being configured. Please contact us to book your appointment.'
            : 'The intake questionnaire is temporarily unavailable. Please contact us directly to book your appointment.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <a
            href="https://wa.me/17582840557"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 50,
              background: '#16a34a', color: '#fff',
              fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}
          >
            WhatsApp us: 758-284-0557
          </a>
          <a
            href="tel:+17582840557"
            style={{ fontSize: 13, color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}
          >
            Or call: 758-284-0557 (Tapion) · 758-720-7111 (Rodney Bay)
          </a>
          <a
            href="/"
            style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', marginTop: 8 }}
          >
            ← Return to home page
          </a>
        </div>
      </div>
    </div>
  );
}

export default async function QuestionnaireStartPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder') {
    console.error('[questionnaire] Supabase not configured — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    return <UnavailablePage reason="config" />;
  }

  const sb = getServiceClient();

  const { data: template, error: tmplErr } = await sb
    .from('questionnaire_templates')
    .select('id')
    .eq('name', TEMPLATE_KEY)
    .eq('is_active', true)
    .single();

  if (tmplErr || !template) {
    console.error('[questionnaire] Template lookup failed:', tmplErr?.message ?? 'no active template found');
    return <UnavailablePage />;
  }

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

  if (sessErr) {
    console.error('[questionnaire] Session creation failed:', sessErr.message);
    return <UnavailablePage />;
  }

  redirect(`/questionnaire/${sessionToken}`);
}
