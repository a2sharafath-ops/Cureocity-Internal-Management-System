-- ============================================================================
-- Cureocity — full EMR: problems, allergies, medications, vitals, SOAP
-- encounters. Run after 0017 (SQL Editor). Clinical PHI — staff manage;
-- clients read their own chart in the portal.
-- ============================================================================

-- ---- problem list ----------------------------------------------------------
create table if not exists problems (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  code        text,                              -- ICD-10 / SNOMED (optional)
  description text not null,
  status      text not null default 'active',    -- active | resolved
  onset_date  date,
  resolved_date date,
  noted_by    text,
  created_at  timestamptz not null default now()
);
create index if not exists problems_client_idx on problems (client_id);

-- ---- allergies -------------------------------------------------------------
create table if not exists allergies (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  substance  text not null,
  reaction   text,
  severity   text default 'moderate',            -- mild | moderate | severe
  noted_by   text,
  created_at timestamptz not null default now()
);
create index if not exists allergies_client_idx on allergies (client_id);

-- ---- medications -----------------------------------------------------------
create table if not exists medications (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  name       text not null,
  dose       text,
  frequency  text,
  route      text default 'oral',
  status     text not null default 'active',      -- active | stopped
  start_date date,
  end_date   date,
  prescriber text,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists medications_client_idx on medications (client_id);

-- ---- clinical vitals -------------------------------------------------------
create table if not exists vitals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        date not null default current_date,
  systolic    int,
  diastolic   int,
  pulse       int,
  temp_c      numeric,
  resp_rate   int,
  spo2        int,
  weight      numeric,
  height      numeric,
  notes       text,
  recorded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists vitals_client_idx on vitals (client_id);

-- ---- SOAP encounters -------------------------------------------------------
create table if not exists encounters (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete cascade,
  date            date not null default current_date,
  type            text default 'Office visit',
  chief_complaint text,
  subjective      text,
  objective       text,
  assessment      text,
  plan            text,
  provider        text,
  created_at      timestamptz not null default now()
);
create index if not exists encounters_client_idx on encounters (client_id);

-- ---- RLS: staff manage, client reads own ----------------------------------
do $$
declare t text;
begin
  foreach t in array array['problems','allergies','medications','vitals','encounters'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_staff', t);
    execute format('drop policy if exists %I on %I', t||'_client_read', t);
    execute format('create policy %I on %I for all using (is_staff()) with check (is_staff())', t||'_staff', t);
    execute format('create policy %I on %I for select using (client_id = my_client_id())', t||'_client_read', t);
    begin execute format('alter publication supabase_realtime add table %I', t); exception when others then null; end;
  end loop;
end $$;
