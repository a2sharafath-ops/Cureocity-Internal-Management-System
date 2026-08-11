-- Two faults in the food table itself, found by asking whether each food's
-- calories agree with its own macros.
--
-- These matter more than anything upstream of them. A recipe is only as good as
-- the food rows it adds up, and both of these have been quietly wrong since the
-- library was imported.
--
-- ===========================================================================
-- A. SEVEN FOODS WITH NO CARBOHYDRATE, THAT ARE MOSTLY CARBOHYDRATE
-- ===========================================================================
--
-- 0138 says, correctly: "Carbohydrate and fibre are null for meat, fish, eggs
-- and oils, which contain neither; that is absence, not a missing reading."
--
-- The rule is right. It was applied too widely. Milk, paneer, khoa, jaggery,
-- toddy and coconut water were swept in with it, and every one of them has a
-- published carbohydrate figure in IFCT 2017:
--
--   Milk, whole, Cow   0 -> 4.94 g   in 248 recipes
--   Panner             0 -> 12.41 g  in 47 recipes
--   Jaggery, cane      0 -> 84.87 g  in 35 recipes
--   Khoa               0 -> 16.53 g  in 16 recipes
--
-- Jaggery is the one to look at twice. It is 85% carbohydrate and has been
-- contributing none. A cup of milk is about 12 g of lactose it has not been
-- counting either. On a diabetic client's chart those are not rounding errors,
-- and they are on 346 ingredient rows between them.
--
-- The values come from @ifct2017/compositions 2.0.9 (MIT) — the same source as
-- 0155, and the one that already agreed with all 528 of our energy and protein
-- figures to the decimal. Where it agrees everywhere else and differs here, the
-- difference is ours.
--
-- ===========================================================================
-- B. NINE FOODS WITH NO CALORIES AT ALL
-- ===========================================================================
--
-- UK CoFID records energy as "N" for these — not zero, NOT MEASURED. The import
-- read that as nothing and stored no energy, so chilli powder has been worth 0
-- kcal in 316 recipes while its own published protein, fat and fibre say
-- it cannot be less than 252 kcal per 100 g.
--
-- CoFID does publish the macros, so the energy is derived from them by Atwater:
-- 4 kcal a gram for protein and carbohydrate, 9 for fat, 2 for fibre. That is
-- the same arithmetic the app already uses to CHECK a figure, turned round to
-- supply one where the source measured everything except the total.
--
-- It is a floor rather than an exact figure — CoFID did not measure the
-- carbohydrate in these either, so anything that is neither protein, fat nor
-- fibre is missing from the sum. For a quarter teaspoon of chilli powder that
-- is a fraction of a calorie. Storing zero was the larger error by far.
--
-- The amounts are small and the effect on any one recipe is a few calories.
-- What it fixes is 47 recipes whose calories openly contradicted their own
-- macros on screen, which is corrosive in a different way: a reader who sees
-- the app disagree with itself stops trusting the figures that are right.
--
-- Re-running is safe.

-- ---------------------------------------------------------------------------
-- A. Restore what IFCT publishes.
-- ---------------------------------------------------------------------------

-- Milk, whole, Cow — used in 248 recipes
update foods set carb_g = 4.94 where food_code = 'L002';
-- Panner — used in 47 recipes
update foods set carb_g = 12.41 where food_code = 'L003';
-- Jaggery, cane (Saccharum officinarum) — used in 35 recipes
update foods set carb_g = 84.87 where food_code = 'I001';
-- Khoa — used in 16 recipes
update foods set carb_g = 16.53 where food_code = 'L004';
-- Toddy — used in 0 recipes
update foods set carb_g = 5.72 where food_code = 'K001';
-- Coconut Water — used in 0 recipes
update foods set carb_g = 3.16 where food_code = 'K002';
-- Milk, whole, Buffalo — used in 0 recipes
update foods set carb_g = 8.39 where food_code = 'L001';

-- ---------------------------------------------------------------------------
-- B. Derive an energy figure where the source measured everything but that.
--    Recorded on the row so nobody mistakes it for a published value.
-- ---------------------------------------------------------------------------

alter table foods add column if not exists kcal_derived boolean not null default false;

comment on column foods.kcal_derived is
  'True where the source did not measure energy and it was worked out from the published protein, fat and fibre by Atwater. A floor, not an exact figure.';

