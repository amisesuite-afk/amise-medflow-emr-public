-- ============================================================
-- Slice B — Workflow Tasks (unresolved loop tracking)
-- 2026-07-30
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  task_type        text        NOT NULL CHECK (task_type IN (
    'review_result',        -- result received, not yet reviewed by clinician
    'inform_patient',       -- result reviewed but patient not yet informed
    'sign_note',            -- clinical note still in draft status
    'await_referral',       -- referral sent, no response received
    'await_investigation',  -- investigation ordered, result not yet received
    'pay_invoice',          -- invoice outstanding
    'follow_up_overdue',    -- follow-up appointment not booked/completed
    'other'
  )),

  patient_id       uuid        REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id     uuid        REFERENCES encounters(id) ON DELETE SET NULL,

  -- Source reference — what created this task
  source_type      text,       -- 'investigation_result' | 'clinical_note' | 'invoice' | 'referral' | 'document'
  source_id        uuid,       -- ID of the source row

  title            text        NOT NULL,
  details          text,

  status           text        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),

  priority         text        NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('urgent', 'high', 'normal', 'low')),

  due_at           timestamptz,
  assigned_to      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  resolved_at      timestamptz,
  resolved_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note  text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_tasks_patient_idx  ON workflow_tasks(patient_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_encounter_idx ON workflow_tasks(encounter_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_status_idx   ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS workflow_tasks_type_idx     ON workflow_tasks(task_type);
-- Prevent duplicate open tasks for the same source row
CREATE UNIQUE INDEX IF NOT EXISTS workflow_tasks_source_open_uniq
  ON workflow_tasks(task_type, source_type, source_id)
  WHERE status = 'open';

ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workflow_tasks' AND policyname = 'staff access workflow_tasks'
  ) THEN
    CREATE POLICY "staff access workflow_tasks"
      ON workflow_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workflow_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workflow_tasks TO service_role;
