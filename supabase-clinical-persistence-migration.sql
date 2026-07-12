-- ============================================================
-- Amise Medical Services — Clinical Persistence Migration
-- Persists clinical data that currently lives only in
-- localStorage in the dashboard.
--
-- Tables: surgical_history, toxic_habits, ros_findings,
--         scales_scores, dashboard_prescriptions,
--         operative_notes, trauma_records,
--         clinical_attachments
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-schema.sql must have been applied
--   (depends on patients, encounters, set_updated_at())
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. SURGICAL HISTORY
-- Past surgical procedures for the patient. procedure_date is
-- nullable because patients may not recall exact dates.
-- ─────────────────────────────────────────────────────────────
create table if not exists surgical_history (
  id              uuid        primary key default gen_random_uuid(),
  patient_id      uuid        not null references patients(id) on delete cascade,
  procedure_name  text        not null,
  procedure_date  date,
  surgeon         text,
  hospital        text,
  complications   text,
  notes           text,
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table surgical_history is
  'Past surgical procedures for a patient. Date is nullable when the patient cannot recall the exact date.';

-- ─────────────────────────────────────────────────────────────
-- 2. TOXIC HABITS
-- Smoking, alcohol, recreational drug use and other habits.
-- ─────────────────────────────────────────────────────────────
create table if not exists toxic_habits (
  id          uuid        primary key default gen_random_uuid(),
  patient_id  uuid        not null references patients(id) on delete cascade,
  habit_type  text        not null
                          check (habit_type in ('smoking', 'alcohol', 'recreational_drugs', 'other')),
  status      text        not null
                          check (status in ('current', 'former', 'never')),
  details     text,
  quit_date   date,
  notes       text,
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table toxic_habits is
  'Social history: smoking, alcohol, recreational drugs and other habits. Details hold quantitative info (e.g. "20 pack-years", "2 units/week").';

-- ─────────────────────────────────────────────────────────────
-- 3. ROS FINDINGS
-- Review of systems findings captured per encounter. Each row
-- covers one organ system; findings are stored as JSONB
-- key-value pairs (finding name -> positive/negative/details).
-- ─────────────────────────────────────────────────────────────
create table if not exists ros_findings (
  id            uuid        primary key default gen_random_uuid(),
  patient_id    uuid        not null references patients(id) on delete cascade,
  encounter_id  uuid        not null references encounters(id) on delete cascade,
  system_name   text        not null,
  findings      jsonb       not null default '{}',
  notes         text,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (encounter_id, system_name)
);

comment on table ros_findings is
  'Review of systems findings per encounter. One row per organ system (e.g. cardiovascular, respiratory, gi, neuro). Findings stored as JSONB map of symptom -> positive/negative/details.';
comment on column ros_findings.system_name is
  'Organ system name: cardiovascular, respiratory, gi, neuro, musculoskeletal, genitourinary, dermatological, etc.';
comment on column ros_findings.findings is
  'JSONB object mapping finding names to values — e.g. {"chest_pain": "positive", "palpitations": "negative", "dyspnoea": "on exertion"}.';

-- ─────────────────────────────────────────────────────────────
-- 4. SCALES SCORES
-- Clinical scoring scales evaluated per encounter (WHO, ASA,
-- Karnofsky, ECOG, Glasgow Coma Scale, Alvarado, etc.).
-- ─────────────────────────────────────────────────────────────
create table if not exists scales_scores (
  id              uuid        primary key default gen_random_uuid(),
  patient_id      uuid        not null references patients(id) on delete cascade,
  encounter_id    uuid        not null references encounters(id) on delete cascade,
  scale_name      text        not null,
  score           numeric     not null,
  interpretation  text,
  details         jsonb       default '{}',
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (encounter_id, scale_name)
);

comment on table scales_scores is
  'Clinical scoring scales per encounter — WHO Performance Status, Karnofsky, ASA Physical Status, ECOG, Glasgow Coma Scale, Alvarado, etc.';
comment on column scales_scores.details is
  'JSONB object with scale-specific component scores — e.g. for GCS: {"eye": 4, "verbal": 5, "motor": 6}.';

-- ─────────────────────────────────────────────────────────────
-- 5. DASHBOARD PRESCRIPTIONS
-- Prescriptions written during consultation in the dashboard.
-- Distinct from the portal prescription_requests table and the
-- existing prescriptions table (which tracks formal RX orders).
-- This table captures the in-consultation prescription draft
-- workflow including PRN and signing.
-- ─────────────────────────────────────────────────────────────
create table if not exists dashboard_prescriptions (
  id            uuid        primary key default gen_random_uuid(),
  patient_id    uuid        not null references patients(id) on delete cascade,
  encounter_id  uuid        references encounters(id) on delete set null,
  drug_name     text        not null,
  dose          text,
  frequency     text,
  route         text        default 'oral',
  duration      text,
  quantity      text,
  instructions  text,
  is_prn        boolean     not null default false,
  status        text        not null default 'draft'
                            check (status in ('draft', 'signed', 'dispensed', 'cancelled')),
  signed_by     uuid        references auth.users(id) on delete set null,
  signed_at     timestamptz,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table dashboard_prescriptions is
  'In-consultation prescription drafts from the dashboard. Distinct from the prescriptions table (formal RX orders) and portal prescription_requests.';

-- ─────────────────────────────────────────────────────────────
-- 6. OPERATIVE NOTES
-- Structured surgical / procedure documentation. Contains all
-- fields required for a complete operative report.
-- ─────────────────────────────────────────────────────────────
create table if not exists operative_notes (
  id                    uuid        primary key default gen_random_uuid(),
  patient_id            uuid        not null references patients(id) on delete cascade,
  encounter_id          uuid        references encounters(id) on delete set null,
  procedure_name        text        not null,
  procedure_date        timestamptz not null default now(),
  surgeon               text,
  assistant             text,
  anaesthesia_type      text,
  indication            text,
  findings              text,
  technique             text,
  specimens             text,
  complications         text,
  post_op_instructions  text,
  estimated_blood_loss  text,
  drain_details         text,
  status                text        not null default 'draft'
                                    check (status in ('draft', 'final')),
  created_by            uuid        references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table operative_notes is
  'Structured operative / procedure reports — indication, findings, technique, specimens, complications, post-op instructions.';

-- ─────────────────────────────────────────────────────────────
-- 7. TRAUMA RECORDS
-- Trauma assessment data including mechanism, pre-hospital care,
-- MIST handover, ABCDE survey, AIS/ISS scoring and burns.
-- One trauma record per encounter (enforced by UNIQUE).
-- ─────────────────────────────────────────────────────────────
create table if not exists trauma_records (
  id                    uuid        primary key default gen_random_uuid(),
  patient_id            uuid        not null references patients(id) on delete cascade,
  encounter_id          uuid        not null references encounters(id) on delete cascade,
  mechanism             jsonb       not null default '[]',
  time_of_injury        timestamptz,
  pre_hospital          jsonb       not null default '[]',
  gc_scene              text,
  mist_injuries         text,
  mist_signs            text,
  admission_vitals      jsonb       not null default '{}',
  abcde                 jsonb       not null default '{}',
  ais                   jsonb       not null default '{}',
  secondary             jsonb       not null default '{}',
  secondary_dropdowns   jsonb       not null default '{}',
  burn_regions          jsonb       not null default '{}',
  burn_time_of_injury   timestamptz,
  burn_inhalation       boolean     not null default false,
  iss_score             numeric,
  created_by            uuid        references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (encounter_id)
);

comment on table trauma_records is
  'Trauma assessment data: mechanism, pre-hospital care, MIST handover, primary survey (ABCDE), secondary survey, AIS/ISS scoring, burns assessment. One record per encounter.';
comment on column trauma_records.mechanism is
  'JSONB array of injury mechanisms — e.g. ["RTA - driver", "high-speed impact"].';
comment on column trauma_records.abcde is
  'JSONB object with primary survey components — Airway, Breathing, Circulation, Disability, Exposure.';
comment on column trauma_records.ais is
  'JSONB object with Abbreviated Injury Scale scores per body region for ISS calculation.';

-- ─────────────────────────────────────────────────────────────
-- 8. CLINICAL ATTACHMENTS
-- File references (metadata only) for clinical files stored in
-- Supabase Storage. Distinct from the documents table which
-- handles formal document types with richer metadata.
-- ─────────────────────────────────────────────────────────────
create table if not exists clinical_attachments (
  id            uuid        primary key default gen_random_uuid(),
  patient_id    uuid        not null references patients(id) on delete cascade,
  encounter_id  uuid        references encounters(id) on delete set null,
  file_name     text        not null,
  file_type     text,
  file_size     integer,
  storage_path  text        not null,
  category      text        not null default 'other'
                            check (category in (
                              'photo', 'scan', 'lab_report', 'imaging',
                              'consent', 'referral_letter', 'other'
                            )),
  description   text,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table clinical_attachments is
  'File attachment metadata for clinical files stored in Supabase Storage. Lighter-weight than the documents table for quick photo/scan uploads during consultation.';
comment on column clinical_attachments.storage_path is
  'Object path within the Supabase Storage bucket — e.g. patients/{patient_id}/attachments/{uuid}.jpg.';

-- ─────────────────────────────────────────────────────────────
-- updated_at TRIGGERS
-- Reuses the existing set_updated_at() function from
-- supabase-schema.sql.
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'surgical_history', 'toxic_habits', 'ros_findings',
    'scales_scores', 'dashboard_prescriptions', 'operative_notes',
    'trauma_records', 'clinical_attachments'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at on %I;
       create trigger trg_updated_at before update on %I
         for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — Enable on all new tables
-- ─────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array[
    'surgical_history', 'toxic_habits', 'ros_findings',
    'scales_scores', 'dashboard_prescriptions', 'operative_notes',
    'trauma_records', 'clinical_attachments'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES
-- All authenticated dashboard staff can read and write all
-- rows. RLS is bypassed by service_role (API server) regardless.
-- ─────────────────────────────────────────────────────────────

-- ── surgical_history ──
create policy "staff_select_surgical_history" on surgical_history
  for select using (true);
create policy "staff_insert_surgical_history" on surgical_history
  for insert with check (true);
create policy "staff_update_surgical_history" on surgical_history
  for update using (true);
create policy "staff_delete_surgical_history" on surgical_history
  for delete using (true);

-- ── toxic_habits ──
create policy "staff_select_toxic_habits" on toxic_habits
  for select using (true);
create policy "staff_insert_toxic_habits" on toxic_habits
  for insert with check (true);
create policy "staff_update_toxic_habits" on toxic_habits
  for update using (true);
create policy "staff_delete_toxic_habits" on toxic_habits
  for delete using (true);

-- ── ros_findings ──
create policy "staff_select_ros_findings" on ros_findings
  for select using (true);
create policy "staff_insert_ros_findings" on ros_findings
  for insert with check (true);
create policy "staff_update_ros_findings" on ros_findings
  for update using (true);
create policy "staff_delete_ros_findings" on ros_findings
  for delete using (true);

-- ── scales_scores ──
create policy "staff_select_scales_scores" on scales_scores
  for select using (true);
create policy "staff_insert_scales_scores" on scales_scores
  for insert with check (true);
create policy "staff_update_scales_scores" on scales_scores
  for update using (true);
create policy "staff_delete_scales_scores" on scales_scores
  for delete using (true);

-- ── dashboard_prescriptions ──
create policy "staff_select_dashboard_prescriptions" on dashboard_prescriptions
  for select using (true);
create policy "staff_insert_dashboard_prescriptions" on dashboard_prescriptions
  for insert with check (true);
create policy "staff_update_dashboard_prescriptions" on dashboard_prescriptions
  for update using (true);
create policy "staff_delete_dashboard_prescriptions" on dashboard_prescriptions
  for delete using (true);

-- ── operative_notes ──
create policy "staff_select_operative_notes" on operative_notes
  for select using (true);
create policy "staff_insert_operative_notes" on operative_notes
  for insert with check (true);
create policy "staff_update_operative_notes" on operative_notes
  for update using (true);
create policy "staff_delete_operative_notes" on operative_notes
  for delete using (true);

-- ── trauma_records ──
create policy "staff_select_trauma_records" on trauma_records
  for select using (true);
create policy "staff_insert_trauma_records" on trauma_records
  for insert with check (true);
create policy "staff_update_trauma_records" on trauma_records
  for update using (true);
create policy "staff_delete_trauma_records" on trauma_records
  for delete using (true);

-- ── clinical_attachments ──
create policy "staff_select_clinical_attachments" on clinical_attachments
  for select using (true);
create policy "staff_insert_clinical_attachments" on clinical_attachments
  for insert with check (true);
create policy "staff_update_clinical_attachments" on clinical_attachments
  for update using (true);
create policy "staff_delete_clinical_attachments" on clinical_attachments
  for delete using (true);

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────

-- surgical_history
create index if not exists idx_surgical_history_patient on surgical_history(patient_id);

-- toxic_habits
create index if not exists idx_toxic_habits_patient on toxic_habits(patient_id);
create index if not exists idx_toxic_habits_type    on toxic_habits(habit_type);

-- ros_findings
create index if not exists idx_ros_findings_patient   on ros_findings(patient_id);
create index if not exists idx_ros_findings_encounter on ros_findings(encounter_id);

-- scales_scores
create index if not exists idx_scales_scores_patient   on scales_scores(patient_id);
create index if not exists idx_scales_scores_encounter on scales_scores(encounter_id);

-- dashboard_prescriptions
create index if not exists idx_dash_rx_patient   on dashboard_prescriptions(patient_id);
create index if not exists idx_dash_rx_encounter on dashboard_prescriptions(encounter_id);
create index if not exists idx_dash_rx_status    on dashboard_prescriptions(status);

-- operative_notes
create index if not exists idx_operative_notes_patient   on operative_notes(patient_id);
create index if not exists idx_operative_notes_encounter on operative_notes(encounter_id);
create index if not exists idx_operative_notes_date      on operative_notes(procedure_date desc);

-- trauma_records
create index if not exists idx_trauma_records_patient   on trauma_records(patient_id);
create index if not exists idx_trauma_records_encounter on trauma_records(encounter_id);

-- clinical_attachments
create index if not exists idx_clinical_attachments_patient   on clinical_attachments(patient_id);
create index if not exists idx_clinical_attachments_encounter on clinical_attachments(encounter_id);
create index if not exists idx_clinical_attachments_category  on clinical_attachments(category);

-- ─────────────────────────────────────────────────────────────
-- GRANTS
-- Both authenticated (dashboard users) and service_role (API
-- server) need full CRUD on all new tables.
-- ─────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.surgical_history         to authenticated;
grant select, insert, update, delete on public.toxic_habits             to authenticated;
grant select, insert, update, delete on public.ros_findings             to authenticated;
grant select, insert, update, delete on public.scales_scores            to authenticated;
grant select, insert, update, delete on public.dashboard_prescriptions  to authenticated;
grant select, insert, update, delete on public.operative_notes          to authenticated;
grant select, insert, update, delete on public.trauma_records           to authenticated;
grant select, insert, update, delete on public.clinical_attachments     to authenticated;

grant select, insert, update, delete on public.surgical_history         to service_role;
grant select, insert, update, delete on public.toxic_habits             to service_role;
grant select, insert, update, delete on public.ros_findings             to service_role;
grant select, insert, update, delete on public.scales_scores            to service_role;
grant select, insert, update, delete on public.dashboard_prescriptions  to service_role;
grant select, insert, update, delete on public.operative_notes          to service_role;
grant select, insert, update, delete on public.trauma_records           to service_role;
grant select, insert, update, delete on public.clinical_attachments     to service_role;
