-- What a cup of this particular food weighs.
--
-- WHY A TABLE AND NOT A CONVERSION FACTOR
--
-- Grams, kilograms, ounces and pounds convert between each other exactly and
-- always: an ounce is 28.3495 g whatever is being weighed. Cups and spoons do
-- not. A cup of puffed rice is 30 g, a cup of atta is 130 g and a cup of bengal
-- gram dal is 200 g — nearly seven times the first. There is no such thing as
-- "a cup in grams", only a cup of something.
--
-- So a volume can only be offered for a food we have a weight for, and that is
-- what this table holds. Where there is no row, the app says so and offers
-- grams instead of guessing. A cup of flour taken as 240 g would be double, and
-- nothing on the screen would have hinted at it.
--
-- WHERE THESE 133 COME FROM
--
-- INDB's own Units.xlsx, which is the file the recipe import should have read
-- in the first place. Most rows carry a USDA FoodData Central citation, and
-- the ones that do not say "BFP manual" or "ASC manual" — the databank's own
-- kitchen measurements. Every row keeps its source.
--
-- Matching INDB's names to this food table was done one at a time, not by
-- fuzzy matching, because a cup weight attached to the wrong food is worse than
-- no cup weight at all. Two near-misses caught while doing it: INDB's "Rice
-- flour" would have landed on Samai, a millet, and its generic "Rice" on the
-- parboiled variety rather than raw milled.
--
-- THREE FIGURES OF INDB'S OWN DELIBERATELY LEFT OUT
--
--   Whipping cream, 1 cup = 120 g. That is half the density of water; it is a
--   cup of cream already whipped, which is mostly air.
--   Cottage cheese, where the same food code is given two different cup
--   weights. Without knowing which is meant, neither is usable.
--   Anything measured in inches or centimetres. A length is not a portion.
--
-- WHAT THE DIETITIAN ADDS HERSELF
--
-- 86 foods of 734 start with a measure. The rest gain one the first time she
-- needs it: the app asks what a cup of that food weighs, records her answer
-- with her name against it, and every recipe can use cups for it from then on.
-- Those rows read 'set by' her name rather than a citation, so the two kinds
-- are never confused.

create table if not exists food_measures (
  food_code  text not null references foods(food_code) on delete cascade,
  -- 'cup', 'tbsp', 'tsp', 'ml', 'piece', 'medium', 'slice'... One row per unit
  -- per food; the mass units are not stored because they need no food.
  unit       text not null,
  grams      numeric not null check (grams > 0),
  -- A citation, or the name of whoever measured it. Never blank: a weight with
  -- no provenance is the thing this whole system exists to keep out.
  source     text not null,
  set_by     text,                      -- filled in only when a person set it
  created_at timestamptz not null default now(),
  primary key (food_code, unit)
);

alter table food_measures enable row level security;

drop policy if exists food_measures_read on food_measures;
create policy food_measures_read on food_measures for select using (is_staff());

drop policy if exists food_measures_write on food_measures;
create policy food_measures_write on food_measures for all
  using (is_staff()) with check (is_staff());

comment on table food_measures is
  'What one cup, spoon or piece of a particular food weighs. Volume and household units are meaningless without it.';

