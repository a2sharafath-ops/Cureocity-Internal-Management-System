-- ============================================================================
-- Cureocity — group classes + room booking. Run after 0006 (SQL Editor -> Run).
-- ============================================================================

create table if not exists rooms (
  id       text primary key,
  name     text not null,
  type     text,
  capacity int not null default 1
);

insert into rooms (id, name, type, capacity) values
  ('r1', 'Group Studio Room', 'Studio',   12),
  ('r2', 'Sauna',             'Recovery', 6),
  ('r3', 'Cold Plunge',       'Recovery', 2)
on conflict (id) do nothing;

create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  room_id    text references rooms(id),
  title      text not null,
  trainer_id text references staff(id),
  date       date not null,
  hour       int  not null,
  capacity   int  not null default 12,
  created_at timestamptz not null default now()
);
create index if not exists classes_date_idx on classes (date, hour);

create table if not exists class_bookings (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid references classes(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, client_id)
);
create index if not exists class_bookings_class_idx on class_bookings (class_id);

alter table rooms          enable row level security;
alter table classes        enable row level security;
alter table class_bookings enable row level security;

-- rooms + classes: readable by any signed-in user (portal shows the schedule); staff write
drop policy if exists rooms_read     on rooms;
drop policy if exists classes_read   on classes;
drop policy if exists classes_write  on classes;
create policy rooms_read    on rooms   for select using (auth.uid() is not null);
create policy classes_read  on classes for select using (auth.uid() is not null);
create policy classes_write on classes for all    using (is_staff()) with check (is_staff());

-- bookings: staff manage all; a client can read / create / cancel their OWN
drop policy if exists cb_staff        on class_bookings;
drop policy if exists cb_client_read  on class_bookings;
drop policy if exists cb_client_write on class_bookings;
drop policy if exists cb_client_del   on class_bookings;
create policy cb_staff        on class_bookings for all    using (is_staff()) with check (is_staff());
create policy cb_client_read  on class_bookings for select using (client_id = my_client_id());
create policy cb_client_write on class_bookings for insert with check (client_id = my_client_id());
create policy cb_client_del   on class_bookings for delete using (client_id = my_client_id());

-- availability counts (a view runs as its owner, so it can total bookings
-- without exposing WHO booked — the portal uses this for the "full" state)
create or replace view class_availability as
  select c.id, c.capacity, count(b.id)::int as booked
  from classes c
  left join class_bookings b on b.class_id = c.id
  group by c.id, c.capacity;
grant select on class_availability to anon, authenticated;

-- realtime
do $$ begin
  begin execute 'alter publication supabase_realtime add table classes';        exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table class_bookings';  exception when others then null; end;
end $$;
