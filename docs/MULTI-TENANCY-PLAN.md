# Multi-tenancy plan: selling MedFlow to other practices

| | |
|---|---|
| Status | **Plan only.** No code has been written for this. 2026-09-25, against `cc83845` |
| Audience | The surgeon-owner (decisions, cost, risk) and a future developer (what to change, in what order) |
| Related | `docs/compliance/security-controls.md` (G-1), `docs/compliance/README.md` (A-21), `migrations/README.md`, `CLAUDE.md` ("Auth model is single-tenant, role-based") |

Effort sizes are relative: **S** is days, **M** is one to three weeks, **L** is one to two months, **XL** is more than that. They assume one developer who knows the codebase.

## 1. Where things stand

- **One Supabase project serves one practice.** Access control is by staff role (`user_profiles.role` through `auth_role()`). Once Migration 89 is applied, every staff member can read every patient, and portal patients can read only their own rows. Nothing in the schema says which practice a row belongs to.
- **What is configurable today:**
  - **iOS**: `PracticeProfile` (`ios/AmiseMedFlow/Services/PracticeProfile.swift`, Settings → Practice). It holds practice and clinician name, credentials, specialty, sites, phone, email, country, time zone and letterhead lines. It is stored **per device** in UserDefaults and defaults to Amise.
  - **API environment variables**: phone lines (`PRACTICE_PHONE`, `PRACTICE_LINE_*`, `WHATSAPP_NUMBERS`, `FORWARD_TO_NUMBERS`), Google (`GMAIL_USER`, `CALENDAR_ID_RODNEY_BAY`, `CALENDAR_ID_TAPION_ERCP`), notification addresses, `MODE`, `DISABLE_AI`, `CLAUDE_MODEL`. The calendar variable names themselves are Amise site names.
- **Still hard-coded to Amise** (a search for Kabiye, Tapion, Rodney Bay, 758, Amise and St Lucia in `artifacts/` and `lib/`):

| Where | Examples | Size |
|---|---|---|
| api-server | AI system prompts naming the practice and Dr Kabiye (`lib/claude.ts`, `routes/generate-letter.ts` and the other document routes); the letterhead constant in `generate-letter.ts`; prep templates and phone numbers (`lib/sms.ts`); `TZ = 'America/St_Lucia'` (`lib/calendar.ts`) | about 20 source files |
| front-desk | Public pages (services, pathway, privacy, kiosk), booking emails and instructions (`lib/instructions.ts`, `lib/email.ts`), `lib/constants.ts`, the intake assistant prompt (`lib/claude.ts`) | about 30 files |
| dashboard | Header, report and letter generators, prep cards, theatre list, notify modal | about 30 files |
| Shared engine | `lib/triage-engine/src/rules.ts`: `Location = 'rodney_bay' \| 'tapion' \| 'remote'` and `SLOT_RULES`; Saint Lucia content in the formulary and screening | 7 files |
| Database | `site` CHECK constraints `('rodney_bay','tapion')` (`supabase-schema.sql` and later migrations); the MRN trigger prefix `AM-` (`supabase-call-logs-add-practice-line.sql`); `patients.mrn` unique across the whole table; the staff seed with Amise staff emails (Migration 84, `supabase-user-profiles-seed.sql`) | |
| iOS | `SupabaseConfig.swift` (fixed project URL and anon key); `ClinicalLocation` enum (Rodney Bay, Tapion, OKEU, Victoria), which is persisted and synced, so it cannot simply be renamed; MRN prefix `AMF-` (`MRNGenerator.swift`) | |
| Infrastructure | `PROJECT_REF` in `run-migrations.yml`; the Supabase URL in `deploy-dashboard.yml`, `deploy-frontend.yml` and `deploy-pages.yml`; the Render URL in `cron.yml`; `render.yaml` service name | |
| Time zone | `America/St_Lucia` in about 40 web and API files | |

Clinical content written for Saint Lucia (formulary brands, epidemiology, prep protocols the surgeon signed) is a **per-market and per-surgeon review**, not a tenancy problem. Each new surgeon must sign off their own prep text and bowel-prep regimens.

## 2. Option A: one Supabase project per practice ("silo")

