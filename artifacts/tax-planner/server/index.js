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

const DEFAULT_PAYROLL_SETTINGS = {
  personalAllowance: 40000,   // XCD/yr employee personal allowance
  nicEmployeeRate:   0.05,    // 5 % of insurable earnings
  nicEmployerRate:   0.05,    // 5 % employer contribution
  nicMonthlyCeiling: 5000,    // XCD insurable earnings ceiling per month
  taxBands: [                 // Applied on annual chargeable income after all allowances
    { upto: 10000, rate: 0.10 },
    { upto: 20000, rate: 0.15 },
    { upto: 30000, rate: 0.20 },
    { upto: null,  rate: 0.25 }, // null = no upper limit
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
};

function readDb(){ if(!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify(defaultDb,null,2)); return JSON.parse(fs.readFileSync(DATA_PATH,'utf8')); }
function writeDb(db){ fs.writeFileSync(DATA_PATH, JSON.stringify(db,null,2)); }

// Migration: seed payroll block into db.json files created before this feature
function ensurePayroll(db){
  if(!db.payroll){ db.payroll={ settings:{...DEFAULT_PAYROLL_SETTINGS}, staff:[...DEFAULT_STAFF], runs:[] }; writeDb(db); }
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

app.get('/api/state', (_,res)=>{ const db=readDb(); ensurePayroll(db); ensureEntities(db); res.json(db); });

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

// ─── MISC ─────────────────────────────────────────────────────────────────────

app.delete('/api/reset', (_,res)=>{ writeDb(defaultDb); res.json({ok:true}); });

app.use(express.static(path.join(ROOT,'dist')));
app.get('*', (_,res)=>{ const html=path.join(ROOT,'dist','index.html'); fs.existsSync(html) ? res.sendFile(html) : res.send('Run npm run dev for the frontend.'); });
app.listen(PORT, ()=>console.log(`Amise Tax Planner API running on http://localhost:${PORT}`));
