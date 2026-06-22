'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import VitalsPhotoCapture from '@/components/VitalsPhotoCapture';
import { API_BASE } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  key: string;
  text: string;
  type: 'single_choice' | 'multi_choice' | 'boolean' | 'scale' | 'text' | 'date';
  options?: QuestionOption[];
  required?: boolean;
  redFlagValues?: string[];
}

interface SessionRow {
  id: string;
  status: 'in_progress' | 'completed' | 'abandoned' | 'nurse_reviewed' | 'doctor_approved';
  consent_given: boolean;
  red_flags_detected?: unknown[];
}

interface SessionData {
  session: SessionRow;
  currentQuestion: Question | null;
  isComplete: boolean;
}

interface AnswerResponse {
  nextQuestion: Question | null;
  isComplete: boolean;
  redFlagsDetected: boolean;
  estimatedRemaining?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style constants — dark theme matching BookingForm
// ─────────────────────────────────────────────────────────────────────────────

const AMISE_TEAL = '#0d9488';
const AMISE_BLUE = '#1e40af';

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    padding: '24px 16px',
  } as React.CSSProperties,

  container: {
    maxWidth: 560,
    margin: '0 auto',
  } as React.CSSProperties,

  header: {
    marginBottom: 28,
    textAlign: 'center' as const,
  } as React.CSSProperties,

  headerLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: AMISE_TEAL,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  } as React.CSSProperties,

  h1: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: '#f1f5f9',
  } as React.CSSProperties,

  subhead: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#64748b',
  } as React.CSSProperties,

  card: {
    background: '#1e293b',
    border: '1px solid #374151',
    borderRadius: 12,
    padding: '28px 24px',
    marginBottom: 16,
  } as React.CSSProperties,

  errorCard: {
    background: '#1e293b',
    border: '1px solid #ef4444',
    borderRadius: 12,
    padding: '32px 24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  successCard: {
    background: '#1e293b',
    border: '1px solid #22c55e',
    borderRadius: 12,
    padding: '32px 24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  redFlagBanner: {
    background: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 20,
    color: '#92400e',
    fontSize: 14,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  progressBar: (pct: number): React.CSSProperties => ({
    height: 4,
    borderRadius: 2,
    background: '#374151',
    marginBottom: 24,
    overflow: 'hidden',
  }),

  progressFill: (pct: number): React.CSSProperties => ({
    height: '100%',
    width: `${pct}%`,
    background: AMISE_TEAL,
    borderRadius: 2,
    transition: 'width 0.3s ease',
  }),

  questionText: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
    lineHeight: 1.4,
    marginBottom: 24,
  } as React.CSSProperties,

  optionButton: (selected: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    marginBottom: 10,
    padding: '14px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    background: selected ? '#0d948822' : '#0f172a',
    border: `2px solid ${selected ? AMISE_TEAL : '#374151'}`,
    color: '#e2e8f0',
    textAlign: 'left',
    fontSize: 15,
    fontWeight: selected ? 600 : 400,
    transition: 'border-color 0.15s, background 0.15s',
  }),

  boolButton: (selected: boolean, isYes: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '20px',
    borderRadius: 8,
    cursor: 'pointer',
    border: `2px solid ${selected ? (isYes ? '#22c55e' : '#ef4444') : '#374151'}`,
    background: selected ? (isYes ? '#22c55e18' : '#ef444418') : '#0f172a',
    color: selected ? (isYes ? '#4ade80' : '#f87171') : '#e2e8f0',
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center' as const,
    transition: 'all 0.15s',
  }),

  textarea: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '12px',
    borderRadius: 6,
    background: '#0f172a',
    border: '1px solid #374151',
    color: '#e2e8f0',
    fontSize: 15,
    fontFamily: 'inherit',
    resize: 'vertical' as const,
    minHeight: 100,
  } as React.CSSProperties,

  dateInput: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '12px',
    borderRadius: 6,
    background: '#0f172a',
    border: '1px solid #374151',
    color: '#e2e8f0',
    fontSize: 15,
    fontFamily: 'inherit',
  } as React.CSSProperties,

  navRow: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
  } as React.CSSProperties,

  backBtn: {
    flex: '0 0 auto',
    padding: '12px 18px',
    borderRadius: 8,
    border: '1px solid #374151',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
  } as React.CSSProperties,

  nextBtn: (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px',
    borderRadius: 8,
    border: 'none',
    background: disabled ? '#1e293b' : AMISE_TEAL,
    color: disabled ? '#4b5563' : '#fff',
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  }),

  consentText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 1.75,
    marginBottom: 20,
  } as React.CSSProperties,

  consentBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 8,
    border: 'none',
    background: AMISE_BLUE,
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  } as React.CSSProperties,

  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1px solid #1e293b',
    fontSize: 11,
    color: '#374151',
    textAlign: 'center' as const,
    lineHeight: 1.7,
  } as React.CSSProperties,
};

// ─────────────────────────────────────────────────────────────────────────────
// Scale slider component
// ─────────────────────────────────────────────────────────────────────────────

