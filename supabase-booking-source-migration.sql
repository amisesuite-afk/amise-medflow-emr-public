-- Migration: booking_source
-- Adds source channel tracking + WhatsApp contact name to appointment_requests.
-- Run in Supabase SQL Editor. 2026-06-02

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'manual', 'phone', 'email')),
  ADD COLUMN IF NOT EXISTS whatsapp_from text;

COMMENT ON COLUMN appointment_requests.source IS 'Channel the booking request arrived from: web form, WhatsApp webhook, manual staff entry, phone call, or email';
COMMENT ON COLUMN appointment_requests.whatsapp_from IS 'WhatsApp sender number (E.164, no whatsapp: prefix) for inbound webhook requests';

-- Index: queue page filters by source
CREATE INDEX IF NOT EXISTS idx_appt_requests_source
  ON appointment_requests (source, status, created_at);

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.columns
          WHERE table_name = 'appointment_requests'
            AND column_name IN ('source', 'whatsapp_from')) = 2,
    'Expected 2 new columns on appointment_requests';
  RAISE NOTICE 'Migration booking_source: OK';
END;
$$;