-- Chilli powder — 13.5p 14.3f 0c 34.8fib, used in 316 recipes
update foods set kcal = 252.3, kcal_derived = true where food_code = 'G516' and kcal is null;
-- Cinnamon, ground — 4p 1.2f 0c 53.1fib, used in 80 recipes
update foods set kcal = 133, kcal_derived = true where food_code = 'G518' and kcal is null;
-- Stock cubes, vegetable — 13.5p 17.3f 0c 1.8fib, used in 25 recipes
update foods set kcal = 213.3, kcal_derived = true where food_code = 'K507' and kcal is null;
-- Fennel seeds — 15.8p 14.9f 0c 0fib, used in 22 recipes
update foods set kcal = 197.3, kcal_derived = true where food_code = 'G510' and kcal is null;
-- Stock cubes, chicken — 15.4p 15.4f 0c 0.6fib, used in 15 recipes
update foods set kcal = 201.4, kcal_derived = true where food_code = 'K506' and kcal is null;
-- Pepper, white — 10.4p 2.1f 0c 26.2fib, used in 10 recipes
update foods set kcal = 112.9, kcal_derived = true where food_code = 'G527' and kcal is null;
-- Oregano, dried, ground — 9p 4.3f 0c 42.5fib, used in 9 recipes
update foods set kcal = 159.7, kcal_derived = true where food_code = 'G526' and kcal is null;
-- Mixed curry spices — 13.2p 13.3f 0c 0fib, used in 5 recipes
update foods set kcal = 172.5, kcal_derived = true where food_code = 'G515' and kcal is null;
-- Paprika — 14.1p 12.9f 0c 34.9fib, used in 2 recipes
update foods set kcal = 242.3, kcal_derived = true where food_code = 'G545' and kcal is null;

-- ---------------------------------------------------------------------------
-- C. A CUP OF STOCK IS NOT A CUP OF STOCK CUBES
--
-- Part B could not be applied to the two stock-cube rows without this one, and
-- checking why turned up a fault that was already doing damage.
--
-- "Stock cubes, vegetable" has a median recorded quantity of 240 g across 40
-- ingredient rows, and one recipe lists 1,200 g of them. Nobody has ever put
-- 1.2 kg of stock cubes in a millet soup. What the recipe means is 1.2 litres
-- of made-up stock.
--
-- The missing energy figure was accidentally hiding it — but the protein was
-- never missing, so a chicken consomme has been carrying 74 g of protein from
-- 484.8 g of "stock cube" for as long as the library has existed. That is why
-- the consommes sit under "more protein than a dish plausibly holds".
--
-- Every packet says one cube to 500 ml, so made-up stock is about 2 g of cube
-- per 100 g of liquid. That is the ratio applied here. Marked estimated and
-- noted on the row, exactly as the frying oil was in 0154.
-- ---------------------------------------------------------------------------

