import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { useAuth } from '@/context/AuthContext';
import { supabase, SITE_LABELS } from '@/lib/supabase';
import { PUBLIC_HOLIDAYS_SLU } from '@workspace/triage-engine';
import { useState, useEffect } from 'react';
import bundledCache from '@/data/calendar-cache.json';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ACTION_LABELS: Record<string, string> = {
  emergency_now:    'Escalate now — emergency pathway',
  same_day_call:    'Same-day clinical call',
  priority_24_48h:  'Priority review within 24–48 hours',
  routine_booking:  'Routine booking pathway',
  admin_review:     'Administrative review',
};

function acuityColor(a: string): string {
  if (a === 'urgent')   return 'var(--urgent)';
  if (a === 'priority') return 'var(--priority)';
  if (a === 'review')   return 'var(--review)';
  return 'var(--accent)';
}

function todayInECT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Lucia' }).format(new Date());
}

function isHolidayToday(): boolean {
  return PUBLIC_HOLIDAYS_SLU.includes(todayInECT());
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/St_Lucia' });
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  const dow = DAY_NAMES[d.getDay()];
  const date = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  return `${dow} ${date} ${month}`;
}

function cardStyle(accent?: boolean): React.CSSProperties {
  return {
    background: '#fff',
    border: `1px solid ${accent ? 'var(--accent)' : '#e2e8f0'}`,
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };
}

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--muted)',
  marginBottom: 4,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  fontStyle: 'italic',
};

