// ─── ClinicalAlertBanner ─────────────────────────────────────────────────────
//
// Surfaces active rules-engine alerts at the top of any clinical view.
// This is the component that makes the PatientFactStore + RulesEngine
// observable to the clinician — the output port of the closed loop.

import React, { useState } from 'react';
import type { ActiveAlert } from '@workspace/patient-state';

interface Props {
  alerts: ActiveAlert[];
  onAcknowledge: (alertId: string, overrideReason?: string) => void;
}

const SEVERITY_STYLE: Record<ActiveAlert['severity'], {
  bg: string; border: string; text: string; icon: string;
}> = {
  critical: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🚨' },
  warning:  { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: '⚠' },
  info:     { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', icon: 'ℹ' },
};

export function ClinicalAlertBanner({ alerts, onAcknowledge }: Props) {
  const [overrideInputId, setOverrideInputId] = useState<string | null>(null);
  const [overrideText,    setOverrideText]    = useState('');

  const active = alerts.filter(a => !a.acknowledgedBy);
  if (!active.length) return null;

  // Critical alerts always first
  const sorted = [...active].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  function handleAck(alert: ActiveAlert) {
    if (alert.requiresAcknowledgement && !overrideText.trim()) {
      setOverrideInputId(alert.id);
      return;
    }
    onAcknowledge(alert.id, overrideText.trim() || undefined);
    setOverrideInputId(null);
    setOverrideText('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
      {sorted.map(alert => {
        const s = SEVERITY_STYLE[alert.severity];
        return (
          <div key={alert.id} style={{
            background: s.bg,
            border: `1px solid ${s.border}`,
            borderLeft: `4px solid ${s.border}`,
            borderRadius: 6,
            padding: '8px 12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.text }}>
                  {alert.message}
                </div>
                {alert.detail && (
                  <div style={{ fontSize: 11, color: s.text, opacity: 0.85, marginTop: 2 }}>
                    {alert.detail}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleAck(alert)}
                style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                  background: s.border, color: '#fff', border: 'none',
                }}
              >
                {alert.requiresAcknowledgement ? 'Override' : 'Dismiss'}
              </button>
            </div>

            {/* Override reason input for safety-critical dismissals */}
            {overrideInputId === alert.id && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  placeholder="Enter override justification (required)…"
                  value={overrideText}
                  onChange={e => setOverrideText(e.target.value)}
                  style={{
                    flex: 1, fontSize: 11, padding: '4px 8px',
                    border: `1px solid ${s.border}`, borderRadius: 4,
                  }}
                />
                <button
                  type="button"
                  disabled={!overrideText.trim()}
                  onClick={() => {
                    onAcknowledge(alert.id, overrideText.trim());
                    setOverrideInputId(null);
                    setOverrideText('');
                  }}
                  style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 4, cursor: overrideText.trim() ? 'pointer' : 'not-allowed',
                    background: overrideText.trim() ? s.border : '#e5e7eb',
                    color: overrideText.trim() ? '#fff' : '#9ca3af', border: 'none',
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => { setOverrideInputId(null); setOverrideText(''); }}
                  style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 4,
                    background: 'none', border: `1px solid ${s.border}`,
                    color: s.text, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
