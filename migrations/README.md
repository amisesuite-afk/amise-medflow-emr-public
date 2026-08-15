# Database migrations — source of truth and process

## Source of truth

The `.github/workflows/run-migrations.yml` GitHub Action (`workflow_dispatch`, manual trigger,
requires typing `run` to confirm) is the source of truth for what's been applied to the
production Supabase project (`nornhfzfrlmfzaqmrzzp`). It runs `supabase-schema.sql` (base
schema) followed by every migration file in a fixed, dependency-safe order, via the Supabase
Management API.

All migration files live as loose `.sql` files at the repo root (`supabase-*-migration.sql`,
plus a few without the `-migration` suffix like `supabase-schema.sql` and
`supabase-add-photo-url.sql`). Every file's own header comment states its purpose and whether
it's idempotent (nearly all are — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`DROP ... IF EXISTS`).

## How to add a new migration

1. Write `supabase-<short-name>-migration.sql` at the repo root. Make every statement
   idempotent (`IF NOT EXISTS` / `IF EXISTS` / `DO $$ ... $$` guards) — the whole runner gets
   re-run from the top each time, so a non-idempotent statement breaks every future run, not
   just this one.
2. Follow the **New Table Checklist** in `CLAUDE.md` if the migration creates a table (RLS,
   grants to both `authenticated` and `service_role`, `NOT NULL` FKs, `CHECK` constraints).
3. **Add a new step to `run-migrations.yml` in the same commit/PR** — append it after the last
   existing step, before `Done`, following the existing `Migration N: <description>` naming
   pattern. This is the step that was skipped for ~44 migrations over this project's history
   and is what caused the backlog item this file exists to close — don't repeat it.
4. `pnpm --filter @workspace/scripts run lint:grants` (CI-enforced) will catch a missing
   `service_role` grant on a new table; it does not catch a migration file never being wired
   into the runner, since that's a workflow-file gap, not a SQL-file gap. There is currently no
   automated check for "every `supabase*.sql` file is referenced somewhere in
   `run-migrations.yml`" — a good candidate for a future lint script, but out of scope here
   since (see below) not every loose file *should* be wired in.
5. If you're building on a migration that hasn't been applied to production yet, say so in the
   PR — the runner is only ever triggered manually, on purpose, by someone who can confirm
   production is in the expected state first.

## Current state (as of this file's creation)

79 `supabase*.sql` files (+ `patient-auth-migration.sql`) exist at the repo root.

- **64 are wired into `run-migrations.yml`** in dependency-safe order: the original 35, plus 29
  added alongside this file (safe, uncontested additions — see below).
- **3 are reference/snapshot files, intentionally never wired in**: `supabase-migration-order.sql`
  (an early, now-superseded ordering doc — see `run-migrations.yml` for the current one),
  `supabase-all-pending-migrations.sql` (a one-off consolidated catch-up script, already
  superseded by individual migrations being wired in properly), and
  `supabase-all-migrations-consolidated.sql` (a static historical dump — also excluded from the
  `lint:rls-policies` CI check for the same reason: it goes stale the moment anyone edits a
  policy elsewhere and nobody remembers to update the dump).
- **12 are excluded on purpose — conflicting duplicate table definitions.** These need a human
  with real production Supabase access to resolve; a static read of the SQL can't tell you
  which version, if either, is actually live. Resolving them was explicitly deferred rather than
  guessed at, since `CREATE TABLE IF NOT EXISTS` means whichever version runs first silently
  wins — get the order wrong here and you could cement the wrong schema instead of just wasting
  a no-op.

### Conflicting tables — needs your review before wiring in

| Table | Competing files | Notes |
|---|---|---|
| `wound_assessments` | `supabase-clinical-tables-migration.sql`, `supabase-slice-jk-wound-mm-migration.sql`, `supabase-wound-assessments-migration.sql` | Live app code (`artifacts/api-server/src/routes/wound-assessments.ts`) reads/writes a `deleted_at` column for soft-delete. Only the **slice-jk** version has `deleted_at` — the other two are missing it. Strong evidence slice-jk is the live schema, but not proof (no direct DB check was possible). |
| `patient_problems` | `supabase-clinical-tables-migration.sql`, `supabase-patient-problems-migration.sql` | Both queried live (`artifacts/api-server/src/lib/patient-context.ts`, `artifacts/dashboard/src/lib/db.ts`) — didn't diff far enough to tell which column layout the app actually needs. Needs a closer read of both schemas against every call site before wiring either in. |
| `mm_cases` | `supabase-quality-cases-migration.sql`, `supabase-slice-jk-wound-mm-migration.sql` | Not yet cross-checked against `artifacts/api-server/src/routes/mm-cases.ts`. |
| `prescriptions` | `supabase-prescriptions-migration.sql`, `supabase-slice-i-prescriptions-migration.sql`, `supabase-emr-enhancement-migration.sql` | The third file is **already wired** (Migration 32, in production per the existing runner). The other two are very likely dead duplicates — but "very likely" isn't "confirmed," so they're still flagged rather than silently dropped. |
| `clinical_guidelines` | `supabase-clinical-guidelines-migration.sql`, `supabase-missing-tables-migration.sql`, `supabase-emr-enhancement-migration.sql` | Same situation as `prescriptions` — the third file is already wired (Migration 32). |
| `patient_tasks` | `supabase-missing-tables-migration.sql`, `supabase-emr-enhancement-migration.sql` | Same situation — `supabase-emr-enhancement-migration.sql` (Migration 32) is already wired. |
| `audit_log` | `supabase-audit-trail-migration.sql`, `supabase-slice-d-audit-migration.sql` | Not yet cross-checked against `artifacts/api-server/src/lib/audit.ts` / `phi-audit-middleware.ts`. |

**One file worth prioritizing:** `supabase-missing-tables-migration.sql` also creates
`pmh_items` and `pending_bookings` — neither of those two table names conflicts with anything
else in the tree. `pmh_items` is confirmed live and load-bearing: the API route
`artifacts/api-server/src/routes/problems.ts` (`/api/problems`) queries it directly, and
`supabase-slice-pqrs-migration.sql`'s own header comment states outright that `pmh_items` "was
created in supabase-missing-tables-migration.sql ... enabling the upsert pattern used by
POST /api/problems." A companion file, `supabase-pmh-items-grant-fix.sql` (fixes a
`permission denied for table pmh_items` 42501 error — the exact failure mode documented in
`CLAUDE.md`'s New Table Checklist), depends on `pmh_items` already existing and is excluded
here for the same reason. Both were still kept out of the automatic-wire pass only because
`supabase-missing-tables-migration.sql` *also* creates the disputed `clinical_guidelines` and
`patient_tasks` tables in the same file — but given `supabase-emr-enhancement-migration.sql`
already owns those two (Migration 32, already wired), re-running this file's `IF NOT EXISTS`
statements for them should be a safe no-op. This is the one entry in this table where the
evidence is strong enough that it's worth a quick manual look rather than a deep one.

To resolve any row above: confirm the live schema in the Supabase dashboard (Table Editor →
column list, or `\d <table>` via SQL Editor), pick the file matching what's actually there,
add its step to `run-migrations.yml`, and delete (or clearly mark superseded, e.g. rename to
`.superseded.sql` so it's excluded from `lint:grants`/`lint:rls-policies`'s glob) the losing
duplicate file(s) so this situation can't quietly get worse.
