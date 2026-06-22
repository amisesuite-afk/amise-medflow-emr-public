import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8787;
const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'data', 'db.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${nanoid(8)}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 30 * 1024 * 1024, files: 30 } });

// ─── PAYROLL DEFAULTS (Saint Lucia ITA Cap 15.02) ─────────────────────────────

// ─── IRD SAINT LUCIA 2025 TAX BANDS (ITA Cap 15.02) ──────────────────────────
const TAX_BANDS = [
  { from:0,     to:18000, rate:0.00, label:'Band 1  First XCD 18,000'      },
  { from:18000, to:30000, rate:0.10, label:'Band 2  XCD 18,001–30,000'     },
  { from:30000, to:50000, rate:0.15, label:'Band 3  XCD 30,001–50,000'     },
  { from:50000, to:80000, rate:0.20, label:'Band 4  XCD 50,001–80,000'     },
  { from:80000, to:null,  rate:0.30, label:'Band 5  Above XCD 80,000'      },
];
function calcTax(income){
  let tax=0;
  for(const b of TAX_BANDS){
    if(income<=b.from) break;
    const top=b.to===null?income:Math.min(income,b.to);
    tax+=(top-b.from)*b.rate;
  }
  return tax;
}

// ─── PERSONAL ALLOWANCES (ITA Cap 15.02, 2025 Regime) ────────────────────────
const ALLOWANCES = [
  {id:'personal',    label:'Personal Allowance (resident individual)',        max:40000,  cat:'Core Personal',          note:'2025: raised from $18,000 — automatic for all resident taxpayers',                       new2025:true },
  {id:'spouse',      label:'Spouse / Partner Allowance',                      max:null,   cat:'Core Personal',          note:'Confirm eligibility per ITA s.26(1)(b) with IRD',                                        new2025:false},
  {id:'child_nu',    label:'Child Allowance — per child (non-university)',    max:5000,   cat:'Family & Dependents',    note:'2025: raised to $5,000/child; proof of maintenance required',                            new2025:true },
  {id:'child_u',     label:'Child Allowance — full-time university student',  max:10000,  cat:'Family & Dependents',    note:'$10,000/child; proof of attendance + fees/housing paid',                                 new2025:true },
  {id:'dep_rel',     label:'Dependent Relative Allowance — per relative',     max:5000,   cat:'Family & Dependents',    note:'2025: raised to $5,000; relative maintained by taxpayer',                                new2025:true },
  {id:'life_ins',    label:'Life Insurance Premiums (own life policy)',        max:5000,   cat:'Insurance & Retirement', note:'Unchanged; statements indicating premiums paid for year',                                 new2025:false},
  {id:'pension',     label:'Approved Pension / RRSP / Annuity Contributions', max:6000,   cat:'Insurance & Retirement', note:'Approved fund only; statements of contributions required',                               new2025:false},
  {id:'health_ins',  label:'Health / Medical Insurance Premiums (personal)',  max:null,   cat:'Insurance & Retirement', note:'Personal policy — statements of premiums paid',                                           new2025:false},
  {id:'rrsp',        label:'Individual Registered Retirement Savings Plan',   max:null,   cat:'Insurance & Retirement', note:'Letter from financial institution stating amount contributed',                            new2025:false},
  {id:'mortgage',    label:'Mortgage Interest Relief — owner-occupied',       max:40000,  cat:'Housing & Property',     note:'2025: MAJOR raise $8,000→$40,000; interest statement + block & parcel; SLU property only',new2025:true },
  {id:'student_loan',label:'Student Loan Interest',                           max:40000,  cat:'Housing & Property',     note:'2025: NEW — statement of interest paid on qualifying student loan',                       new2025:true },
  {id:'house_ins',   label:'House Insurance Premiums + House Tax',            max:null,   cat:'Housing & Property',     note:'2025: NEW — statement of premiums paid and payment receipts',                            new2025:true },
  {id:'repairs',     label:'Repairs / Maintenance to Owner-Occupied Property',max:10000,  cat:'Housing & Property',     note:'2025: NEW — max $10,000; all bills/receipts + written description of work',               new2025:true },
  {id:'rhosp',       label:'Registered Home Ownership Savings Plan',          max:null,   cat:'Housing & Property',     note:'Letter from financial institution',                                                       new2025:false},
  {id:'credit_union',label:'Credit Union / Co-operative Society Shares',      max:10000,  cat:'Investments & Savings',  note:'2025: NEW — credit union share statements; max $10,000 p.a.',                           new2025:true },
  {id:'local_invest',label:'Local & Regional Investment Instruments',         max:10000,  cat:'Investments & Savings',  note:'2025: NEW — T-bills, bonds, shares, mutual funds; local/regional issuer',                new2025:true },
  {id:'solar',       label:'Solar Photovoltaic — purchase & installation',    max:25000,  cat:'Green Energy',           note:'2025: NEW — all bills AND receipts for purchase and installation; max $25,000',           new2025:true },
  {id:'road_rehab',  label:'Community Road Rehabilitation Works Project',     max:5000,   cat:'Green Energy',           note:'2025: NEW — proof of registration + proof of payment; max $5,000',                       new2025:true },
  {id:'medical',     label:'Medical / Dental Expenses (self & family)',       max:null,   cat:'Medical Expenses',       note:'2025: EXPANDED — includes fertility treatments and dependent care; receipts required',    new2025:true },
  {id:'nic',         label:'NIC Self-Employed Contributions (Class 4)',        max:null,   cat:'NIC',                    note:'Confirm deductibility with NIC Board and IRD',                                           new2025:false},
  {id:'education',   label:'Tertiary Education Expenses (self / dependent)',  max:10000,  cat:'Education & Charitable', note:'ITA s.26(1)(e) — approved institution; enrolment letter + fee/housing invoices',          new2025:false},
  {id:'charity',     label:'Charitable Donations — approved organisations',   max:null,   cat:'Education & Charitable', note:'ITA s.27 — Deed of Covenant ≥3 years; NCF / SLU National Trust; max 1/6 CI',             new2025:false},
  {id:'farming',     label:'Hobby Farming',                                   max:5000,   cat:'Education & Charitable', note:'2025: NEW — letter from Ministry of Agriculture; max $5,000',                            new2025:true },
  {id:'travel_allow',label:'Travelling Allowance (business — employed)',      max:6000,   cat:'Employment & Travel',    note:'TD Form AU-3; signed by manager/director; company seal; max $6,000',                     new2025:false},
  {id:'alimony',     label:'Alimony / Maintenance Payments',                  max:null,   cat:'Employment & Travel',    note:'Court Order or Decree; recipient chargeable to tax in Saint Lucia',                      new2025:false},
];

