import { useEffect, useState } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

/**
 * In-app critical-result alert for doctors and admins: a critical result from the laboratory
 * feed is waiting (filed and unreviewed, or not yet matched to a patient). Polls
 * GET /api/lab-feed/alerts every minute; shows nothing when there is none, when the feed tables
 * are absent (Migration 96 not applied) or the API is unreachable. No patient data is shown here:
 * the Results Inbox has it. The email alert (MODE-gated, staff-only) is sent by the API.
 */
export default function LabFeedCriticalBanner({ onOpen }: { onOpen: () => void }) {
  const [counts, setCounts] = useState<{ filed: number; toMatch: number }>({ filed: 0, toMatch: 0 });

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`${getApiOrigin()}/api/lab-feed/alerts`, { headers: await staffAuthHeaders() });
        if (!res.ok) return;
        const d = await res.json() as { available?: boolean; criticalUnreviewed?: number; criticalToReconcile?: number };
        if (alive) setCounts(d.available === false ? { filed: 0, toMatch: 0 } : { filed: d.criticalUnreviewed ?? 0, toMatch: d.criticalToReconcile ?? 0 });
      } catch { /* offline: keep the last counts */ }
    }
    void poll();
    const t = setInterval(() => void poll(), 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const total = counts.filed + counts.toMatch;
  if (total === 0) return null;
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', margin: '6px 12px 0',
        borderRadius: 8, background: '#fef2f2', border: '1.5px solid #dc2626', color: '#7f1d1d', fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 800 }}>⚠ Critical lab result{total === 1 ? '' : 's'} waiting</span>
      <span style={{ fontSize: 12 }}>
        {counts.filed > 0 ? `${counts.filed} to review` : ''}
        {counts.filed > 0 && counts.toMatch > 0 ? ' · ' : ''}
        {counts.toMatch > 0 ? `${counts.toMatch} not yet matched to a patient` : ''}
      </span>
      <button
        type="button"
        onClick={() => {
          try { sessionStorage.setItem('results_inbox_tab', 'feed'); } catch { /* storage blocked */ }
          onOpen();
        }}
        style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}
      >
        Open Results Inbox
      </button>
    </div>
  );
}
