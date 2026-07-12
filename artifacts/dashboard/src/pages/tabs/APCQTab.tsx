import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'scale' | 'boolean' | 'date';

interface QuestionOption {
  value: string;
  label: string;
  redFlag?: boolean;
}

interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  redFlagValues?: string[];
  helpText?: string;
}

interface ApiQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  redFlagValues?: string[];
  helpText?: string;
}

interface SessionStartResponse {
  sessionToken: string;
  firstQuestion: ApiQuestion;
  totalEstimated: number;
}

interface AnswerResponse {
  nextQuestion: ApiQuestion | null;
  complete: boolean;
  redFlagsDetected: string[];
  questionIndex: number;
  totalEstimated: number;
}

type ScreenState = 'consent' | 'questioning' | 'complete';

interface Props {
  sessionToken?: string;
  templateKey?: string;
  mode?: 'screening' | 'condition_specific';
  /** When true, removes full-screen layout for use inside a dashboard tab panel */
  compact?: boolean;
}

// ── Inline question bank (fallback / initial render) ─────────────────────────

const FALLBACK_QUESTIONS: Question[] = [
  {
    id: 'chief_complaint',
    text: 'What is the main reason for your visit today?',
    type: 'single_choice',
    required: true,
    options: [
      { value: 'abdominal_pain', label: 'Abdominal pain' },
      { value: 'reflux', label: 'Heartburn / acid reflux' },
      { value: 'swallowing', label: 'Difficulty swallowing' },
      { value: 'rectal_bleeding', label: 'Rectal bleeding / blood in stool' },
      { value: 'weight_loss', label: 'Unexplained weight loss' },
      { value: 'lump', label: 'Lump or swelling' },
      { value: 'follow_up', label: 'Follow-up appointment' },
      { value: 'other', label: 'Other concern' },
    ],
  },
  {
    id: 'pain_duration',
    text: 'How long have you been experiencing this?',
    type: 'single_choice',
    required: true,
    options: [
      { value: 'hours', label: 'A few hours' },
      { value: 'days', label: '1–7 days' },
      { value: 'weeks', label: '1–4 weeks' },
      { value: 'months', label: '1–6 months' },
      { value: 'over_6months', label: 'More than 6 months' },
    ],
  },
  {
    id: 'pain_score',
    text: 'If you have pain or discomfort, how would you rate it right now?',
    type: 'scale',
    required: false,
    scaleMin: 0,
    scaleMax: 10,
    scaleMinLabel: 'No pain',
    scaleMaxLabel: 'Worst possible',
    redFlagValues: ['8', '9', '10'],
    helpText: '0 = no pain at all, 10 = the worst pain imaginable',
  },
  {
    id: 'associated_symptoms',
    text: 'Are you experiencing any of the following? (Select all that apply)',
    type: 'multi_choice',
    required: false,
    options: [
      { value: 'fever', label: 'Fever or chills' },
      { value: 'vomiting', label: 'Nausea or vomiting' },
      { value: 'rectal_bleed', label: 'Blood in stool or rectal bleeding', redFlag: true },
      { value: 'black_stool', label: 'Black or tarry stools', redFlag: true },
      { value: 'jaundice', label: 'Yellowing of skin or eyes', redFlag: true },
      { value: 'chest_pain', label: 'Chest pain or shortness of breath', redFlag: true },
      { value: 'none', label: 'None of the above' },
    ],
  },
  {
    id: 'weight_loss',
    text: 'Have you noticed any unintentional weight loss recently?',
    type: 'boolean',
    required: true,
    redFlagValues: ['yes'],
  },
  {
    id: 'previous_surgery',
    text: 'Have you had any previous abdominal or gastrointestinal surgery?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'medications',
    text: 'Please list any medications you are currently taking, including supplements.',
    type: 'text',
    required: false,
    helpText: 'Include prescribed medicines, over-the-counter drugs, and herbal supplements.',
  },
  {
    id: 'allergies',
    text: 'Do you have any known allergies to medications, foods, or other substances?',
    type: 'text',
    required: false,
    helpText: 'Write "None" if you have no known allergies.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? '' : 's'} ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-blue-700">
          Question {current} of ~{total}
        </span>
        <span className="text-sm text-gray-500">{pct}% complete</span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div
          className="bg-blue-700 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RedFlagBanner() {
  return (
    <div
      className="rounded-2xl px-6 py-4 flex items-start gap-3 mb-6"
      style={{ background: '#fffbeb', border: '1.5px solid #fbbf24' }}
    >
      <span className="text-2xl mt-0.5" aria-hidden="true">&#9888;</span>
      <p className="text-base font-semibold" style={{ color: '#92400e' }}>
        A member of our nursing team will be with you shortly.
      </p>
    </div>
  );
}

function ScaleInput({
  value,
  onChange,
  min = 0,
  max = 10,
  minLabel,
  maxLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}) {
  const numVal = value === '' ? null : parseInt(value, 10);
  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>{minLabel ?? String(min)}</span>
        <span>{maxLabel ?? String(max)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={numVal ?? min}
        onChange={e => onChange(e.target.value)}
        className="w-full h-3 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#1e40af' }}
      />
      <div className="flex justify-between mt-2">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={`w-9 h-9 rounded-full text-base font-bold transition-all ${
              numVal === n
                ? 'bg-blue-700 text-white shadow-md scale-110'
                : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {numVal !== null && (
        <p className="text-center text-2xl font-bold text-blue-700 mt-4">
          {numVal} / {max}
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function APCQTab({ sessionToken: initialToken, templateKey, mode = 'screening', compact = false }: Props) {
  // Session state
  const [screen, setScreen] = useState<ScreenState>('consent');
  const [sessionToken, setSessionToken] = useState<string>(initialToken ?? '');
  const [sessionStarted, setSessionStarted] = useState<boolean>(!!initialToken);

  // Consent state
  const [consentChecked, setConsentChecked] = useState(false);
  const [patientNameInput, setPatientNameInput] = useState('');

  // Questionnaire state
  const [currentQuestion, setCurrentQuestion] = useState<Question>(FALLBACK_QUESTIONS[0]);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [totalEstimated, setTotalEstimated] = useState(FALLBACK_QUESTIONS.length);
  const [answer, setAnswer] = useState<string | string[]>('');
  const [history, setHistory] = useState<Array<{ question: Question; answer: string | string[] }>>([]);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start session on mount if no token provided
  useEffect(() => {
    if (!initialToken) return;
    setSessionToken(initialToken);
    setSessionStarted(true);
  }, [initialToken]);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/questionnaire/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: templateKey ?? 'general_screening',
          mode,
          patientName: patientNameInput.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json() as SessionStartResponse;
        setSessionToken(data.sessionToken);
        setSessionStarted(true);
        setTotalEstimated(data.totalEstimated);
        setCurrentQuestion(mapApiQuestion(data.firstQuestion));
        setQuestionIndex(1);
      } else {
        // Fall back to offline question bank
        setSessionToken(`offline-${Date.now()}`);
        setSessionStarted(true);
        setCurrentQuestion(FALLBACK_QUESTIONS[0]);
        setQuestionIndex(1);
        setTotalEstimated(FALLBACK_QUESTIONS.length);
      }
    } catch {
      // Network unavailable — use offline bank
      setSessionToken(`offline-${Date.now()}`);
      setSessionStarted(true);
      setCurrentQuestion(FALLBACK_QUESTIONS[0]);
      setQuestionIndex(1);
      setTotalEstimated(FALLBACK_QUESTIONS.length);
    } finally {
      setLoading(false);
      setScreen('questioning');
    }
  }, [templateKey, mode, patientNameInput]);

  function mapApiQuestion(q: ApiQuestion): Question {
    return q;
  }

  function detectLocalRedFlags(q: Question, ans: string | string[]): boolean {
    if (!q.redFlagValues || q.redFlagValues.length === 0) return false;
    if (Array.isArray(ans)) {
      return ans.some(a => q.redFlagValues!.includes(a));
    }
    return q.redFlagValues.includes(ans as string);
  }

  function detectOptionRedFlags(q: Question, ans: string | string[]): boolean {
    if (!q.options) return false;
    const vals = Array.isArray(ans) ? ans : [ans as string];
    return vals.some(v => q.options!.find(o => o.value === v)?.redFlag === true);
  }

  async function submitAnswer() {
    if (loading) return;

    const currentAns = answer;
    const newHistory = [...history, { question: currentQuestion, answer: currentAns }];
    setHistory(newHistory);

    // Check red flags locally
    const isRedFlag =
      detectLocalRedFlags(currentQuestion, currentAns) ||
      detectOptionRedFlags(currentQuestion, currentAns);
    if (isRedFlag) {
      setRedFlags(prev => [...prev, currentQuestion.id]);
    }

    // If offline session, use fallback bank
    if (sessionToken.startsWith('offline-')) {
      const nextIdx = questionIndex;
      if (nextIdx < FALLBACK_QUESTIONS.length) {
        setCurrentQuestion(FALLBACK_QUESTIONS[nextIdx]);
        setQuestionIndex(nextIdx + 1);
        setAnswer('');
      } else {
        setScreen('complete');
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questionnaire/session/${sessionToken}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: currentAns,
        }),
      });
      if (res.ok) {
        const data = await res.json() as AnswerResponse;
        if (data.redFlagsDetected?.length > 0) {
          setRedFlags(prev => [...new Set([...prev, ...data.redFlagsDetected])]);
        }
        if (data.complete || !data.nextQuestion) {
          setScreen('complete');
        } else {
          setCurrentQuestion(mapApiQuestion(data.nextQuestion));
          setQuestionIndex(data.questionIndex ?? questionIndex + 1);
          setTotalEstimated(data.totalEstimated ?? totalEstimated);
          setAnswer('');
        }
      } else {
        // Advance using fallback bank on API error
        const nextIdx = questionIndex;
        if (nextIdx < FALLBACK_QUESTIONS.length) {
          setCurrentQuestion(FALLBACK_QUESTIONS[nextIdx]);
          setQuestionIndex(nextIdx + 1);
          setAnswer('');
        } else {
          setScreen('complete');
        }
      }
    } catch {
      // Network error — advance offline
      const nextIdx = questionIndex;
      if (nextIdx < FALLBACK_QUESTIONS.length) {
        setCurrentQuestion(FALLBACK_QUESTIONS[nextIdx]);
        setQuestionIndex(nextIdx + 1);
        setAnswer('');
      } else {
        setScreen('complete');
      }
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCurrentQuestion(prev.question);
    setAnswer(prev.answer);
    setQuestionIndex(Math.max(1, questionIndex - 1));
    // Remove any red flags from the reverted question
    setRedFlags(flags => flags.filter(f => f !== prev.question.id));
  }

  function isAnswerProvided(): boolean {
    if (!currentQuestion.required) return true;
    if (Array.isArray(answer)) return answer.length > 0;
    return (answer as string).trim().length > 0;
  }

  function toggleMulti(value: string) {
    setAnswer(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(value)) return arr.filter(v => v !== value);
      // If selecting "none", clear everything else
      if (value === 'none') return ['none'];
      // If selecting something else, remove "none"
      return [...arr.filter(v => v !== 'none'), value];
    });
  }

  const hasRedFlag = redFlags.length > 0;

  // ── Consent screen ──────────────────────────────────────────────────────────
  if (screen === 'consent') {
    return (
      <div
        className={compact ? '' : 'min-h-screen flex items-center justify-center p-4'}
        style={compact ? { padding: '8px 4px' } : { background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8"
          style={{ border: '1px solid #bfdbfe', ...(compact ? { boxShadow: 'none', border: '1px solid #dbeafe' } : {}) }}
        >
          {/* Practice header */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: '#dbeafe' }}
            >
              <svg className="w-8 h-8" style={{ color: '#1e40af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-1" style={{ color: '#1e3a8a' }}>
              Amise Medical Services
            </h1>
            <p className="text-base" style={{ color: '#6b7280' }}>
              Pre-Consultation Health Questionnaire
            </p>
          </div>

          {/* Consent text */}
          <div
            className="rounded-xl p-5 mb-6 text-sm leading-relaxed"
            style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e' }}
          >
            <p>
              I consent to the collection of my health information for the purpose of
              improving my care at Amise Medical Services. This information is
              confidential and accessible only to your care team. Data is stored
              securely and protected in accordance with Saint Lucia's Electronic
              Health Records Act.
            </p>
          </div>

          {/* Consent checkbox */}
          <label
            className="flex items-start gap-3 cursor-pointer mb-6 p-4 rounded-xl transition-colors hover:bg-blue-50"
            style={{ border: '1.5px solid', borderColor: consentChecked ? '#1e40af' : '#e5e7eb' }}
          >
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded cursor-pointer"
              style={{ accentColor: '#1e40af' }}
            />
            <span className="text-base font-medium" style={{ color: '#1e3a8a' }}>
              I have read and agree to the above
            </span>
          </label>

          {/* Patient name */}
          <div className="mb-8">
            <label
              htmlFor="patient-name"
              className="block text-sm font-semibold mb-2"
              style={{ color: '#374151' }}
            >
              Please enter your full name to confirm
            </label>
            <input
              id="patient-name"
              type="text"
              value={patientNameInput}
              onChange={e => setPatientNameInput(e.target.value)}
              placeholder="e.g. Marie Joseph"
              className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all"
              style={{
                border: '2px solid',
                borderColor: patientNameInput.trim() ? '#1e40af' : '#d1d5db',
                background: '#fff',
                color: '#111827',
              }}
            />
          </div>

          {/* Begin button */}
          <button
            type="button"
            disabled={!consentChecked || !patientNameInput.trim() || loading}
            onClick={startSession}
            className="w-full py-4 rounded-2xl text-lg font-bold text-white transition-all"
            style={{
              background:
                consentChecked && patientNameInput.trim() && !loading
                  ? '#1e40af'
                  : '#93c5fd',
              cursor:
                consentChecked && patientNameInput.trim() && !loading
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            {loading ? 'Starting…' : 'Begin Questionnaire'}
          </button>
        </div>
      </div>
    );
  }

  // ── Complete screen ─────────────────────────────────────────────────────────
  if (screen === 'complete') {
    return (
      <div
        className={compact ? '' : 'min-h-screen flex items-center justify-center p-4'}
        style={compact ? { padding: '16px 4px' } : { background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
      >
        <div
          className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-10 text-center"
          style={{ border: '1px solid #bfdbfe' }}
        >
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
            style={{ background: '#dcfce7' }}
          >
            <svg className="w-10 h-10" style={{ color: '#166534' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: '#14532d' }}>
            Thank You
          </h2>
          <p className="text-lg leading-relaxed mb-6" style={{ color: '#374151' }}>
            Your responses have been recorded. Please let the nurse know you have
            completed the form.
          </p>
          {hasRedFlag && (
            <div
              className="rounded-xl px-5 py-4 text-base font-semibold"
              style={{ background: '#fffbeb', border: '1.5px solid #fbbf24', color: '#92400e' }}
            >
              A member of our nursing team will be with you shortly.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Questioning screen ──────────────────────────────────────────────────────
  return (
    <div
      className={compact ? '' : 'min-h-screen flex items-center justify-center p-4'}
      style={compact ? { padding: '8px 4px' } : { background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
    >
      <div className="w-full max-w-2xl">
        {/* Red flag banner */}
        {hasRedFlag && <RedFlagBanner />}

        {/* Card */}
        <div
          className="bg-white rounded-2xl shadow-xl p-8"
          style={{ border: '1px solid #bfdbfe' }}
        >
          {/* Progress */}
          <div className="mb-8">
            <ProgressBar current={questionIndex} total={totalEstimated} />
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold mb-2 leading-snug" style={{ color: '#1e3a8a' }}>
            {currentQuestion.text}
          </h2>
          {currentQuestion.helpText && (
            <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
              {currentQuestion.helpText}
            </p>
          )}
          {!currentQuestion.helpText && <div className="mb-6" />}

          {/* Answer inputs */}
          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswer(opt.value)}
                  className="w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all"
                  style={{
                    border: '2px solid',
                    borderColor: answer === opt.value ? '#1e40af' : '#e5e7eb',
                    background: answer === opt.value ? '#eff6ff' : '#fff',
                    color: answer === opt.value ? '#1e3a8a' : '#374151',
                  }}
                >
                  <span
                    className="inline-block w-5 h-5 rounded-full mr-3 border-2 align-middle"
                    style={{
                      borderColor: answer === opt.value ? '#1e40af' : '#d1d5db',
                      background: answer === opt.value ? '#1e40af' : 'transparent',
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'multi_choice' && currentQuestion.options && (
            <div className="space-y-3">
              {currentQuestion.options.map(opt => {
                const selected = Array.isArray(answer) && answer.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleMulti(opt.value)}
                    className="w-full text-left px-5 py-4 rounded-xl text-base font-medium transition-all"
                    style={{
                      border: '2px solid',
                      borderColor: selected ? '#1e40af' : '#e5e7eb',
                      background: selected ? '#eff6ff' : '#fff',
                      color: selected ? '#1e3a8a' : '#374151',
                    }}
                  >
                    <span
                      className="inline-block w-5 h-5 rounded mr-3 border-2 align-middle"
                      style={{
                        borderColor: selected ? '#1e40af' : '#d1d5db',
                        background: selected ? '#1e40af' : 'transparent',
                      }}
                    />
                    {opt.label}
                    {opt.redFlag && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: '#fef3c7', color: '#92400e' }}
                      >
                        Important
                      </span>
                    )}
                  </button>
                );
              })}
              <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
                Select all that apply
              </p>
            </div>
          )}

          {currentQuestion.type === 'boolean' && (
            <div className="flex gap-4 mt-2">
              {(['yes', 'no'] as const).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAnswer(val)}
                  className="flex-1 py-5 rounded-2xl text-xl font-bold transition-all"
                  style={{
                    border: '2.5px solid',
                    borderColor:
                      answer === val
                        ? val === 'yes' ? '#1e40af' : '#374151'
                        : '#e5e7eb',
                    background:
                      answer === val
                        ? val === 'yes' ? '#1e40af' : '#374151'
                        : '#f9fafb',
                    color: answer === val ? '#fff' : '#374151',
                  }}
                >
                  {val === 'yes' ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          )}

          {currentQuestion.type === 'scale' && (
            <ScaleInput
              value={Array.isArray(answer) ? '' : (answer as string)}
              onChange={v => setAnswer(v)}
              min={currentQuestion.scaleMin ?? 0}
              max={currentQuestion.scaleMax ?? 10}
              minLabel={currentQuestion.scaleMinLabel}
              maxLabel={currentQuestion.scaleMaxLabel}
            />
          )}

          {currentQuestion.type === 'text' && (
            <textarea
              value={Array.isArray(answer) ? '' : (answer as string)}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type your answer here…"
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none transition-all"
              style={{
                border: '2px solid',
                borderColor:
                  (!Array.isArray(answer) && (answer as string).trim())
                    ? '#1e40af'
                    : '#d1d5db',
                background: '#fff',
                color: '#111827',
              }}
            />
          )}

          {currentQuestion.type === 'date' && (
            <input
              type="date"
              value={Array.isArray(answer) ? '' : (answer as string)}
              onChange={e => setAnswer(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-base outline-none transition-all"
              style={{
                border: '2px solid',
                borderColor:
                  (!Array.isArray(answer) && (answer as string).trim())
                    ? '#1e40af'
                    : '#d1d5db',
                background: '#fff',
                color: '#111827',
              }}
            />
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm" style={{ color: '#dc2626' }}>{error}</p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={goBack}
              disabled={history.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-base font-semibold transition-all"
              style={{
                background: history.length === 0 ? '#f9fafb' : '#f3f4f6',
                color: history.length === 0 ? '#d1d5db' : '#374151',
                border: '1.5px solid',
                borderColor: history.length === 0 ? '#e5e7eb' : '#d1d5db',
                cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>

            <button
              type="button"
              onClick={submitAnswer}
              disabled={!isAnswerProvided() || loading}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-base font-bold text-white transition-all"
              style={{
                background:
                  isAnswerProvided() && !loading ? '#1e40af' : '#93c5fd',
                cursor:
                  isAnswerProvided() && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Kiosk footer */}
        <p className="text-center text-xs mt-4" style={{ color: '#93c5fd' }}>
          Amise Medical Services · Powered by MedFlow EMR
        </p>
      </div>
    </div>
  );
}

export { timeAgo };
