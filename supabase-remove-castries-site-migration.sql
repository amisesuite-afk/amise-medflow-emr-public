-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: remove 'castries' as a valid site — the practice has two offices
--
-- The application layer (dashboard, front-desk, API validation) was fixed in
-- PR #157 to only offer/accept 'rodney_bay' and 'tapion' as sites. This
-- migration tightens the corresponding CHECK constraints on
-- encounters.site, procedures.site, appointments.site, and
-- user_profiles.default_site to match — otherwise the database itself would
-- still silently accept a direct write of 'castries' even though no part of
-- the application can produce one anymore. user_profiles.default_site was
-- added by a separate migration (supabase-user-default-site-migration.sql)
-- via ADD COLUMN IF NOT EXISTS, which is a no-op on a database where that
-- column already exists — simply fixing that file's CHECK clause would not
-- retroactively tighten an already-provisioned database, hence handling it
-- here explicitly alongside the other three.
--
-- Uses ADD CONSTRAINT ... NOT VALID rather than a plain re-add: this applies
-- the tightened rule to all *future* writes immediately without scanning or
-- rejecting on any *existing* rows that might already have site='castries'
-- from before the app-layer fix. Existing data isn't touched by this
-- migration either way — if any such rows exist, that's a separate data
-- cleanup decision, not something this migration guesses at.
--
-- To later activate full checking against old data too, first confirm no row
-- has the old value (fix or null out any that do), then run e.g.:
--   ALTER TABLE encounters VALIDATE CONSTRAINT encounters_site_check;
--   (and the same for procedures, appointments, user_profiles)
--
-- Run this once in the Supabase SQL editor (idempotent — safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  con_name text;
  new_con_name text;
  tbl text;
  col text;
  pair text[];
begin
  foreach pair slice 1 in array array[
    ['encounters', 'site'],
    ['procedures', 'site'],
    ['appointments', 'site'],
    ['user_profiles', 'default_site']
  ]
  loop
    tbl := pair[1];
    col := pair[2];
    con_name := null; -- SELECT INTO below leaves con_name unchanged (not null) on zero
                       -- matches, which would wrongly reuse the previous iteration's
                       -- constraint name against this iteration's table without this reset
    new_con_name := tbl || '_' || col || '_check'; -- built as plain text, then quoted as
                                                    -- one whole identifier via a single %I
                                                    -- below -- %I on each of tbl/col
                                                    -- separately would risk embedding
                                                    -- quote characters into one token for
                                                    -- any name that actually needs quoting

    select con.conname into con_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = tbl and con.contype = 'c' and att.attname = col
    limit 1;

    if con_name is not null then
      execute format('alter table %I drop constraint %I', tbl, con_name);
    end if;

    execute format(
      'alter table %I add constraint %I check (%I in (''rodney_bay'', ''tapion'')) not valid',
      tbl, new_con_name, col
    );
  end loop;
end $$;
