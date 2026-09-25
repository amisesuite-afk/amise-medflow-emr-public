/**
 * PANE differential — per-category top-3 ratchet (pane model 1.0.0).
 *
 * For every vignette category, the number of PANE differential expectations (mustRankTopK /
 * mustNotMiss on web.pane, i.e. the correct diagnosis in the PANE top 3) that pass must not fall
 * below the floor recorded here. The floors are the counts reached when the neutral model landed
 * (2026-09-25); the pre-1.0.0 counts are kept alongside for reference. Raise a floor when the
 * model improves; never lower one to make a change pass — fix the model or explain the loss in
 * the change log and get sign-off.
 */

import { describe, expect, it } from 'vitest';
import { runAllWeb } from './web-suite';
import type { DxExpectation } from './types';

/** category → [pre-1.0.0 passes, floor now, expectations in the category] */
const FLOORS: Record<string, [number, number, number]> = {
  'anorectal':        [9, 14, 19],
  'breast-endocrine': [5, 17, 17],
  'colorectal':       [14, 23, 25],
  'general-medicine': [4, 54, 57],
  'gi-emergency':     [22, 32, 39],
  'hernia':           [6, 19, 20],
  'hpb':              [36, 42, 46],
  'other':            [7, 31, 31],
  'soft-tissue':      [5, 17, 19],
  'trauma-burns':     [6, 11, 13],
  'upper-gi':         [10, 33, 35],
  'urology':          [5, 14, 15],
  'vascular':         [5, 17, 17],
};

describe('PANE top-3 by vignette category', () => {
  const { vignettes, results } = runAllWeb('2026-01-01T00:00:00.000Z');
  const byId = new Map(vignettes.map(v => [v.id, v]));
  const pass: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const r of results) {
    const v = byId.get(r.vignetteId)!;
    const dx = v.expected.differential ?? {};
    const exps = new Map<string, DxExpectation>([...(dx.mustRankTopK ?? []), ...(dx.mustNotMiss ?? [])].map(e => [e.id, e]));
    for (const er of r.expectations) {
      const e = exps.get(er.id);
      if (!e || (e.source ?? 'web.pane') !== 'web.pane') continue;
      if (e.platforms && !e.platforms.includes('web')) continue;
      total[v.category] = (total[v.category] ?? 0) + 1;
      if (er.status === 'pass') pass[v.category] = (pass[v.category] ?? 0) + 1;
    }
  }

  for (const [category, [before, floor]] of Object.entries(FLOORS)) {
    it(`${category}: at least ${floor} correct in the PANE top 3 (was ${before} before model 1.0.0)`, () => {
      expect(pass[category] ?? 0).toBeGreaterThanOrEqual(floor);
    });
  }

  it('every category with PANE expectations has a floor', () => {
    expect(Object.keys(total).filter(c => !(c in FLOORS))).toEqual([]);
  });
});