Each practice gets its own Supabase project, Render service, two Vercel projects (dashboard and front-desk), and its own Google Workspace, Twilio and Sentry accounts. The iOS app is shared and finds the right project at sign-in. The data model stays single-tenant, so Migration 89 and every existing RLS policy stay correct as written.

**Work needed**

| # | Work | Size |
|---|---|---|
| A1 | **Practice settings for web and API.** A one-row `practice_settings` table: identity, clinician, letterhead, phones, time zone, MRN prefix, AI prompt fragments. A `sites` table referenced by a foreign key replaces the `site` CHECK constraints and the `Location` type. Replace every hard-code in the table above, and add a CI lint that fails on "Kabiye", "Tapion", "Rodney Bay" or a `+1758` number outside the config and seed files. Rename the calendar variables to per-site config | **L** |
| A2 | **Deploy per tenant.** One GitHub Environment per practice, holding `PROJECT_REF`, the URLs and the secrets. Parameterise the deploy, cron and backup workflows by environment. One Render blueprint and two Vercel projects per practice. A provisioning checklist (runbook) covering every variable in `CLAUDE.md`, starting with `MODE=dry_run` and `DISABLE_AI=true` until that practice's agreements are signed | **M** |
| A3 | **Migration runner per project.** Run `run-migrations.yml` as a matrix over the practice environments. Move the Amise staff seed (Migration 84) out of the shared runner into a per-practice seed. **Blocker for a new project:** a database built only from the runner still lacks `audit_log`, `patient_problems`, `mm_cases`, `pmh_items` and `conversation_threads` (`migrations/README.md`, "Steps that cannot fully apply on a fresh database"). So a new practice would get **no audit triggers**. The conflicting duplicate definitions must be resolved and wired in first. `check:migrations-fresh` already proves a new project can be built from empty; add an assertion that those tables exist | **M** |
| A4 | **iOS picks the project at sign-in.** See below | **M** |
| A5 | **Per-practice operations.** A `/api/healthz` field reporting the last applied migration, so drift between tenants shows up. Backups, the secret rotation list and the incident runbook become per practice | **S** |

**How the iOS app would pick a practice.** Recommended: a **practice code at sign-in**.

1. The first screen asks for a short practice code (for example `AMISE-LC`), then email and password.
2. The app looks the code up in a small public directory: a static JSON file on a host the vendor controls, or a tiny central Supabase project. It returns the project URL, the anon key (public by design) and the practice's display name and logo. Store the result in the Keychain. Changing practice requires signing out.
3. `SupabaseConfig` becomes an instance built from that entry instead of static constants. `PracticeProfile` is read from the server's `practice_settings` (cached for offline use) instead of being edited per device.
4. The SwiftData store, the offline outbox, tombstones and sync refusals are **kept per practice** (one store file per practice code). A clinician who works for two practices must never see one practice's patients while signed in to the other.
5. Peer sync includes the practice code in its manifest and refuses a peer from another practice. This complements S-5, which is still open. NAS backup paths include the practice code.

Alternatives considered: looking up the practice by email domain (fails for clinicians on Gmail addresses), or a separate white-label app build per practice (App Store overhead per customer; only worth it for a large customer).

**Cost and operations.** Each practice adds a Supabase project (paid plan; PITR is an extra add-on), a Render web service and Vercel projects, plus that practice's own Twilio numbers, Google Workspace and Sentry. The practice pays its messaging and Workspace costs. Hosting is roughly **tens of US dollars per practice per month** before PITR (**to confirm** against current price lists). The real cost is operations: N migration runs, N sets of secrets, N backups to watch. That is manageable for 2-5 practices and painful beyond about 10 without automation.

**What Option A gives for free:** hard isolation (a bug cannot leak across practices), per-practice data residency (a UK or EU customer can have its project in-region), independent restore and deletion, and a simple story for each practice's data-protection agreement.

## 3. Option B: one shared database, `practice_id` on every PHI table

**Schema changes**

