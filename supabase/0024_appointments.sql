-- ============================================================================
-- Cureocity — appointments / calendar. Run after 0023 (SQL Editor).
-- General-purpose bookings (consultations, assessments, services) distinct
-- from the 12-session strength plan and group classes.
-- ============================================================================

create table if not exists appointments (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  provider_id  text references staff(id),
  type         text default 'Consultation',
  title        text,
  date         date not null,
  hour         int not null default 9,           -- 0..23 start hour
  duration_min int not null default 30,
  status       text not null default 'scheduled', -- scheduled | completed | cancelled | no_show
  location     text,
  notes        text,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists appointments_date_idx     on appointments (date);
create index if not exists appointments_client_idx   on appointments (client_id);
create index if not exists appointments_provider_idx on appointments (provider_id);

alter table appointments enable row level security;
drop policy if exists appts_staff       on appointments;
drop policy if exists appts_client_read on appointments;
create policy appts_staff       on appointments for all    using (is_staff()) with check (is_staff());
create policy appts_client_read on appointments for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table appointments'; exception when others then null; end;
end $$;
