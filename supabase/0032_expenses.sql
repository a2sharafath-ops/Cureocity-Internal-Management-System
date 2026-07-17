-- ============================================================================
-- Cureocity — operating expenses. Run after 0031 (SQL Editor).
-- ============================================================================

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  category    text default 'General',   -- Rent | Equipment | Software | Marketing | Utilities | Salaries | Other
  amount      numeric not null default 0,
  date        date not null default current_date,
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses (date desc);

alter table expenses enable row level security;
drop policy if exists expenses_staff on expenses;
create policy expenses_staff on expenses for all using (is_staff()) with check (is_staff());

insert into expenses (description, category, amount, date) values
  ('Studio rent — this month',      'Rent',      12000, current_date),
  ('Training equipment restock',    'Equipment',  4500, current_date - 6),
  ('Practice management software',  'Software',   1100, current_date),
  ('Instagram ad campaign',         'Marketing',  3000, current_date - 10),
  ('Electricity & water',           'Utilities',  1900, current_date - 2)
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table expenses'; exception when others then null; end;
end $$;