- New `practices` table. New `practice_members (user_id, practice_id, role)`, replacing the single `user_profiles.role`, so one person can belong to two practices with different roles.
- Add `practice_id uuid not null references practices` to every PHI table. The list is Migration 89's sweep list (`phi_tables` in `supabase-staff-only-rls-migration.sql`), plus the tables it leaves to their own policies:
  - core: `patients`, `encounters`, `vitals`, `symptoms`, `medications`, `allergies`, `procedures`, `referrals`, `appointments`, `appointment_requests`, `appointment_change_requests`, `confirmed_appointments`, `pending_bookings`, `consultation_requests`, `referring_providers`;
  - clinical: `clinical_notes`, `documents`, `billing_charges`, `imaging_orders`, `investigation_results`, `surgical_history`, `toxic_habits`, `ros_findings`, `scales_scores`, `dashboard_prescriptions`, `prescriptions`, `operative_notes`, `trauma_records`, `clinical_attachments`, `patient_tasks`, `pmh_items`, `patient_problems`, `wound_assessments`, `mm_cases`, `clinical_states`, `clinical_state_transitions`, `clinical_facts`, `active_alerts`, `encounter_state_history`;
  - iOS-synced: `patient_vitals`, `patient_operative_plans`, `patient_billing_items`, `patient_documents`;
  - intake and messaging: `questionnaire_sessions`, `questionnaire_responses`, `patient_intake`, `intake_summaries`, `call_logs`, `procedure_prep_drafts`, `conversation_threads`, `patient_accounts`;
  - workflow and identity: `escalation_events`, `patient_identifiers`, `duplicate_queue`, `calendar_event_cache`, `patient_token_blacklist`, `ai_proposals`, `workflow_tasks`, `theatre_sessions`, `theatre_cases`, `sync_conflicts`;
  - audit and operations: `audit_log`, `audit_logs`, `clinical_audit_log`, `backup_runs`.
- Reference tables (`questionnaire_templates`, `question_bank`, `branching_rules`, `clinical_guidelines`) stay global, with an optional per-practice override later.
- Uniqueness becomes per practice: `unique (practice_id, mrn)` instead of a global unique MRN, and the MRN trigger counts within the practice and takes its prefix from `practice_settings`.
- Storage objects move under a `<practice_id>/` path prefix, and the bucket policies check it.
- Every table gets a `(practice_id, ...)` index that leads its common queries.

**Auth model change**

- The active practice travels in the JWT (`app_metadata.practice_id`, or a Supabase custom access-token hook that reads `practice_members`). Add `auth_practice_id()` beside `auth_role()`, and make `auth_role()` return the role *in the active practice*.
- Every staff policy becomes `practice_id = (select auth_practice_id()) and (select auth_role()) in (...)`. Portal patients' own-row policies also check the practice. The Migration 89 column guards, `soft_delete()` and `handle_new_user()` become practice-aware.
- **The API server is the hard part.** It connects as `service_role`, which bypasses RLS, so every query must filter by practice itself, or leak. Options:
  1. PHI reads run through a client built from the caller's JWT, so RLS applies.
  2. A wrapper, `sbForPractice(req)`, that always adds `.eq('practice_id', …)`, plus a CI lint that bans raw `sb().from('<phi table>')`.

  Use both. Machine callers (`STAFF_MACHINE_TOKEN`, `CRON_SECRET`, webhooks) need an explicit practice: cron loops over practices, and a webhook resolves the practice from the receiving phone number or inbox.
- Integration credentials (Gmail, Calendar, Twilio) become per practice: a `practice_integrations` table with secrets in Supabase Vault, not environment variables.
- iOS: pulls filter by practice, payloads carry `practice_id`, and the store is partitioned by practice as in Option A.

**Migration strategy** (expand, then contract, so old iOS builds keep working):

1. Create `practices` and `practice_members`. Insert Amise and copy `user_profiles` into `practice_members`.
2. Add `practice_id` as nullable, back-fill every row with Amise's id, and set a column default of `auth_practice_id()` so older clients still write valid rows. Then set `NOT NULL` and add the indexes.
3. Rewrite the policies with a table-driven sweep, the same technique Migration 89 uses on `pg_policies`.
4. Move storage objects under the practice prefix, and update the signed-URL code.
5. Deploy the API wrapper and lint, the dashboard, front-desk and iOS changes. Only then onboard a second practice.
6. Contract: remove the default once every client sends `practice_id`.

