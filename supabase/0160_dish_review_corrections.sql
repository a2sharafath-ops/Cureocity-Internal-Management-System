-- Clear recipe-review warnings whose causes can be proved from the import.
--
-- This deliberately does not auto-correct every row under "Needs a look".
-- The remaining rows require a dietitian to choose a real serving size or
-- verify a source figure. This file only changes mechanical import defects.

-- Five recipes describe a fractional serving in their original label. 0146
-- replaced that with a whole-item label and changed the number of servings,
-- making a whole pie or fish look like one chart portion. Restore the stated
-- portions and convert INDB's whole-recipe macros to the same per-portion basis.
with corrections (source, old_servings, old_label, servings, serving_label, divisor) as (values
  ('INDB ASC241', 0.25::numeric, '1 chicken', 1::numeric, '0.25 chicken', 4::numeric),
  ('INDB BFP231', 1::numeric, '1 fish', 2::numeric, '0.5 fish', 2::numeric),
  ('INDB BFP522', 1::numeric, '1 flan', 2::numeric, '0.5 flan', 2::numeric),
  ('INDB BFP531', 1::numeric, '1 pie', 4::numeric, '0.25 pie', 4::numeric),
  ('INDB BFP532', 1::numeric, '1 pie', 4::numeric, '0.25 pie', 4::numeric)
)
update dishes d set
  servings         = c.servings,
  serving_label    = c.serving_label,
  source_kcal      = d.source_kcal      / c.divisor,
  source_carb_g    = d.source_carb_g    / c.divisor,
  source_protein_g = d.source_protein_g / c.divisor,
  source_fat_g     = d.source_fat_g     / c.divisor,
  source_fibre_g   = d.source_fibre_g   / c.divisor
from corrections c
where d.source = c.source
  and d.servings = c.old_servings
  and d.serving_label = c.old_label;

-- The ingredient seed was split across SQL files. Its old "skip the recipe if
-- any item exists" guard meant both recipes crossing a file boundary kept only
-- the first half. Insert each absent sequence instead, so this is safe to rerun.
with missing (source, food_code, name, raw_g, seq, raw_g_source, note) as (values
  ('INDB ASC351', 'A504', 'Flour, gram', 50::numeric, 1, null::text, null::text),
  ('INDB ASC351', 'G523', 'Garam masala', 0.25::numeric, 2, null, null),
  ('INDB ASC351', 'G516', 'Chilli powder', 0.3375::numeric, 3, null, null),
  ('INDB ASC351', 'G516', 'Chilli powder', 0.675::numeric, 4, null, null),
  -- 10% of the other raw ingredients, matching the documented 0154 method.
  ('INDB ASC351', 'T508', 'Oil, sunflower', 19.7::numeric, 5, 'estimated', 'what the food absorbs, not the panful it was fried in'),
  ('INDB ASC351', 'T508', 'Oil, sunflower', 2.25::numeric, 6, null, null),
  ('INDB ASC351', 'G528', 'Salt', 1.5::numeric, 7, null, null),
  ('INDB ASC351', 'G528', 'Salt', 1.5::numeric, 8, null, null),
  ('INDB ASC351', 'K505', 'Water, distilled', 60::numeric, 9, null, null),
  ('INDB ASC351', 'G536', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric, 10, 'estimated', 'estimated weight from 0.25 tsp at 2.5 g/tsp'),
  ('INDB BFP289', 'G017', 'Onion, big (Allium cepa)', 5::numeric, 4, null, null),
  ('INDB BFP289', 'G031', 'Pepper, black (Piper nigrum)', 0.2875::numeric, 5, null, null),
  ('INDB BFP289', 'G031', 'Pepper, black (Piper nigrum)', 0.575::numeric, 6, null, null),
  ('INDB BFP289', 'L002', 'Milk, whole, Cow', 51.5::numeric, 7, null, null),
  ('INDB BFP289', 'M001', 'Egg, poultry, whole, raw', 12.5::numeric, 8, null, null),
  ('INDB BFP289', 'L505', 'Cheese, processed, plain', 15::numeric, 9, null, null),
  ('INDB BFP289', 'G528', 'Salt', 1.02::numeric, 10, null, null),
  ('INDB BFP289', 'G528', 'Salt', 1.02::numeric, 11, null, null),
  ('INDB BFP289', 'T501', 'Butter, unsalted', 4.7::numeric, 12, null, null),
  ('INDB BFP289', 'T501', 'Butter, unsalted', 4.7::numeric, 13, null, null),
  ('INDB BFP289', 'T501', 'Butter, unsalted', 4.7::numeric, 14, null, null),
  ('INDB BFP289', 'O501', 'Ham', 30::numeric, 15, null, null)
)
insert into dish_items (dish_id, food_code, name, raw_g, seq, raw_g_source, note)
select d.id, m.food_code, m.name, m.raw_g, m.seq, m.raw_g_source, m.note
from missing m
join dishes d on d.source = m.source
where not exists (
  select 1 from dish_items i where i.dish_id = d.id and i.seq = m.seq
);

-- ASC351 had the same panful-of-oil defect as the neighbouring pakora rows,
-- but was absent from 0154. Keep its citation while retiring the bad comparison.
update dishes
set source_superseded = 'The published figure counts the whole pan of frying oil as eaten. The ingredients here record what the food absorbs instead, so the two are no longer measuring the same thing.'
where source = 'INDB ASC351'
  and source_superseded is null;

select count(*) as corrected_review_rows
from dishes
where source in ('INDB ASC241', 'INDB BFP231', 'INDB BFP522', 'INDB BFP531', 'INDB BFP532', 'INDB ASC351', 'INDB BFP289');
