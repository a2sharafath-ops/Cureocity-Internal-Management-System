-- Cureocity — shared task assignees.  A task can be owned by one or more
-- staff members while retaining tasks.assignee_id as the legacy primary
-- owner for existing task flows and integrations.

begin;

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  staff_id text not null references public.staff(id) on delete cascade,
  assigned_by text,
  assigned_at timestamptz not null default now(),
  primary key (task_id, staff_id)
);

create index if not exists task_assignees_staff_task_idx
  on public.task_assignees (staff_id, task_id);

-- Existing single-owner tasks become one-person shared tasks.  This is
-- additive and idempotent; it neither changes the current primary owner nor
-- creates assignments for previously unassigned work.
insert into public.task_assignees (task_id, staff_id, assigned_by)
select id, assignee_id, created_by
from public.tasks
where assignee_id is not null
on conflict (task_id, staff_id) do nothing;

alter table public.task_assignees enable row level security;

drop policy if exists task_assignees_staff on public.task_assignees;
create policy task_assignees_staff on public.task_assignees
  for all using (is_staff()) with check (is_staff());

-- This is the one write path used by the app. It updates the compatibility
-- primary owner and the shared-owner set as one transaction.
create or replace function public.set_shared_task_assignees(
  p_task_id uuid,
  p_staff_ids text[]
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ids text[] := array(
    select id from (
      select id, min(ord) as first_position
      from unnest(coalesce(p_staff_ids, '{}'::text[])) with ordinality as input(id, ord)
      where id <> ''
      group by id
      order by min(ord)
    ) unique_ids
  );
begin
  if my_role() not in ('Administrator', 'Super Admin', 'Manager') then
    raise exception 'Only task managers can change task assignees';
  end if;
  if not exists (select 1 from tasks where id = p_task_id) then
    raise exception 'Task not found';
  end if;
  if exists (select 1 from unnest(ids) id where not exists (select 1 from staff where staff.id = id)) then
    raise exception 'One or more staff assignees were not found';
  end if;

  update tasks set assignee_id = ids[1] where id = p_task_id;
  delete from task_assignees where task_id = p_task_id;
  insert into task_assignees (task_id, staff_id)
  select p_task_id, id from unnest(ids) id;
end;
$$;

revoke all on function public.set_shared_task_assignees(uuid, text[]) from public;
grant execute on function public.set_shared_task_assignees(uuid, text[]) to authenticated;

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.task_assignees'; exception when duplicate_object then null; when others then null; end;
end $$;

comment on table public.task_assignees is
  'Additional and primary staff owners for a task. A task is unassigned only when it has no rows here.';
comment on column public.tasks.assignee_id is
  'Legacy primary task owner. Shared ownership is stored in task_assignees; retain this for compatibility with existing workflows.';

commit;