// ─── DEDUCTIBLE BUSINESS EXPENSE CATEGORIES (ITA s.18) ───────────────────────
const EXPENSE_CATS = [
  {id:'staff',    name:'1. Staff, Wages & Professional Fees',         items:[
    {id:'rn',          label:'Sessional RN / nursing staff fees',           conservative:28000,maximum:38000},
    {id:'anaes',       label:'Sessional anaesthetist fees',                 conservative:20000,maximum:30000},
    {id:'recep1',      label:'Receptionist / admin — Clinic 1',             conservative:22000,maximum:24000},
    {id:'recep2',      label:'Receptionist / admin — Clinic 2',             conservative:18000,maximum:22000},
    {id:'medsecy',     label:'Medical secretary / PA (part-time)',           conservative:15000,maximum:18000},
    {id:'pracmgr',     label:'Practice manager',                            conservative:20000,maximum:24000},
    {id:'locum',       label:'Locum / relief surgeon fees',                 conservative:0,    maximum:15000},
    {id:'accountant',  label:'Accountant / bookkeeper',                     conservative:7000, maximum:9000 },
    {id:'legal',       label:'Legal fees (practice matters only)',           conservative:3000, maximum:6000 },
    {id:'payroll_svc', label:'Payroll / HR administration service',         conservative:3000, maximum:4000 },
    {id:'recruit',     label:'Recruitment fees',                            conservative:0,    maximum:3000 },
  ]},
  {id:'premises', name:'2. Clinic Premises — Both Locations',          items:[
    {id:'rent1',       label:'Rent — Clinic 1 (Rodney Bay)',                conservative:48000,maximum:48000},
    {id:'rent2',       label:'Rent — Clinic 2 (second location)',           conservative:36000,maximum:36000},
    {id:'elec1',       label:'Electricity & utilities — Clinic 1',          conservative:8000, maximum:9600 },
    {id:'elec2',       label:'Electricity & utilities — Clinic 2',          conservative:5000, maximum:6400 },
    {id:'water',       label:'Water / sewage — both clinics',               conservative:2000, maximum:2400 },
    {id:'homeoffice',  label:'Home office — proportionate area',            conservative:0,    maximum:28000},
    {id:'signage',     label:'Signage & clinic branding',                   conservative:1200, maximum:2400 },
  ]},
  {id:'equipment',name:'3. Medical Equipment, Depreciation & Consumables',items:[
    {id:'cap_ercp',    label:'Capital allowance — endoscopy / ERCP equipment',conservative:18000,maximum:22000},
    {id:'cap_surg',    label:'Capital allowance — surgical instruments',      conservative:7000, maximum:9000 },
    {id:'cap_office',  label:'Capital allowance — office / clinic equipment', conservative:4000, maximum:6000 },
    {id:'cap_fitout',  label:'Capital allowance — clinic fit-out / leasehold',conservative:10000,maximum:12000},
    {id:'ercp_cons',   label:'ERCP consumables (catheters, sphincterotomes)', conservative:20000,maximum:26000},
    {id:'surg_inst',   label:'Surgical instruments & single-use disposables', conservative:10000,maximum:13000},
    {id:'ppe',         label:'PPE — gloves, gowns, masks, drapes',            conservative:5000, maximum:6000 },
    {id:'diag',        label:'Diagnostic reagents & laboratory supplies',     conservative:4000, maximum:5500 },
    {id:'gas',         label:'Medical gas (CO2/O2) — rental + refills',       conservative:3600, maximum:4200 },
    {id:'equip_svc',   label:'Equipment servicing & calibration',             conservative:7000, maximum:9000 },
    {id:'sterilise',   label:'Sterilisation & autoclave costs',               conservative:2500, maximum:3000 },
  ]},
  {id:'vehicle',  name:'4. Motor Vehicle — Practice Use',              items:[
    {id:'fuel',        label:'Fuel — documented practice travel (80%)',      conservative:12000,maximum:14400},
    {id:'veh_ins',     label:'Vehicle insurance (business portion)',         conservative:4800, maximum:6000 },
    {id:'veh_maint',   label:'Vehicle maintenance, tyres, servicing',        conservative:3600, maximum:4800 },
    {id:'veh_dep',     label:'Vehicle depreciation / lease payments',        conservative:10000,maximum:12000},
    {id:'parking',     label:'Parking & tolls — practice calls only',        conservative:1000, maximum:1200 },
  ]},
  {id:'insurance',name:'5. Insurance',                                  items:[
    {id:'malpractice', label:'Medical indemnity / malpractice (MPLA/ECMIS)',conservative:30000,maximum:32000},
    {id:'public_liab', label:'Public liability — clinic premises',          conservative:5400, maximum:5400 },
    {id:'biz_int',     label:'Business interruption insurance',             conservative:4200, maximum:4200 },
    {id:'prof_ind',    label:'Professional indemnity — additional riders',  conservative:3600, maximum:3600 },
    {id:'keyperson',   label:'Key-person insurance (business policy)',       conservative:8400, maximum:8400 },
  ]},
  {id:'comms',    name:'6. Communications, IT & Digital',               items:[
    {id:'landlines',   label:'Dedicated practice landlines — both clinics', conservative:7200, maximum:7200 },
    {id:'mobile',      label:'Mobile phone — practice portion (70%)',       conservative:3600, maximum:3600 },
    {id:'broadband',   label:'Broadband / internet — clinic premises',      conservative:3600, maximum:3600 },
    {id:'emr',         label:'Electronic medical records (EMR) — SaaS',    conservative:5400, maximum:5400 },
    {id:'telehealth',  label:'Telemedicine platform',                       conservative:0,    maximum:3600 },
    {id:'cyber',       label:'Cybersecurity / antivirus / backup',          conservative:2400, maximum:2400 },
    {id:'website',     label:'Practice website & digital presence',         conservative:3600, maximum:3600 },
    {id:'software',    label:'Practice management software licences',       conservative:2400, maximum:2400 },
  ]},
  {id:'cme',      name:'7. CME & Professional Travel',                  items:[
    {id:'esge_conf',   label:'ESGE / ASGE / SAGES annual conference',      conservative:10000,maximum:12000},
    {id:'carib_conf',  label:'Caribbean surgical meetings (CGSLA)',         conservative:5000, maximum:6000 },
    {id:'airfare',     label:'International airfare — CME travel',         conservative:15000,maximum:18000},
    {id:'hotel',       label:'Hotel / accommodation — CME travel',         conservative:8000, maximum:9600 },
    {id:'online_cme',  label:'Online CME courses & webinars',              conservative:4200, maximum:4200 },
    {id:'textbooks',   label:'Textbooks & clinical journals',              conservative:3000, maximum:3000 },
    {id:'simulation',  label:'Simulation / cadaveric training courses',    conservative:5000, maximum:8000 },
    {id:'fellowship',  label:'Visiting fellowship / observership travel',  conservative:0,    maximum:12000},
    {id:'slma_cpd',    label:'SLMA / local CPD events',                    conservative:2400, maximum:2400 },
  ]},
  {id:'profees',  name:'8. Professional Fees & Registrations',          items:[
    {id:'slma',        label:'SLMA annual subscription',                   conservative:1800, maximum:1800 },
    {id:'ecsmg',       label:'ECSMG / specialist registration fees',       conservative:1000, maximum:1000 },
    {id:'medcouncil',  label:'Medical Council licence / annual renewal',   conservative:800,  maximum:800  },
    {id:'esge_dues',   label:'ESGE / ASGE membership dues',               conservative:1500, maximum:1500 },
    {id:'gp_gifts',    label:'Gifts to referring GPs (max $500/recipient)',conservative:0,    maximum:2500 },
    {id:'advertising', label:'Advertising — directory, print, digital',    conservative:3600, maximum:4800 },
    {id:'stationery',  label:'Practice stationery, Rx pads, letterheads', conservative:2400, maximum:3000 },
  ]},
  {id:'bank',     name:'9. Bank Charges & Finance Costs',               items:[
    {id:'bank_charges',label:'Business bank account charges',             conservative:1800, maximum:1800 },
    {id:'merchant',    label:'Credit / debit card merchant fees',          conservative:5400, maximum:5400 },
    {id:'equip_loan',  label:'Equipment finance loan — INTEREST ONLY',    conservative:9600, maximum:9600 },
    {id:'fitout_loan', label:'Clinic fit-out loan — INTEREST ONLY',       conservative:6000, maximum:6000 },
    {id:'overdraft',   label:'Overdraft interest (practice account only)', conservative:1800, maximum:1800 },
  ]},
  {id:'misc',     name:'10. Research, Governance & Miscellaneous',      items:[
    {id:'research',    label:'Clinical research costs (ERCP programme)',  conservative:6000, maximum:8000 },
    {id:'audit_qual',  label:'Audit & clinical quality-improvement',      conservative:3600, maximum:3600 },
    {id:'med_waste',   label:'Medical waste disposal (clinical waste)',    conservative:3600, maximum:3600 },
    {id:'postage',     label:'Postage, courier & secure document handling',conservative:1200, maximum:1200 },
    {id:'uniforms',    label:'Staff uniforms / scrubs (practice logo)',   conservative:2400, maximum:2400 },
    {id:'subscriptions',label:'Subscriptions — UpToDate, Cochrane, PubMed',conservative:3000,maximum:3000 },
    {id:'entertainment',label:'Business entertainment — 50% cap (IRD)',   conservative:2400, maximum:2400 },
    {id:'sundry',      label:'Sundry practice expenses',                  conservative:2000, maximum:3000 },
  ]},
];

