import React from 'react';
import type { ClinicalFact, MedicationValue, PrescriptionValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

interface Props {
  fact: ClinicalFact<'medication'> | ClinicalFact<'prescription'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
  /** Optional RxNorm code for this drug */
  rxNormCode?: string | null;
}

export function MedicationFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss, rxNormCode }: Props) {
  const v = fact.value as MedicationValue & Partial<PrescriptionValue>;
  const isPrescription = fact.factType === 'prescription';

  // Safety flag: prescription with unchecked allergy interaction
  const allergyUnchecked = isPrescription && (v as PrescriptionValue).allergyChecked === false;
  const interactionUnchecked = isPrescription && (v as PrescriptionValue).interactionChecked === false;

  return (
    <FragmentShell
      fact={fact}
      codeValue={rxNormCode ?? null}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
      actionSlot={
        isPrescription && (allergyUnchecked || interactionUnchecked) ? (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
            background: '#fee2e2', color: '#991b1b',
          }}>
            {allergyUnchecked ? '⚠ Allergy unchecked' : '⚠ Interactions unchecked'}
          </span>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 12 : 14, color: '#111827' }}>
          {v.name}
        </span>
        {v.genericName && v.genericName !== v.name && (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>({v.genericName})</span>
        )}
        <span style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
          {v.dose} {v.unit}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{v.route} · {v.frequency}</span>
      </div>

      {!compact && (
        <>
          {v.indication && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
              For: {v.indication}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 10 }}>
            {v.startDate && <span>Started: {new Date(v.startDate).toLocaleDateString('en-GB')}</span>}
            {v.endDate   && <span>Until: {new Date(v.endDate).toLocaleDateString('en-GB')}</span>}
            {v.isLongTerm && <span style={{ color: '#4f46e5', fontWeight: 600 }}>Long-term</span>}
          </div>
          {isPrescription && (v as PrescriptionValue).overrideReason && (
            <div style={{ fontSize: 10, color: '#b45309', marginTop: 3 }}>
              Override: {(v as PrescriptionValue).overrideReason}
            </div>
          )}
        </>
      )}
    </FragmentShell>
  );
}
