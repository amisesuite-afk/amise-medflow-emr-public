import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

const API_ORIGIN = getApiOrigin();

type NotifyTemplate = 'appointment_reminder' | 'result_ready' | 'postop_checkin' | 'general';

interface PatientNotifyModalProps {
  open: boolean;
  onClose: () => void;
  status: { ok: boolean; msg: string } | null;
  setStatus: React.Dispatch<React.SetStateAction<{ ok: boolean; msg: string } | null>>;
}

/** Modal for sending a patient SMS/WhatsApp notification (result ready, post-op
 * check-in, appointment reminder, or a custom message). Triggered from the
 * sticky patient-context banner's "Notify" button. */
export default function PatientNotifyModal({ open, onClose, status, setStatus }: PatientNotifyModalProps) {
  const { patientId, patientName } = useAppContext();
  const [template, setTemplate] = useState<NotifyTemplate>('result_ready');
  const [data, setData] = useState({ day: '', date: '', time: '', location: 'Rodney Bay', message: '' });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function send() {
    if (!patientId || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const headers = await staffAuthHeaders();
      const body: Record<string, unknown> = { template };
      if (template === 'appointment_reminder') {
        body.data = { day: data.day, date: data.date, time: data.time, location: data.location };
      } else if (template === 'general') {
        body.data = { message: data.message };
      }
      const res = await fetch(`${API_ORIGIN}/api/notify/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { action?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const label = json.action === 'skipped' ? 'Message queued (dry-run mode)' : 'Message sent';
      setStatus({ ok: true, msg: label });
      setTimeout(() => { onClose(); setStatus(null); }, 1800);
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : 'Send failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send patient notification"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg, #0f172a)', border: '1px solid var(--line, #1e293b)',
        borderRadius: 12, padding: '20px 22px', width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink, #f1f5f9)' }}>
            ✉ Notify {patientName ? patientName.split(' ')[0] : 'Patient'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#64748b', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Template picker */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {([
            { id: 'result_ready',        label: 'Result ready' },
            { id: 'postop_checkin',      label: 'Post-op check-in' },
            { id: 'appointment_reminder',label: 'Appointment reminder' },
            { id: 'general',             label: 'Custom message' },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              style={{
                padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: `1px solid ${template === t.id ? '#3b82f6' : '#334155'}`,
                background: template === t.id ? '#1d4ed8' : 'transparent',
                color: template === t.id ? '#fff' : '#94a3b8',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Conditional fields */}
        {template === 'appointment_reminder' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {(['day', 'date', 'time', 'location'] as const).map(field => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{field}</span>
                <input
                  type="text"
                  value={data[field]}
                  placeholder={field === 'day' ? 'e.g. Tuesday' : field === 'date' ? 'e.g. 5 Aug 2026' : field === 'time' ? 'e.g. 10:00 AM' : 'e.g. Rodney Bay'}
                  onChange={e => setData(d => ({ ...d, [field]: e.target.value }))}
                  style={{
                    padding: '6px 8px', borderRadius: 6, fontSize: 12,
                    border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
                    outline: 'none',
                  }}
                />
              </label>
            ))}
          </div>
        )}

        {template === 'general' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Message</span>
              <textarea
                value={data.message}
                onChange={e => setData(d => ({ ...d, message: e.target.value }))}
                rows={3}
                placeholder="Type the message to send to the patient…"
                style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 12, resize: 'vertical',
                  border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </label>
          </div>
        )}

        {(template === 'result_ready' || template === 'postop_checkin') && (
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
            A pre-written message will be sent to the patient's phone on file.
          </p>
        )}

        {/* Status feedback */}
        {status && (
          <div style={{
            padding: '7px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            marginBottom: 12,
            background: status.ok ? '#052e16' : '#450a0a',
            color: status.ok ? '#4ade80' : '#f87171',
            border: `1px solid ${status.ok ? '#166534' : '#991b1b'}`,
          }}>
            {status.ok ? '✓ ' : '✕ '}{status.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
              border: 'none', background: busy ? '#1e3a8a' : '#1d4ed8',
              color: busy ? '#93c5fd' : '#fff', cursor: busy ? 'default' : 'pointer',
              transition: 'all 0.15s',
            }}
          >{busy ? 'Sending…' : 'Send SMS'}</button>
        </div>
      </div>
    </div>
  );
}
