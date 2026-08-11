-- Weights the import left at zero, and seven foods it never brought across.
--
-- WHY THIS EXISTS
--
-- 495 of the 1,014 imported recipes are unapproved, and 338 of those are held
-- up by an ingredient whose weight is zero. An ingredient at zero grams makes
-- its whole recipe uncomputable, which is the right refusal — but a good many
-- of these were never unknown at all. Three separate causes, all fixed here.
--
-- 1. INDB PUBLISHES ITS OWN CONVERSION TABLE AND WE DID NOT READ IT.
--    Units.xlsx in the INDB repository lists the gram weights INDB itself used,
--    most of them carrying a USDA FoodData Central citation. The first import
--    went to USDA directly and missed this file. Every weight in part C below
--    is INDB's own figure, or arithmetic on it: a spoon derived from a cup uses
--    1 cup = 16 tbsp = 48 tsp, which is division, not a new measurement.
--
-- 2. MILLILITRES WERE NEVER CONVERTED. Milk, cola, coconut water and cream are
--    recorded in ml and arrived at zero grams. A density is a published figure,
--    so these are looked up, not guessed. Ice cream is the one to notice: it is
--    aerated, so 240 ml weighs 132 g, not 240 g. INDB's own table says so and
--    treating it as water would have overstated it by 80%.
--
-- 3. SEVEN FOODS INDB SHIPS WERE NEVER IMPORTED. Part A. Spring onion bulbs is
--    the one that was actually blocking a recipe; the other six are added
--    because leaving a hole in the food table only defers the same failure.
--
-- WHAT THIS DOES NOT FIX
--
-- Around 245 recipe uses are a pinch of spice with no published weight anywhere
-- — asafoetida, amchur, ajwain, essences, colourings. Those are a separate
-- decision and are not touched here. Nor are the 77 real foods measured in
-- spoons that still need a sourced weight each.
--
-- Mutton, dry lotus stem, beetroot, citric acid, jelly crystals, spinach powder
-- and nannari root remain unpriced. INDB references composition for the first
-- three under codes it does not publish, and has none at all for the rest. IFCT
-- 2017 ends at O063 (Rabbit, leg); the mutton INDB calls O064 is not in it.
-- Guessing at them here would be the one thing this system exists to prevent.
--
-- ONE FIGURE OF INDB'S OWN WE DID NOT TAKE
--
-- Units.xlsx says 1 cup of whipping cream weighs 120 g. That is half the weight
-- of water and cream is not half the density of water — 120 g is a cup of cream
-- already whipped, which is mostly air. The recipes here call for it fluid, so
-- fluid is what it is weighed as, using the same file's published and USDA-cited
-- 1 tbsp of fluid cream = 15 g. Trusting the 120 g would have halved the fat in
-- every dessert it appears in.
--
-- Re-running is safe: every statement is conditional on the value still being
-- absent.

-- ---------------------------------------------------------------------------
-- A. Seven foods INDB ships in UK_fct.xlsx and US_fct.xlsx that we never loaded.
--    Values per 100 g, exactly as published. 'Tr' (a trace) is stored as 0;
--    'N' (not measured) is stored as empty, which is not the same as zero.
-- ---------------------------------------------------------------------------

insert into foods (food_code, name, food_group, protein_g, fat_g, carb_g, fibre_g, kcal, source) values
  ('E510', 'Currants', null, 2.3, 0.4, 67.8, null, 267, 'UK CoFID via INDB (UK-14-074)'),
  ('V506', 'Fruit cocktail, canned in syrup, whole contents', null, 0.4, 0, 14.8, null, 57, 'UK CoFID via INDB (UK-14-097)'),
  ('V507', 'Fruit juice drink/squash, diluted', null, 0, 0, 1.8, 0, 7, 'UK CoFID via INDB (UK-17-847)'),
  ('E508', 'Peaches, canned in syrup, whole contents', null, 0.5, 0, 14, null, 55, 'UK CoFID via INDB (UK-14-189)'),
  ('H518', 'Pumpkin seeds', null, 24.4, 45.6, 15.2, null, 565, 'UK CoFID via INDB (UK-14-842)'),
  ('G501', 'Spring onions, bulbs only, raw', null, 0.9, 0, 8.5, null, 35, 'UK CoFID via INDB (UK-13-351)'),
  ('B508', 'Soybeans, mature seeds, raw', null, 36.5, 19.9, 30.2, 9.3, 446, 'USDA via INDB (US-174270)')
