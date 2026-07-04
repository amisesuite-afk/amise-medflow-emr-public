import { useState, useMemo } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';
import CodingAssistant from '@/components/CodingAssistant';

// ── Fee schedule ──────────────────────────────────────────────────────────
interface FeeItem { code: string; description: string; fee: number; }

const FEE_SCHEDULE: { group: string; items: FeeItem[] }[] = [
  {
    group: 'Consultations',
    items: [
      { code: 'C01', description: 'New patient consultation',            fee: 350 },
      { code: 'C02', description: 'Follow-up consultation',              fee: 200 },
      { code: 'C03', description: 'Urgent / emergency consultation',     fee: 500 },
      { code: 'C04', description: 'Telephone / video consultation',      fee: 150 },
      { code: 'C05', description: 'Pre-operative consultation',          fee: 250 },
      { code: 'C06', description: 'Post-operative review',               fee: 175 },
    ],
  },
  {
    group: 'Upper GI Endoscopy',
    items: [
      { code: 'E01', description: 'OGD — diagnostic',                              fee: 1800 },
      { code: 'E02', description: 'OGD + biopsy',                                  fee: 2000 },
      { code: 'E03', description: 'OGD + polypectomy / intervention',               fee: 2400 },
      { code: 'E04', description: 'ERCP — diagnostic',                              fee: 4500 },
      { code: 'E05', description: 'ERCP + sphincterotomy',                          fee: 5500 },
      { code: 'E06', description: 'ERCP + stone extraction',                        fee: 6000 },
      { code: 'E07', description: 'ERCP + biliary stent insertion',                 fee: 6500 },
      { code: 'E08', description: 'ERCP + combined (sphincterotomy + stent)',        fee: 7000 },
    ],
  },
  {
    group: 'Lower GI Endoscopy',
    items: [
      { code: 'L01', description: 'Flexible sigmoidoscopy',              fee: 1500 },
      { code: 'L02', description: 'Colonoscopy — diagnostic',            fee: 2200 },
      { code: 'L03', description: 'Colonoscopy + biopsy',                fee: 2500 },
      { code: 'L04', description: 'Colonoscopy + polypectomy',           fee: 2900 },
    ],
  },
  {
    group: 'Hepatobiliary & Upper GI Surgery',
    items: [
      { code: 'S01', description: 'Laparoscopic cholecystectomy',        fee: 6500 },
      { code: 'S02', description: 'Open cholecystectomy',                fee: 5500 },
      { code: 'S03', description: 'Laparoscopic appendicectomy',         fee: 4500 },
      { code: 'S04', description: 'Open appendicectomy',                 fee: 3800 },
      { code: 'S05', description: 'Whipple procedure',                   fee: 18000 },
    ],
  },
  {
    group: 'Hernia Surgery',
    items: [
      { code: 'H01', description: 'Inguinal hernia repair — laparoscopic (TEP/TAPP)', fee: 5500 },
      { code: 'H02', description: 'Inguinal hernia repair — open (Lichtenstein)',     fee: 4000 },
      { code: 'H03', description: 'Umbilical hernia repair',                          fee: 3500 },
      { code: 'H04', description: 'Incisional hernia repair',                         fee: 5000 },
      { code: 'H05', description: 'Para-umbilical hernia repair',                     fee: 3800 },
    ],
  },
  {
    group: 'Breast & Thyroid',
    items: [
      { code: 'B01', description: 'Wide local excision (breast)',         fee: 4500 },
      { code: 'B02', description: 'Mastectomy (total)',                   fee: 9000 },
      { code: 'B03', description: 'Sentinel node biopsy',                fee: 3500 },
      { code: 'T01', description: 'Hemithyroidectomy',                   fee: 6000 },
      { code: 'T02', description: 'Total thyroidectomy',                  fee: 8000 },
      { code: 'T03', description: 'Parathyroidectomy',                   fee: 7000 },
    ],
  },
  {
    group: 'Office Procedures',
    items: [
      { code: 'O01', description: 'Fine needle aspiration cytology (FNAC)',          fee: 500  },
      { code: 'O02', description: 'Core needle biopsy',                              fee: 800  },
      { code: 'O03', description: 'Excision of skin lesion (< 2 cm)',                fee: 1200 },
      { code: 'O04', description: 'Excision of soft tissue mass',                    fee: 2000 },
      { code: 'O05', description: 'Incision and drainage (abscess)',                  fee: 800  },
      { code: 'O06', description: 'Wound dressing / complex wound care',              fee: 200  },
      { code: 'O07', description: 'Suture removal',                                  fee: 100  },
      { code: 'O08', description: 'Local anaesthetic injection / nerve block',       fee: 300  },
    ],
  },
];

