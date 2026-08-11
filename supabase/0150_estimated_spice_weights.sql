-- A weight for a pinch of spice, marked as the estimate it is.
--
-- THE PROBLEM
--
-- USDA publishes a gram weight for a teaspoon of chilli powder, cinnamon,
-- cumin and cardamom. It publishes none for asafoetida, amchur or ajwain, so
-- those arrived at zero grams and refused to let their recipes be computed.
-- Between them they held up over a hundred recipes on the strength of a
-- quarter teaspoon of hing.
--
-- WHAT IS ESTIMATED, AND HOW HONEST THAT IS
--
-- Every ground spice USDA does list weighs between 2.0 and 2.7 g per teaspoon:
-- cardamom 2.0, cumin 2.1, chilli 2.7, cinnamon 2.6. A ground spice that is not
-- on that list is very unlikely to fall outside it, so 2.5 g/tsp is used, with
-- 3 tsp to the tbsp. That is an inference from a published range, not a
-- measurement, and it is the only figure in this system that is neither
-- calculated nor quoted.
--
-- So it is recorded as such. Every row written here sets raw_g_source to
-- 'estimated', which is what the Dishes screen reads to say "includes an
-- estimated spice weight" on the recipe. A weight nobody can trace must never
-- be indistinguishable from one anybody can.
--
-- WHAT IT COSTS TO BE WRONG
--
-- 147 ingredient rows across 130 recipes. Together they add 520 kcal to the
-- entire library — about 4.0 kcal per recipe. If every one of these estimates
-- were wrong by half, no chart would move by a calorie worth noticing.
--
-- Five rows are the exception, and they are exceptions because the spice IS the
-- dish: 2 tbsp of amchur in Pav bhaji masala, a tbsp of nigella in Panch
-- Phoron, custard powder in a custard. Those carry a real estimate on a real
-- quantity and are worth a dietitian's eye before the recipe is approved.
--
-- WHAT THIS DOES NOT TOUCH
--
-- Essences, food colourings, rose water, kewra water and silver foil — about a
-- hundred uses. Those have no food code at all, so a weight would not help
-- them: the recipe would still refuse on an ingredient the food table has never
-- heard of. Whether a colouring may be recorded as contributing nothing is a
-- different question from what a spoon of it weighs, and it is not answered
-- here.
--
-- Re-running is safe: only rows still at zero are touched.

alter table dish_items add column if not exists raw_g_source text;

do $$ begin
  alter table dish_items add constraint dish_items_raw_g_source_check
    check (raw_g_source is null or raw_g_source in ('published', 'estimated'));
exception when duplicate_object then null; end $$;

comment on column dish_items.raw_g_source is
  'Null means the weight came from a published table. ''estimated'' means it was inferred — currently only a ground spice at 2.5 g per teaspoon, the middle of USDA''s own range.';

-- The 21 seasonings this covers:
--   AJWAIN SEED WHOLE ORGANIC SPICES
--   Agar, dried
--   Asafoetida (Ferula assa-foetida)
--   Basil, dried, ground
--   CAJUN SEASONING, CAJUN
--   Cream of tartar
--   Curry powder
--   Custard powder
--   Drinking chocolate, powder
--   Garlic powder
--   MSG MONOSODIUM GLUTAMATE
--   Mace (Myristica fragrans)
--   Mixed herbs, dried
--   Paprika
--   Rosemary, dried
--   SIVA'S, AMHUR POWDER (DRY MANGO POWDER)
--   SWEET SUNNAH, WHOLE BLACK SEEDS NIGELLA SATIVA
--   Saffron
--   Salt
--   Spices, onion powder
--   Thyme, dried, ground

