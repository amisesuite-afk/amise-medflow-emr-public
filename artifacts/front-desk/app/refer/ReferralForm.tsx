'use client';
import { useState } from 'react';
import { APPOINTMENT_TYPES } from '@/lib/scheduling';
import '../subpage-mobile.css';

type Priority = 'routine' | 'priority' | 'urgent';

interface FormState {
  // Referring provider
  referrerName: string;
  referrerPractice: string;
  referrerPhone: string;
  referrerEmail: string;
  referrerRegNumber: string;
  // Patient
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientNic: string;
  // Referral
  appointmentType: string;
  priority: Priority;
  clinicalReason: string;
  investigations: string;
  medications: string;
  patientInformed: boolean;
  providerConfirm: boolean;
}

const INITIAL: FormState = {
  referrerName: '',
  referrerPractice: '',
  referrerPhone: '',
  referrerEmail: '',
  referrerRegNumber: '',
  patientName: '',
  patientDob: '',
  patientPhone: '',
  patientEmail: '',
  patientNic: '',
  appointmentType: 'new_consult',
  priority: 'routine',
  clinicalReason: '',
  investigations: '',
  medications: '',
  patientInformed: false,
  providerConfirm: false,
};

const PRIORITY_OPTIONS: { value: Priority; label: string; description: string; color: string }[] = [
  { value: 'routine',  label: 'Routine',  description: 'Within 3 weeks',  color: '#0d9488' },
  { value: 'priority', label: 'Priority', description: 'Within 7 days',   color: '#f59e0b' },
  { value: 'urgent',   label: 'Urgent',   description: 'Within 48 hours', color: '#e63946' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', borderRadius: 7,
  background: '#f8fafc', border: '1.5px solid #d1e8e5',
  color: '#0f172a', fontSize: 14, fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: '#374151', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 16,
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: '#0d9488',
  textTransform: 'uppercase', letterSpacing: '0.1em',
  marginBottom: 16, marginTop: 28,
  paddingBottom: 8, borderBottom: '1.5px solid #e2eeed',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReferralForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ referralId: string; bookingId: string; message: string } | null>(null);
  const [error, setError] = useState('');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const canSubmit =
    form.referrerName.trim().length >= 2 &&
    form.referrerPractice.trim().length >= 2 &&
    form.referrerPhone.trim().length >= 7 &&
    form.referrerEmail.trim().includes('@') &&
    form.patientName.trim().length >= 2 &&
    form.patientDob.trim().length > 0 &&
    form.patientPhone.trim().length >= 7 &&
    form.clinicalReason.trim().length >= 10 &&
    form.patientInformed &&
    form.providerConfirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/referral/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrerName:     form.referrerName.trim(),
          referrerPractice: form.referrerPractice.trim(),
          referrerPhone:    form.referrerPhone.trim(),
          referrerEmail:    form.referrerEmail.trim(),
          referrerRegNumber: form.referrerRegNumber.trim() || undefined,
          patientName:      form.patientName.trim(),
          patientDob:       form.patientDob,
          patientPhone:     form.patientPhone.trim(),
          patientEmail:     form.patientEmail.trim() || undefined,
          patientNic:       form.patientNic.trim() || undefined,
          appointmentType:  form.appointmentType,
          priority:         form.priority,
          clinicalReason:   form.clinicalReason.trim(),
          investigations:   form.investigations.trim() || undefined,
          medications:      form.medications.trim() || undefined,
        }),
      });
      const data = await res.json() as { success?: boolean; referralId?: string; bookingId?: string; message?: string; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Submission failed. Please try again or call us directly.');
      } else {
        setSuccess({
          referralId: data.referralId ?? '',
          bookingId:  data.bookingId ?? '',
          message:    data.message ?? 'Referral received.',
        });
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success State ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: '48px 24px' }}>
        <div style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
            Referral Submitted
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 15, color: '#475569', lineHeight: 1.75 }}>
            {success.message}
          </p>
          <div style={{
            padding: '20px 24px', background: '#fff',
            border: '1.5px solid #d1e8e5', borderRadius: 12,
            marginBottom: 28, textAlign: 'left',
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Referral Reference
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 110 }}>Referral ID</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{success.referralId}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 110 }}>Booking ID</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{success.bookingId}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 18px', background: '#fff7ed', border: '1px solid #f97316', borderRadius: 8, fontSize: 13, color: '#7c2d12', lineHeight: 1.7, marginBottom: 28, textAlign: 'left' }}>
            Please retain the referral ID above for your records. Our team will contact the patient within the
            stated priority timeframe. For urgent referrals, you may also call us on <strong>758-284-0557</strong>.
          </div>
          <button
            onClick={() => { setSuccess(null); setForm(INITIAL); }}
            style={{ padding: '11px 28px', borderRadius: 8, border: '1.5px solid #d1e8e5', background: '#fff', color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Submit another referral
          </button>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', padding: '48px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <a href="/" style={{ display: 'inline-block', fontSize: 13, color: '#0d9488', fontWeight: 600, textDecoration: 'none', marginBottom: 16 }}>
            ← Back to Home
          </a>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
            Refer a Patient to Amise Medical Services
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            General &amp; Endoscopic Surgery — led by Dr Dawit Daniel Kabiye, MD, DM
          </p>
        </div>

        {/* Info notes */}
        <div style={{ padding: '14px 18px', background: '#fff7ed', border: '1px solid #f97316', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#7c2d12', lineHeight: 1.7 }}>
          <strong>For urgent referrals requiring same-day review</strong>, please also call{' '}
          <strong>758-284-0557</strong> directly in addition to submitting this form.
        </div>
        <div style={{ padding: '12px 16px', background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 8, marginBottom: 28, fontSize: 12, color: '#065f46', lineHeight: 1.7 }}>
          Referrals are reviewed by our clinical team within one working day.
          You will receive a confirmation with the proposed appointment details.
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="refer-form-card" style={{ background: '#fff', border: '1.5px solid #e2eeed', borderRadius: 14, padding: '32px 32px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>

            {/* ── Referring Provider ── */}
            <div style={sectionHeadStyle}>Referring Provider</div>

            <div className="refer-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Doctor&apos;s full name *</label>
                <input
                  type="text" value={form.referrerName} required
                  onChange={e => set('referrerName', e.target.value)}
                  placeholder="Dr …"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Practice / Hospital *</label>
                <input
                  type="text" value={form.referrerPractice} required
                  onChange={e => set('referrerPractice', e.target.value)}
                  placeholder="Practice or hospital name"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="refer-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Contact phone *</label>
                <input
                  type="tel" value={form.referrerPhone} required
                  onChange={e => set('referrerPhone', e.target.value)}
                  placeholder="+1 758 …"
                  autoComplete="tel"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Contact email *</label>
                <input
                  type="email" value={form.referrerEmail} required
                  onChange={e => set('referrerEmail', e.target.value)}
                  placeholder="doctor@practice.com"
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>GMC / Medical registration number <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <input
                type="text" value={form.referrerRegNumber}
                onChange={e => set('referrerRegNumber', e.target.value)}
                placeholder="Registration / licence number"
                className="refer-reg-input"
                style={{ ...inputStyle, maxWidth: 300 }}
              />
            </div>

            {/* ── Patient ── */}
            <div style={sectionHeadStyle}>Patient Information</div>

            <div className="refer-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Patient full name *</label>
                <input
                  type="text" value={form.patientName} required
                  onChange={e => set('patientName', e.target.value)}
                  placeholder="First and last name"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Date of birth *</label>
                <input
                  type="date" value={form.patientDob} required
                  onChange={e => set('patientDob', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="refer-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Patient contact phone *</label>
                <input
                  type="tel" value={form.patientPhone} required
                  onChange={e => set('patientPhone', e.target.value)}
                  placeholder="+1 758 …"
                  style={inputStyle}
                />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Patient email <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <input
                  type="email" value={form.patientEmail}
                  onChange={e => set('patientEmail', e.target.value)}
                  placeholder="patient@example.com"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>NIC / Passport number <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — for identification)</span></label>
              <input
                type="text" value={form.patientNic}
                onChange={e => set('patientNic', e.target.value)}
                placeholder="National ID or passport number"
                className="refer-nic-input"
                style={{ ...inputStyle, maxWidth: 340 }}
              />
            </div>

            {/* ── Referral Details ── */}
            <div style={sectionHeadStyle}>Referral Details</div>

            <div className="refer-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Appointment type</label>
                <select
                  value={form.appointmentType}
                  onChange={e => set('appointmentType', e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  {Object.entries(APPOINTMENT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => set('priority', e.target.value as Priority)}
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  {PRIORITY_OPTIONS.map(({ value, label, description }) => (
                    <option key={value} value={value}>{label} — {description}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priority indicator */}
            {(() => {
              const p = PRIORITY_OPTIONS.find(o => o.value === form.priority)!;
              return (
                <div style={{
                  padding: '10px 16px', borderRadius: 8, marginBottom: 20,
                  background: `${p.color}18`, border: `1.5px solid ${p.color}44`,
                  fontSize: 13, color: p.color, fontWeight: 600,
                }}>
                  {form.priority === 'urgent' ? '⚠️' : form.priority === 'priority' ? '🔶' : '🟢'}{' '}
                  {p.label} referral — patient to be seen {p.description.toLowerCase()}.
                  {form.priority === 'urgent' && ' Please also call 758-284-0557 directly.'}
                </div>
              );
            })()}

            <div style={fieldStyle}>
              <label style={labelStyle}>
                Clinical reason / presenting complaint *{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', color: '#9ca3af' }}>
                  ({form.clinicalReason.length}/500)
                </span>
              </label>
              <textarea
                value={form.clinicalReason}
                onChange={e => set('clinicalReason', e.target.value.slice(0, 500))}
                placeholder="Describe the clinical indication for referral…"
                rows={4}
                required
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Relevant investigations already done <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea
                value={form.investigations}
                onChange={e => set('investigations', e.target.value)}
                placeholder="e.g. USS abdomen (Jan 2026) — gallstones noted. Bloods: Hb 9.2, ferritin 4."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Current medications relevant to referral <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea
                value={form.medications}
                onChange={e => set('medications', e.target.value)}
                placeholder="e.g. Aspirin 75 mg daily, Metformin 500 mg BD, Omeprazole 20 mg OD"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* ── Confirmations ── */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={form.patientInformed}
                  onChange={e => set('patientInformed', e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0, accentColor: '#0d9488' }}
                />
                <span>The patient has been informed of this referral and consents to their information being shared with Amise Medical Services.</span>
              </label>

              <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', fontSize: 14, color: '#374151', lineHeight: 1.6 }}>
                <input
                  type="checkbox"
                  checked={form.providerConfirm}
                  onChange={e => set('providerConfirm', e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0, accentColor: '#0d9488' }}
                />
                <span>I confirm this referral is clinically appropriate and I am a registered healthcare provider acting in a professional capacity.</span>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#dc2626' }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                marginTop: 28, width: '100%', padding: '14px',
                borderRadius: 8, border: 'none',
                background: canSubmit ? '#0d9488' : '#e5e7eb',
                color: canSubmit ? '#fff' : '#9ca3af',
                fontWeight: 800, fontSize: 15,
                cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
                opacity: submitting ? 0.7 : 1,
                transition: 'background 0.2s',
              }}
            >
              {submitting ? 'Sending Referral…' : 'Send Referral →'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 28, fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.8 }}>
          Amise Medical Services · Tapion Hospital: 758-284-0557 · Rodney Bay: 758-720-7111<br />
          This portal is for healthcare professionals only. Patient data is handled in accordance with Saint Lucia&apos;s data protection framework.
        </div>
      </div>
    </div>
  );
}
