'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getStaffClient } from '@/lib/staff-supabase';
import { Suspense } from 'react';

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
    outline: 'none',
  } as React.CSSProperties,
  btn: {
    width: '100%',
    padding: '13px 0',
    borderRadius: 8,
    background: TEAL,
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  err: {
    background: '#7f1d1d22',
    border: '1px solid #7f1d1d',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fca5a5',
    fontSize: 13,
    marginBottom: 16,
  } as React.CSSProperties,
};

function LoginContent() {
  const params  = useSearchParams();
  const next    = params.get('next') ?? '/staff/schedule';
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [err,   setErr]     = useState('');
  const [busy,  setBusy]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const sb = getStaffClient();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) { setErr(error.message); setBusy(false); return; }
      window.location.href = next;
    } catch {
      setErr('Login failed — please try again.');
      setBusy(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ color: TEAL, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 6 }}>
            MedFlow
          </div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Staff scheduling portal</div>
        </div>

        {err && <div style={s.err}>{err}</div>}

        <form onSubmit={void submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Staff email</label>
            <input
              style={s.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>
          <button style={{ ...s.btn, opacity: busy ? 0.7 : 1 }} type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#475569' }}>
          Patient portal: <a href="/patient/login" style={{ color: TEAL }}>sign in here</a>
        </div>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
