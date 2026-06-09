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

const defaultDb = {
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
  vendors: []
};
function readDb(){ if(!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify(defaultDb,null,2)); return JSON.parse(fs.readFileSync(DATA_PATH,'utf8')); }
function writeDb(db){ fs.writeFileSync(DATA_PATH, JSON.stringify(db,null,2)); }
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
      // One bad document must not kill the whole batch — hold it for manual review.
      return fallbackExtract(file, ext, `Auto-extract failed: ${err.message}. Held for manual review.`, 0.3);
    }
  }
  if(apiKey && !visionReady){
    // HEIC (default iPhone/iPad photo format) and other formats can't be sent to the vision API directly.
    return fallbackExtract(file, ext, `Unsupported format for auto-extract (e.g. HEIC). Convert to JPEG/PNG/PDF, or enable server-side HEIC conversion. Held for manual review.`, 0.3);
  }
  return fallbackExtract(file, ext, 'Mock extraction used. Add ANTHROPIC_API_KEY for Claude Vision.', 0.82);
}

app.get('/api/state', (_,res)=>res.json(readDb()));
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
app.put('/api/expenses/:id', (req,res)=>{ const db=readDb(); const exp=db.expenses.find(e=>e.id===req.params.id); if(!exp) return res.status(404).json({error:'Not found'}); Object.assign(exp, req.body); if(exp.status==='approved') { exp.deductible_amount=deductible(exp); upsertVendor(db, exp.vendor, exp.category, exp.classification, exp.entity_id); } else exp.deductible_amount=0; writeDb(db); res.json(exp); });
app.post('/api/expenses/bulk-approve-ready', (_,res)=>{ const db=readDb(); let count=0; for(const e of db.expenses){ if(e.status==='ready' && !e.is_capital && !e.duplicate){ e.status='approved'; e.deductible_amount=deductible(e); upsertVendor(db,e.vendor,e.category,e.classification,e.entity_id); count++; }} writeDb(db); res.json({count}); });
app.delete('/api/reset', (_,res)=>{ writeDb(defaultDb); res.json({ok:true}); });

app.use(express.static(path.join(ROOT,'dist')));
app.get('*', (_,res)=>{ const html=path.join(ROOT,'dist','index.html'); fs.existsSync(html) ? res.sendFile(html) : res.send('Run npm run dev for the frontend.'); });
app.listen(PORT, ()=>console.log(`Amise Tax Planner API running on http://localhost:${PORT}`));
