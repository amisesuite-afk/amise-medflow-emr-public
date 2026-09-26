/**
 * signoff:catalogue — builds the clinical sign-off catalogue the dashboard's "Clinical sign-off"
 * page reads (artifacts/dashboard/src/data/clinical-signoff-catalogue.json) from every change
 * log's "Needs sign-off" list and SURGEON-DECISIONS sections A–G and I. See signoff/catalogue.ts
 * for the parsing rules and docs/CLINICAL-CONTENT-UPGRADES.md §3.4 for the flow.
 *
 *   pnpm --filter @workspace/scripts run signoff:catalogue        # write the JSON
 *   pnpm --filter @workspace/scripts run lint:signoff-catalogue   # CI: fail if it is stale
 *
 * Run it after editing a change log's sign-off list, SURGEON-DECISIONS or the registry, and
 * commit the JSON with the edit.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATALOGUE_PATH, buildCatalogue, readCatalogueInputs, serialiseCatalogue,
} from './signoff/catalogue';
import type { SignoffCatalogue } from '../../artifacts/dashboard/src/lib/clinical-signoff/types';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

/** What differs between the committed catalogue and a fresh build (item-level, for the message). */
export function catalogueDiff(committed: SignoffCatalogue | null, fresh: SignoffCatalogue): string[] {
  if (!committed) return ['the catalogue file is missing'];
  const out: string[] = [];
  const old = new Map(committed.items.map(i => [i.id, i]));
  const now = new Map(fresh.items.map(i => [i.id, i]));
  for (const [id, it] of now) {
    const o = old.get(id);
    if (!o) out.push(`new item ${id}`);
    else if (o.hash !== it.hash) out.push(`changed item ${id}`);
    else if (JSON.stringify(o) !== JSON.stringify(it)) out.push(`item ${id} (links, title or anchor)`);
  }
  for (const id of old.keys()) if (!now.has(id)) out.push(`removed item ${id}`);
  if (!out.length && JSON.stringify(committed) !== JSON.stringify(fresh)) out.push('rule-set or source summaries (registry titles, review fields or links)');
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  const fresh = buildCatalogue(readCatalogueInputs(REPO_ROOT));
  const text = serialiseCatalogue(fresh);
  const path = join(REPO_ROOT, CATALOGUE_PATH);
  const summary = `${fresh.items.length} items from ${fresh.sources.length} sources, ${fresh.ruleSets.length} rule sets linked (catalogue ${fresh.catalogueHash})`;
  if (!check) {
    writeFileSync(path, text);
    console.log(`Wrote ${CATALOGUE_PATH}: ${summary}.`);
    return;
  }
  const committedText = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (committedText === text) {
    console.log(`✓ Sign-off catalogue is up to date: ${summary}.`);
    return;
  }
  let committed: SignoffCatalogue | null = null;
  try { committed = committedText ? JSON.parse(committedText) as SignoffCatalogue : null; } catch { committed = null; }
  const diff = catalogueDiff(committed, fresh);
  console.error(`✗ ${CATALOGUE_PATH} is stale against the sign-off lists (${diff.length} difference(s)):`);
  for (const d of diff.slice(0, 40)) console.error(`  - ${d}`);
  if (diff.length > 40) console.error(`  … and ${diff.length - 40} more`);
  console.error('Run `pnpm --filter @workspace/scripts run signoff:catalogue` and commit the JSON.');
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
