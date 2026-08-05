-- ============================================================================
-- Cureocity — the customised diet plan, as the clinic actually issues it.
-- Run after 0126.
--
-- The existing `diet_charts` table stores meals as flat [label, detail] pairs.
-- The document the dietitian hands a client is structured quite differently:
--
--   • meal SLOTS carry a time window — "Breakfast (9:30–10:00 am)" — because
--     the timing is part of the prescription, not decoration;
--   • each slot holds numbered OPTIONS, and there are a lot of them: seven for
--     breakfast, eight for lunch. Options are the whole point — the client
--     picks one per meal, which is what makes the plan survivable;
--   • every option carries quantity, calories, protein and micronutrients, so
--     the plan can be checked against the day's targets rather than trusted;
--   • one slot is CONDITIONAL ("Travel-delay backup — use only when lunch or
--     dinner is expected to be delayed by more than 1½–2 hours").
--
-- `diet_charts` is left alone. It holds live data and the day-2 explanation
-- workflow hangs off it; this is a new, richer document beside it.
-- ============================================================================

-- ---- 1. the plan ------------------------------------------------------------
create table if not exists diet_plans (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  -- The consultation it came out of, so the plan and its assessment stay joined.
  consultation_id uuid references consultations(id) on delete set null,
  version         int  not null default 1,
  -- draft → in_review → published. A plan reaches the client only when
  -- published, and only a published plan can be shared to the portal.
  status          text not null default 'draft'
                  check (status in ('draft', 'in_review', 'published', 'archived')),
  issued_on       date,

  -- ---- the day's targets (the table on page 1) ----
  kcal            int,
  protein         text,          -- "90-95 g" — a range, not a number
  carbohydrate    text,
  fats            text,
  fibre           text,
  water           text,          -- "2.5 - 3 ltr/day"

  -- Repeated on the plan itself rather than read from the client record: a
  -- printed plan must stay true to what was known the day it was issued.
  allergies       text,
  -- The long coaching notes at the end (3-part meal rule, hydration, tea).
  notes           text,
  -- The nine "How to use" points. Defaulted, editable per plan, because a
  -- specific client sometimes needs a specific instruction.
  how_to_use      jsonb not null default '[]'::jsonb,

  created_by      text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  published_at    timestamptz,
  -- When the client could first see it in their portal. Null = not shared.
  shared_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists diet_plans_client_idx on diet_plans (client_id, status);
create index if not exists diet_plans_consult_idx on diet_plans (consultation_id);

-- ---- 2. meal slots ----------------------------------------------------------
create table if not exists diet_plan_meals (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references diet_plans(id) on delete cascade,
  seq        int  not null default 0,          -- order down the page
  name       text not null,                    -- "Breakfast"
  time_from  text,                             -- "9:30 am" — text, not `time`:
  time_to    text,                             --   the sheet says "8:00–8:15 am"
  -- Shown under the slot name. Carries the travel-backup instruction.
  note       text,
  -- A conditional slot is printed with its note and is not counted toward the
  -- day's totals — the client eats it INSTEAD of a meal, not as well as.
  conditional boolean not null default false
);
create index if not exists diet_plan_meals_plan_idx on diet_plan_meals (plan_id, seq);

-- ---- 3. the options within a slot -------------------------------------------
create table if not exists diet_plan_options (
  id           uuid primary key default gen_random_uuid(),
  meal_id      uuid not null references diet_plan_meals(id) on delete cascade,
  seq          int  not null default 0,        -- "Option 1", "Option 2", …
  -- The short name: "Puttu, kadala curry, eggs and papaya"
  food_items   text not null,
  -- The measured detail: "Puttu ¾ cup (120 g) + kadala curry ½ cup (100 g) + …"
  qty          text,
  kcal         int,
  protein_g    numeric(5,1),
  -- Free text, comma separated: "Iron, folate, choline, vitamin A, magnesium"
  micronutrients text
);
create index if not exists diet_plan_options_meal_idx on diet_plan_options (meal_id, seq);

-- ---- 4. who can see and touch what -----------------------------------------
alter table diet_plans        enable row level security;
alter table diet_plan_meals   enable row level security;
alter table diet_plan_options enable row level security;

drop policy if exists diet_plans_staff  on diet_plans;
drop policy if exists diet_plans_client on diet_plans;
create policy diet_plans_staff on diet_plans for all
  using (is_staff()) with check (is_staff());
-- A client sees their own plan only once it is BOTH published and shared.
-- Two conditions rather than one: publishing is the clinical decision, sharing
-- is the delivery decision, and a dietitian may want the first without the
-- second while a colleague reviews the wording.
create policy diet_plans_client on diet_plans for select
  using (client_id = my_client_id() and status = 'published' and shared_at is not null);

drop policy if exists diet_plan_meals_staff  on diet_plan_meals;
drop policy if exists diet_plan_meals_client on diet_plan_meals;
create policy diet_plan_meals_staff on diet_plan_meals for all
  using (is_staff()) with check (is_staff());
create policy diet_plan_meals_client on diet_plan_meals for select
  using (exists (
    select 1 from diet_plans p
     where p.id = plan_id and p.client_id = my_client_id()
       and p.status = 'published' and p.shared_at is not null));

drop policy if exists diet_plan_options_staff  on diet_plan_options;
drop policy if exists diet_plan_options_client on diet_plan_options;
create policy diet_plan_options_staff on diet_plan_options for all
  using (is_staff()) with check (is_staff());
create policy diet_plan_options_client on diet_plan_options for select
  using (exists (
    select 1 from diet_plan_meals m
      join diet_plans p on p.id = m.plan_id
     where m.id = meal_id and p.client_id = my_client_id()
       and p.status = 'published' and p.shared_at is not null));

-- ---- 5. live updates for the builder ---------------------------------------
do $$ begin execute 'alter publication supabase_realtime add table diet_plans';        exception when others then null; end $$;
do $$ begin execute 'alter publication supabase_realtime add table diet_plan_meals';   exception when others then null; end $$;
do $$ begin execute 'alter publication supabase_realtime add table diet_plan_options'; exception when others then null; end $$;

-- ---- 6. check afterwards ----------------------------------------------------
--   select id, status, kcal, issued_on from diet_plans order by created_at desc limit 5;
--   select name, time_from, time_to, conditional from diet_plan_meals order by seq;
