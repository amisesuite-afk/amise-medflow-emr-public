-- ============================================================
-- Slice A — AI Proposal workflow + Note versioning
-- 2026-07-30
-- Adds:
--   1. ai_proposals table  (AI_PROPOSED → reviewed lifecycle)
--   2. clinical_notes.version + previous_version_id  (amendment chain)
--   3. Fix clinical_notes.sign-notes to track signed_by
-- Safe to run multiple times (all IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 1. AI PROPOSALS ──────────────────────────────────────────────────────────
-- Stores every AI-generated output before it enters the legal record.
-- Status must be 'approved' or 'edited' before content reaches clinical_notes.

CREATE TABLE IF NOT EXISTS ai_proposals (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient / encounter context
  patient_id         uuid        REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id       uuid        REFERENCES encounters(id) ON DELETE SET NULL,

  -- What kind of AI work produced this
  proposal_type      text        NOT NULL
                     CHECK (proposal_type IN (
                       'soap_segment',       -- VoiceDictation → /api/voice/segment
                       'document_extract',   -- extractDocumentInsights
                       'consult_suggestion', -- /api/ai-consult
                       'letter_draft',       -- generate-letter
                       'note_draft',         -- AmbientConsultation
                       'other'
                     )),

  -- Source artifact (the raw clinical evidence this was derived from)
  source_type        text        CHECK (source_type IN (
                       'voice_transcript', 'uploaded_document',
                       'manual_context', 'patient_context', 'other'
                     )),
  source_content     text,       -- raw transcript / prompt sent to the model

  -- AI execution metadata
  model              text        NOT NULL,
  model_version      text,
  prompt_version     text,
  execution_id       uuid        NOT NULL DEFAULT gen_random_uuid(),
  generated_at       timestamptz NOT NULL DEFAULT now(),

  -- The structured output from the model (proposal content)
  content            jsonb       NOT NULL,

  -- Clinician review
  status             text        NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed', 'approved', 'rejected', 'edited')),
  reviewed_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  approved_content   jsonb,      -- clinician-edited version; null = accepted as-is
  rejection_reason   text,

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_proposals_patient_idx    ON ai_proposals(patient_id);
CREATE INDEX IF NOT EXISTS ai_proposals_encounter_idx  ON ai_proposals(encounter_id);
CREATE INDEX IF NOT EXISTS ai_proposals_status_idx     ON ai_proposals(status);

ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_proposals' AND policyname = 'staff access ai_proposals'
  ) THEN
    CREATE POLICY "staff access ai_proposals"
      ON ai_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_proposals TO service_role;

-- ── 2. NOTE VERSIONING ────────────────────────────────────────────────────────
-- Adds amendment chain to clinical_notes.
-- When a signed note is amended: mark original 'amended', insert new row
-- with previous_version_id pointing to it.

ALTER TABLE clinical_notes
  ADD COLUMN IF NOT EXISTS version            integer      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id uuid        REFERENCES clinical_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_proposal_id     uuid        REFERENCES ai_proposals(id) ON DELETE SET NULL;

COMMENT ON COLUMN clinical_notes.version IS
  'Monotonically increasing version within an amendment chain. First version = 1.';
COMMENT ON COLUMN clinical_notes.previous_version_id IS
  'Points to the note this version amends. Null for the initial version.';
COMMENT ON COLUMN clinical_notes.ai_proposal_id IS
  'The ai_proposals row whose approved_content was used to create this note, if any.';
