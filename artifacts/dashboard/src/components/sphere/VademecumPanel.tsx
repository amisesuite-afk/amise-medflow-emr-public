// ─── VademecumPanel ───────────────────────────────────────────────────────────
//
// Quick-reference panel set: Symptoms · Signs · Labs · Radiology · Biomarkers
//
// "Vademecum" (Latin: "go with me") — the pocket guide the clinician carries
// in their head. This renders the profile's static knowledge as scannable
// columns so the clinician can compare the textbook against the patient's
// recorded facts at a glance.

import React, { useState } from 'react';
import type { PathologyProfile } from '@workspace/patient-state';

interface Props {
  profile: PathologyProfile;
  /** IDs of facts that ARE present in the patient record — used to highlight */
  presentFindings?: string[];
}

type Tab = 'symptoms' | 'signs' | 'labs' | 'radiology' | 'biomarkers';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'symptoms',   label: 'Symptoms',   icon: '🩺' },
  { key: 'signs',      label: 'Signs',      icon: '👁' },
  { key: 'labs',       label: 'Labs',       icon: '🧪' },
  { key: 'radiology',  label: 'Radiology',  icon: '📷' },
  { key: 'biomarkers', label: 'Biomarkers', icon: '🔬' },
];

const DIRECTION_ICON: Record<string, string> = { up: '↑', down: '↓', normal: '→' };
const DIRECTION_COLOR: Record<string, string> = { up: '#ef4444', down: '#3b82f6', normal: '#22c55e' };

export function VademecumPanel({ profile }: Props) {
  const [tab, setTab] = useState<Tab>('symptoms');

  function getItems(): React.ReactNode {
    switch (tab) {
      case 'symptoms':
        return (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {profile.symptoms.map((s, i) => (
              <li key={i} style={rowStyle}>
                <span style={bulletStyle('#60a5fa')} />
                <span style={textStyle}>{s}</span>
              </li>
            ))}
          </ul>
        );

      case 'signs':
        return (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {profile.signs.map((s, i) => (
              <li key={i} style={rowStyle}>
                <span style={bulletStyle('#34d399')} />
                <span style={textStyle}>{s}</span>
              </li>
            ))}
          </ul>
        );

      case 'labs':
        return (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {profile.laboratoryFindings.map((s, i) => (
              <li key={i} style={rowStyle}>
                <span style={bulletStyle('#fbbf24')} />
                <span style={textStyle}>{s}</span>
              </li>
            ))}
          </ul>
        );

      case 'radiology':
        return (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {profile.radiologyFindings.map((s, i) => (
              <li key={i} style={rowStyle}>
                <span style={bulletStyle('#a78bfa')} />
                <span style={textStyle}>{s}</span>
              </li>
            ))}
          </ul>
        );

      case 'biomarkers':
        return (
          <div>
            {profile.biomarkerPattern.map((b, i) => (
              <div key={i} style={{
                ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', padding: '6px 0',
                borderBottom: i < profile.biomarkerPattern.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700,
                    color: DIRECTION_COLOR[b.direction] ?? '#374151',
                  }}>
                    {DIRECTION_ICON[b.direction]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{b.name}</span>
                  {b.threshold && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, background: '#fef3c7',
                      color: '#92400e', borderRadius: 4, padding: '1px 5px',
                    }}>
                      &gt;{b.threshold.value} {b.threshold.unit}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, paddingLeft: 22 }}>
                  {b.significance}
                </div>
                {(b.loinc || b.snomed) && (
                  <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, paddingLeft: 22 }}>
                    {b.loinc && <span style={{ marginRight: 8 }}>LOINC: {b.loinc}</span>}
                    {b.snomed && <span>SNOMED: {b.snomed}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 8,
        borderBottom: '2px solid #f3f4f6', paddingBottom: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              fontSize: 10, fontWeight: tab === t.key ? 700 : 500,
              padding: '5px 8px', border: 'none', background: 'none',
              cursor: 'pointer', color: tab === t.key ? '#3b82f6' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2, borderRadius: 0, transition: 'color 0.1s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {getItems()}
      </div>
    </div>
  );
}

// ── Shared micro-styles ────────────────────────────────────────────────────────

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 6,
  padding: '4px 0',
};

const textStyle: React.CSSProperties = {
  fontSize: 11, color: '#374151', lineHeight: 1.4,
};

function bulletStyle(color: string): React.CSSProperties {
  return {
    width: 6, height: 6, borderRadius: '50%',
    background: color, flexShrink: 0, marginTop: 3,
  };
}
