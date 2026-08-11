-- A pan of frying oil is not an ingredient.
--
-- THE PROBLEM, IN ONE RECIPE
--
--   Peanut cutlet, INDB ASC368
--     Oil, sunflower   441.6 g  = 3,970 kcal
--     Ground nut        50.0 g  =   260 kcal
--     Potato           100.0 g  =    70 kcal
--   which made one cutlet 2,195 kcal.
--
-- 441.6 g is two cups. It is what you fill the pan with, not what you eat. The
-- cutlet absorbs a fraction and the rest goes back in the bottle.
--
-- This is not a mistake anybody made here. INDB's own Units.xlsx lists three
-- separate oil quantities — "Tempering: 2 tbsp", "Greasing: 2 tbsp" and
-- "Frying: 2 cups" — and only the first two describe something eaten. The
-- import could not tell them apart because by the time it saw the recipe they
-- were all just grams. The pan-sized amounts are unmistakable though: 441.6 g
-- appears 62 times, 220.8 g 35 times, 436 g 27 times. Nothing else lands on those numbers.
--
-- Nor is it caught by comparing against the source: INDB publishes 2,368 kcal
-- for that same cutlet. Both figures are absurd and they agree with each other,
-- which is exactly why an absolute "nobody eats this at a sitting" check had to
-- exist alongside the disagreement one.
--
-- WHAT IS WRITTEN INSTEAD, AND HOW FIRM IT IS
--
-- The frying literature puts oil uptake at 10-20% of a fried food's COOKED
-- weight. This applies 10% of the weight of the recipe's other ingredients,
-- which is the conservative end twice over: it is the bottom of the published
-- band, and it is applied to raw weight, which is heavier than cooked because
-- frying drives off water. 10% of raw lands around 12-15% of cooked — the
-- middle of the range — while never overstating.
--
-- It is an ESTIMATE and is recorded as one. Every row gets raw_g_source =
-- 'estimated' and a note, so the Dishes screen says so on the recipe. Nobody
-- should be able to read these figures and think somebody weighed the oil off
-- a cutlet.
--
-- WHAT IT LOOKS LIKE AFTERWARDS
--
--   1 poori    506 -> 99 kcal        1 samosa   757 -> 151 kcal
--   1 pakora   425 -> 47 kcal        1 cutlet  2195 -> 300 kcal
--   1 vada    1064 -> 119 kcal       1 plate   4208 -> 415 kcal (onion pakoda)
--
-- Every one lands where anyone who has eaten these would put them, and not one
-- of the 126 recipes is left above 1,200 kcal a serving.
--
-- THE LIMITATION, STATED PLAINLY
--
-- The 10% is taken against every other ingredient, and we cannot tell which of
-- them actually went in the pan. Dahi vada is fried and then sat in curd; the
-- curd is counted in the weight the absorption is worked out from, so its oil
-- is a little overstated. Splitting a recipe into what is fried and what is not
-- is not something the data supports, and inventing that split would be a
-- bigger guess than the one being made here.
--
-- Re-running is safe: only the pan-sized amounts are matched, and once a row
-- has been corrected it no longer looks like one.

-- ---------------------------------------------------------------------------
-- FIRST: retire the source's own figures for these recipes.
--
-- This has to happen, and it has to happen here, or the correction below makes
-- things worse rather than better.
--
-- lib/dish-pricing.ts holds a deliberate rule: where our sum disagrees with the
-- source's published figure by more than 25%, we distrust OURS and keep THEIRS.
-- It was written for exactly this situation and it was right — a poori
-- computing to 4,264 kcal against a published 921 is arithmetic that is
-- perfectly correct about the wrong quantity.
--
-- But it inverts the moment the quantity is fixed. Correct the oil and our
-- cutlet becomes 300 kcal against INDB's 2,368; the rule would then throw away
-- the right answer and display the pan-inclusive one. The second opinion has to
-- be retired at the same moment it stops being one.
--
-- The published figures are not deleted. They stay on the row as the citation
-- they are, with a line saying why they are no longer used, so anyone comparing
-- this library against INDB can see precisely where and why the two part.
-- ---------------------------------------------------------------------------

alter table dishes add column if not exists source_superseded text;

