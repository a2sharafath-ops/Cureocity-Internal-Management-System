-- ============================================================================
-- Backfill profiles for any auth users created BEFORE the signup trigger
-- existed, and grant the admin account the Administrator role.
-- Run in Supabase SQL Editor (New query -> paste -> Run). Safe to re-run.
-- ============================================================================

insert into profiles (id, email, name, role)
select
  u.id,
  u.email,
  split_part(u.email, '@', 1),
  case
    when lower(u.email) in ('admin@cureo.city', 'admin@cure.city') then 'Administrator'
    else 'Front Desk'
  end
from auth.users u
on conflict (id) do update
  set role  = excluded.role,
      email = excluded.email,
      name  = coalesce(profiles.name, excluded.name);
