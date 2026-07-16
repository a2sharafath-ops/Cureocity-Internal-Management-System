-- ============================================================================
-- Cureocity — Client Portal: client logins scoped to their own data.
-- Run after 0002 + 0005 (SQL Editor -> New query -> paste -> Run).
--
-- Adds profiles.client_id + a 'Client' role, and rewrites RLS so STAFF users
-- (role != Client) keep full access, while a CLIENT user can read ONLY their
-- own client row, sessions, shared consultations, generated blueprint, and
-- blood request. Also closes a hole: profiles are no longer self-updatable
-- (role changes go only through the admin service-role path).
-- ============================================================================

alter table profiles add column if not exists client_id uuid references clients(id) on delete set null;

-- ---- helper functions (run as owner -> bypass RLS, no recursion) ------------
create or replace function my_client_id()
returns uuid language sql security definer stable set search_path = public as $$
  select client_id from profiles where id = auth.uid()
$$;

create or replace function is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) <> 'Client', false)
$$;

-- ---- staff tables: restrict to staff (non-client) users ---------------------
do $$
declare t text;
begin
  foreach t in array array['staff','packages','leads','clients','enrollments','sessions','consultations','blood_requests','blueprints'] loop
    execute format('drop policy if exists auth_read  on %I;', t);
    execute format('drop policy if exists auth_write on %I;', t);
    execute format('drop policy if exists staff_read on %I;', t);
    execute format('drop policy if exists staff_write on %I;', t);
    execute format('create policy staff_read  on %I for select using (is_staff());', t);
    execute format('create policy staff_write on %I for all    using (is_staff()) with check (is_staff());', t);
  end loop;
end $$;

-- audit log: staff read only
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select using (is_staff());

-- profiles: staff can read all; anyone can read their own; NO self-update
drop policy if exists own_profile       on profiles;
drop policy if exists own_profile_write on profiles;
drop policy if exists profiles_read     on profiles;
create policy profiles_read on profiles for select using (is_staff() or id = auth.uid());

-- ---- client-scoped read policies (portal) -----------------------------------
drop policy if exists client_self      on clients;
drop policy if exists client_sessions  on sessions;
drop policy if exists client_consults  on consultations;
drop policy if exists client_blueprint on blueprints;
drop policy if exists client_blood     on blood_requests;

create policy client_self      on clients        for select using (id = my_client_id());
create policy client_sessions  on sessions       for select using (client_id = my_client_id());
create policy client_consults  on consultations  for select using (client_id = my_client_id() and shared = true);
create policy client_blueprint on blueprints      for select using (client_id = my_client_id() and generated = true);
create policy client_blood     on blood_requests  for select using (client_id = my_client_id());
