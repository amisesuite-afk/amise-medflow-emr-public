/**
 * Plan builder — every screen that shows a management protocol reads it through here, adapted to
 * the patient on record: the PlanTab "Insert suggested plan" text, the ManagementPanel, the
 * PrescriptionsTab protocol medicines, the SummaryTab discharge medicines and protocol fill, the
 * Ambient consultation protocol card and plan, the InvestigationsTab protocol panel, the
 * Dictionary launch and the suggested (seeded) investigations. No screen reads a raw protocol for
 * a patient (`patientProtocol` below; a unit test scans the dashboard for raw `getProtocol` use).
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
  getProtocol,
  hasOperativeSteps,
  resolveProtocol,
} from '@workspace/pane-engine';
import type {
  AdaptOptions,
  AdaptedProtocol,
  InvestigationItem,
  ManagementProtocol,
  PlanPatientContext,
  ProtocolMedication,
  SafetyNote,
} from '@workspace/pane-engine';
import { PANE_PANEL_THRESHOLD } from './management-panel-source';
import type { ManagementPanelSource, PaneLeader } from './management-panel-source';

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

/**
 * The shared entry point for a protocol shown for a patient: `resolveProtocol` (the recorded ICD
 * code wins when it names a more specific protocol), then the pane-engine plan-safety filter
 * (`adaptProtocolForPatient`: allergy, pregnancy, under 16, conditional branches, safety lines).
 * Returns null when no protocol matches.
 */
export function patientProtocol(
  diseaseId: string | null | undefined,
  icdCode: string | null | undefined,
  ctx: PlanPatientContext,
  opts: AdaptOptions = {},
): AdaptedProtocol | null {
  const base = planProtocolFor(diseaseId, icdCode);
  return base ? adaptProtocolForPatient(base, ctx, opts) : null;
}

// ── Discharge medicines (SummaryTab) ─────────────────────────────────────────────────────────

export interface DischargeMedicationLine {
  /** The line written into the discharge summary. */
  text: string;
  /** 'medication': given as written; 'bnfc': dose replaced for a child; 'withheld': not given. */
  status: 'medication' | 'bnfc' | 'withheld';
  /** Why the line differs from the protocol (allergy, pregnancy, under 16); absent when it does not. */
  reason?: string;
}

const BNFC_DOSE = /^weight-based/i;

/** The filter's explanation and alternative, after "withheld (contains …)" in its line. */
function withheldDetail(note: string | undefined): string {
  const fallback = 'Choose an alternative with the pharmacist.';
  if (!note) return fallback;
  const m = /withheld \(contains [^)]*\)[.\s—-]*/.exec(note);
  const rest = (m ? note.slice(m.index + m[0].length) : note.replace(/^⚠\s*/, '')).trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : fallback;
}

function medicationText(m: ProtocolMedication): string {
  return `${m.drugName} ${m.dose} ${m.route}, ${m.frequency}${m.duration ? ` for ${m.duration}` : ''} — ${m.indication}`;
}

/**
 * The protocol's discharge medicines for this patient. A medicine the plan-safety filter withheld
 * (allergy, pregnancy …) never appears as a medicine: it is replaced by a line naming what was
 * withheld, why, and the protocol's alternative (a kept medicine listed as its alternative, else
 * the filter's own alternative wording). Under 16 the adult dose is already replaced by
 * "Weight-based — calculate per BNFc", and the line says so.
 */
export function dischargeMedicationLines(adapted: AdaptedProtocol): DischargeMedicationLine[] {
  const kept = (adapted.medications ?? []).filter(m => m.phase === 'discharge');
  const lines: DischargeMedicationLine[] = [];
  for (const w of adapted.withheld) {
    if (w.from !== 'medication' || w.phase !== 'discharge') continue;
    const name = (w.drugName ?? w.item).toLowerCase();
    const alt = kept.filter(m => m.alternativeTo && m.alternativeTo.toLowerCase() === name);
    const alternative = alt.length
      ? `Protocol alternative: ${alt.map(m => m.drugName).join(' or ')} (listed below).`
      : withheldDetail(w.note);
    lines.push({
      text: `⚠ WITHHELD — ${w.item}: ${w.reason}. ${alternative}`,
      status: 'withheld',
      reason: w.reason,
    });
  }
  for (const m of kept) {
    const child = BNFC_DOSE.test(m.dose);
    lines.push({
      text: child ? `${medicationText(m)} [under 16: weight-based dose — calculate per BNFc]` : medicationText(m),
      status: child ? 'bnfc' : 'medication',
      ...(child ? { reason: 'under 16: adult dose replaced — calculate per BNFc' } : {}),
    });
  }
  return lines;
}

/**
 * The SummaryTab "Protocol fill" for the discharge summary: warning signs (the protocol's red
 * flags, without the clinician-facing safety lines), follow-up (follow-up steps and referral) and
 * the discharge notes (discharge medicines as above, the allergy / paediatric safety lines that
 * concern them, and the adapted key points).
 */
