import { useState, useEffect, useCallback } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { getSupabase } from '@/lib/supabase';
import { useAppContext } from '@/context/AppContext';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AppState = 'idle' | 'launching' | 'ready';

type TemplateKey =
  | 'general_screening'
  | 'abdominal_pain'
  | 'upper_gi'
  | 'colorectal'
  | 'breast'
  | 'post_op';

type SessionMode = 'screening' | 'condition_specific';

interface SessionStartResponse {
  sessionId: string;
  sessionToken: string;
  firstQuestion: unknown;
  totalEstimated: number;
}

interface RedFlagItem {
  questionId: string;
  severity: 'high' | 'medium' | 'low';
  label?: string;
}

type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'nurse_reviewed' | 'doctor_approved';

interface QueueSession {
  sessionToken: string;
  patientName: string | null;
  templateKey: string;
  status: SessionStatus;
  createdAt: string;
  redFlags: RedFlagItem[];
}

interface QueueResponse {
  sessions: QueueSession[];
}

interface SendSmsResponse {
  sent: boolean;
  messageSid?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATES: { key: TemplateKey; label: string }[] = [
  { key: 'general_screening', label: 'General Screening' },
  { key: 'abdominal_pain',    label: 'Abdominal Pain' },
  { key: 'upper_gi',          label: 'Upper GI / Endoscopy' },
  { key: 'colorectal',        label: 'Colorectal / Bowel' },
  { key: 'breast',            label: 'Breast Surgery' },
  { key: 'post_op',           label: 'Post-Op Review' },
];

const TEMPLATE_LABEL: Record<string, string> = Object.fromEntries(
  TEMPLATES.map(t => [t.key, t.label]),
);

const MODE_OPTIONS: { value: SessionMode; label: string }[] = [
  { value: 'screening',         label: 'Screening' },
  { value: 'condition_specific', label: 'Condition Specific' },
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

function maxSeverity(flags: RedFlagItem[]): 'high' | 'medium' | 'low' | null {
  if (flags.length === 0) return null;
  if (flags.some(f => f.severity === 'high')) return 'high';
  if (flags.some(f => f.severity === 'medium')) return 'medium';
  return 'low';
}

function statusStyle(status: SessionStatus): { bg: string; text: string; border: string; label: string } {
  switch (status) {
    case 'pending':
      return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: 'Pending' };
    case 'in_progress':
      return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', label: 'In Progress' };
    case 'completed':
      return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24', label: 'Awaiting Review' };
    case 'nurse_reviewed':
      return { bg: '#d1fae5', text: '#065f46', border: '#34d399', label: 'Nurse Reviewed' };
    case 'doctor_approved':
      return { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa', label: 'Doctor Approved' };
  }
}

function redFlagBadgeStyle(severity: 'high' | 'medium' | 'low'): React.CSSProperties {
  switch (severity) {
    case 'high':   return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    case 'medium': return { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' };
    case 'low':    return { background: '#fefce8', color: '#854d0e', border: '1px solid #fde047' };
  }
}

function buildPatientUrl(token: string): string {
  const raw = (import.meta.env.VITE_PATIENT_APP_URL as string | undefined) ?? '';
  const base = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '')
    || 'https://front-desk-amisesuite-afks-projects.vercel.app';
  return `${base}/questionnaire/${token}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ color: '#1e40af' }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function ClipboardIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function CopyButton({ text, label = 'Copy Link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: copied ? '#d1fae5' : '#f3f4f6',
        color: copied ? '#065f46' : '#374151',
        border: `1.5px solid ${copied ? '#34d399' : '#e5e7eb'}`,
      }}
    >
      {copied ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon size={16} />
          {label}
        </>
      )}
    </button>
  );
}

function QueueSessionRow({ session }: { session: QueueSession }) {
  const style = statusStyle(session.status);
  const sev = maxSeverity(session.redFlags);
  const patientUrl = buildPatientUrl(session.sessionToken);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
    >
      {/* Left: meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
            {session.patientName ?? 'Anonymous'}
          </span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
          >
            {style.label}
          </span>
          {session.redFlags.length > 0 && sev && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={redFlagBadgeStyle(sev)}
            >
              <span aria-hidden="true">&#9888;</span>
              {session.redFlags.length} flag{session.redFlags.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
          {TEMPLATE_LABEL[session.templateKey] ?? session.templateKey} · {timeAgo(session.createdAt)}
        </div>
      </div>

      {/* Right: copy link */}
      <CopyButton text={patientUrl} label="Copy Link" />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function QuestionnaireManagerTab() {
  const { patientId: checkedInPatientId, patientName: checkedInPatientName } = useAppContext();

  // Form state
  const [templateKey, setTemplateKey] = useState<TemplateKey>('general_screening');
  const [mode, setMode] = useState<SessionMode>('screening');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientName, setPatientName] = useState('');

  // Prefill the patient name from the most recently checked-in patient
  useEffect(() => {
    if (checkedInPatientName && !patientName) setPatientName(checkedInPatientName);
  }, [checkedInPatientName, patientName]);

  // State machine
  const [appState, setAppState] = useState<AppState>('idle');
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Session result
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [patientUrl, setPatientUrl] = useState<string | null>(null);

  // SMS state
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Queue state
  const [queue, setQueue] = useState<QueueSession[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  // ── Queue fetch ────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    try {
      const client = getSupabase();
      const session = client ? (await client.auth.getSession()).data.session : null;
      const res = await fetch(apiUrl('/api/questionnaire/nurse/queue'), {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.ok) {
        const data = await res.json() as QueueResponse;
        setQueue((data.sessions ?? []).slice(0, 10));
        setQueueError(null);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      // Fallback: query Supabase directly when the API server is unreachable
      const client = getSupabase();
      if (client) {
        try {
          const { data, error: sbErr } = await client
            .from('questionnaire_sessions')
            .select('session_token, patient_name, template_key, status, created_at, red_flags')
            .in('status', ['in_progress', 'completed', 'nurse_reviewed'])
            .order('created_at', { ascending: false })
            .limit(10);
          if (!sbErr && data) {
            setQueue(data.map((s: Record<string, unknown>) => ({
              sessionToken: s.session_token as string,
              patientName: (s.patient_name as string) ?? null,
              templateKey: s.template_key as string,
              status: s.status as SessionStatus,
              createdAt: s.created_at as string,
              redFlags: Array.isArray(s.red_flags) ? s.red_flags as RedFlagItem[] : [],
            })));
            setQueueError(null);
            return;
          }
        } catch { /* Supabase fallback also failed */ }
      }
      setQueueError('Unable to load queue. Please refresh.');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  // ── Start session ──────────────────────────────────────────────────────────

  async function handleStart() {
    setAppState('launching');
    setLaunchError(null);
    setSmsResult(null);

    try {
      const res = await fetch(apiUrl('/api/questionnaire/session/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey,
          mode,
          patientName: patientName.trim() || undefined,
          patientId: checkedInPatientId ?? undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data = await res.json() as SessionStartResponse;
      const token = data.sessionToken;
      const url = buildPatientUrl(token);

      setSessionToken(token);
      setPatientUrl(url);
      setAppState('ready');

      // Refresh queue so new session appears
      void fetchQueue();
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to start session. Please try again.');
      setAppState('idle');
    }
  }

  // ── Send SMS ───────────────────────────────────────────────────────────────

  async function handleSendSms() {
    if (!sessionToken || !patientPhone.trim()) return;
    setSmsSending(true);
    setSmsResult(null);

    try {
      const res = await fetch(apiUrl('/api/questionnaire/send-sms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          phone: patientPhone.trim(),
          patientName: patientName.trim() || undefined,
        }),
      });

      const data = await res.json() as SendSmsResponse | { error?: string };

      if (res.ok && 'sent' in data && data.sent) {
        setSmsResult({ ok: true, message: 'SMS sent successfully.' });
      } else {
        const errMsg = ('error' in data && typeof data.error === 'string') ? data.error : 'SMS could not be sent.';
        setSmsResult({ ok: false, message: errMsg });
      }
    } catch {
      setSmsResult({ ok: false, message: 'Network error — SMS could not be sent.' });
    } finally {
      setSmsSending(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    setAppState('idle');
    setSessionToken(null);
    setPatientUrl(null);
    setLaunchError(null);
    setSmsResult(null);
    setPatientPhone('');
    setPatientName('');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="gap-y" style={{ maxWidth: 720 }}>

      {/* ── Start Questionnaire panel ─────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        style={{ border: '1px solid #e5e7eb' }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: '#dbeafe' }}
          >
            <svg className="w-5 h-5" style={{ color: '#1e40af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#111827' }}>
              Start Questionnaire
            </h2>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              Create a new APCQ session for a waiting patient
            </p>
          </div>
        </div>

        {/* Form fields */}
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div className="fld" style={{ marginBottom: 0 }}>
            <label>Template</label>
            <select
              value={templateKey}
              onChange={e => setTemplateKey(e.target.value as TemplateKey)}
              disabled={appState === 'launching'}
            >
              {TEMPLATES.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="fld" style={{ marginBottom: 0 }}>
            <label>Mode</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as SessionMode)}
              disabled={appState === 'launching'}
            >
              {MODE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="fld" style={{ marginBottom: 0 }}>
            <label>Patient name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              placeholder="e.g. Marie Joseph"
              disabled={appState === 'launching'}
            />
          </div>

          <div className="fld" style={{ marginBottom: 0 }}>
            <label>Patient phone <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional, for SMS)</span></label>
            <input
              type="tel"
              inputMode="tel"
              value={patientPhone}
              onChange={e => setPatientPhone(e.target.value)}
              placeholder="+1868XXXXXXX"
              disabled={appState === 'launching'}
            />
          </div>
        </div>

        {/* Patient linkage indicator */}
        {appState !== 'ready' && (
          <div
            className="px-3 py-2 rounded-lg text-xs mb-4"
            style={checkedInPatientId
              ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#166534' }
              : { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
            }
          >
            {checkedInPatientId
              ? <>Linked to <strong>{checkedInPatientName || 'checked-in patient'}</strong>'s record — responses will be added to their EMR chart once reviewed and approved.</>
              : 'No patient record linked — check this patient in first so responses can be added to their EMR chart.'}
          </div>
        )}

        {/* Launch error */}
        {launchError && (
          <div
            className="px-4 py-3 rounded-lg text-sm mb-4"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}
          >
            {launchError}
          </div>
        )}

        {/* Start button */}
        {appState !== 'ready' && (
          <button
            type="button"
            onClick={() => { void handleStart(); }}
            disabled={appState === 'launching'}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-base font-bold text-white transition-all"
            style={{
              background: appState === 'launching' ? '#93c5fd' : '#1d4ed8',
              cursor: appState === 'launching' ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {appState === 'launching' ? (
              <>
                <Spinner size={18} />
                Starting session…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
                Start Questionnaire
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Result panel ──────────────────────────────────────────────────── */}
      {appState === 'ready' && sessionToken && patientUrl && (
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          style={{ border: '1px solid #e5e7eb' }}
        >
          {/* Success banner */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg mb-6"
            style={{ background: '#d1fae5', border: '1px solid #34d399' }}
          >
            <svg className="w-5 h-5 shrink-0" style={{ color: '#065f46' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <div>
              <p className="text-sm font-bold" style={{ color: '#065f46' }}>Session started</p>
              <p className="text-xs" style={{ color: '#047857' }}>
                {TEMPLATE_LABEL[templateKey]} · {MODE_OPTIONS.find(o => o.value === mode)?.label}
                {patientName.trim() ? ` · ${patientName.trim()}` : ''}
              </p>
            </div>
          </div>

          {/* Patient URL */}
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>
              Patient Link
            </p>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ background: '#f8fafc', border: '1.5px solid #bfdbfe' }}
            >
              <span
                className="flex-1 text-sm font-mono truncate"
                style={{ color: '#1e3a8a' }}
              >
                {patientUrl}
              </span>
              <CopyButton text={patientUrl} />
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center mb-6">
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
              Scan to Open on Patient Device
            </p>
            <div
              className="p-3 rounded-xl"
              style={{ background: '#fff', border: '2px solid #e5e7eb', display: 'inline-block' }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(patientUrl)}`}
                alt="QR code for patient questionnaire link"
                width={200}
                height={200}
                style={{ display: 'block', borderRadius: 6 }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
              Patient token: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{sessionToken}</code>
            </p>
          </div>

          {/* SMS section */}
          {patientPhone.trim() ? (
            <div
              className="rounded-lg px-4 py-4 mb-5"
              style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#0369a1' }}>
                Send via SMS
              </p>
              <p className="text-sm mb-3" style={{ color: '#374151' }}>
                Send the link to <strong>{patientPhone.trim()}</strong>
                {patientName.trim() ? ` (${patientName.trim()})` : ''}.
              </p>

              {smsResult ? (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: smsResult.ok ? '#d1fae5' : '#fef2f2',
                    color: smsResult.ok ? '#065f46' : '#991b1b',
                    border: `1px solid ${smsResult.ok ? '#34d399' : '#fca5a5'}`,
                  }}
                >
                  {smsResult.ok ? (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                  {smsResult.message}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleSendSms(); }}
                  disabled={smsSending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                  style={{
                    background: smsSending ? '#93c5fd' : '#1d4ed8',
                    cursor: smsSending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {smsSending ? (
                    <>
                      <Spinner size={16} />
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      Send via SMS
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-xs"
              style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af' }}
            >
              No phone number entered — SMS delivery not available for this session.
            </div>
          )}

          {/* Start new session */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: '#f3f4f6',
                color: '#374151',
                border: '1.5px solid #e5e7eb',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Start New Session
            </button>
          </div>
        </div>
      )}

      {/* ── Recent Sessions panel ─────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        style={{ border: '1px solid #e5e7eb' }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: '#f0fdf4' }}
            >
              <svg className="w-5 h-5" style={{ color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: '#111827' }}>
                Recent Sessions
              </h2>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {queue.length > 0
                  ? `${queue.length} session${queue.length !== 1 ? 's' : ''} · last 10 shown`
                  : 'No sessions yet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setQueueLoading(true); void fetchQueue(); }}
            disabled={queueLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
          >
            {queueLoading ? (
              <Spinner size={13} />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
        </div>

        {/* Queue error */}
        {queueError && (
          <div
            className="px-4 py-3 rounded-lg text-sm mb-3"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}
          >
            {queueError}
          </div>
        )}

        {/* Loading state */}
        {queueLoading && queue.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={28} />
          </div>
        ) : queue.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center py-14 rounded-xl"
            style={{ background: '#f9fafb', border: '1.5px dashed #d1d5db' }}
          >
            <div style={{ color: '#d1d5db', marginBottom: 12 }}>
              <ClipboardIcon size={48} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#6b7280' }}>
              No sessions yet
            </p>
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
              Start a questionnaire above to create the first session
            </p>
          </div>
        ) : (
          /* Session rows */
          <div className="flex flex-col gap-2">
            {queue.map(session => (
              <QueueSessionRow key={session.sessionToken} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
