import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { signIn, configured } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  if (!configured) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={brand}>Amise Medical Services</div>
          <div style={title}>Configuration Required</div>
          <p style={{ color: '#8fc4b9', fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
            Set the following Replit secrets to enable authentication:
          </p>
          <ul style={{ color: '#5df0e0', fontSize: 12, margin: '12px 0 0 0', padding: '0 0 0 18px', lineHeight: 2 }}>
            <li><code>VITE_SUPABASE_URL</code></li>
            <li><code>VITE_SUPABASE_ANON_KEY</code></li>
          </ul>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    if (err) { setError(err); setBusy(false); }
  }

  return (
    <div style={shell}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 8 }}>
          Amise Medical Services
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '-.02em' }}>
          Front Desk Triage
        </div>
        <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999, background: 'rgba(255,180,0,.1)', border: '1px solid rgba(255,180,0,.28)', color: '#fbbf24', fontSize: 10, fontWeight: 800, letterSpacing: '.08em' }}>
          ⚗ INTERNAL PROTOTYPE — NOT FOR CLINICAL USE
        </div>
      </div>

      <form onSubmit={handleSubmit} style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 18 }}>
          Sign in to continue
        </div>

        <label style={labelStyle}>Email address</label>
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@amisemedical.lc"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = '#0b8278'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.15)'; }}
        />

        <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
        <div style={{ position: 'relative', marginBottom: error ? 10 : 20 }}>
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ ...inputStyle, paddingRight: 42, marginBottom: 0 }}
            onFocus={e => { e.target.style.borderColor = '#0b8278'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.15)'; }}
          />
          <button
            type="button"
            onClick={() => setShowPw(s => !s)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#8fc4b9', padding: 0 }}
          >{showPw ? '🙈' : '👁'}</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.4)', borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 12, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ width: '100%', padding: '11px', borderRadius: 10, background: busy ? '#064a43' : '#0b8278', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', transition: 'background .15s' }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 11, color: '#3d6056', textAlign: 'center', lineHeight: 1.6 }}>
        Amise Medical Services · Verdance Software Division<br />
        This tool is a supervised clinical prototype. All recommendations require clinical review.
      </p>
    </div>
  );
}

const shell: React.CSSProperties = {
  height: '100dvh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(160deg, #0a1f1c 0%, #0d2520 55%, #0a2535 100%)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: '20px 16px',
};
const card: React.CSSProperties = {
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 18, padding: '28px 32px 24px', width: '100%', maxWidth: 340,
  backdropFilter: 'blur(16px)',
};
const brand: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
  color: '#4db8ad', marginBottom: 8,
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 900, color: '#fff' };
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
  textTransform: 'uppercase', color: '#8fc4b9', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.3)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 0,
  transition: 'border-color .15s',
};
