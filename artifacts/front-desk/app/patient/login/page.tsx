'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  } as React.CSSProperties,

  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 14,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 400,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  } as React.CSSProperties,

  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: 15,
    fontFamily: 'inherit',
  } as React.CSSProperties,
};

// useSearchParams must be inside a Suspense boundary
function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/patient';

  const [email,   setEmail]   = useState('');
  const [otp,     setOtp]     = useState('');
  const [stage,   setStage]   = useState<'email' | 'otp' | 'error'>('email');
  const [errMsg,  setErrMsg]  = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sb = getPatientClient();
    void sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(next);
    });
    return () => subscription.unsubscribe();
  }, [next, router]);

  async function sendCode() {
    if (!email.trim()) return;
    setLoading(true);
    setErrMsg('');

    const sb = getPatientClient();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });

    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('not exist') || msg.includes('signups not allowed') || msg.includes('invalid login')) {
        setErrMsg('No patient account found for this email. Please contact our front desk to activate your portal access.');
      } else if (msg.includes('sending') || msg.includes('smtp') || msg.includes('email') || msg.includes('rate limit') || msg.includes('confirmation')) {
        setErrMsg('We are having trouble sending emails right now. Please call 459-2227 / 284-0557 or try again in a few minutes.');
      } else {
        setErrMsg(error.message);
      }
      setStage('error');
    } else {
      setOtp('');
      setStage('otp');
    }
  }

  async function verifyCode() {
    const code = otp.trim();
    if (code.length < 6) return;
    setLoading(true);
    setErrMsg('');

    const sb = getPatientClient();
    const { error } = await sb.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });

    setLoading(false);

    if (error) {
      setErrMsg('That code is invalid or has expired. Please request a new one.');
      setStage('error');
    } else {
      router.replace(next);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>
            Patient Portal
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            Dr Dawit Daniel Kabiye, MD, DM
          </p>
        </div>

        {/* Step 1 — Email */}
        {stage === 'email' && (
          <>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
              Enter your email address and we will send you a sign-in code.
            </p>

            <label style={s.label}>Email Address</label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              placeholder="you@example.com"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void sendCode(); }}
              style={s.input}
            />

            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={!email.trim() || loading}
              style={{
                display: 'block', width: '100%', marginTop: 16, padding: '13px',
                borderRadius: 9, border: 'none',
                background: !email.trim() || loading ? '#1e3a5f' : TEAL,
                color:      !email.trim() || loading ? '#475569' : '#fff',
                fontWeight: 700, fontSize: 15,
                cursor: !email.trim() || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending…' : 'Send sign-in code →'}
            </button>
          </>
        )}

        {/* Step 2 — OTP input */}
        {stage === 'otp' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#4ade80' }}>
                Check your email
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                A sign-in code was sent to{' '}
                <strong style={{ color: '#e2e8f0' }}>{email}</strong>.
                Enter it below — it expires in 1 hour.
              </p>
            </div>

            <label style={s.label}>Sign-in Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              placeholder="000000"
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => { if (e.key === 'Enter') void verifyCode(); }}
              style={{ ...s.input, fontSize: 28, letterSpacing: '0.3em', textAlign: 'center' }}
            />

            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={otp.trim().length < 6 || loading}
              style={{
                display: 'block', width: '100%', marginTop: 16, padding: '13px',
                borderRadius: 9, border: 'none',
                background: otp.trim().length < 6 || loading ? '#1e3a5f' : TEAL,
                color:      otp.trim().length < 6 || loading ? '#475569' : '#fff',
                fontWeight: 700, fontSize: 15,
                cursor: otp.trim().length < 6 || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Verifying…' : 'Sign in →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={loading}
                style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', marginRight: 16 }}
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setStage('email'); setOtp(''); }}
                style={{ fontSize: 13, color: TEAL, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Change email
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div>
            <div style={{ padding: '14px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              {errMsg}
            </div>
            <button
              type="button"
              onClick={() => setStage('email')}
              style={{ fontSize: 13, color: TEAL, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Try again
            </button>
          </div>
        )}

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          New patient?{' '}
          <a href="/patient/request" style={{ color: TEAL, fontWeight: 600, textDecoration: 'none' }}>
            Request a consultation →
          </a>
        </p>

        <p style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e3a5f', fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 1.6 }}>
          Portal access is by invitation from Amise Medical Services staff only.<br />
          For help, call Tapion Hospital: 459-2227 / 284-0557.
        </p>

      </div>
    </div>
  );
}

export default function PatientLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #0d9488', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
