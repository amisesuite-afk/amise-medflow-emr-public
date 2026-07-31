-- ── Slice J — Wound Assessments ───────────────────────────────────────────
-- ── Slice K — M&M / Quality Improvement Cases ──────────────────────────────
-- All operations are idempotent (IF NOT EXISTS).

-- ── 1. wound_assessments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wound_assessments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid        NOT NULL REFERENCES public.patients(id),
  encounter_id     uuid        REFERENCES public.encounters(id),
  label            text        NOT NULL,
  location         text,
  wound_class      text        CHECK (wound_class IN ('clean','clean_contaminated','contaminated','dirty')),
  closure          text        CHECK (closure IN ('primary','secondary','delayed_primary','vac','open')),
  status           text        NOT NULL DEFAULT 'healing'
                               CHECK (status IN ('healing','closed','superficial_ssi','deep_ssi','dehiscence','seroma','haematoma','necrosis')),
  dressing         text,
  drain            text        NOT NULL DEFAULT 'none'
                               CHECK (drain IN ('none','in_situ','removed')),
  drain_output_ml  integer,
  asepsis_score    integer     NOT NULL DEFAULT 0,
  asepsis_details  jsonb       NOT NULL DEFAULT '{}',
  notes            text,
  assessed_date    date        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS wound_assessments_patient_idx
  ON public.wound_assessments(patient_id, assessed_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wound_assessments_encounter_idx
  ON public.wound_assessments(encounter_id)
  WHERE encounter_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.wound_assessments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wound_assessments' AND policyname = 'staff access'
  ) THEN
    CREATE POLICY "staff access" ON public.wound_assessments
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wound_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wound_assessments TO service_role;

-- ── 2. mm_cases ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mm_cases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date        NOT NULL,
  patient_ref      text,
  procedure        text        NOT NULL,
  complication     text        NOT NULL,
  category         text        NOT NULL DEFAULT 'early_postop'
                               CHECK (category IN ('intraoperative','early_postop','late_postop','near_miss','adverse_event')),
  grade            text        CHECK (grade IN ('I','II','IIIa','IIIb','IVa','IVb','V')),
  grade_suffix     boolean     NOT NULL DEFAULT false,
  contributing     jsonb       NOT NULL DEFAULT '[]',
  re_operation     boolean     NOT NULL DEFAULT false,
  icu_admission    boolean     NOT NULL DEFAULT false,
  death            boolean     NOT NULL DEFAULT false,
  lessons_learned  text,
  action_items     text,
  review_status    text        NOT NULL DEFAULT 'pending'
                               CHECK (review_status IN ('pending','reviewed','actioned')),
  review_date      date,
  reviewed_by      text,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mm_cases_date_idx
  ON public.mm_cases(date DESC);

CREATE INDEX IF NOT EXISTS mm_cases_review_status_idx
  ON public.mm_cases(review_status, date DESC);

ALTER TABLE public.mm_cases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mm_cases' AND policyname = 'staff access'
  ) THEN
    CREATE POLICY "staff access" ON public.mm_cases
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mm_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mm_cases TO service_role;
