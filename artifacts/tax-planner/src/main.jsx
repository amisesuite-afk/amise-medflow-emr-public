import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  LayoutDashboard, Receipt, UploadCloud, FileText,
  Calculator, PanelLeft, TrendingUp, TrendingDown,
  CheckCircle, Trash2, Plus,
} from 'lucide-react'
import './style.css'

const API = '/api'
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
  { id: 'expenses',  label: 'Expenses',    Icon: Receipt },
  { id: 'upload',    label: 'Upload',      Icon: UploadCloud },
  { id: 'reports',   label: 'Reports',     Icon: FileText },
  { id: 'summary',   label: 'Tax Summary', Icon: Calculator },
]

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage]           = useState('dashboard')
  const [state, setState]         = useState(null)
  const [drawerOpen, setDrawer]   = useState(false)
  const [busy, setBusy]           = useState(false)
  const [year, setYear]           = useState(new Date().getFullYear())

  const load = () => fetch(API + '/state').then(r => r.json()).then(setState)
  useEffect(() => { load() }, [])

  const expenses  = state?.expenses  || []
  const settings  = state?.settings  || {}
  const approved  = expenses.filter(e => e.status === 'approved')
  const pending   = expenses.filter(e => ['pending', 'ready'].includes(e.status))
  const yearExp   = approved.filter(e => new Date(e.date).getFullYear() === year)

  const totals = useMemo(() => {
    let personal = 0, deductible = 0, capital = 0
    yearExp.forEach(e => {
      if (e.is_capital) { capital += +e.amount_xcd; return }
      if (e.classification === 'personal') personal += +e.amount_xcd
      else deductible += +(e.deductible_amount || e.amount_xcd || 0)
    })
    return { personal, deductible, capital }
  }, [yearExp])

  async function upload(files) {
    setBusy(true)
    const fd = new FormData()
    ;[...files].forEach(f => fd.append('files', f))
    await fetch(API + '/upload', { method: 'POST', body: fd })
    setBusy(false); load()
  }
  async function updateExpense(id, patch) {
    await fetch(`${API}/expenses/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }); load()
  }
  async function addExpense(data) {
    await fetch(`${API}/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }); load()
  }
  async function deleteExpense(id) {
    await fetch(`${API}/expenses/${id}`, { method: 'DELETE' }); load()
  }

  function nav(id) { setPage(id); setDrawer(false) }

  if (!state) return <div className="loading-screen">Loading…</div>

  const curNav = NAV.find(n => n.id === page)

  return (
    <div className="app">
      {drawerOpen && <div className="overlay" onClick={() => setDrawer(false)} />}

      {/* Drawer */}
      <nav className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-logo">Amise Tax Planner</span>
        </div>
        <ul className="drawer-nav">
          {NAV.map(({ id, label, Icon }) => (
            <li key={id}>
              <button className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => nav(id)}>
                <Icon size={18} /><span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="drawer-user">
          <div className="avatar">D</div>
          <div>
            <div className="u-name">Dawit Kabiye</div>
            <div className="u-email">tv7zxnxyfx@privaterelay.appleid.com</div>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="main-wrap">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setDrawer(true)}><PanelLeft size={22} /></button>
          <span className="topbar-title">{curNav?.label}</span>
        </header>
        <main>
          {page === 'dashboard' && <DashboardPage totals={totals} yearExp={yearExp} settings={settings} year={year} setYear={setYear} totalEntries={yearExp.length} />}
          {page === 'expenses'  && <ExpensesPage  expenses={expenses} settings={settings} add={addExpense} update={updateExpense} del={deleteExpense} />}
          {page === 'upload'    && <UploadPage    upload={upload} busy={busy} pending={pending} state={state} update={updateExpense} />}
          {page === 'reports'   && <ReportsPage   expenses={yearExp} year={year} />}
          {page === 'summary'   && <TaxSummaryPage totals={totals} settings={settings} />}
        </main>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ totals, yearExp, settings, year, setYear, totalEntries }) {
  const months = MONTHS.map((_, i) =>
    yearExp.filter(e => new Date(e.date).getMonth() === i)
           .reduce((s, e) => s + (+(e.deductible_amount || e.amount_xcd || 0)), 0)
  )
  const pMax  = settings.personalMaximumLimit      || 232000
  const pCons = settings.personalConservativeLimit || 232000
  const bMax  = settings.maximumLimit              || 707700
  const bCons = settings.conservativeLimit         || 551000
  const combined = totals.personal + totals.deductible
  const years = [2024, 2025, 2026, 2027]

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <h1 className="page-h1">Dashboard</h1>
          <p className="page-sub">Tax year {year} expense overview</p>
        </div>
        <select className="year-select" value={year} onChange={e => setYear(+e.target.value)}>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="big-card">
        <div className="big-card-head"><TrendingUp size={16} className="card-icon" /><span className="card-label">Personal Allowances</span></div>
        <div className="big-card-value">{fmt(totals.personal)}</div>
        <div className="card-sub">of ${pMax.toLocaleString()} max XCD</div>
      </div>

      <div className="big-card">
        <div className="big-card-head"><TrendingDown size={16} className="card-icon" /><span className="card-label">Business Expenses</span></div>
        <div className="big-card-value">{fmt(totals.deductible)}</div>
        <div className="card-sub">of ${bMax.toLocaleString()} max XCD</div>
      </div>

      <div className="card-row">
        <div className="small-card">
          <div className="small-card-label">Total Entries</div>
          <div className="small-card-value">{totalEntries}</div>
          <div className="card-sub">expense records this year</div>
        </div>
        <div className="small-card">
          <div className="small-card-label">Combined Total</div>
          <div className="small-card-value">{fmt(combined)}</div>
          <div className="card-sub">total deductions XCD</div>
        </div>
      </div>

      <section className="section">
        <div className="section-title">Personal Allowances Progress</div>
        <ProgressBar label="Conservative Limit" val={totals.personal} max={pCons} />
        <ProgressBar label="Maximum Limit"       val={totals.personal} max={pMax}  />
      </section>

      <section className="section">
        <div className="section-title">Business Expenses Progress</div>
        <ProgressBar label="Conservative Limit" val={totals.deductible} max={bCons} />
        <ProgressBar label="Maximum Limit"       val={totals.deductible} max={bMax}  />
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
    </div>
  )
}

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

