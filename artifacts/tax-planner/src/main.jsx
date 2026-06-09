import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Landmark, UserCircle, Building2, Briefcase, UploadCloud,
  FileText, Calculator, Users, TrendingUp, TrendingDown,
  CheckCircle, Trash2, Plus, ChevronUp, ChevronDown, Check,
  Pencil, X, Receipt,
} from 'lucide-react'
import './style.css'

const API = '/api'
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const YEARS = [2024, 2025, 2026, 2027]

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// PAYE / NIC engine — Saint Lucia ITA Cap 15.02
function computePayFE(s, ps) {
  if (!s || !ps) return { paye: 0, nic: 0, nicEmpr: 0, net: s?.grossMonthly || 0 }
  const annual = (s.grossMonthly || 0) * 12
  const allow = (ps.personalAllowance || 40000) + (s.spouseAllowance || 0) + (s.childAllowance || 0) + (s.otherAllowance || 0)
  let chargeable = Math.max(0, annual - allow), annualPAYE = 0, prev = 0
  for (const b of (ps.taxBands || [])) {
    if (chargeable <= 0) break
    const last = b.upto == null, w = last ? chargeable : (b.upto - prev), t = Math.min(chargeable, w)
    annualPAYE += t * b.rate; chargeable -= t; if (!last) prev = b.upto
  }
  const ceil = ps.nicMonthlyCeiling || 5000
  const nic = Math.min(s.grossMonthly || 0, ceil) * (ps.nicEmployeeRate || 0.05)
  const nicEmpr = Math.min(s.grossMonthly || 0, ceil) * (ps.nicEmployerRate || 0.05)
  const paye = annualPAYE / 12
  return { paye: +paye.toFixed(2), nic: +nic.toFixed(2), nicEmpr: +nicEmpr.toFixed(2), net: +((s.grossMonthly || 0) - paye - nic).toFixed(2) }
}

