-- ============================================================================
-- Cureocity — workspace Phase 4: Dietitian Diet Charts + Recipes. Run after 0062.
--
--  • diet_charts — versioned per-client meal plans, Draft → Published.
--  • recipes     — the dietitian's recipe library.
-- ============================================================================

create table if not exists diet_charts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references clients(id) on delete cascade,
  version    int  not null default 1,
  status     text not null default 'Draft',        -- Draft | Published
  calories   int,
  protein    text,
  notes      text,
  meals      jsonb not null default '[]'::jsonb,    -- [[label, detail], ...]
  by_name    text,
  created_at timestamptz not null default now()
);
create index if not exists diet_charts_client_idx on diet_charts (client_id);

create table if not exists recipes (
  id         uuid primary key default gen_random_uuid(),
  week       text,
  name       text not null,
  tags       text,
  kcal       int,
  published  boolean not null default false,
  created_at timestamptz not null default now()
);

alter table diet_charts enable row level security;
alter table recipes     enable row level security;

drop policy if exists diet_charts_staff on diet_charts;
create policy diet_charts_staff on diet_charts for all using (is_staff()) with check (is_staff());
-- clients can read their own PUBLISHED chart (portal)
drop policy if exists diet_charts_client on diet_charts;
create policy diet_charts_client on diet_charts for select using (client_id = my_client_id() and status = 'Published');

drop policy if exists recipes_staff on recipes;
create policy recipes_staff on recipes for all using (is_staff()) with check (is_staff());
-- clients can browse published recipes
drop policy if exists recipes_client on recipes;
create policy recipes_client on recipes for select using (published = true);

do $$ begin
  begin execute 'alter publication supabase_realtime add table diet_charts'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table recipes';     exception when others then null; end;
end $$;

-- ---- seed (only if empty) --------------------------------------------------
insert into diet_charts (client_id, version, status, calories, protein, notes, meals, by_name)
select c.id, 1, 'Published', 1450, '72 g',
  'Low-GI focus for prediabetes; avoid refined sugar and late dinners.',
  '[["Early Morning","Warm water + 5 soaked almonds"],["Breakfast","2 idli + sambar + buttermilk"],["Mid-Morning","1 apple"],["Lunch","1 cup brown rice + dal + veg curry + salad"],["Evening","Green tea + roasted chana"],["Dinner","2 roti + paneer bhurji + salad (before 8 PM)"]]'::jsonb,
  'Diet Anjana'
from clients c where c.code = 'CUR-002'
and not exists (select 1 from diet_charts);

insert into recipes (week, name, tags, kcal, published)
select v.week, v.name, v.tags, v.kcal, v.published
from (values
  ('Week of Jun 29', 'Ragi Dosa with Tomato Chutney', 'High fibre · Diabetic friendly', 210, true),
  ('Week of Jun 29', 'Sprouts & Pomegranate Chaat',   'High protein · PCOS friendly',   180, true),
  ('Week of Jul 6',  'Grilled Fish with Millet Pulao', 'Omega-3 · Fatty-liver friendly', 340, false)
) as v(week, name, tags, kcal, published)
where not exists (select 1 from recipes);
