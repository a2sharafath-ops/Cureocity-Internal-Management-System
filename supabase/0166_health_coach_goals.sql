-- ============================================================================
-- Cureocity — Health Coach 360 phase 2: goals, barriers and adherence events.
-- Run after 0165.
--
-- Existing habits become the single structured behaviour-goal record so portal
-- check-offs and earlier history continue to work. Clinical thresholds are not
-- inferred here: the app reports recorded events and due reviews only.
-- ============================================================================

begin;

alter table habits
  add column if not exists cue text,
  add column if not exists time_place text,
  add column if not exists importance smallint,
  add column if not exists confidence smallint,
  add column if not exists barrier_code text,
  add column if not exists barrier_detail text,
  add column if not exists if_then_plan text,
  add column if not exists owner_staff_id text references staff(id) on delete set null,
  add column if not exists review_date date,
  add column if not exists status text not null default 'Active',
  add column if not exists updated_at timestamptz not null default now();

update habits
set status = 'Stopped'
where active = false and status = 'Active';

alter table habits drop constraint if exists habits_importance_check;
alter table habits add constraint habits_importance_check
  check (importance is null or importance between 0 and 10);
alter table habits drop constraint if exists habits_confidence_check;
alter table habits add constraint habits_confidence_check
  check (confidence is null or confidence between 0 and 10);
alter table habits drop constraint if exists habits_status_check;
alter table habits add constraint habits_status_check
  check (status in ('Active', 'Paused', 'Completed', 'Stopped'));
alter table habits drop constraint if exists habits_target_per_week_check;
alter table habits add constraint habits_target_per_week_check
  check (target_per_week between 1 and 7);

create index if not exists habits_review_idx
  on habits (review_date, client_id) where status = 'Active';

-- Append-only history for goal creation, review and lifecycle changes.
create table if not exists coach_goal_events (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null references habits(id) on delete cascade,
  client_id     uuid not null references clients(id) on delete cascade,
  event_type    text not null check (event_type in (
    'Created', 'Reviewed', 'Paused', 'Reactivated', 'Completed', 'Stopped'
  )),
  note          text,
  snapshot      jsonb,
  actor_id      uuid not null default auth.uid(),
  actor_name    text not null,
  actor_role    text not null,
  created_at    timestamptz not null default now()
);
create index if not exists coach_goal_events_client_idx
  on coach_goal_events (client_id, created_at desc);

-- One row is one expected adherence event. Future due events are not created:
-- the denominator therefore contains only events explicitly reviewed as
-- completed or missed. Excused events remain auditable but do not affect it.
create table if not exists coach_adherence_events (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  goal_id       uuid references habits(id) on delete set null,
  category      text not null check (category in (
    'Coaching goal', 'Coach check-in', 'Exercise plan', 'Food logging',
    'Doctor follow-up', 'Test or investigation'
  )),
  event_date    date not null default current_date,
  outcome       text not null check (outcome in ('Completed', 'Missed', 'Excused')),
  source        text not null default 'Coach' check (source in ('Coach', 'Client', 'System', 'Device')),
  note          text,
  recorded_by   uuid not null default auth.uid(),
  recorder_name text not null,
  created_at    timestamptz not null default now()
);
create index if not exists coach_adherence_events_client_idx
  on coach_adherence_events (client_id, event_date desc, category);
create index if not exists coach_adherence_events_goal_idx
  on coach_adherence_events (goal_id, event_date desc) where goal_id is not null;

create table if not exists coach_barriers (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  goal_id        uuid references habits(id) on delete set null,
  category       text not null check (category in (
    'Knowledge', 'Skill', 'Environment', 'Time or routine', 'Social support',
    'Motivation', 'Confidence', 'Symptoms', 'Cost or access', 'Other'
  )),
  detail         text not null,
  coach_response text,
  status         text not null default 'Open' check (status in ('Open', 'Addressed', 'Resolved')),
  created_by     uuid not null default auth.uid(),
  creator_name   text not null,
  identified_at  timestamptz not null default now(),
  resolved_by    text,
  resolved_at    timestamptz,
  resolution_note text,
  check (status <> 'Resolved' or (resolved_at is not null and nullif(btrim(resolution_note), '') is not null))
);
create index if not exists coach_barriers_client_idx
  on coach_barriers (client_id, status, identified_at desc);

alter table coach_goal_events       enable row level security;
alter table coach_adherence_events  enable row level security;
alter table coach_barriers          enable row level security;

drop policy if exists coach_goal_events_read on coach_goal_events;
drop policy if exists coach_goal_events_insert on coach_goal_events;
create policy coach_goal_events_read on coach_goal_events for select using (is_staff());
create policy coach_goal_events_insert on coach_goal_events for insert
  with check (actor_id = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
-- History is append-only.

drop policy if exists coach_adherence_events_read on coach_adherence_events;
drop policy if exists coach_adherence_events_insert on coach_adherence_events;
create policy coach_adherence_events_read on coach_adherence_events for select using (is_staff());
create policy coach_adherence_events_insert on coach_adherence_events for insert
  with check (recorded_by = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
-- Recorded outcomes are corrected by adding another event, not erasing history.

drop policy if exists coach_barriers_read on coach_barriers;
drop policy if exists coach_barriers_insert on coach_barriers;
drop policy if exists coach_barriers_update on coach_barriers;
create policy coach_barriers_read on coach_barriers for select using (is_staff());
create policy coach_barriers_insert on coach_barriers for insert
  with check (created_by = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
create policy coach_barriers_update on coach_barriers for update
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');
-- No delete policy: resolved barriers remain part of the coaching record.

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_goal_events'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_adherence_events'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_barriers'; exception when others then null; end;
end $$;

commit;
