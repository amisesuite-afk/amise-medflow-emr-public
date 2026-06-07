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
  const next   = params.get('next') ?? '/patient';

  useEffect(() => {
    const sb = getPatientClient();
    let settled = false;

    // Hard navigation, not router.replace() — the Next.js client router can
    // silently stall after an async auth state change. A full page load
    // reliably picks up the now-persisted session.
    function go(destination: string) {
      if (settled) return;
      settled = true;
      window.location.href = destination;
    }

    // The link uses Supabase's implicit flow: the access/refresh tokens arrive
    // in the URL hash (#access_token=...) and supabase-js (detectSessionInUrl)
    // parses and persists them automatically — entirely client-side, so it
    // works even when the link is opened in a different browser/WebView than
    // the one that requested it (unlike PKCE, which needs a shared verifier).
    void sb.auth.getSession().then(({ data: { session } }) => {
      if (session) go(next);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) go(next);
    });

    // Fallback: if no session materialises shortly, the link was likely
    // invalid or expired — send the patient back to request a fresh one.
    const timeout = setTimeout(() => go('/patient/login'), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [params, next]);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackContent />
    </Suspense>
  );
}
