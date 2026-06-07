import { useState, useEffect, useCallback } from 'react';

interface ConsultRequest {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  visit_type: string | null;
  description: string | null;
  created_at: string;
  status: 'new' | 'contacted' | 'registered';
  staff_notes: string | null;
}

const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  new:        { label: 'New',        bg: '#fefce8', color: '#a16207', border: '#fde047' },
  contacted:  { label: 'Contacted',  bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  registered: { label: 'Registered', bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
};

const VISIT_LABELS: Record<string, string> = {
  surgical:  'Surgical Consultation',
  endoscopy: 'Endoscopy / Scope',
  followup:  'Follow-up',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.new;
  return (
    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
}

export default function ConsultationRequestsView() {
  const [requests, setRequests]   = useState<ConsultRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<ConsultRequest | null>(null);
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('Saved');
  const [saveErr, setSaveErr]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiUrl('/api/patient/consultation-requests'));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { requests: ConsultRequest[] };
      setRequests(d.requests ?? []);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    setNotes(selected?.staff_notes ?? '');
    setSaveOk(false);
    setSaveErr(null);
  }, [selected?.id]);

  async function patch(id: string, body: Record<string, unknown>) {
    setSaving(true);
    setSaveOk(false);
    setSaveErr(null);
    try {
      const r = await fetch(apiUrl(`/api/patient/consultation-requests/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const d = await r.json().catch(() => ({})) as { invited?: boolean };
      setSaveMsg(
        body.status === 'registered' && d.invited
          ? '✓ Patient record created and portal invite sent'
          : '✓ Saved'
      );
      setSaveOk(true);
      const merged = { ...body };
      setRequests(prev => prev.map(req => req.id === id ? { ...req, ...merged } as ConsultRequest : req));
      setSelected(prev => prev?.id === id ? { ...prev, ...merged } as ConsultRequest : prev);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (e) {
      setSaveErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  const newCount = requests.filter(r => r.status === 'new').length;

  if (loading) {
    return <div style={{ padding: '40px 24px', color: '#6b7280', textAlign: 'center' }}>Loading consultation requests…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>
          Could not load requests: {error}
          <button onClick={() => void load()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 0 }}>

      {/* Left — list */}
      <div style={{
        width: selected ? 340 : '100%',
        maxWidth: selected ? 340 : undefined,
        flexShrink: 0,
        borderRight: selected ? '1px solid #e5e7eb' : 'none',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Public Consultation Requests</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {newCount > 0
                ? <span style={{ color: '#b45309', fontWeight: 600 }}>{newCount} new request{newCount !== 1 ? 's' : ''} — contact within 1 working day</span>
                : 'All requests actioned'}
            </div>
          </div>
          <button onClick={() => void load()} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '40px 20px', color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
            No public requests yet.<br />
            <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>Submitted via the patient portal "Request a Consultation" page.</span>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            {requests.map(req => {
              const isSelected = selected?.id === req.id;
              const isNew = req.status === 'new';
              return (
                <button
                  key={req.id}
                  onClick={() => setSelected(isSelected ? null : req)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 20px',
                    borderBottom: '1px solid #f3f4f6',
                    background: isSelected ? '#f0fdf4' : '#fff',
                    border: 'none', cursor: 'pointer',
                    borderLeft: isSelected ? '3px solid #16a34a' : isNew ? '3px solid #f59e0b' : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.full_name}
                    </span>
                    <StatusPill status={req.status} />
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>
                    {VISIT_LABELS[req.visit_type ?? ''] ?? req.visit_type ?? 'General enquiry'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#9ca3af' }}>
                    <span>{timeAgo(req.created_at)}</span>
                    {req.phone && <span style={{ marginLeft: 'auto' }}>{req.phone}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right — detail */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{selected.full_name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusPill status={selected.status} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>Submitted {timeAgo(selected.created_at)}</span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}>
              ✕ Close
            </button>
          </div>

          {/* Contact info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Phone',      value: selected.phone },
              { label: 'Email',      value: selected.email },
              { label: 'Visit type', value: VISIT_LABELS[selected.visit_type ?? ''] ?? selected.visit_type ?? 'General enquiry' },
              { label: 'Request ID', value: selected.id.slice(0, 8) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: value ? '#111827' : '#9ca3af' }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Quick contact */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {selected.phone && (
              <a href={`tel:${selected.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                📞 Call
              </a>
            )}
            {selected.phone && (
              <a href={`https://wa.me/${selected.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#f0fdf9', border: '1px solid #99f6e4', color: '#0f766e', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                WhatsApp
              </a>
            )}
            {selected.email && (
              <a href={`mailto:${selected.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}>
                ✉ Email
              </a>
            )}
          </div>

          {/* Patient message */}
          {selected.description && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Patient's message</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{selected.description}</div>
            </div>
          )}

          {/* Staff notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Staff notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Call notes, slot offered, converted to booking (ID), referral details…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {saveOk && (
            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
              {saveMsg}
            </div>
          )}
          {saveErr && (
            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
              {saveErr}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {selected.status === 'new' && (
              <button
                onClick={() => void patch(selected.id, { status: 'contacted', staff_notes: notes })}
                disabled={saving}
                style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '…' : 'Mark Contacted'}
              </button>
            )}
            {selected.status !== 'registered' && (
              <button
                onClick={() => void patch(selected.id, { status: 'registered', staff_notes: notes })}
                disabled={saving}
                style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '…' : 'Mark Registered'}
              </button>
            )}
            <button
              onClick={() => void patch(selected.id, { staff_notes: notes })}
              disabled={saving}
              style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '…' : 'Save Notes'}
            </button>
          </div>

          <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6 }}>
            To book a slot: use the <strong>Booking Requests</strong> tab → New Request, then paste this patient's details.
          </p>
        </div>
      )}
    </div>
  );
}
