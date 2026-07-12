import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getApiOrigin } from '@/lib/api-origin';
import AIProviderSettings from '@/components/AIProviderSettings';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

type Role = 'front_desk' | 'nurse' | 'doctor' | 'admin';

const ROLE_LABELS: Record<Role, string> = {
  front_desk: 'Front Desk',
  nurse:      'Nurse',
  doctor:     'Doctor',
  admin:      'Admin',
};

const ROLE_ORDER: Role[] = ['front_desk', 'nurse', 'doctor', 'admin'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Profile section ─────────────────────────────────────────────────────────

function ProfileSection() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!profile) return;
    const sb = getSupabase();
    if (!sb) return;
    setSaving(true); setErr('');
    const { error } = await sb.from('user_profiles').update({ full_name: name.trim() }).eq('id', profile.id);
    setSaving(false);
    if (error) { setErr(error.message); } else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  return (
    <Section title="My Profile">
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted, #64748b)', display: 'block', marginBottom: 4 }}>Role</label>
            <input style={{ ...inp, background: '#f8fafc', color: 'var(--muted, #64748b)' }} value={ROLE_LABELS[(profile?.role as Role) ?? 'front_desk']} readOnly />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
          <button style={btn(true)} onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--accent, #10b981)' }}>✓ Saved</span>}
          {err && <span style={{ fontSize: 12, color: 'var(--urgent, #ef4444)' }}>{err}</span>}
        </div>
      </div>
    </Section>
  );
}

// ─── User management ─────────────────────────────────────────────────────────

function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('user_profiles').select('id, full_name, role, created_at').order('created_at');
    setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }

  async function changeRole(userId: string, newRole: Role) {
    const sb = getSupabase();
    if (!sb) return;
    setSavingId(userId);
    await sb.from('user_profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setSavingId(null);
  }

  if (profile?.role !== 'admin') return null;

  return (
    <Section title="User Management">
      {loading ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--muted, #64748b)' }}>Loading users…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Name', 'Role', ''].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted, #64748b)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : undefined }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                  {u.full_name ?? '—'}
                  {u.id === profile?.id && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent, #10b981)', fontWeight: 700 }}>YOU</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <select
                    value={u.role}
                    disabled={u.id === profile?.id || savingId === u.id}
                    onChange={e => void changeRole(u.id, e.target.value as Role)}
                    style={{ ...inp, width: 'auto', padding: '4px 8px', cursor: u.id === profile?.id ? 'default' : 'pointer' }}
                  >
                    {ROLE_ORDER.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted, #64748b)' }}>
                  {savingId === u.id ? 'Saving…' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

// ─── Practice info ────────────────────────────────────────────────────────────

function PracticeInfo() {
  const rows = [
    ['Practice',  'Amise Medical Services'],
    ['Physician', 'Dr Dawit Daniel Kabiye, MD, DM'],
    ['Specialty', 'General & Endoscopic Surgery'],
    ['Timezone',  'Eastern Caribbean Time (UTC−4, America/St_Lucia)'],
    ['Sites',     'Rodney Bay (Providence Building) · Tapion Hospital (ERCP / Surgery)'],
    ['Emergency', '758-284-0557 / 758-720-7111'],
  ];

  return (
    <Section title="Practice Information">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={label} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : undefined }}>
              <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--muted, #64748b)', whiteSpace: 'nowrap', width: 160 }}>{label}</td>
              <td style={{ padding: '10px 14px', color: '#1e293b' }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Notification preferences ────────────────────────────────────────────────

function NotificationPrefs() {
  const [prefs, setPrefs] = useState({
    emailOnEscalation:    true,
    emailDailySummary:    true,
    smsUrgentOnly:        false,
    smsAllBookings:       false,
    reminders48h:         true,
    reminders24h:         true,
    reminders2h:          true,
  });
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof typeof prefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  }

  function save() {
    // Persisted in localStorage (Supabase settings table in full implementation)
    localStorage.setItem('amise-notification-prefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  useEffect(() => {
    const stored = localStorage.getItem('amise-notification-prefs');
    if (stored) {
      try { setPrefs(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const rows: Array<[keyof typeof prefs, string, string]> = [
    ['emailOnEscalation', 'Email on escalation',      'Immediate email to doctor on EMERGENT / URGENT triage'],
    ['emailDailySummary', 'Daily summary email',       'Morning summary of pending bookings and overnight intakes'],
    ['smsUrgentOnly',     'SMS — urgent alerts only',  'SMS for EMERGENT/URGENT escalations only'],
    ['smsAllBookings',    'SMS — all new bookings',    'SMS notification on every new booking request'],
    ['reminders48h',      'Appointment reminder 48 h', 'Send SMS/WhatsApp reminder 48 hours before appointment'],
    ['reminders24h',      'Appointment reminder 24 h', 'Send email reminder 24 hours before appointment'],
    ['reminders2h',       'Appointment reminder 2 h',  'Send SMS reminder 2 hours before appointment'],
  ];

  return (
    <Section title="Notification Preferences">
      <div style={{ padding: '4px 0' }}>
        {rows.map(([key, label, hint]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted, #64748b)', marginTop: 1 }}>{hint}</div>
            </div>
            <button
              onClick={() => toggle(key)}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: prefs[key] ? 'var(--accent, #0d9488)' : '#cbd5e1',
                position: 'relative', flexShrink: 0,
              }}
              aria-label={`Toggle ${label}`}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: prefs[key] ? 20 : 4,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.15s',
              }} />
            </button>
          </div>
        ))}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button style={btn(true)} onClick={save}>Save preferences</button>
          {saved && <span style={{ fontSize: 12, color: 'var(--accent, #10b981)' }}>✓ Saved</span>}
        </div>
      </div>
    </Section>
  );
}

// ─── API connectivity ────────────────────────────────────────────────────────

function ApiStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const apiOrigin = getApiOrigin();

  async function check() {
    setStatus('checking'); setErr('');
    const t0 = performance.now();
    try {
      const r = await fetch(`${apiOrigin}/api/healthz`);
      const ms = Math.round(performance.now() - t0);
      setLatency(ms);
      if (r.ok) { setStatus('ok'); } else { setStatus('error'); setErr(`HTTP ${r.status}`); }
    } catch (e) {
      setLatency(null);
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'Network error');
    }
  }

  useEffect(() => { void check(); }, []);

  const dot = status === 'ok' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b';
  const label = status === 'ok' ? 'Connected' : status === 'error' ? 'Unreachable' : 'Checking…';

  return (
    <Section title="API Server">
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {apiOrigin || '(same origin)'}
            {latency !== null && ` · ${latency} ms`}
          </div>
          {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{err}</div>}
        </div>
        <button style={btn()} onClick={() => void check()}>Test</button>
      </div>
    </Section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsTab() {
  const { profile } = useAuth();

  if (!profile || !['admin', 'doctor', 'nurse', 'front_desk'].includes(profile.role)) {
    return (
      <div style={{ padding: 24, color: 'var(--muted, #64748b)', fontSize: 13 }}>
        Sign in to access settings.
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Settings</div>
        <div style={{ fontSize: 12, color: 'var(--muted, #64748b)', marginTop: 2 }}>
          Amise Medical Services · {ROLE_LABELS[(profile.role as Role)] ?? profile.role}
        </div>
      </div>

      <AIProviderSettings />
      <ApiStatus />
      <ProfileSection />
      <UserManagement />
      <NotificationPrefs />
      <PracticeInfo />
    </div>
  );
}
