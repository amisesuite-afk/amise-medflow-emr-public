import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DEMO_MODE } from '@/context/AuthContext';
import { checkSupabaseReachable, configIssues } from '@/lib/supabase';

// Read env at module level so the panel can show real values
const ENV_URL   = import.meta.env.VITE_SUPABASE_URL   as string | undefined;
const ENV_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const DEMO_ROLES = ['front_desk', 'nurse', 'doctor', 'admin'] as const;
type DemoRole = typeof DEMO_ROLES[number];
const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  front_desk: 'Front Desk',
  nurse: 'Nurse',
  doctor: 'Doctor',
  admin: 'Administrator',
};

export default function LoginPage() {
  const { signIn, configured, profileError } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [reachable, setReachable] = useState<{ ok: boolean; status?: number; error?: string } | null>(null);
  const [testing, setTesting]   = useState(false);
  const [demoRole, setDemoRole] = useState<DemoRole>('doctor');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    emailRef.current?.focus();
    // Auto-run connectivity check so diagnostics are ready immediately
    runNetworkTest();
  }, []);

  async function runNetworkTest() {
    setTesting(true);
    const result = await checkSupabaseReachable();
    console.log('[diag] reachability test:', result);
    setReachable(result);
    setTesting(false);
  }

  // Demo mode: show a simple entry card
  if (DEMO_MODE) {
    return (
      <div style={shell}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 8 }}>
            Amise Medical Services
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '-.02em' }}>
            MedFlow EMR
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999, background: 'rgba(255,180,0,.1)', border: '1px solid rgba(255,180,0,.28)', color: '#fbbf24', fontSize: 10, fontWeight: 800, letterSpacing: '.08em' }}>
            ⚗ DEMO MODE — local trial only
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Demo mode active</div>
          <div style={{ fontSize: 12, color: '#8fc4b9', marginBottom: 18, lineHeight: 1.5 }}>
            No Supabase account required. Select a role and enter the app.
          </div>
          <label style={labelStyle}>Enter as</label>
          <select
            value={demoRole}
            onChange={e => setDemoRole(e.target.value as DemoRole)}
            style={{ ...inputStyle, marginBottom: 20, cursor: 'pointer' }}
          >
            {DEMO_ROLES.map(r => (
              <option key={r} value={r}>{DEMO_ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { void signIn(demoRole, ''); }}
            style={{ width: '100%', padding: '11px', borderRadius: 10, background: '#0b8278', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
          >
            Enter as {DEMO_ROLE_LABELS[demoRole]}
          </button>
        </div>
      </div>
    );
  }

  // Show spinner while profile is loading post-sign-in
  if (signingIn) {
    return (
      <div style={shell}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Spinner size={28} />
          <div style={{ color: '#4db8ad', fontSize: 13, fontWeight: 700, letterSpacing: '.06em' }}>
            Loading your profile…
          </div>
          {profileError && (
            <div style={{ ...errorBox, maxWidth: 380, textAlign: 'center' }}>
              <strong>Profile warning:</strong> {profileError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not configured at all
  if (!configured) {
    return (
      <div style={shell}>
        <div style={card}>
          <div style={brand}>Amise Medical Services</div>
          <div style={title}>Configuration Required</div>
          <DiagPanel envUrl={ENV_URL} envAnon={ENV_ANON} reachable={reachable} testing={testing} onTest={runNetworkTest} />
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setErrorDetail(null);
    const { error: err, detail } = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setErrorDetail(detail ?? null);
      setBusy(false);
    } else {
      setSigningIn(true);
    }
  }

  return (
    <div style={shell}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 8 }}>
          Amise Medical Services
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: '-.02em' }}>
          MedFlow EMR
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
          <div style={{ ...errorBox, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: errorDetail ? 4 : 0 }}>{error}</div>
            {errorDetail && (
              <div style={{ fontSize: 10, opacity: .75, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 4 }}>
                {errorDetail}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ width: '100%', padding: '11px', borderRadius: 10, background: busy ? '#064a43' : '#0b8278', color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {busy ? <><Spinner size={14} /><span>Signing in…</span></> : 'Sign in'}
        </button>

        {/* Diagnostics toggle */}
        <button
          type="button"
          onClick={() => { setShowDiag(d => !d); if (!showDiag) runNetworkTest(); }}
          style={{ marginTop: 14, width: '100%', background: 'none', border: 'none', color: 'rgba(77,184,173,.5)', fontSize: 10, cursor: 'pointer', letterSpacing: '.06em', fontWeight: 600 }}
        >
          {showDiag ? 'hide diagnostics ▲' : 'connection diagnostics ▼'}
        </button>
      </form>

      {showDiag && (
        <div style={{ width: '100%', maxWidth: 340, marginTop: 10 }}>
          <DiagPanel envUrl={ENV_URL} envAnon={ENV_ANON} reachable={reachable} testing={testing} onTest={runNetworkTest} />
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 11, color: '#3d6056', textAlign: 'center', lineHeight: 1.6 }}>
        Amise Medical Services · Verdance Software Division<br />
        This tool is a supervised clinical prototype. All recommendations require clinical review.
      </p>
    </div>
  );
}

function DiagPanel({ envUrl, envAnon, reachable, testing, onTest }: {
  envUrl: string | undefined;
  envAnon: string | undefined;
  reachable: { ok: boolean; status?: number; error?: string } | null;
  testing: boolean;
  onTest: () => void;
}) {
  const envRows: { label: string; value: string; ok: boolean }[] = [
    {
      label: 'VITE_SUPABASE_URL',
      value: envUrl ? `${envUrl.slice(0, 36)}${envUrl.length > 36 ? '…' : ''} (${envUrl.length} chars)` : 'NOT SET',
      ok: Boolean(envUrl) && configIssues.filter(i => i.variable === 'VITE_SUPABASE_URL').length === 0,
    },
    {
      label: 'VITE_SUPABASE_ANON_KEY',
      value: envAnon ? `${envAnon.slice(0, 6)}… (${envAnon.length} chars, starts: ${envAnon.slice(0, 10)})` : 'NOT SET',
      ok: Boolean(envAnon) && configIssues.filter(i => i.variable === 'VITE_SUPABASE_ANON_KEY').length === 0,
    },
    ...(reachable !== null ? [{
      label: 'Server reachable',
      value: reachable.ok ? `✓ HTTP ${reachable.status}` : `✗ ${reachable.error ?? `HTTP ${reachable.status}`}`,
      ok: reachable.ok,
    }] : []),
  ];

  return (
    <div style={{ background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '12px 14px', marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 10 }}>
        Connection Diagnostics
      </div>

      {/* Env var status rows */}
      {envRows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5, fontSize: 11 }}>
          <span style={{ color: '#8fc4b9', fontFamily: 'monospace', flexShrink: 0 }}>{r.label}</span>
          <span style={{ color: r.ok ? '#4ade80' : '#f87171', fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{r.value}</span>
        </div>
      ))}

      {/* Validation issues */}
      {configIssues.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Configuration errors
          </div>
          {configIssues.map((issue, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: issue.severity === 'error' ? '#f87171' : '#fbbf24' }}>
                {issue.variable}
              </div>
              <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.5, marginTop: 2 }}>
                {issue.message}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onTest}
        disabled={testing}
        style={{ marginTop: 10, padding: '5px 10px', borderRadius: 6, background: 'rgba(11,130,120,.3)', border: '1px solid rgba(11,130,120,.5)', color: '#4db8ad', fontSize: 10, fontWeight: 700, cursor: testing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {testing ? <><Spinner size={10} /><span>Testing…</span></> : '↻ Re-test connection'}
      </button>
    </div>
  );
}

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="rgba(77,184,173,.3)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#4db8ad" strokeWidth="3" strokeLinecap="round" />
    </svg>
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
const errorBox: React.CSSProperties = {
  background: 'rgba(185,28,28,.15)', border: '1px solid rgba(185,28,28,.4)',
  borderRadius: 8, padding: '8px 12px', color: '#fca5a5', fontSize: 12,
};
