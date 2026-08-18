-- Cureocity task projects. Projects organise existing work without changing
-- task ownership, deadlines, reminders, or automated client/lead task flows.

begin;

create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  owner_id text references public.staff(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed')),
  start_date date,
  due_date date,
  created_by text,
  created_at timestamptz not null default now(),
  unique (name)
);

create index if not exists task_projects_status_idx on public.task_projects (status, due_date);
create index if not exists task_projects_owner_idx on public.task_projects (owner_id);

alter table public.tasks
  add column if not exists project_id uuid references public.task_projects(id) on delete set null;

create index if not exists tasks_project_status_due_idx on public.tasks (project_id, status, due_date);

alter table public.task_projects enable row level security;
drop policy if exists task_projects_staff on public.task_projects;
create policy task_projects_read on public.task_projects
  for select using (is_staff());
create policy task_projects_manage on public.task_projects
  for all using (my_role() in ('Administrator', 'Super Admin', 'Manager'))
  with check (my_role() in ('Administrator', 'Super Admin', 'Manager'));

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.task_projects'; exception when duplicate_object then null; when others then null; end;
end $$;

comment on table public.task_projects is
  'Operational projects that group tasks. Unlinked automated client/lead work remains in the Operations inbox.';
comment on column public.tasks.project_id is
  'Optional project grouping. Null keeps a task in the Operations inbox.';

commit;
