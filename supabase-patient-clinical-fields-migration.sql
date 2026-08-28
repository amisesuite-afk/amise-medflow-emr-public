-- Migration: add clinical consultation fields to patients table
-- These fields are written by the iOS app's ConsultationView / AssessmentView
-- and must be synced to Supabase so they persist across devices and app reinstalls.

ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS chief_complaint       text,
    ADD COLUMN IF NOT EXISTS hpi                   text,
    ADD COLUMN IF NOT EXISTS assessment_text       text,
    ADD COLUMN IF NOT EXISTS management_plan       text,
    ADD COLUMN IF NOT EXISTS working_diagnosis     text,
    ADD COLUMN IF NOT EXISTS working_diagnosis_icd text,
    ADD COLUMN IF NOT EXISTS allergies_json        text,   -- JSON: [AllergyEntry]
    ADD COLUMN IF NOT EXISTS social_history        text,
    ADD COLUMN IF NOT EXISTS height_cm             numeric(5,1),
    ADD COLUMN IF NOT EXISTS ward                  text,
    ADD COLUMN IF NOT EXISTS bed_number            text,
    ADD COLUMN IF NOT EXISTS updated_at            timestamptz DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE public.patients SET updated_at = created_at WHERE updated_at IS NULL;

-- Keep updated_at current on every write
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patients_set_updated_at ON public.patients;
CREATE TRIGGER patients_set_updated_at
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
