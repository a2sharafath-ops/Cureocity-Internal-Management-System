-- Ingredients the food table had never heard of: the ones that are food,
-- and the ones that are not.
--
-- 115 ingredient rows across 80 recipes name something with no composition
-- anywhere. Two different problems were sitting in one pile.
--
-- A. THINGS THAT ARE NOT FOOD
--
-- Food colouring, flavouring essence, kewra water, rose water, silver leaf,
-- alum, reetha and ammonium bicarbonate. These have no published composition
-- because there is nothing to publish: a dye, a scent in water, a leaf of inert
-- metal, a raising agent that leaves as gas. At a quarter teaspoon they are not
-- approximately nothing, they are nothing.
--
-- So they are recorded at zero, and the recipe says so. This is a decision the
-- clinic took deliberately, not an import artefact, and the Dishes screen names
-- them on every recipe that uses one — "Counted as contributing nothing: red
-- colour". A reader who disagrees can see exactly what to disagree with.
--
-- What is NOT in here, and why: citric acid, tartaric acid, jelly crystals,
-- gulkand, pineapple syrup, rose petals, spinach powder, nannari root, dry
-- lotus stem, beetroot and an orange drink. Every one of those is a real food
-- with real energy that we have simply not sourced yet. Sweeping them in with
-- the dyes because they were in the same pile would put a zero on a client's
-- chart where a number belongs. They stay blocked.
--
-- B. MUTTON
--
-- IFCT 2017 has no mutton. Its meat section ends at O063, Rabbit, leg. INDB
-- prices mutton against a code, O064, that it references but never publishes.
--
-- In Kerala, mutton is goat, and IFCT has goat in detail — shoulder 188.1 kcal
-- per 100 g, legs 159.9, chops 135.8. Which to use did not have to be guessed.
--
-- Sixteen recipes use mutton, and for fourteen of them INDB publishes both the
-- full ingredient list and the finished per-serving figure. Everything in those
-- recipes except the mutton can be priced from IFCT, so the mutton is the only
-- unknown in the equation and each recipe solves for it independently:
--
--     173  Minestrone soup            190  Mutton pulao
--     173  Mutton biryani             193  Mutton seekh kebab
--     182  Meat and macaroni casserole 193  Dry masala chops
--     186  Spinach mutton             193  Meat consomme
--     186  Roghan josh                194  Brown stock
--     186  Boti kebab                 200  Mutton korma
--     189  Mutton yakhni              207  Mutton do piaza
--
-- Fourteen recipes, computed apart, land between 173 and 207 with a median of
-- 189.6 kcal per 100 g. IFCT's Goat, shoulder is 188.1 — 0.8% away. Legs would
-- have been 15.7% low and chops 28.4% low.
--
-- So this is not really a substitution chosen on the grounds that mutton is
-- goat. It is a measurement recovered from INDB's own arithmetic, which happens
-- to land on a cut IFCT already publishes. The two recipes left out of that
-- median (Mutton chops, and a cabbage and meatball soup) imply 481 and 1044,
-- which is not a cut of anything — both are already flagged for the whole-pot
-- problem and need their servings fixed before they mean anything.
--
-- It is labelled wherever it appears: "Priced as goat: mutton". Nobody should
-- be able to read these recipes and think somebody weighed a sheep.
--
-- C. ONE PLAIN BUG
--
-- Spring onion bulbs is filed as G501 in INDB's food table and D501 in INDB's
-- recipe file. We followed the recipe file, so the ingredient pointed at a code
-- that does not exist. Repointed.
--
-- Re-running is safe.

-- ---------------------------------------------------------------------------
-- A. The non-foods. Zero on every macro, and the source column says why.
-- ---------------------------------------------------------------------------

