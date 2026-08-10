-- Run the whole file in one go. The backfill below moves data that the drop
-- immediately afterwards makes unreachable, so the two belong to the same
-- transaction — which is what the Supabase SQL editor gives you when the file
-- is pasted whole, and what you lose by running it statement by statement.
--
-- A chart option is built from SEVERAL recipes, not one.
--
-- 0139 gave `diet_plan_options` a single `dish_id` and `servings`, which fits
-- an option that is one dish and nothing else. Almost none of the clinic's
-- options are. A breakfast option reads "Puttu ¾ cup + kadala curry ½ cup +
-- 2 eggs + papaya" — four recipes, four portions, one line on the client's
-- chart. Held as one dish, that whole line had to become a single library
-- entry called "Puttu with kadala curry and eggs", and the next option that
-- used kadala curry would need its own copy of the same recipe. Correct one
-- and the others stay wrong.
--
-- So an option now names a LIST of dishes, each with its own portion, and its
-- calories and protein are the sum. The library holds kadala curry once.
--
-- WHAT STAYS THE SAME
--
-- Free text still survives. An option with no components at all is exactly
-- what it was before: text the dietitian wrote and numbers she typed. Linking
-- remains an upgrade, never a requirement.
--
-- `diet_plan_options.food_items` and `qty` are still the words the client
-- reads. The clinic's portions vary per client, so the recipe carries no
-- household portion of its own — "¾ cup" belongs on the chart row, and the
-- multiplier below says how much of a serving that is.

create table if not exists diet_plan_option_dishes (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references diet_plan_options(id) on delete cascade,
  -- Cascade rather than set-null: a component with no dish is not a component.
  -- Deleting a recipe still cannot quietly change an issued chart — the
  -- calories and protein live on the option row itself, and the app clears
  -- them on any chart still open BEFORE it lets the recipe go.
  --
  -- The cost, accepted knowingly: a PUBLISHED chart keeps its printed figures
  -- but loses the record of which recipes produced them. The document a client
  -- holds is unchanged, which is what matters; the provenance behind it is
  -- not. If that trail turns out to be worth keeping, the answer is to refuse
  -- to delete a recipe any issued chart still names, not to leave components
  -- pointing at a row that no longer exists.
  dish_id    uuid not null references dishes(id) on delete cascade,
  -- How much of one serving of that dish. 1 = a serving, 0.5 = half.
  servings   numeric not null default 1,
  seq        int not null default 0        -- order within the option
);

create index if not exists option_dishes_option_idx on diet_plan_option_dishes (option_id, seq);
-- Re-pricing starts from "which options use this dish", so that lookup is
-- the one that has to be quick.
create index if not exists option_dishes_dish_idx on diet_plan_option_dishes (dish_id);

-- ---- who can see and touch what --------------------------------------------
-- Exactly the rules on `diet_plan_options`, one level further down: staff may
-- do anything, a client may read their own only once the plan is both
-- published and shared.
alter table diet_plan_option_dishes enable row level security;

drop policy if exists option_dishes_staff  on diet_plan_option_dishes;
drop policy if exists option_dishes_client on diet_plan_option_dishes;

create policy option_dishes_staff on diet_plan_option_dishes for all
  using (is_staff()) with check (is_staff());

create policy option_dishes_client on diet_plan_option_dishes for select
  using (exists (
    select 1 from diet_plan_options o
      join diet_plan_meals m on m.id = o.meal_id
      join diet_plans p      on p.id = m.plan_id
     where o.id = option_id and p.client_id = my_client_id()
       and p.status = 'published' and p.shared_at is not null));

-- ---- carry over anything already linked ------------------------------------
-- 0139's columns went live this morning, so there may be a handful of single
-- dish links already saved. They become one-component options, which is what
-- they always were.
--
-- Guarded on the column still existing so the file can be run twice. Without
-- it a second run fails on `dish_id`, which the drop below has already taken
-- away — and a migration that only works once is one nobody dares re-run when
-- they are unsure whether it went through the first time.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'diet_plan_options' and column_name = 'dish_id')
  then
    insert into diet_plan_option_dishes (option_id, dish_id, servings, seq)
    select id, dish_id, coalesce(servings, 1), 0
      from diet_plan_options
     where dish_id is not null
       and not exists (
         select 1 from diet_plan_option_dishes d where d.option_id = diet_plan_options.id);
  end if;
end $$;

-- With the links moved, the old columns would be a second place to look for
-- the same fact — and the one the code no longer writes.
alter table diet_plan_options drop column if exists dish_id;
alter table diet_plan_options drop column if exists servings;

do $$ begin execute 'alter publication supabase_realtime add table diet_plan_option_dishes'; exception when others then null; end $$;

-- ---- check afterwards -------------------------------------------------------
--   select o.food_items, d.name, od.servings
--     from diet_plan_option_dishes od
--     join diet_plan_options o on o.id = od.option_id
--     join dishes d on d.id = od.dish_id
--    order by o.food_items, od.seq;
