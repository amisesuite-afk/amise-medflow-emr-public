-- Add default_site column to user_profiles
-- Allows staff members to persist their preferred clinic site.
-- Referenced by AuthContext (profile fetch) and AppContext (initial site).

alter table user_profiles
  add column if not exists default_site text
    check (default_site in ('rodney_bay', 'tapion', 'castries'));

grant select, update on user_profiles to authenticated;
grant select, update on user_profiles to service_role;
