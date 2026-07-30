import { useState, useEffect, useCallback } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OutboundReferral {
  id: string;
  recipient: string;
  specialty: string;
  reason: string;
  dateSent: string;
  expectedDays: number;
  status: 'pending' | 'received' | 'overdue';
}

interface ApiReferral {
  id: string;
  referral_to: string;
  specialty: string | null;
  reason: string | null;
  expected_days: number | null;
  status: string;
  created_at: string;
  encounter_id: string | null;
}

type ProviderType = 'lab' | 'radiology' | 'referring_doctor' | 'other';
type DocumentType =
  | 'lab_report' | 'imaging_report' | 'referral_letter' | 'consent_form'
  | 'surgical_report' | 'discharge_summary' | 'prescription' | 'insurance_form' | 'other';

interface ReferringProvider {
  id: string;
  name: string;
  email: string | null;
  provider_type: ProviderType;
  default_document_type: DocumentType;
  notes: string | null;
  active: boolean;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'lab',              label: 'Laboratory' },
  { value: 'radiology',        label: 'Radiology / Imaging' },
  { value: 'referring_doctor', label: 'Referring Doctor' },
  { value: 'other',            label: 'Other' },
];

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'lab_report',        label: 'Lab Report' },
  { value: 'imaging_report',    label: 'Imaging Report' },
  { value: 'referral_letter',   label: 'Referral Letter' },
  { value: 'consent_form',      label: 'Consent Form' },
  { value: 'surgical_report',   label: 'Surgical Report' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'prescription',      label: 'Prescription' },
  { value: 'insurance_form',    label: 'Insurance Form' },
  { value: 'other',             label: 'Other' },
];

const PROVIDER_TYPE_LABEL = Object.fromEntries(PROVIDER_TYPES.map(t => [t.value, t.label])) as Record<ProviderType, string>;
const DOCUMENT_TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map(t => [t.value, t.label])) as Record<DocumentType, string>;

