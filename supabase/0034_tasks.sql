-- ============================================================================
-- Cureocity — team task board. Run after 0033 (SQL Editor).
-- Work items / deliverables with assignee, priority and status.
-- ============================================================================

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  assignee_id text references staff(id),
  client_id  uuid references clients(id) on delete set null,
  type       text default 'Ops',       -- Ops | Diet Chart | PHB Review | Training Plan | Follow-up
  priority   text default 'Medium',     -- High | Medium | Low
  status     text default 'todo',       -- todo | doing | blocked | done
  due_date   date,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists tasks_status_idx   on tasks (status);
create index if not exists tasks_assignee_idx on tasks (assignee_id);

alter table tasks enable row level security;
drop policy if exists tasks_staff on tasks;
create policy tasks_staff on tasks for all using (is_staff()) with check (is_staff());

do $$ begin
  begin execute 'alter publication supabase_realtime add table tasks'; exception when others then null; end;
end $$;
