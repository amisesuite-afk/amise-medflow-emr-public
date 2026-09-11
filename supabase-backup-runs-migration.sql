-- Migration: backup_runs table
-- Tracks every NAS backup attempt (DB + Storage).
-- Written by GitHub Actions on each run; readable by dashboard.

CREATE TABLE IF NOT EXISTS public.backup_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text        NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  backup_type     text        NOT NULL CHECK (backup_type IN ('db', 'storage', 'full')),
  triggered_by    text        NOT NULL DEFAULT 'github_actions',
  run_id          text,                     -- GitHub Actions run ID for log link
  size_bytes      bigint,                   -- compressed + encrypted DB size
  nas_path        text,                     -- final NAS path of the backup file
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read" ON public.backup_runs
  FOR SELECT TO authenticated USING (true);

-- GitHub Actions uses service_role to insert (no RLS check needed, but GRANT required)
GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_runs TO service_role;

-- Sequence for dashboard queries (most recent first)
CREATE INDEX IF NOT EXISTS backup_runs_started_at_idx
  ON public.backup_runs (started_at DESC);
