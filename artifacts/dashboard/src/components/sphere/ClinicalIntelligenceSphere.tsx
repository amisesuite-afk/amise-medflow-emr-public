// ─── ClinicalIntelligenceSphere ──────────────────────────────────────────────
//
// Main container — assembles the full 360° Clinical Intelligence Sphere for
// one PathologyProfile (e.g. K83.1 Obstructive Jaundice).
//
// Layout:
//
//   ┌──────────────────────────────────────────────────┐
//   │  HEADER: icd10 · name · subtitle · definition    │
//   │  Anatomy-at-risk chips                           │
//   ├────────────────┬─────────────────────────────────┤
//   │  13-axis Radar │  DDx Convergence Map            │
//   │                │  (2 columns of circles)         │
//   ├────────────────┴─────────────────────────────────┤
//   │  BISAP Severity Card  │  Management Pathway      │
//   ├────────────────────────┴─────────────────────────┤
//   │  Vademecum tabs: Symptoms / Signs / Labs / …     │
//   ├──────────────────────────────────────────────────┤
//   │  Clinical Codes table                            │
//   ├──────────────────────────────────────────────────┤
//   │  Clinical Pearls + Uncertainty flags             │
//   └──────────────────────────────────────────────────┘

import React, { useMemo } from 'react';
import type { ClinicalFact, PathologyProfile, DiagnosisValue } from '@workspace/patient-state';
import { AxisScorer } from '@workspace/patient-state';

import { PatientStateRadar }  from './PatientStateRadar';
import { ConvergenceMap }     from './ConvergenceMap';
import { VademecumPanel }     from './VademecumPanel';
import { SeverityScoreCard }  from './SeverityScoreCard';
import { ManagementPathway }  from './ManagementPathway';

interface Props {
  profile: PathologyProfile;
  facts:   ClinicalFact[];
  /** Optional: rendered in the header alongside the ICD-10 code */
  patientLabel?: string;
}

