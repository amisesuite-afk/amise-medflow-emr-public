-- ============================================================================
-- Migration 96 — laboratory results feed + practice reference ranges
-- docs/LAB-FEED.md, docs/clinical-validation/changes/lab-feed.md
--
-- Number: 96. Migration 94 is the outcomes loop; 95 is the clinical sign-off register
-- (supabase-clinical-signoffs-migration.sql). This file does not depend on 94 or 95.
--
-- WHY
--   The practice owner approved (1) practice-configured reference ranges, read by every range,
--   ULN and critical-limit consumer in the app, and (2) automatic lab results from the
--   laboratory (FHIR R4 / HL7 v2 ORU^R01) with safe patient matching and a clinician review
--   inbox. Nothing here changes a score, an engine or a diagnosis weight.
--
-- WHAT
--   public.lab_reference_ranges   analyte (catalogue saved name), unit, sex, age band, lower,
--                                 upper, critical low / high, lab source, effective date.
--                                 Seeded with the defaults of lib/triage-engine/src/reference-
--                                 ranges.ts, marked is_default and "default — replace with your
--                                 laboratory's ranges". Rows are retired, never deleted.
--   public.lab_feed_messages      one row per inbound message: lab id, message control id /
--                                 bundle id (unique per lab: idempotency), format, received at,
--                                 status, counts, error code. NO message body: see below.
--   public.lab_results_to_reconcile
--                                 reports that did not match exactly one patient on MRN + date
--                                 of birth, with the identity as received and the normalised
--                                 observations, for a nurse / doctor / admin to match by hand.
--   public.investigation_results  + source ('lab-feed'), lab_feed_message_id, lab_report_ref
--                                 (unique: the same report is never attached twice).
--
-- NO PHI BODY IN THE MESSAGE LOG (the choice asked for)
--   The raw HL7 / FHIR body is not stored. A matched report is stored as its investigation_
--   results row; an unmatched one as its reconciliation row, which keeps only what matching
--   needs (MRN, names, date of birth, sex as received) and the normalised observations. Both
--   are behind the clinician-only policies below. The log keeps the SHA-256 of the body and its
--   size, so what arrived can be proved against the laboratory's copy, and the laboratory keeps
--   the source message: a resend is safe (idempotent). Storing bodies would put a second, less
--   guarded copy of every report (with every identifier the lab sends) in an operational log.
--
-- ACCESS (Migration 89 role model)
--   lab_reference_ranges: every staff role reads (not PHI); only admin inserts / updates
--   (retire, never delete). The dashboard writes through the API, which audit-logs each change.
--   lab_feed_messages, lab_results_to_reconcile: nurse, doctor, admin read; front desk and
--   portal patients match no policy. Only the service role (API server) writes: the inbound
--   endpoint, and the audit-logged match / dismiss actions.
--
-- CLIENTS TOLERATE ITS ABSENCE
--   Until it runs: POST /api/lab-feed/inbound answers 503 (the laboratory retries); the dashboard
--   uses the built-in default ranges and says the practice ranges, the lab-feed inbox and the
--   reconciliation queue are available after the database update; nothing returns a 500.
--
-- Idempotent: IF NOT EXISTS everywhere, policies in do $guard$ blocks, constraints added only
-- when missing, seed rows inserted only when missing. Depends on patients,
-- investigation_results, auth_role() (all created by earlier steps).
-- ============================================================================

-- ── lab_reference_ranges ───────────────────────────────────────────────────────────────────
create table if not exists public.lab_reference_ranges (
  id              uuid        primary key default gen_random_uuid(),
  analyte         text        not null,
  unit            text        not null default '',
  sex             text        not null default 'any',
  age_min_years   numeric,
  age_max_years   numeric,
  lower_limit     numeric,
  upper_limit     numeric,
  critical_low    numeric,
  critical_high   numeric,
  lab_source      text        not null,
  effective_from  date        not null,
  is_default      boolean     not null default false,
  notes           text,
  retired_at      timestamptz,
  retired_by      uuid,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_by      uuid,
  updated_at      timestamptz not null default now()
);

