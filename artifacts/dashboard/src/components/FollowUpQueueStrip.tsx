import { useEffect, useState } from 'react';

const FOLLOW_UP_KEY = 'amise_followup_v1';

interface StoredFollowUp {
  id: string;
  promptId: string;
  label: string;
  dueDate: string;
  done: boolean;
  recurring?: boolean;
  recurringDays?: number;
  patientName?: string;
}

function loadItems(): StoredFollowUp[] {
  try {
    const raw = localStorage.getItem(FOLLOW_UP_KEY);
    return raw ? (JSON.parse(raw) as StoredFollowUp[]) : [];
  } catch { return []; }
}

function saveItems(items: StoredFollowUp[]): void {
  try { localStorage.setItem(FOLLOW_UP_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function FollowUpQueueStrip() {
  const [items, setItems] = useState<StoredFollowUp[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setItems(loadItems().filter(i => !i.done));
  }, []);

  function markDone(item: StoredFollowUp) {
    const all = loadItems();
    const updated = all.map(i => {
      if (i.id !== item.id) return i;
      const next: StoredFollowUp = { ...i, done: true };
      return next;
    });

    // If recurring: add a new item
    if (item.recurring && item.recurringDays) {
      const nextDue = new Date(item.dueDate);
      nextDue.setDate(nextDue.getDate() + item.recurringDays);
      updated.push({
        id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        promptId: item.promptId,
        label: item.label,
        dueDate: nextDue.toISOString().slice(0, 10),
        done: false,
        recurring: item.recurring,
        recurringDays: item.recurringDays,
        patientName: item.patientName,
      });
    }

    saveItems(updated);
    setItems(updated.filter(i => !i.done));
  }

  function dismiss(item: StoredFollowUp) {
    const all = loadItems().filter(i => i.id !== item.id);
    saveItems(all);
    setItems(all.filter(i => !i.done));
  }

  const activeItems = items.filter(i => !i.done);
  if (activeItems.length === 0) return null;

  const overdue = activeItems.filter(i => daysUntil(i.dueDate) < 0);
  const dueSoon = activeItems.filter(i => { const d = daysUntil(i.dueDate); return d >= 0 && d <= 7; });
  const upcoming = activeItems.filter(i => daysUntil(i.dueDate) > 7);

  const hasOverdue = overdue.length > 0;

  return (
    <div style={{
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
      border: `1px solid ${hasOverdue ? '#7f1d1d' : '#1e3a4c'}`,
      background: '#0a1628',
    }}>

      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
          borderBottom: expanded ? '1px solid #1e293b' : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 13 }}>📅</span>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: hasOverdue ? '#fca5a5' : '#38bdf8',
        }}>
          Follow-up Queue
        </span>

        {overdue.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 7px',
            background: '#7f1d1d', color: '#fca5a5',
          }}>
            {overdue.length} overdue
          </span>
        )}

        {dueSoon.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 7px',
            background: '#431407', color: '#fb923c',
          }}>
            {dueSoon.length} due soon
          </span>
        )}

        <span style={{ fontSize: 10, color: '#475569' }}>
          {activeItems.length} pending
        </span>

        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Items */}
      {expanded && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { list: overdue, label: 'OVERDUE', color: '#fca5a5', bg: 'rgba(127,29,29,0.2)', border: '#dc2626' },
            { list: dueSoon, label: 'DUE WITHIN 7 DAYS', color: '#fb923c', bg: 'rgba(66,32,6,0.2)', border: '#d97706' },
            { list: upcoming, label: 'UPCOMING', color: '#93c5fd', bg: 'rgba(30,58,138,0.15)', border: '#3b82f6' },
          ].map(({ list, label, color, bg, border }) =>
            list.length > 0 ? (
              <div key={label}>
                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                  color, textTransform: 'uppercase', padding: '4px 0 3px',
                }}>
                  {label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {list.map(item => {
                    const days = daysUntil(item.dueDate);
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 7,
                          background: bg, border: `1px solid ${border}40`,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.3 }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            {item.patientName && <span style={{ color: '#94a3b8' }}>{item.patientName} · </span>}
                            {formatDate(item.dueDate)}
                            {days < 0
                              ? <span style={{ color: '#fca5a5', fontWeight: 700 }}> · {Math.abs(days)}d overdue</span>
                              : days === 0
                                ? <span style={{ color: '#fb923c', fontWeight: 700 }}> · Today</span>
                                : <span style={{ color: '#94a3b8' }}> · in {days}d</span>
                            }
                            {item.recurring && <span style={{ color: '#818cf8' }}> · recurring</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => markDone(item)}
                          title="Mark complete"
                          style={{
                            flexShrink: 0, padding: '3px 10px', borderRadius: 5,
                            border: 'none', cursor: 'pointer',
                            background: '#0d9488', color: '#fff',
                            fontSize: 11, fontWeight: 700,
                          }}
                        >
                          ✓ Done
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(item)}
                          title="Dismiss from queue"
                          style={{
                            flexShrink: 0, padding: '3px 7px', borderRadius: 5,
                            border: '1px solid #334155', cursor: 'pointer',
                            background: 'transparent', color: '#64748b', fontSize: 11,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
