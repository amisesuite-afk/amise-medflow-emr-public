/**
 * Shared clinical content lint (`pnpm --filter @workspace/scripts run lint:shared-content`).
 *
 * Clinical rules live once, as data, in clinical-content/rules/*.json; the web imports the JSON and
 * iOS bundles the same files (folder reference "rules", decoded by SharedClinicalContent.swift).
 * Change the JSON, not a platform copy.
 *
 * FAILS (exit 1) when a rules file has no schema or does not validate against it
 * (clinical-content/schemas/*.schema.json, JSON Schema 2020-12); when its `id` is not a registry
 * entry listing the file with a json-key version stamp; when a regex list does not compile; when a
 * Swift Codable struct or TypeScript interface that reads it disagrees with the schema (field
 * names, optionality, basic types, string-enum values); when the iOS loader or ios/project.yml does
 * not include it; or when a retired platform copy is back. Checks: shared-content.ts.
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSharedContent } from './shared-content';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const { problems, checked } = checkSharedContent(REPO_ROOT);
console.log(`Shared clinical content: ${checked.length} file(s) in clinical-content/rules and clinical-content/vademecum (${checked.join(', ')}).`);
if (problems.length) {
  console.error(`\nFAILED: ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nClinical rules live in clinical-content/rules/*.json: change the JSON (and its schema), then the types that read it on both platforms.');
  process.exit(1);
}
console.log('OK: every rule file validates against its schema, is registered, is bundled for iOS, and matches the Swift and TypeScript types.');
