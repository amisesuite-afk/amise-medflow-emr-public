import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { UploadCloud, CheckCircle, FileText, BarChart3, Settings, Receipt, Trash2, Users } from 'lucide-react';
import './style.css';

const API='/api';
function money(n){return `XCD ${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}

// ─── PAYE / NIC engine (mirrors server computeMonthlyPay) ────────────────────
function computePayFE(s, ps){
  if(!s||!ps) return {paye:0,nic:0,nicEmpr:0,net:s?.grossMonthly||0};
  const annual = (s.grossMonthly||0)*12;
  const allow  = (ps.personalAllowance||40000)+(s.spouseAllowance||0)+(s.childAllowance||0)+(s.otherAllowance||0);
  let chargeable=Math.max(0,annual-allow), annualPAYE=0, prev=0;
  for(const b of (ps.taxBands||[])){
    if(chargeable<=0) break;
    const last=b.upto==null, w=last?chargeable:(b.upto-prev), t=Math.min(chargeable,w);
    annualPAYE+=t*b.rate; chargeable-=t; if(!last) prev=b.upto;
  }
  const ceil=ps.nicMonthlyCeiling||5000;
  const nic    =Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployeeRate||0.05);
  const nicEmpr=Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployerRate||0.05);
  const paye   =annualPAYE/12;
  return {paye:+paye.toFixed(2),nic:+nic.toFixed(2),nicEmpr:+nicEmpr.toFixed(2),net:+((s.grossMonthly||0)-paye-nic).toFixed(2)};
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App(){
  const [tab,setTab]=useState('Dashboard'), [state,setState]=useState(null), [busy,setBusy]=useState(false);
  const load=()=>fetch(API+'/state').then(r=>r.json()).then(setState);
  useEffect(()=>{load()},[]);
  const expenses=state?.expenses||[], settings=state?.settings||{};
  const approved=expenses.filter(e=>e.status==='approved'), pending=expenses.filter(e=>['pending','ready'].includes(e.status));
  const totals=useMemo(()=>{let business=0,personal=0,capital=0; approved.forEach(e=>{ if(e.is_capital) capital+=+e.amount_xcd; else if(e.classification==='business') business+=+e.amount_xcd; else personal+=+e.amount_xcd; }); return {business,personal,capital,deductible:approved.reduce((s,e)=>s+(+e.deductible_amount||0),0)}},[expenses]);
  async function upload(files){setBusy(true); const fd=new FormData(); [...files].forEach(f=>fd.append('files',f)); await fetch(API+'/upload',{method:'POST',body:fd}); setBusy(false); load(); setTab('Review Inbox');}
  async function updateExpense(id,patch){await fetch(`${API}/expenses/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)}); load();}
  async function bulk(){await fetch(API+'/expenses/bulk-approve-ready',{method:'POST'}); load();}
  const TABS=['Dashboard','Upload','Review Inbox','Expenses','Reports','Payroll','Tax Summary','Settings'];
  if(!state) return <div className="loading">Loading Amise Tax Planner...</div>;
  return <div className="app">
    <aside>
      <h1>Amise<br/><span>Tax Planner</span></h1>
      {TABS.map(x=><button className={tab===x?'on':''} onClick={()=>setTab(x)} key={x}>{x}</button>)}
    </aside>
    <main>
      <header>
        <div><b>Tax Year</b> {settings.taxYear} · <b>Base</b> {settings.baseCurrency}</div>
        <div className="pill">{pending.length} review items</div>
      </header>
      {tab==='Dashboard'    && <Dashboard totals={totals} expenses={approved} settings={settings}/>}
      {tab==='Upload'       && <Upload upload={upload} busy={busy}/>}
      {tab==='Review Inbox' && <Review expenses={pending} state={state} update={updateExpense} bulk={bulk}/>}
      {tab==='Expenses'     && <Expenses expenses={expenses} update={updateExpense}/>}
      {tab==='Reports'      && <Reports expenses={approved}/>}
      {tab==='Payroll'      && <Payroll state={state} reload={load}/>}
      {tab==='Tax Summary'  && <TaxSummary totals={totals} settings={settings}/>}
      {tab==='Settings'     && <SettingsPage state={state} reload={load}/>}
    </main>
  </div>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({totals,expenses,settings}){
  const months=Array.from({length:12},(_,i)=>expenses.filter(e=>new Date(e.date).getMonth()===i).reduce((s,e)=>s+(+e.deductible_amount||0),0));
  const max=settings.maximumLimit||1, cons=settings.conservativeLimit||1, pmax=settings.personalMaximumLimit||1, pcons=settings.personalConservativeLimit||1;
  return <section><h2><BarChart3/> Dashboard</h2>
    <div className="cards"><Card t="Business deductible" v={money(totals.deductible)}/><Card t="Personal approved" v={money(totals.personal)}/><Card t="Capital held separately" v={money(totals.capital)}/></div>
    <h3>Business expenses</h3><Progress label="Conservative limit" val={totals.deductible} max={cons}/><Progress label="Maximum limit" val={totals.deductible} max={max}/>
    <h3>Personal allowances</h3><Progress label="Conservative limit" val={totals.personal} max={pcons}/><Progress label="Maximum limit" val={totals.personal} max={pmax}/>
    <h3>Monthly breakdown</h3>
    <div className="months">{months.map((m,i)=><div key={i}><span>{new Date(2026,i,1).toLocaleString('default',{month:'short'})}</span><b>{money(m)}</b></div>)}</div>
  </section>;
}
function Card({t,v}){return <div className="card"><span>{t}</span><strong>{v}</strong></div>}
function Progress({label,val,max}){const p=Math.min(100,Math.round((val/max)*100)); return <div className="progress"><div><b>{label}</b><span>{money(val)} / {money(max)} · {p}%</span></div><i><em style={{width:p+'%'}}/></i></div>}

