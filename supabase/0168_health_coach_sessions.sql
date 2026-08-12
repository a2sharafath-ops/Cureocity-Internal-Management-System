-- ============================================================================
-- Cureocity — Health Coach 360 phase 4: structured coaching sessions.
-- Run after 0167.
--
-- One workflow row belongs to one Coach consultation. Drafts are editable;
-- completion records the agreed plan, safety/referral links and human closeout.
-- The event table is append-only so session state changes remain auditable.
-- ============================================================================

begin;

create table if not exists coach_session_workflows (
  id                    uuid primary key default gen_random_uuid(),
  consultation_id       uuid not null unique references consultations(id) on delete cascade,
  client_id             uuid not null references clients(id) on delete cascade,
  version               text not null default 'Cureocity HC360 session v1.0',
  session_number        integer not null check (session_number > 0),
  status                text not null default 'Draft' check (status in ('Draft', 'Completed', 'Reopened')),
  check_in              jsonb not null default '{}'::jsonb,
  review                jsonb not null default '{}'::jsonb,
  barrier               jsonb not null default '{}'::jsonb,
  action_plan           jsonb not null default '{}'::jsonb,
  closeout              jsonb not null default '{}'::jsonb,
  due_screenings        text[] not null default '{}',
  completion_percent    smallint not null default 0 check (completion_percent between 0 and 100),
  goal_id               uuid references habits(id) on delete set null,
  barrier_id            uuid references coach_barriers(id) on delete set null,
  followup_id           uuid references followups(id) on delete set null,
  safety_event_id       uuid references safety_events(id) on delete set null,
  clinical_referral_id  uuid references clinical_referrals(id) on delete set null,
  created_by            uuid not null default auth.uid(),
  creator_name          text not null,
  completed_by          uuid,
  completed_by_name     text,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (status <> 'Completed' or (completion_percent = 100 and completed_at is not null))
);

create index if not exists coach_session_workflows_client_idx
  on coach_session_workflows (client_id, created_at desc);
create index if not exists coach_session_workflows_status_idx
  on coach_session_workflows (status, updated_at desc);

create or replace function guard_coach_session_subject()
returns trigger language plpgsql set search_path = public as $$
declare linked_client uuid; linked_kind text;
begin
  select client_id, kind into linked_client, linked_kind
  from consultations where id = new.consultation_id;
  if linked_kind is distinct from 'Coach' or linked_client is distinct from new.client_id then
    raise exception 'Health Coach workflow must match its Coach consultation and client';
  end if;
  return new;
end $$;

drop trigger if exists coach_session_subject_guard on coach_session_workflows;
create trigger coach_session_subject_guard
  before insert or update of consultation_id, client_id on coach_session_workflows
  for each row execute function guard_coach_session_subject();

alter table coach_session_workflows drop constraint if exists coach_session_workflows_event_key;
alter table coach_session_workflows add constraint coach_session_workflows_event_key
  unique (id, consultation_id, client_id);

create table if not exists coach_session_events (
  id             uuid primary key default gen_random_uuid(),
  workflow_id    uuid not null references coach_session_workflows(id) on delete cascade,
  consultation_id uuid not null references consultations(id) on delete cascade,
  client_id      uuid not null references clients(id) on delete cascade,
  event_type     text not null check (event_type in ('Started', 'Saved', 'Completed', 'Reopened')),
  percent        smallint not null check (percent between 0 and 100),
  note           text,
  actor_id       uuid not null default auth.uid(),
  actor_name     text not null,
  actor_role     text not null,
  created_at     timestamptz not null default now()
);

alter table coach_session_events drop constraint if exists coach_session_events_workflow_subject_fk;
alter table coach_session_events add constraint coach_session_events_workflow_subject_fk
  foreign key (workflow_id, consultation_id, client_id)
  references coach_session_workflows (id, consultation_id, client_id) on delete cascade;

create index if not exists coach_session_events_client_idx
  on coach_session_events (client_id, created_at desc);

alter table coach_session_workflows enable row level security;
alter table coach_session_events enable row level security;

drop policy if exists coach_session_workflows_read on coach_session_workflows;
drop policy if exists coach_session_workflows_write on coach_session_workflows;
create policy coach_session_workflows_read on coach_session_workflows for select using (is_staff());
create policy coach_session_workflows_write on coach_session_workflows for all
  using (is_admin() or my_role() = 'Health Coach')
  with check (is_admin() or my_role() = 'Health Coach');

drop policy if exists coach_session_events_read on coach_session_events;
drop policy if exists coach_session_events_insert on coach_session_events;
create policy coach_session_events_read on coach_session_events for select using (is_staff());
create policy coach_session_events_insert on coach_session_events for insert
  with check (actor_id = auth.uid() and (is_admin() or my_role() = 'Health Coach'));
-- Session history is append-only.

do $$ begin
  begin execute 'alter publication supabase_realtime add table coach_session_workflows'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table coach_session_events'; exception when others then null; end;
end $$;

commit;
