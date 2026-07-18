-- ============================================================================
-- Cureocity — Phase 2 + 3: cross-discipline aggregates, then READ restrictions.
-- Run after 0067.
--
-- Phase 2 (first): security-definer functions that return ONLY numbers/booleans
-- across all disciplines, so shared surfaces (Care Team counts, the 3-discipline
-- BluePrint sign-off) keep working once reads are locked down. They leak no row
-- content.
--
-- Phase 3 (second): SELECT policies enforcing the visibility hierarchy —
--   Doctor      → everything
--   Dietitian   → diet, trainer
--   Trainer     → trainer, diet
--   Psychologist→ psych, diet, trainer
--   Health Coach→ coach, diet, trainer
-- Admin/Manager/Super Admin → everything.
-- ============================================================================

-- ---- visibility primitives -------------------------------------------------
-- Can the caller READ data belonging to this discipline workspace key?
create or replace function can_read_ws(key text)
returns boolean language sql security definer stable set search_path = public as $$
  select is_admin()                       -- admins/managers see all
      or my_role() = 'Doctor'             -- doctor sits on top
      or key = my_ws_key()                -- your own discipline
      or key in ('diet', 'trainer')       -- nutrition + training are shared/open
$$;

-- consultation kind → workspace key, then the same visibility test
create or replace function can_read_consult_kind(k text)
returns boolean language sql security definer stable set search_path = public as $$
  select can_read_ws(case k
    when 'Doctor'       then 'doctor'
    when 'Diet'         then 'diet'
    when 'Trainer'      then 'trainer'
    when 'Coach'        then 'coach'
    when 'Psychologist' then 'psych'
    else 'general' end)
$$;

-- ============================================================================
-- PHASE 2 — cross-discipline aggregates (numbers / booleans only)
-- ============================================================================

-- Care Team hub counters. Takes the app's "today" so it matches app timezone.
create or replace function care_team_counts(p_today date)
returns table (
  consults_pending int, sessions_today int, orders_open int,
  blood_pending int, appts_today int, meals_today int
) language plpgsql security definer stable set search_path = public as $$
begin
  if not is_staff() then return; end if;
  return query select
    (select count(*) from consultations  where status <> 'completed')::int,
    (select count(*) from sessions       where date = p_today and status = 'scheduled')::int,
    (select count(*) from orders         where status in ('ordered','collected'))::int,
    (select count(*) from blood_requests where submitted = false)::int,
    (select count(*) from appointments   where date = p_today and status = 'scheduled')::int,
    (select count(*) from meal_logs      where date = p_today)::int;
end $$;

-- 3-discipline BluePrint sign-off status. Booleans only — a Trainer can see
-- THAT the doctor approved without reading the doctor's summary.
create or replace function blueprint_signoff()
returns table (client_id uuid, doctor boolean, diet boolean, trainer boolean)
language plpgsql security definer stable set search_path = public as $$
begin
  if not is_staff() then return; end if;
  return query
    select c.id,
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Doctor'  and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Diet'    and x.approved),
      exists (select 1 from consultations x where x.client_id = c.id and x.kind = 'Trainer' and x.approved)
    from clients c
    where c.package_id = 'bp1';
end $$;

-- ============================================================================
-- PHASE 3 — read restrictions
-- ============================================================================

-- ---- medical records / prescriptions / orders → Doctor (+admin) only -------
do $$
declare t text;
begin
  foreach t in array array['problems','allergies','medications','vitals','encounters'] loop
    execute format('drop policy if exists %I on %I', t||'_read', t);
    execute format('create policy %I on %I for select using (is_admin() or my_role() = ''Doctor'')', t||'_read', t);
  end loop;
end $$;

drop policy if exists rx_read on prescriptions;
create policy rx_read on prescriptions for select using (is_admin() or my_role() = 'Doctor');

drop policy if exists rxi_read on prescription_items;
create policy rxi_read on prescription_items for select using (is_admin() or my_role() = 'Doctor');

drop policy if exists orders_read on orders;
create policy orders_read on orders for select using (is_admin() or my_role() = 'Doctor');

-- ---- consultations → visible per discipline hierarchy ----------------------
drop policy if exists staff_read         on consultations;
drop policy if exists consultations_read on consultations;
create policy consultations_read on consultations for select using (can_read_consult_kind(kind));

-- ---- concerns → routed discipline (+ general) ------------------------------
drop policy if exists concerns_read on concerns;
create policy concerns_read on concerns for select using (can_read_ws(role) or role = 'general');

-- ---- resource library → own discipline + shared ----------------------------
drop policy if exists resource_files_read on resource_files;
create policy resource_files_read on resource_files for select using (can_read_ws(role) or role = 'all');

-- diet_charts / recipes / sessions / blueprints / mdt_notes stay staff-readable:
-- nutrition + training are the shared/open disciplines, and the BluePrint and
-- MDT board are deliberately cross-team surfaces.
