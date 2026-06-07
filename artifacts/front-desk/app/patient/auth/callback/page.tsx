'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const sb   = getPatientClient();
    const code = params.get('code');

    if (code) {
      void sb.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (data.session) {
          router.replace('/patient');
        } else {
          console.error('exchangeCodeForSession failed:', error);
          router.replace('/patient/login');
        }
      });
    } else {
      void sb.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? '/patient' : '/patient/login');
      });
    }
  }, [router, params]);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackContent />
    </Suspense>
  );
}
