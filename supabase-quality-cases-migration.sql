-- Migration: mm_cases table for Quality Improvement / M&M register
-- Apply via: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.mm_cases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date        NOT NULL,
  patient_ref     text        NOT NULL DEFAULT '',
  procedure       text        NOT NULL DEFAULT '',
  complication    text        NOT NULL DEFAULT '',
  category        text        NOT NULL DEFAULT 'early_postop'
                              CHECK (category IN ('intraoperative', 'early_postop', 'late_postop', 'near_miss', 'adverse_event')),
  grade           text        NOT NULL DEFAULT ''
                              CHECK (grade IN ('', 'I', 'II', 'IIIa', 'IIIb', 'IVa', 'IVb', 'V')),
  grade_suffix    boolean     NOT NULL DEFAULT false,
  contributing    text[]      NOT NULL DEFAULT '{}',
  re_operation    boolean     NOT NULL DEFAULT false,
  icu_admission   boolean     NOT NULL DEFAULT false,
  death           boolean     NOT NULL DEFAULT false,
  lessons_learned text        NOT NULL DEFAULT '',
  action_items    text        NOT NULL DEFAULT '',
  review_status   text        NOT NULL DEFAULT 'pending'
                              CHECK (review_status IN ('pending', 'reviewed', 'actioned')),
  review_date     date,
  reviewed_by     text        NOT NULL DEFAULT '',
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mm_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.mm_cases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mm_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mm_cases TO service_role;

CREATE INDEX IF NOT EXISTS idx_mm_cases_date          ON public.mm_cases(date DESC);
CREATE INDEX IF NOT EXISTS idx_mm_cases_review_status ON public.mm_cases(review_status);
CREATE INDEX IF NOT EXISTS idx_mm_cases_category      ON public.mm_cases(category);

DROP TRIGGER IF EXISTS mm_cases_updated_at ON public.mm_cases;
CREATE TRIGGER mm_cases_updated_at
  BEFORE UPDATE ON public.mm_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
