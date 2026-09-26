/**
 * The Adaptive HPI questions follow the complaint (lib/hpi-fields.ts; history-by-complaint audit).
 * The frame data and the chip → engine mapping are checked by lint:history-frames; this checks what
 * the web actually asks: the template's prompts or the history frame, plus the triage branches.
 */

import { describe, expect, it } from 'vitest';
import { CC_TEMPLATES, getMatrixByName } from '@/lib/cc-matrices';
import { ALL_SYMPTOMS_FLAT } from '@/data/symptoms-db';
import { buildFields, hpiFieldSet, historyPrompts } from '@/lib/hpi-fields';
import { classifyComplaint } from '@workspace/triage-engine/history-frames';
import { extractFeaturesFromSocrates } from '@/lib/socrates-to-features';

/** Abdominal site chips (quadrants and regions). */
const ABDOMINAL = new Set(['RUQ', 'LUQ', 'RLQ', 'LLQ', 'RIF', 'LIF', 'Periumbilical', 'Suprapubic', 'Loin',
  'Central abdomen', 'Right flank', 'Left flank']);
const ABDOMINAL_FRAMES = new Set(['pain.abdomen', 'lump.abdominal']);

function complaintFrame(complaint: string): string {
  const tpl = hpiFieldSet(complaint).template;
  return classifyComplaint(tpl ? tpl.name : complaint).frameId;
}

describe('HPI questions by complaint', () => {
  it('owner report: "Cough" gets the cough history — no abdominal sites, no radiation', () => {
    const set = hpiFieldSet('Cough');
    expect(set.template).toBeUndefined();
    expect(set.frame.frame.id).toBe('cough');
    const chips = set.fields.flatMap(f => f.chips);
    for (const s of ABDOMINAL) expect(chips).not.toContain(s);
    expect(set.fields.some(f => f.key === 'radiation')).toBe(false);
    expect(chips).toContain('Dry cough');
    expect(chips).toContain('Haemoptysis — frank blood');
  });

  it('first-word template matches need the same kind of complaint', () => {
    // Before: abdominal-mass, upper GI bleed, breast lump and neck lump templates.
    expect(getMatrixByName('Abdominal pain').id).toBe('other_surgical');
    expect(getMatrixByName('Upper abdominal pain').id).toBe('other_surgical');
    expect(getMatrixByName('Breast pain').id).toBe('other_surgical');
    expect(getMatrixByName('Neck pain').id).toBe('other_surgical');
    expect(getMatrixByName('Rectal pain').id).toBe('other_surgical');
    // Still matched: the same kind of complaint.
    expect(getMatrixByName('Inguinal hernia').id).toBe('inguinal_hernia');
    expect(getMatrixByName('Nausea').id).toBe('nausea_vomiting');
    expect(getMatrixByName('Acute abdominal pain').id).toBe('acute_abdominal_pain');
    // The fallback now asks the frame's questions.
    expect(hpiFieldSet('Upper abdominal pain').frame.frame.id).toBe('pain.abdomen');
    expect(buildFields('Breast pain').find(f => f.key === 'site')!.chips).toContain('Upper outer — right');
  });

  it('every template and SmartSymptomPicker symptom: radiation only for pain, abdominal sites only for an abdominal complaint', () => {
    const problems: string[] = [];
    const complaints = [...CC_TEMPLATES.map(t => t.name), ...ALL_SYMPTOMS_FLAT];
    for (const c of complaints) {
      const frame = complaintFrame(c);
      const fields = buildFields(c);
      if (!frame.startsWith('pain.') && fields.some(f => f.key === 'radiation')) problems.push(`${c}: radiation for ${frame}`);
      if (!ABDOMINAL_FRAMES.has(frame)) {
        for (const f of fields.filter(x => /site|location/.test(x.key))) {
          const bad = f.chips.filter(ch => ABDOMINAL.has(ch));
          if (bad.length) problems.push(`${c} (${frame}): abdominal sites ${bad.join(', ')}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('pain keeps SOCRATES: abdominal pain via the template, other pain via the pain frame', () => {
    const tpl = hpiFieldSet('Acute abdominal pain');
    expect(tpl.template?.id).toBe('acute_abdominal_pain');
    const typed = hpiFieldSet('Right upper quadrant pain');
    expect(typed.frame.frame.id).toBe('pain.abdomen');
    expect(typed.fields.map(f => f.key)).toEqual(expect.arrayContaining(['onset', 'site', 'character', 'radiation', 'assoc', 'severity']));
  });

  it('the CC strip asks the same questions as the HPI card', () => {
    expect(historyPrompts('Cough').map(p => p.key)).toEqual(hpiFieldSet('Cough').frame.dimensions.map(d => d.webKey ?? d.id).map(k => k));
    expect(historyPrompts('Acute abdominal pain')).toBe(CC_TEMPLATES.find(t => t.id === 'acute_abdominal_pain')!.prompts);
    expect(historyPrompts('Cough', 'dyspnoea')[0]!.label).toBe('Onset');
  });

  it('frame answers reach the pane engine', () => {
    const f = extractFeaturesFromSocrates('Cough', {
      cough_character: 'Productive cough', sputum: 'Purulent green or yellow sputum', haemoptysis: 'Haemoptysis — frank blood',
      cough_exposure: 'Started after an ACE inhibitor, Current or ex-smoker',
    });
    expect(f).toMatchObject({ productive_cough: true, purulent_sputum: true, haemoptysis: true, acei_arb_use: true, smoker: true });
    // A non-pain answer never gets a pain-only feature.
    const d = extractFeaturesFromSocrates('Shortness of breath', { dyspnoea_timing: 'Episodic, Nocturnal' });
    expect(d.episodic_pain).toBeUndefined();
    expect(d.nocturnal_pain).toBeUndefined();
    // "Worse on coughing" aggravates pain; it is not a cough.
    const p = extractFeaturesFromSocrates('Acute abdominal pain', { triggers: 'Coughing, Movement' });
    expect(p.cough).toBeUndefined();
    expect(p.pain_worse_movement).toBe(true);
  });
});
