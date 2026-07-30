-- ============================================================
-- Slice C — Clinical State Engine
-- 2026-07-30
-- Creates:
--   1. clinical_states      — active clinical states with state machine
--   2. clinical_state_transitions — audit trail of every status change
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

-- ── 1. CLINICAL STATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_states (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  patient_id           uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id         uuid        REFERENCES encounters(id) ON DELETE SET NULL,
  problem_id           uuid        REFERENCES patient_problems(id) ON DELETE SET NULL,

  -- Classification
  state_type           text        NOT NULL DEFAULT 'diagnosis'
                       CHECK (state_type IN (
                         'diagnosis',       -- working clinical diagnosis
                         'symptom',         -- presenting symptom being tracked
                         'finding',         -- exam or investigation finding
                         'risk_factor',     -- patient risk factor
                         'complication',    -- post-operative / treatment complication
                         'functional_status',
                         'other'
                       )),

  title                text        NOT NULL,
  description          text,
  icd10_code           text,       -- optional ICD-10 mapping

  -- State machine
  status               text        NOT NULL DEFAULT 'proposed'
                       CHECK (status IN (
                         'proposed',
                         'active',
                         'suspected',
                         'confirmed',
                         'improving',
                         'worsening',
                         'stable',
                         'pending_investigation',
                         'pending_treatment',
                         'pending_review',
                         'resolved',
                         'ruled_out',
                         'entered_in_error'
                       )),

  -- Clinical metadata
  severity             text        CHECK (severity IN ('mild', 'moderate', 'severe', 'critical')),
  urgency              text        CHECK (urgency IN ('elective', 'soon', 'urgent', 'emergency')),
  confidence           text        CHECK (confidence IN ('low', 'moderate', 'high', 'definite')),
  evidence_level       text        CHECK (evidence_level IN (
                         'clinical_history', 'examination', 'investigation',
                         'imaging', 'histology', 'other'
                       )),

  -- Source evidence references
  source_references    jsonb       NOT NULL DEFAULT '[]',
  -- e.g. [{"type": "investigation_result", "id": "uuid", "label": "FBC 2026-07-30"}]

  -- Temporal
  onset_date           date,
  resolution_date      date,
  review_date          date,       -- when this state should next be reviewed
  closure_criteria     text,       -- what would constitute resolution

  -- Clinical ownership
  responsible_clinician uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  next_required_action  text,      -- free-text or structured

  -- Soft delete via entered_in_error status (not a deleted_at column)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS clinical_states_patient_idx   ON clinical_states(patient_id);
CREATE INDEX IF NOT EXISTS clinical_states_encounter_idx ON clinical_states(encounter_id);
CREATE INDEX IF NOT EXISTS clinical_states_status_idx    ON clinical_states(status);
CREATE INDEX IF NOT EXISTS clinical_states_type_idx      ON clinical_states(state_type);
CREATE INDEX IF NOT EXISTS clinical_states_problem_idx   ON clinical_states(problem_id);

-- ── 2. TRANSITION AUDIT TRAIL ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinical_state_transitions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_state_id    uuid        NOT NULL REFERENCES clinical_states(id) ON DELETE CASCADE,
  from_status          text        NOT NULL,
  to_status            text        NOT NULL,
  transitioned_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  transitioned_at      timestamptz NOT NULL DEFAULT now(),
  reason               text,
  notes                text
);

CREATE INDEX IF NOT EXISTS cst_state_idx ON clinical_state_transitions(clinical_state_id);
CREATE INDEX IF NOT EXISTS cst_time_idx  ON clinical_state_transitions(transitioned_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE clinical_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_state_transitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinical_states' AND policyname = 'staff access clinical_states'
  ) THEN
    CREATE POLICY "staff access clinical_states"
      ON clinical_states FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clinical_state_transitions' AND policyname = 'staff access clinical_state_transitions'
  ) THEN
    CREATE POLICY "staff access clinical_state_transitions"
      ON clinical_state_transitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ── GRANTS ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_states            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_states            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_state_transitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_state_transitions TO service_role;
