import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'open' | 'in_progress' | 'overdue' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

const TASK_TYPES = [
  'Follow-up appointment',
  'Pending result',
  'Prescription fill',
  'Referral response',
  'Procedure scheduling',
  'Result review',
  'Document review',
  'Callback',
  'Other',
] as const;

type TaskType = (typeof TASK_TYPES)[number];

interface PatientTask {
  id: string;
  patient_id: string;
  task_type: TaskType;
  description: string;
  due_date: string;
  priority: TaskPriority;
  assigned_to: string | null;
  notes: string | null;
  status: TaskStatus;
  created_at: string;
  created_by: string;
  completed_at: string | null;
  completed_by: string | null;
  patients?: { full_name: string } | null;
}

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; fg: string; border: string }> = {
  urgent: { bg: '#fef2f2', fg: '#dc2626', border: '#fca5a5' },
  high:   { bg: '#fff7ed', fg: '#c2410c', border: '#fdba74' },
  normal: { bg: '#eff6ff', fg: '#1d4ed8', border: '#93c5fd' },
  low:    { bg: '#f0fdf4', fg: '#15803d', border: '#86efac' },
};

const TYPE_ICONS: Record<string, string> = {
  'Follow-up appointment': '📅',
  'Pending result':        '🔬',
  'Prescription fill':     '💊',
  'Referral response':     '📨',
  'Procedure scheduling':  '🏥',
  'Result review':         '📋',
  'Document review':       '📄',
  'Callback':              '📞',
  'Other':                 '📝',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntilDue(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function dueDateLabel(dueDate: string): { text: string; color: string } {
  const days = daysUntilDue(dueDate);
  if (days < 0)  return { text: `Overdue by ${Math.abs(days)}d`, color: '#dc2626' };
  if (days === 0) return { text: 'Due today', color: '#c2410c' };
  if (days === 1) return { text: 'Due tomorrow', color: '#b45309' };
  return { text: `Due in ${days}d`, color: '#6b7280' };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function sortTasks(tasks: PatientTask[]): PatientTask[] {
  return [...tasks].sort((a, b) => {
    // overdue first
    const aOverdue = daysUntilDue(a.due_date) < 0 ? 0 : 1;
    const bOverdue = daysUntilDue(b.due_date) < 0 ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    // then by priority
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    // then by due date
    return a.due_date.localeCompare(b.due_date);
  });
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db',
  fontSize: 13, width: '100%', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, background: '#fff' };

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
};

const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13,
};

const btnSecondary = (color: string): React.CSSProperties => ({
  padding: '5px 12px', borderRadius: 6, border: `1.5px solid ${color}`,
  cursor: 'pointer', background: '#fff', color, fontWeight: 600, fontSize: 12,
});

const badge = (bg: string, fg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 99,
  fontSize: 11, fontWeight: 700, background: bg, color: fg,
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientTasksTab() {
  const { patientId, patientName } = useAppContext();
  const { profile } = useAuth();
  const { showToast } = useToast();

  // task data
  const [tasks, setTasks] = useState<PatientTask[]>([]);
  const [loading, setLoading] = useState(true);

  // new task form
  const [taskType, setTaskType] = useState<TaskType>('Follow-up appointment');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // complete modal
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');

  // snooze modal
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [snoozeDate, setSnoozeDate] = useState('');

  // completed tasks filter
  const [completedDays, setCompletedDays] = useState(30);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let query;
      if (patientId) {
        query = supabase
          .from('patient_tasks')
          .select('*')
          .eq('patient_id', patientId)
          .order('due_date', { ascending: true });
      } else {
        query = supabase
          .from('patient_tasks')
          .select('*, patients(full_name)')
          .in('status', ['open', 'in_progress', 'overdue'])
          .order('due_date', { ascending: true });
      }
      const { data, error } = await query;
      if (error) throw error;
      setTasks((data as PatientTask[]) ?? []);
    } catch (e) {
      showToast(`Failed to load tasks: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [patientId, showToast]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Derived counts ────────────────────────────────────────────────────────

  const activeTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'overdue');
  const overdueTasks = activeTasks.filter(t => daysUntilDue(t.due_date) < 0);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - completedDays);
  const completedTasks = tasks.filter(
    t => t.status === 'completed' && t.completed_at && new Date(t.completed_at) >= cutoff,
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  async function createTask() {
    if (!supabase || !description.trim() || !dueDate) {
      showToast('Please fill in description and due date.', 'error');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('patient_tasks').insert({
        patient_id: patientId || null,
        task_type: taskType,
        description: description.trim(),
        due_date: dueDate,
        priority,
        assigned_to: assignedTo.trim() || null,
        notes: notes.trim() || null,
        status: 'open' as TaskStatus,
        created_by: profile?.id ?? 'unknown',
      });
      if (error) throw error;
      showToast('Task created.', 'success');
      setDescription(''); setDueDate(''); setPriority('normal');
      setAssignedTo(''); setNotes(''); setTaskType('Follow-up appointment');
      await loadTasks();
    } catch (e) {
      showToast(`Failed to create task: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setCreating(false);
    }
  }

  async function completeTask() {
    if (!supabase || !completingId) return;
    try {
      const { error } = await supabase.from('patient_tasks').update({
        status: 'completed' as TaskStatus,
        completed_at: new Date().toISOString(),
        completed_by: profile?.id ?? 'unknown',
        notes: actionNote.trim() || null,
      }).eq('id', completingId);
      if (error) throw error;
      showToast('Task completed.', 'success');
      setCompletingId(null); setActionNote('');
      await loadTasks();
    } catch (e) {
      showToast(`Failed to complete task: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  async function snoozeTask() {
    if (!supabase || !snoozingId || !snoozeDate) return;
    try {
      const { error } = await supabase.from('patient_tasks').update({
        due_date: snoozeDate,
        status: 'open' as TaskStatus,
      }).eq('id', snoozingId);
      if (error) throw error;
      showToast('Task snoozed.', 'success');
      setSnoozingId(null); setSnoozeDate('');
      await loadTasks();
    } catch (e) {
      showToast(`Failed to snooze task: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  async function cancelTask(taskId: string) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('patient_tasks').update({
        status: 'cancelled' as TaskStatus,
      }).eq('id', taskId);
      if (error) throw error;
      showToast('Task cancelled.', 'success');
      await loadTasks();
    } catch (e) {
      showToast(`Failed to cancel task: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="gap-y">

      {/* ── Overview dashboard ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4,
      }}>
        <div style={{
          flex: '1 1 120px', padding: '14px 16px', borderRadius: 10,
          background: '#eff6ff', border: '1px solid #bfdbfe',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Open
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af', marginTop: 2 }}>
            {activeTasks.length}
          </div>
        </div>

        <div style={{
          flex: '1 1 120px', padding: '14px 16px', borderRadius: 10,
          background: overdueTasks.length > 0 ? '#fef2f2' : '#f9fafb',
          border: `1px solid ${overdueTasks.length > 0 ? '#fca5a5' : '#e5e7eb'}`,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: overdueTasks.length > 0 ? '#dc2626' : '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Overdue
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: overdueTasks.length > 0 ? '#b91c1c' : '#9ca3af', marginTop: 2 }}>
            {overdueTasks.length}
          </div>
        </div>

        <div style={{
          flex: '1 1 120px', padding: '14px 16px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Completed ({completedDays}d)
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#166534', marginTop: 2 }}>
            {completedTasks.length}
          </div>
        </div>
      </div>

      {!patientId && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, background: '#eff6ff',
          border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', fontWeight: 600,
        }}>
          Worklist mode — showing all open tasks across patients. Select a patient to filter.
        </div>
      )}

      {/* ── Add new task ───────────────────────────────────────────── */}
      <CollapsibleCard title="Add New Task" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="fld">
            <label style={labelStyle}>Task Type</label>
            <select style={selectStyle} value={taskType}
              onChange={e => setTaskType(e.target.value as TaskType)}>
              {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="fld">
            <label style={labelStyle}>Priority</label>
            <select style={selectStyle} value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="fld" style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <input style={inputStyle} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Review colonoscopy pathology results" />
          </div>

          <div className="fld">
            <label style={labelStyle}>Due Date</label>
            <input type="date" style={inputStyle} value={dueDate}
              onChange={e => setDueDate(e.target.value)} />
          </div>

          <div className="fld">
            <label style={labelStyle}>Assign To</label>
            <input style={inputStyle} value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="Staff name (free text for now)" />
          </div>

          <div className="fld" style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Additional context or instructions" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <button style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }}
              disabled={creating} onClick={createTask}>
              {creating ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </CollapsibleCard>

      {/* ── Active tasks ───────────────────────────────────────────── */}
      <CollapsibleCard title="Active Tasks" badge={activeTasks.length || undefined}
        badgeVariant={overdueTasks.length > 0 ? 'danger' : 'default'} defaultOpen>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Loading tasks...
          </div>
        ) : activeTasks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No active tasks{patientId ? ` for ${patientName || 'this patient'}` : ''}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortTasks(activeTasks).map(task => {
              const due = dueDateLabel(task.due_date);
              const pc = PRIORITY_COLORS[task.priority];
              const isOverdue = daysUntilDue(task.due_date) < 0;

              return (
                <div key={task.id} style={{
                  padding: '12px 14px', borderRadius: 8,
                  border: `1.5px solid ${isOverdue ? '#fca5a5' : '#e5e7eb'}`,
                  background: isOverdue ? '#fffbfb' : '#fff',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICONS[task.task_type] ?? '📝'}</span>
                    <span style={badge(pc.bg, pc.fg)}>
                      {task.priority.toUpperCase()}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      background: '#f3f4f6', padding: '2px 8px', borderRadius: 99,
                    }}>
                      {task.task_type}
                    </span>
                    {!patientId && task.patients?.full_name && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488' }}>
                        {task.patients.full_name}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: due.color }}>
                      {due.text}
                    </span>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, marginBottom: 4 }}>
                    {task.description}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', marginBottom: 8, flexWrap: 'wrap' }}>
                    <span>Due: {fmtDate(task.due_date)}</span>
                    {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                    {task.notes && <span>Notes: {task.notes}</span>}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={btnSecondary('#15803d')}
                      onClick={() => { setCompletingId(task.id); setActionNote(task.notes ?? ''); }}>
                      Complete
                    </button>
                    <button style={btnSecondary('#b45309')}
                      onClick={() => {
                        setSnoozingId(task.id);
                        const d = new Date(task.due_date);
                        d.setDate(d.getDate() + 3);
                        setSnoozeDate(d.toISOString().slice(0, 10));
                      }}>
                      Snooze
                    </button>
                    <button style={btnSecondary('#dc2626')}
                      onClick={() => cancelTask(task.id)}>
                      Cancel
                    </button>
                  </div>

                  {/* Complete modal inline */}
                  {completingId === task.id && (
                    <div style={{
                      marginTop: 10, padding: 12, borderRadius: 8,
                      background: '#f0fdf4', border: '1px solid #86efac',
                    }}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>Action taken / completion note</label>
                      <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
                        value={actionNote} onChange={e => setActionNote(e.target.value)}
                        placeholder="Describe the action taken to close this task" />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button style={btnPrimary} onClick={completeTask}>Confirm Complete</button>
                        <button style={btnSecondary('#6b7280')}
                          onClick={() => { setCompletingId(null); setActionNote(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Snooze modal inline */}
                  {snoozingId === task.id && (
                    <div style={{
                      marginTop: 10, padding: 12, borderRadius: 8,
                      background: '#fff7ed', border: '1px solid #fdba74',
                    }}>
                      <label style={{ ...labelStyle, marginBottom: 6 }}>New due date</label>
                      <input type="date" style={{ ...inputStyle, maxWidth: 200 }}
                        value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button style={{ ...btnPrimary, background: '#b45309' }} onClick={snoozeTask}>
                          Confirm Snooze
                        </button>
                        <button style={btnSecondary('#6b7280')}
                          onClick={() => { setSnoozingId(null); setSnoozeDate(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Completed tasks ────────────────────────────────────────── */}
      <CollapsibleCard title="Completed Tasks" badge={completedTasks.length || undefined}
        defaultOpen={false}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Show last</label>
          <select style={{ ...selectStyle, width: 'auto' }}
            value={completedDays} onChange={e => setCompletedDays(Number(e.target.value))}>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>

        {completedTasks.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No completed tasks in the last {completedDays} days.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completedTasks.map(task => (
              <div key={task.id} style={{
                padding: '10px 14px', borderRadius: 8,
                border: '1px solid #d1d5db', background: '#f9fafb',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{TYPE_ICONS[task.task_type] ?? '📝'}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 99 }}>
                    {task.task_type}
                  </span>
                  <span style={badge('#f0fdf4', '#15803d')}>COMPLETED</span>
                  {!patientId && task.patients?.full_name && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488' }}>
                      {task.patients.full_name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginBottom: 4 }}>
                  {task.description}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
                  {task.completed_at && <span>Completed: {fmtDateTime(task.completed_at)}</span>}
                  {task.completed_by && <span>By: {task.completed_by}</span>}
                  {task.notes && <span>Notes: {task.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}