comment on column dishes.source_superseded is
  'Why the source''s own per-serving figures are no longer a valid second opinion for this recipe. Non-null means: do not compare our sums against them, and never fall back to them.';

with absorbed (recipe, seq, grams) as (values
  -- Bathua poori: 220.8 g in the pan -> 17 g absorbed (506 -> 99 kcal a serving)
  ('BFP114', 3, 17::numeric),
  -- Fermented bengal gram vada (Khameerikrit/Ufn: 220.8 g in the pan -> 12.2 g absorbed (549 -> 81 kcal a serving)
  ('BFP566', 4, 12.2::numeric),
  -- Flattened rice cutlet (Chirwa cutlet/Chivda : 441.6 g in the pan -> 18.4 g absorbed (2151 -> 249 kcal a serving)
  ('ASC367', 9, 18.4::numeric),
  -- Masala green chilli pakora/pakoda (Hari mirc: 220.8 g in the pan -> 10.6 g absorbed (425 -> 47 kcal a serving)
  ('BFP416', 8, 10.6::numeric),
  -- Peas kachori (Matar kachori): 220.8 g in the pan -> 19.5 g absorbed (591 -> 139 kcal a serving)
  ('BFP118', 8, 19.5::numeric),
  -- Peanut cutlet (Mungfali ke cutlet): 441.6 g in the pan -> 20 g absorbed (2195 -> 300 kcal a serving)
  ('ASC368', 9, 20::numeric),
  -- Potato samosa (Aloo ka samosa): 441.6 g in the pan -> 37 g absorbed (757 -> 151 kcal a serving)
  ('ASC361', 9, 37::numeric),
  -- Vegetable seekh kebab: 441.6 g in the pan -> 18.1 g absorbed (1050 -> 98 kcal a serving)
  ('ASC377', 8, 18.1::numeric),
  -- Poshtik namak paras: 220.8 g in the pan -> 27.7 g absorbed (75 -> 31 kcal a serving)
  ('BFP568', 5, 27.7::numeric),
  -- Gram flour and semolina chilla/cheela/savory: 436 g in the pan -> 12.4 g absorbed (1043 -> 91 kcal a serving)
  ('ASC461', 4, 12.4::numeric),
  -- Paneer potato cutlet (Paneer aloo cutlet): 441.6 g in the pan -> 20.8 g absorbed (2137 -> 246 kcal a serving)
  ('ASC370', 7, 20.8::numeric),
  -- Soyabean muthias: 436 g in the pan -> 5.9 g absorbed (1028 -> 61 kcal a serving)
  ('ASC456', 5, 5.9::numeric),
  -- Chicken pakora/pakoda: 220.8 g in the pan -> 17.7 g absorbed (376 -> 72 kcal a serving)
  ('BFP420', 9, 17.7::numeric),
  -- Chicken kebab: 436 g in the pan -> 14.5 g absorbed (825 -> 67 kcal a serving)
  ('ASC243', 6, 14.5::numeric),
  -- Paneer and pea samosa (Paneer matar ka samos: 441.6 g in the pan -> 33.3 g absorbed (785 -> 174 kcal a serving)
  ('ASC363', 7, 33.3::numeric),
  -- Sesame toast: 220.8 g in the pan -> 25.1 g absorbed (283 -> 63 kcal a serving)
  ('ASC046', 8, 25.1::numeric),
  -- Scotch egg: 441.6 g in the pan -> 20.6 g absorbed (2143 -> 251 kcal a serving)
  ('ASC238', 14, 20.6::numeric),
  -- Dahi vadas/Dahi bhalla: 441.6 g in the pan -> 21.1 g absorbed (1064 -> 119 kcal a serving)
  ('ASC279', 6, 21.1::numeric),
  -- Vegetable cutlet: 441.6 g in the pan -> 19.7 g absorbed (2075 -> 178 kcal a serving)
  ('ASC366', 11, 19.7::numeric),
  -- Fried fish (Indian style) (Tali hui machli): 441.6 g in the pan -> 22.2 g absorbed (2154 -> 269 kcal a serving)
  ('ASC247', 11, 22.2::numeric),
  -- Khasta kachori: 441.6 g in the pan -> 22.9 g absorbed (670 -> 132 kcal a serving)
  ('ASC365', 7, 22.9::numeric),
  -- Spinach poori (Palak poori): 441.6 g in the pan -> 19.6 g absorbed (855 -> 96 kcal a serving)
  ('ASC108', 3, 19.6::numeric),
  -- Shammi kebab: 436 g in the pan -> 20.6 g absorbed (1075 -> 141 kcal a serving)
  ('ASC237', 11, 20.6::numeric),
  -- Potato bonda (Aloo bonda): 441.6 g in the pan -> 23.9 g absorbed (1047 -> 108 kcal a serving)
  ('ASC360', 16, 23.9::numeric),
  -- Mathri: 441.6 g in the pan -> 13.3 g absorbed (653 -> 103 kcal a serving)
  ('ASC364', 2, 13.3::numeric),
  -- Mal pua: 441.6 g in the pan -> 42.5 g absorbed (791 -> 193 kcal a serving)
  ('ASC349', 6, 42.5::numeric),
  -- Spinach chickpeas cutlet (Palak channa dal c: 441.6 g in the pan -> 17.8 g absorbed (2083 -> 178 kcal a serving)
  ('ASC371', 8, 17.8::numeric),
  -- Soyabean tikki: 436 g in the pan -> 18.5 g absorbed (1058 -> 119 kcal a serving)
  ('ASC457', 5, 18.5::numeric),
  -- Peanut sago vada (Sabudana mungfali vada): 441.6 g in the pan -> 13.4 g absorbed (2119 -> 194 kcal a serving)
  ('ASC379', 7, 13.4::numeric),
  -- Sweet poori (Meethi poori): 436 g in the pan -> 13 g absorbed (1095 -> 144 kcal a serving)
  ('ASC464', 4, 13::numeric),
  -- Beetroot poori (Chukandar ki poori): 220.8 g in the pan -> 22.4 g absorbed (505 -> 109 kcal a serving)
  ('BFP116', 3, 22.4::numeric),
  -- Spring roll: 441.6 g in the pan -> 27.5 g absorbed (545 -> 79 kcal a serving)
  ('ASC383', 12, 27.5::numeric),
  -- Semolina carrot vada (Suji gajar vada): 436 g in the pan -> 17.3 g absorbed (1040 -> 99 kcal a serving)
  ('ASC473', 3, 17.3::numeric),
  -- Vegetarian nargisi kofta curry: 220.8 g in the pan -> 56.2 g absorbed (1240 -> 500 kcal a serving)
  ('BFP210', 21, 56.2::numeric),
  -- Masala onion pakora/pakoda (Pyaaz ke pakode): 220.8 g in the pan -> 18.6 g absorbed (361 -> 58 kcal a serving)
  ('BFP415', 8, 18.6::numeric),
  -- Mutton chops: 441.6 g in the pan -> 22.8 g absorbed (2145 -> 262 kcal a serving)
  ('ASC236', 9, 22.8::numeric),
  -- Fish pakora/pakoda: 220.8 g in the pan -> 17.7 g absorbed (367 -> 63 kcal a serving)
  ('BFP421', 9, 17.7::numeric),
  -- Poshtik cutlet: 220.8 g in the pan -> 24.3 g absorbed (1110 -> 227 kcal a serving)
  ('BFP427', 11, 24.3::numeric),
  -- Egg cutlet (Anda cutlet): 220.8 g in the pan -> 16.8 g absorbed (1083 -> 166 kcal a serving)
  ('BFP428', 9, 16.8::numeric),
  -- Minced meat cutlet: 220.8 g in the pan -> 22.8 g absorbed (1155 -> 265 kcal a serving)
  ('BFP430', 8, 22.8::numeric),
  -- Dal stuffed poori: 441.6 g in the pan -> 11.6 g absorbed (864 -> 91 kcal a serving)
  ('ASC110', 6, 11.6::numeric),
  -- Paneer cutlet: 220.8 g in the pan -> 12.3 g absorbed (1130 -> 193 kcal a serving)
  ('BFP424', 9, 12.3::numeric),
  -- Vegetable samosa: 220.8 g in the pan -> 36.9 g absorbed (419 -> 143 kcal a serving)
  ('BFP431', 11, 36.9::numeric),
  -- Vegeterian scotch egg: 441.6 g in the pan -> 19 g absorbed (2105 -> 205 kcal a serving)
  ('ASC380', 10, 19::numeric),
  -- Potato aigrettes: 220.8 g in the pan -> 25.9 g absorbed (205 -> 59 kcal a serving)
  ('BFP539', 4, 25.9::numeric),
  -- Gunjia: 441.6 g in the pan -> 22.1 g absorbed (1080 -> 137 kcal a serving)
  ('ASC280', 6, 22.1::numeric),
  -- Kashmiri masala: 218 g in the pan -> 72 g absorbed
  ('BFP003', 13, 72::numeric),
  -- Gulab Jamun with khoya: 441.6 g in the pan -> 46 g absorbed (861 -> 268 kcal a serving)
  ('ASC348', 3, 46::numeric),
  -- Ghujia/Lavang latika: 441.6 g in the pan -> 15.9 g absorbed (761 -> 123 kcal a serving)
  ('ASC347', 4, 15.9::numeric),
  -- Chinese cabbage and meat ball soup: 441.6 g in the pan -> 45.4 g absorbed (2083 -> 302 kcal a serving)
  ('ASC090', 8, 45.4::numeric),
  -- Gulab jamun with milk powder: 220.8 g in the pan -> 36.4 g absorbed (1336 -> 507 kcal a serving)
  ('BFP386', 4, 36.4::numeric),
  -- Sago cutlet/vadas (Sabudana cutlet/vadas): 220.8 g in the pan -> 18.3 g absorbed (1092 -> 182 kcal a serving)
  ('BFP425', 8, 18.3::numeric),
  -- Bhatura: 441.6 g in the pan -> 10.2 g absorbed (1068 -> 99 kcal a serving)
  ('ASC143', 2, 10.2::numeric),
  -- Cheese toast: 441.6 g in the pan -> 10.1 g absorbed (1053 -> 83 kcal a serving)
  ('ASC372', 5, 10.1::numeric),
  -- Spaghetti and cheese balls in tomato sauce: 441.6 g in the pan -> 49.2 g absorbed (4580 -> 1052 kcal a serving)
  ('ASC137', 13, 49.2::numeric),
  -- Vegetarian egg kofta curry: 441.6 g in the pan -> 26.5 g absorbed (4306 -> 575 kcal a serving)
  ('ASC207', 16, 26.5::numeric),
  -- Besan kadhi with pakodies: 441.6 g in the pan -> 69.8 g absorbed (2196 -> 525 kcal a serving)
  ('ASC168', 16, 69.8::numeric),
  -- Cauliflower kofta curry (Phoolgobhi kofta cu: 441.6 g in the pan -> 23.3 g absorbed (4207 -> 447 kcal a serving)
  ('ASC203', 15, 23.3::numeric),
  -- Pea kofta curry (Matar kofta curry): 436 g in the pan -> 30.5 g absorbed (4256 -> 610 kcal a serving)
  ('ASC198', 14, 30.5::numeric),
  -- Ghiya/Lauki Kofta Curry: 441.6 g in the pan -> 23.5 g absorbed (4204 -> 445 kcal a serving)
  ('ASC205', 16, 23.5::numeric),
  -- Paneer kofta curry: 441.6 g in the pan -> 22.6 g absorbed (4360 -> 594 kcal a serving)
  ('ASC200', 14, 22.6::numeric),
  -- Lotus stem kofta curry (Kamal kakdi kofta cu: 441.6 g in the pan -> 25.6 g absorbed (4290 -> 551 kcal a serving)
  ('ASC201', 16, 25.6::numeric),
  -- Cabbage kofta curry (Pattagobhi kofta curry): 441.6 g in the pan -> 23.5 g absorbed (4212 -> 453 kcal a serving)
  ('ASC204', 16, 23.5::numeric),
  -- Spinach kofta curry (Palak kofta curry): 441.6 g in the pan -> 33.1 g absorbed (4268 -> 595 kcal a serving)
  ('ASC199', 16, 33.1::numeric),
  -- Raw banana kofta curry (Kela kofta curry): 441.6 g in the pan -> 25 g absorbed (4214 -> 469 kcal a serving)
  ('ASC202', 15, 25::numeric),
  -- Methi chaman: 441.6 g in the pan -> 53.4 g absorbed (4427 -> 937 kcal a serving)
  ('ASC216', 11, 53.4::numeric),
  -- Jackfruit sabzi (Kathal ki sabzi): 441.6 g in the pan -> 24.6 g absorbed (2091 -> 216 kcal a serving)
  ('ASC218', 12, 24.6::numeric),
  -- Tomato fish: 436 g in the pan -> 50.1 g absorbed (4354 -> 885 kcal a serving)
  ('ASC249', 13, 50.1::numeric),
  -- Chilli paneer: 441.6 g in the pan -> 10.9 g absorbed (2139 -> 203 kcal a serving)
  ('ASC224', 10, 10.9::numeric),
  -- Dum aloo: 441.6 g in the pan -> 19.7 g absorbed (4231 -> 438 kcal a serving)
  ('ASC214', 18, 19.7::numeric),
  -- Boondi raita: 441.6 g in the pan -> 18.1 g absorbed (2089 -> 186 kcal a serving)
  ('ASC277', 5, 18.1::numeric),
  -- Gram flour poori (Besan poori): 220.8 g in the pan -> 10 g absorbed (487 -> 66 kcal a serving)
  ('BFP115', 2, 10::numeric),
  -- Methi poori: 441.6 g in the pan -> 17.1 g absorbed (855 -> 91 kcal a serving)
  ('ASC109', 3, 17.1::numeric),
  -- Onion tomato uttapam: 220.8 g in the pan -> 32.4 g absorbed (605 -> 181 kcal a serving)
  ('ASC148', 7, 32.4::numeric),
  -- Rice moong dal cheela (Chawal aur moong dal : 436 g in the pan -> 10.7 g absorbed (1065 -> 109 kcal a serving)
  ('ASC462', 3, 10.7::numeric),
  -- Cauliflower pakora/pakoda (Phoolgobhi ke pak: 441.6 g in the pan -> 19.7 g absorbed (4187 -> 395 kcal a serving)
  ('ASC353', 5, 19.7::numeric),
  -- Onion pakora/pakoda (Pyaaz ke pakode): 441.6 g in the pan -> 19.7 g absorbed (4208 -> 415 kcal a serving)
  ('ASC352', 5, 19.7::numeric),
  -- Spinach pakora/pakoda (Palak pakoda): 441.6 g in the pan -> 15.7 g absorbed (4179 -> 350 kcal a serving)
  ('ASC355', 5, 15.7::numeric),
  -- Bread pakora/pakoda: 441.6 g in the pan -> 17.7 g absorbed (4311 -> 500 kcal a serving)
  ('ASC358', 5, 17.7::numeric),
  -- Fried fish and Chips (English Style) (Tali h: 441.6 g in the pan -> 22 g absorbed (4202 -> 430 kcal a serving)
  ('ASC248', 10, 22::numeric),
  -- Paneer pulao: 436 g in the pan -> 36.1 g absorbed (4481 -> 886 kcal a serving)
  ('ASC118', 9, 36.1::numeric),
  -- Vegetable burger: 441.6 g in the pan -> 53 g absorbed (2487 -> 740 kcal a serving)
  ('ASC375', 12, 53::numeric),
  -- Indian lamb and egg curry (Nargisi kofta): 220.8 g in the pan -> 54.4 g absorbed (1227 -> 479 kcal a serving)
  ('BFP201', 20, 54.4::numeric),
  -- Paneer pakora/pakoda: 441.6 g in the pan -> 17.2 g absorbed (4302 -> 487 kcal a serving)
  ('ASC359', 7, 17.2::numeric),
  -- Egg pakora/pakoda (Ande ke pakode): 441.6 g in the pan -> 16.7 g absorbed (4237 -> 417 kcal a serving)
  ('ASC357', 5, 16.7::numeric),
  -- Methi pakora/pakoda (Methi ke pakode): 441.6 g in the pan -> 15.7 g absorbed (4183 -> 354 kcal a serving)
  ('ASC356', 5, 15.7::numeric),
  -- Mixed vegetable pakora/pakoda: 441.6 g in the pan -> 19.7 g absorbed (4202 -> 409 kcal a serving)
  ('ASC354', 8, 19.7::numeric),
  -- Soyabean namak paras: 436 g in the pan -> 7 g absorbed (2100 -> 172 kcal a serving)
  ('ASC458', 3, 7::numeric),
  -- Spinach peanut namak paras (Palak moongfali : 436 g in the pan -> 15.5 g absorbed (2142 -> 252 kcal a serving)
  ('ASC460', 4, 15.5::numeric),
  -- Shahi keema kofta curry: 220.8 g in the pan -> 38.2 g absorbed (2418 -> 777 kcal a serving)
  ('BFP196', 23, 38.2::numeric),
  -- Fish finger: 220.8 g in the pan -> 20.5 g absorbed (2236 -> 435 kcal a serving)
  ('BFP226', 7, 20.5::numeric),
  -- Vegetable yakhni: 220.8 g in the pan -> 33.6 g absorbed (2167 -> 484 kcal a serving)
  ('BFP207', 11, 33.6::numeric),
  -- Soya chunks sweet and sour (Nutrinugget swee: 220.8 g in the pan -> 21.6 g absorbed (2117 -> 326 kcal a serving)
  ('BFP203', 12, 21.6::numeric),
  -- Paneer makhana korma: 441.6 g in the pan -> 13.1 g absorbed (4372 -> 520 kcal a serving)
  ('ASC225', 8, 13.1::numeric),
  -- Chicken sweet and sour: 218 g in the pan -> 31.6 g absorbed (2279 -> 604 kcal a serving)
  ('BFP221', 11, 31.6::numeric),
  -- Yam fried (Zimikand/Suran fried): 220.8 g in the pan -> 24.5 g absorbed (2205 -> 441 kcal a serving)
  ('BFP275', 11, 24.5::numeric),
  -- Potato kofta curry (Aloo kofta curry): 436 g in the pan -> 54 g absorbed (4250 -> 815 kcal a serving)
  ('BFP246', 24, 54::numeric),
  -- Jackfruit/Kathal (dry): 220.8 g in the pan -> 24.5 g absorbed (2192 -> 427 kcal a serving)
  ('BFP274', 11, 24.5::numeric),
  -- Creamed spinach and mushroom: 218 g in the pan -> 35.9 g absorbed (2305 -> 668 kcal a serving)
  ('BFP291', 8, 35.9::numeric),
  -- Crispy okra/Crispy lady's fingers (Karare bh: 220.8 g in the pan -> 10.4 g absorbed (2082 -> 191 kcal a serving)
  ('BFP270', 6, 10.4::numeric),
  -- Yam kofta curry (Zimikand/Suran kofta curry): 220.8 g in the pan -> 51.2 g absorbed (2250 -> 726 kcal a serving)
  ('BFP249', 18, 51.2::numeric),
  -- Minced meat samosa (Keema ka samosa): 441.6 g in the pan -> 33.3 g absorbed (781 -> 169 kcal a serving)
  ('ASC362', 5, 33.3::numeric),
  -- Peas poori (Matar ki poori): 220.8 g in the pan -> 18 g absorbed (462 -> 98 kcal a serving)
  ('BFP117', 3, 18::numeric),
  -- Jackfruit kofta curry (Kathal ka kofta curry: 220.8 g in the pan -> 51.2 g absorbed (2237 -> 712 kcal a serving)
  ('BFP250', 18, 51.2::numeric),
  -- Plain urad dal vada (Uzunne vada/Minapa gare: 220.8 g in the pan -> 7.7 g absorbed (545 -> 66 kcal a serving)
  ('BFP436', 1, 7.7::numeric),
  -- Masala urad dal vada: 220.8 g in the pan -> 10.3 g absorbed (559 -> 86 kcal a serving)
  ('BFP437', 5, 10.3::numeric),
  -- Pearl millet mathri (Bajra mathri): 220.8 g in the pan -> 6.1 g absorbed (1092 -> 127 kcal a serving)
  ('BFP564', 2, 6.1::numeric),
  -- Spinach paneer kofta curry (Palak paneer kof: 441.6 g in the pan -> 28.7 g absorbed (4278 -> 566 kcal a serving)
  ('ASC206', 16, 28.7::numeric),
  -- Gobi 65: 436 g in the pan -> 123.4 g absorbed (2197 -> 792 kcal a serving)
  ('OSR076', 21, 123.4::numeric),
  -- Poori: 441.6 g in the pan -> 14.6 g absorbed (853 -> 85 kcal a serving)
  ('ASC107', 1, 14.6::numeric),
  -- Cabbage manchurian (Pattagobhi manchurian): 441.6 g in the pan -> 173.9 g absorbed (1548 -> 746 kcal a serving)
  ('OSR075', 14, 173.9::numeric),
  -- Banana chips (Kele ke chips): 436 g in the pan -> 20.5 g absorbed (1035 -> 101 kcal a serving)
  ('OSR119', 1, 20.5::numeric),
  -- Banana appam: 436 g in the pan -> 68.3 g absorbed (1265 -> 439 kcal a serving)
  ('OSR110', 5, 68.3::numeric),
  -- Khakhra chaat: 436 g in the pan -> 113.5 g absorbed (2796 -> 1346 kcal a serving)
  ('OSR108', 36, 113.5::numeric),
  -- Veg manchurian: 436 g in the pan -> 29.3 g absorbed (1047 -> 133 kcal a serving)
  ('OSR111', 11, 29.3::numeric),
  -- Bhel puri: 436 g in the pan -> 51.5 g absorbed (3282 -> 978 kcal a serving)
  ('OSR114', 34, 51.5::numeric),
  -- Bhel puri: 436 g in the pan -> 51.5 g absorbed (3282 -> 978 kcal a serving)
  ('OSR114', 35, 51.5::numeric),
  -- Jackfruit fritters (Ponsa mulik/Kathal ka pa: 436 g in the pan -> 46 g absorbed (148 -> 48 kcal a serving)
  ('OSR118', 9, 46::numeric),
  -- Rice murukku: 436 g in the pan -> 60.9 g absorbed (173 -> 77 kcal a serving)
  ('OSR113', 5, 60.9::numeric),
  -- Spicy corn chaat: 436 g in the pan -> 64.9 g absorbed (2468 -> 800 kcal a serving)
  ('OSR116', 12, 64.9::numeric),
  -- Papdi: 436 g in the pan -> 21.6 g absorbed (1133 -> 202 kcal a serving)
  ('OSR148', 3, 21.6::numeric),
  -- Masala vada: 441.6 g in the pan -> 6.2 g absorbed (2056 -> 99 kcal a serving)
  ('ASC378', 6, 6.2::numeric),
  -- Sev (Omapodi/Karapusa): 436 g in the pan -> 34.5 g absorbed (769 -> 168 kcal a serving)
  ('OSR147', 6, 34.5::numeric),
  -- Bread roll: 436 g in the pan -> 72.2 g absorbed (488 -> 161 kcal a serving)
  ('OSR152', 9, 72.2::numeric),
  -- Fish cutlet (Machli ka cutlet): 441.6 g in the pan -> 22.8 g absorbed (2114 -> 232 kcal a serving)
  ('ASC369', 12, 22.8::numeric),
  -- Potato stuffed poori (Aloo ki poori): 441.6 g in the pan -> 11.8 g absorbed (857 -> 85 kcal a serving)
  ('ASC111', 4, 11.8::numeric),
  -- Cheese balls: 441.6 g in the pan -> 23.2 g absorbed (374 -> 61 kcal a serving)
  ('ASC409', 5, 23.2::numeric)
)
update dish_items di
   set raw_g        = a.grams,
       raw_g_source = 'estimated',
       note         = 'what the food absorbs, not the panful it was fried in'
  from absorbed a
  join dishes d on d.source = 'INDB ' || a.recipe
 where di.dish_id = d.id
   and di.seq     = a.seq
   and di.raw_g   > 200;

update dishes
   set source_superseded = 'The published figure counts the whole pan of frying oil as eaten. The ingredients here record what the food absorbs instead, so the two are no longer measuring the same thing.'
 where id in (
   select dish_id from dish_items
    where note = 'what the food absorbs, not the panful it was fried in'
 );

-- Proof on screen that it ran.
select count(*) as oil_rows_corrected
  from dish_items
 where note = 'what the food absorbs, not the panful it was fried in';