// ─── KEY 2025/26 IRD ACTIONS ──────────────────────────────────────────────────
const KEY_ACTIONS = [
  {id:'solar',    label:'Install Solar PV system on clinic(s)',               saving:25000,deadline:'31 Dec 2025',note:'All bills AND receipts for both purchase and installation required'},
  {id:'mortgage', label:'Confirm mortgage interest statement from lender',    saving:40000,deadline:'31 Dec 2025',note:'Raised $8,000→$40,000 — obtain from lender before year-end'},
  {id:'cu_shares',label:'Maximise Credit Union shares to $10,000',           saving:10000,deadline:'31 Dec 2025',note:'Credit union share statements required for filing'},
  {id:'invest',   label:'Purchase local/regional investment instruments $10K',saving:10000,deadline:'31 Dec 2025',note:'T-bills, bonds, shares, mutual funds from local/regional issuer'},
  {id:'pa_contr', label:'Formalise PA/secretary employment contract',         saving:24000,deadline:'31 Dec 2025',note:'Written contract + payslips; $18,000–$24,000 deduction'},
  {id:'home_off', label:'Document home office room — measure & calculate',   saving:28000,deadline:'31 Dec 2025',note:'Exclusive consulting/admin room; floor area × total area × occupancy costs'},
  {id:'stud_loan',label:'Claim student loan interest if applicable',          saving:40000,deadline:'31 Mar 2026',note:'Up to $40,000; statement of interest paid on qualifying loan'},
];

