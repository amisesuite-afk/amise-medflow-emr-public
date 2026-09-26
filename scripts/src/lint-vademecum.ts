/**
 * Disease-centred vademecum reference lint (`pnpm --filter @workspace/scripts run lint:vademecum`).
 *
 * Phase 1 is shadow only (docs/VADEMECUM-PLAN.md). lint:shared-content validates the files against
 * their schemas and the Swift / TypeScript types; this FAILS (exit 1) when a reference is broken:
 * a finding, examination sign, decision-rule band, laboratory analyte, PANE id, iOS candidate,
 * decision or history frame that does not exist; a link under the wrong level; a referenced ratio
 * that does not apply to the disease; malformed criteria logic; a pathognomonic entry counted
 * twice; or content marked reviewed. Checks: vademecum.ts.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVademecum, readVademecum } from './vademecum';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const { problems, stats } = checkVademecum(readVademecum(REPO_ROOT), REPO_ROOT);
console.log(`Vademecum: ${stats.findings} findings (${stats.entryPoints} entry points), ${stats.diseases} diseases, ${stats.links} links `
  + `(${Object.entries(stats.bySeed).map(([k, n]) => `${k} ${n}`).join(', ')}; ${stats.withRange} ratios with a range; ${stats.fromMemory} fromMemory), `
  + `${stats.criteria} criteria sets, ${stats.pathognomonic} pathognomonic, ${stats.exclusions} exclusions, ${stats.incidental} incidental work-ups.`);
if (problems.length) {
  console.error(`\nFAILED: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('OK: every reference resolves; nothing is marked reviewed.');
