-- ─── patient-state-schema-migration.sql ───────────────────────────────────────
-- Adds the closed-loop patient state tables:
--   clinical_facts          — structured, versioned clinical facts
--   encounter_state_history — audit trail of encounter state transitions
--   active_alerts           — rules-engine alerts awaiting acknowledgement
--   sync_conflicts          — local ↔ remote version conflicts
--
-- Follows the New Table Checklist from CLAUDE.md:
--   1. Enable RLS
--   2. Staff access policy (authenticated)
--   3. Table-level GRANTs for both authenticated and service_role
--   4. NOT NULL on required FK columns
--   5. CHECK constraints at creation
-- ──────────────────────────────────────────────────────────────────────────────

-- ─── clinical_facts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinical_facts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id    uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  fact_type       text        NOT NULL CHECK (fact_type IN (
    'allergy', 'medication', 'diagnosis', 'symptom', 'vital', 'anthropometric',
    'lab_result', 'imaging_result', 'pathology_result', 'procedure', 'prescription',
    'investigation_order', 'clinical_note', 'follow_up', 'task', 'consent',
    'family_history', 'social_history'
  )),
  fact_value      jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'resolved', 'suspected', 'confirmed', 'refuted',
    'pending', 'cancelled', 'completed', 'overdue'
  )),
  version         integer     NOT NULL DEFAULT 1 CHECK (version >= 1),
  source          text        NOT NULL CHECK (source IN (
    'manual', 'ai_extracted', 'ai_suggested', 'intake_questionnaire',
    'lab_import', 'derived_rule', 'historic_record', 'referral_letter'
  )),
  source_fact_ids uuid[]      NOT NULL DEFAULT '{}',
  rule_id         text,
  created_by      text        NOT NULL DEFAULT 'system',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  verified_by     text,
  verified_at     timestamptz,
  expires_at      timestamptz,
  display_reason  text,
  metadata        jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_clinical_facts_patient   ON public.clinical_facts (patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_encounter ON public.clinical_facts (encounter_id) WHERE encounter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_facts_type      ON public.clinical_facts (fact_type);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_status    ON public.clinical_facts (status);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_updated   ON public.clinical_facts (updated_at);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_value_gin ON public.clinical_facts USING gin (fact_value);

ALTER TABLE public.clinical_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.clinical_facts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_facts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clinical_facts TO service_role;

-- Auto-bump updated_at on update
CREATE OR REPLACE FUNCTION public.set_clinical_fact_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clinical_facts_updated_at
  BEFORE UPDATE ON public.clinical_facts
  FOR EACH ROW EXECUTE FUNCTION public.set_clinical_fact_updated_at();

-- ─── encounter_state_history ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.encounter_state_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid        NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id   uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  state        text        NOT NULL CHECK (state IN (
    'registration', 'intake', 'triage', 'consultation', 'investigation',
    'treatment', 'procedure', 'discharge', 'follow_up', 'closed'
  )),
  entered_at   timestamptz NOT NULL DEFAULT now(),
  exited_at    timestamptz,
  entered_by   text        NOT NULL DEFAULT 'system',
  notes        text
);

CREATE INDEX IF NOT EXISTS idx_esh_encounter ON public.encounter_state_history (encounter_id);
CREATE INDEX IF NOT EXISTS idx_esh_patient   ON public.encounter_state_history (patient_id);

ALTER TABLE public.encounter_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.encounter_state_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.encounter_state_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.encounter_state_history TO service_role;

-- ─── active_alerts ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.active_alerts (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id              uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id            uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  rule_id                 text        NOT NULL,
  severity                text        NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message                 text        NOT NULL,
  detail                  text        NOT NULL DEFAULT '',
  triggering_fact_id      uuid        REFERENCES public.clinical_facts(id) ON DELETE SET NULL,
  related_fact_ids        uuid[]      NOT NULL DEFAULT '{}',
  requires_acknowledgement boolean   NOT NULL DEFAULT false,
  acknowledged_by         text,
  acknowledged_at         timestamptz,
  override_reason         text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient ON public.active_alerts (patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.active_alerts (severity) WHERE acknowledged_at IS NULL;

ALTER TABLE public.active_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.active_alerts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.active_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.active_alerts TO service_role;

-- ─── sync_conflicts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id       uuid        NOT NULL REFERENCES public.clinical_facts(id) ON DELETE CASCADE,
  patient_id    uuid        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  local_fact    jsonb       NOT NULL,
  remote_fact   jsonb       NOT NULL,
  detected_at   timestamptz NOT NULL DEFAULT now(),
  resolution    text        NOT NULL DEFAULT 'pending' CHECK (resolution IN (
    'local_wins', 'remote_wins', 'merge', 'pending'
  )),
  resolved_by   text,
  resolved_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conflicts_patient    ON public.sync_conflicts (patient_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_pending    ON public.sync_conflicts (fact_id) WHERE resolution = 'pending';

ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.sync_conflicts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sync_conflicts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sync_conflicts TO service_role;

-- ─── clinical_audit_log ───────────────────────────────────────────────────────
-- Permanent compliance audit trail — insert-only (no updates, no deletes allowed).

CREATE TABLE IF NOT EXISTS public.clinical_audit_log (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp              timestamptz NOT NULL DEFAULT now(),
  user_id                text        NOT NULL DEFAULT 'system',
  session_id             text        NOT NULL DEFAULT '',
  action                 text        NOT NULL CHECK (action IN (
    'fact_created', 'fact_updated', 'fact_status_changed', 'fact_verified',
    'fact_acknowledged', 'encounter_transitioned', 'rule_fired',
    'sync_push', 'sync_pull', 'conflict_resolved', 'override_recorded'
  )),
  entity_type            text        NOT NULL CHECK (entity_type IN ('fact', 'encounter', 'alert')),
  entity_id              text        NOT NULL,
  previous_value         jsonb,
  new_value              jsonb,
  source                 text        NOT NULL CHECK (source IN (
    'ui', 'api', 'rules_engine', 'ai', 'sync', 'import'
  )),
  clinical_significance  text        NOT NULL CHECK (clinical_significance IN (
    'safety_critical', 'clinical', 'administrative'
  )),
  override_justification text,
  patient_id             uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  encounter_id           uuid        REFERENCES public.encounters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_patient   ON public.clinical_audit_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.clinical_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity    ON public.clinical_audit_log (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_safety    ON public.clinical_audit_log (clinical_significance)
  WHERE clinical_significance = 'safety_critical';

ALTER TABLE public.clinical_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log is read-only for authenticated staff; only service_role may insert (via API/rules)
CREATE POLICY "staff read" ON public.clinical_audit_log
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.clinical_audit_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.clinical_audit_log TO service_role;

-- Block updates and deletes on audit log (immutability enforcement)
CREATE OR REPLACE RULE audit_log_no_update AS
  ON UPDATE TO public.clinical_audit_log DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_log_no_delete AS
  ON DELETE TO public.clinical_audit_log DO INSTEAD NOTHING;
