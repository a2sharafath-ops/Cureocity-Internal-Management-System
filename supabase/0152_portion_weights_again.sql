-- The same portion arithmetic as 0148, run again now that more recipes have
-- a complete set of ingredient weights.
--
-- WHY IT HAS TO RUN TWICE
--
-- 0148 works out what one portion weighs by dividing a recipe's ingredient
-- weights by how many servings it makes, and it deliberately refuses any recipe
-- with an ingredient still at zero grams — a portion figure built from half the
-- ingredients would look precise and be wrong.
--
-- When 0148 ran, a few hundred recipes had exactly that problem: a pinch of
-- asafoetida, a spoon of mayonnaise, a colouring with no food code. Those have
-- since been filled in by 0149, 0150 and 0151, so the recipes that were rightly
-- skipped can now be answered. On the Dish library they are the rows showing an
-- empty grams box beside "One portion is 1 bowl".
--
-- It is the same rule and the same arithmetic; only the data underneath has
-- improved. Anything still missing a weight is still skipped, and this file can
-- be run again after the next batch of weights lands.
--
-- WHAT IT WILL NOT OVERWRITE
--
-- Only rows where portion_g is null. A figure the dietitian has weighed and
-- typed herself carries portion_g_source = 'dietitian' and a value, so it is
-- excluded twice over. She never has to wonder whether a later migration quietly
-- replaced her number.

with weighed as (
  select d.id,
         sum(i.raw_g)                        as total_g,
         count(*)                            as items,
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
--   expect a bowl around 260 g, a plate around 360, a biscuit around 19 — the
--   medians should barely move, because 173 more recipes measured the same way
--   should not change what a bowl is.
