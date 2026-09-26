'use client';

/**
 * Idle auto sign-out for the front-desk staff pages (compliance G-4).
 *
 * After NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES (default 15, clamped 2–120) without
 * input, a 60-second warning with "Stay signed in" appears; when it runs out
 * the staff session and its cookie are cleared (signOutStaff) and the page is
 * reloaded onto /staff/login?reason=idle, which drops everything held in
 * memory. The staff pages keep no patient data in browser storage and have no
 * offline queue, so there is nothing unsynced to protect here (contrast the
 * dashboard's IdleLock).
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { signOutStaff } from '@/lib/staff-supabase';
import {
  createIdleController, parseIdleTimeoutMinutes, IDLE_WARNING_MS, SHARED_ACTIVITY_KEY,
  type IdleController,
} from '@/lib/idle-timeout';

// Must be referenced literally so Next inlines it at build time.
const TIMEOUT_MINUTES = parseIdleTimeoutMinutes(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES);
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
// Separate from the dashboard's key: different origin in production anyway.
const SHARED_KEY = `${SHARED_ACTIVITY_KEY}-staff`;

function readShared(): number | null {
  try {
    const v = Number(localStorage.getItem(SHARED_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}
function writeShared(t: number): void {
  try { localStorage.setItem(SHARED_KEY, String(t)); } catch { /* ignore */ }
}

export default function StaffIdleTimeout() {
  const pathname = usePathname() ?? '';
  const enabled = pathname.startsWith('/staff') && !pathname.startsWith('/staff/login');
  const [warning, setWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(IDLE_WARNING_MS);
  const [signingOut, setSigningOut] = useState(false);
  const ctrlRef = useRef<IdleController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = createIdleController({
      timeoutMs: TIMEOUT_MINUTES * 60_000,
      readSharedActivity: readShared,
      writeSharedActivity: writeShared,
      onChange: (phase, remaining) => {
        if (phase === 'warning') { setRemainingMs(remaining); setWarning(true); }
        else if (phase === 'active') setWarning(false);
        else {
          setWarning(false);
          setSigningOut(true);
          void signOutStaff().finally(() => { window.location.replace('/staff/login?reason=idle'); });
        }
      },
    });
    ctrlRef.current = ctrl;
    const onActivity = () => ctrl.activity();
    const onStorage = (e: StorageEvent) => { if (e.key === SHARED_KEY) ctrl.tick(); };
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
  }, [enabled]);

  if (!enabled || (!warning && !signingOut)) return null;

  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="staff-idle-title" style={{
      position: 'fixed', inset: 0, zIndex: 1000, padding: 16,
      background: signingOut ? '#0f172a' : 'rgba(15, 23, 42, 0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 14,
        padding: '28px 28px 22px', maxWidth: 380, width: '100%', textAlign: 'center',
      }}>
        {signingOut ? (
          <div id="staff-idle-title" role="status" style={{ color: '#cbd5e1', fontSize: 14 }}>Signing out…</div>
        ) : (
          <>
            <div id="staff-idle-title" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              Still there?
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }} aria-live="polite">
              For patient privacy you will be signed out in{' '}
              <strong style={{ color: '#fde68a' }}>{secs} second{secs === 1 ? '' : 's'}</strong>{' '}
              after {TIMEOUT_MINUTES} minutes without activity.
            </div>
            <button
              type="button"
              autoFocus
              onClick={() => { ctrlRef.current?.staySignedIn(); setWarning(false); }}
              style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Stay signed in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
