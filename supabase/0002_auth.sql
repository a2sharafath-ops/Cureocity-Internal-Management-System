-- ============================================================================
-- Cureocity — auth + roles.
-- Adds a profiles table linked to Supabase Auth users, a signup trigger that
-- assigns a role, and replaces the temporary open RLS with authenticated-only
-- rules.  Run AFTER 0001_init.sql (SQL Editor -> New query -> paste -> Run).
--
-- After running this, create your login user:
--   Supabase -> Authentication -> Users -> Add user
--   email: admin@cureo.city   password: (your choice)   [x] Auto Confirm User
-- The trigger will give that email the Administrator role automatically.
-- ============================================================================

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'Front Desk',
  staff_id   text references staff(id),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists own_profile      on profiles;
drop policy if exists own_profile_write on profiles;
-- a signed-in user can read every profile (needed to show staff), but only edit their own
create policy own_profile       on profiles for select using (auth.uid() is not null);
create policy own_profile_write on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- create a profile automatically whenever a new auth user signs up / is added
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'admin@cureo.city' then 'Administrator' else 'Front Desk' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---- tighten app tables: authenticated-only (replace the dev open policies) --
do $$
declare t text;
begin
  foreach t in array array['staff','packages','leads','clients','enrollments','sessions'] loop
    execute format('drop policy if exists dev_read on %I;', t);
    execute format('drop policy if exists dev_write on %I;', t);
    execute format('drop policy if exists auth_read on %I;', t);
    execute format('drop policy if exists auth_write on %I;', t);
    execute format('create policy auth_read  on %I for select using (auth.uid() is not null);', t);
    execute format('create policy auth_write on %I for all    using (auth.uid() is not null) with check (auth.uid() is not null);', t);
  end loop;
end $$;
