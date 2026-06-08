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

-- ─────────────────────────────────────────────────────────────────────────────
-- allergies: unique(patient_id, allergen) enables upsert from the UI.
-- Allergen comparison is case-insensitive via ci_allergen generated column.
-- ─────────────────────────────────────────────────────────────────────────────
alter table allergies
  add column if not exists allergen_ci text generated always as (lower(allergen)) stored;
create unique index if not exists allergies_patient_allergen_ci
  on allergies (patient_id, allergen_ci);

-- ─────────────────────────────────────────────────────────────────────────────
-- medications: unique(patient_id, encounter_id, drug_name, indication)
-- The 'consultation-list' indication marks chip-selected meds so that
-- re-saving from the consultation form replaces rather than appends.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists medications_encounter_drug_indication
  on medications (patient_id, encounter_id, drug_name, indication)
  where indication = 'consultation-list';
