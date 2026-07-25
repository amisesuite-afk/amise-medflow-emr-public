import { useEffect, useState } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

interface OpenTask {
  id: string;
  task_type: string;
  description: string;
  due_date?: string;
  priority: string;
  status: string;
  encounter_id?: string | null;
}

interface OpenTasksBannerProps {
  patientId: string | null;
  encounterId: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#dc2626',
  high:   '#ea580c',
  normal: '#d97706',
  low:    '#6b7280',
};

const TASK_LABELS: Record<string, string> = {
  follow_up_appointment: 'Follow-up appt',
  pending_result:        'Pending result',
  prescription_fill:     'Prescription',
  referral_response:     'Referral response',
  procedure_scheduling:  'Procedure scheduling',
  result_review:         'Result review',
  document_review:       'Document review',
  callback:              'Callback',
  other:                 'Task',
};

export default function OpenTasksBanner({ patientId, encounterId }: OpenTasksBannerProps) {
  const [tasks, setTasks] = useState<OpenTask[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    setTasks([]);
    if (!patientId || !encounterId) return;

    const base = getApiOrigin();
    void (async () => {
      try {
        const headers = await staffAuthHeaders();
        const res = await fetch(`${base}/api/referrals/open-tasks/${patientId}`, { headers });
        if (!res.ok) return;
        const data = await res.json() as { tasks: OpenTask[] };
        // Only show tasks NOT from the current encounter (prior-encounter tasks)
        setTasks((data.tasks ?? []).filter(t => !t.encounter_id || t.encounter_id !== encounterId));
      } catch {
        // silent — banner is optional
      }
    })();
  }, [patientId, encounterId]);

  if (!tasks.length || dismissed) return null;

  const urgentCount = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;

  return (
    <div style={{
      margin: '0 0 10px',
      padding: '10px 14px',
      borderRadius: 10,
      border: `1.5px solid ${urgentCount ? '#fca5a5' : '#fde68a'}`,
      background: urgentCount ? '#fef2f2' : '#fefce8',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{urgentCount ? '🔴' : '📋'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: urgentCount ? '#991b1b' : '#854d0e', marginBottom: 6 }}>
          {tasks.length} unresolved task{tasks.length !== 1 ? 's' : ''} from prior encounter{tasks.length !== 1 ? 's' : ''}
          {urgentCount ? ` — ${urgentCount} high priority` : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {tasks.slice(0, 6).map(t => (
            <span key={t.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 20, fontSize: 11,
              fontWeight: 600,
              background: '#fff',
              border: `1.5px solid ${PRIORITY_COLOR[t.priority] ?? '#d1d5db'}`,
              color: PRIORITY_COLOR[t.priority] ?? '#374151',
            }}>
              {TASK_LABELS[t.task_type] ?? t.task_type}
              {t.description ? `: ${t.description.slice(0, 40)}${t.description.length > 40 ? '…' : ''}` : ''}
            </span>
          ))}
          {tasks.length > 6 && (
            <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>
              +{tasks.length - 6} more
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9ca3af', fontSize: 16, lineHeight: 1, flexShrink: 0,
          padding: '0 2px',
        }}
      >×</button>
    </div>
  );
}
