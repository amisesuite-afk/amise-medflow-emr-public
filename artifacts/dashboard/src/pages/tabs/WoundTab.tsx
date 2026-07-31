import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import {
  type WoundAssessment, type WoundClass, type WoundClosure,
  type WoundStatus, type DrainStatus, type AsepsisDetails,
  calcAsepsisScore, emptyWound,
} from '@/lib/db';

// ─── ASEPSIS band options ─────────────────────────────────────────────────────

const SEROUS_BANDS    = [{ v: 0, l: 'None' }, { v: 1, l: '< 20%' }, { v: 2, l: '20–39%' }, { v: 3, l: '40–59%' }, { v: 4, l: '60–79%' }, { v: 5, l: '≥ 80%' }];
const ERYTHEMA_BANDS  = SEROUS_BANDS;
const PURULENT_BANDS  = [{ v: 0, l: 'None' }, { v: 2, l: '< 20%' }, { v: 4, l: '20–39%' }, { v: 6, l: '40–59%' }, { v: 8, l: '60–79%' }, { v: 10, l: '≥ 80%' }];
const SEPARATN_BANDS  = PURULENT_BANDS;
const ADDITIONAL_TX   = [{ v: 0, l: 'None' }, { v: 5, l: 'Antibiotics only' }, { v: 10, l: 'Drainage under LA' }, { v: 15, l: 'Debridement under GA' }] as { v: 0 | 5 | 10 | 15; l: string }[];

