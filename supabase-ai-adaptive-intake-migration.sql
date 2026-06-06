-- ============================================================
-- Amise Medical Services — AI Adaptive Intake Migration
-- Adds: adaptive intake columns, AI summary fields,
--       consultation_requests table (public self-service)
--
-- Run in: Supabase Dashboard → SQL Editor
-- Prerequisites: supabase-portal-self-service-migration.sql applied first
-- ============================================================

-- ── Extend patient_intake ─────────────────────────────────────────────────────
alter table patient_intake
  add column if not exists visit_type        text,   -- surgical | endoscopy | followup | unsure
  add column if not exists complaint_track   text,   -- gallbladder | gastric | gerd | screening | etc.
  add column if not exists complexity_score  integer default 0,
  add column if not exists ai_summary        text,
  add column if not exists ai_summary_at     timestamptz,
  add column if not exists ai_reviewed       boolean default false;

-- ── Consultation requests (public, no portal account needed) ──────────────────
create table if not exists consultation_requests (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  phone       text,
  email       text,
  visit_type  text,   -- surgical | endoscopy | followup | unsure
  description text,
  created_at  timestamptz default now(),
  status      text default 'new'
    check (status in ('new', 'contacted', 'registered')),
  staff_notes text
);

alter table consultation_requests enable row level security;

-- Staff can read and manage all requests
drop policy if exists "staff_manage_consultation_requests" on consultation_requests;
create policy "staff_manage_consultation_requests" on consultation_requests
  for all to authenticated using (true) with check (true);

-- Anyone (anon) can submit a new request — this is the public "request consult" form
drop policy if exists "anon_insert_consultation_requests" on consultation_requests;
create policy "anon_insert_consultation_requests" on consultation_requests
  for insert to anon with check (true);

grant insert on public.consultation_requests to anon;
grant all on public.consultation_requests to authenticated;

-- ── RLS: allow staff to read/update ai_summary on patient_intake ──────────────
-- (The existing patients_select_own_intake policy covers patient reads.)
-- Staff access is via service_role key on the API server — bypasses RLS by design.