const DEFAULT_PAYROLL_SETTINGS = {
  personalAllowance: 40000,   // XCD/yr employee personal allowance
  nicEmployeeRate:   0.05,    // 5 % of insurable earnings
  nicEmployerRate:   0.05,    // 5 % employer contribution
  nicMonthlyCeiling: 5417,    // ~XCD 65,000/yr ceiling — confirm with NIC Board
  taxBands: [                 // IRD 2025 bands applied on annual chargeable income
    { upto: 18000, rate: 0.00 },
    { upto: 30000, rate: 0.10 },
    { upto: 50000, rate: 0.15 },
    { upto: 80000, rate: 0.20 },
    { upto: null,  rate: 0.30 }, // null = no upper limit
  ],
};

// ─── ENTITY DEFAULTS ─────────────────────────────────────────────────────────

const DEFAULT_ENTITIES = [
  { id:'ent1', name:'Amise Medical Services',  shortName:'Amise',    type:'Medical Practice', color:'#1a6ae6',
    profile:{ practitionerName:'Dr. Dawit Daniel Kabiye, MD, DM', practiceName:'Amise Medical Services', practitionerTin:'', practiceTin:'', phone:'', address:'Rodney Bay, Gros Islet, Saint Lucia', taxYear:2026, engagementType:'both', notes:'General & endoscopic surgery practice.' }},
  { id:'ent2', name:'Verdance',                shortName:'Verdance', type:'Property',          color:'#2a9d5c',
    profile:{ practitionerName:'Dawit Kabiye', practiceName:'Verdance', practitionerTin:'', practiceTin:'', phone:'', address:'Saint Lucia', taxYear:2026, engagementType:'business', notes:'' }},
  { id:'ent3', name:'Zemed Condos & Villas',   shortName:'Zemed',    type:'Property',          color:'#e67e22',
    profile:{ practitionerName:'Dawit Kabiye', practiceName:'Zemed Condos & Villas', practitionerTin:'', practiceTin:'', phone:'', address:'Saint Lucia', taxYear:2026, engagementType:'business', notes:'' }},
  { id:'ent4', name:'MSSL',                    shortName:'MSSL',     type:'Business',          color:'#8e44ad',
    profile:{ practitionerName:'Dawit Kabiye', practiceName:'MSSL', practitionerTin:'', practiceTin:'', phone:'', address:'Saint Lucia', taxYear:2026, engagementType:'business', notes:'' }},
  { id:'ent5', name:'Lucienne Bee Farm',       shortName:'Bee Farm', type:'Agriculture',       color:'#c8950a',
    profile:{ practitionerName:'Dawit Kabiye', practiceName:'Lucienne Bee Farm', practitionerTin:'', practiceTin:'', phone:'', address:'Saint Lucia', taxYear:2026, engagementType:'business', notes:'' }},
  { id:'ent6', name:'Lucienne Parfums',        shortName:'Parfums',  type:'Retail',            color:'#c0397a',
    profile:{ practitionerName:'Dawit Kabiye', practiceName:'Lucienne Parfums', practitionerTin:'', practiceTin:'', phone:'', address:'Saint Lucia', taxYear:2026, engagementType:'business', notes:'' }},
];

function ensureEntities(db){
  if(!db.entities||db.entities.length===0){
    db.entities=DEFAULT_ENTITIES.map(e=>({...e,profile:{...e.profile}}));
    writeDb(db);
  }
}

const DEFAULT_STAFF = [
  { id:'s1', name:'Receptionist / Admin – Clinic 1', position:'Receptionist / Admin',     entity:'Amise Medical Services', type:'permanent', grossMonthly:1833, spouseAllowance:0, childAllowance:0, otherAllowance:0, status:'active' },
  { id:'s2', name:'Receptionist / Admin – Clinic 2', position:'Receptionist / Admin',     entity:'Amise Medical Services', type:'permanent', grossMonthly:1500, spouseAllowance:0, childAllowance:0, otherAllowance:0, status:'active' },
  { id:'s3', name:'Medical Secretary / PA',           position:'Medical Secretary / PA',  entity:'Amise Medical Services', type:'permanent', grossMonthly:1250, spouseAllowance:0, childAllowance:0, otherAllowance:0, status:'active' },
  { id:'s4', name:'Practice Manager',                 position:'Practice Manager',        entity:'Amise Medical Services', type:'permanent', grossMonthly:1667, spouseAllowance:0, childAllowance:0, otherAllowance:0, status:'active' },
  { id:'s5', name:'Payroll / HR Administrator',       position:'Payroll / HR Administrator', entity:'Amise Medical Services', type:'contract', grossMonthly:3500, spouseAllowance:0, childAllowance:0, otherAllowance:0, status:'active' },
];

// ─── DB ───────────────────────────────────────────────────────────────────────

const defaultDb = {
  entities: DEFAULT_ENTITIES.map(e=>({...e,profile:{...e.profile}})),
  settings: {
    taxYear: 2026,
    baseCurrency: 'XCD',
    conservativeLimit: 551000,
    maximumLimit: 707700,
    personalConservativeLimit: 232000,
    personalMaximumLimit: 232000,
    defaultEntity: 'Amise Medical Services',
    categories: {
      business: ['medical/surgical consumables','clinical equipment & maintenance','professional fees','licences','indemnity insurance','association dues','CME / conferences / travel & accommodation','rent & utilities','software & subscriptions','marketing','bank & merchant fees','staff salaries & employer NIC','office supplies & printing','vehicle & fuel (business-use %)','repairs & maintenance','telephone & internet','legal & accounting','capital items'],
      personal: ['personal allowance','mortgage interest','life insurance premiums','medical/health','employee NIC','dependents/child','approved charitable donations','pension/annuity contributions']
    },
    entities: ['Amise Medical Services','Zemed Condos & Villas','MSSL','Lucienne Bee Farm','Lucienne Parfums']
  },
  documents: [],
  expenses: [],
  vendors: [],
  payroll: { settings: DEFAULT_PAYROLL_SETTINGS, staff: DEFAULT_STAFF, runs: [] },
  allowances: {},  // { entityId: { allowanceId: amountString } }
  actions:    {},  // { actionId: boolean }
};