const TABS = [
  { id: 'entities', label: 'Entities',  Icon: Building2   },
  { id: 'profile',  label: 'Profile',   Icon: UserCircle  },
  { id: 'personal', label: 'Personal',  Icon: TrendingUp  },
  { id: 'business', label: 'Business',  Icon: Briefcase   },
  { id: 'upload',   label: 'Upload',    Icon: UploadCloud },
  { id: 'payroll',  label: 'Payroll',   Icon: Users       },
  { id: 'reports',  label: 'Reports',   Icon: FileText    },
  { id: 'summary',  label: 'Summary',   Icon: Calculator  },
]

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab]       = useState('profile')
  const [state, setState]   = useState(null)
  const [entIdx, setEntIdx] = useState(0)
  const [busy, setBusy]     = useState(false)
  const [year, setYear]     = useState(new Date().getFullYear())

  const load = () => fetch(API + '/state').then(r => r.json()).then(setState)
  useEffect(() => { load() }, [])

  if (!state) return <div className="loading-screen"><Landmark size={32} color="#3d9b7d" /><span>Loading…</span></div>

  const entities = state.entities || []
  const expenses = state.expenses || []
  const settings = state.settings || {}
  const entity   = entities[entIdx] || entities[0] || {}

  const approved = expenses.filter(e => e.status === 'approved')
  const pending  = expenses.filter(e => ['pending', 'ready'].includes(e.status))
  const entName  = entity.name || ''

  // Year-filtered by entity for Business/Reports
  const yearEntExp = approved.filter(e =>
    new Date(e.date).getFullYear() === year &&
    (e.entity_id === entName || e.entity_id === entity.shortName)
  )
  // All year expenses (Personal uses all entities)
  const yearAllExp = approved.filter(e => new Date(e.date).getFullYear() === year)

  const personalTotals = useMemo(() => {
    let personal = 0, deductible = 0, capital = 0
    yearAllExp.forEach(e => {
      if (e.is_capital) { capital += +e.amount_xcd; return }
      if (e.classification === 'personal') personal += +e.amount_xcd
      else deductible += +(e.deductible_amount || e.amount_xcd || 0)
    })
    return { personal, deductible, capital }
  }, [yearAllExp])

  const entityDeductible = useMemo(() =>
    yearEntExp.filter(e => !e.is_capital && e.classification !== 'personal')
              .reduce((s, e) => s + +(e.deductible_amount || e.amount_xcd || 0), 0)
  , [yearEntExp])

  async function apiCall(url, method = 'GET', body) {
    const opts = { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }
    await fetch(API + url, opts); load()
  }
  async function upload(files) {
    setBusy(true)
    const fd = new FormData()
    ;[...files].forEach(f => fd.append('files', f))
    await fetch(API + '/upload', { method: 'POST', body: fd })
    setBusy(false); load()
  }

  const sharedProps = { state, load, settings, entity, entities, entIdx, setEntIdx, year, setYear }

  return (
    <div className="app">
      {/* ── Dark header ── */}
      <div className="app-header">
        <div className="app-brand">
          <div className="app-icon"><Landmark size={22} color="white" /></div>
          <div className="app-title-block">
            <div className="app-title">AMISE — TAX &</div>
            <div className="app-title">FINANCIAL CONSULTANCY</div>
          </div>
        </div>
        <div className="entity-pills">
          {entities.map((e, i) => (
            <button key={e.id} className={`entity-pill${i === entIdx ? ' active' : ''}`} onClick={() => setEntIdx(i)}>
              {e.shortName || e.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sub-nav ── */}
      <nav className="sub-nav">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`sub-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={14} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="content">
        {tab === 'entities' && <EntitiesTab {...sharedProps} apiCall={apiCall} />}
        {tab === 'profile'  && <ProfileTab  {...sharedProps} />}
        {tab === 'personal' && <PersonalTab totals={personalTotals} yearExp={yearAllExp} settings={settings} year={year} setYear={setYear} totalEntries={yearAllExp.length} />}
        {tab === 'business' && <BusinessTab {...sharedProps} expenses={expenses} yearEntExp={yearEntExp} entityDeductible={entityDeductible} apiCall={apiCall} />}
        {tab === 'upload'   && <UploadTab   upload={upload} busy={busy} pending={pending} state={state} apiCall={apiCall} />}
        {tab === 'payroll'  && <PayrollTab  {...sharedProps} apiCall={apiCall} />}
        {tab === 'reports'  && <ReportsTab  yearEntExp={yearEntExp} year={year} entity={entity} />}
        {tab === 'summary'  && <SummaryTab  totals={personalTotals} entityDeductible={entityDeductible} settings={settings} entity={entity} />}
      </main>
    </div>
  )
}

// ── Entities tab ─────────────────────────────────────────────────────────────
const BLANK_ENTITY = { name: '', shortName: '', type: 'Business', color: '#3d9b7d' }
const ENTITY_TYPES = ['Medical Practice','Property','Business','Agriculture','Retail','Finance','Other']

function EntitiesTab({ entities, apiCall }) {
  const [editing, setEditing] = useState(null)

  async function save(e) {
    if (e.id) await apiCall(`/entities/${e.id}`, 'PUT', e)
    else      await apiCall('/entities', 'POST', e)
    setEditing(null)
  }
  async function del(id) {
    if (!confirm('Remove this entity?')) return
    await apiCall(`/entities/${id}`, 'DELETE')
  }

  return (
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Entities</h1><p className="page-sub">{entities.length} registered entities</p></div>
        <button onClick={() => setEditing({ ...BLANK_ENTITY })}><Plus size={15} /> Add</button>
      </div>

      <div className="entity-cards">
        {entities.map(e => (
          <div key={e.id} className="entity-card">
            <div className="entity-card-bar" style={{ background: e.color || '#3d9b7d' }} />
            <div className="entity-card-body">
              <div className="entity-card-name">{e.name}</div>
              <div className="entity-card-meta">{e.shortName} · {e.type}</div>
              <div className="entity-card-profile">
                {e.profile?.practitionerName && <span>{e.profile.practitionerName}</span>}
              </div>
            </div>
            <div className="entity-card-actions">
              <button className="btn-icon" onClick={() => setEditing({ ...e, profile: { ...e.profile } })}><Pencil size={14} /></button>
              <button className="btn-icon btn-icon-danger" onClick={() => del(e.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit Entity' : 'Add Entity'} onClose={() => setEditing(null)}>
          <EntityForm e={editing} onSave={save} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}

function EntityForm({ e, onSave, onCancel }) {
  const [f, setF] = useState(e)
  return (
    <div>
      <Field label="Full name"><input value={f.name || ''} onChange={ev => setF({ ...f, name: ev.target.value })} /></Field>
      <Field label="Short name (pill label)"><input value={f.shortName || ''} onChange={ev => setF({ ...f, shortName: ev.target.value })} /></Field>
      <TwoCol>
        <Field label="Type">
          <select value={f.type || 'Business'} onChange={ev => setF({ ...f, type: ev.target.value })}>
            {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Colour">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={f.color || '#3d9b7d'} onChange={ev => setF({ ...f, color: ev.target.value })} style={{ width: 44, height: 38, padding: 2, cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#666' }}>{f.color || '#3d9b7d'}</span>
          </div>
        </Field>
      </TwoCol>
      <div className="modal-actions">
        <button onClick={() => onSave(f)}><Check size={15} /> Save entity</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ entity, entities, entIdx, setEntIdx, load, apiCall }) {
  const [profile, setProfile] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setProfile(entity?.profile ? { ...entity.profile } : null)
    setSaved(false)
  }, [entity?.id])

  if (!entity || !profile) return <div className="empty-state">No entity selected.</div>

  async function save() {
    await apiCall(`/entities/${entity.id}`, 'PUT', { profile })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  function prevEnt() { setEntIdx(i => Math.max(0, i - 1)) }
  function nextEnt() { setEntIdx(i => Math.min(entities.length - 1, i + 1)) }

  return (
    <div className="page">
      <div className="profile-section">
        <div className="profile-header">
          <UserCircle size={16} color="#3d9b7d" />
          <span className="profile-label">Practitioner &amp; Engagement Profile</span>
        </div>
        <div className="profile-sub">Pre-loaded for {entity.name}</div>

        <TwoCol>
          <Field label="Practitioner Name">
            <input value={profile.practitionerName || ''} onChange={e => setProfile({ ...profile, practitionerName: e.target.value })} />
          </Field>
          <Field label="Practice Name">
            <input value={profile.practiceName || ''} onChange={e => setProfile({ ...profile, practiceName: e.target.value })} />
          </Field>
        </TwoCol>
        <TwoCol>
          <Field label="Practitioner TIN / NIN">
            <input value={profile.practitionerTin || ''} onChange={e => setProfile({ ...profile, practitionerTin: e.target.value })} placeholder="e.g. 12345678" />
          </Field>
          <Field label="Practice TIN">
            <input value={profile.practiceTin || ''} onChange={e => setProfile({ ...profile, practiceTin: e.target.value })} placeholder="e.g. 98765432" />
          </Field>
        </TwoCol>
        <TwoCol>
          <Field label="Phone / Contact">
            <input value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 758 …" />
          </Field>
          <Field label="Tax Year">
            <select value={profile.taxYear || 2026} onChange={e => setProfile({ ...profile, taxYear: +e.target.value })}>
              {YEARS.map(y => <option key={y}>{y}</option>)}
            </select>
          </Field>
        </TwoCol>
        <Field label="Address">
          <input value={profile.address || ''} onChange={e => setProfile({ ...profile, address: e.target.value })} />
        </Field>
        <Field label="Engagement Type">
          <select value={profile.engagementType || 'both'} onChange={e => setProfile({ ...profile, engagementType: e.target.value })}>
            <option value="both">Personal &amp; Business</option>
            <option value="business">Business Only</option>
            <option value="personal">Personal Only</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea value={profile.notes || ''} rows={3} onChange={e => setProfile({ ...profile, notes: e.target.value })} />
        </Field>

        {/* Navigation + save controls */}
        <div className="profile-controls">
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon btn-nav" onClick={prevEnt} disabled={entIdx === 0} title="Previous entity"><ChevronUp size={16} /></button>
            <button className="btn-icon btn-nav" onClick={nextEnt} disabled={entIdx === entities.length - 1} title="Next entity"><ChevronDown size={16} /></button>
          </div>
          <span className="profile-entity-pos">{entIdx + 1} / {entities.length}</span>
          <button onClick={save} className={saved ? 'btn-saved' : ''}>
            {saved ? <><Check size={15} /> Saved</> : <><Check size={15} /> Save profile</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Personal tab ──────────────────────────────────────────────────────────────
function PersonalTab({ totals, yearExp, settings, year, setYear, totalEntries }) {
  const months = MONTHS.map((_, i) =>
    yearExp.filter(e => e.classification === 'personal' && new Date(e.date).getMonth() === i)
           .reduce((s, e) => s + +(e.amount_xcd || 0), 0)
  )
  const pMax  = settings.personalMaximumLimit      || 232000
  const pCons = settings.personalConservativeLimit || 232000

  return (
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Personal</h1><p className="page-sub">Allowances — {year}</p></div>
        <select className="year-select" value={year} onChange={e => setYear(+e.target.value)}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="big-card">
        <div className="big-card-head"><TrendingUp size={16} className="card-icon" /><span className="card-label">Personal Allowances</span></div>
        <div className="big-card-value">{fmt(totals.personal)}</div>
        <div className="card-sub">of ${pMax.toLocaleString()} max XCD</div>
      </div>

      <div className="card-row">
        <div className="small-card">
          <div className="small-card-label">Total entries</div>
          <div className="small-card-value">{totalEntries}</div>
          <div className="card-sub">records this year</div>
        </div>
        <div className="small-card">
          <div className="small-card-label">Combined total</div>
          <div className="small-card-value">{fmt(totals.personal + totals.deductible)}</div>
          <div className="card-sub">all deductions XCD</div>
        </div>
      </div>

      <section className="section">
        <div className="section-title">Personal Allowances Progress</div>
        <ProgressBar label="Conservative Limit" val={totals.personal} max={pCons} />
        <ProgressBar label="Maximum Limit"       val={totals.personal} max={pMax}  />
      </section>

      <section className="section">
        <div className="section-title">Monthly Breakdown — Personal</div>
        <div className="month-grid">
          {MONTHS.map((m, i) => (
            <div key={m} className="month-cell">
              <span className="month-label">{m}</span>
              <strong className="month-val">{months[i] > 0 ? fmt(months[i]) : '—'}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Business tab ──────────────────────────────────────────────────────────────
const BLANK_EXP = { date: new Date().toISOString().slice(0, 10), vendor: '', category: '', classification: 'business', amount_xcd: '', currency: 'XCD', notes: '' }

function BusinessTab({ expenses, yearEntExp, entityDeductible, entity, settings, year, setYear, apiCall }) {
  const [form, setForm]     = useState(BLANK_EXP)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const bizCats = settings?.categories?.business || []
  const perCats = settings?.categories?.personal || []
  const cats    = form.classification === 'personal' ? perCats : bizCats
  const bMax    = settings.maximumLimit  || 707700
  const bCons   = settings.conservativeLimit || 551000

  const months = MONTHS.map((_, i) =>
    yearEntExp.filter(e => new Date(e.date).getMonth() === i)
              .reduce((s, e) => s + +(e.deductible_amount || e.amount_xcd || 0), 0)
  )

  async function submit(ev) {
    ev.preventDefault()
    if (!form.vendor || !form.amount_xcd) return
    setSaving(true)
    await apiCall('/expenses', 'POST', {
      ...form, amount_xcd: +form.amount_xcd,
      status: 'approved', deductible_amount: +form.amount_xcd,
      entity_id: entity?.name || '',
    })
    setForm(BLANK_EXP); setSaving(false)
  }
  async function del(id) {
    if (!confirm('Delete this expense?')) return
    await apiCall(`/expenses/${id}`, 'DELETE')
  }

  const allEntExp = expenses.filter(e =>
    (e.entity_id === entity?.name || e.entity_id === entity?.shortName)
  )
  const shown = filter === 'all' ? allEntExp : allEntExp.filter(e => e.status === filter)

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <h1 className="page-h1">Business</h1>
          <p className="page-sub">{entity?.name} — {year}</p>
        </div>
        <select className="year-select" value={year} onChange={e => setYear(+e.target.value)}>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="big-card">
        <div className="big-card-head"><TrendingDown size={16} className="card-icon" /><span className="card-label">Business Expenses</span></div>
        <div className="big-card-value">{fmt(entityDeductible)}</div>
        <div className="card-sub">of ${bMax.toLocaleString()} max XCD</div>
      </div>

      <section className="section">
        <div className="section-title">Expenses Progress</div>
        <ProgressBar label="Conservative Limit" val={entityDeductible} max={bCons} />
        <ProgressBar label="Maximum Limit"       val={entityDeductible} max={bMax}  />
      </section>

      <section className="section">
        <div className="section-title">Monthly Breakdown</div>
        <div className="month-grid">
          {MONTHS.map((m, i) => (
            <div key={m} className="month-cell">
              <span className="month-label">{m}</span>
              <strong className="month-val">{months[i] > 0 ? fmt(months[i]) : '—'}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* Manual entry */}
      <form className="expense-form" onSubmit={submit}>
        <div className="section-title" style={{ marginBottom: 14 }}>Add Expense</div>
        <TwoCol>
          <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></Field>
          <Field label="Amount (XCD)"><input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount_xcd} onChange={e => setForm({ ...form, amount_xcd: e.target.value })} required /></Field>
        </TwoCol>
        <Field label="Vendor / Description"><input placeholder="e.g. Courts, LIME, JQ Charles" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} required /></Field>
        <TwoCol>
          <Field label="Type">
            <select value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value, category: '' })}>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">— select —</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </TwoCol>
        <Field label="Notes (optional)"><textarea placeholder="Reference, project…" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <button type="submit" disabled={saving}><Plus size={15} />{saving ? 'Saving…' : 'Add Expense'}</button>
      </form>

      {/* Filter + list */}
      <div className="filter-row">
        {['all', 'approved', 'pending', 'rejected'].map(f => (
          <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {shown.length === 0
        ? <div className="empty-state">No expenses for {entity?.name}.</div>
        : <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>XCD</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map(e => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.vendor}</td>
                    <td style={{ color: '#666' }}>{e.category}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(e.amount_xcd)}</td>
                    <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                    <td><button className="btn-icon btn-icon-danger" onClick={() => del(e.id)}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  )
}

// ── Upload tab ────────────────────────────────────────────────────────────────
function UploadTab({ upload, busy, pending, state, apiCall }) {
  async function updateExpense(id, patch) { await apiCall(`/expenses/${id}`, 'PUT', patch) }
  async function bulk() {
    await fetch(API + '/expenses/bulk-approve-ready', { method: 'POST' })
    location.reload()
  }
  return (
    <div className="page">
      <h1 className="page-h1">Upload</h1>
      <label className="drop-zone">
        <input type="file" multiple accept="image/*,.heic,.pdf" onChange={e => upload(e.target.files)} />
        <UploadCloud size={40} className="card-icon" />
        <strong>Drop receipts or tap to select</strong>
        <span>Photos, HEIC, PDF — up to 30 files</span>
      </label>
      {busy && <div className="notice">Extracting with AI…</div>}
      {pending.length > 0 && (
        <section className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="section-title" style={{ margin: 0 }}>Review Inbox ({pending.length})</div>
            <button className="btn-sm" onClick={bulk}>Approve all ready</button>
          </div>
          <div className="review-list">
            {pending.map(e => <ReviewCard key={e.id} e={e} state={state} update={updateExpense} />)}
          </div>
        </section>
      )}
      {!busy && pending.length === 0 && <div className="empty-state">No items pending review.</div>}
    </div>
  )
}

function ReviewCard({ e, state, update }) {
  const [x, setX] = useState(e)
  const cats = state.settings.categories[x.classification === 'personal' ? 'personal' : 'business'] || []
  return (
    <div className={`review-card${e.status === 'pending' ? ' needs-review' : ''}`}>
      <div className="review-head"><strong>{e.vendor || 'Unknown'}</strong><span className={`badge badge-${e.status}`}>{e.status}</span></div>
      <div className="review-amount">{fmt(e.amount_xcd)} <span style={{ fontSize: 13, color: '#aaa' }}>XCD</span></div>
      {e.duplicate  && <div className="warn">Duplicate detected</div>}
      {e.is_capital && <div className="warn">Capital item</div>}
      <div className="review-fields">
        <input value={x.vendor || ''} placeholder="Vendor" onChange={ev => setX({ ...x, vendor: ev.target.value })} />
        <input type="date" value={x.date || ''} onChange={ev => setX({ ...x, date: ev.target.value })} />
        <select value={x.classification} onChange={ev => setX({ ...x, classification: ev.target.value })}>
          <option value="business">Business</option>
          <option value="personal">Personal</option>
        </select>
        <select value={x.category} onChange={ev => setX({ ...x, category: ev.target.value })}>
          <option value="">— category —</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="review-actions">
        <button onClick={() => update(e.id, { ...x, status: 'approved' })}><CheckCircle size={14} /> Approve</button>
        <button className="btn-secondary" onClick={() => update(e.id, x)}>Save</button>
        <button className="btn-danger" onClick={() => update(e.id, { status: 'rejected' })}><Trash2 size={14} /> Reject</button>
      </div>
    </div>
  )
}

// ── Payroll tab ───────────────────────────────────────────────────────────────
function PayrollTab({ state, entity, apiCall, load }) {
  const ps    = state?.payroll?.settings || {}
  const staff = state?.payroll?.staff    || []
  const runs  = state?.payroll?.runs     || []
  const now   = new Date()
  const [month,    setMonth]   = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [running,  setRunning] = useState(false)
  const [exporting,setExp]     = useState(false)
  const [editing,  setEditing] = useState(null)

  const active     = staff.filter(s => s.status === 'active')
  const currentRun = runs.find(r => r.month === month)

  async function runPayroll() {
    setRunning(true)
    await fetch(`${API}/payroll/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) })
    setRunning(false); load()
  }
  async function exportRun() {
    setExp(true)
    await fetch(`${API}/payroll/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) })
    setExp(false); load()
  }
  async function saveStaff(s) {
    if (s.id) await fetch(`${API}/payroll/staff/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    else      await fetch(`${API}/payroll/staff`,          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) })
    setEditing(null); load()
  }
  async function delStaff(id) {
    if (!confirm('Remove staff member?')) return
    await fetch(`${API}/payroll/staff/${id}`, { method: 'DELETE' }); load()
  }

  function printSlip(l) {
    const w = window.open('', '_blank'); if (!w) return
    const [yr, mo] = month.split('-')
    const mLabel   = new Date(+yr, +mo - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
    w.document.write(`<!doctype html><html><head><title>Pay Slip</title><style>body{font-family:system-ui;padding:28px;max-width:500px;margin:auto;color:#111}h2{margin:0 0 2px}hr{border:none;border-top:1px solid #ddd;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;font-size:14px}td:last-child{text-align:right;font-weight:700}.tot td{border-top:2px solid #111;font-weight:800}.foot{font-size:11px;color:#888;margin-top:22px;line-height:1.6}</style></head><body><h2>Amise Medical Services</h2><p style="color:#555;font-size:13px;margin:2px 0 18px">Pay Slip · ${mLabel}</p><hr><p><b>${l.name}</b></p><p style="color:#555;font-size:13px">${l.position||''} · ${l.entity||''} · ${l.type||''}</p><hr><table><tr><td>Gross salary</td><td>${fmt(l.gross)}</td></tr><tr><td>PAYE withheld</td><td style="color:#c03030">(${fmt(l.paye)})</td></tr><tr><td>Employee NIC</td><td style="color:#b06000">(${fmt(l.nicEmployee)})</td></tr><tr class="tot"><td>Net pay</td><td style="color:#006b3e">${fmt(l.net)}</td></tr></table><p style="margin-top:14px;font-size:13px;color:#555">Employer NIC: ${fmt(l.nicEmployer)}</p><hr><p class="foot">Generated ${new Date().toLocaleDateString('en-GB')} · ITA Cap 15.02 / NIC Act · Reference only</p></body></html>`)
    w.document.close(); w.print()
  }

  const rTot = active.reduce((t, s) => { const c = computePayFE(s, ps); return { gross: +(t.gross + s.grossMonthly).toFixed(2), nic: +(t.nic + c.nic).toFixed(2), paye: +(t.paye + c.paye).toFixed(2), net: +(t.net + c.net).toFixed(2) } }, { gross: 0, nic: 0, paye: 0, net: 0 })

  const entityForBlank = state?.settings?.entities?.[0] || entity?.name || 'Amise Medical Services'

  return (
    <div className="page">
      <h1 className="page-h1">Payroll</h1>
      <p className="page-sub" style={{ marginBottom: 14 }}>Saint Lucia ITA Cap 15.02 · NIC Act</p>

      {/* Staff roster */}
      <section className="section" style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 12px' }}>
          <div className="section-title" style={{ margin: 0 }}>Staff Roster — {active.length} active</div>
          <button className="btn-sm" onClick={() => setEditing({ name: '', position: '', entity: entityForBlank, type: 'permanent', grossMonthly: 0, spouseAllowance: 0, childAllowance: 0, otherAllowance: 0 })}>
            <Plus size={14} /> Add staff
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Name / Position</th><th>Entity</th><th>Gross/mo</th><th>NIC emp</th><th>PAYE/mo</th><th>Net/mo</th><th></th></tr></thead>
            <tbody>
              {active.map(s => { const c = computePayFE(s, ps); return (
                <tr key={s.id}>
                  <td><b>{s.name}</b><br /><small style={{ color: '#888' }}>{s.position}</small></td>
                  <td style={{ fontSize: 12 }}>{s.entity}</td>
                  <td>{fmt(s.grossMonthly)}</td>
                  <td style={{ color: '#b06000' }}>{fmt(c.nic)}</td>
                  <td style={{ color: '#c03030' }}>{fmt(c.paye)}</td>
                  <td style={{ color: '#177a56', fontWeight: 700 }}>{fmt(c.net)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn-icon" style={{ marginRight: 4 }} onClick={() => setEditing({ ...s })}><Pencil size={13} /></button>
                    <button className="btn-icon btn-icon-danger" onClick={() => delStaff(s.id)}><X size={13} /></button>
                  </td>
                </tr>
              ) })}
              <tr style={{ fontWeight: 800, background: '#f6fbf9' }}>
                <td colSpan={2}>TOTAL — {active.length} staff</td>
                <td>{fmt(rTot.gross)}</td>
                <td style={{ color: '#b06000' }}>{fmt(rTot.nic)}</td>
                <td style={{ color: '#c03030' }}>{fmt(rTot.paye)}</td>
                <td style={{ color: '#177a56' }}>{fmt(rTot.net)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Monthly run */}
      <section className="section">
        <div className="section-title">Monthly Payroll Run</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto', padding: '10px 14px' }} />
          <button onClick={runPayroll} disabled={running}>{running ? 'Computing…' : '▶ Run ' + month}</button>
          {currentRun && <button style={{ background: '#177a56' }} onClick={exportRun} disabled={exporting}>{exporting ? 'Posting…' : '→ Post to Expenses'}</button>}
        </div>
        {currentRun && (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Gross</th><th>PAYE</th><th>NIC Emp</th><th>NIC Empr</th><th>Net Pay</th><th>Slip</th></tr></thead>
              <tbody>
                {currentRun.lines.map(l => (
                  <tr key={l.staffId}>
                    <td><b>{l.name}</b><br /><small style={{ color: '#888' }}>{l.position}</small></td>
                    <td>{fmt(l.gross)}</td>
                    <td style={{ color: '#c03030' }}>{fmt(l.paye)}</td>
                    <td style={{ color: '#b06000' }}>{fmt(l.nicEmployee)}</td>
                    <td style={{ color: '#666' }}>{fmt(l.nicEmployer)}</td>
                    <td style={{ color: '#177a56', fontWeight: 700 }}>{fmt(l.net)}</td>
                    <td><button className="btn-icon" onClick={() => printSlip(l)}>🖨</button></td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 800, background: '#f6fbf9' }}>
                  <td>TOTAL</td>
                  <td>{fmt(currentRun.totals.gross)}</td>
                  <td style={{ color: '#c03030' }}>{fmt(currentRun.totals.paye)}</td>
                  <td style={{ color: '#b06000' }}>{fmt(currentRun.totals.nicEmployee)}</td>
                  <td style={{ color: '#666' }}>{fmt(currentRun.totals.nicEmployer)}</td>
                  <td style={{ color: '#177a56', fontWeight: 700 }}>{fmt(currentRun.totals.net)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <Modal title={editing.id ? 'Edit Staff Member' : 'Add Staff Member'} onClose={() => setEditing(null)}>
          <StaffForm s={editing} ps={ps} entities={state?.settings?.entities || []} onSave={saveStaff} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}

function StaffForm({ s, ps, entities, onSave, onClose }) {
  const [f, setF] = useState({ ...s })
  const c = computePayFE(f, ps)
  return (
    <div>
      <Field label="Full name / label"><input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Position / Job title"><input value={f.position || ''} onChange={e => setF({ ...f, position: e.target.value })} /></Field>
      <TwoCol>
        <Field label="Entity">
          <select value={f.entity || ''} onChange={e => setF({ ...f, entity: e.target.value })}>
            {entities.map(x => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Employment type">
          <select value={f.type || 'permanent'} onChange={e => setF({ ...f, type: e.target.value })}>
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
            <option value="parttime">Part-time</option>
          </select>
        </Field>
      </TwoCol>
      <Field label="Gross monthly salary (XCD)">
        <input type="number" min={0} value={f.grossMonthly || 0} onChange={e => setF({ ...f, grossMonthly: +e.target.value })} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Field label="Spouse allow. /yr"><input type="number" min={0} value={f.spouseAllowance || 0} onChange={e => setF({ ...f, spouseAllowance: +e.target.value })} /></Field>
        <Field label="Child allow. /yr"><input type="number" min={0} value={f.childAllowance || 0} onChange={e => setF({ ...f, childAllowance: +e.target.value })} /></Field>
        <Field label="Other allow. /yr"><input type="number" min={0} value={f.otherAllowance || 0} onChange={e => setF({ ...f, otherAllowance: +e.target.value })} /></Field>
      </div>
      {/* Live PAYE preview */}
      <div className="paye-preview">
        <div className="paye-preview-title">Monthly preview (ITA Cap 15.02)</div>
        <div className="paye-preview-grid">
          <div><div className="paye-label">Gross</div><strong>{fmt(f.grossMonthly || 0)}</strong></div>
          <div><div className="paye-label">NIC emp</div><strong style={{ color: '#b06000' }}>{fmt(c.nic)}</strong></div>
          <div><div className="paye-label">PAYE</div><strong style={{ color: '#c03030' }}>{fmt(c.paye)}</strong></div>
          <div><div className="paye-label">Net pay</div><strong style={{ color: '#177a56' }}>{fmt(c.net)}</strong></div>
        </div>
      </div>
      <div className="modal-actions">
        <button onClick={() => onSave(f)}><Check size={15} /> Save</button>
        {f.id && <button className="btn-danger" onClick={() => { if (confirm('Deactivate?')) onSave({ ...f, status: 'inactive' }) }}>Deactivate</button>}
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ── Reports tab ───────────────────────────────────────────────────────────────
function ReportsTab({ yearEntExp, year, entity }) {
  const byCategory = yearEntExp.reduce((a, e) => {
    const k = e.category || 'Uncategorised'
    a[k] = (a[k] || 0) + (+(e.deductible_amount || e.amount_xcd || 0))
    return a
  }, {})
  const rows  = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Reports</h1><p className="page-sub">{entity?.name} — {year}</p></div>
      </div>
      {rows.length === 0
        ? <div className="empty-state">No approved expenses for {entity?.name}.</div>
        : <section className="section" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>XCD</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v)}</td>
                    <td style={{ textAlign: 'right', color: '#888', fontSize: 12 }}>{total > 0 ? Math.round((v / total) * 100) : 0}%</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
                  <td style={{ textAlign: 'right' }}>100%</td>
                </tr>
              </tbody>
            </table>
          </section>
      }
    </div>
  )
}

// ── Summary tab ───────────────────────────────────────────────────────────────
function SummaryTab({ totals, entityDeductible, settings, entity }) {
  const pMax  = settings.personalMaximumLimit      || 232000
  const pCons = settings.personalConservativeLimit || 232000
  const bMax  = settings.maximumLimit              || 707700
  const bCons = settings.conservativeLimit         || 551000

  return (
    <div className="page">
      <div className="page-title-row">
        <div><h1 className="page-h1">Summary</h1><p className="page-sub">{entity?.name}</p></div>
      </div>

      <div className="card-row">
        <div className="small-card">
          <div className="small-card-label">Business deductible</div>
          <div className="small-card-value">{fmt(entityDeductible)}</div>
          <div className="card-sub">approved XCD</div>
        </div>
        <div className="small-card">
          <div className="small-card-label">Personal allowances</div>
          <div className="small-card-value">{fmt(totals.personal)}</div>
          <div className="card-sub">approved XCD</div>
        </div>
      </div>

      <section className="section">
        <div className="section-title">Personal Allowances (ITA Cap 15.02)</div>
        <ProgressBar label="Conservative Limit" val={totals.personal} max={pCons} />
        <ProgressBar label="Maximum Limit"       val={totals.personal} max={pMax}  />
      </section>

      <section className="section">
        <div className="section-title">Business Expenses — {entity?.name}</div>
        <ProgressBar label="Conservative Limit" val={entityDeductible} max={bCons} />
        <ProgressBar label="Maximum Limit"       val={entityDeductible} max={bMax}  />
      </section>

      <div className="notice">
        Capital items are excluded from the deductible total and flagged for capital allowance review.
        Confirm all figures with a registered tax practitioner before filing with the Saint Lucia IRD.
      </div>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────
function ProgressBar({ label, val, max }) {
  const pct = Math.min(100, max > 0 ? Math.round((val / max) * 100) : 0)
  return (
    <div className="progress-row">
      <div className="progress-meta">
        <span>{label}</span>
        <span>${(val || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${(max || 0).toLocaleString()} XCD</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: pct + '%' }} /></div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

function TwoCol({ children }) {
  return <div className="two-col">{children}</div>
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <strong>{title}</strong>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
