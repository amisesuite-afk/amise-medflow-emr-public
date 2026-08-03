// ─── PathologyFragmentRenderer ────────────────────────────────────────────────
//
// THE PUZZLE BOARD.
//
// Accepts any ClinicalFact, reads its factType (the music key / hexagon centre),
// and dispatches to the correct fragment component. The caller never needs to
// know which component renders which fact — they just hand a fact to this and
// the board places it in the right cell.
//
// Geometric read: this is the tessellation function. Given a tile's code
// (factType), it knows which slot in the honeycomb it belongs to.

import React from 'react';
import type { ClinicalFact, FactStatus } from '@workspace/patient-state';

import { AllergyFragment }            from './AllergyFragment';
import { DiagnosisFragment }          from './DiagnosisFragment';
import { MedicationFragment }         from './MedicationFragment';
import { LabResultFragment }          from './LabResultFragment';
import { VitalFragment }              from './VitalFragment';
import { InvestigationOrderFragment } from './InvestigationOrderFragment';
import { TaskFragment }               from './TaskFragment';
import { ImagingResultFragment }      from './ImagingResultFragment';
import { FragmentShell }              from './FragmentShell';

export interface FragmentRendererProps {
  fact: ClinicalFact;
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
  onTaskComplete?: (id: string, evidence: string) => void;
}

export function PathologyFragmentRenderer({
  fact, compact, showProvenance, onVerify, onStatusChange, onDismiss, onTaskComplete,
}: FragmentRendererProps) {
  const common = { compact, showProvenance, onVerify, onStatusChange, onDismiss };

  switch (fact.factType) {
    case 'allergy':
      return <AllergyFragment fact={fact as ClinicalFact<'allergy'>} {...common} />;

    case 'diagnosis':
      return <DiagnosisFragment fact={fact as ClinicalFact<'diagnosis'>} {...common} />;

    case 'medication':
      return <MedicationFragment fact={fact as ClinicalFact<'medication'>} {...common} />;

    case 'prescription':
      return <MedicationFragment fact={fact as ClinicalFact<'prescription'>} {...common} />;

    case 'lab_result':
    case 'pathology_result':
      return <LabResultFragment fact={fact as ClinicalFact<'lab_result'>} {...common} />;

    case 'vital':
      return <VitalFragment fact={fact as ClinicalFact<'vital'>} {...common} />;

    case 'investigation_order':
      return <InvestigationOrderFragment fact={fact as ClinicalFact<'investigation_order'>} {...common} />;

    case 'task':
      return (
        <TaskFragment
          fact={fact as ClinicalFact<'task'>}
          {...common}
          onComplete={onTaskComplete}
        />
      );

    case 'imaging_result':
      return <ImagingResultFragment fact={fact as ClinicalFact<'imaging_result'>} {...common} />;

    // Remaining types: render a minimal shell with raw JSON until dedicated
    // fragments are built for them — the board has reserved their cells.
    default:
      return (
        <FragmentShell fact={fact} compact={compact} showProvenance={showProvenance} onDismiss={onDismiss}>
          <pre style={{ fontSize: 10, color: '#6b7280', margin: 0, overflowX: 'auto' }}>
            {JSON.stringify(fact.value, null, 2)}
          </pre>
        </FragmentShell>
      );
  }
}

// ── FragmentList ───────────────────────────────────────────────────────────────
// Renders a sorted, filtered collection of facts as a fragment stack.

import { SEVERITY_ORDER } from './pathology-codes';

export interface FragmentListProps {
  facts: ClinicalFact[];
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
  onTaskComplete?: (id: string, evidence: string) => void;
  emptyMessage?: string;
}

export function FragmentList({
  facts, compact, showProvenance,
  onVerify, onStatusChange, onDismiss, onTaskComplete,
  emptyMessage = 'No items',
}: FragmentListProps) {
  const sorted = [...facts].sort((a, b) => {
    const ao = SEVERITY_ORDER[a.factType] ?? 99;
    const bo = SEVERITY_ORDER[b.factType] ?? 99;
    return ao !== bo ? ao - bo : a.createdAt.localeCompare(b.createdAt);
  });

  if (!sorted.length) {
    return (
      <div style={{ fontSize: 12, color: '#9ca3af', padding: '10px 4px', fontStyle: 'italic' }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {sorted.map(f => (
        <PathologyFragmentRenderer
          key={f.id}
          fact={f}
          compact={compact}
          showProvenance={showProvenance}
          onVerify={onVerify}
          onStatusChange={onStatusChange}
          onDismiss={onDismiss}
          onTaskComplete={onTaskComplete}
        />
      ))}
    </div>
  );
}
