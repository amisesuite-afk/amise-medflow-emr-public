-- Patient authentication accounts
-- One account per patient email. The account is created the first time a
-- temp password is issued (at booking or when staff clicks "Send Access").
-- Temp passwords expire after 72 hours. Once a patient sets their own
-- password the temp_password_hash is cleared.

CREATE TABLE IF NOT EXISTS patient_accounts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   text UNIQUE NOT NULL,
  patient_id              uuid REFERENCES patients(id) ON DELETE SET NULL,
  password_hash           text,                        -- scrypt hash, set by patient
  temp_password_hash      text,                        -- scrypt hash, cleared after use
  temp_password_expires_at timestamptz,
  last_login_at           timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_accounts_patient_id_idx ON patient_accounts(patient_id);

-- Row-level security: the API server uses service_role so RLS is bypassed,
-- but we still set up policies so anon/authenticated roles can't read hashes.
ALTER TABLE patient_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY patient_accounts_deny_all ON patient_accounts FOR ALL USING (false);

GRANT ALL ON patient_accounts TO service_role;

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_patient_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS patient_accounts_updated_at ON patient_accounts;
CREATE TRIGGER patient_accounts_updated_at
  BEFORE UPDATE ON patient_accounts
  FOR EACH ROW EXECUTE FUNCTION update_patient_accounts_updated_at();
