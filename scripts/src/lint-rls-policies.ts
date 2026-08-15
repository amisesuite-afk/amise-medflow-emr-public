/**
 * Static presence check for Row Level Security on the highest-risk staff
 * tables (patients, clinical_notes, documents, appointment_requests).
 *
 * This does NOT verify RLS is actually *enforced* — that would require a
 * live Supabase project and an authenticated (non-service_role) test client,
 * which this repo's CI does not have (no SUPABASE_* secrets are wired into
 * the `test` job, and there's no local/dockerized Supabase to stand one up).
 * See .claude/skills/emr-review/SKILL.md and the RLS backlog item for why
 * this is a narrower, static check rather than a live-enforcement test.
 *
 * What it does catch: a table losing `enable row level security`, or one of
 * its known policies being silently dropped/renamed — the kind of regression
 * that would otherwise only surface as "staff can suddenly see everything"
 * or "staff can no longer read anything" in production. Every existing test
 * mocks the Supabase client entirely, so nothing else in this repo would
 * catch that today.
 *
 * Checks the union of every `supabase*.sql` file at the repo root, same
 * approach as lint-migration-grants.ts — RLS is sometimes enabled via a
 * `do $$ ... foreach t in array array[...] ... end $$;` loop rather than a
 * literal `alter table X enable row level security;` per table.
 *
 * Unlike grants (monotonically additive — a table can only gain a grant),
 * policies can be renamed or dropped, so a tree-wide union isn't safe here
 * without one exclusion: `supabase-all-migrations-consolidated.sql` is a
 * static historical snapshot nobody edits when a policy changes elsewhere.
 * Left in the scan, it would permanently mask a rename/removal made in the
 * live source file (verified: renaming a required policy in
 * supabase-schema.sql alone did not fail this check until the consolidated
 * file was excluded — the stale duplicate kept the old name "present").
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/src/lint-rls-policies.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const REQUIRED_POLICIES: Record<string, string[]> = {
  patients: [
    'staff_select_patients',
    'staff_insert_patients',
    'doctors_update_patients',
    'admins_delete_patients',
  ],
  clinical_notes: [
    'staff_select_clinical_notes',
    'doctors_insert_clinical_notes',
    'doctors_update_clinical_notes',
    'admins_delete_clinical_notes',
  ],
  documents: [
    'staff_select_documents',
    'staff_insert_documents',
    'staff_update_documents',
    'admins_delete_documents',
  ],
  appointment_requests: [
    'staff_all',
  ],
};

const DIRECT_ENABLE_RE =
  /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+enable\s+row\s+level\s+security/gi;

const DO_BLOCK_RE = /do\s+\$\$[\s\S]*?end\s+\$\$;/gi;

const ARRAY_LITERAL_RE = /array\s*\[([\s\S]*?)\]/i;

const QUOTED_IDENT_RE = /'([a-zA-Z_][a-zA-Z0-9_]*)'/g;

const POLICY_RE =
  /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;

/** Strip `-- ...` line comments so prose in comment blocks can't be mistaken for SQL. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

// Static historical dump, not a source of truth — see file header comment.
const EXCLUDED_FILES = new Set(['supabase-all-migrations-consolidated.sql']);

function findMigrationFiles(): string[] {
  return readdirSync(REPO_ROOT)
    .filter(f => /^supabase.*\.sql$/i.test(f) && !EXCLUDED_FILES.has(f))
    .sort();
}

function extractRlsEnabledTables(sql: string): Set<string> {
  const tables = new Set<string>();

  for (const m of sql.matchAll(DIRECT_ENABLE_RE)) {
    tables.add(m[1].toLowerCase());
  }

  for (const block of sql.matchAll(DO_BLOCK_RE)) {
    const text = block[0];
    if (!/enable\s+row\s+level\s+security/i.test(text)) continue;
    const arrayMatch = text.match(ARRAY_LITERAL_RE);
    if (!arrayMatch) continue;
    for (const idMatch of arrayMatch[1].matchAll(QUOTED_IDENT_RE)) {
      tables.add(idMatch[1].toLowerCase());
    }
  }

  return tables;
}

function extractPolicies(sql: string): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();
  for (const m of sql.matchAll(POLICY_RE)) {
    const [, policyName, table] = m;
    const key = table.toLowerCase();
    if (!byTable.has(key)) byTable.set(key, new Set());
    byTable.get(key)!.add(policyName);
  }
  return byTable;
}

function main() {
  const files = findMigrationFiles();
  if (files.length === 0) {
    console.error('No supabase*.sql files found at repo root — check REPO_ROOT resolution.');
    process.exit(1);
  }

  const rlsEnabledTables = new Set<string>();
  const policiesByTable = new Map<string, Set<string>>();

  for (const file of files) {
    const raw = readFileSync(join(REPO_ROOT, file), 'utf8');
    const clean = stripComments(raw);

    for (const t of extractRlsEnabledTables(clean)) rlsEnabledTables.add(t);

    for (const [table, names] of extractPolicies(clean)) {
      if (!policiesByTable.has(table)) policiesByTable.set(table, new Set());
      for (const n of names) policiesByTable.get(table)!.add(n);
    }
  }

  const targetTables = Object.keys(REQUIRED_POLICIES);
  const failures: string[] = [];

  for (const table of targetTables) {
    if (!rlsEnabledTables.has(table)) {
      failures.push(`${table}: RLS is not enabled anywhere in the migration tree (expected an "enable row level security" statement).`);
    }
    const havePolicies = policiesByTable.get(table) ?? new Set();
    for (const required of REQUIRED_POLICIES[table]) {
      if (!havePolicies.has(required)) {
        failures.push(`${table}: expected policy "${required}" not found anywhere in the migration tree.`);
      }
    }
  }

  console.log(
    `Checked RLS presence for ${targetTables.length} high-risk table(s) across ${files.length} migration file(s).`,
  );

  if (failures.length === 0) {
    console.log('✓ RLS is enabled and every expected policy is present for: ' + targetTables.join(', ') + '.');
    return;
  }

  console.error(`\n✗ ${failures.length} RLS regression(s) found:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nThis check only verifies policies are *present*, not that they are correctly enforced ' +
    '(that needs a live Supabase project with a real authenticated JWT, which CI does not have ' +
    'today). If a policy was intentionally renamed or replaced, update REQUIRED_POLICIES in ' +
    'scripts/src/lint-rls-policies.ts to match.',
  );
  process.exit(1);
}

main();
