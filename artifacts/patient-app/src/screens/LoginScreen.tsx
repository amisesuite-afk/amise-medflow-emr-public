import React, { useEffect, useState } from 'react';
import { login, requestAccess } from '../api';
import type { PatientSession } from '../api';

interface Props {
  prefillEmail?: string;
  prefillPassword?: string;
  onLogin: (session: PatientSession) => void;
}

type View = 'login' | 'request-sent' | 'change-password';

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100dvh',
    background: '#060e1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 24px',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  wordmark: {
    color: '#0d9488',
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: '0.12em',
    textAlign: 'center',
    marginBottom: 4,
  },
  heading: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
  },
  sub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 5,
    display: 'block',
  },
  input: {
    width: '100%',
    background: '#0d1b2e',
    border: '1.5px solid #1e3a5f',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 16,
    padding: '12px 14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  btn: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    background: '#0d9488',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed' as const,
  },
  ghost: {
    background: 'none',
    border: 'none',
    color: '#0d9488',
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
  error: {
    background: 'rgba(220,38,38,0.12)',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: 8,
    color: '#fca5a5',
    fontSize: 13,
    padding: '10px 14px',
    lineHeight: 1.5,
  },
  success: {
    background: 'rgba(13,148,136,0.12)',
    border: '1px solid rgba(13,148,136,0.4)',
    borderRadius: 8,
    color: '#5eead4',
    fontSize: 13,
    padding: '10px 14px',
    lineHeight: 1.5,
  },
};

export default function LoginScreen({ prefillEmail = '', prefillPassword = '', onLogin }: Props) {
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState(prefillPassword);
  const [requestEmail, setRequestEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the URL pre-filled both fields, auto-submit once
  useEffect(() => {
    if (prefillEmail && prefillPassword) {
      void handleLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const session = await login(email.trim().toLowerCase(), password);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed — please check your details');
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestAccess() {
    if (!requestEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await requestAccess(requestEmail.trim().toLowerCase());
      setView('request-sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send access email');
    } finally {
      setLoading(false);
    }
  }

  // ── Request sent confirmation ─────────────────────────────────────────────

  if (view === 'request-sent') {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.wordmark}>AMISE</div>
          <div style={s.heading}>Check your email</div>
          <div style={s.success}>
            We've sent a temporary password to <strong>{requestEmail}</strong>.
            Open the link in the email or enter the password below.
            It's valid for 72 hours.
          </div>
          <button type="button" style={s.btn} onClick={() => { setEmail(requestEmail); setView('login'); }}>
            Enter password →
          </button>
        </div>
      </div>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div>
          <div style={s.wordmark}>AMISE</div>
          <div style={s.heading}>Patient Portal</div>
          <div style={s.sub}>Sign in to complete your pre-visit forms, manage your medical passport, and track your recovery.</div>
        </div>

        {error && <div style={s.error}>{error}</div>}

        <div>
          <label style={s.label}>Email address</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleLogin()}
            placeholder="your@email.com"
            style={s.input}
          />
        </div>

        <div>
          <label style={s.label}>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleLogin()}
            placeholder="Your password or temporary code"
            style={s.input}
          />
        </div>

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading || !email.trim() || !password}
          style={{ ...s.btn, ...(loading || !email.trim() || !password ? s.btnDisabled : {}) }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#475569' }}>
          First time? No password yet?{' '}
          <button
            type="button"
            style={s.ghost}
            onClick={() => { setRequestEmail(email); setError(null); setView('request-sent'); void requestAccess(email.trim().toLowerCase()).catch(err => setError(err instanceof Error ? err.message : 'Error')); }}
          >
            Send me access
          </button>
        </div>

        <div style={{ borderTop: '1px solid #0d1b2e', paddingTop: 16 }}>
          <label style={s.label}>Or enter a different email to request access</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              value={requestEmail}
              onChange={e => setRequestEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ ...s.input, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => void handleRequestAccess()}
              disabled={loading || !requestEmail.trim()}
              style={{
                padding: '12px 16px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: loading || !requestEmail.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !requestEmail.trim() ? 0.55 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '…' : 'Send →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