function readDb(){ if(!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify(defaultDb,null,2)); return JSON.parse(fs.readFileSync(DATA_PATH,'utf8')); }
function writeDb(db){ fs.writeFileSync(DATA_PATH, JSON.stringify(db,null,2)); }

// Migration: seed payroll block into db.json files created before this feature
function ensurePayroll(db){
  if(!db.payroll){ db.payroll={ settings:{...DEFAULT_PAYROLL_SETTINGS}, staff:[...DEFAULT_STAFF], runs:[] }; writeDb(db); }
}
function ensureAllowances(db){
  if(!db.allowances){ db.allowances={}; writeDb(db); }
  if(!db.actions)   { db.actions={};    writeDb(db); }
  // seed personal allowance default for each entity
  for(const e of (db.entities||[])){ if(!db.allowances[e.id]) db.allowances[e.id]={personal:'40000'}; }
}

// ─── PAYE / NIC ENGINE (mirrors frontend computePayFE) ───────────────────────

function computeMonthlyPay(s, ps){
  const annual = s.grossMonthly * 12;
  const allow  = (ps.personalAllowance||40000) + (s.spouseAllowance||0) + (s.childAllowance||0) + (s.otherAllowance||0);
  let chargeable = Math.max(0, annual - allow);
  let annualPAYE = 0, prev = 0;
  for(const band of (ps.taxBands||[])){
    if(chargeable<=0) break;
    const last  = band.upto==null;
    const width = last ? chargeable : (band.upto - prev);
    const taxable = Math.min(chargeable, width);
    annualPAYE += taxable * band.rate;
    chargeable -= taxable;
    if(!last) prev = band.upto;
  }
  const ceil   = ps.nicMonthlyCeiling||5000;
  const nicEmp  = Math.min(s.grossMonthly,ceil) * (ps.nicEmployeeRate||0.05);
  const nicEmpr = Math.min(s.grossMonthly,ceil) * (ps.nicEmployerRate||0.05);
  const monthlyPAYE = annualPAYE / 12;
  return {
    gross:       s.grossMonthly,
    paye:        +monthlyPAYE.toFixed(2),
    nicEmployee: +nicEmp.toFixed(2),
    nicEmployer: +nicEmpr.toFixed(2),
    net:         +(s.grossMonthly - monthlyPAYE - nicEmp).toFixed(2),
    annualGross: annual,
    annualPAYE:  +annualPAYE.toFixed(2),
  };
}

// ─── EXISTING HELPERS ─────────────────────────────────────────────────────────

function statusFor(extracted, duplicate=false){ return duplicate || extracted.is_capital_item || extracted.confidence < .75 ? 'pending' : 'ready'; }
function deductible(exp){ return exp.is_capital || exp.classification !== 'business' ? 0 : Number(exp.amount_xcd || 0); }
function fxRate(currency){ const map={XCD:1,USD:2.7,EUR:2.95,GBP:3.45,CAD:1.98,CNY:.37}; return map[String(currency||'XCD').toUpperCase()] || 2.7; }
function findVendor(db, name){ return db.vendors.find(v => v.name.toLowerCase() === String(name||'').toLowerCase()); }
function upsertVendor(db, name, category, classification, entity){ if(!name) return; let v=findVendor(db,name); if(v){ v.default_category=category||v.default_category; v.default_classification=classification||v.default_classification; v.default_entity=entity||v.default_entity; } else db.vendors.push({id:nanoid(), name, default_category:category, default_classification:classification, default_entity:entity}); }
function dupeInfo(db, x){ const exact=db.expenses.find(e=> e.vendor.toLowerCase()===String(x.vendor_name||'').toLowerCase() && e.date===x.date && Number(e.amount_original||e.amount_xcd)===Number(x.total)); const near=db.expenses.find(e=> e.vendor.toLowerCase()===String(x.vendor_name||'').toLowerCase() && e.date===x.date); return { exact: !!exact, near: !!near && !exact}; }

function fallbackExtract(file, ext, note, confidence){
  const base = path.basename(file.originalname).replace(/[_-]/g,' ');
  const amount = Number((Math.random()*900+25).toFixed(2));
  const cap = /scope|vehicle|equipment|unit|fit.?out|machine/i.test(base);
  return { document_type: ext==='.pdf'?'invoice':'receipt', vendor_name: base.split('.')[0].slice(0,40)||'Unknown Vendor', vendor_tin:null, date:new Date().toISOString().slice(0,10), currency:/usd/i.test(base)?'USD':'XCD', subtotal:amount, tax_amount:0, total:amount, line_items:[{description:'Imported document', amount}], suggested_category: cap?'capital items':'medical/surgical consumables', suggested_classification:'business', suggested_entity:'Amise Medical Services', is_capital_item:cap, confidence, notes:note };
}

async function extractWithClaude(file){
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg');
  const isPdf = mime === 'application/pdf' || ext === '.pdf';
  const VISION_IMAGE = ['image/jpeg','image/png','image/gif','image/webp'];
  const visionReady = isPdf || VISION_IMAGE.includes(mime);
  if(apiKey && visionReady){
    try{
      const anthropic = new Anthropic({ apiKey });
      const data = fs.readFileSync(file.path).toString('base64');
      const prompt = `Extract this receipt/invoice/statement for Saint Lucia tax bookkeeping. Return ONLY JSON (no prose, no code fences) with keys: document_type, vendor_name, vendor_tin, date, currency, subtotal, tax_amount, total, line_items, suggested_category, suggested_classification, suggested_entity, is_capital_item, confidence, notes. Use YYYY-MM-DD. Flag fixed assets/equipment/vehicles/fit-out as capital. confidence <0.75 if vendor/date/total/category/classification uncertain.`;
      const block = isPdf
        ? { type:'document', source:{ type:'base64', media_type:'application/pdf', data } }
        : { type:'image', source:{ type:'base64', media_type:mime, data } };
      const msg = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:1200, messages:[{ role:'user', content:[ block, { type:'text', text:prompt } ] }] });
      const text = (msg.content||[]).map(c=>c.text||'').join('\n').trim();
      return JSON.parse(text.replace(/```json|```/g,'').trim());
    }catch(err){
      return fallbackExtract(file, ext, `Auto-extract failed: ${err.message}. Held for manual review.`, 0.3);
    }
  }
  if(apiKey && !visionReady){
    return fallbackExtract(file, ext, `Unsupported format for auto-extract (e.g. HEIC). Convert to JPEG/PNG/PDF, or enable server-side HEIC conversion. Held for manual review.`, 0.3);
  }
  return fallbackExtract(file, ext, 'Mock extraction used. Add ANTHROPIC_API_KEY for Claude Vision.', 0.82);
}

