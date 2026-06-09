import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Landmark, UserCircle, Building2, Briefcase, UploadCloud,
  FileText, Calculator, Users, TrendingUp, TrendingDown,
  CheckCircle, Trash2, Plus, ChevronUp, ChevronDown, Check,
  Pencil, X, Receipt, BarChart2, ClipboardCheck, Brain, Shield,
} from 'lucide-react'
import './style.css'

// ── Helpers ───────────────────────────────────────────────────────────────────
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const YEARS  = [2024,2025,2026,2027]
const STORE  = 'amise_tax_v1'
const ANTHROPIC = 'https://api.anthropic.com/v1/messages'

function fmt(n){ return '$'+Number(n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtInt(n){ return '$'+Math.round(Number(n||0)).toLocaleString('en') }
function nanoid(n=10){ let s=''; const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; for(let i=0;i<n;i++) s+=c[Math.floor(Math.random()*c.length)]; return s }
function fxRate(cur){ return ({XCD:1,USD:2.7,EUR:2.95,GBP:3.45,CAD:1.98})[String(cur||'XCD').toUpperCase()]||2.7 }
function readB64(file){ return new Promise((ok,fail)=>{ const r=new FileReader(); r.onload=e=>ok(e.target.result.split(',')[1]); r.onerror=fail; r.readAsDataURL(file) }) }

function calcTax(income, bands){
  if(!bands?.length) return 0
  let tax=0
  for(const b of bands){
    if(income<=b.from) break
    const top=b.to===null?income:Math.min(income,b.to)
    tax+=(top-b.from)*b.rate
  }
  return tax
}

function computePayFE(s,ps){
  if(!s||!ps) return {paye:0,nic:0,nicEmpr:0,net:s?.grossMonthly||0}
  const annual=(s.grossMonthly||0)*12
  const allow=(ps.personalAllowance||40000)+(s.spouseAllowance||0)+(s.childAllowance||0)+(s.otherAllowance||0)
  let chargeable=Math.max(0,annual-allow),annualPAYE=0,prev=0
  for(const b of (ps.taxBands||[])){
    if(chargeable<=0) break
    const last=b.upto==null,w=last?chargeable:(b.upto-prev),t=Math.min(chargeable,w)
    annualPAYE+=t*b.rate; chargeable-=t; if(!last) prev=b.upto
  }
  const ceil=ps.nicMonthlyCeiling||5417
  const nic=Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployeeRate||0.05)
  const nicEmpr=Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployerRate||0.05)
  const paye=annualPAYE/12
  return {paye:+paye.toFixed(2),nic:+nic.toFixed(2),nicEmpr:+nicEmpr.toFixed(2),net:+((s.grossMonthly||0)-paye-nic).toFixed(2)}
}

// ── IRD 2025 Data ─────────────────────────────────────────────────────────────
const TAX_BANDS=[
  {from:0,    to:18000,rate:0.00,label:'Band 1  First XCD 18,000'},
  {from:18000,to:30000,rate:0.10,label:'Band 2  XCD 18,001–30,000'},
  {from:30000,to:50000,rate:0.15,label:'Band 3  XCD 30,001–50,000'},
  {from:50000,to:80000,rate:0.20,label:'Band 4  XCD 50,001–80,000'},
  {from:80000,to:null, rate:0.30,label:'Band 5  Above XCD 80,000'},
]

const ALLOWANCES=[
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
]

