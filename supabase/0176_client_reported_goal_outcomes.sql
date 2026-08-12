-- ============================================================================
-- Cureocity — client-reported Health Coach goal outcomes. Run after 0175.
--
-- A habit check-off records whether an action happened. This separate,
-- append-only record preserves the client's own view of progress toward the
-- goal. It is informational and never automatically passes, fails, ranks or
-- disciplines a Health Coach.
-- ============================================================================

begin;

create table if not exists client_goal_outcomes (
  id                  uuid primary key default gen_random_uuid(),
  goal_id             uuid not null references habits(id) on delete restrict,
  client_id           uuid not null references clients(id) on delete restrict,
  goal_name           text not null,
  achievement_rating  smallint not null check (achievement_rating between 0 and 10),
  progress_note       text check (progress_note is null or char_length(progress_note) <= 1000),
  support_requested   boolean not null default false,
  reported_by         uuid not null references profiles(id) on delete restrict,
  reporter_name       text not null,
  reported_at         timestamptz not null default now()
);

create index if not exists client_goal_outcomes_client_idx
  on client_goal_outcomes (client_id, reported_at desc);
create index if not exists client_goal_outcomes_goal_idx
  on client_goal_outcomes (goal_id, reported_at desc);
create index if not exists client_goal_outcomes_support_idx
  on client_goal_outcomes (client_id, reported_at desc) where support_requested;

create or replace function prevent_client_goal_outcome_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Client-reported goal outcomes are append-only';
end;
$$;

drop trigger if exists client_goal_outcomes_immutable on client_goal_outcomes;
create trigger client_goal_outcomes_immutable
before update or delete on client_goal_outcomes
for each row execute function prevent_client_goal_outcome_mutation();

create or replace function record_client_goal_outcome(
  target_goal_id uuid,
  target_rating integer,
  target_note text,
  target_support_requested boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_client_id uuid;
  actor_name text;
  actor_role text;
  target_goal habits%rowtype;
  outcome_id uuid;
begin
  select client_id, name, role into actor_client_id, actor_name, actor_role
  from profiles where id = auth.uid();
  if actor_role is distinct from 'Client' or actor_client_id is null then
    raise exception 'Only a linked client portal login can report goal progress';
  end if;
  if target_goal_id is null or target_rating is null or target_rating not between 0 and 10 then
    raise exception 'Choose a progress rating from 0 to 10';
  end if;
  if target_note is not null and char_length(btrim(target_note)) > 1000 then
    raise exception 'Keep the progress note within 1,000 characters';
  end if;

  select * into target_goal from habits
  where id = target_goal_id and client_id = actor_client_id;
  if target_goal.id is null or target_goal.status <> 'Active' or not target_goal.active then
    raise exception 'Choose one of your current coaching goals';
  end if;

  insert into client_goal_outcomes (
    goal_id, client_id, goal_name, achievement_rating, progress_note,
    support_requested, reported_by, reporter_name
  ) values (
    target_goal.id, actor_client_id, target_goal.name, target_rating,
    nullif(btrim(target_note), ''), coalesce(target_support_requested, false),
    auth.uid(), coalesce(nullif(btrim(actor_name), ''), 'Client')
  ) returning id into outcome_id;
  return outcome_id;
end;
$$;

alter table client_goal_outcomes enable row level security;

drop policy if exists client_goal_outcomes_read on client_goal_outcomes;
create policy client_goal_outcomes_read on client_goal_outcomes for select
  using (is_staff() or client_id = my_client_id());
-- No direct INSERT / UPDATE / DELETE policies. The function validates that the
-- authenticated portal login and goal belong to the same client. Corrections
-- are additional reports, never edits to client voice.

revoke all on function record_client_goal_outcome(uuid, integer, text, boolean) from public;
grant execute on function record_client_goal_outcome(uuid, integer, text, boolean) to authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table client_goal_outcomes'; exception when others then null; end;
end $$;

commit;
