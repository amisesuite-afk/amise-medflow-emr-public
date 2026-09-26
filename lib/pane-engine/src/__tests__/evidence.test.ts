import { describe, expect, it } from 'vitest';
import {
  DISEASES, FEATURES, DECISION_RULES, EXAM_SIGNS, applyRecordedEvidence, baseRate, ruleBandFor, decisionRule, engineBands,
  evidenceItems, featureLikelihood, initPaneState, relevantRules, relevantSigns, ruleFeatureId, sensSpec, signFeatureId,
  targetGroup, updatePosterior, MAX_SECOND_TARGET_SENSITIVITY,
} from '../index.js';
import type { DiseaseNode, PaneState } from '../index.js';

const byId = new Map(DISEASES.map(d => [d.id, d]));
const featureIds = new Set(FEATURES.map(f => f.id));
const d = (id: string): DiseaseNode => byId.get(id)!;

function run(features: Record<string, boolean>, diseases = DISEASES): PaneState {
  let s = initPaneState(diseases);
  for (const [f, v] of Object.entries(features)) s = updatePosterior(s, diseases, f, v);
  return s;
}

describe('evidence catalogues', () => {
  it('every target group names registered PANE diseases', () => {
    for (const [id, g] of Object.entries(EXAM_SIGNS.targetGroups)) {
      for (const p of g.pane) expect(byId.has(p), `${id}: ${p}`).toBe(true);
    }
    for (const r of DECISION_RULES.rules) for (const p of r.target.pane) expect(byId.has(p), `${r.id}: ${p}`).toBe(true);
  });

  it('signs reference known groups, presentations and features', () => {
    const tags = new Set(Object.keys(EXAM_SIGNS.presentations));
    const ids = new Set<string>();
    for (const s of EXAM_SIGNS.signs) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      expect(targetGroup(s.target.group), `${s.id} group`).toBeDefined();
      for (const a of s.alsoTargets ?? []) expect(targetGroup(a.group), `${s.id} alsoTarget`).toBeDefined();
      for (const t of s.presentations) expect(tags.has(t), `${s.id}: ${t}`).toBe(true);
      for (const f of [...s.supersedes, ...(s.twins?.present ?? []), ...(s.twins?.absent ?? [])]) expect(featureIds.has(f), `${s.id}: ${f}`).toBe(true);
      if (s.target.paneFeature) expect(featureIds.has(s.target.paneFeature)).toBe(true);
      if (s.engine === 'lr') {
        expect(s.lrPositive && s.lrNegative, `${s.id} needs both LRs`).toBeTruthy();
        expect(s.lrPositive!.point).toBeGreaterThan(1);
        expect(s.lrNegative!.point).toBeLessThan(1);
      }
      // "LR- near 1 means don't": absence is meaningful only with LR- at most 0.6.
      if (s.negativeMeaningful) expect(s.lrNegative!.point, s.id).toBeLessThanOrEqual(0.6);
      expect(s.fromMemory, `${s.id}: unverified values stay fromMemory`).toBe(true);
    }
  });

  it('a superseded twin is never lost for a diagnosis that relies on it (listed above 0.3)', () => {
    for (const s of EXAM_SIGNS.signs.filter(x => x.engine === 'lr')) {
      const targets = new Set([s.target.group, ...(s.alsoTargets ?? []).map(a => a.group)].flatMap(g => targetGroup(g)!.pane));
      for (const twin of s.supersedes) {
        for (const dis of DISEASES) {
          const p = dis.features[twin];
          if (typeof p === 'number' && p > 0.3) expect(targets.has(dis.id), `${s.id} supersedes ${twin} of ${dis.id}`).toBe(true);
        }
      }
    }
  });

  it('rules reference known signs, features and rules; bands are ordered and cover their range', () => {
    const signIds = new Set(EXAM_SIGNS.signs.map(s => s.id));
    const tags = new Set(Object.keys(EXAM_SIGNS.presentations));
    for (const r of DECISION_RULES.rules) {
      for (const s of r.components.signs) expect(signIds.has(s), `${r.id}: ${s}`).toBe(true);
      for (const f of r.components.paneFeatures) expect(featureIds.has(f), `${r.id}: ${f}`).toBe(true);
      for (const x of r.supersededBy) expect(decisionRule(x), `${r.id}: ${x}`).toBeDefined();
      if (r.appliesWhen) expect(decisionRule(r.appliesWhen.rule)).toBeDefined();
      for (const t of r.presentations) expect(tags.has(t), `${r.id}: ${t}`).toBe(true);
      for (const b of r.bands) expect(b.risk || b.lr, `${r.id}/${b.id} needs a risk or a likelihood ratio`).toBeTruthy();
      expect(r.fromMemory).toBe(true);
    }
  });

  it('second targets never hit the sensitivity cap (their likelihood ratio is as written)', () => {
    for (const s of EXAM_SIGNS.signs) {
      if (!s.alsoTargets?.length || s.engine !== 'lr') continue;
      const { specificity } = sensSpec(s.lrPositive!.point, s.lrNegative!.point);
      for (const a of s.alsoTargets) expect(a.lrPositive.point * (1 - specificity), s.id).toBeLessThanOrEqual(MAX_SECOND_TARGET_SENSITIVITY);
    }
  });
});

