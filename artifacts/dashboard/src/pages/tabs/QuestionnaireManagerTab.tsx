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

// ── Walk-in questionnaire types ────────────────────────────────────────────────

interface WalkInAnswers {
  chiefComplaint: string;
  duration: string;
  severity: string;
  onset: string;
  aggravating: string;
  relieving: string;
  associated: string[];
  pmhx: string[];
  medications: string;
  allergies: string;
  familyHistory: string;
  smoking: string;
  alcohol: string;
  previousSurgery: string;
  lastMeal: string;
  additionalNotes: string;
}

const BLANK_WALKIN: WalkInAnswers = {
  chiefComplaint: '',
  duration: '',
  severity: '0',
  onset: '',
  aggravating: '',
  relieving: '',
  associated: [],
  pmhx: [],
  medications: '',
  allergies: '',
  familyHistory: '',
  smoking: '',
  alcohol: '',
  previousSurgery: '',
  lastMeal: '',
  additionalNotes: '',
};

const ASSOCIATED_SYMPTOMS = [
  'Nausea / vomiting', 'Fever / chills', 'Loss of appetite', 'Weight loss (unintentional)',
  'Change in bowel habit', 'Rectal bleeding', 'Blood in vomit', 'Jaundice',
  'Abdominal distension', 'Dysphagia', 'Heartburn / reflux', 'Urinary symptoms',
  'Shortness of breath', 'Chest pain', 'Dizziness / syncope', 'Night sweats',
];

const PMHX_OPTS = [
  'Diabetes mellitus', 'Hypertension', 'Ischaemic heart disease', 'Heart failure',
  'Asthma / COPD', 'Chronic kidney disease', 'Liver disease / cirrhosis',
  'Peptic ulcer disease', 'Cancer (previous)', 'Inflammatory bowel disease',
  'Thyroid disease', 'Stroke / TIA', 'DVT / PE', 'Anaemia', 'HIV / AIDS',
  'None significant',
];

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

function statusChip(status: SessionStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':       return { bg: '#f3f4f6', text: '#374151', label: 'Pending' };
    case 'in_progress':   return { bg: '#eff6ff', text: '#1e40af', label: 'In Progress' };
    case 'completed':     return { bg: '#fef3c7', text: '#92400e', label: 'Awaiting Review' };
    case 'nurse_reviewed':return { bg: '#d1fae5', text: '#065f46', label: 'Nurse Reviewed' };
    case 'doctor_approved':return { bg: '#dbeafe', text: '#1e40af', label: 'Doctor Approved' };
  }
}

