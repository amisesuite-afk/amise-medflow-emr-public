import { useEffect, useState } from 'react';
import { pendingCount, type SyncStatus } from '@/lib/sync-outbox';

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

  if ((effectiveStatus as string) === 'idle' || (effectiveStatus as string) === 'synced' || (effectiveStatus as string) === 'saved') {
    // Show nothing when everything is clean (no noise)
    return null;
  }

  return (
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
    </span>
  );
}
