import { useState, useMemo, useRef } from 'react';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#060d18', panel: '#0a1420', card: '#0d1a2e',
  border: '#1e3a5f', blue: '#4a9eff', muted: '#4a7aa0',
  text: '#c8dff5', dim: '#7ab3e0',
  green: '#34d399', amber: '#fbbf24', red: '#f87171', purple: '#a78bfa',
  redBg: 'rgba(248,113,113,0.08)', amberBg: 'rgba(251,191,36,0.08)',
  greenBg: 'rgba(52,211,153,0.08)', purpleBg: 'rgba(167,139,250,0.08)',
};

const SECTIONS = [
  { id: 'profile',    label: 'Profile',        icon: '👤' },
  { id: 'allowances', label: 'Personal Relief', icon: '🏠' },
  { id: 'expenses',   label: 'Business Exp.',   icon: '🏥' },
  { id: 'tax',        label: 'Tax Computation', icon: '🏛️' },
  { id: 'actions',    label: 'Action Plan',     icon: '✅' },
  { id: 'preflight',  label: 'Pre-Flight',      icon: '🛡️' },
  { id: 'report',     label: 'AI Report',       icon: '🧠' },
  { id: 'documents',  label: 'Documents',       icon: '📎' },
];

// ─── IRD Saint Lucia 2025 Tax Bands ──────────────────────────────────────────
const TAX_BANDS = [
  { from: 0,     to: 18000,     rate: 0.00, label: 'Band 1  First XCD 18,000' },
  { from: 18000, to: 30000,     rate: 0.10, label: 'Band 2  XCD 18,001–30,000' },
  { from: 30000, to: 50000,     rate: 0.15, label: 'Band 3  XCD 30,001–50,000' },
  { from: 50000, to: 80000,     rate: 0.20, label: 'Band 4  XCD 50,001–80,000' },
  { from: 80000, to: Infinity,  rate: 0.30, label: 'Band 5  Above XCD 80,000' },
];

// ─── Part 1 — Personal Allowances (ITA Cap 15.02, 2025) ──────────────────────
interface Allowance { id: string; label: string; max: number | null; cat: string; note: string; new2025: boolean; }

const ALLOWANCES: Allowance[] = [
  // Core
  { id:'personal',     label:'Personal Allowance (resident individual)',      max:40000,  cat:'Core Personal',          note:'2025: raised from $18,000 — automatic; all resident taxpayers', new2025:true  },
  { id:'spouse',       label:'Spouse / Partner Allowance',                    max:null,   cat:'Core Personal',          note:'Confirm eligibility per ITA s.26(1)(b) with IRD',                new2025:false },
  // Family
  { id:'child_nu',     label:'Child Allowance — per child (non-university)',  max:5000,   cat:'Family & Dependents',    note:'2025: raised to $5,000/child; proof of maintenance',             new2025:true  },
  { id:'child_u',      label:'Child Allowance — full-time university student',max:10000,  cat:'Family & Dependents',    note:'$10,000/child; proof of attendance + fees/housing paid',        new2025:true  },
  { id:'dep_rel',      label:'Dependent Relative Allowance — per relative',   max:5000,   cat:'Family & Dependents',    note:'2025: raised to $5,000; relative maintained by taxpayer',       new2025:true  },
  // Insurance & Retirement
  { id:'life_ins',     label:'Life Insurance Premiums (own life policy)',     max:5000,   cat:'Insurance & Retirement', note:'Unchanged; statements indicating premiums paid for year',        new2025:false },
  { id:'pension',      label:'Approved Pension / RRSP / Annuity Contributions',max:6000, cat:'Insurance & Retirement', note:'Approved fund only; statements of contributions required',       new2025:false },
  { id:'health_ins',   label:'Health / Medical Insurance Premiums (personal)',max:null,   cat:'Insurance & Retirement', note:'Personal policy — statements of premiums paid for year',         new2025:false },
  { id:'rrsp',         label:'Individual Registered Retirement Savings Plan', max:null,   cat:'Insurance & Retirement', note:'Letter from financial institution stating amount contributed',   new2025:false },
  // Housing & Property
  { id:'mortgage',     label:'Mortgage Interest Relief — owner-occupied',    max:40000,  cat:'Housing & Property',     note:'2025: MAJOR raise $8,000→$40,000; interest statement + block & parcel; SLU property only', new2025:true  },
  { id:'student_loan', label:'Student Loan Interest',                         max:40000,  cat:'Housing & Property',     note:'2025: NEW — statement of interest paid on qualifying student loan', new2025:true },
  { id:'house_ins',    label:'House Insurance Premiums + House Tax',          max:null,   cat:'Housing & Property',     note:'2025: NEW — statement of premiums paid and payment receipts',   new2025:true  },
  { id:'repairs',      label:'Repairs / Maintenance to Owner-Occupied Property',max:10000,cat:'Housing & Property',    note:'2025: NEW — max $10,000; all bills/receipts + written description of work', new2025:true },
  { id:'rhosp',        label:'Registered Home Ownership Savings Plan',        max:null,   cat:'Housing & Property',     note:'Letter from financial institution',                              new2025:false },
  // Investments & Savings
  { id:'credit_union', label:'Credit Union / Co-operative Society Shares',   max:10000,  cat:'Investments & Savings',  note:'2025: NEW — credit union share statements; max $10,000 p.a.',  new2025:true  },
  { id:'local_invest', label:'Local & Regional Investment Instruments',       max:10000,  cat:'Investments & Savings',  note:'2025: NEW — T-bills, bonds, shares, mutual funds; local/regional issuer', new2025:true },
  // Green Energy
  { id:'solar',        label:'Solar Photovoltaic — purchase & installation',  max:25000,  cat:'Green Energy',           note:'2025: NEW — all bills AND receipts for purchase and installation; max $25,000', new2025:true },
  { id:'road_rehab',   label:'Community Road Rehabilitation Works Project',   max:5000,   cat:'Green Energy',           note:'2025: NEW — proof of registration + proof of payment; max $5,000', new2025:true },
  // Medical
  { id:'medical',      label:'Medical / Dental Expenses (self & family)',     max:null,   cat:'Medical Expenses',       note:'2025: EXPANDED — now includes fertility treatments and dependent care; receipts retained', new2025:true },
  // NIC
  { id:'nic',          label:'NIC Self-Employed Contributions (Class 4)',     max:null,   cat:'NIC',                    note:'Confirm deductibility with NIC Board and IRD',                  new2025:false },
  // Education & Charitable
  { id:'education',    label:'Tertiary Education Expenses (self / dependent)',max:10000,  cat:'Education & Charitable', note:'ITA s.26(1)(e) — approved institution; enrolment letter + fee/housing invoices', new2025:false },
  { id:'charity',      label:'Charitable Donations — approved organisations', max:null,   cat:'Education & Charitable', note:'ITA s.27 — Deed of Covenant ≥3 years; NCF / SLU National Trust; Max 1/6 CI', new2025:false },
  { id:'farming',      label:'Hobby Farming',                                 max:5000,   cat:'Education & Charitable', note:'2025: NEW — letter from Ministry of Agriculture; max $5,000',  new2025:true  },
  // Employment & Travel
  { id:'travel_allow', label:'Travelling Allowance (business — employed)',    max:6000,   cat:'Employment & Travel',    note:'TD Form AU-3; signed by manager/director; company seal; max $6,000', new2025:false },
  { id:'alimony',      label:'Alimony / Maintenance Payments',                max:null,   cat:'Employment & Travel',    note:'Court Order or Decree; recipient chargeable to tax in Saint Lucia', new2025:false },
];

// ─── Part 2 — Deductible Business Expenses (ITA s.18) ────────────────────────
interface ExpenseItem { id: string; label: string; conservative: number; maximum: number; }
interface ExpenseCategory { id: string; name: string; color: string; items: ExpenseItem[]; }

interface ExtractedExpense {
  id: string; vendor: string; date: string; amountXcd: number;
  description: string; catId: string; itemId: string;
  applied: boolean; sourceDocId: string;
}
interface DocFile {
  id: string; name: string; mimeType: string; base64: string;
  fileType: 'image' | 'pdf' | 'excel' | 'csv';
  status: 'queued' | 'processing' | 'done' | 'error';
  extracted: ExtractedExpense[]; errorMsg?: string;
}

