/**
 * Plan builder — the PlanTab "Insert suggested plan" text, the ManagementPanel protocol and the
 * PrescriptionsTab protocol medicines, adapted to the patient on record.
 *
 * Pure and deterministic (no AI, no network). The patient-specific filters live in pane-engine
 * (`adaptProtocolForPatient`, lib/pane-engine/src/management/planSafety.ts):
 *   - class-aware allergy cross-check with the protocol's alternative;
 *   - pregnancy (no NSAIDs from 20 weeks, no DOAC/warfarin → LMWH, ionising imaging caveats,
 *     obstetric involvement, "β-HCG: result required" when pregnancy is possible);
 *   - under 16: adult doses replaced by "weight-based — calculate per BNFc", adult hernia
 *     techniques (mesh, TEP/TAPP, truss) withheld;
 *   - VTE prophylaxis line in every operative plan (NICE NG89), renal dose caution;
 *   - procedure-specific anticoagulant / antiplatelet / SGLT2 / steroid / anaesthetic lines.
 * The surgeon reviews and edits everything: this only drafts clinician-facing text.
 */

import {
  adaptPlanText,
  adaptProtocolForPatient,
  hasOperativeSteps,
  resolveProtocol,
} from '@workspace/pane-engine';
import type {
  AdaptedProtocol,
  ManagementProtocol,
  PlanPatientContext,
  SafetyNote,
} from '@workspace/pane-engine';

export const PLAN_PHASE_LABELS: Record<string, string> = {
  immediate:    'IMMEDIATE',
  conservative: 'CONSERVATIVE MANAGEMENT',
  surgical:     'SURGICAL MANAGEMENT',
  followup:     'FOLLOW-UP',
};

/** What the dashboard records about the patient (AppContext fields), all optional. */
export interface PlanContextSource {
  age?: string | number | null;
  sex?: string | null;
  pregnancyPossible?: boolean;
  /** Free-text allergy field ("Penicillin (anaphylaxis), latex") or a list. */
  allergies?: string | string[] | null;
  medications?: string[] | null;
  medicationsText?: string | null;
  comorbidities?: string[] | null;
  pmhNotes?: string | null;
  hpiNotes?: string | null;
  freeText?: string | null;
  surgicalHistory?: string[] | null;
  assessment?: string | null;
  /** Report-imported / typed lab values (key `egfr` in mL/min/1.73 m²). */
  extractedLabs?: Record<string, number | null> | null;
}

