/**
 * One navigation model for the consultation (UX review M6 / top-10 #10).
 *
 * Before: three stacked layers — the phase breadcrumb (History › Exam › Assessment › Plan), a row
 * of Back / Dictate / Ambient / Next / Summary, and a 17-pill pathway bar — and the Scores tab
 * disappeared once a chief complaint was chosen (the pathway bar replaced the tab bar and had no
 * Scales entry).
 *
 * After: one pathway bar. The phase is a group label inside it; the actions sit in its header;
 * Scores is a step (next to Assessment); the non-documentation steps (Notes, Monitor, Tasks) and
 * Scores / Vitals / Prescriptions are also in a Tools menu that opens them over the current step.
 * Nothing is removed: every section stays reachable (the Tools-only sections stay in the
 * consultation tab list, so the command palette and deep links still land on them).
 *
 * Pure (no React) so it can be unit-tested: lib/__tests__/consult-steps.test.ts.
 */
import type { Section } from '@/context/AppContext';

export type ConsultPhaseKey = 'history' | 'exam' | 'investigations' | 'assessment' | 'plan' | 'more';

export const PHASE_LABELS: Record<ConsultPhaseKey, string> = {
  history: 'History',
  exam: 'Exam',
  investigations: 'Investigations',
  assessment: 'Assessment',
  plan: 'Plan',
  more: 'More',
};

const PHASE_OF: Partial<Record<Section, ConsultPhaseKey>> = {
  brief: 'history', triage: 'history', hpi: 'history', pmh: 'history', surgical: 'history',
  medications: 'history', allergies: 'history', family_hx: 'history', toxic: 'history',
  ros: 'history', nurse_apcq: 'history', apcq: 'history',
  examination: 'exam', wounds: 'exam',
  investigations: 'investigations', blood_gas: 'investigations', radiology: 'investigations',
  attachments: 'investigations',
  assessment: 'assessment', scales: 'assessment', ai_consultant: 'assessment', classifications: 'assessment',
  plan: 'plan', procedures: 'plan', prescriptions: 'plan', dosing: 'plan', fluid_nutrition: 'plan',
  referring_providers: 'plan', consent: 'plan', periop: 'plan', who_checklist: 'plan',
  letters: 'plan', patient_education: 'plan',
};

export function sectionPhase(section: Section): ConsultPhaseKey {
  return PHASE_OF[section] ?? 'more';
}

/** Steps that are not documentation of this encounter: in the Tools menu, not in the pill bar. */
export const TOOL_ONLY_SECTIONS: ReadonlySet<Section> = new Set<Section>(['progress', 'monitoring', 'tasks']);

/**
 * Pill-bar steps for a chief-complaint pathway: the matrix's sections minus the Tools-only ones,
 * with Scores added right after Assessment (or at the end when the pathway has no Assessment).
 */
export function workflowSteps(matrixSections: readonly Section[]): Section[] {
  const pills = matrixSections.filter(s => !TOOL_ONLY_SECTIONS.has(s));
  if (pills.includes('scales')) return pills;
  const at = pills.indexOf('assessment');
  return at >= 0 ? [...pills.slice(0, at + 1), 'scales', ...pills.slice(at + 1)] : [...pills, 'scales'];
}

/** Steps counted in "n/N done": Scores has no documentation signal and is never counted. */
export function countedSteps(steps: readonly Section[]): Section[] {
  return steps.filter(s => s !== 'scales');
}

export interface PhaseGroup { phase: ConsultPhaseKey; label: string; steps: Section[] }

/** Consecutive steps of the same phase, in order, for the group labels inside the bar. */
export function groupByPhase(steps: readonly Section[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const step of steps) {
    const phase = sectionPhase(step);
    const last = groups[groups.length - 1];
    if (last && last.phase === phase) last.steps.push(step);
    else groups.push({ phase, label: PHASE_LABELS[phase], steps: [step] });
  }
  return groups;
}

/** A phase shows ✓ only when every documentable step in it is done (never by position). */
export function phaseDone(group: PhaseGroup, done: Partial<Record<Section, boolean>>): boolean {
  const counted = group.steps.filter(s => s in done);
  return counted.length > 0 && counted.every(s => !!done[s]);
}

/** Previous / next step around `active` in `steps` (null at either end or when not a step). */
export function neighbours<T extends { id: Section }>(steps: readonly T[], active: Section): { prev: T | null; next: T | null } {
  const i = steps.findIndex(s => s.id === active);
  if (i < 0) return { prev: null, next: steps[0] ?? null };
  return { prev: i > 0 ? steps[i - 1]! : null, next: i < steps.length - 1 ? steps[i + 1]! : null };
}

// ── Tools menu ────────────────────────────────────────────────────────────────

export type ConsultToolId = 'scales' | 'monitoring' | 'prescriptions' | 'progress' | 'tasks';

export interface ConsultTool { id: ConsultToolId; label: string; icon: string; doctorOnly: boolean }

/** Opened over the current step (a side panel), so the clinician keeps their place. */
export const CONSULT_TOOLS: readonly ConsultTool[] = [
  { id: 'scales',        label: 'Scores',        icon: '📊', doctorOnly: false },
  { id: 'monitoring',    label: 'Vitals',        icon: '🩺', doctorOnly: false },
  { id: 'prescriptions', label: 'Prescriptions', icon: '💊', doctorOnly: true },
  { id: 'progress',      label: 'Notes',         icon: '📝', doctorOnly: false },
  { id: 'tasks',         label: 'Tasks',         icon: '✓',  doctorOnly: false },
];

/** Tools this user may open (Prescriptions is doctor-only, as its step is). */
export function availableTools(isDoctor: boolean): ConsultTool[] {
  return CONSULT_TOOLS.filter(t => !t.doctorOnly || isDoctor);
}
