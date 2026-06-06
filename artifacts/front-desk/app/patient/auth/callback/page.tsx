'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const sb   = getPatientClient();
    const code = params.get('code');

    if (code) {
      // PKCE flow: exchange the one-time code for a session
      void sb.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (data.session) {
          router.replace('/patient');
        } else {
          console.error('exchangeCodeForSession failed:', error);
          router.replace('/patient/login?error=auth');
        }
      });
    } else {
      // Fallback: check if a session already exists (e.g. navigated here directly)
      void sb.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace('/patient');
        } else {
          router.replace('/patient/login?error=nocode');
        }
      });
    }
  }, [router, params]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${TEAL}`, borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Signing you in…</p>
    </div>
  );
}
