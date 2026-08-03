import React from 'react';
import type { ClinicalFact, InvestigationOrderValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

const URGENCY_STYLE: Record<InvestigationOrderValue['urgency'], React.CSSProperties> = {
  stat:    { background: '#fee2e2', color: '#991b1b' },
  urgent:  { background: '#fef3c7', color: '#92400e' },
  routine: { background: '#f3f4f6', color: '#374151' },
};

const CATEGORY_ICON: Record<InvestigationOrderValue['category'], string> = {
  laboratory:       '🧪',
  radiology:        '🩻',
  histopathology:   '🔭',
  endoscopy:        '🔬',
  cardiology:       '💓',
  other:            '📤',
};

interface Props {
  fact: ClinicalFact<'investigation_order'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function InvestigationOrderFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as InvestigationOrderValue;
  const isOverdue = v.dueBy && !v.resultFactId && new Date(v.dueBy) < new Date();

  return (
    <FragmentShell
      fact={fact}
      codeValue={null}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: compact ? 11 : 13 }}>{CATEGORY_ICON[v.category]}</span>
        <span style={{ fontWeight: 600, fontSize: compact ? 12 : 13, color: '#111827' }}>
          {v.testName}
          {v.panel && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>({v.panel})</span>}
        </span>
        <span style={{
          ...URGENCY_STYLE[v.urgency],
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {v.urgency}
        </span>
        {isOverdue && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase',
          }}>
            OVERDUE
          </span>
        )}
        {v.resultFactId && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#d1fae5', color: '#065f46',
          }}>
            ✓ Result received
          </span>
        )}
      </div>

      {!compact && (
        <>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 3 }}>
            <strong>Indication:</strong> {v.indication}
          </div>
          {v.clinicalQuestion && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>
              "{v.clinicalQuestion}"
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10 }}>
            <span>Ordered: {new Date(v.orderedAt).toLocaleDateString('en-GB')}</span>
            {v.dueBy && <span>Due: {new Date(v.dueBy).toLocaleDateString('en-GB')}</span>}
          </div>
        </>
      )}
    </FragmentShell>
  );
}
