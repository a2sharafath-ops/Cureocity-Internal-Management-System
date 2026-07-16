-- ============================================================================
-- Cureocity — initial schema + seed (lean core: staff, packages, leads,
-- clients, enrollments, strength sessions).  Grows as we port more views.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste this ->
-- Run.  Safe to re-run (drops and recreates the demo tables).
--
-- NOTE ON SECURITY: RLS is enabled, but for this first milestone we add a
-- temporary "read for everyone" policy so the app can display data before
-- auth is wired up.  This is DEMO data only (no real patients).  We replace
-- these policies with real role-based rules the moment Supabase Auth is added.
-- ============================================================================

-- ---- clean slate (demo only) ----------------------------------------------
drop table if exists sessions cascade;
drop table if exists enrollments cascade;
drop table if exists clients cascade;
drop table if exists leads cascade;
drop table if exists packages cascade;
drop table if exists staff cascade;

-- ---- staff -----------------------------------------------------------------
create table staff (
  id          text primary key,
  name        text not null,
  designation text,
  department  text,
  role        text not null default 'Staff',   -- Administrator | Manager | Front Desk | Health Professional | Finance | HR | Staff
  is_trainer  boolean not null default false,
  color       text,
  created_at  timestamptz not null default now()
);

-- ---- packages --------------------------------------------------------------
create table packages (
  id         text primary key,
  name       text not null,
  sessions   int  not null default 0,   -- strength-session credits (0 = none)
  validity   int  not null default 0,   -- days
  price      numeric not null default 0,
  is_facility boolean not null default false,
  has_sessions boolean generated always as (sessions > 0 and not is_facility) stored,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- leads -----------------------------------------------------------------
create table leads (
  id         uuid primary key default gen_random_uuid(),
  num        int,
  name       text not null,
  phone      text,
  fde        text,                       -- front-desk executive who handled it
  source     text,
  interest   text,
  urgency    text,
  history    text,
  goals      text,
  location   text,
  budget     text,
  profession text,
  stage      text not null default '1-New Lead',
  objection  text,
  notes      text,
  created_at timestamptz not null default now()
);

-- ---- clients ---------------------------------------------------------------
create table clients (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  name         text not null,
  phone        text,
  email        text,
  package_id   text references packages(id),
  pro_id       text references staff(id),
  used         int  not null default 0,
  joined       date,
  dob          text,
  gender       text,
  occupation   text,
  height       numeric,
  weight       numeric,
  conditions   text,
  goals        text[] default '{}',
  address      text,
  emergency    text,
  branch       text,
  verified     boolean not null default true,
  consent_tnc  boolean not null default false,
  consent_waiver boolean not null default false,
  converted_from text,
  created_at   timestamptz not null default now()
);

-- ---- enrollments (trainer + default slot) ---------------------------------
create table enrollments (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  trainer_id text references staff(id),
  hour       int,
  session    text default 'PT',
  created_at timestamptz not null default now()
);

-- ---- strength sessions (12 / 4 weeks, alternate days, reschedulable) -------
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  trainer_id  text references staff(id),
  seq         int,
  date        date,
  hour        int,
  status      text not null default 'scheduled',  -- scheduled | completed | cancelled
  rescheduled boolean not null default false,
  created_at  timestamptz not null default now()
);

create index on clients (package_id);
create index on enrollments (client_id);
create index on sessions (client_id);
create index on sessions (date);

-- ============================================================================
-- SEED
-- ============================================================================

-- packages: Facility (access only), PT & Comprehensive (session-based), BluePrint
insert into packages (id, name, sessions, validity, price, is_facility) values
  ('fm4',  'Facility Membership — 4 Weeks',   28,  28,  7000,  true),
  ('fm12', 'Facility Membership — 12 Weeks',  84,  84,  15000, true),
  ('fm24', 'Facility Membership — 24 Weeks',  168, 168, 25000, true),
  ('fm48', 'Facility Membership — 48 Weeks',  336, 336, 35000, true),
  ('pt4',  'Personal Training (PT) — 4 Weeks', 12, 28,  10000, false),
  ('pt12', 'Personal Training (PT) — 12 Weeks',36, 84,  30000, false),
  ('comp4','Comprehensive — 4 Weeks',          12, 28,  15000, false),
  ('comp12','Comprehensive — 12 Weeks',        36, 84,  35000, false),
  ('bp1',  'BluePrint',                        1,  30,  2624,  false);

