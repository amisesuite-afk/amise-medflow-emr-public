-- Migration: add physical examination fields to patients table
-- These fields are written by the iOS app's ConsultationView (exam section)
-- and must be synced to Supabase so they persist across devices and app reinstalls.

ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS exam_general text,
    ADD COLUMN IF NOT EXISTS exam_cvs     text,
    ADD COLUMN IF NOT EXISTS exam_resp    text,
    ADD COLUMN IF NOT EXISTS exam_abdo    text,
    ADD COLUMN IF NOT EXISTS exam_neuro   text,
    ADD COLUMN IF NOT EXISTS exam_msk     text,
    ADD COLUMN IF NOT EXISTS exam_skin    text,
    ADD COLUMN IF NOT EXISTS exam_other   text;
