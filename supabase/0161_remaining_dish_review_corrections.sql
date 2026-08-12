-- Finish the recipe-by-recipe review started in 0160.
--
-- Every change below has one of three traceable causes:
--   1. the imported label describes a whole batch, not a chart portion;
--   2. a source quantity had no gram conversion, so the recipe was unpriced;
--   3. INDB counted a frying bath / prepared stock as though it were eaten.
--
-- Published fields are divided only when the underlying whole-recipe figure
-- remains valid. Where the source and corrected ingredients no longer measure
-- the same thing, the source is retained for provenance but retired as a
-- nutrition fallback via source_superseded.

-- Whole batches converted to usable chart portions. Multiplying the old
-- published per-serving value by old_servings recovers the whole recipe; the
-- same whole is then divided by the new portion count.
with portions (source, old_servings, old_label, servings, serving_label) as (values
  ('INDB BFP310', 0.75::numeric, '1 cup',          12::numeric, '1 tablespoon'),
  ('INDB BFP312', 1::numeric,    '1 cup',          16::numeric, '1 tablespoon'),
  ('INDB OSR018', 2::numeric,    '1 bowl',          8::numeric, '1 bowl'),
  ('INDB OSR020', 6::numeric,    '1 piece',         8::numeric, '1 bowl'),
  ('INDB OSR081', 1::numeric,    '1 box',          32::numeric, '1 tablespoon'),
  ('INDB OSR094', 1::numeric,    '1 souffle dish',  6::numeric, '1 portion'),
  ('INDB OSR127', 1::numeric,    '1 cake',         12::numeric, '1 slice'),
  ('INDB OSR146', 1::numeric,    '1 cake',          8::numeric, '1 slice')
)
update dishes d set
  servings         = p.servings,
  serving_label    = p.serving_label,
  source_kcal      = d.source_kcal      * d.servings / p.servings,
  source_carb_g    = d.source_carb_g    * d.servings / p.servings,
  source_protein_g = d.source_protein_g * d.servings / p.servings,
  source_fat_g     = d.source_fat_g     * d.servings / p.servings,
  source_fibre_g   = d.source_fibre_g   * d.servings / p.servings
from portions p
where d.source = p.source
  and d.servings = p.old_servings
  and d.serving_label = p.old_label;

-- Unit conversions and preparation-state corrections. Each old value is part
-- of the guard, so this migration is safe to rerun.
with corrections (source, seq, old_g, new_g, gram_source, explanation) as (values
  -- Frying oil: 10% of all other raw ingredients, matching migration 0154.
  ('INDB OSR063',  9, 460::numeric,  40.9::numeric,   'estimated', 'what the fish absorbs, not the 500 ml frying bath'),
  ('INDB OSR016',  8, 410::numeric, 108.1::numeric,   'estimated', 'what the malpua absorbs, not the 2 cups of ghee heated in the pan'),
  ('INDB OSR020',  4, 400::numeric, 177.5::numeric,   'estimated', 'what the halwa retains after the source instructs the cook to drain excess ghee'),

  -- Missing spoon/cup conversions from the original recipe workbooks.
  ('INDB ASC087',  6,   0::numeric,   1.25::numeric,  'estimated', '0.25 tsp chilli sauce at 5 g/tsp'),
  ('INDB ASC089',  6,   0::numeric,   1.25::numeric,  'estimated', '0.25 tsp chilli sauce at 5 g/tsp'),
  ('INDB ASC093', 15,   0::numeric,   1.25::numeric,  'estimated', '0.25 tsp chilli sauce at 5 g/tsp'),
  ('INDB BFP067',  0,   0::numeric,  11::numeric,     null::text,  '1 tbsp vermicelli from INDB Units.xlsx: 176 g/cup divided by 16'),
  ('INDB OSR016',  2,   0::numeric,  41.25::numeric,  null::text,  '4 tbsp mango pulp from INDB Units.xlsx: 165 g/cup'),
  ('INDB OSR135',  2,   0::numeric,  15::numeric,     null::text,  'the source recipe specifies 1 tbsp lime juice'),
  ('INDB OSR146',  2,   0::numeric,  21.875::numeric, null::text,  '2 tbsp urad dal from INDB Units.xlsx: 175 g/cup'),

  -- The source specifies 1 lb dried beans, while B507 describes prepared
  -- beans. Six 172 g cooked cups put both sides in the same preparation state.
  ('INDB OSR154',  8, 453::numeric, 1032::numeric,    'estimated', '1 lb dry black beans converted to about 6 cups cooked at 172 g/cup')
)
update dish_items i set
  raw_g = c.new_g,
  raw_g_source = c.gram_source,
  note = c.explanation
