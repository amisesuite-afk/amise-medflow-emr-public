import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ProcedureImagePanel, { type ProcImage } from '@/components/ProcedureImagePanel';
import ClavienDindoGrader from '@/components/ClavienDindoGrader';
import PathologySpecimenTracker from '@/components/PathologySpecimenTracker';
import OperativeNoteGenerator from '@/components/OperativeNoteGenerator';
import PostopCarePlan from '@/components/PostopCarePlan';
import EndoscopyReportGenerator from '@/components/EndoscopyReportGenerator';

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
  polyps: { site: string; size: string; morphology: string; intervention: string }[];
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

function ColonForm({ data, onChange }: { data: ColonData; onChange: (d: ColonData) => void }) {
  function set<K extends keyof ColonData>(k: K, v: ColonData[K]) { onChange({ ...data, [k]: v }); }
  function addPolyp() {
    set('polyps', [...data.polyps, { site: '', size: '', morphology: '', intervention: '' }]);
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
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr auto', gap: 6, marginBottom: 6, background: '#f9fafb', borderRadius: 6, padding: 8 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Tattoo">
          <SelectOpts chips={['Not required', 'Applied', 'Deferred']} value={data.tattoo} onChange={v => set('tattoo', v)} />
        </Field>
        <Field label="Tattoo site">
          <input type="text" value={data.tattooSite} onChange={e => set('tattooSite', e.target.value)}
            placeholder="e.g. 5 cm proximal to lesion, sigmoid colon" style={{ fontSize: 12 }} />
        </Field>
        <Field label="Surveillance recommendation">
          <SelectOpts chips={['No follow-up required', '1 year', '3 years', '5 years', '10 years', 'As per histopathology', 'Annual (IBD / high-risk)']}
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

function PostopForm({ data, onChange }: { data: PostopData; onChange: (d: PostopData) => void }) {
  function set<K extends keyof PostopData>(k: K, v: PostopData[K]) { onChange({ ...data, [k]: v }); }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
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
          placeholder="Describe key operative steps in sequence…"
          style={{ fontSize: 12, minHeight: 100 }} />
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

function buildProcHtml(
  type: ProcType,
  ogd: OgdData, colon: ColonData, ercp: ErcpData, preop: PreopData, postop: PostopData,
  bronch: BronchData,
  freeText: string, patientName: string,
  draft: string,
  images: ProcImage[],
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel[type]}</title>
<style>
body{font-family:Arial,sans-serif;max-width:760px;margin:32px auto;color:#111;font-size:13px}
@media print{body{margin:16px}}
.sig-line{margin-top:48px;border-top:1px solid #374151;width:260px;padding-top:6px;font-size:11px;color:#6b7280}
</style></head><body>
${letterhead}
<h1 style="font-size:16px;margin:0 0 4px">${typeLabel[type]}</h1>
<h2 style="font-size:13px;color:#6b7280;font-weight:400;margin:0 0 16px">${patientName} &nbsp;|&nbsp; ${now}</h2>
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
  const { procedureData, setProcedureData, procedures, setProcedures, patientName, age, sex } = useAppContext();
  const [activeType, setActiveType] = useState<ProcType>('ogd');
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
      const resp = await fetch('/api/ai/procedure-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="gap-y">
      {/* Procedure type selector + print button */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PROC_TABS.map(tab => (
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
          onClick={() => printProcNote(buildProcHtml(activeType, ogd, colon, ercp, preop, postop, bronch, procedures, patientName || 'Patient', getDraft(activeType), getImages(activeType)))}
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
      <OperativeNoteGenerator />
      <PostopCarePlan />
    </div>
  );
}
