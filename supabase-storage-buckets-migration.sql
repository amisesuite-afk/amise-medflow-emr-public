-- Create storage buckets for clinical attachments and patient documents

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'clinical-attachments',
    'clinical-attachments',
    false,
    10485760, -- 10 MB
    ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
  ),
  (
    'patient-documents',
    'patient-documents',
    false,
    52428800, -- 50 MB
    ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
ON CONFLICT (id) DO NOTHING;

-- RLS policies for clinical-attachments (authenticated users only)
CREATE POLICY "Authenticated users can upload clinical attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'clinical-attachments');

CREATE POLICY "Authenticated users can read clinical attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'clinical-attachments');

CREATE POLICY "Authenticated users can delete clinical attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'clinical-attachments');

-- RLS policies for patient-documents (authenticated users only)
CREATE POLICY "Authenticated users can upload patient documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patient-documents');

CREATE POLICY "Authenticated users can read patient documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient-documents');

CREATE POLICY "Authenticated users can delete patient documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'patient-documents');
