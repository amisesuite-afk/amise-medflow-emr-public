'use client';
import { useState } from 'react';
import type { BookingTrack } from '@/types';
import { APPOINTMENT_TYPES, BOOKING_DISCLAIMER } from '@/lib/scheduling';
import '../subpage-mobile.css';

type Step = 'track' | 'procedure_info' | 'details' | 'done';

const TRACK_INFO: Record<BookingTrack, { label: string; description: string; icon: string }> = {
  routine: {
    label:       'Routine appointment',
    description: 'Request a standard consultation. Our front desk team will check availability and contact you to confirm.',
    icon:        '📅',
  },
  referral: {
    label:       'GP / specialist referral',
    description: 'Your doctor has referred you to Amise Medical Services. Priority slots — staff will confirm within 24 hours.',
    icon:        '📋',
  },
  urgent: {
    label:       '',
    description: '',
    icon:        '',
  },
};

// Public hospitals and polyclinics in Saint Lucia — offered as suggestions on
// the "referring practice / hospital" field via <datalist> so referrers can
// pick rather than type in full. (We don't maintain a directory of individual
// doctors' names here — that would need to be sourced from a verified
// registry such as the SLMDA roster rather than guessed at.)
const SAINT_LUCIA_HEALTH_INSTITUTIONS = [
  'Victoria Hospital', 'Tapion Hospital', 'St Jude Hospital',
  'Soufrière Hospital', 'Dennery Hospital', 'Gros Islet Polyclinic',
  'Castries Polyclinic', 'Vieux Fort Polyclinic', 'Micoud Polyclinic',
  'Babonneau Polyclinic', 'Choiseul Polyclinic', 'Anse La Raye Polyclinic',
  'Canaries Polyclinic', 'Marigot Health Centre', 'Praslin Health Centre',
  'Mon Repos Health Centre', 'Laborie Health Centre', 'Dennery Health Centre',
];

/** Map each appointment-type key to one of the four optgroup labels */
const APPT_GROUPS: Record<string, string> = {
  new_consult:  'Consultations',
  follow_up:    'Consultations',
  telephone:    'Consultations',
  ogd:          'Endoscopy & Procedures',
  colonoscopy:  'Endoscopy & Procedures',
  ercp_workup:  'Endoscopy & Procedures',
  flexi_sig:    'Endoscopy & Procedures',
  breast:       'Specialist Clinics',
  thyroid:      'Specialist Clinics',
  diabetic_foot:'Specialist Clinics',
  pre_op:       'Surgery & Post-Op',
  post_op:      'Surgery & Post-Op',
};

const OPTGROUP_ORDER = [
  'Consultations',
  'Endoscopy & Procedures',
  'Specialist Clinics',
  'Surgery & Post-Op',
];

/** True when the appointment type requires endoscopy prep info */
function needsPrepNotice(apptType: string): boolean {
  return ['colonoscopy', 'egd', 'ogd', 'ercp'].some(prefix => apptType.startsWith(prefix));
}

// ── Procedure-specific intake questions ──────────────────────────────────────