with stock (recipe, seq, grams) as (values
  -- Brown sauce: 240 g of stock -> 4.8 g of cube
  ('ASC078', 3, 4.8::numeric),
  -- Clear tomato soup (Tamatar ka soup): 120 g of stock -> 2.4 g of cube
  ('ASC079', 10, 2.4::numeric),
  -- Lentil soup: 240 g of stock -> 4.8 g of cube
  ('ASC080', 11, 4.8::numeric),
  -- Chicken consomme (Clear chicken soup): 120 g of stock -> 2.4 g of cube
  ('ASC081', 7, 2.4::numeric),
  -- Cream of tomato soup: 120 g of stock -> 2.4 g of cube
  ('ASC082', 12, 2.4::numeric),
  -- Egg drop soup: 240 g of stock -> 4.8 g of cube
  ('ASC089', 8, 4.8::numeric),
  -- Cream of green peas soup: 120 g of stock -> 2.4 g of cube
  ('ASC083', 13, 2.4::numeric),
  -- Cream of spinach soup: 120 g of stock -> 2.4 g of cube
  ('ASC084', 13, 2.4::numeric),
  -- Cream of mixed vegetable soup: 120 g of stock -> 2.4 g of cube
  ('ASC085', 13, 2.4::numeric),
  -- Cream of mushroom soup: 120 g of stock -> 2.4 g of cube
  ('ASC086', 13, 2.4::numeric),
  -- Chicken sweet corn soup: 360 g of stock -> 7.2 g of cube
  ('ASC087', 8, 7.2::numeric),
  -- Minestrone soup: 240 g of stock -> 4.8 g of cube
  ('ASC088', 11, 4.8::numeric),
  -- Chinese cabbage and meat ball soup: 240 g of stock -> 4.8 g of cube
  ('ASC090', 11, 4.8::numeric),
  -- French onion soup: 240 g of stock -> 4.8 g of cube
  ('ASC091', 7, 4.8::numeric),
  -- Talaumein soup: 240 g of stock -> 4.8 g of cube
  ('ASC093', 17, 4.8::numeric),
  -- Cold summer garden soup: 180 g of stock -> 3.6 g of cube
  ('ASC095', 10, 3.6::numeric),
  -- Meat consomme (with mutton): 484.8 g of stock -> 9.7 g of cube
  ('BFP065', 9, 9.7::numeric),
  -- Consomme au julienne: 484.8 g of stock -> 9.7 g of cube
  ('BFP066', 10, 9.7::numeric),
  -- Consomme au vermicelli: 484.8 g of stock -> 9.7 g of cube
  ('BFP067', 10, 9.7::numeric),
  -- Green pea soup (Matar ka soup): 363.6 g of stock -> 7.3 g of cube
  ('BFP072', 11, 7.3::numeric),
  -- Spinach soup (Palak ka soup): 363.6 g of stock -> 7.3 g of cube
  ('BFP073', 10, 7.3::numeric),
  -- Mixed vegetable soup: 242.4 g of stock -> 4.8 g of cube
  ('BFP074', 13, 4.8::numeric),
  -- Cheese soup: 363.6 g of stock -> 7.3 g of cube
  ('BFP075', 8, 7.3::numeric),
  -- Mulligatawny soup: 242.4 g of stock -> 4.8 g of cube
  ('BFP076', 11, 4.8::numeric),
  -- Cream of carrot soup: 242.4 g of stock -> 4.8 g of cube
  ('BFP079', 12, 4.8::numeric),
  -- Cream of broccoli soup: 242.4 g of stock -> 4.8 g of cube
  ('BFP080', 12, 4.8::numeric),
  -- Cream of potato soup: 242.4 g of stock -> 4.8 g of cube
  ('BFP082', 11, 4.8::numeric),
  -- Almond soup (Badam ka soup): 242.4 g of stock -> 4.8 g of cube
  ('BFP087', 11, 4.8::numeric),
  -- Minced meat pancake (with chicken): 121.2 g of stock -> 2.4 g of cube
  ('BFP127', 15, 2.4::numeric),
  -- Mutton pulao: 121.2 g of stock -> 2.4 g of cube
  ('BFP141', 31, 2.4::numeric),
  -- Chicken pulao: 121.2 g of stock -> 2.4 g of cube
  ('BFP142', 30, 2.4::numeric),
  -- Spaghetti bolognese: 120 g of stock -> 2.4 g of cube
  ('BFP155', 12, 2.4::numeric),
  -- Meat and macaroni casserole: 60 g of stock -> 1.2 g of cube
  ('BFP157', 15, 1.2::numeric),
  -- Soya chunks sweet and sour (Nutrinugget swee: 60.6 g of stock -> 1.2 g of cube
  ('BFP203', 17, 1.2::numeric),
  -- Chicken sweet and sour: 60.6 g of stock -> 1.2 g of cube
  ('BFP221', 17, 1.2::numeric),
  -- Savoury puffs: 75.75 g of stock -> 1.5 g of cube
  ('BFP535', 14, 1.5::numeric),
  -- Chicken manchurian: 120 g of stock -> 2.4 g of cube
  ('OSR065', 19, 2.4::numeric),
  -- Curried Cauliflower soup: 600 g of stock -> 12 g of cube
  ('OSR135', 14, 12::numeric),
  -- Millet soup: 1200 g of stock -> 24 g of cube
  ('OSR136', 17, 24::numeric),
  -- Classic seasoned black beans: 480 g of stock -> 9.6 g of cube
  ('OSR154', 6, 9.6::numeric)
)
update dish_items di
   set raw_g        = st.grams,
       raw_g_source = 'estimated',
       note         = 'the cube that made the stock, not the stock itself'
  from stock st
  join dishes d on d.source = 'INDB ' || st.recipe
 where di.dish_id = d.id
   and di.seq     = st.seq
   and di.raw_g   > 20;

-- Proof on screen.
select (select count(*) from foods where food_code in ('L002', 'L003', 'I001', 'L004', 'K001', 'K002', 'L001') and carb_g is not null) as carbohydrate_restored,
       (select count(*) from foods where kcal_derived) as energy_derived,
       (select carb_g from foods where food_code = 'I001') as jaggery_carb_g,
       (select carb_g from foods where food_code = 'L002') as milk_carb_g,
       (select round(kcal) from foods where food_code = 'G516') as chilli_powder_kcal;
