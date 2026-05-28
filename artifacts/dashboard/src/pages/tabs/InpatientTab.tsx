import { useState, useId } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  wrapDoc, masthead, metaGrid, sec, kvTable, bulList, inlineText, callout, footer, signoff, escH as escHDoc, T,
} from './lib/docTemplate';
import { printDoc, saveBlobAsPDF } from './lib/pdfExport';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LabRow {
  test: string;
  result: string;
  flag: '' | 'H' | 'L' | 'N';  // H=high, L=low, N=normal
  reference: string;
  unit: string;
}
interface TrendRow {
  test: string;
  result1: string;
  result2: string;
  flag1: '' | 'H' | 'L' | 'N';
  flag2: '' | 'H' | 'L' | 'N';
  reference: string;
  unit: string;
}
interface ImagingRow { modality: string; region: string; date: string; findings: string; }
interface ProgressNote { date: string; author: string; type: 'SOAP' | 'Progress' | 'Ward Round'; note: string; }
interface MedRow { name: string; dose: string; route: string; frequency: string; }
interface ListItem { text: string; }

const DEFAULT_HAEM: LabRow[] = [
  { test: 'Haemoglobin',   result: '', flag: '', reference: 'M 13.5–17.5 / F 12.0–16.0', unit: 'g/dL' },
  { test: 'WBC',           result: '', flag: '', reference: '4.0–11.0', unit: '×10⁹/L' },
  { test: 'Platelets',     result: '', flag: '', reference: '150–400', unit: '×10⁹/L' },
  { test: 'Haematocrit',   result: '', flag: '', reference: 'M 40–52 / F 36–48', unit: '%' },
  { test: 'Neutrophils',   result: '', flag: '', reference: '2.0–7.5', unit: '×10⁹/L' },
  { test: 'Lymphocytes',   result: '', flag: '', reference: '1.0–4.5', unit: '×10⁹/L' },
];
const DEFAULT_LFT: TrendRow[] = [
  { test: 'ALT',        result1: '', result2: '', flag1: '', flag2: '', reference: '7–56',    unit: 'U/L' },
  { test: 'AST',        result1: '', result2: '', flag1: '', flag2: '', reference: '10–40',   unit: 'U/L' },
  { test: 'ALP',        result1: '', result2: '', flag1: '', flag2: '', reference: '44–147',  unit: 'U/L' },
  { test: 'GGT',        result1: '', result2: '', flag1: '', flag2: '', reference: '8–61',    unit: 'U/L' },
  { test: 'Bilirubin T',result1: '', result2: '', flag1: '', flag2: '', reference: '3–21',    unit: 'µmol/L' },
  { test: 'Bilirubin D',result1: '', result2: '', flag1: '', flag2: '', reference: '0–5',     unit: 'µmol/L' },
  { test: 'Albumin',    result1: '', result2: '', flag1: '', flag2: '', reference: '35–50',   unit: 'g/L' },
  { test: 'Total Protein', result1: '', result2: '', flag1: '', flag2: '', reference: '60–83', unit: 'g/L' },
];
const DEFAULT_TUMOUR: LabRow[] = [
  { test: 'CEA',    result: '', flag: '', reference: '<5.0',   unit: 'ng/mL' },
  { test: 'CA 19-9',result: '', flag: '', reference: '<37',    unit: 'U/mL' },
  { test: 'AFP',    result: '', flag: '', reference: '<8.1',   unit: 'ng/mL' },
  { test: 'CA 125', result: '', flag: '', reference: '<35',    unit: 'U/mL' },
  { test: 'PSA',    result: '', flag: '', reference: '<4.0',   unit: 'ng/mL' },
];
const DEFAULT_AMYLASE: LabRow[] = [
  { test: 'Amylase', result: '', flag: '', reference: '30–110', unit: 'U/L' },
  { test: 'Lipase',  result: '', flag: '', reference: '7–60',   unit: 'U/L' },
  { test: 'Glucose', result: '', flag: '', reference: '3.9–6.1',unit: 'mmol/L' },
  { test: 'Urea',    result: '', flag: '', reference: '2.5–7.8',unit: 'mmol/L' },
  { test: 'Creatinine', result: '', flag: '', reference: '62–115',unit: 'µmol/L' },
  { test: 'eGFR',    result: '', flag: '', reference: '>60',    unit: 'mL/min' },
  { test: 'Na⁺',     result: '', flag: '', reference: '136–145',unit: 'mmol/L' },
  { test: 'K⁺',      result: '', flag: '', reference: '3.5–5.0',unit: 'mmol/L' },
  { test: 'CRP',     result: '', flag: '', reference: '<5',     unit: 'mg/L' },
];

// ── Diagnostic algorithms ─────────────────────────────────────────────────────

interface DiagAlert { text: string; color: string; }