// ─── EXPENSE ROUTES ───────────────────────────────────────────────────────────

app.get('/api/state', (_,res)=>{
  const db=readDb();
  ensurePayroll(db); ensureEntities(db); ensureAllowances(db);
  res.json({ ...db, taxKnowledge:{ taxBands:TAX_BANDS, allowances:ALLOWANCES, expenseCats:EXPENSE_CATS, keyActions:KEY_ACTIONS } });
});

// ─── ENTITY ROUTES ────────────────────────────────────────────────────────────
app.get('/api/entities', (_,res)=>{ const db=readDb(); ensureEntities(db); res.json(db.entities); });
app.post('/api/entities', (req,res)=>{ const db=readDb(); ensureEntities(db); const e={...req.body,id:nanoid()}; if(!e.profile) e.profile={practitionerName:'',practiceName:e.name||'',practitionerTin:'',practiceTin:'',phone:'',address:'',taxYear:2026,engagementType:'business',notes:''}; db.entities.push(e); writeDb(db); res.json(e); });
app.put('/api/entities/:id', (req,res)=>{ const db=readDb(); ensureEntities(db); const i=db.entities.findIndex(e=>e.id===req.params.id); if(i<0) return res.status(404).json({error:'Not found'}); db.entities[i]={...db.entities[i],...req.body, profile:{...db.entities[i].profile,...(req.body.profile||{})}}; writeDb(db); res.json(db.entities[i]); });
app.delete('/api/entities/:id', (req,res)=>{ const db=readDb(); ensureEntities(db); db.entities=db.entities.filter(e=>e.id!==req.params.id); writeDb(db); res.json({ok:true}); });
app.put('/api/settings', (req,res)=>{ const db=readDb(); db.settings={...db.settings,...req.body}; writeDb(db); res.json(db.settings); });
app.post('/api/upload', upload.array('files', 30), async (req,res)=>{
  const db=readDb(); const created=[];
  for(const file of req.files || []){
    const extracted = await extractWithClaude(file);
    const vendorDefault = findVendor(db, extracted.vendor_name);
    if(vendorDefault){ extracted.suggested_category ||= vendorDefault.default_category; extracted.suggested_classification ||= vendorDefault.default_classification; extracted.suggested_entity ||= vendorDefault.default_entity; }
    const rate=fxRate(extracted.currency); const amountXcd=Number((Number(extracted.total||0)*rate).toFixed(2)); const dupe=dupeInfo(db, extracted);
    const doc={ id:nanoid(), source_type:file.mimetype==='application/pdf'?'pdf':'photo', file_url:`/uploads/${path.basename(file.path)}`, raw_text:'', received_at:new Date().toISOString(), status:dupe.exact?'duplicate':'received', extracted };
    const exp={ id:nanoid(), entity_id:extracted.suggested_entity || db.settings.defaultEntity, date:extracted.date, vendor:extracted.vendor_name, category:extracted.suggested_category, classification:extracted.suggested_classification, amount_xcd:amountXcd, amount_original:Number(extracted.total||0), currency:extracted.currency||'XCD', fx_rate:rate, fx_date:new Date().toISOString().slice(0,10), is_capital:!!extracted.is_capital_item, deductible_amount:0, source_document_id:doc.id, confidence:Number(extracted.confidence||0), status: statusFor(extracted, dupe.exact), duplicate:dupe.exact, near_duplicate:dupe.near, notes:extracted.notes||'', created_at:new Date().toISOString() };
    exp.deductible_amount = exp.status==='approved' ? deductible(exp) : 0;
    db.documents.push(doc); db.expenses.push(exp); created.push(exp);
  }
  writeDb(db); res.json({created});
});
app.post('/api/email-ingest', async (req,res)=>{
  const db=readDb();
  const doc={id:nanoid(), source_type:'email', file_url:'', raw_text:req.body.body||'', received_at:new Date().toISOString(), status:'received'};
  const extracted={document_type:'receipt', vendor_name:req.body.from||'Forwarded Email', vendor_tin:null, date:new Date().toISOString().slice(0,10), currency:'XCD', subtotal:0,tax_amount:0,total:Number(req.body.total||0), line_items:[], suggested_category:'office supplies & printing', suggested_classification:'business', suggested_entity:db.settings.defaultEntity, is_capital_item:false, confidence:.65, notes:'Email forwarding MVP stub. Connect inbound provider webhook here.'};
  const exp={id:nanoid(), entity_id:db.settings.defaultEntity, date:extracted.date, vendor:extracted.vendor_name, category:extracted.suggested_category, classification:'business', amount_xcd:extracted.total, amount_original:extracted.total, currency:'XCD', fx_rate:1, fx_date:extracted.date, is_capital:false, deductible_amount:0, source_document_id:doc.id, confidence:.65, status:'pending', notes:extracted.notes, created_at:new Date().toISOString()};
  doc.extracted=extracted; db.documents.push(doc); db.expenses.push(exp); writeDb(db); res.json({created:[exp]});
});
app.post('/api/expenses', (req,res)=>{ const db=readDb(); const exp={id:nanoid(), created_at:new Date().toISOString(), entity_id:req.body.entity_id||db.settings.defaultEntity, ...req.body}; if(exp.status==='approved') exp.deductible_amount=deductible(exp); else exp.deductible_amount=0; if(!exp.fx_rate){ const rate=fxRate(exp.currency||'XCD'); exp.fx_rate=rate; exp.amount_xcd=+(Number(exp.amount_xcd||0)).toFixed(2); exp.fx_date=exp.date||new Date().toISOString().slice(0,10); } db.expenses.push(exp); writeDb(db); res.json(exp); });
app.put('/api/expenses/:id', (req,res)=>{ const db=readDb(); const exp=db.expenses.find(e=>e.id===req.params.id); if(!exp) return res.status(404).json({error:'Not found'}); Object.assign(exp, req.body); if(exp.status==='approved') { exp.deductible_amount=deductible(exp); upsertVendor(db, exp.vendor, exp.category, exp.classification, exp.entity_id); } else exp.deductible_amount=0; writeDb(db); res.json(exp); });
app.delete('/api/expenses/:id', (req,res)=>{ const db=readDb(); const before=db.expenses.length; db.expenses=db.expenses.filter(e=>e.id!==req.params.id); writeDb(db); res.json({deleted:before-db.expenses.length}); });
app.post('/api/expenses/bulk-approve-ready', (_,res)=>{ const db=readDb(); let count=0; for(const e of db.expenses){ if(e.status==='ready' && !e.is_capital && !e.duplicate){ e.status='approved'; e.deductible_amount=deductible(e); upsertVendor(db,e.vendor,e.category,e.classification,e.entity_id); count++; }} writeDb(db); res.json({count}); });

