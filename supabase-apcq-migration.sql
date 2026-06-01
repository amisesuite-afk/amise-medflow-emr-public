-- ============================================================
-- Amise Medical Services — APCQ Migration
-- Adaptive Pre-Consultation Questionnaire (APCQ) Module
--
-- Run this in: Supabase Dashboard → SQL Editor
-- All timestamps use timestamptz; scheduling convention is
-- America/St_Lucia (UTC-4, no DST).
-- ============================================================

-- Extension guard (already present in base schema, kept for
-- standalone execution safety)
create extension if not exists "uuid-ossp";


-- ============================================================
-- SECTION 1: HELPER FUNCTION — generate_session_token()
-- Returns a 32-character random hex string used as an
-- anonymous access token for kiosk / QR-code sessions.
-- ============================================================

create or replace function generate_session_token()
returns text
language sql
as $$
  select encode(gen_random_bytes(16), 'hex');
$$;


-- ============================================================
-- SECTION 2: CORE QUESTIONNAIRE TABLES
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 2.1  QUESTIONNAIRE_TEMPLATES
--      Defines a reusable questionnaire form (e.g. upper_gi,
--      post_op_review). One template maps to many questions via
--      question_bank.
-- ─────────────────────────────────────────────────────────────
create table if not exists questionnaire_templates (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        unique not null,
                          -- e.g. 'general_screening', 'upper_gi', 'breast',
                          -- 'colorectal', 'post_op_review', 'ercp_workup'
  mode        text        not null
                          check (mode in ('screening', 'condition_specific')),
  specialty   text        not null
                          check (specialty in (
                            'general_surgery',
                            'endoscopy',
                            'breast_surgery',
                            'post_op',
                            'general_medical'
                          )),
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table questionnaire_templates is
  'Reusable questionnaire definitions grouped by clinical specialty and mode.';
comment on column questionnaire_templates.name is
  'Machine-readable identifier, e.g. ''upper_gi'', ''ercp_workup''.';
comment on column questionnaire_templates.mode is
  '''screening'' = general intake; ''condition_specific'' = targeted to a known diagnosis or procedure.';


-- ─────────────────────────────────────────────────────────────
-- 2.2  QUESTION_BANK
--      Individual questions belonging to a template, with
--      branching metadata and red-flag screening flags.
-- ─────────────────────────────────────────────────────────────
create table if not exists question_bank (
  id                  uuid        primary key default uuid_generate_v4(),
  template_id         uuid        not null
                                  references questionnaire_templates(id)
                                  on delete cascade,
  question_key        text        not null,
                                  -- Short identifier, e.g. 'chief_complaint',
                                  -- 'pain_onset', 'rectal_bleeding'
  question_text       text        not null,   -- Text shown to patient
  question_type       text        not null
                                  check (question_type in (
                                    'single_choice',
                                    'multi_choice',
                                    'text',
                                    'scale',
                                    'boolean',
                                    'date'
                                  )),
  options             jsonb,
                                  -- Array of option objects:
                                  -- [{
                                  --   "value": "yes",
                                  --   "label": "Yes",
                                  --   "triggers_branch": true,
                                  --   "red_flag": false
                                  -- }]
                                  -- null for free-text / date / scale questions
  is_required         boolean     not null default false,
  is_red_flag_screen  boolean     not null default false,
                                  -- If true, any positive answer triggers an
                                  -- immediate alert to nursing staff
  display_order       integer     not null default 0,
  help_text           text,       -- Optional hint shown beneath the question
  created_at          timestamptz not null default now(),

  -- question_key must be unique within a template
  unique (template_id, question_key)
);

comment on table question_bank is
  'Individual questions belonging to a questionnaire template.';
comment on column question_bank.is_red_flag_screen is
  'When true, a positive or high-severity answer triggers immediate nurse alert regardless of branching.';
comment on column question_bank.options is
  'JSONB array of {value, label, triggers_branch, red_flag}. Null for text/date/scale questions.';


-- ─────────────────────────────────────────────────────────────
-- 2.3  BRANCHING_RULES
--      Conditional logic: "if question X has answer Y, show
--      question Z next". Evaluated in descending priority order.
-- ─────────────────────────────────────────────────────────────
create table if not exists branching_rules (
  id                   uuid    primary key default uuid_generate_v4(),
  template_id          uuid    not null
                               references questionnaire_templates(id)
                               on delete cascade,
  source_question_key  text    not null,
                               -- The question whose answer drives branching
  answer_value         text    not null,
                               -- The specific value that triggers the branch
                               -- (exact match for single_choice/boolean;
                               --  contained-in for multi_choice)
  target_question_key  text    not null,
                               -- The question to show when the rule fires
  priority             integer not null default 0,
                               -- Higher value = evaluated first
  skip_if_answered     boolean not null default false
                               -- Skip target if the patient already answered it
);

comment on table branching_rules is
  'Conditional branching logic linking question answers to follow-up questions.';
comment on column branching_rules.priority is
  'Rules with higher priority are evaluated first. Allows overrides for specific edge cases.';


-- ============================================================
-- SECTION 3: SESSION AND RESPONSE TABLES
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 3.1  QUESTIONNAIRE_SESSIONS
--      One session per patient attempt at a questionnaire.
--      Patients may be anonymous (kiosk / QR link) — patient_id
--      may be null until staff links the record.
-- ─────────────────────────────────────────────────────────────
create table if not exists questionnaire_sessions (
  id                    uuid        primary key default uuid_generate_v4(),

  -- Patient linkage (nullable: patient may be unregistered at intake)
  patient_id            uuid        references patients(id) on delete set null,
  encounter_id          uuid        references encounters(id) on delete set null,
  template_id           uuid        not null
                                    references questionnaire_templates(id),

  mode                  text        not null
                                    check (mode in ('screening', 'condition_specific')),
  status                text        not null default 'in_progress'
                                    check (status in (
                                      'in_progress',
                                      'completed',
                                      'abandoned',
                                      'nurse_reviewed',
                                      'doctor_approved'
                                    )),
  delivery_method       text        not null
                                    check (delivery_method in (
                                      'kiosk',
                                      'whatsapp_link',
                                      'qr_code',
                                      'staff_assisted'
                                    )),

  -- Consent tracking
  consent_given         boolean     not null default false,
  consent_timestamp     timestamptz,
  consent_ip            text,

  -- Timing
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  total_questions_shown integer,

  -- Clinical flags detected during the session
  -- Array of: [{"question_key": "rectal_bleeding", "answer": "yes", "severity": "high"}]
  red_flags_detected    jsonb,

  -- Nurse review
  nurse_reviewed_by     uuid        references auth.users(id) on delete set null,
  nurse_reviewed_at     timestamptz,
  nurse_notes           text,

  -- Doctor approval
  doctor_approved_by    uuid        references auth.users(id) on delete set null,
  doctor_approved_at    timestamptz,

  -- EMR population tracking
  emr_populated         boolean     not null default false,
  emr_populated_at      timestamptz,

  -- Anonymous access token (generated automatically on insert if null)
  session_token         text        unique not null,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table questionnaire_sessions is
  'One row per patient questionnaire attempt. Supports anonymous kiosk and QR-code access via session_token.';
comment on column questionnaire_sessions.patient_id is
  'Nullable — patient may be unregistered at time of questionnaire; staff links later.';
comment on column questionnaire_sessions.session_token is
  'Random 32-char hex token used for anonymous access via QR/link. Auto-generated before insert if null.';
comment on column questionnaire_sessions.red_flags_detected is
  'JSONB array of [{question_key, answer, severity}] populated as patient progresses.';


-- ─────────────────────────────────────────────────────────────
-- 3.2  QUESTIONNAIRE_RESPONSES
--      Individual answers submitted within a session, one row
--      per question answered.
-- ─────────────────────────────────────────────────────────────
create table if not exists questionnaire_responses (
  id               uuid        primary key default uuid_generate_v4(),
  session_id       uuid        not null
                               references questionnaire_sessions(id)
                               on delete cascade,
  question_key     text        not null,
  question_text    text,       -- Snapshot of question text at time of answer
  answer_value     text,       -- Raw stored value (e.g. 'yes', '7', '2026-06-01')
  answer_display   text,       -- Human-readable label (e.g. 'Yes', 'Moderate (7/10)')
  is_red_flag      boolean     not null default false,
  answered_at      timestamptz not null default now(),
  sequence_number  integer     not null
                               -- Position of this question in the session (1-based)
);

comment on table questionnaire_responses is
  'Individual patient answers within a questionnaire session.';
comment on column questionnaire_responses.answer_value is
  'Machine-readable raw value stored for processing and branching evaluation.';
comment on column questionnaire_responses.answer_display is
  'Human-readable version of the answer for display in summaries and EMR.';
comment on column questionnaire_responses.sequence_number is
  '1-based order in which this question was presented during the session.';


-- ============================================================
-- SECTION 4: INTAKE SUMMARY AND CONSENT TABLES
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 4.1  INTAKE_SUMMARIES
--      Claude-generated pre-visit clinical summary produced
--      after session completion. One summary per session.
-- ─────────────────────────────────────────────────────────────
create table if not exists intake_summaries (
  id                       uuid        primary key default uuid_generate_v4(),
  session_id               uuid        unique not null
                                        references questionnaire_sessions(id)
                                        on delete cascade,
  patient_id               uuid        references patients(id) on delete set null,

  -- AI-generated content (written by Claude; reviewed by doctor before actioning)
  ai_summary               text,
                                        -- Narrative pre-visit briefing for clinician
  chief_complaint          text,

  -- Structured clinical data extracted from responses
  key_positives            jsonb,       -- Array of strings: notable positive findings
  red_flags                jsonb,       -- Array of {symptom, severity, action}
  recommended_focus_areas  jsonb,       -- Array of strings: areas for doctor to probe

  estimated_urgency        text        not null default 'routine'
                                        check (estimated_urgency in (
                                          'routine',
                                          'priority',
                                          'urgent',
                                          'emergency'
                                        )),

  -- Full snapshot of all Q&A at time of summary generation
  raw_responses            jsonb,

  -- Generation metadata
  generated_at             timestamptz,
  model_used               text,        -- e.g. 'claude-sonnet-4-6'

  reviewed_by_doctor       boolean     not null default false
);

comment on table intake_summaries is
  'Claude-generated pre-consultation summary; one per questionnaire session. INSERT/UPDATE via service_role only.';
comment on column intake_summaries.ai_summary is
  'Narrative clinical briefing drafted by Claude. Must be reviewed by a doctor before use.';
comment on column intake_summaries.raw_responses is
  'JSONB snapshot of all Q&A pairs at point of summary generation (immutable audit record).';
comment on column intake_summaries.estimated_urgency is
  'AI-estimated triage urgency — must be validated by clinical staff before acting upon.';


-- ─────────────────────────────────────────────────────────────
-- 4.2  CONSENT_RECORDS
--      Immutable record of every consent interaction, including
--      the exact text shown and the patient's response.
-- ─────────────────────────────────────────────────────────────
create table if not exists consent_records (
  id                   uuid        primary key default uuid_generate_v4(),
  session_id           uuid        not null
                                   references questionnaire_sessions(id)
                                   on delete restrict,
                                   -- Restrict: consent records must survive session deletion review
  consent_type         text        not null
                                   check (consent_type in (
                                     'data_collection',
                                     'telehealth',
                                     'procedure',
                                     'research'
                                   )),
  consent_text         text        not null,
                                   -- Exact text presented to the patient (verbatim snapshot)
  consent_version      text        not null,
                                   -- Semantic version of the consent form, e.g. '1.0', '2.1'
  consented            boolean     not null,
                                   -- True = accepted, False = declined
  patient_name_entered text,       -- Patient typed their name to confirm (digital signature)
  ip_address           text,
  user_agent           text,
  timestamp            timestamptz not null default now()
);

comment on table consent_records is
  'Append-only record of patient consent interactions. ON DELETE RESTRICT to preserve audit trail.';
comment on column consent_records.consent_text is
  'Verbatim text shown to the patient at the time of consent — never updated post-insert.';
comment on column consent_records.consent_version is
  'Version of the consent form presented, enabling compliance audit across form revisions.';


-- ============================================================
-- SECTION 5: TRIGGERS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 5.1  Auto-generate session_token before insert if null
-- ─────────────────────────────────────────────────────────────
create or replace function trg_fn_set_session_token()
returns trigger
language plpgsql
as $$
begin
  if new.session_token is null or trim(new.session_token) = '' then
    new.session_token := generate_session_token();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_session_token on questionnaire_sessions;
create trigger trg_set_session_token
  before insert on questionnaire_sessions
  for each row execute function trg_fn_set_session_token();

-- ─────────────────────────────────────────────────────────────
-- 5.2  updated_at maintenance for APCQ tables that have it
-- ─────────────────────────────────────────────────────────────
-- Reuses the set_updated_at() function defined in the base schema.

drop trigger if exists trg_updated_at on questionnaire_templates;
create trigger trg_updated_at
  before update on questionnaire_templates
  for each row execute function set_updated_at();

drop trigger if exists trg_updated_at on questionnaire_sessions;
create trigger trg_updated_at
  before update on questionnaire_sessions
  for each row execute function set_updated_at();


-- ============================================================
-- SECTION 6: INDEXES
-- ============================================================

-- questionnaire_sessions
create index if not exists idx_qs_patient_id
  on questionnaire_sessions(patient_id);

create index if not exists idx_qs_encounter_id
  on questionnaire_sessions(encounter_id);

create index if not exists idx_qs_status
  on questionnaire_sessions(status);

create index if not exists idx_qs_session_token
  on questionnaire_sessions(session_token);

create index if not exists idx_qs_template_id
  on questionnaire_sessions(template_id);

create index if not exists idx_qs_started_at
  on questionnaire_sessions(started_at desc);

-- questionnaire_responses
create index if not exists idx_qr_session_id
  on questionnaire_responses(session_id);

create index if not exists idx_qr_is_red_flag
  on questionnaire_responses(session_id, is_red_flag)
  where is_red_flag = true;

-- intake_summaries
create index if not exists idx_is_session_id
  on intake_summaries(session_id);

create index if not exists idx_is_patient_id
  on intake_summaries(patient_id);

create index if not exists idx_is_estimated_urgency
  on intake_summaries(estimated_urgency)
  where reviewed_by_doctor = false;

-- question_bank
create index if not exists idx_qb_template_id
  on question_bank(template_id, display_order);

-- branching_rules
create index if not exists idx_br_template_source
  on branching_rules(template_id, source_question_key, priority desc);

-- consent_records
create index if not exists idx_cr_session_id
  on consent_records(session_id);


-- ============================================================
-- SECTION 7: ROW LEVEL SECURITY
-- ============================================================

alter table questionnaire_templates  enable row level security;
alter table question_bank            enable row level security;
alter table branching_rules          enable row level security;
alter table questionnaire_sessions   enable row level security;
alter table questionnaire_responses  enable row level security;
alter table intake_summaries         enable row level security;
alter table consent_records          enable row level security;


-- ─────────────────────────────────────────────────────────────
-- 7.1  questionnaire_templates
--      Read-only for all authenticated staff.
--      Mutations restricted to admin and service_role.
-- ─────────────────────────────────────────────────────────────
create policy "apcq_tmpl_staff_select"
  on questionnaire_templates
  for select
  using (auth.uid() is not null);

create policy "apcq_tmpl_admin_insert"
  on questionnaire_templates
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_tmpl_admin_update"
  on questionnaire_templates
  for update
  using (auth_role() = 'admin');

create policy "apcq_tmpl_admin_delete"
  on questionnaire_templates
  for delete
  using (auth_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- 7.2  question_bank
--      Read-only for all authenticated staff.
--      Mutations restricted to admin and service_role.
-- ─────────────────────────────────────────────────────────────
create policy "apcq_qb_staff_select"
  on question_bank
  for select
  using (auth.uid() is not null);

create policy "apcq_qb_admin_insert"
  on question_bank
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_qb_admin_update"
  on question_bank
  for update
  using (auth_role() = 'admin');

create policy "apcq_qb_admin_delete"
  on question_bank
  for delete
  using (auth_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- 7.3  branching_rules
--      Same access pattern as question_bank.
-- ─────────────────────────────────────────────────────────────
create policy "apcq_br_staff_select"
  on branching_rules
  for select
  using (auth.uid() is not null);

create policy "apcq_br_admin_insert"
  on branching_rules
  for insert
  with check (auth_role() = 'admin');

create policy "apcq_br_admin_update"
  on branching_rules
  for update
  using (auth_role() = 'admin');

create policy "apcq_br_admin_delete"
  on branching_rules
  for delete
  using (auth_role() = 'admin');


-- ─────────────────────────────────────────────────────────────
-- 7.4  questionnaire_sessions
--
--      Anonymous (kiosk/QR) access: anon role can SELECT and
--      INSERT only the session whose token matches the local
--      runtime setting app.session_token.
--
--      Authenticated staff: all roles listed can SELECT all
--      sessions; nurses, doctors, and admins can UPDATE to
--      progress status and record nurse review fields.
-- ─────────────────────────────────────────────────────────────

-- Anon: read own session by token
create policy "apcq_sess_anon_select_by_token"
  on questionnaire_sessions
  for select
  to anon
  using (
    session_token = current_setting('app.session_token', true)
  );

-- Anon: create new session (token will be auto-generated)
create policy "apcq_sess_anon_insert"
  on questionnaire_sessions
  for insert
  to anon
  with check (true);

-- Authenticated staff: read all sessions
create policy "apcq_sess_staff_select"
  on questionnaire_sessions
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Authenticated staff: create sessions on behalf of patients
create policy "apcq_sess_staff_insert"
  on questionnaire_sessions
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Nurses, doctors, admins: update status and review fields
create policy "apcq_sess_clinical_update"
  on questionnaire_sessions
  for update
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin')
  );


-- ─────────────────────────────────────────────────────────────
-- 7.5  questionnaire_responses
--
--      Anon can INSERT responses for a session they own (matched
--      via a security-definer helper to avoid join on anon).
--      Authenticated staff can SELECT all responses.
-- ─────────────────────────────────────────────────────────────

-- Helper: verify that an anon caller owns the session referenced
-- by the response being inserted (avoids granting anon SELECT on
-- questionnaire_sessions directly in this policy expression).
create or replace function anon_owns_session(p_session_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from questionnaire_sessions
    where id = p_session_id
      and session_token = current_setting('app.session_token', true)
  );
$$;

-- Anon: insert responses only if they own the parent session
create policy "apcq_resp_anon_insert"
  on questionnaire_responses
  for insert
  to anon
  with check (
    anon_owns_session(session_id)
  );

-- Authenticated staff: read all responses
create policy "apcq_resp_staff_select"
  on questionnaire_responses
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

-- Authenticated staff: insert responses (staff-assisted delivery)
create policy "apcq_resp_staff_insert"
  on questionnaire_responses
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );


-- ─────────────────────────────────────────────────────────────
-- 7.6  intake_summaries
--
--      Nurses, doctors, and admins can SELECT.
--      INSERT and UPDATE are restricted to service_role only
--      (Claude-generated content; never written by browser
--      clients directly).
-- ─────────────────────────────────────────────────────────────
create policy "apcq_is_clinical_select"
  on intake_summaries
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin')
  );

-- No INSERT/UPDATE policies for authenticated or anon roles.
-- The service_role bypasses RLS entirely and may write freely.


-- ─────────────────────────────────────────────────────────────
-- 7.7  consent_records
--
--      Anon can INSERT (patient submitting consent during kiosk
--      or QR session). Authenticated staff can SELECT all.
--      No client-side UPDATE or DELETE — consent is immutable.
-- ─────────────────────────────────────────────────────────────
create policy "apcq_cr_anon_insert"
  on consent_records
  for insert
  to anon
  with check (true);

create policy "apcq_cr_staff_insert"
  on consent_records
  for insert
  to authenticated
  with check (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );

create policy "apcq_cr_staff_select"
  on consent_records
  for select
  to authenticated
  using (
    auth_role() in ('nurse', 'doctor', 'admin', 'front_desk')
  );


-- ============================================================
-- SECTION 8: POSTGRESQL-LEVEL GRANTS
-- ============================================================
-- RLS policies restrict which rows each role can access.
-- These grants give the roles permission to attempt operations
-- at all — without them Postgres returns permission denied
-- before RLS is even evaluated.

-- Schema usage
grant usage on schema public to anon, authenticated;

-- questionnaire_templates and question_bank: read for all authenticated
grant select
  on public.questionnaire_templates
  to authenticated;
grant insert, update, delete
  on public.questionnaire_templates
  to authenticated;   -- RLS limits actual mutations to admin

grant select
  on public.question_bank
  to authenticated;
grant insert, update, delete
  on public.question_bank
  to authenticated;   -- RLS limits actual mutations to admin

-- branching_rules
grant select
  on public.branching_rules
  to authenticated;
grant insert, update, delete
  on public.branching_rules
  to authenticated;   -- RLS limits actual mutations to admin

-- questionnaire_sessions: anon needs select/insert; authenticated needs all
grant select, insert
  on public.questionnaire_sessions
  to anon;
grant select, insert, update
  on public.questionnaire_sessions
  to authenticated;

-- questionnaire_responses: anon insert; authenticated select/insert
grant insert
  on public.questionnaire_responses
  to anon;
grant select, insert
  on public.questionnaire_responses
  to authenticated;

-- intake_summaries: authenticated select only (writes via service_role)
grant select
  on public.intake_summaries
  to authenticated;

-- consent_records: anon insert; authenticated select/insert
grant insert
  on public.consent_records
  to anon;
grant select, insert
  on public.consent_records
  to authenticated;


-- ============================================================
-- END OF MIGRATION
-- ============================================================
-- Tables created:
--   questionnaire_templates  — form definitions by specialty
--   question_bank            — individual questions per template
--   branching_rules          — conditional next-question logic
--   questionnaire_sessions   — one row per patient attempt
--   questionnaire_responses  — individual answers per session
--   intake_summaries         — Claude-generated pre-visit briefs
--   consent_records          — immutable consent audit trail
--
-- Functions created:
--   generate_session_token() — 32-char random hex token
--   anon_owns_session(uuid)  — RLS helper (security definer)
--   trg_fn_set_session_token() — trigger function for auto-token
--
-- Triggers created:
--   trg_set_session_token    — auto-fills session_token before insert
--   trg_updated_at           — maintains updated_at on templates/sessions
-- ============================================================
