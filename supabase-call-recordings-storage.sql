-- Migration: Supabase Storage bucket for call recordings
-- Run in Supabase SQL editor

-- Create the bucket (public = false, so recordings are not world-accessible)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'call-recordings',
  'call-recordings',
  false,
  52428800, -- 50 MB max per file
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/wav',
        'audio/webm', 'audio/amr', 'audio/3gpp', 'audio/aac', 'application/octet-stream']
)
on conflict (id) do nothing;

-- Service role can read/write all recordings
create policy "service_role full access on call-recordings"
  on storage.objects for all
  using (bucket_id = 'call-recordings' and auth.role() = 'service_role')
  with check (bucket_id = 'call-recordings' and auth.role() = 'service_role');

-- Authenticated staff can read recordings (for audio player in dashboard)
create policy "authenticated staff can read call recordings"
  on storage.objects for select
  using (
    bucket_id = 'call-recordings'
    and auth.role() = 'authenticated'
  );
