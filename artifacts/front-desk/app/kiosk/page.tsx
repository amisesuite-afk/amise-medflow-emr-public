'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback } from 'react';
import VitalsPhotoCapture from '@/components/VitalsPhotoCapture';
import { API_BASE } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionOption { value: string; label: string; }

interface Question {
  key: string;
  text: string;
  type: 'single_choice' | 'multi_choice' | 'boolean' | 'scale' | 'text' | 'date';
  options?: QuestionOption[];
  required?: boolean;
  helpText?: string;
}

interface AnswerResponse {
  nextQuestion: Question | null;
  isComplete: boolean;
  redFlagsDetected: boolean;
  redFlagSeverity: string | null;
  estimatedRemaining?: number;
}

type KioskScreen = 'welcome' | 'checkin' | 'consent' | 'question' | 'redflag' | 'vitals_photo' | 'complete';

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';
const BG = '#060d18';
const CARD = '#0f172a';
const BORDER = '#1e3a5f';
const IDLE_TIMEOUT = 90; // seconds before reset

// ─────────────────────────────────────────────────────────────────────────────
// Shared style helpers
// ─────────────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: '36px 32px',
  marginBottom: 20,
};

const h2: React.CSSProperties = {
  margin: '0 0 20px',
  fontSize: 26,
  fontWeight: 800,
  color: '#f1f5f9',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: 8,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
};

const textInput: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '16px 18px',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: '#060d18',
  color: '#e2e8f0',
  fontSize: 20,
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '20px',
  borderRadius: 12,
  border: 'none',
  background: TEAL,
  color: '#fff',
  fontWeight: 800,
  fontSize: 20,
  cursor: 'pointer',
  marginTop: 12,
  letterSpacing: '0.01em',
};

const btnSecondary: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '16px',
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: '#64748b',
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  marginTop: 10,
};

const btnBack: React.CSSProperties = {
  flexShrink: 0,
  padding: '16px 22px',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: 'transparent',
  color: '#64748b',
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
};

// ─────────────────────────────────────────────────────────────────────────────
// Kiosk question input — tablet-optimised (large tap targets)
// ─────────────────────────────────────────────────────────────────────────────

function KioskInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[] | null;
  onChange: (v: string | string[]) => void;
}) {
  const str = typeof value === 'string' ? value : '';
  const arr = Array.isArray(value) ? value : [];

  const optBtn = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '20px 22px',
    marginBottom: 12,
    borderRadius: 12,
    border: selected ? `2px solid ${TEAL}` : `1.5px solid ${BORDER}`,
    background: selected ? `${TEAL}22` : CARD,
    color: selected ? '#e2e8f0' : '#94a3b8',
    fontWeight: selected ? 700 : 500,
    fontSize: 18,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.1s, background 0.1s',
  });

  switch (question.type) {
    case 'single_choice':
      return (
        <div>
          {(question.options ?? []).map(opt => (
            <button key={opt.value} type="button" onClick={() => onChange(opt.value)} style={optBtn(str === opt.value)}>
              <span style={{
                width: 26, height: 26, minWidth: 26,
                borderRadius: '50%',
                border: str === opt.value ? `2px solid ${TEAL}` : '2px solid #374151',
                background: str === opt.value ? TEAL : 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 16,
              }}>
                {str === opt.value && <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      );

    case 'multi_choice':
      return (
        <div>
          {(question.options ?? []).map(opt => {
            const checked = arr.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(checked ? arr.filter(v => v !== opt.value) : [...arr, opt.value])}
                style={optBtn(checked)}
              >
                <span style={{
                  width: 26, height: 26, minWidth: 26,
                  borderRadius: 6,
                  border: checked ? `2px solid ${TEAL}` : '2px solid #374151',
                  background: checked ? TEAL : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginRight: 16,
                  fontSize: 16,
                  color: '#fff',
                }}>
                  {checked ? '✓' : ''}
                </span>
                {opt.label}
              </button>
            );
          })}
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Select all that apply.</p>
        </div>
      );

    case 'boolean':
      return (
        <div style={{ display: 'flex', gap: 16 }}>
          {(['yes', 'no'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                flex: 1,
                padding: '28px 16px',
                borderRadius: 14,
                border: str === v ? `2px solid ${TEAL}` : `1.5px solid ${BORDER}`,
                background: str === v ? `${TEAL}22` : CARD,
                color: str === v ? '#e2e8f0' : '#64748b',
                fontWeight: 800,
                fontSize: 24,
                cursor: 'pointer',
              }}
            >
              {v === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      );

    case 'scale': {
      const current = str !== '' ? Number(str) : 0;
      const colors = ['#22c55e','#4ade80','#86efac','#fde047','#fbbf24','#fb923c','#f97316','#ef4444','#dc2626','#b91c1c','#7f1d1d'];
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
            <span>0 — No pain</span>
            <span>10 — Worst pain</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 16 }}>
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(String(i))}
                style={{
                  width: 56, height: 56,
                  borderRadius: 10,
                  border: current === i && str !== '' ? `3px solid ${colors[i]}` : `1.5px solid ${BORDER}`,
                  background: current === i && str !== '' ? `${colors[i]}33` : CARD,
                  color: current === i && str !== '' ? colors[i] : '#94a3b8',
                  fontWeight: 800,
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'text':
      return (
        <textarea
          value={str}
          onChange={e => onChange(e.target.value)}
          placeholder="Type your answer here…"
          rows={4}
          style={{
            ...textInput,
            resize: 'vertical' as const,
            fontSize: 17,
          }}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={str}
          onChange={e => onChange(e.target.value)}
          style={{ ...textInput, fontSize: 20 }}
        />
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main kiosk page
// ─────────────────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const [screen, setScreen] = useState<KioskScreen>('welcome');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [token, setToken] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [totalEstimated, setTotalEstimated] = useState(10);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [value, setValue] = useState<string | string[] | null>(null);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Array<{ question: Question; value: string | string[] }>>([]);
  const [countdown, setCountdown] = useState(30);
  const [idleSeconds, setIdleSeconds] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Inactivity tracking ──────────────────────────────────────────────────

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIdleSeconds(0);
  }, []);

  useEffect(() => {
    const onActivity = () => resetIdle();
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [resetIdle]);

  useEffect(() => {
    const active = screen === 'checkin' || screen === 'consent' || screen === 'question' || screen === 'vitals_photo';
    if (!active) {
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      setIdleSeconds(0);
      return;
    }
    idleIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      setIdleSeconds(elapsed);
      if (elapsed >= IDLE_TIMEOUT) reset();
    }, 1000);
    return () => { if (idleIntervalRef.current) clearInterval(idleIntervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Auto-reset countdown on terminal screens ─────────────────────────────

  useEffect(() => {
    if (screen !== 'complete' && screen !== 'redflag') return;
    setCountdown(30);
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); reset(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // ── Full reset ────────────────────────────────────────────────────────────

  function reset() {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setScreen('welcome');
    setName('');
    setDob('');
    setToken('');
    setCurrentQuestion(null);
    setTotalEstimated(10);
    setQuestionNumber(1);
    setValue(null);
    setHasRedFlag(false);
    setSubmitting(false);
    setCreating(false);
    setError('');
    setHistory([]);
    setIdleSeconds(0);
    lastActivityRef.current = Date.now();
  }

  // ── Start session ─────────────────────────────────────────────────────────

  async function startSession() {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/kiosk/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), dob: dob || null }),
      });
      const data = await res.json() as {
        error?: string;
        token?: string;
        sessionId?: string;
        firstQuestion?: Question | null;
        totalEstimated?: number;
      };
      if (!res.ok) {
        setError(data.error ?? 'Unable to start session. Please ask a staff member.');
        return;
      }
      setToken(data.token!);
      setCurrentQuestion(data.firstQuestion ?? null);
      setTotalEstimated(data.totalEstimated ?? 10);
      setScreen('consent');
    } catch {
      setError('Connection error. Please ask a staff member for assistance.');
    } finally {
      setCreating(false);
    }
  }

  // ── Answer submission ─────────────────────────────────────────────────────

  const submitAnswer = useCallback(async (forced?: string | string[]) => {
    const answer = forced ?? value;
    if (!currentQuestion || answer === null || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/kiosk/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, questionKey: currentQuestion.key, value: answer }),
      });

      if (!res.ok) {
        setSubmitting(false);
        return;
      }

      const data = await res.json() as AnswerResponse;

      setHistory(h => [...h, { question: currentQuestion, value: answer }]);
      setQuestionNumber(n => n + 1);

      if (data.redFlagsDetected) {
        setHasRedFlag(true);
        // Emergency severity → full red flag screen
        if (data.redFlagSeverity === 'emergency') {
          setScreen('redflag');
          setSubmitting(false);
          return;
        }
      }

      if (data.isComplete || !data.nextQuestion) {
        setScreen('vitals_photo');
      } else {
        setCurrentQuestion(data.nextQuestion);
        setValue(null);
        if (data.estimatedRemaining != null) {
          setTotalEstimated(questionNumber + data.estimatedRemaining);
        }
      }
    } catch {
      // Silent — keep showing current question
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, value, submitting, token, questionNumber]);

  // ── Auto-advance for single_choice / boolean ──────────────────────────────

  useEffect(() => {
    if (!currentQuestion) return;
    if (currentQuestion.type !== 'single_choice' && currentQuestion.type !== 'boolean') return;
    if (!value) return;

    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      void submitAnswer(value as string);
    }, 500);

    return () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); };
  }, [value, currentQuestion, submitAnswer]);

  // ── Back navigation ───────────────────────────────────────────────────────

  function handleBack() {
    if (history.length === 0) { setScreen('consent'); return; }
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentQuestion(prev.question);
    setValue(prev.value);
    setQuestionNumber(n => Math.max(1, n - 1));
  }

  // ── Value validity ────────────────────────────────────────────────────────

  function isValid(): boolean {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'multi_choice') return Array.isArray(value) && value.length > 0;
    if (currentQuestion.type === 'scale') return value !== null && value !== '';
    if (!currentQuestion.required) return true;
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
  }

  const progressPct = totalEstimated > 0
    ? Math.min(100, Math.round(((questionNumber - 1) / totalEstimated) * 100))
    : 0;

  const idleWarn = idleSeconds >= 60;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // ── Welcome ──
  if (screen === 'welcome') {
    return (
      <div
        onClick={() => { resetIdle(); setScreen('checkin'); }}
        style={{
          position: 'fixed', inset: 0,
          background: BG,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: 48,
          gap: 32,
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 72 }}>🏥</div>

        <div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: TEAL,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: 0, fontSize: 48, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.1 }}>
            Patient Check-In
          </h1>
          <p style={{ margin: '18px 0 0', fontSize: 20, color: '#475569', lineHeight: 1.6 }}>
            Dr Dawit Daniel Kabiye, MD, DM<br />
            General &amp; Endoscopic Surgery
          </p>
        </div>

        <div style={{
          padding: '22px 60px',
          borderRadius: 14,
          background: TEAL,
          color: '#fff',
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: '0.02em',
          boxShadow: `0 0 40px ${TEAL}44`,
        }}>
          Tap here to begin
        </div>

        <p style={{ fontSize: 13, color: '#1e3a5f' }}>
          Pre-visit health questionnaire · Strictly confidential
        </p>
      </div>
    );
  }

  // ── Red flag emergency ──
  if (screen === 'redflag') {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#1a0500',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 56,
        gap: 28,
      }}>
        <div style={{ fontSize: 88 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: 42, fontWeight: 900, color: '#fbbf24', lineHeight: 1.15 }}>
          Please Go to Reception Now
        </h1>
        <p style={{ margin: 0, fontSize: 22, color: '#fef3c7', lineHeight: 1.7, maxWidth: 560 }}>
          Based on your answers, a member of our clinical team needs to see you
          straight away. Please go to the reception desk or press the nurse call button.
        </p>
        <div style={{ fontSize: 18, color: '#f59e0b', fontWeight: 600 }}>
          Tapion Hospital: 459-2227 · 284-0557
        </div>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 12,
            padding: '16px 44px',
            borderRadius: 12,
            border: 'none',
            background: '#92400e',
            color: '#fef3c7',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Return to home ({countdown}s)
        </button>
      </div>
    );
  }

  // ── Complete ──
  if (screen === 'complete') {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#020d06',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 56,
        gap: 28,
      }}>
        <div style={{ fontSize: 88 }}>✅</div>
        <h1 style={{ margin: 0, fontSize: 42, fontWeight: 900, color: '#4ade80', lineHeight: 1.15 }}>
          Thank You!
        </h1>
        <p style={{ margin: 0, fontSize: 22, color: '#bbf7d0', lineHeight: 1.7, maxWidth: 540 }}>
          Your pre-visit questionnaire is complete.<br />
          Please let the nurse or receptionist know you are ready.
        </p>
        {hasRedFlag && (
          <div style={{
            padding: '16px 28px',
            borderRadius: 12,
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            color: '#92400e',
            fontSize: 17,
            fontWeight: 700,
            maxWidth: 480,
          }}>
            ⚠️ A member of our nursing team will be with you shortly.
          </div>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            padding: '14px 40px',
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: 'transparent',
            color: '#475569',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Return to home ({countdown}s)
        </button>
      </div>
    );
  }

  // ── Interactive screens (checkin / consent / question) ──
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: BG,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '48px 32px 64px',
      } as React.CSSProperties}
    >
      {/* Idle warning banner */}
      {idleWarn && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
            background: '#7c2d12',
            color: '#fed7aa',
            textAlign: 'center',
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Screen will reset in {IDLE_TIMEOUT - idleSeconds}s — tap to continue
        </div>
      )}

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: TEAL,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#f1f5f9' }}>
            Pre-Visit Health Questionnaire
          </h1>
        </div>

        {/* ── Checkin ── */}
        {screen === 'checkin' && (
          <div style={card}>
            <h2 style={h2}>Tell us who you are</h2>
            <p style={{ margin: '0 0 28px', fontSize: 16, color: '#64748b', lineHeight: 1.6 }}>
              This helps your care team prepare for your visit today.
            </p>

            <label style={label}>First &amp; Last Name</label>
            <input
              type="text"
              value={name}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. Jane Smith"
              onChange={e => { setName(e.target.value); resetIdle(); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) void startSession(); }}
              style={textInput}
            />

            <label style={{ ...label, marginTop: 24 }}>Date of Birth (optional)</label>
            <input
              type="date"
              value={dob}
              onChange={e => { setDob(e.target.value); resetIdle(); }}
              style={textInput}
            />

            {error && (
              <p style={{ margin: '16px 0 0', color: '#f87171', fontSize: 15 }}>{error}</p>
            )}

            <button
              type="button"
              onClick={() => void startSession()}
              disabled={!name.trim() || creating}
              style={{
                ...btnPrimary,
                marginTop: 32,
                opacity: !name.trim() || creating ? 0.4 : 1,
                cursor: !name.trim() || creating ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Starting…' : 'Next →'}
            </button>

            <button type="button" onClick={reset} style={btnSecondary}>
              ← Back to home
            </button>
          </div>
        )}

        {/* ── Consent ── */}
        {screen === 'consent' && (
          <div style={card}>
            <h2 style={h2}>Your Consent</h2>
            <p style={{ margin: '0 0 20px', fontSize: 16, color: '#94a3b8', lineHeight: 1.8 }}>
              Amise Medical Services collects the information in this questionnaire to prepare
              your care team for your visit. Your responses are{' '}
              <strong style={{ color: '#e2e8f0' }}>stored securely</strong> and are accessible
              only to the clinical staff responsible for your care, in accordance with Saint
              Lucia&apos;s Electronic Health Records Act.
            </p>
            <div style={{
              padding: '16px 20px',
              borderRadius: 10,
              background: '#060d18',
              border: `1px solid ${BORDER}`,
              fontSize: 13,
              color: '#6b7280',
              lineHeight: 1.7,
              marginBottom: 32,
            }}>
              This information will not be shared outside your care team or used for any
              purpose other than your direct care at Amise Medical Services.
            </div>

            <button
              type="button"
              onClick={async () => {
                resetIdle();
                try {
                  const r = await fetch(`/api/questionnaire/session/${token}/consent`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ consentGiven: true }),
                  });
                  if (!r.ok) {
                    const e = await r.json().catch(() => ({}));
                    setError((e as { error?: string }).error ?? 'Could not record consent');
                    return;
                  }
                } catch {
                  setError('Connection error recording consent');
                  return;
                }
                setScreen('question');
              }}
              style={btnPrimary}
            >
              I agree -- start questionnaire
            </button>
            <button type="button" onClick={() => setScreen('checkin')} style={btnSecondary}>
              ← Back
            </button>
          </div>
        )}

        {/* ── Question ── */}
        {screen === 'question' && currentQuestion && (
          <div>
            {/* Red flag banner */}
            {hasRedFlag && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px',
                borderRadius: 12,
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                color: '#92400e',
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 24,
              }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <span>A member of our nursing team will be with you shortly.</span>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 14, color: '#475569', marginBottom: 8,
              }}>
                <span>Question {questionNumber} of ~{totalEstimated}</span>
                <span>{progressPct}%</span>
              </div>
              <div style={{ height: 8, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progressPct}%`,
                  background: TEAL, borderRadius: 4,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            <div style={card}>
              {/* Question text */}
              <div style={{
                fontSize: 24, fontWeight: 700, color: '#f1f5f9',
                lineHeight: 1.45, marginBottom: 8,
              }}>
                {currentQuestion.text}
              </div>
              {currentQuestion.helpText && (
                <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>
                  {currentQuestion.helpText}
                </p>
              )}
              {!currentQuestion.helpText && <div style={{ marginBottom: 28 }} />}

              {/* Input */}
              <KioskInput
                question={currentQuestion}
                value={value}
                onChange={v => { setValue(v); resetIdle(); }}
              />

              {/* Submitting overlay for auto-advance types */}
              {submitting && (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 15, padding: '12px 0' }}>
                  Saving…
                </div>
              )}

              {/* Manual Next button for non-auto types */}
              {(currentQuestion.type === 'multi_choice' ||
                currentQuestion.type === 'text' ||
                currentQuestion.type === 'scale' ||
                currentQuestion.type === 'date') && (
                <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                  <button type="button" onClick={handleBack} style={btnBack}>
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitAnswer()}
                    disabled={!isValid() || submitting}
                    style={{
                      flex: 1,
                      padding: '20px',
                      borderRadius: 12,
                      border: 'none',
                      background: !isValid() || submitting ? '#1e293b' : TEAL,
                      color: !isValid() || submitting ? '#4b5563' : '#fff',
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: !isValid() || submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Saving…' : 'Next →'}
                  </button>
                </div>
              )}

              {/* Back button only for auto-advance types */}
              {(currentQuestion.type === 'single_choice' || currentQuestion.type === 'boolean') && !submitting && (
                <div style={{ marginTop: 20 }}>
                  <button type="button" onClick={handleBack} style={btnBack}>
                    ← Back
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Vitals photo ── */}
        {screen === 'vitals_photo' && (
          <VitalsPhotoCapture
            apiBase={API_BASE}
            token={token}
            onContinue={() => setScreen('complete')}
            onSkip={() => setScreen('complete')}
            theme={{ card: CARD, border: BORDER, accent: TEAL, inputBg: BG }}
          />
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40,
          textAlign: 'center',
          fontSize: 11,
          color: '#1e3a5f',
          lineHeight: 1.7,
        }}>
          Amise Medical Services · Saint Lucia<br />
          Tapion Hospital: 459-2227 · 284-0557 · Rodney Bay (Providence Building)
        </div>
      </div>
    </div>
  );
}
