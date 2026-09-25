-- ============================================================
-- Migration 92 — patients.visit_type
-- The iOS app selects and pushes patients.visit_type (VisitType raw values, e.g. "New Consult",
-- "Follow-up", "ERCP", "Burns"), but no wired migration ever created the column, so on a database
-- without it every patient pull/push failed with "column patients.visit_type does not exist".
-- Additive and idempotent. No CHECK: values are the app's VisitType labels (append-only list).
-- Migration 89's front-desk column guard already lists visit_type as allowed.
-- ============================================================
do $m$
begin
  if to_regclass('public.patients') is not null then
    alter table public.patients add column if not exists visit_type text;
  end if;
end
$m$;
