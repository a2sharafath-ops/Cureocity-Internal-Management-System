-- ============================================================================
-- Cureocity — compliance & governance: consent, breach register, data
-- retention. Run after 0020 (SQL Editor).
-- ============================================================================

-- ---- consent records -------------------------------------------------------
create table if not exists consents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  type         text not null,                    -- treatment | data-sharing | marketing | research | telehealth
  granted      boolean not null default true,
  method       text default 'signed',            -- signed | verbal | digital
  granted_date date,
  expires_date date,
  revoked_date date,
  notes        text,
  recorded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists consents_client_idx on consents (client_id);

-- ---- breach / incident register -------------------------------------------
create table if not exists breach_incidents (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  severity       text not null default 'medium', -- low | medium | high | critical
  affected_count int not null default 0,
  discovered_date date,
  status         text not null default 'open',    -- open | investigating | contained | closed
  reported_to_authority boolean not null default false,
  reported_date  date,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists breach_status_idx on breach_incidents (status);

-- ---- data retention policies ----------------------------------------------
create table if not exists retention_policies (
  id          uuid primary key default gen_random_uuid(),
  data_type   text not null,
  retain_years int not null default 7,
  legal_basis text,
  action_after text default 'archive',            -- archive | anonymize | delete
  created_at  timestamptz not null default now()
);

-- ---- RLS: staff-only (governance data is internal) ------------------------
alter table consents          enable row level security;
alter table breach_incidents  enable row level security;
alter table retention_policies enable row level security;

drop policy if exists consents_staff       on consents;
drop policy if exists consents_client_read on consents;
create policy consents_staff       on consents for all    using (is_staff()) with check (is_staff());
create policy consents_client_read on consents for select using (client_id = my_client_id());

drop policy if exists breach_staff on breach_incidents;
create policy breach_staff on breach_incidents for all using (is_staff()) with check (is_staff());

drop policy if exists retention_staff on retention_policies;
create policy retention_staff on retention_policies for all using (is_staff()) with check (is_staff());

-- ---- seed retention policies ----------------------------------------------
insert into retention_policies (data_type, retain_years, legal_basis, action_after) values
  ('Clinical records (EMR)',   10, 'Medical records retention norms', 'archive'),
  ('Financial / invoices',      8, 'Tax & audit requirements',        'archive'),
  ('Consent forms',            10, 'Proof of authorization',          'archive'),
  ('Marketing contacts',        2, 'Consent-based; purge on withdrawal', 'delete'),
  ('Access / audit logs',       6, 'Security investigation window',    'archive')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table consents';         exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table breach_incidents'; exception when others then null; end;
end $$;
