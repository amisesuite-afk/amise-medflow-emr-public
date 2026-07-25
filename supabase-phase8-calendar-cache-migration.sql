-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 8 migration: calendar_event_cache + FHIR preparation
-- Amise MedFlow EMR — 2026-07-25
--
-- Replaces the ephemeral src/data/calendar-cache.json file with a Supabase
-- table so the event cache persists across Render container restarts and is
-- shared between server instances.
--
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.calendar_event_cache (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_key  text        NOT NULL UNIQUE, -- 'rodney_bay' | 'tapion' | 'combined'
  calendar_id   text        NOT NULL,        -- the actual Google Calendar ID
  fetched_at    timestamptz NOT NULL,
  time_zone     text        NOT NULL DEFAULT 'America/St_Lucia',
  events        jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_event_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.calendar_event_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_event_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_event_cache TO service_role;

DROP TRIGGER IF EXISTS trg_updated_at ON public.calendar_event_cache;
CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON public.calendar_event_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendar_event_cache_key
  ON public.calendar_event_cache(calendar_key);