const APPT_LABELS: Record<string, string> = {
  new_consult: 'New Consultation', follow_up: 'Follow-up Consultation',
  post_op: 'Post-operative Review', ercp_workup: 'ERCP Work-up',
  ercp: 'ERCP Procedure', breast: 'Breast Clinic',
  telephone: 'Telephone Consultation', diabetic_foot: 'Diabetic Foot Clinic',
};

interface LineItem { code: string; description: string; qty: number; unit: number; }

function fmt(n: number) { return `EC$${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// ── Superbill print ────────────────────────────────────────────────────────
function printSuperbill(opts: {
  patient: { name: string; age: string; sex: string; nhiNumber: string; };
  provider: string;
  site: string;
  date: string;
  lines: LineItem[];
  icdCodes: string[];
  cptCodes: string[];
  insurer: string;
  policy: string;
  preAuth: string;
  subtotal: number;
  discount: number;
  total: number;
  insurerPays: number;
  patientPays: number;
  notes: string;
}) {
  const rows = opts.lines.map(l => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #cbd5e1;font-family:monospace;font-size:11px">${l.code}</td>
      <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px">${l.description}</td>
      <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;font-size:12px">${l.qty}</td>
      <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;font-size:12px;font-variant-numeric:tabular-nums">${fmt(l.unit)}</td>
      <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums">${fmt(l.qty * l.unit)}</td>
    </tr>`).join('');

  const icdList = opts.icdCodes.length
    ? opts.icdCodes.map(c => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;font-family:monospace;font-size:11px">${c}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:11px">None recorded</span>';

  const cptList = opts.cptCodes.length
    ? opts.cptCodes.map(c => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 6px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-family:monospace;font-size:11px">${c}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:11px">None recorded</span>';

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Superbill — ${opts.patient.name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#0f172a;background:#fff;padding:32px 40px;max-width:800px;margin:0 auto}
    @media print{body{padding:0;max-width:none}}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a}
    .practice{font-size:11px;color:#475569;line-height:1.6}
    .practice strong{font-size:14px;font-weight:800;color:#0f172a;display:block;margin-bottom:2px}
    .superbill-title{font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a}
    .section{margin-bottom:20px}
    .section-label{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
    .meta-item .key{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em}
    .meta-item .val{font-size:13px;font-weight:600;color:#0f172a;margin-top:1px}
    table{width:100%;border-collapse:collapse}
    thead th{background:#f8fafc;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;padding:8px;border:1px solid #cbd5e1;text-align:left}
    thead th:last-child,thead th:nth-last-child(2){text-align:right}
    thead th:nth-child(3){text-align:center}
    .totals{margin-left:auto;width:260px;margin-top:12px}
    .total-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:1px solid #f1f5f9;font-variant-numeric:tabular-nums}
    .total-row.grand{font-size:15px;font-weight:800;border-top:2px solid #0f172a;border-bottom:none;padding-top:10px;margin-top:4px}
    .split-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .split-item .key{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase}
    .split-item .val{font-size:14px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums}
    .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
    .sig-block{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:40px}
    .sig-line{border-top:1px solid #475569;padding-top:6px;font-size:11px;color:#475569}
    .no-print{margin-bottom:20px}
    @media print{.no-print{display:none}}
  </style></head><body>
  <div class="no-print" style="display:flex;gap:8px">
    <button onclick="window.print()" style="padding:8px 18px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">Print / Save PDF</button>
    <button onclick="window.close()" style="padding:8px 14px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;cursor:pointer">Close</button>
  </div>
  <div class="header">
    <div class="practice">
      <strong>Amise Medical Services</strong>
      Dr Dawit Daniel Kabiye, MD, DM — Consultant General &amp; Endoscopic Surgeon<br>
      Rodney Bay Medical Centre · Tapion Hospital, Saint Lucia<br>
      Tel: +1 (758) 284-0557
    </div>
    <div style="text-align:right">
      <div class="superbill-title">SUPERBILL</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">Date: ${opts.date}</div>
      <div style="font-size:11px;color:#64748b">${opts.site}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Patient</div>
    <div class="meta-grid">
      <div class="meta-item"><div class="key">Name</div><div class="val">${opts.patient.name || '—'}</div></div>
      <div class="meta-item"><div class="key">Age / Sex</div><div class="val">${opts.patient.age || '—'} / ${opts.patient.sex || '—'}</div></div>
      <div class="meta-item"><div class="key">NHI Number</div><div class="val">${opts.patient.nhiNumber || '—'}</div></div>
    </div>
  </div>

  ${opts.insurer ? `<div class="section">
    <div class="section-label">Insurance</div>
    <div class="meta-grid">
      <div class="meta-item"><div class="key">Insurer</div><div class="val">${opts.insurer}</div></div>
      <div class="meta-item"><div class="key">Policy / Member No.</div><div class="val">${opts.policy || '—'}</div></div>
      <div class="meta-item"><div class="key">Pre-authorisation</div><div class="val">${opts.preAuth || '—'}</div></div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-label">Diagnosis codes (ICD-10)</div>
    <div style="padding:6px 0">${icdList}</div>
  </div>

  <div class="section">
    <div class="section-label">Procedure codes (CPT)</div>
    <div style="padding:6px 0">${cptList}</div>
  </div>

  <div class="section">
    <div class="section-label">Services rendered</div>
    <table>
      <thead><tr>
        <th style="width:70px">Code</th>
        <th>Description</th>
        <th style="width:40px">Qty</th>
        <th style="width:100px">Unit fee</th>
        <th style="width:100px">Amount</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8;font-size:12px">No items</td></tr>'}</tbody>
    </table>
    <div class="totals">
      ${opts.discount > 0 ? `
      <div class="total-row"><span>Subtotal</span><span>${fmt(opts.subtotal)}</span></div>
      <div class="total-row"><span>Discount</span><span style="color:#dc2626">−${fmt(opts.discount)}</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL</span><span>${fmt(opts.total)}</span></div>
    </div>
    ${opts.insurer ? `<div class="split-box">
      <div class="split-item"><div class="key">Insurer pays</div><div class="val">${fmt(opts.insurerPays)}</div></div>
      <div class="split-item"><div class="key">Patient pays</div><div class="val">${fmt(opts.patientPays)}</div></div>
    </div>` : ''}
  </div>

  ${opts.notes ? `<div class="section">
    <div class="section-label">Billing notes</div>
    <p style="font-size:12px;color:#374151;white-space:pre-wrap">${opts.notes}</p>
  </div>` : ''}

  <div class="sig-block">
    <div>
      <div class="sig-line">Physician signature</div>
      <div style="font-size:11px;color:#475569;margin-top:4px">Dr Dawit Daniel Kabiye, MD, DM</div>
    </div>
    <div>
      <div class="sig-line">Date</div>
      <div style="font-size:11px;color:#475569;margin-top:4px">${opts.date}</div>
    </div>
  </div>

  <div class="footer">
    This superbill is for insurance reimbursement and patient record purposes only.<br>
    Fees are in Eastern Caribbean dollars (EC$). EC$1 ≈ US$0.37.
  </div>
  </body></html>`);
  w.document.close();
}

// ── Main component ─────────────────────────────────────────────────────────
export default function BillingTab() {
  const ctx = useAppContext();

  const [lines, setLines] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [insurerPct, setInsurerPct] = useState('80');
  const [selectedGroup, setSelectedGroup] = useState(FEE_SCHEDULE[0].group);

  const apptLabel = APPT_LABELS[ctx.triageResult.appointmentType] ?? ctx.triageResult.appointmentType;

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.unit, 0), [lines]);
  const discountAmt = Math.min(parseFloat(discount) || 0, subtotal);
  const total = subtotal - discountAmt;
  const insurerPays = Math.round(total * (parseFloat(insurerPct) / 100) * 100) / 100;
  const patientPays = Math.round((total - insurerPays) * 100) / 100;

  function addItem(item: FeeItem) {
    setLines(prev => {
      const existing = prev.findIndex(l => l.code === item.code);
      if (existing >= 0) {
        return prev.map((l, i) => i === existing ? { ...l, qty: l.qty + 1 } : l);
      }
      return [...prev, { code: item.code, description: item.description, qty: 1, unit: item.fee }];
    });
  }

  function removeItem(code: string) { setLines(prev => prev.filter(l => l.code !== code)); }
  function updateQty(code: string, qty: number) {
    if (qty < 1) { removeItem(code); return; }
    setLines(prev => prev.map(l => l.code === code ? { ...l, qty } : l));
  }
  function updateUnit(code: string, unit: number) {
    setLines(prev => prev.map(l => l.code === code ? { ...l, unit } : l));
  }

  const today = new Date().toLocaleDateString('en-LC', {
    timeZone: 'America/St_Lucia', dateStyle: 'long',
  });

  const SITE_LABELS: Record<string, string> = {
    rodney_bay: 'Rodney Bay Medical Centre',
    tapion:     'Tapion Hospital',
  };

  function handlePrint() {
    printSuperbill({
      patient: { name: ctx.patientName, age: ctx.age, sex: ctx.sex, nhiNumber: ctx.nhiNumber },
      provider: 'Dr Dawit Daniel Kabiye, MD, DM',
      site: SITE_LABELS[ctx.currentSite] ?? ctx.currentSite,
      date: today,
      lines,
      icdCodes: ctx.icdCodes,
      cptCodes: ctx.cptCodes,
      insurer: ctx.insuranceProvider,
      policy: ctx.policyNumber,
      preAuth: ctx.preAuthStatus,
      subtotal,
      discount: discountAmt,
      total,
      insurerPays,
      patientPays,
      notes: ctx.billing,
    });
  }

  const feeStyle: React.CSSProperties = {
    fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#0f5fa8',
  };

  return (
    <div className="gap-y">
      {/* Encounter summary strip */}
      <CollapsibleCard title="Encounter summary">
        <div className="form-grid cols-2">
          <div className="fld"><label>Patient</label><input readOnly value={ctx.patientName || '—'} /></div>
          <div className="fld"><label>Appointment type</label><input readOnly value={apptLabel} /></div>
          <div className="fld"><label>Site</label><input readOnly value={SITE_LABELS[ctx.currentSite] ?? ctx.currentSite} /></div>
          <div className="fld"><label>Date</label><input readOnly value={today} /></div>
        </div>
      </CollapsibleCard>

      {/* Insurance / NHI */}
      <CollapsibleCard title="Insurance / NHI" defaultOpen>
        <div className="form-grid cols-2">
          <div className="fld">
            <label>Insurance provider</label>
            <input placeholder="e.g. SAGICOR, CLICO, GHL…" value={ctx.insuranceProvider} onChange={e => ctx.setInsuranceProvider(e.target.value)} />
          </div>
          <div className="fld">
            <label>Policy / member number</label>
            <input placeholder="e.g. SGC-1234567" value={ctx.policyNumber} onChange={e => ctx.setPolicyNumber(e.target.value)} />
          </div>
          <div className="fld">
            <label>NHI number</label>
            <input placeholder="National Health Insurance number" value={ctx.nhiNumber} onChange={e => ctx.setNhiNumber(e.target.value)} />
          </div>
          <div className="fld">
            <label>Pre-authorisation</label>
            <select value={ctx.preAuthStatus} onChange={e => ctx.setPreAuthStatus(e.target.value)}>
              <option value="">—</option>
              <option value="not_required">Not required</option>
              <option value="required_pending">Required — pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </CollapsibleCard>

      {/* AI coding assistant */}
      <CodingAssistant />

      {/* Fee schedule picker */}
      <CollapsibleCard title="Fee schedule — EC$" defaultOpen>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {FEE_SCHEDULE.map(g => (
            <button
              key={g.group}
              type="button"
              onClick={() => setSelectedGroup(g.group)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                border: '1px solid',
                borderColor: selectedGroup === g.group ? '#0f5fa8' : '#e2e8f0',
                background: selectedGroup === g.group ? '#0f5fa8' : '#f8fafc',
                color: selectedGroup === g.group ? '#fff' : '#475569',
                cursor: 'pointer',
              }}
            >
              {g.group}
            </button>
          ))}
        </div>

        {FEE_SCHEDULE.filter(g => g.group === selectedGroup).map(g => (
          <div key={g.group} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {g.items.map(item => {
              const inBill = lines.some(l => l.code === item.code);
              return (
                <div
                  key={item.code}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
                    background: inBill ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${inBill ? '#93c5fd' : '#e2e8f0'}`,
                    transition: 'background .15s',
                  }}
                  onClick={() => addItem(item)}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', width: 36, flexShrink: 0 }}>{item.code}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#1e293b' }}>{item.description}</span>
                  <span style={feeStyle}>{fmt(item.fee)}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4,
                    background: inBill ? '#0f5fa8' : '#e2e8f0',
                    color: inBill ? '#fff' : '#64748b',
                  }}>{inBill ? '✓ Added' : '+ Add'}</span>
                </div>
              );
            })}
          </div>
        ))}
      </CollapsibleCard>

      {/* Line items */}
      <CollapsibleCard title={`Superbill line items${lines.length ? ` (${lines.length})` : ''}`} defaultOpen>
        {lines.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>
            No items added. Select services from the fee schedule above, or add a custom item below.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 520 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Code</th>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Description</th>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', width: 50 }}>Qty</th>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', width: 100 }}>Unit (EC$)</th>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', width: 100 }}>Total</th>
                  <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.code}>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{line.code}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontSize: 12 }}>{line.description}</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <input
                        type="number" min={1} value={line.qty}
                        onChange={e => updateQty(line.code, parseInt(e.target.value, 10) || 1)}
                        style={{ width: 44, textAlign: 'center', padding: '3px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                      <input
                        type="number" min={0} step={50} value={line.unit}
                        onChange={e => updateUnit(line.code, parseFloat(e.target.value) || 0)}
                        style={{ width: 90, textAlign: 'right', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                      {fmt(line.qty * line.unit)}
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button type="button" onClick={() => removeItem(line.code)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                        title="Remove">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Custom item */}
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>+ Add custom item</summary>
          <CustomItemRow onAdd={item => setLines(prev => [...prev, item])} />
        </details>

        {/* Totals */}
        {lines.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320, marginLeft: 'auto' }}>
            {/* Discount */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Discount (EC$)</span>
              <input
                type="number" min={0} step={50} value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="0"
                style={{ width: 90, textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12 }}
              />
            </div>
            <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
              <span>TOTAL</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#0f5fa8' }}>{fmt(total)}</span>
            </div>

            {/* Insurer/patient split */}
            {ctx.insuranceProvider && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Insurer covers</span>
                  <input
                    type="number" min={0} max={100} value={insurerPct}
                    onChange={e => setInsurerPct(e.target.value)}
                    style={{ width: 50, textAlign: 'center', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                  />
                  <span style={{ fontSize: 11, color: '#64748b' }}>%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>{ctx.insuranceProvider}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{fmt(insurerPays)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>Patient pays</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(patientPays)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleCard>

      {/* Notes */}
      <CollapsibleCard title="Billing notes">
        <div className="fld">
          <label>Internal notes (not visible to patient)</label>
          <textarea
            rows={3}
            placeholder="Payment received, outstanding balance, follow-up billing notes…"
            value={ctx.billing}
            onChange={e => ctx.setBilling(e.target.value)}
          />
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
          Fee information must not appear in automated patient communications.
        </p>
      </CollapsibleCard>

      {/* Print superbill */}
      <button
        type="button"
        onClick={handlePrint}
        disabled={!ctx.patientName}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
          background: ctx.patientName ? '#0f172a' : '#d1d5db',
          color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: ctx.patientName ? 'pointer' : 'default',
        }}
      >
        {ctx.patientName ? `Print Superbill — ${ctx.patientName}` : 'Load a patient to print superbill'}
      </button>
    </div>
  );
}

// ── Custom line-item row ───────────────────────────────────────────────────
function CustomItemRow({ onAdd }: { onAdd: (item: LineItem) => void }) {
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');

  function add() {
    if (!desc.trim() || !unit) return;
    const code = `X${Date.now().toString().slice(-4)}`;
    onAdd({ code, description: desc.trim(), qty: parseInt(qty, 10) || 1, unit: parseFloat(unit) || 0 });
    setDesc(''); setQty('1'); setUnit('');
  }

  const inp: React.CSSProperties = {
    fontSize: 12, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, outline: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input style={{ ...inp, flex: '1 1 180px' }} placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
      <input style={{ ...inp, width: 50 }} type="number" min={1} placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} />
      <input style={{ ...inp, width: 90 }} type="number" min={0} step={50} placeholder="EC$ unit fee" value={unit} onChange={e => setUnit(e.target.value)} />
      <button type="button" onClick={add}
        style={{ padding: '5px 14px', borderRadius: 5, background: '#0f172a', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        Add
      </button>
    </div>
  );
}
