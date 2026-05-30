'use client';
import type { ConversationThread } from '@/types';
import TriageBadge from './TriageBadge';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_DOT: Record<string, string> = {
  active: '#34d399',
  pending_approval: '#fbbf24',
  resolved: '#6b7280',
  escalated: '#ef4444',
};

interface Props {
  thread: ConversationThread;
  selected: boolean;
  onClick: () => void;
}

export default function ThreadCard({ thread, selected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? '#1e3a5f' : '#1e293b',
        border: `1px solid ${selected ? '#0d9488' : '#374151'}`,
        borderLeft: selected ? '3px solid #0d9488' : '3px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <TriageBadge level={thread.triage_level} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[thread.status] ?? '#6b7280' }} />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{timeAgo(thread.updated_at)}</span>
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 2 }}>
        {thread.patient_name ?? 'Anonymous'}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {thread.chief_complaint ?? 'No complaint recorded yet'}
      </div>
    </div>
  );
}
