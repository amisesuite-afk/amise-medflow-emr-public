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
4. Run `pnpm --filter @workspace/scripts run check:migrations-fresh` (CI-enforced, about 10s).
   It applies every wired step to an empty in-process Postgres, twice, and fails on a forward
   reference, a non-idempotent statement, or a policy or grant that a re-run would re-open
   before Migration 89. See [Fresh-database check](#fresh-database-check).
5. `pnpm --filter @workspace/scripts run lint:grants` (CI-enforced) will catch a missing
   `service_role` grant on a new table; it does not catch a migration file never being wired
   into the runner, since that's a workflow-file gap, not a SQL-file gap. There is currently no
   automated check for "every `supabase*.sql` file is referenced somewhere in
   `run-migrations.yml`" — a good candidate for a future lint script, but out of scope here
   since (see below) not every loose file *should* be wired in.
6. If you're building on a migration that hasn't been applied to production yet, say so in the
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
| `audit_log` | `supabase-audit-trail-migration.sql`, `supabase-slice-d-audit-migration.sql` | Both `logAudit()` (`lib/audit.ts`) and `audit()` (`lib/supabase.ts`) write `user_agent` and `mode` columns on every call. `supabase-audit-trail-migration.sql`'s `CREATE TABLE` doesn't have either column; `supabase-slice-d-audit-migration.sql`'s does (added via a follow-up `ALTER TABLE` in the same file). Since these audit calls are already live in production (`clinical-notes.ts`, `encounters.ts`, `prescriptions.ts`, etc. all call `audit()` today) without reported insert failures, the **slice-d version is almost certainly the live schema** — strong evidence, not yet a direct DB check. |

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

## Fresh-database check

`scripts/src/check-migrations-fresh.ts` (`pnpm --filter @workspace/scripts run
check:migrations-fresh`, run in CI) reads the steps from `run-migrations.yml` and applies each
file, in order, to an empty PGlite database (Postgres compiled to WASM, in process). Nothing
connects to a real database. Supabase's own objects are replaced by stand-ins: the `anon`,
`authenticated` and `service_role` roles, the `extensions` schema (`uuid-ossp`, `pgcrypto`),
`auth.users`, `auth.uid()`, `auth.role()`, `auth.jwt()`, `auth.email()`, `storage.buckets`,
`storage.objects`, `storage.foldername()`/`filename()`/`extension()`, and the
`supabase_realtime` publication. Each file is sent as one string, as the runner sends it, so
one failing statement rolls back the whole file.

It then checks three things:

1. **Every step applies a second time.** The runner is re-run from the top, so every file must
   be idempotent.
2. **The second pass leaves the schema unchanged.** It compares a catalogue snapshot (columns,
   constraints, indexes, RLS flags, policies, triggers, functions, grants, publication tables,
   buckets) after each pass. A difference means a guarded statement skipped on the first pass
   because a *later* step creates what it needs. That is a forward reference that raises no
   error.
3. **A re-run does not re-open access.** It re-runs the steps before Migration 89 and lists any
   policy or table grant that exists then but not in the final state. Such access would be open
   for part of every production run, until step 89 narrows it again.

Guarded steps report what they skip with `RAISE NOTICE`, and the check always prints those.

### What it found (fixed, first applied by the next run)

The runner as it stood could not complete on any database:

- **Fresh database: 15 steps failed.** The first was Migration 2, and several later failures
  were knock-on effects of it.
- **Re-run against a database that already had the objects (production): 35 steps failed.** The
  first was "Run base schema" (`policy "users_select_own_profile" ... already exists`). Every
  `CREATE POLICY`, most `CREATE TRIGGER` and every `ADD CONSTRAINT` was bare. The README's
  "re-run from the top" process could not have got past the base schema, so production has in
  practice been migrated some other way (e.g. the SQL editor).

Forward references, where a step uses something a later step creates:

| Step | Reference | Fix |
|---|---|---|
| 2 (patient portal) | policy `patients_select_own_sessions` on `questionnaire_sessions`, created by Migration 3 | Migration 2 skips the policy when the table is missing. New **Migration 90** (`supabase-deferred-forward-refs-migration.sql`, appended last) creates it. It is a no-op on production, which already has it. The other failures (6, 7, 14, 23, 89) were knock-on effects of 2 rolling back. |

No other step uses anything a later step creates. The snapshot comparison (point 2 above)
confirms this for guarded statements too.

References to objects **no runner step creates** at all (production-only, or created only by
the excluded conflicting files listed above). Each is now guarded so the step completes; on
production, where the object exists, the step behaves as before:

| Step | Reference | On a fresh database |
|---|---|---|
| 21 (procedure prep drafts) | FK `thread_id → conversation_threads`. The table was applied to production by hand from `artifacts/front-desk/supabase-schema.sql` and is not in the runner. | `thread_id` is created without the FK. The FK is added if `conversation_threads` exists. |
| 29 (appointment requests align) | back-fill from `chief_complaint`, `preferred_site`, `preferred_date`, `triage_level`, legacy production-only columns from the same front-desk schema | each back-fill is skipped (nothing to back-fill) |
| 56 (slice C) | FK `clinical_states.problem_id → patient_problems` (excluded conflicting table) | column created without the FK. The FK is added if `patient_problems` exists. |
| 66 (clinical audit trigger) | `audit_log` (excluded conflicting table) | The step used to `RAISE EXCEPTION`; it now raises a notice. Its existing re-check still attaches no trigger while `audit_log` is missing. |
| 77 (prescriptions flat columns, wired twice) | back-fill from `prescriptions.items`, which exists only in the excluded prescriptions files | back-fill skipped. This UPDATE is also why the step failed on production (hence Migration 78). |
| 80 (mm_cases RCA) | `mm_cases` (excluded conflicting table) | skipped |
| 83 (pmh_items grant fix) | `pmh_items` (only in the unwired `supabase-missing-tables-migration.sql`) | skipped |

Other fixes:

- **68 (iOS EMR columns)** used `CREATE POLICY IF NOT EXISTS`, which is not valid Postgres in
  any version. The step failed with a syntax error on every database, so its columns and
  tables have come from later steps. It is now guarded like the rest.
- **Idempotency.** Every bare `CREATE POLICY` in a wired file is wrapped as
  `do $guard$ begin create policy ...; exception when duplicate_object then null; end $guard$;`.
  It creates the policy only if it is missing and never overwrites one, so a policy that a
  later step (notably 89) narrowed keeps its narrowed definition. The same applies to the
  trigger in 40 and the constraints in 5 and 61.
- **Re-run window.** Three earlier steps re-created or re-opened policies that 89 narrows or
  drops: the six "Authenticated users can ... clinical attachments / patient documents"
  storage policies (35), `staff_manage_consultation_requests` (7, which used drop+create) and
  `doctors_update_patients` (base schema). Each now skips when Migration 89 has already run
  (`to_regclass('public.user_profiles_revoked') is not null`). Without this, the first
  complete production run after this change would have let any signed-in user, portal
  patients included, read those storage buckets until step 89 ran.

**Before the next production run:** the runner has never completed there. Expect it to apply
everything that has been failing, including 68, 77, 87, 88, 89 and 90. Read the Migration 89
notes below before running it.

### Steps that cannot fully apply on a fresh database

A fresh database built only from the runner still lacks the following, until the conflicting
duplicates above are resolved and wired in:

- `audit_log`, so Migration 66 attaches no audit triggers;
- `patient_problems`, so `clinical_states.problem_id` has no FK;
- `mm_cases`, so there are no RCA columns (80);
- `pmh_items`, so the grant fix (83) is skipped;
- `conversation_threads`, so `procedure_prep_drafts.thread_id` has no FK and the front-desk
  thread features have no table;
- the legacy `appointment_requests` columns, which are only back-filled from on production
  (29), and `prescriptions.items` (77).

## Later additions

Migrations added after this file was written, each wired into `run-migrations.yml` in the same
change. None has been applied to production until someone runs the workflow.

### Migration 87 — `supabase-soft-delete-migration.sql` (soft delete)

- Adds nullable `deleted_at timestamptz` and `deleted_by uuid` to the five tables the iOS app
  syncs: `clinical_notes`, `prescriptions`, `patient_vitals`, `patient_billing_items`,
  `patient_documents`. These are **not** the web dashboard's `vitals` and `documents` tables,
  which are separate tables with their own schema. Each table is guarded with `to_regclass()`,
  and there is a partial index on `(patient_id) WHERE deleted_at IS NULL` for each one.
- `clinical_notes.deleted_at` already existed from Migration 36 (`supabase-phase2-schema-migration.sql`).
  `prescriptions.deleted_at` came only from `supabase-slice-i-prescriptions-migration.sql`,
  which is in the excluded conflicting-duplicates set above. The API server's
  `/api/prescriptions` routes already filter on it, so this migration is now what guarantees
  the column exists.
- Adds `public.soft_delete(p_table text, p_id uuid) returns text`, a `SECURITY DEFINER` RPC.
  It is the supported way for staff to soft-delete, and **no RLS policy is added or changed**.
  The function checks the caller's role with `auth_role()` (notes: an admin, or the doctor
  who wrote the note or a note with no author; prescriptions: doctor or admin; vitals, billing
  items and documents: doctor, nurse or admin; front desk is refused). It sets only
  `deleted_at`/`deleted_by`, writes an `audit_log` row (`action = 'soft_delete'`) in the same
  transaction, and returns `deleted`, `already_deleted` or `not_found`. A refusal raises
  SQLSTATE `42501`. Execute is granted to `authenticated` and `service_role` and revoked from
  `anon`. The migration file header explains why this approach was chosen over widening
  UPDATE policies.
