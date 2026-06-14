import { useState, useEffect, useCallback } from 'react';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAuth } from '@/context/AuthContext';
import { getApiOrigin } from '@/lib/api-origin';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RedFlagItem {
  questionId: string;
  severity: 'high' | 'medium' | 'low';
  label?: string;
}

interface QAResponse {
  questionId: string;
  questionText: string;
  answer: string | string[];
  answeredAt: string;
}

interface AISummary {
  keyPositives: string[];
  redFlags: string[];
  recommendedFocusAreas: string[];
  overallImpression: string;
}

interface QuestionnaireSession {
  sessionToken: string;
  patientName: string | null;
  patientId: string | null;
  templateKey: string;
  completedAt: string;
  status: 'completed' | 'nurse_reviewed' | 'doctor_approved';
  redFlags: RedFlagItem[];
  responses?: QAResponse[];
}

interface ExtractedVitals {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  respiratoryRate?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  glucoseMmol?: number | null;
  deviceType?: string | null;
  rawText?: string | null;
  confidence?: 'high' | 'medium' | 'low';
}

type ExtractedVitalsStatus = 'pending_review' | 'confirmed' | 'rejected' | 'written';

const VITALS_FIELD_LABELS: Array<{ key: keyof ExtractedVitals; label: string; unit: string }> = [
  { key: 'systolicBp', label: 'Systolic BP', unit: 'mmHg' },
  { key: 'diastolicBp', label: 'Diastolic BP', unit: 'mmHg' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' },
  { key: 'temperatureC', label: 'Temperature', unit: '°C' },
  { key: 'spo2', label: 'Oxygen saturation', unit: '%' },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: '/min' },
  { key: 'weightKg', label: 'Weight', unit: 'kg' },
  { key: 'heightCm', label: 'Height', unit: 'cm' },
  { key: 'glucoseMmol', label: 'Glucose', unit: 'mmol/L' },
];

interface SessionDetail extends QuestionnaireSession {
  responses: QAResponse[];
  aiSummary?: AISummary | null;
  extractedVitals?: ExtractedVitals | null;
  extractedVitalsStatus?: ExtractedVitalsStatus | null;
}

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

function templateLabel(key: string): string {
  const labels: Record<string, string> = {
    general_screening: 'General Screening',
    upper_gi: 'Upper GI',
    lower_gi: 'Lower GI',
    breast: 'Breast Clinic',
    diabetic_foot: 'Diabetic Foot',
    post_op: 'Post-op Review',
    ercp_workup: 'ERCP Work-up',
  };
  return labels[key] ?? key;
}

function formatAnswer(ans: string | string[]): string {
  if (Array.isArray(ans)) return ans.length > 0 ? ans.join(', ') : '—';
  return ans?.trim() ? ans : '—';
}

function statusColors(status: QuestionnaireSession['status']): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (status) {
    case 'completed':
      return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24', label: 'Awaiting Review' };
    case 'nurse_reviewed':
      return { bg: '#d1fae5', text: '#065f46', border: '#34d399', label: 'Nurse Reviewed' };
    case 'doctor_approved':
      return { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa', label: 'Doctor Approved' };
    default:
      return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: status };
  }
}

/** Red flags are persisted using the triage engine's urgency vocabulary
 *  (routine/priority/urgent/emergency); the badge UI here uses high/medium/low —
 *  map between the two so severity badges render with the right colour. */
function urgencyToDisplaySeverity(urgency: string): 'high' | 'medium' | 'low' {
  switch (urgency) {
    case 'emergency':
    case 'urgent':
      return 'high';
    case 'priority':
      return 'medium';
    default:
      return 'low';
  }
}

function maxSeverity(flags: RedFlagItem[]): 'high' | 'medium' | 'low' | null {
  if (flags.length === 0) return null;
  if (flags.some(f => f.severity === 'high')) return 'high';
  if (flags.some(f => f.severity === 'medium')) return 'medium';
  return 'low';
}

