-- ============================================================================
-- Cureocity — gym passes + retail POS. Run after 0016 (SQL Editor).
-- ============================================================================

-- ---- pass types (drop-in / punch card / time pass) -------------------------
create table if not exists pass_types (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'day',   -- day | multi | unlimited
  price      numeric not null default 0,
  valid_days int not null default 1,         -- window the pass stays usable
  entries    int not null default 1,         -- punches; unlimited uses a big number
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- issued passes ---------------------------------------------------------
create table if not exists passes (
  id            uuid primary key default gen_random_uuid(),
  pass_type_id  uuid references pass_types(id),
  client_id     uuid references clients(id) on delete set null,
  guest_name    text,
  guest_phone   text,
  name          text,                          -- denormalised pass-type name
  price         numeric not null default 0,
  entries_total int not null default 1,
  entries_used  int not null default 0,
  valid_until   date,
  status        text not null default 'active', -- active | used | expired
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists passes_client_idx on passes (client_id);
create index if not exists passes_status_idx on passes (status);

-- ---- retail products -------------------------------------------------------
create table if not exists products (
  id         uuid primary key default gen_random_uuid(),
  sku        text,
  name       text not null,
  category   text default 'General',
  price      numeric not null default 0,
  stock      int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- sales (POS transactions) ---------------------------------------------
create table if not exists sales (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete set null,
  guest_name text,
  subtotal   numeric not null default 0,
  discount   numeric not null default 0,
  total      numeric not null default 0,
  method     text default 'Cash',              -- Cash | Card | UPI | Bank
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists sales_created_idx on sales (created_at desc);

create table if not exists sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name       text not null,
  qty        int not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0
);
create index if not exists sale_items_sale_idx on sale_items (sale_id);

-- ---- RLS: staff manage all; clients read their own passes/sales -----------
alter table pass_types enable row level security;
alter table passes     enable row level security;
alter table products   enable row level security;
alter table sales      enable row level security;
alter table sale_items enable row level security;

drop policy if exists pt_staff        on pass_types;
drop policy if exists pt_read         on pass_types;
create policy pt_staff on pass_types for all    using (is_staff()) with check (is_staff());
create policy pt_read  on pass_types for select using (true);

drop policy if exists passes_staff       on passes;
drop policy if exists passes_client_read on passes;
create policy passes_staff       on passes for all    using (is_staff()) with check (is_staff());
create policy passes_client_read on passes for select using (client_id = my_client_id());

drop policy if exists products_staff on products;
drop policy if exists products_read  on products;
create policy products_staff on products for all    using (is_staff()) with check (is_staff());
create policy products_read  on products for select using (true);

drop policy if exists sales_staff       on sales;
drop policy if exists sales_client_read on sales;
create policy sales_staff       on sales for all    using (is_staff()) with check (is_staff());
create policy sales_client_read on sales for select using (client_id = my_client_id());

drop policy if exists si_staff       on sale_items;
drop policy if exists si_client_read on sale_items;
create policy si_staff       on sale_items for all    using (is_staff()) with check (is_staff());
create policy si_client_read on sale_items for select using (
  exists (select 1 from sales s where s.id = sale_id and s.client_id = my_client_id())
);

-- ---- seed --------------------------------------------------------------
insert into pass_types (name, kind, price, valid_days, entries) values
  ('Day Pass',            'day',       500,   1,  1),
  ('10-Visit Punch Card', 'multi',    4000,  90, 10),
  ('Weekly Unlimited',    'unlimited', 1500,  7, 999)
on conflict do nothing;

insert into products (sku, name, category, price, stock) values
  ('SUP-WHEY-1K', 'Whey Protein 1kg',     'Supplements', 3200, 24),
  ('SUP-BCAA-30', 'BCAA 30 servings',     'Supplements', 1400, 30),
  ('BEV-WATER-1L','Mineral Water 1L',     'Beverages',     40, 200),
  ('MER-TEE-M',   'Cureocity Tee (M)',    'Merchandise',   700, 40),
  ('ACC-SHAKER',  'Shaker Bottle',        'Accessories',   350, 60),
  ('ACC-GLOVES',  'Training Gloves',      'Accessories',   900, 18)
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table passes';   exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table products'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table sales';    exception when others then null; end;
end $$;
