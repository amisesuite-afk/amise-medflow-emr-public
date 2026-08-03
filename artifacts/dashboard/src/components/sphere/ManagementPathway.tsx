// ─── ManagementPathway ────────────────────────────────────────────────────────
//
// Renders the management steps as a horizontal flow diagram.
// Each step shows its completion status based on the patient's fact store.
//
// For K83.1:
//   Stabilise → Identify → Decompress → Definitive → Monitor

import React from 'react';
import type { ClinicalFact, ManagementStep } from '@workspace/patient-state';

interface Props {
  steps: ManagementStep[];
  facts: ClinicalFact[];
}

function stepComplete(step: ManagementStep, facts: ClinicalFact[]): boolean {
  if (!step.factTypes?.length) return false;
  return step.factTypes.some(ft =>
    facts.some(f => f.factType === ft && (f.status === 'completed' || f.status === 'active' || f.status === 'confirmed')),
  );
}

function stepInProgress(step: ManagementStep, facts: ClinicalFact[]): boolean {
  if (!step.factTypes?.length) return false;
  return step.factTypes.some(ft =>
    facts.some(f => f.factType === ft && (f.status === 'pending' || f.status === 'active')),
  );
}

export function ManagementPathway({ steps, facts }: Props) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div>
      {/* Horizontal step indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
        {sorted.map((step, i) => {
          const done  = stepComplete(step, facts);
          const inProg = !done && stepInProgress(step, facts);
          const pending = !done && !inProg;

          const bg = done ? '#22c55e' : inProg ? '#f59e0b' : '#e5e7eb';
          const textC = done || inProg ? '#fff' : '#9ca3af';

          return (
            <React.Fragment key={step.order}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                {/* Circle */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: bg, color: textC,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, marginBottom: 4,
                  boxShadow: done ? '0 0 0 3px #86efac' : inProg ? '0 0 0 3px #fde68a' : 'none',
                  transition: 'background 0.2s',
                }}>
                  {done ? '✓' : step.icon}
                </div>
                {/* Label */}
                <div style={{
                  fontSize: 9, fontWeight: done ? 700 : 500,
                  color: done ? '#166534' : inProg ? '#92400e' : '#6b7280',
                  textAlign: 'center', letterSpacing: 0.3,
                }}>
                  {step.label}
                </div>
              </div>

              {/* Connector arrow */}
              {i < sorted.length - 1 && (
                <div style={{
                  height: 2, background: done ? '#86efac' : '#e5e7eb',
                  flexShrink: 0, marginBottom: 20, marginTop: -20, width: 0,
                  // handled by flex gap between circles; connector via pseudo-line
                }}>
                  <svg width={24} height={2} style={{ display: 'block', marginTop: -1 }}>
                    <line x1={0} y1={1} x2={24} y2={1}
                      stroke={done ? '#22c55e' : '#e5e7eb'} strokeWidth={2}
                    />
                  </svg>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Detail cards for each step */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(step => {
          const done   = stepComplete(step, facts);
          const inProg = !done && stepInProgress(step, facts);

          return (
            <div
              key={step.order}
              style={{
                border: `1px solid ${done ? '#86efac' : inProg ? '#fde68a' : '#e5e7eb'}`,
                borderLeft: `4px solid ${done ? '#22c55e' : inProg ? '#f59e0b' : '#d1d5db'}`,
                borderRadius: 6, padding: '7px 10px',
                background: done ? '#f0fdf4' : inProg ? '#fffbeb' : '#fafafa',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{step.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>
                  {step.label}
                </span>
                {done && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, background: '#22c55e',
                    color: '#fff', borderRadius: 4, padding: '1px 5px',
                  }}>DONE</span>
                )}
                {inProg && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, background: '#f59e0b',
                    color: '#fff', borderRadius: 4, padding: '1px 5px',
                  }}>IN PROGRESS</span>
                )}
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                {step.details.map((d, i) => (
                  <li key={i} style={{ fontSize: 10, color: '#374151', marginBottom: 1, lineHeight: 1.4 }}>
                    {d}
                  </li>
                ))}
              </ul>
              {step.factTypes && step.factTypes.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {step.factTypes.map(ft => (
                    <span key={ft} style={{
                      fontSize: 8, background: '#e0e7ff', color: '#3730a3',
                      borderRadius: 3, padding: '1px 4px',
                    }}>
                      {ft}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