interface ProcedureQuestion {
  id: string;
  label: string;
  type: 'text' | 'select' | 'yesno' | 'textarea';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

const PROCEDURE_QUESTIONS: Record<string, { heading: string; questions: ProcedureQuestion[] }> = {
  ogd: {
    heading: 'Gastroscopy (OGD) — clinical information',
    questions: [
      { id: 'primary_symptom', label: 'Primary symptom', type: 'select', options: ['Dyspepsia / heartburn', 'Dysphagia (difficulty swallowing)', 'Nausea / vomiting', 'Upper GI bleeding', 'Epigastric pain', 'Anaemia (iron-deficiency)', 'Weight loss', 'Other'], required: true },
      { id: 'symptom_duration', label: 'How long have you had this symptom?', type: 'select', options: ['Less than 2 weeks', '2–4 weeks', '1–3 months', '3–6 months', 'More than 6 months'] },
      { id: 'blood_thinners', label: 'Are you taking blood thinners (e.g. warfarin, aspirin, clopidogrel)?', type: 'yesno' },
      { id: 'previous_endoscopy', label: 'Have you had an endoscopy before?', type: 'yesno' },
      { id: 'allergies', label: 'Any known drug allergies?', type: 'text', placeholder: 'e.g. penicillin, iodine, latex — or "none"' },
      { id: 'other_info', label: 'Anything else we should know?', type: 'textarea', placeholder: 'e.g. relevant medical conditions, recent test results' },
    ],
  },
  colonoscopy: {
    heading: 'Colonoscopy — clinical information',
    questions: [
      { id: 'primary_symptom', label: 'Primary reason for colonoscopy', type: 'select', options: ['Change in bowel habit', 'Rectal bleeding', 'Screening / surveillance', 'Abdominal pain', 'Anaemia (iron-deficiency)', 'Family history of colorectal cancer', 'Polyp follow-up', 'Other'], required: true },
      { id: 'symptom_duration', label: 'How long have you had this symptom?', type: 'select', options: ['Less than 2 weeks', '2–4 weeks', '1–3 months', '3–6 months', 'More than 6 months', 'N/A — screening'] },
      { id: 'previous_colonoscopy', label: 'Have you had a colonoscopy before?', type: 'yesno' },
      { id: 'family_history', label: 'Family history of bowel cancer?', type: 'yesno' },
      { id: 'blood_thinners', label: 'Are you taking blood thinners?', type: 'yesno' },
      { id: 'allergies', label: 'Any known drug allergies?', type: 'text', placeholder: 'e.g. penicillin, iodine, latex — or "none"' },
    ],
  },
  ercp_workup: {
    heading: 'ERCP / Biliary investigation — clinical information',
    questions: [
      { id: 'primary_indication', label: 'Reason for ERCP referral', type: 'select', options: ['Bile duct stones (choledocholithiasis)', 'Jaundice — cause unknown', 'Biliary stricture', 'Stent replacement', 'Pancreatitis (biliary)', 'Other'], required: true },
      { id: 'jaundice', label: 'Do you currently have jaundice (yellow skin/eyes)?', type: 'yesno' },
      { id: 'prior_ercp', label: 'Have you had an ERCP before?', type: 'yesno' },
      { id: 'stent_in_situ', label: 'Do you have a biliary stent in place?', type: 'yesno' },
      { id: 'blood_thinners', label: 'Are you taking blood thinners?', type: 'yesno' },
      { id: 'recent_imaging', label: 'Recent imaging results available?', type: 'select', options: ['Ultrasound', 'CT scan', 'MRCP', 'Multiple', 'None yet'] },
      { id: 'allergies', label: 'Any known drug allergies (especially contrast/iodine)?', type: 'text', placeholder: 'e.g. iodine, contrast dye, penicillin — or "none"' },
    ],
  },
  flexi_sig: {
    heading: 'Flexible sigmoidoscopy — clinical information',
    questions: [
      { id: 'primary_symptom', label: 'Primary reason', type: 'select', options: ['Rectal bleeding', 'Change in bowel habit', 'Screening', 'Polyp follow-up', 'Other'], required: true },
      { id: 'blood_thinners', label: 'Are you taking blood thinners?', type: 'yesno' },
      { id: 'allergies', label: 'Any known drug allergies?', type: 'text', placeholder: 'e.g. penicillin — or "none"' },
    ],
  },
  breast: {
    heading: 'Breast clinic — clinical information',
    questions: [
      { id: 'primary_concern', label: 'Primary concern', type: 'select', options: ['New breast lump', 'Breast pain', 'Nipple discharge', 'Skin change', 'Screening / family history', 'Follow-up after treatment', 'Other'], required: true },
      { id: 'duration', label: 'How long have you noticed this?', type: 'select', options: ['Less than 1 week', '1–4 weeks', '1–3 months', 'More than 3 months', 'N/A'] },
      { id: 'family_history', label: 'Family history of breast or ovarian cancer?', type: 'yesno' },
      { id: 'previous_imaging', label: 'Any previous breast imaging?', type: 'select', options: ['Mammogram', 'Ultrasound', 'Both', 'None'] },
    ],
  },
  thyroid: {
    heading: 'Thyroid clinic — clinical information',
    questions: [
      { id: 'primary_concern', label: 'Primary concern', type: 'select', options: ['Thyroid nodule / lump', 'Goitre (enlarged thyroid)', 'Abnormal thyroid function tests', 'Follow-up', 'Other'], required: true },
      { id: 'thyroid_function', label: 'Most recent thyroid function test result', type: 'select', options: ['Normal', 'Overactive (hyperthyroid)', 'Underactive (hypothyroid)', 'Not tested / unknown'] },
      { id: 'previous_imaging', label: 'Previous thyroid ultrasound?', type: 'yesno' },
      { id: 'family_history', label: 'Family history of thyroid disease or thyroid cancer?', type: 'yesno' },
    ],
  },
  pre_op: {
    heading: 'Pre-operative assessment — clinical information',
    questions: [
      { id: 'planned_surgery', label: 'What surgery is planned?', type: 'text', placeholder: 'e.g. laparoscopic cholecystectomy', required: true },
      { id: 'blood_thinners', label: 'Are you taking blood thinners?', type: 'yesno' },
      { id: 'anaesthetic_history', label: 'Any problems with previous anaesthetics?', type: 'yesno' },
      { id: 'medical_conditions', label: 'Significant medical conditions', type: 'textarea', placeholder: 'e.g. diabetes, heart disease, asthma — or "none"' },
      { id: 'allergies', label: 'Any known drug allergies?', type: 'text', placeholder: 'e.g. penicillin, latex — or "none"' },
    ],
  },
  diabetic_foot: {
    heading: 'Diabetic foot clinic — clinical information',
    questions: [
      { id: 'primary_concern', label: 'Primary concern', type: 'select', options: ['Non-healing wound / ulcer', 'Foot numbness / tingling', 'Foot pain', 'Routine diabetic foot check', 'Infection', 'Other'], required: true },
      { id: 'diabetes_type', label: 'Diabetes type', type: 'select', options: ['Type 1', 'Type 2', 'Not sure'] },
      { id: 'wound_present', label: 'Do you currently have a wound or ulcer on your foot?', type: 'yesno' },
      { id: 'last_hba1c', label: 'Most recent HbA1c (if known)', type: 'text', placeholder: 'e.g. 7.2% — or "unknown"' },
    ],
  },
};

function buildReasonWithProcedureInfo(reason: string, answers: Record<string, string>, apptType: string): string {
  const parts: string[] = [];
  if (reason.trim()) parts.push(reason.trim());
  const config = PROCEDURE_QUESTIONS[apptType];
  if (config) {
    const answerLines = config.questions
      .filter(q => answers[q.id]?.trim())
      .map(q => `${q.label}: ${answers[q.id]}`);
    if (answerLines.length > 0) {
      parts.push(`[${config.heading}] ${answerLines.join(' | ')}`);
    }
  }
  return parts.join(' — ');
}

// ── Shared style primitives ───────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  borderRadius: 8,
  background: '#f8fafc',
  border: '1px solid #d1e8e5',
  color: '#0f172a',
  fontSize: 14,
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#0d9488',
  marginBottom: 18,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 20px',
  borderRadius: 50,
  border: 'none',
  background: '#0d9488',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtnStyle: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '12px 18px',
  borderRadius: 50,
  border: '1px solid #d1d5db',
  background: 'transparent',
  color: '#6b7280',
  cursor: 'pointer',
  fontSize: 14,
  fontFamily: 'inherit',
};

