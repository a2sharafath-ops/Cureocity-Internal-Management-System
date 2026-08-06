-- ============================================================================
-- Cureocity — the Dietary Assessment Summary. Run after 0128.
--
-- The companion to the diet plan: what was found, where the plan came from.
--
-- Most of it already exists elsewhere — the client record, the Diet
-- questionnaire, the InBody — so the app drafts it and the dietitian corrects.
-- This table holds the answers, frozen at issue, plus the handful of things
-- nothing was capturing:
--
--   • occupation and activity level (the activity level is not cosmetic — it
--     is the multiplier that turns BMR into the day's calorie target);
--   • the exercise-routine table (type / frequency / duration);
--   • sleep hours and quality;
--   • BMR and TEE;
--   • target weight and timeline;
--   • meal frequency and count;
--   • the medication table.
--
-- Frozen deliberately: a client's weight changes, so an assessment that read
-- live from `measurements` would silently rewrite what was found in July.
-- ============================================================================

-- ---- BMR from the InBody ---------------------------------------------------
-- The machine measures it. Mifflin–St Jeor only estimates: on the sample
-- assessment the InBody said 1500 where the formula gives 1644, and that 10%
-- gap is 150 kcal a day on the client's target. Capture the measured value.
alter table measurements add column if not exists bmr int;
comment on column measurements.bmr is
  'Basal metabolic rate as MEASURED by the InBody, kcal/day. Null falls back to a Mifflin-St Jeor estimate.';

create table if not exists diet_assessments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  consultation_id uuid references consultations(id) on delete set null,
  version         int  not null default 1,
  status          text not null default 'draft'
                  check (status in ('draft', 'in_review', 'published', 'archived')),
  issued_on       date,

  -- ---- initial consultation ----
  consulted_on       date,
  dietitian          text,
  medical_history    text,
  existing_condition text,
  medications        jsonb not null default '[]'::jsonb,   -- [{medication, notes}]
  allergies          text,
  family_history     text,

  -- ---- lifestyle ----
  occupation      text,
  daily_activity  text,                                    -- Sedentary … Extremely active
  exercise        jsonb not null default '[]'::jsonb,      -- [{type, frequency, duration}]
  sleep_hours     text,                                    -- "7-8", a range as written
  sleep_quality   text,
  stress_level    text check (stress_level in ('low', 'medium', 'high') or stress_level is null),
  gut_health      text,
  weight_change   text,

  -- ---- dietary preference ----
  diet_type       text,
  food_allergies  text,
  food_dislikes   text,
  supplements     text,

  -- ---- current health status (frozen at issue) ----
  height       numeric,
  weight       numeric,
  bmi          numeric,
  bmr          int,
  tee          int,
  muscle_mass  numeric,
  fat_mass     numeric,
  body_fat     numeric,
  visceral_fat numeric,
  waist_hip    numeric,

  -- ---- goals ----
  primary_goals  text,
  target_weight  numeric,
  timeline_weeks int,
  objectives     text,

  -- ---- dietary intake ----
  meal_frequency text,
  meals_per_day  text,
  snacking       text,
  hydration      text,

  notes        text,
  created_by   text,
  reviewed_by  text,
  reviewed_at  timestamptz,
  published_at timestamptz,
  shared_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists diet_assessments_client_idx  on diet_assessments (client_id, status);
create index if not exists diet_assessments_consult_idx on diet_assessments (consultation_id);

alter table diet_assessments enable row level security;
drop policy if exists diet_assessments_staff  on diet_assessments;
drop policy if exists diet_assessments_client on diet_assessments;
create policy diet_assessments_staff on diet_assessments for all
  using (is_staff()) with check (is_staff());
-- Same two conditions as the diet plan: publishing is the clinical decision,
-- sharing is the delivery one, and a client sees it only when both have happened.
create policy diet_assessments_client on diet_assessments for select
  using (client_id = my_client_id() and status = 'published' and shared_at is not null);

do $$ begin execute 'alter publication supabase_realtime add table diet_assessments'; exception when others then null; end $$;

-- ---- check afterwards -------------------------------------------------------
--   select id, status, bmr, tee, daily_activity, issued_on
--     from diet_assessments order by created_at desc limit 5;