function runLabAlerts(haem: LabRow[], lft: TrendRow[], amylase: LabRow[], tumour: LabRow[]): DiagAlert[] {
  const alerts: DiagAlert[] = [];
  const getH = (rows: LabRow[], t: string) => rows.find(r => r.test === t);
  const getT = (rows: TrendRow[], t: string) => rows.find(r => r.test === t);
  const val = (v: string) => parseFloat(v);
  const hi = (r: LabRow | undefined) => r && r.result && (r.flag === 'H' || (r.result && !isNaN(val(r.result))));

  // Obstructive jaundice pattern
  const bili = getT(lft, 'Bilirubin T');
  const alp  = getT(lft, 'ALP');
  const alt  = getT(lft, 'ALT');
  if (bili && alp && bili.flag1 === 'H' && alp.flag1 === 'H') {
    alerts.push({ text: 'Obstructive pattern: ↑ Bilirubin + ↑ ALP — consider biliary obstruction, CBD stone, or cholangitis', color: '#854d0e' });
  }
  if (alt && alp && alt.flag1 === 'H' && alp.flag1 === 'H' && bili?.flag1 === 'H') {
    alerts.push({ text: 'Hepatocellular + cholestatic injury — consider hepatitis, drug-induced, or cholangiohepatitis', color: '#7c3aed' });
  }

  // Pancreatitis
  const amy = getH(amylase, 'Amylase');
  const lip = getH(amylase, 'Lipase');
  if ((amy && val(amy.result) > 200) || (lip && val(lip.result) > 120)) {
    alerts.push({ text: 'Markedly elevated amylase/lipase — pancreatitis likely; assess severity (Glasgow/Ranson)', color: '#b91c1c' });
  }

  // Sepsis/infection
  const crp = getH(amylase, 'CRP');
  const wbc = getH(haem, 'WBC');
  if (crp && val(crp.result) > 100 && wbc && (wbc.flag === 'H' || val(wbc.result) > 12)) {
    alerts.push({ text: '↑ CRP + leukocytosis — systemic inflammatory response; consider SIRS/sepsis criteria', color: '#9a3412' });
  }

  // Hypoalbuminaemia
  const alb = getT(lft, 'Albumin');
  if (alb && val(alb.result1) > 0 && val(alb.result1) < 30) {
    alerts.push({ text: 'Hypoalbuminaemia (< 30 g/L) — nutritional depletion, chronic liver disease, or protein-losing state', color: '#0369a1' });
  }

  // AKI
  const cr = getH(amylase, 'Creatinine');
  if (cr && val(cr.result) > 200) {
    alerts.push({ text: 'Elevated creatinine — possible AKI or CKD; review fluid status and nephrotoxic medications', color: '#7c3aed' });
  }

  // Elevated tumour marker
  const cea   = getH(tumour, 'CEA');
  const ca199 = getH(tumour, 'CA 19-9');
  if (cea && val(cea.result) > 10) alerts.push({ text: `CEA ${cea.result} ng/mL — elevated; consider colorectal, gastric, or pancreatic malignancy in context`, color: '#065f46' });
  if (ca199 && val(ca199.result) > 100) alerts.push({ text: `CA 19-9 ${ca199.result} U/mL — significantly elevated; consider pancreatobiliary malignancy or cholangitis`, color: '#065f46' });

  return alerts;
}

// ── Caribbean palette ─────────────────────────────────────────────────────────
// Navy #1a3a5c · Teal #0b7e72 · Sand #f5ede0 · Terracotta #c45c38 · Cream #fefcf8

const C = {
  navy:   '#1a3a5c',
  teal:   '#0b7e72',
  sand:   '#f5ede0',
  terra:  '#c45c38',
  cream:  '#fefcf8',
  muted:  '#6b7280',
};

// ── Shared styles ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  border: `1.5px solid #e2d9cf`,
  borderRadius: 10,
  overflow: 'hidden',
  marginBottom: 10,
};
const CARD_HDR = (accent: string): React.CSSProperties => ({
  background: accent,
  color: '#fff',
  padding: '7px 14px',
  fontSize: 11,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
const CARD_BODY: React.CSSProperties = {
  background: C.cream,
  padding: '10px 14px 12px',
};
const FLD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
};
const LBL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: C.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const INP: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '7px 10px',
  border: '1.5px solid #d6cfc8',
  borderRadius: 6,
  background: '#fff',
  outline: 'none',
  color: '#1a1a1a',
};
const TA: React.CSSProperties = {
  ...INP,
  resize: 'vertical',
  minHeight: 72,
  lineHeight: 1.55,
  fontFamily: 'inherit',
};
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' };
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 12px' };

// ── Flag indicator ────────────────────────────────────────────────────────────

function FlagBadge({ flag }: { flag: '' | 'H' | 'L' | 'N' }) {
  if (!flag || flag === 'N') return <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>→</span>;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
      background: flag === 'H' ? '#fee2e2' : '#eff6ff',
      color: flag === 'H' ? '#b91c1c' : '#1d4ed8',
    }}>
      {flag === 'H' ? '↑' : '↓'}
    </span>
  );
}

// ── Editable lab table (simple rows) ─────────────────────────────────────────

