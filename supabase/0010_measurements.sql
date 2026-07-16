-- ============================================================================
-- Cureocity — client body measurements / InBody records.
-- Run after 0006 (SQL Editor -> New query -> paste -> Run).
-- ============================================================================

create table if not exists measurements (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  date          date not null,
  weight        numeric,   -- kg
  bmi           numeric,
  body_fat      numeric,   -- %
  muscle_mass   numeric,   -- kg (skeletal muscle)
  visceral_fat  numeric,
  waist         numeric,   -- cm
  hip           numeric,   -- cm
  resting_hr    int,       -- bpm
  notes         text,
  recorded_by   text,
  created_at    timestamptz not null default now()
);
create index if not exists measurements_client_idx on measurements (client_id, date desc);

alter table measurements enable row level security;
drop policy if exists measurements_staff       on measurements;
drop policy if exists measurements_client_read on measurements;
create policy measurements_staff       on measurements for all    using (is_staff()) with check (is_staff());
create policy measurements_client_read on measurements for select using (client_id = my_client_id());
