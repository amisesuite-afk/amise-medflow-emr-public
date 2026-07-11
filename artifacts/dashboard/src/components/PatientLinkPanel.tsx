/**
 * PatientLinkPanel — generates and sends the patient pre-visit link.
 *
 * Shown in the CheckIn tab (encounter-open step) when no pre-visit
 * submission exists yet. Staff clicks "Generate & Send Link" — the API
 * creates a previsit_submissions row, returns the patient token, and
 * optionally fires an SMS to the patient's phone number.
 */
import { useState } from 'react';
import { staffAuthHeaders } from '@/lib/staff-auth';

interface Props {
  patientId: string;
  patientPhone?: string;
  appointmentId?: string;
  onLinkGenerated?: () => void;
}

interface LinkResult {
  token: string;
  link: string;
  smsSent: boolean;
}

export default function PatientLinkPanel({ patientId, patientPhone, appointmentId, onLinkGenerated }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendSms, setSendSms] = useState(!!patientPhone);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const headers = await staffAuthHeaders();
      const r = await fetch('/api/previsit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          patientId,
          appointmentId,
          sendSms: sendSms && !!patientPhone,
          patientPhone,
        }),
      });
      const data = await r.json() as { success?: boolean; token?: string; link?: string; smsSent?: boolean; error?: string };
      if (!r.ok || !data.link) throw new Error(data.error ?? 'Failed to generate link');
      setResult({ token: data.token!, link: data.link!, smsSent: data.smsSent ?? false });
      onLinkGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result?.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (result) {
    return (
      <div style={{
        background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>Pre-visit link ready</div>
            {result.smsSent && (
              <div style={{ fontSize: 11, color: '#15803d' }}>SMS sent to patient ✓</div>
            )}
          </div>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 11, background: '#fff', border: '1px solid #d1fae5',
          borderRadius: 6, padding: '8px 10px', color: '#374151', wordBreak: 'break-all',
          lineHeight: 1.5,
        }}>
          {result.link}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void copy()}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #16a34a',
              background: copied ? '#16a34a' : '#fff', color: copied ? '#fff' : '#16a34a',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={() => { setResult(null); }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer',
            }}
          >
            Generate new
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#fafafa', border: '1.5px dashed #d1d5db', borderRadius: 10,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📋</span> Send pre-visit questionnaire to patient
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
        Patient completes CC, HPI, PMH, medications, allergies, ROS, and photos on their own device before the appointment.
      </div>

      {patientPhone && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sendSms}
            onChange={e => setSendSms(e.target.checked)}
            style={{ width: 15, height: 15 }}
          />
          Send SMS to {patientPhone}
        </label>
      )}

      {error && (
        <div style={{ fontSize: 11, color: '#dc2626', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px' }}>
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        style={{
          padding: '8px 18px', borderRadius: 7, border: 'none', cursor: loading ? 'wait' : 'pointer',
          background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, alignSelf: 'flex-start',
        }}
      >
        {loading ? 'Generating…' : '🔗 Generate & send link'}
      </button>
    </div>
  );
}
