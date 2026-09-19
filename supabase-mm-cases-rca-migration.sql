-- Migration 80: mm_cases — add RCA / postmortem analysis columns
-- Adds timeline reconstruction, 5 Whys, structured action items, and
-- AI-generated root-cause summary to existing mm_cases rows.

ALTER TABLE public.mm_cases
  ADD COLUMN IF NOT EXISTS timeline_events    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS five_whys          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS structured_actions JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rca_summary        TEXT  NOT NULL DEFAULT '';

COMMENT ON COLUMN public.mm_cases.timeline_events    IS 'Chronological event log: [{time: text, event: text}]';
COMMENT ON COLUMN public.mm_cases.five_whys          IS 'Iterative root-cause drill-down: [{why: text, answer: text}]';
COMMENT ON COLUMN public.mm_cases.structured_actions IS 'Action items with ownership: [{text, owner, dueDate, status: open|in_progress|done}]';
COMMENT ON COLUMN public.mm_cases.rca_summary        IS 'AI-generated postmortem / root-cause analysis narrative';