function LabTable({
  rows, onChange, accent,
}: { rows: LabRow[]; onChange: (rows: LabRow[]) => void; accent: string }) {
  function setRow(i: number, patch: Partial<LabRow>) {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  }
  function autoFlag(i: number, result: string) {
    const r = rows[i];
    if (!result || !r.reference) { setRow(i, { result, flag: '' }); return; }
    const v = parseFloat(result);
    if (!isFinite(v)) { setRow(i, { result, flag: 'N' }); return; }
    const m = r.reference.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
    if (!m) { setRow(i, { result, flag: 'N' }); return; }
    const lo = parseFloat(m[1]), hi = parseFloat(m[2]);
    const flag = v > hi ? 'H' : v < lo ? 'L' : 'N';
    setRow(i, { result, flag });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: accent + '18' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: accent, fontSize: 10.5, whiteSpace: 'nowrap' }}>Test</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: accent, fontSize: 10.5, width: 90 }}>Result</th>
            <th style={{ padding: '5px 4px', textAlign: 'center', width: 36 }}></th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: C.muted, fontSize: 10.5 }}>Reference</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: C.muted, fontSize: 10.5, width: 70 }}>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #ede8e2', background: r.flag === 'H' ? '#fff5f5' : r.flag === 'L' ? '#eff6ff' : undefined }}>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{r.test}</td>
              <td style={{ padding: '4px 8px' }}>
                <input
                  type="text"
                  value={r.result}
                  onChange={e => autoFlag(i, e.target.value)}
                  placeholder="—"
                  style={{ width: 80, fontSize: 12, padding: '3px 6px', border: '1px solid #d6cfc8', borderRadius: 4, background: '#fff' }}
                />
              </td>
              <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                <FlagBadge flag={r.flag} />
              </td>
              <td style={{ padding: '4px 8px', fontSize: 11, color: C.muted }}>{r.reference}</td>
              <td style={{ padding: '4px 8px', fontSize: 11, color: C.muted }}>{r.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Editable trend table (2 time-points) ─────────────────────────────────────

function TrendTable({
  rows, onChange, accent, label1, label2,
}: { rows: TrendRow[]; onChange: (rows: TrendRow[]) => void; accent: string; label1: string; label2: string }) {
  function setRow(i: number, patch: Partial<TrendRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function autoFlag(i: number, which: 1 | 2, result: string) {
    const r = rows[i];
    const v = parseFloat(result);
    let flag: '' | 'H' | 'L' | 'N' = '';
    if (result && r.reference) {
      const m = r.reference.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
      if (m && isFinite(v)) {
        const lo = parseFloat(m[1]), hi = parseFloat(m[2]);
        flag = v > hi ? 'H' : v < lo ? 'L' : 'N';
      } else if (result) flag = 'N';
    }
    if (which === 1) setRow(i, { result1: result, flag1: flag });
    else             setRow(i, { result2: result, flag2: flag });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: accent + '18' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: accent, fontSize: 10.5 }}>Test</th>
            <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: accent, fontSize: 10.5, width: 100 }}>{label1}</th>
            <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: accent, fontSize: 10.5, width: 100 }}>{label2}</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: C.muted, fontSize: 10.5 }}>Reference</th>
            <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: C.muted, fontSize: 10.5, width: 70 }}>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #ede8e2' }}>
              <td style={{ padding: '4px 8px', fontWeight: 600 }}>{r.test}</td>
              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <input
                    type="text"
                    value={r.result1}
                    onChange={e => autoFlag(i, 1, e.target.value)}
                    placeholder="—"
                    style={{ width: 60, fontSize: 12, padding: '3px 6px', border: '1px solid #d6cfc8', borderRadius: 4, background: r.flag1 === 'H' ? '#fff5f5' : r.flag1 === 'L' ? '#eff6ff' : '#fff' }}
                  />
                  {r.flag1 && <FlagBadge flag={r.flag1} />}
                </span>
              </td>
              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <input
                    type="text"
                    value={r.result2}
                    onChange={e => autoFlag(i, 2, e.target.value)}
                    placeholder="—"
                    style={{ width: 60, fontSize: 12, padding: '3px 6px', border: '1px solid #d6cfc8', borderRadius: 4, background: r.flag2 === 'H' ? '#fff5f5' : r.flag2 === 'L' ? '#eff6ff' : '#fff' }}
                  />
                  {r.flag2 && <FlagBadge flag={r.flag2} />}
                </span>
              </td>
              <td style={{ padding: '4px 8px', fontSize: 11, color: C.muted }}>{r.reference}</td>
              <td style={{ padding: '4px 8px', fontSize: 11, color: C.muted }}>{r.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Collapsible section card ──────────────────────────────────────────────────

function Sec({
  title, accent = C.navy, children, defaultOpen = true,
  action,
}: {
  title: string; accent?: string; children: React.ReactNode;
  defaultOpen?: boolean; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={CARD}>
      <div style={CARD_HDR(accent)}>
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          <span style={{ fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', display: 'inline-block' }}>▾</span>
          {title}
        </button>
        {action && <div>{action}</div>}
      </div>
      {open && <div style={CARD_BODY}>{children}</div>}
    </div>
  );
}

// ── Editable list (bullet items) ──────────────────────────────────────────────

function EditList({
  items, onChange, placeholder,
}: { items: ListItem[]; onChange: (v: ListItem[]) => void; placeholder?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: C.teal, fontWeight: 700, fontSize: 14 }}>•</span>
          <input
            type="text"
            value={item.text}
            onChange={e => onChange(items.map((it, idx) => idx === i ? { text: e.target.value } : it))}
            placeholder={placeholder}
            style={{ ...INP, flex: 1 }}
          />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
      ))}
      <button type="button"
        onClick={() => onChange([...items, { text: '' }])}
        style={{ alignSelf: 'flex-start', background: 'none', border: `1px dashed ${C.teal}`, color: C.teal, borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
        + Add
      </button>
    </div>
  );
}

// ── Medication row editor ─────────────────────────────────────────────────────