// ── Expenses (manual entry + list) ────────────────────────────────────────────
const BLANK = { date: new Date().toISOString().slice(0, 10), vendor: '', category: '', classification: 'business', amount_xcd: '', currency: 'XCD', notes: '' }

function ExpensesPage({ expenses, settings, add, update, del }) {
  const [form, setForm]   = useState(BLANK)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const bizCats = settings?.categories?.business || []
  const perCats = settings?.categories?.personal || []
  const cats    = form.classification === 'personal' ? perCats : bizCats

  async function submit(e) {
    e.preventDefault()
    if (!form.vendor || !form.amount_xcd) return
    setSaving(true)
    await add({ ...form, amount_xcd: +form.amount_xcd, status: 'approved', deductible_amount: +form.amount_xcd, entity_id: settings.defaultEntity || '' })
    setForm(BLANK)
    setSaving(false)
  }

  const shown = filter === 'all' ? expenses : expenses.filter(e => e.status === filter)

  return (
    <div className="page">
      <h1 className="page-h1">Expenses</h1>

      {/* Manual entry form */}
      <form className="expense-form" onSubmit={submit}>
        <div className="section-title" style={{ marginBottom: 14 }}>Add Expense</div>
        <div className="form-row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="field">
            <label>Amount (XCD)</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount_xcd} onChange={e => setForm({ ...form, amount_xcd: e.target.value })} required />
          </div>
        </div>
        <div className="field">
          <label>Vendor / Description</label>
          <input placeholder="e.g. Courts, LIME, JQ Charles" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} required />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Type</label>
            <select value={form.classification} onChange={e => setForm({ ...form, classification: e.target.value, category: '' })}>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="">— select —</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <textarea placeholder="Reference number, project, etc." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button type="submit" disabled={saving}>
          <Plus size={16} />{saving ? 'Saving…' : 'Add Expense'}
        </button>
      </form>

      {/* Filter + list */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['all', 'approved', 'pending', 'rejected'].map(f => (
          <button key={f} className={filter === f ? '' : 'btn-secondary'} onClick={() => setFilter(f)} style={{ padding: '7px 12px', fontSize: 13, textTransform: 'capitalize' }}>{f}</button>
        ))}
      </div>

      {shown.length === 0
        ? <div className="empty-state">No expenses yet.</div>
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
                    <td>
                      <button className="btn-danger btn-sm" style={{ padding: '5px 9px' }} onClick={() => { if (confirm('Delete this expense?')) del(e.id) }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
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
function UploadPage({ upload, busy, pending, state, update }) {
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
            {pending.map(e => <ReviewCard key={e.id} e={e} state={state} update={update} />)}
          </div>
        </section>
      )}

      {pending.length === 0 && !busy && (
        <div className="empty-state">No items pending review.</div>
      )}
    </div>
  )
}

