-- ============================================================================
-- Cureocity — e-prescriptions + lab/imaging orders. Run after 0018 (SQL Editor).
-- Clinical PHI — staff manage; patients read their own in the portal.
-- ============================================================================

-- ---- prescriptions (header) -----------------------------------------------
create table if not exists prescriptions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  status      text not null default 'signed',   -- draft | signed | dispensed | cancelled
  notes       text,
  flags       text,                              -- screening flags captured at sign time
  provider    text,
  signed_date date,
  created_at  timestamptz not null default now()
);
create index if not exists prescriptions_client_idx on prescriptions (client_id);

create table if not exists prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid references prescriptions(id) on delete cascade,
  drug            text not null,
  dose            text,
  frequency       text,
  route           text default 'oral',
  duration        text,
  quantity        text,
  instructions    text
);
create index if not exists rx_items_rx_idx on prescription_items (prescription_id);

-- ---- lab / imaging orders --------------------------------------------------
create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  category    text not null default 'lab',       -- lab | imaging
  test        text not null,
  priority    text not null default 'routine',   -- routine | urgent | stat
  status      text not null default 'ordered',   -- ordered | collected | resulted | cancelled
  result      text,
  result_date date,
  provider    text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists orders_client_idx on orders (client_id);
create index if not exists orders_status_idx on orders (status);

-- ---- RLS -------------------------------------------------------------------
alter table prescriptions      enable row level security;
alter table prescription_items enable row level security;
alter table orders             enable row level security;

drop policy if exists rx_staff        on prescriptions;
drop policy if exists rx_client_read  on prescriptions;
create policy rx_staff       on prescriptions for all    using (is_staff()) with check (is_staff());
create policy rx_client_read on prescriptions for select using (client_id = my_client_id());

drop policy if exists rxi_staff       on prescription_items;
drop policy if exists rxi_client_read on prescription_items;
create policy rxi_staff       on prescription_items for all    using (is_staff()) with check (is_staff());
create policy rxi_client_read on prescription_items for select using (
  exists (select 1 from prescriptions r where r.id = prescription_id and r.client_id = my_client_id())
);

drop policy if exists orders_staff       on orders;
drop policy if exists orders_client_read on orders;
create policy orders_staff       on orders for all    using (is_staff()) with check (is_staff());
create policy orders_client_read on orders for select using (client_id = my_client_id());

do $$ begin
  begin execute 'alter publication supabase_realtime add table prescriptions';      exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table prescription_items'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table orders';             exception when others then null; end;
end $$;
