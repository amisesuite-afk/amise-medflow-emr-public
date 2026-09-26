-- ============================================================
-- Migration 93 — iOS sync column reconciliation
-- The iOS app selects and pushes a fixed set of columns (the same list as the read-only check
-- docs/sql/check-ios-columns.sql). On the live database some of them were never created because
-- the migration runner has never completed there (seen 2026-09-25: patients.visit_type, then
-- patients.mallampati_score), and each missing column fails the whole iOS pull or push.
-- This adds every one of those columns that is missing, with the type from the repo's own table
-- definitions. Additive and idempotent: ADD COLUMN IF NOT EXISTS leaves an existing column (and
-- its type, default and constraints) untouched, and each table is skipped unless it exists as a
-- real table (a view of the same name is left alone).
-- All added columns are nullable with no default, so no existing row or write changes meaning.
-- Primary keys (id) are not touched. Migration 89's patients column guard is not changed:
-- clinical columns stay outside the front-desk allow-list.
-- ============================================================
do $m$
begin
  if exists (select 1 from pg_class where oid = to_regclass('public.appointment_requests') and relkind in ('r', 'p')) then
    alter table public.appointment_requests add column if not exists created_at timestamptz;
    alter table public.appointment_requests add column if not exists patient_email text;
    alter table public.appointment_requests add column if not exists patient_name text;
    alter table public.appointment_requests add column if not exists patient_phone text;
    alter table public.appointment_requests add column if not exists preferred_slot text;
    alter table public.appointment_requests add column if not exists reason text;
    alter table public.appointment_requests add column if not exists status text;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.audit_log') and relkind in ('r', 'p')) then
    alter table public.audit_log add column if not exists created_at timestamptz;
    alter table public.audit_log add column if not exists patient_id uuid;
    alter table public.audit_log add column if not exists resource_id text;
    alter table public.audit_log add column if not exists resource_type text;
    alter table public.audit_log add column if not exists user_agent text;
    alter table public.audit_log add column if not exists user_email text;
    alter table public.audit_log add column if not exists user_id uuid;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.clinical_notes') and relkind in ('r', 'p')) then
    alter table public.clinical_notes add column if not exists ai_assisted boolean;
    alter table public.clinical_notes add column if not exists content text;
    alter table public.clinical_notes add column if not exists created_at timestamptz;
    alter table public.clinical_notes add column if not exists created_by uuid;
    alter table public.clinical_notes add column if not exists deleted_at timestamptz;
    alter table public.clinical_notes add column if not exists note_type text;
    alter table public.clinical_notes add column if not exists patient_id uuid;
    alter table public.clinical_notes add column if not exists signed_at timestamptz;
    alter table public.clinical_notes add column if not exists signed_by uuid;
    alter table public.clinical_notes add column if not exists status text;
    alter table public.clinical_notes add column if not exists updated_at timestamptz;
    alter table public.clinical_notes add column if not exists updated_by uuid;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.patient_billing_items') and relkind in ('r', 'p')) then
    alter table public.patient_billing_items add column if not exists added_at timestamptz;
    alter table public.patient_billing_items add column if not exists amount_xcd numeric(10,2);
    alter table public.patient_billing_items add column if not exists cpt_category text;
    alter table public.patient_billing_items add column if not exists cpt_code text;
    alter table public.patient_billing_items add column if not exists cpt_description text;
    alter table public.patient_billing_items add column if not exists modifier text;
    alter table public.patient_billing_items add column if not exists note text;
    alter table public.patient_billing_items add column if not exists patient_id uuid;
    alter table public.patient_billing_items add column if not exists units integer;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.patient_documents') and relkind in ('r', 'p')) then
    alter table public.patient_documents add column if not exists ai_summary text;
    alter table public.patient_documents add column if not exists category text;
    alter table public.patient_documents add column if not exists extracted_text text;
    alter table public.patient_documents add column if not exists file_name text;
    alter table public.patient_documents add column if not exists mime_type text;
    alter table public.patient_documents add column if not exists patient_id uuid;
    alter table public.patient_documents add column if not exists storage_url text;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.patient_operative_plans') and relkind in ('r', 'p')) then
    alter table public.patient_operative_plans add column if not exists anaesthesia_type text;
    alter table public.patient_operative_plans add column if not exists antibiotic_prophylaxis text;
    alter table public.patient_operative_plans add column if not exists consent_procedure text;
    alter table public.patient_operative_plans add column if not exists consent_signed boolean;
    alter table public.patient_operative_plans add column if not exists patient_id uuid;
    alter table public.patient_operative_plans add column if not exists positioning text;
    alter table public.patient_operative_plans add column if not exists special_equipment text;
    alter table public.patient_operative_plans add column if not exists surgical_team_note text;
    alter table public.patient_operative_plans add column if not exists updated_at timestamptz;
    alter table public.patient_operative_plans add column if not exists vte_prophy text;
    alter table public.patient_operative_plans add column if not exists who_checklist jsonb;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.patient_vitals') and relkind in ('r', 'p')) then
    alter table public.patient_vitals add column if not exists avpu text;
    alter table public.patient_vitals add column if not exists bp_diastolic integer;
    alter table public.patient_vitals add column if not exists bp_systolic integer;
    alter table public.patient_vitals add column if not exists glucose_mmol numeric(4,1);
    alter table public.patient_vitals add column if not exists heart_rate integer;
    alter table public.patient_vitals add column if not exists notes text;
    alter table public.patient_vitals add column if not exists on_supplemental_o2 boolean;
    alter table public.patient_vitals add column if not exists patient_id uuid;
    alter table public.patient_vitals add column if not exists recorded_at timestamptz;
    alter table public.patient_vitals add column if not exists respiratory_rate integer;
    alter table public.patient_vitals add column if not exists spo2 integer;
    alter table public.patient_vitals add column if not exists temperature_c numeric(4,1);
    alter table public.patient_vitals add column if not exists weight_kg numeric(5,1);
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.patients') and relkind in ('r', 'p')) then
    alter table public.patients add column if not exists acuity text;
    alter table public.patients add column if not exists address text;
    alter table public.patients add column if not exists allergies_json text;
    alter table public.patients add column if not exists assessment_text text;
    alter table public.patients add column if not exists bed_number text;
    alter table public.patients add column if not exists bronchoscopy_data_json text;
    alter table public.patients add column if not exists check_in_time timestamptz;
    alter table public.patients add column if not exists chief_complaint text;
    alter table public.patients add column if not exists colonoscopy_data_json text;
    alter table public.patients add column if not exists consent_form_data_json text;
    alter table public.patients add column if not exists created_at timestamptz;
    alter table public.patients add column if not exists date_of_birth date;
    alter table public.patients add column if not exists discharge_summary_data_json text;
    alter table public.patients add column if not exists email text;
    alter table public.patients add column if not exists encounter_status text;
    alter table public.patients add column if not exists ercp_data_json text;
    alter table public.patients add column if not exists exam_abdo text;
    alter table public.patients add column if not exists exam_cvs text;
    alter table public.patients add column if not exists exam_general text;
    alter table public.patients add column if not exists exam_msk text;
    alter table public.patients add column if not exists exam_neuro text;
    alter table public.patients add column if not exists exam_other text;
    alter table public.patients add column if not exists exam_resp text;
    alter table public.patients add column if not exists exam_skin text;
    alter table public.patients add column if not exists family_history_notes text;
    alter table public.patients add column if not exists full_name text;
    alter table public.patients add column if not exists height_cm numeric(5,1);
    alter table public.patients add column if not exists hpi text;
    alter table public.patients add column if not exists insurance_provider text;
    alter table public.patients add column if not exists investigations_json text;
    alter table public.patients add column if not exists location text;
    alter table public.patients add column if not exists mallampati_score integer;
    alter table public.patients add column if not exists management_plan text;
    alter table public.patients add column if not exists mrn text;
    alter table public.patients add column if not exists nok_name text;
    alter table public.patients add column if not exists nok_phone text;
    alter table public.patients add column if not exists nok_relation text;
    alter table public.patients add column if not exists ogd_data_json text;
    alter table public.patients add column if not exists operation_date timestamptz;
    alter table public.patients add column if not exists pathway_data_json text;
    alter table public.patients add column if not exists patient_instructions_data_json text;
    alter table public.patients add column if not exists phone text;
    alter table public.patients add column if not exists pmh_entries_json text;
    alter table public.patients add column if not exists pmh_notes text;
    alter table public.patients add column if not exists policy_number text;
    alter table public.patients add column if not exists post_op_review_data_json text;
    alter table public.patients add column if not exists pre_op_checklist_data_json text;
    alter table public.patients add column if not exists pshx_entries_json text;
    alter table public.patients add column if not exists referral_letter_data_json text;
    alter table public.patients add column if not exists setting text;
    alter table public.patients add column if not exists sex text;
    alter table public.patients add column if not exists social_history text;
    alter table public.patients add column if not exists surgery_data_json text;
    alter table public.patients add column if not exists surgical_history text;
    alter table public.patients add column if not exists trauma_data_json text;
    alter table public.patients add column if not exists updated_at timestamptz;
    alter table public.patients add column if not exists visit_type text;
    alter table public.patients add column if not exists ward text;
    alter table public.patients add column if not exists working_diagnosis text;
    alter table public.patients add column if not exists working_diagnosis_icd text;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.prescriptions') and relkind in ('r', 'p')) then
    alter table public.prescriptions add column if not exists deleted_at timestamptz;
    alter table public.prescriptions add column if not exists dose text;
    alter table public.prescriptions add column if not exists drug_name text;
    alter table public.prescriptions add column if not exists duration text;
    alter table public.prescriptions add column if not exists frequency text;
    alter table public.prescriptions add column if not exists indication text;
    alter table public.prescriptions add column if not exists instructions text;
    alter table public.prescriptions add column if not exists patient_id uuid;
    alter table public.prescriptions add column if not exists prescribed_at timestamptz;
    alter table public.prescriptions add column if not exists prescriber_id uuid;
    alter table public.prescriptions add column if not exists route text;
    alter table public.prescriptions add column if not exists updated_at timestamptz;
  end if;
  if exists (select 1 from pg_class where oid = to_regclass('public.user_profiles') and relkind in ('r', 'p')) then
    alter table public.user_profiles add column if not exists role text;
  end if;
end
$m$;
