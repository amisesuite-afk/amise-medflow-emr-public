import React, { useState } from 'react';
import { adaptProtocolForPatient } from '@workspace/pane-engine';
import type { ManagementProtocol, ManagementStep, PlanPatientContext, SafetyNote } from '@workspace/pane-engine';
import { planProtocolFor } from '@/lib/plan-builder';

interface Props {
  diseaseId: string | null;
  icdCode: string | null;
  /**
   * The patient on record. When given, the protocol is adapted to it (allergy cross-check,
   * pregnancy and under-16 filters, conditional branches) and the patient-specific safety lines
   * are shown first. Omit it only for a reference view with no patient open (the Dictionary
   * passes it whenever a patient is open).
   */
  patient?: PlanPatientContext | null;
}

const SAFETY_STYLE: Record<SafetyNote['severity'], React.CSSProperties> = {
  critical: { background: '#5c1a1a', color: '#fecaca', border: '1px solid #7f1d1d' },
  warning:  { background: '#4a3410', color: '#fde68a', border: '1px solid #92400e' },
  info:     { background: '#12263a', color: '#bfdbfe', border: '1px solid #1e3a5f' },
};

const PHASE_LABELS: Record<ManagementStep['phase'], string> = {
  immediate:    'Immediate',
  conservative: 'Conservative',
  surgical:     'Surgical',
  followup:     'Follow-up',
};

const PHASE_ORDER: ManagementStep['phase'][] = ['immediate', 'conservative', 'surgical', 'followup'];

const GOLD = '#C8A24B';
const BODY = 'rgba(255,255,255,0.92)';
const TEAL_LABEL = '#1F7A8C';

const urgencyStyle: Record<'stat' | 'urgent' | 'routine', React.CSSProperties> = {
  stat:    { background: '#5c1a1a', color: '#fca5a5', border: '1px solid #7f1d1d' },
  urgent:  { background: '#5c3a0a', color: '#fcd34d', border: '1px solid #92400e' },
  routine: { background: '#1e293b', color: '#94a3b8', border: '1px solid #374151' },
};

export function ManagementPanel({ diseaseId, icdCode, patient }: Props) {
  const [open, setOpen] = useState(true);

  // The recorded ICD code wins when it names a more specific protocol (pane-engine resolveProtocol).
  const base: ManagementProtocol | null = planProtocolFor(diseaseId, icdCode);
  const adapted = base && patient ? adaptProtocolForPatient(base, patient) : null;
  const protocol: ManagementProtocol | null = adapted ?? base;
  const safetyNotes: SafetyNote[] = adapted?.safetyNotes ?? [];

  if (!protocol) return null;
  const safetyTexts = new Set(safetyNotes.map(n => n.text));
  const redFlags = protocol.redFlags.filter(f => !safetyTexts.has(f));

  const stepsByPhase = PHASE_ORDER.reduce<Partial<Record<ManagementStep['phase'], string[]>>>(
    (acc, phase) => {
      const steps = protocol.management.filter(s => s.phase === phase).map(s => s.step);
      if (steps.length) acc[phase] = steps;
      return acc;
    },
    {},
  );

  return (
    <div style={{ border: '1px solid #1F7A8C', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', background: '#0d2137', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontWeight: 600, color: GOLD, fontSize: 14 }}>
          Suggested management (reference) — {protocol.label}
        </span>
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke={TEAL_LABEL} strokeWidth={2}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '12px 16px', background: '#0b1929', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
          {/* Patient-specific safety checks */}
          {safetyNotes.length > 0 && (
            <section>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#f59e0b', letterSpacing: '0.05em', marginBottom: 6, marginTop: 0 }}>For this patient — review before acting</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {safetyNotes.map((n, i) => (
                  <li key={i} style={{ padding: '4px 8px', borderRadius: 4, fontSize: 12, ...SAFETY_STYLE[n.severity] }}>
                    {n.severity === 'critical' ? '⚠ ' : ''}{n.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <section>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.05em', marginBottom: 6, marginTop: 0 }}>Red Flags</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {redFlags.map((flag, i) => (
                  <span
                    key={i}
                    style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 4, background: '#5c1a1a', color: '#fca5a5', border: '1px solid #7f1d1d', fontSize: 11 }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Key Points */}
          {protocol.keyPoints.length > 0 && (
            <section>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: GOLD, letterSpacing: '0.05em', marginBottom: 6, marginTop: 0 }}>Key Points</h4>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {protocol.keyPoints.map((pt, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: TEAL_LABEL, marginTop: 1 }}>&#x2022;</span>
                    <span style={{ color: BODY }}>{pt}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Investigations */}
          {protocol.investigations.length > 0 && (
            <section>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: GOLD, letterSpacing: '0.05em', marginBottom: 6, marginTop: 0 }}>Investigations</h4>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  {protocol.investigations.map((inv, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#0f1f33' : 'transparent' }}>
                      <td style={{ padding: '4px 8px', color: BODY }}>{inv.label}</td>
                      <td style={{ padding: '4px 8px', width: 72 }}>
                        <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500, ...urgencyStyle[inv.urgency] }}>
                          {inv.urgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Management Steps */}
          {Object.keys(stepsByPhase).length > 0 && (
            <section>
              <h4 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: GOLD, letterSpacing: '0.05em', marginBottom: 6, marginTop: 0 }}>Management</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.entries(stepsByPhase) as [ManagementStep['phase'], string[]][]).map(([phase, steps]) => (
                  <div key={phase}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TEAL_LABEL, textTransform: 'uppercase' }}>{PHASE_LABELS[phase]}</span>
                    <ol style={{ margin: '3px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {steps.map((step, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8 }}>
                          <span style={{ color: TEAL_LABEL, flexShrink: 0 }}>{i + 1}.</span>
                          <span style={{ color: BODY }}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Referral */}
          {protocol.referral && (
            <section style={{ borderTop: '1px solid #1e3a50', paddingTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: GOLD, textTransform: 'uppercase' }}>Referral: </span>
              <span style={{ color: BODY, fontSize: 12 }}>{protocol.referral}</span>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
