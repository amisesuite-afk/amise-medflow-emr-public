-- ────────────────────────────────────────────────────────────────────────────
-- patient_token_blacklist: persisted JWT JTI blacklist for patient auth logout
-- Run in Supabase SQL editor (once).
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.patient_token_blacklist (
  jti        TEXT        PRIMARY KEY,
  exp        TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_token_blacklist ENABLE ROW LEVEL SECURITY;

-- Staff can read (for auditing); only service_role can write (via API server)
CREATE POLICY "staff read" ON public.patient_token_blacklist
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.patient_token_blacklist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_token_blacklist TO service_role;

-- Auto-clean expired entries daily (keep table from growing unbounded)
-- Requires pg_cron extension. If not available, add a periodic cleanup call in cron.ts instead.
-- SELECT cron.schedule('cleanup-token-blacklist', '0 3 * * *',
--   $$DELETE FROM public.patient_token_blacklist WHERE exp < NOW()$$);