const EXPENSE_CATS=[
  {id:'staff',    name:'1. Staff, Wages & Professional Fees',items:[
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
  {id:'premises',name:'2. Clinic Premises — Both Locations',items:[
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
  {id:'vehicle',  name:'4. Motor Vehicle — Practice Use',items:[
    {id:'fuel',        label:'Fuel — documented practice travel (80%)',      conservative:12000,maximum:14400},
    {id:'veh_ins',     label:'Vehicle insurance (business portion)',         conservative:4800, maximum:6000 },
    {id:'veh_maint',   label:'Vehicle maintenance, tyres, servicing',        conservative:3600, maximum:4800 },
    {id:'veh_dep',     label:'Vehicle depreciation / lease payments',        conservative:10000,maximum:12000},
    {id:'parking',     label:'Parking & tolls — practice calls only',        conservative:1000, maximum:1200 },
  ]},
  {id:'insurance',name:'5. Insurance',items:[
    {id:'malpractice', label:'Medical indemnity / malpractice (MPLA/ECMIS)',conservative:30000,maximum:32000},
    {id:'public_liab', label:'Public liability — clinic premises',          conservative:5400, maximum:5400 },
    {id:'biz_int',     label:'Business interruption insurance',             conservative:4200, maximum:4200 },
    {id:'prof_ind',    label:'Professional indemnity — additional riders',  conservative:3600, maximum:3600 },
    {id:'keyperson',   label:'Key-person insurance (business policy)',       conservative:8400, maximum:8400 },
  ]},
  {id:'comms',    name:'6. Communications, IT & Digital',items:[
    {id:'landlines',   label:'Dedicated practice landlines — both clinics', conservative:7200, maximum:7200 },
    {id:'mobile',      label:'Mobile phone — practice portion (70%)',       conservative:3600, maximum:3600 },
    {id:'broadband',   label:'Broadband / internet — clinic premises',      conservative:3600, maximum:3600 },
    {id:'emr',         label:'Electronic medical records (EMR) — SaaS',    conservative:5400, maximum:5400 },
    {id:'telehealth',  label:'Telemedicine platform',                       conservative:0,    maximum:3600 },
    {id:'cyber',       label:'Cybersecurity / antivirus / backup',          conservative:2400, maximum:2400 },
    {id:'website',     label:'Practice website & digital presence',         conservative:3600, maximum:3600 },
    {id:'software',    label:'Practice management software licences',       conservative:2400, maximum:2400 },
  ]},
  {id:'cme',      name:'7. CME & Professional Travel',items:[
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
  {id:'profees',  name:'8. Professional Fees & Registrations',items:[
    {id:'slma',        label:'SLMA annual subscription',                   conservative:1800, maximum:1800 },
    {id:'ecsmg',       label:'ECSMG / specialist registration fees',       conservative:1000, maximum:1000 },
    {id:'medcouncil',  label:'Medical Council licence / annual renewal',   conservative:800,  maximum:800  },
    {id:'esge_dues',   label:'ESGE / ASGE membership dues',               conservative:1500, maximum:1500 },
    {id:'gp_gifts',    label:'Gifts to referring GPs (max $500/recipient)',conservative:0,    maximum:2500 },
    {id:'advertising', label:'Advertising — directory, print, digital',    conservative:3600, maximum:4800 },
    {id:'stationery',  label:'Practice stationery, Rx pads, letterheads', conservative:2400, maximum:3000 },
  ]},
  {id:'bank',     name:'9. Bank Charges & Finance Costs',items:[
    {id:'bank_charges',label:'Business bank account charges',             conservative:1800, maximum:1800 },
    {id:'merchant',    label:'Credit / debit card merchant fees',          conservative:5400, maximum:5400 },
    {id:'equip_loan',  label:'Equipment finance loan — INTEREST ONLY',    conservative:9600, maximum:9600 },
    {id:'fitout_loan', label:'Clinic fit-out loan — INTEREST ONLY',       conservative:6000, maximum:6000 },
    {id:'overdraft',   label:'Overdraft interest (practice account only)', conservative:1800, maximum:1800 },
  ]},
  {id:'misc',     name:'10. Research, Governance & Miscellaneous',items:[
    {id:'research',    label:'Clinical research costs (ERCP programme)',  conservative:6000, maximum:8000 },
    {id:'audit_qual',  label:'Audit & clinical quality-improvement',      conservative:3600, maximum:3600 },
    {id:'med_waste',   label:'Medical waste disposal (clinical waste)',    conservative:3600, maximum:3600 },
    {id:'postage',     label:'Postage, courier & secure document handling',conservative:1200, maximum:1200 },
    {id:'uniforms',    label:'Staff uniforms / scrubs (practice logo)',   conservative:2400, maximum:2400 },
    {id:'subscriptions',label:'Subscriptions — UpToDate, Cochrane, PubMed',conservative:3000,maximum:3000 },
    {id:'entertainment',label:'Business entertainment — 50% cap (IRD)',   conservative:2400, maximum:2400 },
    {id:'sundry',      label:'Sundry practice expenses',                  conservative:2000, maximum:3000 },
  ]},
]

const KEY_ACTIONS=[
  {id:'solar',    label:'Install Solar PV system on clinic(s)',               saving:25000,deadline:'31 Dec 2025',note:'All bills AND receipts for both purchase and installation required'},
  {id:'mortgage', label:'Confirm mortgage interest statement from lender',    saving:40000,deadline:'31 Dec 2025',note:'Raised $8,000→$40,000 — obtain from lender before year-end'},
  {id:'cu_shares',label:'Maximise Credit Union shares to $10,000',           saving:10000,deadline:'31 Dec 2025',note:'Credit union share statements required for filing'},
  {id:'invest',   label:'Purchase local/regional investment instruments $10K',saving:10000,deadline:'31 Dec 2025',note:'T-bills, bonds, shares, mutual funds from local/regional issuer'},
  {id:'pa_contr', label:'Formalise PA/secretary employment contract',         saving:24000,deadline:'31 Dec 2025',note:'Written contract + payslips; $18,000–$24,000 deduction'},
  {id:'home_off', label:'Document home office room — measure & calculate',   saving:28000,deadline:'31 Dec 2025',note:'Exclusive consulting/admin room; floor area × total area × occupancy costs'},
  {id:'stud_loan',label:'Claim student loan interest if applicable',          saving:40000,deadline:'31 Mar 2026',note:'Up to $40,000; statement of interest paid on qualifying loan'},
]

const TK={taxBands:TAX_BANDS,allowances:ALLOWANCES,expenseCats:EXPENSE_CATS,keyActions:KEY_ACTIONS}

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_PS={
  personalAllowance:40000,nicEmployeeRate:0.05,nicEmployerRate:0.05,nicMonthlyCeiling:5417,
  taxBands:[{upto:18000,rate:0},{upto:30000,rate:0.10},{upto:50000,rate:0.15},{upto:80000,rate:0.20},{upto:null,rate:0.30}],
}

const DEFAULT_ENTITIES=[
  {id:'ent1',name:'Amise Medical Services', shortName:'Amise',   type:'Medical Practice',color:'#1a6ae6',
   profile:{practitionerName:'Dr. Dawit Daniel Kabiye, MD, DM',practiceName:'Amise Medical Services',practitionerTin:'',practiceTin:'',phone:'',address:'Rodney Bay, Gros Islet, Saint Lucia',taxYear:2026,engagementType:'both',notes:'General & endoscopic surgery practice.',grossIncome:''}},
  {id:'ent2',name:'Verdance',               shortName:'Verdance',type:'Property',         color:'#2a9d5c',
   profile:{practitionerName:'Dawit Kabiye',practiceName:'Verdance',practitionerTin:'',practiceTin:'',phone:'',address:'Saint Lucia',taxYear:2026,engagementType:'business',notes:'',grossIncome:''}},
  {id:'ent3',name:'Zemed Condos & Villas',  shortName:'Zemed',   type:'Property',         color:'#e67e22',
   profile:{practitionerName:'Dawit Kabiye',practiceName:'Zemed Condos & Villas',practitionerTin:'',practiceTin:'',phone:'',address:'Saint Lucia',taxYear:2026,engagementType:'business',notes:'',grossIncome:''}},
  {id:'ent4',name:'MSSL',                   shortName:'MSSL',    type:'Business',         color:'#8e44ad',
   profile:{practitionerName:'Dawit Kabiye',practiceName:'MSSL',practitionerTin:'',practiceTin:'',phone:'',address:'Saint Lucia',taxYear:2026,engagementType:'business',notes:'',grossIncome:''}},
  {id:'ent5',name:'Lucienne Bee Farm',      shortName:'Bee Farm',type:'Agriculture',      color:'#c8950a',
   profile:{practitionerName:'Dawit Kabiye',practiceName:'Lucienne Bee Farm',practitionerTin:'',practiceTin:'',phone:'',address:'Saint Lucia',taxYear:2026,engagementType:'business',notes:'',grossIncome:''}},
  {id:'ent6',name:'Lucienne Parfums',       shortName:'Parfums', type:'Retail',           color:'#c0397a',
   profile:{practitionerName:'Dawit Kabiye',practiceName:'Lucienne Parfums',practitionerTin:'',practiceTin:'',phone:'',address:'Saint Lucia',taxYear:2026,engagementType:'business',notes:'',grossIncome:''}},
]

const DEFAULT_STAFF=[
  {id:'s1',name:'Receptionist / Admin – Clinic 1',position:'Receptionist / Admin',    entity:'Amise Medical Services',type:'permanent',grossMonthly:1833,spouseAllowance:0,childAllowance:0,otherAllowance:0,status:'active'},
  {id:'s2',name:'Receptionist / Admin – Clinic 2',position:'Receptionist / Admin',    entity:'Amise Medical Services',type:'permanent',grossMonthly:1500,spouseAllowance:0,childAllowance:0,otherAllowance:0,status:'active'},
  {id:'s3',name:'Medical Secretary / PA',          position:'Medical Secretary / PA', entity:'Amise Medical Services',type:'permanent',grossMonthly:1250,spouseAllowance:0,childAllowance:0,otherAllowance:0,status:'active'},
  {id:'s4',name:'Practice Manager',                position:'Practice Manager',       entity:'Amise Medical Services',type:'permanent',grossMonthly:1667,spouseAllowance:0,childAllowance:0,otherAllowance:0,status:'active'},
  {id:'s5',name:'Payroll / HR Administrator',      position:'Payroll / HR Admin',     entity:'Amise Medical Services',type:'contract', grossMonthly:3500,spouseAllowance:0,childAllowance:0,otherAllowance:0,status:'active'},
]

const DEFAULT_SETTINGS={
  taxYear:2026,baseCurrency:'XCD',conservativeLimit:551000,maximumLimit:707700,
  personalConservativeLimit:232000,personalMaximumLimit:232000,defaultEntity:'Amise Medical Services',
  categories:{
    business:['medical/surgical consumables','clinical equipment & maintenance','professional fees','licences','indemnity insurance','CME / conferences / travel & accommodation','rent & utilities','software & subscriptions','marketing','bank & merchant fees','staff salaries & employer NIC','vehicle & fuel','repairs & maintenance','telephone & internet','legal & accounting'],
    personal:['personal allowance','mortgage interest','life insurance premiums','medical/health','employee NIC','dependents/child','approved charitable donations','pension/annuity contributions'],
  },
}

// ── LocalStorage ──────────────────────────────────────────────────────────────
function freshDb(){
  const db={
    entities:DEFAULT_ENTITIES.map(e=>({...e,profile:{...e.profile}})),
    expenses:[],documents:[],vendors:[],
    payroll:{settings:DEFAULT_PS,staff:DEFAULT_STAFF,runs:[]},
    allowances:{},actions:{},settings:DEFAULT_SETTINGS,
  }
  for(const e of db.entities) db.allowances[e.id]={personal:'40000'}
  return db
}

function loadDb(){
  try{
    const raw=localStorage.getItem(STORE)
    if(!raw) return freshDb()
    const db=JSON.parse(raw)
    if(!db.allowances) db.allowances={}
    if(!db.actions) db.actions={}
    if(!db.entities?.length) db.entities=freshDb().entities
    if(!db.payroll) db.payroll={settings:DEFAULT_PS,staff:DEFAULT_STAFF,runs:[]}
    if(!db.documents) db.documents=[]
    for(const e of db.entities) if(!db.allowances[e.id]) db.allowances[e.id]={personal:'40000'}
    return db
  }catch{ return freshDb() }
}

function saveDb(db){ try{localStorage.setItem(STORE,JSON.stringify(db))}catch{} }

// ── Direct Anthropic call ─────────────────────────────────────────────────────
async function callClaude(apiKey, messages, model='claude-haiku-4-5-20251001', max_tokens=1200){
  const res=await fetch(ANTHROPIC,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model,max_tokens,messages}),
  })
  const j=await res.json()
  if(!res.ok) throw new Error(j.error?.message||`HTTP ${res.status}`)
  return j.content.map(c=>c.text||'').join('')
}

async function extractFile(apiKey, file){
  const ext=file.name.split('.').pop().toLowerCase()
  const isImg=/^(jpg|jpeg|png|gif|webp)$/.test(ext)
  const isPdf=ext==='pdf'
  const mime=isPdf?'application/pdf':file.type||'image/jpeg'
  const prompt='Extract this receipt/invoice for Saint Lucia tax bookkeeping. Return ONLY JSON (no prose, no code fences) with keys: document_type, vendor_name, vendor_tin, date, currency, subtotal, tax_amount, total, line_items, suggested_category, suggested_classification, suggested_entity, is_capital_item, confidence, notes. Use YYYY-MM-DD dates. Flag equipment/vehicles/fit-out as capital (is_capital_item:true). Set confidence<0.75 if uncertain.'
  if(apiKey&&(isImg||isPdf)){
    try{
      const data=await readB64(file)
      const block=isPdf?{type:'document',source:{type:'base64',media_type:'application/pdf',data}}:{type:'image',source:{type:'base64',media_type:mime,data}}
      const text=await callClaude(apiKey,[{role:'user',content:[block,{type:'text',text:prompt}]}])
      return JSON.parse(text.replace(/```json|```/g,'').trim())
    }catch(e){
      return fallbackExtract(file.name,`AI extraction failed: ${e.message}`)
    }
  }
  return fallbackExtract(file.name, apiKey?'Unsupported file type for AI extraction. Held for manual review.':'No API key — held for manual review.')
}

function fallbackExtract(name, note){
  return{document_type:'receipt',vendor_name:name.split('.')[0].replace(/[_-]/g,' ').slice(0,40)||'Unknown',vendor_tin:null,date:new Date().toISOString().slice(0,10),currency:'XCD',subtotal:0,tax_amount:0,total:0,line_items:[],suggested_category:'office supplies & printing',suggested_classification:'business',suggested_entity:'Amise Medical Services',is_capital_item:false,confidence:0.3,notes:note}
}

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS=[
  {id:'entities',  label:'Entities',   Icon:Building2   },
  {id:'profile',   label:'Profile',    Icon:UserCircle  },
  {id:'allowances',label:'Allowances', Icon:Landmark    },
  {id:'personal',  label:'Personal',   Icon:TrendingUp  },
  {id:'business',  label:'Business',   Icon:Briefcase   },
  {id:'upload',    label:'Upload',     Icon:UploadCloud },
  {id:'payroll',   label:'Payroll',    Icon:Users       },
  {id:'taxcomp',   label:'Tax Comp',   Icon:BarChart2   },
  {id:'actions',   label:'Action Plan',Icon:ClipboardCheck},
  {id:'aireport',  label:'AI Report',  Icon:Brain       },
  {id:'reports',   label:'Reports',    Icon:FileText    },
  {id:'summary',   label:'Summary',    Icon:Calculator  },
]

// ── App ───────────────────────────────────────────────────────────────────────
function App(){
  const [state, setState]=useState(loadDb)
  const [tab,   setTab  ]=useState('profile')
  const [entIdx,setEntIdx]=useState(0)
  const [year,  setYear ]=useState(new Date().getFullYear())

  function mutate(fn){
    setState(prev=>{
      const next=JSON.parse(JSON.stringify(prev))
      fn(next)
      saveDb(next)
      return next
    })
  }

  const entities=state.entities||[]
  const expenses=state.expenses||[]
  const settings=state.settings||{}
  const tk=TK
  const entity=entities[entIdx]||entities[0]||{}
  const entName=entity.name||''

  const approved=expenses.filter(e=>e.status==='approved')
  const pending =expenses.filter(e=>['pending','ready'].includes(e.status))

  const yearEntExp=approved.filter(e=>new Date(e.date).getFullYear()===year&&(e.entity_id===entName||e.entity_id===entity.shortName))
  const yearAllExp=approved.filter(e=>new Date(e.date).getFullYear()===year)

  const personalTotals=useMemo(()=>{
    let personal=0,deductible=0,capital=0
    yearAllExp.forEach(e=>{
      if(e.is_capital){capital+=Number(e.amount_xcd);return}
      if(e.classification==='personal') personal+=Number(e.amount_xcd)
      else deductible+=Number(e.deductible_amount||e.amount_xcd||0)
    })
    return{personal,deductible,capital}
  },[yearAllExp])

  const entityDeductible=useMemo(()=>
    yearEntExp.filter(e=>!e.is_capital&&e.classification!=='personal')
              .reduce((s,e)=>s+Number(e.deductible_amount||e.amount_xcd||0),0)
  ,[yearEntExp])

  const sp={state,mutate,settings,entity,entities,entIdx,setEntIdx,year,setYear,tk}

  return(
    <div className="app">
      <div className="app-header">
        <div className="app-brand">
          <div className="app-icon"><Landmark size={22} color="white"/></div>
          <div className="app-title-block">
            <div className="app-title">AMISE — TAX &</div>
            <div className="app-title">FINANCIAL CONSULTANCY</div>
          </div>
        </div>
        <div className="entity-pills">
          {entities.map((e,i)=>(
            <button key={e.id} className={`entity-pill${i===entIdx?' active':''}`} onClick={()=>setEntIdx(i)}>
              {e.shortName||e.name}
            </button>
          ))}
        </div>
      </div>
      <nav className="sub-nav">
        {TABS.map(({id,label,Icon})=>(
          <button key={id} className={`sub-tab${tab===id?' active':''}`} onClick={()=>setTab(id)}>
            <Icon size={13}/><span>{label}</span>
          </button>
        ))}
      </nav>
      <main className="content">
        {tab==='entities'  &&<EntitiesTab   {...sp}/>}
        {tab==='profile'   &&<ProfileTab    {...sp}/>}
        {tab==='allowances'&&<AllowancesTab {...sp}/>}
        {tab==='personal'  &&<PersonalTab   totals={personalTotals} yearExp={yearAllExp} settings={settings} year={year} setYear={setYear} totalEntries={yearAllExp.length}/>}
        {tab==='business'  &&<BusinessTab   {...sp} expenses={expenses} yearEntExp={yearEntExp} entityDeductible={entityDeductible}/>}
        {tab==='upload'    &&<UploadTab     {...sp} pending={pending}/>}
        {tab==='payroll'   &&<PayrollTab    {...sp}/>}
        {tab==='taxcomp'   &&<TaxCompTab    {...sp} entityDeductible={entityDeductible}/>}
        {tab==='actions'   &&<ActionPlanTab {...sp}/>}
        {tab==='aireport'  &&<AIReportTab   {...sp} entityDeductible={entityDeductible}/>}
        {tab==='reports'   &&<ReportsTab    yearEntExp={yearEntExp} year={year} entity={entity}/>}
        {tab==='summary'   &&<SummaryTab    totals={personalTotals} entityDeductible={entityDeductible} settings={settings} entity={entity}/>}
      </main>
    </div>
  )
}

// ── Entities ──────────────────────────────────────────────────────────────────
const ENTITY_TYPES=['Medical Practice','Property','Holding Company','Business','Agriculture','Retail','Finance','Other']
const BLANK_ENT={name:'',shortName:'',type:'Business',color:'#3d9b7d'}

function EntitiesTab({entities,mutate}){
  const [editing,setEditing]=useState(null)
  function save(e){
    if(e.id){
      mutate(db=>{ const i=db.entities.findIndex(x=>x.id===e.id); if(i>=0) db.entities[i]={...db.entities[i],...e,profile:{...db.entities[i].profile,...(e.profile||{})}} })
    }else{
      const id=nanoid()
      mutate(db=>{ db.entities.push({...e,id}); db.allowances[id]={personal:'40000'} })
    }
    setEditing(null)
  }
  function del(id){ if(!confirm('Remove this entity?')) return; mutate(db=>{ db.entities=db.entities.filter(e=>e.id!==id) }) }
  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Entities</h1><p className="page-sub">{entities.length} registered</p></div>
        <button onClick={()=>setEditing({...BLANK_ENT})}><Plus size={15}/> Add</button>
      </div>
      <div className="entity-cards">
        {entities.map(e=>(
          <div key={e.id} className="entity-card">
            <div className="entity-card-bar" style={{background:e.color||'#3d9b7d'}}/>
            <div className="entity-card-body">
              <div className="entity-card-name">{e.name}</div>
              <div className="entity-card-meta">{e.shortName} · {e.type}</div>
              {e.profile?.practitionerName&&<div className="entity-card-profile">{e.profile.practitionerName}</div>}
            </div>
            <div className="entity-card-actions">
              <button className="btn-icon" onClick={()=>setEditing({...e,profile:{...e.profile}})}><Pencil size={14}/></button>
              <button className="btn-icon btn-icon-danger" onClick={()=>del(e.id)}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
      {editing&&<Modal title={editing.id?'Edit Entity':'Add Entity'} onClose={()=>setEditing(null)}><EntityForm e={editing} onSave={save} onCancel={()=>setEditing(null)}/></Modal>}
    </div>
  )
}
function EntityForm({e,onSave,onCancel}){
  const [f,setF]=useState(e)
  return(
    <div>
      <Field label="Full name"><input value={f.name||''} onChange={ev=>setF({...f,name:ev.target.value})}/></Field>
      <Field label="Short name (pill)"><input value={f.shortName||''} onChange={ev=>setF({...f,shortName:ev.target.value})}/></Field>
      <TwoCol>
        <Field label="Type"><select value={f.type||'Business'} onChange={ev=>setF({...f,type:ev.target.value})}>{ENTITY_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Colour">
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="color" value={f.color||'#3d9b7d'} onChange={ev=>setF({...f,color:ev.target.value})} style={{width:44,height:38,padding:2,cursor:'pointer'}}/>
            <span style={{fontSize:13,color:'#666'}}>{f.color||'#3d9b7d'}</span>
          </div>
        </Field>
      </TwoCol>
      <div className="modal-actions">
        <button onClick={()=>onSave(f)}><Check size={15}/> Save entity</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Profile ───────────────────────────────────────────────────────────────────
function ProfileTab({entity,entities,entIdx,setEntIdx,mutate}){
  const [profile,setProfile]=useState(null)
  const [saved,setSaved]=useState(false)
  const prevId=React.useRef(null)
  if(entity?.id!==prevId.current){ prevId.current=entity?.id; if(profile!==null||entity?.profile) setTimeout(()=>{ setProfile(entity?.profile?{...entity.profile}:null); setSaved(false) },0) }
  React.useEffect(()=>{ setProfile(entity?.profile?{...entity.profile}:null); setSaved(false) },[entity?.id])
  if(!entity||!profile) return <div className="empty-state">No entity selected.</div>
  function save(){
    mutate(db=>{ const i=db.entities.findIndex(e=>e.id===entity.id); if(i>=0) db.entities[i]={...db.entities[i],profile:{...db.entities[i].profile,...profile}} })
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }
  return(
    <div className="page">
      <div className="profile-section">
        <div className="profile-header"><UserCircle size={16} color="#3d9b7d"/><span className="profile-label">Practitioner &amp; Engagement Profile</span></div>
        <div className="profile-sub">Pre-loaded for {entity.name}</div>
        <TwoCol>
          <Field label="Practitioner Name"><input value={profile.practitionerName||''} onChange={e=>setProfile({...profile,practitionerName:e.target.value})}/></Field>
          <Field label="Practice Name"><input value={profile.practiceName||''} onChange={e=>setProfile({...profile,practiceName:e.target.value})}/></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Practitioner TIN"><input value={profile.practitionerTin||''} onChange={e=>setProfile({...profile,practitionerTin:e.target.value})} placeholder="e.g. 12345678"/></Field>
          <Field label="Practice TIN"><input value={profile.practiceTin||''} onChange={e=>setProfile({...profile,practiceTin:e.target.value})} placeholder="e.g. 98765432"/></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Phone / Contact"><input value={profile.phone||''} onChange={e=>setProfile({...profile,phone:e.target.value})} placeholder="+1 758 …"/></Field>
          <Field label="Annual Gross Income (XCD)"><input type="number" min={0} value={profile.grossIncome||''} onChange={e=>setProfile({...profile,grossIncome:e.target.value})} placeholder="e.g. 1000000"/></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Tax Year"><select value={profile.taxYear||2026} onChange={e=>setProfile({...profile,taxYear:+e.target.value})}>{YEARS.map(y=><option key={y}>{y}</option>)}</select></Field>
          <Field label="Engagement Type">
            <select value={profile.engagementType||'both'} onChange={e=>setProfile({...profile,engagementType:e.target.value})}>
              <option value="both">Personal &amp; Business</option>
              <option value="business">Business Only</option>
              <option value="personal">Personal Only</option>
            </select>
          </Field>
        </TwoCol>
        <Field label="Address"><input value={profile.address||''} onChange={e=>setProfile({...profile,address:e.target.value})}/></Field>
        <Field label="Notes"><textarea value={profile.notes||''} rows={3} onChange={e=>setProfile({...profile,notes:e.target.value})}/></Field>
        <div className="profile-controls">
          <div style={{display:'flex',gap:6}}>
            <button className="btn-icon btn-nav" onClick={()=>setEntIdx(i=>Math.max(0,i-1))} disabled={entIdx===0}><ChevronUp size={16}/></button>
            <button className="btn-icon btn-nav" onClick={()=>setEntIdx(i=>Math.min(entities.length-1,i+1))} disabled={entIdx===entities.length-1}><ChevronDown size={16}/></button>
          </div>
          <span className="profile-entity-pos">{entIdx+1} / {entities.length}</span>
          <button onClick={save} className={saved?'btn-saved':''}>{saved?<><Check size={15}/> Saved</>:<><Check size={15}/> Save profile</>}</button>
        </div>
      </div>
    </div>
  )
}

// ── Allowances ────────────────────────────────────────────────────────────────
function AllowancesTab({entity,state,mutate,tk}){
  const eid   =entity?.id||'ent1'
  const claimed=state?.allowances?.[eid]||{personal:'40000'}
  const al    =tk.allowances||[]
  const totalClaimed=al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const maxTotal    =al.reduce((s,a)=>s+(a.max||0),0)
  function set(id,val){ mutate(db=>{ if(!db.allowances[eid]) db.allowances[eid]={}; db.allowances[eid]={...db.allowances[eid],[id]:val} }) }
  function fillMax(){ const next={...claimed}; al.forEach(a=>{if(a.max!==null) next[a.id]=String(a.max)}); mutate(db=>{ db.allowances[eid]=next }) }
  function clearAll(){ mutate(db=>{ db.allowances[eid]={personal:'40000'} }) }
  const cats={}; al.forEach(a=>{ if(!cats[a.cat]) cats[a.cat]=[]; cats[a.cat].push(a) })
  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Allowances</h1><p className="page-sub">ITA Cap 15.02 · 2025 regime · {entity?.name}</p></div>
        <div style={{display:'flex',gap:8,flexDirection:'column',alignItems:'flex-end'}}>
          <button className="btn-sm" onClick={fillMax}>Fill all max</button>
          <button className="btn-sm btn-secondary" onClick={clearAll}>Clear</button>
        </div>
      </div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Total claimed</div><div className="small-card-value">{fmtInt(totalClaimed)}</div><div className="card-sub">XCD this year</div></div>
        <div className="small-card"><div className="small-card-label">Max available</div><div className="small-card-value">{fmtInt(maxTotal)}</div><div className="card-sub">if all maximums claimed</div></div>
      </div>
      {Object.entries(cats).map(([cat,items])=>(
        <section key={cat} className="section">
          <div className="section-title">{cat}</div>
          {items.map(a=>(
            <div key={a.id} className="allowance-row">
              <div className="allowance-info">
                <div className="allowance-label">{a.label}{a.new2025&&<span className="badge-new">2025</span>}</div>
                {a.max!==null&&<div className="allowance-max">Max {fmtInt(a.max)} XCD</div>}
                <div className="allowance-note">{a.note}</div>
              </div>
              <div className="allowance-input-wrap">
                <input type="number" min={0} max={a.max||undefined} value={claimed[a.id]||''} placeholder="0" onChange={e=>set(a.id,e.target.value)} className="allowance-input"/>
                {a.max!==null&&<button className="btn-fill-max" onClick={()=>set(a.id,String(a.max))}>Max</button>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

// ── Personal ──────────────────────────────────────────────────────────────────
function PersonalTab({totals,yearExp,settings,year,setYear,totalEntries}){
  const months=MONTHS.map((_,i)=>yearExp.filter(e=>e.classification==='personal'&&new Date(e.date).getMonth()===i).reduce((s,e)=>s+Number(e.amount_xcd||0),0))
  const pMax =settings.personalMaximumLimit     ||232000
  const pCons=settings.personalConservativeLimit||232000
  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Personal</h1><p className="page-sub">Allowances — {year}</p></div>
        <select className="year-select" value={year} onChange={e=>setYear(+e.target.value)}>{YEARS.map(y=><option key={y}>{y}</option>)}</select>
      </div>
      <div className="big-card"><div className="big-card-head"><TrendingUp size={16} className="card-icon"/><span className="card-label">Personal Allowances</span></div><div className="big-card-value">{fmt(totals.personal)}</div><div className="card-sub">of ${pMax.toLocaleString()} max XCD</div></div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Total entries</div><div className="small-card-value">{totalEntries}</div><div className="card-sub">records this year</div></div>
        <div className="small-card"><div className="small-card-label">Combined total</div><div className="small-card-value">{fmt(totals.personal+totals.deductible)}</div><div className="card-sub">all deductions XCD</div></div>
      </div>
      <section className="section"><div className="section-title">Personal Allowances Progress</div><ProgressBar label="Conservative Limit" val={totals.personal} max={pCons}/><ProgressBar label="Maximum Limit" val={totals.personal} max={pMax}/></section>
      <section className="section"><div className="section-title">Monthly Breakdown — Personal</div><div className="month-grid">{MONTHS.map((m,i)=><div key={m} className="month-cell"><span className="month-label">{m}</span><strong className="month-val">{months[i]>0?fmt(months[i]):'—'}</strong></div>)}</div></section>
    </div>
  )
}

// ── Business ──────────────────────────────────────────────────────────────────
const BLANK_EXP={date:new Date().toISOString().slice(0,10),vendor:'',category:'',classification:'business',amount_xcd:'',currency:'XCD',notes:''}
function BusinessTab({expenses,yearEntExp,entityDeductible,entity,settings,year,setYear,mutate,tk}){
  const [form,setForm]=useState(BLANK_EXP)
  const [filter,setFilter]=useState('all')
  const [saving,setSaving]=useState(false)
  const [catMode,setCatMode]=useState('simple')
  const bizCats=settings?.categories?.business||[]
  const perCats=settings?.categories?.personal||[]
  const cats=form.classification==='personal'?perCats:bizCats
  const bMax=settings.maximumLimit||707700
  const bCons=settings.conservativeLimit||551000
  const expCats=tk.expenseCats||[]
  const months=MONTHS.map((_,i)=>yearEntExp.filter(e=>new Date(e.date).getMonth()===i).reduce((s,e)=>s+Number(e.deductible_amount||e.amount_xcd||0),0))
  function submit(ev){
    ev.preventDefault(); if(!form.vendor||!form.amount_xcd) return
    setSaving(true)
    const exp={...form,id:nanoid(),amount_xcd:Number(form.amount_xcd),status:'approved',deductible_amount:form.classification!=='personal'?Number(form.amount_xcd):0,entity_id:entity?.name||'',created_at:new Date().toISOString(),fx_rate:1,fx_date:form.date,is_capital:false,confidence:1,duplicate:false,near_duplicate:false,source_document_id:null}
    mutate(db=>{ db.expenses.push(exp) })
    setForm(BLANK_EXP); setSaving(false)
  }
  function del(id){ if(!confirm('Delete this expense?')) return; mutate(db=>{ db.expenses=db.expenses.filter(e=>e.id!==id) }) }
  const allEntExp=expenses.filter(e=>(e.entity_id===entity?.name||e.entity_id===entity?.shortName))
  const shown=filter==='all'?allEntExp:allEntExp.filter(e=>e.status===filter)
  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Business</h1><p className="page-sub">{entity?.name} — {year}</p></div>
        <select className="year-select" value={year} onChange={e=>setYear(+e.target.value)}>{YEARS.map(y=><option key={y}>{y}</option>)}</select>
      </div>
      <div className="big-card"><div className="big-card-head"><TrendingDown size={16} className="card-icon"/><span className="card-label">Business Expenses</span></div><div className="big-card-value">{fmt(entityDeductible)}</div><div className="card-sub">of ${bMax.toLocaleString()} max XCD</div></div>
      <section className="section"><div className="section-title">Expenses Progress</div><ProgressBar label="Conservative Limit" val={entityDeductible} max={bCons}/><ProgressBar label="Maximum Limit" val={entityDeductible} max={bMax}/></section>
      <section className="section"><div className="section-title">Monthly Breakdown</div><div className="month-grid">{MONTHS.map((m,i)=><div key={m} className="month-cell"><span className="month-label">{m}</span><strong className="month-val">{months[i]>0?fmt(months[i]):'—'}</strong></div>)}</div></section>
      <form className="expense-form" onSubmit={submit}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div className="section-title" style={{margin:0}}>Add Expense</div>
          <div style={{display:'flex',gap:6}}>
            <button type="button" className={`filter-btn${catMode==='simple'?' active':''}`} onClick={()=>setCatMode('simple')}>Simple</button>
            <button type="button" className={`filter-btn${catMode==='ird'?' active':''}`}    onClick={()=>setCatMode('ird')}>IRD items</button>
          </div>
        </div>
        <TwoCol>
          <Field label="Date"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required/></Field>
          <Field label="Amount (XCD)"><input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount_xcd} onChange={e=>setForm({...form,amount_xcd:e.target.value})} required/></Field>
        </TwoCol>
        <Field label="Vendor / Description"><input placeholder="e.g. Courts, LIME, Dr Smith" value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} required/></Field>
        {catMode==='simple'?(
          <TwoCol>
            <Field label="Type"><select value={form.classification} onChange={e=>setForm({...form,classification:e.target.value,category:''})}><option value="business">Business</option><option value="personal">Personal</option></select></Field>
            <Field label="Category"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">— select —</option>{cats.map(c=><option key={c}>{c}</option>)}</select></Field>
          </TwoCol>
        ):(
          <TwoCol>
            <Field label="IRD Category"><select value={form.ird_cat||''} onChange={e=>setForm({...form,ird_cat:e.target.value,category:e.target.value})}><option value="">— select —</option>{expCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></Field>
            <Field label="IRD Line Item"><select value={form.ird_item||''} onChange={e=>setForm({...form,ird_item:e.target.value})}><option value="">— select —</option>{(expCats.find(c=>c.name===form.ird_cat)||{items:[]}).items.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}</select></Field>
          </TwoCol>
        )}
        <Field label="Notes (optional)"><textarea placeholder="Reference, project…" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <button type="submit" disabled={saving}><Plus size={15}/>{saving?'Saving…':'Add Expense'}</button>
      </form>
      <div className="filter-row">{['all','approved','pending','rejected'].map(f=><button key={f} className={`filter-btn${filter===f?' active':''}`} onClick={()=>setFilter(f)}>{f}</button>)}</div>
      {shown.length===0?<div className="empty-state">No expenses for {entity?.name}.</div>
        :<div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>XCD</th><th>Status</th><th></th></tr></thead>
            <tbody>{shown.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.vendor}</td><td style={{color:'#666'}}>{e.category}</td><td style={{fontWeight:600}}>{fmt(e.amount_xcd)}</td><td><span className={`badge badge-${e.status}`}>{e.status}</span></td><td><button className="btn-icon btn-icon-danger" onClick={()=>del(e.id)}><Trash2 size={13}/></button></td></tr>)}</tbody>
          </table>
        </div>
      }
    </div>
  )
}

// ── Upload ────────────────────────────────────────────────────────────────────
function UploadTab({state,mutate,pending,entity}){
  const [view,setView]=useState('inbox')
  const [busy,setBusy]=useState(false)
  const [aiKey,setAiKey]=useState(sessionStorage.getItem('up_key')||'')
  const docs=(state?.documents||[]).slice().reverse()

  async function handleFiles(files){
    setBusy(true)
    if(aiKey) sessionStorage.setItem('up_key',aiKey)
    for(const file of [...files]){
      const extracted=await extractFile(aiKey,file)
      const rate=fxRate(extracted.currency)
      const amountXcd=Number((Number(extracted.total||0)*rate).toFixed(2))
      const docId=nanoid()
      const confidence=Number(extracted.confidence||0)
      const status=extracted.is_capital_item||confidence<0.75?'pending':'ready'
      const doc={id:docId,source_type:/pdf/i.test(file.type)?'pdf':'photo',file_url:'',file_name:file.name,received_at:new Date().toISOString(),status:'received',extracted}
      const exp={id:nanoid(),entity_id:extracted.suggested_entity||entity?.name||'Amise Medical Services',date:extracted.date||new Date().toISOString().slice(0,10),vendor:extracted.vendor_name||'Unknown',category:extracted.suggested_category||'',classification:extracted.suggested_classification||'business',amount_xcd:amountXcd,amount_original:Number(extracted.total||0),currency:extracted.currency||'XCD',fx_rate:rate,fx_date:new Date().toISOString().slice(0,10),is_capital:!!extracted.is_capital_item,deductible_amount:status==='approved'?amountXcd:0,source_document_id:docId,confidence,status,duplicate:false,near_duplicate:false,notes:extracted.notes||'',created_at:new Date().toISOString()}
      mutate(db=>{ db.documents.push(doc); db.expenses.push(exp) })
    }
    setBusy(false)
  }
  function update(id,patch){ mutate(db=>{ const i=db.expenses.findIndex(e=>e.id===id); if(i>=0) Object.assign(db.expenses[i],patch) }) }
  function bulk(){ mutate(db=>{ for(const e of db.expenses){ if(e.status==='ready'&&!e.is_capital&&!e.duplicate){ e.status='approved'; e.deductible_amount=e.classification!=='personal'?Number(e.amount_xcd||0):0 } } }) }
  function delDoc(id){ if(!confirm('Delete document and linked expense?')) return; mutate(db=>{ db.documents=db.documents.filter(d=>d.id!==id); db.expenses=db.expenses.filter(e=>e.source_document_id!==id) }) }

  return(
    <div className="page">
      <div className="page-title-row"><div><h1 className="page-h1">Upload</h1><p className="page-sub">{docs.length} documents · {pending.length} pending</p></div></div>
      <section className="section">
        <div className="section-title">Anthropic API Key (for AI extraction)</div>
        <p style={{fontSize:13,color:'#777',marginBottom:10}}>Optional — used only for receipt AI extraction. Stored in session only.</p>
        <div style={{display:'flex',gap:8}}>
          <input type="password" value={aiKey} onChange={e=>setAiKey(e.target.value)} placeholder="sk-ant-api03-…" style={{flex:1,padding:'11px 13px',border:'1.5px solid #dde4e1',borderRadius:10,fontSize:14}}/>
        </div>
      </section>
      <label className="drop-zone">
        <input type="file" multiple accept="image/*,.heic,.pdf,.xlsx,.csv,.doc,.docx" onChange={e=>handleFiles(e.target.files)}/>
        <UploadCloud size={40} className="card-icon"/>
        <strong>Drop receipts, invoices, statements</strong>
        <span>Photos, PDF, Excel, CSV — up to 30 files · AI extracts details if key provided</span>
      </label>
      {busy&&<div className="notice">Processing files…</div>}
      <div className="filter-row">
        <button className={`filter-btn${view==='inbox'?' active':''}`} onClick={()=>setView('inbox')}>Inbox{pending.length>0?` (${pending.length})`:''}</button>
        <button className={`filter-btn${view==='docs'?' active':''}`} onClick={()=>setView('docs')}>All Documents{docs.length>0?` (${docs.length})`:''}</button>
      </div>
      {view==='inbox'&&(
        <>
          {pending.length>0&&(
            <section className="section">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div className="section-title" style={{margin:0}}>Review Inbox ({pending.length})</div>
                <button className="btn-sm" onClick={bulk}>Approve all ready</button>
              </div>
              <div className="review-list">{pending.map(e=><ReviewCard key={e.id} e={e} state={state} update={update}/>)}</div>
            </section>
          )}
          {!busy&&pending.length===0&&<div className="empty-state">No items pending review.</div>}
        </>
      )}
      {view==='docs'&&(
        docs.length===0?<div className="empty-state">No documents uploaded yet.</div>
          :<div className="doc-grid">
            {docs.map(d=>{
              const x=d.extracted||{}
              const linkedExp=(state?.expenses||[]).find(e=>e.source_document_id===d.id)
              return(
                <div key={d.id} className="doc-card">
                  <div className="doc-thumb">{d.source_type==='pdf'?<FileText size={22} color="#c03030"/>:<Receipt size={22} color="#3d9b7d"/>}</div>
                  <div className="doc-info">
                    <div className="doc-name">{d.file_name||'Document'}</div>
                    <div className="doc-meta">{x.vendor_name&&<span>{x.vendor_name}{x.date?` · ${x.date}`:''}{x.total?` · $${Number(x.total).toLocaleString()}`:''}</span>}</div>
                    <div className="doc-extracted">
                      {x.suggested_category&&<span className="doc-tag">{x.suggested_category}</span>}
                      {linkedExp&&<span className={`badge badge-${linkedExp.status}`}>{linkedExp.status}</span>}
                    </div>
                  </div>
                  <div className="doc-actions">
                    <button className="btn-icon btn-icon-danger" onClick={()=>delDoc(d.id)}><Trash2 size={13}/></button>
                  </div>
                </div>
              )
            })}
          </div>
      )}
    </div>
  )
}
function ReviewCard({e,state,update}){
  const [x,setX]=useState(e)
  const cats=state.settings.categories[x.classification==='personal'?'personal':'business']||[]
  return(
    <div className={`review-card${e.status==='pending'?' needs-review':''}`}>
      <div className="review-head"><strong>{e.vendor||'Unknown'}</strong><span className={`badge badge-${e.status}`}>{e.status}</span></div>
      <div className="review-amount">{fmt(e.amount_xcd)} <span style={{fontSize:13,color:'#aaa'}}>XCD</span></div>
      {e.is_capital&&<div className="warn">Capital item</div>}
      <div className="review-fields">
        <input value={x.vendor||''} placeholder="Vendor" onChange={ev=>setX({...x,vendor:ev.target.value})}/>
        <input type="date" value={x.date||''} onChange={ev=>setX({...x,date:ev.target.value})}/>
        <select value={x.classification} onChange={ev=>setX({...x,classification:ev.target.value})}><option value="business">Business</option><option value="personal">Personal</option></select>
        <select value={x.category} onChange={ev=>setX({...x,category:ev.target.value})}><option value="">— category —</option>{cats.map(c=><option key={c}>{c}</option>)}</select>
      </div>
      <div className="review-actions">
        <button onClick={()=>update(e.id,{...x,status:'approved',deductible_amount:x.classification!=='personal'?Number(x.amount_xcd||0):0})}><CheckCircle size={14}/> Approve</button>
        <button className="btn-secondary" onClick={()=>update(e.id,x)}>Save</button>
        <button className="btn-danger" onClick={()=>update(e.id,{status:'rejected'})}><Trash2 size={14}/> Reject</button>
      </div>
    </div>
  )
}

// ── Payroll ───────────────────────────────────────────────────────────────────
function PayrollTab({state,entity,mutate}){
  const ps   =state?.payroll?.settings||{}
  const staff=state?.payroll?.staff   ||[]
  const runs =state?.payroll?.runs    ||[]
  const now  =new Date()
  const [month,   setMonth  ]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [running, setRunning]=useState(false)
  const [editing, setEditing]=useState(null)
  const active=staff.filter(s=>s.status==='active')
  const currentRun=runs.find(r=>r.month===month)

  function runPayroll(){
    setRunning(true)
    const lines=active.map(s=>{const c=computePayFE(s,ps);return{staffId:s.id,name:s.name,position:s.position,entity:s.entity,type:s.type,gross:s.grossMonthly,paye:c.paye,nicEmployee:c.nic,nicEmployer:c.nicEmpr,net:c.net}})
    const totals=lines.reduce((t,l)=>({gross:+(t.gross+l.gross).toFixed(2),paye:+(t.paye+l.paye).toFixed(2),nicEmployee:+(t.nicEmployee+l.nicEmployee).toFixed(2),nicEmployer:+(t.nicEmployer+l.nicEmployer).toFixed(2),net:+(t.net+l.net).toFixed(2)}),{gross:0,paye:0,nicEmployee:0,nicEmployer:0,net:0})
    const run={id:nanoid(),month,lines,totals,createdAt:new Date().toISOString()}
    mutate(db=>{ db.payroll.runs=db.payroll.runs.filter(r=>r.month!==month); db.payroll.runs.push(run) })
    setRunning(false)
  }
  function exportRun(){
    if(!currentRun) return
    const byEntity={}
    for(const l of currentRun.lines){ if(!byEntity[l.entity]) byEntity[l.entity]={salaries:0,nicEmpr:0}; byEntity[l.entity].salaries+=l.gross; byEntity[l.entity].nicEmpr+=l.nicEmployer }
    mutate(db=>{
      db.expenses=db.expenses.filter(e=>e.payroll_month!==month)
      for(const [ent,t] of Object.entries(byEntity)){
        const total=+(t.salaries+t.nicEmpr).toFixed(2)
        db.expenses.push({id:nanoid(),entity_id:ent,date:`${month}-01`,vendor:'Staff Payroll',category:'staff salaries & employer NIC',classification:'business',amount_xcd:total,amount_original:total,currency:'XCD',fx_rate:1,fx_date:`${month}-01`,is_capital:false,deductible_amount:total,source_document_id:null,confidence:1,status:'approved',duplicate:false,near_duplicate:false,payroll_month:month,notes:`${currentRun.lines.length} staff · salaries XCD ${t.salaries.toFixed(2)} · employer NIC XCD ${t.nicEmpr.toFixed(2)}`,created_at:new Date().toISOString()})
      }
    })
  }
  function saveStaff(s){
    if(s.id) mutate(db=>{ const i=db.payroll.staff.findIndex(x=>x.id===s.id); if(i>=0) db.payroll.staff[i]={...db.payroll.staff[i],...s} })
    else mutate(db=>{ db.payroll.staff.push({...s,id:nanoid(),status:'active'}) })
    setEditing(null)
  }
  function delStaff(id){ if(!confirm('Remove staff member?')) return; mutate(db=>{ db.payroll.staff=db.payroll.staff.filter(s=>s.id!==id) }) }
  function printSlip(l){
    const w=window.open('','_blank'); if(!w) return
    const [yr,mo]=month.split('-')
    const mLabel=new Date(+yr,+mo-1,1).toLocaleString('en-GB',{month:'long',year:'numeric'})
    w.document.write(`<!doctype html><html><head><title>Pay Slip</title><style>body{font-family:system-ui;padding:28px;max-width:500px;margin:auto;color:#111}hr{border:none;border-top:1px solid #ddd;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;font-size:14px}td:last-child{text-align:right;font-weight:700}.tot td{border-top:2px solid #111;font-weight:800}.foot{font-size:11px;color:#888;margin-top:22px;line-height:1.6}</style></head><body><h2 style="margin:0 0 2px">Amise Medical Services</h2><p style="color:#555;font-size:13px;margin:2px 0 18px">Pay Slip · ${mLabel}</p><hr><p><b>${l.name}</b></p><p style="color:#555;font-size:13px;margin:4px 0">${l.position||''} · ${l.entity||''}</p><hr><table><tr><td>Gross salary</td><td>${fmt(l.gross)}</td></tr><tr><td>PAYE withheld</td><td style="color:#c03030">(${fmt(l.paye)})</td></tr><tr><td>Employee NIC</td><td style="color:#b06000">(${fmt(l.nicEmployee)})</td></tr><tr class="tot"><td>Net pay</td><td style="color:#006b3e">${fmt(l.net)}</td></tr></table><p style="margin-top:14px;font-size:13px;color:#555">Employer NIC: ${fmt(l.nicEmployer)}</p><hr><p class="foot">Generated ${new Date().toLocaleDateString('en-GB')} · ITA Cap 15.02 / NIC Act · Reference only</p></body></html>`)
    w.document.close(); w.print()
  }
  const rTot=active.reduce((t,s)=>{const c=computePayFE(s,ps);return{gross:+(t.gross+s.grossMonthly).toFixed(2),nic:+(t.nic+c.nic).toFixed(2),paye:+(t.paye+c.paye).toFixed(2),net:+(t.net+c.net).toFixed(2)}},{gross:0,nic:0,paye:0,net:0})
  const entityForBlank=state?.settings?.entities?.[0]||entity?.name||'Amise Medical Services'
  return(
    <div className="page">
      <h1 className="page-h1">Payroll</h1>
      <p className="page-sub" style={{marginBottom:14}}>Saint Lucia ITA Cap 15.02 · NIC Act</p>
      <section className="section" style={{padding:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 18px 12px'}}>
          <div className="section-title" style={{margin:0}}>Staff Roster — {active.length} active</div>
          <button className="btn-sm" onClick={()=>setEditing({name:'',position:'',entity:entityForBlank,type:'permanent',grossMonthly:0,spouseAllowance:0,childAllowance:0,otherAllowance:0})}><Plus size={14}/> Add staff</button>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr><th>Name / Position</th><th>Entity</th><th>Gross/mo</th><th>NIC emp</th><th>PAYE/mo</th><th>Net/mo</th><th></th></tr></thead>
            <tbody>
              {active.map(s=>{const c=computePayFE(s,ps);return(
                <tr key={s.id}>
                  <td><b>{s.name}</b><br/><small style={{color:'#888'}}>{s.position}</small></td>
                  <td style={{fontSize:12}}>{s.entity}</td>
                  <td>{fmt(s.grossMonthly)}</td>
                  <td style={{color:'#b06000'}}>{fmt(c.nic)}</td>
                  <td style={{color:'#c03030'}}>{fmt(c.paye)}</td>
                  <td style={{color:'#177a56',fontWeight:700}}>{fmt(c.net)}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button className="btn-icon" style={{marginRight:4}} onClick={()=>setEditing({...s})}><Pencil size={13}/></button>
                    <button className="btn-icon btn-icon-danger" onClick={()=>delStaff(s.id)}><X size={13}/></button>
                  </td>
                </tr>
              )})}
              <tr style={{fontWeight:800,background:'#f6fbf9'}}><td colSpan={2}>TOTAL — {active.length} staff</td><td>{fmt(rTot.gross)}</td><td style={{color:'#b06000'}}>{fmt(rTot.nic)}</td><td style={{color:'#c03030'}}>{fmt(rTot.paye)}</td><td style={{color:'#177a56'}}>{fmt(rTot.net)}</td><td/></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <div className="section-title">Monthly Payroll Run</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:16}}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',padding:'10px 14px'}}/>
          <button onClick={runPayroll} disabled={running}>{running?'Computing…':'▶ Run '+month}</button>
          {currentRun&&<button style={{background:'#177a56'}} onClick={exportRun}>→ Post to Expenses</button>}
        </div>
        {currentRun&&(
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Gross</th><th>PAYE</th><th>NIC Emp</th><th>NIC Empr</th><th>Net Pay</th><th>Slip</th></tr></thead>
              <tbody>
                {currentRun.lines.map(l=>(
                  <tr key={l.staffId}>
                    <td><b>{l.name}</b><br/><small style={{color:'#888'}}>{l.position}</small></td>
                    <td>{fmt(l.gross)}</td><td style={{color:'#c03030'}}>{fmt(l.paye)}</td>
                    <td style={{color:'#b06000'}}>{fmt(l.nicEmployee)}</td><td style={{color:'#666'}}>{fmt(l.nicEmployer)}</td>
                    <td style={{color:'#177a56',fontWeight:700}}>{fmt(l.net)}</td>
                    <td><button className="btn-icon" onClick={()=>printSlip(l)}>🖨</button></td>
                  </tr>
                ))}
                <tr style={{fontWeight:800,background:'#f6fbf9'}}><td>TOTAL</td><td>{fmt(currentRun.totals.gross)}</td><td style={{color:'#c03030'}}>{fmt(currentRun.totals.paye)}</td><td style={{color:'#b06000'}}>{fmt(currentRun.totals.nicEmployee)}</td><td style={{color:'#666'}}>{fmt(currentRun.totals.nicEmployer)}</td><td style={{color:'#177a56',fontWeight:700}}>{fmt(currentRun.totals.net)}</td><td/></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing&&<Modal title={editing.id?'Edit Staff Member':'Add Staff Member'} onClose={()=>setEditing(null)}><StaffForm s={editing} ps={ps} entities={state?.settings?.entities||[entityForBlank]} onSave={saveStaff} onClose={()=>setEditing(null)}/></Modal>}
    </div>
  )
}
function StaffForm({s,ps,entities,onSave,onClose}){
  const [f,setF]=useState({...s}); const c=computePayFE(f,ps)
  return(
    <div>
      <Field label="Full name / label"><input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <Field label="Position / Job title"><input value={f.position||''} onChange={e=>setF({...f,position:e.target.value})}/></Field>
      <TwoCol>
        <Field label="Entity"><select value={f.entity||''} onChange={e=>setF({...f,entity:e.target.value})}>{entities.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="Employment type"><select value={f.type||'permanent'} onChange={e=>setF({...f,type:e.target.value})}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="parttime">Part-time</option></select></Field>
      </TwoCol>
      <Field label="Gross monthly salary (XCD)"><input type="number" min={0} value={f.grossMonthly||0} onChange={e=>setF({...f,grossMonthly:+e.target.value})}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <Field label="Spouse allow./yr"><input type="number" min={0} value={f.spouseAllowance||0} onChange={e=>setF({...f,spouseAllowance:+e.target.value})}/></Field>
        <Field label="Child allow./yr"><input type="number" min={0} value={f.childAllowance||0} onChange={e=>setF({...f,childAllowance:+e.target.value})}/></Field>
        <Field label="Other allow./yr"><input type="number" min={0} value={f.otherAllowance||0} onChange={e=>setF({...f,otherAllowance:+e.target.value})}/></Field>
      </div>
      <div className="paye-preview">
        <div className="paye-preview-title">Monthly preview (ITA Cap 15.02)</div>
        <div className="paye-preview-grid">
          <div><div className="paye-label">Gross</div><strong>{fmt(f.grossMonthly||0)}</strong></div>
          <div><div className="paye-label">NIC emp</div><strong style={{color:'#b06000'}}>{fmt(c.nic)}</strong></div>
          <div><div className="paye-label">PAYE</div><strong style={{color:'#c03030'}}>{fmt(c.paye)}</strong></div>
          <div><div className="paye-label">Net pay</div><strong style={{color:'#177a56'}}>{fmt(c.net)}</strong></div>
        </div>
      </div>
      <div className="modal-actions">
        <button onClick={()=>onSave(f)}><Check size={15}/> Save</button>
        {f.id&&<button className="btn-danger" onClick={()=>{if(confirm('Deactivate?')) onSave({...f,status:'inactive'})}}>Deactivate</button>}
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ── Tax Computation ───────────────────────────────────────────────────────────
function TaxCompTab({entity,state,entityDeductible,tk}){
  const bands  =tk.taxBands||[]
  const al     =tk.allowances||[]
  const expCats=tk.expenseCats||[]
  const eid    =entity?.id||''
  const claimed=state?.allowances?.[eid]||{personal:'40000'}
  const gross  =Number(entity?.profile?.grossIncome)||0
  const totalAllowances=al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const chargeable     =Math.max(0,gross-totalAllowances-entityDeductible)
  const taxPayable     =calcTax(chargeable,bands)
  const effectiveRate  =gross>0?(taxPayable/gross)*100:0
  const conserv_allow=134000, max_allow=208500
  const conserv_exp  =expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.conservative,0),0)
  const max_exp      =expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.maximum,0),0)
  const taxCons=calcTax(Math.max(0,gross-conserv_allow-conserv_exp),bands)
  const taxMax =calcTax(Math.max(0,gross-max_allow-max_exp),bands)
  const inTarget=taxPayable>=50000&&taxPayable<=70000
  const bandRows=bands.map(b=>{
    if(chargeable<=b.from) return{band:b.label,rate:`${(b.rate*100).toFixed(0)}%`,taxable:0,tax:0}
    const top=b.to===null?chargeable:Math.min(chargeable,b.to)
    const taxable=top-b.from
    return{band:b.label,rate:`${(b.rate*100).toFixed(0)}%`,taxable,tax:taxable*b.rate}
  })
  return(
    <div className="page">
      <div className="page-title-row"><div><h1 className="page-h1">Tax Computation</h1><p className="page-sub">{entity?.name} — ITA Cap 15.02 2025</p></div></div>
      {!gross&&<div className="warn">Enter annual gross income in the Profile tab to see the full computation.</div>}
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Gross income</div><div className="small-card-value">{fmtInt(gross)}</div><div className="card-sub">XCD annual</div></div>
        <div className="small-card"><div className="small-card-label">Total deductions</div><div className="small-card-value">{fmtInt(totalAllowances+entityDeductible)}</div><div className="card-sub">allowances + expenses</div></div>
      </div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Chargeable income</div><div className="small-card-value">{fmtInt(chargeable)}</div><div className="card-sub">XCD after deductions</div></div>
        <div className="small-card"><div className="small-card-label">Tax payable</div><div className="small-card-value" style={{color:inTarget?'#177a56':'#c03030'}}>{fmtInt(taxPayable)}</div><div className="card-sub">{effectiveRate.toFixed(2)}% effective rate</div></div>
      </div>
      <div className={`target-banner${inTarget?' target-ok':taxPayable<50000?' target-low':' target-high'}`}>
        <Shield size={16}/> Target band $50,000–$70,000 XCD — {inTarget?'✓ Within target':taxPayable<50000?'Below target — risk of appearing under-taxed':'Above target — deductions not fully optimised'}
      </div>
      <section className="section" style={{padding:0}}>
        <div style={{padding:'16px 18px 12px'}} className="section-title">Tax Band Breakdown</div>
        <table className="data-table">
          <thead><tr><th>Band</th><th>Rate</th><th style={{textAlign:'right'}}>Taxable XCD</th><th style={{textAlign:'right'}}>Tax XCD</th></tr></thead>
          <tbody>
            {bandRows.map((r,i)=>(
              <tr key={i} style={{opacity:r.taxable>0?1:.45}}>
                <td style={{fontSize:12}}>{r.band}</td><td style={{fontWeight:600}}>{r.rate}</td>
                <td style={{textAlign:'right'}}>{r.taxable>0?fmtInt(r.taxable):'—'}</td>
                <td style={{textAlign:'right',color:r.tax>0?'#c03030':'#aaa'}}>{r.tax>0?fmtInt(r.tax):'—'}</td>
              </tr>
            ))}
            <tr style={{fontWeight:800}}><td colSpan={2}>Total tax payable</td><td style={{textAlign:'right'}}>{fmtInt(chargeable)}</td><td style={{textAlign:'right',color:'#c03030'}}>{fmtInt(taxPayable)}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="section">
        <div className="section-title">Scenario Comparison</div>
        <div className="scenario-grid">
          <div className="scenario-card"><div className="scenario-label">Conservative</div><div className="scenario-deduct">{fmtInt(conserv_allow+conserv_exp)} deductions</div><div className="scenario-tax">{fmtInt(taxCons)}</div><div className="card-sub">tax payable XCD</div></div>
          <div className="scenario-card scenario-current"><div className="scenario-label">Current</div><div className="scenario-deduct">{fmtInt(totalAllowances+entityDeductible)} deductions</div><div className="scenario-tax">{fmtInt(taxPayable)}</div><div className="card-sub">tax payable XCD</div></div>
          <div className="scenario-card"><div className="scenario-label">Maximum</div><div className="scenario-deduct">{fmtInt(max_allow+max_exp)} deductions</div><div className="scenario-tax" style={{color:'#177a56'}}>{fmtInt(taxMax)}</div><div className="card-sub">tax payable XCD</div></div>
        </div>
      </section>
    </div>
  )
}

// ── Action Plan ───────────────────────────────────────────────────────────────
function ActionPlanTab({state,mutate,tk}){
  const actions =tk.keyActions||[]
  const done    =state?.actions||{}
  const pending =actions.filter(a=>!done[a.id])
  const potential=pending.reduce((s,a)=>s+a.saving,0)
  function toggle(id){ mutate(db=>{ db.actions={...db.actions,[id]:!db.actions[id]} }) }
  return(
    <div className="page">
      <h1 className="page-h1">Action Plan</h1>
      <p className="page-sub">Key 2025/26 IRD actions · Filing deadline 31 March 2026</p>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Pending actions</div><div className="small-card-value">{pending.length}</div><div className="card-sub">of {actions.length} total</div></div>
        <div className="small-card"><div className="small-card-label">Potential savings</div><div className="small-card-value" style={{color:'#177a56'}}>{fmtInt(potential)}</div><div className="card-sub">XCD additional deductions</div></div>
      </div>
      <div className="actions-list">
        {actions.map(a=>(
          <div key={a.id} className={`action-item${done[a.id]?' action-done':''}`} onClick={()=>toggle(a.id)}>
            <div className={`action-check${done[a.id]?' action-check-done':''}`}>{done[a.id]&&<Check size={14}/>}</div>
            <div className="action-body">
              <div className="action-label">{a.label}</div>
              <div className="action-meta"><span className="action-saving">Saves {fmtInt(a.saving)} XCD</span><span className="action-deadline">⏰ {a.deadline}</span></div>
              <div className="action-note">{a.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="notice">Tap each action to mark it complete. Consult a registered tax practitioner before filing with Saint Lucia IRD (efilingovt.lc · Tel 468-4700).</div>
    </div>
  )
}

// ── AI Report ─────────────────────────────────────────────────────────────────
function AIReportTab({entity,state,entityDeductible,tk}){
  const [apiKey, setApiKey]=useState(sessionStorage.getItem('ai_key')||'')
  const [showKey,setShowKey]=useState(false)
  const [loading,setLoading]=useState(false)
  const [report, setReport]=useState('')
  const [error,  setError ]=useState('')

  const bands  =tk.taxBands||[]
  const al     =tk.allowances||[]
  const expCats=tk.expenseCats||[]
  const actions=tk.keyActions||[]
  const eid    =entity?.id||''
  const claimed=state?.allowances?.[eid]||{personal:'40000'}
  const gross  =Number(entity?.profile?.grossIncome)||0
  const totalAllowances=al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const chargeable =Math.max(0,gross-totalAllowances-entityDeductible)
  const taxPayable =calcTax(chargeable,bands)
  const effectiveRate=gross>0?(taxPayable/gross)*100:0
  const done   =state?.actions||{}
  const pendingActions=actions.filter(a=>!done[a.id])
  const conserv_exp=expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.conservative,0),0)
  const max_exp    =expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.maximum,0),0)
  const taxCons=calcTax(Math.max(0,gross-134000-conserv_exp),bands)
  const taxMax =calcTax(Math.max(0,gross-208500-max_exp),bands)

  async function generate(){
    if(!apiKey) return
    sessionStorage.setItem('ai_key',apiKey)
    setLoading(true); setError(''); setReport('')
    const xcd=v=>'$'+Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0})
    const prompt=`You are a senior tax consultant specialising in Saint Lucia's IRD regime (ITA Cap 15.02, 2025). You are advising a medical practitioner.

PRACTITIONER: ${entity?.profile?.practitionerName||'Practitioner'}
PRACTICE: ${entity?.profile?.practiceName||entity?.name||''}
TAX YEAR: ${entity?.profile?.taxYear||2026}
GROSS PROFESSIONAL INCOME: XCD ${xcd(gross)}
PERSONAL ALLOWANCES CLAIMED: XCD ${xcd(totalAllowances)}
DEDUCTIBLE BUSINESS EXPENSES: XCD ${xcd(entityDeductible)}
CHARGEABLE INCOME: XCD ${xcd(chargeable)}
INCOME TAX PAYABLE: XCD ${xcd(taxPayable)}
EFFECTIVE TAX RATE: ${effectiveRate.toFixed(2)}%

IRD 2025 TAX BANDS: Band 1 First $18,000 @ 0% | Band 2 $18,001–30,000 @ 10% | Band 3 $30,001–50,000 @ 15% | Band 4 $50,001–80,000 @ 20% | Band 5 Above $80,000 @ 30%

SCENARIOS: Conservative deductions (${xcd(134000+conserv_exp)} = tax ${xcd(taxCons)}) | Maximum (${xcd(208500+max_exp)} = tax ${xcd(taxMax)})

PENDING IRD ACTIONS (potential XCD ${xcd(pendingActions.reduce((s,a)=>s+(a.saving||0),0))} additional deductions):
${pendingActions.map(a=>`- ${a.label}: saves XCD ${xcd(a.saving)} — ${a.note} (deadline ${a.deadline})`).join('\n')}

FILING DEADLINE: 31 March 2026 | efilingovt.lc | Tel: 468-4700

Provide a structured tax planning report covering:
**1. EXECUTIVE SUMMARY** — Overall position and headline recommendation.
**2. PERSONAL ALLOWANCES ANALYSIS** — Current utilisation vs maximum ($208,500 for 2025). Key underutilised allowances.
**3. BUSINESS EXPENSE OPTIMISATION** — Commentary on current vs conservative and maximum scenarios.
**4. TAX COMPUTATION WALKTHROUGH** — Step-by-step with 2025 bands.
**5. 2025/26 ACTION PLAN** — Ranked by saving potential. Specific steps and documentation required.
**6. COMPLIANCE & DOCUMENTATION** — Key records per IRD (7-year rule, ITA s.73). Risk areas.
**7. MULTI-YEAR PLANNING** — 2026 and beyond.

Write in professional British-Caribbean tone. Be specific and actionable.`

    try{
      const text=await callClaude(apiKey,[{role:'user',content:prompt}],'claude-sonnet-4-6',3000)
      setReport(text)
    }catch(err){ setError(err.message||String(err)) }
    setLoading(false)
  }

  return(
    <div className="page">
      <h1 className="page-h1">AI Report</h1>
      <p className="page-sub">Claude-generated tax consultancy report · {entity?.name}</p>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Gross income</div><div className="small-card-value">{fmtInt(gross)}</div><div className="card-sub">XCD annual</div></div>
        <div className="small-card"><div className="small-card-label">Tax payable</div><div className="small-card-value" style={{color:'#c03030'}}>{fmtInt(taxPayable)}</div><div className="card-sub">{effectiveRate.toFixed(2)}% effective</div></div>
      </div>
      {!gross&&<div className="warn">Enter gross income in Profile tab before generating report.</div>}
      <section className="section">
        <div className="section-title">Anthropic API Key</div>
        <p style={{fontSize:13,color:'#777',marginBottom:10}}>Sent directly to Anthropic — never stored on any server.</p>
        <div style={{display:'flex',gap:8}}>
          <input type={showKey?'text':'password'} value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-ant-api03-…" style={{flex:1,padding:'11px 13px',border:'1.5px solid #dde4e1',borderRadius:10,fontSize:14}}/>
          <button className="btn-secondary btn-sm" onClick={()=>setShowKey(v=>!v)} style={{flexShrink:0}}>{showKey?'Hide':'Show'}</button>
        </div>
      </section>
      <button onClick={generate} disabled={!apiKey||!gross||loading} style={{width:'100%',justifyContent:'center',fontSize:15,padding:'13px'}}>
        <Brain size={17}/>{loading?'Generating report…':'Generate Tax Consultancy Report'}
      </button>
      {error&&<div className="warn">Error: {error}</div>}
      {report&&(
        <section className="section">
          <div className="section-title">Report — {new Date().toLocaleDateString('en-GB')}</div>
          <div className="report-body">
            {report.split('\n').map((line,i)=>{
              if(line.startsWith('**')&&line.endsWith('**')) return <h3 key={i} className="report-h3">{line.replace(/\*\*/g,'')}</h3>
              if(line.startsWith('- ')) return <p key={i} className="report-bullet">• {line.slice(2)}</p>
              if(!line.trim()) return <br key={i}/>
              return <p key={i} className="report-p">{line}</p>
            })}
          </div>
        </section>
      )}
      {!report&&!loading&&<div className="empty-state" style={{padding:'30px 20px'}}>Report will appear here after generation.</div>}
    </div>
  )
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsTab({yearEntExp,year,entity}){
  const byCategory=yearEntExp.reduce((a,e)=>{const k=e.category||'Uncategorised';a[k]=(a[k]||0)+(+(e.deductible_amount||e.amount_xcd||0));return a},{})
  const rows=Object.entries(byCategory).sort((a,b)=>b[1]-a[1])
  const total=rows.reduce((s,[,v])=>s+v,0)
  return(
    <div className="page">
      <div className="page-title-row"><div><h1 className="page-h1">Reports</h1><p className="page-sub">{entity?.name} — {year}</p></div></div>
      {rows.length===0?<div className="empty-state">No approved expenses for {entity?.name}.</div>
        :<section className="section" style={{padding:0}}>
          <table className="data-table">
            <thead><tr><th>Category</th><th style={{textAlign:'right'}}>XCD</th><th style={{textAlign:'right'}}>%</th></tr></thead>
            <tbody>
              {rows.map(([k,v])=><tr key={k}><td>{k}</td><td style={{textAlign:'right',fontWeight:600}}>{fmt(v)}</td><td style={{textAlign:'right',color:'#888',fontSize:12}}>{total>0?Math.round((v/total)*100):0}%</td></tr>)}
              <tr style={{fontWeight:700}}><td>Total</td><td style={{textAlign:'right'}}>{fmt(total)}</td><td style={{textAlign:'right'}}>100%</td></tr>
            </tbody>
          </table>
        </section>
      }
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────
function SummaryTab({totals,entityDeductible,settings,entity}){
  const pMax =settings.personalMaximumLimit     ||232000
  const pCons=settings.personalConservativeLimit||232000
  const bMax =settings.maximumLimit             ||707700
  const bCons=settings.conservativeLimit        ||551000
  return(
    <div className="page">
      <div className="page-title-row"><div><h1 className="page-h1">Summary</h1><p className="page-sub">{entity?.name}</p></div></div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Business deductible</div><div className="small-card-value">{fmt(entityDeductible)}</div><div className="card-sub">approved XCD</div></div>
        <div className="small-card"><div className="small-card-label">Personal allowances</div><div className="small-card-value">{fmt(totals.personal)}</div><div className="card-sub">approved XCD</div></div>
      </div>
      <section className="section"><div className="section-title">Personal Allowances (ITA Cap 15.02)</div><ProgressBar label="Conservative Limit" val={totals.personal} max={pCons}/><ProgressBar label="Maximum Limit" val={totals.personal} max={pMax}/></section>
      <section className="section"><div className="section-title">Business Expenses — {entity?.name}</div><ProgressBar label="Conservative Limit" val={entityDeductible} max={bCons}/><ProgressBar label="Maximum Limit" val={entityDeductible} max={bMax}/></section>
      <div className="notice">Capital items excluded from deductible total. Confirm all figures with a registered tax practitioner before filing with Saint Lucia IRD.</div>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────
function ProgressBar({label,val,max}){
  const pct=Math.min(100,max>0?Math.round((val/max)*100):0)
  return(
    <div className="progress-row">
      <div className="progress-meta"><span>{label}</span><span>${(val||0).toLocaleString(undefined,{maximumFractionDigits:0})} / ${(max||0).toLocaleString()} XCD</span></div>
      <div className="progress-track"><div className="progress-fill" style={{width:pct+'%'}}/></div>
    </div>
  )
}
function Field({label,children}){return<div className="field"><label className="field-label">{label}</label>{children}</div>}
function TwoCol({children}){return<div className="two-col">{children}</div>}
function Modal({title,onClose,children}){
  return(
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="modal">
        <div className="modal-header"><strong>{title}</strong><button className="btn-icon" onClick={onClose}><X size={16}/></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App/>)
