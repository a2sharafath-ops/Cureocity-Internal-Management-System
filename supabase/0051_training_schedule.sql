-- ============================================================================
-- Cureocity — Training Schedule: trainer availability grid + assignments,
-- fitness assessments (due tracker), and recovery sessions. Run after 0050.
-- ============================================================================

-- Weekly recurring trainer slots: one row per (trainer, hour) once touched.
-- Absence of a row = unavailable. status 'available' with client_id null = open.
create table if not exists trainer_slots (
  id         uuid primary key default gen_random_uuid(),
  trainer_id text not null references staff(id) on delete cascade,
  hour       int  not null,
  status     text not null default 'available',   -- available | unavailable
  client_id  uuid references clients(id) on delete set null,
  tag        text,                                 -- PT | Initial Assessment | Re-assessment
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (trainer_id, hour)
);
create index if not exists trainer_slots_trainer_idx on trainer_slots (trainer_id);

-- Fitness assessments & re-assessments due per client.
create table if not exists assessments (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  trainer_id     text references staff(id),
  kind           text not null default 'initial',  -- initial | reassessment
  due_date       date not null default current_date,
  scheduled_date date,
  status         text not null default 'due',       -- due | booked | done
  notes          text,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists assessments_due_idx on assessments (status, due_date);

-- Recovery sessions (physio / mobility / recovery-suite bookings).
create table if not exists recovery_sessions (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  kind       text not null default 'Recovery',      -- e.g. Physio, Mobility, Sauna, Ice bath
  staff_id   text references staff(id),
  date       date not null default current_date,
  hour       int,
  status     text not null default 'scheduled',     -- scheduled | completed
  notes      text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists recovery_date_idx on recovery_sessions (date, hour);

alter table trainer_slots     enable row level security;
alter table assessments       enable row level security;
alter table recovery_sessions enable row level security;

drop policy if exists trainer_slots_staff on trainer_slots;
create policy trainer_slots_staff on trainer_slots for all using (is_staff()) with check (is_staff());
drop policy if exists assessments_staff on assessments;
create policy assessments_staff on assessments for all using (is_staff()) with check (is_staff());
drop policy if exists assessments_client_read on assessments;
create policy assessments_client_read on assessments for select using (client_id = my_client_id());
drop policy if exists recovery_staff on recovery_sessions;
create policy recovery_staff on recovery_sessions for all using (is_staff()) with check (is_staff());
drop policy if exists recovery_client_read on recovery_sessions;
create policy recovery_client_read on recovery_sessions for select using (client_id = my_client_id());

alter publication supabase_realtime add table trainer_slots;
alter publication supabase_realtime add table assessments;
alter publication supabase_realtime add table recovery_sessions;

-- Extra trainers so the weekly grid has real columns (matches the prototype).
insert into staff (id, name, designation, department, role, is_trainer, color) values
  ('tr2', 'Annakutty',        'Fitness Trainer', 'Fitness', 'Health Professional', true, '#2563eb'),
  ('tr3', 'Athul AM',         'Fitness Trainer', 'Fitness', 'Health Professional', true, '#d97706'),
  ('tr4', 'Anurudh K Shaiju', 'Fitness Trainer', 'Fitness', 'Health Professional', true, '#7c3aed'),
  ('tr5', 'Sarath Kumar',     'Fitness Trainer', 'Fitness', 'Health Professional', true, '#dc2626')
on conflict (id) do nothing;

-- Branch (from 0050) — only if that column exists; otherwise skip harmlessly.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='staff' and column_name='branch') then
    update staff set branch = 'Calicut' where id in ('tr4','tr5');
  end if;
end $$;
