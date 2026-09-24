-- Migration 80: mm_cases — add RCA / postmortem analysis columns
-- Adds timeline reconstruction, 5 Whys, structured action items, and
-- AI-generated root-cause summary to existing mm_cases rows.

-- mm_cases' creating migrations are excluded from the runner (two conflicting
-- definitions, see migrations/README.md), so on a fresh database the table may
-- not exist. Skip with a notice then; production has the table, so it is
-- unaffected. Re-run this step after the conflict is resolved and wired in.
DO $guard$ BEGIN
  IF to_regclass('public.mm_cases') IS NULL THEN
    RAISE NOTICE 'mm_cases missing: RCA columns skipped';
    RETURN;
  END IF;
  EXECUTE $sql$
    ALTER TABLE public.mm_cases
      ADD COLUMN IF NOT EXISTS timeline_events    JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS five_whys          JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS structured_actions JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS rca_summary        TEXT  NOT NULL DEFAULT ''
  $sql$;
  EXECUTE $sql$
    COMMENT ON COLUMN public.mm_cases.timeline_events    IS 'Chronological event log: [{time: text, event: text}]'
  $sql$;
  EXECUTE $sql$
    COMMENT ON COLUMN public.mm_cases.five_whys          IS 'Iterative root-cause drill-down: [{why: text, answer: text}]'
  $sql$;
  EXECUTE $sql$
    COMMENT ON COLUMN public.mm_cases.structured_actions IS 'Action items with ownership: [{text, owner, dueDate, status: open|in_progress|done}]'
  $sql$;
  EXECUTE $sql$
    COMMENT ON COLUMN public.mm_cases.rca_summary        IS 'AI-generated postmortem / root-cause analysis narrative'
  $sql$;
END $guard$;
