'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';

const Spinner = () => (
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

// useSearchParams must be inside a Suspense boundary
function CallbackContent() {
  const params = useSearchParams();

  useEffect(() => {
    const sb   = getPatientClient();
    const code = params.get('code');

    // Hard navigation, not router.replace() — the Next.js client router can
    // silently stall after an async auth state change. A full page load
    // reliably picks up the now-persisted session.
    if (code) {
      void sb.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (data.session) {
          window.location.href = '/patient';
        } else {
          console.error('exchangeCodeForSession failed:', error);
          window.location.href = '/patient/login';
        }
      });
    } else {
      void sb.auth.getSession().then(({ data: { session } }) => {
        window.location.href = session ? '/patient' : '/patient/login';
      });
    }
  }, [params]);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackContent />
    </Suspense>
  );
}
