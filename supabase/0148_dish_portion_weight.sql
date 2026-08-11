-- What one portion of a recipe actually weighs.
--
-- The library says "1 bowl" and "1 plate", which is how a chart reads to a
-- client but tells a dietitian very little. A bowl of clear soup and a bowl of
-- biryani are the same word and nothing like the same food. A weight settles
-- it, and it is the figure she needs when deciding whether an option is a
-- sensible size.
--
-- WHERE THE NUMBER COMES FROM. Not from a standard — there isn't one. Nobody
-- publishes "one plate of pakora = N grams", and ICMR-NIN's portion sizes are
-- by food group (so much cereal, so much pulse) rather than by dish. So this
-- is arithmetic on the recipe's own data: its ingredient weights divided by
-- how many servings it makes. Every figure traces back to something recorded.
--
-- IT IS INGREDIENT WEIGHT, NOT PLATE WEIGHT. Rice roughly triples when boiled,
-- so 360 g of ingredients is a considerably larger plate of cooked food. The
-- screens say "of ingredients" for that reason. It is also the basis the whole
-- app already computes on: IFCT's values are for raw foods, and the energy in
-- a boiled cup of rice is the energy of the rice that went in.
--
-- EDITABLE, AND HERS WHEN SHE TOUCHES IT. The derived value is a starting
-- point. `portion_g_source` records which it is, so a figure the dietitian
-- weighed is never quietly replaced by one the app worked out.

alter table dishes
  add column if not exists portion_g numeric,
  add column if not exists portion_g_source text
    check (portion_g_source is null or portion_g_source in ('derived', 'dietitian'));

comment on column dishes.portion_g is
  'Raw ingredient weight of one serving, in grams. Derived from the recipe unless a dietitian has set it.';

-- Fill in what can be worked out, for recipes that have both a servings count
-- and a complete set of ingredient weights. Anything with a missing weight is
-- left null rather than under-counted: a portion figure built from half the
-- ingredients would look precise and be wrong.
with weighed as (
  select d.id,
         sum(i.raw_g)                as total_g,
         count(*)                    as items,
         count(*) filter (where i.raw_g > 0) as weighed_items
    from dishes d
    join dish_items i on i.dish_id = d.id
   group by d.id
)
update dishes d set
  portion_g = round((w.total_g / d.servings)::numeric, 1),
  portion_g_source = 'derived'
from weighed w
where w.id = d.id
  and d.servings is not null and d.servings > 0
  and w.items = w.weighed_items
  and w.total_g > 0
  and d.portion_g is null;

-- ---- check afterwards -------------------------------------------------------
--   select serving_label, count(*), round(percentile_cont(0.5)
--            within group (order by portion_g)) as median_g
--     from dishes where portion_g is not null
--    group by 1 order by 2 desc limit 10;
--   expect a bowl around 260 g, a plate around 360, a biscuit around 19.
