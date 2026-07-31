-- ── Slice I — Prescriptions ────────────────────────────────────────────────
-- Creates the prescriptions table with full RLS and grants.
-- Items are stored as JSONB (list of PrescriptionItem objects).
-- All operations are idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES public.patients(id),
  encounter_id     uuid REFERENCES public.encounters(id),
  prescribed_by    uuid NOT NULL,
  prescriber_name  text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'signed', 'dispensed')),
  items            jsonb NOT NULL DEFAULT '[]',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- Index for patient history queries
CREATE INDEX IF NOT EXISTS prescriptions_patient_idx
  ON public.prescriptions(patient_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Index for encounter-scoped queries
CREATE INDEX IF NOT EXISTS prescriptions_encounter_idx
  ON public.prescriptions(encounter_id)
  WHERE encounter_id IS NOT NULL AND deleted_at IS NULL;

-- RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "staff access" ON public.prescriptions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grants (both roles required — service_role bypasses RLS but not table GRANTs)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescriptions TO service_role;
