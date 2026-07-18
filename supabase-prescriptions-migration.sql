-- Migration: prescriptions table
-- Required for PrescriptionsTab to persist signed prescription records.
-- Apply via: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id   uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  prescribed_by  text        NOT NULL,
  prescriber_name text       NOT NULL DEFAULT '',
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'signed', 'dispensed')),
  items          jsonb       NOT NULL DEFAULT '[]',
  notes          text        NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.prescriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id   ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter_id ON public.prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at   ON public.prescriptions(created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS prescriptions_updated_at ON public.prescriptions;
CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