function AcuityBadge({ acuity, score }: { acuity: string; score: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, color: '#fff', background: acuityColor(acuity), fontSize: 12, fontWeight: 800 }}>
      <span>{acuity.toUpperCase()}</span>
      <span style={{ opacity: 0.85 }}>· {score}</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const bg = severity === 'urgent' ? 'var(--urgent)' : severity === 'priority' ? 'var(--priority)' : 'var(--review)';
  return (
    <span style={{ background: bg, color: '#fff', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
      {severity}
    </span>
  );
}

interface CalEvent { id: string; summary: string; start: string; end: string; type: string }

function typeChip(type: string): React.CSSProperties {
  if (type === 'theatre')   return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  if (type === 'endoscopy') return { background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' };
  if (type === 'break')     return { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' };
  return { background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' };
}

// Use VITE_API_URL when deployed (e.g. Render); fall back to same-origin proxy in dev
const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}${path}`;
}

// ─── Patient Tasks ─────────────────────────────────────────────────────────────

type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus   = 'open' | 'in_progress' | 'overdue' | 'completed' | 'cancelled';

interface PatientTask {
  id: string;
  patient_id: string;
  task_type: string;
  description: string;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
}

function priorityBadgeStyle(priority: TaskPriority): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flexShrink: 0,
    color: '#fff',
  };
  if (priority === 'urgent') return { ...base, background: '#dc2626' };
  if (priority === 'high')   return { ...base, background: '#f97316' };
  if (priority === 'normal') return { ...base, background: '#94a3b8' };
  return { ...base, background: '#64748b' };
}

function dueDateLabel(dueDate: string, today: string): { text: string; color: string } {
  if (dueDate < today) return { text: 'OVERDUE', color: '#dc2626' };
  // Parse as local date strings (YYYY-MM-DD) to avoid timezone shift
  const [dy, dm, dd] = dueDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const dueDateObj  = new Date(dy, dm - 1, dd);
  const todayDateObj = new Date(ty, tm - 1, td);
  const diffMs = dueDateObj.getTime() - todayDateObj.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return { text: 'Due today', color: '#f59e0b' };
  if (diffDays === 1) return { text: 'Due tomorrow', color: '#f59e0b' };
  if (diffDays <= 3)  return { text: `Due in ${diffDays}d`, color: '#f59e0b' };
  return { text: `Due in ${diffDays}d`, color: '#94a3b8' };
}

// ──────────────────────────────────────────────────────────────────────────────

export default function DashboardTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const r = ctx.triageResult;
  const holiday = isHolidayToday();
  const today = todayInECT();

  const [upcoming, setUpcoming] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [syncStatus, setSyncStatus] = useState<'live' | 'cached' | 'loading'>('loading');

  // ── Patient Tasks state ──
  const [tasks, setTasks] = useState<PatientTask[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    setCalLoading(true);
    setSyncStatus('loading');

    // Load bundled calendar data immediately (works on GitHub Pages with no API server)
    const now = new Date();
    const cutoff = new Date(now.getTime() + 45 * 86400_000);
    const bundledEvents = (bundledCache.events as CalEvent[]).filter(e => {
      const start = new Date(e.start);
      return start >= now && start < cutoff;
    });

    // Try live API sync — if available, override bundled data
    fetch(apiUrl('/api/scheduling/sync'), { method: 'POST' })
      .then(r => r.json())
      .then((d: { synced?: boolean }) => { setSyncStatus(d.synced ? 'live' : 'cached'); })
      .catch(() => { setSyncStatus('cached'); })
      .finally(() => {
        fetch(apiUrl('/api/scheduling/upcoming?days=45'))
          .then(r => r.json())
          .then((d: { events?: CalEvent[] }) => {
            if (d.events && d.events.length > 0) {
              setUpcoming(d.events);
            } else {
              setUpcoming(bundledEvents);
              setSyncStatus('cached');
            }
          })
          .catch(() => {
            setUpcoming(bundledEvents);
            setSyncStatus('cached');
          })
          .finally(() => setCalLoading(false));
      });
  }, []);

  // ── Fetch patient tasks on mount ──
  useEffect(() => {
    async function fetchTasks() {
      setTasksLoading(true);
      if (!supabase) {
        setTasksLoading(false);
        return;
      }
      const { data: taskData } = await supabase
        .from('patient_tasks')
        .select('id, patient_id, task_type, description, due_date, priority, status')
        .in('status', ['open', 'in_progress', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(15);

      if (taskData && taskData.length > 0) {
        setTasks(taskData as PatientTask[]);
        const uniqueIds = [...new Set((taskData as PatientTask[]).map(t => t.patient_id))];
        const { data: patientData } = await supabase
          .from('patients')
          .select('id, full_name')
          .in('id', uniqueIds);
        if (patientData) {
          const map: Record<string, string> = {};
          for (const p of patientData as { id: string; full_name: string }[]) {
            map[p.id] = p.full_name;
          }
          setPatientNames(map);
        }
      } else {
        setTasks([]);
      }
      setTasksLoading(false);
    }
    fetchTasks();
  }, []);

  async function completeTask(id: string) {
    if (!supabase) return;
    setCompletingId(id);
    await supabase
      .from('patient_tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
    setCompletingId(null);
  }

  // Group by date
  const byDate: Record<string, CalEvent[]> = {};
  for (const ev of upcoming) {
    const dateKey = ev.start.slice(0, 10);
    (byDate[dateKey] ??= []).push(ev);
  }
  const dates = Object.keys(byDate).sort();

  const selectedEvents = byDate[selectedDate] ?? [];
  const todayEvents = byDate[today] ?? [];

  const overdueCount = tasks.filter(t => t.due_date < today || t.status === 'overdue').length;

  return (
    <div className="gap-y">

      {/* Patient Tasks panel */}
      <div style={{ ...cardStyle(), borderColor: overdueCount > 0 ? '#fca5a5' : '#e2e8f0', borderWidth: overdueCount > 0 ? 2 : 1 }}>
        {/* Header row */}
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setTasksOpen(o => !o)}
          role="button"
          aria-expanded={tasksOpen}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={titleStyle}>Patient Tasks</span>
            {!tasksLoading && tasks.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10,
                background: overdueCount > 0 ? '#dc2626' : 'var(--accent)',
                color: '#fff', fontSize: 10, fontWeight: 800,
              }}>
                {tasks.length}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1 }}>
            {tasksOpen ? '▲' : '▼'}
          </span>
        </div>

        {tasksOpen && (
          <>
            {tasksLoading && (
              <div style={emptyStyle}>Loading tasks…</div>
            )}

            {!tasksLoading && tasks.length === 0 && (
              <div style={emptyStyle}>No open or overdue tasks</div>
            )}

            {!tasksLoading && tasks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tasks.map(task => {
                  const due = dueDateLabel(task.due_date, today);
                  const patientName = patientNames[task.patient_id] ?? 'Unknown patient';
                  const isCompleting = completingId === task.id;
                  const label = task.description
                    ? `${task.task_type}: ${task.description}`.slice(0, 80) + ((`${task.task_type}: ${task.description}`).length > 80 ? '…' : '')
                    : task.task_type;

                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 6,
                        background: task.due_date < today || task.status === 'overdue' ? '#fff5f5' : '#f8fafc',
                        border: `1px solid ${task.due_date < today || task.status === 'overdue' ? '#fecaca' : '#e2e8f0'}`,
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Priority badge */}
                      <span style={priorityBadgeStyle(task.priority)}>
                        {task.priority}
                      </span>

                      {/* Patient name */}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2b', minWidth: 100, flexShrink: 0 }}>
                        {patientName}
                      </span>

                      {/* Task type + description */}
                      <span style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 120 }}>
                        {label}
                      </span>

                      {/* Due date */}
                      <span style={{ fontSize: 11, fontWeight: 700, color: due.color, flexShrink: 0 }}>
                        {due.text}
                      </span>

                      {/* Complete button */}
                      <button
                        type="button"
                        disabled={isCompleting}
                        onClick={e => { e.stopPropagation(); completeTask(task.id); }}
                        style={{
                          padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                          border: '1px solid #a7f3d0', background: isCompleting ? '#f1f5f9' : '#ecfdf5',
                          color: isCompleting ? 'var(--muted)' : '#065f46',
                          cursor: isCompleting ? 'default' : 'pointer', flexShrink: 0,
                        }}
                      >
                        {isCompleting ? 'Saving…' : 'Complete'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Card 1 — Current patient */}
      <div style={cardStyle()}>
        <div style={titleStyle}>Current patient</div>
        {!ctx.patientName.trim() ? (
          <div style={emptyStyle}>No patient loaded — start with New Patient in Intake</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {ctx.patientPhoto && (
              <img
                src={ctx.patientPhoto}
                alt=""
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a2e2b' }}>{ctx.patientName}</div>
            {(ctx.age || ctx.sex !== 'unknown') && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {ctx.age ? `Age ${ctx.age}` : ''}
                {ctx.age && ctx.sex !== 'unknown' ? ' · ' : ''}
                {ctx.sex !== 'unknown' ? ctx.sex.charAt(0).toUpperCase() + ctx.sex.slice(1) : ''}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
              <AcuityBadge acuity={r.acuity} score={r.score} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ACTION_LABELS[r.recommendedAction] ?? r.recommendedAction}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {[
                { label: 'Intake', top: 'intake' as const, sec: 'intake' as const },
                { label: 'Consult', top: 'consultation' as const, sec: 'triage' as const },
                { label: 'Exam', top: 'consultation' as const, sec: 'examination' as const },
                { label: 'Summary', top: 'finaldoc' as const, sec: 'intake' as const },
              ].map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => { ctx.setTopSection(a.top); ctx.setActiveSection(a.sec); }}
                  style={{
                    padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                    border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  {a.label} →
                </button>
              ))}
            </div>
          </div></div>
        )}
      </div>

      <div className="two-col">
        {/* Card 2 — Active pathways */}
        <div style={cardStyle()}>
          <div style={titleStyle}>Active pathways</div>
          {r.activePathways.length === 0 ? (
            <div style={emptyStyle}>No clinical pathways triggered</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {r.activePathways.map(pw => (
                <div key={pw.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SeverityBadge severity={pw.severity} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1a2e2b' }}>{pw.title}</span>
                  </div>
                  <ul style={{ margin: '0 0 0 12px', padding: 0, fontSize: 11, color: 'var(--muted)', listStyle: 'disc' }}>
                    {pw.checklist.slice(0, 3).map(item => (
                      <li key={item} style={{ marginBottom: 2 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3 — Vital flags */}
        <div style={cardStyle()}>
          <div style={titleStyle}>Vital flags</div>
          {r.vitalRedFlags.length === 0 ? (
            <div style={emptyStyle}>No vital sign alerts</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {r.vitalRedFlags.map(f => (
                <span key={f.label} className={`vflag ${f.severity}`}>
                  <strong>{f.label}</strong>: {f.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card 4 — Missing intake fields */}
      <div style={cardStyle()}>
        <div style={titleStyle}>Missing intake fields</div>
        {r.missingCriticalFields.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--review)', fontWeight: 600 }}>All critical fields complete</div>
        ) : (
          <div className="chips">
            {r.missingCriticalFields.map(f => (
              <span key={f} className="chip" style={{ borderColor: '#f59e0b', color: '#92400e', background: '#fffbeb' }}>
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card 5 — Today at a glance */}
      {!calLoading && todayEvents.length > 0 && (
        <div style={{ ...cardStyle(), borderColor: '#0b8278', borderWidth: 2 }}>
          <div style={{ ...titleStyle, color: '#0b8278' }}>
            Today — {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/St_Lucia' }).format(new Date())}
          </div>
          {holiday && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#92400e', fontWeight: 700 }}>
              Public holiday — clinic may be modified
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {todayEvents.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 8px', borderRadius: 5, background: '#f8fffe' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 80 }}>
                  {formatTime(ev.start)}
                </span>
                <span style={{ fontSize: 12, fontWeight: ev.type === 'break' ? 400 : 600, color: ev.type === 'break' ? 'var(--muted)' : '#1a2e2b', flex: 1 }}>
                  {ev.summary}
                </span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, ...typeChip(ev.type) }}>
                  {ev.type}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            {SITE_LABELS[ctx.currentSite as keyof typeof SITE_LABELS] ?? ctx.currentSite} · amisesuite@gmail.com
          </div>
        </div>
      )}

      {/* Card 6 — Upcoming schedule browser */}
      <div style={cardStyle(true)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={titleStyle}>Upcoming appointments</div>
            {syncStatus === 'live' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Live
              </span>
            )}
            {syncStatus === 'cached' && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 10, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cached
              </span>
            )}
          </div>
          {calLoading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</span>}
        </div>

        {!calLoading && dates.length === 0 && (
          <div style={emptyStyle}>
            No upcoming appointments found
          </div>
        )}

        {dates.length > 0 && (
          <>
            {/* Date tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {dates.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selectedDate === d ? 'var(--accent)' : '#e2e8f0',
                    background: selectedDate === d ? 'var(--accent)' : '#fff',
                    color: selectedDate === d ? '#fff' : (d === today ? 'var(--accent)' : '#374151'),
                  }}
                >
                  {d === today ? 'Today' : formatDateHeading(byDate[d][0].start)}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>·{byDate[d].filter(e => e.type !== 'break').length}</span>
                </button>
              ))}
            </div>

            {/* Event list for selected date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {selectedEvents.length === 0 ? (
                <div style={emptyStyle}>No appointments</div>
              ) : (
                selectedEvents.map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 8px', borderRadius: 5, background: '#f8fffe' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 80 }}>
                      {formatTime(ev.start)}–{formatTime(ev.end)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: ev.type === 'break' ? 400 : 600, color: ev.type === 'break' ? 'var(--muted)' : '#1a2e2b', flex: 1 }}>
                      {ev.summary}
                    </span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700, flexShrink: 0, ...typeChip(ev.type) }}>
                      {ev.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {profile && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            Logged in as {profile.full_name ?? profile.email} · {profile.role}
          </div>
        )}
      </div>
    </div>
  );
}
