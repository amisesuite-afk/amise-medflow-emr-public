/**
 * Clinical validation — web harness tests (run by `pnpm -r run test` in CI).
 *
 * Policy (same as the iOS ClinicalValidationTests): a critical expectation that fails without a
 * knownGap/unverified flag for web fails this suite; quality failures are only reported.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { counts, matchesAny, normalise } from './grade';
import { loadVignettes, REPO_ROOT } from './load';
import { runAllWeb } from './web-suite';

describe('vignettes', () => {
  it('load and pass structural validation', () => {
    const { vignettes, errors } = loadVignettes();
    expect(errors).toEqual([]);
    expect(vignettes.length).toBeGreaterThan(0);
  });
});

// The same vectors are asserted in ios/AmiseMedFlowTests/ClinicalValidation/ClinValGraderTests.swift.
// Change both together: they pin the grading rules shared by the two harnesses.
describe('grading rules (mirrored in Swift)', () => {
  it('normalises case, quotes, dashes and whitespace', () => {
    expect(normalise('  Murphy’s   Sign – POSITIVE ')).toBe("murphy's sign - positive");
  });
  it('matches substrings, regexes and ICD prefixes', () => {
    expect(matchesAny('Laparoscopic Appendicectomy (preferred)', ['re:laparoscopic append(ic)?ectomy'])).toBe(true);
    expect(matchesAny('CT Abdomen / Pelvis (with contrast)', ['re:\\bct\\b[^.;\\n]{0,40}(abdo|pelvi)'])).toBe(true);
    expect(matchesAny('Acute Cholecystitis', ['icd:K81'], 'K81.0')).toBe(true);
    expect(matchesAny('Acute Cholecystitis', ['icd:K80'], 'K81.0')).toBe(false);
    expect(matchesAny('Early cholecystectomy (Grade I–II Tokyo)', ['grade i-ii'])).toBe(true);
  });
  it('applies unless-alternatives', () => {
    expect(counts('Percutaneous cholecystostomy if high surgical risk', ['cholecystostomy'], ['high surgical risk'])).toBe(false);
    expect(counts('Percutaneous cholecystostomy', ['cholecystostomy'], ['high surgical risk'])).toBe(true);
  });
});

describe('web engines against the vignettes', () => {
  const { results, errors, vignettes } = runAllWeb('2026-01-01T00:00:00.000Z');

  it('run every vignette without errors', () => {
    expect(errors).toEqual([]);
    expect(results.length).toBe(vignettes.length);
  });

  it('have no unflagged critical failures', () => {
    const blocking = results.flatMap(r => r.expectations
      .filter(e => e.blocking)
      .map(e => `${r.vignetteId}/${e.id}: ${e.detail}`));
    expect(blocking).toEqual([]);
  });
});

/**
 * The iOS runner mirrors ConsultationView's call sites (it cannot drive SwiftUI state). This
 * check fails when the consultation's BayesianDiagnosisEngine.infer calls change their arguments,
 * so the mirror in ClinValIOSRunner.swift is updated in the same PR.
 */
describe('iOS harness mirror', () => {
  const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');
  function inferCalls(src: string): string[][] {
    const calls: string[][] = [];
    let from = 0;
    for (;;) {
      const start = src.indexOf('BayesianDiagnosisEngine.infer(', from);
      if (start < 0) break;
      let depth = 0;
      let end = start;
      for (let i = src.indexOf('(', start); i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = src.slice(src.indexOf('(', start) + 1, end);
      calls.push([...body.matchAll(/(?:^|,)\s*([a-zA-Z0-9]+):/gm)].map(m => m[1]));
      from = end;
    }
    return calls;
  }

  it('ClinValIOSRunner passes the same infer arguments as the consultation', () => {
    const view = inferCalls(read('ios/AmiseMedFlow/Views/Consultation/ConsultationView.swift'));
    const tab = inferCalls(read('ios/AmiseMedFlow/Views/Consultation/ConsultationView+DiagnosisTab.swift'));
    const runner = inferCalls(read('ios/AmiseMedFlowTests/ClinicalValidation/ClinValIOSRunner.swift'));
    expect(view.length).toBe(1);
    expect(tab.length).toBe(1);
    expect(runner.length).toBe(2);
    expect(runner[0]).toEqual(view[0]);   // handleChiefComplaintChange (early differential)
    expect(runner[1]).toEqual(tab[0]);    // refreshBayesian
  });
});
