import { useState, useRef, useEffect } from 'react';

const PIN = import.meta.env.VITE_ACCESS_PIN || 'amise2025';
const STORAGE_KEY = 'amise_proto_auth';

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(STORAGE_KEY) === PIN);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!authed) inputRef.current?.focus(); }, [authed]);

  if (authed) return <>{children}</>;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PIN) {
      sessionStorage.setItem(STORAGE_KEY, PIN);
      setAuthed(true);
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 600);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0a1f1c 0%, #0d2520 55%, #0a2535 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Logo / brand */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 8 }}>
          Amise Medical Services
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: '-.02em', marginBottom: 4 }}>
          MedFlow EMR
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', borderRadius: 999,
          background: 'rgba(255,180,0,.12)', border: '1px solid rgba(255,180,0,.3)',
          color: '#fbbf24', fontSize: 11, fontWeight: 800, letterSpacing: '.08em',
        }}>
          ⚗ INTERNAL PROTOTYPE — NOT FOR CLINICAL USE
        </div>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 18,
          padding: '32px 36px 28px',
          width: 320,
          backdropFilter: 'blur(16px)',
          animation: shake ? 'gateshake .5s ease' : undefined,
        }}
      >
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8fc4b9', marginBottom: 8 }}>
          Access code
        </label>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter access code"
            autoComplete="off"
            style={{
              width: '100%', padding: '11px 44px 11px 14px',
              borderRadius: 10, border: '1px solid rgba(255,255,255,.15)',
              background: 'rgba(0,0,0,.3)', color: '#fff',
              fontSize: 15, outline: 'none', letterSpacing: show ? undefined : '.1em',
              boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = '#0b8278'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.15)'; }}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, color: '#8fc4b9', padding: 0, lineHeight: 1,
            }}
          >{show ? '🙈' : '👁'}</button>
        </div>
        <button
          type="submit"
          style={{
            width: '100%', padding: '11px', borderRadius: 10,
            background: '#0b8278', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            transition: 'background .15s',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#0f9e92'; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#0b8278'; }}
        >
          Unlock
        </button>
      </form>

      {/* Footer */}
      <p style={{ marginTop: 28, fontSize: 11, color: '#3d6056', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
        Amise Medical Services · Verdance Software Division<br />
        This tool is a supervised clinical prototype. All triage recommendations require qualified clinical review.
      </p>

      <style>{`
        @keyframes gateshake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
