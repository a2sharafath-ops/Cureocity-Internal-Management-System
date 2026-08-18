-- Cureocity — explicitly start an initial Active Health Coach programme.
--
-- A newly assigned client is operationally Active, but the prior lifecycle
-- flow had no durable way to record the initial rationale and next contact
-- without faking a status transition. This keeps later transitions strict.

begin;

alter table coach_programme_lifecycle_events
  alter column from_status drop not null;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  where con.conrelid = 'public.coach_programme_lifecycle_events'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%from_status <> to_status%';
  if constraint_name is not null then
    execute format('alter table public.coach_programme_lifecycle_events drop constraint %I', constraint_name);
  end if;
end $$;

alter table coach_programme_lifecycle_events
  drop constraint if exists coach_programme_lifecycle_events_transition_check;
alter table coach_programme_lifecycle_events
  add constraint coach_programme_lifecycle_events_transition_check
  check (from_status is null or from_status <> to_status);

create or replace function transition_coach_programme_lifecycle(
  target_client_id uuid,
  target_status text,
  target_reason text,
  target_effective_date date,
  target_next_contact_date date,
  target_next_contact_plan text,
  supervisor_override_reason text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_role text;
  actor_staff_id text;
  current_row coach_programme_lifecycles%rowtype;
  current_status text;
  is_initial boolean := false;
begin
  select name, role, staff_id into actor_name, actor_role, actor_staff_id
  from profiles where id = auth.uid();
  if actor_role = 'Health Coach' then
    if actor_staff_id is null or not is_assigned_health_coach(target_client_id) then
      raise exception 'Only the assigned Health Coach can change this programme lifecycle';
    end if;
  elsif actor_role in ('Super Admin', 'Medical Director') then
    if supervisor_override_reason is null or char_length(btrim(supervisor_override_reason)) < 12 then
      raise exception 'Supervisor override requires a reason of at least 12 characters';
    end if;
  else
    raise exception 'You are not authorized to change this programme lifecycle';
  end if;

  if target_client_id is null or not exists (select 1 from clients where id = target_client_id) then
    raise exception 'Choose a valid client';
  end if;
  if target_status is null or target_status not in ('Active', 'Paused', 'Completed', 'Disengaged', 'Clinically Transferred') then
    raise exception 'Choose a valid programme status';
  end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 12 and 1000 then
    raise exception 'Record a transition reason of 12 to 1,000 characters';
  end if;
  if target_effective_date is null or target_effective_date > current_date then
    raise exception 'The effective date cannot be in the future';
  end if;

  lock table coach_programme_lifecycles in share row exclusive mode;
  select * into current_row from coach_programme_lifecycles
  where client_id = target_client_id for update;
  is_initial := not found;
  current_status := coalesce(current_row.status, 'Active');
  if current_row.effective_date is not null and target_effective_date < current_row.effective_date then
    raise exception 'The effective date cannot precede the current lifecycle state';
  end if;
  if not (is_initial and target_status = 'Active')
     and not coach_programme_transition_allowed(current_status, target_status) then
    raise exception 'Programme cannot move from % to %', current_status, target_status;
  end if;

  if target_status in ('Active', 'Paused', 'Disengaged') then
    if target_next_contact_date is null or target_next_contact_date < current_date
       or target_next_contact_date < target_effective_date
       or target_next_contact_plan is null
       or char_length(btrim(target_next_contact_plan)) not between 12 and 1000 then
      raise exception 'A future next-contact date and plan are required';
    end if;
  else
    target_next_contact_date := null;
    target_next_contact_plan := null;
  end if;

  insert into coach_programme_lifecycles (
    client_id, status, status_reason, effective_date, next_contact_date,
    next_contact_plan, changed_by, changed_by_name, changed_by_role, updated_at
  ) values (
    target_client_id, target_status, btrim(target_reason), target_effective_date,
    target_next_contact_date, nullif(btrim(target_next_contact_plan), ''),
    auth.uid(), coalesce(nullif(btrim(actor_name), ''), actor_role), actor_role, now()
  ) on conflict (client_id) do update set
    status = excluded.status,
    status_reason = excluded.status_reason,
    effective_date = excluded.effective_date,
    next_contact_date = excluded.next_contact_date,
    next_contact_plan = excluded.next_contact_plan,
    changed_by = excluded.changed_by,
    changed_by_name = excluded.changed_by_name,
    changed_by_role = excluded.changed_by_role,
    updated_at = excluded.updated_at;

  insert into coach_programme_lifecycle_events (
    client_id, from_status, to_status, reason, effective_date,
    next_contact_date, next_contact_plan, actor_id, actor_name, actor_role
  ) values (
    target_client_id, case when is_initial then null else current_status end,
    target_status, btrim(target_reason), target_effective_date,
    target_next_contact_date, nullif(btrim(target_next_contact_plan), ''),
    auth.uid(), coalesce(nullif(btrim(actor_name), ''), actor_role), actor_role
  );
  return target_status;
end;
$$;

revoke all on function transition_coach_programme_lifecycle(uuid, text, text, date, date, text, text) from public;
grant execute on function transition_coach_programme_lifecycle(uuid, text, text, date, date, text, text) to authenticated;

commit;
