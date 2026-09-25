/** Clinical validation — run every vignette through the web engines (no side effects). */

import { addSummaries, buildResult } from './grade';
import { loadVignettes } from './load';
import { runWeb } from './web-runner';
import type { ClinvalResult, Vignette, WebResultsFile } from './types';

export const HARNESS_VERSION = 'clinval-web/1';

export function runAllWeb(generatedAt = new Date().toISOString()): {
  vignettes: Vignette[]; results: ClinvalResult[]; errors: string[]; file: WebResultsFile;
} {
  const { vignettes, errors } = loadVignettes();
  const vs = vignettes.map(l => l.vignette);
  const results: ClinvalResult[] = [];
  for (const v of vs) {
    try {
      results.push(buildResult(v, 'web', runWeb(v), generatedAt));
    } catch (x) {
      errors.push(`${v.id}: web runner threw: ${x instanceof Error ? x.stack ?? x.message : String(x)}`);
    }
  }
  const file: WebResultsFile = {
    type: 'clinval-web-results',
    generatedAt,
    harness: HARNESS_VERSION,
    vignetteCount: vs.length,
    results,
    totals: addSummaries(results.map(r => r.summary)),
  };
  return { vignettes: vs, results, errors, file };
}