function asepsisInterpretation(score: number): { label: string; color: string; bg: string; border: string } {
  if (score <= 10) return { label: 'Satisfactory healing', color: '#15803d', bg: '#f0fdf4', border: '#86efac' };
  if (score <= 20) return { label: 'Superficial SSI', color: '#b45309', bg: '#fefce8', border: '#fde047' };
  return { label: 'Deep SSI — requires treatment', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' };
}

function statusColor(status: WoundStatus): string {
  const map: Record<WoundStatus, string> = {
    healing: '#15803d',
    closed: '#0f766e',
    superficial_ssi: '#b45309',
    deep_ssi: '#dc2626',
    dehiscence: '#dc2626',
    seroma: '#7c3aed',
    haematoma: '#7c3aed',
    necrosis: '#7f1d1d',
  };
  return map[status] ?? '#64748b';
}

function statusLabel(status: WoundStatus): string {
  return {
    healing: 'Healing',
    closed: 'Closed',
    superficial_ssi: 'Superficial SSI',
    deep_ssi: 'Deep SSI',
    dehiscence: 'Dehiscence',
    seroma: 'Seroma',
    haematoma: 'Haematoma',
    necrosis: 'Necrosis',
  }[status] ?? status;
}

// ─── Empty ASEPSIS ────────────────────────────────────────────────────────────

function emptyAsepsis(): AsepsisDetails {
  return { serous: 0, erythema: 0, purulent: 0, separation: 0, isolatedBacteria: false, prolongedStay: false, additionalTx: 0 };
}

// ─── Wound form state ─────────────────────────────────────────────────────────

type WoundFormState = WoundAssessment & { dirty: boolean };

function woundToForm(w: WoundAssessment): WoundFormState {
  return { ...w, dirty: false };
}
function freshForm(): WoundFormState {
  return { ...emptyWound(), asepsisDetails: emptyAsepsis(), dirty: false };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WoundTab() {
  const { wounds, saveWound, removeWound } = useAppContext();

  const [editing, setEditing] = useState<WoundFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openNew() {
    setEditing(freshForm());
  }
  function openEdit(w: WoundAssessment) {
    setEditing(woundToForm(w));
  }
  function closeForm() {
    setEditing(null);
  }

  function patch<K extends keyof WoundFormState>(key: K, value: WoundFormState[K]) {
    setEditing(prev => prev ? { ...prev, [key]: value, dirty: true } : prev);
  }
  function patchAsepsis<K extends keyof AsepsisDetails>(key: K, value: AsepsisDetails[K]) {
    setEditing(prev => {
      if (!prev) return prev;
      const det = { ...prev.asepsisDetails, [key]: value };
      return { ...prev, asepsisDetails: det, asepsisScore: calcAsepsisScore(det), dirty: true };
    });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await saveWound({ ...editing, asepsisScore: calcAsepsisScore(editing.asepsisDetails) });
    setSaving(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await removeWound(id);
    setDeleteConfirm(null);
  }

  const asepsisI = editing ? asepsisInterpretation(calcAsepsisScore(editing.asepsisDetails)) : null;

  return (
    <div className="gap-y">

      {/* Header */}
      <div style={{ background: 'var(--panel-hd)', borderRadius: 10, padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Wound Assessment</div>
          <div style={{ fontSize: 12, color: 'var(--sidebar-text)', marginTop: 2 }}>
            ASEPSIS scoring · CDC SSI classification · Drain tracking
          </div>
        </div>
        <button type="button" onClick={openNew}
          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + New Wound
        </button>
      </div>

      {/* ── Wound list ─────────────────────────────────────────────────── */}
      {wounds.length === 0 && !editing && (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No wound assessments yet. Tap "+ New Wound" to begin.
        </div>
      )}

      {wounds.map(w => {
        const interp = asepsisInterpretation(w.asepsisScore);
        const sc = statusColor(w.status);
        return (
          <div key={w.id} style={{ background: '#fff', border: `1px solid #e2e8f0`, borderLeft: `4px solid ${sc}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{w.label}</div>
                {w.location && <div style={{ fontSize: 12, color: '#64748b' }}>{w.location}</div>}
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag label={statusLabel(w.status)} color={sc} />
                  {w.woundClass && <Tag label={woundClassLabel(w.woundClass)} color="#475569" />}
                  {w.closure && <Tag label={closureLabel(w.closure)} color="#475569" />}
                  {w.drain !== 'none' && <Tag label={`Drain: ${w.drain === 'in_situ' ? 'In situ' : 'Removed'}`} color="#7c3aed" />}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ASEPSIS</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: interp.color }}>{w.asepsisScore}</div>
                <div style={{ fontSize: 10, color: interp.color, fontWeight: 600 }}>{interp.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{w.assessedDate}</div>
              </div>
            </div>
            {w.drain === 'in_situ' && w.drainOutputMl && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#7c3aed' }}>
                Drain output: <strong>{w.drainOutputMl} mL</strong>
              </div>
            )}
            {w.dressing && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Dressing: {w.dressing}
              </div>
            )}
            {w.notes && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#475569', background: '#f8fafc', borderRadius: 6, padding: '6px 10px' }}>
                {w.notes}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => openEdit(w)}
                style={btnSecondary}>Edit / Reassess</button>
              {deleteConfirm === w.id ? (
                <>
                  <button type="button" onClick={() => handleDelete(w.id)}
                    style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fca5a5' }}>Confirm delete</button>
                  <button type="button" onClick={() => setDeleteConfirm(null)} style={btnSecondary}>Cancel</button>
                </>
              ) : (
                <button type="button" onClick={() => setDeleteConfirm(w.id)}
                  style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fecaca' }}>Delete</button>
              )}
            </div>
          </div>
        );
      })}

      {/* ── Wound form ─────────────────────────────────────────────────── */}
      {editing && (
        <CollapsibleCard title={editing.id.startsWith('tmp-') ? 'New Wound Assessment' : `Edit — ${editing.label}`} defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Field label="Label / Name">
              <input style={inp} value={editing.label} onChange={e => patch('label', e.target.value)} placeholder="e.g. Laparotomy wound" />
            </Field>
            <Field label="Location">
              <input style={inp} value={editing.location} onChange={e => patch('location', e.target.value)} placeholder="e.g. Midline abdomen" />
            </Field>
            <Field label="Assessment date">
              <input style={inp} type="date" value={editing.assessedDate} onChange={e => patch('assessedDate', e.target.value)} />
            </Field>
            <Field label="Wound class (CDC)">
              <select style={inp} value={editing.woundClass} onChange={e => patch('woundClass', e.target.value as WoundClass)}>
                <option value="">— select —</option>
                <option value="clean">Clean</option>
                <option value="clean_contaminated">Clean-contaminated</option>
                <option value="contaminated">Contaminated</option>
                <option value="dirty">Dirty / Infected</option>
              </select>
            </Field>
            <Field label="Closure type">
              <select style={inp} value={editing.closure} onChange={e => patch('closure', e.target.value as WoundClosure)}>
                <option value="">— select —</option>
                <option value="primary">Primary (1°)</option>
                <option value="secondary">Secondary intention (open)</option>
                <option value="delayed_primary">Delayed primary (3°)</option>
                <option value="vac">Negative pressure (VAC)</option>
                <option value="open">Open packing</option>
              </select>
            </Field>
            <Field label="Status">
              <select style={inp} value={editing.status} onChange={e => patch('status', e.target.value as WoundStatus)}>
                <option value="healing">Healing</option>
                <option value="closed">Closed</option>
                <option value="superficial_ssi">Superficial SSI</option>
                <option value="deep_ssi">Deep SSI</option>
                <option value="dehiscence">Dehiscence</option>
                <option value="seroma">Seroma</option>
                <option value="haematoma">Haematoma</option>
                <option value="necrosis">Necrosis</option>
              </select>
            </Field>
            <Field label="Dressing">
              <input style={inp} value={editing.dressing} onChange={e => patch('dressing', e.target.value)} placeholder="e.g. Mepore, Aquacel" />
            </Field>
            <Field label="Drain">
              <select style={inp} value={editing.drain} onChange={e => patch('drain', e.target.value as DrainStatus)}>
                <option value="none">None</option>
                <option value="in_situ">In situ</option>
                <option value="removed">Removed</option>
              </select>
            </Field>
            {editing.drain === 'in_situ' && (
              <Field label="Drain output (mL/24h)">
                <input style={inp} type="number" min="0" value={editing.drainOutputMl}
                  onChange={e => patch('drainOutputMl', e.target.value)} placeholder="e.g. 50" />
              </Field>
            )}
          </div>

          {/* ASEPSIS scoring */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
              ASEPSIS Score
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <Field label="Serous discharge (0–5)">
                <select style={inp} value={editing.asepsisDetails.serous}
                  onChange={e => patchAsepsis('serous', parseInt(e.target.value))}>
                  {SEROUS_BANDS.map(b => <option key={b.v} value={b.v}>{b.l} (score {b.v})</option>)}
                </select>
              </Field>
              <Field label="Erythema (0–5)">
                <select style={inp} value={editing.asepsisDetails.erythema}
                  onChange={e => patchAsepsis('erythema', parseInt(e.target.value))}>
                  {ERYTHEMA_BANDS.map(b => <option key={b.v} value={b.v}>{b.l} (score {b.v})</option>)}
                </select>
              </Field>
              <Field label="Purulent exudate (0–10)">
                <select style={inp} value={editing.asepsisDetails.purulent}
                  onChange={e => patchAsepsis('purulent', parseInt(e.target.value))}>
                  {PURULENT_BANDS.map(b => <option key={b.v} value={b.v}>{b.l} (score {b.v})</option>)}
                </select>
              </Field>
              <Field label="Deep tissue separation (0–10)">
                <select style={inp} value={editing.asepsisDetails.separation}
                  onChange={e => patchAsepsis('separation', parseInt(e.target.value))}>
                  {SEPARATN_BANDS.map(b => <option key={b.v} value={b.v}>{b.l} (score {b.v})</option>)}
                </select>
              </Field>
              <Field label="Additional treatment">
                <select style={inp} value={editing.asepsisDetails.additionalTx}
                  onChange={e => patchAsepsis('additionalTx', parseInt(e.target.value) as 0 | 5 | 10 | 15)}>
                  {ADDITIONAL_TX.map(b => <option key={b.v} value={b.v}>{b.l} (+{b.v})</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={editing.asepsisDetails.isolatedBacteria}
                  onChange={e => patchAsepsis('isolatedBacteria', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span>Bacteria isolated from wound culture <span style={{ color: '#94a3b8' }}>(+10)</span></span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={editing.asepsisDetails.prolongedStay}
                  onChange={e => patchAsepsis('prolongedStay', e.target.checked)} style={{ width: 15, height: 15 }} />
                <span>Postoperative stay &gt; 14 days <span style={{ color: '#94a3b8' }}>(+5)</span></span>
              </label>
            </div>

            {asepsisI && (
              <div style={{
                background: asepsisI.bg, border: `2px solid ${asepsisI.border}`,
                borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ASEPSIS Total</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: asepsisI.color }}>
                    {calcAsepsisScore(editing.asepsisDetails)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: asepsisI.color }}>{asepsisI.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    0–10 = undisturbed healing · 11–20 = superficial SSI · &gt;20 = deep SSI
                  </div>
                </div>
              </div>
            )}
          </div>

          <Field label="Notes / Clinical observations">
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }}
              value={editing.notes} onChange={e => patch('notes', e.target.value)}
              placeholder="Wound appearance, odour, surrounding skin changes, patient symptoms…" />
          </Field>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleSave} disabled={saving}
              style={{ background: saving ? '#94a3b8' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 22px', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save Assessment'}
            </button>
            <button type="button" onClick={closeForm} style={btnSecondary}>Cancel</button>
          </div>
        </CollapsibleCard>
      )}

      {/* ── CDC SSI Classification Reference ────────────────────────────── */}
      <CollapsibleCard title="CDC Surgical Site Infection Classification (Reference)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CDC_SSI.map(s => (
            <div key={s.type} style={{ border: `2px solid ${s.color}20`, borderLeft: `4px solid ${s.color}`, borderRadius: 8, padding: '10px 14px', background: `${s.color}06` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.type}</div>
              <div style={{ fontSize: 12, color: '#334155', marginTop: 3 }}>{s.criteria}</div>
              {s.note && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, fontStyle: 'italic' }}>{s.note}</div>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          CDC NHSN 2022 definitions. SSI surveillance period: 30 days (no implant) or 90 days (with implant).
        </div>
      </CollapsibleCard>

    </div>
  );
}

// ─── Reference data ───────────────────────────────────────────────────────────

const CDC_SSI = [
  {
    type: 'Superficial Incisional SSI',
    color: '#b45309',
    criteria: 'Occurs within 30 days of surgery. Involves only skin or subcutaneous tissue. One of: purulent drainage; organisms isolated from aseptically-obtained culture; signs/symptoms (pain, swelling, erythema, heat) AND deliberate opening by surgeon; diagnosis by surgeon.',
    note: 'Does NOT include stitch abscess, infected burn wound, or cellulitis without discharge.',
  },
  {
    type: 'Deep Incisional SSI',
    color: '#dc2626',
    criteria: 'Occurs within 30–90 days of surgery. Involves deep soft tissues (fascial and muscle layers). One of: purulent drainage from deep incision; spontaneous dehiscence or deliberate opening by surgeon with fever >38°C or localised pain/tenderness; abscess or evidence of infection on direct examination, imaging, or histopathology.',
  },
  {
    type: 'Organ/Space SSI',
    color: '#7c3aed',
    criteria: 'Occurs within 30–90 days of surgery. Involves any anatomical area (other than incision) opened or manipulated during surgery. One of: purulent drainage from drain placed into organ/space; organisms isolated from culture of fluid or tissue; abscess or evidence of infection on direct examination, imaging, or histopathology.',
    note: 'Examples: intra-abdominal abscess, anastomotic leak, biloma, subphrenic collection.',
  },
];

// ─── Label helpers ────────────────────────────────────────────────────────────

function woundClassLabel(c: WoundClass): string {
  return { clean: 'Clean', clean_contaminated: 'Clean-contaminated', contaminated: 'Contaminated', dirty: 'Dirty/Infected' }[c] ?? c;
}
function closureLabel(c: WoundClosure): string {
  return { primary: '1° closure', secondary: '2° (open)', delayed_primary: '3° (delayed)', vac: 'VAC', open: 'Open packing' }[c] ?? c;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}15`, border: `1px solid ${color}30`, borderRadius: 5, padding: '2px 8px' }}>
      {label}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 13, color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box',
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #cbd5e1',
  background: '#fff', color: '#334155', fontWeight: 600, fontSize: 12, cursor: 'pointer',
};
