-- ============================================================================
-- Cureocity — Health Coach 360 phase 6: structured MDT huddles and owned tasks.
-- Run after 0168.
--
-- The original mdt_notes table remains as historical free-text communication.
-- New huddles use the operating manual's fixed fields, while every team action
-- has an owner, due date, status and append-only decision history.
-- ============================================================================

begin;

create table if not exists mdt_huddles (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references clients(id) on delete cascade,
  huddle_date            date not null default current_date,
  current_plan           text not null,
  progress_status        text not null check (progress_status in ('Green', 'Amber', 'Red')),
  progress_reason        text not null,
  issue_category         text not null check (issue_category in (
    'None', 'Medical', 'Nutrition', 'Exercise', 'Behaviour', 'Mental health',
    'Engagement', 'Safety', 'Logistics', 'Other'
  )),
  new_issue              text,
  barrier_category       text not null check (barrier_category in (
    'None', 'Knowledge', 'Skill', 'Environment', 'Time or routine',
    'Social support', 'Motivation', 'Confidence', 'Symptoms',
    'Cost or access', 'Other'
  )),
  barrier_detail         text,
  safety_status          text not null check (safety_status in ('None', 'Concern', 'Escalated')),
  referral_status        text not null check (referral_status in (
    'Not required', 'Required', 'Pending', 'Booked', 'Completed'
  )),
  today_owner_role       text not null check (today_owner_role in (
    'Health Coach', 'Doctor', 'Dietitian', 'Fitness Trainer', 'Psychologist', 'Medical Director'
  )),
  coach_next_move        text not null,
  team_decision_required boolean not null default false,
  team_decision          text,
  author_id              uuid not null default auth.uid(),
  author_name            text not null,
  author_role            text not null,
  created_at             timestamptz not null default now(),
  check (issue_category = 'None' or nullif(btrim(new_issue), '') is not null),
  check (barrier_category = 'None' or nullif(btrim(barrier_detail), '') is not null),
  check (not team_decision_required or nullif(btrim(team_decision), '') is not null)
);

create index if not exists mdt_huddles_client_idx
  on mdt_huddles (client_id, huddle_date desc, created_at desc);

create table if not exists mdt_tasks (
  id                   uuid primary key default gen_random_uuid(),
  huddle_id            uuid not null references mdt_huddles(id) on delete restrict,
  client_id            uuid not null references clients(id) on delete cascade,
  owner_role           text not null check (owner_role in (
    'Health Coach', 'Doctor', 'Dietitian', 'Fitness Trainer', 'Psychologist', 'Medical Director'
  )),
  assigned_to_staff_id text references staff(id) on delete set null,
  task                 text not null,
  due_date             date not null,
  priority             text not null default 'Routine' check (priority in ('Routine', 'Priority', 'Urgent')),
  status               text not null default 'Open' check (status in ('Open', 'In progress', 'Completed', 'Cancelled')),
  decision             text,
  created_by           uuid not null default auth.uid(),
  creator_name         text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_by         text,
  completed_at         timestamptz,
  unique (id, client_id),
  check (status not in ('Completed', 'Cancelled') or nullif(btrim(decision), '') is not null),
  check (status <> 'Completed' or (completed_by is not null and completed_at is not null))
);

create index if not exists mdt_tasks_open_idx
  on mdt_tasks (owner_role, assigned_to_staff_id, due_date)
  where status in ('Open', 'In progress');
create index if not exists mdt_tasks_client_idx
  on mdt_tasks (client_id, created_at desc);

create table if not exists mdt_task_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null,
  client_id   uuid not null,
  from_status text,
  to_status   text not null,
  decision    text,
  actor_id    uuid not null default auth.uid(),
  actor_name  text not null,
  actor_role  text not null,
  created_at  timestamptz not null default now(),
  foreign key (task_id, client_id) references mdt_tasks(id, client_id) on delete restrict
);

create index if not exists mdt_task_events_task_idx
  on mdt_task_events (task_id, created_at);
create index if not exists mdt_task_events_client_idx
  on mdt_task_events (client_id, created_at desc);

-- A task cannot accidentally be attached to a different client than its huddle.
create or replace function guard_mdt_task_subject()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from mdt_huddles h
    where h.id = new.huddle_id and h.client_id = new.client_id
  ) then
    raise exception 'MDT task must match its huddle client';
  end if;
  return new;
end;
$$;

drop trigger if exists mdt_task_subject_guard on mdt_tasks;
create trigger mdt_task_subject_guard
before insert or update of huddle_id, client_id on mdt_tasks
for each row execute function guard_mdt_task_subject();

alter table mdt_huddles     enable row level security;
alter table mdt_tasks       enable row level security;
alter table mdt_task_events enable row level security;

drop policy if exists mdt_huddles_read on mdt_huddles;
drop policy if exists mdt_huddles_insert on mdt_huddles;
create policy mdt_huddles_read on mdt_huddles for select using (is_staff());
create policy mdt_huddles_insert on mdt_huddles for insert
  with check (
    author_id = auth.uid()
    and (is_admin() or my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist', 'Medical Director'
    ))
  );
-- Huddle records are immutable; corrections are entered as a new huddle.

drop policy if exists mdt_tasks_read on mdt_tasks;
drop policy if exists mdt_tasks_insert on mdt_tasks;
drop policy if exists mdt_tasks_update on mdt_tasks;
create policy mdt_tasks_read on mdt_tasks for select using (is_staff());
create policy mdt_tasks_insert on mdt_tasks for insert
  with check (
    created_by = auth.uid()
    and (is_admin() or my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist', 'Medical Director'
    ))
  );
create policy mdt_tasks_update on mdt_tasks for update
  using (
    is_admin() or created_by = auth.uid() or owner_role = my_role()
    or assigned_to_staff_id = my_staff_id()
  )
  with check (
    is_admin() or created_by = auth.uid() or owner_role = my_role()
    or assigned_to_staff_id = my_staff_id()
  );
-- No delete policy: cancelled tasks remain visible in the care record.

drop policy if exists mdt_task_events_read on mdt_task_events;
drop policy if exists mdt_task_events_insert on mdt_task_events;
create policy mdt_task_events_read on mdt_task_events for select using (is_staff());
create policy mdt_task_events_insert on mdt_task_events for insert
  with check (
    actor_id = auth.uid()
    and (is_admin() or my_role() in (
      'Doctor', 'Dietitian', 'Fitness Trainer', 'Health Coach', 'Psychologist', 'Medical Director'
    ))
  );
-- Event history is append-only.

do $$ begin
  begin execute 'alter publication supabase_realtime add table mdt_huddles'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table mdt_tasks'; exception when others then null; end;
end $$;

commit;
