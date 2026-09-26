/**
 * signoff:apply — records approved clinical sign-off decisions in the repository.
 *
 *   pnpm --filter @workspace/scripts run signoff:apply <bundle.json> [--rule-set <id> …] [--dry-run]
 *
 * <bundle.json> is the "Export approved decisions" download from the dashboard's Clinical
 * sign-off page (Insights → Clinical sign-off). The script re-reads the sign-off lists from the
 * docs, works out each item's latest decision for its CURRENT wording and, for every fully
 * approved rule set (or the named ones), sets lastReviewed / reviewer / reviewEvidence /
 * nextReviewDue in clinical-content/registry.json and appends a dated record to
 * SURGEON-DECISIONS.md section I. It also keeps a copy of the bundle (JSON + Markdown) in
 * clinical-content/signoffs/ and rebuilds the sign-off catalogue. It refuses — and writes
 * nothing — when a named rule set has a pending, rejected, deferred or changed item, when nothing
 * is complete, or when the bundle was applied before.
 *
 * The app never edits the repository: a developer runs this, reviews the diff and commits it.
 * Details: signoff/apply.ts; flow: docs/CLINICAL-CONTENT-UPGRADES.md §3.4.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBundle, bundleSha } from './signoff/apply';
import {
  CATALOGUE_PATH, DECISIONS_DOC, REGISTRY_PATH, buildCatalogue, readCatalogueInputs, serialiseCatalogue,
} from './signoff/catalogue';
import { bundleMarkdown, stLuciaDate } from '../../artifacts/dashboard/src/lib/clinical-signoff/status';
import type { SignoffBundle } from '../../artifacts/dashboard/src/lib/clinical-signoff/types';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const SIGNOFFS_DIR = 'clinical-content/signoffs';

function usage(msg?: string): never {
  if (msg) console.error(msg);
  console.error('Usage: pnpm --filter @workspace/scripts run signoff:apply <bundle.json> [--rule-set <id> …] [--dry-run]');
  process.exit(2);
}

function main() {
  const args = process.argv.slice(2);
  const only: string[] = [];
  let dryRun = false;
  let file: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--rule-set') { const v = args[++i]; if (!v) usage('--rule-set needs an id'); only.push(v); }
    else if (a.startsWith('--')) usage(`Unknown option ${a}`);
    else if (!file) file = a;
    else usage(`Unexpected argument ${a}`);
  }
  if (!file) usage();
  // pnpm runs the script in scripts/; resolve the path from where the command was typed.
  const base = process.env.INIT_CWD ?? process.cwd();
  const bundlePath = isAbsolute(file) ? file : resolve(base, file);
  const bundleText = readFileSync(bundlePath, 'utf8');
  let bundle: SignoffBundle;
  try { bundle = JSON.parse(bundleText) as SignoffBundle; } catch (e) { usage(`${bundlePath} is not JSON: ${(e as Error).message}`); }

  const catalogue = buildCatalogue(readCatalogueInputs(REPO_ROOT));
  if (bundle.catalogueHash && bundle.catalogueHash !== catalogue.catalogueHash) {
    console.log(`Note: the bundle was exported against catalogue ${bundle.catalogueHash}; the docs now give ${catalogue.catalogueHash}. Items whose wording changed since their decision count as not approved.`);
  }
  const result = applyBundle({
    bundle,
    bundleText,
    catalogue,
    registryText: readFileSync(join(REPO_ROOT, REGISTRY_PATH), 'utf8'),
    decisionsText: readFileSync(join(REPO_ROOT, DECISIONS_DOC), 'utf8'),
    only,
  });
  if (!result.ok) {
    console.error('✗ signoff:apply refused — nothing was written:');
    for (const r of result.refusals) console.error(`  - ${r}`);
    process.exit(1);
  }
  for (const a of result.applied) {
    console.log(a.kind === 'rule-set'
      ? `✓ ${a.id}: ${a.items} items approved${a.amended ? ` (${a.amended} amended)` : ''} → lastReviewed ${a.lastReviewed}, reviewer ${a.reviewer}`
      : `✓ ${a.id}: ${a.items} items approved (no registry entry; recorded in SURGEON-DECISIONS only)`);
  }
  for (const n of result.notApplied) {
    console.log(`· ${n.id}: not applied — ${n.blocking.length} item(s) not approved`);
  }
  if (dryRun) {
    console.log('\n--dry-run: nothing written. SURGEON-DECISIONS section I would gain:\n');
    console.log(result.section);
    return;
  }
  writeFileSync(join(REPO_ROOT, REGISTRY_PATH), result.registryText);
  writeFileSync(join(REPO_ROOT, DECISIONS_DOC), result.decisionsText);
  const sha = bundleSha(bundleText);
  const stem = `${SIGNOFFS_DIR}/signoff-${stLuciaDate(bundle.exportedAt)}-${sha.slice(0, 8)}`;
  mkdirSync(join(REPO_ROOT, SIGNOFFS_DIR), { recursive: true });
  writeFileSync(join(REPO_ROOT, `${stem}.json`), bundleText.endsWith('\n') ? bundleText : `${bundleText}\n`);
  writeFileSync(join(REPO_ROOT, `${stem}.md`), `${bundleMarkdown(bundle, catalogue)}\n`);
  // Registry review fields are part of the catalogue: rebuild it so lint:signoff-catalogue passes.
  writeFileSync(join(REPO_ROOT, CATALOGUE_PATH), serialiseCatalogue(buildCatalogue(readCatalogueInputs(REPO_ROOT))));
  console.log(`\nWrote ${REGISTRY_PATH}, ${DECISIONS_DOC}, ${stem}.json/.md and ${CATALOGUE_PATH}.`);
  console.log('Next: run lint:guideline-registry and lint:signoff-catalogue, review the diff, and commit it.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
