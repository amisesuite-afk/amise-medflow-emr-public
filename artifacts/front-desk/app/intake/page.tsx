'use client';

import { useState, useCallback } from 'react';
import {
  QUESTION_BANK,
  createSession,
  processAnswer,
  getNextQuestion,
  detectSpecialty,
  buildResponseSummary,
  isSessionSufficient,
} from '@workspace/triage-engine/apcq';
import type { SessionState, Question, ApcqRedFlag } from '@workspace/triage-engine/apcq';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Screen = 'cc' | 'referral_check' | 'referral_upload' | 'details' | 'consent' | 'questions' | 'complete' | 'whatsapp_exit';

type ReferralType = 'self' | 'doctor';

interface PatientDetails {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  referralType: ReferralType;
  referringDoctor: string;
  referringPractice: string;
}

const WHATSAPP_NUMBER = '17582840557';
const PRACTICE_PHONE_DISPLAY = '758-284-0557';

const CHIEF_COMPLAINT = QUESTION_BANK.chief_complaint;

// ─────────────────────────────────────────────────────────────────────────────
// Styles — light theme matching landing page
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';

const S = {
  page: {
    minHeight: '100dvh',
    background: '#fafaf9',
    color: '#1c1917',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  } as React.CSSProperties,

  header: {
    padding: '1rem 1.25rem 0.75rem',
    borderBottom: '1px solid #e7e5e4',
    background: '#ffffff',
  } as React.CSSProperties,

  logoRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  } as React.CSSProperties,

  logoText: {
    margin: 0, fontSize: '1.125rem', fontWeight: 700, color: TEAL, letterSpacing: '-0.01em',
  } as React.CSSProperties,

  subtitle: {
    margin: 0, fontSize: '0.8125rem', color: '#78716c', fontWeight: 500,
  } as React.CSSProperties,

  confidential: {
    margin: '0.5rem 0 0', fontSize: '0.6875rem', color: '#a8a29e',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  } as React.CSSProperties,

  body: {
    maxWidth: 560, margin: '0 auto', padding: '1.25rem 1rem 2rem',
  } as React.CSSProperties,

  card: {
    background: '#ffffff', border: '1px solid #e7e5e4', borderRadius: 12,
    padding: '1.5rem 1.25rem', marginBottom: 16,
  } as React.CSSProperties,

  sectionTitle: {
    margin: '0 0 0.25rem', fontSize: '1.125rem', fontWeight: 700, color: '#1c1917',
  } as React.CSSProperties,

  sectionSub: {
    margin: '0 0 1.25rem', fontSize: '0.8125rem', color: '#78716c', lineHeight: 1.5,
  } as React.CSSProperties,

  optionBtn: (selected: boolean): React.CSSProperties => ({
    display: 'block', width: '100%', marginBottom: 8,
    padding: '0.875rem 1rem', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
    background: selected ? '#0d948815' : '#fafaf9',
    border: `2px solid ${selected ? TEAL : '#e7e5e4'}`,
    color: '#1c1917', fontSize: '0.9375rem', fontWeight: selected ? 600 : 400,
    transition: 'border-color 0.15s, background 0.15s',
  }),

  boolBtn: (selected: boolean, isYes: boolean): React.CSSProperties => ({
    flex: 1, padding: '1.125rem', borderRadius: 8, cursor: 'pointer', textAlign: 'center' as const,
    border: `2px solid ${selected ? (isYes ? '#16a34a' : '#dc2626') : '#e7e5e4'}`,
    background: selected ? (isYes ? '#16a34a10' : '#dc262610') : '#fafaf9',
    color: selected ? (isYes ? '#16a34a' : '#dc2626') : '#1c1917',
    fontSize: '1rem', fontWeight: 700, transition: 'all 0.15s',
  }),

  input: {
    width: '100%', boxSizing: 'border-box' as const, padding: '0.75rem 1rem',
    borderRadius: 8, border: '1px solid #d6d3d1', fontSize: '0.9375rem',
    fontFamily: 'inherit', color: '#1c1917', background: '#fafaf9', outline: 'none',
  } as React.CSSProperties,

  textarea: {
    width: '100%', boxSizing: 'border-box' as const, padding: '0.75rem 1rem',
    borderRadius: 8, border: '1px solid #d6d3d1', fontSize: '0.9375rem',
    fontFamily: 'inherit', color: '#1c1917', background: '#fafaf9', outline: 'none',
    resize: 'vertical' as const, minHeight: 80,
  } as React.CSSProperties,

  label: {
    display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#44403c',
    marginBottom: 6,
  } as React.CSSProperties,

  fieldGroup: {
    marginBottom: 16,
  } as React.CSSProperties,

  primaryBtn: (disabled: boolean): React.CSSProperties => ({
    width: '100%', padding: '0.875rem', borderRadius: 8, border: 'none',
    background: disabled ? '#d6d3d1' : TEAL, color: disabled ? '#a8a29e' : '#fff',
    fontWeight: 700, fontSize: '0.9375rem',
    cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
  }),

  secondaryBtn: {
    width: '100%', padding: '0.875rem', borderRadius: 8,
    border: '1px solid #d6d3d1', background: 'transparent',
    color: '#78716c', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
    marginTop: 10,
  } as React.CSSProperties,

  backBtn: {
    padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #d6d3d1',
    background: 'transparent', color: '#78716c', cursor: 'pointer', fontSize: '0.875rem',
  } as React.CSSProperties,

  navRow: {
    display: 'flex', gap: 10, marginTop: '1.25rem',
  } as React.CSSProperties,

  progressBar: {
    height: 4, borderRadius: 2, background: '#e7e5e4', marginBottom: 20, overflow: 'hidden',
  } as React.CSSProperties,

  progressFill: (pct: number): React.CSSProperties => ({
    height: '100%', width: `${pct}%`, background: TEAL, borderRadius: 2,
    transition: 'width 0.3s ease',
  }),

  questionText: {
    fontSize: '1.0625rem', fontWeight: 700, color: '#1c1917', lineHeight: 1.4, marginBottom: 20,
  } as React.CSSProperties,

  redFlagBanner: {
    background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
    padding: '0.875rem 1rem', marginBottom: 16, color: '#92400e',
    fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
  } as React.CSSProperties,

  whatsappEscape: {
    textAlign: 'center' as const, marginTop: 20, paddingTop: 16,
    borderTop: '1px solid #e7e5e4',
  } as React.CSSProperties,

  whatsappLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    color: '#16a34a', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
  } as React.CSSProperties,

  whatsappNote: {
    fontSize: '0.75rem', color: '#a8a29e', marginTop: 6, lineHeight: 1.4,
  } as React.CSSProperties,

  footer: {
    marginTop: 24, paddingTop: 16, borderTop: '1px solid #e7e5e4',
    fontSize: '0.6875rem', color: '#a8a29e', textAlign: 'center' as const, lineHeight: 1.7,
  } as React.CSSProperties,
};