from corrections c
join dishes d on d.source = c.source
where i.dish_id = d.id
  and i.seq = c.seq
  and i.raw_g = c.old_g;

-- B507's imported label data has 120 kcal per 130 g. The old 55 kcal value is
-- a transcription error: it cannot coexist with 15.8 g carbohydrate, 3.94 g
-- protein, 0.79 g fat and 5.5 g fibre. 92 kcal/100 g restores that label basis.
update foods
set kcal = 92
where food_code = 'B507'
  and kcal = 55;

-- These source figures cease to be comparable after the correction above, or
-- fail their own calorie/macronutrient energy balance. Keep the original
-- numbers and citation visible, but make the completed food-table calculation
-- the value used by charts.
with retired (source, reason) as (values
  ('INDB OSR063', 'The INDB figure counts the full frying bath as eaten. The ingredients now record estimated absorbed oil.'),
  ('INDB OSR016', 'The INDB figure counts the two cups of ghee heated in the pan as eaten. The ingredients now record estimated absorbed ghee.'),
  ('INDB OSR020', 'The INDB figure counts all 400 g of ghee although the source instructs the cook to drain the excess. The ingredients now record estimated retained ghee.'),
  ('INDB ASC087', 'The legacy published macros fail their own energy balance after prepared stock was treated as stock cubes. The completed ingredient calculation is used instead.'),
  ('INDB ASC089', 'The legacy published macros fail their own energy balance after prepared stock was treated as stock cubes. The completed ingredient calculation is used instead.'),
  ('INDB ASC093', 'The legacy published macros fail their own energy balance after prepared stock was treated as stock cubes. The completed ingredient calculation is used instead.'),
  ('INDB BFP067', 'The legacy published macros fail their own energy balance after prepared stock was treated as stock cubes. The completed ingredient calculation is used instead.'),
  ('INDB OSR135', 'The legacy published macros fail their own energy balance after prepared stock was treated as stock cubes. The completed ingredient calculation is used instead.'),
  ('INDB OSR154', 'The legacy published macros fail their own energy balance and mix dry-bean weight with a prepared-bean food row. The corrected ingredient calculation is used instead.'),
  ('INDB ASC011', 'The complete food-table calculation disagrees with the legacy INDB total; no missing or discarded ingredient supports the higher published figure.'),
  ('INDB OSR002', 'The complete food-table calculation disagrees with the legacy INDB total; the source and current food table use incompatible ingredient composition figures.')
)
update dishes d
set source_superseded = r.reason
from retired r
where d.source = r.source
  and d.source_superseded is null;

select count(*) as reviewed_rows
from dishes
where source in (
  'INDB BFP310', 'INDB BFP312', 'INDB OSR018', 'INDB OSR020',
  'INDB OSR081', 'INDB OSR094', 'INDB OSR127', 'INDB OSR146',
  'INDB OSR063', 'INDB OSR016', 'INDB ASC087', 'INDB ASC089',
  'INDB ASC093', 'INDB BFP067', 'INDB OSR135', 'INDB OSR154',
  'INDB ASC011', 'INDB OSR002'
);