// ─── Upload ───────────────────────────────────────────────────────────────────
function Upload({upload,busy}){return <section><h2><UploadCloud/> Upload</h2><label className="drop"><input type="file" multiple accept="image/*,.heic,.pdf" onChange={e=>upload(e.target.files)}/><UploadCloud size={50}/><b>Select up to 20+ receipt photos, screenshots, HEIC, files, or PDFs</b><span>Each document becomes a Review Inbox card before posting.</span></label>{busy&&<p className="notice">Extracting documents...</p>}<EmailStub/></section>}
function EmailStub(){const [from,setFrom]=useState('receipts@vendor.com'),[total,setTotal]=useState('0'); async function send(){await fetch(API+'/email-ingest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,total,body:'Forwarded receipt body'})}); location.reload();} return <div className="panel"><h3>Email forwarding MVP test</h3><input value={from} onChange={e=>setFrom(e.target.value)}/><input value={total} onChange={e=>setTotal(e.target.value)} placeholder="Total XCD"/><button onClick={send}>Simulate forwarded receipt</button></div>;}

// ─── Review Inbox ─────────────────────────────────────────────────────────────
function Review({expenses,state,update,bulk}){return <section><h2><Receipt/> Review Inbox</h2><button onClick={bulk}>Bulk approve all Ready</button><div className="grid">{expenses.map(e=><ReviewCard key={e.id} e={e} state={state} update={update}/>)}</div></section>}
function ReviewCard({e,state,update}){const doc=state.documents.find(d=>d.id===e.source_document_id); const [x,setX]=useState(e); const needs=e.status==='pending'||e.is_capital||e.duplicate||e.confidence<.75; const cats=state.settings.categories[x.classification==='personal'?'personal':'business']; return <div className={'review '+(needs?'needs':'ready')}><div className="thumb">{doc?.file_url?<a href={doc.file_url} target="_blank"><FileText/></a>:<FileText/>}</div><b>{e.vendor}</b><small>{needs?'Needs review':'Ready'} · confidence {Math.round((e.confidence||0)*100)}%</small>{e.duplicate&&<p className="warn">Duplicate detected</p>}{e.near_duplicate&&<p className="warn">Near match detected</p>}{e.is_capital&&<p className="warn">Capital item: not counted in deductible total</p>}<input value={x.vendor||''} onChange={ev=>setX({...x,vendor:ev.target.value})}/><input type="date" value={x.date||''} onChange={ev=>setX({...x,date:ev.target.value})}/><select value={x.classification} onChange={ev=>setX({...x,classification:ev.target.value})}><option>business</option><option>personal</option></select><select value={x.category} onChange={ev=>setX({...x,category:ev.target.value})}>{cats.map(c=><option key={c}>{c}</option>)}</select><select value={x.entity_id} onChange={ev=>setX({...x,entity_id:ev.target.value})}>{state.settings.entities.map(c=><option key={c}>{c}</option>)}</select><div className="row"><input value={x.currency} onChange={ev=>setX({...x,currency:ev.target.value})}/><input type="number" value={x.amount_original} onChange={ev=>setX({...x,amount_original:+ev.target.value})}/></div><p>{money(x.amount_xcd)} · FX {x.fx_rate} on {x.fx_date}</p><label><input type="checkbox" checked={!!x.is_capital} onChange={ev=>setX({...x,is_capital:ev.target.checked})}/> Capital item</label><textarea value={x.notes||''} onChange={ev=>setX({...x,notes:ev.target.value})}/><div className="actions"><button onClick={()=>update(e.id,{...x,status:'approved'})}><CheckCircle/>Approve</button><button onClick={()=>update(e.id,x)}>Save edit</button><button className="danger" onClick={()=>update(e.id,{status:'rejected'})}><Trash2/>Reject</button></div></div>;}

// ─── Expenses / Reports / Tax Summary ─────────────────────────────────────────
function Expenses({expenses}){return <section><h2>Expenses</h2><div style={{overflowX:'auto'}}><table><thead><tr><th>Date</th><th>Vendor</th><th>Entity</th><th>Category</th><th>Class</th><th>Original</th><th>XCD</th><th>Status</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.vendor}</td><td>{e.entity_id}</td><td>{e.category}</td><td>{e.classification}</td><td>{e.currency} {e.amount_original}</td><td>{money(e.amount_xcd)}</td><td>{e.status}</td></tr>)}</tbody></table></div></section>;}
function Reports({expenses}){return <section><h2>Reports</h2><table><tbody>{Object.entries(expenses.reduce((a,e)=>{a[e.category]=(a[e.category]||0)+(+e.deductible_amount||0);return a},{})).map(([k,v])=><tr key={k}><td>{k}</td><td>{money(v)}</td></tr>)}</tbody></table></section>;}
function TaxSummary({totals,settings}){return <section><h2>Tax Summary</h2><Card t="Deductible business expenses" v={money(totals.deductible)}/><Card t="Personal allowances used" v={money(totals.personal)}/><Card t="Capital items excluded" v={money(totals.capital)}/><p className="notice">Capital items are flagged separately for capital allowance review and do not auto-post into the deductible total.</p><h3>Business expenses</h3><Progress label="Conservative" val={totals.deductible} max={settings.conservativeLimit}/><Progress label="Maximum" val={totals.deductible} max={settings.maximumLimit}/><h3>Personal allowances</h3><Progress label="Conservative" val={totals.personal} max={settings.personalConservativeLimit}/><Progress label="Maximum" val={totals.personal} max={settings.personalMaximumLimit}/></section>;}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsPage({state,reload}){const [s,setS]=useState(state.settings); async function save(){await fetch(API+'/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)}); reload();} return <section><h2><Settings/> Settings</h2><label>Business conservative limit<input type="number" value={s.conservativeLimit} onChange={e=>setS({...s,conservativeLimit:+e.target.value})}/></label><label>Business maximum limit<input type="number" value={s.maximumLimit} onChange={e=>setS({...s,maximumLimit:+e.target.value})}/></label><label>Personal conservative limit<input type="number" value={s.personalConservativeLimit} onChange={e=>setS({...s,personalConservativeLimit:+e.target.value})}/></label><label>Personal maximum limit<input type="number" value={s.personalMaximumLimit} onChange={e=>setS({...s,personalMaximumLimit:+e.target.value})}/></label><label>Entities<textarea value={s.entities.join('\n')} onChange={e=>setS({...s,entities:e.target.value.split('\n').filter(Boolean)})}/></label><label>Business categories<textarea value={s.categories.business.join('\n')} onChange={e=>setS({...s,categories:{...s.categories,business:e.target.value.split('\n').filter(Boolean)}})}/></label><label>Personal categories<textarea value={s.categories.personal.join('\n')} onChange={e=>setS({...s,categories:{...s.categories,personal:e.target.value.split('\n').filter(Boolean)}})}/></label><button onClick={save}>Save settings</button></section>;}

// ─── Payroll ──────────────────────────────────────────────────────────────────
function Payroll({state,reload}){
  const ps    = state?.payroll?.settings || {};
  const staff = state?.payroll?.staff    || [];
  const runs  = state?.payroll?.runs     || [];
  const now   = new Date();
  const [month,  setMonth]  = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [running,setRunning]= useState(false);
  const [exporting,setExp]  = useState(false);
  const [editing, setEditing]= useState(null);
  const currentRun = runs.find(r=>r.month===month);
  const active     = staff.filter(s=>s.status==='active');

  async function runPayroll(){
    setRunning(true);
    await fetch(`${API}/payroll/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month})});
    await reload(); setRunning(false);
  }
  async function exportToExpenses(){
    setExp(true);
    await fetch(`${API}/payroll/export`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month})});
    await reload(); setExp(false);
  }
  async function saveStaff(s){
    if(s.id) await fetch(`${API}/payroll/staff/${s.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});
    else     await fetch(`${API}/payroll/staff`,       {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});
    await reload(); setEditing(null);
  }
  async function removeStaff(id){
    if(!confirm('Remove this staff member from the roster?')) return;
    await fetch(`${API}/payroll/staff/${id}`,{method:'DELETE'}); await reload();
  }

  function printSlip(l){
    const w=window.open('','_blank'); if(!w) return;
    const [yr,mo]=month.split('-');
    const mLabel=new Date(+yr,+mo-1,1).toLocaleString('en-GB',{month:'long',year:'numeric'});
    w.document.write(`<!doctype html><html><head><title>Pay Slip</title><style>body{font-family:system-ui;padding:28px;max-width:500px;margin:auto;color:#111}h2{margin:0 0 2px;font-size:20px}.sub{color:#555;font-size:13px;margin:0 0 18px}hr{border:none;border-top:1px solid #ddd;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;font-size:14px}td:last-child{text-align:right;font-weight:700}.total td{border-top:2px solid #111;font-weight:800;font-size:15px}.foot{font-size:11px;color:#888;margin-top:22px;line-height:1.6}</style></head><body><h2>Amise Medical Services</h2><p class="sub">Pay Slip · ${mLabel}</p><hr><p><b>${l.name}</b></p><p style="color:#555;font-size:13px">${l.position||''} · ${l.entity||''} · ${l.type||''}</p><hr><table><tr><td>Gross salary</td><td>${money(l.gross)}</td></tr><tr><td>PAYE withheld</td><td style="color:#c03030">(${money(l.paye)})</td></tr><tr><td>Employee NIC</td><td style="color:#b06000">(${money(l.nicEmployee)})</td></tr><tr class="total"><td>Net pay</td><td style="color:#006b3e">${money(l.net)}</td></tr></table><p style="margin-top:14px;font-size:13px;color:#555">Employer NIC contribution: ${money(l.nicEmployer)}</p><hr><p class="foot">Generated ${new Date().toLocaleDateString('en-GB')} · ITA Cap 15.02 / NIC Act · Reference only<br>Confirm figures with a registered tax practitioner before filing.</p></body></html>`);
    w.document.close(); w.print();
  }

  const rTot=active.reduce((t,s)=>{const c=computePayFE(s,ps);return{gross:+(t.gross+s.grossMonthly).toFixed(2),nic:+(t.nic+c.nic).toFixed(2),paye:+(t.paye+c.paye).toFixed(2),net:+(t.net+c.net).toFixed(2)};},{gross:0,nic:0,paye:0,net:0});

  return <section>
    <h2><Users/> Payroll · Saint Lucia ITA Cap 15.02</h2>

    {/* Staff Roster */}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
      <h3 style={{margin:0}}>Staff Roster — {active.length} active</h3>
      <button onClick={()=>setEditing({name:'',position:'',entity:state?.settings?.entities?.[0]||'Amise Medical Services',type:'permanent',grossMonthly:0,spouseAllowance:0,childAllowance:0,otherAllowance:0})}>+ Add Staff</button>
    </div>
    <div style={{overflowX:'auto'}}>
      <table>
        <thead><tr><th>Name / Position</th><th>Entity</th><th>Type</th><th>Gross/mo</th><th>NIC emp</th><th>PAYE/mo</th><th>Net/mo</th><th></th></tr></thead>
        <tbody>
          {active.map(s=>{const c=computePayFE(s,ps); return <tr key={s.id}>
            <td><b>{s.name}</b><br/><small style={{color:'#778'}}>{s.position}</small></td>
            <td style={{fontSize:12}}>{s.entity}</td>
            <td style={{fontSize:12,textTransform:'capitalize'}}>{s.type}</td>
            <td>{money(s.grossMonthly)}</td>
            <td style={{color:'#b06000'}}>{money(c.nic)}</td>
            <td style={{color:'#c03030'}}>{money(c.paye)}</td>
            <td style={{color:'#006b3e',fontWeight:700}}>{money(c.net)}</td>
            <td style={{whiteSpace:'nowrap'}}>
              <button style={{padding:'5px 10px',fontSize:12,background:'#e8f2ef',color:'#0b3d36'}} onClick={()=>setEditing(s)}>Edit</button>{' '}
              <button style={{padding:'5px 10px',fontSize:12,background:'#fde8e8',color:'#b83232'}} onClick={()=>removeStaff(s.id)}>✕</button>
            </td>
          </tr>;})}
          <tr style={{fontWeight:800,background:'#f3fbf8'}}>
            <td colSpan={3}>TOTAL — {active.length} staff</td>
            <td>{money(rTot.gross)}</td>
            <td style={{color:'#b06000'}}>{money(rTot.nic)}</td>
            <td style={{color:'#c03030'}}>{money(rTot.paye)}</td>
            <td style={{color:'#006b3e'}}>{money(rTot.net)}</td>
            <td/>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Monthly Run */}
    <h3 style={{marginTop:28}}>Monthly Payroll Run</h3>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
      <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',padding:'10px 14px'}}/>
      <button onClick={runPayroll} disabled={running}>{running?'Computing…':'▶ Run for '+month}</button>
      {currentRun&&<button style={{background:'#146454'}} onClick={exportToExpenses} disabled={exporting}>{exporting?'Posting…':'→ Post to Expenses'}</button>}
      {currentRun&&<span style={{fontSize:12,color:'#5a706b'}}>Computed {new Date(currentRun.createdAt).toLocaleString('en-GB')}</span>}
    </div>

    {currentRun&&<div style={{overflowX:'auto'}}>
      <table>
        <thead><tr><th>Name</th><th>Entity</th><th>Gross</th><th>PAYE</th><th>NIC Emp</th><th>NIC Empr</th><th>Net Pay</th><th>Slip</th></tr></thead>
        <tbody>
          {currentRun.lines.map(l=><tr key={l.staffId}>
            <td><b>{l.name}</b><br/><small style={{color:'#778'}}>{l.position}</small></td>
            <td style={{fontSize:12}}>{l.entity}</td>
            <td>{money(l.gross)}</td>
            <td style={{color:'#c03030'}}>{money(l.paye)}</td>
            <td style={{color:'#b06000'}}>{money(l.nicEmployee)}</td>
            <td style={{color:'#667'}}>{money(l.nicEmployer)}</td>
            <td style={{color:'#006b3e',fontWeight:700}}>{money(l.net)}</td>
            <td><button style={{padding:'5px 10px',fontSize:12,background:'#e8f2ef',color:'#0b3d36'}} onClick={()=>printSlip(l)}>🖨</button></td>
          </tr>)}
          <tr style={{fontWeight:800,background:'#f3fbf8'}}>
            <td colSpan={2}>TOTAL</td>
            <td>{money(currentRun.totals.gross)}</td>
            <td style={{color:'#c03030'}}>{money(currentRun.totals.paye)}</td>
            <td style={{color:'#b06000'}}>{money(currentRun.totals.nicEmployee)}</td>
            <td style={{color:'#667'}}>{money(currentRun.totals.nicEmployer)}</td>
            <td style={{color:'#006b3e',fontWeight:700}}>{money(currentRun.totals.net)}</td>
            <td/>
          </tr>
        </tbody>
      </table>
      <p style={{fontSize:12,color:'#778',marginTop:8}}>
        Total employer cost: {money(currentRun.totals.gross+currentRun.totals.nicEmployer)} (gross + employer NIC) · "Post to Expenses" exports this as a deductible business expense.
      </p>
    </div>}

    {editing&&<StaffModal s={editing} onSave={saveStaff} onClose={()=>setEditing(null)} entities={state?.settings?.entities||[]} ps={ps}/>}
  </section>;
}

// ─── Staff Modal ──────────────────────────────────────────────────────────────
function StaffModal({s,onSave,onClose,entities,ps}){
  const [f,setF]=useState({...s});
  const c=computePayFE(f,ps);
  return <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
    <div style={{background:'white',borderRadius:22,padding:28,width:500,maxWidth:'95vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
      <h3 style={{margin:'0 0 16px'}}>{f.id?'Edit':'Add'} Staff Member</h3>
      <label>Full name / display label<input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label>
      <label>Position / Job title<input value={f.position||''} onChange={e=>setF({...f,position:e.target.value})}/></label>
      <label>Entity<select value={f.entity||''} onChange={e=>setF({...f,entity:e.target.value})}>{entities.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Employment type
        <select value={f.type||'permanent'} onChange={e=>setF({...f,type:e.target.value})}>
          <option value="permanent">Permanent</option><option value="contract">Contract</option><option value="parttime">Part-time</option>
        </select>
      </label>
      <label>Gross monthly salary (XCD)<input type="number" min={0} value={f.grossMonthly||0} onChange={e=>setF({...f,grossMonthly:+e.target.value})}/></label>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
        <label style={{fontSize:12}}>Spouse allow. /yr (XCD)<input type="number" min={0} value={f.spouseAllowance||0} onChange={e=>setF({...f,spouseAllowance:+e.target.value})}/></label>
        <label style={{fontSize:12}}>Child allow. /yr (XCD)<input type="number" min={0} value={f.childAllowance||0} onChange={e=>setF({...f,childAllowance:+e.target.value})}/></label>
        <label style={{fontSize:12}}>Other allow. /yr (XCD)<input type="number" min={0} value={f.otherAllowance||0} onChange={e=>setF({...f,otherAllowance:+e.target.value})}/></label>
      </div>
      {/* Live PAYE/NIC preview */}
      <div style={{background:'#f3fbf8',borderRadius:14,padding:16,margin:'14px 0'}}>
        <div style={{fontSize:12,color:'#5a706b',fontWeight:700,marginBottom:8}}>Monthly preview (ITA Cap 15.02)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,textAlign:'center'}}>
          <div><div style={{fontSize:11,color:'#778'}}>Gross</div><b>{money(f.grossMonthly||0)}</b></div>
          <div><div style={{fontSize:11,color:'#778'}}>NIC emp</div><b style={{color:'#b06000'}}>{money(c.nic)}</b></div>
          <div><div style={{fontSize:11,color:'#778'}}>PAYE</div><b style={{color:'#c03030'}}>{money(c.paye)}</b></div>
          <div><div style={{fontSize:11,color:'#778'}}>Net pay</div><b style={{color:'#006b3e'}}>{money(c.net)}</b></div>
        </div>
      </div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
        <button onClick={()=>onSave(f)}>Save</button>
        {f.id&&<button style={{background:'#b83232'}} onClick={()=>{if(confirm('Mark as inactive? Excluded from future runs.')) onSave({...f,status:'inactive'});}}>Deactivate</button>}
        <button style={{background:'#e8efec',color:'#333'}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
