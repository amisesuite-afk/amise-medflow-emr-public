/**
 * One consultation navigation model (UX review M6 / top-10 #10): Scores stays a step once a chief
 * complaint is chosen, phases are group labels inside the bar, non-documentation steps move to
 * the Tools menu without becoming unreachable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Section } from '@/context/AppContext';
import { CC_BY_FREQUENCY, getMatrix } from '@/lib/cc-matrices';
import {
  availableTools, CONSULT_TOOLS, countedSteps, groupByPhase, neighbours, phaseDone,
  sectionPhase, TOOL_ONLY_SECTIONS, workflowSteps,
} from '@/lib/consult-steps';

const SRC = join(__dirname, '..', '..');
const readSrc = (p: string) => readFileSync(join(SRC, p), 'utf8');

describe('pathway bar steps', () => {
  it('Scores is a step once a chief complaint is chosen (after Assessment)', () => {
    const steps = workflowSteps(['hpi', 'pmh', 'examination', 'assessment', 'plan', 'progress', 'monitoring', 'tasks']);
    expect(steps).toEqual(['hpi', 'pmh', 'examination', 'assessment', 'scales', 'plan']);
    expect(workflowSteps(['hpi', 'plan'])).toEqual(['hpi', 'plan', 'scales']);
    expect(workflowSteps(['hpi', 'scales'])).toEqual(['hpi', 'scales']);
  });

  it('every real chief-complaint pathway keeps Scores and drops only Notes / Monitor / Tasks', () => {
    expect(getMatrix('biliary_colic')).toBeDefined();
    expect(CC_BY_FREQUENCY.length).toBeGreaterThan(10);
    for (const m of CC_BY_FREQUENCY) {
      const steps = workflowSteps(m.sections);
      expect(steps).toContain('scales');
      const dropped = m.sections.filter(s => !steps.includes(s));
      expect(dropped.every(s => TOOL_ONLY_SECTIONS.has(s))).toBe(true);
    }
  });

  it('Scores is never counted as documented / missing', () => {
    expect(countedSteps(['hpi', 'scales', 'plan'])).toEqual(['hpi', 'plan']);
  });
});

describe('phase groups', () => {
  it('groups consecutive steps under their phase label', () => {
    const groups = groupByPhase(['hpi', 'pmh', 'examination', 'investigations', 'radiology', 'assessment', 'scales', 'plan', 'prescriptions']);
    expect(groups.map(g => [g.label, g.steps])).toEqual([
      ['History', ['hpi', 'pmh']],
      ['Exam', ['examination']],
      ['Investigations', ['investigations', 'radiology']],
      ['Assessment', ['assessment', 'scales']],
      ['Plan', ['plan', 'prescriptions']],
    ]);
    expect(sectionPhase('tasks' as Section)).toBe('more');
  });

  it('a phase is ✓ only when all its documentable steps are done (not because it was passed)', () => {
    const [history] = groupByPhase(['hpi', 'pmh', 'medications']);
    expect(phaseDone(history!, { hpi: true, pmh: false, medications: false })).toBe(false);
    expect(phaseDone(history!, { hpi: true, pmh: true, medications: true })).toBe(true);
    const [assess] = groupByPhase(['scales']);
    expect(phaseDone(assess!, {})).toBe(false);
  });
});

describe('prev / next', () => {
  const steps = [{ id: 'hpi' as Section }, { id: 'pmh' as Section }, { id: 'plan' as Section }];
  it('follows the bar order', () => {
    expect(neighbours(steps, 'pmh')).toEqual({ prev: { id: 'hpi' }, next: { id: 'plan' } });
    expect(neighbours(steps, 'plan').next).toBeNull();
    expect(neighbours(steps, 'tasks').next).toEqual({ id: 'hpi' });
  });
});

describe('Tools menu', () => {
  it('offers Scores, Vitals and Prescriptions (and the steps moved out of the bar)', () => {
    expect(CONSULT_TOOLS.map(t => t.label)).toEqual(['Scores', 'Vitals', 'Prescriptions', 'Notes', 'Tasks']);
    for (const s of TOOL_ONLY_SECTIONS) expect(CONSULT_TOOLS.some(t => t.id === s)).toBe(true);
    expect(availableTools(false).map(t => t.id)).not.toContain('prescriptions');
    expect(availableTools(true).map(t => t.id)).toContain('prescriptions');
  });

  it('is offered in every consultation navigation mode (CC pathway, guided, full tab strip)', () => {
    const nav = readSrc('components/ConsultationNav.tsx');
    expect(nav).toMatch(/const toolsMenu = <ConsultToolsMenu\b/);
    expect(nav.match(/\{toolsMenu\}/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('opens over the current step: the drawer never changes the active step', () => {
    const drawer = readSrc('components/ConsultToolDrawer.tsx');
    expect(drawer).not.toMatch(/setActiveSection|setTopSection/);
  });
});