export function dischargeProtocolFill(adapted: AdaptedProtocol): { warningSigns: string[]; followUp: string[]; dischargeNotes: string[] } {
  const safetyTexts = new Set(adapted.safetyNotes.map(n => n.text));
  const meds = dischargeMedicationLines(adapted);
  const medNotes = meds.length
    ? adapted.safetyNotes.filter(n => n.kind === 'allergy' || (n.kind === 'paediatric' && meds.some(l => l.status === 'bnfc'))).map(n => `⚠ ${n.text}`)
    : [];
  return {
    warningSigns: adapted.redFlags.filter(f => !safetyTexts.has(f)),
    followUp: [
      ...adapted.management.filter(s => s.phase === 'followup').map(s => s.step),
      ...(adapted.referral ? [`Referral: ${adapted.referral}`] : []),
    ],
    dischargeNotes: [...medNotes, ...meds.map(l => l.text), ...adapted.keyPoints],
  };
}

// ── Seeded (suggested) investigations ────────────────────────────────────────────────────────

export interface SeededInvestigation {
  /** The protocol's own label (what is ordered if the clinician ticks it). */
  label: string;
  /** Patient-specific caveat the filter added (pregnancy, child, contrast allergy), or null. */
  caveat: string | null;
  urgency: InvestigationItem['urgency'];
  /** "Acute appendicitis" (confirmed) or "Acute appendicitis (leading differential)". */
  reason: string;
}

export interface SeedResult {
  protocol: AdaptedProtocol | null;
  /** True when the diagnosis is confirmed; false for the leading (considered) differential. */
  confirmed: boolean;
  items: SeededInvestigation[];
  /** Stat tests held back because the diagnosis is only being considered. */
  heldBack: SeededInvestigation[];
}

export type InvestigationWithCaveat = InvestigationItem & {
  /** Patient-specific caveat the filter added (pregnancy, child, contrast allergy), or null. */
  caveat: string | null;
};

/**
 * The adapted protocol's investigations with the orderable label (the protocol's own wording) and
 * the patient-specific caveat kept apart: an order or imaging request is made from the label (the
 * caveat names other modalities, e.g. "only if ultrasound/MRI cannot answer", which would confuse
 * the modality parser), and the caveat is shown next to it.
 */
export function investigationsWithCaveats(adapted: AdaptedProtocol): InvestigationWithCaveat[] {
  const base = getProtocol(adapted.diseaseId)?.investigations ?? [];
  return adapted.investigations.map(inv => {
    let best = '';
    for (const b of base) if (inv.label.startsWith(b.label) && b.label.length > best.length) best = b.label;
    if (!best || best === inv.label) return { ...inv, caveat: null };
    return { ...inv, label: best, caveat: inv.label.slice(best.length).replace(/^\s*—\s*/, '').trim() || null };
  });
}

/**
 * The investigations suggested from the diagnosis (the HPI / Labs / Imaging "suggested" lists).
 *
 * - One diagnosis only: the confirmed diagnosis (locked working diagnosis or recorded ICD-10
 *   code) when there is one, otherwise the leading PANE differential — never every top-3
 *   differential (`managementPanelSource` decides, as for the ManagementPanel). When the
 *   confirmed diagnosis has no protocol (e.g. an ICD code such as O26.83 that names no protocol),
 *   the leading differential (posterior ≥ 20%) is used instead, as a considered diagnosis.
 * - Through the patient filter (`patientProtocol`): conditional branches resolved, pregnancy /
 *   child / contrast caveats on imaging, "pregnancy test — result required" when a procedure is
 *   planned in a woman who may be pregnant.
 * - Stat and urgent tests only (routine ones stay tap-to-add on the Labs step); from a diagnosis
 *   that is only being considered, no stat test is suggested — a stat test presupposes the
 *   diagnosis (e.g. an immediate CT head for SAH): it is suggested once the diagnosis is confirmed.
 *
 * Nothing here orders anything: the result is a list of suggestions the clinician ticks or ignores.
 */
export function seedInvestigations(
  source: ManagementPanelSource,
  ctx: PlanPatientContext,
  opts: { leader?: PaneLeader | null } = {},
): SeedResult {
  const empty: SeedResult = { protocol: null, confirmed: source.source === 'confirmed', items: [], heldBack: [] };
  if (source.source === 'none') return empty;
  let protocol = patientProtocol(source.diseaseId, source.icdCode, ctx);
  let confirmed = source.source === 'confirmed';
  const leader = opts.leader;
  if (!protocol && confirmed && leader && leader.probability >= PANE_PANEL_THRESHOLD) {
    protocol = patientProtocol(leader.diseaseId, null, ctx);
    confirmed = false;
  }
  if (!protocol) return empty;
  const reason = confirmed ? protocol.label : `${protocol.label} (leading differential)`;
  const items: SeededInvestigation[] = [];
  const heldBack: SeededInvestigation[] = [];
  const rank = { stat: 0, urgent: 1, routine: 2 } as const;
  for (const inv of investigationsWithCaveats(protocol).sort((a, b) => rank[a.urgency] - rank[b.urgency])) {
    if (inv.urgency === 'routine') continue;
    const item: SeededInvestigation = { label: inv.label, caveat: inv.caveat, urgency: inv.urgency, reason };
    if (!confirmed && inv.urgency === 'stat') heldBack.push(item);
    else items.push(item);
  }
  return { protocol, confirmed, items, heldBack };
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
