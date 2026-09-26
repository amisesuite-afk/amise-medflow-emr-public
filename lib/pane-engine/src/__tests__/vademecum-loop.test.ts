/**
 * Vademecum loop (phase 1, shadow): the bundled content loads, the Bayesian layer ranks, and the
 * hybrid layer (criteria floors with the plausibility gate, confirmatory findings, exclusions,
 * conflicts), the entry-point seeding, the question picker and the stopping rule behave as
 * documented in loop.ts. Nothing here is production behaviour.
 */
import { describe, expect, it } from 'vitest';
import {
  VADEMECUM_AREAS, VADEMECUM_FINDINGS, bestQuestion, bundledVademecum, complaintAreas, evaluate, findingsFromLabs,
  findingsFromScores, findingsFromText, generateExamSigns, generateHistoryQuestions, generateInvestigations, loadVademecum,
  runLoop, seedCandidates, decidingFindings, deferredCantMiss,
} from '../vademecum-loop/index.js';
import type { PatientInfo, TextMatcher, VademecumAreaFile, VademecumDisease } from '../vademecum-loop/index.js';

const v = bundledVademecum();
const man24: PatientInfo = { age: 24, sex: 'male' };
const woman50: PatientInfo = { age: 50, sex: 'female' };

describe('bundled vademecum', () => {
  it('loads both pilot areas with thresholds and a reverse index', () => {
    expect(v.areas.map(a => a.area).sort()).toEqual(['abdominal-pain', 'cough-breathlessness']);
    expect(v.diseases.size).toBeGreaterThan(100);
    for (const d of v.diseases.values()) {
      expect(d.thresholds.test).toBeLessThan(d.thresholds.treat);
      for (const f of d.links.keys()) expect(v.reverse.get(f)).toContain(d.disease.id);
    }
    expect(VADEMECUM_FINDINGS.status).toBe('shadow');
  });

  it('nothing is marked signed off', () => {
    for (const d of v.diseases.values()) expect(d.disease.signOff).toBe('pending');
    for (const a of VADEMECUM_AREAS) expect(a.lastReviewed).toBe('unknown');
  });

  it('complaint areas come from keywords or history frames', () => {
    expect(complaintAreas(v, 'Right iliac fossa pain')).toEqual(['abdominal-pain']);
    expect(complaintAreas(v, 'Cough for three weeks')).toEqual(['cough-breathlessness']);
    expect(complaintAreas(v, 'Something else', ['dyspnoea'])).toEqual(['cough-breathlessness']);
  });
});

