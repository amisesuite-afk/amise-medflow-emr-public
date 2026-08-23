-- Migration 69: iOS Consultation form fields
-- Adds all structured consultation columns written by ConsultationView (HPI, PMH, surgical hx,
-- allergies JSON, per-system exam fields, and management plan). Idempotent.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS hpi               TEXT,
  ADD COLUMN IF NOT EXISTS surgical_history  TEXT,
  ADD COLUMN IF NOT EXISTS allergies_json    TEXT,
  ADD COLUMN IF NOT EXISTS exam_general      TEXT,
  ADD COLUMN IF NOT EXISTS exam_cvs          TEXT,
  ADD COLUMN IF NOT EXISTS exam_resp         TEXT,
  ADD COLUMN IF NOT EXISTS exam_abdo         TEXT,
  ADD COLUMN IF NOT EXISTS exam_neuro        TEXT,
  ADD COLUMN IF NOT EXISTS exam_msk          TEXT,
  ADD COLUMN IF NOT EXISTS exam_skin         TEXT,
  ADD COLUMN IF NOT EXISTS exam_other        TEXT,
  ADD COLUMN IF NOT EXISTS management_plan   TEXT;
