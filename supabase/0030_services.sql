-- ============================================================================
-- Cureocity — master service list. Run after 0029 (SQL Editor).
-- The catalogue of billable services behind packages (tech-team managed).
-- ============================================================================

create table if not exists services (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text default 'General',
  mode       text default 'Offline',    -- Offline | Online
  slot_based boolean not null default false,
  day_offset int,                        -- protocol day (2 / 10 / 21 / 28) if a follow-up
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table services enable row level security;
drop policy if exists services_staff on services;
create policy services_staff on services for all using (is_staff()) with check (is_staff());

insert into services (name, category, mode, slot_based, day_offset) values
  ('Initial Doctor Consultation',      'Doctor Consultation', 'Offline', false, null),
  ('Doctor Followup (28 days)',        'Doctor Consultation', 'Offline', false, 28),
  ('Initial Fitness Consultation',     'Fitness Services',    'Offline', false, null),
  ('Fitness Reassessment',             'Fitness Services',    'Offline', false, 21),
  ('12 Sessions Strength',             'Fitness Services',    'Offline', true,  null),
  ('Initial Diet Consultation',        'Diet Consultation',   'Offline', false, null),
  ('Diet Chart Explanation',           'Diet Consultation',   'Offline', false, 2),
  ('10th Day Diet Followup',           'Diet Consultation',   'Offline', false, 10),
  ('21st Day Diet Followup',           'Diet Consultation',   'Offline', false, 21)
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table services'; exception when others then null; end;
end $$;
