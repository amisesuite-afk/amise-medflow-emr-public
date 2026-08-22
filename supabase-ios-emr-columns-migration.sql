-- Migration 68: iOS EMR — working diagnosis + assessment fields on patients
-- Adds the three clinical-intelligence columns written by the iOS app's SyncService.pushPatientEdits
-- and the working_diagnosis-seeded rx/prescription remote table.
-- Idempotent: all statements use ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

-- 1. Extend the patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS working_diagnosis       TEXT,
  ADD COLUMN IF NOT EXISTS working_diagnosis_icd   TEXT,
  ADD COLUMN IF NOT EXISTS assessment_text         TEXT;

-- 2. Prescriptions table (written by iOS; referenced by web dashboard billing radiation)
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  drug            TEXT NOT NULL,
  dose            TEXT,
  route           TEXT,
  frequency       TEXT,
  duration        TEXT,
  indication      TEXT,
  instructions    TEXT,
  prescribed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prescribed_by   UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "staff access" ON public.prescriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO service_role;

-- 3. Patient documents table (imported via iOS PhotosPicker; AI-summarised)
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'image/jpeg',
  storage_url     TEXT,
  ai_summary      TEXT,
  extracted_text  TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by     UUID REFERENCES auth.users(id)
);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "staff access" ON public.patient_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_documents TO service_role;