describe('Bayesian layer and hybrid layer', () => {
  const rif = seedCandidates(v, { complaint: 'Right iliac fossa pain', frames: ['pain.abdomen'], patient: man24 });

  it('ranks appendicitis first for the classic story', () => {
    const ev = evaluate(v, rif.ids, { patient: man24, answers: { rlq_pain: true, pain_migration: true, nausea_vomiting: true, fever: true } });
    expect(ev.ranked[0]!.id).toBe('appendicitis');
    expect(ev.display.length).toBe(v.policy.displaySlots);
  });

  it('a previous appendicectomy excludes appendicitis, with its reason, unless overridden', () => {
    const answers = { rlq_pain: true, pain_migration: true, prior_appendicectomy: true };
    const ev = evaluate(v, rif.ids, { patient: man24, answers });
    expect(ev.ranked.some(r => r.id === 'appendicitis')).toBe(false);
    expect(ev.excluded.find(e => e.diseaseId === 'appendicitis')?.reason).toMatch(/appendicectomy/i);
    const overridden = evaluate(v, rif.ids, { patient: man24, answers, overrides: ['prior-appendicectomy'] });
    expect(overridden.ranked.some(r => r.id === 'appendicitis')).toBe(true);
    // Bayesian-only mode applies no exclusion.
    expect(evaluate(v, rif.ids, { patient: man24, answers, hybrid: false }).ranked.some(r => r.id === 'appendicitis')).toBe(true);
  });

  it('a man is never a candidate for ectopic pregnancy', () => {
    const lower = seedCandidates(v, { complaint: 'Lower abdominal pain', patient: man24 });
    expect(lower.ids).not.toContain('ectopic_pregnancy');
    const ev = evaluate(v, ['ectopic_pregnancy', 'appendicitis'], { patient: man24, answers: {} });
    expect(ev.ranked.map(r => r.id)).toEqual(['appendicitis']);
  });

  it('met Atlanta criteria set a floor and a label; Bayesian-only mode does not', () => {
    const cand = seedCandidates(v, { complaint: 'Epigastric pain', patient: woman50 });
    const answers = { epigastric_pain: true, radiation_to_back: true, elevated_amylase: true, lipase_raised: true };
    const hybrid = evaluate(v, cand.ids, { patient: woman50, answers });
    const pan = hybrid.ranked.find(r => r.id === 'pancreatitis')!;
    expect(pan.criteriaLabels.join(' ')).toMatch(/Atlanta/);
    expect(pan.effective).toBeGreaterThanOrEqual(v.policy.criteriaFloors.suspected);
    const bayes = evaluate(v, cand.ids, { patient: woman50, answers, hybrid: false }).ranked.find(r => r.id === 'pancreatitis')!;
    expect(bayes.floor).toBe(0);
    expect(bayes.criteriaLabels).toEqual([]);
  });

  it('a definitive histology is a confirmatory finding and a final-diagnosis prompt, never a written diagnosis', () => {
    const cand = seedCandidates(v, { entryFindings: ['histology_adenoma_dysplasia'], patient: woman50 });
    expect(cand.ids).toContain('colorectal_adenoma');
    const ev = evaluate(v, cand.ids, { patient: woman50, answers: { histology_adenoma_dysplasia: true } });
    expect(ev.ranked[0]!.id).toBe('colorectal_adenoma');
    expect(ev.ranked[0]!.confirmatory.join(' ')).toMatch(/Confirmatory finding/);
    expect(ev.finalDiagnosisPrompts).toEqual([expect.objectContaining({ finalIcd10: 'D12.6', sourceType: 'histology' })]);
    expect(ev.incidental.map(w => w.diseaseId)).toContain('colorectal_adenoma');
  });

  it('an NG12 referral criterion sets the test band without moving the rank', () => {
    const cand = seedCandidates(v, { complaint: 'Cough', patient: { age: 64, sex: 'male' } });
    const ev = evaluate(v, cand.ids, { patient: { age: 64, sex: 'male' }, answers: { cough: true, cxr_mass: true, smoker: true } });
    const lung = ev.ranked.find(r => r.id === 'lung_cancer')!;
    expect(lung.referralFloor).toBe(v.policy.criteriaFloors.referral);
    expect(lung.floor).toBe(0);
    expect(lung.band).not.toBe('observe');
  });
});

