-- ============================================================
-- Migration: patients full fields + patient-photos storage bucket
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (all ADD COLUMN IF NOT EXISTS)
-- 2026-07-06
-- ============================================================

-- ── 1. PATIENTS TABLE — add all missing administrative columns ──

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS quarter            text,
  ADD COLUMN IF NOT EXISTS referred_by        text,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS policy_number      text,
  ADD COLUMN IF NOT EXISTS nhi_number         text,
  ADD COLUMN IF NOT EXISTS pre_auth_status    text CHECK (pre_auth_status IN ('pending','approved','declined')),
  ADD COLUMN IF NOT EXISTS occupation         text,
  ADD COLUMN IF NOT EXISTS nok_name           text,
  ADD COLUMN IF NOT EXISTS nok_relation       text,
  ADD COLUMN IF NOT EXISTS nok_phone          text;

COMMENT ON COLUMN patients.quarter            IS 'Saint Lucia administrative quarter (derived from SL_COMMUNITIES at check-in)';
COMMENT ON COLUMN patients.referred_by        IS 'Name of referring doctor or facility';
COMMENT ON COLUMN patients.insurance_provider IS 'Health insurance provider, e.g. SAGICOR, CLICO, Self-pay';
COMMENT ON COLUMN patients.policy_number      IS 'Insurance policy or member number';
COMMENT ON COLUMN patients.nhi_number         IS 'National Health Insurance number';
COMMENT ON COLUMN patients.pre_auth_status    IS 'Pre-authorisation status: pending / approved / declined';
COMMENT ON COLUMN patients.occupation         IS 'Patient occupation / employment';
COMMENT ON COLUMN patients.nok_name           IS 'Next-of-kin full name';
COMMENT ON COLUMN patients.nok_relation       IS 'Next-of-kin relationship to patient';
COMMENT ON COLUMN patients.nok_phone          IS 'Next-of-kin contact phone number';

-- ── 2. SERVICE ROLE GRANT — api-server connects as service_role ──
-- (photo_url and other columns already granted if you ran earlier migrations;
--  this re-grants so the new columns are covered)
GRANT ALL ON TABLE patients TO service_role;
GRANT ALL ON TABLE patients TO authenticated;

-- ── 3. PATIENT-PHOTOS STORAGE BUCKET ──────────────────────────────────────

-- Create the bucket (private — not publicly accessible by URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-photos',
  'patient-photos',
  false,
  5242880,   -- 5 MB per photo
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated staff to upload/update photos
CREATE POLICY "staff_upload_patient_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patient-photos');

CREATE POLICY "staff_update_patient_photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'patient-photos');

-- Allow authenticated users to read photos
CREATE POLICY "staff_read_patient_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient-photos');

-- Allow service_role (api-server) full access
CREATE POLICY "service_role_patient_photos"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'patient-photos')
  WITH CHECK (bucket_id = 'patient-photos');

-- ── 4. PATIENT-DOCUMENTS STORAGE BUCKET ─────────────────────────────────

-- For scanned referral letters and clinical documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  false,
  20971520,   -- 20 MB (PDFs can be large)
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "staff_upload_patient_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patient-documents');

CREATE POLICY "staff_read_patient_documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient-documents');

CREATE POLICY "service_role_patient_documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'patient-documents')
  WITH CHECK (bucket_id = 'patient-documents');

-- ── 5. VERIFICATION ──────────────────────────────────────────────────────

DO $$
DECLARE
  missing_cols text := '';
  col_name text;
  required_cols text[] := ARRAY[
    'quarter','referred_by','insurance_provider','policy_number',
    'nhi_number','pre_auth_status','occupation',
    'nok_name','nok_relation','nok_phone','photo_url'
  ];
BEGIN
  FOREACH col_name IN ARRAY required_cols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'patients' AND column_name = col_name
    ) THEN
      missing_cols := missing_cols || col_name || ' ';
    END IF;
  END LOOP;

  IF missing_cols <> '' THEN
    RAISE EXCEPTION 'Missing columns on patients: %', missing_cols;
  END IF;

  RAISE NOTICE '✓ patients table: all 11 required columns present';

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'patient-photos') THEN
    RAISE NOTICE '✓ storage bucket: patient-photos exists';
  ELSE
    RAISE WARNING '⚠ storage bucket patient-photos was NOT created — check storage extension is enabled';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'patient-documents') THEN
    RAISE NOTICE '✓ storage bucket: patient-documents exists';
  ELSE
    RAISE WARNING '⚠ storage bucket patient-documents was NOT created';
  END IF;
END;
$$;
