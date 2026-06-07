'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const params = useSearchParams();
  const next = params.get('next') ?? '/patient';

  const [email,      setEmail]      = useState('');
  const [stage,      setStage]      = useState<'email' | 'sent' | 'error' | 'stuck' | 'redirecting'>('email');
  const [errMsg,     setErrMsg]     = useState('');
  const [loading,    setLoading]    = useState(false);
  // Guards against double-fire (e.g. on-screen keyboard "Go" + button tap landing
  // almost simultaneously) — useState is async and can't prevent a same-tick race;
  // a ref flips synchronously so the second call bails before any network request.
  const inFlight = useRef(false);

  useEffect(() => {
    const sb = getPatientClient();

    // Loop-breaker: a stale/half-written session can "exist" here yet get
    // rejected by the destination page, which bounces back to login — which
    // sees the same stale session and bounces away again, forever. If we're
    // about to redirect away but a prior attempt already landed us back here,
    // the session is bad: clear it and stay put instead of looping.
    const BOUNCE_FLAG = 'amise-patient-login-redirect-attempted';

    function redirectAwayOrBreakLoop() {
      if (sessionStorage.getItem(BOUNCE_FLAG)) {
        // Second bounce: the session "exists" here but the destination won't
        // accept it (commonly an in-app browser — Mail, Gmail, etc. — that
        // doesn't keep the session in storage across a full page load).
        // Signing out silently just left patients staring at a spinner
        // forever; show them what happened and how to actually get in.
        sessionStorage.removeItem(BOUNCE_FLAG);
        void sb.auth.signOut();
        setStage('stuck');
        return;
      }
      sessionStorage.setItem(BOUNCE_FLAG, '1');
      setStage('redirecting');
      window.location.href = next;
    }

    void sb.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAwayOrBreakLoop();
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) redirectAwayOrBreakLoop();
    });
    return () => subscription.unsubscribe();
  }, [next]);

  async function sendCode() {
    if (!email.trim() || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setErrMsg('');

    const sb = getPatientClient();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/patient/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);
    inFlight.current = false;

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
      setStage('sent');
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

        {/* A valid sign-in link landed here directly (rather than on the auth
            callback page) — let the patient know we're taking them in rather
            than leaving them looking at a bare form for a moment. */}
        {stage === 'redirecting' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ width: 32, height: 32, margin: '0 auto 16px', borderRadius: '50%', border: `3px solid ${TEAL}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>Signing you in…</p>
          </div>
        )}

        {/* Step 1 — Email */}
        {stage === 'email' && (
          <>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
              Enter your email address and we will send you a sign-in link — just one tap, no codes to type.
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
              {loading ? 'Sending…' : 'Send sign-in link →'}
            </button>
          </>
        )}

        {/* Step 2 — Link sent confirmation */}
        {stage === 'sent' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
              <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#4ade80' }}>
                Check your email
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                We sent a sign-in link to{' '}
                <strong style={{ color: '#e2e8f0' }}>{email}</strong>.
                Open the email and tap the link — that's all you need to do.
              </p>
            </div>

            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
              No rush — the link stays valid for a full hour. Take your time finding the email.
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
              Tip: if you don't see it, check your Junk or Spam folder.
            </p>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={loading}
                style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginRight: 16 }}
              >
                {loading ? 'Sending…' : 'Resend link'}
              </button>
              <button
                type="button"
                onClick={() => setStage('email')}
                style={{ fontSize: 13, color: TEAL, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Change email
              </button>
            </div>
          </>
        )}

        {/* Stuck — sign-in link landed but the session wouldn't carry through,
            most often the in-app browser inside Mail / Gmail / WhatsApp */}
        {stage === 'stuck' && (
          <div>
            <div style={{ padding: '14px 16px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
              <strong>We couldn't finish signing you in here.</strong><br />
              This usually happens when the link opens inside the Mail (or Gmail/WhatsApp) app's
              built-in browser instead of Safari or Chrome.
              <br /><br />
              <strong>Try this:</strong> press and hold the link in the email, choose{' '}
              <em>"Open in Safari"</em> (or copy the link and paste it into Safari/Chrome), then
              request a fresh sign-in link below — links expire once opened.
            </div>
            <button
              type="button"
              onClick={() => { setStage('email'); setErrMsg(''); }}
              style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 9, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Send a new link
            </button>
            <p style={{ margin: '14px 0 0', fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
              Still stuck? Call Tapion Hospital: 459-2227 / 284-0557 — our front desk can book you in directly.
            </p>
          </div>
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
