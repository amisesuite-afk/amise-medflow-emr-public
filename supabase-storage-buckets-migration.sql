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

-- RLS policies for clinical-attachments and patient-documents (authenticated
-- users only).
--
-- Migration 89 (supabase-staff-only-rls-migration.sql) drops all six and
-- replaces them with staff-only policies. Once 89 has run (its
-- user_profiles_revoked table exists), do not create them again: re-running the
-- runner from the top would otherwise let every signed-in user, portal patients
-- included, read these buckets until step 89 came round again.
do $guard$ begin
  if to_regclass('public.user_profiles_revoked') is not null then
    raise notice 'Migration 89 has run: legacy open storage policies not re-created';
    return;
  end if;

  -- clinical-attachments
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can upload clinical attachments') then
    CREATE POLICY "Authenticated users can upload clinical attachments"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'clinical-attachments');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can read clinical attachments') then
    CREATE POLICY "Authenticated users can read clinical attachments"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'clinical-attachments');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can delete clinical attachments') then
    CREATE POLICY "Authenticated users can delete clinical attachments"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'clinical-attachments');
  end if;

  -- patient-documents
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can upload patient documents') then
    CREATE POLICY "Authenticated users can upload patient documents"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'patient-documents');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can read patient documents') then
    CREATE POLICY "Authenticated users can read patient documents"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'patient-documents');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and policyname = 'Authenticated users can delete patient documents') then
    CREATE POLICY "Authenticated users can delete patient documents"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'patient-documents');
  end if;
end $guard$;