const EXPENSE_CATS: ExpenseCategory[] = [
  { id:'staff', name:'1. Staff, Wages & Professional Fees', color:C.green, items:[
    { id:'rn',          label:'Sessional RN / nursing staff fees',            conservative:28000, maximum:38000 },
    { id:'anaes',       label:'Sessional anaesthetist fees',                  conservative:20000, maximum:30000 },
    { id:'recep1',      label:'Receptionist / admin — Clinic 1',              conservative:22000, maximum:24000 },
    { id:'recep2',      label:'Receptionist / admin — Clinic 2',              conservative:18000, maximum:22000 },
    { id:'medsecy',     label:'Medical secretary / PA (part-time)',            conservative:15000, maximum:18000 },
    { id:'pracmgr',     label:'Practice manager',                             conservative:20000, maximum:24000 },
    { id:'locum',       label:'Locum / relief surgeon fees',                  conservative:0,     maximum:15000 },
    { id:'accountant',  label:'Accountant / bookkeeper',                      conservative:7000,  maximum:9000  },
    { id:'legal',       label:'Legal fees (practice matters only)',            conservative:3000,  maximum:6000  },
    { id:'payroll_svc', label:'Payroll / HR administration service',          conservative:3000,  maximum:4000  },
    { id:'recruit',     label:'Recruitment fees',                             conservative:0,     maximum:3000  },
  ]},
  { id:'premises', name:'2. Clinic Premises — Both Locations', color:C.blue, items:[
    { id:'rent1',       label:'Rent — Clinic 1 (Rodney Bay)',                 conservative:48000, maximum:48000 },
    { id:'rent2',       label:'Rent — Clinic 2 (second location)',            conservative:36000, maximum:36000 },
    { id:'elec1',       label:'Electricity & utilities — Clinic 1',           conservative:8000,  maximum:9600  },
    { id:'elec2',       label:'Electricity & utilities — Clinic 2',           conservative:5000,  maximum:6400  },
    { id:'water',       label:'Water / sewage — both clinics',                conservative:2000,  maximum:2400  },
    { id:'homeoffice',  label:'Home office — proportionate area',             conservative:0,     maximum:28000 },
    { id:'signage',     label:'Signage & clinic branding',                    conservative:1200,  maximum:2400  },
  ]},
  { id:'equipment', name:'3. Medical Equipment, Depreciation & Consumables', color:C.purple, items:[
    { id:'cap_ercp',    label:'Capital allowance — endoscopy / ERCP equipment',conservative:18000, maximum:22000 },
    { id:'cap_surg',    label:'Capital allowance — surgical instruments',      conservative:7000,  maximum:9000  },
    { id:'cap_office',  label:'Capital allowance — office / clinic equipment', conservative:4000,  maximum:6000  },
    { id:'cap_fitout',  label:'Capital allowance — clinic fit-out / leasehold',conservative:10000, maximum:12000 },
    { id:'ercp_cons',   label:'ERCP consumables (catheters, sphincterotomes)', conservative:20000, maximum:26000 },
    { id:'surg_inst',   label:'Surgical instruments & single-use disposables', conservative:10000, maximum:13000 },
    { id:'ppe',         label:'PPE — gloves, gowns, masks, drapes',            conservative:5000,  maximum:6000  },
    { id:'diag',        label:'Diagnostic reagents & laboratory supplies',     conservative:4000,  maximum:5500  },
    { id:'gas',         label:'Medical gas (CO2/O2) — rental + refills',       conservative:3600,  maximum:4200  },
    { id:'equip_svc',   label:'Equipment servicing & calibration',             conservative:7000,  maximum:9000  },
    { id:'sterilise',   label:'Sterilisation & autoclave costs',               conservative:2500,  maximum:3000  },
  ]},
  { id:'vehicle', name:'4. Motor Vehicle — Practice Use', color:C.amber, items:[
    { id:'fuel',        label:'Fuel — documented practice travel (80%)',       conservative:12000, maximum:14400 },
    { id:'veh_ins',     label:'Vehicle insurance (business portion)',          conservative:4800,  maximum:6000  },
    { id:'veh_maint',   label:'Vehicle maintenance, tyres, servicing',         conservative:3600,  maximum:4800  },
    { id:'veh_dep',     label:'Vehicle depreciation / lease payments',         conservative:10000, maximum:12000 },
    { id:'parking',     label:'Parking & tolls — practice calls only',         conservative:1000,  maximum:1200  },
  ]},
  { id:'insurance', name:'5. Insurance', color:C.red, items:[
    { id:'malpractice', label:'Medical indemnity / malpractice (MPLA/ECMIS)', conservative:30000, maximum:32000 },
    { id:'public_liab', label:'Public liability — clinic premises',           conservative:5400,  maximum:5400  },
    { id:'biz_int',     label:'Business interruption insurance',              conservative:4200,  maximum:4200  },
    { id:'prof_ind',    label:'Professional indemnity — additional riders',   conservative:3600,  maximum:3600  },
    { id:'keyperson',   label:'Key-person insurance (business policy)',        conservative:8400,  maximum:8400  },
  ]},
  { id:'comms', name:'6. Communications, IT & Digital', color:C.blue, items:[
    { id:'landlines',   label:'Dedicated practice landlines — both clinics',  conservative:7200,  maximum:7200  },
    { id:'mobile',      label:'Mobile phone — practice portion (70%)',        conservative:3600,  maximum:3600  },
    { id:'broadband',   label:'Broadband / internet — clinic premises',       conservative:3600,  maximum:3600  },
    { id:'emr',         label:'Electronic medical records (EMR) — SaaS',     conservative:5400,  maximum:5400  },
    { id:'telehealth',  label:'Telemedicine platform',                        conservative:0,     maximum:3600  },
    { id:'cyber',       label:'Cybersecurity / antivirus / backup',           conservative:2400,  maximum:2400  },
    { id:'website',     label:'Practice website & digital presence',          conservative:3600,  maximum:3600  },
    { id:'software',    label:'Practice management software licences',        conservative:2400,  maximum:2400  },
  ]},
  { id:'cme', name:'7. CME & Professional Travel', color:C.green, items:[
    { id:'esge_conf',   label:'ESGE / ASGE / SAGES annual conference',       conservative:10000, maximum:12000 },
    { id:'carib_conf',  label:'Caribbean surgical meetings (CGSLA)',          conservative:5000,  maximum:6000  },
    { id:'airfare',     label:'International airfare — CME travel',          conservative:15000, maximum:18000 },
    { id:'hotel',       label:'Hotel / accommodation — CME travel',          conservative:8000,  maximum:9600  },
    { id:'online_cme',  label:'Online CME courses & webinars',               conservative:4200,  maximum:4200  },
    { id:'textbooks',   label:'Textbooks & clinical journals',               conservative:3000,  maximum:3000  },
    { id:'simulation',  label:'Simulation / cadaveric training courses',     conservative:5000,  maximum:8000  },
    { id:'fellowship',  label:'Visiting fellowship / observership travel',   conservative:0,     maximum:12000 },
    { id:'slma_cpd',    label:'SLMA / local CPD events',                     conservative:2400,  maximum:2400  },
  ]},
  { id:'profees', name:'8. Professional Fees & Registrations', color:C.purple, items:[
    { id:'slma',        label:'SLMA annual subscription',                    conservative:1800,  maximum:1800  },
    { id:'ecsmg',       label:'ECSMG / specialist registration fees',        conservative:1000,  maximum:1000  },
    { id:'medcouncil',  label:'Medical Council licence / annual renewal',    conservative:800,   maximum:800   },
    { id:'esge_dues',   label:'ESGE / ASGE membership dues',                conservative:1500,  maximum:1500  },
    { id:'gp_gifts',    label:'Gifts to referring GPs (max $500/recipient)', conservative:0,     maximum:2500  },
    { id:'advertising', label:'Advertising — directory, print, digital',     conservative:3600,  maximum:4800  },
    { id:'stationery',  label:'Practice stationery, Rx pads, letterheads',  conservative:2400,  maximum:3000  },
  ]},
  { id:'bank', name:'9. Bank Charges & Finance Costs', color:C.amber, items:[
    { id:'bank_charges',label:'Business bank account charges',               conservative:1800,  maximum:1800  },
    { id:'merchant',    label:'Credit / debit card merchant fees',            conservative:5400,  maximum:5400  },
    { id:'equip_loan',  label:'Equipment finance loan — INTEREST ONLY',      conservative:9600,  maximum:9600  },
    { id:'fitout_loan', label:'Clinic fit-out loan — INTEREST ONLY',         conservative:6000,  maximum:6000  },
    { id:'overdraft',   label:'Overdraft interest (practice account only)',   conservative:1800,  maximum:1800  },
  ]},
  { id:'misc', name:'10. Research, Governance & Miscellaneous', color:C.red, items:[
    { id:'research',    label:'Clinical research costs (ERCP programme)',    conservative:6000,  maximum:8000  },
    { id:'audit_qual',  label:'Audit & clinical quality-improvement',        conservative:3600,  maximum:3600  },
    { id:'med_waste',   label:'Medical waste disposal (clinical waste)',      conservative:3600,  maximum:3600  },
    { id:'postage',     label:'Postage, courier & secure document handling', conservative:1200,  maximum:1200  },
    { id:'uniforms',    label:'Staff uniforms / scrubs (practice logo)',     conservative:2400,  maximum:2400  },
    { id:'subscriptions',label:'Subscriptions — UpToDate, Cochrane, PubMed',conservative:3000,  maximum:3000  },
    { id:'entertainment',label:'Business entertainment — 50% cap (IRD)',     conservative:2400,  maximum:2400  },
    { id:'sundry',      label:'Sundry practice expenses',                    conservative:2000,  maximum:3000  },
  ]},
];