describe('plausibility gate (synthetic area)', () => {
  const disease = (id: string, links: VademecumDisease['findings']['history'], criteria: VademecumDisease['criteria'] = []): VademecumDisease => ({
    id, label: id, icd10: 'R10.4', pane: null, ios: null, prevalenceTier: 'common', cantMiss: false, urgency: 'routine', course: 'acute',
    seedFromComplaint: true, findings: { history: links, exam: [], score: [], investigation: [] }, criteria, pathognomonic: [], exclusions: [],
    workupWhenIncidental: null, source: 'test', signOff: 'pending',
  });
  const link = (finding: string, lr: number) => ({
    finding, lrPositive: { point: lr }, lrNegative: null, negativeMeaningful: false, seed: 'new' as const, source: 'test', fromMemory: true,
  });
  const area = (lrB: number): VademecumAreaFile => ({
    id: 'vademecum-test', version: '0.0.1', title: 't', updated: '2026-09-26', lastReviewed: 'unknown', reviewer: 'unknown', status: 'shadow',
    area: 'test', setting: 't', complaints: { frames: [], keywords: ['test'] }, related: [],
    diseases: [
      disease('a', [], [{ id: 'crit', name: 'Test criteria', kind: 'diagnostic', source: 'test', fromMemory: true,
        levels: [{ id: 'def', label: 'fever', grade: 'definite', when: { op: 'finding', finding: 'fever' } }] }]),
      disease('b', [link('rlq_pain', lrB)]),
    ],
  });

  it('below the gate the floor is not applied and the criteria are a conflict', () => {
    const t = loadVademecum(VADEMECUM_FINDINGS, [area(100)]);
    const ev = evaluate(t, ['a', 'b'], { patient: woman50, answers: { fever: true, rlq_pain: true } });
    const a = ev.ranked.find(r => r.id === 'a')!;
    expect(a.probability).toBeLessThan(t.policy.criteriaMinPosterior);
    expect(a.floor).toBe(0);
    expect(ev.ranked[0]!.id).toBe('b');
    expect(ev.conflicts[0]).toEqual(expect.objectContaining({ diseaseId: 'a', kind: 'criteria-met-low-posterior' }));
    expect(ev.conflicts[0]!.detail).toMatch(/floor not applied/);
  });

  it('at or above the gate the definite floor applies', () => {
    const t = loadVademecum(VADEMECUM_FINDINGS, [area(5)]);
    const ev = evaluate(t, ['a', 'b'], { patient: woman50, answers: { fever: true, rlq_pain: true } });
    expect(ev.ranked[0]!.id).toBe('a');
    expect(ev.ranked[0]!.effective).toBe(t.policy.criteriaFloors.definite);
  });
});

describe('any entry point', () => {
  it('a raised lipase seeds pancreatitis and its can\'t-miss mimics without a complaint', () => {
    const cand = seedCandidates(v, { entryFindings: ['lipase_raised'], patient: woman50 });
    expect(cand.ids).toContain('pancreatitis');
    expect(cand.seededBy['pancreatitis']!.join(' ')).toMatch(/^entry: lipase_raised/);
    expect(cand.ids).toContain('mesenteric_ischaemia');
    expect(cand.areas).toEqual(['abdominal-pain']);
  });

  it('structured labs become findings through the reference-range classifier (absent when measured and below)', () => {
    const classify = (_: string, __: number) => ({ flag: 'high' as const, uln: 60 });
    const out = findingsFromLabs(v, [{ analyte: 'Lipase', value: 820, unit: 'U/L' }], classify);
    expect(out.lipase_raised).toBe(true);
    expect(out.elevated_amylase).toBe(true);
    const low = findingsFromLabs(v, [{ analyte: 'Lipase', value: 90, unit: 'U/L' }], classify);
    expect(low.elevated_amylase).toBe(false);
  });

  it('report text is read negation-aware; recorded scores become rule bands', () => {
    const match: TextMatcher = (text, term) => {
      const t = text.toLowerCase();
      if (!t.includes(term)) return null;
      return t.includes(`no ${term}`) ? 'negated' : 'affirmed';
    };
    expect(findingsFromText(v, 'Free gas under the diaphragm.', match, { levels: ['investigation'] }).free_gas).toBe(true);
    expect(findingsFromText(v, 'No free gas.', match, { levels: ['investigation'] }).free_gas).toBe(false);
    const bands = findingsFromScores(v, { alvarado: 9 });
    expect(Object.values(bands).filter(Boolean)).toHaveLength(1);
  });
});