function MedTable({ rows, onChange }: { rows: MedRow[]; onChange: (r: MedRow[]) => void }) {
  function setRow(i: number, patch: Partial<MedRow>) {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr auto', gap: 6, alignItems: 'center' }}>
          <input type="text" value={row.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Drug name" style={{ ...INP, fontSize: 12 }} />
          <input type="text" value={row.dose} onChange={e => setRow(i, { dose: e.target.value })} placeholder="Dose" style={{ ...INP, fontSize: 12 }} />
          <input type="text" value={row.route} onChange={e => setRow(i, { route: e.target.value })} placeholder="Route" style={{ ...INP, fontSize: 12 }} />
          <input type="text" value={row.frequency} onChange={e => setRow(i, { frequency: e.target.value })} placeholder="Frequency" style={{ ...INP, fontSize: 12 }} />
          <button type="button" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr', gap: 6, marginBottom: 4 }}>
        {['Drug name', 'Dose', 'Route', 'Frequency'].map(l => (
          <span key={l} style={{ fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{l}</span>
        ))}
      </div>
      <button type="button"
        onClick={() => onChange([...rows, { name: '', dose: '', route: '', frequency: '' }])}
        style={{ alignSelf: 'flex-start', background: 'none', border: `1px dashed ${C.teal}`, color: C.teal, borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
        + Add medication
      </button>
    </div>
  );
}

// ── Print helpers ─────────────────────────────────────────────────────────────

// escH is imported from docTemplate as escHDoc — alias for local use
const escH = escHDoc;

const LOGO_SVG = `<svg width="120" height="42" viewBox="0 0 150 52" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="15" cy="11" rx="6.5" ry="7.5" fill="#0B2545"/>
  <path d="M8.5 19 C7 28 8 37 14 41 C17.5 43 21 41 21 38 C17.5 36 14.5 31 14.5 24.5 C14.5 20.5 16.5 19.5 18.5 19 C14 17 8.5 17.5 8.5 19Z" fill="#0B2545"/>
  <ellipse cx="29" cy="11" rx="6.5" ry="7.5" fill="#922b21"/>
  <path d="M35.5 19 C37 28 36 37 30 41 C26.5 43 23 41 23 38 C26.5 36 29.5 31 29.5 24.5 C29.5 20.5 27.5 19.5 25.5 19 C30 17 35.5 17.5 35.5 19Z" fill="#922b21"/>
  <line x1="48" y1="6" x2="48" y2="46" stroke="#ddd" stroke-width="1"/>
  <text x="56" y="24" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="bold" fill="#0B2545" letter-spacing="1.2">AMISE</text>
  <text x="56" y="37" font-family="Arial,Helvetica,sans-serif" font-size="7.5" fill="#666" letter-spacing="2.5">MEDICAL SERVICES</text>
  <text x="56" y="47" font-family="Arial,Helvetica,sans-serif" font-size="6.5" fill="#999" letter-spacing="0.5">Saint Lucia</text>
</svg>`;

interface PrintState {
  mrNumber: string; bloodGroup: string;
  nokName: string; nokRelation: string; nokTel: string; insurance: string;
  admittingSurgeon: string; referringPhysician: string;
  dateAdmission: string; dateDischarge: string; ward: string;
  primaryDx: ListItem[]; backgroundDx: ListItem[]; pendingInv: ListItem[];
  historyProse: string;
  haem: LabRow[]; lft: TrendRow[]; tumour: LabRow[]; amylase: LabRow[];
  imaging: ImagingRow[];
  procedureDate: string; operator: string; instrument: string; anaesthesia: string;
  indication: string; procedureNarrative: string; dischargeDx: string;
  complications: string; postProcCourse: string;
  followupHeading: string; followupBody: string;
  medications: MedRow[]; lifestyle: ListItem[]; followupPlan: ListItem[]; redFlags: ListItem[];
  signoffName: string; signoffRole: string; signoffContact: string; signoffDate: string;
  progressNotes: ProgressNote[];
  lftLabel1: string; lftLabel2: string;
}

const SITE_INFO: Record<string, { name: string; address: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay' },
  castries:   { name: 'Castries Office',   address: 'Castries, Saint Lucia' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia' },
};

function buildInpatientHtml(st: PrintState, ctx: ReturnType<typeof useAppContext>): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
  const los = (st.dateAdmission && st.dateDischarge)
    ? (() => { const d = Math.round((new Date(st.dateDischarge).getTime() - new Date(st.dateAdmission).getTime()) / 86_400_000); return d >= 0 ? `${d} day${d === 1 ? '' : 's'}` : ''; })()
    : '';
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');

  // ── Lab table renderers (spec: no filled header bar; hairline rows) ──
  const flagMark = (f: '' | 'H' | 'L' | 'N', v: string) =>
    !v ? '' : f === 'H' ? `<span style="color:#b91c1c;font-weight:800"> ↑</span>`
            : f === 'L' ? `<span style="color:#1d4ed8;font-weight:800"> ↓</span>`
            : `<span style="color:#16a34a"> →</span>`;

  const labTbl = (rows: LabRow[]): string => {
    const filled = rows.filter(r => r.result);
    if (!filled.length) return `<p style="color:${T.mute};font-size:10px;font-style:italic;margin:4px 0">No results recorded</p>`;
    return `<table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <tr><th style="text-align:left;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 6px 3px 0;border-bottom:.5pt solid #E5E7EB">Test</th>
          <th style="text-align:right;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">Result</th>
          <th style="font-size:9.5px;font-weight:700;color:${T.mute};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">Reference</th>
          <th style="font-size:9.5px;font-weight:700;color:${T.mute};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">Unit</th></tr>
      ${filled.map(r => `<tr style="border-top:.25pt solid #E5E7EB">
        <td style="padding:3px 6px 3px 0;font-weight:600;color:${T.ink}">${escH(r.test)}</td>
        <td style="padding:3px 6px;text-align:right;font-weight:700;color:${T.ink}">${escH(r.result)}${flagMark(r.flag, r.result)}</td>
        <td style="padding:3px 6px;color:${T.mute}">${escH(r.reference)}</td>
        <td style="padding:3px 6px;color:${T.mute}">${escH(r.unit)}</td>
      </tr>`).join('')}
    </table>`;
  };

  const trendTbl = (rows: TrendRow[], l1: string, l2: string): string => {
    const filled = rows.filter(r => r.result1 || r.result2);
    if (!filled.length) return `<p style="color:${T.mute};font-size:10px;font-style:italic;margin:4px 0">No results recorded</p>`;
    return `<table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <tr><th style="text-align:left;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 6px 3px 0;border-bottom:.5pt solid #E5E7EB">Test</th>
          <th style="text-align:right;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">${escH(l1)}</th>
          <th style="text-align:right;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">${escH(l2)}</th>
          <th style="font-size:9.5px;font-weight:700;color:${T.mute};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">Reference</th>
          <th style="font-size:9.5px;font-weight:700;color:${T.mute};padding:3px 6px;border-bottom:.5pt solid #E5E7EB">Unit</th></tr>
      ${filled.map(r => `<tr style="border-top:.25pt solid #E5E7EB">
        <td style="padding:3px 6px 3px 0;font-weight:600;color:${T.ink}">${escH(r.test)}</td>
        <td style="padding:3px 6px;text-align:right;font-weight:700;color:${T.ink}">${escH(r.result1)}${flagMark(r.flag1, r.result1)}</td>
        <td style="padding:3px 6px;text-align:right;font-weight:700;color:${T.ink}">${escH(r.result2)}${flagMark(r.flag2, r.result2)}</td>
        <td style="padding:3px 6px;color:${T.mute}">${escH(r.reference)}</td>
        <td style="padding:3px 6px;color:${T.mute}">${escH(r.unit)}</td>
      </tr>`).join('')}
    </table>`;
  };

  // ── Algorithm alerts → gold-border callout ──
  const alerts = runLabAlerts(st.haem, st.lft, st.amylase, st.tumour);
  const alertHtml = alerts.length
    ? callout('Clinical algorithm alerts', alerts.map(a => `<p style="margin:2px 0;font-size:10.5px;color:${T.ink}">⚑ ${escH(a.text)}</p>`).join(''))
    : '';

  // ── Medications table ──
  const medRows = st.medications.filter(m => m.name);
  const medTbl = medRows.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <tr><th style="text-align:left;font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 8px 3px 0;border-bottom:.5pt solid #E5E7EB">Drug</th>
            <th style="font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 8px;border-bottom:.5pt solid #E5E7EB">Dose</th>
            <th style="font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 8px;border-bottom:.5pt solid #E5E7EB">Route</th>
            <th style="font-size:9.5px;font-weight:700;color:${T.navy};padding:3px 8px;border-bottom:.5pt solid #E5E7EB">Frequency</th></tr>
        ${medRows.map(m => `<tr style="border-top:.25pt solid #E5E7EB">
          <td style="padding:3px 8px 3px 0;font-weight:600">${escH(m.name)}</td>
          <td style="padding:3px 8px;color:${T.ink}">${escH(m.dose)}</td>
          <td style="padding:3px 8px;color:${T.ink}">${escH(m.route)}</td>
          <td style="padding:3px 8px;color:${T.ink}">${escH(m.frequency)}</td>
        </tr>`).join('')}
      </table>`
    : '';

  const meta = metaGrid([
    { label: 'Patient',           value: ctx.patientName || '—', sub: ageLine || undefined },
    { label: 'MR Number',         value: st.mrNumber || '—', sub: ctx.dob ? `DOB: ${ctx.dob}` : undefined },
    { label: 'Blood group',       value: st.bloodGroup || '—', sub: st.insurance || undefined },
    { label: 'Ward / Unit',       value: st.ward || '—', sub: los ? `LOS: ${los}` : undefined },
    { label: 'Admission',         value: st.dateAdmission || '—' },
    { label: 'Discharge',         value: st.dateDischarge || '—' },
    { label: 'Admitting surgeon', value: st.admittingSurgeon || 'Dr Dawit Daniel Kabiye, MD, DM' },
    { label: 'Referring physician', value: st.referringPhysician || '—' },
    ...(st.nokName ? [{ label: 'Next of kin', value: st.nokName, sub: [st.nokRelation, st.nokTel].filter(Boolean).join(' · ') }] : []),
  ]);

  const pxDx = st.primaryDx.filter(d => d.text);
  const bgDx = st.backgroundDx.filter(d => d.text);
  const pending = st.pendingInv.filter(d => d.text);

  let body = masthead('Inpatient / Procedural Discharge Summary', site.name, site.address, now, LOGO_SVG);
  body += meta;

  if (pxDx.length) body += sec('Primary diagnosis', pxDx.map(d => `<p style="font-weight:700;font-size:11px;margin:1px 0">${escH(d.text)}</p>`).join(''));
  if (bgDx.length)  body += sec('Background diagnoses', bulList(bgDx.map(d => d.text)));
  if (st.historyProse) body += sec('Clinical history', inlineText(st.historyProse));

  body += sec('Investigations — haematology', labTbl(st.haem));
  body += sec(`Investigations — liver function (${escH(st.lftLabel1 || 'Day 1')} vs ${escH(st.lftLabel2 || 'Day 2')})`, trendTbl(st.lft, st.lftLabel1 || 'Day 1', st.lftLabel2 || 'Day 2'));
  if (st.amylase.some(r => r.result)) body += sec('Investigations — metabolic / renal / inflammatory', labTbl(st.amylase));
  if (st.tumour.some(r => r.result))  body += sec('Investigations — tumour markers', labTbl(st.tumour));

  if (st.imaging.filter(r => r.findings).length) {
    body += sec('Imaging', st.imaging.filter(r => r.findings).map(r =>
      `<p style="margin:3px 0"><strong>${escH(r.modality)}${r.region ? ` — ${escH(r.region)}` : ''}${r.date ? ` (${escH(r.date)})` : ''}:</strong> ${escH(r.findings)}</p>`
    ).join(''));
  }

  body += alertHtml;

  if (st.procedureNarrative || st.procedureDate) {
    const procMeta = kvTable([
      ['Date', st.procedureDate], ['Operator', st.operator],
      ['Instrument', st.instrument], ['Anaesthesia', st.anaesthesia],
      ['Indication', st.indication], ['Discharge diagnosis', st.dischargeDx],
    ]);
    body += sec('Operative / procedural record',
      procMeta +
      (st.procedureNarrative ? `<div style="margin-top:6px">${inlineText(st.procedureNarrative)}</div>` : '') +
      (st.complications ? `<p style="margin-top:4px"><strong>Complications:</strong> ${escH(st.complications)}</p>` : '') +
      (st.postProcCourse ? `<div style="margin-top:4px">${inlineText(st.postProcCourse)}</div>` : '')
    );
  }

  if (medTbl) body += sec('Medications on discharge', medTbl);

  if (st.followupHeading || st.followupBody) {
    body += callout(st.followupHeading || 'Follow-up', `<p style="font-size:10.5px">${escH(st.followupBody)}</p>`);
  }

  if (st.lifestyle.filter(l => l.text).length) body += sec('Lifestyle advice', bulList(st.lifestyle.map(l => l.text)));
  if (st.followupPlan.filter(l => l.text).length) body += sec('Follow-up plan', bulList(st.followupPlan.map(l => l.text)));
  if (st.redFlags.filter(l => l.text).length) body += callout('Return immediately if any of the following occur', bulList(st.redFlags.map(l => l.text)));
  if (pending.length) body += sec('Pending investigations', bulList(pending.map(d => d.text)));

  body += signoff(
    st.signoffName || 'Dr Dawit Daniel Kabiye, MD, DM',
    st.signoffRole || 'General & Endoscopic Surgery · Amise Medical Services',
    `${st.signoffContact || site.name + ' · 1 (758) 720 7111'}   Date: ${st.signoffDate || '..................'}`,
  );
  body += footer('Prepared from clinical data recorded at the time of admission and discharge. Please verify all details before acting on this summary.');

  return wrapDoc(`Inpatient Summary — ${ctx.patientName || 'Patient'}`, body);
}



// ── Main component ────────────────────────────────────────────────────────────

export default function InpatientTab() {
  const ctx = useAppContext();
  const uid = useId();

  // Patient extras
  const [mrNumber, setMrNumber] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [nokName, setNokName] = useState('');
  const [nokRelation, setNokRelation] = useState('');
  const [nokTel, setNokTel] = useState('');
  const [insurance, setInsurance] = useState('');
  const [admittingSurgeon, setAdmittingSurgeon] = useState('Dr. Dawit D Kabiye');
  const [referringPhysician, setReferringPhysician] = useState('');
  const [dateAdmission, setDateAdmission] = useState('');
  const [dateDischarge, setDateDischarge] = useState('');
  const [ward, setWard] = useState('');

  // Diagnoses
  const [primaryDx, setPrimaryDx] = useState<ListItem[]>([{ text: '' }]);
  const [backgroundDx, setBackgroundDx] = useState<ListItem[]>([{ text: '' }]);
  const [pendingInv, setPendingInv] = useState<ListItem[]>([{ text: '' }]);
  const [historyProse, setHistoryProse] = useState('');

  // Labs
  const [haem, setHaem] = useState<LabRow[]>(DEFAULT_HAEM);
  const [lft, setLft] = useState<TrendRow[]>(DEFAULT_LFT);
  const [lftLabel1, setLftLabel1] = useState('Admission');
  const [lftLabel2, setLftLabel2] = useState('Day 3');
  const [tumour, setTumour] = useState<LabRow[]>(DEFAULT_TUMOUR);
  const [amylase, setAmylase] = useState<LabRow[]>(DEFAULT_AMYLASE);
  const [imaging, setImaging] = useState<ImagingRow[]>([
    { modality: '', region: '', date: '', findings: '' },
  ]);

  // Procedure
  const [procedureDate, setProcedureDate] = useState('');
  const [operator, setOperator] = useState('Dr. Dawit D Kabiye');
  const [instrument, setInstrument] = useState('');
  const [anaesthesia, setAnaesthesia] = useState('');
  const [indication, setIndication] = useState('');
  const [procedureNarrative, setProcedureNarrative] = useState('');
  const [dischargeDx, setDischargeDx] = useState('');
  const [complications, setComplications] = useState('');
  const [postProcCourse, setPostProcCourse] = useState('');

  // Follow-up callout
  const [followupHeading, setFollowupHeading] = useState('Follow-up Appointment');
  const [followupBody, setFollowupBody] = useState('');

  // Discharge
  const [medications, setMedications] = useState<MedRow[]>([{ name: '', dose: '', route: '', frequency: '' }]);
  const [lifestyle, setLifestyle] = useState<ListItem[]>([{ text: '' }]);
  const [followupPlan, setFollowupPlan] = useState<ListItem[]>([{ text: '' }]);
  const [redFlags, setRedFlags] = useState<ListItem[]>([{ text: 'Fever > 38.5 °C' }, { text: 'Increasing pain or distension' }, { text: 'Wound breakdown or discharge' }]);

  // Sign-off
  const [signoffName, setSignoffName] = useState('Dr. Dawit D Kabiye');
  const [signoffRole, setSignoffRole] = useState('MD, DM · General & Endoscopic Surgery');
  const [signoffContact, setSignoffContact] = useState('');
  const [signoffDate, setSignoffDate] = useState('');

  // Progress notes
  const [progressNotes, setProgressNotes] = useState<ProgressNote[]>([]);
  const [noteType, setNoteType] = useState<'SOAP' | 'Progress' | 'Ward Round'>('SOAP');
  const [noteText, setNoteText] = useState('');

  const los = (dateAdmission && dateDischarge)
    ? (() => { const d = Math.round((new Date(dateDischarge).getTime() - new Date(dateAdmission).getTime()) / 86_400_000); return d >= 0 ? `${d} day${d === 1 ? '' : 's'}` : ''; })()
    : '';

  const alerts = runLabAlerts(haem, lft, amylase, tumour);

  function getState(): PrintState {
    return {
      mrNumber, bloodGroup, nokName, nokRelation, nokTel, insurance,
      admittingSurgeon, referringPhysician, dateAdmission, dateDischarge, ward,
      primaryDx, backgroundDx, pendingInv, historyProse,
      haem, lft, tumour, amylase, imaging,
      procedureDate, operator, instrument, anaesthesia, indication,
      procedureNarrative, dischargeDx, complications, postProcCourse,
      followupHeading, followupBody,
      medications, lifestyle, followupPlan, redFlags,
      signoffName, signoffRole, signoffContact, signoffDate,
      progressNotes, lftLabel1, lftLabel2,
    };
  }

  const BTN: React.CSSProperties = { padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: `2px solid ${C.teal}`, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 16 }}>🏥</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.navy }}>Inpatient / Procedural Summary</span>
          {los && <span style={{ background: C.teal, color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>LOS {los}</span>}
        </div>
        <button type="button" style={{ ...BTN, background: C.navy, color: '#fff' }}
          onClick={() => printDoc(buildInpatientHtml(getState(), ctx))}>
          🖨 Print
        </button>
        <button type="button" style={{ ...BTN, background: C.teal, color: '#fff' }}
          onClick={() => void saveBlobAsPDF(buildInpatientHtml(getState(), ctx), `AmiseSuite_${ctx.patientName || 'Report'}.pdf`)}>
          ↓ PDF
        </button>
      </div>

      {/* Algorithm alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ background: a.color + '12', border: `1px solid ${a.color}40`, borderRadius: 7, padding: '8px 12px', fontSize: 12, color: a.color, fontWeight: 600 }}>
              ⚑ {a.text}
            </div>
          ))}
        </div>
      )}

      {/* 1. Patient header */}
      <Sec title="Patient Details" accent={C.navy}>
        <div style={{ ...GRID3, marginBottom: 8 }}>
          <div style={FLD}><label style={LBL} htmlFor={uid+'mr'}>MR Number</label><input id={uid+'mr'} style={INP} value={mrNumber} onChange={e => setMrNumber(e.target.value)} placeholder="MR-2024-001" /></div>
          <div style={FLD}><label style={LBL}>Patient Name</label><input style={{ ...INP, background: '#f3f4f6' }} value={ctx.patientName} readOnly /></div>
          <div style={FLD}><label style={LBL}>Age / Sex / DOB</label><input style={{ ...INP, background: '#f3f4f6' }} value={[ctx.age ? ctx.age + ' yrs' : '', ctx.sex !== 'unknown' ? ctx.sex : '', ctx.dob].filter(Boolean).join(' · ')} readOnly /></div>
          <div style={FLD}><label style={LBL}>Blood Group</label>
            <select style={{ ...INP }} value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
              <option value="">— select —</option>
              {['A+','A−','B+','B−','AB+','AB−','O+','O−'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={FLD}><label style={LBL}>Insurance</label><input style={INP} value={insurance} onChange={e => setInsurance(e.target.value)} placeholder="CLICO / GEL / Self-pay" /></div>
          <div style={FLD}><label style={LBL}>Ward / Unit</label><input style={INP} value={ward} onChange={e => setWard(e.target.value)} placeholder="Surgical Ward B" /></div>
          <div style={FLD}><label style={LBL}>Date Admission</label><input type="date" style={INP} value={dateAdmission} onChange={e => setDateAdmission(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Date Discharge</label><input type="date" style={INP} value={dateDischarge} onChange={e => setDateDischarge(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Length of Stay</label><input style={{ ...INP, background: '#f3f4f6' }} readOnly value={los || '—'} /></div>
          <div style={FLD}><label style={LBL}>Admitting Surgeon</label><input style={INP} value={admittingSurgeon} onChange={e => setAdmittingSurgeon(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Referring Physician</label><input style={INP} value={referringPhysician} onChange={e => setReferringPhysician(e.target.value)} /></div>
        </div>
        <div style={GRID3}>
          <div style={FLD}><label style={LBL}>Next of Kin</label><input style={INP} value={nokName} onChange={e => setNokName(e.target.value)} placeholder="Full name" /></div>
          <div style={FLD}><label style={LBL}>Relationship</label><input style={INP} value={nokRelation} onChange={e => setNokRelation(e.target.value)} placeholder="Spouse / Child / Sibling" /></div>
          <div style={FLD}><label style={LBL}>NOK Contact</label><input style={INP} value={nokTel} onChange={e => setNokTel(e.target.value)} placeholder="+1 758 …" /></div>
        </div>
      </Sec>

      {/* 2. Diagnoses */}
      <Sec title="Diagnoses & History" accent={C.teal}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...LBL, marginBottom: 6 }}>Primary Diagnosis</div>
          <EditList items={primaryDx} onChange={setPrimaryDx} placeholder="Enter primary diagnosis (+ ICD-10 if available)" />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...LBL, marginBottom: 6 }}>Background / Co-morbid Diagnoses</div>
          <EditList items={backgroundDx} onChange={setBackgroundDx} placeholder="Co-morbidity" />
        </div>
        <div style={FLD}>
          <label style={LBL}>History of Presenting Illness</label>
          <textarea style={TA} value={historyProse} onChange={e => setHistoryProse(e.target.value)} placeholder="Onset, character, duration, associated symptoms, relevant background…" />
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ ...LBL, marginBottom: 6 }}>Pending Investigations</div>
          <EditList items={pendingInv} onChange={setPendingInv} placeholder="e.g. CT abdomen / histology" />
        </div>
      </Sec>

      {/* 3. Labs */}
      <Sec title="Investigations — Haematology" accent="#1e40af" defaultOpen={false}>
        <LabTable rows={haem} onChange={setHaem} accent="#1e40af" />
      </Sec>

      <Sec title="Investigations — Liver Function (Trend)" accent="#1e40af" defaultOpen={false}
        action={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="text" value={lftLabel1} onChange={e => setLftLabel1(e.target.value)} style={{ width: 90, fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.15)', color: '#fff' }} />
            <span style={{ color: '#fff', opacity: .7 }}>vs</span>
            <input type="text" value={lftLabel2} onChange={e => setLftLabel2(e.target.value)} style={{ width: 90, fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.15)', color: '#fff' }} />
          </div>
        }
      >
        <TrendTable rows={lft} onChange={setLft} accent="#1e40af" label1={lftLabel1} label2={lftLabel2} />
      </Sec>

      <Sec title="Investigations — Metabolic / Renal / Inflammatory" accent="#075985" defaultOpen={false}>
        <LabTable rows={amylase} onChange={setAmylase} accent="#075985" />
      </Sec>

      <Sec title="Investigations — Tumour Markers" accent="#075985" defaultOpen={false}>
        <LabTable rows={tumour} onChange={setTumour} accent="#075985" />
      </Sec>

      {/* 4. Imaging */}
      <Sec title="Imaging" accent="#854d0e" defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {imaging.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 100px 100px 1fr auto', gap: 6, alignItems: 'flex-start' }}>
              <div style={FLD}><label style={LBL}>Modality</label><input style={{ ...INP, fontSize: 12 }} value={row.modality} onChange={e => setImaging(imaging.map((r,idx) => idx===i ? {...r, modality: e.target.value} : r))} placeholder="CT / USS / XR" /></div>
              <div style={FLD}><label style={LBL}>Region</label><input style={{ ...INP, fontSize: 12 }} value={row.region} onChange={e => setImaging(imaging.map((r,idx) => idx===i ? {...r, region: e.target.value} : r))} placeholder="Abdomen" /></div>
              <div style={FLD}><label style={LBL}>Date</label><input type="date" style={{ ...INP, fontSize: 12 }} value={row.date} onChange={e => setImaging(imaging.map((r,idx) => idx===i ? {...r, date: e.target.value} : r))} /></div>
              <div style={FLD}><label style={LBL}>Findings</label><textarea style={{ ...TA, minHeight: 56, fontSize: 12 }} value={row.findings} onChange={e => setImaging(imaging.map((r,idx) => idx===i ? {...r, findings: e.target.value} : r))} placeholder="Radiological findings…" /></div>
              <button type="button" onClick={() => setImaging(imaging.filter((_,idx) => idx!==i))} style={{ marginTop: 18, background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setImaging([...imaging, { modality:'', region:'', date:'', findings:'' }])}
            style={{ alignSelf: 'flex-start', background: 'none', border: `1px dashed #854d0e`, color: '#854d0e', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            + Add imaging
          </button>
        </div>
      </Sec>

      {/* 5. Procedure */}
      <Sec title="Operative / Procedural Record" accent="#5b21b6" defaultOpen={false}>
        <div style={{ ...GRID3, marginBottom: 8 }}>
          <div style={FLD}><label style={LBL}>Date of Procedure</label><input type="date" style={INP} value={procedureDate} onChange={e => setProcedureDate(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Operator / Surgeon</label><input style={INP} value={operator} onChange={e => setOperator(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Instrument / Scope</label><input style={INP} value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="Olympus CF-HQ190 / Storz" /></div>
          <div style={FLD}><label style={LBL}>Anaesthesia</label><input style={INP} value={anaesthesia} onChange={e => setAnaesthesia(e.target.value)} placeholder="GA / Sedation / Spinal / LA" /></div>
          <div style={FLD}><label style={LBL}>Indication</label><input style={INP} value={indication} onChange={e => setIndication(e.target.value)} placeholder="e.g. CBD stone, rectal bleeding" /></div>
          <div style={FLD}><label style={LBL}>Discharge Diagnosis</label><input style={INP} value={dischargeDx} onChange={e => setDischargeDx(e.target.value)} /></div>
        </div>
        <div style={FLD}>
          <label style={LBL}>Operative / Procedure Narrative</label>
          <textarea style={{ ...TA, minHeight: 120 }} value={procedureNarrative} onChange={e => setProcedureNarrative(e.target.value)} placeholder="Describe technique, findings, and steps in clinical prose…" />
        </div>
        <div style={{ ...GRID2, marginTop: 8 }}>
          <div style={FLD}><label style={LBL}>Complications (if any)</label><textarea style={TA} value={complications} onChange={e => setComplications(e.target.value)} placeholder="Nil / describe" /></div>
          <div style={FLD}><label style={LBL}>Post-procedure Course</label><textarea style={TA} value={postProcCourse} onChange={e => setPostProcCourse(e.target.value)} placeholder="Stable, tolerated well, …" /></div>
        </div>
      </Sec>

      {/* 6. Progress notes */}
      <Sec title="Progress Notes / SOAP" accent={C.teal} defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {progressNotes.map((note, i) => (
            <div key={i} style={{ border: `1.5px solid #d6cfc8`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: C.teal + '18', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.teal }}>{note.type} · {note.date} · {note.author}</span>
                <button type="button" onClick={() => setProgressNotes(progressNotes.filter((_,idx) => idx!==i))}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
              <div style={{ padding: '6px 10px', fontSize: 12, whiteSpace: 'pre-wrap', color: '#1a1a1a' }}>{note.note}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#f9f5f0', border: `1px solid #e2d9cf`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['SOAP', 'Progress', 'Ward Round'] as const).map(t => (
              <button key={t} type="button" onClick={() => setNoteType(t)}
                style={{ padding: '4px 12px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${noteType === t ? C.teal : '#d6cfc8'}`, background: noteType === t ? C.teal : '#fff', color: noteType === t ? '#fff' : C.muted }}>
                {t}
              </button>
            ))}
            <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
            <input type="text"
              defaultValue="Dr. Dawit D Kabiye"
              id={uid+'noteauthor'}
              placeholder="Author"
              style={{ ...INP, width: 180, fontSize: 12 }}
            />
            <input type="date" id={uid+'notedate'} style={{ ...INP, width: 140, fontSize: 12 }} />
          </div>
          {noteType === 'SOAP' && (
            <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4 }}>
              Format: <strong>S</strong> Subjective · <strong>O</strong> Objective · <strong>A</strong> Assessment · <strong>P</strong> Plan
            </div>
          )}
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={noteType === 'SOAP' ? 'S: Patient reports…\nO: Temp 37.2 · BP 118/76 · Abdomen soft…\nA: Post-op day 1, recovering well\nP: Continue current management…' : 'Enter note…'}
            style={{ ...TA, minHeight: 100 }}
          />
          <button type="button"
            onClick={() => {
              const authorEl = document.getElementById(uid+'noteauthor') as HTMLInputElement;
              const dateEl   = document.getElementById(uid+'notedate')   as HTMLInputElement;
              if (!noteText.trim()) return;
              setProgressNotes([...progressNotes, {
                date: dateEl?.value || new Date().toLocaleDateString('en-GB'),
                author: authorEl?.value || 'Dr. Dawit D Kabiye',
                type: noteType, note: noteText.trim(),
              }]);
              setNoteText('');
            }}
            style={{ ...BTN, background: C.teal, color: '#fff', marginTop: 8 }}>
            + Add Note
          </button>
        </div>
      </Sec>

      {/* 7. Discharge plan */}
      <Sec title="Discharge Management Plan" accent={C.terra}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...GRID2, marginBottom: 8 }}>
            <div style={FLD}><label style={LBL}>Follow-up callout heading</label><input style={INP} value={followupHeading} onChange={e => setFollowupHeading(e.target.value)} /></div>
            <div style={FLD}><label style={LBL}>Follow-up callout text</label><input style={INP} value={followupBody} onChange={e => setFollowupBody(e.target.value)} placeholder="Review in surgical OPD in 2 weeks…" /></div>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...LBL, marginBottom: 6 }}>Medications on Discharge</div>
          <MedTable rows={medications} onChange={setMedications} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
          <div>
            <div style={{ ...LBL, marginBottom: 6 }}>Lifestyle Advice</div>
            <EditList items={lifestyle} onChange={setLifestyle} placeholder="Diet, activity, wound care…" />
          </div>
          <div>
            <div style={{ ...LBL, marginBottom: 6 }}>Follow-up Plan</div>
            <EditList items={followupPlan} onChange={setFollowupPlan} placeholder="OPD in 2 weeks, biopsy results…" />
          </div>
          <div>
            <div style={{ ...LBL, marginBottom: 6 }}>Red Flags — Return If</div>
            <EditList items={redFlags} onChange={setRedFlags} placeholder="Warning sign…" />
          </div>
        </div>
      </Sec>

      {/* 8. Sign-off */}
      <Sec title="Sign-off" accent={C.navy} defaultOpen={false}>
        <div style={GRID2}>
          <div style={FLD}><label style={LBL}>Clinician name</label><input style={INP} value={signoffName} onChange={e => setSignoffName(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Role / Qualifications</label><input style={INP} value={signoffRole} onChange={e => setSignoffRole(e.target.value)} /></div>
          <div style={FLD}><label style={LBL}>Contact</label><input style={INP} value={signoffContact} onChange={e => setSignoffContact(e.target.value)} placeholder="1 (758) 720 7111" /></div>
          <div style={FLD}><label style={LBL}>Date</label><input type="date" style={INP} value={signoffDate} onChange={e => setSignoffDate(e.target.value)} /></div>
        </div>
      </Sec>

    </div>
  );
}
