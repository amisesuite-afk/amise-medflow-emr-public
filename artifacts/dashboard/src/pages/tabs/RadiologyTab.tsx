import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── RadiologyRequest interface ────────────────────────────────────────────────

export interface RadiologyRequest {
  id: string;
  modality: 'MRI' | 'CT' | 'Ultrasound' | 'XRay' | 'Scope' | 'Functional' | 'Other';
  anatomicalRegion: string;
  laterality: 'left' | 'right' | 'bilateral' | '';
  indication: string;
  clinicalQuestion: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  ctContrast: 'none' | 'IV' | 'oral' | 'both';
  ctContrastType: string;
  ctEgfr: string;
  mriProtocol: string;
  mriSequences: string;
  scopeType: string;
  functionalType: string;
  otherDescription: string;
  resultReceived: boolean;
  resultNotes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ANATOMICAL_REGIONS = [
  'Brain', 'Cervical Spine', 'Thoracic Spine', 'Lumbar Spine',
  'Chest', 'Abdomen', 'Pelvis', 'Abdomen & Pelvis (TAP)',
  'Shoulder', 'Hip', 'Knee', 'Ankle', 'Wrist',
  'Liver', 'Pancreas', 'Thyroid', 'Breast', 'Testis', 'Groin', 'Whole Body',
];

const MRI_PROTOCOLS = [
  'Brain without contrast',
  'Brain with contrast (Gad)',
  'MRCP (magnetic cholangiopancreatography)',
  'MRI Abdomen with Gad',
  'MRI Pelvis with Gad',
  'MRI Breast bilateral with Gad',
  'MRI Spine without contrast',
  'MRI Angiogram (MRA)',
  'MRI Liver (Eovist/Primovist)',
  'Other - specify',
];

const CT_CONTRAST_TYPES = ['Omnipaque 300', 'Omnipaque 350', 'Other'];

const SCOPE_TYPES = [
  'Upper GI Endoscopy (OGD)',
  'Colonoscopy',
  'Flexible Sigmoidoscopy',
  'ERCP',
  'Bronchoscopy',
  'Cystoscopy',
  'Laparoscopy',
  'Hysteroscopy',
  'Other',
];

const FUNCTIONAL_TYPES = [
  'ECG (12-lead)',
  'Holter Monitor (24hr)',
  'Exercise ECG (Stress Test)',
  'Echocardiogram',
  'Pulmonary Function Tests (PFT)',
  'EEG',
  'EMG / Nerve Conduction Study',
  'Urodynamics',
  'Manometry (Oesophageal)',
  'Gastric Emptying Study',
  'Other',
];

// ── Modality badge colours ────────────────────────────────────────────────────

const MODALITY_COLOURS: Record<RadiologyRequest['modality'], { bg: string; color: string; border: string }> = {
  MRI:        { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
  CT:         { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Ultrasound: { bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' },
  XRay:       { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  Scope:      { bg: '#f3e8ff', color: '#7c3aed', border: '#ddd6fe' },
  Functional: { bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  Other:      { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
};

const MODALITY_LABELS: Record<RadiologyRequest['modality'], string> = {
  MRI: 'MRI', CT: 'CT', Ultrasound: 'US', XRay: 'X-Ray', Scope: 'Scope', Functional: 'Functional', Other: 'Other',
};

const URGENCY_COLOURS: Record<RadiologyRequest['urgency'], { bg: string; color: string; border: string }> = {
  routine:   { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  urgent:    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  emergency: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

// ── Empty form state ──────────────────────────────────────────────────────────

function emptyForm(): Omit<RadiologyRequest, 'id' | 'resultReceived' | 'resultNotes'> {
  return {
    modality: 'Ultrasound',
    anatomicalRegion: '',
    laterality: '',
    indication: '',
    clinicalQuestion: '',
    urgency: 'routine',
    ctContrast: 'none',
    ctContrastType: '',
    ctEgfr: '',
    mriProtocol: '',
    mriSequences: '',
    scopeType: '',
    functionalType: '',
    otherDescription: '',
  };
}

// ── eGFR warning ─────────────────────────────────────────────────────────────

function EgfrWarning({ egfr }: { egfr: string }) {
  const val = parseFloat(egfr);
  if (!egfr.trim() || isNaN(val)) return null;
  if (val < 30) {
    return (
      <div style={{ marginTop: 4, padding: '5px 10px', borderRadius: 6, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12, fontWeight: 600 }}>
        eGFR &lt;30 — IV contrast contraindicated — use with extreme caution
      </div>
    );
  }
  if (val < 45) {
    return (
      <div style={{ marginTop: 4, padding: '5px 10px', borderRadius: 6, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
        eGFR &lt;45 — discuss contrast risk with radiologist
      </div>
    );
  }
  return null;
}

// ── Pill button helper ────────────────────────────────────────────────────────

function PillBtn({
  label, active, onClick, colour,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colour?: { bg: string; color: string; border: string };
}) {
  const activeBg    = colour?.bg    ?? '#0d9488';
  const activeColor = colour?.color ?? '#fff';
  const activeBdr   = colour?.border ?? '#0d9488';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 13px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        border: active ? `1.5px solid ${activeBdr}` : '1px solid #d1d5db',
        background: active ? activeBg : '#f9fafb',
        color: active ? activeColor : '#374151',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddRadiologyForm({ onAdd }: { onAdd: (r: RadiologyRequest) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleSubmit() {
    if (!form.anatomicalRegion.trim() && !form.otherDescription.trim()) return;
    onAdd({
      ...form,
      id: crypto.randomUUID(),
      resultReceived: false,
      resultNotes: '',
    });
    setForm(emptyForm());
    setShowForm(false);
  }

  const modalities: RadiologyRequest['modality'][] = ['MRI', 'CT', 'Ultrasound', 'XRay', 'Scope', 'Functional', 'Other'];
  const modLabels: Record<RadiologyRequest['modality'], string> = {
    MRI: 'MRI', CT: 'CT', Ultrasound: 'Ultrasound', XRay: 'X-Ray', Scope: 'Scope', Functional: 'Functional', Other: 'Other',
  };

  const needsContrast = form.ctContrast === 'IV' || form.ctContrast === 'both';

  const canSubmit = (form.modality === 'Other'
    ? form.otherDescription.trim().length > 0
    : form.anatomicalRegion.trim().length > 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowForm(s => !s)}
        style={{
          padding: '7px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          border: '1.5px dashed #0d9488',
          background: showForm ? '#f0fdfa' : '#fff',
          color: '#0d9488',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
      >
        {showForm ? '▾ Hide form' : '+ Add Radiology / Imaging Request'}
      </button>

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, padding: '14px 16px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>

          {/* Modality */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Modality</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {modalities.map(m => {
                const col = MODALITY_COLOURS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('modality', m)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: form.modality === m ? 700 : 500,
                      cursor: 'pointer',
                      border: form.modality === m ? `2px solid ${col.border}` : '1px solid #d1d5db',
                      background: form.modality === m ? col.bg : '#fff',
                      color: form.modality === m ? col.color : '#374151',
                    }}
                  >
                    {modLabels[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Anatomical Region */}
          {form.modality !== 'Other' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Anatomical Region</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={form.anatomicalRegion}
                  onChange={e => set('anatomicalRegion', e.target.value)}
                  placeholder="e.g. Right upper quadrant, L4/5 disc…"
                  style={{ flex: 1, fontSize: 13 }}
                />
                <select
                  value=""
                  onChange={e => { if (e.target.value) set('anatomicalRegion', e.target.value); }}
                  style={{ fontSize: 13, maxWidth: 200 }}
                >
                  <option value="">Quick-pick region…</option>
                  {ANATOMICAL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Laterality */}
          {form.modality !== 'Other' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Laterality</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['left', 'right', 'bilateral', ''] as const).map(lat => (
                  <PillBtn
                    key={lat || 'na'}
                    label={lat === '' ? 'N/A' : lat.charAt(0).toUpperCase() + lat.slice(1)}
                    active={form.laterality === lat}
                    onClick={() => set('laterality', lat)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Urgency */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Urgency</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['routine', 'urgent', 'emergency'] as const).map(u => (
                <PillBtn
                  key={u}
                  label={u.charAt(0).toUpperCase() + u.slice(1)}
                  active={form.urgency === u}
                  onClick={() => set('urgency', u)}
                  colour={URGENCY_COLOURS[u]}
                />
              ))}
            </div>
          </div>

          {/* Indication */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Indication</div>
            <input
              type="text"
              value={form.indication}
              onChange={e => set('indication', e.target.value)}
              placeholder="e.g. Right upper quadrant pain, abnormal LFTs, query cholelithiasis…"
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>

          {/* Clinical question */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Clinical Question</div>
            <textarea
              value={form.clinicalQuestion}
              onChange={e => set('clinicalQuestion', e.target.value)}
              placeholder="What specific information is needed from this investigation?"
              style={{ width: '100%', fontSize: 13, minHeight: 56, resize: 'vertical' }}
            />
          </div>

          {/* MRI-specific */}
          {form.modality === 'MRI' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1d4ed8' }}>MRI Options</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Protocol</div>
                <select
                  value={form.mriProtocol}
                  onChange={e => set('mriProtocol', e.target.value)}
                  style={{ fontSize: 13, width: '100%' }}
                >
                  <option value="">— select protocol —</option>
                  {MRI_PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Sequences (optional)</div>
                <input
                  type="text"
                  value={form.mriSequences}
                  onChange={e => set('mriSequences', e.target.value)}
                  placeholder="e.g. DWI, FLAIR, T1 fat-sat, T2…"
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>
          )}

          {/* CT-specific */}
          {form.modality === 'CT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#92400e' }}>CT Options</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Contrast</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['none', 'IV', 'oral', 'both'] as const).map(c => (
                    <PillBtn
                      key={c}
                      label={c === 'none' ? 'None' : c === 'IV' ? 'IV' : c === 'oral' ? 'Oral' : 'Both'}
                      active={form.ctContrast === c}
                      onClick={() => set('ctContrast', c)}
                    />
                  ))}
                </div>
              </div>
              {needsContrast && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Contrast Type</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {CT_CONTRAST_TYPES.map(t => (
                      <PillBtn
                        key={t}
                        label={t}
                        active={form.ctContrastType === t}
                        onClick={() => set('ctContrastType', t)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {needsContrast && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>eGFR (mL/min/1.73m²)</div>
                  <input
                    type="number"
                    value={form.ctEgfr}
                    onChange={e => set('ctEgfr', e.target.value)}
                    placeholder="Enter patient eGFR…"
                    style={{ width: 180, fontSize: 13 }}
                    min={0}
                    max={200}
                  />
                  <EgfrWarning egfr={form.ctEgfr} />
                </div>
              )}
            </div>
          )}

          {/* Scope-specific */}
          {form.modality === 'Scope' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: '#faf5ff', borderRadius: 8, border: '1px solid #ddd6fe' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7c3aed' }}>Scope Type</div>
              <select
                value={form.scopeType}
                onChange={e => set('scopeType', e.target.value)}
                style={{ fontSize: 13, width: '100%' }}
              >
                <option value="">— select scope type —</option>
                {SCOPE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Functional-specific */}
          {form.modality === 'Functional' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: '#eef2ff', borderRadius: 8, border: '1px solid #c7d2fe' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3730a3' }}>Functional Test Type</div>
              <select
                value={form.functionalType}
                onChange={e => set('functionalType', e.target.value)}
                style={{ fontSize: 13, width: '100%' }}
              >
                <option value="">— select functional test —</option>
                {FUNCTIONAL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Other modality */}
          {form.modality === 'Other' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</div>
              <input
                type="text"
                value={form.otherDescription}
                onChange={e => set('otherDescription', e.target.value)}
                placeholder="Describe the investigation or test…"
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              background: canSubmit ? '#0d9488' : '#e5e7eb',
              color: canSubmit ? '#fff' : '#9ca3af',
              cursor: canSubmit ? 'pointer' : 'default',
              alignSelf: 'flex-start',
            }}
          >
            Add to Requests
          </button>
        </div>
      )}
    </div>
  );
}

// ── Request item card ─────────────────────────────────────────────────────────

function RequestCard({
  req,
  onChange,
  onRemove,
}: {
  req: RadiologyRequest;
  onChange: (r: RadiologyRequest) => void;
  onRemove: () => void;
}) {
  const modCol = MODALITY_COLOURS[req.modality];
  const urgCol = URGENCY_COLOURS[req.urgency];

  const regionLabel = [
    req.modality === 'Other' ? req.otherDescription : req.anatomicalRegion,
    req.laterality ? req.laterality.charAt(0).toUpperCase() + req.laterality.slice(1) : '',
  ].filter(Boolean).join(' · ');

  // Modality-specific detail line
  let detailLine = '';
  if (req.modality === 'MRI' && req.mriProtocol) {
    detailLine = req.mriProtocol + (req.mriSequences ? ` · Sequences: ${req.mriSequences}` : '');
  } else if (req.modality === 'CT') {
    const parts: string[] = [];
    if (req.ctContrast && req.ctContrast !== 'none') {
      parts.push(`Contrast: ${req.ctContrast.toUpperCase()}`);
      if (req.ctContrastType) parts.push(req.ctContrastType);
      if (req.ctEgfr) parts.push(`eGFR: ${req.ctEgfr}`);
    } else if (req.ctContrast === 'none') {
      parts.push('No contrast');
    }
    detailLine = parts.join(' · ');
  } else if (req.modality === 'Scope' && req.scopeType) {
    detailLine = req.scopeType;
  } else if (req.modality === 'Functional' && req.functionalType) {
    detailLine = req.functionalType;
  }

  const needsEgfrWarning = req.modality === 'CT' && (req.ctContrast === 'IV' || req.ctContrast === 'both') && req.ctEgfr;

  return (
    <div
      style={{
        border: `1px solid ${req.resultReceived ? '#86efac' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '10px 14px',
        background: req.resultReceived ? '#f0fdf4' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Top row: badges + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        {/* Modality badge */}
        <span style={{
          padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: modCol.bg, color: modCol.color, border: `1px solid ${modCol.border}`,
        }}>
          {MODALITY_LABELS[req.modality]}
        </span>

        {/* Region */}
        {regionLabel && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{regionLabel}</span>
        )}

        {/* Urgency pill */}
        <span style={{
          padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          background: urgCol.bg, color: urgCol.color, border: `1px solid ${urgCol.border}`,
          textTransform: 'capitalize',
        }}>
          {req.urgency}
        </span>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          title="Remove request"
          style={{
            background: 'none', border: 'none', color: '#9ca3af',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px',
            marginLeft: 2,
          }}
        >
          ×
        </button>
      </div>

      {/* Indication */}
      {req.indication && (
        <div style={{ fontSize: 12, color: '#374151' }}>
          <span style={{ fontWeight: 600 }}>Indication: </span>{req.indication}
        </div>
      )}

      {/* Clinical question */}
      {req.clinicalQuestion && (
        <div style={{ fontSize: 12, color: '#374151' }}>
          <span style={{ fontWeight: 600 }}>Q: </span>{req.clinicalQuestion}
        </div>
      )}

      {/* Modality-specific details */}
      {detailLine && (
        <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>{detailLine}</div>
      )}

      {/* eGFR warning (display only) */}
      {needsEgfrWarning && <EgfrWarning egfr={req.ctEgfr} />}

      {/* Result received checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
        <input
          type="checkbox"
          id={`rad-result-${req.id}`}
          checked={req.resultReceived}
          onChange={e => onChange({ ...req, resultReceived: e.target.checked, resultNotes: e.target.checked ? req.resultNotes : '' })}
          style={{ width: 15, height: 15, cursor: 'pointer' }}
        />
        <label
          htmlFor={`rad-result-${req.id}`}
          style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: req.resultReceived ? '#16a34a' : '#6b7280' }}
        >
          Result received
        </label>
        {req.resultReceived && (
          <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 2 }}>✓</span>
        )}
      </div>

      {/* Result notes */}
      {req.resultReceived && (
        <textarea
          value={req.resultNotes}
          onChange={e => onChange({ ...req, resultNotes: e.target.value })}
          placeholder="Enter result summary or key findings…"
          style={{
            width: '100%',
            fontSize: 12,
            minHeight: 52,
            resize: 'vertical',
            border: '1px solid #86efac',
            borderRadius: 6,
            padding: '5px 8px',
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RadiologyTab() {
  const { radiologyRequests, setRadiologyRequests } = useAppContext() as ReturnType<typeof useAppContext> & {
    radiologyRequests: RadiologyRequest[];
    setRadiologyRequests: (v: RadiologyRequest[]) => void;
  };

  const requests: RadiologyRequest[] = radiologyRequests ?? [];

  function addRequest(r: RadiologyRequest) {
    setRadiologyRequests([...requests, r]);
  }

  function updateRequest(r: RadiologyRequest) {
    setRadiologyRequests(requests.map(x => x.id === r.id ? r : x));
  }

  function removeRequest(id: string) {
    setRadiologyRequests(requests.filter(x => x.id !== id));
  }

  const resultCount = requests.filter(r => r.resultReceived).length;

  const badgeText = requests.length > 0
    ? `${requests.length} request${requests.length !== 1 ? 's' : ''} · ${resultCount} result${resultCount !== 1 ? 's' : ''} received`
    : undefined;

  return (
    <div className="gap-y">
      <CollapsibleCard
        title="Radiology &amp; Imaging Requests"
        badge={badgeText}
        badgeVariant={resultCount > 0 ? 'default' : undefined}
      >
        {/* List of existing requests */}
        {requests.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
            No imaging requests added yet. Use the form below to add one.
          </div>
        )}

        {requests.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {requests.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                onChange={updateRequest}
                onRemove={() => removeRequest(req.id)}
              />
            ))}
          </div>
        )}

        {/* Add form */}
        <AddRadiologyForm onAdd={addRequest} />
      </CollapsibleCard>
    </div>
  );
}
