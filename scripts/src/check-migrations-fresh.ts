/**
 * Fresh-database check for the migration runner.
 *
 * `.github/workflows/run-migrations.yml` is the source of truth for what gets
 * applied to production (see migrations/README.md). Production was bootstrapped
 * partly by hand, so a step that only works because an earlier *manual* change
 * (or a *later* step) already created something goes unnoticed there. This
 * script catches that: it applies every wired step, in runner order, to an
 * empty in-process Postgres (PGlite, WASM — no Docker, no network, no secrets),
 * then:
 *   1. applies every step a second time, to prove each file is idempotent;
 *   2. compares a catalogue snapshot after each pass. A difference means a
 *      guarded statement skipped on the fresh pass because a *later* step
 *      creates what it needs: a forward reference that raises no error;
 *   3. re-runs the steps before Migration 89 (staff-only RLS) and lists any
 *      policy or grant that exists then but not at the end: access that re-running the
 *      runner from the top would re-open until step 89 narrows it again.
 *
 * Guarded steps report what they skipped with RAISE NOTICE; those notices are
 * always printed, so "passes on a fresh database" never hides what is missing.
 *
 * Supabase-managed pieces the migrations rely on are replaced by small
 * stand-ins created before the base schema runs:
 *   - roles `anon`, `authenticated`, `service_role` (bypassrls);
 *   - schema `extensions` with `uuid-ossp` and `pgcrypto` (on the search path,
 *     as in Supabase);
 *   - schema `auth`: `auth.users`, `auth.uid()`, `auth.role()`, `auth.jwt()`,
 *     `auth.email()`, reading the same `request.jwt.claim(s)` settings as
 *     PostgREST;
 *   - schema `storage`: `storage.buckets`, `storage.objects` (RLS on),
 *     `storage.foldername()`, `storage.filename()`, `storage.extension()`;
 *   - the `supabase_realtime` publication.
 *
 * Each step is sent as one multi-statement string, like the runner's call to
 * the Management API, so a failing statement rolls the whole file back.
 *
 * It never connects to a real database.
 *
 * Usage: pnpm --filter @workspace/scripts run check:migrations-fresh
 *        (add `-- --verbose` to print every step with its timing)
 */

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/src/check-migrations-fresh.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'run-migrations.yml');
const VERBOSE = process.argv.includes('--verbose');

export interface Step {
  name: string;
  file: string;
}

/** Wired steps in runner order: each `- name:` paired with the `< file.sql` it feeds to jq. */
export function parseRunnerSteps(yaml: string): Step[] {
  const steps: Step[] = [];
  let name = '';
  for (const line of yaml.split('\n')) {
    const n = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
    if (n) name = n[1].replace(/^"(.*)"$/, '$1');
    const f = line.match(/<\s*([A-Za-z0-9_.\-]+\.sql)\b/);
    if (f) steps.push({ name, file: f[1] });
  }
  return steps;
}

/** Stand-ins for what Supabase provisions before any migration runs. */
export const SUPABASE_STANDINS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
set search_path to public, extensions;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  aud text,
  role text,
  email text,
  phone text,
  encrypted_password text default '',
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;
create function auth.email() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  )
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index bname on storage.buckets (name);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
create function storage.filename(name text) returns text language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end $$;
create function storage.extension(name text) returns text language plpgsql immutable as $$
declare _parts text[]; _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

