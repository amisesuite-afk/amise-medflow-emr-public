-- Migration: referring_doctors_seed
-- Seeds `referring_providers` with the practice's initial directory of
-- referring doctors (provider_type = 'referring_doctor'), so the "Referred
-- by" field on the front-desk check-in form can offer a typeahead/dropdown
-- of known referrers ("referrals recognition") instead of pure free text.
--
-- referring_providers.email was originally `not null unique` (see
-- supabase-email-document-intake-migration.sql) — fine for labs/imaging
-- senders matched by the email-intake pipeline, but several referring
-- doctors in this list have no known email, and a few share a clinic
-- inbox with another doctor already in the list. Postgres UNIQUE
-- constraints allow multiple NULLs, so dropping NOT NULL lets us record
-- doctors without an email while keeping the email uniqueness guarantee
-- for the entries that do have one (each non-null email below appears at
-- most once; doctors who share a clinic inbox with another listed doctor
-- are seeded with a NULL email and a note pointing at the shared address).
--
-- The user has indicated this list will grow over time — additions go
-- through the existing admin UI (ReferringProvidersTab.tsx ->
-- /api/admin/referring-providers), which already supports a null-ish
-- (now optional) email.
--
-- Run in Supabase SQL Editor against your production project.
-- 2026-06-12

ALTER TABLE referring_providers
  ALTER COLUMN email DROP NOT NULL;

-- ── Seed referring doctors ──────────────────────────────────────────────────
-- Idempotent: only inserts a row if no referring_doctor with the same name
-- already exists, so re-running this migration is safe.

insert into referring_providers (name, email, provider_type, default_document_type, notes, active)
select v.name, v.email, 'referring_doctor', 'referral_letter', v.notes, true
from (values
  ('Dr. Jeffers',                    'jeffersclinic@gmail.com',              null),
  ('Dr. Grandison Didier',           'dr.m.m.didiers@gmail.com',             null),
  ('Dr. Merle Clarke',                'kidneycareslu@gmail.com',              null),
  ('Dr. Brathwaite',                  'davidbrathwaite@doctors.org.uk',       null),
  ('Dr. Samuel',                      'urolgynaedrs@gmail.com',               null),
  ('Dr. J Bird',                      null,                                   null),
  ('Dr. L Surage',                    'l.surage@gmail.com',                   null),
  ('Dr. R Daniel',                    'drjrdaniel.tapioncardiology@gmail.com', null),
  ('Dr. T Remy',                      'remsurg@gmail.com',                    null),
  ('Dr. T Glasgow',                   'tglasgow@doctor.com',                  null),
  ('Dr. Gillard',                     null,                                   null),
  ('Dr. Augustin',                    'dr.aaugustin@outlook.com',             null),
  ('Dr. Benjamin',                    'drbenjymd@outlook.com',                null),
  ('Dr. K Cenac',                     'drkcenac@gmail.com',                   'Alt. email: drkcenacoffice@gmail.com'),
  ('M Care',                          'info@memberclinic.com',                null),
  ('Dr. Mills',                       'alli.mills.73@gmail.com',              null),
  ('Dr. N Charles',                   'laury52@hotmail.com',                  null),
  ('Dr. West Gustave',                'kristinwest1206@gmail.com',            null),
  ('Dr. John Mondesir',               'dr.john.mondesir@gmail.com',           null),
  ('Dr. G Melville',                  'drmelvillepractice@hotmail.com',       'Alt. email: gavindm@hotmail.com'),
  ('Dr. D Louisy',                    'drdlouisy@gmail.com',                  null),
  ('Dr. K Louisy',                    'kemobo.louisy@gmail.com',              null),
  ('Dr. Ndidi Dagbue',                'nadagbue@hotmail.com',                 null),
  ('Dr. Sherwin James',               'sherwinjames@hotmail.com',             'Phone: 285-7766'),
  ('Dr Tanya Beaubrun',                'tanyabeaubrun68@gmail.com',            null),
  ('Dr. A James',                     'drajam009@gmail.com',                  null),
  ('Dr. Garriga',                     'garrigastl2014@gmail.com',             null),
  ('Dr. Nathaniel',                   'christynats04@gmail.com',              null),
  ('Dr. Flemming',                    'flemingsallapudi@gmail.com',           null),
  ('Dr. Nega',                        null,                                   'Shares M Care clinic email: info@memberclinic.com'),
  ('Dr. Naomi Jude',                  null,                                   'Shares M Care clinic email: info@memberclinic.com'),
  ('Dr. Alpha Augustin',              null,                                   'Shares email with Dr. Augustin: dr.aaugustin@outlook.com'),
  ('Dr. PV St Rose',                  'drpeterstroseclinic@gmail.com',        null),
  ('Dr. Asha Martin',                 'ashamartin81@gmail.com',               null),
  ('Dr. Volson',                      'drwoc67@hotmail.com',                  null),
  ('Dr. Altenor',                     'caltenor@gmail.com',                   null),
  ('Dr. Suarez',                      'drlilysuarez61@gmail.com',             null),
  ('Dr. Celia Mc. Connell Downes',    'cggmcconnell@gmail.com',               null),
  ('Dr. Martin Plummer',              'plummerpaediatrics@gmail.com',         null),
  ('Dr. Segun Tobias',                'mcareassociates@gmail.com',            null),
  ('Dr. Burt',                        'richard_burt@hotmail.com',             null),
  ('Dr Seema Gupta',                  'seedrgupta@gmail.com',                 null)
) as v(name, email, notes)
where not exists (
  select 1 from referring_providers rp
  where rp.name = v.name and rp.provider_type = 'referring_doctor'
);

DO $$
BEGIN
  ASSERT (SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'referring_providers'
            AND column_name = 'email') = 'YES',
    'Expected referring_providers.email to be nullable';
  ASSERT (SELECT count(*) FROM referring_providers WHERE provider_type = 'referring_doctor') >= 42,
    'Expected at least 42 referring_doctor rows after seeding';
  RAISE NOTICE 'Migration referring_doctors_seed: OK';
END;
$$;