-- ── lab_feed_messages ──────────────────────────────────────────────────────────────────────
create table if not exists public.lab_feed_messages (
  id              uuid        primary key default gen_random_uuid(),
  lab_id          text        not null,
  message_id      text        not null,
  format          text        not null,
  received_at     timestamptz not null default now(),
  processed_at    timestamptz,
  status          text        not null default 'received',
  report_count    integer     not null default 0,
  attached_count  integer     not null default 0,
  queued_count    integer     not null default 0,
  duplicate_count integer     not null default 0,
  critical_count  integer     not null default 0,
  error_code      text,
  error_detail    text,
  body_sha256     text        not null,
  body_bytes      integer     not null default 0,
  created_at      timestamptz not null default now()
);

-- ── lab_results_to_reconcile ───────────────────────────────────────────────────────────────
create table if not exists public.lab_results_to_reconcile (
  id                    uuid        primary key default gen_random_uuid(),
  message_id            uuid        not null references public.lab_feed_messages(id) on delete restrict,
  lab_id                text        not null,
  -- '<lab>:<report id>:<status>:<reported at>' — the same report is queued once.
  report_ref            text        not null,
  reason                text        not null,
  -- Identity exactly as the laboratory sent it (needed to match by hand).
  received_mrn          text,
  received_family_name  text,
  received_given_name   text,
  received_dob          date,
  received_sex          text,
  test_name             text        not null,
  collected_at          timestamptz,
  reported_at           timestamptz,
  performing_lab        text,
  -- Normalised observations (see artifacts/api-server/src/lib/lab-feed/types.ts), no raw body.
  observations          jsonb       not null default '[]'::jsonb,
  is_abnormal           boolean     not null default false,
  is_critical           boolean     not null default false,
  status                text        not null default 'open',
  matched_patient_id    uuid        references public.patients(id) on delete set null,
  matched_result_id     uuid        references public.investigation_results(id) on delete set null,
  resolved_by           uuid,
  resolved_at           timestamptz,
  resolution_note       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── investigation_results: lab-feed provenance ─────────────────────────────────────────────
alter table public.investigation_results
  add column if not exists source              text,
  add column if not exists lab_feed_message_id uuid,
  add column if not exists lab_report_ref      text;

-- ── Constraints (added only when missing) ──────────────────────────────────────────────────
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'lab_reference_ranges_shape_check') then
    alter table public.lab_reference_ranges add constraint lab_reference_ranges_shape_check
      check (length(analyte) between 1 and 60
             and length(unit) <= 30
             and sex in ('any', 'male', 'female')
             and length(btrim(lab_source)) between 1 and 200
             and (notes is null or length(notes) <= 500)
             and effective_from >= date '2000-01-01');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lab_reference_ranges_limits_check') then
    alter table public.lab_reference_ranges add constraint lab_reference_ranges_limits_check
      check ((lower_limit is not null or upper_limit is not null or critical_low is not null or critical_high is not null)
             and coalesce(lower_limit, 0) >= 0 and coalesce(upper_limit, 0) >= 0
             and coalesce(critical_low, 0) >= 0 and coalesce(critical_high, 0) >= 0
             and (lower_limit is null or upper_limit is null or lower_limit <= upper_limit)
             and (critical_low is null or lower_limit is null or critical_low <= lower_limit)
             and (critical_high is null or upper_limit is null or critical_high >= upper_limit)
             and (critical_low is null or critical_high is null or critical_low < critical_high)
             and coalesce(age_min_years, 0) >= 0 and coalesce(age_max_years, 1) > 0
             and (age_min_years is null or age_max_years is null or age_min_years < age_max_years));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lab_reference_ranges_default_check') then
    -- A default row always says so; a practice row never claims to be the default.
    alter table public.lab_reference_ranges add constraint lab_reference_ranges_default_check
      check (is_default = (lab_source = 'default — replace with your laboratory''s ranges'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lab_feed_messages_shape_check') then
    alter table public.lab_feed_messages add constraint lab_feed_messages_shape_check
      check (lab_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'
             and length(message_id) between 1 and 200
             and format in ('fhir-r4', 'hl7v2')
             and status in ('received', 'processed', 'queued', 'partial', 'duplicate', 'rejected', 'failed')
             and body_sha256 ~ '^[0-9a-f]{64}$'
             and body_bytes >= 0
             and report_count >= 0 and attached_count >= 0 and queued_count >= 0
             and duplicate_count >= 0 and critical_count >= 0
             and (error_code is null or error_code ~ '^[a-z0-9_]{1,40}$')
             and (error_detail is null or length(error_detail) <= 300));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lab_results_to_reconcile_shape_check') then
    alter table public.lab_results_to_reconcile add constraint lab_results_to_reconcile_shape_check
      check (lab_id ~ '^[a-z0-9][a-z0-9_-]{0,39}$'
             and length(report_ref) between 1 and 400
             and reason in ('no_identifier', 'mrn_not_found', 'dob_missing', 'dob_mismatch', 'multiple_matches')
             and length(test_name) between 1 and 200
             and (received_sex is null or received_sex in ('male', 'female', 'other', 'unknown'))
             and jsonb_typeof(observations) = 'array' and jsonb_array_length(observations) <= 200
             and (resolution_note is null or length(resolution_note) <= 500));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lab_results_to_reconcile_status_check') then
    alter table public.lab_results_to_reconcile add constraint lab_results_to_reconcile_status_check
      check (status in ('open', 'matched', 'dismissed')
             and ((status = 'open') = (resolved_at is null))
             and (status <> 'matched' or (matched_patient_id is not null and matched_result_id is not null))
             and (status <> 'dismissed' or length(btrim(coalesce(resolution_note, ''))) > 0));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'investigation_results_source_check') then
    alter table public.investigation_results add constraint investigation_results_source_check
      check ((source is null or source ~ '^[a-z][a-z0-9-]{0,30}$')
             and (lab_report_ref is null or (source = 'lab-feed' and length(lab_report_ref) between 1 and 400)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'investigation_results_lab_feed_message_fkey') then
    alter table public.investigation_results add constraint investigation_results_lab_feed_message_fkey
      foreign key (lab_feed_message_id) references public.lab_feed_messages(id) on delete set null;
  end if;
end
$c$;

-- ── Indexes ────────────────────────────────────────────────────────────────────────────────
create unique index if not exists lab_feed_messages_lab_message_key
  on public.lab_feed_messages (lab_id, message_id);
create index if not exists lab_feed_messages_received_idx
  on public.lab_feed_messages (received_at desc);

create unique index if not exists lab_results_to_reconcile_report_ref_key
  on public.lab_results_to_reconcile (report_ref);
create index if not exists lab_results_to_reconcile_open_idx
  on public.lab_results_to_reconcile (created_at desc) where status = 'open';

create unique index if not exists investigation_results_lab_report_ref_key
  on public.investigation_results (lab_report_ref) where lab_report_ref is not null;
create index if not exists investigation_results_lab_feed_unreviewed_idx
  on public.investigation_results (created_at desc) where source = 'lab-feed' and status = 'resulted';

-- One live row per analyte / sex / age band / effective date (practice and default kept apart).
create unique index if not exists lab_reference_ranges_live_key
  on public.lab_reference_ranges (analyte, sex, coalesce(age_min_years, -1), coalesce(age_max_years, -1),
                                  effective_from, is_default)
  where retired_at is null;

-- ── Seed: the built-in defaults (lib/triage-engine/src/reference-ranges.ts) ────────────────
-- Adults (18+). scripts/src/lab-feed-migration.test.ts fails if these differ from the code.
insert into public.lab_reference_ranges
  (analyte, unit, sex, age_min_years, age_max_years, lower_limit, upper_limit, critical_low, critical_high,
   lab_source, effective_from, is_default)
select v.analyte, v.unit, v.sex, 18, null, v.lo, v.hi, v.clo, v.chi,
       'default — replace with your laboratory''s ranges', date '2026-09-26', true
from (values
  ('WBC',            '×10⁹/L',        'any',    4.0::numeric, 11.0::numeric, null::numeric, null::numeric),
  ('Haemoglobin',    'g/dL',          'any',    null, null, 8.0,  null),
  ('Haemoglobin',    'g/dL',          'male',   13.0, 17.0, 8.0,  null),
  ('Haemoglobin',    'g/dL',          'female', 12.0, 15.5, 8.0,  null),
  ('Platelets',      '×10⁹/L',        'any',    150,  400,  50,   null),
  ('INR',            '',              'any',    0.8,  1.2,  null, 2.5),
  ('D-dimer',        'µg/L FEU',      'any',    null, 500,  null, null),
  ('CRP',            'mg/L',          'any',    null, 5,    null, null),
  ('Sodium',         'mmol/L',        'any',    135,  145,  120,  155),
  ('Potassium',      'mmol/L',        'any',    3.5,  5.3,  2.5,  6.0),
  ('Urea',           'mmol/L',        'any',    2.5,  7.8,  null, null),
  ('Creatinine',     'µmol/L',        'any',    null, null, null, 300),
  ('Creatinine',     'µmol/L',        'male',   59,   104,  null, 300),
  ('Creatinine',     'µmol/L',        'female', 45,   84,   null, 300),
  ('eGFR',           'mL/min/1.73m²', 'any',    60,   null, null, null),
  ('Calcium',        'mmol/L',        'any',    2.2,  2.6,  1.75, 3.0),
  ('Magnesium',      'mmol/L',        'any',    0.7,  1.0,  null, null),
  ('Glucose',        'mmol/L',        'any',    3.9,  7.8,  3.0,  20.0),
  ('A1c (glycated)', '%',             'any',    null, 5.6,  null, null),
  ('Bilirubin',      'µmol/L',        'any',    null, 21,   null, null),
  ('ALT',            'U/L',           'any',    null, 40,   null, null),
  ('AST',            'U/L',           'any',    null, 40,   null, null),
  ('ALP',            'U/L',           'any',    30,   130,  null, null),
  ('GGT',            'U/L',           'any',    null, 65,   null, null),
  ('Albumin',        'g/L',           'any',    35,   50,   null, null),
  ('Amylase',        'U/L',           'any',    null, 100,  null, null),
  ('Lipase',         'U/L',           'any',    null, 60,   null, null),
  ('LDH',            'U/L',           'any',    null, 200,  null, null),
  ('Lactate',        'mmol/L',        'any',    null, 2.0,  null, 3.9),
  ('Troponin I',     'ng/L',          'any',    null, 14,   null, 52),
  ('Troponin T',     'ng/L',          'any',    null, 14,   null, 52),
  ('Troponin',       'ng/L',          'any',    null, 14,   null, 52),
  ('CEA',            'ng/mL',         'any',    null, 5,    null, null),
  ('CA 19-9',        'U/mL',          'any',    null, 37,   null, null),
  ('AFP',            'ng/mL',         'any',    null, 10,   null, null),
  ('CA-125',         'U/mL',          'any',    null, 35,   null, null),
  ('PSA',            'ng/mL',         'male',   null, 4,    null, null)
) as v(analyte, unit, sex, lo, hi, clo, chi)
where not exists (
  select 1 from public.lab_reference_ranges r
  where r.is_default and r.analyte = v.analyte and r.sex = v.sex and r.effective_from = date '2026-09-26'
);

-- ── RLS ────────────────────────────────────────────────────────────────────────────────────
alter table public.lab_reference_ranges enable row level security;
alter table public.lab_feed_messages enable row level security;
alter table public.lab_results_to_reconcile enable row level security;

do $guard$ begin
  create policy "staff_select_lab_reference_ranges" on public.lab_reference_ranges
    for select to authenticated
    using ((select public.auth_role()) in ('front_desk', 'nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "admin_insert_lab_reference_ranges" on public.lab_reference_ranges
    for insert to authenticated
    with check ((select public.auth_role()) = 'admin' and not is_default);
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "admin_update_lab_reference_ranges" on public.lab_reference_ranges
    for update to authenticated
    using ((select public.auth_role()) = 'admin')
    with check ((select public.auth_role()) = 'admin');
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_select_lab_feed_messages" on public.lab_feed_messages
    for select to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

do $guard$ begin
  create policy "clinicians_select_lab_results_to_reconcile" on public.lab_results_to_reconcile
    for select to authenticated
    using ((select public.auth_role()) in ('nurse', 'doctor', 'admin'));
exception when duplicate_object then null;
end $guard$;

-- ── Grants ─────────────────────────────────────────────────────────────────────────────────
-- Ranges: read by staff, written by admin (no DELETE: retire instead). Feed tables: read-only
-- for clients; the service role (API server) writes. Its GRANT is checked before RLS.
grant select, insert, update on table public.lab_reference_ranges to authenticated;
grant select, insert, update, delete on table public.lab_reference_ranges to service_role;
grant select on table public.lab_feed_messages to authenticated;
grant select, insert, update, delete on table public.lab_feed_messages to service_role;
grant select on table public.lab_results_to_reconcile to authenticated;
grant select, insert, update, delete on table public.lab_results_to_reconcile to service_role;
