/**
 * Vademecum phase 1 (shadow): the content passes lint:vademecum, the lint catches broken
 * references, the final-diagnosis prompt is a valid outcomes-loop record, and the clinval shadow
 * reads a vignette record the documented way (negation-aware text, reference ranges, reports).
 */
import { describe, expect, it } from 'vitest';
import { bundledVademecum, evaluate, seedCandidates } from '../../lib/pane-engine/src/vademecum-loop/index';
import { sanitizeFinalDiagnosis } from '../../lib/triage-engine/src/outcomes/index';
import { REPO_ROOT, loadVignettes } from './clinval/load';
import { runVademecumShadow, shadowVignette, textMatcher, vignetteEvidence } from './clinval/vademecum-shadow';
import { checkVademecum, readVademecum } from './vademecum';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('vademecum content', () => {
  it('passes lint:vademecum', () => {
    const { problems, stats } = checkVademecum(readVademecum(REPO_ROOT), REPO_ROOT);
    expect(problems).toEqual([]);
    expect(stats.diseases).toBeGreaterThan(100);
    expect(stats.fromMemory).toBe(stats.links);
  });

  it('fails on a broken finding, a pathognomonic entry with no ratio, or a review date', () => {
    const files = readVademecum(REPO_ROOT);
    const bad = clone(files);
    const d = bad.areas[0]!.diseases[0]!;
    d.findings.history.push({ ...d.findings.history[0]!, finding: 'no_such_finding' });
    d.pathognomonic.push({ finding: 'fever', lrPositive: null, definitive: false, label: 'x', source: 'x', fromMemory: true });
    bad.areas[0]!.lastReviewed = '2026-09-26';
    const { problems } = checkVademecum(bad, REPO_ROOT);
    expect(problems.some(p => p.includes('no_such_finding'))).toBe(true);
    expect(problems.some(p => p.includes('either definitive'))).toBe(true);
    expect(problems.some(p => /lastReviewed|reviewed/i.test(p))).toBe(true);
  });
});

describe('outcomes loop hand-off', () => {
  it('a pathology final-diagnosis prompt is a valid FinalDiagnosis once the clinician confirms it', () => {
    const v = bundledVademecum();
    const patient = { age: 58, sex: 'male' as const };
    const cand = seedCandidates(v, { entryFindings: ['histology_adenoma_dysplasia'], patient });
    const [prompt] = evaluate(v, cand.ids, { patient, answers: { histology_adenoma_dysplasia: true } }).finalDiagnosisPrompts;
    expect(prompt).toBeDefined();
    const r = sanitizeFinalDiagnosis({
      encounterRef: 'web:enc-1', finalIcd10: prompt!.finalIcd10, finalDiseaseId: prompt!.finalDiseaseId,
      sourceType: prompt!.sourceType, sourceDate: '2026-09-26', actionsTaken: [], retrospectiveAcuity: null, status: 'confirmed',
    });
    expect(r.ok).toBe(true);
  });
});

describe('clinval vademecum shadow', () => {
  const { vignettes } = loadVignettes();
  const byId = (id: string) => vignettes.find(l => l.vignette.id === id)!.vignette;
  const v = bundledVademecum();

  it('reads text negation-aware (short terms as whole words)', () => {
    expect(textMatcher('No free gas under the diaphragm.', 'free gas')).toBe('negated');
    expect(textMatcher('Free gas under the diaphragm.', 'free gas')).toBe('affirmed');
    expect(textMatcher('Patient is sober.', 'sob')).toBeNull();
    expect(textMatcher('Nothing relevant.', 'free gas')).toBeNull();
  });

  it('reads previous operations from the surgical history only', () => {
    const ev = vignetteEvidence(v, byId('periop-preop-asa1-lap-chole'), 'web');
    expect(ev.answers.prior_cholecystectomy).not.toBe(true);
  });

  it('reads labs through the reference ranges and reports by kind', () => {
    const ev = vignetteEvidence(v, byId('entry-lab-raised-lipase-vague-epigastric'), 'ios');
    expect(ev.answers.lipase_raised).toBe(true);
    expect(ev.answers.elevated_amylase).toBe(true);
    const path = vignetteEvidence(v, byId('entry-pathology-adenoma-histology'), 'ios');
    expect(path.answers.histology_adenoma_dysplasia).toBe(true);
  });

  it('an entry-point vignette is a pilot row with its entry type', () => {
    const row = shadowVignette(v, byId('entry-lab-raised-d-dimer'), new Map(), false)!;
    expect(row.entry).toBe('lab');
    expect(row.area).toBe('cough-breathlessness');
    expect(row.engines['vademecum.web']!.targetRank).toBe(1);
  });

  it('runs on a subset without questions', () => {
    const { file, errors } = runVademecumShadow({ withQuestions: false, only: id => id.startsWith('entry-') });
    expect(errors).toEqual([]);
    expect(file.rows.map(r => r.entry).sort()).toEqual(['imaging', 'imaging', 'lab', 'lab', 'pathology']);
    expect(file.groups['entry:lab']?.['vademecum.web']?.n).toBe(2);
  });
});