export function ClinicalIntelligenceSphere({ profile, facts, patientLabel }: Props) {
  const scorer = useMemo(() => new AxisScorer(profile), [profile]);
  const vector = useMemo(() => scorer.score(facts), [scorer, facts]);
  const burden = useMemo(() => scorer.overallBurden(vector), [scorer, vector]);
  const atRisk = useMemo(() => scorer.atRiskAxes(vector), [scorer, vector]);

  // Active diagnoses from the fact store for the convergence map
  const activeDxCodes = useMemo(() =>
    facts
      .filter(f => f.factType === 'diagnosis' && f.status !== 'refuted')
      .map(f => (f.value as DiagnosisValue).icd10)
      .filter((c): c is string => !!c),
    [facts],
  );

  const burdenColor =
    burden < 30 ? '#22c55e'
    : burden < 55 ? '#f59e0b'
    : burden < 75 ? '#f97316'
    : '#ef4444';

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1e4d8c 100%)',
        color: '#fff', borderRadius: '12px 12px 0 0',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                background: '#ffffff25', borderRadius: 4, padding: '1px 6px',
              }}>
                ICD-10 {profile.icd10}
              </span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>SNOMED {profile.snomed}</span>
              {patientLabel && (
                <span style={{ fontSize: 10, background: '#3b82f630', borderRadius: 4, padding: '1px 6px' }}>
                  {patientLabel}
                </span>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{profile.name}</div>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 0.5 }}>{profile.subtitle}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, maxWidth: 500 }}>
              {profile.definition}
            </div>
          </div>

          {/* Overall burden pill */}
          <div style={{
            background: burdenColor, borderRadius: 12,
            padding: '8px 14px', textAlign: 'center', flexShrink: 0,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{burden}</div>
            <div style={{ fontSize: 8, color: '#ffffffcc', letterSpacing: 0.5, marginTop: 2 }}>BURDEN</div>
          </div>
        </div>

        {/* Anatomy at risk */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {profile.anatomyAtRisk.map(a => (
            <span key={a.label} style={{
              fontSize: 9, background: `${a.color}30`, border: `1px solid ${a.color}80`,
              color: '#e5e7eb', borderRadius: 4, padding: '2px 7px',
            }}>
              {a.label}
            </span>
          ))}
        </div>

        {/* At-risk axes warning */}
        {atRisk.length > 0 && (
          <div style={{
            marginTop: 10, background: '#ef444425', border: '1px solid #ef444460',
            borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#fca5a5',
          }}>
            <strong>⚠ {atRisk.length} axis(es) above risk threshold:</strong>{' '}
            {atRisk.map(a => {
              const def = profile.axes.find(ax => ax.id === a.axisId);
              return `${def?.name ?? `Axis ${a.axisId}`} (${a.score})`;
            }).join(' · ')}
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>

        {/* Row 1: Radar + DDx */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 0, borderBottom: '1px solid #f3f4f6',
        }}>
          <div style={{ padding: 16, borderRight: '1px solid #f3f4f6' }}>
            <SectionTitle>Patient State Vector</SectionTitle>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PatientStateRadar
                vector={vector}
                axes={profile.axes}
                size={360}
              />
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <SectionTitle>DDx Convergence Map</SectionTitle>
            <ConvergenceMap
              differentials={profile.differentials}
              activeDxCodes={activeDxCodes}
            />
          </div>
        </div>

        {/* Row 2: Severity + Management */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 0, borderBottom: '1px solid #f3f4f6',
        }}>
          <div style={{ padding: 16, borderRight: '1px solid #f3f4f6' }}>
            <SectionTitle>Severity Scoring — {profile.severity.name}</SectionTitle>
            <SeverityScoreCard profile={profile} facts={facts} />
          </div>

          <div style={{ padding: 16 }}>
            <SectionTitle>Management Pathway</SectionTitle>
            <ManagementPathway steps={profile.managementSteps} facts={facts} />
          </div>
        </div>

        {/* Row 3: Vademecum */}
        <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
          <SectionTitle>Clinical Vademecum — Textbook Presentation</SectionTitle>
          <VademecumPanel profile={profile} />
        </div>

        {/* Row 4: Clinical codes table */}
        <div style={{ padding: 16, borderBottom: '1px solid #f3f4f6' }}>
          <SectionTitle>Clinical Code Mapping</SectionTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Concept', 'ICD-10', 'SNOMED CT', 'LOINC', 'Example'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '5px 8px',
                      border: '1px solid #e5e7eb', color: '#6b7280',
                      fontWeight: 600, fontSize: 9, letterSpacing: 0.4,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.clinicalCodes.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={tdStyle}><strong>{row.concept}</strong></td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#7c3aed' }}>{row.icd10 ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#0891b2' }}>{row.snomed ?? '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#b45309' }}>{row.loinc ?? '—'}</td>
                    <td style={{ ...tdStyle, color: '#6b7280' }}>{row.example ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 5: Pearls + Uncertainty */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 0, padding: 0,
        }}>
          <div style={{ padding: 16, borderRight: '1px solid #f3f4f6' }}>
            <SectionTitle>Clinical Pearls</SectionTitle>
            <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
              {profile.clinicalPearls.map((p, i) => (
                <li key={i} style={{ fontSize: 10, color: '#374151', marginBottom: 4, lineHeight: 1.5 }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ padding: 16 }}>
            <SectionTitle>Uncertainty Flags</SectionTitle>
            {profile.uncertaintyFlags.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 6, alignItems: 'flex-start',
                padding: '3px 0',
              }}>
                <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>?</span>
                <span style={{ fontSize: 10, color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: '#6b7280',
      textTransform: 'uppercase', marginBottom: 10,
      borderBottom: '1px solid #f3f4f6', paddingBottom: 4,
    }}>
      {children}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #e5e7eb',
  verticalAlign: 'top',
};
