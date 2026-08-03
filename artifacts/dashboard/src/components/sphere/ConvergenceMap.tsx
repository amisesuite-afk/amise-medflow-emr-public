// ─── ConvergenceMap ───────────────────────────────────────────────────────────
//
// Differential Diagnosis Convergence Map — the Venn-like intersection display
// showing which DDx are still live and what discriminating features apply.
//
// Geometric read: each differential is a coloured circle on the board.
// The clinician's emerging picture is the pin placed at the intersection
// of the circles that best match the patient's facts.

import React, { useState } from 'react';
import type { DifferentialDiagnosis } from '@workspace/patient-state';

interface Props {
  differentials: DifferentialDiagnosis[];
  activeDxCodes?: string[];     // ICD-10 codes currently confirmed/working in the fact store
}

export function ConvergenceMap({ differentials, activeDxCodes = [] }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div>
      {/* ── Active / ruled-in indicator ─────────────────────────────────── */}
      {activeDxCodes.length > 0 && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac',
          borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: '#166534',
        }}>
          <strong>Active diagnosis:</strong>{' '}
          {activeDxCodes.join(' · ')}
        </div>
      )}

      {/* ── DDx grid ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {differentials.map(ddx => {
          const isActive  = activeDxCodes.includes(ddx.icd10);
          const isHovered = hovered === ddx.icd10;

          return (
            <div
              key={ddx.icd10}
              onMouseEnter={() => setHovered(ddx.icd10)}
              onMouseLeave={() => setHovered(null)}
              style={{
                border: `2px solid ${isActive ? ddx.color : isHovered ? ddx.color : '#e5e7eb'}`,
                borderLeft: `5px solid ${ddx.color}`,
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'default',
                transition: 'border-color 0.15s',
                background: isActive ? `${ddx.color}18` : '#fafafa',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: ddx.color, flexShrink: 0, marginTop: 2,
                }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                    {ddx.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{ddx.icd10}</div>
                </div>
                {isActive && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                    background: ddx.color, color: '#fff', borderRadius: 4,
                    padding: '1px 5px', flexShrink: 0,
                  }}>
                    ACTIVE
                  </span>
                )}
              </div>

              {/* Discriminating features */}
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                {ddx.discriminatingFeatures.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 1 }}>
                    <span style={{ color: ddx.color, flexShrink: 0 }}>▸</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* Confirmation tests — revealed on hover */}
              {isHovered && (
                <div style={{
                  marginTop: 8, paddingTop: 6,
                  borderTop: `1px solid ${ddx.color}50`,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, marginBottom: 4 }}>
                    CONFIRM WITH
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {ddx.confirmationTests.map((t, i) => (
                      <span key={i} style={{
                        fontSize: 9, background: `${ddx.color}25`,
                        color: '#374151', borderRadius: 4, padding: '1px 6px',
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Convergence note ────────────────────────────────────────────── */}
      <div style={{
        marginTop: 10, fontSize: 10, color: '#9ca3af', fontStyle: 'italic',
        borderTop: '1px solid #f3f4f6', paddingTop: 6,
      }}>
        Hover any card to reveal confirmation tests. Active diagnosis highlighted.
      </div>
    </div>
  );
}
