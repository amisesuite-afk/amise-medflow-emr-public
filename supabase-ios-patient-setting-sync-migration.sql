-- Migration 71: patients — setting, location, acuity columns for iOS multi-device sync
--
-- The iOS EMR assigns every patient a ClinicalSetting (outpatient / inpatient / theatre /
-- endoscopy / emergency), ClinicalLocation (rodney_bay / tapion / okeu / victoria / other),
-- and Acuity (routine / priority / urgent / emergency).  Without these columns in Supabase
-- the iPad pulls patients from the remote but they all default to .outpatient locally, so
-- they never appear in the Ward Rounds section even though they exist.

alter table patients
  add column if not exists setting  text not null default 'outpatient'
    check (setting in ('outpatient','inpatient','theatre','endoscopy','emergency')),
  add column if not exists location text not null default 'rodney_bay'
    check (location in ('rodney_bay','tapion','okeu','victoria','other')),
  add column if not exists acuity   text not null default 'routine'
    check (acuity in ('routine','priority','urgent','emergency'));
