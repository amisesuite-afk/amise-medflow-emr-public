'use client';
import { useState, useEffect } from 'react';
import type { BookingTrack } from '@/types';
import { APPOINTMENT_TYPES, BOOKING_DISCLAIMER } from '@/lib/scheduling';

interface Slot {
  start: string;
  end: string;
  location: string;
  appointmentType: string;
  display: string;
}

type Step = 'track' | 'details' | 'slots' | 'done';

const TRACK_INFO: Record<BookingTrack, { label: string; description: string; icon: string }> = {
  routine: {
    label:       'Routine appointment',
    description: 'Book directly for a standard consultation. Slots are confirmed immediately.',
    icon:        '📅',
  },
  referral: {
    label:       'GP / specialist referral',
    description: 'Your doctor has referred you to Dr Kabiye. Priority slots — staff will confirm within 24 hours.',
    icon:        '📋',
  },
  urgent: {
    label:       '',
    description: '',
    icon:        '',
  },
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 6,
  background: '#1e293b', border: '1px solid #374151',
  color: '#e2e8f0', fontSize: 14, fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function BookingForm() {
  const [step,             setStep]           = useState<Step>('track');
  const [track,            setTrack]          = useState<BookingTrack>('routine');
  const [appointmentType,  setApptType]       = useState('new_consult');
  const [patientName,      setName]           = useState('');
  const [patientPhone,     setPhone]          = useState('');
  const [patientEmail,     setEmail]          = useState('');
  const [patientDob,       setDob]            = useState('');
  const [reason,           setReason]         = useState('');
  const [referralDoctor,   setRefDoctor]      = useState('');
  const [referralPractice, setRefPractice]    = useState('');
  const [slots,            setSlots]          = useState<Slot[]>([]);
  const [slotsLoading,     setSlotsLoading]   = useState(false);
  const [selectedSlot,     setSelectedSlot]   = useState<Slot | null>(null);
  const [submitting,       setSubmitting]     = useState(false);
  const [result,           setResult]         = useState<{ autoConfirmed: boolean; message: string } | null>(null);
  const [error,            setError]          = useState('');

  // Load slots when reaching slot step
  useEffect(() => {
    if (step !== 'slots') return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    void fetch(`/api/booking/slots?type=${appointmentType}&track=${track}`)
      .then(r => r.json())
      .then((d: { slots: Slot[] }) => { setSlots(d.slots ?? []); setSlotsLoading(false); })
      .catch(() => setSlotsLoading(false));
  }, [step, appointmentType, track]);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/booking/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          track, appointmentType, patientName, patientPhone, patientEmail: patientEmail.trim() || undefined,
          patientDob, reason, referralDoctor, referralPractice,
          selectedSlot: selectedSlot ?? undefined,
        }),
      });
      const data = await r.json() as { autoConfirmed?: boolean; error?: string };
      if (!r.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setResult({
          autoConfirmed: data.autoConfirmed ?? false,
          message: data.autoConfirmed
            ? `Your appointment has been confirmed: ${selectedSlot?.display ?? ''}. A confirmation has been sent to ${patientPhone}${patientEmail.trim() ? ` and ${patientEmail.trim()}` : ''}.`
            : `Your request has been received. You will be contacted at ${patientPhone} within ${track === 'referral' ? '24 hours' : '2 hours'} to confirm your appointment.`,
        });
        setStep('done');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const emailValid =
    patientEmail.trim() === '' ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail.trim());

  const canAdvanceDetails =
    patientName.trim().length >= 2 &&
    patientPhone.trim().length >= 7 &&
    emailValid &&
    (track !== 'referral' || referralDoctor.trim().length >= 2);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            Book an Appointment
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
            Dr Dawit Daniel Kabiye, MD, DM — General &amp; Endoscopic Surgery
          </p>
        </div>

        {/* Disclaimer banner */}
        <div style={{
          marginBottom: 24, padding: '10px 14px', borderRadius: 6,
          background: '#1e293b', border: '1px solid #f97316',
          fontSize: 11, color: '#fb923c', lineHeight: 1.6,
        }}>
          <strong>Important:</strong> {BOOKING_DISCLAIMER}
        </div>

        {/* ── STEP: TRACK ── */}
        {step === 'track' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              How are you coming to us?
            </div>

            {(['routine', 'referral'] as BookingTrack[]).map(t => {
              const info = TRACK_INFO[t];
              return (
                <button
                  key={t}
                  onClick={() => setTrack(t)}
                  style={{
                    display: 'block', width: '100%', marginBottom: 10,
                    padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
                    background: track === t ? '#0d948822' : '#1e293b',
                    border: `2px solid ${track === t ? '#0d9488' : '#374151'}`,
                    color: '#e2e8f0', textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {info.icon} {info.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{info.description}</div>
                </button>
              );
            })}

            <div style={{ marginTop: 14 }}>
              <label style={labelStyle}>Type of appointment</label>
              <select
                value={appointmentType}
                onChange={e => setApptType(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                {Object.entries(APPOINTMENT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setStep('details')}
              style={{
                marginTop: 20, width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP: DETAILS ── */}
        {step === 'details' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your details
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Full name *</label>
              <input type="text" value={patientName} onChange={e => setName(e.target.value)} placeholder="First and last name" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>WhatsApp / mobile number *</label>
              <input type="tel" value={patientPhone} onChange={e => setPhone(e.target.value)} placeholder="+1 758 …" style={inputStyle} />
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                We will send appointment confirmations to this number.
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email address <span style={{ color: '#4b5563', fontWeight: 400, textTransform: 'none' }}>(recommended — full prep instructions sent here)</span></label>
              <input
                type="email"
                value={patientEmail}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ ...inputStyle, borderColor: !emailValid ? '#ef4444' : '#374151' }}
              />
              {!emailValid && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>Please enter a valid email address.</div>
              )}
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                Procedure instructions and your appointment details will be sent to this address. Leave blank to receive confirmation by WhatsApp/SMS only.
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Date of birth</label>
              <input type="date" value={patientDob} onChange={e => setDob(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Brief reason for visit (optional)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. follow-up after discharge, hernia review, breast screening"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
                Administrative only — do not include clinical history or test results.
              </div>
            </div>

            {track === 'referral' && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Referring doctor&apos;s name *</label>
                  <input
                    type="text"
                    value={referralDoctor}
                    onChange={e => setRefDoctor(e.target.value)}
                    placeholder="Dr …"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Referring practice / hospital</label>
                  <input
                    type="text"
                    value={referralPractice}
                    onChange={e => setRefPractice(e.target.value)}
                    placeholder="Practice or hospital name"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setStep('track')}
                style={{ flex: '0 0 auto', padding: '12px 18px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('slots')}
                disabled={!canAdvanceDetails}
                style={{
                  flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                  background: canAdvanceDetails ? '#0d9488' : '#1e293b',
                  color: canAdvanceDetails ? '#fff' : '#4b5563',
                  fontWeight: 700, fontSize: 14,
                  cursor: canAdvanceDetails ? 'pointer' : 'not-allowed',
                }}
              >
                View available slots →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: SLOTS ── */}
        {step === 'slots' && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 18, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {track === 'referral' ? 'Preferred appointment slot' : 'Select your appointment'}
            </div>

            {slotsLoading && (
              <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 13 }}>
                Checking availability…
              </div>
            )}

            {!slotsLoading && slots.length === 0 && (
              <div style={{
                padding: '14px 16px', borderRadius: 8, background: '#1e293b',
                border: '1px solid #374151', color: '#94a3b8', fontSize: 13, marginBottom: 16,
              }}>
                {track === 'referral'
                  ? 'Our team will contact you to arrange a priority slot. Please submit your details and we will confirm within 24 hours.'
                  : 'No slots are currently available online. Please contact us directly at Tapion Hospital (459-2227) and we will arrange an appointment for you.'}
              </div>
            )}

            {!slotsLoading && slots.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedSlot(s)}
                style={{
                  display: 'block', width: '100%', marginBottom: 10,
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  background: selectedSlot?.start === s.start ? '#0d948822' : '#1e293b',
                  border: `2px solid ${selectedSlot?.start === s.start ? '#0d9488' : '#374151'}`,
                  color: '#e2e8f0', textAlign: 'left', fontSize: 14,
                }}
              >
                {s.display}
              </button>
            ))}

            {track === 'referral' && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, background: '#1e293b',
                border: '1px solid #374151', fontSize: 12, color: '#6b7280',
                marginBottom: 14, lineHeight: 1.5,
              }}>
                Referral appointments are subject to staff confirmation and verification of the referral. You will receive a confirmation message within 24 hours.
              </div>
            )}

            {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setStep('details')}
                style={{ flex: '0 0 auto', padding: '12px 18px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
              >
                ← Back
              </button>
              <button
                onClick={() => void submit()}
                disabled={
                  submitting ||
                  (track === 'routine' && !selectedSlot) ||
                  (slots.length > 0 && !selectedSlot && track !== 'referral')
                }
                style={{
                  flex: 1, padding: '12px', borderRadius: 8, border: 'none',
                  background: '#0d9488', color: '#fff',
                  fontWeight: 700, fontSize: 14, cursor: submitting ? 'wait' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting…' : track === 'routine' ? 'Confirm appointment' : 'Submit request'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {result.autoConfirmed ? '✅' : '📨'}
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#34d399', margin: '0 0 12px' }}>
              {result.autoConfirmed ? 'Appointment confirmed' : 'Request received'}
            </h2>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, margin: '0 0 24px' }}>
              {result.message}
            </p>
            <div style={{ fontSize: 11, color: '#4b5563', padding: '10px 14px', background: '#1e293b', borderRadius: 6, textAlign: 'left', lineHeight: 1.6 }}>
              {BOOKING_DISCLAIMER}
            </div>
            <button
              onClick={() => {
                setStep('track'); setName(''); setPhone(''); setEmail(''); setDob('');
                setReason(''); setRefDoctor(''); setRefPractice('');
                setSelectedSlot(null); setResult(null); setError('');
              }}
              style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}
            >
              Book another appointment
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #1e293b', fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 1.7 }}>
          Amise Medical Services · Saint Lucia<br />
          Tapion Hospital: 459-2227 / 284-0557<br />
          Rodney Bay (Providence Building) · Castries
        </div>
      </div>
    </div>
  );
}