on conflict (food_code) do nothing;

-- ---------------------------------------------------------------------------
-- B and C. Weights for ingredients currently sitting at zero grams.
--
--   recipe  - INDB's recipe code, matched against the dish's source
--   item    - the ingredient name as the recipe writes it
--   grams   - the weight, and where it comes from
--
-- The update only touches rows still at zero, so a weight someone has since
-- corrected by hand is never overwritten.
-- ---------------------------------------------------------------------------

with weights (recipe, item, grams) as (values
  -- 2 tsp of Flour, rice; derived from INDB Units.xlsx "1 cup Rice flour = 120 g"
  ('ASC360', 'Flour, rice', 5::numeric),
  -- 3 tsp of Mayonnaise, standard, retail; derived from INDB Units.xlsx "1 cup Mayonnaise = 220 g"
  ('ASC268', 'Mayonnaise, standard, retail', 13.75::numeric),
  -- 3 tbsp of Coconut milk; derived from INDB Units.xlsx "1 cup Coconut milk = 244 g"
  ('BFP153', 'Coconut milk', 45.75::numeric),
  -- 1 tbsp of Celery stalk (Apium graveolens); derived from INDB Units.xlsx "1 cup Celery, raw = 101 g"
  ('BFP231', 'Celery stalk (Apium graveolens)', 6.31::numeric),
  -- 2 tbsp of Cream, fresh, whipping; published in INDB Units.xlsx
  ('BFP453', 'Cream, fresh, whipping', 30::numeric),
  -- 7 ml of Vinegar, distilled; INDB Units.xlsx "1 cup Vinegar, distilled = 238 g", i.e. 0.992 g/ml
  ('ASC509', 'Vinegar, distilled', 6.94::numeric),
  -- 1 tsp of Vinegar, distilled; derived from INDB Units.xlsx "1 cup Vinegar, distilled = 238 g"
  ('ASC513', 'Vinegar, distilled', 4.96::numeric),
  -- 0.5 tsp of Vinegar, distilled; derived from INDB Units.xlsx "1 cup Vinegar, distilled = 238 g"
  ('ASC514', 'Vinegar, distilled', 2.48::numeric),
  -- 1.5 tsp of Tea, black, infusion, average; published in INDB Units.xlsx
  ('ASC001', 'Tea, black, infusion, average', 3::numeric),
  -- 1 tsp of Tea, black, infusion, average; published in INDB Units.xlsx
  ('ASC004', 'Tea, black, infusion, average', 2::numeric),
  -- 250 ml of Cola; carbonated soft drink, taken as 1 g/ml
  ('ASC006', 'Cola', 250::numeric),
  -- 250 ml of Cola; carbonated soft drink, taken as 1 g/ml
  ('ASC007', 'Cola', 250::numeric),
  -- 50 ml of Ice cream, dairy, vanilla, soft scoop; INDB Units.xlsx: 0.5 cup = 66 g, so 132 g per 240 ml = 0.55 g/ml (ice cream is aerated)
  ('ASC011', 'Ice cream, dairy, vanilla, soft scoop', 27.5::numeric),
  -- 60 ml of Nuts, coconut water (liquid from coconuts); coconut water, taken as 1 g/ml
  ('ASC011', 'Nuts, coconut water (liquid from coconuts)', 60::numeric),
  -- 2 tsp of Cheese spread, cream cheese, regular; derived from INDB Units.xlsx "1 cup Cheese spread, cream cheese, regular = 240 g"
  ('ASC034', 'Cheese spread, cream cheese, regular', 10::numeric),
  -- 1 tsp of Jaggery, cane (Saccharum officinarum); derived from INDB Units.xlsx "1 cup Jaggery = 200 g"
  ('ASC127', 'Jaggery, cane (Saccharum officinarum)', 4.17::numeric),
  -- 0.5 tsp of Tea, black, infusion, average; published in INDB Units.xlsx
  ('ASC169', 'Tea, black, infusion, average', 1::numeric),
  -- 1 tsp of Coconut, kernal, dry (Cocos nucifera); derived from INDB Units.xlsx "1 cup Coconut meat, raw = 80 g"
  ('ASC214', 'Coconut, kernal, dry (Cocos nucifera)', 1.67::numeric),
  -- 1 tsp of Oil, coconut; oil at 0.92 g/ml against INDB Units.xlsx "1 cup oil = 240 ml"
  ('ASC219', 'Oil, coconut', 4.6::numeric),
  -- 0.5 tsp of Cashew nut (Anacardium occidentale); derived from INDB Units.xlsx "1 cup Cashewnut = 137 g"
  ('ASC223', 'Cashew nut (Anacardium occidentale)', 1.43::numeric),
  -- 2 tsp of Mayonnaise, standard, retail; derived from INDB Units.xlsx "1 cup Mayonnaise = 220 g"
  ('ASC256', 'Mayonnaise, standard, retail', 9.17::numeric),
  -- 1 tbsp of Cream, fresh, whipping; published in INDB Units.xlsx
  ('ASC263', 'Cream, fresh, whipping', 15::numeric),
  -- 1.5 tsp of Mayonnaise, standard, retail; derived from INDB Units.xlsx "1 cup Mayonnaise = 220 g"
  ('ASC264', 'Mayonnaise, standard, retail', 6.88::numeric),
  -- 250 ml of Fruit cocktail, canned in syrup, whole conte; canned fruit with its syrup, taken as 1 g/ml
  ('ASC319', 'Fruit cocktail, canned in syrup, whole contents', 250::numeric),
  -- 200 ml of Energy drink, carbonated; carbonated soft drink, taken as 1 g/ml
  ('BFP026', 'Energy drink, carbonated', 200::numeric),
  -- 500 ml of Energy drink, carbonated; carbonated soft drink, taken as 1 g/ml
  ('BFP027', 'Energy drink, carbonated', 500::numeric),
  -- 2 tsp of Coconut, kernal, dry (Cocos nucifera); derived from INDB Units.xlsx "1 cup Coconut meat, raw = 80 g"
  ('BFP204', 'Coconut, kernal, dry (Cocos nucifera)', 3.33::numeric),
  -- 80 ml of White sauce, savoury, made with whole milk, ; milk-based sauce, taken as 1 g/ml
  ('BFP218', 'White sauce, savoury, made with whole milk, homemade', 80::numeric),
  -- 2 tsp of Coconut, kernal, dry (Cocos nucifera); derived from INDB Units.xlsx "1 cup Coconut meat, raw = 80 g"
  ('BFP222', 'Coconut, kernal, dry (Cocos nucifera)', 3.33::numeric),
  -- 100 ml of Cream, fresh, whipping; INDB Units.xlsx "1 cup Cream, fluid, light = 240 g", i.e. 1.000 g/ml
  ('BFP541', 'Cream, fresh, whipping', 100::numeric),
  -- 360 ml of Milk, Cow; whole cow milk, 1.03 g/ml (standard published density)
  ('BFP607', 'Milk, Cow', 370.8::numeric),
  -- 360 ml of Milk, Cow; whole cow milk, 1.03 g/ml (standard published density)
  ('BFP608', 'Milk, Cow', 370.8::numeric),
  -- 360 ml of Milk, Cow; whole cow milk, 1.03 g/ml (standard published density)
  ('BFP609', 'Milk, Cow', 370.8::numeric),
  -- 4.5 tbsp of Wheat, semolina (Triticum aestivum); derived from INDB Units.xlsx "1 cup Semolina = 167 g"
  ('OSR009', 'Wheat, semolina (Triticum aestivum)', 46.97::numeric),
  -- 100 ml of Coconut milk; INDB Units.xlsx "1 cup Coconut milk = 244 g", i.e. 1.017 g/ml
  ('OSR009', 'Coconut milk', 101.67::numeric),
  -- 2 tbsp of Milk, condensed, whole, sweetened; derived from INDB Units.xlsx "1 cup Milk, condensed, sweetened = 304 g"
  ('OSR012', 'Milk, condensed, whole, sweetened', 38::numeric),
  -- 1.5 tbsp of Almond (Prunus amygdalus); derived from INDB Units.xlsx "1 cup Almond = 143 g"
  ('OSR017', 'Almond (Prunus amygdalus)', 13.41::numeric),
  -- 1.5 tbsp of Pistachio nuts (Pistacla vera); derived from INDB Units.xlsx "1 cup Nuts, pistachio nuts, raw = 123 g"
  ('OSR017', 'Pistachio nuts (Pistacla vera)', 11.53::numeric),
  -- 0.5 tbsp of Flour, rice; derived from INDB Units.xlsx "1 cup Rice flour = 120 g"
  ('OSR022', 'Flour, rice', 3.75::numeric),
  -- 2 C of Apple juice, clear, ambient and chilled; INDB Units.xlsx: 1 cup = 240 ml = 240 g
  ('OSR023', 'Apple juice, clear, ambient and chilled', 480::numeric),
  -- 2 tbsp of Wheat, semolina (Triticum aestivum); derived from INDB Units.xlsx "1 cup Semolina = 167 g"
  ('OSR026', 'Wheat, semolina (Triticum aestivum)', 20.88::numeric),
  -- 2 tbsp of Cashew nut (Anacardium occidentale); derived from INDB Units.xlsx "1 cup Cashewnut = 137 g"
  ('OSR026', 'Cashew nut (Anacardium occidentale)', 17.13::numeric),
  -- 2 tbsp of MARGARINE; published in INDB Units.xlsx
  ('OSR029', 'MARGARINE', 28.4::numeric),
  -- 0.33 C of Oil, sesame; oil at 0.92 g/ml against INDB Units.xlsx "1 cup oil = 240 ml"
  ('OSR052', 'Oil, sesame', 72.86::numeric),
  -- 4 tbsp of Oil, coconut; oil at 0.92 g/ml against INDB Units.xlsx "1 cup oil = 240 ml"
  ('OSR059', 'Oil, coconut', 55.2::numeric),
  -- 3.5 tbsp of Tomato, ripe, hybrid (Solanum lycopersicum); derived from INDB Units.xlsx "1 cup Tomatoes, raw/ripe = 180 g"
  ('OSR114', 'Tomato, ripe, hybrid (Solanum lycopersicum)', 39.38::numeric),
  -- 2 tbsp of Ground nut (Arachis hypogea); derived from INDB Units.xlsx "1 cup Peanuts, all types, raw = 146 g"
  ('OSR114', 'Ground nut (Arachis hypogea)', 18.25::numeric),
  -- 3.5 tbsp of Jaggery, cane (Saccharum officinarum); derived from INDB Units.xlsx "1 cup Jaggery = 200 g"
  ('OSR114', 'Jaggery, cane (Saccharum officinarum)', 43.75::numeric),
  -- 1.5 tbsp of Coconut, kernal, dry (Cocos nucifera); derived from INDB Units.xlsx "1 cup Coconut meat, raw = 80 g"
  ('OSR115', 'Coconut, kernal, dry (Cocos nucifera)', 7.5::numeric),
  -- 2 tbsp of Tomato, ripe, hybrid (Solanum lycopersicum); derived from INDB Units.xlsx "1 cup Tomatoes, raw/ripe = 180 g"
  ('OSR116', 'Tomato, ripe, hybrid (Solanum lycopersicum)', 22.5::numeric),
  -- 3 tbsp of Wheat, semolina (Triticum aestivum); derived from INDB Units.xlsx "1 cup Semolina = 167 g"
  ('OSR118', 'Wheat, semolina (Triticum aestivum)', 31.31::numeric),
  -- 2 tbsp of Cashew nut (Anacardium occidentale); derived from INDB Units.xlsx "1 cup Cashewnut = 137 g"
  ('OSR118', 'Cashew nut (Anacardium occidentale)', 17.13::numeric),
  -- 200 ml of Cream, fluid, light (coffee cream or table c; INDB Units.xlsx gives 1 cup = 240 g = 240 ml
  ('OSR121', 'Cream, fluid, light (coffee cream or table cream)', 200::numeric),
  -- 0.5 tsp of Tamarind, pulp (Tamarindus indica); derived from INDB Units.xlsx "1 cup Tamarind = 120 g"
  ('OSR083', 'Tamarind, pulp (Tamarindus indica)', 1.25::numeric),
  -- 0.5 tsp of Jaggery, cane (Saccharum officinarum); derived from INDB Units.xlsx "1 cup Jaggery = 200 g"
  ('OSR083', 'Jaggery, cane (Saccharum officinarum)', 2.08::numeric),
  -- 1 tsp of Coconut, kernal, dry (Cocos nucifera); derived from INDB Units.xlsx "1 cup Coconut meat, raw = 80 g"
  ('OSR135', 'Coconut, kernal, dry (Cocos nucifera)', 1.67::numeric),
  -- 2 tbsp of Cheese, cream, low fat; derived from INDB Units.xlsx "1 cup Cheese spread, cream cheese, regular = 240 g"
  ('OSR139', 'Cheese, cream, low fat', 30::numeric)
)
update dish_items di
   set raw_g = w.grams
  from weights w
  join dishes d on d.source = 'INDB ' || w.recipe
 where di.dish_id = d.id
   and di.name    = w.item
   and coalesce(di.raw_g, 0) = 0;
