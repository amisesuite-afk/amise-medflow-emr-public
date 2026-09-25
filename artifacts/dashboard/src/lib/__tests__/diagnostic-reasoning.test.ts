import { describe, expect, it } from 'vitest';
import { DISEASES, applyModifiers, initPaneState, updatePosterior } from '@workspace/pane-engine';
import type { PaneState } from '@workspace/pane-engine';
import {
  buildDiagnosticReasoning, news2Series, numericLabs, paneWeight, reasoningHarnessLines, reasoningRecordText,
  resolveWorkingNode, CANT_MISS_DISEASE_IDS,
} from '@/lib/diagnostic-reasoning';

const diseases = applyModifiers(DISEASES, 45, 'male', undefined, {});

function stateWith(findings: Record<string, boolean>): PaneState {
  let s = initPaneState(diseases);
  for (const [f, v] of Object.entries(findings)) s = updatePosterior(s, diseases, f, v);
  return s;
}

const EPIGASTRIC = { epigastric_pain: true, nausea_vomiting: true, radiation_to_back: true, alcohol_use: true, acute_onset: true };

function run(state: PaneState, extra: Partial<Parameters<typeof buildDiagnosticReasoning>[0]> = {}) {
  return buildDiagnosticReasoning({
    state, diseases, working: null, news2Series: [], recordText: '', labs: [], longitudinal: null, ...extra,
  });
}

