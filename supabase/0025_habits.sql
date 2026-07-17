-- ============================================================================
-- Cureocity — habits & streaks. Run after 0024 (SQL Editor).
-- Coaches assign habits; clients check them off from their portal.
-- ============================================================================

create table if not exists habits (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  name       text not null,
  cadence    text not null default 'daily',   -- daily | weekly
  target_per_week int not null default 7,
  icon       text default '✅',
  active     boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists habits_client_idx on habits (client_id);

create table if not exists habit_logs (
  id         uuid primary key default gen_random_uuid(),
  habit_id   uuid references habits(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  date       date not null default current_date,
  done       boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);
create index if not exists habit_logs_habit_idx on habit_logs (habit_id);
create index if not exists habit_logs_client_idx on habit_logs (client_id);

-- ---- RLS: staff manage; client reads own habits + logs their own -----------
alter table habits     enable row level security;
alter table habit_logs enable row level security;

drop policy if exists habits_staff       on habits;
drop policy if exists habits_client_read on habits;
create policy habits_staff       on habits for all    using (is_staff()) with check (is_staff());
create policy habits_client_read on habits for select using (client_id = my_client_id());

drop policy if exists hl_staff        on habit_logs;
drop policy if exists hl_client_read  on habit_logs;
drop policy if exists hl_client_write on habit_logs;
drop policy if exists hl_client_upd   on habit_logs;
create policy hl_staff        on habit_logs for all    using (is_staff()) with check (is_staff());
create policy hl_client_read  on habit_logs for select using (client_id = my_client_id());
create policy hl_client_write on habit_logs for insert with check (client_id = my_client_id());
create policy hl_client_upd   on habit_logs for update using (client_id = my_client_id()) with check (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table habits';     exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table habit_logs';  exception when others then null; end;
end $$;
