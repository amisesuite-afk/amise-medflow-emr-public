-- User profile role assignments for Amise Medical Services
--
-- amisesuite@gmail.com  → front_desk  (booking inbox, scheduling, check-in)
-- dawitson@yahoo.com    → doctor      (full clinical EMR)
--
-- Run AFTER both users have signed up via Supabase Auth (auth.users rows must exist).
-- The ON CONFLICT clause makes this safe to re-run.

insert into public.user_profiles (id, full_name, role, default_site)
select
  au.id,
  case au.email
    when 'amisesuite@gmail.com' then 'Amise Front Desk'
    when 'dawitson@yahoo.com'   then 'Dr Dawit Daniel Kabiye'
  end,
  case au.email
    when 'amisesuite@gmail.com' then 'front_desk'
    when 'dawitson@yahoo.com'   then 'doctor'
  end,
  'rodney_bay'
from auth.users au
where au.email in ('amisesuite@gmail.com', 'dawitson@yahoo.com')
on conflict (id) do update
  set role         = excluded.role,
      full_name    = excluded.full_name,
      default_site = excluded.default_site;
