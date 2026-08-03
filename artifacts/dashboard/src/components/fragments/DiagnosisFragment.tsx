import React from 'react';
import type { ClinicalFact, DiagnosisValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

// ICD-10-CM certainty → visual weight (the "key" within diagnoses)
const CERTAINTY_STYLE: Record<DiagnosisValue['certainty'], React.CSSProperties> = {
  confirmed: { fontWeight: 700, color: '#111827' },
  probable:  { fontWeight: 600, color: '#374151' },
  working:   { fontWeight: 500, color: '#6b7280', fontStyle: 'italic' },
  excluded:  { fontWeight: 400, color: '#9ca3af', textDecoration: 'line-through' },
};

const CERTAINTY_BADGE: Record<DiagnosisValue['certainty'], { bg: string; fg: string }> = {
  confirmed: { bg: '#d1fae5', fg: '#065f46' },
  probable:  { bg: '#fef9c3', fg: '#854d0e' },
  working:   { bg: '#ede9fe', fg: '#5b21b6' },
  excluded:  { bg: '#fee2e2', fg: '#991b1b' },
};

interface Props {
  fact: ClinicalFact<'diagnosis'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function DiagnosisFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as DiagnosisValue;
  const badge = CERTAINTY_BADGE[v.certainty];

  return (
    <FragmentShell
      fact={fact}
      codeValue={v.icd10}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...CERTAINTY_STYLE[v.certainty], fontSize: compact ? 12 : 14 }}>
          {v.name}
        </span>
        {v.laterality && (
          <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>
            ({v.laterality})
          </span>
        )}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
          background: badge.bg, color: badge.fg,
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {v.certainty}
        </span>
        {v.icd10 && (
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
            background: '#f5f3ff', color: '#6b21a8',
            fontFamily: 'monospace',
          }}>
            ICD-10: {v.icd10}
          </span>
        )}
      </div>

      {!compact && v.onsetDate && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
          Onset: {new Date(v.onsetDate).toLocaleDateString('en-GB')}
          {v.resolvedDate && ` → Resolved: ${new Date(v.resolvedDate).toLocaleDateString('en-GB')}`}
        </div>
      )}
    </FragmentShell>
  );
}
