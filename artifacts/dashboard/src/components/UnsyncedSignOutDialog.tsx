import React, { useEffect, useRef } from 'react';
import { unsyncedQuestion, type UnsyncedSummary } from '@/lib/secure-sign-out';

/**
 * Shown when sign-out would destroy clinical data that exists only in this
 * browser (the offline outbox, local follow-up reminders, referral drafts).
 * "Stay signed in" is the default and the focused button; discarding needs a
 * deliberate second click on the danger button. Escape = stay.
 */
export default function UnsyncedSignOutDialog({
  summary, onStay, onDiscard,
}: { summary: UnsyncedSummary; onStay: () => void; onDiscard: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="unsynced-title" aria-describedby="unsynced-desc" style={backdrop}>
      <div style={card}>
        <div id="unsynced-title" style={{ fontSize: 16, fontWeight: 700, color: '#fde68a', marginBottom: 10 }}>
          {unsyncedQuestion(summary)}
        </div>
        <div id="unsynced-desc" style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 20 }}>
          {summary.outbox > 0 && (
            <>These edits could not be saved to the server yet
              {summary.outboxTypes.length > 0 && <> ({summary.outboxTypes.join(', ').replace(/_/g, ' ')})</>}.
              {' '}Staying signed in lets them sync automatically when the connection returns.{' '}</>
          )}
          {(summary.followUps > 0 || summary.referralDrafts > 0) && (
            <>Local follow-up reminders and referral drafts are kept only in this browser.{' '}</>
          )}
          Signing out now removes patient data from this browser, including these items.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button ref={stayRef} type="button" onClick={onStay} style={primary}>
            Stay signed in
          </button>
          <button type="button" onClick={onDiscard} style={danger}>
            Discard and sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function SigningOutOverlay() {
  return (
    <div role="status" aria-live="polite" style={{ ...backdrop, zIndex: 10002 }}>
      <div style={{ ...card, maxWidth: 320, textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>
        Saving your changes before signing out…
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 10001,
  background: 'rgba(5, 15, 13, 0.85)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const card: React.CSSProperties = {
  background: '#0d2520', border: '1px solid #1e3a3a', borderRadius: 14,
  padding: '24px 24px 20px', maxWidth: 460, width: '100%',
  boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
};
const primary: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, border: 'none', background: '#0d9488',
  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const danger: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 8, border: '1px solid #7f1d1d', background: 'transparent',
  color: '#fca5a5', fontWeight: 600, fontSize: 13, cursor: 'pointer',
};
