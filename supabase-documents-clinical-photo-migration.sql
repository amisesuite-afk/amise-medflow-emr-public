-- Migration: documents_clinical_photo
-- Adds a 'clinical_photo' category to documents.document_type so staff can
-- attach clinical photos (wound checks, post-op sites, endoscopy stills,
-- skin lesions, etc.) taken on a phone/tablet during a visit — distinct from
-- scanned referral letters, lab reports, and other paperwork.
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-12

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check,
  ADD CONSTRAINT documents_document_type_check
    CHECK (document_type IN (
      'lab_report', 'imaging_report', 'referral_letter', 'consent_form',
      'surgical_report', 'discharge_summary', 'prescription', 'insurance_form',
      'clinical_photo', 'other'
    ));

COMMENT ON COLUMN documents.document_type IS
  'lab_report | imaging_report | referral_letter | consent_form | surgical_report | discharge_summary | prescription | insurance_form | clinical_photo (wound/procedure/exam photo taken on a device) | other';

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM information_schema.check_constraints
          WHERE constraint_name = 'documents_document_type_check'
            AND check_clause LIKE '%clinical_photo%') = 1,
    'Expected documents_document_type_check to allow ''clinical_photo''';
  RAISE NOTICE 'Migration documents_clinical_photo: OK';
END;
$$;