const STATUS_STYLE: Record<OutboundReferral['status'], { bg: string; fg: string; bd: string; label: string }> = {
  pending:  { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d', label: 'Pending' },
  overdue:  { bg: '#fef2f2', fg: '#b91c1c', bd: '#fca5a5', label: 'Overdue' },
  received: { bg: '#f0fdf4', fg: '#166534', bd: '#86efac', label: 'Received' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

// UUIDs from the API don't start with 'ref-'; local-only IDs do.
const isApiId = (id: string) => !id.startsWith('ref-');

function apiToOutbound(r: ApiReferral): OutboundReferral {
  const expectedDays = r.expected_days ?? 14;
  let status: OutboundReferral['status'];
  if (r.status === 'accepted' || r.status === 'completed') {
    status = 'received';
  } else {
    const due = new Date(r.created_at).getTime() + expectedDays * 86_400_000;
    status = Date.now() > due ? 'overdue' : 'pending';
  }
  return {
    id:           r.id,
    recipient:    r.referral_to,
    specialty:    r.specialty ?? '',
    reason:       r.reason ?? '',
    dateSent:     r.created_at.slice(0, 10),
    expectedDays,
    status,
  };
}

// localStorage fallback (used when no patientId context)
const lsKey = (pid: string | null, eid: string | null) => `outbound_referrals_${pid ?? 'local'}_${eid ?? 'none'}`;
function lsLoad(pid: string | null, eid: string | null): OutboundReferral[] {
  try { return JSON.parse(localStorage.getItem(lsKey(pid, eid)) ?? '[]') as OutboundReferral[]; } catch { return []; }
}
function lsSave(pid: string | null, eid: string | null, refs: OutboundReferral[]) {
  try { localStorage.setItem(lsKey(pid, eid), JSON.stringify(refs.filter(r => !isApiId(r.id)))); } catch { /* ignore */ }
}
function markOverdue(refs: OutboundReferral[]): OutboundReferral[] {
  const now = Date.now();
  return refs.map(r => {
    if (r.status === 'received') return r;
    const due = new Date(r.dateSent).getTime() + r.expectedDays * 86_400_000;
    return { ...r, status: now > due ? 'overdue' : 'pending' };
  });
}

// Static seed providers shown immediately while API loads
const SEED_PROVIDERS: ReferringProvider[] = [
  { id: 'seed-1',  name: 'Dr. Jeffers',                  email: 'jeffersclinic@gmail.com',               provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-2',  name: 'Dr. Grandison Didier',         email: 'dr.m.m.didiers@gmail.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-3',  name: 'Dr. Merle Clarke',             email: 'kidneycareslu@gmail.com',               provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Nephrology',                    active: true, created_at: '' },
  { id: 'seed-4',  name: 'Dr. Brathwaite',               email: 'davidbrathwaite@doctors.org.uk',        provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-5',  name: 'Dr. Samuel',                   email: 'urolgynaedrs@gmail.com',                provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Urology / Gynaecology',         active: true, created_at: '' },
  { id: 'seed-6',  name: 'Dr. J Bird',                   email: null,                                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-7',  name: 'Dr. L Surage',                 email: 'l.surage@gmail.com',                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-8',  name: 'Dr. R Daniel',                 email: 'drjrdaniel.tapioncardiology@gmail.com', provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Cardiology',                    active: true, created_at: '' },
  { id: 'seed-9',  name: 'Dr. T Remy',                   email: 'remsurg@gmail.com',                     provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-10', name: 'Dr. T Glasgow',                email: 'tglasgow@doctor.com',                   provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-11', name: 'Dr. Gillard',                  email: null,                                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-12', name: 'Dr. Augustin',                 email: 'dr.aaugustin@outlook.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-13', name: 'Dr. Benjamin',                 email: 'drbenjymd@outlook.com',                 provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-14', name: 'Dr. K Cenac',                  email: 'drkcenac@gmail.com',                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Alt: drkcenacoffice@gmail.com', active: true, created_at: '' },
  { id: 'seed-15', name: 'M Care / Member Clinic',       email: 'info@memberclinic.com',                 provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-16', name: 'Dr. Mills',                    email: 'alli.mills.73@gmail.com',               provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-17', name: 'Dr. N Charles',                email: 'laury52@hotmail.com',                   provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-18', name: 'Dr. West Gustave',             email: 'kristinwest1206@gmail.com',             provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-19', name: 'Dr. John Mondesir',            email: 'dr.john.mondesir@gmail.com',            provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-20', name: 'Dr. G Melville',               email: 'drmelvillepractice@hotmail.com',        provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Alt: gavindm@hotmail.com',      active: true, created_at: '' },
  { id: 'seed-21', name: 'Dr. D Louisy',                 email: 'drdlouisy@gmail.com',                   provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-22', name: 'Dr. K Louisy',                 email: 'kemobo.louisy@gmail.com',               provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-23', name: 'Dr. Ndidi Dagbue',             email: 'nadagbue@hotmail.com',                  provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-24', name: 'Dr. Sherwin James',            email: 'sherwinjames@hotmail.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Phone: 285-7766',               active: true, created_at: '' },
  { id: 'seed-25', name: 'Dr. Tanya Beaubrun',           email: 'tanyabeaubrun68@gmail.com',             provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-26', name: 'Dr. A James',                  email: 'drajam009@gmail.com',                   provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-27', name: 'Dr. Garriga',                  email: 'garrigastl2014@gmail.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-28', name: 'Dr. Nathaniel',                email: 'christynats04@gmail.com',               provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-29', name: 'Dr. Flemming',                 email: 'flemingsallapudi@gmail.com',            provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-30', name: 'Dr. Nega',                     email: null,                                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-31', name: 'Dr. Naomi Jude',               email: null,                                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-32', name: 'Dr. Alpha Augustin',           email: null,                                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-33', name: 'Dr. PV St Rose',               email: 'drpeterstroseclinic@gmail.com',         provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-34', name: 'Dr. Asha Martin',              email: 'ashamartin81@gmail.com',                provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-35', name: 'Dr. Volson',                   email: 'drwoc67@hotmail.com',                   provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-36', name: 'Dr. Altenor',                  email: 'caltenor@gmail.com',                    provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-37', name: 'Dr. Suarez',                   email: 'drlilysuarez61@gmail.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-38', name: 'Dr. Celia Mc. Connell Downes', email: 'cggmcconnell@gmail.com',                provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-39', name: 'Dr. Martin Plummer',           email: 'plummerpaediatrics@gmail.com',          provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: 'Paediatrics',                   active: true, created_at: '' },
  { id: 'seed-40', name: 'Dr. Segun Tobias',             email: 'mcareassociates@gmail.com',             provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-41', name: 'Dr. Burt',                     email: 'richard_burt@hotmail.com',              provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
  { id: 'seed-42', name: 'Dr. Seema Gupta',              email: 'seedrgupta@gmail.com',                  provider_type: 'referring_doctor', default_document_type: 'referral_letter', notes: null,                            active: true, created_at: '' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13,
  background: '#fff', color: '#1e293b',
};

const btn = (primary?: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 6,
  border: primary ? 'none' : '1px solid #e2e8f0',
  background: primary ? 'var(--accent, #0d9488)' : '#fff',
  color: primary ? '#fff' : '#374151',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #64748b)', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ── Add provider form ────────────────────────────────────────────────────────

const EMPTY_PROVIDER_FORM = { name: '', email: '', provider_type: 'lab' as ProviderType, default_document_type: 'lab_report' as DocumentType, notes: '' };

function AddProviderForm({ onAdded }: { onAdded: (p: ReferringProvider) => void }) {
  const [form, setForm] = useState(EMPTY_PROVIDER_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleAdd() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch(apiUrl('/api/admin/referring-providers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim() || undefined, provider_type: form.provider_type, default_document_type: form.default_document_type, notes: form.notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onAdded(data.provider as ReferringProvider);
      setForm(EMPTY_PROVIDER_FORM);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add provider.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ padding: '16px 18px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Name</label>
          <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Saint Lucia Diagnostic Imaging" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Email <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
          <input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="reports@example.com" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Provider type</label>
          <select style={inp} value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value as ProviderType }))}>
            {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Default document type</label>
          <select style={inp} value={form.default_document_type} onChange={e => setForm(f => ({ ...f, default_document_type: e.target.value as DocumentType }))}>
            {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
          <input style={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this sender" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
        <button style={btn(true)} onClick={() => void handleAdd()} disabled={saving}>{saving ? 'Adding…' : 'Add provider'}</button>
        {err && <span style={{ fontSize: 12, color: 'var(--urgent, #ef4444)' }}>{err}</span>}
      </div>
    </div>
  );
}

// ── Provider row ─────────────────────────────────────────────────────────────

function ProviderRow({ provider, onChanged, onDeleted }: {
  provider: ReferringProvider;
  onChanged: (p: ReferringProvider) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: provider.name, email: provider.email ?? '', provider_type: provider.provider_type, default_document_type: provider.default_document_type, notes: provider.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function patch(updates: Record<string, unknown>) {
    setSaving(true); setErr('');
    try {
      const res = await fetch(apiUrl(`/api/admin/referring-providers/${provider.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onChanged(data.provider as ReferringProvider);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally { setSaving(false); }
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    if (await patch({ name: form.name.trim(), email: form.email.trim() || null, provider_type: form.provider_type, default_document_type: form.default_document_type, notes: form.notes.trim() || null })) setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove ${provider.name} from the referring providers directory?`)) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch(apiUrl(`/api/admin/referring-providers/${provider.id}`), { method: 'DELETE', headers: await staffAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onDeleted(provider.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete.'); setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
        <td colSpan={6} style={{ padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
            <input style={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email (optional)" />
            <select style={inp} value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value as ProviderType }))}>
              {PROVIDER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select style={inp} value={form.default_document_type} onChange={e => setForm(f => ({ ...f, default_document_type: e.target.value as DocumentType }))}>
              {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input style={{ ...inp, gridColumn: '1 / -1' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <button style={btn(true)} onClick={() => void handleSave()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button style={btn()} onClick={() => { setEditing(false); setErr(''); }} disabled={saving}>Cancel</button>
            {err && <span style={{ fontSize: 12, color: 'var(--urgent, #ef4444)' }}>{err}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
        {provider.name}
        {provider.notes && <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', fontWeight: 400, marginTop: 2 }}>{provider.notes}</div>}
      </td>
      <td style={{ padding: '10px 14px', color: provider.email ? '#374151' : '#9ca3af' }}>{provider.email || '—'}</td>
      <td style={{ padding: '10px 14px', color: '#374151' }}>{PROVIDER_TYPE_LABEL[provider.provider_type] ?? provider.provider_type}</td>
      <td style={{ padding: '10px 14px', color: '#374151' }}>{DOCUMENT_TYPE_LABEL[provider.default_document_type] ?? provider.default_document_type}</td>
      <td style={{ padding: '10px 14px' }}>
        <button style={{ ...btn(provider.active), padding: '4px 10px', fontSize: 11 }} onClick={() => void patch({ active: !provider.active })} disabled={saving}>
          {provider.active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <button style={{ ...btn(), padding: '4px 10px', fontSize: 11, marginRight: 6 }} onClick={() => setEditing(true)} disabled={saving}>Edit</button>
        <button style={{ ...btn(), padding: '4px 10px', fontSize: 11, color: 'var(--urgent, #ef4444)' }} onClick={() => void handleDelete()} disabled={saving}>Delete</button>
        {err && <div style={{ fontSize: 11, color: 'var(--urgent, #ef4444)', marginTop: 4 }}>{err}</div>}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReferringProvidersTab() {
  const { profile } = useAuth();
  const { patientId, encounterId } = useAppContext();

  const [providers, setProviders] = useState<ReferringProvider[]>(SEED_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState('');

  const [outbound, setOutbound] = useState<OutboundReferral[]>([]);
  const [refForm, setRefForm] = useState({ recipient: '', specialty: '', reason: '', expectedDays: 14 });
  const [addingRef, setAddingRef] = useState(false);
  const [savingRef, setSavingRef] = useState(false);
  const [refError, setRefError] = useState('');

  // Load outbound referrals: from API if patientId is available, else localStorage
  const loadOutbound = useCallback(async () => {
    if (!patientId) {
      setOutbound(markOverdue(lsLoad(patientId, encounterId)));
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/referrals/patient/${patientId}`), { headers: await staffAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const apiRefs = (data.referrals as ApiReferral[]).filter(r =>
        !encounterId || !r.encounter_id || r.encounter_id === encounterId,
      );
      setOutbound(apiRefs.map(apiToOutbound));
    } catch {
      setOutbound(markOverdue(lsLoad(patientId, encounterId)));
    }
  }, [patientId, encounterId]);

  useEffect(() => { void loadOutbound(); }, [loadOutbound]);

  async function addReferral() {
    if (!refForm.recipient.trim()) return;
    setSavingRef(true); setRefError('');
    try {
      if (patientId) {
        const res = await fetch(apiUrl('/api/referrals'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
          body: JSON.stringify({
            patientId,
            encounterId: encounterId ?? undefined,
            referralTo: refForm.recipient.trim(),
            specialty: refForm.specialty.trim() || undefined,
            reason: refForm.reason.trim() || undefined,
            expectedDays: refForm.expectedDays,
            urgency: 'routine',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setOutbound(prev => [apiToOutbound(data.referral as ApiReferral), ...prev]);
      } else {
        const ref: OutboundReferral = {
          id: `ref-${Date.now()}`,
          recipient: refForm.recipient.trim(),
          specialty: refForm.specialty.trim(),
          reason: refForm.reason.trim(),
          dateSent: new Date().toISOString().slice(0, 10),
          expectedDays: refForm.expectedDays,
          status: 'pending',
        };
        const next = [ref, ...outbound];
        setOutbound(next);
        lsSave(patientId, encounterId, next);
      }
      setRefForm({ recipient: '', specialty: '', reason: '', expectedDays: 14 });
      setAddingRef(false);
    } catch (e) {
      setRefError(e instanceof Error ? e.message : 'Could not save referral.');
    } finally { setSavingRef(false); }
  }

  async function markReceived(id: string) {
    if (isApiId(id)) {
      try {
        await fetch(apiUrl(`/api/referrals/${id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
          body: JSON.stringify({ status: 'accepted' }),
        });
      } catch { /* optimistic update still applies */ }
    }
    setOutbound(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: 'received' as const } : r);
      if (!isApiId(id)) lsSave(patientId, encounterId, next);
      return next;
    });
  }

  async function removeReferral(id: string) {
    if (isApiId(id)) {
      try {
        await fetch(apiUrl(`/api/referrals/${id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
          body: JSON.stringify({ status: 'declined' }),
        });
      } catch { /* optimistic remove still applies */ }
    }
    setOutbound(prev => {
      const next = prev.filter(r => r.id !== id);
      if (!isApiId(id)) lsSave(patientId, encounterId, next);
      return next;
    });
  }

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true); setProviderError('');
    try {
      const res = await fetch(apiUrl('/api/admin/referring-providers'), { headers: await staffAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const live = (data.providers ?? []) as ReferringProvider[];
      if (live.length > 0) setProviders(live);
    } catch (e) {
      setProviderError(e instanceof Error ? e.message : 'Could not load referring providers.');
    } finally { setLoadingProviders(false); }
  }, []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);

  if (!profile || !['admin', 'doctor', 'nurse', 'front_desk'].includes(profile.role)) {
    return <div style={{ padding: 24, color: 'var(--muted, #64748b)', fontSize: 13 }}>Sign in to access referring providers.</div>;
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Referring Providers</div>
        <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
          Labs, imaging centres, and referring doctors recognised by the email document intake pipeline.
        </div>
      </div>

      {/* ── Outbound referral tracker ── */}
      <Section title="Outbound referrals">
        <div style={{ padding: '12px 16px' }}>
          {outbound.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(['pending', 'overdue', 'received'] as const).map(s => {
                const n = outbound.filter(r => r.status === s).length;
                if (!n) return null;
                const st = STATUS_STYLE[s];
                return (
                  <span key={s} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, fontWeight: 700 }}>
                    {n} {st.label.toLowerCase()}
                  </span>
                );
              })}
            </div>
          )}

          {outbound.length === 0 && !addingRef && (
            <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', fontStyle: 'italic', marginBottom: 10 }}>
              No outbound referrals recorded for this encounter.
            </div>
          )}

          {outbound.map(r => {
            const st = STATUS_STYLE[r.status];
            const due = new Date(new Date(r.dateSent).getTime() + r.expectedDays * 86_400_000);
            return (
              <div key={r.id} style={{
                marginBottom: 8, padding: '9px 12px', borderRadius: 7,
                border: `1px solid ${st.bd}`, borderLeft: `3px solid ${st.fg}`,
                background: r.status === 'received' ? '#f0fdf4' : 'var(--surface, #fff)',
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.recipient}</span>
                    {r.specialty && <span style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>· {r.specialty}</span>}
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: st.bg, color: st.fg, border: `1px solid ${st.bd}`, fontWeight: 700 }}>{st.label}</span>
                  </div>
                  {r.reason && <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginBottom: 2 }}>{r.reason}</div>}
                  <div style={{ fontSize: 11, color: 'var(--faint, #94a3b8)', fontVariantNumeric: 'tabular-nums' }}>
                    Sent {r.dateSent} · Expected by {due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {r.status !== 'received' && (
                    <button onClick={() => void markReceived(r.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      ✓ Received
                    </button>
                  )}
                  <button onClick={() => void removeReferral(r.id)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          {addingRef ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 3 }}>Recipient *</label>
                  <input value={refForm.recipient} onChange={e => setRefForm(f => ({ ...f, recipient: e.target.value }))} placeholder="Dr. Smith / Radiology Dept" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 3 }}>Specialty</label>
                  <input value={refForm.specialty} onChange={e => setRefForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Cardiology, Oncology…" style={inp} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 3 }}>Reason</label>
                  <input value={refForm.reason} onChange={e => setRefForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Further workup of incidental finding" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 3 }}>Expected response (days)</label>
                  <input type="number" min={1} max={365} value={refForm.expectedDays} onChange={e => setRefForm(f => ({ ...f, expectedDays: Number(e.target.value) }))} style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => void addReferral()} disabled={!refForm.recipient.trim() || savingRef} style={btn(true)}>
                  {savingRef ? 'Saving…' : 'Log referral'}
                </button>
                <button onClick={() => { setAddingRef(false); setRefError(''); }} style={btn()}>Cancel</button>
                {refError && <span style={{ fontSize: 12, color: 'var(--urgent, #ef4444)' }}>{refError}</span>}
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingRef(true)} style={{ ...btn(), marginTop: 4, fontSize: 12 }}>
              + Log outbound referral
            </button>
          )}
        </div>
      </Section>

      <Section title="Add Provider">
        <AddProviderForm onAdded={p => setProviders(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))} />
      </Section>

      <Section title="Directory">
        {loadingProviders && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted, #64748b)', borderBottom: '1px solid #f1f5f9' }}>
            Syncing with server…
          </div>
        )}
        {!loadingProviders && providerError && (
          <div style={{ padding: '8px 14px', fontSize: 11, borderBottom: '1px solid #fef2f2', background: '#fff5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#ef4444' }}>Could not reach API — showing local directory.</span>
            <button type="button" onClick={() => void loadProviders()} style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>↻ Retry</button>
          </div>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Name', 'Email', 'Type', 'Default Document Type', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted, #64748b)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <ProviderRow
                key={p.id}
                provider={p}
                onChanged={updated => setProviders(prev => prev.map(x => x.id === updated.id ? updated : x))}
                onDeleted={id => setProviders(prev => prev.filter(x => x.id !== id))}
              />
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
