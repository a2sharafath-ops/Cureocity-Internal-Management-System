-- ============================================================================
-- Cureocity — Health Coach programme lifecycle. Run after 0176.
--
-- This is a care-engagement record, separate from paid package/subscription
-- status. Assigned Health Coaches own it; supervisors require an override
-- reason. Every transition is append-only and no transition changes billing.
-- ============================================================================

begin;

create table if not exists coach_programme_lifecycles (
  client_id          uuid primary key references clients(id) on delete restrict,
  status             text not null check (status in (
                       'Active', 'Paused', 'Completed', 'Disengaged', 'Clinically Transferred'
                     )),
  status_reason      text,
  effective_date     date,
  next_contact_date  date,
  next_contact_plan  text,
  changed_by         uuid references profiles(id) on delete restrict,
  changed_by_name    text,
  changed_by_role    text,
  updated_at         timestamptz not null default now(),
  check (status_reason is null or char_length(btrim(status_reason)) between 12 and 1000),
  check (next_contact_plan is null or char_length(btrim(next_contact_plan)) between 12 and 1000),
  check (
    status not in ('Active', 'Paused', 'Disengaged')
    or effective_date is null
    or (next_contact_date is not null and next_contact_plan is not null)
  )
);

create index if not exists coach_programme_lifecycles_status_idx
  on coach_programme_lifecycles (status, next_contact_date);

create table if not exists coach_programme_lifecycle_events (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients(id) on delete restrict,
  from_status        text not null check (from_status in (
                       'Active', 'Paused', 'Completed', 'Disengaged', 'Clinically Transferred'
                     )),
  to_status          text not null check (to_status in (
                       'Active', 'Paused', 'Completed', 'Disengaged', 'Clinically Transferred'
                     )),
  reason             text not null check (char_length(btrim(reason)) between 12 and 1000),
  effective_date     date not null,
  next_contact_date  date,
  next_contact_plan  text,
  actor_id           uuid not null references profiles(id) on delete restrict,
  actor_name         text not null,
  actor_role         text not null,
  created_at         timestamptz not null default now(),
  check (from_status <> to_status),
  check (next_contact_plan is null or char_length(btrim(next_contact_plan)) between 12 and 1000)
);

create index if not exists coach_programme_lifecycle_events_client_idx
  on coach_programme_lifecycle_events (client_id, effective_date desc, created_at desc);

create or replace function coach_programme_transition_allowed(from_status text, to_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case from_status
    when 'Active' then to_status in ('Paused', 'Completed', 'Disengaged', 'Clinically Transferred')
    when 'Paused' then to_status in ('Active', 'Completed', 'Disengaged', 'Clinically Transferred')
    when 'Completed' then to_status = 'Active'
    when 'Disengaged' then to_status in ('Active', 'Clinically Transferred')
    when 'Clinically Transferred' then to_status = 'Active'
    else false
  end
$$;

create or replace function prevent_coach_programme_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Programme lifecycle events are append-only';
end;
$$;

drop trigger if exists coach_programme_lifecycle_events_immutable on coach_programme_lifecycle_events;
create trigger coach_programme_lifecycle_events_immutable
before update or delete on coach_programme_lifecycle_events
for each row execute function prevent_coach_programme_event_mutation();

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
begin
  select name, role, staff_id into actor_name, actor_role, actor_staff_id
  from profiles where id = auth.uid();
  if actor_role = 'Health Coach' then
    if actor_staff_id is null or not is_assigned_health_coach(target_client_id) then
      raise exception 'Only the assigned Health Coach can change this programme lifecycle';
    end if;
  elsif actor_role in ('Super Admin', 'Administrator', 'Manager', 'Medical Director') then
    if supervisor_override_reason is null or char_length(btrim(supervisor_override_reason)) < 12 then
      raise exception 'Supervisor override requires a reason of at least 12 characters';
    end if;
  else
    raise exception 'You are not authorized to change this programme lifecycle';
  end if;

  if target_client_id is null or not exists (select 1 from clients where id = target_client_id) then
    raise exception 'Choose a valid client';
  end if;
  if target_status is null or target_status not in (
    'Active', 'Paused', 'Completed', 'Disengaged', 'Clinically Transferred'
  ) then
    raise exception 'Choose a valid programme status';
  end if;
  if target_reason is null or char_length(btrim(target_reason)) not between 12 and 1000 then
    raise exception 'Record a transition reason of 12 to 1,000 characters';
  end if;
  if target_effective_date is null or target_effective_date > current_date then
    raise exception 'The effective date cannot be in the future';
  end if;

  -- Serialize first-ever transitions as well as updates. A row lock cannot lock
  -- a row that does not exist yet, so without this two simultaneous first
  -- transitions could both claim to start from Active.
  lock table coach_programme_lifecycles in share row exclusive mode;
  select * into current_row from coach_programme_lifecycles
  where client_id = target_client_id for update;
  current_status := coalesce(current_row.status, 'Active');
  if current_row.effective_date is not null and target_effective_date < current_row.effective_date then
    raise exception 'The effective date cannot precede the current lifecycle state';
  end if;
  if not coach_programme_transition_allowed(current_status, target_status) then
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
    target_client_id, current_status, target_status, btrim(target_reason),
    target_effective_date, target_next_contact_date,
    nullif(btrim(target_next_contact_plan), ''), auth.uid(),
    coalesce(nullif(btrim(actor_name), ''), actor_role), actor_role
  );
  return target_status;
end;
$$;

alter table coach_programme_lifecycles enable row level security;
alter table coach_programme_lifecycle_events enable row level security;

drop policy if exists coach_programme_lifecycles_read on coach_programme_lifecycles;
create policy coach_programme_lifecycles_read on coach_programme_lifecycles for select
  using (is_staff() or client_id = my_client_id());
drop policy if exists coach_programme_lifecycle_events_read on coach_programme_lifecycle_events;
create policy coach_programme_lifecycle_events_read on coach_programme_lifecycle_events for select
  using (is_staff() or client_id = my_client_id());
-- No direct writes. The RPC above is the only authenticated mutation path.

revoke all on function transition_coach_programme_lifecycle(uuid, text, text, date, date, text, text) from public;
grant execute on function transition_coach_programme_lifecycle(uuid, text, text, date, date, text, text) to authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_programme_lifecycles'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_programme_lifecycle_events'; exception when others then null; end;
end $$;

commit;
