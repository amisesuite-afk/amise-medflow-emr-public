-- Migration: add encounter_status and check_in_time to patients
-- Supports front-desk → doctor real-time handoff on iPad/iPhone

-- 1. Add columns (idempotent via IF NOT EXISTS)
ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS encounter_status TEXT NOT NULL DEFAULT 'not_checked_in',
    ADD COLUMN IF NOT EXISTS check_in_time    TIMESTAMPTZ;

-- 2. Constrain valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'patients' AND constraint_name = 'patients_encounter_status_check'
    ) THEN
        ALTER TABLE public.patients
            ADD CONSTRAINT patients_encounter_status_check
            CHECK (encounter_status IN ('not_checked_in', 'waiting', 'with_doctor', 'complete'));
    END IF;
END $$;

-- 3. Index for the doctor's "waiting today" query
CREATE INDEX IF NOT EXISTS idx_patients_encounter_status
    ON public.patients (encounter_status, check_in_time)
    WHERE encounter_status = 'waiting';

-- 4. Enable realtime publication so iOS receives instant push on INSERT/UPDATE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'patients'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
    END IF;
END $$;