- Readers: the iOS pull selects `deleted_at` and removes local copies of deleted rows. The
  web dashboard and API server add `.is('deleted_at', null)` to every read of these tables.

### Migration 88 — `supabase-news2-scale2-migration.sql` (NEWS2 SpO₂ Scale 2 opt-in)

- Adds `patients.news2_spo2_scale2 boolean not null default false`, guarded with
  `to_regclass('public.patients')` and `ADD COLUMN IF NOT EXISTS`. No new table, so the
  existing `patients` grants and RLS policies cover it.
- The column holds the iOS `Patient.news2UseSpO2Scale2` flag: a clinician's opt-in to RCP NEWS2
  SpO₂ Scale 2 for confirmed hypercapnic respiratory failure. Default `false` means Scale 1.
  The flag already synced over peer sync and NAS backup. This column lets devices that only
  sync through Supabase agree on it.
- iOS (`SyncService+NEWS2Scale2.swift`): the patient pull selects the column and falls back to
  the old column list if the server does not have it yet. The flag is pushed in its own
  `update`, which fails harmlessly and is retried on the next sync until this migration is
  applied. The web dashboard and API server do not read or write the column.

### Migration 89 — `supabase-staff-only-rls-migration.sql` (staff-only RLS, security finding S-2)

Why: patient-portal users are Supabase Auth users in this same project (invited from
`api-server/src/routes/portal.ts`). Two things gave them staff-level database access with their
own JWT:

