-- ============================================================
-- Amise Medical Services — Document AI Extraction Migration
-- Adds a triage-only AI extraction pipeline to `documents`:
-- structured facts + flags pulled from uploaded clinical
-- documents (lab reports, imaging, referral letters, etc.)
-- for staff review. Never a diagnosis — flag-only, "triage
-- territory" by design.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-clinical-records-migration.sql
--   (creates the `documents` table this migration extends)
-- ============================================================

alter table documents
  add column if not exists ai_extraction_status text not null default 'pending'
    check (ai_extraction_status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  add column if not exists ai_extracted_data jsonb,
  add column if not exists ai_flags jsonb,
  add column if not exists ai_extraction_at timestamptz,
  add column if not exists staff_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists staff_reviewed_at timestamptz;

comment on column documents.ai_extraction_status is
  'Pipeline state for the triage-only AI extraction pass: pending → processing → done | failed | skipped.';
comment on column documents.ai_extracted_data is
  'Structured facts read off the document by Claude (values, units, dates, stated reference ranges) — a transcription aid, never a diagnosis or interpretation.';
comment on column documents.ai_flags is
  'Array of {type, label, severity, detail} items the document itself marks as out-of-range/urgent/abnormal — surfaced for staff attention only, never a clinical interpretation.';
comment on column documents.ai_extraction_at is
  'When the AI extraction pass completed (successfully or not).';
comment on column documents.staff_reviewed_at is
  'When a staff member acknowledged the AI extraction/flags for this document.';

create index if not exists documents_ai_extraction_status_idx
  on documents (ai_extraction_status);

-- Fast lookup of flagged-but-unreviewed documents for the dashboard alert surface
create index if not exists documents_needs_review_idx
  on documents (created_at desc)
  where ai_flags is not null and staff_reviewed_at is null;
