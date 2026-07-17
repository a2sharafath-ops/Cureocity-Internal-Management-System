-- ============================================================================
-- Cureocity — client_packages: every package a client has purchased, with dates.
-- Enables holding a membership + PT/Comprehensive simultaneously and enforcing
-- the "membership required before PT/Comprehensive" rule. Run after 0046.
-- ============================================================================

create table if not exists client_packages (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  package_id  text references packages(id),
  package_name text,
  category    text not null default 'other',   -- membership | training | comprehensive | blueprint | other
  start_date  date not null default current_date,
  end_date    date,                            -- start + package validity
  price       numeric default 0,
  status      text not null default 'active',  -- active | expired | cancelled
  created_by  text,
  created_at  timestamptz default now()
);

create index if not exists client_packages_client_idx on client_packages (client_id);
create index if not exists client_packages_cat_idx on client_packages (category);

alter table client_packages enable row level security;

-- Staff can read/write; clients can read their own.
drop policy if exists client_packages_staff_all on client_packages;
create policy client_packages_staff_all on client_packages
  for all using (is_staff()) with check (is_staff());

drop policy if exists client_packages_client_read on client_packages;
create policy client_packages_client_read on client_packages
  for select using (client_id = my_client_id());

-- realtime
alter publication supabase_realtime add table client_packages;