1. Many staff policies only tested "is authenticated" (`auth.uid() is not null`,
   `using (true)`, `auth.role() = 'authenticated'`). Postgres ORs permissive policies, so the
   portal's "own row" policies restricted nothing. Examples: `staff_select_patients`,
   `staff_select_documents`, `staff_all` on `appointment_requests`, and the staff policies on
   the `clinical-attachments`, `patient-documents`, `patient-photos` and `call-recordings`
   storage buckets.
2. `handle_new_user()` in `supabase-schema.sql` gave **every** new auth user a `user_profiles`
   row with role `front_desk`, including every invited portal patient. So policies that did
   check `auth_role()` also treated portal patients as front-desk staff.

What it does (idempotent; every table is guarded with `to_regclass()`):

- **`handle_new_user()`** now creates a profile only when `app_metadata.staff_role` is one of
  the four staff roles. Only the service role can set `app_metadata`. `supabase-schema.sql`
  carries the same definition.
- **Revokes the auto-created profiles.** A `user_profiles` row is moved to the new, admin-only
  table `public.user_profiles_revoked` and deleted when all of these are true:
  - its role is `front_desk`;
  - `full_name` is null and the row was never edited;
  - the auth user is linked to `patients.auth_user_id` or has no password (portal users sign
    in by magic link or OTP; every staff app uses a password);
  - it was not revoked before.

  A row an admin restored is therefore never revoked again. The step raises a `NOTICE` with
  the count, plus the number of portal-linked accounts that still hold a staff role, for
  manual review.
- **Explicit rewrites** (names unchanged, so `lint:rls-policies` still sees them):
  `staff_select_patients`, `staff_insert_patients`, `staff_select_documents`,
  `staff_insert_documents`, `staff_update_documents`, `appointment_requests.staff_all` and
  `appointment_change_requests.staff_manage_change_requests`. `staff_update_documents` also
  closes a patient write path: portal uploads are registered with `created_by` set to the
  patient, and the old `created_by = auth.uid()` rule let the patient rewrite that row.
- **A table-driven sweep** over about 55 PHI and operational tables. It rewrites each
  permissive policy for `public` or `authenticated` whose `USING` and `WITH CHECK` are exactly
  one of "is authenticated", keeping the name and command. This also catches policies applied
  by hand in production, such as the conflicting-duplicate tables above.
