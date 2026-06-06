'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const sb = getPatientClient();

    // With implicit flow supabase-js reads the URL hash and fires SIGNED_IN
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/patient');
      } else if (event === 'SIGNED_OUT') {
        router.replace('/patient/login');
      }
    });

    // In case the hash was already consumed before this page mounted
    void sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/patient');
    });

    // Fallback — if nothing happens in 8 seconds, go to login
    const t = setTimeout(() => router.replace('/patient/login'), 8000);

    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, [router]);

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