create publication supabase_realtime;
`;

/**
 * One line per schema object (tables, columns, constraints, indexes, RLS,
 * policies, triggers, functions, grants, publication tables, buckets) in the
 * schemas the migrations touch. Comparing it after the fresh pass with the
 * re-run pass finds *silent* forward references: a guarded statement
 * (`if to_regclass(...)`) that skipped on the first pass because a later step
 * creates what it needs, then did something on the second pass.
 */
const SNAPSHOT_QUERIES: Record<string, string> = {
  column: `select table_schema || '.' || table_name || '.' || column_name || ' ' || data_type
             || case when is_nullable = 'NO' then ' not null' else '' end
             || coalesce(' default ' || column_default, '')
           from information_schema.columns where table_schema in ('public', 'storage')`,
  constraint: `select conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
               from pg_constraint where connamespace in ('public'::regnamespace, 'storage'::regnamespace)`,
  index: `select schemaname || '.' || indexname || ' ' || indexdef from pg_indexes
          where schemaname in ('public', 'storage')`,
  rls: `select c.oid::regclass || ' rls=' || c.relrowsecurity from pg_class c
        where c.relkind = 'r' and c.relnamespace in ('public'::regnamespace, 'storage'::regnamespace)`,
  policy: `select schemaname || '.' || tablename || ' "' || policyname || '" ' || permissive || ' ' || cmd
             || ' to ' || array_to_string(roles, ',') || ' using(' || coalesce(qual, '') || ') check('
             || coalesce(with_check, '') || ')'
           from pg_policies where schemaname in ('public', 'storage')`,
  trigger: `select pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where not t.tgisinternal and c.relnamespace in ('public'::regnamespace, 'storage'::regnamespace)`,
  function: `select p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid)) from pg_proc p
             where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')`,
  grant: `select grantee || ' ' || privilege_type || ' on ' || table_schema || '.' || table_name
          from information_schema.role_table_grants
          where grantee in ('anon', 'authenticated', 'service_role') and table_schema in ('public', 'storage')`,
  publication: `select pubname || ' ' || schemaname || '.' || tablename from pg_publication_tables`,
  bucket: `select id || ' public=' || coalesce(public::text, 'null') from storage.buckets`,
};

async function snapshot(db: PGlite): Promise<Set<string>> {
  const lines = new Set<string>();
  for (const [kind, sql] of Object.entries(SNAPSHOT_QUERIES)) {
    const { rows } = await db.query<Record<string, string>>(sql, [], { rowMode: 'object' });
    for (const row of rows) lines.add(`${kind}: ${Object.values(row)[0]}`);
  }
  return lines;
}

export interface StepFailure {
  pass: 1 | 2;
  step: Step;
  message: string;
}

export interface FreshCheckResult {
  failures: StepFailure[];
  /** Objects present after the re-run but not after the fresh run (and vice versa). */
  appearedOnRerun: string[];
  disappearedOnRerun: string[];
  /**
   * Policies and table grants that exist part-way through a re-run, just before
   * the staff-only RLS step, but not in the final state: access a re-run would re-open for a
   * while. Empty when that step is not wired.
   */
  reopenedBeforeStaffRls: string[];
  /** NOTICEs raised on the fresh pass, per step — how guarded steps report what they skipped. */
  notices: { step: Step; message: string }[];
}

/**
 * Migration 89 narrows staff policies that earlier steps create open. The
 * runner is re-run from the top, so an early step that re-creates (or
 * re-opens) one of those policies leaves it open until step 89 runs again.
 */
export const STAFF_RLS_FILE = 'supabase-staff-only-rls-migration.sql';

function firstLine(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.split('\n')[0];
}

