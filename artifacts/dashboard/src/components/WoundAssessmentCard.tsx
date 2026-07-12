import { useState, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { emptyWound, calcAsepsisScore, type WoundAssessment, type WoundClass, type WoundClosure, type WoundStatus, type DrainStatus } from '@/lib/db';
import CollapsibleCard from './CollapsibleCard';

// ── Static lookup maps ────────────────────────────────────────────────────────

const WOUND_CLASS_LABELS: Record<WoundClass, string> = {
  clean:              'Clean (I)',
  clean_contaminated: 'Clean-contaminated (II)',
  contaminated:       'Contaminated (III)',
  dirty:              'Dirty / infected (IV)',
};

const CLOSURE_LABELS: Record<WoundClosure, string> = {
  primary:         'Primary closure',
  secondary:       'Secondary intention',
  delayed_primary: 'Delayed primary',
  vac:             'VAC / NPWT',
  open:            'Open / packed',
};

const STATUS_CONFIG: Record<WoundStatus, { label: string; color: string; bg: string }> = {
  healing:        { label: 'Healing well',         color: '#15803d', bg: '#dcfce7' },
  superficial_ssi:{ label: 'Superficial SSI',      color: '#b45309', bg: '#fef3c7' },
  deep_ssi:       { label: 'Deep SSI',             color: '#b91c1c', bg: '#fee2e2' },
  dehiscence:     { label: 'Dehiscence',           color: '#7c3aed', bg: '#ede9fe' },
  seroma:         { label: 'Seroma',               color: '#0369a1', bg: '#e0f2fe' },
  haematoma:      { label: 'Haematoma',            color: '#9f1239', bg: '#ffe4e6' },
  necrosis:       { label: 'Necrosis',             color: '#1c1917', bg: '#d6d3d1' },
  closed:         { label: 'Closed / healed',      color: '#475569', bg: '#f1f5f9' },
};

const ASEPSIS_BANDS = [
  { label: '<20%', serous: 1, erythema: 1, purulent: 2, separation: 2 },
  { label: '20-39%', serous: 2, erythema: 2, purulent: 4, separation: 4 },
  { label: '40-59%', serous: 3, erythema: 3, purulent: 6, separation: 6 },
  { label: '60-79%', serous: 4, erythema: 4, purulent: 8, separation: 8 },
  { label: '≥80%',   serous: 5, erythema: 5, purulent: 10, separation: 10 },
];

function asepsisRisk(score: number) {
  if (score === 0) return { label: 'No SSI', color: '#15803d' };
  if (score <= 10) return { label: 'Undisturbed healing', color: '#0369a1' };
  if (score <= 20) return { label: 'Disturbed healing', color: '#b45309' };
  if (score <= 30) return { label: 'Minor wound infection', color: '#d97706' };
  return { label: 'Wound infection', color: '#b91c1c' };
}

// ── Single wound form ─────────────────────────────────────────────────────────

function WoundForm({ wound, onChange, onDelete, onSave }: {
  wound: WoundAssessment;
  onChange: (w: WoundAssessment) => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const [showAsepsis, setShowAsepsis] = useState(false);
  const risk = asepsisRisk(wound.asepsisScore);
  const sc = STATUS_CONFIG[wound.status];

  function updateAsepsis<K extends keyof typeof wound.asepsisDetails>(key: K, val: typeof wound.asepsisDetails[K]) {
    const next = { ...wound.asepsisDetails, [key]: val };
    onChange({ ...wound, asepsisDetails: next, asepsisScore: calcAsepsisScore(next) });
  }

  const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: 'var(--surface, #fff)' };
  const sel = inp;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <input
          value={wound.label}
          onChange={e => onChange({ ...wound, label: e.target.value })}
          style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: 'var(--fg, #0f172a)', outline: 'none' }}
          placeholder="Wound label…"
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 4 }}>
          {sc.label}
        </span>
        <button type="button" onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1 }} title="Remove wound">×</button>
      </div>

      {/* Fields */}
      <div style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div style={fld}>
          <label style={lbl}>Anatomical location</label>
          <input value={wound.location} onChange={e => onChange({ ...wound, location: e.target.value })} style={inp} placeholder="e.g. RIF, midline, LIF…" />
        </div>
        <div style={fld}>
          <label style={lbl}>Date assessed</label>
          <input type="date" value={wound.assessedDate} onChange={e => onChange({ ...wound, assessedDate: e.target.value })} style={inp} />
        </div>
        <div style={fld}>
          <label style={lbl}>Wound class</label>
          <select value={wound.woundClass} onChange={e => onChange({ ...wound, woundClass: e.target.value as WoundClass | '' })} style={sel}>
            <option value="">— select —</option>
            {(Object.entries(WOUND_CLASS_LABELS) as [WoundClass, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={fld}>
          <label style={lbl}>Closure</label>
          <select value={wound.closure} onChange={e => onChange({ ...wound, closure: e.target.value as WoundClosure | '' })} style={sel}>
            <option value="">— select —</option>
            {(Object.entries(CLOSURE_LABELS) as [WoundClosure, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div style={fld}>
          <label style={lbl}>Status</label>
          <select value={wound.status} onChange={e => onChange({ ...wound, status: e.target.value as WoundStatus })} style={sel}>
            {(Object.entries(STATUS_CONFIG) as [WoundStatus, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={fld}>
          <label style={lbl}>Dressing</label>
          <input value={wound.dressing} onChange={e => onChange({ ...wound, dressing: e.target.value })} style={inp} placeholder="e.g. Mepilex, dry, saline…" />
        </div>
        <div style={fld}>
          <label style={lbl}>Drain</label>
          <select value={wound.drain} onChange={e => onChange({ ...wound, drain: e.target.value as DrainStatus })} style={sel}>
            <option value="none">None</option>
            <option value="in_situ">In situ</option>
            <option value="removed">Removed</option>
          </select>
        </div>
        {wound.drain === 'in_situ' && (
          <div style={fld}>
            <label style={lbl}>Drain output (mL/24h)</label>
            <input type="number" value={wound.drainOutputMl} onChange={e => onChange({ ...wound, drainOutputMl: e.target.value })} style={inp} placeholder="mL" />
          </div>
        )}
        <div style={{ ...fld, gridColumn: '1 / -1' }}>
          <label style={lbl}>Notes</label>
          <textarea value={wound.notes} onChange={e => onChange({ ...wound, notes: e.target.value })} style={{ ...inp, minHeight: 56, resize: 'vertical' }} placeholder="Wound appearance, size, surrounding tissue…" />
        </div>
      </div>

      {/* ASEPSIS score */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          type="button"
          onClick={() => setShowAsepsis(s => !s)}
          style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: 'none', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer', padding: '3px 10px', marginBottom: showAsepsis ? 8 : 0 }}
        >
          ASEPSIS score: <span style={{ color: risk.color, fontWeight: 700 }}>{wound.asepsisScore} — {risk.label}</span> {showAsepsis ? '▲' : '▼'}
        </button>

        {showAsepsis && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>Score: 0 = no SSI · 1–10 = undisturbed · 11–20 = disturbed · 21–30 = minor infection · &gt;30 = infection</div>
            {(['serous', 'erythema', 'purulent', 'separation'] as const).map(field => {
              const fieldLabels = { serous: 'Serous discharge', erythema: 'Erythema', purulent: 'Purulent exudate', separation: 'Deep tissue separation' };
              return (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, width: 160, flexShrink: 0 }}>{fieldLabels[field]}</span>
                  <select
                    value={wound.asepsisDetails[field]}
                    onChange={e => updateAsepsis(field, parseInt(e.target.value) as never)}
                    style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                  >
                    <option value={0}>None (0)</option>
                    {ASEPSIS_BANDS.map(b => <option key={b.label} value={b[field]}>{b.label} ({b[field]})</option>)}
                  </select>
                </div>
              );
            })}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {([
                { key: 'isolatedBacteria', label: 'Bacteria isolated (+10)' },
                { key: 'prolongedStay', label: 'Hospital stay >14d (+5)' },
              ] as const).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={wound.asepsisDetails[key]} onChange={e => updateAsepsis(key, e.target.checked)} />
                  {label}
                </label>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>Additional treatment:</span>
                <select
                  value={wound.asepsisDetails.additionalTx}
                  onChange={e => updateAsepsis('additionalTx', parseInt(e.target.value) as 0 | 5 | 10 | 15)}
                  style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value={0}>None (0)</option>
                  <option value={5}>Antibiotics (+5)</option>
                  <option value={10}>Drainage under LA (+10)</option>
                  <option value={15}>Debridement under GA (+15)</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: risk.color }}>
              Total ASEPSIS: {wound.asepsisScore} — {risk.label}
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onSave}
          style={{ fontSize: 12, fontWeight: 600, padding: '5px 16px', borderRadius: 6, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' }}
        >
          Save wound
        </button>
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function WoundAssessmentCard() {
  const { wounds, setWounds, saveWound, removeWound, patientId } = useAppContext();

  const addWound = useCallback(() => {
    const label = wounds.length === 0 ? 'Wound 1' : `Wound ${wounds.length + 1}`;
    setWounds(prev => [...prev, emptyWound(label)]);
  }, [wounds.length, setWounds]);

  const updateWound = useCallback((id: string, updated: WoundAssessment) => {
    setWounds(prev => prev.map(w => w.id === id ? updated : w));
  }, [setWounds]);

  const activeCount = wounds.filter(w => w.status !== 'closed').length;

  return (
    <CollapsibleCard title="Wound assessment" badge={activeCount || undefined}>
      {wounds.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 8 }}>
          No wounds recorded for this encounter.
        </div>
      ) : (
        wounds.map(w => (
          <WoundForm
            key={w.id}
            wound={w}
            onChange={updated => updateWound(w.id, updated)}
            onDelete={() => void removeWound(w.id)}
            onSave={() => void saveWound(w)}
          />
        ))
      )}

      <button
        type="button"
        onClick={addWound}
        style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 6, border: '1px dashed #94a3b8', background: 'none', color: '#475569', cursor: 'pointer', width: '100%' }}
      >
        + Add wound
      </button>

      {!patientId && wounds.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          Save the patient first to persist wound data.
        </div>
      )}
    </CollapsibleCard>
  );
}
