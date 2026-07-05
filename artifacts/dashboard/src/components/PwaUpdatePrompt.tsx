import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 minutes while the tab is open
      if (r) {
        setInterval(() => { void r.update(); }, 60 * 60 * 1000);
      }
    },
  });

  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when a new update arrives
  useEffect(() => {
    if (needRefresh) setDismissed(false);
  }, [needRefresh]);

  if (!needRefresh || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#1e3a2e', color: '#fff',
      borderRadius: 10, padding: '12px 18px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      <span>🔄 New version available</span>
      <button
        onClick={() => { void updateServiceWorker(true); }}
        style={{
          background: '#10b981', color: '#fff', border: 'none',
          borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Update now
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'transparent', color: '#9ca3af', border: 'none',
          cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
        }}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
