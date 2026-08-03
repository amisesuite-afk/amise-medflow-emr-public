import React from 'react';
import type { ClinicalFact, VitalValue, VitalParameter, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

// LOINC codes for vital signs — the shared key for this fragment type
const VITAL_LOINC: Record<VitalParameter, string> = {
  systolicBp:     '8480-6',
  diastolicBp:    '8462-4',
  heartRate:      '8867-4',
  temperatureC:   '8310-5',
  respiratoryRate:'9279-1',
  spo2:           '59408-5',
  glucoseMmol:    '2339-0',
};

const VITAL_LABEL: Record<VitalParameter, string> = {
  systolicBp:     'SBP',
  diastolicBp:    'DBP',
  heartRate:      'HR',
  temperatureC:   'Temp',
  respiratoryRate:'RR',
  spo2:           'SpO₂',
  glucoseMmol:    'RBS',
};

const VITAL_UNIT: Record<VitalParameter, string> = {
  systolicBp:     'mmHg',
  diastolicBp:    'mmHg',
  heartRate:      'bpm',
  temperatureC:   '°C',
  respiratoryRate:'breaths/min',
  spo2:           '%',
  glucoseMmol:    'mmol/L',
};

interface Props {
  fact: ClinicalFact<'vital'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function VitalFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as VitalValue;
  const loinc = VITAL_LOINC[v.parameter];
  const label = VITAL_LABEL[v.parameter];
  const unit  = VITAL_UNIT[v.parameter];

  const numColor = v.isCritical ? '#b91c1c'
    : v.isAbnormal ? '#b45309'
    : '#065f46';

  return (
    <FragmentShell
      fact={fact}
      codeValue={loinc}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: compact ? 11 : 12, fontWeight: 600, color: '#374151', minWidth: 36 }}>
          {label}
        </span>
        <span style={{
          fontFamily: 'monospace', fontWeight: 800,
          fontSize: compact ? 14 : 18, color: numColor,
        }}>
          {v.numericValue}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{unit}</span>

        {v.isCritical && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
            background: '#b91c1c', color: '#fff', textTransform: 'uppercase',
          }}>
            CRITICAL
          </span>
        )}
        {!v.isCritical && v.isAbnormal && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#fef3c7', color: '#92400e',
          }}>
            ⚠
          </span>
        )}
      </div>

      {!compact && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
          Range: {v.referenceRange[0]}–{v.referenceRange[1]} {unit}
          {v.takenAt && <span style={{ marginLeft: 8 }}>{new Date(v.takenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
          {v.method && <span style={{ marginLeft: 8 }}>{v.method}</span>}
        </div>
      )}
    </FragmentShell>
  );
}
