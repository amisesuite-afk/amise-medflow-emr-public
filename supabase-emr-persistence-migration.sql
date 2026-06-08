-- ─────────────────────────────────────────────────────────────────────────────
-- EMR Persistence — unique constraints required for upsert patterns
-- ─────────────────────────────────────────────────────────────────────────────
-- AppContext.saveAssessment / savePlan use Supabase upsert with onConflict,
-- which requires a unique index on the conflict columns. Without these
-- constraints the upsert silently falls back to INSERT on every autosave,
-- creating duplicate rows for every keypress.
--
-- Design decision: one active assessment row and one management plan row per
-- encounter — these represent the evolving clinical picture captured by the
-- doctor's consultation view. Historical versions live in clinical_notes (SOAP).
-- Additional plan types (discharge, referral, follow_up) remain unrestricted
-- and are inserted without the upsert pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- assessments: one primary assessment per encounter
alter table assessments
  add constraint assessments_encounter_unique unique (encounter_id);

-- plans: one management plan per encounter (used by the autosave path)
alter table plans
  add constraint plans_encounter_unique unique (encounter_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- vitals: recorded_at defaults to now() at DB level but the monitoring tab
-- sends a specific timestamp (wheel-picker time field). Ensure the column
-- exists with a default so rows without an explicit recorded_at still work.
-- ─────────────────────────────────────────────────────────────────────────────
alter table vitals
  alter column recorded_at set default now();
