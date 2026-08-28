-- Migration: patient_operative_plans table for iOS OperativePlan sync
-- Stores consent, anaesthetic prep, and WHO surgical safety checklist data.
-- WHO checklist booleans stored as a JSONB object to avoid 17 separate columns.

CREATE TABLE IF NOT EXISTS public.patient_operative_plans (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Consent
  consent_procedure       TEXT        NOT NULL DEFAULT '',
  consent_signed          BOOLEAN     NOT NULL DEFAULT false,
  -- Anaesthesia & prep
  anaesthesia_type        TEXT        NOT NULL DEFAULT 'General',
  positioning             TEXT        NOT NULL DEFAULT 'Supine',
  antibiotic_prophylaxis  TEXT        NOT NULL DEFAULT '',
  vte_prophy              TEXT        NOT NULL DEFAULT '',
  special_equipment       TEXT        NOT NULL DEFAULT '',
  surgical_team_note      TEXT        NOT NULL DEFAULT '',
  -- WHO checklist (17 booleans stored as JSONB for compactness)
  who_checklist           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_operative_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.patient_operative_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_operative_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_operative_plans TO service_role;

CREATE INDEX IF NOT EXISTS idx_patient_op_plans_patient_id ON public.patient_operative_plans(patient_id);

-- Keep updated_at current on every write
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS patient_operative_plans_updated_at ON public.patient_operative_plans;
CREATE TRIGGER patient_operative_plans_updated_at
  BEFORE UPDATE ON public.patient_operative_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
