-- Migration: tax_planner_state table
-- Stores the entire tax-planner JSON blob as one JSONB row per install.
-- Apply via: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.tax_planner_state (
  id          text        PRIMARY KEY,
  data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: no authenticated user access needed — server connects as service_role only
ALTER TABLE public.tax_planner_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tax_planner_state TO service_role;

-- Storage bucket 'tax-planner-uploads' is created automatically by the server on first boot.
-- If you want to pre-create it via the Supabase Dashboard:
--   Storage → New bucket → Name: tax-planner-uploads → Public: ON
