-- ============================================================
-- Migration 97 — patients.appointment_type
-- The iPad front-desk scheduler (AppointmentSchedulerView) records the booking type on the patient
-- (Patient.appointmentType: "New Consultation", "Follow-Up", "Procedure", "Endoscopy / ERCP",
-- "Urgent / Emergency", or a calendar-import label such as "Colonoscopy"), but the column never
-- existed on patients (only on appointments / appointment_requests), so it stayed on the device.
-- The iOS app pushes and pulls it in its own requests (SyncService+AppointmentType.swift) and
-- tolerates its absence until this migration runs. Administrative field: Migration 89's
-- front-desk column guard lists it as allowed.
-- Additive and idempotent. No CHECK: values are the app's labels.
-- ============================================================
do $m$
begin
  if to_regclass('public.patients') is not null then
    alter table public.patients add column if not exists appointment_type text;
  end if;
end
$m$;
