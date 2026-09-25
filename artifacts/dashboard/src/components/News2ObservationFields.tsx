/**
 * News2ObservationFields — the two NEWS2 observations that are not numbers:
 * consciousness (ACVPU) and air / supplemental oxygen.
 *
 * Used beside every vitals entry form so NEWS2 can be complete (RCP 2017). Both start as
 * "Not recorded" — never a silent Alert / room air (hazard log H-04). Values are the
 * VitalsState strings: avpu '' | 'A'…'U', onSupplementalO2 '' | 'air' | 'o2'. Saved to
 * vitals.avpu / vitals.on_supplemental_o2 (Migration 91).
 *
 * Entry only: no scoring or colouring here.
 */
import type React from 'react';
import { NEWS2_AVPU_LABELS, type News2Avpu } from '@workspace/triage-engine';

export type News2ObservationKey = 'avpu' | 'onSupplementalO2';

interface Props {
  avpu: string;
  onSupplementalO2: string;
  onChange(key: News2ObservationKey, value: string): void;
  /** Smaller labels for tight rows (e.g. the vitals strip). */
  compact?: boolean;
}

export default function News2ObservationFields({ avpu, onSupplementalO2, onChange, compact }: Props) {
  const labelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 3,
    fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: 'var(--muted, #6b7280)',
  };
  const selectStyle = (set: boolean): React.CSSProperties => ({
    fontSize: compact ? 12 : 13, padding: compact ? '4px 6px' : '6px 8px', borderRadius: 6,
    border: `1.5px solid ${set ? '#0d9488' : 'var(--border, #d1d5db)'}`,
    background: set ? '#f0fdfa' : 'var(--card, #fff)', color: 'var(--ink, #0f172a)',
    textTransform: 'none', letterSpacing: 'normal', fontWeight: set ? 700 : 400,
  });
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={labelStyle}>
        ACVPU
        <select
          aria-label="Consciousness (ACVPU)"
          style={selectStyle(!!avpu)}
          value={avpu}
          onChange={e => onChange('avpu', e.target.value)}
        >
          <option value="">Not recorded</option>
          {(Object.keys(NEWS2_AVPU_LABELS) as News2Avpu[]).map(k => (
            <option key={k} value={k}>{k} — {NEWS2_AVPU_LABELS[k]}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        Air / O₂
        <select
          aria-label="Air or supplemental oxygen"
          style={selectStyle(!!onSupplementalO2)}
          value={onSupplementalO2}
          onChange={e => onChange('onSupplementalO2', e.target.value)}
        >
          <option value="">Not recorded</option>
          <option value="air">Room air</option>
          <option value="o2">Supplemental O₂</option>
        </select>
      </label>
    </div>
  );
}
