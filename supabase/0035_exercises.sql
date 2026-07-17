-- ============================================================================
-- Cureocity — exercise library & workout templates. Run after 0034 (SQL Editor).
-- ============================================================================

create table if not exists exercises (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  mode       text default 'Offline',   -- Offline | Online
  type       text default 'Strength',   -- Strength | Cardio | Mobility
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workout_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  mode       text default 'Offline',
  type       text default 'Strength',
  items      jsonb not null default '[]',   -- [{exercise, sets, reps, rest}]
  created_by text,
  created_at timestamptz not null default now()
);

alter table exercises          enable row level security;
alter table workout_templates  enable row level security;
drop policy if exists exercises_staff on exercises;
drop policy if exists wtemplates_staff on workout_templates;
create policy exercises_staff  on exercises         for all using (is_staff()) with check (is_staff());
create policy wtemplates_staff on workout_templates for all using (is_staff()) with check (is_staff());

insert into exercises (name, mode, type) values
  ('Air Squat', 'Offline', 'Strength'), ('Plank Hold', 'Offline', 'Strength'), ('Walking Lunges', 'Offline', 'Strength'),
  ('Kettlebell Deadlift', 'Offline', 'Strength'), ('Treadmill Intervals', 'Offline', 'Cardio'), ('Rowing Machine', 'Offline', 'Cardio'),
  ('YMCA Step Test', 'Offline', 'Cardio'), ('Standing Bicycle Crunches', 'Online', 'Cardio'), ('Chair Squats (home)', 'Online', 'Strength'),
  ('Resistance Band Rows', 'Online', 'Strength'), ('Jumping Jacks', 'Online', 'Cardio'), ('Plank Shoulder Taps', 'Online', 'Strength')
on conflict do nothing;

insert into workout_templates (name, mode, type, items) values
  ('Beginner Full Body', 'Offline', 'Strength', '[{"exercise":"Air Squat","sets":3,"reps":"12","rest":"60s"},{"exercise":"Plank Hold","sets":3,"reps":"30s","rest":"45s"},{"exercise":"Walking Lunges","sets":3,"reps":"10/leg","rest":"60s"}]'),
  ('Fat Burn Cardio', 'Offline', 'Cardio', '[{"exercise":"Treadmill Intervals","sets":4,"reps":"3 min","rest":"90s"},{"exercise":"Rowing Machine","sets":3,"reps":"500 m","rest":"2 min"}]'),
  ('Home Cardio Blast', 'Online', 'Cardio', '[{"exercise":"Jumping Jacks","sets":3,"reps":"45s","rest":"30s"},{"exercise":"Standing Bicycle Crunches","sets":3,"reps":"20","rest":"45s"}]')
on conflict do nothing;

do $$ begin
  begin execute 'alter publication supabase_realtime add table exercises';         exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table workout_templates'; exception when others then null; end;
end $$;