// ─────────────────────────────────────────────────────────────────────────────
// Question input renderer
// ─────────────────────────────────────────────────────────────────────────────

function QuestionInput({ question, value, onChange }: {
  question: Question;
  value: string | string[] | null;
  onChange: (v: string | string[]) => void;
}) {
  const strVal = typeof value === 'string' ? value : '';
  const arrVal = Array.isArray(value) ? value : [];

  switch (question.type) {
    case 'single_choice':
      return (
        <div>
          {(question.options ?? []).map(opt => (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
              style={S.optionBtn(strVal === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      );

    case 'multi_choice':
      return (
        <div>
          {(question.options ?? []).map(opt => {
            const checked = arrVal.includes(opt.value);
            return (
              <button key={opt.value} type="button"
                onClick={() => onChange(checked ? arrVal.filter(v => v !== opt.value) : [...arrVal, opt.value])}
                style={S.optionBtn(checked)}>
                <span style={{ marginRight: 8, opacity: 0.6 }}>{checked ? '☑' : '☐'}</span>
                {opt.label}
              </button>
            );
          })}
          <div style={{ fontSize: '0.6875rem', color: '#a8a29e', marginTop: 6 }}>Select all that apply.</div>
        </div>
      );

    case 'boolean':
      return (
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => onChange('yes')} style={S.boolBtn(strVal === 'yes', true)}>Yes</button>
          <button type="button" onClick={() => onChange('no')} style={S.boolBtn(strVal === 'no', false)}>No</button>
        </div>
      );

    case 'scale':
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.75rem', color: '#78716c' }}>
            <span>0 — None</span><span>10 — Severe</span>
          </div>
          <input type="range" min={0} max={10} step={1} value={strVal || '0'}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%', accentColor: TEAL, cursor: 'pointer' }} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <span style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 16,
              background: TEAL, color: '#fff', fontWeight: 700, fontSize: '1.125rem' }}>
              {strVal || '0'}
            </span>
          </div>
        </div>
      );

    case 'text':
      return <textarea value={strVal} onChange={e => onChange(e.target.value)}
        placeholder="Type your answer here…" style={S.textarea} rows={3} />;

    case 'date':
      return <input type="date" value={strVal} onChange={e => onChange(e.target.value)} style={S.input} />;

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main intake page
// ─────────────────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const [screen, setScreen] = useState<Screen>('cc');

  // Chief complaint
  const [ccSelection, setCcSelection] = useState<string[]>([]);

  // Referral
  const [referralType, setReferralType] = useState<ReferralType>('self');

  // Patient details
  const [details, setDetails] = useState<PatientDetails>({
    fullName: '', email: '', phone: '', dob: '',
    referralType: 'self', referringDoctor: '', referringPractice: '',
  });

  // APCQ engine state
  const [apcqState, setApcqState] = useState<SessionState | null>(null);
  const [questionValue, setQuestionValue] = useState<string | string[] | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [history, setHistory] = useState<Array<{ state: SessionState; value: string | string[] }>>([]);
  const [hasRedFlag, setHasRedFlag] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── CC screen → Referral check ─────────────────────────────────────────
  function handleCcNext() {
    if (ccSelection.length === 0) return;
    setScreen('referral_check');
  }

  function handleReferralNext() {
    setDetails(d => ({ ...d, referralType }));
    if (referralType === 'doctor') {
      setScreen('referral_upload');
    } else {
      setScreen('details');
    }
  }

  // ── Details → Consent ────────────────────────────────────────────────────
  function handleDetailsNext() {
    if (!details.fullName.trim() || !details.phone.trim()) return;
    setScreen('consent');
  }

  // ── Consent → Start APCQ ────────────────────────────────────────────────
  function handleConsentAccept() {
    const specialty = detectSpecialty(ccSelection);
    const session = createSession({
      sessionId: crypto.randomUUID(),
      templateKey: 'general_screening',
      mode: 'screening',
    });

    // Pre-answer the chief complaint since we already collected it
    const withCc = processAnswer(session, {
      questionKey: 'chief_complaint',
      value: ccSelection,
    });

    setApcqState(withCc);
    setQuestionValue(null);
    setQuestionNumber(1);
    setScreen('questions');
  }

  // ── Answer submission (client-side APCQ) ─────────────────────────────────
  const submitAnswer = useCallback(() => {
    if (!apcqState?.currentQuestion || questionValue === null) return;

    const prevState = apcqState;
    const newState = processAnswer(apcqState, {
      questionKey: apcqState.currentQuestion.key,
      value: questionValue,
    });

    setHistory(h => [...h, { state: prevState, value: questionValue }]);
    setQuestionNumber(n => n + 1);

    if (newState.redFlags.length > 0) setHasRedFlag(true);

    setApcqState(newState);
    setQuestionValue(null);

    if (newState.isComplete) {
      handleComplete(newState);
    }
  }, [apcqState, questionValue]);

  // ── Back navigation ──────────────────────────────────────────────────────
  function handleBack() {
    if (history.length === 0) {
      setScreen('consent');
      return;
    }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setApcqState(prev.state);
    setQuestionValue(prev.value);
    setQuestionNumber(n => Math.max(1, n - 1));
  }

  // ── Complete: save to Supabase ───────────────────────────────────────────
  async function handleComplete(finalState: SessionState) {
    setScreen('complete');
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: details,
          chiefComplaint: ccSelection,
          specialty: detectSpecialty(ccSelection),
          responses: finalState.responses,
          redFlags: finalState.redFlags,
          summary: buildResponseSummary(finalState),
          isComplete: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitError((err as { error?: string }).error ?? 'Failed to save. Please contact the practice.');
      }
    } catch {
      setSubmitError('Network error. Your responses were recorded locally. Please contact the practice.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── WhatsApp escape ──────────────────────────────────────────────────────
  function handleWhatsAppExit() {
    setScreen('whatsapp_exit');
  }

  // ── Validation helpers ───────────────────────────────────────────────────
  function isQuestionValid(): boolean {
    if (!apcqState?.currentQuestion) return false;
    const q = apcqState.currentQuestion;
    if (q.type === 'multi_choice') return Array.isArray(questionValue) && questionValue.length > 0;
    if (q.type === 'scale') return questionValue !== null;
    if (q.type === 'boolean') return questionValue === 'yes' || questionValue === 'no';
    if (!q.required) return true;
    if (Array.isArray(questionValue)) return questionValue.length > 0;
    return typeof questionValue === 'string' && questionValue.trim().length > 0;
  }

  const progressPct = apcqState
    ? Math.min(100, Math.round((questionNumber / (questionNumber + apcqState.estimatedRemaining)) * 100))
    : 0;

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Good day, I'd like to request an appointment at Amise Medical Services.\n\nName: ${details.fullName || '(not provided)'}\nConcern: ${ccSelection.map(v => {
      const opt = CHIEF_COMPLAINT.options?.find(o => o.value === v);
      return opt?.label ?? v;
    }).join(', ') || '(not selected)'}`
  )}`;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.logoRow}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill={TEAL} />
            <path d="M14 6v16M6 14h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div>
            <h1 style={S.logoText}>AMISE Medical Services</h1>
            <p style={S.subtitle}>New Patient Intake</p>
          </div>
        </div>
        <p style={S.confidential}>Confidential &middot; Saint Lucia</p>
      </header>

      <div style={S.body}>

        {/* ── Step 1: Chief Complaint ── */}
        {screen === 'cc' && (
          <div>
            <div style={S.card}>
              <h2 style={S.sectionTitle}>What brings you in today?</h2>
              <p style={S.sectionSub}>Select your main concern(s) so we can prepare for your visit.</p>

              {(CHIEF_COMPLAINT.options ?? []).map(opt => {
                const checked = ccSelection.includes(opt.value);
                return (
                  <button key={opt.value} type="button"
                    onClick={() => setCcSelection(checked
                      ? ccSelection.filter(v => v !== opt.value)
                      : [...ccSelection, opt.value])}
                    style={S.optionBtn(checked)}>
                    <span style={{ marginRight: 8, opacity: 0.6 }}>{checked ? '☑' : '☐'}</span>
                    {opt.label}
                  </button>
                );
              })}
              <div style={{ fontSize: '0.6875rem', color: '#a8a29e', marginTop: 4 }}>Select all that apply.</div>

              <div style={{ marginTop: 20 }}>
                <button type="button" onClick={handleCcNext} disabled={ccSelection.length === 0}
                  style={S.primaryBtn(ccSelection.length === 0)}>
                  Continue
                </button>
              </div>
            </div>

            <WhatsAppEscape url={whatsappUrl} />
          </div>
        )}

        {/* ── Step 1b: Referral check ── */}
        {screen === 'referral_check' && (
          <div>
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Have you been referred by a doctor?</h2>
              <p style={S.sectionSub}>
                We accept referrals via scanned letter or WhatsApp. Referred patients receive priority scheduling.
              </p>

              <button type="button" onClick={() => setReferralType('self')}
                style={S.optionBtn(referralType === 'self')}>
                <span style={{ marginRight: 8 }}>{referralType === 'self' ? '●' : '○'}</span>
                No — I&apos;m booking for myself
              </button>
              <button type="button" onClick={() => setReferralType('doctor')}
                style={S.optionBtn(referralType === 'doctor')}>
                <span style={{ marginRight: 8 }}>{referralType === 'doctor' ? '●' : '○'}</span>
                Yes — I have a doctor&apos;s referral
              </button>

              <div style={S.navRow}>
                <button type="button" onClick={() => setScreen('cc')} style={S.backBtn}>← Back</button>
                <button type="button" onClick={handleReferralNext}
                  style={{ ...S.primaryBtn(false), flex: 1 }}>
                  Continue
                </button>
              </div>
            </div>

            <WhatsAppEscape url={whatsappUrl} />
          </div>
        )}

        {/* ── Step 1c: Referral upload ── */}
        {screen === 'referral_upload' && (
          <div>
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Referral details</h2>
              <p style={S.sectionSub}>
                Please provide your referring doctor&apos;s details. You can send the referral letter
                via WhatsApp or bring it to your appointment.
              </p>

              <div style={S.fieldGroup}>
                <label style={S.label}>Referring doctor&apos;s name</label>
                <input type="text" value={details.referringDoctor}
                  onChange={e => setDetails(d => ({ ...d, referringDoctor: e.target.value }))}
                  placeholder="e.g. Dr Smith" style={S.input} />
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Referring practice / hospital</label>
                <select value={details.referringPractice}
                  onChange={e => setDetails(d => ({ ...d, referringPractice: e.target.value }))}
                  style={{ ...S.input, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                  <option value="">Select or type below…</option>
                  <option value="Victoria Hospital">Victoria Hospital</option>
                  <option value="Tapion Hospital">Tapion Hospital</option>
                  <option value="St Jude Hospital">St Jude Hospital</option>
                  <option value="Soufrière Hospital">Soufrière Hospital</option>
                  <option value="Dennery Hospital">Dennery Hospital</option>
                  <option value="Gros Islet Polyclinic">Gros Islet Polyclinic</option>
                  <option value="Castries Polyclinic">Castries Polyclinic</option>
                  <option value="Vieux Fort Polyclinic">Vieux Fort Polyclinic</option>
                  <option value="Micoud Polyclinic">Micoud Polyclinic</option>
                  <option value="Babonneau Polyclinic">Babonneau Polyclinic</option>
                  <option value="Choiseul Polyclinic">Choiseul Polyclinic</option>
                  <option value="Anse La Raye Polyclinic">Anse La Raye Polyclinic</option>
                  <option value="Canaries Polyclinic">Canaries Polyclinic</option>
                  <option value="Marigot Health Centre">Marigot Health Centre</option>
                  <option value="Mon Repos Health Centre">Mon Repos Health Centre</option>
                  <option value="Laborie Health Centre">Laborie Health Centre</option>
                  <option value="Private practice">Private practice</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{
                padding: '0.875rem 1rem', borderRadius: 8, background: '#ecfdf5',
                border: '1px solid #a7f3d0', marginBottom: 16,
              }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: '#065f46' }}>
                  📄 Send your referral letter:
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#065f46', lineHeight: 1.5 }}>
                  Scan or photograph the letter and send it via WhatsApp to{' '}
                  <strong>{PRACTICE_PHONE_DISPLAY}</strong>, or bring it to your appointment.
                </p>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  `Good day, I have a referral letter from ${details.referringDoctor || 'my doctor'} for Amise Medical Services. I'd like to send it for review.\n\nPatient: ${details.fullName || '(will provide)'}`
                )}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginTop: 10, padding: '0.5rem 1rem',
                    borderRadius: 6, background: '#16a34a', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
                  }}>
                  💬 Send referral via WhatsApp
                </a>
              </div>

              <div style={S.navRow}>
                <button type="button" onClick={() => setScreen('referral_check')} style={S.backBtn}>← Back</button>
                <button type="button" onClick={() => setScreen('details')}
                  style={{ ...S.primaryBtn(false), flex: 1 }}>
                  Continue to your details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Patient Details ── */}
        {screen === 'details' && (
          <div>
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Your details</h2>
              <p style={S.sectionSub}>We need a few details to book your appointment and prepare for your visit.</p>

              <div style={S.fieldGroup}>
                <label style={S.label}>Full name *</label>
                <input type="text" value={details.fullName}
                  onChange={e => setDetails(d => ({ ...d, fullName: e.target.value }))}
                  placeholder="e.g. John Baptiste" style={S.input} autoComplete="name" />
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Phone number *</label>
                <input type="tel" value={details.phone}
                  onChange={e => setDetails(d => ({ ...d, phone: e.target.value }))}
                  placeholder="e.g. +1 758 284 0557" style={S.input} autoComplete="tel" />
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Email address</label>
                <input type="email" value={details.email}
                  onChange={e => setDetails(d => ({ ...d, email: e.target.value }))}
                  placeholder="e.g. john@example.com" style={S.input} autoComplete="email" />
              </div>

              <div style={S.fieldGroup}>
                <label style={S.label}>Date of birth</label>
                <input type="date" value={details.dob}
                  onChange={e => setDetails(d => ({ ...d, dob: e.target.value }))}
                  style={S.input} />
              </div>

              <div style={S.navRow}>
                <button type="button" onClick={() => setScreen(referralType === 'doctor' ? 'referral_upload' : 'referral_check')} style={S.backBtn}>← Back</button>
                <button type="button" onClick={handleDetailsNext}
                  disabled={!details.fullName.trim() || !details.phone.trim()}
                  style={{ ...S.primaryBtn(!details.fullName.trim() || !details.phone.trim()), flex: 1 }}>
                  Continue
                </button>
              </div>
            </div>

            <WhatsAppEscape url={whatsappUrl} />
          </div>
        )}

        {/* ── Step 3: Consent ── */}
        {screen === 'consent' && (
          <div>
            <div style={S.card}>
              <h2 style={S.sectionTitle}>Before we begin</h2>
              <p style={{ ...S.sectionSub, marginBottom: 16 }}>
                We will ask a few health questions to help your care team prepare for your visit.
                This takes about 2–3 minutes.
              </p>

              <div style={{
                padding: '0.875rem 1rem', borderRadius: 8, background: '#fafaf9',
                border: '1px solid #e7e5e4', fontSize: '0.8125rem', color: '#78716c',
                lineHeight: 1.6, marginBottom: 20,
              }}>
                I consent to the collection of my health information for the purpose of improving my
                care at Amise Medical Services. This information is confidential and accessible only
                to my care team. Data is stored securely in accordance with Saint Lucia&apos;s
                Electronic Health Records Act.
              </div>

              <button type="button" onClick={handleConsentAccept} style={S.primaryBtn(false)}>
                I consent — begin questionnaire
              </button>

              <div style={S.navRow}>
                <button type="button" onClick={() => setScreen('details')} style={S.backBtn}>← Back</button>
              </div>
            </div>

            <WhatsAppEscape url={whatsappUrl} />
          </div>
        )}

        {/* ── Step 4: APCQ Questions ── */}
        {screen === 'questions' && apcqState?.currentQuestion && (
          <div>
            {hasRedFlag && (
              <div style={S.redFlagBanner}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>A symptom you reported has been flagged. Our team will prioritise your case.</span>
              </div>
            )}

            {/* Progress */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#a8a29e', marginBottom: 6 }}>
              <span>Question {questionNumber}</span>
              <span>{progressPct}% complete</span>
            </div>
            <div style={S.progressBar}>
              <div style={S.progressFill(progressPct)} />
            </div>

            <div style={S.card}>
              <div style={S.questionText}>{apcqState.currentQuestion.text}</div>

              <QuestionInput
                question={apcqState.currentQuestion}
                value={questionValue}
                onChange={setQuestionValue}
              />

              {submitError && (
                <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: 10 }}>{submitError}</div>
              )}

              <div style={S.navRow}>
                <button type="button" onClick={handleBack} style={S.backBtn}>← Back</button>
                <button type="button" onClick={submitAnswer} disabled={!isQuestionValid()}
                  style={{ ...S.primaryBtn(!isQuestionValid()), flex: 1 }}>
                  {apcqState.estimatedRemaining <= 1 ? 'Finish' : 'Next →'}
                </button>
              </div>
            </div>

            <WhatsAppEscape url={whatsappUrl} />
          </div>
        )}

        {/* ── Complete ── */}
        {screen === 'complete' && (
          <div style={S.card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <h2 style={{ ...S.sectionTitle, color: '#16a34a' }}>Thank you, {details.fullName.split(' ')[0]}.</h2>
              <p style={{ ...S.sectionSub, marginBottom: 20 }}>
                Your responses have been submitted. Our team will review your information and
                contact you to confirm your appointment.
              </p>

              {hasRedFlag && (
                <div style={{ ...S.redFlagBanner, justifyContent: 'center', marginBottom: 16 }}>
                  <span>⚠️</span>
                  <span>Some symptoms have been flagged for priority review.</span>
                </div>
              )}

              {submitting && (
                <p style={{ fontSize: '0.8125rem', color: '#a8a29e' }}>Saving your responses…</p>
              )}
              {submitError && (
                <div style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: 8, marginBottom: 8 }}>
                  {submitError}
                </div>
              )}

              <div style={{
                padding: '0.875rem 1rem', borderRadius: 8, background: '#fafaf9',
                border: '1px solid #e7e5e4', fontSize: '0.75rem', color: '#a8a29e', lineHeight: 1.6,
              }}>
                Your information is confidential and has been shared only with your care team at
                Amise Medical Services.
              </div>

              <div style={{ marginTop: 16 }}>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                  style={{ ...S.secondaryBtn, display: 'inline-block', textDecoration: 'none', color: '#16a34a', borderColor: '#16a34a' }}>
                  💬 Message us on WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── WhatsApp exit ── */}
        {screen === 'whatsapp_exit' && (
          <div style={S.card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <h2 style={S.sectionTitle}>Contact us on WhatsApp</h2>
              <p style={S.sectionSub}>
                You can reach us directly on WhatsApp. A member of our team will assist you
                and complete the intake at your consultation.
              </p>

              <div style={{
                padding: '0.75rem 1rem', borderRadius: 8, background: '#fef3c7',
                border: '1px solid #f59e0b', fontSize: '0.8125rem', color: '#92400e',
                lineHeight: 1.5, marginBottom: 20,
              }}>
                Completing the questionnaire helps us triage your case to the right specialty
                and prepare for your visit. Skipping it may delay your care.
              </div>

              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block', width: '100%', padding: '0.875rem', borderRadius: 8,
                  background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.9375rem',
                  textDecoration: 'none', textAlign: 'center',
                }}>
                Open WhatsApp — {PRACTICE_PHONE_DISPLAY}
              </a>

              <button type="button" onClick={() => setScreen(apcqState ? 'questions' : 'cc')}
                style={S.secondaryBtn}>
                ← Go back to the questionnaire
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          Amise Medical Services &middot; Saint Lucia<br />
          General &amp; Endoscopic Surgery — Dr Dawit Daniel Kabiye, MD, DM<br />
          Tapion Hospital &middot; Rodney Bay (Providence Building)
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp escape hatch (shown on every step)
// ─────────────────────────────────────────────────────────────────────────────

function WhatsAppEscape({ url }: { url: string }) {
  return (
    <div style={S.whatsappEscape}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={S.whatsappLink}>
        💬 Prefer WhatsApp? Message us instead
      </a>
      <p style={S.whatsappNote}>
        Skipping the questionnaire may delay triage to the right specialty.
      </p>
    </div>
  );
}
