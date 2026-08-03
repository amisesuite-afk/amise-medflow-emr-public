// ─── FragmentShell ────────────────────────────────────────────────────────────
//
// The shared outer casing every clinical fragment snaps into.
// Provides:  coded header · source badge · status chip · provenance tooltip
//            verify button (safety-critical AI facts) · dismiss/action slot
//
// Think of it as the standard hexagon edge geometry — every tile exposes the
// same six connection points regardless of what's inside it.

import React, { useState } from 'react';
import type { ClinicalFact, FactStatus, FactSource } from '@workspace/patient-state';
import { getCodeSystem, formatCode } from './pathology-codes';

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<FactSource, string> = {
  manual:               'Manual',
  ai_extracted:         'AI extracted',
  ai_suggested:         'AI suggestion',
  intake_questionnaire: 'Intake form',
  lab_import:           'Lab import',
  derived_rule:         'Auto-generated',
  historic_record:      'Historic',
  referral_letter:      'Referral',
};

const SOURCE_STYLE: Record<FactSource, React.CSSProperties> = {
  manual:               { background: '#f3f4f6', color: '#374151' },
  ai_extracted:         { background: '#ede9fe', color: '#5b21b6' },
  ai_suggested:         { background: '#fdf4ff', color: '#7e22ce' },
  intake_questionnaire: { background: '#eff6ff', color: '#1e40af' },
  lab_import:           { background: '#fff7ed', color: '#9a3412' },
  derived_rule:         { background: '#f0fdf4', color: '#166534' },
  historic_record:      { background: '#f8fafc', color: '#475569' },
  referral_letter:      { background: '#fdf2f8', color: '#831843' },
};

const STATUS_STYLE: Record<FactStatus, React.CSSProperties> = {
  active:    { background: '#dcfce7', color: '#166534' },
  confirmed: { background: '#d1fae5', color: '#065f46' },
  suspected: { background: '#fef9c3', color: '#854d0e' },
  resolved:  { background: '#f3f4f6', color: '#6b7280' },
  refuted:   { background: '#fecaca', color: '#991b1b', textDecoration: 'line-through' },
  pending:   { background: '#dbeafe', color: '#1e40af' },
  cancelled: { background: '#f3f4f6', color: '#9ca3af', textDecoration: 'line-through' },
  completed: { background: '#d1fae5', color: '#065f46' },
  overdue:   { background: '#fee2e2', color: '#991b1b' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FragmentShellProps {
  fact: ClinicalFact;
  codeValue?: string | null;   // e.g. "K35.2" (ICD-10), "8867-4" (LOINC)
  compact?: boolean;
  showProvenance?: boolean;
  onVerify?: (id: string) => void;
  onStatusChange?: (id: string, status: FactStatus) => void;
  onDismiss?: (id: string) => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FragmentShell({
  fact, codeValue, compact, showProvenance,
  onVerify, onStatusChange, onDismiss, actionSlot, children,
}: FragmentShellProps) {
  const cs = getCodeSystem(fact.factType);
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  const needsVerification =
    (fact.source === 'ai_extracted' || fact.source === 'ai_suggested') &&
    !fact.verifiedBy &&
    (fact.factType === 'allergy' || fact.factType === 'prescription' || fact.factType === 'diagnosis');

  const codeDisplay = codeValue ? formatCode(cs.system, codeValue) : null;

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${cs.borderColor}40`,
      borderLeft: `3px solid ${cs.borderColor}`,
      marginBottom: compact ? 4 : 8,
      background: '#fff',
      overflow: 'hidden',
      boxShadow: needsVerification ? `0 0 0 2px ${cs.borderColor}60` : undefined,
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: compact ? '4px 8px' : '6px 10px',
        background: cs.color, borderBottom: `1px solid ${cs.borderColor}20`,
      }}>
        <span style={{ fontSize: compact ? 12 : 14 }}>{cs.icon}</span>
        <span style={{
          fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: 0.6,
          textTransform: 'uppercase', color: cs.textColor, opacity: 0.7,
        }}>
          {codeDisplay ?? cs.label}
        </span>

        {/* Source badge */}
        <span style={{
          marginLeft: 'auto',
          ...SOURCE_STYLE[fact.source],
          fontSize: 9, fontWeight: 600, padding: '1px 5px',
          borderRadius: 3, letterSpacing: 0.3,
        }}>
          {SOURCE_LABELS[fact.source]}
        </span>

        {/* Status chip */}
        <span style={{
          ...STATUS_STYLE[fact.status],
          fontSize: 9, fontWeight: 700, padding: '1px 5px',
          borderRadius: 3, textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
          {fact.status}
        </span>

        {/* Provenance toggle */}
        {(showProvenance || fact.displayReason) && (
          <button
            type="button"
            title="Why does this appear?"
            onClick={() => setProvenanceOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, padding: '0 2px', color: cs.textColor, opacity: 0.5,
            }}
          >
            ℹ
          </button>
        )}

        {/* Dismiss */}
        {onDismiss && (
          <button
            type="button"
            title="Dismiss"
            onClick={() => onDismiss(fact.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, padding: '0 2px', color: '#9ca3af', lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Provenance row ── */}
      {provenanceOpen && fact.displayReason && (
        <div style={{
          padding: '4px 10px', fontSize: 11, color: '#6b7280',
          background: '#fafafa', borderBottom: '1px solid #f3f4f6',
          fontStyle: 'italic',
        }}>
          <strong>Why:</strong> {fact.displayReason}
          {fact.ruleId && <span style={{ marginLeft: 8, opacity: 0.6 }}>Rule: {fact.ruleId}</span>}
        </div>
      )}

      {/* ── AI verification warning ── */}
      {needsVerification && (
        <div style={{
          padding: '5px 10px', fontSize: 11,
          background: '#fffbeb', borderBottom: '1px solid #fde68a',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: '#b45309', fontWeight: 600 }}>
            ⚠ AI-generated — clinician verification required before acting on this
          </span>
          {onVerify && (
            <button
              type="button"
              onClick={() => onVerify(fact.id)}
              style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                background: '#b45309', color: '#fff', border: 'none',
              }}
            >
              Verify ✓
            </button>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ padding: compact ? '5px 8px' : '8px 10px' }}>
        {children}
      </div>

      {/* ── Footer: status controls + action slot ── */}
      {(onStatusChange || actionSlot) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 6px',
          borderTop: '1px solid #f3f4f6',
        }}>
          {onStatusChange && (
            <select
              value={fact.status}
              onChange={e => onStatusChange(fact.id, e.target.value as FactStatus)}
              style={{
                fontSize: 10, padding: '2px 4px', borderRadius: 4,
                border: '1px solid #e5e7eb', color: '#374151', cursor: 'pointer',
              }}
            >
              {(['active','confirmed','resolved','refuted','pending','cancelled','suspected','completed','overdue'] as FactStatus[])
                .map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {actionSlot && <div style={{ marginLeft: 'auto' }}>{actionSlot}</div>}
        </div>
      )}
    </div>
  );
}
