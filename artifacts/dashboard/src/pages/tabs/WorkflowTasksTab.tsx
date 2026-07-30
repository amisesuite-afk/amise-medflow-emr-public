import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';

// ── Types ────────────────────────────────────────────────────────────────────

type WTaskStatus   = 'open' | 'in_progress' | 'resolved' | 'dismissed';
type WTaskPriority = 'urgent' | 'high' | 'normal' | 'low';
type WTaskType =
  | 'review_result'
  | 'inform_patient'
  | 'sign_note'
  | 'await_referral'
  | 'await_investigation'
  | 'pay_invoice'
  | 'follow_up_overdue'
  | 'other';

interface WorkflowTask {
  id: string;
  task_type: WTaskType;
  title: string;
  details: string | null;
  patient_id: string | null;
  encounter_id: string | null;
  source_type: string | null;
  source_id: string | null;
  status: WTaskStatus;
  priority: WTaskPriority;
  due_at: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: WTaskPriority[] = ['urgent', 'high', 'normal', 'low'];

const PRIORITY_STYLE: Record<WTaskPriority, { pill: string; border: string }> = {
  urgent: { pill: 'background:#fef2f2;color:#dc2626;border:1px solid #fca5a5', border: '#fca5a5' },
  high:   { pill: 'background:#fff7ed;color:#c2410c;border:1px solid #fdba74', border: '#fdba74' },
  normal: { pill: 'background:#f0f9ff;color:#0369a1;border:1px solid #7dd3fc', border: '#7dd3fc' },
  low:    { pill: 'background:#f0fdf4;color:#16a34a;border:1px solid #86efac', border: '#86efac' },
};

const TYPE_LABEL: Record<WTaskType, string> = {
  review_result:        'Review result',
  inform_patient:       'Inform patient',
  sign_note:            'Sign note',
  await_referral:       'Await referral',
  await_investigation:  'Await investigation',
  pay_invoice:          'Pay invoice',
  follow_up_overdue:    'Follow-up overdue',
  other:                'Other',
};

const TYPE_ICON: Record<WTaskType, string> = {
  review_result:       '🔬',
  inform_patient:      '📞',
  sign_note:           '✍️',
  await_referral:      '📨',
  await_investigation: '⏳',
  pay_invoice:         '💳',
  follow_up_overdue:   '📅',
  other:               '📌',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-LC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sortTasks(tasks: WorkflowTask[]): WorkflowTask[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkflowTasksTab() {
  const { currentPatient, currentEncounterId } = useAppContext();
  const { showToast } = useToast();

  const [tasks, setTasks]           = useState<WorkflowTask[]>([]);
  const [loading, setLoading]       = useState(false);
  const [statusFilter, setStatusFilter] = useState<WTaskStatus | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState<WTaskType | 'all'>('all');
  const [resolving, setResolving]   = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params = new URLSearchParams();
      if (currentPatient?.id) params.set('patientId', currentPatient.id);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all')   params.set('type', typeFilter);

      const resp = await fetch(`/api/workflow-tasks?${params.toString()}`, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json() as { tasks: WorkflowTask[] };
      setTasks(json.tasks);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== 'AbortError') {
        showToast('Failed to load workflow tasks', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [currentPatient?.id, statusFilter, typeFilter, showToast]);

  useEffect(() => { void load(); }, [load]);

  async function resolveTask(id: string, action: 'resolved' | 'dismissed') {
    setResolving(r => ({ ...r, [id]: true }));
    try {
      const resp = await fetch(`/api/workflow-tasks/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast(action === 'resolved' ? 'Task resolved' : 'Task dismissed', 'success');
      await load();
    } catch {
      showToast('Failed to update task', 'error');
    } finally {
      setResolving(r => ({ ...r, [id]: false }));
    }
  }

  const open = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
  const done = tasks.filter(t => t.status === 'resolved' || t.status === 'dismissed');

  const sorted = sortTasks(statusFilter === 'all' ? tasks : (statusFilter === 'open' || statusFilter === 'in_progress' ? open : done));

  // group by type for the open view
  const byType = PRIORITY_ORDER.flatMap(() => []).length === 0
    ? sorted
    : sorted;

  const urgentCount = open.filter(t => t.priority === 'urgent').length;
  const highCount   = open.filter(t => t.priority === 'high').length;

  return (
    <div style={{ padding: '16px', maxWidth: 900 }}>

      {/* Summary strip */}
      {(urgentCount > 0 || highCount > 0) && (
        <div style={{ display:'flex', gap:8, marginBottom:16, padding:'10px 14px', borderRadius:8, background:'#fef2f2', border:'1px solid #fca5a5' }}>
          {urgentCount > 0 && (
            <span style={{ fontWeight:700, color:'#dc2626', fontSize:14 }}>
              🚨 {urgentCount} urgent
            </span>
          )}
          {highCount > 0 && (
            <span style={{ fontWeight:600, color:'#c2410c', fontSize:14 }}>
              ⚠️ {highCount} high priority
            </span>
          )}
          <span style={{ color:'#6b7280', fontSize:13 }}>— requires clinician attention</span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as WTaskStatus | 'all')}
          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13 }}
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All statuses</option>
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as WTaskType | 'all')}
          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13 }}
        >
          <option value="all">All types</option>
          {(Object.keys(TYPE_LABEL) as WTaskType[]).map(k => (
            <option key={k} value={k}>{TYPE_ICON[k]} {TYPE_LABEL[k]}</option>
          ))}
        </select>

        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', cursor:'pointer', fontSize:13 }}
        >
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>

        <button
          onClick={() => setShowCreate(c => !c)}
          style={{ padding:'6px 12px', borderRadius:6, border:'1px solid #2563eb', background:'#eff6ff', color:'#1d4ed8', cursor:'pointer', fontSize:13, marginLeft:'auto' }}
        >
          + Add task
        </button>
      </div>

      {/* Manual create form */}
      {showCreate && (
        <CreateTaskForm
          patientId={currentPatient?.id ?? null}
          encounterId={currentEncounterId ?? null}
          onCreated={async () => { setShowCreate(false); await load(); }}
          onCancel={() => setShowCreate(false)}
          showToast={showToast}
        />
      )}

      {/* Task list */}
      {loading && tasks.length === 0 ? (
        <div style={{ color:'#6b7280', fontSize:14, padding:'24px 0', textAlign:'center' }}>Loading tasks…</div>
      ) : sorted.length === 0 ? (
        <div style={{ color:'#6b7280', fontSize:14, padding:'24px 0', textAlign:'center' }}>
          {statusFilter === 'open' ? '✅ No open tasks' : 'No tasks found'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {byType.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              resolving={resolving[task.id] ?? false}
              onResolve={resolveTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  resolving,
  onResolve,
}: {
  task: WorkflowTask;
  resolving: boolean;
  onResolve: (id: string, action: 'resolved' | 'dismissed') => Promise<void>;
}) {
  const isDone = task.status === 'resolved' || task.status === 'dismissed';
  const ps = PRIORITY_STYLE[task.priority];

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${isDone ? '#e5e7eb' : ps.border}`,
      background: isDone ? '#fafafa' : 'var(--card-bg, #fff)',
      padding: '12px 16px',
      opacity: isDone ? 0.7 : 1,
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <span style={{ fontSize:20, lineHeight:'1', marginTop:2 }}>{TYPE_ICON[task.task_type]}</span>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontWeight:600, fontSize:14, color: isDone ? '#6b7280' : '#111827' }}>
              {task.title}
            </span>
            <span style={{
              fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
              textTransform:'uppercase', letterSpacing:'0.05em',
              ...parsePillStyle(ps.pill),
            }}>
              {task.priority}
            </span>
            <span style={{ fontSize:11, color:'#6b7280', background:'#f3f4f6', padding:'2px 7px', borderRadius:20 }}>
              {TYPE_LABEL[task.task_type]}
            </span>
            {task.status !== 'open' && (
              <span style={{ fontSize:11, color:'#6b7280', background:'#f3f4f6', padding:'2px 7px', borderRadius:20 }}>
                {task.status}
              </span>
            )}
          </div>

          {task.details && (
            <div style={{ fontSize:13, color:'#374151', marginTop:4 }}>{task.details}</div>
          )}

          <div style={{ display:'flex', gap:12, marginTop:6, fontSize:12, color:'#9ca3af' }}>
            <span>Created {fmtDate(task.created_at)}</span>
            {task.due_at && <span>Due {fmtDate(task.due_at)}</span>}
            {task.resolved_at && <span>{task.status === 'resolved' ? 'Resolved' : 'Dismissed'} {fmtDate(task.resolved_at)}</span>}
          </div>
        </div>

        {!isDone && (
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button
              disabled={resolving}
              onClick={() => void onResolve(task.id, 'resolved')}
              style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #16a34a', background:'#f0fdf4', color:'#15803d', cursor:'pointer', fontSize:12, fontWeight:500 }}
            >
              {resolving ? '…' : '✓ Done'}
            </button>
            <button
              disabled={resolving}
              onClick={() => void onResolve(task.id, 'dismissed')}
              style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #d1d5db', background:'#f9fafb', color:'#6b7280', cursor:'pointer', fontSize:12 }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Converts a style string like "background:#fff;color:#000" to a CSSProperties object
function parsePillStyle(s: string): Record<string, string> {
  return Object.fromEntries(
    s.split(';').filter(Boolean).map(pair => {
      const idx = pair.indexOf(':');
      const key = pair.slice(0, idx).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return [key, pair.slice(idx + 1).trim()];
    })
  );
}

// ── CreateTaskForm ────────────────────────────────────────────────────────────

type ShowToast = (msg: string, type: 'success' | 'error' | 'info') => void;

function CreateTaskForm({
  patientId,
  encounterId,
  onCreated,
  onCancel,
  showToast,
}: {
  patientId: string | null;
  encounterId: string | null;
  onCreated: () => Promise<void>;
  onCancel: () => void;
  showToast: ShowToast;
}) {
  const [taskType, setTaskType] = useState<WTaskType>('other');
  const [title, setTitle]       = useState('');
  const [details, setDetails]   = useState('');
  const [priority, setPriority] = useState<WTaskPriority>('normal');
  const [saving, setSaving]     = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/workflow-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, patientId, encounterId, title: title.trim(), details: details.trim() || null, priority }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      showToast('Task created', 'success');
      await onCreated();
    } catch {
      showToast('Failed to create task', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={e => void submit(e)}
      style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:16, marginBottom:16, background:'#f9fafb' }}
    >
      <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>New workflow task</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <label style={{ fontSize:12, color:'#374151' }}>
          Type
          <select
            value={taskType}
            onChange={e => setTaskType(e.target.value as WTaskType)}
            style={{ display:'block', width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #d1d5db', marginTop:4, fontSize:13 }}
          >
            {(Object.keys(TYPE_LABEL) as WTaskType[]).map(k => (
              <option key={k} value={k}>{TYPE_ICON[k]} {TYPE_LABEL[k]}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize:12, color:'#374151' }}>
          Priority
          <select
            value={priority}
            onChange={e => setPriority(e.target.value as WTaskPriority)}
            style={{ display:'block', width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #d1d5db', marginTop:4, fontSize:13 }}
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      <label style={{ fontSize:12, color:'#374151', display:'block', marginBottom:10 }}>
        Title *
        <input
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Review FBC result"
          style={{ display:'block', width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:6, border:'1px solid #d1d5db', marginTop:4, fontSize:13 }}
        />
      </label>

      <label style={{ fontSize:12, color:'#374151', display:'block', marginBottom:12 }}>
        Details (optional)
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={2}
          style={{ display:'block', width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:6, border:'1px solid #d1d5db', marginTop:4, fontSize:13, resize:'vertical' }}
        />
      </label>

      <div style={{ display:'flex', gap:8 }}>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          style={{ padding:'7px 16px', borderRadius:6, border:'1px solid #2563eb', background:'#2563eb', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 }}
        >
          {saving ? 'Saving…' : 'Create task'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding:'7px 16px', borderRadius:6, border:'1px solid #d1d5db', background:'#fff', color:'#374151', cursor:'pointer', fontSize:13 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
