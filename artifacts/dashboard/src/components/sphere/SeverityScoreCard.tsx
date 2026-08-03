// ─── SeverityScoreCard ───────────────────────────────────────────────────────
//
// BISAP / clinical severity scoring with live fact detection.
//
// Each SeverityCriterion has an optional detect(facts) => boolean function
// defined in the K83.1 profile. This component calls those functions against
// the patient's live fact array and renders:
//   • The total score
//   • Each criterion with its met/unmet status
//   • The matching severity band (Low / Moderate / High / Critical)
//   • A mini bar visualisation

import React from 'react';
import type { ClinicalFact, PathologyProfile } from '@workspace/patient-state';

interface Props {
  profile: PathologyProfile;
  facts: ClinicalFact[];
}

export function SeverityScoreCard({ profile, facts }: Props) {
  const { name, description, criteria, bands } = profile.severity;

  // Evaluate each criterion
  const evaluated = criteria.map(c => ({
    ...c,
    met: c.detect ? c.detect(facts) : false,
  }));
  const total = evaluated.reduce((s, c) => s + (c.met ? c.points : 0), 0);
  const maxScore = criteria.reduce((s, c) => s + c.points, 0);

  // Matching band
  const band = bands.find(b => total >= b.min && total <= b.max) ?? bands[bands.length - 1];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{name}</div>
          <div style={{ fontSize: 10, color: '#6b7280' }}>{description}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{
            fontSize: 28, fontWeight: 800, color: band.text,
            background: band.color, borderRadius: 8, padding: '4px 12px', lineHeight: 1.2,
          }}>
            {total}
          </div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>/ {maxScore} pts</div>
        </div>
      </div>

      {/* Severity band badge */}
      <div style={{
        background: band.color, color: band.text,
        borderRadius: 6, padding: '5px 10px',
        fontSize: 11, fontWeight: 700, marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>
          {band.label === 'Low Risk' ? '✓' : band.label === 'Critical' ? '🚨' : '⚠'}
        </span>
        {band.label}
        <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 4 }}>
          (score {band.min}–{band.max})
        </span>
      </div>

      {/* Criteria list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {evaluated.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '5px 8px', borderRadius: 5,
              background: c.met ? '#f0fdf4' : '#fafafa',
              border: `1px solid ${c.met ? '#86efac' : '#e5e7eb'}`,
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              background: c.met ? '#22c55e' : '#e5e7eb',
              color: c.met ? '#fff' : '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {c.met ? '✓' : '–'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: c.met ? 700 : 500, color: c.met ? '#166534' : '#374151' }}>
                {c.label}
                <span style={{
                  marginLeft: 6, fontSize: 10, fontWeight: 700,
                  color: c.met ? '#166534' : '#9ca3af',
                }}>
                  +{c.points}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                {c.description}
              </div>
              {!c.detect && (
                <div style={{ fontSize: 9, color: '#f59e0b', marginTop: 1 }}>
                  Manual assessment required
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Score bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{
          height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.round((total / maxScore) * 100)}%`,
            background: band.color !== '#fee2e2' ? band.color : '#ef4444',
            borderRadius: 3, transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          {bands.map(b => (
            <span key={b.label} style={{ fontSize: 8, color: '#9ca3af' }}>{b.label.split(' ')[0]}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
