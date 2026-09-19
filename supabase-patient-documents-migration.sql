-- Migration 79: patient_documents — iOS document metadata table
-- iOS SyncService and DocumentsView pull/push document metadata here.
-- Storage files live in Supabase Storage; this table holds the metadata row.

CREATE TABLE IF NOT EXISTS public.patient_documents (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  file_name      TEXT        NOT NULL,
  mime_type      TEXT        NOT NULL,
  storage_url    TEXT,
  ai_summary     TEXT,
  extracted_text TEXT,
  category       TEXT,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff access" ON public.patient_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.patient_documents TO service_role;
