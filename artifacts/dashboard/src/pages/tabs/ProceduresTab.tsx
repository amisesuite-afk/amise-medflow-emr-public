import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
import ProcedureImagePanel, { type ProcImage } from '@/components/ProcedureImagePanel';
import ClavienDindoGrader from '@/components/ClavienDindoGrader';
import PathologySpecimenTracker from '@/components/PathologySpecimenTracker';
import PostopCarePlan from '@/components/PostopCarePlan';
import EndoscopyReportGenerator from '@/components/EndoscopyReportGenerator';
import SurveillanceProtocolCard from '@/components/SurveillanceProtocolCard';

// ── Types ─────────────────────────────────────────────────────────────────────

type ProcType = 'ogd' | 'colonoscopy' | 'ercp' | 'bronch' | 'preop' | 'postop' | 'other';

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fld">
      <label style={{ fontSize: 12, fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}

function ChipRow({ chips, value, onToggle }: { chips: string[]; value: string[]; onToggle: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
      {chips.map(chip => {
        const on = value.includes(chip);
        return (
          <button key={chip} type="button" onClick={() => onToggle(chip)} style={{
            padding: '3px 10px', borderRadius: 12,
            border: on ? '1px solid #0d9488' : '1px solid #d1d5db',
            background: on ? '#0d9488' : '#f9fafb',
            color: on ? '#fff' : '#374151',
            fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer',
          }}>{chip}</button>
        );
      })}
    </div>
  );
}

function SelectOpts({ chips, value, onChange }: { chips: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 12 }}>
      <option value="">— select —</option>
      {chips.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function CheckList({ items, value, onChange }: { items: string[]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter(x => x !== item) : [...value, item]);
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 12px', marginTop: 4 }}>
      {items.map(item => (
        <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#374151' }}>
          <input type="checkbox" checked={value.includes(item)} onChange={() => toggle(item)}
            style={{ accentColor: '#0d9488', width: 13, height: 13, flexShrink: 0 }} />
          {item}
        </label>
      ))}
    </div>
  );
}

function ProcSection({ title, children, defaultOpen = true, badge }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string | number }) {
  return (
    <details open={defaultOpen} style={{ marginTop: 12 }}>
      <summary style={{
        cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#64748b',
        letterSpacing: '0.06em', userSelect: 'none', listStyle: 'none',
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0',
      }}>
        <span style={{ fontSize: 8, color: '#0d9488' }}>▶</span>
        {title.toUpperCase()}
        {badge !== undefined && String(badge) !== '0' && (
          <span style={{ marginLeft: 'auto', background: '#d1fae5', color: '#065f46', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{badge}</span>
        )}
      </summary>
      <div style={{ paddingTop: 12 }}>{children}</div>
    </details>
  );
}

// ── AI Draft Report Panel ─────────────────────────────────────────────────────

function DraftReportPanel({
  procType, draft, loading, onGenerate, onSave, hero = false,
}: {
  procType: ProcType;
  draft: string;
  loading: boolean;
  onGenerate: () => void;
  onSave: (text: string) => void;
  hero?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const typeLabels: Record<ProcType, string> = {
    ogd: 'OGD', colonoscopy: 'Colonoscopy', ercp: 'ERCP', bronch: 'Bronchoscopy',
    preop: 'Pre-op Assessment', postop: 'Operative Note', other: 'Note',
  };

  return (
    <div style={hero
      ? { background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '14px 16px' }
      : { marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          style={{
            padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
            background: loading ? '#e2e8f0' : '#0d9488',
            color: loading ? '#94a3b8' : '#fff',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {loading ? (
            <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>⟳</span> Drafting…</>
          ) : (
            <><span>🤖</span> {draft ? 'Re-draft' : 'Draft'} {typeLabels[procType]} Report</>
          )}
        </button>
        {draft && !editing && (
          <>
            <button
              type="button"
              onClick={() => { setEditText(draft); setEditing(true); }}
              style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, border: '1px solid #d1d5db', background: '#f8fafc', color: '#374151', cursor: 'pointer' }}
            >✏️ Edit</button>
            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓ Draft ready</span>
          </>
        )}
      </div>

      {loading && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#f0fdfa', border: '1px solid #99f6e4', fontSize: 12, color: '#0f766e', fontStyle: 'italic' }}>
          Generating professional report from structured data…
        </div>
      )}

      {!loading && draft && !editing && (
        <div style={{
          padding: '14px 18px', borderRadius: 8,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          fontSize: 12, lineHeight: 1.75, whiteSpace: 'pre-wrap',
          maxHeight: 380, overflowY: 'auto',
          fontFamily: 'Georgia, "Times New Roman", serif',
          color: '#1e293b',
        }}>
          {draft}
        </div>
      )}

      {editing && (
        <div>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: '100%', minHeight: 340, fontSize: 12, lineHeight: 1.75,
              fontFamily: 'Georgia, "Times New Roman", serif',
              padding: '12px 16px', borderRadius: 8, border: '2px solid #0d9488',
              color: '#1e293b', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { onSave(editText); setEditing(false); }}
              style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer' }}
            >Save changes</button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
      )}

      {!loading && !draft && (
        <div style={{ fontSize: 11, color: hero ? '#0f766e' : '#94a3b8', fontStyle: 'italic' }}>
          {hero
            ? 'Expand "Clinical findings" below to add structured data, then click Draft — or click now to generate from indication alone.'
            : 'Fill in the structured data, then click "Draft Report" to generate a professional narrative for review and filing.'}
        </div>
      )}
    </div>
  );
}

// ── OGD form ──────────────────────────────────────────────────────────────────

interface OgdData {
  indication: string; sedationType: string; instrument: string;
  oesophagus: string; stomach: string; duodenum: string;
  biopsy: string; biopsySite: string;
  cloTest: string;
  complications: string; additionalNotes: string;
}

const EMPTY_OGD: OgdData = {
  indication: '', sedationType: '', instrument: '',
  oesophagus: '', stomach: '', duodenum: '',
  biopsy: '', biopsySite: '', cloTest: '',
  complications: '', additionalNotes: '',
};

function OgdForm({ data, onChange }: { data: OgdData; onChange: (d: OgdData) => void }) {
  function set<K extends keyof OgdData>(k: K, v: OgdData[K]) { onChange({ ...data, [k]: v }); }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="Indication">
          <SelectOpts chips={['Dyspepsia', 'Dysphagia', 'Haematemesis', 'Anaemia workup', "Barrett's surveillance", 'Gastric ulcer follow-up', 'Oesophageal stricture', 'H. pylori testing', 'Post-op surveillance', 'Weight loss workup']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Sedation">
          <SelectOpts chips={['None (unsedated)', 'Topical spray only', 'Conscious sedation', 'GA / propofol']}
            value={data.sedationType} onChange={v => set('sedationType', v)} />
        </Field>
        <Field label="Instrument">
          <input type="text" value={data.instrument} onChange={e => set('instrument', e.target.value)}
            placeholder="e.g. Olympus GIF-H290" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Field label="Oesophagus">
          <SelectOpts chips={['Normal', 'Oesophagitis grade A', 'Oesophagitis grade B', 'Oesophagitis grade C', 'Oesophagitis grade D', "Barrett's oesophagus", 'Stricture', 'Varices', 'Hiatal hernia', 'Mass / polyp']}
            value={data.oesophagus} onChange={v => set('oesophagus', v)} />
        </Field>
        <Field label="Stomach">
          <SelectOpts chips={['Normal', 'Gastritis (antral)', 'Gastritis (diffuse)', 'Ulcer (antrum)', 'Ulcer (lesser curve)', 'Polyp', 'Atrophic mucosa', 'Mass']}
            value={data.stomach} onChange={v => set('stomach', v)} />
        </Field>
        <Field label="Duodenum">
          <SelectOpts chips={['Normal', 'Duodenitis', 'Duodenal ulcer (D1)', 'Duodenal ulcer (D2)', 'Erosions', 'Mass']}
            value={data.duodenum} onChange={v => set('duodenum', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <Field label="Biopsy">
          <SelectOpts chips={['Yes', 'No']} value={data.biopsy} onChange={v => set('biopsy', v)} />
        </Field>
        <Field label="Biopsy site(s)">
          <input type="text" value={data.biopsySite} onChange={e => set('biopsySite', e.target.value)}
            placeholder="e.g. antrum ×2, Z-line ×4" style={{ fontSize: 12 }} />
        </Field>
        <Field label="CLO / H. pylori">
          <SelectOpts chips={['Positive', 'Negative', 'Not done']} value={data.cloTest} onChange={v => set('cloTest', v)} />
        </Field>
        <Field label="Complications">
          <SelectOpts chips={['None', 'Bleeding', 'Perforation', 'Aspiration', 'Poor tolerance', 'Incomplete procedure']}
            value={data.complications} onChange={v => set('complications', v)} />
        </Field>
      </div>

      <Field label="Additional findings, grades, plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Z-line / GEJ, hiatal hernia size, LA grade of oesophagitis, HP treatment plan, biopsy sites, surveillance recommendation, next steps…"
          style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Colonoscopy form ──────────────────────────────────────────────────────────

interface ColonData {
  indication: string; prepQuality: string; sedationType: string;
  instrument: string;
  cecalIntubation: string; intubationTimeMin: string; withdrawalTimeMin: string;
  ileoscopy: string; appendixOrifice: string;
  findings: string;
  polyps: { site: string; size: string; morphology: string; intervention: string; histology: string }[];
  tattoo: string; tattooSite: string;
  surveillanceInterval: string;
  complications: string; additionalNotes: string;
}

const EMPTY_COLON: ColonData = {
  indication: '', prepQuality: '', sedationType: '',
  instrument: '',
  cecalIntubation: '', intubationTimeMin: '', withdrawalTimeMin: '',
  ileoscopy: '', appendixOrifice: '',
  findings: '',
  polyps: [],
  tattoo: '', tattooSite: '',
  surveillanceInterval: '',
  complications: '', additionalNotes: '',
};

interface BsgResult {
  interval: string;
  risk: 'none' | 'low' | 'intermediate' | 'high' | 'urgent';
  rationale: string;
}

function parseSizeMm(sizeStr: string): number {
  const n = parseFloat(sizeStr.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function calcBsgSurveillance(polyps: ColonData['polyps']): BsgResult | null {
  const relevant = polyps.filter(p => p.histology && p.histology !== 'Hyperplastic polyp' && p.histology !== 'Pending histology');
  if (relevant.length === 0) return null;

  if (relevant.some(p => p.histology === 'Suspected carcinoma')) {
    return { interval: 'Urgent MDT referral', risk: 'urgent', rationale: 'Suspected carcinoma — urgent MDT / colorectal surgery referral required' };
  }

  const hasHgd = relevant.some(p => p.histology === 'High-grade dysplasia (HGD)');
  const adenomas = relevant.filter(p =>
    p.histology === 'Tubular adenoma' || p.histology === 'Tubulovillous adenoma' ||
    p.histology === 'Villous adenoma' || p.histology === 'High-grade dysplasia (HGD)'
  );
  const hasVillous = relevant.some(p => p.histology === 'Villous adenoma' || p.histology === 'Tubulovillous adenoma');
  const adenomaCount = adenomas.length;
  const adenomaSizes = adenomas.map(p => parseSizeMm(p.size));
  const maxAdenomaSize = adenomaSizes.length > 0 ? Math.max(...adenomaSizes) : 0;

  const ssls = relevant.filter(p => p.histology === 'Sessile serrated lesion (SSL)');
  const hasLargeSsl = ssls.some(p => parseSizeMm(p.size) >= 10);
  const hasSslDysplasia = relevant.some(p => p.histology === 'High-grade dysplasia (HGD)' && polyps.some(q => q.histology === 'Sessile serrated lesion (SSL)'));

  if (adenomaCount >= 5 || maxAdenomaSize >= 20 || hasHgd || hasVillous) {
    const reasons: string[] = [];
    if (adenomaCount >= 5) reasons.push(`${adenomaCount} adenomas`);
    if (maxAdenomaSize >= 20) reasons.push(`≥20mm adenoma (${maxAdenomaSize}mm)`);
    if (hasVillous) reasons.push('villous/tubulovillous histology');
    if (hasHgd) reasons.push('HGD');
    return { interval: '1 year', risk: 'high', rationale: `High risk — ${reasons.join('; ')}` };
  }

  if (adenomaCount >= 3 || (maxAdenomaSize >= 10 && maxAdenomaSize < 20) || hasLargeSsl || hasSslDysplasia) {
    const reasons: string[] = [];
    if (adenomaCount >= 3) reasons.push(`${adenomaCount} adenomas`);
    if (maxAdenomaSize >= 10 && maxAdenomaSize < 20) reasons.push(`${maxAdenomaSize}mm adenoma`);
    if (hasLargeSsl) reasons.push('SSL ≥10mm');
    return { interval: '3 years', risk: 'intermediate', rationale: `Intermediate risk — ${reasons.join('; ')}` };
  }

  if (ssls.length > 0 && !hasLargeSsl) {
    return { interval: '5 years', risk: 'low', rationale: 'Sessile serrated lesion(s) <10mm without dysplasia' };
  }

  if (adenomaCount >= 1 && adenomaCount <= 2 && maxAdenomaSize < 10) {
    return { interval: 'No surveillance required', risk: 'none', rationale: '1–2 small (<10mm) tubular adenomas — return to population screening (BSG 2019)' };
  }

  return null;
}

const BSG_RISK_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  none:         { bg: '#f0fdf4', border: '#86efac', color: '#15803d', label: 'Low risk' },
  low:          { bg: '#f0fdf4', border: '#86efac', color: '#15803d', label: 'Low risk' },
  intermediate: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309', label: 'Intermediate risk' },
  high:         { bg: '#fff1f2', border: '#fca5a5', color: '#b91c1c', label: 'High risk' },
  urgent:       { bg: '#fff1f2', border: '#f87171', color: '#7f1d1d', label: 'URGENT' },
};

function ColonForm({ data, onChange }: { data: ColonData; onChange: (d: ColonData) => void }) {
  function set<K extends keyof ColonData>(k: K, v: ColonData[K]) { onChange({ ...data, [k]: v }); }
  function addPolyp() {
    set('polyps', [...data.polyps, { site: '', size: '', morphology: '', intervention: '', histology: '' }]);
  }
  function updatePolyp(i: number, field: string, v: string) {
    set('polyps', data.polyps.map((p, idx) => idx === i ? { ...p, [field]: v } : p));
  }
  function removePolyp(i: number) {
    set('polyps', data.polyps.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['Colorectal cancer screening', 'Polyp surveillance', 'Rectal bleeding', 'Change in bowel habit', 'Anaemia workup', 'IBD surveillance', 'Diarrhoea workup', 'Diverticular disease', 'Post-resection surveillance', 'Iron deficiency anaemia']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Instrument">
          <input type="text" value={data.instrument} onChange={e => set('instrument', e.target.value)}
            placeholder="e.g. Olympus CF-HQ190L" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Bowel prep quality (Boston BSS)">
          <SelectOpts chips={['Excellent (≥8)', 'Adequate (6–7)', 'Poor (3–5)', 'Inadequate (<3)', 'Repeat required']}
            value={data.prepQuality} onChange={v => set('prepQuality', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Sedation">
          <SelectOpts chips={['None', 'Entonox', 'Conscious sedation', 'GA / propofol']}
            value={data.sedationType} onChange={v => set('sedationType', v)} />
        </Field>
        <Field label="Caecal intubation">
          <SelectOpts chips={['Yes — complete', 'No — splenic flexure', 'No — hepatic flexure', 'No — sigmoid']}
            value={data.cecalIntubation} onChange={v => set('cecalIntubation', v)} />
        </Field>
        <Field label="Ileoscopy">
          <SelectOpts chips={['Performed — normal', 'Performed — abnormal', 'Not attempted']}
            value={data.ileoscopy} onChange={v => set('ileoscopy', v)} />
        </Field>
        <Field label="Appendix orifice">
          <SelectOpts chips={['Visualised', 'Not visualised', 'Previous appendicectomy']}
            value={data.appendixOrifice} onChange={v => set('appendixOrifice', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Time to caecum (min)">
          <input type="number" value={data.intubationTimeMin} onChange={e => set('intubationTimeMin', e.target.value)}
            placeholder="—" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Withdrawal time (min)">
          <input type="number" value={data.withdrawalTimeMin} onChange={e => set('withdrawalTimeMin', e.target.value)}
            placeholder="≥6" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Colonic findings (primary)">
          <SelectOpts chips={['Normal', 'Diverticulosis', 'Angiodysplasia', 'Haemorrhoids', 'Mass / lesion', 'Stricture', 'IBD changes', 'Melanosis coli']}
            value={data.findings} onChange={v => set('findings', v)} />
        </Field>
        <Field label="Complications">
          <SelectOpts chips={['None', 'Post-polypectomy bleeding', 'Perforation', 'Poor tolerance / abandoned', 'Incomplete procedure']}
            value={data.complications} onChange={v => set('complications', v)} />
        </Field>
      </div>

      <Field label="Polyps">
        {data.polyps.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0' }}>No polyps recorded</div>
        )}
        {data.polyps.map((polyp, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, background: '#f9fafb', borderRadius: 6, padding: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Site</div>
              <SelectOpts chips={['Rectum', 'Sigmoid', 'Descending colon', 'Splenic flexure', 'Transverse colon', 'Hepatic flexure', 'Ascending colon', 'Caecum', 'Terminal ileum']}
                value={polyp.site} onChange={v => updatePolyp(i, 'site', v)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Size</div>
              <input type="text" value={polyp.size} onChange={e => updatePolyp(i, 'size', e.target.value)}
                placeholder="mm" style={{ fontSize: 12, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Morphology (Paris)</div>
              <SelectOpts chips={['Ip (pedunculated)', 'Is (sessile)', 'IIa (flat elevated)', 'IIb (flat)', 'IIc (depressed)', 'LST (laterally spreading)', 'LST-G', 'LST-NG']}
                value={polyp.morphology} onChange={v => updatePolyp(i, 'morphology', v)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Histology</div>
              <SelectOpts chips={['Tubular adenoma', 'Tubulovillous adenoma', 'Villous adenoma', 'Sessile serrated lesion (SSL)', 'Hyperplastic polyp', 'High-grade dysplasia (HGD)', 'Suspected carcinoma', 'Pending histology']}
                value={polyp.histology} onChange={v => updatePolyp(i, 'histology', v)} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Intervention</div>
              <SelectOpts chips={['Biopsy only', 'Hot snare polypectomy', 'Cold snare polypectomy', 'EMR', 'ESD', 'APC', 'Clip haemostasis', 'Left in situ — refer']}
                value={polyp.intervention} onChange={v => updatePolyp(i, 'intervention', v)} />
            </div>
            <button type="button" onClick={() => removePolyp(i)}
              style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, paddingBottom: 2 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={addPolyp}
          style={{ marginTop: 4, fontSize: 12, color: '#0d9488', background: 'none', border: '1px dashed #0d9488', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
          + Add polyp
        </button>
      </Field>


      {(() => {
        const bsg = calcBsgSurveillance(data.polyps);
        if (!bsg) return null;
        const style = BSG_RISK_STYLE[bsg.risk];
        return (
          <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: style.color, marginBottom: 2 }}>
                BSG 2019 Surveillance — {style.label}
              </div>
              <div style={{ fontSize: 12, color: '#374151' }}>{bsg.rationale}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: style.color }}>{bsg.interval}</div>
              {data.surveillanceInterval !== bsg.interval && (
                <button type="button"
                  onClick={() => set('surveillanceInterval', bsg.interval)}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: `1px solid ${style.border}`, background: style.bg, color: style.color, cursor: 'pointer', fontWeight: 600 }}>
                  Apply
                </button>
              )}
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Tattoo">
          <SelectOpts chips={['Not required', 'Applied', 'Deferred']} value={data.tattoo} onChange={v => set('tattoo', v)} />
        </Field>
        <Field label="Tattoo site">
          <input type="text" value={data.tattooSite} onChange={e => set('tattooSite', e.target.value)}
            placeholder="e.g. 5 cm proximal to lesion, sigmoid colon" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Surveillance recommendation">
          <SelectOpts chips={['No surveillance required', '1 year', '3 years', '5 years', '10 years', 'As per histopathology', 'Annual (IBD / high-risk)', 'Urgent MDT referral']}
            value={data.surveillanceInterval} onChange={v => set('surveillanceInterval', v)} />
        </Field>
      </div>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Additional findings, biopsy plan, IBD activity score, surveillance rationale…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── ERCP form ─────────────────────────────────────────────────────────────────

interface ErcpData {
  indication: string; sedationType: string; instrument: string;
  papillaDescription: string;
  cannulation: string; contrastInjection: string;
  cholangiogramFindings: string; cbdDiameter: string;
  pancreatogramDone: string; cholangioscopy: string;
  sphincterotomy: string; precut: string;
  stoneExtraction: string; stoneCount: string; stoneSizeMm: string;
  stent: string; stentType: string; stentSizeFr: string; stentLengthCm: string;
  biliarySweep: string; fluoroscopyTimeMin: string;
  complications: string; additionalNotes: string;
}

const EMPTY_ERCP: ErcpData = {
  indication: '', sedationType: '', instrument: '',
  papillaDescription: '',
  cannulation: '', contrastInjection: '',
  cholangiogramFindings: '', cbdDiameter: '',
  pancreatogramDone: '', cholangioscopy: '',
  sphincterotomy: '', precut: '',
  stoneExtraction: '', stoneCount: '', stoneSizeMm: '',
  stent: '', stentType: '', stentSizeFr: '', stentLengthCm: '',
  biliarySweep: '', fluoroscopyTimeMin: '',
  complications: '', additionalNotes: '',
};

function ErcpForm({ data, onChange }: { data: ErcpData; onChange: (d: ErcpData) => void }) {
  function set<K extends keyof ErcpData>(k: K, v: ErcpData[K]) { onChange({ ...data, [k]: v }); }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['CBD stones (choledocholithiasis)', 'Biliary stricture (benign)', 'Biliary stricture (malignant)', 'Cholangitis', 'Biliary leak', 'Stent exchange', 'Pancreatic duct stones', 'Pancreatic stricture', 'Bile duct injury', 'PSC / cholangiopathy']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Instrument (duodenoscope)">
          <input type="text" value={data.instrument} onChange={e => set('instrument', e.target.value)}
            placeholder="e.g. Olympus TJF-Q190V" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Sedation / anaesthesia">
          <SelectOpts chips={['Conscious sedation', 'Propofol TIVA', 'GA', 'Monitored anaesthesia care']}
            value={data.sedationType} onChange={v => set('sedationType', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Papilla description">
          <SelectOpts chips={['Normal native papilla', 'Bulging / impacted stone', 'Stenotic orifice', 'Prior sphincterotomy', 'Peri-ampullary diverticulum', 'Tumour involvement']}
            value={data.papillaDescription} onChange={v => set('papillaDescription', v)} />
        </Field>
        <Field label="Cannulation">
          <SelectOpts chips={['Successful — native papilla', 'Successful — pancreatic duct', 'Failed', 'Previous sphincterotomy']}
            value={data.cannulation} onChange={v => set('cannulation', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
        <Field label="Cholangiogram findings">
          <SelectOpts chips={['Normal biliary tree', 'CBD stones', 'Dilated CBD', 'Biliary stricture', 'Biliary leak', 'Hilar involvement', 'Post-surgical anatomy']}
            value={data.cholangiogramFindings} onChange={v => set('cholangiogramFindings', v)} />
        </Field>
        <Field label="Contrast injection">
          <SelectOpts chips={['Full cholangiogram', 'Partial', 'Not performed']}
            value={data.contrastInjection} onChange={v => set('contrastInjection', v)} />
        </Field>
        <Field label="CBD (mm)">
          <input type="number" value={data.cbdDiameter} onChange={e => set('cbdDiameter', e.target.value)}
            placeholder="mm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Pancreatogram">
          <SelectOpts chips={['Not performed', 'Normal pancreatic duct', 'Pancreatic duct stricture', 'Pancreatic duct stones', 'IPMN findings']}
            value={data.pancreatogramDone} onChange={v => set('pancreatogramDone', v)} />
        </Field>
        <Field label="Cholangioscopy">
          <SelectOpts chips={['Not performed', 'Performed — normal', 'Performed — abnormal (see notes)']}
            value={data.cholangioscopy} onChange={v => set('cholangioscopy', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Sphincterotomy">
          <SelectOpts chips={['Not performed', 'Performed', 'Extension of prior']}
            value={data.sphincterotomy} onChange={v => set('sphincterotomy', v)} />
        </Field>
        <Field label="Pre-cut sphincterotomy">
          <SelectOpts chips={['Not required', 'Performed', 'Attempted — failed']}
            value={data.precut} onChange={v => set('precut', v)} />
        </Field>
        <Field label="Biliary sweep / balloon">
          <SelectOpts chips={['Not performed', 'Performed — clear', 'Performed — residual']}
            value={data.biliarySweep} onChange={v => set('biliarySweep', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 12 }}>
        <Field label="Stone extraction">
          <SelectOpts chips={['Not applicable', 'Complete clearance', 'Partial — residual stones', 'Not possible']}
            value={data.stoneExtraction} onChange={v => set('stoneExtraction', v)} />
        </Field>
        <Field label="Count">
          <input type="text" value={data.stoneCount} onChange={e => set('stoneCount', e.target.value)}
            placeholder="n" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Max size (mm)">
          <input type="text" value={data.stoneSizeMm} onChange={e => set('stoneSizeMm', e.target.value)}
            placeholder="mm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px', gap: 12 }}>
        <Field label="Stent placed">
          <SelectOpts chips={['No', 'Yes']} value={data.stent} onChange={v => set('stent', v)} />
        </Field>
        <Field label="Stent type">
          <SelectOpts chips={['Plastic (straight)', 'Plastic (pigtail)', 'SEMS (uncovered)', 'SEMS (partially covered)', 'SEMS (fully covered)', 'Nasobiliary drain']}
            value={data.stentType} onChange={v => set('stentType', v)} />
        </Field>
        <Field label="Fr">
          <input type="number" value={data.stentSizeFr} onChange={e => set('stentSizeFr', e.target.value)}
            placeholder="Fr" style={{ fontSize: 12 }} />
        </Field>
        <Field label="cm">
          <input type="number" value={data.stentLengthCm} onChange={e => set('stentLengthCm', e.target.value)}
            placeholder="cm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Fluoroscopy time (min)">
          <input type="number" value={data.fluoroscopyTimeMin} onChange={e => set('fluoroscopyTimeMin', e.target.value)}
            placeholder="min" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Complications">
          <SelectOpts chips={['None', 'Post-ERCP pancreatitis', 'Bleeding', 'Perforation', 'Cholangitis', 'Contrast reaction']}
            value={data.complications} onChange={v => set('complications', v)} />
        </Field>
      </div>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Cytology brushings, pancreatogram findings, cholangioscopy findings, follow-up plan…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Bronchoscopy form ─────────────────────────────────────────────────────────

interface BronchData {
  indication: string; bronchoscope: string; sedationType: string;
  vocalCords: string; carina: string;
  rightAirways: string; leftAirways: string;
  overallFindings: string; lesionDescription: string;
  bal: string; balSite: string;
  biopsy: string; biopsySite: string;
  brushings: string; ebus: string;
  microbiology: string;
  complications: string; additionalNotes: string;
}

const EMPTY_BRONCH: BronchData = {
  indication: '', bronchoscope: '', sedationType: '',
  vocalCords: '', carina: '',
  rightAirways: '', leftAirways: '',
  overallFindings: '', lesionDescription: '',
  bal: '', balSite: '',
  biopsy: '', biopsySite: '',
  brushings: '', ebus: '',
  microbiology: '',
  complications: '', additionalNotes: '',
};

function BronchForm({ data, onChange }: { data: BronchData; onChange: (d: BronchData) => void }) {
  function set<K extends keyof BronchData>(k: K, v: BronchData[K]) { onChange({ ...data, [k]: v }); }
  const showLesion = data.rightAirways.toLowerCase().includes('mass') || data.rightAirways.toLowerCase().includes('lesion') ||
    data.leftAirways.toLowerCase().includes('mass') || data.leftAirways.toLowerCase().includes('lesion');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Indication">
          <SelectOpts chips={['Haemoptysis', 'Persistent cough', 'Suspected malignancy', 'Mediastinal mass', 'Recurrent pneumonia', 'Foreign body', 'Airway evaluation', 'Atelectasis workup', 'Pre-operative airway', 'Sarcoidosis', 'Interstitial lung disease']}
            value={data.indication} onChange={v => set('indication', v)} />
        </Field>
        <Field label="Bronchoscope">
          <input type="text" value={data.bronchoscope} onChange={e => set('bronchoscope', e.target.value)}
            placeholder="e.g. Olympus BF-H190" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Sedation / anaesthesia">
          <SelectOpts chips={['Topical only (awake)', 'Conscious sedation', 'Propofol TIVA', 'GA / LMA', 'GA / ETT']}
            value={data.sedationType} onChange={v => set('sedationType', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Vocal cords">
          <SelectOpts chips={['Normal — full abduction', 'Reduced mobility (left)', 'Reduced mobility (right)', 'Bilateral paresis', 'Oedema / erythema', 'Lesion / polyp', 'Not assessed']}
            value={data.vocalCords} onChange={v => set('vocalCords', v)} />
        </Field>
        <Field label="Carina">
          <SelectOpts chips={['Sharp / normal', 'Blunted / widened', 'Infiltrated', 'Extrinsic compression']}
            value={data.carina} onChange={v => set('carina', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Right airways">
          <SelectOpts chips={['Normal', 'Secretions', 'Mucosal oedema / erythema', 'Endobronchial mass', 'Extrinsic compression', 'Lesion (see notes)']}
            value={data.rightAirways} onChange={v => set('rightAirways', v)} />
        </Field>
        <Field label="Left airways">
          <SelectOpts chips={['Normal', 'Secretions', 'Mucosal oedema / erythema', 'Endobronchial mass', 'Extrinsic compression', 'Lesion (see notes)']}
            value={data.leftAirways} onChange={v => set('leftAirways', v)} />
        </Field>
      </div>

      <Field label="Overall findings / impression">
        <textarea value={data.overallFindings} onChange={e => set('overallFindings', e.target.value)}
          placeholder="Overall bronchoscopic impression, airway patency, mucosal appearance…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>

      {showLesion && (
        <Field label="Lesion description">
          <textarea value={data.lesionDescription} onChange={e => set('lesionDescription', e.target.value)}
            placeholder="Location, size estimate, surface characteristics, obstructive fraction, vascularity, friability…" style={{ fontSize: 12, minHeight: 60 }} />
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <Field label="BAL">
          <SelectOpts chips={['Not performed', 'Performed', 'Not indicated']}
            value={data.bal} onChange={v => set('bal', v)} />
        </Field>
        <Field label="BAL site">
          <input type="text" value={data.balSite} onChange={e => set('balSite', e.target.value)}
            placeholder="e.g. RML, LLL" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Endobronchial biopsy">
          <SelectOpts chips={['Not performed', 'Performed']}
            value={data.biopsy} onChange={v => set('biopsy', v)} />
        </Field>
        <Field label="Biopsy site(s)">
          <input type="text" value={data.biopsySite} onChange={e => set('biopsySite', e.target.value)}
            placeholder="e.g. RUL mass ×4" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Brushings">
          <SelectOpts chips={['Not performed', 'Performed']}
            value={data.brushings} onChange={v => set('brushings', v)} />
        </Field>
        <Field label="EBUS">
          <SelectOpts chips={['Not performed', 'Performed — see notes', 'Planned separately']}
            value={data.ebus} onChange={v => set('ebus', v)} />
        </Field>
        <Field label="Complications">
          <SelectOpts chips={['None', 'Desaturation', 'Endobronchial bleeding', 'Bronchospasm', 'Poor tolerance / abandoned']}
            value={data.complications} onChange={v => set('complications', v)} />
        </Field>
      </div>

      <Field label="Microbiology / specimens sent">
        <input type="text" value={data.microbiology} onChange={e => set('microbiology', e.target.value)}
          placeholder="e.g. BAL for MC&S, AFB, galactomannan, PCR; biopsy for histopathology" style={{ fontSize: 12 }} />
      </Field>

      <Field label="Additional findings / plan">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Additional findings, cytology, plan, follow-up…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Pre-op form ───────────────────────────────────────────────────────────────

interface PreopData {
  plannedProcedure: string; urgency: string; asaGrade: string;
  airway: string; dentition: string;
  cardiacRisk: string[]; respiratoryRisk: string[];
  bloodsOk: string; crossmatch: string; ecg: string; cxr: string; imaging: string;
  consentObtained: string; consentNotes: string;
  anaesthesiaConsent: string; lastOralIntake: string;
  prophylaxis: string[]; additionalNotes: string;
}

const EMPTY_PREOP: PreopData = {
  plannedProcedure: '', urgency: '', asaGrade: '',
  airway: '', dentition: '',
  cardiacRisk: [], respiratoryRisk: [],
  bloodsOk: '', crossmatch: '', ecg: '', cxr: '', imaging: '',
  consentObtained: '', consentNotes: '',
  anaesthesiaConsent: '', lastOralIntake: '',
  prophylaxis: [], additionalNotes: '',
};

function PreopForm({ data, onChange }: { data: PreopData; onChange: (d: PreopData) => void }) {
  function set<K extends keyof PreopData>(k: K, v: PreopData[K]) { onChange({ ...data, [k]: v }); }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Planned procedure">
          <input type="text" value={data.plannedProcedure} onChange={e => set('plannedProcedure', e.target.value)}
            placeholder="e.g. Laparoscopic cholecystectomy" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Urgency">
          <SelectOpts chips={['Elective', 'Semi-elective', 'Urgent (24–72 h)', 'Emergency (<24 h)']}
            value={data.urgency} onChange={v => set('urgency', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="ASA grade">
          <SelectOpts chips={['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V', 'ASA VI']}
            value={data.asaGrade} onChange={v => set('asaGrade', v)} />
        </Field>
        <Field label="Airway (Mallampati)">
          <SelectOpts chips={['Mallampati I', 'Mallampati II', 'Mallampati III', 'Mallampati IV', 'Difficult airway predicted', 'Previous difficult intubation']}
            value={data.airway} onChange={v => set('airway', v)} />
        </Field>
        <Field label="Dentition">
          <SelectOpts chips={['Good / intact', 'Loose teeth', 'Dentures / plates', 'Poor dentition']}
            value={data.dentition} onChange={v => set('dentition', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Cardiac risk factors">
          <CheckList items={['None identified', 'Hypertension', 'IHD / angina', 'Prior MI', 'CCF', 'Arrhythmia', 'Diabetes', 'Obesity (BMI >30)']}
            value={data.cardiacRisk} onChange={v => set('cardiacRisk', v)} />
        </Field>
        <Field label="Respiratory risk factors">
          <CheckList items={['None identified', 'Asthma', 'COPD', 'OSA / CPAP', 'Smoker (active)', 'Interstitial lung disease']}
            value={data.respiratoryRisk} onChange={v => set('respiratoryRisk', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {([['bloodsOk', 'Bloods'], ['crossmatch', 'X-match / G&S'], ['ecg', 'ECG'], ['cxr', 'CXR'], ['imaging', 'Imaging']] as [keyof PreopData, string][]).map(([k, lbl]) => (
          <Field key={k} label={lbl}>
            <SelectOpts chips={['Done ✓', 'N/A', 'Pending']}
              value={data[k] as string} onChange={v => set(k, v)} />
          </Field>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Surgical consent">
          <SelectOpts chips={['Obtained — signed', 'Verbal (emergency)', 'Pending', 'Not applicable']}
            value={data.consentObtained} onChange={v => set('consentObtained', v)} />
        </Field>
        <Field label="Anaesthesia consent">
          <SelectOpts chips={['Obtained', 'Pending', 'N/A']}
            value={data.anaesthesiaConsent} onChange={v => set('anaesthesiaConsent', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Consent notes (risks discussed)">
          <input type="text" value={data.consentNotes} onChange={e => set('consentNotes', e.target.value)}
            placeholder="e.g. Bleeding, infection, conversion to open, bile leak discussed" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Last oral intake">
          <input type="text" value={data.lastOralIntake} onChange={e => set('lastOralIntake', e.target.value)}
            placeholder="e.g. Nil by mouth since 06:00" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Prophylaxis">
        <CheckList items={['DVT prophylaxis (LMWH)', 'TED stockings', 'Antibiotic prophylaxis', 'Anticoagulant held / bridged', 'Bowel prep given', 'Metoclopramide / antacid']}
          value={data.prophylaxis} onChange={v => set('prophylaxis', v)} />
      </Field>

      <Field label="Additional notes">
        <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Any other pre-operative considerations…" style={{ fontSize: 12, minHeight: 60 }} />
      </Field>
    </div>
  );
}

// ── Operative Note form ───────────────────────────────────────────────────────

interface PostopData {
  procedurePerformed: string; approach: string; anaesthesiaType: string;
  duration: string; surgeon: string; assistant: string;
  anaesthetist: string; scrubNurse: string;
  position: string; incision: string;
  operativeSteps: string; safetyChecks: string[];
  intraopImaging: string;
  findings: string; ebl: string; fluidIn: string; urineOut: string;
  specimenSent: string; specimenSite: string;
  drain: string; drainType: string; drainSite: string;
  closure: string; dressing: string;
  postopOrders: string[]; diet: string; ivAccess: string;
  complications: string; additionalNotes: string;
}

const EMPTY_POSTOP: PostopData = {
  procedurePerformed: '', approach: '', anaesthesiaType: '',
  duration: '', surgeon: '', assistant: '',
  anaesthetist: '', scrubNurse: '',
  position: '', incision: '',
  operativeSteps: '', safetyChecks: [],
  intraopImaging: '',
  findings: '', ebl: '', fluidIn: '', urineOut: '',
  specimenSent: '', specimenSite: '',
  drain: '', drainType: '', drainSite: '',
  closure: '', dressing: '',
  postopOrders: [], diet: '', ivAccess: '',
  complications: '', additionalNotes: '',
};

// ── Surgical templates ────────────────────────────────────────────────────────

interface SurgicalTemplate {
  group: string; name: string;
  approach: string; anaesthesiaType: string; position: string; incision: string;
  safetyChecks: string[]; intraopImaging: string;
  operativeSteps: string; findingsTemplate: string;
  ebl: string; specimenSent: string; specimenSite: string;
  drain: string; drainType: string; drainSite: string;
  closure: string; dressing: string;
  postopOrders: string[]; diet: string; ivAccess: string;
  postOpNotes: string;
}

function applyTemplate(tpl: SurgicalTemplate, current: PostopData): PostopData {
  return {
    ...current,
    procedurePerformed: tpl.name,
    approach: tpl.approach,
    anaesthesiaType: tpl.anaesthesiaType,
    position: tpl.position,
    incision: tpl.incision,
    safetyChecks: tpl.safetyChecks,
    intraopImaging: tpl.intraopImaging,
    operativeSteps: tpl.operativeSteps,
    findings: tpl.findingsTemplate,
    ebl: tpl.ebl,
    specimenSent: tpl.specimenSent,
    specimenSite: tpl.specimenSite,
    drain: tpl.drain,
    drainType: tpl.drainType,
    drainSite: tpl.drainSite,
    closure: tpl.closure,
    dressing: tpl.dressing,
    postopOrders: tpl.postopOrders,
    diet: tpl.diet,
    ivAccess: tpl.ivAccess,
    additionalNotes: tpl.postOpNotes,
  };
}

const SURGICAL_TEMPLATES: SurgicalTemplate[] = [
  // Hepatobiliary
  { group: 'Hepatobiliary', name: 'Laparoscopic cholecystectomy',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: '12 mm umbilical Hassan port; 5 mm epigastric port; 5 mm right subcostal port; 5 mm right lateral port',
    safetyChecks: ['WHO surgical safety checklist', 'Critical view of safety (CVS) confirmed', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under GA. Cefazolin 2 g IV at induction. TED stockings + LMWH.
2. Hassan technique at umbilicus — 12 mm port under direct vision. Pneumoperitoneum CO₂ 15 mmHg.
3. 5 mm epigastric, 5 mm right subcostal, 5 mm right lateral ports inserted under vision.
4. Patient positioned head-up, left lateral tilt.
5. Systematic laparoscopic inspection of peritoneal cavity.
6. Gallbladder fundus retracted cephalad. Infundibulum retracted laterally.
7. Calot's triangle dissected — posterior then anterior peritoneum divided with hook diathermy.
8. Critical view of safety (CVS) established: two structures entering gallbladder; lower one-third cleared from liver bed. CVS documented with still image.
9. Cystic artery: 2 clips proximal, 1 clip distal — divided.
10. Cystic duct: 2 clips proximal, 1 clip distal — divided.
11. Gallbladder dissected from liver bed using diathermy — haemostasis confirmed.
12. Specimen in endobag — retrieved through umbilical port. Liver bed irrigated and aspirated.
13. Ports removed under direct vision. Pneumoperitoneum released.
14. 12 mm umbilical fascial defect closed: Vicryl 0, J-needle. All ports: subcuticular Monocryl 3/0.
15. Specimen to histopathology. Patient tolerated procedure well. Transferred to recovery.`,
    findingsTemplate: `Gallbladder: [inflamed / oedematous / normal]. Wall: [thickened / normal]. Stone(s): [single large stone in neck / multiple stones]. No bile spillage. CVS achieved. CBD: not dilated. Liver: normal. No unexpected intra-abdominal pathology.`,
    ebl: '<50 ml', specimenSent: 'Yes — histopathology', specimenSite: 'Gallbladder + stone(s)',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'], diet: 'Free fluids', ivAccess: 'PIV × 1',
    postOpNotes: `Analgesia: paracetamol 1 g QID + ibuprofen 400 mg TDS + PRN oxycodone 5 mg.
Anti-emetic: ondansetron 4 mg PRN.
Discharge: same-day / overnight — tolerating fluids, pain controlled, voiding, mobile.
Follow-up: 2 weeks — wound check + histology.
Red flags: fever >38°C, jaundice, severe RUQ pain, shoulder-tip pain → ED.` },

  { group: 'Hepatobiliary', name: 'Laparoscopic cholecystectomy + on-table cholangiogram (IOC)',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: '12 mm umbilical Hassan port; 5 mm epigastric port; 5 mm right subcostal port; 5 mm right lateral port',
    safetyChecks: ['WHO surgical safety checklist', 'Critical view of safety (CVS) confirmed', 'On-table cholangiogram', 'Swab count correct ×2'],
    intraopImaging: 'On-table cholangiogram',
    operativeSteps:
`1. Patient supine under GA. Cefazolin 2 g IV at induction. TED stockings + LMWH.
2. Hassan technique umbilical 12 mm port. Pneumoperitoneum 15 mmHg. Three 5 mm working ports.
3. CVS established in Calot's triangle — documented with image.
4. Cystic duct: proximal clip applied, anterior wall incised — IOC catheter inserted and secured.
5. Contrast injected under fluoroscopy: [CBD ___ mm, no filling defect / stone(s) at ___ — describe].
6. IOC catheter removed. Cystic duct: 2 proximal clips, 1 distal — divided.
7. Cystic artery: 2 proximal, 1 distal clip — divided.
8. Gallbladder dissected from liver bed. Specimen in endobag — retrieved through umbilical port.
9. Liver bed haemostasis, irrigation, aspiration — clear.
10. Ports removed under vision. Fascial defect closed. Skin subcuticular Monocryl.
11. Specimen to histopathology. Patient tolerated procedure well.`,
    findingsTemplate: `Gallbladder: [inflamed / normal]. IOC: CBD [___ mm, normal calibre / filling defect at ___]. No contrast extravasation. Biliary anatomy: [normal / variant]. Post-IOC: [CBD clear / stones → ERCP planned / LCBDE performed].`,
    ebl: '<50 ml', specimenSent: 'Yes — histopathology', specimenSite: 'Gallbladder + stone(s)',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'], diet: 'Free fluids', ivAccess: 'PIV × 1',
    postOpNotes: `Analgesia: paracetamol 1 g QID + ibuprofen 400 mg TDS + PRN oxycodone.
Discharge: same-day / overnight.
Follow-up: 2 weeks — wound + histology. If CBD stones on IOC → ERCP within 2–4 weeks.` },

  // Hernia
  { group: 'Hernia', name: 'Inguinal hernia repair — TAPP (laparoscopic)',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: '12 mm umbilical Hassan port; 5 mm right iliac fossa port; 5 mm left iliac fossa port',
    safetyChecks: ['WHO surgical safety checklist', 'Correct site marking confirmed', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under GA. Cefazolin 2 g IV. TED stockings + LMWH. IDC inserted.
2. Hassan umbilical 12 mm port. Pneumoperitoneum 12 mmHg. Trendelenburg 15°.
3. 5 mm right and left iliac fossa ports inserted under vision.
4. Both inguinal regions inspected: [direct / indirect / combined / bilateral / contralateral normal].
5. Peritoneal incision: transverse from ASIS medially over defect, extended above medial umbilical ligament.
6. Preperitoneal space developed: Cooper's ligament, iliopubic tract, epigastric vessels, vas deferens, gonadal vessels identified and preserved. Triangle of doom and triangle of pain respected.
7. Hernia sac fully reduced. [Indirect sac: parietalized / endoloop ligation at deep ring.]
8. Mesh (15 × 10 cm lightweight polypropylene) introduced, unfurled to cover direct, indirect, and femoral spaces.
9. Mesh secured: 2 tacks to Cooper's ligament; 1 tack above iliopubic tract. No fixation below iliopubic tract.
10. Peritoneal closure: running absorbable 2/0 Vicryl — complete mesh coverage.
11. IDC removed. Ports removed. Fascial defect closed. Skin Monocryl. Patient tolerated procedure well.`,
    findingsTemplate: `Hernia: [right / left / bilateral] [direct / indirect / combined]. Defect size: [___ cm]. Content: [omentum / empty sac]. Contralateral: [normal / defect repaired]. Mesh: 15 × 10 cm, tension-free, complete peritoneal coverage confirmed.`,
    ebl: '<20 ml', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'], diet: 'Light diet', ivAccess: 'PIV × 1',
    postOpNotes: `Analgesia: paracetamol 1 g QID + ibuprofen 400 mg TDS + PRN oxycodone 5 mg.
Scrotal support (male) — reduce haematoma/seroma risk.
No heavy lifting >5 kg for 4 weeks. Discharge: day surgery.
Follow-up: 2 weeks — seroma/wound; 6 weeks — return to strenuous activity.` },

  { group: 'Hernia', name: 'Inguinal hernia repair — Lichtenstein (open)',
    approach: 'Open', anaesthesiaType: 'Spinal', position: 'Supine',
    incision: 'Oblique groin incision 1 cm above midpoint of inguinal ligament toward pubic tubercle',
    safetyChecks: ['WHO surgical safety checklist', 'Correct site marking confirmed', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under spinal / GA. Prophylactic antibiotics. TED stockings.
2. Oblique groin incision in Langer's lines. Scarpa's fascia divided. External oblique aponeurosis opened from external ring along fibres.
3. Ilioinguinal and iliohypogastric nerves identified and preserved throughout.
4. Cord structures mobilised at pubic tubercle. Cremasteric fibres divided.
5. Hernia sac: [indirect — high ligation with Vicryl 0 at deep ring / direct — plicated with Prolene 2/0].
6. Lightweight polypropylene mesh (7.5 × 15 cm) placed tension-free over posterior wall.
7. Mesh secured: pubic tubercle (Prolene 2/0 × 2); inguinal ligament (running Prolene 2/0); conjoint tendon (interrupted Prolene 2/0). Lateral slit around cord — tails sutured to create new internal ring.
8. External oblique closed (Vicryl 2/0 continuous). Scarpa's fascia (Vicryl 3/0). Skin subcuticular Monocryl 3/0.
9. Patient tolerated procedure well.`,
    findingsTemplate: `Hernia: [right / left] [direct: Hesselbach defect ___ cm / indirect: sac at deep ring]. Content: [omentum / empty]. Mesh: 7.5 × 15 cm lightweight polypropylene, tension-free.`,
    ebl: '<20 ml', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'], diet: 'Normal diet', ivAccess: 'PIV × 1',
    postOpNotes: `Analgesia: paracetamol 1 g QID + ibuprofen 400 mg TDS + PRN oxycodone.
No heavy lifting >10 kg for 4 weeks. Discharge: same-day / next day.
Follow-up: 2 weeks — wound; 6 weeks — return to strenuous activity.` },

  { group: 'Hernia', name: 'Umbilical hernia repair (open, suture)',
    approach: 'Open', anaesthesiaType: 'GA', position: 'Supine',
    incision: 'Transverse infraumbilical / circumumbilical incision',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under GA. Prophylactic antibiotics. TED stockings.
2. Transverse infraumbilical incision. Skin flap raised to expose hernia sac and neck.
3. Sac dissected free. Sac opened, contents inspected and reduced. Sac excised.
4. Fascial edges freshened. Defect repaired with interrupted non-absorbable sutures (Prolene 0) — Mayo technique if defect >2 cm.
5. Subcutaneous (Vicryl 3/0). Skin subcuticular Monocryl 3/0 (clip to umbilicus).
6. Patient tolerated procedure well.`,
    findingsTemplate: `Umbilical defect: [___ cm]. Content: [omentum / empty sac]. Fascia: [healthy / attenuated]. Repair: [primary suture <2 cm / Mayo repair 2–4 cm].`,
    ebl: '<20 ml', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'], diet: 'Normal diet', ivAccess: 'PIV × 1',
    postOpNotes: `Analgesia: paracetamol 1 g QID + ibuprofen 400 mg TDS.
Discharge: same-day. Follow-up: 2 weeks — wound check.` },

  // Colorectal
  { group: 'Colorectal', name: 'Laparoscopic appendicectomy',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: '12 mm umbilical Hassan port; 5 mm suprapubic port; 5 mm left iliac fossa port',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under GA (RSI if emergency). Cefazolin 2 g + metronidazole 500 mg IV at induction. TED stockings. IDC inserted.
2. Hassan umbilical 12 mm port. Pneumoperitoneum 15 mmHg. 5 mm suprapubic + 5 mm LIF ports.
3. Systematic peritoneal inspection. Appendix identified at tenia coli confluence.
4. Appendix retracted anterosuperiorly. Mesoappendix divided with clips / LigaSure, securing appendicular artery.
5. Appendix base skeletonised. Two Endoloops at base (1 mm apart); third Endoloop on specimen side. Appendix divided.
6. Specimen in endobag — retrieved through umbilical port.
7. [If perforated: warm saline lavage 1–2 L × 3; Blake drain in RIF.]
8. Ports removed under vision. 12 mm fascial defect closed (Vicryl 0, J-needle). Skin Monocryl 3/0.
9. Specimen to histopathology. Patient tolerated procedure well.`,
    findingsTemplate: `Appendix: [acutely inflamed / gangrenous / perforated at base / mid / normal]. Position: [standard / retrocaecal / pelvic]. Faecalith: [present / absent]. Contamination: [none / localised pus / free pus]. No other pathology.`,
    ebl: '<30 ml', specimenSent: 'Yes — histopathology', specimenSite: 'Appendix',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['Antibiotic therapy', 'DVT prophylaxis', 'IDC — strict I&O', 'Wound review in 2 days'],
    diet: 'Free fluids', ivAccess: 'PIV × 1',
    postOpNotes: `Antibiotics: continue IV cefazolin + metronidazole if perforated (48–72h IV → oral co-amoxiclav).
Analgesia: paracetamol + ibuprofen + PRN oxycodone.
Discharge: day 1–2 (simple); day 3–5 (perforated).
Follow-up: 2 weeks — wound + histology (exclude carcinoid/Crohn's).` },

  { group: 'Colorectal', name: 'Laparoscopic right hemicolectomy',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: 'Five-port laparoscopic access; 4–5 cm right transverse minilaparotomy for extraction',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine under GA. ERAS protocol. Prophylactic antibiotics + DVT prophylaxis. IDC inserted.
2. Five-port laparoscopic access established.
3. Medial-to-lateral mobilisation: ileocolic vessels divided at origin (vascular stapler). SMA and SMV identified and preserved.
4. Hepatic flexure mobilised. Kocherisation. Lateral attachments divided.
5. Specimen exteriorised through 4–5 cm right transverse minilaparotomy with wound protector.
6. Extracorporeal functional end-to-end ileocolic anastomosis (linear stapler 60 mm × 2). Enterotomy closed (Vicryl 3/0).
7. Anastomosis returned. Mesenteric defect closed (Vicryl 3/0).
8. Minilaparotomy: loop PDS 1. Ports ≥10 mm: Vicryl 0 J-needle. Skin Monocryl 3/0.
9. Specimen to histopathology. Patient tolerated procedure well.`,
    findingsTemplate: `Pathology: [caecum / ascending colon / hepatic flexure; size ___ cm]. Liver: [no metastases visible / lesion at ___]. Peritoneum: [clear]. Anastomosis: air-leak test negative.`,
    ebl: '<100 ml', specimenSent: 'Yes — histopathology', specimenSite: 'Right hemicolectomy specimen',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'IDC — strict I&O', 'Physiotherapy', 'Wound review in 2 days'],
    diet: 'Sips only', ivAccess: 'PIV × 2',
    postOpNotes: `ERAS: paracetamol + NSAID + PRN opioid; early ambulation; sips at 4h → free fluids → light diet.
IDC remove day 1. Discharge day 3–5 on return of bowel function.
Follow-up: 4 weeks — wound + histology + oncology MDT if malignancy.` },

  { group: 'Colorectal', name: 'Laparoscopic anterior resection',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Lloyd-Davies / lithotomy',
    incision: 'Five-port laparoscopic access; Pfannenstiel / left iliac fossa extraction incision',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient Lloyd-Davies under GA. ERAS. Prophylactic antibiotics + DVT prophylaxis + bowel prep. IDC inserted.
2. Five-port laparoscopic access. Rectal catheter placed.
3. IMA divided at origin after identification of left ureter. Total mesorectal excision (TME) to pelvic floor.
4. Inferior hypogastric plexus and autonomic nerves preserved.
5. Rectum divided distally (2–3 linear stapler cartridges) below tumour. Specimen exteriorised.
6. Anvil 29 mm circular stapler inserted in proximal colon. Colorectal anastomosis. Air-leak test: negative.
7. [Protecting loop ileostomy if high-risk anastomosis.]
8. Pelvic drain placed. Fascial closure loop PDS. Skin Monocryl.
9. Patient tolerated procedure well.`,
    findingsTemplate: `Tumour: [mid / lower rectum at ___ cm from anal verge; T stage on imaging]. TME: complete plane. Margins: [proximal and distal clear — distal ___ cm]. Anastomosis: [___ cm from anal verge; air-leak test negative]. Autonomic nerves: identified and preserved.`,
    ebl: '', specimenSent: 'Yes — histopathology', specimenSite: 'Sigmoid / rectal specimen (anterior resection)',
    drain: 'Placed', drainType: 'Blake drain', drainSite: 'Pelvis',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'IDC — strict I&O', 'Physiotherapy', 'Wound review in 2 days'],
    diet: 'Sips only', ivAccess: 'PIV × 2',
    postOpNotes: `ERAS protocol: early diet, analgesia ladder, ambulation.
IDC remove day 1–2. Drain remove day 2–3 if serous output.
Discharge: day 4–6 on return of bowel function.
Follow-up: 4 weeks — wound + histology; oncology MDT.` },

  { group: 'Colorectal', name: "Hartmann's procedure",
    approach: 'Open', anaesthesiaType: 'GA', position: 'Lloyd-Davies / lithotomy',
    incision: 'Midline laparotomy — xiphoid to pubis',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient Lloyd-Davies under GA (RSI). Prophylactic antibiotics + DVT prophylaxis. IDC inserted.
2. Midline laparotomy. Peritoneal contamination assessed — peritoneal toilet with warm saline commenced.
3. Sigmoid colon and rectum mobilised — avascular plane lateral to sigmoid into pelvis.
4. IMA divided. Ureters identified and preserved bilaterally.
5. Rectum divided below peritoneal reflection with linear stapler. Stump oversewn (Prolene 3/0) and marked with long non-absorbable suture.
6. Proximal colon divided at disease-free margin. Specimen removed.
7. Peritoneal toilet (3–5 L warm saline) — aspirated.
8. LIF colostomy trephine. End colostomy fashioned and matured (Brooke technique, Vicryl 3/0). Stoma appliance applied.
9. Pelvic Blake drain exited through stab incision. Abdomen: mass closure loop PDS 1. Skin: clips.
10. Specimen to histopathology. Patient tolerated procedure.`,
    findingsTemplate: `Pathology: [perforated diverticulitis / sigmoid volvulus / obstructing carcinoma — Hinchey grade ___: localised abscess / pelvic abscess / purulent peritonitis / faecal peritonitis]. Proximal colon: viable. Stump: mid-rectum. Reversal planned: 3–6 months.`,
    ebl: '', specimenSent: 'Yes — histopathology', specimenSite: 'Sigmoid colon + rectum specimen',
    drain: 'Placed', drainType: 'Blake drain', drainSite: 'Pelvis / presacral',
    closure: 'Vicryl + skin staples', dressing: 'Mepore',
    postopOrders: ['Antibiotic therapy', 'DVT prophylaxis', 'IDC — strict I&O', 'Continuous monitoring', 'Physiotherapy'],
    diet: 'NBM / NPO', ivAccess: 'PIV × 2',
    postOpNotes: `IV antibiotics: co-amoxiclav or cefazolin + metronidazole × 3–5 days.
Analgesia: PCA morphine 48h → oral ladder.
IDC: UO ≥0.5 ml/kg/h; remove at 48h. Drain: remove day 3–4 if serous <100 ml.
Stoma nurse: review day 1. Discharge: day 5–10.
Follow-up: 4 weeks — wound, stoma, histology, reversal planning.` },

  // Upper GI
  { group: 'Upper GI', name: 'Laparoscopic Nissen fundoplication',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Reverse Trendelenburg',
    incision: 'Five-port: 12 mm umbilical, two 5 mm LUQ ports, 5 mm RUQ port, 5 mm epigastric liver retractor',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient reverse Trendelenburg with split-leg table under GA. Five-port access. Liver retractor deployed.
2. Pars flaccida divided. Short gastric vessels divided with LigaSure (5–6 vessels).
3. Oesophageal hiatus dissected — posterior window created. Hiatal crura exposed anteriorly and posteriorly.
4. Mediastinal oesophagus mobilised — minimum 3 cm tension-free intra-abdominal length confirmed with 52 Fr bougie in situ.
5. Posterior cruroplasty: [2–3] interrupted Ethibond 2/0 — hiatus snug around bougie.
6. Fundus passed through posterior window (shoe-shine test: fundus stays without traction).
7. 360° floppy fundoplication fashioned over 52 Fr bougie: 3 × Ethibond 2/0 incorporating oesophageal wall. Wrap 2 cm in length.
8. Bougie removed. Wrap tension-free, below diaphragm.
9. Ports removed. Fascial defects >10 mm closed (Vicryl 0, J-needle). Skin Monocryl 3/0. Patient tolerated procedure well.`,
    findingsTemplate: `Hiatal hernia: [___ cm / absent]. Oesophageal length: [___ cm intra-abdominal achieved]. Short gastric vessels: [5–6 divided]. Crural defect: [___ cm, closed with ___ sutures]. Fundoplication: 2 cm floppy 360°, passes bougie without tension.`,
    ebl: '<50 ml', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'Physiotherapy', 'Wound review in 2 days'], diet: 'Sips only', ivAccess: 'PIV × 1',
    postOpNotes: `Diet: sips day 0 → pureed week 1 → soft diet week 2–6 → normal at 6 weeks.
PPI: omeprazole 20 mg OD for 8 weeks. Avoid carbonated drinks × 6 weeks.
Discharge: day 1–2. Follow-up: 2 weeks (diet); 3 months (symptom review).` },

  { group: 'Upper GI', name: 'Laparoscopic sleeve gastrectomy (LSG)',
    approach: 'Laparoscopic', anaesthesiaType: 'GA', position: 'Supine',
    incision: 'Five-port: 12 mm umbilical, four 5 mm working ports (split-leg table)',
    safetyChecks: ['WHO surgical safety checklist', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine, split legs, under GA. 36 Fr bougie passed by anaesthetist. Five-port access.
2. Greater curve mobilised from 4 cm proximal to pylorus to angle of His using LigaSure — gastroepiploic arcade preserved.
3. Short gastric vessels divided. Fundus fully mobilised.
4. Sleeve fashioned along 36 Fr bougie using sequential linear stapler firings (6–8 cartridges, green/blue load) from 4 cm proximal to pylorus to angle of His.
5. Staple line inspected. Air-leak test (methylene blue / air under saline) — negative.
6. Staple line oversewn with running Vicryl 3/0 [if performed].
7. Blake drain along staple line [if placed — remove day 1 if no leak].
8. Ports closed. Patient tolerated procedure well. Resected stomach to histopathology.`,
    findingsTemplate: `Bougie size: 36 Fr. Sleeve length: [adequate — angle of His to 4 cm proximal pylorus]. Staple line: [intact, no leak on air test]. Pylorus: [preserved, no injury].`,
    ebl: '<50 ml', specimenSent: 'Yes — histopathology', specimenSite: 'Resected gastric sleeve',
    drain: 'Placed', drainType: 'Blake drain', drainSite: 'Along staple line',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepore',
    postopOrders: ['DVT prophylaxis', 'IDC — strict I&O', 'Physiotherapy', 'Remove drain day 1'], diet: 'Sips only', ivAccess: 'PIV × 1',
    postOpNotes: `Bariatric enhanced recovery: sips at 4h, protein supplements from day 1.
Drain remove day 1 if no signs of leak (output <30 ml, non-bilious).
VTE: LMWH × 28 days post-op (bariatric extended prophylaxis).
Follow-up: 1 week (drain removal, wound); 1 month; 3 months; 6 months.` },

  // Endoscopy
  { group: 'Endoscopy', name: 'OGD — diagnostic',
    approach: 'Endoscopic', anaesthesiaType: 'MAC / sedation', position: 'Left lateral',
    incision: 'Transoral — no incision', safetyChecks: ['WHO surgical safety checklist'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient positioned left lateral under topical oropharyngeal anaesthesia / conscious sedation.
2. GIF-H290 gastroscope passed under direct vision through cricopharyngeus.
3. Oesophagus inspected to gastro-oesophageal junction — [describe findings].
4. Retroflexion performed in stomach. Fundus, cardia, body, antrum and pylorus inspected — [describe findings].
5. Duodenum intubated. D1 and D2 inspected — [describe findings].
6. Scope withdrawn with careful inspection. Biopsies taken from [sites] as clinically indicated.
7. Patient tolerated procedure well. No immediate complications.`,
    findingsTemplate: 'Oesophagus: [normal / describe]. Stomach: [normal / describe]. Duodenum: [normal / describe]. Biopsies: [sites and indication].',
    ebl: 'Nil', specimenSent: 'Yes — histopathology', specimenSite: 'Gastric / duodenal biopsies',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: '', dressing: 'N/A',
    postopOrders: ['Continuous monitoring'],
    diet: 'Sips only', ivAccess: 'PIV × 1',
    postOpNotes: `Post-OGD: observations ×30 min. Resume diet when gag reflex fully returned.
Histopathology results to be reviewed at follow-up.
If H. pylori positive on biopsy — prescribe eradication therapy and arrange UBT at 6 weeks.` },

  { group: 'Endoscopy', name: 'Colonoscopy — diagnostic',
    approach: 'Endoscopic', anaesthesiaType: 'MAC / sedation', position: 'Left lateral',
    incision: 'Transanal — no incision', safetyChecks: ['WHO surgical safety checklist'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient positioned left lateral under conscious sedation. Bowel preparation: [adequate / excellent / poor].
2. CF-HQ190 colonoscope inserted per rectum. Rectal ampulla inspected.
3. Scope advanced through sigmoid, descending colon, splenic flexure, transverse colon, hepatic flexure, ascending colon to caecum.
4. Caecal intubation confirmed by identification of appendix orifice, ileocaecal valve and caecal pole. Ileoscopy performed — [normal / abnormal].
5. Careful withdrawal with four-quadrant inspection at each segment. Total withdrawal time: ___ minutes.
6. Findings: [describe any polyps, diverticulosis, inflammation, masses].
7. Patient tolerated procedure well. No immediate complications.`,
    findingsTemplate: 'Caecal intubation: confirmed. Bowel prep: [adequate/excellent/poor]. Mucosa: [normal throughout / describe lesions]. Polyps: [none / describe site, size, Paris classification]. Diverticula: [none / describe segment]. Other: [describe].',
    ebl: 'Nil', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: '', dressing: 'N/A',
    postopOrders: ['Continuous monitoring'],
    diet: 'Normal diet', ivAccess: 'PIV × 1',
    postOpNotes: `Post-colonoscopy: observations ×30 min. Normal diet when fully awake.
BSG surveillance interval calculated based on findings.
Histopathology results (if biopsies taken) to be reviewed at follow-up.` },

  { group: 'Endoscopy', name: 'Colonoscopy + polypectomy / EMR',
    approach: 'Endoscopic', anaesthesiaType: 'MAC / sedation', position: 'Left lateral',
    incision: 'Transanal — no incision', safetyChecks: ['WHO surgical safety checklist'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient positioned left lateral under conscious sedation. Bowel preparation: [adequate / excellent].
2. Colonoscope advanced to caecum. Withdrawal performed with systematic inspection.
3. Polyp(s) identified and characterised (NICE/Paris classification) — see findings section.
4. Cold snare polypectomy / hot snare polypectomy / EMR performed:
   - [Site]: [size] mm, [Paris], removed by [technique]. Specimen retrieved.
5. Haemostasis confirmed at all polypectomy sites. [Haemostatic clips applied if required.]
6. [Tattoo applied at ___ cm for subsequent surgical planning.]
7. Specimens labelled individually and sent for histopathology.
8. Patient tolerated procedure well. No immediate complications. BSG surveillance interval calculated.`,
    findingsTemplate: 'Caecal intubation: confirmed. Polyp 1: [site] cm, [size] mm, Paris [classification], removed by [cold snare / hot snare / EMR]. Polyp 2: [describe]. Haemostasis: confirmed. Tattoo: [placed / not required]. Specimens: individually labelled.',
    ebl: 'Minimal', specimenSent: 'Yes — histopathology', specimenSite: 'Colonic polyp(s) — individually labelled',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: '', dressing: 'N/A',
    postopOrders: ['Continuous monitoring'],
    diet: 'Light diet', ivAccess: 'PIV × 1',
    postOpNotes: `Post-polypectomy: observations ×60 min. Light diet after procedure; normal diet next day.
Warn patient: delayed bleeding risk up to 14 days — attend ER if significant rectal bleeding.
BSG surveillance interval: [calculate based on polyp number, size, histology].
Histopathology results to be reviewed; communicate results and surveillance plan to patient.` },

  { group: 'Endoscopy', name: 'ERCP — sphincterotomy + stone extraction',
    approach: 'Endoscopic', anaesthesiaType: 'MAC / sedation', position: 'Prone',
    incision: 'Transoral — no incision', safetyChecks: ['WHO surgical safety checklist'],
    intraopImaging: 'Fluoroscopy (C-arm)',
    operativeSteps:
`1. Patient positioned prone under propofol TIVA / deep sedation with CO₂ insufflation.
2. ERCP duodenoscope (TJF-Q180V) advanced to second part of duodenum. Papilla identified — [describe].
3. Deep biliary cannulation achieved with sphincterotome / guidewire technique. Contrast injected.
4. Cholangiogram confirmed: [CBD diameter ___ mm, [number] stones in [location], biliary anatomy].
5. Biliary sphincterotomy performed extending to superior duodenal fold. Haemostasis achieved.
6. [Balloon dilatation performed to ___ mm.]
7. CBD stones extracted using extraction balloon / Dormia basket — [number] stones retrieved. Completion sweep confirmed clearance.
8. Completion cholangiogram confirmed CBD clearance / residual stones [describe].
9. [Biliary stent placed as bridge if required.]
10. Patient tolerated procedure well. No immediate complications. Post-ERCP observations commenced.`,
    findingsTemplate: 'Papilla: [normal / periampullary diverticulum / describe]. Cholangiogram: CBD ___ mm, [number] calculi in [location]. Sphincterotomy: performed to superior fold. Stones extracted: [number], largest ___ mm. Completion cholangiogram: [clear / residual stones — describe]. Stent: [placed / not required].',
    ebl: 'Minimal', specimenSent: 'None', specimenSite: '',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: '', dressing: 'N/A',
    postopOrders: ['NPO until tolerated', 'Continuous monitoring', 'Antibiotic therapy'],
    diet: 'NBM / NPO', ivAccess: 'PIV × 1',
    postOpNotes: `Post-ERCP: 4–6 hours fasting, observations ×4 hours. Lipase/amylase at 4h.
Warn patient: post-ERCP pancreatitis risk (~3–5%). If severe abdominal pain develops — admit for observation.
Post-sphincterotomy: delayed bleeding risk; monitor stool.
Follow-up: arrange MRCP or ultrasound at 6 weeks; outpatient review for cholecystectomy planning if gallstones present.` },

  // Breast & Thyroid
  { group: 'Breast & Thyroid', name: 'Total thyroidectomy',
    approach: 'Open', anaesthesiaType: 'GA', position: 'Supine',
    incision: 'Collar (Kocher) incision in natural skin crease, 1–2 cm above clavicle',
    safetyChecks: ['WHO surgical safety checklist', 'Correct site marking confirmed', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine, neck extended over shoulder roll under GA. NIM ETT placed; baseline neuromonitoring (bilateral V1/R1/L1) confirmed.
2. Collar incision marked in natural skin crease. Full-thickness subplatysmal flaps raised superiorly to thyroid cartilage, inferiorly to sternal notch.
3. Midline raphe divided. Strap muscles separated and retracted laterally.
4. RIGHT LOBE: Superior pole vessels divided sequentially close to thyroid capsule (preserving external laryngeal nerve — stimulated and confirmed).
5. Lateral dissection: middle thyroid vein divided. Inferior thyroid artery identified medial to carotid.
6. Right RLN identified in tracheo-oesophageal groove, traced to laryngeal entry. Continuous NIM signal confirmed throughout dissection.
7. Right upper and lower parathyroid glands identified — [in situ with intact pedicle / devascularised → autotransplanted to sternomastoid].
8. Right lobe dissected off trachea and isthmus divided.
9. LEFT LOBE: Same technique applied. Left RLN identified and confirmed by NIM. Left parathyroids identified and preserved.
10. Specimen excised en bloc. Final NIM signals confirmed bilaterally (V2/R2/L2).
11. Haemostasis achieved with Ligasure and haemostatic clips. [Small-bore suction drain placed in thyroid bed.]
12. Strap muscles re-approximated with Vicryl 3/0. Platysma closed Vicryl 3/0. Skin closed Monocryl 4/0 subcuticular.
13. Specimen weight ___ g. Sent for histopathology.`,
    findingsTemplate: 'Thyroid: [describe size, consistency, nodule(s), capsule integrity]. RLN (right): [identified and preserved, NIM signal maintained]. RLN (left): [identified and preserved, NIM signal maintained]. Parathyroids (right): [upper in situ / lower in situ / autotransplanted]. Parathyroids (left): [upper in situ / lower in situ / autotransplanted]. Specimen weight: ___ g.',
    ebl: '50–100', specimenSent: 'Yes — histopathology', specimenSite: 'Total thyroid specimen + any nodules',
    drain: 'Placed', drainType: 'Blake drain', drainSite: 'Thyroid bed',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepilex / Tegaderm',
    postopOrders: ['NPO until tolerated', 'DVT prophylaxis', 'Continuous monitoring', 'Wound review in 2 days'],
    diet: 'Sips only', ivAccess: 'PIV × 1',
    postOpNotes: `CALCIUM PROTOCOL: Check PTH and corrected calcium at 6 hours post-op.
If PTH <10 pmol/L or Ca²⁺ <2.0 mmol/L: commence calcium carbonate 1.5 g TDS + calcitriol 0.25 mcg BD.
If symptomatic hypocalcaemia (perioral tingling, Chvostek/Trousseau positive): IV calcium gluconate 10 mL 10% over 10 min.
Drain removal: when output <30 mL/24h (usually day 1).
Thyroxine: commence levothyroxine 100 mcg daily (adjust per TFTs at 6 weeks).
Histopathology follow-up: results at 2-week clinic; MDT referral if malignancy confirmed.
Follow-up: 2 weeks (drain review, Ca²⁺, wound); 6 weeks (TFTs, histopathology discussion).` },

  { group: 'Breast & Thyroid', name: 'Wide local excision (WLE) of breast',
    approach: 'Open', anaesthesiaType: 'GA', position: 'Supine',
    incision: 'Periareolar / radial / elliptical excision — cosmetic incision in Langer\'s lines overlying tumour',
    safetyChecks: ['WHO surgical safety checklist', 'Correct site marking confirmed', 'Swab count correct ×2'],
    intraopImaging: 'None used',
    operativeSteps:
`1. Patient supine, arm extended on arm board. Wire/seed/ROLL localisation confirmed in theatre with imaging review.
2. Skin incision designed: [elliptical / periareolar / radial] to include skin overlying tumour if indicated.
3. Skin incision made. Subcutaneous flaps raised.
4. WLE performed with macroscopic clear margins in all planes (target ≥1 mm microscopic). Specimen orientated with sutures/clips (superior — short, lateral — long, deep — medium, medial — double).
5. Specimen sent fresh to histopathology for margin assessment ± intraoperative frozen section.
6. [Margin shavings taken from [direction] margin on surgeon's assessment.]
7. Haemostasis secured with diathermy. Dead space closed with interrupted Vicryl 2/0.
8. [Small corrugated drain placed if large cavity — remove day 1.]
9. Skin closed with Monocryl 3/0 subcuticular. Dressing applied.
10. Mammographic titanium clips placed in tumour bed for radiotherapy planning.
11. [Sentinel node biopsy performed — see addendum.]`,
    findingsTemplate: 'Tumour location: [quadrant, distance from nipple]. Localisation wire/seed: confirmed in situ. Specimen: [dimensions] cm × [dimensions] cm × [dimensions] cm, orientated [superior/lateral/deep/medial]. Macroscopic margins: [describe]. Frozen section (if performed): [margin status]. Clips placed in tumour bed: yes. SLNB (if performed): [hot/blue node(s) identified — describe].',
    ebl: 'Minimal', specimenSent: 'Yes — histopathology', specimenSite: 'WLE specimen orientated (superior/lateral/deep/medial) ± margin shavings',
    drain: 'Not placed', drainType: '', drainSite: '',
    closure: 'Monocryl (subcuticular)', dressing: 'Mepilex / Tegaderm',
    postopOrders: ['DVT prophylaxis', 'Wound review in 2 days'],
    diet: 'Normal diet', ivAccess: 'PIV × 1',
    postOpNotes: `Post-op: same-day discharge if no drain. Sling for comfort if required.
Wound review at 48–72 hours (practice nurse).
Histopathology and margin status: discuss at MDT within 1–2 weeks.
If margins involved: re-excision or completion mastectomy discussion at MDT.
Radiotherapy referral: arrange if breast-conserving surgery confirmed oncologically appropriate.
Breast care nurse: referral for psychological support and post-op information.
Follow-up: 2 weeks clinic (histopathology discussion, treatment planning).` },
];

function PostopForm({ data, onChange }: { data: PostopData; onChange: (d: PostopData) => void }) {
  const [surgeryKey, setSurgeryKey] = useState('');
  function set<K extends keyof PostopData>(k: K, v: PostopData[K]) { onChange({ ...data, [k]: v }); }

  function loadSurgery(name: string) {
    setSurgeryKey(name);
    if (!name) return;
    const tpl = SURGICAL_TEMPLATES.find(t => t.name === name);
    if (!tpl) return;
    if (data.operativeSteps && data.operativeSteps.trim()) {
      if (!window.confirm('Replace the existing operative note with this template?')) return;
    }
    onChange(applyTemplate(tpl, data));
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>

      {/* ── Surgery type selector (prominent, at top) ── */}
      <div style={{ padding: '12px 14px', background: '#0f172a', borderRadius: 8, border: '2px solid #0d9488' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', marginBottom: 8, letterSpacing: '0.06em' }}>
          SELECT SURGERY TYPE — auto-fills all fields
        </div>
        <select
          value={surgeryKey}
          onChange={e => loadSurgery(e.target.value)}
          style={{
            width: '100%', fontSize: 13, fontWeight: 600,
            padding: '9px 12px', borderRadius: 7,
            border: '1px solid #0d9488', background: '#0a1628', color: '#f1f5f9',
            cursor: 'pointer',
          }}
        >
          <option value="">— Select procedure to auto-populate all fields —</option>
          {Array.from(new Set(SURGICAL_TEMPLATES.map(t => t.group))).map(g => (
            <optgroup key={g} label={g}>
              {SURGICAL_TEMPLATES.filter(t => t.group === g).map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {surgeryKey && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#10b981' }}>✓ Template loaded — all fields pre-filled. Edit below as needed.</span>
            <button type="button"
              onClick={() => { setSurgeryKey(''); onChange({ ...data, operativeSteps: '', findings: '', procedurePerformed: '' }); }}
              style={{ fontSize: 11, padding: '2px 10px', borderRadius: 5, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #99f6e4' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f766e', marginBottom: 6 }}>THEATRE TEAM</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Field label="Surgeon">
            <input type="text" value={data.surgeon} onChange={e => set('surgeon', e.target.value)}
              placeholder="Dr Kabiye" style={{ fontSize: 12 }} />
          </Field>
          <Field label="Assistant">
            <input type="text" value={data.assistant} onChange={e => set('assistant', e.target.value)}
              placeholder="Name / grade" style={{ fontSize: 12 }} />
          </Field>
          <Field label="Anaesthetist">
            <input type="text" value={data.anaesthetist} onChange={e => set('anaesthetist', e.target.value)}
              placeholder="Dr name" style={{ fontSize: 12 }} />
          </Field>
          <Field label="Scrub nurse">
            <input type="text" value={data.scrubNurse} onChange={e => set('scrubNurse', e.target.value)}
              placeholder="Name" style={{ fontSize: 12 }} />
          </Field>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="Procedure performed">
          <input type="text" value={data.procedurePerformed} onChange={e => set('procedurePerformed', e.target.value)}
            placeholder="Full operative name e.g. Laparoscopic cholecystectomy" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Approach">
          <SelectOpts chips={['Laparoscopic', 'Open', 'Converted to open', 'VATS', 'Robotic', 'Endoscopic']}
            value={data.approach} onChange={v => set('approach', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Anaesthesia">
          <SelectOpts chips={['GA', 'Spinal', 'Epidural', 'Regional block', 'MAC / sedation', 'Local only']}
            value={data.anaesthesiaType} onChange={v => set('anaesthesiaType', v)} />
        </Field>
        <Field label="Patient position">
          <SelectOpts chips={['Supine', 'Lloyd-Davies / lithotomy', 'Left lateral', 'Right lateral', 'Prone', 'Reverse Trendelenburg', 'Trendelenburg']}
            value={data.position} onChange={v => set('position', v)} />
        </Field>
        <Field label="Duration (minutes)">
          <input type="number" value={data.duration} onChange={e => set('duration', e.target.value)}
            placeholder="min" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Incision / port placement">
        <input type="text" value={data.incision} onChange={e => set('incision', e.target.value)}
          placeholder="e.g. 12mm umbilical Hasson port, two 5mm ports RUQ and epigastrium" style={{ fontSize: 12 }} />
      </Field>

      <Field label="Critical safety checks performed">
        <CheckList items={['WHO surgical safety checklist', 'Critical view of safety (CVS) confirmed', 'On-table cholangiogram', 'Correct site marking confirmed', 'Swab count correct ×2']}
          value={data.safetyChecks} onChange={v => set('safetyChecks', v)} />
      </Field>

      <Field label="Intraoperative imaging">
        <SelectOpts chips={['None used', 'Fluoroscopy (C-arm)', 'Intraoperative ultrasound', 'On-table cholangiogram', 'Laparoscopic ultrasound', 'ICG fluorescence']}
          value={data.intraopImaging} onChange={v => set('intraopImaging', v)} />
      </Field>

      <Field label="Key operative steps">
        <textarea value={data.operativeSteps} onChange={e => set('operativeSteps', e.target.value)}
          placeholder="Select a surgery type above to auto-fill, or type operative steps here…"
          style={{ fontSize: 12, minHeight: 160 }} />
      </Field>

      <Field label="Intraoperative findings">
        <textarea value={data.findings} onChange={e => set('findings', e.target.value)}
          placeholder="Key intraoperative findings…"
          style={{ fontSize: 12, minHeight: 70 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="EBL (mL)">
          <input type="text" value={data.ebl} onChange={e => set('ebl', e.target.value)}
            placeholder="e.g. Minimal / 200" style={{ fontSize: 12 }} />
        </Field>
        <Field label="IV fluid in">
          <input type="text" value={data.fluidIn} onChange={e => set('fluidIn', e.target.value)}
            placeholder="e.g. 1000 mL NaCl 0.9%" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Urine output (mL)">
          <input type="text" value={data.urineOut} onChange={e => set('urineOut', e.target.value)}
            placeholder="mL" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Specimen sent">
          <SelectOpts chips={['None', 'Yes — histopathology', 'Yes — microbiology', 'Yes — cytology']}
            value={data.specimenSent} onChange={v => set('specimenSent', v)} />
        </Field>
        <Field label="Specimen site / label">
          <input type="text" value={data.specimenSite} onChange={e => set('specimenSite', e.target.value)}
            placeholder="e.g. Gallbladder + contents" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Field label="Drain">
          <SelectOpts chips={['Not placed', 'Placed', 'Removed intra-op']}
            value={data.drain} onChange={v => set('drain', v)} />
        </Field>
        <Field label="Drain type">
          <SelectOpts chips={['Corrugated', 'Jackson-Pratt (JP)', 'Blake drain', 'T-tube', 'Chest drain', 'Pelvic drain', 'Nasobiliary']}
            value={data.drainType} onChange={v => set('drainType', v)} />
        </Field>
        <Field label="Drain site">
          <input type="text" value={data.drainSite} onChange={e => set('drainSite', e.target.value)}
            placeholder="e.g. RUQ through port site" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Wound closure">
          <SelectOpts chips={['Monocryl (subcuticular)', 'Vicryl + skin staples', 'Prolene (interrupted)', 'Clips', 'Glue', 'Wound left open', 'VAC dressing']}
            value={data.closure} onChange={v => set('closure', v)} />
        </Field>
        <Field label="Dressing">
          <input type="text" value={data.dressing} onChange={e => set('dressing', e.target.value)}
            placeholder="e.g. Mepilex / Tegaderm" style={{ fontSize: 12 }} />
        </Field>
      </div>

      <Field label="Post-operative orders">
        <CheckList items={['NPO until tolerated', 'Antibiotic therapy', 'DVT prophylaxis', 'IDC — strict I&O', 'Continuous monitoring', 'Physiotherapy', 'Wound review in 2 days', 'Remove drain day 1']}
          value={data.postopOrders} onChange={v => set('postopOrders', v)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Post-op diet">
          <SelectOpts chips={['NBM / NPO', 'Sips only', 'Free fluids', 'Light diet', 'Normal diet', 'TPN / Enteral feed']}
            value={data.diet} onChange={v => set('diet', v)} />
        </Field>
        <Field label="IV access">
          <SelectOpts chips={['PIV × 1', 'PIV × 2', 'PICC', 'Central (CVC)', 'Arterial line', 'None / removed']}
            value={data.ivAccess} onChange={v => set('ivAccess', v)} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Intraoperative complications">
          <SelectOpts chips={['None', 'Haemorrhage', 'Visceral injury', 'Conversion to open', 'Anaesthetic complication', 'Inadvertent organ damage']}
            value={data.complications} onChange={v => set('complications', v)} />
        </Field>
        <Field label="Additional operative notes">
          <textarea value={data.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
            placeholder="Any other intraoperative or post-op details…" style={{ fontSize: 12, minHeight: 60 }} />
        </Field>
      </div>
    </div>
  );
}

// ── Procedure PDF export ──────────────────────────────────────────────────────

function buildPreopSeed(
  comorbidities: string[],
  medications: string[],
  toxicHabits: string[],
  allergies: string,
  assessment: string,
  plan: string,
): PreopData {
  const cardiacRisk: string[] = [];
  for (const c of comorbidities) {
    if (/hypertension|high blood pressure/i.test(c)) cardiacRisk.push('Hypertension');
    if (/\bihd\b|ischaemic heart|angina/i.test(c)) cardiacRisk.push('IHD / angina');
    if (/\bmi\b|prior mi|infarct|myocardial infarct/i.test(c)) cardiacRisk.push('Prior MI');
    if (/\bccf\b|heart failure|cardiac failure|cardiomyopathy/i.test(c)) cardiacRisk.push('CCF');
    if (/arrhythmia|\baf\b|atrial fib|atrial flutter|\bsvt\b|\bvt\b|pacemaker/i.test(c)) cardiacRisk.push('Arrhythmia');
    if (/\bdiabetes\b|\bdm\b|type [12] diabetes/i.test(c)) cardiacRisk.push('Diabetes');
    if (/obesity|\bbmi\b|morbid obes/i.test(c)) cardiacRisk.push('Obesity (BMI >30)');
  }
  if (cardiacRisk.length === 0) cardiacRisk.push('None identified');

  const respiratoryRisk: string[] = [];
  for (const c of comorbidities) {
    if (/\basthma\b/i.test(c)) respiratoryRisk.push('Asthma');
    if (/\bcopd\b|emphysema|chronic obstructive/i.test(c)) respiratoryRisk.push('COPD');
    if (/\bosa\b|sleep apno|cpap|bipap/i.test(c)) respiratoryRisk.push('OSA / CPAP');
    if (/\bild\b|interstitial lung|pulmonary fibrosis/i.test(c)) respiratoryRisk.push('Interstitial lung disease');
  }
  for (const t of toxicHabits) {
    if (/smok/i.test(t)) respiratoryRisk.push('Smoker (active)');
  }
  if (respiratoryRisk.length === 0) respiratoryRisk.push('None identified');

  const serious = comorbidities.filter(c =>
    /\bihd\b|ischaemic heart|angina|\bmi\b|infarct|\bccf\b|heart failure|cardiomyopathy|\bcopd\b|emphysema|\bosa\b|sleep apno|arrhythmia|\baf\b|atrial fib|renal fail|\bckd\b|dialysis|cancer|malignancy|cirrhosis|\bstroke\b|\btia\b/i.test(c),
  );
  const asaGrade = serious.length >= 1 ? 'ASA III'
    : comorbidities.length === 0 && toxicHabits.length === 0 ? 'ASA I'
    : 'ASA II';

  const anticoagNames = ['warfarin', 'clopidogrel', 'rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban', 'ticagrelor', 'prasugrel', 'xarelto', 'eliquis', 'pradaxa', 'brilinta'];
  const prophylaxis: string[] = [];
  if (medications.some(m => anticoagNames.some(a => m.toLowerCase().includes(a)))) {
    prophylaxis.push('Anticoagulant held / bridged');
  }

  const procRegex = /laparoscop|cholecyst|appendicect|colectomy|gastrectomy|hernia repair|thyroidectomy|mastectomy|prostatectomy|colostomy|ileostomy|hemicolectomy|bowel resect|right hemi|left hemi|anterior resect|hartmann|whipple|pancreatectomy|splenectomy|adrenalectomy|parathyroid|fundoplication|heller|stoma|inguinal|umbilical|incisional|ventral|open repair|endoscopy|colonoscopy|\bogd\b|ercp|bronch/i;
  let plannedProcedure = '';
  for (const line of [...plan.split('\n'), ...assessment.split('\n')]) {
    if (procRegex.test(line)) {
      const clean = line.trim().replace(/^[-•*·]\s*/, '').replace(/^(?:plan|assessment|diagnosis)[:\s]+/i, '');
      if (clean.length > 3 && clean.length < 120) { plannedProcedure = clean; break; }
    }
  }

  const parts: string[] = [];
  if (allergies) parts.push(`ALLERGIES: ${allergies}`);
  const pmhLine = comorbidities.filter(c => !/^none$/i.test(c));
  if (pmhLine.length > 0) parts.push(`PMH: ${pmhLine.join(', ')}`);
  if (medications.length > 0) parts.push(`Medications: ${medications.join(', ')}`);

  return { ...EMPTY_PREOP, plannedProcedure, asaGrade, cardiacRisk, respiratoryRisk, prophylaxis, additionalNotes: parts.join('\n') };
}

function buildProcHtml(
  type: ProcType,
  ogd: OgdData, colon: ColonData, ercp: ErcpData, preop: PreopData, postop: PostopData,
  bronch: BronchData,
  freeText: string, patientName: string,
  draft: string,
  images: ProcImage[],
  dob?: string,
  nhiNumber?: string,
  allergies?: string,
): string {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const row = (label: string, val: string | string[]) => {
    const v = Array.isArray(val) ? val.join(', ') : val;
    if (!v) return '';
    return `<tr><td style="padding:4px 10px 4px 0;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0 4px 10px;color:#111">${v}</td></tr>`;
  };
  const section = (title: string, rows: string) =>
    `<h3 style="margin:16px 0 6px;font-size:13px;color:#0d9488;border-bottom:1px solid #d1fae5;padding-bottom:4px">${title}</h3><table style="border-collapse:collapse;width:100%;font-size:12px">${rows}</table>`;

  const letterhead = `<div style="border-bottom:2px solid #0d9488;margin-bottom:16px;padding-bottom:12px">
    <div style="font-size:16px;font-weight:700;color:#0d9488">Amise Medical Services</div>
    <div style="font-size:12px;color:#6b7280">Dr Dawit Daniel Kabiye, MD, DM | General &amp; Endoscopic Surgery | Saint Lucia</div>
  </div>`;

  const draftBlock = draft
    ? `<div style="margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
        <h3 style="margin:0 0 10px;font-size:13px;color:#0d9488">Narrative Report</h3>
        <div style="font-family:Georgia,serif;font-size:13px;line-height:1.8;white-space:pre-wrap;color:#111">${draft.replace(/</g, '&lt;')}</div>
      </div>` : '';

  const imageGrid = images.length > 0
    ? `<div style="margin-top:20px">
        <h3 style="margin:0 0 10px;font-size:13px;color:#0d9488;border-bottom:1px solid #d1fae5;padding-bottom:4px">ENDOSCOPIC / OPERATIVE IMAGES</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
          ${images.map((img, i) => `<div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
            <div style="position:relative;background:#0a0a0a">
              <img src="${img.dataUrl}" alt="${img.label || `Image ${i + 1}`}" style="width:100%;aspect-ratio:4/3;object-fit:contain;display:block" />
            </div>
            <div style="padding:4px 6px;font-size:10px">
              <div style="font-weight:700;color:#0d9488">${i + 1}. ${img.label || '—'}</div>
              ${img.finding ? `<div style="color:#374151;margin-top:2px">${img.finding.replace(/</g, '&lt;')}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>`
    : '';

  let structuredBody = '';
  if (type === 'postop') {
    structuredBody = section('Operative Details', [
      row('Procedure', postop.procedurePerformed),
      row('Approach', postop.approach),
      row('Anaesthesia', postop.anaesthesiaType),
      row('Duration', postop.duration ? `${postop.duration} min` : ''),
      row('Surgeon', postop.surgeon),
      row('Assistant', postop.assistant),
      row('Anaesthetist', postop.anaesthetist),
      row('Scrub nurse', postop.scrubNurse),
      row('Position', postop.position),
      row('Incision / access', postop.incision),
      row('Safety checks', postop.safetyChecks),
      row('Intraop imaging', postop.intraopImaging),
      row('Key steps', postop.operativeSteps),
      row('Findings', postop.findings),
      row('EBL', postop.ebl ? `${postop.ebl} mL` : ''),
      row('Fluid in', postop.fluidIn),
      row('Urine out', postop.urineOut ? `${postop.urineOut} mL` : ''),
      row('Specimen', postop.specimenSent + (postop.specimenSite ? ` — ${postop.specimenSite}` : '')),
      row('Drain', postop.drain + (postop.drainType ? ` (${postop.drainType})` : '') + (postop.drainSite ? `, ${postop.drainSite}` : '')),
      row('Wound closure', postop.closure),
      row('Dressing', postop.dressing),
      row('Post-op orders', postop.postopOrders),
      row('Complications', postop.complications),
      row('Notes', postop.additionalNotes),
    ].join(''));
  } else if (type === 'ogd') {
    structuredBody = section('Upper GI Endoscopy (OGD)', [
      row('Indication', ogd.indication),
      row('Instrument', ogd.instrument),
      row('Sedation', ogd.sedationType),
      row('Oesophagus', ogd.oesophagus),
      row('Stomach', ogd.stomach),
      row('Duodenum', ogd.duodenum),
      row('Biopsy', ogd.biopsy + (ogd.biopsySite ? ` — ${ogd.biopsySite}` : '')),
      row('CLO test', ogd.cloTest),
      row('Complications', ogd.complications),
      row('Notes', ogd.additionalNotes),
    ].join(''));
  } else if (type === 'colonoscopy') {
    structuredBody = section('Colonoscopy', [
      row('Indication', colon.indication),
      row('Instrument', colon.instrument),
      row('Bowel prep', colon.prepQuality),
      row('Sedation', colon.sedationType),
      row('Caecal intubation', colon.cecalIntubation),
      row('Time to caecum', colon.intubationTimeMin ? `${colon.intubationTimeMin} min` : ''),
      row('Withdrawal time', colon.withdrawalTimeMin ? `${colon.withdrawalTimeMin} min` : ''),
      row('Findings', colon.findings),
      row('Polyps', colon.polyps.length ? colon.polyps.map(p => `${p.site} — ${p.size}mm, ${p.morphology}, ${p.intervention}`).join('; ') : ''),
      row('Tattoo', colon.tattoo + (colon.tattooSite ? ` — ${colon.tattooSite}` : '')),
      row('Surveillance', colon.surveillanceInterval),
      row('Complications', colon.complications),
      row('Notes', colon.additionalNotes),
    ].join(''));
  } else if (type === 'ercp') {
    structuredBody = section('ERCP', [
      row('Indication', ercp.indication),
      row('Instrument', ercp.instrument),
      row('Sedation', ercp.sedationType),
      row('Papilla', ercp.papillaDescription),
      row('Cannulation', ercp.cannulation),
      row('CBD diameter', ercp.cbdDiameter ? `${ercp.cbdDiameter} mm` : ''),
      row('Cholangiogram', ercp.cholangiogramFindings),
      row('Pancreatogram', ercp.pancreatogramDone),
      row('Cholangioscopy', ercp.cholangioscopy),
      row('Sphincterotomy', ercp.sphincterotomy),
      row('Stone extraction', ercp.stoneExtraction && ercp.stoneExtraction !== 'Not applicable' ? `${ercp.stoneCount || ''} stone(s), max ${ercp.stoneSizeMm || ''}mm — ${ercp.stoneExtraction}` : ercp.stoneExtraction),
      row('Stent', ercp.stent === 'Yes' ? `${ercp.stentType} ${ercp.stentSizeFr}Fr ${ercp.stentLengthCm}cm` : ercp.stent),
      row('Biliary sweep', ercp.biliarySweep),
      row('Fluoroscopy', ercp.fluoroscopyTimeMin ? `${ercp.fluoroscopyTimeMin} min` : ''),
      row('Complications', ercp.complications),
      row('Notes', ercp.additionalNotes),
    ].join(''));
  } else if (type === 'preop') {
    structuredBody = section('Pre-operative Assessment', [
      row('Planned procedure', preop.plannedProcedure),
      row('Urgency', preop.urgency),
      row('ASA grade', preop.asaGrade),
      allergies ? `<tr><td style="padding:4px 10px 4px 0;font-weight:600;color:#dc2626;white-space:nowrap;vertical-align:top">&#9888; Allergies</td><td style="padding:4px 0 4px 10px;color:#dc2626;font-weight:600">${allergies.replace(/</g, '&lt;')}</td></tr>` : '',
      row('Airway', preop.airway),
      row('Dentition', preop.dentition),
      row('Cardiac risk', preop.cardiacRisk),
      row('Respiratory risk', preop.respiratoryRisk),
      row('Investigations', [preop.bloodsOk && `Bloods: ${preop.bloodsOk}`, preop.crossmatch && `X-match: ${preop.crossmatch}`, preop.ecg && `ECG: ${preop.ecg}`, preop.cxr && `CXR: ${preop.cxr}`, preop.imaging && `Imaging: ${preop.imaging}`].filter(Boolean).join(', ')),
      row('Consent', preop.consentObtained + (preop.consentNotes ? ` — ${preop.consentNotes}` : '')),
      row('Prophylaxis', preop.prophylaxis),
      row('Notes', preop.additionalNotes),
    ].join(''));
  } else if (type === 'bronch') {
    structuredBody = section('Bronchoscopy', [
      row('Indication', bronch.indication),
      row('Bronchoscope', bronch.bronchoscope),
      row('Sedation', bronch.sedationType),
      row('Vocal cords', bronch.vocalCords),
      row('Carina', bronch.carina),
      row('Right airways', bronch.rightAirways),
      row('Left airways', bronch.leftAirways),
      row('Overall findings', bronch.overallFindings),
      bronch.lesionDescription ? row('Lesion', bronch.lesionDescription) : '',
      row('BAL', bronch.bal + (bronch.balSite ? ` — ${bronch.balSite}` : '')),
      row('Biopsy', bronch.biopsy + (bronch.biopsySite ? ` — ${bronch.biopsySite}` : '')),
      row('Brushings', bronch.brushings),
      row('EBUS', bronch.ebus),
      row('Microbiology / specimens', bronch.microbiology),
      row('Complications', bronch.complications),
      row('Notes', bronch.additionalNotes),
    ].join(''));
  } else {
    structuredBody = `<p style="font-size:13px;white-space:pre-wrap">${freeText.replace(/</g, '&lt;')}</p>`;
  }

  const typeLabel: Record<ProcType, string> = {
    ogd: 'Upper GI Endoscopy (OGD)', colonoscopy: 'Colonoscopy', ercp: 'ERCP',
    bronch: 'Bronchoscopy',
    preop: 'Pre-operative Assessment', postop: 'Operative Note', other: 'Procedure Note',
  };

  const allergyBanner = allergies
    ? `<div style="margin:8px 0 12px;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;font-size:12px;font-weight:700;color:#dc2626">&#9888; ALLERGIES: ${allergies.replace(/</g, '&lt;')}</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel[type]}</title>
<style>
body{font-family:Arial,sans-serif;max-width:760px;margin:32px auto;color:#111;font-size:13px}
@media print{body{margin:16px}}
.sig-line{margin-top:48px;border-top:1px solid #374151;width:260px;padding-top:6px;font-size:11px;color:#6b7280}
</style></head><body>
${letterhead}
<h1 style="font-size:16px;margin:0 0 4px">${typeLabel[type]}</h1>
<div style="font-size:13px;color:#374151;margin:0 0 4px">
  <strong>${patientName}</strong>${dob ? ` &nbsp;&middot;&nbsp; DOB: ${dob}` : ''}${nhiNumber ? ` &nbsp;&middot;&nbsp; NHI: ${nhiNumber}` : ''} &nbsp;|&nbsp; <span style="color:#6b7280">${now}</span>
</div>
${allergyBanner}
${draftBlock || structuredBody}
${!draftBlock ? '' : `<details style="margin-top:16px"><summary style="font-size:11px;color:#94a3b8;cursor:pointer">Structured data</summary>${structuredBody}</details>`}
${imageGrid}
<div class="sig-line">Operating Surgeon</div>
<p style="margin-top:32px;font-size:10px;color:#9ca3af">Amise Medical Services · Dr Dawit Daniel Kabiye MD DM · ${now}${draft ? ' · AI-ASSISTED DRAFT — SURGEON APPROVED' : ''}</p>
</body></html>`;
}

function printProcNote(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
}

// ── Main component ────────────────────────────────────────────────────────────

const PROC_TABS: { id: ProcType; label: string }[] = [
  { id: 'ogd',         label: 'OGD' },
  { id: 'colonoscopy', label: 'Colonoscopy' },
  { id: 'ercp',        label: 'ERCP' },
  { id: 'bronch',      label: 'Bronchoscopy' },
  { id: 'preop',       label: 'Pre-op Assessment' },
  { id: 'postop',      label: 'Operative Note' },
  { id: 'other',       label: 'Other / Notes' },
];

export default function ProceduresTab() {
  const {
    procedureData, setProcedureData, procedures, setProcedures,
    patientName, age, sex, dob, nhiNumber, encounterType,
    comorbidities, medications, allergies: allergyText, assessment, plan, toxicHabits,
  } = useAppContext();
  const [activeType, setActiveType] = useState<ProcType>(encounterType === 'endoscopy' ? 'ogd' : 'preop');
  const preopSeededRef = useRef(false);

  useEffect(() => {
    setActiveType(encounterType === 'endoscopy' ? 'ogd' : 'preop');
  }, [encounterType]);

  useEffect(() => {
    if (activeType !== 'preop') return;
    if (preopSeededRef.current) return;
    const current = (procedureData['preop'] as PreopData | undefined) ?? EMPTY_PREOP;
    if (current.plannedProcedure !== '' || current.cardiacRisk.length > 0) return;
    preopSeededRef.current = true;
    const seed = buildPreopSeed(comorbidities, medications, toxicHabits ?? [], allergyText ?? '', assessment ?? '', plan ?? '');
    setProcedureData({ ...procedureData, preop: seed });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  const [draftLoading, setDraftLoading] = useState(false);

  function getTyped<T>(key: string, empty: T): T {
    return (procedureData[key] as T | undefined) ?? empty;
  }
  function setTyped<T>(key: string, val: T) {
    setProcedureData({ ...procedureData, [key]: val });
  }
  function getDraft(type: ProcType): string {
    return (procedureData[`${type}_draft`] as string | undefined) ?? '';
  }
  function setDraft(type: ProcType, text: string) {
    setProcedureData({ ...procedureData, [`${type}_draft`]: text });
  }
  function getImages(type: ProcType): ProcImage[] {
    return (procedureData[`${type}_images`] as ProcImage[] | undefined) ?? [];
  }
  function setImages(type: ProcType, imgs: ProcImage[]) {
    setProcedureData({ ...procedureData, [`${type}_images`]: imgs });
  }

  const ogd    = getTyped<OgdData>('ogd', EMPTY_OGD);
  const colon  = getTyped<ColonData>('colonoscopy', EMPTY_COLON);
  const ercp   = getTyped<ErcpData>('ercp', EMPTY_ERCP);
  const bronch = getTyped<BronchData>('bronch', EMPTY_BRONCH);
  const preop  = getTyped<PreopData>('preop', EMPTY_PREOP);
  const postop = getTyped<PostopData>('postop', EMPTY_POSTOP);

  async function generateDraft(type: ProcType) {
    const dataMap: Record<ProcType, unknown> = {
      ogd, colonoscopy: colon, ercp, bronch, preop, postop, other: {},
    };
    const imgs = getImages(type).map(img => ({ label: img.label, finding: img.finding }));
    setDraftLoading(true);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const resp = await fetch('/api/ai/procedure-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          type,
          data: dataMap[type],
          images: imgs.length > 0 ? imgs : undefined,
          patientName: patientName || 'Patient',
          patientAge: age || undefined,
          patientSex: sex !== 'unknown' ? sex : undefined,
          reportDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const json = await resp.json() as { success: boolean; report: string; error?: string };
      if (json.success) {
        setDraft(type, json.report);
      } else {
        alert(`Draft generation failed: ${json.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to generate report: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDraftLoading(false);
    }
  }

  const displayTabs = encounterType === 'endoscopy'
    ? PROC_TABS
    : [...PROC_TABS.filter(t => t.id === 'preop' || t.id === 'postop'), ...PROC_TABS.filter(t => t.id !== 'preop' && t.id !== 'postop')];

  return (
    <div className="gap-y">
      {/* Procedure type selector + print button */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {displayTabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveType(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: activeType === tab.id ? 700 : 500,
              border: activeType === tab.id ? '2px solid #0d9488' : '1px solid #d1d5db',
              background: activeType === tab.id ? '#0d9488' : '#fff',
              color: activeType === tab.id ? '#fff' : '#374151',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {getDraft(tab.id) && (
              <span style={{ background: activeType === tab.id ? 'rgba(255,255,255,0.3)' : '#d1fae5', color: activeType === tab.id ? '#fff' : '#065f46', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>
                Draft ✓
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => printProcNote(buildProcHtml(activeType, ogd, colon, ercp, preop, postop, bronch, procedures, patientName || 'Patient', getDraft(activeType), getImages(activeType), dob || undefined, nhiNumber || undefined, allergyText || undefined))}
          style={{
            marginLeft: 'auto',
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: '1px solid #0d9488', background: '#fff', color: '#0d9488', cursor: 'pointer',
          }}
        >
          🖨 Print / Export PDF
        </button>
      </div>

      {activeType === 'ogd' && (
        <CollapsibleCard title="Upper GI Endoscopy (OGD)">
          <DraftReportPanel hero
            procType="ogd" draft={getDraft('ogd')} loading={draftLoading}
            onGenerate={() => generateDraft('ogd')}
            onSave={text => setDraft('ogd', text)}
          />
          <ProcSection title="Clinical findings & structured data">
            <OgdForm data={ogd} onChange={d => setTyped('ogd', d)} />
          </ProcSection>
          <ProcSection title="Endoscopic images" defaultOpen={false} badge={getImages('ogd').length || undefined}>
            <ProcedureImagePanel
              images={getImages('ogd')} onChange={imgs => setImages('ogd', imgs)}
              title="OGD Images"
              siteLabels={['Lips / mouth', 'Oesophagus', 'GEJ / Z-line', 'Fundus', 'Body of stomach', 'Antrum', 'Pylorus', 'Duodenal bulb', 'D2 / papilla', 'Incisura angularis']}
            />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'colonoscopy' && (
        <CollapsibleCard title="Colonoscopy">
          <DraftReportPanel hero
            procType="colonoscopy" draft={getDraft('colonoscopy')} loading={draftLoading}
            onGenerate={() => generateDraft('colonoscopy')}
            onSave={text => setDraft('colonoscopy', text)}
          />
          <ProcSection title="Clinical findings & structured data">
            <ColonForm data={colon} onChange={d => setTyped('colonoscopy', d)} />
          </ProcSection>
          <ProcSection title="Colonoscopy images" defaultOpen={false} badge={getImages('colonoscopy').length || undefined}>
            <ProcedureImagePanel
              images={getImages('colonoscopy')} onChange={imgs => setImages('colonoscopy', imgs)}
              title="Colonoscopy Images"
              siteLabels={['Anus / rectum', 'Sigmoid colon', 'Descending colon', 'Splenic flexure', 'Transverse colon', 'Hepatic flexure', 'Ascending colon', 'Caecum', 'Ileocaecal valve', 'Terminal ileum', 'Polyp', 'Post-polypectomy site']}
            />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'ercp' && (
        <CollapsibleCard title="ERCP">
          <DraftReportPanel hero
            procType="ercp" draft={getDraft('ercp')} loading={draftLoading}
            onGenerate={() => generateDraft('ercp')}
            onSave={text => setDraft('ercp', text)}
          />
          <ProcSection title="Clinical findings & structured data">
            <ErcpForm data={ercp} onChange={d => setTyped('ercp', d)} />
          </ProcSection>
          <ProcSection title="ERCP images" defaultOpen={false} badge={getImages('ercp').length || undefined}>
            <ProcedureImagePanel
              images={getImages('ercp')} onChange={imgs => setImages('ercp', imgs)}
              title="ERCP Images"
              siteLabels={['Papilla', 'Post-sphincterotomy', 'Cholangiogram', 'CBD with stones', 'Stent in situ', 'Balloon trawl', 'Pancreatogram', 'Fluoroscopy frame', 'Cholangioscopy view']}
            />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'bronch' && (
        <CollapsibleCard title="Bronchoscopy">
          <DraftReportPanel hero
            procType="bronch" draft={getDraft('bronch')} loading={draftLoading}
            onGenerate={() => generateDraft('bronch')}
            onSave={text => setDraft('bronch', text)}
          />
          <ProcSection title="Clinical findings & structured data">
            <BronchForm data={bronch} onChange={d => setTyped('bronch', d)} />
          </ProcSection>
          <ProcSection title="Bronchoscopy images" defaultOpen={false} badge={getImages('bronch').length || undefined}>
            <ProcedureImagePanel
              images={getImages('bronch')} onChange={imgs => setImages('bronch', imgs)}
              title="Bronchoscopy Images"
              siteLabels={['Vocal cords', 'Subglottis / trachea', 'Carina', 'Right main bronchus', 'RUL bronchus', 'RML bronchus', 'RLL bronchus', 'Left main bronchus', 'LUL bronchus', 'Lingula', 'LLL bronchus', 'Lesion / mass', 'BAL site', 'Post-biopsy']}
            />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'preop' && (
        <CollapsibleCard title="Pre-operative Assessment">
          <ProcSection title="Assessment checklist">
            <PreopForm data={preop} onChange={d => setTyped('preop', d)} />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'postop' && (
        <CollapsibleCard title="Operative Note">
          <DraftReportPanel hero
            procType="postop" draft={getDraft('postop')} loading={draftLoading}
            onGenerate={() => generateDraft('postop')}
            onSave={text => setDraft('postop', text)}
          />
          <ProcSection title="Operative details & structured data">
            <PostopForm data={postop} onChange={d => setTyped('postop', d)} />
          </ProcSection>
          <ProcSection title="Operative images" defaultOpen={false} badge={getImages('postop').length || undefined}>
            <ProcedureImagePanel
              images={getImages('postop')} onChange={imgs => setImages('postop', imgs)}
              title="Operative / Laparoscopic Images"
              siteLabels={['Port placement', 'Initial findings', 'Dissection', 'Critical structure', 'Critical view of safety', 'Specimen', 'Haemostasis confirmed', 'Drain in situ', 'Port closure', 'Other']}
            />
          </ProcSection>
        </CollapsibleCard>
      )}

      {activeType === 'other' && (
        <>
          <CollapsibleCard title="Procedure Notes / Other">
            <div className="fld">
              <label>Free-text procedure notes</label>
              <textarea
                value={procedures}
                onChange={e => setProcedures(e.target.value)}
                placeholder="Any other procedure notes — consent, operator grade, planned procedures, complications…"
                style={{ minHeight: 160, fontSize: 13 }}
              />
            </div>
          </CollapsibleCard>
          <PathologySpecimenTracker />
          <ClavienDindoGrader />
        </>
      )}

      {(['ogd', 'colonoscopy', 'ercp', 'bronch'] as ProcType[]).includes(activeType) && (
        <EndoscopyReportGenerator type={activeType as 'ogd' | 'colonoscopy' | 'ercp' | 'bronch'} />
      )}
      <PostopCarePlan />
      <SurveillanceProtocolCard />
    </div>
  );
}