function ReviewCard({ e, state, update }) {
  const [x, setX] = useState(e)
  const cats = state.settings.categories[x.classification === 'personal' ? 'personal' : 'business'] || []
  return (
    <div className={`review-card ${e.status === 'pending' ? 'needs-review' : ''}`}>
      <div className="review-head">
        <strong>{e.vendor || 'Unknown vendor'}</strong>
        <span className={`badge badge-${e.status}`}>{e.status}</span>
      </div>
      <div className="review-amount">{fmt(e.amount_xcd)} <span style={{ fontSize: 14, color: '#aaa' }}>XCD</span></div>
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

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsPage({ expenses, year }) {
  const byCategory = expenses.reduce((a, e) => {
    const key = e.category || 'Uncategorised'
    a[key] = (a[key] || 0) + (+(e.deductible_amount || e.amount_xcd || 0))
    return a
  }, {})
  const rows  = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <h1 className="page-h1">Reports</h1>
          <p className="page-sub">Approved deductions — {year}</p>
        </div>
      </div>

      {rows.length === 0
        ? <div className="empty-state">No approved expenses yet.</div>
        : <section className="section" style={{ padding: 0 }}>
            <table className="data-table">
              <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Total XCD</th></tr></thead>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(v)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
      }
    </div>
  )
}

// ── Tax Summary ───────────────────────────────────────────────────────────────
function TaxSummaryPage({ totals, settings }) {
  const pMax  = settings.personalMaximumLimit      || 232000
  const pCons = settings.personalConservativeLimit || 232000
  const bMax  = settings.maximumLimit              || 707700
  const bCons = settings.conservativeLimit         || 551000

  return (
    <div className="page">
      <h1 className="page-h1">Tax Summary</h1>

      <div className="card-row">
        <div className="small-card">
          <div className="small-card-label">Business deductible</div>
          <div className="small-card-value">{fmt(totals.deductible)}</div>
          <div className="card-sub">approved XCD</div>
        </div>
        <div className="small-card">
          <div className="small-card-label">Personal allowances</div>
          <div className="small-card-value">{fmt(totals.personal)}</div>
          <div className="card-sub">approved XCD</div>
        </div>
      </div>

      <section className="section">
        <div className="section-title">Personal Allowances</div>
        <ProgressBar label="Conservative Limit" val={totals.personal} max={pCons} />
        <ProgressBar label="Maximum Limit"       val={totals.personal} max={pMax}  />
      </section>

      <section className="section">
        <div className="section-title">Business Expenses</div>
        <ProgressBar label="Conservative Limit" val={totals.deductible} max={bCons} />
        <ProgressBar label="Maximum Limit"       val={totals.deductible} max={bMax}  />
      </section>

      <div className="notice">
        Capital items are excluded from the deductible total and flagged for capital allowance review.
        Confirm figures with a registered tax practitioner before filing.
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
