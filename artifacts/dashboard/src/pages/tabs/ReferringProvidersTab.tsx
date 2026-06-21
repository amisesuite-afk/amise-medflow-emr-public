import { useState, useEffect, useCallback } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  { value: 'lab_report',       label: 'Lab Report' },
  { value: 'imaging_report',   label: 'Imaging Report' },
  { value: 'referral_letter',  label: 'Referral Letter' },
  { value: 'consent_form',     label: 'Consent Form' },
  { value: 'surgical_report',  label: 'Surgical Report' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'prescription',     label: 'Prescription' },
  { value: 'insurance_form',   label: 'Insurance Form' },
  { value: 'other',            label: 'Other' },
];

const PROVIDER_TYPE_LABEL: Record<ProviderType, string> = Object.fromEntries(
  PROVIDER_TYPES.map(t => [t.value, t.label]),
) as Record<ProviderType, string>;

const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = Object.fromEntries(
  DOCUMENT_TYPES.map(t => [t.value, t.label]),
) as Record<DocumentType, string>;

// ── Style helpers ─────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
  color: '#1e293b',
};

const btn = (primary?: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 6,
  border: primary ? 'none' : '1px solid #e2e8f0',
  background: primary ? 'var(--accent, #0d9488)' : '#fff',
  color: primary ? '#fff' : '#374151',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
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

const EMPTY_FORM = {
  name: '',
  email: '',
  provider_type: 'lab' as ProviderType,
  default_document_type: 'lab_report' as DocumentType,
  notes: '',
};

// ── Add provider form ────────────────────────────────────────────────────────

function AddProviderForm({ onAdded }: { onAdded: (provider: ReferringProvider) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleAdd() {
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(apiUrl('/api/admin/referring-providers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          provider_type: form.provider_type,
          default_document_type: form.default_document_type,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onAdded(data.provider as ReferringProvider);
      setForm(EMPTY_FORM);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add provider.');
    } finally {
      setSaving(false);
    }
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
        <button style={btn(true)} onClick={() => void handleAdd()} disabled={saving}>
          {saving ? 'Adding…' : 'Add provider'}
        </button>
        {err && <span style={{ fontSize: 12, color: 'var(--urgent, #ef4444)' }}>{err}</span>}
      </div>
    </div>
  );
}

// ── Provider row (inline edit) ───────────────────────────────────────────────

function ProviderRow({ provider, onChanged, onDeleted }: {
  provider: ReferringProvider;
  onChanged: (provider: ReferringProvider) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: provider.name,
    email: provider.email ?? '',
    provider_type: provider.provider_type,
    default_document_type: provider.default_document_type,
    notes: provider.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function patch(updates: Record<string, unknown>) {
    setSaving(true);
    setErr('');
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
      setErr(e instanceof Error ? e.message : 'Could not save changes.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    const ok = await patch({
      name: form.name.trim(),
      email: form.email.trim() || null,
      provider_type: form.provider_type,
      default_document_type: form.default_document_type,
      notes: form.notes.trim() || null,
    });
    if (ok) setEditing(false);
  }

  async function toggleActive() {
    await patch({ active: !provider.active });
  }

  async function handleDelete() {
    if (!confirm(`Remove ${provider.name} from the referring providers directory?`)) return;
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(apiUrl(`/api/admin/referring-providers/${provider.id}`), {
        method: 'DELETE',
        headers: await staffAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      onDeleted(provider.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete provider.');
      setSaving(false);
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
        <button
          style={{ ...btn(provider.active), padding: '4px 10px', fontSize: 11 }}
          onClick={() => void toggleActive()}
          disabled={saving}
        >
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

// ── Main component ───────────────────────────────────────────────────────────

export default function ReferringProvidersTab() {
  const { profile } = useAuth();
  const [providers, setProviders] = useState<ReferringProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/admin/referring-providers'), {
        headers: await staffAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setProviders((data.providers ?? []) as ReferringProvider[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load referring providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile || !['admin', 'doctor', 'nurse', 'front_desk'].includes(profile.role)) {
    return (
      <div style={{ padding: 24, color: 'var(--muted, #64748b)', fontSize: 13 }}>
        Sign in to access referring providers.
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Referring Providers</div>
        <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
          Labs, imaging centres, and referring doctors recognised by the email document intake pipeline.
        </div>
      </div>

      <Section title="Add Provider">
        <AddProviderForm onAdded={p => setProviders(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))} />
      </Section>

      <Section title="Directory">
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--muted, #64748b)' }}>Loading providers…</div>
        ) : error ? (
          <div style={{ padding: 16, fontSize: 12 }}>
            <div style={{ color: 'var(--urgent, #ef4444)', marginBottom: 6 }}>{error}</div>
            <button
              type="button"
              onClick={() => void load()}
              style={{ fontSize: 12, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >↻ Retry</button>
          </div>
        ) : providers.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--muted, #64748b)' }}>No referring providers yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Name', 'Email', 'Type', 'Default Document Type', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted, #64748b)' }}>
                    {h}
                  </th>
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
        )}
      </Section>
    </div>
  );
}