function buildPatientUrl(token: string): string {
  const raw = (import.meta.env.VITE_PATIENT_APP_URL as string | undefined) ?? '';
  const base = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '')
    || 'https://front-desk-amisesuite-afks-projects.vercel.app';
  return `${base}/questionnaire/${token}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={handleCopy} style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      background: copied ? '#d1fae5' : '#f3f4f6',
      color: copied ? '#065f46' : '#374151',
      border: `1px solid ${copied ? '#34d399' : '#e5e7eb'}`,
    }}>
      {copied ? '✓ Copied' : 'Copy Link'}
    </button>
  );
}

function QueueSessionRow({ session }: { session: QueueSession }) {
  const chip = statusChip(session.status);
  const sev = maxSeverity(session.redFlags);
  const patientUrl = buildPatientUrl(session.sessionToken);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{session.patientName ?? 'Anonymous'}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: chip.bg, color: chip.text }}>{chip.label}</span>
          {session.redFlags.length > 0 && sev && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: sev === 'high' ? '#fee2e2' : sev === 'medium' ? '#fef3c7' : '#fefce8',
              color: sev === 'high' ? '#991b1b' : sev === 'medium' ? '#92400e' : '#854d0e' }}>
              ⚠ {session.redFlags.length} flag{session.redFlags.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          {TEMPLATE_LABEL[session.templateKey] ?? session.templateKey} · {timeAgo(session.createdAt)}
        </div>
      </div>
      <CopyButton text={patientUrl} />
    </div>
  );
}

// ── Walk-in questionnaire ──────────────────────────────────────────────────────

function WalkInQuestionnaire() {
  const { patientName } = useAppContext();
  const [answers, setAnswers] = useState<WalkInAnswers>(BLANK_WALKIN);
  const [submitted, setSubmitted] = useState(false);

  function set<K extends keyof WalkInAnswers>(k: K, v: WalkInAnswers[K]) {
    setAnswers(prev => ({ ...prev, [k]: v }));
  }

  function toggleMulti(field: 'associated' | 'pmhx', val: string) {
    const current = answers[field];
    set(field, current.includes(val) ? current.filter(x => x !== val) : [...current, val]);
  }

  function handleSubmit() {
    setSubmitted(true);
    // Store locally (AppContext autosave will pick up any mapped fields)
  }

  function handleReset() {
    setAnswers(BLANK_WALKIN);
    setSubmitted(false);
  }

  const sev = parseInt(answers.severity);

  if (submitted) {
    return (
      <div style={{ padding: '20px 16px', textAlign: 'center', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac' }}>
        <div style={{ fontSize: 20 }}>✓</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#166534', marginTop: 6 }}>Assessment recorded</div>
        <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>{patientName || 'Patient'}'s walk-in assessment has been captured.</div>
        <button type="button" onClick={handleReset}
          style={{ marginTop: 14, padding: '8px 20px', borderRadius: 7, border: '1px solid #d1fae5', background: '#fff', color: '#065f46', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
          New Assessment
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Chief complaint */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
          1. Chief complaint — why is the patient here today? <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea value={answers.chiefComplaint} onChange={e => set('chiefComplaint', e.target.value)}
          placeholder="Describe the main problem in the patient's own words…"
          style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      {/* Duration · Onset */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>2. Duration</label>
          <input type="text" value={answers.duration} onChange={e => set('duration', e.target.value)}
            placeholder="e.g. 3 days, 2 weeks, 6 months"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>3. Onset</label>
          <select value={answers.onset} onChange={e => set('onset', e.target.value)}
            style={{ width: '100%', fontSize: 12, padding: '7px 8px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }}>
            <option value="">— Select —</option>
            <option value="sudden">Sudden (minutes)</option>
            <option value="rapid">Rapid (hours)</option>
            <option value="gradual">Gradual (days)</option>
            <option value="insidious">Insidious (weeks–months)</option>
          </select>
        </div>
      </div>

      {/* Pain severity */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
          4. Severity / pain score: <span style={{ color: sev >= 8 ? '#dc2626' : sev >= 5 ? '#d97706' : '#059669', fontWeight: 800, fontSize: 13 }}>{answers.severity} / 10</span>
        </label>
        <input type="range" min={0} max={10} step={1} value={answers.severity} onChange={e => set('severity', e.target.value)}
          style={{ width: '100%', accentColor: sev >= 8 ? '#dc2626' : sev >= 5 ? '#d97706' : '#0d9488' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
          <span>0 — None</span><span>5 — Moderate</span><span>10 — Worst imaginable</span>
        </div>
      </div>

      {/* Aggravating · Relieving */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>5. Aggravating factors</label>
          <input type="text" value={answers.aggravating} onChange={e => set('aggravating', e.target.value)}
            placeholder="e.g. eating, movement, lying down"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>6. Relieving factors</label>
          <input type="text" value={answers.relieving} onChange={e => set('relieving', e.target.value)}
            placeholder="e.g. antacids, rest, fasting"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Associated symptoms */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>7. Associated symptoms (tick all that apply)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 12px' }}>
          {ASSOCIATED_SYMPTOMS.map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#374151' }}>
              <input type="checkbox" checked={answers.associated.includes(s)} onChange={() => toggleMulti('associated', s)}
                style={{ accentColor: '#0d9488', width: 13, height: 13, flexShrink: 0 }} />
              {s}
            </label>
          ))}
        </div>
      </div>

      {/* Past medical history */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>8. Past medical history (tick all that apply)</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 12px' }}>
          {PMHX_OPTS.map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#374151' }}>
              <input type="checkbox" checked={answers.pmhx.includes(s)} onChange={() => toggleMulti('pmhx', s)}
                style={{ accentColor: '#0d9488', width: 13, height: 13, flexShrink: 0 }} />
              {s}
            </label>
          ))}
        </div>
      </div>

      {/* Medications · Allergies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>9. Current medications</label>
          <textarea value={answers.medications} onChange={e => set('medications', e.target.value)}
            placeholder="List medications and doses…"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>10. Allergies</label>
          <textarea value={answers.allergies} onChange={e => set('allergies', e.target.value)}
            placeholder="Drug / food / latex allergies and reactions…"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Family history · Social */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>11. Family history</label>
          <input type="text" value={answers.familyHistory} onChange={e => set('familyHistory', e.target.value)}
            placeholder="e.g. Ca colon — father"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>12. Smoking</label>
          <select value={answers.smoking} onChange={e => set('smoking', e.target.value)}
            style={{ width: '100%', fontSize: 12, padding: '7px 8px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }}>
            <option value="">— Select —</option>
            <option value="never">Never</option>
            <option value="ex">Ex-smoker</option>
            <option value="current_light">Current — light (&lt;10/day)</option>
            <option value="current_heavy">Current — heavy (≥10/day)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>13. Alcohol</label>
          <select value={answers.alcohol} onChange={e => set('alcohol', e.target.value)}
            style={{ width: '100%', fontSize: 12, padding: '7px 8px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }}>
            <option value="">— Select —</option>
            <option value="none">None</option>
            <option value="social">Social / occasional</option>
            <option value="moderate">Moderate (1–2 standard/day)</option>
            <option value="heavy">Heavy (&gt;3 standard/day)</option>
          </select>
        </div>
      </div>

      {/* Previous surgery · Last meal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>14. Previous surgery</label>
          <input type="text" value={answers.previousSurgery} onChange={e => set('previousSurgery', e.target.value)}
            placeholder="e.g. Appendicectomy 2015, none"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>15. Last meal / drink</label>
          <input type="text" value={answers.lastMeal} onChange={e => set('lastMeal', e.target.value)}
            placeholder="e.g. Breakfast at 07:00 today"
            style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Additional notes */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>16. Additional clinical notes</label>
        <textarea value={answers.additionalNotes} onChange={e => set('additionalNotes', e.target.value)}
          placeholder="Any other relevant information…"
          style={{ width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} />
      </div>

      <button type="button" onClick={handleSubmit} disabled={!answers.chiefComplaint.trim()}
        style={{
          padding: '10px 24px', borderRadius: 8, border: 'none', cursor: answers.chiefComplaint.trim() ? 'pointer' : 'not-allowed',
          background: answers.chiefComplaint.trim() ? '#0d9488' : '#9ca3af',
          color: '#fff', fontWeight: 700, fontSize: 13,
        }}>
        ✓ Save Walk-in Assessment
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function QuestionnaireManagerTab() {
  const { patientId: checkedInPatientId, patientName: checkedInPatientName } = useAppContext();

  const [templateKey, setTemplateKey] = useState<TemplateKey>('general_screening');
  const [mode, setMode] = useState<SessionMode>('screening');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [activeSection, setActiveSection] = useState<'remote' | 'walkin'>('walkin');

  useEffect(() => {
    if (checkedInPatientName && !patientName) setPatientName(checkedInPatientName);
  }, [checkedInPatientName, patientName]);

  const [appState, setAppState] = useState<AppState>('idle');
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [patientUrl, setPatientUrl] = useState<string | null>(null);
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [queue, setQueue] = useState<QueueSession[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const client = getSupabase();
      const session = client ? (await client.auth.getSession()).data.session : null;
      const res = await fetch(apiUrl('/api/questionnaire/nurse/queue'), {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as QueueResponse;
        setQueue((data.sessions ?? []).slice(0, 10));
        setQueueError(null);
      } else throw new Error(`HTTP ${res.status}`);
    } catch {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error: sbErr } = await client
            .from('questionnaire_sessions')
            .select('session_token, status, created_at, red_flags_detected, template:questionnaire_templates(name), patient:patients(full_name)')
            .in('status', ['in_progress', 'completed', 'nurse_reviewed'])
            .order('created_at', { ascending: false })
            .limit(10);
          if (!sbErr && data) {
            setQueue(data.map((s: Record<string, unknown>) => {
              const tmpl = s.template as { name?: string } | null;
              const pat = s.patient as { full_name?: string } | null;
              return {
                sessionToken: s.session_token as string,
                patientName: pat?.full_name ?? null,
                templateKey: tmpl?.name ?? 'unknown',
                status: s.status as SessionStatus,
                createdAt: s.created_at as string,
                redFlags: Array.isArray(s.red_flags_detected) ? s.red_flags_detected as RedFlagItem[] : [],
              };
            }));
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

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  async function handleStart() {
    setAppState('launching');
    setLaunchError(null);
    setSmsResult(null);
    try {
      const res = await fetch(apiUrl('/api/questionnaire/session/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey, mode,
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
      void fetchQueue();
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to start session. Please try again.');
      setAppState('idle');
    }
  }

  async function handleSendSms() {
    if (!sessionToken || !patientPhone.trim()) return;
    setSmsSending(true);
    setSmsResult(null);
    try {
      const res = await fetch(apiUrl('/api/questionnaire/send-sms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, phone: patientPhone.trim(), patientName: patientName.trim() || undefined }),
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

  function handleReset() {
    setAppState('idle');
    setSessionToken(null);
    setPatientUrl(null);
    setLaunchError(null);
    setSmsResult(null);
    setPatientPhone('');
    setPatientName('');
  }

  const panel: React.CSSProperties = {
    background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
  };

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Section toggle ── */}
      <div style={{ display: 'flex', gap: 0, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
        {([
          { id: 'walkin', label: '📋 In-Room Assessment' },
          { id: 'remote', label: '📱 Send to Patient Device' },
        ] as const).map(s => (
          <button key={s.id} type="button" onClick={() => setActiveSection(s.id)} style={{
            flex: 1, padding: '7px 12px', borderRadius: 6, border: 'none',
            background: activeSection === s.id ? '#fff' : 'transparent',
            boxShadow: activeSection === s.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            color: activeSection === s.id ? '#0d9488' : '#64748b',
            fontWeight: activeSection === s.id ? 700 : 500,
            fontSize: 12, cursor: 'pointer',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Walk-in: in-room pre-formed questionnaire ── */}
      {activeSection === 'walkin' && (
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              📋
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                Walk-in Assessment — {checkedInPatientName || 'Patient'}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                Staff-assisted — fill in with the patient sitting in front of you
              </div>
            </div>
          </div>
          <WalkInQuestionnaire />
        </div>
      )}

      {/* ── Remote: send questionnaire to patient device ── */}
      {activeSection === 'remote' && (
        <>
          {/* Start panel */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                📱
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Send Questionnaire to Patient</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Patient fills it in on their own phone or tablet via link / QR code</div>
              </div>
            </div>

            {/* Form */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>Template</label>
                <select value={templateKey} onChange={e => setTemplateKey(e.target.value as TemplateKey)} disabled={appState === 'launching'}>
                  {TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value as SessionMode)} disabled={appState === 'launching'}>
                  {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>Patient name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="e.g. Marie Joseph" disabled={appState === 'launching'} />
              </div>
              <div className="fld" style={{ marginBottom: 0 }}>
                <label>Patient phone <span style={{ color: '#9ca3af', fontWeight: 400 }}>(for SMS)</span></label>
                <input type="tel" inputMode="tel" value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="+1758XXXXXXX" disabled={appState === 'launching'} />
              </div>
            </div>

            {/* Patient linkage */}
            {appState !== 'ready' && (
              <div style={{ padding: '7px 12px', borderRadius: 7, fontSize: 11,
                background: checkedInPatientId ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${checkedInPatientId ? '#86efac' : '#fde68a'}`,
                color: checkedInPatientId ? '#166534' : '#92400e',
              }}>
                {checkedInPatientId
                  ? <>Linked to <strong>{checkedInPatientName || 'checked-in patient'}</strong>'s record</>
                  : 'No patient linked — check this patient in first so responses are added to their chart.'}
              </div>
            )}

            {launchError && (
              <div style={{ padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 11 }}>
                {launchError}
              </div>
            )}

            {appState !== 'ready' && (
              <button type="button" onClick={() => { void handleStart(); }} disabled={appState === 'launching'}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: appState === 'launching' ? 'not-allowed' : 'pointer',
                  background: appState === 'launching' ? '#93c5fd' : '#1d4ed8',
                  color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                {appState === 'launching' ? '⏳ Starting session…' : '▶ Start Questionnaire Session'}
              </button>
            )}
          </div>

          {/* Result panel */}
          {appState === 'ready' && sessionToken && patientUrl && (
            <div style={panel}>
              <div style={{ padding: '8px 12px', borderRadius: 7, background: '#d1fae5', border: '1px solid #34d399', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>Session started</div>
                  <div style={{ fontSize: 11, color: '#047857' }}>{TEMPLATE_LABEL[templateKey]} · {MODE_OPTIONS.find(o => o.value === mode)?.label}{patientName.trim() ? ` · ${patientName.trim()}` : ''}</div>
                </div>
              </div>

              {/* URL */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', marginBottom: 5 }}>PATIENT LINK</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, background: '#f8fafc', border: '1.5px solid #bfdbfe' }}>
                  <span style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#1e3a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patientUrl}</span>
                  <CopyButton text={patientUrl} />
                </div>
              </div>

              {/* QR code */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em' }}>SCAN ON PATIENT DEVICE</div>
                <div style={{ padding: 10, borderRadius: 10, background: '#fff', border: '2px solid #e5e7eb', display: 'inline-block' }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(patientUrl)}`}
                    alt="QR code" width={180} height={180} style={{ display: 'block', borderRadius: 4 }} />
                </div>
              </div>

              {/* SMS */}
              {patientPhone.trim() ? (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', letterSpacing: '0.06em', marginBottom: 6 }}>SEND VIA SMS</div>
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
                    Send to <strong>{patientPhone.trim()}</strong>{patientName.trim() ? ` (${patientName.trim()})` : ''}.
                  </div>
                  {smsResult ? (
                    <div style={{ padding: '7px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: smsResult.ok ? '#d1fae5' : '#fef2f2',
                      color: smsResult.ok ? '#065f46' : '#991b1b',
                      border: `1px solid ${smsResult.ok ? '#34d399' : '#fca5a5'}`,
                    }}>
                      {smsResult.ok ? '✓' : '✕'} {smsResult.message}
                    </div>
                  ) : (
                    <button type="button" onClick={() => { void handleSendSms(); }} disabled={smsSending}
                      style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: smsSending ? 'not-allowed' : 'pointer',
                        background: smsSending ? '#93c5fd' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                      {smsSending ? '⏳ Sending…' : '💬 Send SMS'}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#9ca3af', padding: '7px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  No phone number — SMS not available for this session.
                </div>
              )}

              <button type="button" onClick={handleReset}
                style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                + Start New Session
              </button>
            </div>
          )}

          {/* Recent sessions */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Recent Sessions</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  {queue.length > 0 ? `${queue.length} session${queue.length !== 1 ? 's' : ''} · last 10 shown` : 'No sessions yet'}
                </div>
              </div>
              <button type="button" onClick={() => { setQueueLoading(true); void fetchQueue(); }} disabled={queueLoading}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 11, cursor: queueLoading ? 'not-allowed' : 'pointer' }}>
                {queueLoading ? '⟳ Loading…' : '⟳ Refresh'}
              </button>
            </div>

            {queueError && (
              <div style={{ padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 11 }}>
                {queueError}
              </div>
            )}

            {queueLoading && queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 12 }}>Loading sessions…</div>
            ) : queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', background: '#f9fafb', borderRadius: 8, border: '1.5px dashed #d1d5db' }}>
                <div style={{ fontSize: 32, marginBottom: 8, color: '#d1d5db' }}>📋</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>No sessions yet</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Start a questionnaire session above</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {queue.map(session => <QueueSessionRow key={session.sessionToken} session={session} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