describe('diagnostic reasoning — web adapter (PANE)', () => {
  it('explains the leading diagnosis from PANE likelihoods, with the module source', () => {
    const r = run(stateWith(EPIGASTRIC));
    const panc = r.explanations.find(e => e.hypothesisId === 'pancreatitis')!;
    expect(r.explanations[0].hypothesisId).toBe('pancreatitis');
    const back = panc.forFindings.find(f => f.findingId === 'radiation_to_back')!;
    expect(back.lr).toBeGreaterThan(5);
    expect(back.source).toMatch(/PANE general surgery/);
    expect(panc.missing.map(m => m.findingId)).toContain('elevated_amylase');
    expect(panc.missing.find(m => m.findingId === 'elevated_amylase')!.documented).toBe(false);
  });

  it('LR is P(finding | disease) over the background rate', () => {
    const panc = DISEASES.find(d => d.id === 'pancreatitis')!;
    const w = paneWeight(panc, 'elevated_amylase');
    expect(w.lrPresent).toBeGreaterThan(10);
    expect(w.cardinal).toBe(true);
    expect(w.lrAbsent).toBeLessThan(0.2);
  });

  it('best next discriminator: amylase / lipase before any scan, with the post-test probabilities', () => {
    const r = run(stateWith(EPIGASTRIC));
    expect(r.discriminators[0].probe.id).toBe('elevated_amylase');
    expect(r.discriminators[0].probe.cost).toBe('lab');
    expect(r.discriminators[0].why).toMatch(/^If positive: Acute Pancreatitis \d+% → (>99%|\d+%)/);
    // No can't-miss diagnosis among pancreatitis / gastritis / biliary colic: no CT, MRI or endoscopy.
    expect(r.discriminators.every(d => d.probe.cost !== 'advanced')).toBe(true);
  });

  it('can-not-miss list names real PANE diseases', () => {
    const ids = new Set(DISEASES.map(d => d.id));
    for (const id of CANT_MISS_DISEASE_IDS) expect(ids.has(id), id).toBe(true);
  });

  it('premature closure: raised amylase against a confirmed peptic ulcer names the finding and pancreatitis', () => {
    const state = stateWith({ ...EPIGASTRIC, elevated_amylase: true });
    const r = run(state, { working: { diseaseId: 'peptic_ulcer', icdCode: 'K27.9', label: 'Peptic ulcer disease' } });
    expect(r.workingId).toBe('peptic_ulcer');
    const texts = r.closureAlerts.map(a => a.text).join('\n');
    expect(texts).toMatch(/Doesn't fit the working diagnosis: the record favours Acute Pancreatitis \(>99%\) over Peptic Ulcer Disease \(<1%\) — mainly Elevated amylase \/ lipase/);
    expect(r.explanations.map(e => e.hypothesisId)).toContain('peptic_ulcer');
  });

  it('no closure alert when the working diagnosis fits', () => {
    const state = stateWith({ ...EPIGASTRIC, elevated_amylase: true });
    const r = run(state, { working: { diseaseId: 'pancreatitis', icdCode: null, label: 'Acute pancreatitis' } });
    expect(r.closureAlerts.filter(a => a.kind !== 'contradicting-finding')).toEqual([]);
  });

  it('NEWS2 rising raises an alert even when PANE does not model the working diagnosis', () => {
    const r = run(stateWith(EPIGASTRIC), { working: { diseaseId: null, icdCode: 'Z99.9', label: 'Something unmodelled' }, news2Series: [1, 5] });
    expect(r.closureAlerts.map(a => a.kind)).toEqual(['news2-rising']);
  });

  it('resolves the working diagnosis by id, ICD-10 or label', () => {
    expect(resolveWorkingNode(diseases, { diseaseId: 'appendicitis', icdCode: null, label: '' })?.id).toBe('appendicitis');
    expect(resolveWorkingNode(diseases, { diseaseId: null, icdCode: 'K85.9', label: '' })?.id).toBe('pancreatitis');
    expect(resolveWorkingNode(diseases, { diseaseId: null, icdCode: null, label: 'acute appendicitis' })?.id).toBe('appendicitis');
    expect(resolveWorkingNode(diseases, null)).toBeNull();
  });

  it('zebra check reads the record, numeric labs and the supplement history', () => {
    const recordText = reasoningRecordText({
      chiefComplaint: 'Jaundice', narrative: ['Yellow eyes for a week.'],
      investigationResults: { ALT: '420 U/L' }, supplements: ['Cerasee tea'],
    });
    const r = run(stateWith({ jaundice: true }), { recordText, labs: numericLabs({ ALT: '420 U/L' }) });
    const hili = r.zebras.find(z => z.id === 'herb-induced-liver-injury');
    expect(hili?.link).toBe('supplements');
    expect(hili?.matched).toEqual(['raised transaminases', 'herb']);
  });

  it('time-out after changing diagnoses for the same complaint; longitudinal trends', () => {
    const r = run(stateWith(EPIGASTRIC), {
      currentComplaint: 'Epigastric pain',
      longitudinal: {
        visits: [
          { date: '2026-01-10', complaint: 'Epigastric pain', diagnosis: 'Gastritis' },
          { date: '2026-03-02', complaint: 'Upper abdominal pain', diagnosis: 'Biliary colic' },
        ],
        creatinine: [], haemoglobin: [{ date: '2026-01-10', value: 13.5 }, { date: '2026-03-02', value: 10.9 }], weight: [],
      },
    });
    expect(r.timeOut.suggested).toBe(true);
    expect(r.timeOut.reasons[0]).toMatch(/Visit 3 for the same complaint with changing diagnoses/);
    expect(r.longitudinal?.trends.map(t => t.analyte)).toEqual(['haemoglobin']);
    expect(r.longitudinal?.unheld).toHaveLength(1);
  });

  it('probability ranges bracket the posterior', () => {
    const r = run(stateWith(EPIGASTRIC));
    for (const h of r.hypotheses) {
      expect(r.ranges[h.id].low).toBeLessThanOrEqual(h.probability + 1e-12);
      expect(r.ranges[h.id].high).toBeGreaterThanOrEqual(h.probability - 1e-12);
    }
  });

  it('NEWS2 series and harness lines', () => {
    expect(news2Series([
      { respiratoryRate: 16, spo2: 98, onOxygen: false, systolicBP: 125, heartRate: 80, temperatureCelsius: 37, avpu: 'A' },
      {},
      { respiratoryRate: 26, spo2: 93, onOxygen: false, systolicBP: 95, heartRate: 118, temperatureCelsius: 38.6, avpu: 'A' },
    ])).toEqual([0, 10]);
    const r = run(stateWith(EPIGASTRIC), { working: { diseaseId: 'peptic_ulcer', icdCode: null, label: 'PUD' } });
    const lines = reasoningHarnessLines(r, 'web.reasoning');
    expect(lines.some(l => l.source === 'web.reasoning.discriminator' && /Elevated amylase/.test(l.text))).toBe(true);
    expect(lines.some(l => l.source === 'web.reasoning.alert')).toBe(true);
  });
});
