-- ============================================================
-- Migration: Add photo_url column to patients table
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Stores the patient's self-uploaded profile photo as a base64
-- data URL (e.g. "data:image/jpeg;base64,..."). Nullable —
-- uploading a photo is optional, per patient's choice.
alter table patients add column if not exists photo_url text;