// ─── PAYROLL ROUTES ───────────────────────────────────────────────────────────

// Staff CRUD
app.get('/api/payroll/staff', (_,res)=>{ const db=readDb(); ensurePayroll(db); res.json(db.payroll.staff); });
app.post('/api/payroll/staff', (req,res)=>{ const db=readDb(); ensurePayroll(db); const s={...req.body,id:nanoid(),status:'active'}; db.payroll.staff.push(s); writeDb(db); res.json(s); });
app.put('/api/payroll/staff/:id', (req,res)=>{ const db=readDb(); ensurePayroll(db); const i=db.payroll.staff.findIndex(s=>s.id===req.params.id); if(i<0) return res.status(404).json({error:'Not found'}); db.payroll.staff[i]={...db.payroll.staff[i],...req.body}; writeDb(db); res.json(db.payroll.staff[i]); });
app.delete('/api/payroll/staff/:id', (req,res)=>{ const db=readDb(); ensurePayroll(db); db.payroll.staff=db.payroll.staff.filter(s=>s.id!==req.params.id); writeDb(db); res.json({ok:true}); });

// Payroll settings (tax bands, NIC rates, allowances)
app.get('/api/payroll/settings', (_,res)=>{ const db=readDb(); ensurePayroll(db); res.json(db.payroll.settings); });
app.put('/api/payroll/settings', (req,res)=>{ const db=readDb(); ensurePayroll(db); db.payroll.settings={...db.payroll.settings,...req.body}; writeDb(db); res.json(db.payroll.settings); });

// Run payroll for a month — computes and stores PAYE/NIC for all active staff
app.post('/api/payroll/run', (req,res)=>{
  const {month}=req.body;
  if(!month) return res.status(400).json({error:'month required (YYYY-MM)'});
  const db=readDb(); ensurePayroll(db);
  const ps=db.payroll.settings;
  const lines=db.payroll.staff.filter(s=>s.status==='active').map(s=>({
    staffId:s.id, name:s.name, position:s.position, entity:s.entity, type:s.type,
    ...computeMonthlyPay(s,ps),
  }));
  const totals=lines.reduce((t,l)=>({
    gross:+(t.gross+l.gross).toFixed(2),
    paye:+(t.paye+l.paye).toFixed(2),
    nicEmployee:+(t.nicEmployee+l.nicEmployee).toFixed(2),
    nicEmployer:+(t.nicEmployer+l.nicEmployer).toFixed(2),
    net:+(t.net+l.net).toFixed(2),
  }),{gross:0,paye:0,nicEmployee:0,nicEmployer:0,net:0});
  const run={id:nanoid(),month,lines,totals,createdAt:new Date().toISOString()};
  db.payroll.runs=db.payroll.runs.filter(r=>r.month!==month);
  db.payroll.runs.push(run);
  writeDb(db); res.json(run);
});

// Export payroll run → approved expense rows (replaces any previous export for that month)
app.post('/api/payroll/export', (req,res)=>{
  const {month}=req.body;
  const db=readDb(); ensurePayroll(db);
  const run=db.payroll.runs.find(r=>r.month===month);
  if(!run) return res.status(404).json({error:`No payroll run found for ${month}. Run payroll first.`});
  db.expenses=db.expenses.filter(e=>e.payroll_month!==month);
  const byEntity={};
  for(const l of run.lines){
    if(!byEntity[l.entity]) byEntity[l.entity]={salaries:0,nicEmpr:0};
    byEntity[l.entity].salaries+=l.gross;
    byEntity[l.entity].nicEmpr+=l.nicEmployer;
  }
  const created=[];
  for(const [entity,t] of Object.entries(byEntity)){
    const total=+(t.salaries+t.nicEmpr).toFixed(2);
    const exp={id:nanoid(),entity_id:entity,date:`${month}-01`,vendor:'Staff Payroll',category:'staff salaries & employer NIC',classification:'business',amount_xcd:total,amount_original:total,currency:'XCD',fx_rate:1,fx_date:`${month}-01`,is_capital:false,deductible_amount:total,source_document_id:null,confidence:1,status:'approved',duplicate:false,near_duplicate:false,payroll_month:month,notes:`${run.lines.length} staff · salaries XCD ${t.salaries.toFixed(2)} · employer NIC XCD ${t.nicEmpr.toFixed(2)}`,created_at:new Date().toISOString()};
    db.expenses.push(exp); created.push(exp);
  }
  writeDb(db); res.json({created});
});

