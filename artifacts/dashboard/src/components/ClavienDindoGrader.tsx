import { useState } from 'react';
import CollapsibleCard from './CollapsibleCard';

const GRADES = [
  {
    grade: 'I',
    label: 'Grade I — Minor deviation',
    color: '#15803d', bg: '#f0fdf4',
    description: 'Any deviation from normal postoperative course not requiring pharmacological, surgical, endoscopic, or radiological intervention. Allowed: antiemetics, antipyretics, analgesia, electrolytes, physiotherapy. Wound infections opened at bedside.',
  },
  {
    grade: 'II',
    label: 'Grade II — Pharmacological treatment',
    color: '#0369a1', bg: '#f0f9ff',
    description: 'Requiring pharmacological treatment beyond Grade I. Blood transfusions and total parenteral nutrition are included.',
  },
  {
    grade: 'IIIa',
    label: 'Grade IIIa — Intervention without GA',
    color: '#7c3aed', bg: '#f5f3ff',
    description: 'Requiring surgical, endoscopic, or radiological intervention — NOT under general anaesthesia.',
  },
  {
    grade: 'IIIb',
    label: 'Grade IIIb — Intervention under GA',
    color: '#6d28d9', bg: '#ede9fe',
    description: 'Requiring surgical, endoscopic, or radiological intervention — UNDER general anaesthesia.',
  },
  {
    grade: 'IVa',
    label: 'Grade IVa — Single organ dysfunction',
    color: '#b45309', bg: '#fef3c7',
    description: 'Life-threatening complication including CNS complications. ICU management required. Single organ dysfunction (including dialysis).',
  },
  {
    grade: 'IVb',
    label: 'Grade IVb — Multi-organ dysfunction',
    color: '#92400e', bg: '#fef3c7',
    description: 'Life-threatening complication. ICU management required. Multi-organ dysfunction.',
  },
  {
    grade: 'V',
    label: 'Grade V — Death',
    color: '#991b1b', bg: '#fef2f2',
    description: 'Death of a patient.',
  },
];

interface Complication {
  id: string;
  description: string;
  grade: string;
  suffix: 'd' | '';
}

function uid() { return `cd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }

export default function ClavienDindoGrader() {
  const [complications, setComplications] = useState<Complication[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Complication>({ id: uid(), description: '', grade: 'II', suffix: '' });

  function add() {
    if (!draft.description.trim()) return;
    setComplications(c => [...c, draft]);
    setDraft({ id: uid(), description: '', grade: 'II', suffix: '' });
    setAdding(false);
  }

  const badge = complications.length > 0 ? complications.length : undefined;

  return (
    <CollapsibleCard title="Clavien-Dindo complication grading" badge={badge} defaultOpen={false}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
        Standardised surgical complication classification (Dindo et al., 2004). Suffix "(d)" = complication still ongoing at discharge.
      </div>

      {/* Reference */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {GRADES.map(g => (
          <span key={g.grade} style={{ fontSize: 10, fontWeight: 600, color: g.color, background: g.bg, border: `1px solid ${g.color}30`, borderRadius: 4, padding: '2px 7px', cursor: 'help' }} title={g.description}>
            {g.grade}
          </span>
        ))}
      </div>

      {complications.map((c, i) => {
        const gdef = GRADES.find(g => g.grade === c.grade) ?? GRADES[1];
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, padding: '8px 10px', background: gdef.bg, border: `1px solid ${gdef.color}30`, borderRadius: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: gdef.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Grade {c.grade}{c.suffix}
            </span>
            <span style={{ fontSize: 13, flex: 1 }}>{c.description}</span>
            <button type="button" onClick={() => setComplications(cs => cs.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 15, flexShrink: 0 }}>×</button>
          </div>
        );
      })}

      {complications.length === 0 && !adding && (
        <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 8 }}>No complications recorded.</div>
      )}

      {adding && (
        <div style={{ border: '1px dashed #94a3b8', borderRadius: 7, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>COMPLICATION</label>
              <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%' }}
                placeholder="e.g. Wound infection requiring antibiotics" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>GRADE</label>
              <select value={draft.grade} onChange={e => setDraft(d => ({ ...d, grade: e.target.value }))}
                style={{ fontSize: 13, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                {GRADES.map(g => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>(d)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', paddingBottom: 7 }}>
                <input type="checkbox" checked={draft.suffix === 'd'} onChange={e => setDraft(d => ({ ...d, suffix: e.target.checked ? 'd' : '' }))} />
                At discharge
              </label>
            </div>
          </div>
          {draft.grade && (
            <div style={{ fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 5, padding: '6px 10px', marginBottom: 8 }}>
              {GRADES.find(g => g.grade === draft.grade)?.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={add} disabled={!draft.description.trim()}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', opacity: draft.description.trim() ? 1 : 0.5 }}>
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!adding && (
        <button type="button" onClick={() => setAdding(true)}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, border: '1px dashed #94a3b8', background: 'none', color: '#475569', cursor: 'pointer', width: '100%' }}>
          + Record complication
        </button>
      )}
    </CollapsibleCard>
  );
}
