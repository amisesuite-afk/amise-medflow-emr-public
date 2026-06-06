'use client';

// Public page — no authentication required.
// New patients request a consultation without needing a portal account.

import { useState } from 'react';

const TEAL = '#0d9488';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://amise-medflow-api.onrender.com';

export default function RequestConsultPage() {
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [visitType, setVisitType] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage]         = useState<'form' | 'submitting' | 'done' | 'error'>('form');
  const [errMsg, setErrMsg]       = useState('');

  async function handleSubmit() {
    if (!name.trim() || (!phone.trim() && !email.trim())) return;
    setStage('submitting');

    try {
      const resp = await fetch(`${API}/api/patient/request-consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim(), phone: phone.trim(), email: email.trim(), visit_type: visitType, description: description.trim() }),
      });
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error((json as { error?: string }).error ?? 'Request failed');
      }
      setStage('done');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStage('error');
    }
  }

  const input: React.CSSProperties  = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 15, fontFamily: 'inherit' };
  const label: React.CSSProperties  = { display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' };
  const sel: React.CSSProperties    = { ...input, cursor: 'pointer' };

  if (stage === 'done') {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '40px 32px', width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Request received</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
            Thank you. Our front desk will contact you within one working day to confirm your appointment.
          </p>
          <p style={{ fontSize: 12, color: '#475569' }}>
            For urgent concerns call Tapion Hospital: 459-2227 / 284-0557
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9' }}>Request a Consultation</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            No account needed. We will contact you to confirm.
          </p>
        </div>

        {stage === 'error' && (
          <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 20 }}>
            {errMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={label}>Full name *</label>
            <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
          </div>

          <div>
            <label style={label}>Phone number</label>
            <input style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 758…" />
          </div>

          <div>
            <label style={label}>Email address</label>
            <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>* Provide at least one of phone or email so we can reach you.</p>

          <div>
            <label style={label}>Type of visit</label>
            <select style={sel} value={visitType} onChange={e => setVisitType(e.target.value)}>
              <option value="">Not sure / general enquiry</option>
              <option value="surgical">Surgical Consultation</option>
              <option value="endoscopy">Endoscopy / Scope (colonoscopy, gastroscopy)</option>
              <option value="followup">Follow-up visit</option>
            </select>
          </div>

          <div>
            <label style={label}>Brief description (optional)</label>
            <textarea
              style={{ ...input, resize: 'vertical', minHeight: 80 } as React.CSSProperties}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. I've had abdominal pain for a few weeks and was referred by Dr. Pierre…"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={stage === 'submitting' || !name.trim() || (!phone.trim() && !email.trim())}
            style={{
              padding: '14px', borderRadius: 9, border: 'none',
              background: (!name.trim() || (!phone.trim() && !email.trim())) ? '#1e3a5f' : TEAL,
              color: (!name.trim() || (!phone.trim() && !email.trim())) ? '#475569' : '#fff',
              fontSize: 15, fontWeight: 700,
              cursor: (!name.trim() || (!phone.trim() && !email.trim())) ? 'not-allowed' : 'pointer',
            }}
          >
            {stage === 'submitting' ? 'Sending…' : 'Submit request →'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', margin: 0 }}>
            Already have an account?{' '}
            <a href="/patient/login" style={{ color: TEAL, textDecoration: 'none' }}>Sign in →</a>
          </p>
        </div>

        <p style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #1e3a5f', fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 1.6 }}>
          For urgent concerns or emergencies, call Tapion Hospital: 459-2227 / 284-0557<br />
          or visit your nearest emergency department.
        </p>
      </div>
    </div>
  );
}
