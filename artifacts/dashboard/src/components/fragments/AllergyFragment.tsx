import React from 'react';
import type { ClinicalFact, AllergyValue, FactStatus } from '@workspace/patient-state';
import { FragmentShell } from './FragmentShell';

// SNOMED CT codes for common allergen categories (the "music key" for allergies)
const SNOMED_CATEGORY: Record<AllergyValue['category'], string> = {
  drug:         '416098002',
  food:         '414285001',
  environmental:'232347008',
  latex:        '300916003',
  contrast:     '409137002',
  other:        '609328004',
};

const SEVERITY_COLOR: Record<AllergyValue['severity'], string> = {
  mild:        '#dcfce7',
  moderate:    '#fef9c3',
  severe:      '#fee2e2',
  anaphylaxis: '#b91c1c',
  unknown:     '#f3f4f6',
};
const SEVERITY_TEXT: Record<AllergyValue['severity'], string> = {
  mild: '#166534', moderate: '#854d0e', severe: '#991b1b',
  anaphylaxis: '#fff', unknown: '#6b7280',
};

interface Props {
  fact: ClinicalFact<'allergy'>;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
}

export function AllergyFragment({ fact, compact, showProvenance, onVerify, onStatusChange, onDismiss }: Props) {
  const v = fact.value as AllergyValue;
  const snomedCode = SNOMED_CATEGORY[v.category];

  return (
    <FragmentShell
      fact={fact}
      codeValue={snomedCode}
      compact={compact}
      showProvenance={showProvenance}
      onVerify={onVerify}
      onStatusChange={onStatusChange}
      onDismiss={onDismiss}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 12 : 14, color: '#111827' }}>
          {v.substance}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          background: SEVERITY_COLOR[v.severity], color: SEVERITY_TEXT[v.severity],
          textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {v.severity}
        </span>
        <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>
          {v.category}
        </span>
      </div>

      {!compact && (
        <>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
            <strong>Reaction:</strong> {v.reaction}
          </div>
          {v.crossReactivities.length > 0 && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 3 }}>
              <strong>Cross-reactive:</strong> {v.crossReactivities.join(', ')}
            </div>
          )}
          {v.onsetDate && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              Onset: {new Date(v.onsetDate).toLocaleDateString('en-GB')}
            </div>
          )}
        </>
      )}
    </FragmentShell>
  );
}