**Testing: extend the fresh-database check.** `scripts/src/check-migrations-fresh.ts` already builds the whole schema in PGlite with stubbed `auth.uid()` and `auth.jwt()`. Add a cross-tenant isolation stage:

- Create practices A and B. Give each a user per staff role and a portal patient, and seed one row per PHI table and one object per bucket in each practice.
- For each user, set `role authenticated` and the JWT claims, then assert, for **every** table in the list: SELECT returns none of the other practice's rows; INSERT or UPDATE with the other practice's `practice_id` fails; `soft_delete()` on the other practice's row is refused; bucket objects outside the user's own prefix are invisible.
- A catalogue assertion: every table with a `patient_id` column has `practice_id NOT NULL`, and every policy on it references `auth_practice_id()`. Add a `lint:tenant-columns` in the style of `lint:grants`, so a new table cannot ship without `practice_id`.
- API tests with two practices, asserting that each PHI route returns only the caller's practice rows.

**Size: XL overall** (schema and policies L, API audit and wrapper L, iOS M, tests M). Every route and every direct dashboard query (`db.ts` makes about 65 direct Supabase calls) must be checked.

## 4. Recommendation

**Use Option A for the first 2–3 pilot practices. Build the practice-configuration layer (Phases 1–3) once, because Option B needs it too. Revisit Option B only when there are more than about 5–10 practices, or when silo operations cost more than the rewrite.** Option A also gives each practice in-region hosting and a clean data-protection story, which matter for UK and EU buyers. Option B's main failure mode, a service-role query that forgets its practice filter, is a silent mass breach.

**Phased steps**

| Phase | Steps | Size |
|---|---|---|
| 0. Prerequisites, before any pilot | Apply Migrations 87–90 (A-25). Resolve the conflicting duplicate tables so a fresh project gets `audit_log` and the rest. Close S-5 (peer-sync authentication), S-6 (Sentry PHI) and G-5 (browser PHI on sign-out). A template data-processing agreement with each practice. The regulatory positioning decision for the target market (A-14). A CSO in post | M (engineering), plus legal and regulatory time |
| 1. De-Amise the web and API | `practice_settings` and `sites` tables, time zone, MRN prefix, templated AI prompts and letterheads, public pages; the staff seed moved out of the runner; the hard-code lint (A1) | L |
| 2. Tenant tooling | GitHub Environments, parameterised deploy, migrations, cron and backups; provisioning runbook; migration-version health field (A2, A3, A5) | M |
| 3. iOS practice code | Directory lookup, `SupabaseConfig` instance, store partitioned per practice, `PracticeProfile` from the server, peer-sync practice check (A4) | M |
| 4. First pilot | Provision practice 2 in `dry_run` with `DISABLE_AI=true`. The new surgeon signs off their own prep text. Staff set up by explicit `user_profiles` rows. Then switch to `supervised` | S per practice once 1–3 are done |
| 5. Later, only if needed | Option B | XL |

## 5. Risks

| Risk | Option | Mitigation |
|---|---|---|
| Cross-practice leak through the service-role API | B | User-JWT clients for PHI, the `sbForPractice` wrapper and lint, the isolation stage in the fresh-database check, a pen test before the second practice goes live |
| **Amise details in another practice's patient messages**, for example the wrong phone number in an "if unsure, call us" line | A, B | Phase 1 and the hard-code lint. Treat this as a patient-safety hazard: add it to `hazard-log.md` (H-11) before the first pilot |
| A migration applied to some practices and not others | A | Matrix runner, the migration-version health field, and one release checklist per practice |
| A clinician in two practices sees the wrong practice's patients on iOS | A, B | Store partitioned by practice code; sign out to switch; peer-sync practice check |
| Clinical content not valid for another market or surgeon | A, B | Per-market clinical review; per-surgeon sign-off of prep and bowel-prep text; pharmacist review (A-11) |
| Becoming a medical-device manufacturer and a data processor by selling | A, B | A-14 regulatory decision; DPAs and a subprocessor list per customer; the CSO signs the safety case before sale |
| Support and on-call load grows with each practice | A | Automate provisioning (Phase 2); cap the pilot count until it is automated |
| Staff locked out after Migration 89 in a new project | A | New projects create staff through the admin API with `app_metadata.staff_role` from the start (`migrations/README.md`, "Staff onboarding") |