insert into food_measures (food_code, unit, grams, source) values
  ('A009', 'cup', 170, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168874/measures')   -- 1 cup Quinoa (Chenopodium quinoa),
  ('A011', 'cup', 55, 'INDB Units.xlsx — ASC manual')   -- 1 cup Rice flakes (Oryza sativa ),
  ('A012', 'cup', 30, 'INDB Units.xlsx — ASC manual')   -- 1 cup Rice puffed (Oryza sativa ),
  ('A015', 'cup', 160, 'INDB Units.xlsx — BFP manual')   -- 1 cup Rice, raw, milled (Oryza sativa ),
  ('A018', 'cup', 120, 'INDB Units.xlsx — BFP manual')   -- 1 cup Wheat flour, refined (Triticum aestivum),
  ('A019', 'cup', 130, 'INDB Units.xlsx — BFP manual')   -- 1 cup Wheat flour, atta (Triticum aestivum),
  ('A022', 'cup', 167, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168933/measures')   -- 1 cup Wheat, semolina (Triticum aestivum),
  ('A505', 'cup', 120, 'INDB Units.xlsx — same as flour')   -- 1 cup Flour, rice,
  ('B001', 'cup', 200, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173756/measures')   -- 1 cup Bengal gram, dal (Cicer arietinum),
  ('B003', 'cup', 175, 'INDB Units.xlsx — ASC manual')   -- 1 cup Black gram, dal (Phaseolus mungo),
  ('B010', 'cup', 175, 'INDB Units.xlsx — ASC manual')   -- 1 cup Green gram, dal (Phaseolus aureus),
  ('B013', 'cup', 175, 'INDB Units.xlsx — ASC manual')   -- 1 cup Lentil dal (Lens culinaris),
  ('B021', 'cup', 175, 'INDB Units.xlsx — ASC manual')   -- 1 cup Red gram, dal (Cajanus cajan),
  ('B506', 'block', 81, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172475/measures')   -- 1 block Tofu, soya bean, steamed,
  ('B506', 'cup', 126, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172475/measures')   -- 1 cup Tofu, soya bean, steamed,
  ('B509', 'cup', 200, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173756/measures')   -- 1 cup Chickpeas (garbanzo beans, bengal gram),,
  ('C020', 'cup', 16, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 cup Fenugreek leaves (Trigonella foenum grae,
  ('C502', 'cup', 34, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170068/measures')   -- 1 cup Watercress, raw,
  ('D033', 'medium', 50, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Capsicum, green (Capsicum annuum),
  ('D033', 'ring', 30, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 ring Capsicum, green (Capsicum annuum),
  ('D036', 'medium', 400, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Cauliflower (Brassica oleracea),
  ('D075', 'cup', 180, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1103276/portions')   -- 1 cup Tomato, ripe, hybrid (Lycopersicon escul,
  ('D075', 'medium', 50, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Tomato, ripe, hybrid (Lycopersicon escul,
  ('D075', 'piece', 17, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1103276/portions')   -- 1 piece Tomato, ripe, hybrid (Lycopersicon escul,
  ('D075', 'small', 25, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 small Tomato, ripe, hybrid (Lycopersicon escul,
  ('E001', 'medium', 80, 'INDB Units.xlsx — BFP manual')   -- 1 medium Apple, big (Malus domestica),
  ('E009', 'medium', 100, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Banana, ripe, montham (Musa x paradisiac,
  ('E017', 'cup', 147, 'INDB Units.xlsx — USDA (https://courses.washington.edu/bonephys/calist.pdf)')   -- 1 cup Dates, dry, pale brown (Phoenix dactylif,
  ('E017', 'piece', 9, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Dates, dry, pale brown (Phoenix dactylif,
  ('E036', 'cup', 165, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169910/measures')   -- 1 cup Mango, ripe, banganapalli (Mangifera ind,
  ('E036', 'medium', 200, 'INDB Units.xlsx — BFP manual')   -- 1 medium Mango, ripe, banganapalli (Mangifera ind,
  ('E049', 'medium', 600, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Papaya, ripe (Carcia papaya),
  ('E050', 'piece', 200, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Peach (Prunus communis),
  ('E051', 'medium', 178, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169118/measures')   -- 1 medium Pear (Pyrus sp.),
  ('E051', 'small', 148, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169118/measures')   -- 1 small Pear (Pyrus sp.),
  ('E053', 'slice', 50, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 slice Pineapple (Ananas comosus),
  ('E057', 'piece', 0.2222, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Raisins, dried, black (Vitis vinifera),
  ('E057', 'tbsp', 10, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 tbsp Raisins, dried, black (Vitis vinifera),
  ('E064', 'cup', 120, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/167763/measures')   -- 1 cup Tamarind, pulp (Tamarindus indicus),
  ('E064', 'piece', 2, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/167763/measures')   -- 1 piece Tamarind, pulp (Tamarindus indicus),
  ('E064', 'tbsp', 10, 'https://www.aqua-calc.com/calculate/food-volume-to-weight')   -- 1 tbsp Tamarind, pulp (Tamarindus indicus),
  ('E067', 'medium', 400, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Wood Apple (Limonia acidissima),
  ('E506', 'piece', 1.1111, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Sultanas,
  ('F002', 'cup', 128, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170393/measures')   -- 1 cup Carrot, orange (Dacus carota),
  ('F002', 'medium', 60, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Carrot, orange (Dacus carota),
  ('F006', 'medium', 70, 'INDB Units.xlsx — BFP manual')   -- 1 medium Potato, brown skin, big (Solanum tuberos,
  ('F006', 'small', 35, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 small Potato, brown skin, big (Solanum tuberos,
  ('F013', 'cup', 133, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168482/measures')   -- 1 cup Sweet potato, brown skin (Ipomoes batata,
  ('F013', 'piece', 130, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168482/measures')   -- 1 piece Sweet potato, brown skin (Ipomoes batata,
  ('G014', 'cup', 96, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/ginger-blank-root-coma-and-blank-raw')   -- 1 cup Ginger, fresh (Zinziber officinale),
  ('G016', 'cup', 16, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 cup Mint leaves (Mentha spicata ),
  ('G016', 'piece', 0.5, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Mint leaves (Mentha spicata ),
  ('G017', 'medium', 60, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 medium Onion, big (Allium cepa),
  ('G017', 'small', 30, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 small Onion, big (Allium cepa),
  ('G024', 'cup', 80, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/spices-coma-and-blank-coriander-blank-seed')   -- 1 cup Coriander seeds (Coriandrum sativum),
  ('G024', 'tbsp', 5, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170922/measures')   -- 1 tbsp Coriander seeds (Coriandrum sativum),
  ('G024', 'tsp', 1.8, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170922/measures')   -- 1 tsp Coriander seeds (Coriandrum sativum),
  ('G025', 'cup', 96, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/spices-coma-and-blank-cumin-blank-seed-blank--op-whole-cp-')   -- 1 cup Cumin seeds (Cuminum cyminum),
  ('G025', 'tbsp', 6, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170923/measures')   -- 1 tbsp Cumin seeds (Cuminum cyminum),
  ('G025', 'tsp', 2.1, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170923/measures')   -- 1 tsp Cumin seeds (Cuminum cyminum),
  ('G027', 'blade', 1, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 blade Mace (Myristica fragrans),
  ('G512', 'piece', 0.4, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Bay leaf, dried,
  ('G529', 'packet', 0.5, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 packet Saffron,
  ('G529', 'strand', 0.0025, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 strand Saffron,
  ('G529', 'tbsp', 1, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 tbsp Saffron,
  ('G537', 'piece', 2, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece STAR ANISE,
  ('G538', 'cup', 238, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172237/measures')   -- 1 cup Vinegar, distilled,
  ('G538', 'tbsp', 14.9, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172237/measures')   -- 1 tbsp Vinegar, distilled,
  ('G546', 'cup', 160, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/shallots-coma-and-blank-raw-blank--op-chopped-cp-')   -- 1 cup Shallots, raw,
  ('G547', 'cup', 100, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170005/measures')   -- 1 cup Spring onions, bulbs and tops, raw,
  ('G547', 'piece', 30, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Spring onions, bulbs and tops, raw,
  ('G549', 'cup', 90, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168576/measures')   -- 1 cup Peppers, jalapeno, raw,
  ('G549', 'piece', 14, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/168576/measures')   -- 1 piece Peppers, jalapeno, raw,
  ('H001', 'cup', 143, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170567/measures')   -- 1 cup Almond (Prunus amygdalus),
  ('H001', 'piece', 1.11, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Almond (Prunus amygdalus),
  ('H005', 'cup', 137, 'INDB Units.xlsx — USDA (https://courses.washington.edu/bonephys/calist.pdf)')   -- 1 cup Cashew nut (Anacardium occidentale),
  ('H005', 'piece', 1.67, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Cashew nut (Anacardium occidentale),
  ('H007', 'cup', 80, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170169/measures')   -- 1 cup Coconut, kernel, fresh (Cocos nucifera),
  ('H007', 'piece', 250, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Coconut, kernel, fresh (Cocos nucifera),
  ('H012', 'cup', 146, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172430/measures')   -- 1 cup Ground nut (Arachis hypogea),
  ('H012', 'handful', 35, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 handful Ground nut (Arachis hypogea),
  ('H012', 'tbsp', 14.175, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172430/measures')   -- 1 tbsp Ground nut (Arachis hypogea),
  ('H018', 'cup', 123, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170184/measures')   -- 1 cup Pistachio nuts (Pistacla vera),
  ('H018', 'piece', 0.56, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Pistachio nuts (Pistacla vera),
  ('H020', 'cup', 140, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170562/measures')   -- 1 cup Sunflower seeds (Helianthus annuus),
  ('H021', 'piece', 2.5, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Walnut (Juglans regia),
  ('H501', 'cup', 244, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1097553/portions')   -- 1 cup Coconut milk,
  ('H518', 'cup', 129, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170556/measures')   -- 1 cup Pumpkin seeds,
  ('I001', 'cup', 200, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 cup Jaggery, cane (Saccharum officinarum),
  ('I501', 'cup', 132, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/167575/measures')   -- 1 cup Ice cream, dairy, vanilla, soft scoop,
  ('I502', 'cube', 2.3, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169655/measures')   -- 1 cube Sugar, white,
  ('I502', 'cup', 200, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169655/measures')   -- 1 cup Sugar, white,
  ('I502', 'tsp', 4.2, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169655/measures')   -- 1 tsp Sugar, white,
  ('I507', 'cup', 339, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169640/measures')   -- 1 cup Honey,
  ('I507', 'tbsp', 15, 'INDB Units.xlsx — BFP manual')   -- 1 tbsp Honey,
  ('I507', 'tsp', 5, 'INDB Units.xlsx — BFP manual')   -- 1 tsp Honey,
  ('I511', 'cup', 240, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/babyfood-coma-and-blank-fruit-coma-and-blank-tutti-blank-frutti-coma-and-blank-junior')   -- 1 cup TUTTI FRUTTI GUMBALLS, TUTTI FRUTTI,
  ('L500', 'cup', 132, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173414/measures')   -- 1 cup Cheese, Cheddar, English,
  ('L500', 'slice', 28, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173414/measures')   -- 1 slice Cheese, Cheddar, English,
  ('L501', 'cup', 240, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1098072/portions')   -- 1 cup Cheese spread, cream cheese, regular,
  ('L505', 'cup', 240, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1097906/portions')   -- 1 cup Cheese, processed, plain,
  ('L506', 'cube', 17, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173420/measures')   -- 1 cube Cheese, Feta,
  ('L506', 'cup', 150, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173420/measures')   -- 1 cup Cheese, Feta,
  ('L507', 'cup', 220, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/171009/measures')   -- 1 cup Mayonnaise, standard, retail,
  ('L507', 'tbsp', 13.8, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/171009/measures')   -- 1 tbsp Mayonnaise, standard, retail,
  ('L508', 'cup', 304, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1097540/portions')   -- 1 cup Milk, condensed, whole, sweetened,
  ('L514', 'cup', 240, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1097906/portions')   -- 1 cup Sour cream, regular,
  ('L514', 'tbsp', 15, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/1097906/portions')   -- 1 tbsp Sour cream, regular,
  ('L515', 'cup', 240, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170857/measures')   -- 1 cup Cream, fluid, light (coffee cream or tab,
  ('L515', 'tbsp', 15, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170857/measures')   -- 1 tbsp Cream, fluid, light (coffee cream or tab,
  ('L517', 'cup', 246, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/170885/measures')   -- 1 cup Whey, acid, fluid,
  ('L520', 'cup', 245, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/171284/measures')   -- 1 cup Yogurt, whole milk, plain,
  ('L521', 'cup', 245, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172225/measures')   -- 1 cup Milk, buttermilk, fluid, whole,
  ('M001', 'piece', 50, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Egg, poultry, whole, raw,
  ('M002', 'piece', 34, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Egg, poultry, white, raw,
  ('M003', 'piece', 16, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Egg, poultry, yolk, raw,
  ('O500', 'rasher', 40, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 rasher Bacon rashers, back, raw,
  ('O501', 'cup', 269.5, 'https://www.aqua-calc.com/calculate/food-volume-to-weight/substance/ham-coma-and-blank-chopped-coma-and-blank-not-blank-canned-blank--op-slice-coma-and-blank-1-blank-oz-column--blank-4-blank-x-blank-4-blank-x-blank-3-forward-slash-32-blank-inch-cp-')   -- 1 cup Ham,
  ('O501', 'slice', 15, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 slice Ham,
  ('O503', 'slice', 17, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 slice Salami,
  ('T501', 'blob', 15, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 blob Butter, unsalted,
  ('T501', 'cup', 227, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173410/measures')   -- 1 cup Butter, unsalted,
  ('T501', 'knob', 20, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 knob Butter, unsalted,
  ('T501', 'tbsp', 14.2, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/173410/measures')   -- 1 tbsp Butter, unsalted,
  ('T504', 'cup', 227, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172349/measures')   -- 1 cup MARGARINE,
  ('T504', 'tbsp', 14.2, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/172349/measures')   -- 1 tbsp MARGARINE,
  ('U500', 'piece', 8, 'INDB Units.xlsx — ASC manual')   -- 1 piece Biscuits, digestive, plain,
  ('U506', 'piece', 42, 'INDB Units.xlsx — USDA (https://courses.washington.edu/bonephys/calist.pdf)')   -- 1 piece HOT DOG BUNS,
  ('V510', 'piece', 2, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Tea, black, infusion, average,
  ('V510', 'tsp', 2, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 tsp Tea, black, infusion, average,
  ('W504', 'cup', 224, 'INDB Units.xlsx — USDA (https://courses.washington.edu/bonephys/calist.pdf)')   -- 1 cup JAM,
  ('W504', 'tbsp', 20, 'https://fdc.nal.usda.gov/fdc-app.html#/food-details/169641/measures')   -- 1 tbsp JAM,
  ('X513', 'piece', 250, 'INDB Units.xlsx — INDB Units.xlsx')   -- 1 piece Pizza base, raw
on conflict (food_code, unit) do nothing;
