-- Theatre sessions + cases — persists operating lists and links to Google Calendar events.
-- Run in Supabase SQL editor before deploying.

-- ── theatre_sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.theatre_sessions (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_date      date        NOT NULL,
  session_type      text        NOT NULL DEFAULT 'morning'
                                CHECK (session_type IN ('morning','afternoon','full_day','ercp')),
  location_key      text        NOT NULL DEFAULT 'tapion',
  google_event_id   text,
  google_calendar_id text,
  cal_start_time    timestamptz,
  cal_end_time      timestamptz,
  cal_summary       text,
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','published','cancelled')),
  published_at      timestamptz,
  published_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── theatre_cases ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.theatre_cases (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   uuid        NOT NULL REFERENCES public.theatre_sessions(id) ON DELETE CASCADE,
  patient_id   uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text        NOT NULL,
  procedure    text        NOT NULL,
  duration_min integer     NOT NULL DEFAULT 60,
  position     text,
  anaesthetic  text,
  equipment    text[],
  antibiotics  text,
  notes        text,
  proc_group   text,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS theatre_sessions_google_event_id_idx
  ON public.theatre_sessions (google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS theatre_sessions_date_idx
  ON public.theatre_sessions (session_date DESC);

CREATE INDEX IF NOT EXISTS theatre_cases_session_idx
  ON public.theatre_cases (session_id, sort_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.theatre_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theatre_cases    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.theatre_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "staff access" ON public.theatre_cases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.theatre_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.theatre_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.theatre_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.theatre_cases TO service_role;
