-- Recover household measures that were present in the original INDB recipe
-- workbooks but imported as zero grams.
--
-- The source workbooks remain authoritative for the stated quantities. Gram
-- weights come from INDB Units.xlsx where it provides a matching household
-- measure, and otherwise use the documented estimate shown on the row. The
-- old zero is part of every guard, so this migration is safe to rerun.

with corrections (source, seq, new_g, gram_source, explanation) as (values
  ('INDB ASC046',  3,  9::numeric,        'estimated', '1 tbsp sesame seeds; estimated from the USDA standard household measure of 9 g/tbsp'),
  ('INDB ASC046', 12,  5::numeric,        'estimated', '1 tsp chilli sauce at 5 g/tsp'),
  ('INDB ASC224', 14,  5::numeric,        'estimated', '1 tsp chilli sauce at 5 g/tsp'),
  ('INDB ASC247', 17, 10::numeric,        'estimated', '2 tsp mint sauce at 5 g/tsp'),
  ('INDB ASC360',  1,  0.455729::numeric, null,        '0.125 tsp urad dal from INDB Units.xlsx: 175 g/cup divided by 48 tsp/cup'),
  ('INDB BFP203',  7, 10::numeric,        'estimated', '2 tsp egg yolk at 5 g/tsp; INDB Units.xlsx records one yolk as 16 g'),
  ('INDB BFP221',  7, 10::numeric,        'estimated', '2 tsp egg yolk at 5 g/tsp; INDB Units.xlsx records one yolk as 16 g'),
  ('INDB OSR075', 23,  5::numeric,        'estimated', '1 tsp chilli sauce at 5 g/tsp'),
  ('INDB OSR108',  7, 48.9375::numeric,   null,        '4.5 tbsp pomegranate seeds from INDB Units.xlsx: 174 g/cup'),
  ('INDB OSR111',  2, 18.625::numeric,    null,        '2 tbsp capsicum from INDB Units.xlsx: 149 g/cup'),
  ('INDB OSR114',  7, 32.8125::numeric,   'estimated', 'midpoint of the source range, 3.5 tbsp potato, using 150 g/cup'),
  ('INDB OSR118',  4, 10::numeric,        null,        '2 tbsp dry coconut from INDB Units.xlsx: 80 g/cup')
)
update dish_items i set
  raw_g = c.new_g,
  raw_g_source = c.gram_source,
  note = c.explanation
from corrections c
join dishes d on d.source = c.source
where i.dish_id = d.id
  and i.seq = c.seq
  and i.raw_g = 0;

-- A dry run through the same nutrient and plausibility rules used by the dish
-- library clears these ten recipes after the corrections above. OSR108 is
-- deliberately absent: even corrected, its source-guessed two-plate yield
-- produces 1,371 kcal per plate, so it remains held for dietitian review.
with verified (source) as (values
  ('INDB ASC046'),
  ('INDB ASC224'),
  ('INDB ASC247'),
  ('INDB ASC360'),
  ('INDB BFP203'),
  ('INDB BFP221'),
  ('INDB OSR075'),
  ('INDB OSR111'),
  ('INDB OSR114'),
  ('INDB OSR118')
)
update dishes d set
  approved = true,
  approved_by = 'Source workbook audit',
  approved_at = now(),
  updated_at = now()
from verified v
where d.source = v.source
  and d.approved = false
  and d.servings > 0
  and not exists (
    select 1
    from dish_items i
    where i.dish_id = d.id
      and (i.food_code is null or i.raw_g <= 0)
  );

select count(*) as corrected_recipe_rows
from dishes
where source in (
  'INDB ASC046', 'INDB ASC224', 'INDB ASC247', 'INDB ASC360',
  'INDB BFP203', 'INDB BFP221', 'INDB OSR075', 'INDB OSR108',
  'INDB OSR111', 'INDB OSR114', 'INDB OSR118'
);
