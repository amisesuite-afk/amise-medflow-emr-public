/**
 * Clinical validation — merged report.
 *
 *   pnpm --filter @workspace/scripts run clinval:report [-- --ios <clinval-ios.jsonl>] [--web <web-latest.json>]
 *
 * Merges the iOS results (the `clinval-ios` artifact of the "iOS — Compile Check" workflow, one
 * CLINVAL JSON object per line) with the web results (docs/clinical-validation/results/web-latest.json)
 * into docs/clinical-validation/REPORT.md: per condition and permutation, pass/fail per
 * expectation and platform, critical first, with guideline citations and a "Proposed fix" column
 * (filled from each expectation's `proposedFix` by the vignette authors).
 *
 * iOS file lookup order: --ios, docs/clinical-validation/results/ios-latest.jsonl, ios/clinval-ios.jsonl,
 * ios/clinval-ios-direct.jsonl. Web: --web, else web-latest.json, else the web suite is run now.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadVignettes, REPO_ROOT } from './load';
import { renderReport } from './render';
import type { ClinvalResult, WebResultsFile } from './types';
import { runAllWeb } from './web-suite';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function firstExisting(paths: (string | undefined)[]): string | undefined {
  return paths.find((p): p is string => !!p && existsSync(p));
}

export function readIosJsonl(path: string): { results: ClinvalResult[]; skipped: number } {
  const results: ClinvalResult[] = [];
  let skipped = 0;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim().replace(/^CLINVAL\|/, '');
    if (!line) continue;
    try {
      const r = JSON.parse(line) as ClinvalResult;
      if (r.type === 'clinval-result' && r.platform === 'ios') results.push(r); else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { results, skipped };
}

function main(): void {
  const { vignettes, errors } = loadVignettes();
  if (errors.length) {
    console.error('Vignette errors:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(2);
  }
  const vs = vignettes.map(l => l.vignette);
  const notes: string[] = [];

  const iosPath = firstExisting([
    arg('ios'),
    arg('ios') ? join(process.cwd(), arg('ios')!) : undefined,
    arg('ios') ? join(REPO_ROOT, arg('ios')!) : undefined,
    join(REPO_ROOT, 'docs', 'clinical-validation', 'results', 'ios-latest.jsonl'),
    join(REPO_ROOT, 'ios', 'clinval-ios.jsonl'),
    join(REPO_ROOT, 'ios', 'clinval-ios-direct.jsonl'),
  ]);
  let ios: ClinvalResult[] = [];
  if (iosPath) {
    const read = readIosJsonl(iosPath);
    ios = read.results;
    const generated = ios[0]?.generatedAt ?? statSync(iosPath).mtime.toISOString();
    notes.push(`iOS: ${ios.length} vignette results from \`${relative(REPO_ROOT, iosPath)}\` (generated ${generated})${read.skipped ? `; ${read.skipped} unreadable lines skipped` : ''}.`);
    const modes = [...new Set(ios.map(r => r.outputs.engineInfo?.bayesDatabase).filter(Boolean))];
    if (modes.length) notes.push(`iOS differential engine mode: ${modes.join(', ')} (BayesianDiagnosisEngine ${modes.includes('fallback') ? 'could not decode DiagnosticDatabase.json and used its built-in lists' : 'used DiagnosticDatabase.json'}).`);
    const known = new Set(vs.map(v => v.id));
    const unknown = ios.filter(r => !known.has(r.vignetteId)).map(r => r.vignetteId);
    if (unknown.length) notes.push(`iOS results for vignettes not in the current set (ignored): ${unknown.join(', ')}.`);
    ios = ios.filter(r => known.has(r.vignetteId));
  } else {
    notes.push('iOS: no results file. Download the `clinval-ios` artifact from the "iOS — Compile Check" workflow run and save it as docs/clinical-validation/results/ios-latest.jsonl (or pass --ios <file>).');
  }

  const webPath = firstExisting([
    arg('web'),
    arg('web') ? join(process.cwd(), arg('web')!) : undefined,
    arg('web') ? join(REPO_ROOT, arg('web')!) : undefined,
    join(REPO_ROOT, 'docs', 'clinical-validation', 'results', 'web-latest.json'),
  ]);
  let web: ClinvalResult[];
  if (webPath) {
    const file = JSON.parse(readFileSync(webPath, 'utf8')) as WebResultsFile;
    web = file.results;
    notes.push(`Web: ${web.length} vignette results from \`${relative(REPO_ROOT, webPath)}\` (generated ${file.generatedAt}, ${file.harness}).`);
  } else {
    const run = runAllWeb();
    web = run.results;
    notes.push(`Web: ${web.length} vignette results from a live run (${run.file.harness}).`);
  }
  const knownIds = new Set(vs.map(v => v.id));
  web = web.filter(r => knownIds.has(r.vignetteId));
  const missingWeb = vs.filter(v => !web.some(r => r.vignetteId === v.id)).map(v => v.id);
  if (missingWeb.length) notes.push(`Web results missing for: ${missingWeb.join(', ')} — re-run clinval:web.`);

  const md = renderReport(vs, [...ios, ...web], {
    title: 'Clinical validation report — consultation engines vs guidelines',
    generatedAt: new Date().toISOString(),
    platforms: ['ios', 'web'],
    sourcesNote: notes,
    includeOutputs: false,
  });
  const out = join(REPO_ROOT, 'docs', 'clinical-validation', 'REPORT.md');
  writeFileSync(out, md);
  console.log(notes.join('\n'));
  console.log(`Wrote ${relative(REPO_ROOT, out)}`);
}

main();
