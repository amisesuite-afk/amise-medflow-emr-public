'use client';
import { triageColor, triageBg, triageLabel } from '@/lib/triage';
import type { TriageLevel } from '@/types';

export default function TriageBadge({ level }: { level: TriageLevel }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
        background: triageBg(level), color: triageColor(level),
        border: `1px solid ${triageColor(level)}44`,
      }}
    >
      {level === 'EMERGENT' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: triageColor(level), animation: 'pulse 1s infinite' }} />
      )}
      {triageLabel(level)}
    </span>
  );
}
