-- Migration 86: consultation pathway form data (iOS)
-- The iOS consultation "first door" pathways store burns assessment, wellness screening
-- and ward-review checklist as one JSON blob (PathwayData) on the patient. This column
-- lets it sync through Supabase between devices. Idempotent; no new table, so the
-- existing patients grants and RLS policies already cover it.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS pathway_data_json TEXT;