insert into foods (food_code, name, food_group, protein_g, fat_g, carb_g, fibre_g, kcal, source) values
  ('Z501', 'Food colouring', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z502', 'Flavouring essence', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z503', 'Kewra water (screwpine)', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z504', 'Rose water', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z505', 'Silver leaf (vark)', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z506', 'Alum solution, 2%', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z507', 'Reetha (soapnut)', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.'),
  ('Z508', 'Ammonium bicarbonate', 'Non-nutritive', 0, 0, 0, 0, 0, 'Not a food — a colouring, flavouring or inert additive. Recorded as contributing no energy by a decision of the clinic, not from a published table.')
on conflict (food_code) do nothing;

-- ---------------------------------------------------------------------------
-- A note on an ingredient, for anything whose composition is a stand-in.
-- ---------------------------------------------------------------------------

alter table dish_items add column if not exists note text;

comment on column dish_items.note is
  'Why this ingredient''s composition is not simply itself — mutton priced as goat, a colouring counted as nothing. Shown on the recipe so a substitution can never pass for a measurement.';

-- ---------------------------------------------------------------------------
-- B and C. Point each ingredient at the food that will price it.
-- ---------------------------------------------------------------------------

with fix (recipe, item, code, grams, note) as (values
  ('ASC241', 'Red colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC251', 'Red colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC336', 'Colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC336', 'Kewra essence', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC337', 'Colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC337', 'Kewra essence', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC339', 'Kewra essence', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC349', 'Kewra essence', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC350', 'Silver Foil', 'Z505', 0.05::numeric, 'counted as contributing nothing'),
  ('ASC396', 'Yellow colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC398', 'Orange colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC399', 'Pineapple essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC444', 'Ammonium bicarbonate', 'Z508', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP198', 'TOMATO COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP198', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP199', 'TOMATO COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP199', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP210', 'Yellow colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC236', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP396', 'COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP396', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP397', 'KEWRA ESSENCE', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP403', 'KEWRA ESSENCE', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP404', 'KEWRA ESSENCE', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP479', 'LEMON COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP479', 'LEMON ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP502', 'ALMOND ESSENCE', 'Z502', 0.31::numeric, 'counted as contributing nothing'),
  ('BFP511', 'ALMONDS ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP511', 'GREEN COLOUR', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC494', 'Orange essence', 'Z502', 2.5::numeric, 'counted as contributing nothing'),
  ('ASC494', 'Yellow color', 'Z501', 7.5::numeric, 'counted as contributing nothing'),
  ('ASC497', 'Pineapple essence', 'Z502', 2.5::numeric, 'counted as contributing nothing'),
  ('ASC497', 'Yellow color', 'Z501', 3.75::numeric, 'counted as contributing nothing'),
  ('ASC505', 'Alum Solution (2%)', 'Z506', 1000::numeric, 'counted as contributing nothing'),
  ('BFP360', 'Red colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP589', 'ESSENCE', 'Z502', 2.5::numeric, 'counted as contributing nothing'),
  ('BFP601', 'Spring onions, bulbs only, raw', 'G501', null::numeric, null),
  ('ASC018', 'Pineapple Essesnce', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC019', 'Orange Essesnce', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC090', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC088', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC120', 'Orange and green color', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC122', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC228', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC234', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC232', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC227', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('ASC287', 'Kewra essence', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC292', 'Kewra essence', 'Z503', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC307', 'Red colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC309', 'Yellow colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC310', 'Orange colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC310', 'Orange essence', 'Z502', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC313', 'Yellow colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC316', 'Mango essence', 'Z502', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC321', 'Kewra essence', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC345', 'Kewra essence', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC421', 'Orange colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC421', 'Orange essence', 'Z502', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC423', 'Banana flavour', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('ASC426', 'Red colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC426', 'Syrawberry flavour', 'Z502', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP015', 'Banana essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP015', 'Green colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP019', 'Fruit essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP019', 'Green colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP141', 'Kewra', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP141', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP142', 'Kewra', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP157', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP194', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP348', 'STRAWBERRY COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP348', 'STRAWBERRY ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP359', 'Red colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP366', 'LEMON ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP366', 'YELLOW COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP367', 'ORANGE COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP367', 'ORANGE ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP368', 'PINEAPPLE ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP368', 'YELLOW COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP382', 'LEMON ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP382', 'ORANGE COLOUR', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP388', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP388', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP389', 'Food colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP389', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP389', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP390', 'Food colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP390', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP390', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP391', 'Food colour', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP391', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP391', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP392', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP392', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP393', 'KEWRA ESSENCE', 'Z503', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP393', 'REETHA', 'Z507', 0.08::numeric, 'counted as contributing nothing'),
  ('BFP483', 'STRAWBERRY ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP483', 'YELLOW COLOUR', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP483', 'Strawberry essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP489', 'Lemon color', 'Z501', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP489', 'Lemon essence', 'Z502', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP496', 'ORANGE ESSENCE', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP505', 'Orange colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('ASC068', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP607', 'Yellow color', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP607', 'Mango essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP608', 'Yellow color', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP608', 'Pineapple essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('BFP609', 'Green colour', 'Z501', 0.63::numeric, 'counted as contributing nothing'),
  ('BFP609', 'Banana essence', 'Z502', 1.25::numeric, 'counted as contributing nothing'),
  ('OSR006', 'Rose water', 'Z504', 0.63::numeric, 'counted as contributing nothing'),
  ('OSR023', 'Rose water', 'Z504', 15::numeric, 'counted as contributing nothing'),
  ('BFP065', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)'),
  ('BFP190', 'MUTTON, muscle', 'O001', null::numeric, 'priced as goat (IFCT 2017 has no mutton)')
)
update dish_items di
   set food_code = f.code,
       raw_g     = case when coalesce(di.raw_g, 0) = 0 and f.grams is not null
                        then f.grams else di.raw_g end,
       note      = f.note
  from fix f
  join dishes d on d.source = 'INDB ' || f.recipe
 where di.dish_id = d.id
   and di.name    = f.item
   and (di.food_code is null or di.food_code not in (select food_code from foods));