- **Storage** staff policies are recreated with the staff check.
- **Front desk may edit a patient's admin and intake details.** Front desk does patient intake
  on the iPad, so the patient-reported history it captures is allowed.
  - `staff_update_patients` replaces `doctors_update_patients`, which covered doctor, nurse and
    admin only. Before, a front-desk update silently changed 0 rows.
  - The BEFORE UPDATE trigger `patients_front_desk_column_guard`
    (`enforce_front_desk_patient_columns()`) raises SQLSTATE `42501` when a `front_desk`
    caller changes a column outside the allow-list. It compares `OLD` and `NEW` with
    `IS DISTINCT FROM`, so a full-row update whose clinical values are unchanged still
    succeeds. The error names the blocked columns, never their values.
  - Allow-list:
    - identity and contact: `full_name`, `first_name`, `last_name`, `date_of_birth`, `sex`,
      `phone`, `email`, `address`, `quarter`, `occupation`, `photo_url`, `mrn`, `nhi_number`;
    - next of kin: `nok_name`, `nok_relation`, `nok_phone`, `emergency_contact`,
      `emergency_phone`;
    - insurance and referral: `insurance_provider`, `policy_number`, `pre_auth_status`,
      `referred_by`;
    - scheduling: `check_in_time`, `encounter_status`, `setting`, `location`,
      `operation_date`, `visit_type`;
    - patient-reported intake: `chief_complaint`, `pmh_notes` (includes the questionnaire's
      `MEDICATIONS:` line), `family_history_notes`, `surgical_history`, `allergies_json`,
      `height_cm`;
    - bookkeeping: `updated_at`, `updated_by`.
  - Everything else is blocked for front desk, including any column added later. That covers
    `hpi`, `assessment_text`, `working_diagnosis`/`working_diagnosis_icd`, `management_plan`,
    `exam_*`, `investigations_json`, `pmh_entries_json`/`pshx_entries_json`, `social_history`,
    the procedure-form `*_data_json` columns, `acuity`, `mallampati_score`,
    `news2_spo2_scale2`, `pathway_data_json`, `ward`/`bed_number`, and the portal link
    `auth_user_id`/`portal_*`.
  - Nurse, doctor and admin are not affected. Neither is the service role: the API server has
    no `auth.uid()`, so the trigger lets it through. Note that this means
    `PATCH /api/patients/:id` is not restricted by the trigger.
  - `patients.visit_type` is pushed by the iOS app but no migration in this tree adds it
    (production has it). The allow-list entry is harmless where the column is missing.
- **Portal patients may edit their own contact details only.** `patients_update_own_contact`
  let a portal patient update any column of their own row, including name, date of birth,
  MRN, clinical fields and `auth_user_id`. The BEFORE UPDATE trigger
  `patients_self_update_column_guard` (`enforce_patient_self_update_columns()`) applies to a
  signed-in caller with no staff role (`auth.uid()` set, `auth_role()` null), which after this
  migration means a portal patient. It raises `42501` when that caller changes a column outside:
  - contact: `phone`, `email`, `address`;
  - next of kin: `nok_name`, `nok_relation`, `nok_phone`, `emergency_contact`,
    `emergency_phone`;
  - the other fields the portal profile page (`artifacts/front-desk/app/patient/profile/page.tsx`)
    already saves: `photo_url`, `blood_group`, `height_cm`, `weight_kg`. Without them the
    portal's profile save would fail;
  - bookkeeping: `updated_at`, `updated_by`.
- **Verified locally** (PGlite, every wired migration applied in runner order, this file applied
  twice). As front desk: a phone change and a change of every intake column succeed; a full-row
  update with unchanged clinical values succeeds; `hpi`, `acuity`, working diagnosis/ICD,
  exams, plan, social history, investigations, procedure JSON, mallampati, Scale 2, pathway
  data, ward/bed and `auth_user_id` each fail with `42501`. As a portal patient: contact, NOK,
  emergency contact and the portal profile fields succeed; `full_name`, `date_of_birth`, `mrn`,
  `hpi`, `allergies_json`, `auth_user_id` and `portal_enabled` fail with `42501`; another
  patient's row changes 0 rows. Doctor and service role updates are unaffected.
- **The new predicate is** `(select auth_role()) in ('front_desk','nurse','doctor','admin')`.
  `auth_role()` returns NULL for a user with no profile row, so such a user gets no access.

