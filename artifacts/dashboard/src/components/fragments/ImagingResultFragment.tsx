import React from 'react';
import type { ClinicalFact, ImagingResultValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

// RadLex codes for common modalities
const MODALITY_CODE: Record<string, string> = {
  'CT':        'RID10321',
  'MRI':       'RID10312',
  'Ultrasound':'RID10326',
  'X-ray':     'RID10361',
  'PET':       'RID10317',
  'Mammogram': 'RID10357',
  'Fluoroscopy':'RID10330',
};

interface Props {
  fact: ClinicalFact<'imaging_result'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function ImagingResultFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as ImagingResultValue;
  const radlexCode = MODALITY_CODE[v.modality] ?? null;

  return (
    <FragmentShell
      fact={fact}
      codeValue={radlexCode}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 12 : 14, color: '#111827' }}>
          {v.modality} — {v.region}
          {v.laterality && <span style={{ fontWeight: 400, color: '#6b7280' }}> ({v.laterality})</span>}
        </span>
        {v.isAbnormal && !v.urgentFindings.length && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: '#fef3c7', color: '#92400e', textTransform: 'uppercase',
          }}>
            Abnormal
          </span>
        )}
        {v.urgentFindings.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 3,
            background: '#b91c1c', color: '#fff', textTransform: 'uppercase',
          }}>
            ⚠ Urgent finding
          </span>
        )}
      </div>

      {!compact && (
        <>
          {v.urgentFindings.length > 0 && (
            <div style={{
              marginTop: 4, padding: '4px 8px', borderRadius: 4,
              background: '#fee2e2', border: '1px solid #fca5a5', fontSize: 11, color: '#991b1b',
            }}>
              {v.urgentFindings.join(' · ')}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
            <strong>Impression:</strong> {v.impression}
          </div>
          {v.findings && v.findings !== v.impression && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              <strong>Findings:</strong> {v.findings}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10 }}>
            <span>{new Date(v.performedAt).toLocaleDateString('en-GB')}</span>
            {v.reportedBy && <span>Reported by: {v.reportedBy}</span>}
          </div>
        </>
      )}
    </FragmentShell>
  );
}
