import React from 'react';
import type { ClinicalFact, TaskValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

const PRIORITY_STYLE: Record<TaskValue['priority'], React.CSSProperties> = {
  critical: { background: '#fee2e2', color: '#991b1b' },
  high:     { background: '#fef3c7', color: '#92400e' },
  medium:   { background: '#eff6ff', color: '#1e40af' },
  low:      { background: '#f3f4f6', color: '#374151' },
};

const CATEGORY_ICON: Record<TaskValue['category'], string> = {
  clinical:       '🩺',
  administrative: '📋',
  investigation:  '🧪',
  follow_up:      '📅',
  documentation:  '📝',
  safety:         '⚠',
};

interface Props {
  fact: ClinicalFact<'task'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
  onComplete?: (id: string, evidence: string) => void;
}

export function TaskFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss, onComplete }: Props) {
  const v = fact.value as TaskValue;
  const isOverdue = v.dueAt && !v.completedAt && new Date(v.dueAt) < new Date();
  const isDone    = !!v.completedAt;

  return (
    <FragmentShell
      fact={fact}
      codeValue={null}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
      actionSlot={
        !isDone && onComplete ? (
          <button
            type="button"
            onClick={() => onComplete(fact.id, 'Done')}
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: '#166534', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Mark done ✓
          </button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? 11 : 12 }}>{CATEGORY_ICON[v.category]}</span>
        <span style={{
          fontWeight: isDone ? 400 : 600,
          fontSize: compact ? 12 : 13,
          color: isDone ? '#9ca3af' : '#111827',
          textDecoration: isDone ? 'line-through' : undefined,
        }}>
          {v.title}
        </span>
        <span style={{
          ...PRIORITY_STYLE[v.priority],
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {v.priority}
        </span>
        {isOverdue && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#b91c1c', color: '#fff', textTransform: 'uppercase',
          }}>
            OVERDUE
          </span>
        )}
      </div>

      {!compact && (
        <>
          {v.description && (
            <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>{v.description}</div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10 }}>
            {v.assignedTo && <span>Assigned: {v.assignedTo}</span>}
            {v.dueAt && <span>Due: {new Date(v.dueAt).toLocaleDateString('en-GB')}</span>}
            {v.completedAt && (
              <span style={{ color: '#065f46' }}>
                Done: {new Date(v.completedAt).toLocaleDateString('en-GB')}
                {v.completedBy && ` by ${v.completedBy}`}
              </span>
            )}
          </div>
        </>
      )}
    </FragmentShell>
  );
}
