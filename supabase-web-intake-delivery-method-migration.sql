-- Migration: add 'web_intake' to questionnaire_sessions.delivery_method
-- The web intake flow (front-desk /intake page) creates questionnaire sessions
-- with delivery_method='web_intake', which is not in the original check constraint.
-- 2026-06-23

ALTER TABLE questionnaire_sessions
  DROP CONSTRAINT IF EXISTS questionnaire_sessions_delivery_method_check;

ALTER TABLE questionnaire_sessions
  ADD CONSTRAINT questionnaire_sessions_delivery_method_check
  CHECK (delivery_method IN ('kiosk', 'whatsapp_link', 'qr_code', 'staff_assisted', 'web_intake'));
