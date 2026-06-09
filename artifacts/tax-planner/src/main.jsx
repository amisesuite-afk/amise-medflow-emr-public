import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Landmark, UserCircle, Building2, Briefcase, UploadCloud,
  FileText, Calculator, Users, TrendingUp, TrendingDown,
  CheckCircle, Trash2, Plus, ChevronUp, ChevronDown, Check,
  Pencil, X, Receipt, BarChart2, ClipboardCheck, Brain, Shield,
} from 'lucide-react'
import './style.css'

const API = '/api'
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const YEARS  = [2024, 2025, 2026, 2027]

function fmt(n)  { return '$' + Number(n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function fmtInt(n){ return '$' + Math.round(Number(n||0)).toLocaleString('en') }

function calcTax(income, bands) {
  if (!bands?.length) return 0
  let tax = 0
  for (const b of bands) {
    if (income <= b.from) break
    const top = b.to === null ? income : Math.min(income, b.to)
    tax += (top - b.from) * b.rate
  }
  return tax
}

// PAYE/NIC engine using server payroll settings bands
function computePayFE(s, ps) {
  if (!s || !ps) return { paye:0, nic:0, nicEmpr:0, net: s?.grossMonthly||0 }
  const annual = (s.grossMonthly||0)*12
  const allow  = (ps.personalAllowance||40000)+(s.spouseAllowance||0)+(s.childAllowance||0)+(s.otherAllowance||0)
  let chargeable=Math.max(0,annual-allow), annualPAYE=0, prev=0
  for(const b of (ps.taxBands||[])){
    if(chargeable<=0) break
    const last=b.upto==null, w=last?chargeable:(b.upto-prev), t=Math.min(chargeable,w)
    annualPAYE+=t*b.rate; chargeable-=t; if(!last) prev=b.upto
  }
  const ceil=ps.nicMonthlyCeiling||5417
  const nic    =Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployeeRate||0.05)
  const nicEmpr=Math.min(s.grossMonthly||0,ceil)*(ps.nicEmployerRate||0.05)
  const paye   =annualPAYE/12
  return {paye:+paye.toFixed(2),nic:+nic.toFixed(2),nicEmpr:+nicEmpr.toFixed(2),net:+((s.grossMonthly||0)-paye-nic).toFixed(2)}
}

const TABS = [
  { id:'entities',   label:'Entities',    Icon:Building2      },
  { id:'profile',    label:'Profile',     Icon:UserCircle     },
  { id:'allowances', label:'Allowances',  Icon:Landmark       },
  { id:'personal',   label:'Personal',    Icon:TrendingUp     },
  { id:'business',   label:'Business',    Icon:Briefcase      },
  { id:'upload',     label:'Upload',      Icon:UploadCloud    },
  { id:'payroll',    label:'Payroll',     Icon:Users          },
  { id:'taxcomp',    label:'Tax Comp',    Icon:BarChart2      },
  { id:'actions',    label:'Action Plan', Icon:ClipboardCheck },
  { id:'aireport',   label:'AI Report',   Icon:Brain          },
  { id:'reports',    label:'Reports',     Icon:FileText       },
  { id:'summary',    label:'Summary',     Icon:Calculator     },
]

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [tab,     setTab]     = useState('profile')
  const [state,   setState]   = useState(null)
  const [entIdx,  setEntIdx]  = useState(0)
  const [busy,    setBusy]    = useState(false)
  const [year,    setYear]    = useState(new Date().getFullYear())

  const load = () => fetch(API+'/state').then(r=>r.json()).then(setState)
  useEffect(()=>{ load() },[])

  if(!state) return <div className="loading-screen"><Landmark size={32} color="#3d9b7d"/><span>Loading…</span></div>

  const entities = state.entities  || []
  const expenses = state.expenses  || []
  const settings = state.settings  || {}
  const tk       = state.taxKnowledge || {}
  const entity   = entities[entIdx] || entities[0] || {}

  const approved = expenses.filter(e=>e.status==='approved')
  const pending  = expenses.filter(e=>['pending','ready'].includes(e.status))
  const entName  = entity.name || ''

  const yearEntExp = approved.filter(e=>
    new Date(e.date).getFullYear()===year &&
    (e.entity_id===entName||e.entity_id===entity.shortName)
  )
  const yearAllExp = approved.filter(e=>new Date(e.date).getFullYear()===year)

  const personalTotals = useMemo(()=>{
    let personal=0,deductible=0,capital=0
    yearAllExp.forEach(e=>{
      if(e.is_capital){capital+=+e.amount_xcd;return}
      if(e.classification==='personal') personal+=+e.amount_xcd
      else deductible+=+(e.deductible_amount||e.amount_xcd||0)
    })
    return {personal,deductible,capital}
  },[yearAllExp])

  const entityDeductible = useMemo(()=>
    yearEntExp.filter(e=>!e.is_capital&&e.classification!=='personal')
              .reduce((s,e)=>s++(e.deductible_amount||e.amount_xcd||0),0)
  ,[yearEntExp])

  async function apiCall(url,method='GET',body){
    const opts={method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}
    await fetch(API+url,opts); load()
  }
  async function upload(files){
    setBusy(true)
    const fd=new FormData()
    ;[...files].forEach(f=>fd.append('files',f))
    await fetch(API+'/upload',{method:'POST',body:fd})
    setBusy(false); load()
  }

  const sp={state,load,settings,entity,entities,entIdx,setEntIdx,year,setYear,tk}

  return (
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
        {tab==='entities'  && <EntitiesTab   {...sp} apiCall={apiCall}/>}
        {tab==='profile'   && <ProfileTab    {...sp}/>}
        {tab==='allowances'&& <AllowancesTab {...sp} apiCall={apiCall}/>}
        {tab==='personal'  && <PersonalTab   totals={personalTotals} yearExp={yearAllExp} settings={settings} year={year} setYear={setYear} totalEntries={yearAllExp.length}/>}
        {tab==='business'  && <BusinessTab   {...sp} expenses={expenses} yearEntExp={yearEntExp} entityDeductible={entityDeductible} apiCall={apiCall}/>}
        {tab==='upload'    && <UploadTab     upload={upload} busy={busy} pending={pending} state={state} apiCall={apiCall}/>}
        {tab==='payroll'   && <PayrollTab    {...sp} apiCall={apiCall}/>}
        {tab==='taxcomp'   && <TaxCompTab    {...sp} entityDeductible={entityDeductible}/>}
        {tab==='actions'   && <ActionPlanTab {...sp} apiCall={apiCall}/>}
        {tab==='aireport'  && <AIReportTab   {...sp} entityDeductible={entityDeductible}/>}
        {tab==='reports'   && <ReportsTab    yearEntExp={yearEntExp} year={year} entity={entity}/>}
        {tab==='summary'   && <SummaryTab    totals={personalTotals} entityDeductible={entityDeductible} settings={settings} entity={entity}/>}
      </main>
    </div>
  )
}

