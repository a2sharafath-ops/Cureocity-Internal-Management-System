-- ============================================================================
-- Cureocity — Phase 1 hard enforcement: discipline-aware WRITE policies.
-- Run after 0066.
--
-- Until now every clinical role passed the same `is_staff()` gate, so a Trainer
-- could write to a Doctor's records via the API. This makes WRITES owned by the
-- responsible discipline, enforced in the database (not just the UI).
--
-- READS are deliberately left open to staff in this phase — tightening reads
-- breaks cross-discipline counts and the 3-discipline BluePrint sign-off, which
-- need security-definer aggregates first (Phase 2/3).
--
-- Pattern per table:
--   <t>_read   for select  using (is_staff())          -- unchanged access
--   <t>_write  for all     using (owner) with check (owner)
-- Policies are permissive (OR'd), so SELECT = is_staff OR owner = open,
-- while INSERT/UPDATE/DELETE only match <t>_write = owner only.
-- Existing <t>_client_read (portal) policies are left untouched.
-- ============================================================================

-- ---- primitives ------------------------------------------------------------
create or replace function my_role()
returns text language sql security definer stable set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(my_role() in ('Administrator', 'Super Admin', 'Manager'), false)
$$;

-- caller's discipline as a workspace key (doctor|diet|trainer|coach|psych)
create or replace function my_ws_key()
returns text language sql security definer stable set search_path = public as $$
  select case my_role()
    when 'Doctor'          then 'doctor'
    when 'Dietitian'       then 'diet'
    when 'Fitness Trainer' then 'trainer'
    when 'Health Coach'    then 'coach'
    when 'Psychologist'    then 'psych'
    else null end
$$;

-- does the caller own this consultation kind?
create or replace function owns_consult_kind(k text)
returns boolean language sql security definer stable set search_path = public as $$
  select is_admin() or case my_role()
    when 'Doctor'          then k = 'Doctor'
    when 'Dietitian'       then k = 'Diet'
    when 'Fitness Trainer' then k = 'Trainer'
    when 'Health Coach'    then k = 'Coach'
    when 'Psychologist'    then k = 'Psychologist'
    else false end
$$;

-- ---- medical records → Doctor only ----------------------------------------
do $$
declare t text;
begin
  foreach t in array array['problems','allergies','medications','vitals','encounters'] loop
    execute format('drop policy if exists %I on %I', t||'_staff', t);
    execute format('drop policy if exists %I on %I', t||'_read',  t);
    execute format('drop policy if exists %I on %I', t||'_write', t);
    execute format('create policy %I on %I for select using (is_staff())', t||'_read', t);
    execute format(
      'create policy %I on %I for all using (is_admin() or my_role() = ''Doctor'') with check (is_admin() or my_role() = ''Doctor'')',
      t||'_write', t);
  end loop;
end $$;

-- ---- prescriptions / orders → Doctor only ----------------------------------
drop policy if exists rx_staff on prescriptions;
drop policy if exists rx_read  on prescriptions;
drop policy if exists rx_write on prescriptions;
create policy rx_read  on prescriptions for select using (is_staff());
create policy rx_write on prescriptions for all
  using (is_admin() or my_role() = 'Doctor') with check (is_admin() or my_role() = 'Doctor');

drop policy if exists rxi_staff on prescription_items;
drop policy if exists rxi_read  on prescription_items;
drop policy if exists rxi_write on prescription_items;
create policy rxi_read  on prescription_items for select using (is_staff());
create policy rxi_write on prescription_items for all
  using (is_admin() or my_role() = 'Doctor') with check (is_admin() or my_role() = 'Doctor');

drop policy if exists orders_staff on orders;
drop policy if exists orders_read  on orders;
drop policy if exists orders_write on orders;
create policy orders_read  on orders for select using (is_staff());
create policy orders_write on orders for all
  using (is_admin() or my_role() = 'Doctor') with check (is_admin() or my_role() = 'Doctor');

-- ---- nutrition → Dietitian only --------------------------------------------
drop policy if exists diet_charts_staff on diet_charts;
drop policy if exists diet_charts_read  on diet_charts;
drop policy if exists diet_charts_write on diet_charts;
create policy diet_charts_read  on diet_charts for select using (is_staff());
create policy diet_charts_write on diet_charts for all
  using (is_admin() or my_role() = 'Dietitian') with check (is_admin() or my_role() = 'Dietitian');

drop policy if exists recipes_staff on recipes;
drop policy if exists recipes_read  on recipes;
drop policy if exists recipes_write on recipes;
create policy recipes_read  on recipes for select using (is_staff());
create policy recipes_write on recipes for all
  using (is_admin() or my_role() = 'Dietitian') with check (is_admin() or my_role() = 'Dietitian');

-- ---- consultations → owned per `kind` --------------------------------------
-- (staff_read from 0006 stays; drop only the blanket write policy)
drop policy if exists staff_write        on consultations;
drop policy if exists consultations_write on consultations;
create policy consultations_write on consultations for all
  using (owns_consult_kind(kind)) with check (owns_consult_kind(kind));

-- ---- concerns → the discipline it's routed to ------------------------------
drop policy if exists concerns_staff on concerns;
drop policy if exists concerns_read  on concerns;
drop policy if exists concerns_write on concerns;
create policy concerns_read  on concerns for select using (is_staff());
create policy concerns_write on concerns for all
  using (is_admin() or role in (my_ws_key(), 'general'))
  with check (is_admin() or role in (my_ws_key(), 'general'));

-- ---- resource library → own discipline folder (or shared) ------------------
drop policy if exists resource_files_staff on resource_files;
drop policy if exists resource_files_read  on resource_files;
drop policy if exists resource_files_write on resource_files;
create policy resource_files_read  on resource_files for select using (is_staff());
create policy resource_files_write on resource_files for all
  using (is_admin() or role in (my_ws_key(), 'all'))
  with check (is_admin() or role in (my_ws_key(), 'all'));