-- staff (subset; role-mapped). t0 = Babith the default trainer.
insert into staff (id, name, designation, department, role, is_trainer, color) values
  ('u1', 'Sharafath',        'Founder',          'Management',         'Administrator',      false, '#0f766e'),
  ('t0', 'Babith T',         'Fitness Manager',  'Health Professional','Health Professional', true, '#0891b2'),
  ('d1', 'Mohammed Suroor',  'Fitness Trainer',  'Fitness',            'Health Professional', true, '#0d9488'),
  ('d2', 'Afya Sudharshan',  'Dietitian',        'Health Professional','Health Professional', false,'#2563eb'),
  ('d5', 'Inshad Kalaparambil','Doctor',         'Health Professional','Health Professional', false,'#dc2626'),
  ('s1', 'Sini',             'Front Desk',       'Front Desk',         'Front Desk',         false, '#7c3aed');

-- lead: Anjoom (HOT)
insert into leads (num, name, phone, fde, source, interest, urgency, history, goals, location, budget, profession, stage, notes)
values (1, 'Anjoom Korambayil', '9846 072318', 'Sini', 'Instagram', 'Personal Training',
        'Strong - wants to start now', 'Complete beginner', 'Specific weight loss target',
        '3-5 km (Vytilla/Elamkulam/Palarivattom)', 'Doesnt ask price first - quality focused',
        'Business Owner/Entrepreneur', '2-Discovery',
        'Enquired via Instagram DM — wants condition-free strength training; asked about morning slots.');

-- client: Aquib (Facility, ~3 weeks, regular) — no sessions
insert into clients (id, code, name, phone, email, package_id, pro_id, used, joined, dob, gender,
                     occupation, height, weight, conditions, goals, address, emergency, branch,
                     verified, consent_tnc, consent_waiver, converted_from)
values ('11111111-1111-1111-1111-111111111111', 'CUR-001', 'Aquib Ali Farzeen', '9895 663214',
        'aquib.farzeen@gmail.com', 'fm12', 'd1', 9, '2026-06-11', '08/03/1993', 'Male',
        'Software Engineer', 174, 82, 'None', array['Fat loss','Strength & flexibility'],
        'Skyline Apartments, Kadavanthra, Kochi 682020', '9895 663200', 'Kochi',
        true, true, true, 'Instagram lead · May 2026');
insert into enrollments (client_id, trainer_id, hour) values
  ('11111111-1111-1111-1111-111111111111', 't0', 9);

-- client: Minhas (Comprehensive 12wk, ~3 weeks, ~10 sessions done)
insert into clients (id, code, name, phone, email, package_id, pro_id, used, joined, dob, gender,
                     occupation, height, weight, conditions, goals, address, emergency, branch,
                     verified, consent_tnc, consent_waiver, converted_from)
values ('22222222-2222-2222-2222-222222222222', 'CUR-002', 'Minhas V.P.', '9847 553120',
        'minhas.vp@gmail.com', 'comp12', 'd1', 10, '2026-06-11', '22/07/1988', 'Male',
        'Business Owner', 172, 88, 'Prediabetes, High cholesterol',
        array['Fat loss','Manage health condition','Strength & flexibility'],
        'Marine Drive, Ernakulam, Kochi 682031', '9847 553100', 'Kochi',
        true, true, true, 'Walk-in · May 2026');
insert into enrollments (client_id, trainer_id, hour) values
  ('22222222-2222-2222-2222-222222222222', 't0', 10);

-- Minhas' 36 strength sessions on alternate days from Jun 11; those on/before
-- Jul 2 are marked completed (~10).
insert into sessions (client_id, trainer_id, seq, date, hour, status)
select '22222222-2222-2222-2222-222222222222', 't0', g,
       (date '2026-06-11' + (g * 2))::date, 10,
       case when (date '2026-06-11' + (g * 2)) <= date '2026-07-02' then 'completed' else 'scheduled' end
from generate_series(1, 36) as g;

-- ============================================================================
-- RLS — temporary permissive read (DEMO ONLY; replace when auth lands)
-- ============================================================================
alter table staff       enable row level security;
alter table packages    enable row level security;
alter table leads       enable row level security;
alter table clients     enable row level security;
alter table enrollments enable row level security;
alter table sessions    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['staff','packages','leads','clients','enrollments','sessions'] loop
    execute format('drop policy if exists dev_read on %I;', t);
    execute format('create policy dev_read on %I for select using (true);', t);
    -- allow writes too during early dev; tighten with auth later
    execute format('drop policy if exists dev_write on %I;', t);
    execute format('create policy dev_write on %I for all using (true) with check (true);', t);
  end loop;
end $$;