describe('question picker, generators and stopping', () => {
  const cand = seedCandidates(v, { complaint: 'Right iliac fossa pain', frames: ['pain.abdomen'], patient: man24 });
  const input = { patient: man24, answers: { rlq_pain: true, pain_migration: true } };

  it('asks an unanswered finding of the current level', () => {
    const q = bestQuestion(v, cand.ids, input, 'history');
    expect(q).not.toBeNull();
    expect(v.findings.get(q!.id)?.level ?? 'score').toBe('history');
    expect(input.answers).not.toHaveProperty(q!.id);
  });

  it('generators return history chips by dimension, exam signs and investigations', () => {
    const h = generateHistoryQuestions(v, cand.ids, input);
    expect(h.length).toBeGreaterThan(0);
    expect(h.every(g => g.chips.length > 0)).toBe(true);
    expect(generateExamSigns(v, cand.ids, input).length).toBeGreaterThan(0);
    expect(generateInvestigations(v, cand.ids, input).some(i => i.confirmatory)).toBe(true);
  });

  it('stops at the treat threshold on a classic appendicitis', () => {
    const truth: Record<string, boolean> = {
      rlq_pain: true, pain_migration: true, nausea_vomiting: true, fever: true, anorexia: true, 'sign.mcburney': true,
      'sign.rebound': true, elevated_wbc: true, imaging_appendicitis: true,
    };
    const run = runLoop(v, cand, { patient: man24, answers: {} }, q => (q.kind === 'finding' ? truth[q.id] ?? false : undefined));
    expect(run.stop).toBe('treat-threshold');
    expect(run.final.ranked[0]!.id).toBe('appendicitis');
    expect(run.steps.length).toBeLessThanOrEqual(v.policy.maxQuestions);
  });
});

describe('deciding tests: a can\'t-miss diagnosis settled by a later test does not hold history', () => {
  const woman60: PatientInfo = { age: 60, sex: 'female' };
  const cand = seedCandidates(v, { complaint: 'Right upper quadrant pain', frames: ['pain.abdomen'], patient: woman60 });
  const history = { ruq_pain: true, fatty_food_trigger: true, fever: true, nausea_vomiting: true };

  it('gallbladder carcinoma is decided by an investigation-level finding', () => {
    const tests = decidingFindings(v, 'gallbladder_carcinoma');
    expect(tests.length).toBeGreaterThan(0);
    expect(tests.some(t => t.level === 'investigation')).toBe(true);
  });

  it('an open can\'t-miss with only later deciding tests is deferred at history, not at investigation', () => {
    const ev = evaluate(v, cand.ids, { patient: woman60, answers: history });
    const open = ev.ranked.filter(r => r !== ev.ranked[0] && r.cantMiss && r.band !== 'observe').map(r => r.id);
    const atHistory = deferredCantMiss(v, ev, 'history', ev.answers);
    for (const id of atHistory) expect(open).toContain(id);
    for (const id of atHistory) {
      expect(decidingFindings(v, id).some(f => f.level === 'investigation' || f.level === 'score')).toBe(true);
    }
    expect(deferredCantMiss(v, ev, 'investigation', ev.answers).size).toBe(0);
  });

  it('when the deciding test is not available the loop stops and names it, never dropping the diagnosis', () => {
    const run = runLoop(v, cand, { patient: woman60, answers: {} }, q => {
      if (q.kind !== 'finding') return undefined;
      const level = v.findings.get(q.id)?.level;
      if (level === 'investigation') return undefined; // not in the record: must be ordered
      return (history as Record<string, boolean>)[q.id] ?? (q.id === 'sign.murphy' ? true : false);
    });
    if (run.stop === 'treat-threshold-workup') {
      expect(run.pendingWorkup!.length).toBeGreaterThan(0);
      for (const p of run.pendingWorkup!) {
        expect(run.final.ranked.find(r => r.id === p.diseaseId)?.band).not.toBe('observe');
        expect(p.tests.length).toBeGreaterThan(0);
        expect(p.tests.every(t => t.level === 'score' || t.level === 'investigation')).toBe(true);
      }
    }
    expect(run.steps.length).toBeLessThanOrEqual(v.policy.maxQuestions);
  });
});