// ── WhatsApp SVG icon ─────────────────────────────────────────────────────────

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, hasProcedureStep }: { current: Step; hasProcedureStep: boolean }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'track',   label: 'Appointment type' },
    ...(hasProcedureStep ? [{ id: 'procedure_info' as Step, label: 'Clinical info' }] : []),
    { id: 'details', label: 'Your details' },
  ];
  const currentIdx = steps.findIndex(s => s.id === current);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const active   = s.id === current;
        const complete = i < currentIdx;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: complete ? '#0d9488' : active ? '#0d9488' : '#e2e8f0',
                color: complete || active ? '#fff' : '#94a3b8',
                border: active ? '2px solid #0d9488' : complete ? '2px solid #0d9488' : '2px solid #e2e8f0',
              }}>
                {complete ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? '#0d9488' : complete ? '#0d9488' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 40, height: 2, background: i < currentIdx ? '#0d9488' : '#e2e8f0', margin: '0 4px', marginBottom: 20 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [submitting,       setSubmitting]     = useState(false);
  const [result,           setResult]         = useState<{ message: string } | null>(null);
  const [error,            setError]          = useState('');
  const [procedureAnswers, setProcedureAnswers] = useState<Record<string, string>>({});
  const [preferredDays,    setPreferredDays]  = useState('');
  const [preferredTime,    setPreferredTime]  = useState('');
  const [preferredLocation, setPreferredLoc]  = useState('');

  const hasProcedureQuestions = appointmentType in PROCEDURE_QUESTIONS;
  const procedureConfig = PROCEDURE_QUESTIONS[appointmentType];

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const prefParts: string[] = [];
      if (preferredDays) prefParts.push(`Days: ${preferredDays}`);
      if (preferredTime) prefParts.push(`Time: ${preferredTime}`);
      if (preferredLocation) prefParts.push(`Location: ${preferredLocation}`);
      const preferences = prefParts.length > 0 ? prefParts.join(' | ') : undefined;

      const r = await fetch('/api/booking/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          track, appointmentType, patientName, patientPhone, patientEmail: patientEmail.trim() || undefined,
          patientDob,
          reason: buildReasonWithProcedureInfo(reason, procedureAnswers, appointmentType),
          referralDoctor, referralPractice,
          preferences,
        }),
      });
      const data = await r.json() as { error?: string };
      if (!r.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setResult({
          message: `Your request has been received. Our front desk team will review your request and contact you at ${patientPhone} to confirm your appointment${track === 'referral' ? ' within 24 hours' : ''}.`,
        });
        setStep('done');
      }
    } catch {
      setError('Network error. Please check your connection and try again, or call us at 758-284-0557 / 758-720-7111 to book by phone.');
    } finally {
      setSubmitting(false);
    }
  }

  const emailValid =
    patientEmail.trim() === '' ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail.trim());

  const phoneDigits = patientPhone.replace(/\D/g, '');
  const phoneValid =
    patientPhone.trim() === '' ||
    (phoneDigits.length >= 7 && phoneDigits.length <= 15);

  const canAdvanceDetails =
    patientName.trim().length >= 2 &&
    phoneDigits.length >= 7 &&
    phoneValid &&
    emailValid &&
    (track !== 'referral' || referralDoctor.trim().length >= 2);

  // Build optgroups for the appointment type selector
  const groupedTypes = OPTGROUP_ORDER.map(groupLabel => ({
    groupLabel,
    items: Object.entries(APPOINTMENT_TYPES).filter(([k]) => APPT_GROUPS[k] === groupLabel),
  })).filter(g => g.items.length > 0);

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Sub-nav header ──────────────────────────────────────────── */}
      <nav className="amise-sub-nav">
        <div className="amise-sub-nav-inner">
          <a
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0f172a', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            <span>Amise Medical Services</span>
          </a>
          {/* Right side intentionally empty — user is on the booking page */}
        </div>
      </nav>

      {/* ── Page body ───────────────────────────────────────────────── */}
      <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '32px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          {/* Page title block */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Amise Medical Services · Saint Lucia
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
              Book an Appointment
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
              General &amp; Endoscopic Surgery — led by Dr Dawit Daniel Kabiye, MD, DM
            </p>
          </div>

          {/* ── Disclaimer banner ──────────────────────────────────── */}
          <div style={{
            marginBottom: 24, padding: '10px 14px', borderRadius: 8,
            background: '#fff7ed', border: '1px solid #fed7aa',
            fontSize: 11, color: '#92400e', lineHeight: 1.6,
          }}>
            <strong>Important:</strong> {BOOKING_DISCLAIMER}
          </div>

          {/* ── WhatsApp alternative card ───────────────────────────── */}
          <div style={{
            marginBottom: 8, padding: '18px 20px', borderRadius: 10,
            background: '#f0fdf9', border: '1px solid #a7f3d0',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ color: '#16a34a', marginTop: 1 }}>
                <WhatsAppIcon />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#064e3b', marginBottom: 4 }}>
                  Book instantly on WhatsApp
                </div>
                <div style={{ fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                  Message us directly — we usually respond within 30 minutes during clinic hours.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a
                href="https://wa.me/17582840557"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 50,
                  background: '#16a34a', color: '#fff',
                  fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <WhatsAppIcon />
                WhatsApp Tapion Office →
              </a>
              <a
                href="https://wa.me/17587207111"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 50,
                  background: '#16a34a', color: '#fff',
                  fontWeight: 700, fontSize: 13, textDecoration: 'none',
                  fontFamily: 'inherit',
                }}
              >
                <WhatsAppIcon />
                WhatsApp Rodney Bay Office →
              </a>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 24px' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>— or book online below —</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* ── Form card ──────────────────────────────────────────── */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '32px',
            boxShadow: '0 1px 4px rgba(15,23,42,0.06)',
          }}
          // Mobile padding handled inline below via a wrapper trick — we use a className instead
          className="amise-booking-card"
          >
            {/* Step indicator (hidden on done screen) */}
            {step !== 'done' && <StepIndicator current={step} hasProcedureStep={hasProcedureQuestions} />}

            {/* ── STEP: TRACK ────────────────────────────────────── */}
            {step === 'track' && (
              <div>
                <div style={stepLabelStyle}>How are you coming to us?</div>

                {(['routine', 'referral'] as BookingTrack[]).map(t => {
                  const info = TRACK_INFO[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setTrack(t)}
                      style={{
                        display: 'block', width: '100%', marginBottom: 10,
                        padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                        background: track === t ? '#f0fdf9' : '#f8fafc',
                        border: `2px solid ${track === t ? '#0d9488' : '#e2e8f0'}`,
                        color: '#0f172a', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: track === t ? '#0d9488' : '#0f172a' }}>
                        {info.icon} {info.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{info.description}</div>
                    </button>
                  );
                })}

                <div style={{ marginTop: 20 }}>
                  <label style={labelStyle}>Type of appointment</label>
                  <select
                    value={appointmentType}
                    onChange={e => setApptType(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    {groupedTypes.map(({ groupLabel, items }) => (
                      <optgroup key={groupLabel} label={groupLabel}>
                        {items.map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* Endoscopy prep notice */}
                {needsPrepNotice(appointmentType) && (
                  <div style={{
                    marginTop: 12, padding: '12px 14px', borderRadius: 8,
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    fontSize: 12, color: '#1e40af', lineHeight: 1.6,
                  }}>
                    <strong>Preparation required:</strong> Endoscopy procedures require specific preparation. Full instructions will be sent by email and WhatsApp after your booking is confirmed. Please ensure you have provided both contact details.
                  </div>
                )}

                <button
                  onClick={() => {
                    setProcedureAnswers({});
                    setStep(hasProcedureQuestions ? 'procedure_info' : 'details');
                  }}
                  style={{ ...primaryBtnStyle, marginTop: 24, width: '100%' }}
                >
                  Continue →
                </button>
              </div>
            )}

            {/* ── STEP: PROCEDURE-SPECIFIC QUESTIONS ────────────── */}
            {step === 'procedure_info' && procedureConfig && (
              <div>
                <div style={stepLabelStyle}>{procedureConfig.heading}</div>
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                  background: '#f0fdf9', border: '1px solid #a7f3d0',
                  fontSize: 12, color: '#065f46', lineHeight: 1.6,
                }}>
                  These questions help us prepare for your appointment. Your answers are shared with Dr Kabiye&apos;s team only.
                </div>

                {procedureConfig.questions.map(q => (
                  <div key={q.id} style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>
                      {q.label}
                      {q.required && ' *'}
                    </label>
                    {q.type === 'select' && q.options && (
                      <select
                        value={procedureAnswers[q.id] ?? ''}
                        onChange={e => setProcedureAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        style={{ ...inputStyle, appearance: 'auto' }}
                      >
                        <option value="">Select…</option>
                        {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {q.type === 'text' && (
                      <input
                        type="text"
                        value={procedureAnswers[q.id] ?? ''}
                        onChange={e => setProcedureAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={q.placeholder}
                        style={inputStyle}
                      />
                    )}
                    {q.type === 'textarea' && (
                      <textarea
                        value={procedureAnswers[q.id] ?? ''}
                        onChange={e => setProcedureAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={q.placeholder}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                    )}
                    {q.type === 'yesno' && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        {['Yes', 'No'].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setProcedureAnswers(prev => ({ ...prev, [q.id]: v }))}
                            style={{
                              padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
                              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                              background: procedureAnswers[q.id] === v ? '#f0fdf9' : '#f8fafc',
                              border: `2px solid ${procedureAnswers[q.id] === v ? '#0d9488' : '#e2e8f0'}`,
                              color: procedureAnswers[q.id] === v ? '#0d9488' : '#6b7280',
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button onClick={() => setStep('track')} style={ghostBtnStyle}>
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('details')}
                    disabled={procedureConfig.questions.some(q => q.required && !procedureAnswers[q.id]?.trim())}
                    style={{
                      ...primaryBtnStyle,
                      background: procedureConfig.questions.some(q => q.required && !procedureAnswers[q.id]?.trim()) ? '#e2e8f0' : '#0d9488',
                      color: procedureConfig.questions.some(q => q.required && !procedureAnswers[q.id]?.trim()) ? '#94a3b8' : '#fff',
                      cursor: procedureConfig.questions.some(q => q.required && !procedureAnswers[q.id]?.trim()) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: DETAILS ──────────────────────────────────── */}
            {step === 'details' && (
              <div>
                <div style={stepLabelStyle}>Your details</div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Full name *</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={e => setName(e.target.value)}
                    placeholder="First and last name"
                    autoComplete="name"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>WhatsApp / mobile number *</label>
                  <input
                    type="tel"
                    value={patientPhone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+1 758 XXX-XXXX"
                    autoComplete="tel"
                    aria-invalid={patientPhone.trim() !== '' && !phoneValid ? true : undefined}
                    style={{
                      ...inputStyle,
                      ...(patientPhone.trim() !== '' && !phoneValid ? { borderColor: '#ef4444' } : {}),
                    }}
                  />
                  {patientPhone.trim() !== '' && !phoneValid ? (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }} role="alert">
                      Please enter a valid phone number (e.g. +1 758 284-0557).
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                      We will send appointment confirmations to this number.
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>
                    Email address{' '}
                    <span style={{ color: '#6b7280', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      (recommended — full prep instructions sent here)
                    </span>
                  </label>
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={!emailValid || undefined}
                    aria-describedby={!emailValid ? 'email-error' : undefined}
                    style={{ ...inputStyle, borderColor: !emailValid ? '#dc2626' : '#d1e8e5' }}
                  />
                  {!emailValid && (
                    <div id="email-error" role="alert" style={{ fontSize: 11, color: '#dc2626', marginTop: 5 }}>
                      Please enter a valid email address.
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                    Procedure instructions and your appointment details will be sent to this address. Leave blank to receive confirmation by WhatsApp/SMS only.
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Date of birth</label>
                  <input
                    type="date"
                    value={patientDob}
                    onChange={e => setDob(e.target.value)}
                    autoComplete="bday"
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Brief reason for visit <span style={{ color: '#6b7280', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. follow-up after discharge, hernia review, breast screening"
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                    Administrative only — do not include clinical history or test results.
                  </div>
                </div>

                {track === 'referral' && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Referring doctor&apos;s name *</label>
                      <input
                        type="text"
                        value={referralDoctor}
                        onChange={e => setRefDoctor(e.target.value)}
                        placeholder="Dr …"
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Referring practice / hospital</label>
                      <input
                        type="text"
                        value={referralPractice}
                        onChange={e => setRefPractice(e.target.value)}
                        placeholder="Practice or hospital name"
                        style={inputStyle}
                        list="sl-health-institutions"
                      />
                      <datalist id="sl-health-institutions">
                        {SAINT_LUCIA_HEALTH_INSTITUTIONS.map(inst => <option key={inst} value={inst} />)}
                      </datalist>
                    </div>
                  </>
                )}

                {/* ── Scheduling preferences ──────────────────── */}
                <div style={{
                  marginTop: 20, marginBottom: 16, padding: '16px 18px',
                  borderRadius: 10, background: '#f0fdf9', border: '1px solid #a7f3d0',
                }}>
                  <div style={{ ...labelStyle, color: '#065f46', marginBottom: 12, fontSize: 12, textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>
                    Scheduling preferences <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional — helps our team find the best time for you)</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Preferred days</label>
                      <select
                        value={preferredDays}
                        onChange={e => setPreferredDays(e.target.value)}
                        style={{ ...inputStyle, appearance: 'auto' }}
                      >
                        <option value="">No preference</option>
                        <option value="Monday–Wednesday">Early week (Mon–Wed)</option>
                        <option value="Thursday–Friday">Late week (Thu–Fri)</option>
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Preferred time</label>
                      <select
                        value={preferredTime}
                        onChange={e => setPreferredTime(e.target.value)}
                        style={{ ...inputStyle, appearance: 'auto' }}
                      >
                        <option value="">No preference</option>
                        <option value="Morning (8 am – 12 pm)">Morning (8 am – 12 pm)</option>
                        <option value="Afternoon (12 – 4 pm)">Afternoon (12 – 4 pm)</option>
                        <option value="First available">First available</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Preferred location</label>
                    <select
                      value={preferredLocation}
                      onChange={e => setPreferredLoc(e.target.value)}
                      style={{ ...inputStyle, appearance: 'auto' }}
                    >
                      <option value="">No preference</option>
                      <option value="Rodney Bay (Providence Building)">Rodney Bay (Providence Building)</option>
                      <option value="Tapion (Dr Kabiye's Office)">Tapion (Dr Kabiye&apos;s Office)</option>
                    </select>
                  </div>
                </div>

                {error && (
                  <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button
                    onClick={() => setStep(hasProcedureQuestions ? 'procedure_info' : 'track')}
                    style={ghostBtnStyle}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => void submit()}
                    disabled={!canAdvanceDetails || submitting}
                    style={{
                      ...primaryBtnStyle,
                      background: canAdvanceDetails && !submitting ? '#0d9488' : '#e2e8f0',
                      color: canAdvanceDetails && !submitting ? '#fff' : '#94a3b8',
                      cursor: canAdvanceDetails && !submitting ? 'pointer' : 'not-allowed',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    {submitting ? 'Submitting…' : 'Submit request →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: DONE ─────────────────────────────────────── */}
            {step === 'done' && result && (
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>📨</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0d9488', margin: '0 0 12px' }}>
                  Request received
                </h2>
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: '0 0 24px' }}>
                  {result.message}
                </p>

                <div style={{
                  padding: '14px 16px', borderRadius: 10, background: '#f0fdf9',
                  border: '1px solid #a7f3d0', fontSize: 13, color: '#065f46',
                  lineHeight: 1.6, marginBottom: 24, textAlign: 'left',
                }}>
                  <strong>What happens next:</strong> Our front desk team will check availability and contact you to confirm a specific date and time. If you have any questions in the meantime, WhatsApp or call us.
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                  <a
                    href={`https://wa.me/17582840557?text=${encodeURIComponent(`Hi, I submitted a booking request — name: ${patientName}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 18px', borderRadius: 50,
                      background: '#16a34a', color: '#fff',
                      fontWeight: 700, fontSize: 13, textDecoration: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    <WhatsAppIcon />
                    WhatsApp us
                  </a>
                  <a
                    href="tel:+17582840557"
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '10px 18px', borderRadius: 50,
                      border: '1px solid #d1d5db', background: 'transparent',
                      color: '#374151', fontWeight: 600, fontSize: 13, textDecoration: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    Call 758-284-0557
                  </a>
                </div>

                <div style={{
                  fontSize: 11, color: '#6b7280', padding: '10px 14px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  borderRadius: 8, textAlign: 'left', lineHeight: 1.6,
                }}>
                  {BOOKING_DISCLAIMER}
                </div>

                <button
                  onClick={() => {
                    setStep('track'); setName(''); setPhone(''); setEmail(''); setDob('');
                    setReason(''); setRefDoctor(''); setRefPractice(''); setProcedureAnswers({});
                    setPreferredDays(''); setPreferredTime(''); setPreferredLoc('');
                    setResult(null); setError('');
                  }}
                  style={{ ...ghostBtnStyle, marginTop: 20, flex: 'none' }}
                >
                  Book another appointment
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 1.8 }}>
            Amise Medical Services · Saint Lucia<br />
            Tapion: 758-284-0557 · Rodney Bay: 758-720-7111<br />
            Rodney Bay (Providence Building) · Tapion (Dr Kabiye&apos;s Office)
          </div>
        </div>
      </div>
    </>
  );
}