export async function runFreshCheck(
  steps: Step[],
  readSql: (file: string) => string,
  log: (line: string) => void = () => {},
): Promise<FreshCheckResult> {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto, pg_trgm } });
  try {
    await db.exec(SUPABASE_STANDINS);
    const failures: StepFailure[] = [];
    const notices: FreshCheckResult['notices'] = [];
    const snapshots: Set<string>[] = [];
    for (const pass of [1, 2] as const) {
      for (const step of steps) {
        const t0 = Date.now();
        const onNotice = (n: { message?: string }) => {
          if (pass === 1 && n.message) notices.push({ step, message: n.message });
        };
        try {
          await db.exec(readSql(step.file), { onNotice });
          log(`  pass ${pass} ok   ${String(Date.now() - t0).padStart(5)}ms  ${step.name} (${step.file})`);
        } catch (e) {
          failures.push({ pass, step, message: firstLine(e) });
          log(`  pass ${pass} FAIL ${String(Date.now() - t0).padStart(5)}ms  ${step.name} (${step.file}): ${firstLine(e)}`);
        }
      }
      snapshots.push(await snapshot(db));
    }
    const [first, second] = snapshots;

    // Pass 3 (partial): re-run every step before the staff-only RLS step and
    // compare policies and grants with the final state.
    const reopenedBeforeStaffRls: string[] = [];
    const staffRls = steps.findIndex((s) => s.file === STAFF_RLS_FILE);
    if (staffRls > 0) {
      for (const step of steps.slice(0, staffRls)) {
        try {
          await db.exec(readSql(step.file));
        } catch (e) {
          failures.push({ pass: 2, step, message: `(re-run up to ${STAFF_RLS_FILE}) ${firstLine(e)}` });
        }
      }
      const mid = await snapshot(db);
      for (const l of mid) if (/^(policy|grant): /.test(l) && !second.has(l)) reopenedBeforeStaffRls.push(l);
      reopenedBeforeStaffRls.sort();
    }

    return {
      failures,
      notices,
      appearedOnRerun: [...second].filter((l) => !first.has(l)).sort(),
      disappearedOnRerun: [...first].filter((l) => !second.has(l)).sort(),
      reopenedBeforeStaffRls,
    };
  } finally {
    await db.close();
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const steps = parseRunnerSteps(readFileSync(WORKFLOW, 'utf8'));
  if (steps.length === 0) {
    console.error('No migration steps found in run-migrations.yml — has its format changed?');
    process.exit(1);
  }
  console.log(`Applying ${steps.length} wired steps to an empty database, twice (fresh run, then re-run)...`);
  const { failures, notices, appearedOnRerun, disappearedOnRerun, reopenedBeforeStaffRls } = await runFreshCheck(
    steps,
    (file) => readFileSync(join(REPO_ROOT, file), 'utf8'),
    VERBOSE ? (l) => console.log(l) : undefined,
  );
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  // Guarded steps say what they skipped with RAISE NOTICE. Always list those,
  // so "passes on a fresh database" never hides what a fresh database lacks.
  const skips = notices.filter(
    (n) => /missing|skip|does not exist/i.test(n.message) && !/, skipping$/.test(n.message),
  );
  if (skips.length > 0) {
    console.log(`\nSkipped on a fresh database (notices raised by guarded steps):`);
    for (const n of skips) console.log(`  - ${n.step.name}: ${n.message.split('\n')[0]}`);
  }
  if (VERBOSE) {
    const other = notices.filter((n) => !skips.includes(n));
    if (other.length > 0) console.log(`\nOther notices on the fresh pass: ${other.length}`);
    for (const n of other) console.log(`  - ${n.step.name}: ${n.message.split('\n')[0]}`);
  }

  const drift = appearedOnRerun.length + disappearedOnRerun.length;
  if (failures.length === 0 && drift === 0 && reopenedBeforeStaffRls.length === 0) {
    console.log(
      `\nOK: all ${steps.length} steps applied on a fresh database, re-applied cleanly, ` +
        `the re-run left the schema unchanged, and no policy or grant is re-opened part-way through a re-run (${secs}s).`,
    );
    return;
  }
  for (const pass of [1, 2] as const) {
    const fs = failures.filter((f) => f.pass === pass);
    if (fs.length === 0) continue;
    console.error(
      pass === 1
        ? `\n${fs.length} step(s) failed on a FRESH database (forward reference or missing prerequisite):`
        : `\n${fs.length} step(s) failed when RE-RUN (not idempotent):`,
    );
    for (const f of fs) console.error(`  - ${f.step.name} (${f.step.file}): ${f.message}`);
  }
  if (drift > 0) {
    console.error(
      `\nThe re-run changed the schema, so some step behaves differently once later steps have run ` +
        `(a guarded forward reference, or a step that is not idempotent):`,
    );
    for (const l of appearedOnRerun) console.error(`  + ${l}`);
    for (const l of disappearedOnRerun) console.error(`  - ${l}`);
  }
  if (reopenedBeforeStaffRls.length > 0) {
    console.error(
      `\nRe-running the runner from the top re-creates these policies/grants before ${STAFF_RLS_FILE} ` +
        `narrows them again, so they are open for part of every run. Guard the early step ` +
        `(skip when to_regclass('public.user_profiles_revoked') is not null):`,
    );
    for (const l of reopenedBeforeStaffRls) console.error(`  + ${l}`);
  }
  console.error(
    `\nFix the migration, not this check. See migrations/README.md ("Fresh-database check") (${secs}s).`,
  );
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
