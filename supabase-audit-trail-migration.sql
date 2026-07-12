CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id),
  user_email text,
  action text NOT NULL,         -- 'view', 'create', 'update', 'delete', 'approve', 'export'
  resource_type text NOT NULL,  -- 'patient', 'prescription', 'document', 'note', 'appointment'
  resource_id text,
  patient_id uuid REFERENCES patients(id),
  details jsonb,
  ip_address text
);
CREATE INDEX IF NOT EXISTS audit_log_patient_id_idx ON audit_log(patient_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
GRANT INSERT, SELECT ON audit_log TO authenticated;
GRANT ALL ON audit_log TO service_role;
