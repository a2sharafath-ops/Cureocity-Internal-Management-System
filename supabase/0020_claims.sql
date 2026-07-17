-- ============================================================================
-- Cureocity — insurance & claims. Run after 0019 (SQL Editor).
-- ============================================================================

-- ---- insurers / payers -----------------------------------------------------
create table if not exists insurers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'private',  -- private | govt | tpa
  contact    text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- patient insurance policies -------------------------------------------
create table if not exists insurance_policies (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete cascade,
  insurer_id      uuid references insurers(id) on delete set null,
  policy_number   text,
  plan_name       text,
  coverage_amount numeric not null default 0,
  valid_from      date,
  valid_to        date,
  status          text not null default 'active',  -- active | expired | inactive
  created_at      timestamptz not null default now()
);
create index if not exists policies_client_idx on insurance_policies (client_id);

-- ---- claims ----------------------------------------------------------------
create table if not exists claims (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete cascade,
  policy_id       uuid references insurance_policies(id) on delete set null,
  insurer_id      uuid references insurers(id) on delete set null,
  invoice_id      uuid references invoices(id) on delete set null,
  claim_number    text,
  service_desc    text,
  amount_claimed  numeric not null default 0,
  amount_approved numeric,
  status          text not null default 'draft',  -- draft | submitted | in_review | approved | rejected | paid
  submitted_date  date,
  decision_date   date,
  notes           text,
  created_by      text,
  created_at      timestamptz not null default now()
);
create index if not exists claims_client_idx on claims (client_id);
create index if not exists claims_status_idx on claims (status);

-- ---- RLS -------------------------------------------------------------------
alter table insurers          enable row level security;
alter table insurance_policies enable row level security;
alter table claims            enable row level security;

drop policy if exists insurers_staff on insurers;
create policy insurers_staff on insurers for all using (is_staff()) with check (is_staff());

drop policy if exists policies_staff       on insurance_policies;
drop policy if exists policies_client_read on insurance_policies;
create policy policies_staff       on insurance_policies for all    using (is_staff()) with check (is_staff());
create policy policies_client_read on insurance_policies for select using (client_id = my_client_id());

drop policy if exists claims_staff       on claims;
drop policy if exists claims_client_read on claims;
create policy claims_staff       on claims for all    using (is_staff()) with check (is_staff());
create policy claims_client_read on claims for select using (client_id = my_client_id());

-- ---- seed insurers ---------------------------------------------------------
insert into insurers (name, kind, contact) values
  ('Star Health Insurance',      'private', 'claims@starhealth.example'),
  ('HDFC ERGO Health',           'private', 'support@hdfcergo.example'),
  ('Ayushman Bharat (PM-JAY)',   'govt',    'pmjay@nha.example'),
  ('MediAssist TPA',             'tpa',     'ops@mediassist.example')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table claims';             exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table insurance_policies'; exception when others then null; end;
end $$;
