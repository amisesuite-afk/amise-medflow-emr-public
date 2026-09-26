/**
 * Clinical validation — web harness CLI (the fast local loop).
 *
 *   pnpm --filter @workspace/scripts run clinval:web
 *   pnpm --filter @workspace/scripts run clinval:web -- --engine vademecum   (phase-1 shadow)
 *
 * Writes docs/clinical-validation/results/web-latest.json and web-latest.md, prints a summary,
 * and exits 1 when a critical expectation fails without a knownGap/unverified flag (2 when a
 * vignette is malformed).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './load';
import { renderReport } from './render';
import type { SourcedText, WebResultsFile } from './types';
import { runAllWeb } from './web-suite';
import { ENGINES, renderShadow, runVademecumShadow } from './vademecum-shadow';

const RESULTS_DIR = join(REPO_ROOT, 'docs', 'clinical-validation', 'results');
const MAX_TEXT = 400;

/** The committed JSON keeps output texts short (grading already ran on the full text). */
function compact(file: WebResultsFile): WebResultsFile {
  const cut = (t: string) => (t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 14)} …(truncated)` : t);
  const cutList = (l: SourcedText[]) => l.map(x => ({ ...x, text: cut(x.text) }));
  return {
    ...file,
    results: file.results.map(r => ({
      ...r,
      outputs: {
        ...r.outputs,
        redFlags: cutList(r.outputs.redFlags),
        investigations: cutList(r.outputs.investigations),
        management: cutList(r.outputs.management),
        alarms: r.outputs.alarms.map(a => ({ ...a, detail: cut(a.detail) })),
      },
    })),
  };
}

/**
 * `--engine vademecum`: the phase-1 vademecum shadow (vademecum-shadow.ts) on the pilot-area
 * vignettes, beside PANE and the iOS results. Writes vademecum-shadow-latest.{json,md} (not
 * committed) and never blocks. `--no-questions` skips the simulated consultations (faster).
 */
function mainVademecum(args: string[]): void {
  const { file, errors } = runVademecumShadow({ withQuestions: !args.includes('--no-questions') });
  if (errors.length) {
    console.error('Vademecum shadow errors:');
    for (const e of errors) console.error(`  - ${e}`);
  }
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, 'vademecum-shadow-latest.json'), `${JSON.stringify(file, null, 2)}\n`);
  writeFileSync(join(RESULTS_DIR, 'vademecum-shadow-latest.md'), renderShadow(file));
  console.log(`CLINVAL vademecum shadow: ${file.rows.length} pilot vignettes (vademecum ${file.vademecumVersion})`);
  for (const [key, g] of Object.entries(file.groups)) {
    const parts = ENGINES.filter(e => g[e]).map(e => {
      const a = g[e]!;
      return `${e} top1 ${a.top1}/${a.nTarget} top3 ${a.top3} top5 ${a.top5} cm ${a.cantMissCaptured}/${a.cantMissTotal}`;
    });
    const q = g.questions;
    console.log(`  ${key}: ${parts.join(' · ')}${q ? ` · questions vademecum ${q.vademecumMean} (median ${q.vademecumMedian}) vs PANE ${q.paneMean} (median ${q.paneMedian})` : ''}`);
  }
  console.log(`  lost can't-miss: ${file.lostCantMiss.length}; hybrid changed the answer in ${file.rows.filter(r => r.hybridChanges.length).length}`);
  console.log('Wrote docs/clinical-validation/results/vademecum-shadow-latest.json and .md (shadow; do not commit)');
  if (errors.length) process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  const ei = args.indexOf('--engine');
  const engine = ei >= 0 ? args[ei + 1] : undefined;
  if (engine === 'vademecum') return mainVademecum(args);
  if (engine !== undefined && engine !== 'current') {
    console.error(`Unknown --engine '${engine}' (current | vademecum)`);
    process.exit(2);
  }
  const { vignettes, results, errors, file } = runAllWeb();
  if (errors.length) {
    console.error('Vignette errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(2);
  }
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, 'web-latest.json'), `${JSON.stringify(compact(file), null, 2)}\n`);
  writeFileSync(join(RESULTS_DIR, 'web-latest.md'), renderReport(vignettes, results, {
    title: 'Clinical validation — web engines (latest local run)',
    generatedAt: file.generatedAt,
    platforms: ['web'],
    sourcesNote: [`Harness ${file.harness}; ${file.vignetteCount} vignettes from ios/AmiseMedFlowTests/ClinicalValidation/Vignettes/.`],
    includeOutputs: true,
  }));

  const t = file.totals;
  console.log(`CLINVAL web: ${results.length} vignettes, ${t.total} expectations — ${t.pass} pass, ${t.fail} fail, ${t.na} n/a`);
  console.log(`  critical fail ${t.criticalFail} (blocking ${t.blocking}, known gap ${t.knownGapFail}, unverified ${t.unverifiedFail}); quality fail ${t.qualityFail}; gaps resolved ${t.gapResolved}`);
  for (const r of results) {
    const s = r.summary;
    console.log(`  ${r.vignetteId.padEnd(46)} pass ${String(s.pass).padStart(2)}  fail ${String(s.fail).padStart(2)}  n/a ${String(s.na).padStart(2)}  blocking ${s.blocking}`);
  }
  const blocking = results.flatMap(r => r.expectations.filter(e => e.blocking).map(e => `${r.vignetteId}/${e.id}: ${e.detail}`));
  if (blocking.length) {
    console.log('BLOCKING (critical, not flagged):');
    for (const b of blocking) console.log(`  - ${b}`);
  }
  const resolved = results.flatMap(r => r.expectations.filter(e => e.gapResolved).map(e => `${r.vignetteId}/${e.id}`));
  if (resolved.length) console.log(`Flags to remove (now passing): ${resolved.join(', ')}`);
  console.log('Wrote docs/clinical-validation/results/web-latest.json and web-latest.md');
  if (blocking.length) process.exit(1);
}

main();