describe('sign features carry the catalogue likelihood ratios', () => {
  it('sensSpec inverts LR+ and LR-', () => {
    const { sensitivity, specificity } = sensSpec(2.8, 0.5);
    expect(sensitivity / (1 - specificity)).toBeCloseTo(2.8, 6);
    expect((1 - sensitivity) / specificity).toBeCloseTo(0.5, 6);
  });

  it("Murphy's sign: LR+ 2.8 and LR- 0.5 for cholecystitis against any other diagnosis", () => {
    const f = signFeatureId('murphy');
    const b = baseRate(f);
    const p = featureLikelihood(d('cholecystitis'), f);
    expect(p / b).toBeCloseTo(2.8, 2);
    expect((1 - p) / (1 - b)).toBeCloseTo(0.5, 2);
    expect(featureLikelihood(d('biliary_colic'), f)).toBeCloseTo(b, 6);
  });

  it('a finding-level sign weighs the causes of the finding (shifting dullness → ascites)', () => {
    const f = signFeatureId('shifting_dullness');
    const cirr = featureLikelihood(d('cirrhosis'), f) / baseRate(f);
    const ac = featureLikelihood(d('appendicitis'), f) / baseRate(f);
    expect(cirr).toBeGreaterThan(1.3);
    expect(ac).toBeCloseTo(1, 1);
  });

  it('a recorded sign is applied once however often it is supplied', () => {
    const once = run({ ruq_pain: true, [signFeatureId('murphy')]: true });
    let twice = updatePosterior(once, DISEASES, signFeatureId('murphy'), true);
    twice = updatePosterior(twice, DISEASES, signFeatureId('murphy'), true);
    expect(twice.posteriors.cholecystitis).toBeCloseTo(once.posteriors.cholecystitis, 12);
  });
});

describe('recorded evidence → features', () => {
  it('a chip supersedes its free-text twin and absence counts only when meaningful', () => {
    const out = applyRecordedEvidence({ ruq_pain: true, murphy_sign: true }, { signs: { murphy: 'present', rovsing: 'absent' }, ruleValues: {} });
    expect(out.murphy_sign).toBeUndefined();
    expect(out[signFeatureId('murphy')]).toBe(true);
    expect(signFeatureId('rovsing') in out).toBe(false);
    const absent = applyRecordedEvidence({}, { signs: { murphy: 'absent' }, ruleValues: {} });
    expect(absent[signFeatureId('murphy')]).toBe(false);
  });

  it('a red-flag (twin) sign records its engine feature when present and nothing when absent', () => {
    expect(applyRecordedEvidence({}, { signs: { neck_stiffness: 'present' }, ruleValues: {} })).toEqual({ neck_stiffness: true });
    expect(applyRecordedEvidence({}, { signs: { neck_stiffness: 'absent' }, ruleValues: {} })).toEqual({});
  });

  it('an irreducible hernia is recorded as irreducible', () => {
    const out = applyRecordedEvidence({ groin_swelling: true }, { signs: { reducible: 'absent' }, ruleValues: {} });
    expect(out.hernia_irreducible).toBe(true);
    expect(signFeatureId('reducible') in out).toBe(false);
  });

  it('paediatric signs apply only in the age range studied', () => {
    expect(applyRecordedEvidence({}, { signs: { crt_child: 'present' }, ruleValues: {}, ageYears: 40 })).toEqual({});
    expect(applyRecordedEvidence({}, { signs: { crt_child: 'present' }, ruleValues: {}, ageYears: 2 })[signFeatureId('crt_child')]).toBe(true);
  });

  it('rules: band by value; AIR supersedes Alvarado; PERC only with Wells PE ≤ 4; LRINEC low band not applied', () => {
    const both = applyRecordedEvidence({}, { signs: {}, ruleValues: { alvarado: 8, air: 10 } });
    expect(both[ruleFeatureId('air', 'high')]).toBe(true);
    expect(Object.keys(both).some(k => k.startsWith('rule_alvarado'))).toBe(false);
    expect(applyRecordedEvidence({}, { signs: {}, ruleValues: { perc: 0, 'wells-pe': 6 } })[ruleFeatureId('perc', 'negative')]).toBeUndefined();
    expect(applyRecordedEvidence({}, { signs: {}, ruleValues: { perc: 0, 'wells-pe': 1.5 } })[ruleFeatureId('perc', 'negative')]).toBe(true);
    expect(applyRecordedEvidence({}, { signs: {}, ruleValues: { lrinec: 3 } })).toEqual({});
    expect(applyRecordedEvidence({}, { signs: {}, ruleValues: { curb65: 3 } })).toEqual({});
    expect(ruleBandFor(decisionRule('wells-pe')!, 4.5)!.id).toBe('likely');
    expect(ruleBandFor(decisionRule('centor')!, -1)!.id).toBe('low');
    expect(engineBands(decisionRule('lrinec')!).map(b => b.id)).toEqual(['high']);
  });

  it('evidence items explain each effect', () => {
    const items = evidenceItems({ signs: { murphy: 'present', kernig: 'present', rovsing: 'absent' }, ruleValues: { curb65: 2, 'ottawa-ankle': 0 } });
    const by = new Map(items.map(i => [i.id, i]));
    expect(by.get('murphy')!.effect).toBe('engine');
    expect(by.get('kernig')!.effect).toBe('display');
    expect(by.get('rovsing')!.effect).toBe('not-applied');
    expect(by.get('curb65')!.risk).toMatch(/9 %/);
    expect(by.get('ottawa-ankle')!.posttest).toBeLessThan(0.02);
  });
});

