-- Migration: add 'local_folder' (and 'manual_upload') to documents.source CHECK constraint
-- Run this in Supabase SQL editor before deploying folder-watcher.
-- Safe to run multiple times (IF EXISTS guards).

-- Drop the old constraint (name may vary — try both common names)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_source_check;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_source_fkey;

-- Add updated constraint with all known source values
ALTER TABLE public.documents
  ADD CONSTRAINT documents_source_check
  CHECK (source IN (
    'uploaded',
    'generated',
    'received_fax',
    'received_email',
    'scanned',
    'manual_upload',
    'local_folder'
  ));
