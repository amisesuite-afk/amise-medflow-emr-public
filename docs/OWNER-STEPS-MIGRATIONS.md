# Database updates still to apply on the live database — owner steps

Done so far on the live database (Amise-frontdesk, production): Migration 92 (`patients.visit_type`)
and Migration 93 (iOS sync columns), both on 2026-09-25.

Still to apply: Migrations 87, 88, 90, 91, 94, 95, 96, 97 (safe, additive) and 89 (staff-only access; needs checks
first and should go with the deploy to `main`).

How to run one file, every time:

1. On the iPad, open the file's link below in Safari, select all (⌘A), copy (⌘C).
2. Supabase → project **Amise-frontdesk** → **SQL Editor** → new query tab (+) → paste (⌘V) → **Run**.
3. Expect **"Success. No rows returned"** (Migration 89 may also show notices). Send a screenshot if
   anything else appears, and stop there.

Every file is safe to run twice: a second run changes nothing.

## Part 1 — any time (additive, no access changes)

First, one read-only check (the soft-delete function in 87 writes an audit row; your live audit
table must have these columns):

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'audit_log'
  and column_name in ('action', 'details', 'user_id', 'user_email', 'resource_type', 'resource_id', 'patient_id');
```

Expect 7 rows. If fewer, send the screenshot before running 87 (88, 90 and 91 can still go ahead).

| Order | Migration | What it adds | Link |
|---|---|---|---|
| 1 | 87 Soft delete | `deleted_at`/`deleted_by` on notes, prescriptions, vitals, billing, documents, and a `soft_delete()` function that checks the caller's role and writes the audit log. Deleting on iPhone/iPad then reaches the server instead of staying on the device. | [supabase-soft-delete-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-soft-delete-migration.sql) |
| 2 | 88 NEWS2 Scale 2 | `patients.news2_spo2_scale2` (default off), so the SpO₂ Scale 2 choice syncs between devices. | [supabase-news2-scale2-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-news2-scale2-migration.sql) |
| 3 | 90 Deferred references | A portal policy that already exists on production; a no-op there. Run it for completeness. | [supabase-deferred-forward-refs-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-deferred-forward-refs-migration.sql) |
| 4 | 91 Web vitals NEWS2 fields | `avpu` and `on_supplemental_o2` on the web `vitals` table, so web NEWS2 is complete. | [supabase-web-vitals-news2-fields-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-web-vitals-news2-fields-migration.sql) |
| 5 | 94 Outcomes and calibration | Two new tables, `prediction_snapshots` and `diagnosis_outcomes` (nurse, doctor and admin only; front desk and portal see nothing), so completed visits keep what the engines predicted and the final diagnosis can be recorded later. Until it runs, visits still close normally and the screens say the feature waits for this update. | [supabase-outcomes-calibration-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-outcomes-calibration-migration.sql) |
| 6 | 95 Clinical sign-off | One new table, `clinical_signoffs` (doctor and admin record decisions in their own name; nurses can read them; front desk and portal see nothing; decisions can never be changed or deleted, only followed by a new one), so the Insights → Clinical sign-off page can record your approvals. Until it runs, the page shows the items read-only. | [supabase-clinical-signoffs-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-clinical-signoffs-migration.sql) |
| 7 | 96 Lab results feed and reference ranges | Three new tables: `lab_reference_ranges` (seeded with the built-in defaults, each marked "default — replace with your laboratory's ranges"; staff read, admin edits in Settings), `lab_feed_messages` (log of messages from the laboratory, no message bodies) and `lab_results_to_reconcile` (results that did not match a patient exactly; nurse, doctor and admin only — front desk sees nothing), plus three provenance columns on `investigation_results`. Until it runs, the laboratory's messages are refused with "retry later" and the app uses the built-in default ranges. Independent of 94 and 95. | [supabase-lab-feed-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-lab-feed-migration.sql) |
| 8 | 97 Appointment type on patients | One new column, `patients.appointment_type`, which the iPad front-desk scheduler already writes locally; front desk may set it (added to the Migration 89 allow-list). Run it before 89. | [supabase-patients-appointment-type-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-patients-appointment-type-migration.sql) |

After Part 1, on the iPhone: Settings → Sync Now. Nothing else changes for users.

After 94: close one test encounter on the web, then check a row appears:

```sql
select encounter_id, created_at from prediction_snapshots order by created_at desc limit 1;
```

After 95: open Insights → Clinical sign-off. The note "Recording decisions becomes available after the
database update" should be gone. Optionally, this should return one row with `rls_enabled = true`:

```sql
select relname, relrowsecurity as rls_enabled from pg_class where relname = 'clinical_signoffs';
```

After 96: check the default ranges are there (expect 37), then follow the go-live checklist in
`docs/LAB-FEED.md` §8 before giving the laboratory its secret:

```sql
select count(*) from lab_reference_ranges where is_default;
```

## Part 2 — Migration 89, staff-only access (on deploy day)

What it does: only accounts with a staff role (front desk, nurse, doctor, admin) can read or change
patient data. Patient-portal accounts see only their own record. New sign-ups no longer become
"front desk" automatically. Front desk can edit admin and intake details only (your decision of
2026-09-25).

Why wait for deploy day: the API server changes that go with it are on this branch, not yet on
`main`. Run 89 on the same day as the deploy, after the two checks below.

### Check A — accounts that will lose their automatic "front desk" role

Paste and run:

```sql
select u.email, up.role, up.full_name, up.created_at,
       exists (select 1 from patients p where p.auth_user_id = up.id) as portal_linked,
       coalesce(u.encrypted_password, '') = '' as no_password
from user_profiles up join auth.users u on u.id = up.id
where up.role = 'front_desk' and up.full_name is null
  and up.updated_at <= up.created_at + interval '1 second'
  and (exists (select 1 from patients p where p.auth_user_id = up.id)
       or coalesce(u.encrypted_password, '') = '');
```

Every row should be a patient, not a member of staff. If a real staff member appears, send me the
screenshot before going on (the fix is to give them a name in `user_profiles` first).

### Check B — staff accounts with no profile (they would be locked out)

```sql
select u.email from auth.users u left join user_profiles up on up.id = u.id where up.id is null;
```

Every email listed must be a patient or unused. For any staff member listed, send me the screenshot
first.

### Run Migration 89

[supabase-staff-only-rls-migration.sql](https://raw.githubusercontent.com/amisesuite-afk/amise-medflow-emr-public/claude/pr-37-gbg22z/supabase-staff-only-rls-migration.sql)

Then sign in on the dashboard, the front-desk staff pages and the iPhone/iPad, and check each can
see today's patients. If anyone cannot, send a screenshot; access is restored with one SQL line
(see `migrations/README.md` → Migration 89 → "Restore a revoked profile").

### Known effect to be aware of

A front-desk device cannot send the patient-reported HPI or the pre-visit note to the cloud; they
stay on the iPad and reach your devices through nearby sync. This is an open decision for you
(whether front desk may write those two items).

## Adding staff after Migration 89

A new staff member signs up, then you (or I) add their role once:

```sql
insert into user_profiles (id, full_name, role)
values ('<their auth user id>', '<Full Name>', 'front_desk');   -- or nurse / doctor / admin
```
