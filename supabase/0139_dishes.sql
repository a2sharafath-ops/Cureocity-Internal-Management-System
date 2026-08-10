-- Dishes: the bridge between the food tables and a real diet chart.
--
-- `foods` holds raw ingredients — rice, coconut, green gram. A chart does not
-- speak that language. It says "1 medium piece puttu, ¾ cup crumbled + ½ cup
-- kadala curry", and nothing in IFCT can price that.
--
-- A dish is a recipe: a list of ingredients in grams, a total cooked weight,
-- and how many servings it makes. From that the app can COMPUTE what a serving
-- contains, instead of a dietitian recalling it or a language model inventing
-- it. Change an ingredient and every chart that uses the dish is re-priced.
--
-- Two deliberate choices.
--
-- FREE TEXT SURVIVES. `diet_plan_options.food_items` stays exactly as it is —
-- a dietitian must always be able to write something the library has never
-- heard of, mid-consultation, without stopping to define a recipe first. A dish
-- link is an upgrade to an option, never a requirement.
--
-- COOKED WEIGHT IS RECORDED, NOT ASSUMED. Rice roughly triples in weight when
-- boiled; a dosa loses water on the pan. Storing what the finished dish weighs
-- is what makes "½ cup" mean anything. Where it is unknown the field is null
-- and the app says the dish is unpriced rather than guessing a yield factor.

create table if not exists dishes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- "Puttu", "Kadala curry" — the name as it appears on a client's chart.
  aliases       text,                    -- other spellings staff might search
  cuisine       text default 'Kerala',
  -- What the whole recipe weighs when cooked, and what it divides into. Both
  -- null = the dish is described but cannot be priced yet.
  cooked_g      numeric,
  servings      numeric,
  -- The household portion this dish is normally written as: "1 medium piece",
  -- "¾ cup crumbled". Free text, because that is how a chart reads.
  serving_label text,
  notes         text,
  source        text,                    -- where the recipe came from
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists dish_items (
  id         uuid primary key default gen_random_uuid(),
  dish_id    uuid not null references dishes(id) on delete cascade,
  -- The IFCT food, where one matches. Null with a name filled in means the
  -- ingredient is known but not yet mapped — visible, and priceable later.
  food_code  text references foods(food_code),
  name       text not null,              -- as written in the recipe
  raw_g      numeric not null,           -- RAW weight, matching IFCT's basis
  seq        int not null default 0
);

create index if not exists dishes_name_idx on dishes (lower(name));
create index if not exists dish_items_dish_idx on dish_items (dish_id);

alter table dishes enable row level security;
alter table dish_items enable row level security;

-- The recipe library is clinic reference data, like `foods` and `services`:
-- every clinician reads it, and changing it changes documents already issued,
-- so writing is held to the people who may author nutrition.
drop policy if exists dishes_read on dishes;
create policy dishes_read on dishes for select using (is_staff());
drop policy if exists dishes_write on dishes;
create policy dishes_write on dishes for all
  using (is_admin() or my_role() = 'Dietitian' or my_role() = 'Medical Director')
  with check (is_admin() or my_role() = 'Dietitian' or my_role() = 'Medical Director');

drop policy if exists dish_items_read on dish_items;
create policy dish_items_read on dish_items for select using (is_staff());
drop policy if exists dish_items_write on dish_items;
create policy dish_items_write on dish_items for all
  using (is_admin() or my_role() = 'Dietitian' or my_role() = 'Medical Director')
  with check (is_admin() or my_role() = 'Dietitian' or my_role() = 'Medical Director');

-- A chart option may name the dish it is built from. Nullable on purpose: see
-- "free text survives" above.
alter table diet_plan_options
  add column if not exists dish_id uuid references dishes(id) on delete set null,
  -- How much of the dish this option is, as a multiple of one serving. 1 = a
  -- serving, 0.5 = half. Kept separate from the printed `qty` text, which stays
  -- the human phrasing the client reads.
  add column if not exists servings numeric;