function redFlagBadgeStyle(severity: 'high' | 'medium' | 'low'): React.CSSProperties {
  switch (severity) {
    case 'high':
      return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    case 'medium':
      return { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' };
    case 'low':
      return { background: '#fefce8', color: '#854d0e', border: '1px solid #fde047' };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl"
      style={{ background: '#f9fafb', border: '1.5px dashed #d1d5db' }}
    >
      <svg
        className="w-14 h-14 mb-4"
        style={{ color: '#d1d5db' }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
      <p className="text-base font-semibold" style={{ color: '#6b7280' }}>
        No completed questionnaires
      </p>
      <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
        Completed patient forms will appear here
      </p>
    </div>
  );
}

function SessionCard({
  session,
  selected,
  onClick,
}: {
  session: QuestionnaireSession;
  selected: boolean;
  onClick: () => void;
}) {
  const statusStyle = statusColors(session.status);
  const sev = maxSeverity(session.redFlags);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-all rounded-xl p-4"
      style={{
        background: selected ? '#eff6ff' : '#fff',
        border: '1.5px solid',
        borderColor: selected ? '#1e40af' : '#e5e7eb',
        outline: 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + meta */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ color: '#111827' }}>
            {session.patientName ?? 'Anonymous'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
            {templateLabel(session.templateKey)} · {timeAgo(session.completedAt)}
          </p>
        </div>

        {/* Right: status badge */}
        <span
          className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
          style={{
            background: statusStyle.bg,
            color: statusStyle.text,
            border: `1px solid ${statusStyle.border}`,
          }}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Red flag badges */}
      {session.redFlags.length > 0 && sev && (
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={redFlagBadgeStyle(sev)}
          >
            <span aria-hidden="true">&#9888;</span>
            {session.redFlags.length} red flag{session.redFlags.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </button>
  );
}

function AISummaryBox({ summary, loading }: { summary: AISummary | null | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}
      >
        <Spinner size={18} />
        <span className="text-sm font-medium" style={{ color: '#1e40af' }}>
          Loading AI summary…
        </span>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}
    >
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#1e40af' }}>
        AI Clinical Summary
      </p>

      {summary.overallImpression && (
        <p className="text-sm leading-relaxed" style={{ color: '#1e3a8a' }}>
          {summary.overallImpression}
        </p>
      )}

      {summary.keyPositives.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>
            Key Positives
          </p>
          <ul className="space-y-0.5">
            {summary.keyPositives.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: '#374151' }}>
                <span style={{ color: '#16a34a', marginTop: 1 }}>&#10003;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.redFlags.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: '#b45309' }}>
            Concerns to Address
          </p>
          <ul className="space-y-0.5">
            {summary.redFlags.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: '#374151' }}>
                <span style={{ color: '#d97706', marginTop: 1 }}>&#9888;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.recommendedFocusAreas.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: '#1e40af' }}>
            Recommended Focus Areas
          </p>
          <ul className="space-y-0.5">
            {summary.recommendedFocusAreas.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: '#374151' }}>
                <span style={{ color: '#3b82f6', marginTop: 1 }}>&#8594;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NurseAPCQTab() {
  const { profile } = useAuth();
  const userRole = profile?.role ?? 'front_desk';
  const isDoctor = userRole === 'doctor' || userRole === 'admin';

  const [sessions, setSessions] = useState<QuestionnaireSession[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null | undefined>(undefined);
  const [nurseNotes, setNurseNotes] = useState('');
  const [marking, setMarking] = useState(false);
  const [markSuccess, setMarkSuccess] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [approveErr, setApproveErr] = useState<string | null>(null);
  const [emrWarning, setEmrWarning] = useState<string | null>(null);
  const [vitalsForm, setVitalsForm] = useState<Record<string, string>>({});
  const [vitalsSubmitting, setVitalsSubmitting] = useState<'confirm' | 'reject' | null>(null);
  const [vitalsActionErr, setVitalsActionErr] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/questionnaire/nurse/queue'), { headers: await staffAuthHeaders() });
      if (res.ok) {
        // Backend sends raw urgency values (routine/priority/urgent/emergency)
        // for red-flag severity — remap to the high/medium/low badge vocabulary.
        const data = await res.json() as {
          sessions: Array<Omit<QuestionnaireSession, 'redFlags'> & {
            redFlags: Array<{ questionId: string; severity: string; label?: string }>;
          }>;
        };
        setSessions((data.sessions ?? []).map(s => ({
          ...s,
          redFlags: s.redFlags.map(f => ({
            questionId: f.questionId,
            severity: urgencyToDisplaySeverity(f.severity),
            label: f.label,
          })),
        })));
        setQueueError(null);
      } else {
        setQueueError('Unable to load queue. Please refresh.');
      }
    } catch {
      setQueueError('Unable to connect to server.');
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Initial fetch + 30-second auto-refresh
  useEffect(() => {
    void fetchQueue();
    const id = setInterval(() => { void fetchQueue(); }, 30000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  async function openSession(token: string) {
    if (selectedToken === token) {
      setSelectedToken(null);
      setDetail(null);
      setAiSummary(undefined);
      setNurseNotes('');
      setMarkSuccess(false);
      setApproveSuccess(false);
      setApproveErr(null);
      setVitalsForm({});
      setVitalsActionErr(null);
      return;
    }
    setSelectedToken(token);
    setDetail(null);
    setAiSummary(undefined);
    setNurseNotes('');
    setMarkSuccess(false);
    setApproveSuccess(false);
    setApproveErr(null);
    setVitalsForm({});
    setVitalsActionErr(null);
    setLoadingDetail(true);
    setLoadingAI(true);

    try {
      const res = await fetch(apiUrl(`/api/questionnaire/session/${token}`));
      if (res.ok) {
        // The session-detail endpoint is shared with the anonymous patient
        // resume flow, so it returns raw DB rows (`session` + `responses`)
        // rather than the display shape this tab needs — map it here,
        // filling in patient/template names from the already-loaded queue row.
        const data = await res.json() as {
          session: {
            session_token: string;
            status: string;
            patient_id: string | null;
            completed_at: string | null;
            started_at: string | null;
            red_flags_detected: Array<{ question_key: string; severity: string; message?: string }> | null;
            extracted_vitals: ExtractedVitals | null;
            extracted_vitals_status: ExtractedVitalsStatus | null;
          };
          responses: Array<{
            question_key: string;
            question_text: string | null;
            answer_value: string | null;
            answer_display: string | null;
            answered_at: string;
          }>;
        };
        const base = sessions.find(s => s.sessionToken === token);
        setDetail({
          sessionToken: data.session.session_token,
          patientName: base?.patientName ?? null,
          patientId: data.session.patient_id,
          templateKey: base?.templateKey ?? 'general_screening',
          completedAt: data.session.completed_at ?? data.session.started_at ?? '',
          status: data.session.status as SessionDetail['status'],
          redFlags: (data.session.red_flags_detected ?? []).map(f => ({
            questionId: f.question_key,
            severity: urgencyToDisplaySeverity(f.severity),
            label: f.message,
          })),
          responses: (data.responses ?? []).map(r => ({
            questionId: r.question_key,
            questionText: r.question_text ?? r.question_key,
            answer: r.answer_display ?? r.answer_value ?? '—',
            answeredAt: r.answered_at,
          })),
          extractedVitals: data.session.extracted_vitals,
          extractedVitalsStatus: data.session.extracted_vitals_status,
        });

        if (data.session.extracted_vitals) {
          const vitals = data.session.extracted_vitals;
          const form: Record<string, string> = {};
          for (const { key } of VITALS_FIELD_LABELS) {
            const v = vitals[key];
            if (typeof v === 'number') form[key] = String(v);
          }
          setVitalsForm(form);
        }
      } else {
        setDetail(null);
      }
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }

    // Fetch AI summary separately — backend returns the raw `intake_summaries`
    // row (snake_case columns); map it onto the display shape this tab uses.
    try {
      const res = await fetch(apiUrl(`/api/questionnaire/session/${token}/summary`), { headers: await staffAuthHeaders() });
      if (res.ok) {
        const data = await res.json() as {
          summary?: {
            ai_summary: string | null;
            key_positives: unknown;
            red_flags: unknown;
            recommended_focus_areas: unknown;
          };
        };
        const s = data.summary;
        const asStringArray = (v: unknown): string[] =>
          Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
        // intake_summaries.red_flags is an array of {symptom, severity, action}
        // objects (not plain strings) — render each as a readable line.
        const redFlagLines = (v: unknown): string[] =>
          Array.isArray(v)
            ? (v as Array<{ symptom?: string; severity?: string; action?: string }>)
                .filter((f) => f && typeof f === 'object')
                .map((f) => [f.symptom, f.severity ? `(${f.severity})` : null, f.action ? `— ${f.action}` : null]
                  .filter(Boolean).join(' '))
            : [];
        setAiSummary(s ? {
          overallImpression: s.ai_summary ?? '',
          keyPositives: asStringArray(s.key_positives),
          redFlags: redFlagLines(s.red_flags),
          recommendedFocusAreas: asStringArray(s.recommended_focus_areas),
        } : null);
      } else {
        setAiSummary(null);
      }
    } catch {
      setAiSummary(null);
    } finally {
      setLoadingAI(false);
    }
  }

  /** Confirm or reject the vitals Claude read off a patient/kiosk photo.
   *  Confirmed values are staged for the next EMR population pass, which
   *  writes them into the vitals table. */
  async function reviewVitalsPhoto(action: 'confirm' | 'reject') {
    if (!selectedToken || vitalsSubmitting || !profile?.id) return;
    setVitalsSubmitting(action);
    setVitalsActionErr(null);
    try {
      const values: Record<string, number> = {};
      if (action === 'confirm') {
        for (const { key } of VITALS_FIELD_LABELS) {
          const raw = vitalsForm[key];
          if (raw === undefined || raw.trim() === '') continue;
          const num = Number(raw);
          if (!Number.isNaN(num)) values[key] = num;
        }
      }

      const res = await fetch(apiUrl(`/api/questionnaire/session/${selectedToken}/vitals-photo/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ action, values, nurseUserId: profile.id }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }

      const d = await res.json() as { vitals: ExtractedVitals; status: ExtractedVitalsStatus };
      setDetail(prev => prev ? { ...prev, extractedVitals: d.vitals, extractedVitalsStatus: d.status } : prev);
    } catch (err) {
      setVitalsActionErr(err instanceof Error ? err.message : 'Could not save vitals review.');
    } finally {
      setVitalsSubmitting(null);
    }
  }

  async function markReviewed() {
    if (!selectedToken || marking || !profile?.id) return;
    setMarking(true);
    try {
      const res = await fetch(apiUrl(`/api/questionnaire/session/${selectedToken}/nurse-review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ nurseNotes, nurseUserId: profile.id }),
      });
      if (res.ok) {
        setMarkSuccess(true);
        setSessions(prev =>
          prev.map(s =>
            s.sessionToken === selectedToken
              ? { ...s, status: 'nurse_reviewed' as const }
              : s,
          ),
        );
        if (detail) {
          setDetail({ ...detail, status: 'nurse_reviewed' });
        }
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setMarking(false);
    }
  }

  /** Doctor approval — also triggers EMR population (drafts symptoms,
   *  assessment and plan from the intake onto the patient's encounter). */
  async function approveSession() {
    if (!selectedToken || approving || !profile?.id) return;
    setApproving(true);
    setApproveErr(null);
    setEmrWarning(null);
    try {
      const res = await fetch(apiUrl(`/api/questionnaire/session/${selectedToken}/doctor-approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ doctorUserId: profile.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const d = await res.json() as { emrPopulated?: boolean; emrError?: string | null };
      if (d.emrPopulated === false) {
        setEmrWarning(
          d.emrError
            ? `Approved, but EMR was not populated automatically: ${d.emrError}. Please add symptoms/assessment/plan manually for this encounter.`
            : 'Approved, but EMR was not populated automatically — this session is not yet linked to a patient. Please add symptoms/assessment/plan manually for this encounter.',
        );
      }
      setApproveSuccess(true);
      setSessions(prev =>
        prev.map(s =>
          s.sessionToken === selectedToken
            ? { ...s, status: 'doctor_approved' as const }
            : s,
        ),
      );
      if (detail) {
        setDetail({ ...detail, status: 'doctor_approved' });
      }
    } catch (e) {
      setApproveErr(String(e instanceof Error ? e.message : e));
    } finally {
      setApproving(false);
    }
  }

  const selectedSession = sessions.find(s => s.sessionToken === selectedToken);

  return (
    <div className="gap-y" style={{ height: '100%' }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: '#fff', border: '1px solid #e5e7eb' }}
      >
        <div>
          <h2 className="text-sm font-bold" style={{ color: '#111827' }}>
            Patient Questionnaires
          </h2>
          <p className="text-xs" style={{ color: '#6b7280' }}>
            {sessions.length > 0
              ? `${sessions.filter(s => s.status === 'completed').length} awaiting review`
              : 'No pending questionnaires'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoadingQueue(true); void fetchQueue(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
          }}
          disabled={loadingQueue}
        >
          {loadingQueue ? (
            <Spinner size={14} />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Error state */}
      {queueError && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}
        >
          {queueError}
        </div>
      )}

      {/* Main layout: list + detail panel */}
      <div className="flex gap-4" style={{ minHeight: 0, flex: 1 }}>
        {/* Session list */}
        <div className="flex flex-col gap-2" style={{ width: 320, flexShrink: 0 }}>
          {loadingQueue && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size={28} />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState />
          ) : (
            sessions.map(session => (
              <SessionCard
                key={session.sessionToken}
                session={session}
                selected={selectedToken === session.sessionToken}
                onClick={() => { void openSession(session.sessionToken); }}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedToken ? (
          <div
            className="flex-1 rounded-xl overflow-auto"
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              minWidth: 0,
            }}
          >
            {loadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size={32} />
              </div>
            ) : !detail && !selectedSession ? (
              <div
                className="flex items-center justify-center py-20 text-sm"
                style={{ color: '#9ca3af' }}
              >
                Unable to load session details.
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Detail header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: '#111827' }}>
                      {(detail ?? selectedSession)?.patientName ?? 'Anonymous'}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                      {templateLabel((detail ?? selectedSession)?.templateKey ?? '')} ·{' '}
                      {timeAgo((detail ?? selectedSession)?.completedAt ?? '')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const s = statusColors((detail ?? selectedSession)!.status);
                      return (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
                        >
                          {s.label}
                        </span>
                      );
                    })()}
                    {(detail ?? selectedSession)!.redFlags.length > 0 && (() => {
                      const sev = maxSeverity((detail ?? selectedSession)!.redFlags)!;
                      return (
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                          style={redFlagBadgeStyle(sev)}
                        >
                          <span aria-hidden="true">&#9888;</span>
                          {(detail ?? selectedSession)!.redFlags.length} red flag{(detail ?? selectedSession)!.redFlags.length !== 1 ? 's' : ''}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* AI Summary */}
                <AISummaryBox summary={aiSummary} loading={loadingAI} />

                {/* Q&A Responses */}
                {detail?.responses && detail.responses.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-bold uppercase tracking-wider mb-3"
                      style={{ color: '#6b7280' }}
                    >
                      Patient Responses
                    </p>
                    <div className="space-y-2">
                      {detail.responses.map((resp, i) => (
                        <div
                          key={resp.questionId}
                          className="rounded-lg px-4 py-3"
                          style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff', border: '1px solid #f3f4f6' }}
                        >
                          <p className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                            {resp.questionText}
                          </p>
                          <p className="text-sm" style={{ color: '#111827' }}>
                            {formatAnswer(resp.answer)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No responses yet */}
                {!detail?.responses?.length && !loadingDetail && (
                  <div
                    className="rounded-lg px-4 py-6 text-center text-sm"
                    style={{ background: '#f9fafb', color: '#9ca3af', border: '1px solid #f3f4f6' }}
                  >
                    Response details are being loaded…
                  </div>
                )}

                {/* Vitals from photo */}
                {detail?.extractedVitals && (
                  <div className="rounded-lg p-4" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0f766e' }}>
                        Vitals from Photo
                      </p>
                      {detail.extractedVitalsStatus === 'pending_review' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef9c3', color: '#854d0e', border: '1px solid #fde68a' }}>
                          Awaiting review
                        </span>
                      )}
                      {(detail.extractedVitalsStatus === 'confirmed' || detail.extractedVitalsStatus === 'written') && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' }}>
                          {detail.extractedVitalsStatus === 'written' ? 'Confirmed — written to chart' : 'Confirmed'}
                        </span>
                      )}
                      {detail.extractedVitalsStatus === 'rejected' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                          Rejected
                        </span>
                      )}
                    </div>

                    {detail.extractedVitals.deviceType && (
                      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                        Photographed device: {detail.extractedVitals.deviceType}
                        {detail.extractedVitals.confidence === 'low' && ' — low confidence, please verify'}
                      </p>
                    )}

                    {detail.extractedVitalsStatus === 'pending_review' || !detail.extractedVitalsStatus ? (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {VITALS_FIELD_LABELS.map(({ key, label, unit }) => (
                            <label key={key} className="text-xs" style={{ color: '#374151' }}>
                              {label} ({unit})
                              <input
                                type="number"
                                inputMode="decimal"
                                value={vitalsForm[key] ?? ''}
                                onChange={e => setVitalsForm(prev => ({ ...prev, [key]: e.target.value }))}
                                className="mt-1 w-full rounded-md px-2 py-1.5 text-sm outline-none"
                                style={{ border: '1.5px solid #d1d5db', background: '#fff', color: '#111827' }}
                              />
                            </label>
                          ))}
                        </div>

                        {vitalsActionErr && (
                          <div className="px-3 py-2 rounded-lg text-xs mb-3" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}>
                            {vitalsActionErr}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { void reviewVitalsPhoto('confirm'); }}
                            disabled={vitalsSubmitting !== null}
                            className="px-3 py-2 rounded-lg text-xs font-bold text-white transition-all"
                            style={{ background: vitalsSubmitting ? '#6ee7b7' : '#0d9488', cursor: vitalsSubmitting ? 'not-allowed' : 'pointer' }}
                          >
                            {vitalsSubmitting === 'confirm' ? 'Saving…' : 'Confirm vitals'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { void reviewVitalsPhoto('reject'); }}
                            disabled={vitalsSubmitting !== null}
                            className="px-3 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{ background: '#fff', color: '#991b1b', border: '1px solid #fca5a5', cursor: vitalsSubmitting ? 'not-allowed' : 'pointer' }}
                          >
                            {vitalsSubmitting === 'reject' ? 'Saving…' : 'Discard photo reading'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {VITALS_FIELD_LABELS.filter(({ key }) => detail.extractedVitals?.[key] != null).map(({ key, label, unit }) => (
                          <div key={key} className="text-sm" style={{ color: '#111827' }}>
                            <span style={{ color: '#6b7280' }}>{label}:</span>{' '}
                            <strong>{String(detail.extractedVitals?.[key])} {unit}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                {/* Nurse review (nurse role) */}
                {!isDoctor && (
                  <>
                    <div>
                      <label
                        htmlFor="nurse-notes"
                        className="block text-xs font-bold mb-2 uppercase tracking-wider"
                        style={{ color: '#6b7280' }}
                      >
                        Nurse Notes
                      </label>
                      <textarea
                        id="nurse-notes"
                        value={nurseNotes}
                        onChange={e => setNurseNotes(e.target.value)}
                        placeholder="Add clinical notes or observations…"
                        rows={3}
                        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-all"
                        style={{
                          border: '1.5px solid',
                          borderColor: nurseNotes.trim() ? '#1e40af' : '#d1d5db',
                          background: '#fff',
                          color: '#111827',
                        }}
                        disabled={(detail ?? selectedSession)?.status !== 'completed'}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      {markSuccess ? (
                        <div
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                          style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' }}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Marked as Reviewed — the doctor can now approve and populate the EMR
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { void markReviewed(); }}
                          disabled={
                            marking ||
                            (detail ?? selectedSession)?.status !== 'completed'
                          }
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                          style={{
                            background:
                              !marking && (detail ?? selectedSession)?.status === 'completed'
                                ? '#1e40af'
                                : '#93c5fd',
                            cursor:
                              !marking && (detail ?? selectedSession)?.status === 'completed'
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                        >
                          {marking ? (
                            <>
                              <Spinner size={14} />
                              Saving…
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Mark as Reviewed
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Doctor approval (doctor/admin role) — closes the loop into the EMR */}
                {isDoctor && (
                  <div className="space-y-3">
                    <div
                      className="rounded-lg px-4 py-3 text-xs leading-relaxed"
                      style={{ background: '#eff6ff', color: '#1e3a8a', border: '1px solid #bfdbfe' }}
                    >
                      Approving will draft this patient's symptoms, a provisional assessment and a
                      management plan onto an open encounter from the intake responses and AI
                      summary — clearly marked as AI-drafted, ready for you to review and amend at
                      consultation.
                    </div>

                    {(detail ?? selectedSession)?.status === 'doctor_approved' || approveSuccess ? (
                      <div
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #60a5fa' }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {emrWarning ? 'Approved — EMR not populated, see note below' : 'Approved — EMR populated for this encounter'}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { void approveSession(); }}
                        disabled={
                          approving ||
                          !['completed', 'nurse_reviewed'].includes((detail ?? selectedSession)?.status ?? '')
                        }
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-all"
                        style={{
                          background:
                            !approving && ['completed', 'nurse_reviewed'].includes((detail ?? selectedSession)?.status ?? '')
                              ? '#1e40af'
                              : '#93c5fd',
                          cursor:
                            !approving && ['completed', 'nurse_reviewed'].includes((detail ?? selectedSession)?.status ?? '')
                              ? 'pointer'
                              : 'not-allowed',
                        }}
                      >
                        {approving ? (
                          <>
                            <Spinner size={14} />
                            Approving…
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Approve &amp; Populate EMR
                          </>
                        )}
                      </button>
                    )}

                    {approveErr && (
                      <div
                        className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}
                      >
                        {approveErr}
                      </div>
                    )}

                    {emrWarning && (
                      <div
                        className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}
                      >
                        ⚠ {emrWarning}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No selection placeholder */
          sessions.length > 0 && (
            <div
              className="flex-1 flex items-center justify-center rounded-xl"
              style={{ background: '#f9fafb', border: '1.5px dashed #d1d5db' }}
            >
              <div className="text-center">
                <svg
                  className="w-10 h-10 mx-auto mb-3"
                  style={{ color: '#d1d5db' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>
                  Select a session to review
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
