import React from 'react';
import type { ClinicalFact, LabResultValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

// LOINC codes for common surgical labs (partial — the key entries in the honeycomb)
// A full LOINC map would come from a terminology service; these are examples.
const COMMON_LOINC: Record<string, string> = {
  'Haemoglobin':         '718-7',
  'Hemoglobin':          '718-7',
  'WBC':                 '6690-2',
  'Platelets':           '777-3',
  'Sodium':              '2951-2',
  'Potassium':           '2823-3',
  'Creatinine':          '2160-0',
  'Urea':                '3094-0',
  'ALT':                 '1742-6',
  'AST':                 '1920-8',
  'Bilirubin':           '1975-2',
  'CRP':                 '1988-5',
  'Amylase':             '1798-8',
  'Lipase':              '3040-3',
  'INR':                 '34714-6',
  'Lactate':             '2518-9',
  'Troponin':            '6598-7',
  'HbA1c':               '4548-4',
  'TSH':                 '3016-3',
};

const TREND_ICON: Record<NonNullable<LabResultValue['trend']>, string> = {
  improving: '↓', worsening: '↑', stable: '→', new: '★',
};
const TREND_COLOR: Record<NonNullable<LabResultValue['trend']>, string> = {
  improving: '#16a34a', worsening: '#dc2626', stable: '#6b7280', new: '#7c3aed',
};

interface Props {
  fact: ClinicalFact<'lab_result'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function LabResultFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as LabResultValue;
  const loincCode = COMMON_LOINC[v.testName] ?? null;

  const valueColor = v.isCritical ? '#b91c1c'
    : v.isAbnormal ? '#b45309'
    : '#166534';

  return (
    <FragmentShell
      fact={fact}
      codeValue={loincCode ? `${loincCode}` : null}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: compact ? 12 : 13, color: '#374151' }}>
          {v.testName}
          {v.panel && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>({v.panel})</span>}
        </span>

        <span style={{ fontWeight: 700, fontSize: compact ? 13 : 15, color: valueColor, fontFamily: 'monospace' }}>
          {v.result} {v.unit}
        </span>

        {v.isCritical && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 3,
            background: '#b91c1c', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            CRITICAL
          </span>
        )}
        {!v.isCritical && v.isAbnormal && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#fef3c7', color: '#92400e', textTransform: 'uppercase',
          }}>
            Abnormal
          </span>
        )}

        {v.trend && (
          <span style={{ fontSize: 12, color: TREND_COLOR[v.trend], fontWeight: 700 }}>
            {TREND_ICON[v.trend]}
            {!compact && <span style={{ fontSize: 10, marginLeft: 2 }}>{v.trend}</span>}
          </span>
        )}
      </div>

      {!compact && (
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
          Ref: {v.referenceRange}
          {v.previousValue != null && (
            <span style={{ marginLeft: 10 }}>
              Prev: {v.previousValue} {v.unit}
              {v.previousDate && ` (${new Date(v.previousDate).toLocaleDateString('en-GB')})`}
            </span>
          )}
        </div>
      )}
      {!compact && v.laboratory && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{v.laboratory}</div>
      )}
    </FragmentShell>
  );
}
