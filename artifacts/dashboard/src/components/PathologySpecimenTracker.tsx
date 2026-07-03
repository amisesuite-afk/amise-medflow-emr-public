import { useState } from 'react';
import CollapsibleCard from './CollapsibleCard';

type SpecimenStatus = 'collected' | 'sent' | 'received_lab' | 'result_available' | 'reviewed';

const STATUS_CONFIG: Record<SpecimenStatus, { label: string; color: string; bg: string; next?: SpecimenStatus }> = {
  collected:         { label: 'Collected',          color: '#0369a1', bg: '#e0f2fe', next: 'sent' },
  sent:              { label: 'Sent to lab',         color: '#7c3aed', bg: '#f5f3ff', next: 'received_lab' },
  received_lab:      { label: 'Received at lab',     color: '#b45309', bg: '#fef3c7', next: 'result_available' },
  result_available:  { label: 'Result available',    color: '#b91c1c', bg: '#fee2e2', next: 'reviewed' },
  reviewed:          { label: 'Reviewed',            color: '#15803d', bg: '#dcfce7' },
};

const SPECIMEN_TYPES = [
  'Gallbladder (cholecystectomy)',
  'Appendix (appendicectomy)',
  'Polyp (colonoscopy)',
  'Colonic segment',
  'Small bowel segment',
  'Rectal biopsy',
  'Liver biopsy',
  'Lymph node',
  'Breast lump / excision',
  'Thyroid nodule / lobe',
  'Skin lesion / excision',
  'Inguinal hernia sac',
  'Bile duct brushings (ERCP)',
  'Gastric biopsy (OGD)',
  'Duodenal biopsy',
  'Other',
];

interface Specimen {
  id: string;
  type: string;
  site: string;
  container: string;
  collectedDate: string;
  labRef: string;
  status: SpecimenStatus;
  resultSummary: string;
}

function uid() { return `sp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`; }

export default function PathologySpecimenTracker() {
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Specimen>({
    id: uid(), type: 'Gallbladder (cholecystectomy)', site: '', container: 'Formalin', collectedDate: new Date().toISOString().slice(0, 10), labRef: '', status: 'collected', resultSummary: '',
  });

  function add() {
    setSpecimens(s => [...s, draft]);
    setDraft({ id: uid(), type: 'Gallbladder (cholecystectomy)', site: '', container: 'Formalin', collectedDate: new Date().toISOString().slice(0, 10), labRef: '', status: 'collected', resultSummary: '' });
    setAdding(false);
  }

  function advanceStatus(id: string) {
    setSpecimens(ss => ss.map(s => {
      if (s.id !== id) return s;
      const next = STATUS_CONFIG[s.status].next;
      return next ? { ...s, status: next } : s;
    }));
  }

  function remove(id: string) { setSpecimens(ss => ss.filter(s => s.id !== id)); }

  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: '100%' };
  const pending = specimens.filter(s => s.status !== 'reviewed').length;

  return (
    <CollapsibleCard title="Pathology specimen tracker" badge={pending || undefined} defaultOpen={false}>
      {specimens.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', margin: '0 0 10px' }}>No specimens recorded.</p>
      )}

      {specimens.map(sp => {
        const cfg = STATUS_CONFIG[sp.status];
        return (
          <div key={sp.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{sp.type}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {sp.collectedDate}{sp.labRef && ` · Ref: ${sp.labRef}`}{sp.container && ` · ${sp.container}`}
                </div>
              </div>
              <button type="button" onClick={() => advanceStatus(sp.id)} title="Advance status"
                style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 5, padding: '3px 8px', cursor: STATUS_CONFIG[sp.status].next ? 'pointer' : 'default' }}>
                {cfg.label} {STATUS_CONFIG[sp.status].next ? '→' : '✓'}
              </button>
              <button type="button" onClick={() => remove(sp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 15 }}>×</button>
            </div>
            {sp.status === 'result_available' && (
              <div style={{ padding: '6px 12px 10px' }}>
                <textarea
                  value={sp.resultSummary}
                  onChange={e => setSpecimens(ss => ss.map(s => s.id === sp.id ? { ...s, resultSummary: e.target.value } : s))}
                  placeholder="Enter result summary…"
                  style={{ ...inp, minHeight: 56 }}
                />
              </div>
            )}
            {sp.status === 'reviewed' && sp.resultSummary && (
              <div style={{ padding: '6px 12px 10px', fontSize: 12, color: '#334155', fontStyle: 'italic' }}>{sp.resultSummary}</div>
            )}
          </div>
        );
      })}

      {adding && (
        <div style={{ border: '1px dashed #94a3b8', borderRadius: 7, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>SPECIMEN TYPE</label>
              <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} style={inp}>
                {SPECIMEN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>CONTAINER</label>
              <select value={draft.container} onChange={e => setDraft(d => ({ ...d, container: e.target.value }))} style={inp}>
                {['Formalin', 'Saline', 'Dry', 'Cytology medium', 'Sterile universal'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>DATE COLLECTED</label>
              <input type="date" value={draft.collectedDate} onChange={e => setDraft(d => ({ ...d, collectedDate: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>LAB REFERENCE</label>
              <input value={draft.labRef} onChange={e => setDraft(d => ({ ...d, labRef: e.target.value }))} style={inp} placeholder="Path lab ref number…" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={add}
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}>Add</button>
            <button type="button" onClick={() => setAdding(false)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {!adding && (
        <button type="button" onClick={() => setAdding(true)}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, border: '1px dashed #94a3b8', background: 'none', color: '#475569', cursor: 'pointer', width: '100%' }}>
          + Add specimen
        </button>
      )}
    </CollapsibleCard>
  );
}
