-- Migration: patient_billing_items table for iOS BillingLineItem sync
-- Records CPT-coded billing items added during a consultation.
-- The existing billing_charges table (web dashboard) has a different schema;
-- this table maps directly to the iOS BillingLineItem model.

CREATE TABLE IF NOT EXISTS public.patient_billing_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID          NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  cpt_code        TEXT          NOT NULL,
  cpt_description TEXT          NOT NULL DEFAULT '',
  cpt_category    TEXT          NOT NULL DEFAULT '',
  units           INTEGER       NOT NULL DEFAULT 1,
  amount_xcd      NUMERIC(10,2) NOT NULL DEFAULT 0,
  modifier        TEXT          NOT NULL DEFAULT '',
  note            TEXT          NOT NULL DEFAULT '',
  added_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_billing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.patient_billing_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_billing_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_billing_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_patient_billing_patient_id ON public.patient_billing_items(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_billing_added_at   ON public.patient_billing_items(added_at DESC);
