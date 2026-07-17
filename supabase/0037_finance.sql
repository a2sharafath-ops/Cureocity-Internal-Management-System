-- ============================================================================
-- Cureocity — finance sheets: payables, estimates, cash/bank ledger.
-- Run after 0036 (SQL Editor). Sales sheet is derived from paid invoices.
-- ============================================================================

create table if not exists payables (
  id         uuid primary key default gen_random_uuid(),
  vendor     text not null,
  item       text,
  amount     numeric not null default 0,
  due_date   date,
  status     text not null default 'Unpaid',   -- Unpaid | Paid
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists estimates (
  id         uuid primary key default gen_random_uuid(),
  lead_name  text not null,
  item       text,
  amount     numeric not null default 0,
  date       date not null default current_date,
  status     text not null default 'Draft',    -- Draft | Sent | Accepted | Expired
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists ledger (
  id         uuid primary key default gen_random_uuid(),
  account    text not null default 'bank',      -- bank | cash
  date       date not null default current_date,
  ref        text,
  party      text,
  kind       text,                              -- NEFT | UPI | Cash | Card ...
  direction  text not null default 'in',        -- in | out
  amount     numeric not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_account_idx on ledger (account, date desc);

alter table payables  enable row level security;
alter table estimates enable row level security;
alter table ledger    enable row level security;
drop policy if exists payables_staff on payables;
drop policy if exists estimates_staff on estimates;
drop policy if exists ledger_staff on ledger;
create policy payables_staff  on payables  for all using (is_staff()) with check (is_staff());
create policy estimates_staff on estimates for all using (is_staff()) with check (is_staff());
create policy ledger_staff    on ledger    for all using (is_staff()) with check (is_staff());

-- ---- seed ------------------------------------------------------------------
insert into payables (vendor, item, amount, due_date, status) values
  ('MedEquip Traders',  'Resistance bands restock', 8400,  current_date + 4, 'Unpaid'),
  ('Kochi Property LLP','Studio rent — this month', 85000, current_date + 1, 'Unpaid'),
  ('CleanPro Services', 'Deep cleaning',            6000,  current_date - 2, 'Paid')
on conflict do nothing;

insert into estimates (lead_name, item, amount, status) values
  ('Ramesh Iyer', 'Comprehensive 12 Weeks',       35000, 'Sent'),
  ('Fatima N',    'Personal Training 24 Weeks',    60000, 'Accepted'),
  ('Joseph V',    'Facility Membership 12 Weeks',  15000, 'Expired')
on conflict do nothing;

insert into ledger (account, ref, party, kind, direction, amount) values
  ('bank', 'NEFT-88231', 'Kochi Property LLP',  'NEFT', 'out', 85000),
  ('bank', 'UPI-55710',  'Client payment',      'UPI',  'in',  7500),
  ('bank', 'NEFT-88190', 'Salary batch',        'NEFT', 'out', 390000),
  ('cash', null,          'Supplement counter sales', 'Cash', 'in', 3600),
  ('cash', null,          'Water cans + pantry',      'Cash', 'out', 850),
  ('cash', null,          'Walk-in day pass ×2',      'Cash', 'in', 1200)
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table payables';  exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table estimates'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table ledger';    exception when others then null; end;
end $$;
