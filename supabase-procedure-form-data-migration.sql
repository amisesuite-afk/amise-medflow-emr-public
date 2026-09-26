-- Migration 85: procedure form data + missing iOS clinical fields
-- Adds columns for the 12 procedure form JSON blobs (TraumaData, OGDData, etc.)
-- stored by the iOS app, plus mallampati_score, operation_date, investigations_json,
-- pmh_entries_json, and pshx_entries_json which are written by the iOS app but had
-- no corresponding columns in the patients table. All idempotent.

ALTER TABLE public.patients
  -- Structured clinical indices
  ADD COLUMN IF NOT EXISTS mallampati_score            INTEGER,
  ADD COLUMN IF NOT EXISTS operation_date              TIMESTAMPTZ,
  -- Rich JSON blobs (iOS stores, web dashboard may read-only display)
  ADD COLUMN IF NOT EXISTS investigations_json         TEXT,
  ADD COLUMN IF NOT EXISTS pmh_entries_json            TEXT,
  ADD COLUMN IF NOT EXISTS pshx_entries_json           TEXT,
  -- Procedure form JSON blobs
  ADD COLUMN IF NOT EXISTS trauma_data_json            TEXT,
  ADD COLUMN IF NOT EXISTS ogd_data_json               TEXT,
  ADD COLUMN IF NOT EXISTS colonoscopy_data_json       TEXT,
  ADD COLUMN IF NOT EXISTS surgery_data_json           TEXT,
  ADD COLUMN IF NOT EXISTS ercp_data_json              TEXT,
  ADD COLUMN IF NOT EXISTS bronchoscopy_data_json      TEXT,
  ADD COLUMN IF NOT EXISTS discharge_summary_data_json TEXT,
  ADD COLUMN IF NOT EXISTS post_op_review_data_json    TEXT,
  ADD COLUMN IF NOT EXISTS referral_letter_data_json   TEXT,
  ADD COLUMN IF NOT EXISTS consent_form_data_json      TEXT,
  ADD COLUMN IF NOT EXISTS pre_op_checklist_data_json  TEXT,
  ADD COLUMN IF NOT EXISTS patient_instructions_data_json TEXT;