function ScaleSlider({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const current = value ?? 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: '#6b7280' }}>
        <span>0 — None</span>
        <span>10 — Severe</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={current}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: AMISE_TEAL, cursor: 'pointer' }}
      />
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <span style={{
          display: 'inline-block',
          padding: '6px 18px',
          borderRadius: 20,
          background: AMISE_TEAL,
          color: '#fff',
          fontWeight: 700,
          fontSize: 20,
          minWidth: 48,
        }}>
          {current}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question renderer
// ─────────────────────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  onChange,
}: {
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
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={s.optionButton(strVal === opt.value)}
            >
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
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = checked
                    ? arrVal.filter(v => v !== opt.value)
                    : [...arrVal, opt.value];
                  onChange(next);
                }}
                style={s.optionButton(checked)}
              >
                <span style={{ marginRight: 8, opacity: 0.6 }}>{checked ? '☑' : '☐'}</span>
                {opt.label}
              </button>
            );
          })}
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>Select all that apply.</div>
        </div>
      );

    case 'boolean':
      return (
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => onChange('yes')} style={s.boolButton(strVal === 'yes', true)}>
            Yes
          </button>
          <button type="button" onClick={() => onChange('no')} style={s.boolButton(strVal === 'no', false)}>
            No
          </button>
        </div>
      );

    case 'scale':
      return (
        <ScaleSlider
          value={strVal !== '' ? Number(strVal) : null}
          onChange={v => onChange(String(v))}
        />
      );

    case 'text':
      return (
        <textarea
          value={strVal}
          onChange={e => onChange(e.target.value)}
          placeholder="Type your answer here…"
          style={s.textarea}
          rows={4}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={strVal}
          onChange={e => onChange(e.target.value)}
          style={s.dateInput}
        />
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export default function QuestionnairePage({ params }: { params: { token: string } }) {
  const { token } = params;

  // ── Loading / session state ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  // ── Questionnaire flow ────────────────────────────────────────────────────
  type Screen = 'consent' | 'question' | 'vitals_photo' | 'complete';
  const [screen, setScreen] = useState<Screen>('consent');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [value, setValue] = useState<string | string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hasRedFlag, setHasRedFlag] = useState(false);

  // Progress tracking — we start at 1 and increment as we go
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalEstimated, setTotalEstimated] = useState<number | null>(null);

  // History for back navigation (stack of answered question keys)
  const [history, setHistory] = useState<
    Array<{ question: Question; answeredValue: string | string[] }>
  >([]);

  // ── Fetch session on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`${API_BASE}/api/questionnaire/session/${token}`);
        if (!res.ok) {
          setSessionError('This questionnaire link is invalid or has expired.');
          setLoading(false);
          return;
        }
        const data = (await res.json()) as SessionData;
        setSessionData(data);

        const status = data.session.status;

        if (status === 'abandoned') {
          setSessionError('This questionnaire link is invalid or has expired.');
          setLoading(false);
          return;
        }

        if (
          status === 'completed' ||
          status === 'nurse_reviewed' ||
          status === 'doctor_approved' ||
          data.isComplete
        ) {
          setScreen('complete');
          setLoading(false);
          return;
        }

        // In progress
        if (data.session.consent_given) {
          setScreen('question');
        } else {
          setScreen('consent');
        }

        if (data.currentQuestion) {
          setCurrentQuestion(data.currentQuestion);
        }

        // Estimate total from red_flags_detected presence (rough)
        // We don't have the total from this endpoint, so we leave null
        setLoading(false);
      } catch {
        setSessionError('Unable to load your questionnaire. Please check your internet connection and try again.');
        setLoading(false);
      }
    }

    void fetchSession();
  }, [token, API_BASE]);

  // ── Consent accepted ──────────────────────────────────────────────────────
  async function handleConsent() {
    try {
      const r = await fetch(`${API_BASE}/api/questionnaire/session/${token}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentGiven: true }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setSubmitError((e as { error?: string }).error ?? 'Could not record consent');
        return;
      }
    } catch {
      setSubmitError('Connection error recording consent');
      return;
    }
    if (!sessionData?.currentQuestion) {
      setScreen('complete');
      return;
    }
    setCurrentQuestion(sessionData.currentQuestion);
    setScreen('question');
  }

  // ── Answer submission ────────────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    if (!currentQuestion || value === null) return;
    if (submitting) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`${API_BASE}/api/questionnaire/session/${token}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionKey: currentQuestion.key, value }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setSubmitError(err.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as AnswerResponse;

      // Push to history before moving forward
      setHistory(h => [...h, { question: currentQuestion, answeredValue: value }]);
      setQuestionNumber(n => n + 1);

      if (data.redFlagsDetected) {
        setHasRedFlag(true);
      }

      if (data.isComplete || !data.nextQuestion) {
        setScreen('vitals_photo');
      } else {
        setCurrentQuestion(data.nextQuestion);
        setValue(null);
        if (data.estimatedRemaining !== undefined) {
          setTotalEstimated(questionNumber + data.estimatedRemaining);
        }
      }
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, value, submitting, token, API_BASE, questionNumber]);

  // ── Back navigation ──────────────────────────────────────────────────────
  function handleBack() {
    if (history.length === 0) {
      // Go back to consent
      setScreen('consent');
      return;
    }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentQuestion(prev.question);
    setValue(prev.answeredValue);
    setQuestionNumber(n => Math.max(1, n - 1));
  }

  // ── Value validation ─────────────────────────────────────────────────────
  function isValueValid(): boolean {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'multi_choice') {
      return Array.isArray(value) && value.length > 0;
    }
    if (currentQuestion.type === 'scale') {
      // Scale defaults to 0, which is always valid
      return value !== null && value !== '';
    }
    if (!currentQuestion.required) {
      // Optional text/date — allow empty
      return true;
    }
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  }

  // ── Progress percentage ─────────────────────────────────────────────────
  const progressPct = totalEstimated
    ? Math.min(100, Math.round(((questionNumber - 1) / totalEstimated) * 100))
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLabel}>Amise Medical Services · Saint Lucia</div>
          <h1 style={s.h1}>Pre-Visit Health Questionnaire</h1>
          <p style={s.subhead}>General &amp; Endoscopic Surgery — led by Dr Dawit Daniel Kabiye, MD, DM</p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ ...s.card, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            Loading your questionnaire…
          </div>
        )}

        {/* ── Session error ── */}
        {!loading && sessionError && (
          <div style={s.errorCard}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f87171', margin: '0 0 12px' }}>
              Link Unavailable
            </h2>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
              {sessionError}
            </p>
          </div>
        )}

        {/* ── Consent screen ── */}
        {!loading && !sessionError && screen === 'consent' && (
          <div style={s.card}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
              Before we begin — your consent
            </h2>
            <p style={s.consentText}>
              I consent to the collection of my health information for the purpose of improving my
              care at Amise Medical Services. This information is confidential and accessible only
              to your care team. Data is stored securely in accordance with Saint Lucia&apos;s
              Electronic Health Records Act.
            </p>
            <div style={{
              padding: '10px 14px',
              borderRadius: 6,
              background: '#0f172a',
              border: '1px solid #374151',
              fontSize: 11,
              color: '#6b7280',
              lineHeight: 1.6,
              marginBottom: 20,
            }}>
              This questionnaire collects information to prepare your care team for your visit.
              Your responses will not be used for any purpose other than your direct care at
              Amise Medical Services.
            </div>
            <button type="button" onClick={handleConsent} style={s.consentBtn}>
              I consent — begin questionnaire
            </button>
          </div>
        )}

        {/* ── Question screen ── */}
        {!loading && !sessionError && screen === 'question' && currentQuestion && (
          <div>
            {/* Red flag banner */}
            {hasRedFlag && (
              <div style={s.redFlagBanner}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span>A member of our nursing team will be with you shortly.</span>
              </div>
            )}

            {/* Progress bar */}
            {totalEstimated !== null && totalEstimated > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                  <span>Question {questionNumber}</span>
                  <span>{progressPct}% complete</span>
                </div>
                <div style={s.progressBar(progressPct)}>
                  <div style={s.progressFill(progressPct)} />
                </div>
              </div>
            )}

            {/* Question card */}
            <div style={s.card}>
              <div style={s.questionText}>{currentQuestion.text}</div>

              <QuestionInput
                question={currentQuestion}
                value={value}
                onChange={setValue}
              />

              {submitError && (
                <div style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>
                  {submitError}
                </div>
              )}

              <div style={s.navRow}>
                <button
                  type="button"
                  onClick={handleBack}
                  style={s.backBtn}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => void submitAnswer()}
                  disabled={!isValueValid() || submitting}
                  style={s.nextBtn(!isValueValid() || submitting)}
                >
                  {submitting ? 'Saving…' : 'Next →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Vitals photo screen ── */}
        {!loading && !sessionError && screen === 'vitals_photo' && (
          <VitalsPhotoCapture
            apiBase={API_BASE}
            token={token}
            onContinue={() => setScreen('complete')}
            onSkip={() => setScreen('complete')}
          />
        )}

        {/* ── Complete screen ── */}
        {!loading && !sessionError && screen === 'complete' && (
          <div style={s.successCard}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#4ade80', margin: '0 0 14px' }}>
              Thank you.
            </h2>
            <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.75, margin: '0 0 20px' }}>
              Your responses have been recorded. Please let the nurse know you have finished.
            </p>
            <div style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#0f172a',
              border: '1px solid #374151',
              fontSize: 12,
              color: '#6b7280',
              lineHeight: 1.6,
            }}>
              Your information is confidential and has been shared only with your care team at
              Amise Medical Services.
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={s.footer}>
          Amise Medical Services · Saint Lucia<br />
          Tapion Hospital: 459-2227 / 284-0557<br />
          Rodney Bay (Providence Building) · Tapion Hospital
        </div>
      </div>
    </div>
  );
}