describe('a rule and its components count once', () => {
  const band = ruleFeatureId('alvarado', 'high');
  const sign = signFeatureId('mcburney');
  const order = (fs: [string, boolean][]) => {
    let s = initPaneState(DISEASES);
    for (const [f, v] of fs) s = updatePosterior(s, DISEASES, f, v);
    return s.posteriors.appendicitis;
  };

  it('is order-independent', () => {
    const a = order([['rlq_pain', true], ['pain_migration', true], [sign, true], [band, true]]);
    const b = order([[band, true], [sign, true], ['pain_migration', true], ['rlq_pain', true]]);
    const c = order([[sign, true], [band, true], ['rlq_pain', true], ['pain_migration', true]]);
    expect(b).toBeCloseTo(a, 10);
    expect(c).toBeCloseTo(a, 10);
  });

  it('the rule supersedes its component sign for its target', () => {
    const withSign = order([['rlq_pain', true], [band, true], [sign, true]]);
    const without = order([['rlq_pain', true], [band, true]]);
    expect(withSign).toBeCloseTo(without, 6);
  });

  it('a positive band adds only what its component findings have not already given', () => {
    const comps = order([['rlq_pain', true], ['pain_migration', true], ['anorexia', true], ['fever', true]]);
    const compsBand = order([['rlq_pain', true], ['pain_migration', true], ['anorexia', true], ['fever', true], [band, true]]);
    expect(compsBand).toBeCloseTo(comps, 6);
    const bare = order([['rlq_pain', true]]);
    const bareBand = order([['rlq_pain', true], [band, true]]);
    expect(bareBand).toBeGreaterThan(bare);
  });

  it('a low band lowers the target', () => {
    const low = ruleFeatureId('alvarado', 'low');
    expect(order([['rlq_pain', true], [low, true]])).toBeLessThan(order([['rlq_pain', true]]));
  });
});

describe('relevance', () => {
  it('offers the complaint signs and the rule for right iliac fossa pain', () => {
    const signs = relevantSigns({ text: 'Right iliac fossa pain for 18 hours', ageYears: 24 }).map(r => r.sign.id);
    expect(signs).toEqual(expect.arrayContaining(['mcburney', 'rovsing', 'psoas', 'rebound']));
    expect(signs).not.toContain('crt_child');
    const rules = relevantRules({ text: 'Right iliac fossa pain', differential: ['appendicitis'] }).map(r => r.rule.id);
    expect(rules).toEqual(expect.arrayContaining(['alvarado', 'air']));
  });

  it('puts signs for the current differential first', () => {
    const r = relevantSigns({ text: 'abdominal pain', differential: ['cholecystitis', 'appendicitis'] });
    expect(r[0].inDifferential).toBe(true);
  });
});
