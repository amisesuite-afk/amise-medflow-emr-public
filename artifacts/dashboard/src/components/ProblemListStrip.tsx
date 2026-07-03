import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import type { PatientProblem } from '@/lib/db';

const STATUS_CONFIG: Record<PatientProblem['status'], { bg: string; text: string; label: string; next: PatientProblem['status'] }> = {
  active:   { bg: '#fef2f2', text: '#b91c1c', label: 'Active',   next: 'chronic' },
  chronic:  { bg: '#fffbeb', text: '#92400e', label: 'Chronic',  next: 'resolved' },
  resolved: { bg: '#f0fdf4', text: '#166534', label: 'Resolved', next: 'active' },
};

export default function ProblemListStrip() {
  const { problems, addProblem, updateProblemStatus, deleteProblem, patientId } = useAppContext();
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) setTimeout(() => inputRef.current?.focus(), 30);
  }, [adding]);

  const activeCount = problems.filter(p => p.status !== 'resolved').length;

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    setAdding(false);
    await addProblem({ title, status: 'active' });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { void handleAdd(); }
    if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
  }

  const hasProblem = problems.length > 0 || adding;

  return (
    <div style={{
      background: '#1e293b',
      borderBottom: '1px solid #334155',
      padding: '4px 12px',
      userSelect: 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
        >
          <span style={{ fontSize: 9, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 150ms' }}>▶</span>
          Problem List
          {activeCount > 0 && (
            <span style={{ marginLeft: 4, fontSize: 9, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '0 5px', fontWeight: 700 }}>
              {activeCount}
            </span>
          )}
        </button>

        {!hasProblem && !adding && (
          <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', marginLeft: 4 }}>No active problems</span>
        )}

        {expanded && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title="Add problem"
            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: '1px 7px', lineHeight: '18px' }}
          >
            + Add
          </button>
        )}
      </div>

      {/* Problem chips */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingBottom: hasProblem || adding ? 6 : 0, marginTop: hasProblem || adding ? 4 : 0 }}>
          {problems.map(p => {
            const cfg = STATUS_CONFIG[p.status];
            return (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,0.06)', border: `1px solid #334155`, borderRadius: 5, padding: '2px 6px 2px 3px' }}
              >
                <button
                  type="button"
                  title={`Status: ${cfg.label} — click to change`}
                  onClick={() => void updateProblemStatus(p.id, cfg.next)}
                  style={{ background: cfg.bg, color: cfg.text, border: 'none', borderRadius: 3, fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '1px 4px', whiteSpace: 'nowrap' }}
                >
                  {cfg.label}
                </button>
                <span style={{ fontSize: 11, color: '#e2e8f0', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.title}
                </span>
                {p.icd10Code && (
                  <span style={{ fontSize: 9, color: '#64748b' }}>{p.icd10Code}</span>
                )}
                <button
                  type="button"
                  onClick={() => void deleteProblem(p.id)}
                  title="Remove problem"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 11, lineHeight: 1, padding: '0 1px', marginLeft: 1 }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {adding && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', border: '1px solid #475569', borderRadius: 5, padding: '2px 6px' }}>
              <input
                ref={inputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => { if (!newTitle.trim()) { setAdding(false); } }}
                placeholder="Problem or diagnosis…"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 11, width: 180 }}
              />
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); void handleAdd(); }}
                style={{ background: '#3b82f6', border: 'none', borderRadius: 3, color: '#fff', fontSize: 10, cursor: 'pointer', padding: '1px 6px', fontWeight: 600 }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewTitle(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                ×
              </button>
            </div>
          )}

          {!patientId && problems.length > 0 && (
            <span style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', alignSelf: 'center' }}>Save patient to persist</span>
          )}
        </div>
      )}
    </div>
  );
}
