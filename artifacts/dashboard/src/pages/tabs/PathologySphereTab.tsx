// ─── PathologySphereTab ───────────────────────────────────────────────────────
//
// 360° Clinical Intelligence Sphere — patient-specific tab.
//
// Shows the K83.1 Obstructive Jaundice sphere when that diagnosis is present
// in the patient's fact store, or a selector when no matching profile is loaded.
//
// Wired to the live PatientFactStore so the sphere updates in real time as
// facts are added or verified.

import { useMemo, useState } from 'react';
import { K83_1 } from '@workspace/patient-state';
import { usePatientState } from '@/context/PatientStateContext';
import { ClinicalIntelligenceSphere } from '@/components/sphere';

// Registry of all available profiles
const PROFILE_REGISTRY = [
  { key: 'K83.1', label: 'K83.1 — Obstructive Jaundice', profile: K83_1 },
];

export default function PathologySphereTab() {
  const { facts } = usePatientState();
  const [selectedKey, setSelectedKey] = useState('K83.1');

  const profile = useMemo(
    () => PROFILE_REGISTRY.find(p => p.key === selectedKey)?.profile ?? K83_1,
    [selectedKey],
  );

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Profile selector — grows as more profiles are added */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 14, padding: '0 2px',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: 0.4 }}>
          PROFILE
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {PROFILE_REGISTRY.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelectedKey(p.key)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: selectedKey === p.key ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
                background: selectedKey === p.key ? '#eff6ff' : '#fff',
                color: selectedKey === p.key ? '#1d4ed8' : '#374151',
                fontWeight: selectedKey === p.key ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>
          {facts.length} fact{facts.length !== 1 ? 's' : ''} in patient record
        </div>
      </div>

      <ClinicalIntelligenceSphere
        profile={profile}
        facts={facts}
      />
    </div>
  );
}