What it deliberately leaves alone:

- every patient self-access policy (`patients_select_own`, `patients_update_own_contact`,
  `patients_select_own_*`, `patients_insert_own_*`, `patients_{upload,select,delete}_own_docs`);
- anon intake policies and `service_role` policies;
- `clinical_notes`, whose policies were already restricted to doctor, admin and nurse;
- reference tables with no patient data (`questionnaire_templates`, `question_bank`,
  `branching_rules`, `clinical_guidelines`).

Staff impact: none for anyone with a staff `user_profiles` row, because all four roles pass the
new predicate. That covers the dashboard, the front-desk staff portal and the iOS app. Anyone
signed in **without** a profile row loses access.

**Before running**, list the accounts that would be affected and confirm none is a real staff
member:

```sql
select u.email, up.role, up.full_name, up.created_at, up.updated_at,
       exists (select 1 from patients p where p.auth_user_id = up.id) as portal_linked,
       coalesce(u.encrypted_password, '') = '' as no_password
from user_profiles up join auth.users u on u.id = up.id
where up.role = 'front_desk' and up.full_name is null
  and up.updated_at <= up.created_at + interval '1 second'
  and (exists (select 1 from patients p where p.auth_user_id = up.id)
       or coalesce(u.encrypted_password, '') = '');
```

Set a `full_name` on any real staff member in that list first. Also check that every staff
account has a profile, since staff without one are locked out after this migration:
`select u.email from auth.users u left join user_profiles up on up.id = u.id where up.id is null;`

**Restore a revoked profile.** If the account is a staff member who is also linked as a portal
patient, unlink the patient record first.

```sql
insert into user_profiles (id, full_name, role, default_site)
select id, '<name>', role, default_site from user_profiles_revoked where id = '<uuid>';
```

**Staff onboarding after this migration.** New auth users no longer get a profile
automatically. After creating the user, an admin must do one of the following:

- run `insert into user_profiles (id, full_name, role) values ('<auth uuid>', '<name>', '<role>');`
- create the user with the admin API and `app_metadata: { staff_role: '<role>' }`.

Until then the user can sign in but cannot see any data.

**iOS front desk.** The iPad intake writes `chief_complaint`, `pmh_notes`, `surgical_history`
and `allergies_json`, all now allowed. The iOS app also copes with a refusal:

- a front-desk push (role confirmed from `user_profiles`) leaves the blocked columns out of the
  patient UPDATE, so a stale local copy of a clinical field cannot cause a refusal
  (`FrontDeskPatientColumns` in `SyncService+AppointmentSync.swift` mirrors the allow-list; keep
  them in step);
- `SyncService.sync()` runs each step on its own, and each push loop handles errors per record.
  A `42501` marks that record refused: it keeps its local data and `pendingSync`, is not
  retried until the next sign-in or app launch, and the sync status shows "1 change not
  permitted for your role".

Open issue: the questionnaire also writes `hpi` and creates a pre-visit `clinical_notes` row.
`hpi` stays blocked for front desk, and `doctors_insert_clinical_notes` (older than this
migration) lets only doctor and admin insert notes. So from a front-desk device the
patient-reported HPI and the pre-visit note stay on the device (and travel over peer sync),
not to the cloud. Before this change the refused note insert also aborted the rest of every
sync cycle; now only that note is held back.

**Deploy order.** The API-side fixes for S-1 and S-3 (a staff role is required on
`/api/staff/*` and on `requireStaffAuth`) check `user_profiles`. Until this migration runs,
portal patients invited earlier still hold the auto-created `front_desk` profile. Run this
migration together with, or soon after, that deploy.

**Base schema.** `supabase-schema.sql` still creates the old open policy definitions. They
are overridden here, so this step must stay after every step that creates those policies.
`lint:rls-policies` now fails if the last definition of a required policy, in runner order, is
"any authenticated user".

### Migration 90 — `supabase-deferred-forward-refs-migration.sql` (deferred forward references)

- Creates `patients_select_own_sessions` on `questionnaire_sessions`, which Migration 2
  referenced before Migration 3 created the table. Migration 2 now skips it when the table is
  missing, so a fresh run no longer fails at step 2.
- Appended last so no applied step is renumbered. Idempotent, and a no-op on production,
  which already has the policy. It is a patient own-row policy, which Migration 89 leaves
  alone, so running after 89 is safe.
- For a future forward reference, do the same with a new step appended at the end: guard the
  early step and create the object in the new file.