with spice (recipe, item, grams) as (values
  -- 0.5 tsp; adds 3.1 kcal to Classic italian pasta
  ('ASC130', 'Basil, dried, ground', 1.25::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Rainbow sandwich
  ('ASC030', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Pea potato sandwich (toasted) (Matar alo
  ('ASC041', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Paneer pea sandwich (toasted) (Paneer ma
  ('ASC042', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 0 kcal to Sesame toast
  ('ASC046', 'MSG MONOSODIUM GLUTAMATE', 0.63::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Potato parantha/paratha (Aloo ka paranth
  ('ASC098', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Radish parantha/paratha (Mooli ka parant
  ('ASC099', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Cauliflower parantha/paratha (Phoolgobhi
  ('ASC100', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Dal parantha/paratha
  ('ASC101', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Sprouted moong parantha/paratha
  ('ASC102', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Pea parantha/paratha (Matar ka parantha/
  ('ASC103', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Keema parantha/paratha
  ('ASC104', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Paneer parantha/paratha
  ('ASC105', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 1 tsp; adds 6 kcal to Makki ki roti
  ('ASC150', 'AJWAIN SEED WHOLE ORGANIC SPICES', 2.5::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Tandoori chicken
  ('ASC241', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.31::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Fried fish (Indian style) (Tali hui mach
  ('ASC247', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.31::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Fried fish (Indian style) (Tali hui mach
  ('ASC247', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.31::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Potato samosa (Aloo ka samosa)
  ('ASC361', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Mathri
  ('ASC364', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Khasta kachori
  ('ASC365', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Vegetable cutlet
  ('ASC366', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Peanut cutlet (Mungfali ke cutlet)
  ('ASC368', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Paneer potato cutlet (Paneer aloo cutlet
  ('ASC370', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Spinach chickpeas cutlet (Palak channa d
  ('ASC371', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Vegetable seekh kebab
  ('ASC377', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Peanut sago vada (Sabudana mungfali vada
  ('ASC379', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.125 tsp; adds 0 kcal to Spring roll
  ('ASC383', 'MSG MONOSODIUM GLUTAMATE', 0.31::numeric),
  -- 2 tsp; adds 17.7 kcal to Custard tart
  ('ASC395', 'Custard powder', 5::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Sweet and salty biscuit (Meethay aur nam
  ('ASC444', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.125 tsp; adds 1.1 kcal to Soyabean muthias
  ('ASC456', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.31::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Soyabean tikki
  ('ASC457', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Gram flour and semolina chilla/cheela/sa
  ('ASC461', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.125 tsp; adds 1 kcal to Peas kachori (Matar kachori)
  ('BFP118', 'Asafoetida (Ferula assa-foetida)', 0.31::numeric),
  -- 0.25 tsp; adds 2 kcal to Semolina burfi (Suji/Rava burfi)
  ('BFP401', 'Saffron', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Masala onion pakora/pakoda (Pyaaz ke pak
  ('BFP415', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Masala green chilli pakora/pakoda (Hari 
  ('BFP416', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Chicken pakora/pakoda
  ('BFP420', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Chicken pakora/pakoda
  ('BFP420', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Fish pakora/pakoda
  ('BFP421', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Fish pakora/pakoda
  ('BFP421', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Vegetable samosa
  ('BFP431', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Dessicated coconut chutney (Sookhe kase 
  ('BFP450', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Spicy chutney sandwich
  ('BFP460', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.5 pinch; adds 0 kcal to Cream buns
  ('BFP534', 'Salt', 0.31::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Poshtik namak paras
  ('BFP568', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.125 tsp; adds 1 kcal to Tamarind chutney (Chintapandu pachadi/Pu
  ('OSR096', 'Asafoetida (Ferula assa-foetida)', 0.31::numeric),
  -- 2 tbsp; adds 54 kcal to Pav bhaji masala
  ('OSR097', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 15::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Mustard seeds baghar (Mustard seed tadka
  ('BFP169', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 1 tbsp; adds 30 kcal to Bengal 5 Spice Blend (Panch Phoran)
  ('OSR082', 'SWEET SUNNAH, WHOLE BLACK SEEDS NIGELLA SATIVA', 7.5::numeric),
  -- 0.25 tsp; adds 2.4 kcal to Espreso coffee
  ('ASC003', 'Drinking chocolate, powder', 0.63::numeric),
  -- 0.25 tsp; adds 0 kcal to Hot and sour soup
  ('ASC092', 'MSG MONOSODIUM GLUTAMATE', 0.63::numeric),
  -- 0.125 tsp; adds 0 kcal to Talaumein soup
  ('ASC093', 'MSG MONOSODIUM GLUTAMATE', 0.31::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Curd rice (Dahi bhaat/Dahi chawal/ Perug
  ('ASC126', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Tamarind rice (Chintapandu pulihora/Puli
  ('ASC127', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Besan kadhi with pakodies
  ('ASC168', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Khatta channa
  ('ASC169', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.125 tsp; adds 1.1 kcal to Stuffed okra (Bharwa bhindi)
  ('ASC184', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.31::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Stuffed capsicum (Bharwa shimla mirch)
  ('ASC186', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Stuffed brinjal (Bharwa baingan)
  ('ASC187', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Baked brinjal in tomato sauce
  ('ASC213', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Al yakhani
  ('ASC220', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 0 kcal to Chilli paneer
  ('ASC224', 'MSG MONOSODIUM GLUTAMATE', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Mutton yakhni
  ('ASC232', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Chicken yakhni
  ('ASC233', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 1 tsp; adds 6 kcal to Tandoori fish
  ('ASC252', 'AJWAIN SEED WHOLE ORGANIC SPICES', 2.5::numeric),
  -- 1.5 tsp; adds 13.3 kcal to Triffle pudding
  ('ASC319', 'Custard powder', 3.75::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Chenna murki
  ('ASC345', 'Cream of tartar', 0.31::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Onion pakora/pakoda (Pyaaz ke pakode)
  ('ASC352', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Cauliflower pakora/pakoda (Phoolgobhi ke
  ('ASC353', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Mixed vegetable pakora/pakoda
  ('ASC354', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Spinach pakora/pakoda (Palak pakoda)
  ('ASC355', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Methi pakora/pakoda (Methi ke pakode)
  ('ASC356', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Egg pakora/pakoda (Ande ke pakode)
  ('ASC357', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Bread pakora/pakoda
  ('ASC358', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Paneer pakora/pakoda
  ('ASC359', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Paneer pakora/pakoda
  ('ASC359', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Coconut chutney (Nariyal ki chutney)
  ('ASC386', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Chocolate chiffon cake
  ('ASC424', 'Cream of tartar', 0.63::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Soyabean namak paras
  ('ASC458', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.31::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Spinach peanut namak paras (Palak moongf
  ('ASC460', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Spinach peanut namak paras (Palak moongf
  ('ASC460', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.31::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Moong dal stuffed cheela/chilla (Moong d
  ('BFP046', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Paneer stuffed cheela/chilla
  ('BFP047', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Puffy omelette/omlet
  ('BFP055', 'Cream of tartar', 0.63::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Orange omelette/omlet
  ('BFP056', 'Cream of tartar', 0.63::numeric),
  -- 0.5 tsp; adds 2.9 kcal to Mulligatawny soup
  ('BFP076', 'Curry powder', 1.25::numeric),
  -- 0.17 tsp; adds 1.4 kcal to Eggplant/Brinjal rice (Vangi bhat)
  ('BFP132', 'Asafoetida (Ferula assa-foetida)', 0.43::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Onion-green chilli parantha/paratha (Pya
  ('BFP108', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Rasam with tamarind (Puli rasam/ Chintap
  ('BFP176', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Rasam with lemon (Nimmakaya rasam/Nimmak
  ('BFP177', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Besan gatte curry
  ('BFP187', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.2 kcal to Besan gatte curry
  ('BFP187', 'Mace (Myristica fragrans)', 0.63::numeric),
  -- 0.125 tsp; adds 1 kcal to Vegetable yakhni
  ('BFP207', 'Asafoetida (Ferula assa-foetida)', 0.31::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Masala arbi
  ('BFP264', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.125 tsp; adds 1.1 kcal to Crispy okra/Crispy lady's fingers (Karar
  ('BFP270', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.31::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Crispy okra/Crispy lady's fingers (Karar
  ('BFP270', 'AJWAIN SEED WHOLE ORGANIC SPICES', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Stuffed bittergourd (wet) (Bharwa karele
  ('BFP273', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.125 tsp; adds 0.7 kcal to Chicken and tomato towers
  ('BFP305', 'Curry powder', 0.31::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Gun powder chutney
  ('BFP448', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Curd mint dip
  ('BFP451', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2.3 kcal to Stuffed bittergourd (dry) (Bharwa karela
  ('BFP604', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.63::numeric),
  -- 0.25 tsp; adds 2 kcal to Coconut kheer (Nariyal ki kheer)
  ('OSR012', 'Saffron', 0.63::numeric),
  -- 1 tbsp; adds 26.6 kcal to Mango vanilla custard
  ('OSR017', 'Custard powder', 7.5::numeric),
  -- 0.05 tsp; adds 0.4 kcal to Sweetened yogurt (Shrikhand)
  ('OSR024', 'Saffron', 0.13::numeric),
  -- 0.5 tsp; adds 4.1 kcal to Gooseberry pickle (Amla ka achaar)
  ('OSR049', 'Asafoetida (Ferula assa-foetida)', 1.25::numeric),
  -- 0.5 tsp; adds 4.1 kcal to Coconut pickle (Nariyal ka aachar)
  ('OSR059', 'Asafoetida (Ferula assa-foetida)', 1.25::numeric),
  -- 2 tsp; adds 15.5 kcal to Mango murabba candy
  ('OSR061', 'Saffron', 5::numeric),
  -- 0.5 tbsp; adds 0 kcal to Fish orly
  ('OSR063', 'Paprika', 3.75::numeric),
  -- 1 tsp; adds 9 kcal to Hariyali Fish Tikka
  ('OSR064', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 2.5::numeric),
  -- 0.5 tsp; adds 4.1 kcal to Lemon chicken
  ('OSR067', 'Rosemary, dried', 1.25::numeric),
  -- 1 tsp; adds 6.9 kcal to Lemon chicken
  ('OSR067', 'Thyme, dried, ground', 2.5::numeric),
  -- 1 tsp; adds 6.2 kcal to Lemon butter fish
  ('OSR068', 'Garlic powder', 2.5::numeric),
  -- 1 tsp; adds 0 kcal to Lemon butter fish
  ('OSR068', 'Paprika', 2.5::numeric),
  -- 1 tsp; adds 8.5 kcal to Lemon butter fish
  ('OSR068', 'Spices, onion powder', 2.5::numeric),
  -- 2 tbsp; adds 0 kcal to Cajun chicken
  ('OSR073', 'CAJUN SEASONING, CAJUN', 15::numeric),
  -- 0.25 tsp; adds 1.5 kcal to Roasted cauliflower steak
  ('OSR078', 'Garlic powder', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Garlic chutney/Poondu chutney (Lahasun k
  ('OSR080', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.125 tsp; adds 0.8 kcal to Macaroni salad
  ('OSR087', 'Garlic powder', 0.31::numeric),
  -- 1 tsp; adds 6.3 kcal to Spinach and paneer souffle
  ('OSR093', 'Basil, dried, ground', 2.5::numeric),
  -- 0.5 tsp; adds 3 kcal to Gram flour chilla/cheela (Besan chilla/c
  ('OSR100', 'AJWAIN SEED WHOLE ORGANIC SPICES', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Vegetable namkeen jave
  ('OSR101', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Quinoa khichdi/khichri
  ('OSR107', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Khakhra chaat
  ('OSR108', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Khakhra chaat
  ('OSR108', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tbsp; adds 6.7 kcal to Pav bhaji
  ('OSR112', 'Mace (Myristica fragrans)', 1.88::numeric),
  -- 0.5 tbsp; adds 13.5 kcal to Pav bhaji
  ('OSR112', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 3.75::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Rice murukku
  ('OSR113', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.5 tsp; adds 3 kcal to Rice murukku
  ('OSR113', 'AJWAIN SEED WHOLE ORGANIC SPICES', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Bhel puri
  ('OSR114', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.62 tsp; adds 5.6 kcal to Bhel puri
  ('OSR114', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.55::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Semolina dhokla (Suji/Rava dhokla)
  ('OSR115', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Spicy corn chaat
  ('OSR116', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 3.25 tsp; adds 1.3 kcal to Mango cheesecake
  ('OSR121', 'Agar, dried', 8.13::numeric),
  -- 0.75 tsp; adds 4.9 kcal to Bottle gourd soup (Ghiya/Lauki soup)
  ('OSR130', 'Mixed herbs, dried', 1.88::numeric),
  -- 2 tsp; adds 11.7 kcal to Curried Cauliflower soup
  ('OSR135', 'Curry powder', 5::numeric),
  -- 0.5 tsp; adds 5 kcal to Curried Cauliflower soup
  ('OSR135', 'SWEET SUNNAH, WHOLE BLACK SEEDS NIGELLA SATIVA', 1.25::numeric),
  -- 0.2 tbsp; adds 6 kcal to Dalma
  ('OSR141', 'SWEET SUNNAH, WHOLE BLACK SEEDS NIGELLA SATIVA', 1.5::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Split bengal gram dal (Channa dal)
  ('OSR142', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.5 tsp; adds 4.5 kcal to Split bengal gram dal (Channa dal)
  ('OSR142', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Horsegram dal (Kulthi dal)
  ('OSR143', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Dal dhokli
  ('OSR145', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.5 tsp; adds 3 kcal to Dal dhokli
  ('OSR145', 'AJWAIN SEED WHOLE ORGANIC SPICES', 1.25::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Gujarati handvo
  ('OSR146', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Sev (Omapodi/Karapusa)
  ('OSR147', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric),
  -- 0.2 tsp; adds 1.8 kcal to Bread roll
  ('OSR152', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.5::numeric),
  -- 0.2 tsp; adds 1.8 kcal to Soya seekh kebab
  ('OSR153', 'SIVA''S, AMHUR POWDER (DRY MANGO POWDER)', 0.5::numeric),
  -- 0.25 tsp; adds 2.1 kcal to Maa chaane ki dal
  ('OSR155', 'Asafoetida (Ferula assa-foetida)', 0.63::numeric)
)
update dish_items di
   set raw_g        = sp.grams,
       raw_g_source = 'estimated'
  from spice sp
  join dishes d on d.source = 'INDB ' || sp.recipe
 where di.dish_id = d.id
   and di.name    = sp.item
   and coalesce(di.raw_g, 0) = 0;
