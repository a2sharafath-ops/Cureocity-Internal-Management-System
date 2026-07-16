-- ============================================================================
-- Cureocity — care schema for Professional workspaces + BluePrint.
-- consultations, blood_requests, blueprints. Run after 0002.
-- (SQL Editor -> New query -> paste -> Run.)
-- ============================================================================

-- ---- consultations ---------------------------------------------------------
create table if not exists consultations (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  kind       text not null,                       -- Doctor | Diet | Trainer | Coach
  status     text not null default 'scheduled',   -- scheduled | completed
  notes      text,
  summary    text,
  approved   boolean not null default false,
  shared     boolean not null default false,      -- shared with client
  by_name    text,
  by_role    text,
  created_at timestamptz not null default now()
);
create index if not exists consultations_client_idx on consultations (client_id);

-- ---- blood report requests (one per client) --------------------------------
create table if not exists blood_requests (
  client_id      uuid primary key references clients(id) on delete cascade,
  requested_at   date,
  submitted      boolean not null default false,
  submitted_date date,
  shared_team    boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---- blueprints (one per client) -------------------------------------------
create table if not exists blueprints (
  client_id      uuid primary key references clients(id) on delete cascade,
  status         text not null default 'in_progress',  -- in_progress | consolidated | generated
  consolidated   text,
  scores         jsonb,
  generated      boolean not null default false,
  generated_date date,
  updated_at     timestamptz not null default now()
);

-- ---- RLS: authenticated staff full access (same pattern as other tables) ---
alter table consultations  enable row level security;
alter table blood_requests enable row level security;
alter table blueprints     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['consultations','blood_requests','blueprints'] loop
    execute format('drop policy if exists auth_read  on %I;', t);
    execute format('drop policy if exists auth_write on %I;', t);
    execute format('create policy auth_read  on %I for select using (auth.uid() is not null);', t);
    execute format('create policy auth_write on %I for all    using (auth.uid() is not null) with check (auth.uid() is not null);', t);
  end loop;
end $$;
