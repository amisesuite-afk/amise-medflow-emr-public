/**
 * Catches the single most common cause of production incidents in this repo:
 * a new table created without a matching `grant ... to service_role`. The
 * API server connects to Supabase as service_role — RLS is bypassed for that
 * role, but the underlying table-level GRANT is still checked by Postgres.
 * Missing it is a 42501 ("permission denied for table X") -> HTTP 502 on
 * every endpoint touching that table. See the New Table Checklist in
 * CLAUDE.md.
 *
 * Checks the union of every `supabase*.sql` file at the repo root, not just
 * the file that created the table — several tables in this repo's history
 * were granted retroactively in a separate "fix" migration, which is a
 * legitimate pattern, not a bug. A table only fails this check if it is
 * never granted to service_role anywhere in the tree.
 *
 * Escape hatch: append `-- lint:allow-missing-service-role-grant` to the
 * CREATE TABLE line for a genuine exception (e.g. a view-backed table the
 * API server never touches).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/src/lint-migration-grants.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const ALLOW_MARKER = 'lint:allow-missing-service-role-grant';

const CREATE_TABLE_RE =
  /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;

const GRANT_RE =
  /grant\s+[a-z, ]+\s+on\s+(?!schema\b)(?:table\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+to\s+([^;]+);/gis;

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

interface TableRef { table: string; file: string; }

function findMigrationFiles(): string[] {
  return readdirSync(REPO_ROOT)
    .filter(f => /^supabase.*\.sql$/i.test(f))
    .sort();
}

function main() {
  const files = findMigrationFiles();
  if (files.length === 0) {
    console.error('No supabase*.sql files found at repo root — check REPO_ROOT resolution.');
    process.exit(1);
  }

  const created: TableRef[] = [];
  const grantedToServiceRole = new Set<string>();
  const allowlisted = new Set<string>();

  for (const file of files) {
    const raw = readFileSync(join(REPO_ROOT, file), 'utf8');
    const rawLines = raw.split('\n');
    const clean = stripComments(raw);

    // CREATE TABLE — scan comment-stripped text, so prose like "CREATE TABLE
    // definitions exist" in a comment block can't be mistaken for real SQL.
    // Stripping only truncates each line at `--`, so line numbers still line
    // up with `raw`; the allow-marker (which lives in a trailing comment on
    // the same line) is checked against the original line.
    for (const m of clean.matchAll(CREATE_TABLE_RE)) {
      const table = m[1].toLowerCase();
      const lineNo = clean.slice(0, m.index ?? 0).split('\n').length - 1;
      const originalLine = rawLines[lineNo] ?? '';
      if (originalLine.includes(ALLOW_MARKER)) {
        allowlisted.add(table);
        continue;
      }
      created.push({ table, file });
    }

    for (const m of clean.matchAll(GRANT_RE)) {
      const table = m[1].toLowerCase();
      const toClause = m[2].toLowerCase();
      if (toClause.includes('service_role')) {
        grantedToServiceRole.add(table);
      }
    }
  }

  const seen = new Set<string>();
  const missing: TableRef[] = [];
  for (const ref of created) {
    if (seen.has(ref.table)) continue; // report each table once, at its first CREATE
    seen.add(ref.table);
    if (!grantedToServiceRole.has(ref.table) && !allowlisted.has(ref.table)) {
      missing.push(ref);
    }
  }

  console.log(
    `Scanned ${files.length} file(s) — ${created.length} CREATE TABLE statement(s), ` +
    `${seen.size} unique table(s), ${grantedToServiceRole.size} granted to service_role, ` +
    `${allowlisted.size} allowlisted.`,
  );

  if (missing.length === 0) {
    console.log('✓ Every table has a service_role grant somewhere in the migration tree.');
    return;
  }

  console.error(`\n✗ ${missing.length} table(s) created without a service_role grant anywhere:\n`);
  for (const { table, file } of missing) {
    console.error(`  - ${table}  (created in ${basename(file)})`);
  }
  console.error(
    '\nAdd `grant select, insert, update, delete on public.<table> to service_role;` ' +
    '(same migration file or a follow-up one), or mark a genuine exception with ' +
    `\`-- ${ALLOW_MARKER}\` on the CREATE TABLE line.`,
  );
  process.exit(1);
}

main();
