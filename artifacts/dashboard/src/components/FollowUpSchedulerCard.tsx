import { useState } from 'react';
import CollapsibleCard from './CollapsibleCard';

export interface FollowUpEntry {
  id: string;
  type: string;
  date: string;
  location: string;
  instructions: string;
}

const FU_TYPES = [
  'Wound check',
  'Suture / staple removal',
  'Drain removal',
  'Review histopathology',
  'Review imaging',
  'Review blood results',
  'Post-op clinic',
  'Oncology review',
  'Endoscopy follow-up',
  'Dietitian review',
  'Physiotherapy',
  'Other',
];

const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  'Wound check': 'Return for wound inspection. Keep wound dry and covered until review. Report any redness, swelling, discharge, or fever >38°C.',
  'Suture / staple removal': 'Return for suture/staple removal. Keep wound clean and dry. No heavy lifting or strenuous activity until reviewed.',
  'Drain removal': 'Return for drain removal when output <30 mL/24 h. Record daily drain output. Contact rooms if drain dislodges.',
  'Review histopathology': 'Return to discuss pathology results. No changes to management until results reviewed with surgeon.',
  'Review imaging': 'Return to discuss imaging findings. Bring imaging disc/report to appointment.',
  'Post-op clinic': 'Routine post-operative review. Bring all medications and discharge summary. Return to ED if: fever, worsening pain, vomiting, wound breakdown.',
};

interface Props {
  entries: FollowUpEntry[];
  onChange: (entries: FollowUpEntry[]) => void;
}

function nextId() { return `fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

export default function FollowUpSchedulerCard({ entries, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<FollowUpEntry>({
    id: nextId(), type: 'Post-op clinic', date: '', location: 'Amise Medical Services, Rodney Bay', instructions: '',
  });

  function add() {
    if (!draft.date) return;
    onChange([...entries, draft]);
    setDraft({ id: nextId(), type: 'Post-op clinic', date: '', location: 'Amise Medical Services, Rodney Bay', instructions: '' });
    setAdding(false);
  }

  function remove(id: string) { onChange(entries.filter(e => e.id !== id)); }

  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: '100%' };

  return (
    <CollapsibleCard title="Follow-up schedule" badge={entries.length || undefined} defaultOpen={false}>
      {entries.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No follow-up scheduled.</p>
      )}

      {entries.map(e => (
        <div key={e.id} style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '8px 12px', marginBottom: 8, background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.type}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                {e.date} · {e.location}
              </div>
              {e.instructions && (
                <div style={{ fontSize: 12, color: '#334155', marginTop: 4, whiteSpace: 'pre-wrap' }}>{e.instructions}</div>
              )}
            </div>
            <button type="button" onClick={() => remove(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, flexShrink: 0 }}>×</button>
          </div>
        </div>
      ))}

      {adding ? (
        <div style={{ border: '1px dashed #94a3b8', borderRadius: 7, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>TYPE</label>
              <select
                value={draft.type}
                onChange={e => setDraft(d => ({ ...d, type: e.target.value, instructions: DEFAULT_INSTRUCTIONS[e.target.value] ?? '' }))}
                style={inp}
              >
                {FU_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>DATE</label>
              <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>LOCATION</label>
              <input value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>INSTRUCTIONS FOR PATIENT</label>
              <textarea
                value={draft.instructions}
                onChange={e => setDraft(d => ({ ...d, instructions: e.target.value }))}
                style={{ ...inp, minHeight: 72, resize: 'vertical' }}
                placeholder="Return precautions, what to bring, wound care…"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={add} disabled={!draft.date}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', opacity: draft.date ? 1 : 0.5 }}>
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, border: '1px dashed #94a3b8', background: 'none', color: '#475569', cursor: 'pointer', width: '100%' }}>
          + Schedule follow-up
        </button>
      )}
    </CollapsibleCard>
  );
}
