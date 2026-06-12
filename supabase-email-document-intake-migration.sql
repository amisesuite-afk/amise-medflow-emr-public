-- ============================================================
-- Amise Medical Services — Email Document Intake Migration
-- Adds a `referring_providers` directory (labs, imaging centres,
-- referring doctors) used to recognise incoming document emails
-- (lab results, imaging reports, referral letters) and file them
-- into `documents` for staff review/linking.
--
-- Also relaxes `documents.patient_id` to nullable, since documents
-- arriving by email may not yet be matched to a patient record.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-clinical-records-migration.sql
--   (creates the `documents` table)
-- ============================================================

-- ── documents.patient_id → nullable ──
-- Emailed documents land unmatched (patient_id = null) until staff link
-- them to a patient record.
alter table documents
  alter column patient_id drop not null;

-- ── referring_providers ──
create table if not exists referring_providers (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  email                 text        not null unique,
  provider_type         text        not null
                                    check (provider_type in (
                                      'lab', 'radiology', 'referring_doctor', 'other'
                                    )),
  default_document_type text        not null
                                    check (default_document_type in (
                                      'lab_report', 'imaging_report', 'referral_letter',
                                      'consent_form', 'surgical_report', 'discharge_summary',
                                      'prescription', 'insurance_form', 'other'
                                    )),
  notes                 text,
  active                boolean     not null default true,
  created_at            timestamptz not null default now()
);

comment on table referring_providers is
  'Directory of known labs, imaging centres, and referring doctors. Used to match incoming document emails (sender address) and auto-file attachments into `documents`.';
comment on column referring_providers.email is
  'Sender address, stored lowercase. Matched case-insensitively against the From header of incoming emails.';
comment on column referring_providers.default_document_type is
  'documents.document_type applied to attachments received from this sender.';

create index if not exists idx_referring_providers_email on referring_providers (email);

-- ── RLS ──
alter table referring_providers enable row level security;

create policy "staff_select_referring_providers" on referring_providers
  for select using (auth.uid() is not null);
create policy "staff_insert_referring_providers" on referring_providers
  for insert with check (auth.uid() is not null);
create policy "staff_update_referring_providers" on referring_providers
  for update using (auth.uid() is not null);
create policy "admins_delete_referring_providers" on referring_providers
  for delete using (auth_role() = 'admin');

grant select, insert, update, delete on public.referring_providers to authenticated;
