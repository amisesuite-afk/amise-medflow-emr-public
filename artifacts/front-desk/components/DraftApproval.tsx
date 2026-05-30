'use client';
import { useState } from 'react';
import type { ConversationThread } from '@/types';

interface Props {
  thread: ConversationThread;
  secret: string;
  onAction: () => void;
}

export default function DraftApproval({ thread, secret, onAction }: Props) {
  const [draft, setDraft]     = useState(thread.draft_reply ?? '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');

  async function call(endpoint: string, body: Record<string, unknown>) {
    setLoading(true);
    setMsg('');
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
        body: JSON.stringify(body),
      });
      const data = await r.json() as { success?: boolean; error?: string };
      setMsg(data.success ? '✓ Done' : `Error: ${data.error ?? 'unknown'}`);
      if (data.success) onAction();
    } catch {
      setMsg('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '12px 14px', background: '#0c1a2e', border: '1px solid #0d9488', borderRadius: 8, marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#5eead4', marginBottom: 8, textTransform: 'uppercase' }}>
        Draft Reply — Pending Approval
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6,
          background: '#1e293b', border: '1px solid #374151', color: '#e2e8f0', fontSize: 13,
          resize: 'vertical', fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/approve', { threadId: thread.id, nurseId: 'nurse' })}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          {loading ? '…' : '✓ Approve & Send'}
        </button>
        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/reject', { threadId: thread.id, nurseId: 'nurse', editedReply: draft })}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #374151', background: '#1e293b', color: '#e2e8f0', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          Save Edit
        </button>
        <button
          disabled={loading}
          onClick={() => void call('/api/nurse/reject', { threadId: thread.id, nurseId: 'nurse', editedReply: '' })}
          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}
        >
          Discard Draft
        </button>
        {msg && <span style={{ alignSelf: 'center', fontSize: 12, color: msg.startsWith('✓') ? '#34d399' : '#f87171' }}>{msg}</span>}
      </div>
    </div>
  );
}
