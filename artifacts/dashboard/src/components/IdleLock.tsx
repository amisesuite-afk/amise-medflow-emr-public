import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  createIdleController, parseIdleTimeoutMinutes, IDLE_WARNING_MS, SHARED_ACTIVITY_KEY,
  type IdleController,
} from '@/lib/idle-timeout';
import { describeUnsynced, type UnsyncedSummary } from '@/lib/secure-sign-out';

/**
 * Idle auto sign-out for every signed-in dashboard role (compliance G-4).
 *
 * After `VITE_IDLE_TIMEOUT_MINUTES` (default 15) without input, a 60-second
 * warning with "Stay signed in" appears. When it runs out, the app flushes
 * pending saves and the offline outbox, then:
 *   - nothing unsynced → signs out (this browser only) and clears PHI from
 *     browser storage; the login page says why;
 *   - unsynced clinical data remains → it is NOT discarded (nobody is there
 *     to confirm). The screen locks instead: patient data is hidden, the same
 *     user can unlock with their password, sync is retried every 30 s and the
 *     session signs out by itself once everything has synced. "Sign out…"
 *     asks before discarding anything.
 */

const TIMEOUT_MINUTES = parseIdleTimeoutMinutes(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES);
const TIMEOUT_MS = TIMEOUT_MINUTES * 60_000;
const LOCKED_RETRY_MS = 30_000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

type UiPhase = 'active' | 'warning' | 'signing_out' | 'locked';

function readShared(): number | null {
  try {
    const v = Number(localStorage.getItem(SHARED_ACTIVITY_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}
function writeShared(t: number): void {
  try { localStorage.setItem(SHARED_ACTIVITY_KEY, String(t)); } catch { /* ignore */ }
}

export default function IdleLock() {
  const { profile, signIn, signOut } = useAuth();
  const [phase, setPhase] = useState<UiPhase>('active');
  const [remainingMs, setRemainingMs] = useState(IDLE_WARNING_MS);
  const [unsynced, setUnsynced] = useState<UnsyncedSummary | null>(null);
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ctrlRef = useRef<IdleController | null>(null);
  const phaseRef = useRef<UiPhase>(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const signOutRef = useRef(signOut);
  useEffect(() => { signOutRef.current = signOut; }, [signOut]);

  const attemptIdleSignOut = useCallback(async () => {
    const out = await signOutRef.current({ reason: 'idle' });
    // 'signed_out': AuthGuard unmounts this component.
    if (out.status === 'blocked') {
      setUnsynced(out.summary);
      setPhase('locked');
    } else if (out.status === 'cancelled') {
      // Joined a manual sign-out whose dialog got "Stay signed in": someone is
      // at the screen. A locked screen stays locked until a password unlock.
      if (phaseRef.current !== 'locked') {
        ctrlRef.current?.staySignedIn();
        setPhase('active');
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = createIdleController({
      timeoutMs: TIMEOUT_MS,
      readSharedActivity: readShared,
      writeSharedActivity: writeShared,
      onChange: (p, remaining) => {
        if (p === 'warning') {
          setRemainingMs(remaining);
          setPhase(prev => (prev === 'active' || prev === 'warning' ? 'warning' : prev));
        } else if (p === 'active') {
          setPhase(prev => (prev === 'warning' ? 'active' : prev));
        } else {
          setPhase('signing_out');
          void attemptIdleSignOut();
        }
      },
    });
    ctrlRef.current = ctrl;

    const onActivity = () => ctrl.activity();
    const onStorage = (e: StorageEvent) => { if (e.key === SHARED_ACTIVITY_KEY) ctrl.tick(); };
    const onVisible = () => { if (document.visibilityState === 'visible') ctrl.tick(); };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => ctrl.tick(), 1_000);
    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity, { capture: true }));
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [attemptIdleSignOut]);

  // While locked with unsynced data: keep trying to sync; sign out once clean.
  useEffect(() => {
    if (phase !== 'locked') return;
    const id = setInterval(() => { void attemptIdleSignOut(); }, LOCKED_RETRY_MS);
    return () => clearInterval(id);
  }, [phase, attemptIdleSignOut]);

  const staySignedIn = () => {
    ctrlRef.current?.staySignedIn();
    setPhase('active');
  };

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
      setPassword('');
      setUnsynced(null);
      ctrlRef.current?.staySignedIn();
      setPhase('active');
    }
  };

  if (phase === 'active') return null;

  if (phase === 'warning') {
    const secs = Math.max(0, Math.ceil(remainingMs / 1000));
    return (
      <div role="alertdialog" aria-modal="true" aria-labelledby="idle-warn-title" style={warnBackdrop}>
        <div style={card}>
          <div id="idle-warn-title" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
            Still there?
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }} aria-live="polite">
            For patient privacy you will be signed out in{' '}
            <strong style={{ color: '#fde68a' }}>{secs} second{secs === 1 ? '' : 's'}</strong>{' '}
            after {TIMEOUT_MINUTES} minutes without activity.
          </div>
          <button type="button" autoFocus onClick={staySignedIn} style={primaryBtn}>
            Stay signed in
          </button>
        </div>
      </div>
    );
  }

  // signing_out / locked: patient data is fully hidden behind an opaque screen.
  return (
    <div style={lockBackdrop}>
      <div style={card}>
        <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
          Session locked
        </div>
        {phase === 'signing_out' ? (
          <div style={{ fontSize: 13, color: '#94a3b8' }} role="status">Saving changes and signing out…</div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              {profile?.email ?? 'Re-enter your password to continue'}
            </div>
            {unsynced && unsynced.total > 0 && (
              <div role="status" style={{ fontSize: 12, color: '#fde68a', background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 8, padding: '8px 10px', marginBottom: 16, textAlign: 'left', lineHeight: 1.45 }}>
                You were not signed out because {describeUnsynced(unsynced)} would have been lost.
                They are kept and will keep trying to sync; this session signs out by itself once they have.
              </div>
            )}
            <form onSubmit={handleUnlock}>
              <input
                type="password"
                autoFocus
                aria-label="Password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={input}
              />
              {unlockError && (
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{unlockError}</div>
              )}
              <button type="submit" disabled={submitting || !password} style={{ ...primaryBtn, width: '100%', opacity: submitting || !password ? 0.6 : 1 }}>
                {submitting ? 'Verifying…' : 'Unlock'}
              </button>
            </form>
            <button type="button" onClick={() => { void signOut(); }} style={linkBtn}>
              Not you? Sign out…
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#0d2520', border: '1px solid #1e3a3a', borderRadius: 16,
  padding: '32px 32px 24px', maxWidth: 380, width: '100%', textAlign: 'center',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
};
const warnBackdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999, padding: 16,
  background: 'rgba(10, 25, 22, 0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const lockBackdrop: React.CSSProperties = {
  ...warnBackdrop,
  background: '#0a1916', // opaque: nothing of the chart shows through
};
const input: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
  border: '1px solid #1e3a3a', background: '#0a1917', color: '#e2e8f0',
  fontSize: 14, marginBottom: 10, outline: 'none',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0d9488',
  color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const linkBtn: React.CSSProperties = {
  marginTop: 14, background: 'none', border: 'none', color: '#94a3b8',
  fontSize: 12, textDecoration: 'underline', cursor: 'pointer',
};
