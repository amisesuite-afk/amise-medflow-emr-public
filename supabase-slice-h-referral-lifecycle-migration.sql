-- ── Slice H — Referral lifecycle ──────────────────────────────────────────────
-- Adds missing columns to the referrals table so the lifecycle API
-- (POST create, PATCH status transitions, GET open list) can function.
-- All operations are idempotent (IF NOT EXISTS / IF EXISTS).

-- 1. Add missing columns
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referral_type        text
      CHECK (referral_type IN ('outpatient','specialist','imaging','pathology','physio','other')),
  ADD COLUMN IF NOT EXISTS sent_at               timestamptz,
  ADD COLUMN IF NOT EXISTS response_received_at  timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz,
  ADD COLUMN IF NOT EXISTS expected_days         integer DEFAULT 14;

-- 2. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS referrals_patient_status_idx
  ON public.referrals(patient_id, status);

CREATE INDEX IF NOT EXISTS referrals_open_idx
  ON public.referrals(status, created_at DESC)
  WHERE deleted_at IS NULL
    AND status NOT IN ('completed', 'declined');
