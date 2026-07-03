-- ── Staff scheduling module schema additions ─────────────────────────────────
-- Adds: source, patient_dob, result_alert_email, result_alert_pending,
--       result_alert_sent_at to appointment_requests.
-- Run once against the production Supabase project.

ALTER TABLE appointment_requests
  ADD COLUMN IF NOT EXISTS source               VARCHAR(20)   DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS patient_dob          DATE,
  ADD COLUMN IF NOT EXISTS result_alert_email   TEXT,
  ADD COLUMN IF NOT EXISTS result_alert_pending BOOLEAN       DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS result_alert_sent_at TIMESTAMPTZ;

-- Backfill existing rows that came from the web intake flow
UPDATE appointment_requests
   SET source = 'web'
 WHERE source IS NULL;

-- Constraint (optional — add after backfill)
ALTER TABLE appointment_requests
  ADD CONSTRAINT chk_appt_source
  CHECK (source IN ('web', 'staff', 'whatsapp', 'phone', 'kiosk', 'referral'));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appt_source
  ON appointment_requests(source);

CREATE INDEX IF NOT EXISTS idx_appt_lab_alert
  ON appointment_requests(result_alert_pending, result_alert_sent_at)
  WHERE result_alert_pending = TRUE;

-- Ensure service_role can read/write (API server connects as service_role)
GRANT ALL ON appointment_requests TO service_role;
GRANT ALL ON appointment_requests TO authenticated;
