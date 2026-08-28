-- Migration: patient_vitals table for iOS VitalsEntry sync
-- The existing `vitals` table (web dashboard) requires encounter_id NOT NULL
-- and is tied to the web encounter workflow. This table is encounter-free,
-- mirroring the iOS VitalsEntry model which is linked only to a patient.

CREATE TABLE IF NOT EXISTS public.patient_vitals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  bp_systolic         INTEGER,
  bp_diastolic        INTEGER,
  heart_rate          INTEGER,
  respiratory_rate    INTEGER,
  temperature_c       NUMERIC(4,1),
  spo2                INTEGER,
  weight_kg           NUMERIC(5,1),
  glucose_mmol        NUMERIC(4,1),
  avpu                TEXT        CHECK (avpu IN ('A','C','V','P','U')),
  on_supplemental_o2  BOOLEAN     NOT NULL DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.patient_vitals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_vitals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_vitals TO service_role;

CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id  ON public.patient_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vitals_recorded_at ON public.patient_vitals(recorded_at DESC);
