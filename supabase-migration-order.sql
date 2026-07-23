-- ============================================================
-- Amise Medical Services — Migration Order Reference
-- ============================================================
-- Run supabase-schema.sql FIRST, then these in order.
-- Each is idempotent (CREATE IF NOT EXISTS / ALTER ADD IF NOT EXISTS).
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Clinical records: clinical_notes, documents, billing_charges,
--    imaging_orders, investigation_results
\i supabase-clinical-records-migration.sql

-- 2. Patient portal: patients.auth_user_id, patients.portal_enabled
\i supabase-patient-portal-migration.sql

-- 3. Questionnaires: questionnaire_templates, question_bank,
--    branching_rules, questionnaire_sessions, questionnaire_responses,
--    intake_summaries, consent_records
\i supabase-apcq-migration.sql

-- 4. Questionnaire token expiry: questionnaire_sessions.expires_at
\i supabase-questionnaire-token-expiry-migration.sql

-- 5. EMR persistence: UNIQUE on assessments/plans encounter_id,
--    allergies.allergen_ci, medications index, vitals default
\i supabase-emr-persistence-migration.sql

-- 6. Portal self-service: patient_intake, patients.nok_*/blood_group/height/weight
\i supabase-portal-self-service-migration.sql

-- 7. AI adaptive intake: consultation_requests, patient_intake additions
\i supabase-ai-adaptive-intake-migration.sql

-- 8. Booking notifications: appointment_requests.patient_ack_sent_at etc.
--    (idempotent — base schema already has these columns)
\i supabase-booking-notifications-migration.sql

-- 9. Booking source: appointment_requests.source, .whatsapp_from
--    (idempotent — base schema already has these columns)
\i supabase-booking-source-migration.sql

-- 10. Email/document intake: referring_providers, documents.patient_id nullable
\i supabase-email-document-intake-migration.sql

-- 11. Document AI extraction: documents.ai_extraction_* columns
\i supabase-document-ai-extraction-migration.sql

-- 12. Documents clinical photo: adds 'clinical_photo' to document_type check
\i supabase-documents-clinical-photo-migration.sql

-- 13. Vitals photo extraction: questionnaire_sessions vitals columns
\i supabase-vitals-photo-migration.sql

-- 14. Service role grants fix: ensures service_role has grants on all tables
\i supabase-service-role-grants-fix-migration.sql

-- 15. Appointment email optional: makes patient_email nullable
\i supabase-appointment-requests-email-optional-migration.sql

-- 16. Referring doctors seed data
\i supabase-referring-doctors-seed-migration.sql

-- 17. Confirmed appointments table (prerequisite for intake-reminder)
\i supabase-confirmed-appointments-migration.sql

-- 18. Intake reminder: confirmed_appointments.intake_reminder_sent
\i supabase-intake-reminder-migration.sql

-- 19. Booking waitlist: waitlist status support
\i supabase-booking-waitlist-migration.sql

-- 20. Patients quarter: patients.quarter
\i supabase-patients-quarter-migration.sql

-- 21. Procedure prep drafts: procedure_prep_drafts table
\i supabase-procedure-prep-drafts-migration.sql

-- 22. Post-visit followup: confirmed_appointments.post_visit_followup_sent
\i supabase-post-visit-followup-migration.sql

-- 23. Appointment change requests: appointment_change_requests table
\i supabase-appointment-change-requests-migration.sql

-- 24. User default site: user_profiles.default_site
\i supabase-user-default-site-migration.sql

-- 25. Preferred slot type fix: appointment_requests.preferred_slot timestamptz -> text
\i supabase-preferred-slot-text-migration.sql

-- 26. Align appointment_requests columns with application code:
--     adds appointment_type, location, triage_acuity, triage_score,
--     confirmed_slot, staff_confirmed_at, patient_confirmed_at,
--     prep_sms_sent, reminder_sent_at, whatsapp_from, google_event_id, reason.
--     Backfills from old column names (chief_complaint→appointment_type etc.)
\i supabase-appointment-requests-align-migration.sql

-- 27. Patient photo URL: patients.photo_url text (nullable)
\i supabase-add-photo-url.sql

-- 28. Web intake delivery method: adds 'web_intake' to
--     questionnaire_sessions.delivery_method CHECK constraint
\i supabase-web-intake-delivery-method-migration.sql

-- 29. Clinical scores + extracted labs: encounters.clinical_scores jsonb,
--     encounters.extracted_labs jsonb, GIN index on clinical_scores
\i supabase-clinical-scores-migration.sql

-- ============================================================
-- FULL TABLE INVENTORY (after all migrations)
-- ============================================================
-- Base schema (supabase-schema.sql):
--   user_profiles, patients, encounters, vitals, symptoms,
--   medications, allergies, assessments, plans, procedures,
--   referrals, appointments, audit_logs, appointment_requests
--
-- Migration additions:
--   clinical_notes, documents, billing_charges, imaging_orders,
--   investigation_results, questionnaire_templates, question_bank,
--   branching_rules, questionnaire_sessions, questionnaire_responses,
--   intake_summaries, consent_records, patient_intake,
--   consultation_requests, referring_providers,
--   confirmed_appointments, procedure_prep_drafts,
--   appointment_change_requests
--
-- Total: 32 tables
-- ============================================================
