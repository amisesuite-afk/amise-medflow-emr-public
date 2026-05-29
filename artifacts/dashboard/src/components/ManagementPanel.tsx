import React, { useState } from 'react';
import { getProtocol, getProtocolByIcd } from '@workspace/pane-engine';
import type { ManagementProtocol, ManagementStep } from '@workspace/pane-engine';

interface Props {
  diseaseId: string | null;
  icdCode: string | null;
}

const PHASE_LABELS: Record<ManagementStep['phase'], string> = {
  immediate:    'Immediate',
  conservative: 'Conservative',
  surgical:     'Surgical',
  followup:     'Follow-up',
};

const PHASE_ORDER: ManagementStep['phase'][] = ['immediate', 'conservative', 'surgical', 'followup'];

const URGENCY_BADGE: Record<'stat' | 'urgent' | 'routine', string> = {
  stat:    'bg-red-100 text-red-800 border-red-300',
  urgent:  'bg-amber-100 text-amber-800 border-amber-300',
  routine: 'bg-gray-100 text-gray-700 border-gray-300',
};

export function ManagementPanel({ diseaseId, icdCode }: Props) {
  const [open, setOpen] = useState(true);

  const protocol: ManagementProtocol | null =
    (diseaseId ? getProtocol(diseaseId) : null) ??
    (icdCode   ? getProtocolByIcd(icdCode) : null);

  if (!protocol) return null;

  const stepsByPhase = PHASE_ORDER.reduce<Partial<Record<ManagementStep['phase'], string[]>>>(
    (acc, phase) => {
      const steps = protocol.management.filter(s => s.phase === phase).map(s => s.step);
      if (steps.length) acc[phase] = steps;
      return acc;
    },
    {},
  );

  return (
    <div className="border border-teal-300 rounded-lg overflow-hidden mb-3">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-teal-50 hover:bg-teal-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-semibold text-teal-800 text-sm">
          Management — {protocol.label}
        </span>
        <svg
          className={`w-4 h-4 text-teal-600 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-4 text-sm">
          {/* Red Flags */}
          {protocol.redFlags.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase text-red-700 tracking-wide mb-1">Red Flags</h4>
              <div className="flex flex-wrap gap-1">
                {protocol.redFlags.map((flag, i) => (
                  <span
                    key={i}
                    className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 text-xs"
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
              <h4 className="text-xs font-semibold uppercase text-teal-700 tracking-wide mb-1">Key Points</h4>
              <ul className="space-y-0.5 text-gray-700">
                {protocol.keyPoints.map((pt, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-teal-500 mt-0.5">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Investigations */}
          {protocol.investigations.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase text-teal-700 tracking-wide mb-1">Investigations</h4>
              <table className="w-full text-xs">
                <tbody>
                  {protocol.investigations.map((inv, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="py-1 pr-2 text-gray-800">{inv.label}</td>
                      <td className="py-1 w-20">
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-xs font-medium ${URGENCY_BADGE[inv.urgency]}`}>
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
              <h4 className="text-xs font-semibold uppercase text-teal-700 tracking-wide mb-1">Management</h4>
              <div className="space-y-2">
                {(Object.entries(stepsByPhase) as [ManagementStep['phase'], string[]][]).map(([phase, steps]) => (
                  <div key={phase}>
                    <span className="text-xs font-semibold text-gray-500 uppercase">{PHASE_LABELS[phase]}</span>
                    <ol className="mt-0.5 space-y-0.5 text-gray-700">
                      {steps.map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-gray-400 shrink-0">{i + 1}.</span>
                          <span>{step}</span>
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
            <section className="border-t border-teal-100 pt-2">
              <span className="text-xs font-semibold text-teal-700 uppercase">Referral: </span>
              <span className="text-gray-700 text-xs">{protocol.referral}</span>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
