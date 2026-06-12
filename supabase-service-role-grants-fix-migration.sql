-- Fix: grant the service_role Postgres role table privileges on core
-- clinical tables. The base schema and the clinical-records migration only
-- granted these tables to `authenticated`, but artifacts/api-server's sb()
-- client connects as `service_role` (SUPABASE_SERVICE_ROLE_KEY). Without an
-- explicit grant, Postgres returns "permission denied for table X" (42501)
-- for any query the API server makes against these tables — even though
-- service_role bypasses RLS, it still needs the underlying table privilege.
--
-- service_role is a trusted, server-only credential, so full privileges are
-- appropriate here (RLS is bypassed for this role regardless).

grant select, insert, update, delete on public.user_profiles        to service_role;
grant select, insert, update, delete on public.patients             to service_role;
grant select, insert, update, delete on public.encounters           to service_role;
grant select, insert, update, delete on public.vitals               to service_role;
grant select, insert, update, delete on public.symptoms             to service_role;
grant select, insert, update, delete on public.medications          to service_role;
grant select, insert, update, delete on public.allergies            to service_role;
grant select, insert, update, delete on public.assessments          to service_role;
grant select, insert, update, delete on public.plans                to service_role;
grant select, insert, update, delete on public.procedures           to service_role;
grant select, insert, update, delete on public.referrals            to service_role;
grant select, insert, update, delete on public.appointments         to service_role;
grant select, insert, update, delete on public.audit_logs           to service_role;

grant select, insert, update, delete on public.clinical_notes       to service_role;
grant select, insert, update, delete on public.documents            to service_role;
grant select, insert, update, delete on public.billing_charges      to service_role;
grant select, insert, update, delete on public.imaging_orders       to service_role;
grant select, insert, update, delete on public.investigation_results to service_role;

grant select, insert, update, delete on public.patient_intake       to service_role;
