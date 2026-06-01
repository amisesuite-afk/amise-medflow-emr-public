import { useState, useEffect, useCallback } from 'react';

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

interface SessionDetail extends QuestionnaireSession {
  responses: QAResponse[];
  aiSummary?: AISummary | null;
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

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/questionnaire/nurse/queue');
      if (res.ok) {
        const data = await res.json() as { sessions: QuestionnaireSession[] };
        setSessions(data.sessions ?? []);
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
      return;
    }
    setSelectedToken(token);
    setDetail(null);
    setAiSummary(undefined);
    setNurseNotes('');
    setMarkSuccess(false);
    setLoadingDetail(true);
    setLoadingAI(true);

    try {
      const res = await fetch(`/api/questionnaire/session/${token}`);
      if (res.ok) {
        const data = await res.json() as SessionDetail;
        setDetail(data);
      } else {
        setDetail(null);
      }
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }

    // Fetch AI summary separately
    try {
      const res = await fetch(`/api/questionnaire/session/${token}/summary`);
      if (res.ok) {
        const data = await res.json() as { summary: AISummary };
        setAiSummary(data.summary ?? null);
      } else {
        setAiSummary(null);
      }
    } catch {
      setAiSummary(null);
    } finally {
      setLoadingAI(false);
    }
  }

  async function markReviewed() {
    if (!selectedToken || marking) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/questionnaire/session/${selectedToken}/nurse-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: nurseNotes }),
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

                {/* Divider */}
                <div style={{ borderTop: '1px solid #e5e7eb' }} />

                {/* Nurse notes */}
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

                {/* Action buttons */}
                <div className="flex items-center gap-3">
                  {markSuccess ? (
                    <div
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                      style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Marked as Reviewed
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

                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      border: '1.5px solid #e5e7eb',
                    }}
                    onClick={() => {
                      // Future: sends notification to doctor
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    Notify Doctor
                  </button>
                </div>
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
