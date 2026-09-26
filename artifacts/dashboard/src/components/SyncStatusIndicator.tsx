import { useEffect, useState } from 'react';
import { describeRefusal, onOutboxRefusal, pendingCount, type SyncStatus } from '@/lib/sync-outbox';

interface SyncStatusIndicatorProps {
  /** Additional explicit save status from the parent autosave loop */
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

const DOT: Record<SyncStatus | 'saving' | 'idle' | 'saved', { color: string; label: string }> = {
  synced:    { color: '#22c55e', label: 'All changes saved' },
  saved:     { color: '#22c55e', label: 'All changes saved' },
  idle:      { color: '#94a3b8', label: 'No pending changes' },
  pending:   { color: '#f59e0b', label: 'Pending sync' },
  retrying:  { color: '#f59e0b', label: 'Syncing…' },
  saving:    { color: '#f59e0b', label: 'Saving…' },
  conflict:  { color: '#ef4444', label: 'Sync conflict — refresh to resolve' },
  error:     { color: '#ef4444', label: 'Sync error — will retry' },
};

export default function SyncStatusIndicator({ saveStatus }: SyncStatusIndicatorProps) {
  const [pending, setPending] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  // A save the server refused for this role (42501) — dropped, not retried: say so once.
  const [refusal, setRefusal] = useState<string | null>(null);
  useEffect(() => onOutboxRefusal(r => setRefusal(describeRefusal(r))), []);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!mounted) return;
      const n = await pendingCount();
      setPending(n);
      setSyncStatus(n > 0 ? 'pending' : 'synced');
    };
    void check();
    const timer = setInterval(() => { void check(); }, 10_000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  type EffectiveStatus = SyncStatus | 'saving' | 'idle' | 'saved';
  const effectiveStatus: EffectiveStatus =
    saveStatus === 'saving' ? 'saving' :
    saveStatus === 'error'  ? ('error' as EffectiveStatus)  :
    syncStatus as EffectiveStatus;

  const { color, label } = DOT[effectiveStatus] ?? DOT.idle;

  const refusalNotice = refusal && (
    <span role="status" data-testid="outbox-refusal-notice"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: '#92400e',
        padding: '2px 6px', borderRadius: 20, background: '#fffbeb', border: '1px solid #fcd34d',
        maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
      }}
      title={refusal}>
      {refusal}
      <button type="button" onClick={() => setRefusal(null)} aria-label="Dismiss"
        style={{ border: 'none', background: 'none', color: '#92400e', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
    </span>
  );

  if ((effectiveStatus as string) === 'idle' || (effectiveStatus as string) === 'synced' || (effectiveStatus as string) === 'saved') {
    // Show nothing when everything is clean (no noise) — except a refusal notice.
    return refusalNotice || null;
  }

  return (<>{refusalNotice}
    <span
      title={pending > 0 ? `${pending} change${pending !== 1 ? 's' : ''} pending sync — ${label}` : label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 600, color,
        padding: '2px 6px', borderRadius: 20,
        background: `${color}18`,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap', flexShrink: 0,
        animation: effectiveStatus === 'saving' || effectiveStatus === 'retrying'
          ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      {effectiveStatus === 'error' ? `Sync error${pending > 0 ? ` (${pending})` : ''}` :
       effectiveStatus === 'saving' ? 'Saving…' :
       pending > 0 ? `${pending} pending` : label}
    </span></>
  );
}
