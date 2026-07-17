-- ============================================================================
-- Cureocity — per-client assigned workouts. Run after 0038 (SQL Editor).
-- A snapshot of a workout template (or custom plan) assigned to a client.
-- ============================================================================

create table if not exists client_workouts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  name        text not null,
  mode        text default 'Offline',
  type        text default 'Strength',
  items       jsonb not null default '[]',   -- [{exercise, sets, reps, rest}]
  assigned_by text,
  created_at  timestamptz not null default now()
);
create index if not exists client_workouts_client_idx on client_workouts (client_id);

alter table client_workouts enable row level security;
drop policy if exists cw_staff       on client_workouts;
drop policy if exists cw_client_read on client_workouts;
create policy cw_staff       on client_workouts for all    using (is_staff()) with check (is_staff());
create policy cw_client_read on client_workouts for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table client_workouts'; exception when others then null; end;
end $$;
