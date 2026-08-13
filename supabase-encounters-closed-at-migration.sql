-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: encounters.closed_at — powers the reopen-for-edit grace period
--
-- POST /api/visit/complete now stamps closed_at when it sets status='closed'.
-- POST /api/visit/reopen/:encounterId (new) allows the treating doctor to
-- reopen a closed encounter for correction within a grace window (default
-- 7 days, ENCOUNTER_REOPEN_GRACE_DAYS env var) measured from closed_at.
--
-- Run this once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table encounters
  add column if not exists closed_at timestamptz;

create index if not exists idx_encounters_closed_at
  on encounters(closed_at)
  where closed_at is not null;
