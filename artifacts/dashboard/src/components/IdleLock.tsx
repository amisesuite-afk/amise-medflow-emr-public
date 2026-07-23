import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function IdleLock() {
  const { profile, signIn } = useAuth();
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lockedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lockedRef.current = true;
      setLocked(true);
    }, IDLE_TIMEOUT_MS);
  }, []);

  const resetTimer = useCallback(() => {
    if (lockedRef.current) return;
    schedule();
  }, [schedule]);

  useEffect(() => {
    const EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    schedule();
    return () => {
      EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule, resetTimer]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = profile?.email;
    if (!email || !password) return;
    setSubmitting(true);
    setUnlockError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (result.error) {
      setUnlockError(result.error);
    } else {
      lockedRef.current = false;
      setLocked(false);
      setPassword('');
      schedule();
    }
  };

  if (!locked) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(10, 25, 22, 0.97)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: '#0d2520', border: '1px solid #1e3a3a', borderRadius: 16,
        padding: '40px 36px', maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
          Session locked
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 28 }}>
          {profile?.email ?? 'Re-enter your password to continue'}
        </div>
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
              border: '1px solid #1e3a3a', background: '#0a1917', color: '#e2e8f0',
              fontSize: 14, marginBottom: 10, outline: 'none',
            }}
          />
          {unlockError && (
            <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>
              {unlockError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !password}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8,
              border: 'none', background: '#0d9488', color: '#fff',
              fontWeight: 700, fontSize: 14,
              cursor: submitting || !password ? 'default' : 'pointer',
              opacity: submitting || !password ? 0.6 : 1,
              transition: 'opacity .15s',
            }}
          >
            {submitting ? 'Verifying…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