// ─── ALLOWANCES & ACTIONS ─────────────────────────────────────────────────────
app.get('/api/allowances/:entityId', (req,res)=>{ const db=readDb(); ensureAllowances(db); res.json(db.allowances[req.params.entityId]||{personal:'40000'}); });
app.put('/api/allowances/:entityId', (req,res)=>{ const db=readDb(); ensureAllowances(db); db.allowances[req.params.entityId]=req.body; writeDb(db); res.json(db.allowances[req.params.entityId]); });

app.get('/api/actions', (_,res)=>{ const db=readDb(); res.json(db.actions||{}); });
app.put('/api/actions', (req,res)=>{ const db=readDb(); db.actions={...db.actions,...req.body}; writeDb(db); res.json(db.actions); });

// ─── DOCUMENT MANAGEMENT ──────────────────────────────────────────────────────
app.delete('/api/documents/:id', (req,res)=>{
  const db=readDb();
  const doc=db.documents.find(d=>d.id===req.params.id);
  if(!doc) return res.status(404).json({error:'Not found'});
  if(doc.file_url){
    const rel=doc.file_url.startsWith('/')?doc.file_url.slice(1):doc.file_url;
    const fp=path.join(ROOT,rel);
    if(fs.existsSync(fp)) try{fs.unlinkSync(fp)}catch(_){}
  }
  db.documents=db.documents.filter(d=>d.id!==req.params.id);
  db.expenses=db.expenses.filter(e=>e.source_document_id!==req.params.id);
  writeDb(db);
  res.json({ok:true});
});

// ─── AI REPORT ────────────────────────────────────────────────────────────────
app.post('/api/report', async (req,res)=>{
  const {apiKey,practitionerName,practiceName,taxYear,grossIncome,totalAllowances,totalBusiness,chargeable,taxPayable,effectiveRate,pendingActions,scenarios}=req.body;
  if(!apiKey) return res.status(400).json({error:'Anthropic API key required'});
  const conserv_exp=EXPENSE_CATS.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.conservative,0),0);
  const max_exp    =EXPENSE_CATS.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.maximum,0),0);
  const xcd=v=>'$'+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0});
  const prompt=`You are a senior tax consultant specialising in Saint Lucia's IRD regime (ITA Cap 15.02, 2025). You are advising a medical practitioner.

PRACTITIONER: ${practitionerName}
PRACTICE: ${practiceName}
TAX YEAR: ${taxYear}
GROSS PROFESSIONAL INCOME: XCD ${xcd(grossIncome)}
PERSONAL ALLOWANCES CLAIMED: XCD ${xcd(totalAllowances)}
DEDUCTIBLE BUSINESS EXPENSES: XCD ${xcd(totalBusiness)}
CHARGEABLE INCOME: XCD ${xcd(chargeable)}
INCOME TAX PAYABLE: XCD ${xcd(taxPayable)}
EFFECTIVE TAX RATE: ${Number(effectiveRate||0).toFixed(2)}%

IRD 2025 TAX BANDS: Band 1 First $18,000 @ 0% | Band 2 $18,001–30,000 @ 10% | Band 3 $30,001–50,000 @ 15% | Band 4 $50,001–80,000 @ 20% | Band 5 Above $80,000 @ 30%

SCENARIOS: Conservative deductions ($134,000 allowances + $${conserv_exp.toLocaleString()} business = tax $${xcd(scenarios?.taxCons||0)}) | Maximum ($208,500 + $${max_exp.toLocaleString()} = tax $${xcd(scenarios?.taxMax||0)})

PENDING IRD ACTIONS (potential XCD ${xcd((pendingActions||[]).reduce((s,a)=>s+(a.saving||0),0))} additional deductions):
${(pendingActions||[]).map(a=>`- ${a.label}: saves XCD ${xcd(a.saving)} — ${a.note} (deadline ${a.deadline})`).join('\n')}

FILING DEADLINE: 31 March 2026 | efilingovt.lc | Tel: 468-4700

Provide a structured tax planning report covering:
**1. EXECUTIVE SUMMARY** — Overall position and headline recommendation.
**2. PERSONAL ALLOWANCES ANALYSIS** — Current utilisation vs maximum ($208,500 for 2025). Key underutilised allowances.
**3. BUSINESS EXPENSE OPTIMISATION** — Commentary on current vs conservative ($${conserv_exp.toLocaleString()}) and maximum ($${max_exp.toLocaleString()}) scenarios.
**4. TAX COMPUTATION WALKTHROUGH** — Step-by-step with 2025 bands.
**5. 2025/26 ACTION PLAN** — Ranked by saving potential. Specific steps and documentation required.
**6. COMPLIANCE & DOCUMENTATION** — Key records per IRD (7-year rule, ITA s.73). Risk areas.
**7. MULTI-YEAR PLANNING** — 2026 and beyond — sustainable structure for a growing medical practice.

Write in professional British-Caribbean tone. Be specific and actionable.`;
  try{
    const anthropic=new Anthropic({apiKey});
    const msg=await anthropic.messages.create({model:'claude-sonnet-4-6',max_tokens:3000,messages:[{role:'user',content:prompt}]});
    res.json({report:msg.content.map(c=>c.text||'').join('')});
  }catch(err){
    res.status(500).json({error:err.message||String(err)});
  }
});

// ─── MISC ─────────────────────────────────────────────────────────────────────

app.delete('/api/reset', (_,res)=>{ writeDb(defaultDb); res.json({ok:true}); });

app.use(express.static(path.join(ROOT,'dist')));
app.get('/{*path}', (_,res)=>{ const html=path.join(ROOT,'dist','index.html'); fs.existsSync(html) ? res.sendFile(html) : res.send('Run npm run dev for the frontend.'); });
app.listen(PORT, ()=>console.log(`Amise Tax Planner API running on http://localhost:${PORT}`));