// ─── Key 2025 Actions ─────────────────────────────────────────────────────────
interface KeyAction { id: string; label: string; saving: number; deadline: string; note: string; }
const KEY_ACTIONS: KeyAction[] = [
  { id:'solar',     label:'Install Solar PV system on clinic(s)',                saving:25000, deadline:'31 Dec 2025', note:'All bills AND receipts for both purchase and installation required' },
  { id:'mortgage',  label:'Confirm mortgage interest statement',                 saving:40000, deadline:'31 Dec 2025', note:'Raised $8,000→$40,000 — obtain from lender before year-end' },
  { id:'cu_shares', label:'Maximise Credit Union shares to $10,000',            saving:10000, deadline:'31 Dec 2025', note:'Credit union share statements required for filing' },
  { id:'invest',    label:'Purchase local/regional investment instruments $10K', saving:10000, deadline:'31 Dec 2025', note:'T-bills, bonds, shares, mutual funds from local/regional issuer' },
  { id:'pa_contr',  label:'Formalise PA/secretary employment contract',          saving:24000, deadline:'31 Dec 2025', note:'Written contract + payslips; $18,000–$24,000 deduction' },
  { id:'home_off',  label:'Document home office room — measure & calculate',    saving:28000, deadline:'31 Dec 2025', note:'Exclusive consulting/admin room; floor area × total area × occupancy costs' },
  { id:'stud_loan', label:'Claim student loan interest if applicable',           saving:40000, deadline:'31 Mar 2026', note:'Up to $40,000; statement of interest paid on qualifying loan' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = (v: string | number) => Number(v) || 0;
const xcd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const xcd2 = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function calcTax(income: number): number {
  let tax = 0;
  for (const b of TAX_BANDS) {
    if (income <= b.from) break;
    const top = b.to === Infinity ? income : Math.min(income, b.to);
    tax += (top - b.from) * b.rate;
  }
  return tax;
}

function taxBandBreakdown(income: number): { band: string; rate: string; taxable: number; tax: number }[] {
  return TAX_BANDS.map(b => {
    if (income <= b.from) return { band: b.label, rate: `${(b.rate * 100).toFixed(0)}%`, taxable: 0, tax: 0 };
    const top = b.to === Infinity ? income : Math.min(income, b.to);
    const taxable = top - b.from;
    return { band: b.label, rate: `${(b.rate * 100).toFixed(0)}%`, taxable, tax: taxable * b.rate };
  });
}

const inputS: React.CSSProperties = {
  width: '100%', background: C.panel, border: `1px solid ${C.border}`,
  color: C.text, padding: '7px 10px', borderRadius: 5, fontSize: 12,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelS: React.CSSProperties = { color: C.dim, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3, display: 'block' };

// ─── Sub-components ───────────────────────────────────────────────────────────
function SH({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color: C.blue, fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>{icon}</span>{title}
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function KV({ label, value, color, large }: { label: string; value: string; color?: string; large?: boolean }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ color: C.dim, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: color ?? C.blue, fontWeight: 700, fontSize: large ? 18 : 14 }}>{value}</div>
    </div>
  );
}

function Alert({ type, msg }: { type: 'error' | 'warn' | 'ok'; msg: string }) {
  const cfg = {
    error: { bg: C.redBg,   border: C.red,   icon: '✕', col: C.red   },
    warn:  { bg: C.amberBg, border: C.amber, icon: '⚠', col: C.amber },
    ok:    { bg: C.greenBg, border: C.green, icon: '✓', col: C.green },
  }[type];
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}33`, borderRadius: 5, padding: '7px 10px', marginBottom: 5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: cfg.col, fontSize: 11, marginTop: 1 }}>{cfg.icon}</span>
      <span style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{msg}</span>
    </div>
  );
}

function Divider({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ color: color ?? C.muted, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

// ─── Document extraction prompt ───────────────────────────────────────────────
const EXTRACT_PROMPT = `You are a financial document parser for Amise Medical Services, a surgical practice in Saint Lucia.
Extract all expense or payment items from the provided content.
Return ONLY a valid JSON array (no markdown, no extra text) with this structure:
[{"vendor":"string","date":"string","amountXcd":number,"description":"string","catId":"staff|premises|equipment|vehicle|insurance|comms|cme|profees|bank|misc","itemId":"string"}]
Item IDs — staff: rn,anaes,recep1,recep2,medsecy,pracmgr,locum,accountant,legal,payroll_svc,recruit | premises: rent1,rent2,elec1,elec2,water,homeoffice,signage | equipment: cap_ercp,cap_surg,cap_office,cap_fitout,ercp_cons,surg_inst,ppe,diag,gas,equip_svc,sterilise | vehicle: fuel,veh_ins,veh_maint,veh_dep,parking | insurance: malpractice,public_liab,biz_int,prof_ind,keyperson | comms: landlines,mobile,broadband,emr,telehealth,cyber,website,software | cme: esge_conf,carib_conf,airfare,hotel,online_cme,textbooks,simulation,fellowship,slma_cpd | profees: slma,ecsmg,medcouncil,esge_dues,gp_gifts,advertising,stationery | bank: bank_charges,merchant,equip_loan,fitout_loan,overdraft | misc: research,audit_qual,med_waste,postage,uniforms,subscriptions,entertainment,sundry
Currency: all amounts must be XCD. Convert USD×2.70, GBP×3.42, EUR×2.94. If amount unclear set 0. Return ONLY the JSON array, nothing else.`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive]     = useState('profile');
  const [loading, setLoading]   = useState(false);
  const [report, setReport]     = useState('');
  const [ackd, setAckd]         = useState(false);
  const reportRef               = useRef<HTMLDivElement>(null);
  const fileInputRef            = useRef<HTMLInputElement>(null);
  const cameraRef               = useRef<HTMLInputElement>(null);

  const [profile, setProfile]   = useState({
    name:       'Dr. Dawit Daniel Kabiye, MD, DM',
    practice:   'Amise Medical Services',
    taxYear:    '2025',
    grossIncome:'1000000',
    currency:   'XCD',
    apiKey:     '',
    showKey:    false,
  });
  const setP = (k: string, v: string) => setProfile(p => ({ ...p, [k]: v }));

  // claimed[allowance.id] = XCD amount as string
  const [claimed, setClaimed]   = useState<Record<string, string>>({
    personal: '40000',  // auto-fill the guaranteed personal allowance
  });
  const setClaim = (id: string, v: string) => setClaimed(c => ({ ...c, [id]: v }));

  // actual[expenseItem.id] = XCD amount as string
  const [actual, setActual]     = useState<Record<string, string>>({});
  const setAct = (id: string, v: string) => setActual(a => ({ ...a, [id]: v }));

  // action checklist
  const [done, setDone]         = useState<Record<string, boolean>>({});

  // documents
  const [docs, setDocs]         = useState<DocFile[]>([]);
  const toggleDone = (id: string) => setDone(d => ({ ...d, [id]: !d[id] }));

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalClaimed = useMemo(() =>
    ALLOWANCES.reduce((s, a) => s + n(claimed[a.id] ?? 0), 0),
  [claimed]);

  const conservativeExp = useMemo(() =>
    EXPENSE_CATS.reduce((s, cat) => s + cat.items.reduce((cs, i) => cs + i.conservative, 0), 0),
  []);

  const maximumExp = useMemo(() =>
    EXPENSE_CATS.reduce((s, cat) => s + cat.items.reduce((cs, i) => cs + i.maximum, 0), 0),
  []);

  const totalActual = useMemo(() =>
    EXPENSE_CATS.reduce((s, cat) => s + cat.items.reduce((cs, i) => cs + n(actual[i.id] ?? 0), 0), 0),
  [actual]);

  const gross            = n(profile.grossIncome);
  const chargeable       = useMemo(() => Math.max(0, gross - totalClaimed - totalActual), [gross, totalClaimed, totalActual]);
  const taxPayable       = useMemo(() => calcTax(chargeable), [chargeable]);
  const effectiveRate    = gross ? (taxPayable / gross) * 100 : 0;
  const totalDeductions  = totalClaimed + totalActual;

  // Conservative scenario
  const chargeableCons   = Math.max(0, gross - 134000 - conservativeExp);
  const taxCons          = calcTax(chargeableCons);

  // Maximum scenario
  const chargeableMax    = Math.max(0, gross - 208500 - maximumExp);
  const taxMax           = calcTax(chargeableMax);

  // Target: $50K-$70K
  // Working backwards from tax bands: $50K needs ~$212,667 chargeable
  const targetLow        = 50000;
  const targetHigh       = 70000;
  const inTarget         = taxPayable >= targetLow && taxPayable <= targetHigh;

  const pendingActions   = KEY_ACTIONS.filter(a => !done[a.id]);
  const potentialSavings = useMemo(() =>
    pendingActions.reduce((s, a) => s + a.saving, 0),
  [pendingActions]);

  // Pre-flight
  const pf = useMemo(() => {
    const issues: { sev: 'BLOCK'|'WARN'; msg: string }[] = [];
    const ok: string[] = [];
    if (!profile.name)        issues.push({ sev:'BLOCK', msg:'Practitioner name is required' });
    else                      ok.push('Practitioner name provided');
    if (gross < 100000)       issues.push({ sev:'WARN',  msg:`Gross income XCD ${xcd(gross)} seems low for this practice — verify` });
    else                      ok.push(`Gross income ${xcd(gross)} XCD recorded`);
    if (!profile.apiKey)      issues.push({ sev:'BLOCK', msg:'Anthropic API key is required to generate the AI report' });
    else                      ok.push('API key provided');
    if (taxPayable > 87000)   issues.push({ sev:'WARN',  msg:`Current tax ${xcd2(taxPayable)} exceeds conservative target — review deductions` });
    else if (taxPayable < 1500 && totalActual === 0) issues.push({ sev:'WARN', msg:'No business expenses entered — computation may be incomplete' });
    else                      ok.push(`Tax liability ${xcd2(taxPayable)} is within acceptable range`);
    if (!ackd)                issues.push({ sev:'BLOCK', msg:'You must confirm data accuracy before generating AI report' });
    return { issues, ok, blockers: issues.filter(i => i.sev === 'BLOCK') };
  }, [profile.name, profile.apiKey, gross, taxPayable, totalActual, ackd]);

  // ── Fill helpers ──────────────────────────────────────────────────────────
  function fillCatConservative(catId: string) {
    const cat = EXPENSE_CATS.find(c => c.id === catId);
    if (!cat) return;
    setActual(a => {
      const next = { ...a };
      cat.items.forEach(i => { next[i.id] = String(i.conservative); });
      return next;
    });
  }
  function fillCatMaximum(catId: string) {
    const cat = EXPENSE_CATS.find(c => c.id === catId);
    if (!cat) return;
    setActual(a => {
      const next = { ...a };
      cat.items.forEach(i => { next[i.id] = String(i.maximum); });
      return next;
    });
  }
  function fillAllConservative() {
    setActual(() => {
      const next: Record<string, string> = {};
      EXPENSE_CATS.forEach(cat => cat.items.forEach(i => { next[i.id] = String(i.conservative); }));
      return next;
    });
  }
  function fillAllMaximum() {
    setActual(() => {
      const next: Record<string, string> = {};
      EXPENSE_CATS.forEach(cat => cat.items.forEach(i => { next[i.id] = String(i.maximum); }));
      return next;
    });
  }
  function fillAllowancesMax() {
    setClaimed(() => {
      const next: Record<string, string> = {};
      ALLOWANCES.forEach(a => { if (a.max !== null) next[a.id] = String(a.max); });
      return next;
    });
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  function classifyFileType(mime: string, name: string): DocFile['fileType'] {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (['xlsx', 'xls'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'excel';
    return 'csv';
  }

  async function readBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function processDocObj(doc: DocFile) {
    if (!profile.apiKey) return;
    const contentParts: unknown[] = [{ type: 'text', text: EXTRACT_PROMPT }];
    if (doc.fileType === 'image') {
      contentParts.push({ type: 'image', source: { type: 'base64', media_type: doc.mimeType || 'image/jpeg', data: doc.base64 } });
    } else if (doc.fileType === 'pdf') {
      contentParts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 } });
    } else {
      let text = '';
      try {
        if (doc.fileType === 'excel') {
          const XLSX = await import('xlsx');
          const wb = XLSX.read(doc.base64, { type: 'base64' });
          text = wb.SheetNames.map(nm => `Sheet: ${nm}\n${XLSX.utils.sheet_to_csv(wb.Sheets[nm])}`).join('\n\n');
        } else {
          text = atob(doc.base64);
        }
      } catch { text = ''; }
      contentParts.push({ type: 'text', text: `\n\nFILE CONTENT:\n${text.slice(0, 8000)}` });
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, messages: [{ role: 'user', content: contentParts }] }),
      });
      const j = await res.json() as { content?: { text?: string }[]; error?: { message?: string } };
      if (j.error) throw new Error(j.error.message);
      const raw = j.content?.map(b => b.text ?? '').join('') ?? '[]';
      const parsed = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as Array<{
        vendor?: string; date?: string; amountXcd?: number; description?: string; catId?: string; itemId?: string;
      }>;
      const extracted: ExtractedExpense[] = parsed.map((item, idx) => ({
        id: `ext-${doc.id}-${idx}`,
        vendor: item.vendor ?? 'Unknown',
        date: item.date ?? '',
        amountXcd: Number(item.amountXcd) || 0,
        description: item.description ?? '',
        catId: item.catId ?? 'misc',
        itemId: item.itemId ?? 'sundry',
        applied: false,
        sourceDocId: doc.id,
      }));
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'done', extracted } : d));
    } catch (err) {
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'error', errorMsg: String(err) } : d));
    }
  }

  async function processDoc(docId: string) {
    const doc = docs.find(d => d.id === docId);
    if (!doc || doc.status === 'processing') return;
    const processing = { ...doc, status: 'processing' as const };
    setDocs(prev => prev.map(d => d.id === docId ? processing : d));
    await processDocObj(processing);
  }

  async function handleDocFiles(files: FileList | null) {
    if (!files?.length) return;
    const newDocs: DocFile[] = [];
    for (const f of Array.from(files)) {
      const base64 = await readBase64(f);
      newDocs.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name, mimeType: f.type, base64,
        fileType: classifyFileType(f.type, f.name),
        status: profile.apiKey ? 'processing' : 'queued',
        extracted: [],
      });
    }
    setDocs(prev => [...prev, ...newDocs]);
    if (profile.apiKey) {
      for (const doc of newDocs) await processDocObj(doc);
    }
  }

  function applyExtracted(extId: string) {
    const item = docs.flatMap(d => d.extracted).find(e => e.id === extId);
    if (!item) return;
    setActual(a => ({ ...a, [item.itemId]: String(n(a[item.itemId] ?? 0) + item.amountXcd) }));
    setDocs(prev => prev.map(d => ({ ...d, extracted: d.extracted.map(e => e.id === extId ? { ...e, applied: true } : e) })));
  }

  function applyAll() {
    const pending = docs.flatMap(d => d.extracted.filter(e => !e.applied));
    setActual(a => {
      const next = { ...a };
      pending.forEach(e => { next[e.itemId] = String(n(next[e.itemId] ?? 0) + e.amountXcd); });
      return next;
    });
    setDocs(prev => prev.map(d => ({ ...d, extracted: d.extracted.map(e => ({ ...e, applied: true })) })));
  }

  // ── Excel Template Download ────────────────────────────────────────────────
  async function downloadExcelTemplate() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function colLetter(idx: number): string {
      let s = '';
      for (let num = idx + 1; num > 0; ) {
        const r = (num - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        num = Math.floor((num - 1) / 26);
      }
      return s;
    }
    const COL_E = colLetter(4);   // Jan
    const COL_P = colLetter(15);  // Dec
    const COL_Q = colLetter(16);  // Annual Total

    // ── Instructions sheet ──────────────────────────────────────────────────
    const instrWS = XLSX.utils.aoa_to_sheet([
      ['AMISE MEDICAL SERVICES — Tax & Financial Planner (3-Year)'],
      ['IRD Saint Lucia · ITA Cap 15.02 · 2025 Regime · All amounts in XCD (Eastern Caribbean Dollars)'],
      [''],
      ['HOW TO USE THIS WORKBOOK:'],
      ['1. Open the relevant year tab: 2025, 2026, or 2027'],
      ['2. Enter actual XCD amounts paid each month in columns E (Jan) through P (Dec)'],
      ['3. Column Q calculates the Annual Total automatically (SUM formula)'],
      ['4. Save and upload the completed workbook in the Finance Auditor app → Documents tab'],
      ['5. The AI will extract and pre-fill your expense entries from the data'],
      [''],
      ['TAX BANDS — IRD Saint Lucia 2025 (ITA Cap 15.02):'],
      ['  0%  — First XCD 18,000 (personal allowance for all resident taxpayers)'],
      ['  10% — XCD 18,001 to 30,000'],
      ['  15% — XCD 30,001 to 50,000'],
      ['  20% — XCD 50,001 to 80,000'],
      ['  30% — Above XCD 80,000'],
      [''],
      ['IMPORTANT DEADLINES:'],
      ['  Tax return filing: 31 March following the tax year'],
      ['  Complete all qualifying deductions: 31 December of the tax year'],
      [''],
      ['IRD CONTACT:'],
      ['  Online filing: efilingovt.lc'],
      ['  Telephone: 468-4700'],
      ['  Retain all receipts and documents for minimum 7 years (ITA s.73)'],
    ]);
    instrWS['!cols'] = [{ wch: 85 }];
    XLSX.utils.book_append_sheet(wb, instrWS, 'Instructions');

    // ── Year sheets ──────────────────────────────────────────────────────────
    for (const year of [2025, 2026, 2027]) {
      type ARow = (string | number)[];
      const aoa: ARow[] = [];

      // Header rows
      aoa.push(['Category', 'Item / Allowance', `Conservative (${year}) XCD`, `Maximum (${year}) XCD`, ...MONTHS, 'Annual Total XCD']);
      aoa.push(['', '', 'IRD reference figure', 'IRD reference figure', ...MONTHS.map(() => 'Enter actual XCD'), 'Auto-calculated']);
      aoa.push(new Array(17).fill(''));

      // ── PART 1: Personal Allowances ────────────────────────────────────────
      aoa.push([`PART 1 — PERSONAL ALLOWANCES & RELIEFS (ITA Cap 15.02, ${year})`, '', '', '', ...MONTHS.map(() => ''), '']);

      for (const a of ALLOWANCES) {
        aoa.push([
          a.cat,
          a.label + (a.new2025 ? '  ★ NEW 2025' : ''),
          a.max !== null ? a.max : 'Receipted amount',
          a.max !== null ? a.max : 'Receipted amount',
          ...MONTHS.map(() => 0),
          0,
        ]);
      }

      aoa.push(new Array(17).fill(''));

      // ── PART 2: Business Expenses ──────────────────────────────────────────
      aoa.push([`PART 2 — DEDUCTIBLE BUSINESS EXPENSES (ITA s.18, ${year})`, '', '', '', ...MONTHS.map(() => ''), '']);

      for (const cat of EXPENSE_CATS) {
        aoa.push([cat.name, `── ${cat.name} ──`, '', '', ...MONTHS.map(() => ''), '']);
        for (const item of cat.items) {
          aoa.push([
            cat.name,
            item.label,
            item.conservative,
            item.maximum,
            ...MONTHS.map(() => 0),
            0,
          ]);
        }
        aoa.push(new Array(17).fill(''));
      }

      // ── Summary ────────────────────────────────────────────────────────────
      aoa.push([`SUMMARY — ${year}`, '', '', '', ...MONTHS.map(() => ''), '']);
      aoa.push(['INCOME', `Gross Professional Income (XCD) — Tax Year ${year}`, '', '', ...MONTHS.map(() => 0), 0]);
      aoa.push(['SUMMARY', 'Total Personal Allowances (sum from Part 1)', '', '', ...MONTHS.map(() => ''), '']);
      aoa.push(['SUMMARY', 'Total Business Expenses (sum from Part 2)', '', '', ...MONTHS.map(() => ''), '']);
      aoa.push(['SUMMARY', 'Estimated Chargeable Income (Gross − Allowances − Expenses)', '', '', ...MONTHS.map(() => ''), '']);
      aoa.push(['NOTE', 'Use the Finance Auditor app for full band-by-band tax computation', '', '', ...MONTHS.map(() => ''), '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Add SUM formulas for Annual Total column on all numeric data rows
      for (let r = 0; r < aoa.length; r++) {
        if (aoa[r].length >= 17 && typeof aoa[r][4] === 'number') {
          const xlR = r + 1;
          ws[`${COL_Q}${xlR}`] = { t: 'n', f: `SUM(${COL_E}${xlR}:${COL_P}${xlR})` };
        }
      }

      // Column widths
      ws['!cols'] = [
        { wch: 32 },
        { wch: 50 },
        { wch: 20 },
        { wch: 18 },
        ...MONTHS.map(() => ({ wch: 9 })),
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, String(year));
    }

    XLSX.writeFile(wb, 'amise-tax-planner-2025-2027.xlsx');
  }

  // ── AI Report ─────────────────────────────────────────────────────────────
  async function runReport() {
    if (pf.blockers.length > 0) { setActive('preflight'); return; }
    setLoading(true);
    setReport('');
    setActive('report');
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    const prompt = `You are a senior tax consultant and financial auditor specialising in Saint Lucia's IRD tax regime (Income Tax Act Cap 15.02, 2025 Regime). You are advising a medical practitioner.

PRACTITIONER: ${profile.name}
PRACTICE: ${profile.practice}
TAX YEAR: ${profile.taxYear}
CURRENCY: XCD (Eastern Caribbean Dollar)
GROSS PROFESSIONAL INCOME: XCD ${xcd(gross)}

PERSONAL ALLOWANCES CLAIMED: XCD ${xcd(totalClaimed)}
DEDUCTIBLE BUSINESS EXPENSES: XCD ${xcd(totalActual)}
TOTAL DEDUCTIONS: XCD ${xcd(totalDeductions)} (${gross ? ((totalDeductions/gross)*100).toFixed(1) : 0}% of gross)
CHARGEABLE INCOME: XCD ${xcd(chargeable)}
INCOME TAX PAYABLE: XCD ${xcd2(taxPayable)}
EFFECTIVE TAX RATE: ${effectiveRate.toFixed(2)}%

SCENARIO COMPARISON:
- Conservative deductions: Chargeable XCD ${xcd(chargeableCons)}, Tax XCD ${xcd2(taxCons)}
- Maximum deductions: Chargeable XCD ${xcd(chargeableMax)}, Tax XCD ${xcd2(taxMax)}
- Current position: Tax XCD ${xcd2(taxPayable)} — ${inTarget ? '✓ WITHIN $50K–$70K TARGET BAND' : taxPayable < targetLow ? 'BELOW target — risk of appearing under-taxed' : 'ABOVE target — deductions not fully optimised'}

IRD TAX BANDS (2025):
Band 1: First XCD 18,000 @ 0%
Band 2: XCD 18,001–30,000 @ 10%
Band 3: XCD 30,001–50,000 @ 15%
Band 4: XCD 50,001–80,000 @ 20%
Band 5: Above XCD 80,000 @ 30%

PENDING 2025 ACTIONS (potential additional deductions XCD ${xcd(potentialSavings)}):
${pendingActions.map(a => `- ${a.label}: saves XCD ${xcd(a.saving)} — ${a.note}`).join('\n')}

FILING DEADLINE: 31 March 2026 | efilingovt.lc | Tel: 468-4700

Provide a structured tax planning and consultancy report covering:
**1. EXECUTIVE SUMMARY** — Overall tax position, whether it meets the $50K–$70K target, and headline recommendation.
**2. PERSONAL ALLOWANCES ANALYSIS** — Current utilisation vs maximum available ($208,500 for 2025). Key underutilised allowances and how to claim them.
**3. BUSINESS EXPENSE OPTIMISATION** — Commentary on current deductions vs conservative ($508,200) and maximum ($762,000) scenarios. Top categories to review.
**4. TAX COMPUTATION WALKTHROUGH** — Step-by-step breakdown using 2025 IRD bands. Show how chargeable income maps to tax payable.
**5. 2025 ACTION PLAN** — Ranked by tax saving potential. Specific steps to take before 31 December 2025. Documentation requirements.
**6. COMPLIANCE & DOCUMENTATION** — Key records to retain per IRD requirements (7-year rule per ITA s.73). Risk areas requiring careful documentation.
**7. MULTI-YEAR PLANNING** — 2026 and beyond — sustainable tax structure recommendations for a growing medical practice.
**8. RED FLAGS & AUDIT RISKS** — Areas that may attract IRD scrutiny. How to document and mitigate.

Use precise financial language. Quote specific XCD amounts. Reference the ITA where relevant. Be direct and actionable.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': profile.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const j = await res.json() as { content?: { text?: string }[]; error?: { message?: string } };
      if (j.error) { setReport(`Error: ${j.error.message ?? 'API error'}`); }
      else { setReport(j.content?.map(b => b.text ?? '').join('\n') ?? 'No response.'); }
    } catch (e) {
      setReport(`Connection error — check API key and network. ${String(e)}`);
    }
    setLoading(false);
  }

  // ── Section renderers ──────────────────────────────────────────────────────
  function renderProfile() {
    return (
      <div>
        <SH icon="👤" title="Practitioner & Engagement Profile" sub="Pre-loaded for Amise Medical Services — update as needed" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {([
            ['name',       'Practitioner Name'],
            ['practice',   'Practice Name'],
            ['taxYear',    'Tax Year'],
            ['grossIncome','Gross Professional Income (XCD)'],
          ] as const).map(([k, l]) => (
            <div key={k}>
              <label style={labelS}>{l}</label>
              <input style={inputS} value={profile[k]} onChange={e => setP(k, e.target.value)} />
            </div>
          ))}
        </div>

        <Divider label="Anthropic API Key (for AI report)" />
        <div style={{ marginBottom: 12 }}>
          <label style={labelS}>API Key — stays in-memory, never stored or logged</label>
          <div style={{ position: 'relative' }}>
            <input
              type={profile.showKey ? 'text' : 'password'}
              style={{ ...inputS, paddingRight: 70 }}
              value={profile.apiKey}
              placeholder="sk-ant-api03-…"
              onChange={e => setP('apiKey', e.target.value)}
            />
            <button
              onClick={() => setP('showKey', String(!profile.showKey))}
              style={{ position: 'absolute', right: 8, top: 6, background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 10 }}
            >
              {profile.showKey ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', marginTop: 12 }}>
          <p style={{ color: C.muted, fontSize: 10, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: C.dim }}>🔒 Privacy:</strong> All financial data is processed client-side in-memory.
            Data is only transmitted to the Anthropic API when you explicitly generate a report, using your own API key.
            No data is stored on any server. Retain all source documents per ITA s.73 (7-year rule).
          </p>
        </div>

        <Divider label="Tax Year Summary — Live" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <KV label="Gross Income" value={xcd(gross)} color={C.blue} />
          <KV label="Total Deductions" value={xcd(totalDeductions)} color={C.green} />
          <KV label="Chargeable Income" value={xcd(chargeable)} color={C.amber} />
          <KV label="Tax Payable" value={xcd2(taxPayable)} color={taxPayable <= 70000 ? C.green : C.red} large />
        </div>
      </div>
    );
  }

  function renderAllowances() {
    const cats = [...new Set(ALLOWANCES.map(a => a.cat))];
    return (
      <div>
        <SH icon="🏠" title="Part 1 — Personal Allowances & Reliefs" sub="ITA Cap 15.02 — 2025 Regime. Enter your actual claimed amounts." />
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={fillAllowancesMax} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${C.green}`, background: C.greenBg, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 10 }}>
            ↑ Fill All to Maximum
          </button>
          <button onClick={() => setClaimed({ personal: '40000' })} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}>
            Reset
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: C.dim, fontSize: 10 }}>Total claimed:</span>
            <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>{xcd(totalClaimed)}</span>
            <span style={{ color: C.muted, fontSize: 10 }}>/ {xcd(208500)} max</span>
          </div>
        </div>

        {cats.map(cat => {
          const items = ALLOWANCES.filter(a => a.cat === cat);
          const catTotal = items.reduce((s, a) => s + n(claimed[a.id] ?? 0), 0);
          return (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ background: C.card, borderRadius: '6px 6px 0 0', padding: '7px 12px', border: `1px solid ${C.border}`, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: C.blue, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cat}</span>
                <span style={{ color: catTotal > 0 ? C.green : C.muted, fontWeight: 700, fontSize: 11 }}>{xcd(catTotal)}</span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                {items.map((a, idx) => (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: 0, borderBottom: idx < items.length - 1 ? `1px solid ${C.border}` : 'none', background: idx % 2 === 0 ? C.panel : C.card }}>
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        {a.new2025 && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: C.greenBg, color: C.green, border: `1px solid ${C.green}33` }}>★ NEW 2025</span>}
                        <span style={{ color: C.text, fontSize: 11 }}>{a.label}</span>
                      </div>
                      <div style={{ color: C.muted, fontSize: 9, lineHeight: 1.4 }}>{a.note}</div>
                    </div>
                    <div style={{ padding: '8px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${C.border}` }}>
                      <span style={{ color: C.dim, fontSize: 11, fontWeight: 600 }}>
                        {a.max !== null ? xcd(a.max) : 'Receipted'}
                      </span>
                    </div>
                    <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', borderLeft: `1px solid ${C.border}` }}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.blue, fontWeight: 700, fontSize: 12 }}>$</span>
                        <input
                          type="number"
                          value={claimed[a.id] ?? ''}
                          onChange={e => setClaim(a.id, e.target.value)}
                          placeholder="0"
                          style={{ ...inputS, paddingLeft: 18, fontSize: 12 }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>Total Personal Allowances Claimed</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: C.green, fontWeight: 800, fontSize: 18 }}>{xcd(totalClaimed)}</span>
            <div style={{ color: C.dim, fontSize: 10 }}>Conservative: {xcd(134000)} · Maximum: {xcd(208500)}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderExpenses() {
    return (
      <div>
        <SH icon="🏥" title="Part 2 — Deductible Business Expenses" sub="ITA s.18 — Amise Medical Services. Enter actual claimed amounts or use fill buttons." />
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={fillAllConservative} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${C.amber}`, background: C.amberBg, color: C.amber, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 10 }}>
            Fill All — Conservative ({xcd(conservativeExp)})
          </button>
          <button onClick={fillAllMaximum} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${C.green}`, background: C.greenBg, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 10 }}>
            Fill All — Maximum ({xcd(maximumExp)})
          </button>
          <button onClick={() => setActual({})} style={{ padding: '5px 14px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}>
            Reset All
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: C.dim, fontSize: 10 }}>Total:</span>
            <span style={{ color: C.blue, fontWeight: 700, fontSize: 14 }}>{xcd(totalActual)}</span>
            <span style={{ color: C.muted, fontSize: 10 }}>/ {xcd(maximumExp)} max</span>
          </div>
        </div>

        {EXPENSE_CATS.map(cat => {
          const catActual = cat.items.reduce((s, i) => s + n(actual[i.id] ?? 0), 0);
          const catMax = cat.items.reduce((s, i) => s + i.maximum, 0);
          const catCons = cat.items.reduce((s, i) => s + i.conservative, 0);
          return (
            <div key={cat.id} style={{ marginBottom: 14 }}>
              <div style={{ background: C.card, borderRadius: '6px 6px 0 0', padding: '8px 12px', border: `1px solid ${C.border}`, borderBottom: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: cat.color, fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>{cat.name}</span>
                <button onClick={() => fillCatConservative(cat.id)} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.amber}33`, background: 'transparent', color: C.amber, cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, fontWeight: 700 }}>
                  CONSERVATIVE
                </button>
                <button onClick={() => fillCatMaximum(cat.id)} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${C.green}33`, background: 'transparent', color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: 9, fontWeight: 700 }}>
                  MAXIMUM
                </button>
                <span style={{ color: catActual > 0 ? cat.color : C.muted, fontWeight: 700, fontSize: 11, minWidth: 70, textAlign: 'right' }}>
                  {xcd(catActual)} <span style={{ color: C.muted, fontWeight: 400, fontSize: 9 }}>/ {xcd(catMax)}</span>
                </span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px', background: '#05111e', borderBottom: `1px solid ${C.border}` }}>
                  {['Item', 'Conservative', 'Maximum', 'Actual (XCD)'].map(h => (
                    <div key={h} style={{ padding: '5px 10px', color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: h === 'Item' ? 'left' : 'center' }}>{h}</div>
                  ))}
                </div>
                {cat.items.map((item, idx) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px', borderBottom: idx < cat.items.length - 1 ? `1px solid ${C.border}` : 'none', background: idx % 2 === 0 ? C.panel : C.card }}>
                    <div style={{ padding: '7px 10px', color: C.text, fontSize: 11 }}>{item.label}</div>
                    <div style={{ padding: '7px 8px', color: C.dim, fontSize: 11, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>{xcd(item.conservative)}</div>
                    <div style={{ padding: '7px 8px', color: C.dim, fontSize: 11, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>{xcd(item.maximum)}</div>
                    <div style={{ padding: '4px 6px', borderLeft: `1px solid ${C.border}` }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: C.blue, fontWeight: 700, fontSize: 12 }}>$</span>
                        <input
                          type="number"
                          value={actual[item.id] ?? ''}
                          onChange={e => setAct(item.id, e.target.value)}
                          placeholder="0"
                          style={{ ...inputS, paddingLeft: 18, fontSize: 11, textAlign: 'right' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 100px', background: '#040d16', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ padding: '7px 10px', color: C.dim, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Category Total</div>
                  <div style={{ padding: '7px 8px', color: C.amber, fontSize: 11, fontWeight: 700, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>{xcd(catCons)}</div>
                  <div style={{ padding: '7px 8px', color: C.green, fontSize: 11, fontWeight: 700, textAlign: 'center', borderLeft: `1px solid ${C.border}` }}>{xcd(catMax)}</div>
                  <div style={{ padding: '7px 8px', color: cat.color, fontSize: 11, fontWeight: 700, textAlign: 'right', borderLeft: `1px solid ${C.border}` }}>{xcd(catActual)}</div>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ background: C.greenBg, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ color: C.green, fontWeight: 700, fontSize: 12 }}>Total Business Expenses</span>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: C.green, fontWeight: 800, fontSize: 18 }}>{xcd(totalActual)}</span>
            <div style={{ color: C.dim, fontSize: 10 }}>Conservative: {xcd(conservativeExp)} · Maximum: {xcd(maximumExp)}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderTax() {
    const bands = taxBandBreakdown(chargeable);
    return (
      <div>
        <SH icon="🏛️" title="Tax Computation — IRD Saint Lucia 2025" sub="Income Tax Act Cap 15.02 — automatic band-by-band calculation" />

        {/* Summary tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          <KV label="Gross Income" value={xcd(gross)} color={C.blue} />
          <KV label="Personal Allowances" value={`(${xcd(totalClaimed)})`} color={C.green} />
          <KV label="Business Expenses" value={`(${xcd(totalActual)})`} color={C.green} />
          <KV label="Chargeable Income" value={xcd(chargeable)} color={C.amber} />
          <KV label="Income Tax Payable" value={xcd2(taxPayable)} color={taxPayable <= 70000 ? C.green : C.red} large />
          <KV label="Effective Rate" value={`${effectiveRate.toFixed(2)}%`} color={effectiveRate <= 7 ? C.green : effectiveRate <= 12 ? C.amber : C.red} />
        </div>

        {/* Band breakdown */}
        <Divider label="IRD Tax Band Breakdown" />
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 100px 100px', background: '#05111e', padding: '6px 12px', borderBottom: `1px solid ${C.border}` }}>
            {['Tax Band', 'Rate', 'Taxable Amount', 'Tax in Band'].map(h => (
              <div key={h} style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
            ))}
          </div>
          {bands.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 100px 100px', padding: '8px 12px', borderBottom: i < bands.length - 1 ? `1px solid ${C.border}` : 'none', background: b.taxable > 0 ? (i % 2 === 0 ? C.panel : C.card) : 'transparent' }}>
              <span style={{ color: b.taxable > 0 ? C.text : C.muted, fontSize: 11 }}>{b.band}</span>
              <span style={{ color: b.rate === '0%' ? C.green : C.amber, fontSize: 11, fontWeight: 700 }}>{b.rate}</span>
              <span style={{ color: b.taxable > 0 ? C.dim : C.muted, fontSize: 11 }}>{b.taxable > 0 ? xcd(b.taxable) : '—'}</span>
              <span style={{ color: b.tax > 0 ? C.red : C.muted, fontSize: 11, fontWeight: b.tax > 0 ? 700 : 400 }}>{b.tax > 0 ? xcd2(b.tax) : '—'}</span>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 100px 100px', padding: '8px 12px', background: '#040d16', borderTop: `1px solid ${C.border}` }}>
            <span style={{ color: C.dim, fontSize: 10, fontWeight: 700 }}>TOTAL</span>
            <span />
            <span style={{ color: C.amber, fontSize: 12, fontWeight: 700 }}>{xcd(chargeable)}</span>
            <span style={{ color: C.red, fontSize: 12, fontWeight: 800 }}>{xcd2(taxPayable)}</span>
          </div>
        </div>

        {/* Scenario comparison */}
        <Divider label="Scenario Comparison" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Maximum Deductions', chargeable: chargeableMax, tax: taxMax, note: 'All 2025 allowances + max expenses', color: C.green },
            { label: 'Current Position', chargeable, tax: taxPayable, note: 'Your entered deductions', color: C.blue },
            { label: 'Conservative Base', chargeable: chargeableCons, tax: taxCons, note: 'Core allowances + documented expenses', color: C.amber },
          ].map(s => (
            <div key={s.label} style={{ background: C.card, border: `1px solid ${s.color}33`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ color: s.color, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>{s.label}</div>
              <div style={{ color: C.dim, fontSize: 10, marginBottom: 8 }}>{s.note}</div>
              <div style={{ color: C.dim, fontSize: 10, marginBottom: 2 }}>Chargeable: <span style={{ color: s.color }}>{xcd(s.chargeable)}</span></div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 16 }}>{xcd2(s.tax)}</div>
              <div style={{ color: C.muted, fontSize: 9, marginTop: 4 }}>Eff. rate: {gross ? ((s.tax / gross) * 100).toFixed(1) : 0}%</div>
            </div>
          ))}
        </div>

        {/* Target band */}
        <div style={{ background: inTarget ? C.greenBg : taxPayable < targetLow ? C.purpleBg : C.amberBg, border: `1px solid ${inTarget ? C.green : taxPayable < targetLow ? C.purple : C.amber}44`, borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: inTarget ? C.green : taxPayable < targetLow ? C.purple : C.amber, marginBottom: 6 }}>
            {inTarget ? '✓ Within Target Band' : taxPayable < targetLow ? '↓ Below Target Range' : '↑ Above Target Range'}
          </div>
          <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>
            Target: <strong>XCD $50,000–$70,000</strong> tax (5.0–7.0% effective rate on $1M gross).<br />
            Current: <strong>{xcd2(taxPayable)}</strong> ({effectiveRate.toFixed(2)}% effective rate).<br />
            {!inTarget && taxPayable < targetLow && <span>Consider documenting more deductions conservatively — risk of appearing under-taxed. Total deductions = {((totalDeductions/gross)*100).toFixed(1)}% of gross.</span>}
            {!inTarget && taxPayable > targetHigh && <span>Review pending allowances and expense categories. Remaining potential savings: <strong>{xcd(potentialSavings)}</strong> XCD from 2025 actions.</span>}
          </div>
        </div>
      </div>
    );
  }

  function renderActions() {
    const completedSavings = KEY_ACTIONS.filter(a => done[a.id]).reduce((s, a) => s + a.saving, 0);
    return (
      <div>
        <SH icon="✅" title="Key 2025 Action Plan" sub="Complete before 31 December 2025 to maximise deductions. Filing deadline: 31 March 2026." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <KV label="Pending savings" value={xcd(potentialSavings)} color={C.amber} />
          <KV label="Actions secured" value={xcd(completedSavings)} color={C.green} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {KEY_ACTIONS.map(a => (
            <div
              key={a.id}
              onClick={() => toggleDone(a.id)}
              style={{
                background: done[a.id] ? C.greenBg : C.card,
                border: `1px solid ${done[a.id] ? C.green + '44' : C.border}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                border: `2px solid ${done[a.id] ? C.green : C.border}`,
                background: done[a.id] ? C.green : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done[a.id] && <span style={{ color: '#000', fontSize: 12, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ color: done[a.id] ? C.green : C.text, fontWeight: 700, fontSize: 12, textDecoration: done[a.id] ? 'line-through' : 'none' }}>{a.label}</span>
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 13, flexShrink: 0, marginLeft: 10 }}>{xcd(a.saving)}</span>
                </div>
                <div style={{ color: C.muted, fontSize: 10, lineHeight: 1.5 }}>{a.note}</div>
                <div style={{ color: C.amber, fontSize: 10, marginTop: 4 }}>Deadline: {a.deadline}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px 14px', background: C.amberBg, border: `1px solid ${C.amber}33`, borderRadius: 8 }}>
          <div style={{ color: C.amber, fontWeight: 700, fontSize: 11, marginBottom: 6 }}>⚠ Filing Deadline: 31 March 2026</div>
          <div style={{ color: C.text, fontSize: 11, lineHeight: 1.6 }}>
            File online at <strong>efilingovt.lc</strong> or call <strong>Tel: 468-4700</strong>.<br />
            Retain all receipts and supporting documents for minimum 7 years (ITA s.73).
          </div>
        </div>
      </div>
    );
  }

  function renderPreflight() {
    return (
      <div>
        <SH icon="🛡️" title="Pre-Flight Review" sub="All blockers must be resolved before generating the AI report." />
        {pf.blockers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ color: C.red, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 700 }}>🚫 Blockers — must resolve</p>
            {pf.blockers.map((b, i) => <Alert key={i} type="error" msg={b.msg} />)}
          </div>
        )}
        {pf.issues.filter(i => i.sev === 'WARN').length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ color: C.amber, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 700 }}>⚠ Warnings — review before proceeding</p>
            {pf.issues.filter(i => i.sev === 'WARN').map((w, i) => <Alert key={i} type="warn" msg={w.msg} />)}
          </div>
        )}
        {pf.ok.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ color: C.green, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 700 }}>✓ Checks passed</p>
            {pf.ok.map((o, i) => <Alert key={i} type="ok" msg={o} />)}
          </div>
        )}
        <Divider label="Data summary" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
          <KV label="Gross Income" value={xcd(gross)} />
          <KV label="Personal Allowances" value={xcd(totalClaimed)} color={C.green} />
          <KV label="Business Expenses" value={xcd(totalActual)} color={C.green} />
          <KV label="Chargeable Income" value={xcd(chargeable)} color={C.amber} />
          <KV label="Tax Payable" value={xcd2(taxPayable)} color={taxPayable <= 70000 ? C.green : C.red} large />
          <KV label="Effective Rate" value={`${effectiveRate.toFixed(2)}%`} color={effectiveRate <= 7 ? C.green : C.amber} />
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <p style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>Confirmation required before AI analysis</p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={ackd} onChange={e => setAckd(e.target.checked)} style={{ marginTop: 2, accentColor: C.blue }} />
            <span style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>
              I confirm this financial data is accurate to the best of my knowledge and I authorise transmitting it to the Anthropic API for analysis.
              I understand this is a planning tool — formal tax advice should be confirmed with a registered Saint Lucia tax practitioner before filing.
            </span>
          </label>
        </div>
        <button
          onClick={runReport}
          disabled={pf.blockers.length > 0}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 6, border: 'none',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: pf.blockers.length > 0 ? 'not-allowed' : 'pointer',
            background: pf.blockers.length > 0 ? C.panel : 'linear-gradient(135deg,#1a6aff,#0a3aaa)',
            color: pf.blockers.length > 0 ? C.muted : '#fff',
            boxShadow: pf.blockers.length > 0 ? 'none' : '0 0 20px rgba(74,158,255,0.2)',
          }}
        >
          {pf.blockers.length > 0 ? `🚫 Resolve ${pf.blockers.length} blocker(s) first` : '🧠 Generate AI Tax Report →'}
        </button>
      </div>
    );
  }

  function renderReport() {
    return (
      <div ref={reportRef}>
        <SH icon="🧠" title="AI Tax & Financial Consultancy Report" sub={`${profile.practice} | Tax Year ${profile.taxYear} | Powered by Claude`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
          <KV label="Tax Payable" value={xcd2(taxPayable)} color={taxPayable <= 70000 ? C.green : C.red} large />
          <KV label="Effective Rate" value={`${effectiveRate.toFixed(2)}%`} color={effectiveRate <= 7 ? C.green : C.amber} />
          <KV label="Target Status" value={inTarget ? '✓ ON TARGET' : taxPayable < targetLow ? 'BELOW TARGET' : 'ABOVE TARGET'} color={inTarget ? C.green : taxPayable < targetLow ? C.purple : C.amber} />
        </div>

        {!loading && (
          <button onClick={runReport} disabled={pf.blockers.length > 0} style={{
            width: '100%', padding: '10px 0', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'linear-gradient(135deg,#1a6aff22,#1a6aff44)', color: C.blue,
            fontFamily: 'inherit', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em',
            textTransform: 'uppercase', cursor: pf.blockers.length > 0 ? 'not-allowed' : 'pointer', marginBottom: 16,
          }}>
            {report ? '🔄 Regenerate Report' : '🧠 Generate Report'}
          </button>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: C.blue, fontSize: 12, padding: '40px 0', letterSpacing: '0.08em' }}>
            Generating tax consultancy report via Anthropic API…
          </div>
        )}

        {report && !loading && (
          <div style={{ background: '#040a12', border: `1px solid ${C.border}`, borderRadius: 8, padding: 18 }}>
            {report.split('\n').map((line, i) => {
              const clean = line.replace(/\*\*(.+?)\*\*/g, '$1');
              if (/^\*\*\d+\./.test(line) || /^\*\*[A-Z]/.test(line))
                return <p key={i} style={{ color: C.blue, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 18, marginBottom: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>{clean}</p>;
              if (line.startsWith('- ') || line.startsWith('• '))
                return <p key={i} style={{ color: C.text, fontSize: 12, marginTop: 3, paddingLeft: 14, lineHeight: 1.65 }}>• {clean.slice(2)}</p>;
              if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
              return <p key={i} style={{ color: '#a8c8e8', fontSize: 12, lineHeight: 1.7, marginTop: 4 }}>{clean}</p>;
            })}
          </div>
        )}
      </div>
    );
  }

  function renderDocuments() {
    const allPending  = docs.flatMap(d => d.extracted.filter(e => !e.applied));
    const appliedCount = docs.flatMap(d => d.extracted.filter(e => e.applied)).length;
    const totalXcd    = allPending.reduce((s, e) => s + e.amountXcd, 0);
    return (
      <div>
        <SH icon="📎" title="Documents & Receipts"
          sub="Upload receipts, invoices, PDFs, photos or spreadsheets — AI extracts and pre-fills expense entries" />

        {/* Excel template download */}
        <div style={{ background: C.card, border: `1px solid ${C.green}33`, borderRadius: 8, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.green, fontWeight: 700, fontSize: 11, marginBottom: 3 }}>📥 Download 3-Year Monthly Input Template</div>
            <div style={{ color: C.muted, fontSize: 10, lineHeight: 1.5 }}>
              Pre-formatted Excel workbook with all allowances &amp; expense lines as rows, monthly columns Jan–Dec, for 2025 · 2026 · 2027.
              Fill in your monthly figures, then upload the completed file here for AI extraction.
            </div>
          </div>
          <button
            onClick={() => void downloadExcelTemplate()}
            style={{ padding: '9px 18px', borderRadius: 6, border: `1px solid ${C.green}`, background: C.greenBg, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, letterSpacing: '0.07em', whiteSpace: 'nowrap' }}
          >
            📥 Download .xlsx
          </button>
        </div>

        {!profile.apiKey && (
          <Alert type="warn" msg="Add your Anthropic API key in Profile to enable AI document scanning" />
        )}

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); void handleDocFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}
        >
          <div style={{ fontSize: 30, marginBottom: 6 }}>📎</div>
          <div style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>Drop files here or tap to browse</div>
          <div style={{ color: C.muted, fontSize: 10, marginTop: 3 }}>Receipts · Invoices · PDFs · Photos · Excel (.xlsx) · CSV</div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv"
            style={{ display: 'none' }} onChange={e => void handleDocFiles(e.target.files)} />
        </div>

        {/* Camera button (opens photo library + camera on mobile) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => cameraRef.current?.click()}
            style={{ flex: 1, padding: '9px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>
            📸 Photograph Receipt / Stub
          </button>
          <input ref={cameraRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={e => void handleDocFiles(e.target.files)} />
          {docs.length > 0 && (
            <button onClick={() => setDocs([])}
              style={{ padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10 }}>
              Clear All
            </button>
          )}
        </div>

        {/* Processing queue */}
        {docs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6, fontWeight: 700 }}>
              Document Queue
            </p>
            {docs.map(doc => (
              <div key={doc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>
                  {doc.fileType === 'image' ? '🖼️' : doc.fileType === 'pdf' ? '📄' : '📊'}
                </span>
                <span style={{ flex: 1, color: C.text, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                {doc.status === 'processing' && <span style={{ color: C.blue, fontSize: 10 }}>⟳ Processing…</span>}
                {doc.status === 'done' && (
                  <span style={{ color: C.green, fontSize: 10 }}>
                    ✓ {doc.extracted.length} item{doc.extracted.length !== 1 ? 's' : ''}
                  </span>
                )}
                {doc.status === 'error' && (
                  <span style={{ color: C.red, fontSize: 10 }} title={doc.errorMsg}>✕ Error</span>
                )}
                {doc.status === 'queued' && (
                  <button onClick={() => void processDoc(doc.id)} disabled={!profile.apiKey}
                    style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: profile.apiKey ? C.blue : C.muted, cursor: profile.apiKey ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 10 }}>
                    Process
                  </button>
                )}
                <button onClick={() => setDocs(prev => prev.filter(d => d.id !== doc.id))}
                  style={{ padding: '2px 6px', border: 'none', background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Extracted items review table */}
        {allPending.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                Extracted — {allPending.length} pending · {xcd(totalXcd)} XCD
              </span>
              <button onClick={applyAll}
                style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: 'linear-gradient(135deg,#1a6aff,#0a3aaa)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 10 }}>
                ✓ Apply All
              </button>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.9fr 2fr 54px', padding: '6px 12px', background: C.panel, borderBottom: `1px solid ${C.border}` }}>
                {['Vendor', 'Description', 'Amount', 'Expense Line', ''].map((h, i) => (
                  <span key={i} style={{ color: C.muted, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{h}</span>
                ))}
              </div>
              {allPending.map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.9fr 2fr 54px', padding: '7px 12px', borderBottom: `1px solid ${C.border}22`, alignItems: 'center', gap: 4 }}>
                  <div style={{ color: C.text, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.vendor}>{item.vendor}</div>
                  <div style={{ color: C.muted, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>{item.description || item.date}</div>
                  <div style={{ color: C.green, fontWeight: 700, fontSize: 11 }}>{xcd(item.amountXcd)}</div>
                  <select
                    value={item.itemId}
                    onChange={e => {
                      const nid = e.target.value;
                      const newCat = EXPENSE_CATS.find(c => c.items.some(i => i.id === nid));
                      setDocs(prev => prev.map(d => ({
                        ...d,
                        extracted: d.extracted.map(ex => ex.id === item.id
                          ? { ...ex, itemId: nid, catId: newCat?.id ?? ex.catId }
                          : ex),
                      })));
                    }}
                    style={{ ...inputS, fontSize: 10, padding: '2px 4px' }}
                  >
                    {EXPENSE_CATS.map(c => (
                      <optgroup key={c.id} label={c.name.replace(/^\d+\.\s*/, '').slice(0, 28)}>
                        {c.items.map(i => <option key={i.id} value={i.id}>{i.label.slice(0, 34)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => applyExtracted(item.id)}
                    style={{ width: 50, padding: '4px 0', borderRadius: 4, border: 'none', background: C.greenBg, color: C.green, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700 }}>
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {appliedCount > 0 && (
          <div style={{ marginTop: 10 }}>
            <Alert type="ok" msg={`${appliedCount} item(s) applied to business expenses — review totals in Business Exp. tab`} />
          </div>
        )}

        {docs.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '16px 14px', marginTop: 8 }}>
            <p style={{ color: C.muted, fontSize: 10, lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: C.dim }}>Supported formats</strong><br />
              📸 <strong style={{ color: C.text }}>Photos</strong> — photograph receipts, payment stubs, or even an Excel spreadsheet with your phone camera<br />
              📄 <strong style={{ color: C.text }}>PDF</strong> — clinic invoices, bank statements, insurance receipts, tax certificates<br />
              📊 <strong style={{ color: C.text }}>Excel / CSV</strong> — exported bank transactions, expense spreadsheets (.xlsx, .xls, .csv)<br /><br />
              Claude reads each file and extracts vendor, date, amount, and suggested expense category.
              You review and apply each item — amounts are added directly to the matching expense fields.
            </p>
          </div>
        )}
      </div>
    );
  }

  const pfBadge = pf.blockers.length ? `${pf.blockers.length} 🚫` : pf.issues.filter(i => i.sev === 'WARN').length ? `${pf.issues.filter(i => i.sev === 'WARN').length} ⚠` : '✓';
  const pfColor = pf.blockers.length ? C.red : pf.issues.some(i => i.sev === 'WARN') ? C.amber : C.green;

  return (
    <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", background: C.bg, minHeight: '100vh', color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,#0a1628,#060d18)', borderBottom: `1px solid ${C.border}`, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 980, margin: '0 auto' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#1a6aff,#0a3aaa)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🏛️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#e8f4ff' }}>AMISE — TAX & FINANCIAL CONSULTANCY</div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.15em', marginTop: 2 }}>IRD SAINT LUCIA · ITA CAP 15.02 · 2025 REGIME · ALL AMOUNTS XCD</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: C.dim, fontSize: 9, letterSpacing: '0.1em' }}>CURRENT TAX PAYABLE</div>
              <div style={{ color: taxPayable <= 70000 ? C.green : C.red, fontWeight: 800, fontSize: 16 }}>{xcd2(taxPayable)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: C.dim, fontSize: 9, letterSpacing: '0.1em' }}>EFFECTIVE RATE</div>
              <div style={{ color: effectiveRate <= 7 ? C.green : C.amber, fontWeight: 800, fontSize: 16 }}>{effectiveRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 12px 0', borderBottom: `1px solid ${C.border}`, background: '#07111f', overflowX: 'auto' }}>
        {SECTIONS.map(s => {
          const isPF = s.id === 'preflight';
          return (
            <button key={s.id} onClick={() => setActive(s.id)} style={{
              padding: '6px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
              borderRadius: '5px 5px 0 0', border: '1px solid', borderBottom: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: active === s.id ? C.panel : 'transparent',
              borderColor: active === s.id ? C.border : 'transparent',
              color: active === s.id ? C.blue : C.muted,
            }}>
              {s.icon} {s.label}
              {isPF && <span style={{ marginLeft: 5, color: pfColor, fontSize: 9, fontWeight: 700 }}>{pfBadge}</span>}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '22px 16px 60px' }}>
        {active === 'profile'    && renderProfile()}
        {active === 'allowances' && renderAllowances()}
        {active === 'expenses'   && renderExpenses()}
        {active === 'tax'        && renderTax()}
        {active === 'actions'    && renderActions()}
        {active === 'preflight'  && renderPreflight()}
        {active === 'report'     && renderReport()}
        {active === 'documents'  && renderDocuments()}

        {!['preflight', 'report', 'documents'].includes(active) && (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => { const i = SECTIONS.findIndex(s => s.id === active); if (i < SECTIONS.length - 1) setActive(SECTIONS[i + 1].id); }}
              style={{ padding: '9px 22px', borderRadius: 6, border: `1px solid ${C.blue}`, background: 'transparent', color: C.blue, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em' }}
            >
              NEXT →
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 10, borderTop: `1px solid ${C.border}`, color: '#1e3a5f', fontSize: 9, letterSpacing: '0.1em' }}>
        AMISE MEDICAL SERVICES · DR. DAWIT DANIEL KABIYE, MD · IRD SAINT LUCIA · ITA CAP 15.02 · 2025 REGIME · REFERENCE ONLY — ENGAGE A REGISTERED TAX PRACTITIONER FOR FORMAL FILING
      </div>
    </div>
  );
}
