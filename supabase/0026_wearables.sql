-- ============================================================================
-- Cureocity — wearables sync. Run after 0025 (SQL Editor).
-- Daily metrics from devices (steps, sleep, HR, activity). Data arrives via
-- the secret-gated ingest endpoint (/api/wearables/ingest) once a device
-- integration is wired, or is entered manually. Connections are a scaffold
-- for the future OAuth link.
-- ============================================================================

create table if not exists wearable_connections (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  provider     text not null,                 -- apple | google | fitbit | garmin
  status       text not null default 'connected', -- connected | disconnected
  connected_at timestamptz not null default now(),
  unique (client_id, provider)
);
create index if not exists wc_client_idx on wearable_connections (client_id);

create table if not exists wearable_readings (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        date not null default current_date,
  steps       int,
  resting_hr  int,
  sleep_min   int,
  active_min  int,
  calories    int,
  source      text not null default 'manual',  -- manual | device
  created_at  timestamptz not null default now(),
  unique (client_id, date, source)
);
create index if not exists wr_client_idx on wearable_readings (client_id);
create index if not exists wr_date_idx   on wearable_readings (date);

-- ---- RLS: staff manage; client reads own + logs own manual readings --------
alter table wearable_connections enable row level security;
alter table wearable_readings    enable row level security;

drop policy if exists wc_staff       on wearable_connections;
drop policy if exists wc_client_read on wearable_connections;
create policy wc_staff       on wearable_connections for all    using (is_staff()) with check (is_staff());
create policy wc_client_read on wearable_connections for select using (client_id = my_client_id());

drop policy if exists wr_staff        on wearable_readings;
drop policy if exists wr_client_read  on wearable_readings;
drop policy if exists wr_client_write on wearable_readings;
drop policy if exists wr_client_upd   on wearable_readings;
create policy wr_staff        on wearable_readings for all    using (is_staff()) with check (is_staff());
create policy wr_client_read  on wearable_readings for select using (client_id = my_client_id());
create policy wr_client_write on wearable_readings for insert with check (client_id = my_client_id());
create policy wr_client_upd   on wearable_readings for update using (client_id = my_client_id()) with check (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table wearable_readings';    exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table wearable_connections'; exception when others then null; end;
end $$;