/** Splits a free-text list on commas, semicolons and new lines. */
export function splitList(text: string | null | undefined): string[] {
  return (text ?? '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
}

function toAge(age: string | number | null | undefined): number | null {
  if (typeof age === 'number') return Number.isFinite(age) ? age : null;
  if (!age) return null;
  const n = parseFloat(age);
  return Number.isFinite(n) ? n : null;
}

/** Builds the pane-engine patient context from the dashboard fields. */
export function planPatientContext(src: PlanContextSource): PlanPatientContext {
  const allergies = Array.isArray(src.allergies) ? src.allergies : splitList(src.allergies ?? '');
  const egfr = src.extractedLabs?.egfr;
  return {
    ageYears: toAge(src.age),
    sex: src.sex ?? null,
    pregnancyPossible: !!src.pregnancyPossible,
    allergies,
    medications: [...(src.medications ?? []), ...splitList(src.medicationsText)],
    comorbidities: src.comorbidities ?? [],
    assessment: src.assessment ?? '',
    freeText: [src.hpiNotes, src.pmhNotes, src.freeText, ...(src.surgicalHistory ?? [])].filter(Boolean).join(' ; '),
    egfr: typeof egfr === 'number' && Number.isFinite(egfr) ? egfr : null,
  };
}

/**
 * The protocol for a confirmed diagnosis: the working diagnosis's protocol unless the recorded ICD
 * code points to a more specific one (pane-engine `resolveProtocol`).
 */
export function planProtocolFor(diseaseId: string | null | undefined, icdCode: string | null | undefined): ManagementProtocol | null {
  return resolveProtocol(diseaseId ?? null, icdCode ?? null);
}

export interface PlanBuildOptions {
  isInpatient?: boolean;
  surgeon?: string;
  /** Dx-variant phase filter. */
  allowedPhases?: string[];
  /** Dx-variant plan prefix. */
  planPrefix?: string;
}

export interface PlanSections {
  prefix: string[];
  safety: SafetyNote[];
  admission: string[];
  phases: { phase: string; label: string; steps: string[] }[];
  investigations: { label: string; urgency: string }[];
  referral: string | null;
  adapted: AdaptedProtocol;
}

/** Adapts the protocol for the patient and splits the plan into its sections. */
export function buildPlanSections(
  protocol: ManagementProtocol,
  ctx: PlanPatientContext,
  opts: PlanBuildOptions = {},
): PlanSections {
  const { allowedPhases, planPrefix } = opts;
  // Operative when the plan keeps surgical-phase steps that describe an operation or procedure.
  const operative = hasOperativeSteps(protocol, allowedPhases);
  const adapted = adaptProtocolForPatient(protocol, ctx, { operative });

  const prefix = planPrefix
    ? adaptPlanText(planPrefix, protocol, ctx).split('\n').map(l => l.trimEnd()).filter(l => l.trim())
    : [];

  const admission = opts.isInpatient
    ? [
      `- Admit under ${opts.surgeon || 'the admitting surgeon'} — General / Endoscopic Surgery`,
      '- Monitoring: VS q4h, I&O charting, daily weights',
      '- VTE risk assessment on admission; prophylaxis as in the safety checks above (NICE NG89)',
    ]
    : [];

  const byPhase = new Map<string, string[]>();
  for (const step of adapted.management) {
    if (allowedPhases && !allowedPhases.includes(step.phase)) continue;
    if (!byPhase.has(step.phase)) byPhase.set(step.phase, []);
    byPhase.get(step.phase)!.push(step.step);
  }
  const phases = [...byPhase].map(([phase, steps]) => ({ phase, label: PLAN_PHASE_LABELS[phase] ?? phase.toUpperCase(), steps }));

  return {
    prefix,
    safety: adapted.safetyNotes,
    admission,
    phases,
    investigations: adapted.investigations.map(i => ({ label: i.label, urgency: i.urgency })),
    referral: adapted.referral ?? null,
    adapted,
  };
}

const SEVERITY_MARK: Record<SafetyNote['severity'], string> = { critical: '⚠ ', warning: '', info: '' };

/** One line per safety note, as written into the plan. */
export function safetyLines(notes: readonly SafetyNote[]): string[] {
  return notes.map(n => `- ${SEVERITY_MARK[n.severity]}${n.text}`);
}

/** PlanTab's suggested plan text. */
export function buildPlanText(protocol: ManagementProtocol, ctx: PlanPatientContext, opts: PlanBuildOptions = {}): string {
  const sec = buildPlanSections(protocol, ctx, opts);
  const lines: string[] = [];

  if (sec.prefix.length) lines.push(...sec.prefix, '');

  if (sec.safety.length) {
    lines.push('Patient-specific safety checks (review before acting)');
    lines.push(...safetyLines(sec.safety));
    lines.push('');
  }

  if (sec.admission.length) lines.push('Admission orders', ...sec.admission, '');

  for (const p of sec.phases) {
    lines.push(`${protocol.label} — ${p.label}`);
    p.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
  }

  if (sec.investigations.length) {
    lines.push('Investigations');
    for (const inv of sec.investigations) lines.push(`- ${inv.label} (${inv.urgency})`);
    lines.push('');
  }

  if (sec.referral) lines.push('Referral', sec.referral, '');

  return lines.join('\n').trimEnd();
}