// ── Entities ──────────────────────────────────────────────────────────────────
const ENTITY_TYPES=['Medical Practice','Property','Holding Company','Business','Agriculture','Retail','Finance','Other']
const BLANK_ENT={name:'',shortName:'',type:'Business',color:'#3d9b7d'}

function EntitiesTab({entities,apiCall}){
  const [editing,setEditing]=useState(null)
  async function save(e){ if(e.id) await apiCall(`/entities/${e.id}`,'PUT',e); else await apiCall('/entities','POST',e); setEditing(null) }
  async function del(id){ if(!confirm('Remove this entity?')) return; await apiCall(`/entities/${id}`,'DELETE') }
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
function ProfileTab({entity,entities,entIdx,setEntIdx,load,apiCall}){
  const [profile,setProfile]=useState(null)
  const [saved,setSaved]=useState(false)
  useEffect(()=>{ setProfile(entity?.profile?{...entity.profile}:null); setSaved(false) },[entity?.id])
  if(!entity||!profile) return <div className="empty-state">No entity selected.</div>
  async function save(){
    await apiCall(`/entities/${entity.id}`,'PUT',{profile})
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
          <Field label="Practitioner TIN / NIN"><input value={profile.practitionerTin||''} onChange={e=>setProfile({...profile,practitionerTin:e.target.value})} placeholder="e.g. 12345678"/></Field>
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
function AllowancesTab({entity,state,apiCall,tk}){
  const eid    = entity?.id||'ent1'
  const claimed= state?.allowances?.[eid] || {personal:'40000'}
  const al     = tk.allowances || []
  const totalClaimed = al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const maxTotal = al.reduce((s,a)=>s+(a.max||0),0)

  async function set(id,val){ await apiCall(`/allowances/${eid}`,'PUT',{...claimed,[id]:val}) }
  async function fillMax(){
    const next={...claimed}; al.forEach(a=>{if(a.max!==null) next[a.id]=String(a.max)}); await apiCall(`/allowances/${eid}`,'PUT',next)
  }
  async function clearAll(){ await apiCall(`/allowances/${eid}`,'PUT',{personal:'40000'}) }

  // group by category
  const cats={}
  al.forEach(a=>{ if(!cats[a.cat]) cats[a.cat]=[]; cats[a.cat].push(a) })

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
        <div className="small-card">
          <div className="small-card-label">Total claimed</div>
          <div className="small-card-value">{fmtInt(totalClaimed)}</div>
          <div className="card-sub">XCD this year</div>
        </div>
        <div className="small-card">
          <div className="small-card-label">Max available</div>
          <div className="small-card-value">{fmtInt(maxTotal)}</div>
          <div className="card-sub">if all maximums claimed</div>
        </div>
      </div>

      {Object.entries(cats).map(([cat,items])=>(
        <section key={cat} className="section">
          <div className="section-title">{cat}</div>
          {items.map(a=>(
            <div key={a.id} className="allowance-row">
              <div className="allowance-info">
                <div className="allowance-label">
                  {a.label}
                  {a.new2025&&<span className="badge-new">2025</span>}
                </div>
                {a.max!==null&&<div className="allowance-max">Max {fmtInt(a.max)} XCD</div>}
                <div className="allowance-note">{a.note}</div>
              </div>
              <div className="allowance-input-wrap">
                <input
                  type="number" min={0} max={a.max||undefined}
                  value={claimed[a.id]||''}
                  placeholder="0"
                  onChange={e=>set(a.id,e.target.value)}
                  className="allowance-input"
                />
                {a.max!==null&&(
                  <button className="btn-fill-max" onClick={()=>set(a.id,String(a.max))} title="Fill maximum">Max</button>
                )}
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
  const months=MONTHS.map((_,i)=>yearExp.filter(e=>e.classification==='personal'&&new Date(e.date).getMonth()===i).reduce((s,e)=>s++(e.amount_xcd||0),0))
  const pMax =settings.personalMaximumLimit     ||232000
  const pCons=settings.personalConservativeLimit||232000
  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Personal</h1><p className="page-sub">Allowances — {year}</p></div>
        <select className="year-select" value={year} onChange={e=>setYear(+e.target.value)}>{YEARS.map(y=><option key={y}>{y}</option>)}</select>
      </div>
      <div className="big-card">
        <div className="big-card-head"><TrendingUp size={16} className="card-icon"/><span className="card-label">Personal Allowances</span></div>
        <div className="big-card-value">{fmt(totals.personal)}</div>
        <div className="card-sub">of ${pMax.toLocaleString()} max XCD</div>
      </div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Total entries</div><div className="small-card-value">{totalEntries}</div><div className="card-sub">records this year</div></div>
        <div className="small-card"><div className="small-card-label">Combined total</div><div className="small-card-value">{fmt(totals.personal+totals.deductible)}</div><div className="card-sub">all deductions XCD</div></div>
      </div>
      <section className="section">
        <div className="section-title">Personal Allowances Progress</div>
        <ProgressBar label="Conservative Limit" val={totals.personal} max={pCons}/>
        <ProgressBar label="Maximum Limit"       val={totals.personal} max={pMax}/>
      </section>
      <section className="section">
        <div className="section-title">Monthly Breakdown — Personal</div>
        <div className="month-grid">{MONTHS.map((m,i)=><div key={m} className="month-cell"><span className="month-label">{m}</span><strong className="month-val">{months[i]>0?fmt(months[i]):'—'}</strong></div>)}</div>
      </section>
    </div>
  )
}

// ── Business ──────────────────────────────────────────────────────────────────
const BLANK_EXP={date:new Date().toISOString().slice(0,10),vendor:'',category:'',classification:'business',amount_xcd:'',currency:'XCD',notes:''}

function BusinessTab({expenses,yearEntExp,entityDeductible,entity,settings,year,setYear,apiCall,tk}){
  const [form,setForm]  =useState(BLANK_EXP)
  const [filter,setFilter]=useState('all')
  const [saving,setSaving]=useState(false)
  const [catMode,setCatMode]=useState('simple') // 'simple' | 'ird'
  const bizCats=settings?.categories?.business||[]
  const perCats=settings?.categories?.personal||[]
  const cats   =form.classification==='personal'?perCats:bizCats
  const bMax   =settings.maximumLimit  ||707700
  const bCons  =settings.conservativeLimit||551000
  const expCats=tk.expenseCats||[]

  const months=MONTHS.map((_,i)=>yearEntExp.filter(e=>new Date(e.date).getMonth()===i).reduce((s,e)=>s++(e.deductible_amount||e.amount_xcd||0),0))

  async function submit(ev){
    ev.preventDefault(); if(!form.vendor||!form.amount_xcd) return
    setSaving(true)
    await apiCall('/expenses','POST',{...form,amount_xcd:+form.amount_xcd,status:'approved',deductible_amount:+form.amount_xcd,entity_id:entity?.name||''})
    setForm(BLANK_EXP); setSaving(false)
  }
  async function del(id){ if(!confirm('Delete this expense?')) return; await apiCall(`/expenses/${id}`,'DELETE') }

  const allEntExp=expenses.filter(e=>(e.entity_id===entity?.name||e.entity_id===entity?.shortName))
  const shown=filter==='all'?allEntExp:allEntExp.filter(e=>e.status===filter)

  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Business</h1><p className="page-sub">{entity?.name} — {year}</p></div>
        <select className="year-select" value={year} onChange={e=>setYear(+e.target.value)}>{YEARS.map(y=><option key={y}>{y}</option>)}</select>
      </div>
      <div className="big-card">
        <div className="big-card-head"><TrendingDown size={16} className="card-icon"/><span className="card-label">Business Expenses</span></div>
        <div className="big-card-value">{fmt(entityDeductible)}</div>
        <div className="card-sub">of ${bMax.toLocaleString()} max XCD</div>
      </div>
      <section className="section">
        <div className="section-title">Expenses Progress</div>
        <ProgressBar label="Conservative Limit" val={entityDeductible} max={bCons}/>
        <ProgressBar label="Maximum Limit"       val={entityDeductible} max={bMax}/>
      </section>
      <section className="section">
        <div className="section-title">Monthly Breakdown</div>
        <div className="month-grid">{MONTHS.map((m,i)=><div key={m} className="month-cell"><span className="month-label">{m}</span><strong className="month-val">{months[i]>0?fmt(months[i]):'—'}</strong></div>)}</div>
      </section>

      {/* Add expense form */}
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
            <Field label="Type">
              <select value={form.classification} onChange={e=>setForm({...form,classification:e.target.value,category:''})}>
                <option value="business">Business</option><option value="personal">Personal</option>
              </select>
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                <option value="">— select —</option>{cats.map(c=><option key={c}>{c}</option>)}
              </select>
            </Field>
          </TwoCol>
        ):(
          <TwoCol>
            <Field label="IRD Category">
              <select value={form.ird_cat||''} onChange={e=>setForm({...form,ird_cat:e.target.value,category:e.target.value})}>
                <option value="">— select —</option>
                {expCats.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="IRD Line Item">
              <select value={form.ird_item||''} onChange={e=>setForm({...form,ird_item:e.target.value})}>
                <option value="">— select —</option>
                {(expCats.find(c=>c.name===form.ird_cat)||{items:[]}).items.map(i=><option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </Field>
          </TwoCol>
        )}
        <Field label="Notes (optional)"><textarea placeholder="Reference, project…" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <button type="submit" disabled={saving}><Plus size={15}/>{saving?'Saving…':'Add Expense'}</button>
      </form>

      {/* Filter + list */}
      <div className="filter-row">
        {['all','approved','pending','rejected'].map(f=>(
          <button key={f} className={`filter-btn${filter===f?' active':''}`} onClick={()=>setFilter(f)}>{f}</button>
        ))}
      </div>
      {shown.length===0
        ?<div className="empty-state">No expenses for {entity?.name}.</div>
        :<div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>XCD</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {shown.map(e=>(
                <tr key={e.id}>
                  <td>{e.date}</td><td>{e.vendor}</td>
                  <td style={{color:'#666'}}>{e.category}</td>
                  <td style={{fontWeight:600}}>{fmt(e.amount_xcd)}</td>
                  <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                  <td><button className="btn-icon btn-icon-danger" onClick={()=>del(e.id)}><Trash2 size={13}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  )
}

// ── Upload ────────────────────────────────────────────────────────────────────
function UploadTab({upload,busy,pending,state,apiCall}){
  const [view, setView] = useState('inbox')
  const docs = (state?.documents||[]).slice().reverse()

  async function updateExpense(id,patch){ await apiCall(`/expenses/${id}`,'PUT',patch) }
  async function bulk(){ await fetch(API+'/expenses/bulk-approve-ready',{method:'POST'}); location.reload() }
  async function deleteDoc(id){
    if(!confirm('Delete this document and its linked expense record?')) return
    await apiCall(`/documents/${id}`,'DELETE')
  }

  function docThumb(d){
    const isImg=d.source_type!=='pdf'&&d.source_type!=='email'&&d.file_url
    if(isImg) return <img src={d.file_url} alt="" onError={e=>{e.currentTarget.style.display='none'}}/>
    if(d.source_type==='pdf') return <FileText size={22} color="#c03030"/>
    return <Receipt size={22} color="#3d9b7d"/>
  }

  function cleanName(url){
    if(!url) return 'Document'
    const f=url.split('/').pop()||''
    return f.replace(/^\d{13}-[a-zA-Z0-9]{8}-/,'').replace(/_/g,' ')
  }

  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Upload</h1><p className="page-sub">{docs.length} documents · {pending.length} pending</p></div>
      </div>

      <label className="drop-zone">
        <input type="file" multiple
          accept="image/*,.heic,.pdf,.xlsx,.xls,.csv,.doc,.docx,.txt"
          onChange={e=>upload(e.target.files)}
        />
        <UploadCloud size={40} className="card-icon"/>
        <strong>Drop receipts, invoices, statements, spreadsheets</strong>
        <span>Photos, PDF, Excel, CSV, Word, HEIC — up to 30 files · AI extracts details</span>
      </label>
      {busy&&<div className="notice">Extracting with AI…</div>}

      <div className="filter-row">
        <button className={`filter-btn${view==='inbox'?' active':''}`} onClick={()=>setView('inbox')}>
          Inbox{pending.length>0?` (${pending.length})`:''}
        </button>
        <button className={`filter-btn${view==='docs'?' active':''}`} onClick={()=>setView('docs')}>
          All Documents{docs.length>0?` (${docs.length})`:''}
        </button>
      </div>

      {view==='inbox'&&(
        <>
          {pending.length>0&&(
            <section className="section">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div className="section-title" style={{margin:0}}>Review Inbox ({pending.length})</div>
                <button className="btn-sm" onClick={bulk}>Approve all ready</button>
              </div>
              <div className="review-list">{pending.map(e=><ReviewCard key={e.id} e={e} state={state} update={updateExpense}/>)}</div>
            </section>
          )}
          {!busy&&pending.length===0&&<div className="empty-state">No items pending review.</div>}
        </>
      )}

      {view==='docs'&&(
        <>
          {docs.length===0
            ?<div className="empty-state">No documents uploaded yet.</div>
            :<div className="doc-grid">
              {docs.map(d=>{
                const x=d.extracted||{}
                const linkedExp=(state?.expenses||[]).find(e=>e.source_document_id===d.id)
                return(
                  <div key={d.id} className="doc-card">
                    <div className="doc-thumb">{docThumb(d)}</div>
                    <div className="doc-info">
                      <div className="doc-name">{cleanName(d.file_url)}</div>
                      <div className="doc-meta">
                        {x.vendor_name&&<span>{x.vendor_name}{x.date?` · ${x.date}`:''}{x.total?` · $${Number(x.total).toLocaleString()} ${x.currency||'XCD'}`:''}</span>}
                        {!x.vendor_name&&<span style={{color:'#bbb'}}>No extraction data</span>}
                      </div>
                      <div className="doc-extracted">
                        {x.suggested_category&&<span className="doc-tag">{x.suggested_category}</span>}
                        {linkedExp&&<span className={`badge badge-${linkedExp.status}`}>{linkedExp.status}</span>}
                        {x.confidence!=null&&<span style={{fontSize:11,color:'#bbb'}}>{Math.round(x.confidence*100)}%</span>}
                      </div>
                    </div>
                    <div className="doc-actions">
                      {d.file_url&&(
                        <a href={d.file_url} target="_blank" rel="noreferrer"
                          className="btn-icon" style={{textDecoration:'none'}}>
                          <FileText size={14}/>
                        </a>
                      )}
                      <button className="btn-icon btn-icon-danger" onClick={()=>deleteDoc(d.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                )
              })}
            </div>
          }
        </>
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
      {e.duplicate &&<div className="warn">Duplicate detected</div>}
      {e.is_capital&&<div className="warn">Capital item</div>}
      <div className="review-fields">
        <input value={x.vendor||''} placeholder="Vendor" onChange={ev=>setX({...x,vendor:ev.target.value})}/>
        <input type="date" value={x.date||''} onChange={ev=>setX({...x,date:ev.target.value})}/>
        <select value={x.classification} onChange={ev=>setX({...x,classification:ev.target.value})}>
          <option value="business">Business</option><option value="personal">Personal</option>
        </select>
        <select value={x.category} onChange={ev=>setX({...x,category:ev.target.value})}>
          <option value="">— category —</option>{cats.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="review-actions">
        <button onClick={()=>update(e.id,{...x,status:'approved'})}><CheckCircle size={14}/> Approve</button>
        <button className="btn-secondary" onClick={()=>update(e.id,x)}>Save</button>
        <button className="btn-danger" onClick={()=>update(e.id,{status:'rejected'})}><Trash2 size={14}/> Reject</button>
      </div>
    </div>
  )
}

// ── Payroll ───────────────────────────────────────────────────────────────────
function PayrollTab({state,entity,load,apiCall}){
  const ps   =state?.payroll?.settings||{}
  const staff=state?.payroll?.staff   ||[]
  const runs =state?.payroll?.runs    ||[]
  const now  =new Date()
  const [month,   setMonth]  =useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [running, setRunning]=useState(false)
  const [exporting,setExp]   =useState(false)
  const [editing, setEditing]=useState(null)

  const active    =staff.filter(s=>s.status==='active')
  const currentRun=runs.find(r=>r.month===month)

  async function runPayroll(){ setRunning(true); await fetch(`${API}/payroll/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month})}); setRunning(false); load() }
  async function exportRun()  { setExp(true);    await fetch(`${API}/payroll/export`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month})}); setExp(false); load() }
  async function saveStaff(s){
    if(s.id) await fetch(`${API}/payroll/staff/${s.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)})
    else     await fetch(`${API}/payroll/staff`,        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)})
    setEditing(null); load()
  }
  async function delStaff(id){ if(!confirm('Remove staff member?')) return; await fetch(`${API}/payroll/staff/${id}`,{method:'DELETE'}); load() }

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
              <tr style={{fontWeight:800,background:'#f6fbf9'}}>
                <td colSpan={2}>TOTAL — {active.length} staff</td>
                <td>{fmt(rTot.gross)}</td><td style={{color:'#b06000'}}>{fmt(rTot.nic)}</td>
                <td style={{color:'#c03030'}}>{fmt(rTot.paye)}</td><td style={{color:'#177a56'}}>{fmt(rTot.net)}</td><td/>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="section">
        <div className="section-title">Monthly Payroll Run</div>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:16}}>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{width:'auto',padding:'10px 14px'}}/>
          <button onClick={runPayroll} disabled={running}>{running?'Computing…':'▶ Run '+month}</button>
          {currentRun&&<button style={{background:'#177a56'}} onClick={exportRun} disabled={exporting}>{exporting?'Posting…':'→ Post to Expenses'}</button>}
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
                <tr style={{fontWeight:800,background:'#f6fbf9'}}>
                  <td>TOTAL</td><td>{fmt(currentRun.totals.gross)}</td><td style={{color:'#c03030'}}>{fmt(currentRun.totals.paye)}</td>
                  <td style={{color:'#b06000'}}>{fmt(currentRun.totals.nicEmployee)}</td><td style={{color:'#666'}}>{fmt(currentRun.totals.nicEmployer)}</td>
                  <td style={{color:'#177a56',fontWeight:700}}>{fmt(currentRun.totals.net)}</td><td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing&&<Modal title={editing.id?'Edit Staff Member':'Add Staff Member'} onClose={()=>setEditing(null)}><StaffForm s={editing} ps={ps} entities={state?.settings?.entities||[]} onSave={saveStaff} onClose={()=>setEditing(null)}/></Modal>}
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
  const bands  = tk.taxBands||[]
  const al     = tk.allowances||[]
  const expCats= tk.expenseCats||[]

  const eid    = entity?.id||''
  const claimed= state?.allowances?.[eid]||{personal:'40000'}
  const gross  = Number(entity?.profile?.grossIncome)||0
  const totalAllowances = al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const chargeable      = Math.max(0,gross-totalAllowances-entityDeductible)
  const taxPayable      = calcTax(chargeable,bands)
  const effectiveRate   = gross>0?(taxPayable/gross)*100:0

  const conserv_allow  = 134000
  const max_allow      = 208500
  const conserv_exp    = expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.conservative,0),0)
  const max_exp        = expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.maximum,0),0)
  const chargeableCons = Math.max(0,gross-conserv_allow-conserv_exp)
  const chargeableMax  = Math.max(0,gross-max_allow-max_exp)
  const taxCons        = calcTax(chargeableCons,bands)
  const taxMax         = calcTax(chargeableMax,bands)

  const inTarget       = taxPayable>=50000&&taxPayable<=70000
  const bandRows       = bands.map(b=>{
    if(chargeable<=b.from) return {band:b.label,rate:`${(b.rate*100).toFixed(0)}%`,taxable:0,tax:0}
    const top=b.to===null?chargeable:Math.min(chargeable,b.to)
    const taxable=top-b.from
    return {band:b.label,rate:`${(b.rate*100).toFixed(0)}%`,taxable,tax:taxable*b.rate}
  })

  return(
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Tax Computation</h1><p className="page-sub">{entity?.name} — ITA Cap 15.02 2025</p></div>
      </div>

      {!gross&&<div className="warn">Enter annual gross income in the Profile tab to see the full computation.</div>}

      {/* Input summary */}
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Gross income</div><div className="small-card-value">{fmtInt(gross)}</div><div className="card-sub">XCD annual</div></div>
        <div className="small-card"><div className="small-card-label">Total deductions</div><div className="small-card-value">{fmtInt(totalAllowances+entityDeductible)}</div><div className="card-sub">allowances + expenses</div></div>
      </div>
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Chargeable income</div><div className="small-card-value">{fmtInt(chargeable)}</div><div className="card-sub">XCD after deductions</div></div>
        <div className="small-card"><div className="small-card-label">Tax payable</div><div className="small-card-value" style={{color:inTarget?'#177a56':'#c03030'}}>{fmtInt(taxPayable)}</div><div className="card-sub">{effectiveRate.toFixed(2)}% effective rate</div></div>
      </div>

      {/* Target band */}
      <div className={`target-banner${inTarget?' target-ok':taxPayable<50000?' target-low':' target-high'}`}>
        <Shield size={16}/> Target band $50,000–$70,000 XCD — {inTarget?'✓ Within target':taxPayable<50000?'Below target — risk of appearing under-taxed':'Above target — deductions not fully optimised'}
      </div>

      {/* Tax band breakdown */}
      <section className="section" style={{padding:0}}>
        <div style={{padding:'16px 18px 12px'}} className="section-title">Tax Band Breakdown</div>
        <table className="data-table">
          <thead><tr><th>Band</th><th>Rate</th><th style={{textAlign:'right'}}>Taxable XCD</th><th style={{textAlign:'right'}}>Tax XCD</th></tr></thead>
          <tbody>
            {bandRows.map((r,i)=>(
              <tr key={i} style={{opacity:r.taxable>0?1:.45}}>
                <td style={{fontSize:12}}>{r.band}</td>
                <td style={{fontWeight:600}}>{r.rate}</td>
                <td style={{textAlign:'right'}}>{r.taxable>0?fmtInt(r.taxable):'—'}</td>
                <td style={{textAlign:'right',color:r.tax>0?'#c03030':'#aaa'}}>{r.tax>0?fmtInt(r.tax):'—'}</td>
              </tr>
            ))}
            <tr style={{fontWeight:800}}>
              <td colSpan={2}>Total tax payable</td>
              <td style={{textAlign:'right'}}>{fmtInt(chargeable)}</td>
              <td style={{textAlign:'right',color:'#c03030'}}>{fmtInt(taxPayable)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Scenario comparison */}
      <section className="section">
        <div className="section-title">Scenario Comparison</div>
        <div className="scenario-grid">
          <div className="scenario-card">
            <div className="scenario-label">Conservative</div>
            <div className="scenario-deduct">{fmtInt(conserv_allow+conserv_exp)} deductions</div>
            <div className="scenario-tax">{fmtInt(taxCons)}</div>
            <div className="card-sub">tax payable XCD</div>
          </div>
          <div className="scenario-card scenario-current">
            <div className="scenario-label">Current</div>
            <div className="scenario-deduct">{fmtInt(totalAllowances+entityDeductible)} deductions</div>
            <div className="scenario-tax">{fmtInt(taxPayable)}</div>
            <div className="card-sub">tax payable XCD</div>
          </div>
          <div className="scenario-card">
            <div className="scenario-label">Maximum</div>
            <div className="scenario-deduct">{fmtInt(max_allow+max_exp)} deductions</div>
            <div className="scenario-tax" style={{color:'#177a56'}}>{fmtInt(taxMax)}</div>
            <div className="card-sub">tax payable XCD</div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Action Plan ───────────────────────────────────────────────────────────────
function ActionPlanTab({state,apiCall,tk}){
  const actions  = tk.keyActions||[]
  const done     = state?.actions||{}
  const pending  = actions.filter(a=>!done[a.id])
  const potential= pending.reduce((s,a)=>s+a.saving,0)

  async function toggle(id){ await apiCall('/actions','PUT',{[id]:!done[id]}) }

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
            <div className={`action-check${done[a.id]?' action-check-done':''}`}>
              {done[a.id]&&<Check size={14}/>}
            </div>
            <div className="action-body">
              <div className="action-label">{a.label}</div>
              <div className="action-meta">
                <span className="action-saving">Saves {fmtInt(a.saving)} XCD</span>
                <span className="action-deadline">⏰ {a.deadline}</span>
              </div>
              <div className="action-note">{a.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="notice">
        Tap each action to mark it complete. Consult a registered tax practitioner before filing with the Saint Lucia IRD (efilingovt.lc · Tel 468-4700).
      </div>
    </div>
  )
}

// ── AI Report ─────────────────────────────────────────────────────────────────
function AIReportTab({entity,state,entityDeductible,tk}){
  const [apiKey,  setApiKey]  = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report,  setReport]  = useState('')
  const [error,   setError]   = useState('')

  const bands  = tk.taxBands||[]
  const al     = tk.allowances||[]
  const expCats= tk.expenseCats||[]
  const actions= tk.keyActions||[]

  const eid           = entity?.id||''
  const claimed       = state?.allowances?.[eid]||{personal:'40000'}
  const gross         = Number(entity?.profile?.grossIncome)||0
  const totalAllowances = al.reduce((s,a)=>s+(Number(claimed[a.id])||0),0)
  const chargeable    = Math.max(0,gross-totalAllowances-entityDeductible)
  const taxPayable    = calcTax(chargeable,bands)
  const effectiveRate = gross>0?(taxPayable/gross)*100:0
  const done          = state?.actions||{}
  const pendingActions= actions.filter(a=>!done[a.id])
  const conserv_exp   = expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.conservative,0),0)
  const max_exp       = expCats.reduce((s,c)=>s+c.items.reduce((cs,i)=>cs+i.maximum,0),0)
  const taxCons       = calcTax(Math.max(0,gross-134000-conserv_exp),bands)
  const taxMax        = calcTax(Math.max(0,gross-208500-max_exp),bands)

  async function generate(){
    if(!apiKey) return
    setLoading(true); setError(''); setReport('')
    try{
      const res=await fetch(API+'/report',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          apiKey,
          practitionerName:entity?.profile?.practitionerName||'Practitioner',
          practiceName:entity?.profile?.practiceName||entity?.name||'',
          taxYear:entity?.profile?.taxYear||2026,
          grossIncome:gross,
          totalAllowances,
          totalBusiness:entityDeductible,
          chargeable,
          taxPayable,
          effectiveRate,
          pendingActions,
          scenarios:{taxCons,taxMax},
        }),
      })
      const j=await res.json()
      if(j.error) throw new Error(j.error)
      setReport(j.report)
    }catch(err){ setError(err.message||String(err)) }
    setLoading(false)
  }

  const ready=apiKey&&gross>0

  return(
    <div className="page">
      <h1 className="page-h1">AI Report</h1>
      <p className="page-sub">Claude-generated tax consultancy report · {entity?.name}</p>

      {/* Data summary */}
      <div className="card-row">
        <div className="small-card"><div className="small-card-label">Gross income</div><div className="small-card-value">{fmtInt(gross)}</div><div className="card-sub">XCD annual</div></div>
        <div className="small-card"><div className="small-card-label">Tax payable</div><div className="small-card-value" style={{color:'#c03030'}}>{fmtInt(taxPayable)}</div><div className="card-sub">{effectiveRate.toFixed(2)}% effective</div></div>
      </div>

      {!gross&&<div className="warn">Enter gross income in Profile tab before generating report.</div>}

      {/* API key */}
      <section className="section">
        <div className="section-title">Anthropic API Key</div>
        <p style={{fontSize:13,color:'#777',marginBottom:10}}>Your key is sent directly to the server to call Claude — it is not stored anywhere.</p>
        <div style={{display:'flex',gap:8}}>
          <input
            type={showKey?'text':'password'}
            value={apiKey}
            onChange={e=>setApiKey(e.target.value)}
            placeholder="sk-ant-api03-…"
            style={{flex:1,padding:'11px 13px',border:'1.5px solid #dde4e1',borderRadius:10,fontSize:14}}
          />
          <button className="btn-secondary btn-sm" onClick={()=>setShowKey(v=>!v)} style={{flexShrink:0}}>{showKey?'Hide':'Show'}</button>
        </div>
      </section>

      <button onClick={generate} disabled={!ready||loading} style={{width:'100%',justifyContent:'center',fontSize:15,padding:'13px'}}>
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
  const rows =Object.entries(byCategory).sort((a,b)=>b[1]-a[1])
  const total=rows.reduce((s,[,v])=>s+v,0)
  return(
    <div className="page">
      <div className="page-title-row"><div><h1 className="page-h1">Reports</h1><p className="page-sub">{entity?.name} — {year}</p></div></div>
      {rows.length===0?<div className="empty-state">No approved expenses for {entity?.name}.</div>
        :<section className="section" style={{padding:0}}>
          <table className="data-table">
            <thead><tr><th>Category</th><th style={{textAlign:'right'}}>XCD</th><th style={{textAlign:'right'}}>%</th></tr></thead>
            <tbody>
              {rows.map(([k,v])=>(
                <tr key={k}><td>{k}</td><td style={{textAlign:'right',fontWeight:600}}>{fmt(v)}</td><td style={{textAlign:'right',color:'#888',fontSize:12}}>{total>0?Math.round((v/total)*100):0}%</td></tr>
              ))}
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
