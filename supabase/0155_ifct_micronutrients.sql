-- The other 22 nutrients IFCT 2017 publishes for every one of its 528 foods.
--
-- WHY NOW
--
-- The clinic's brief, section 4: "Ensure coverage of all required vitamins and
-- minerals. All values derived from latest ICMR-IFCT." Section 5 names four by
-- name — calcium and iron against thyroxine, sodium and potassium on diuretics.
-- Until this file the food table held five figures per food (energy, protein,
-- fat, carbohydrate, fibre) and the chart's Key Micronutrients column was a
-- free-text box somebody typed from memory. That is the one thing this whole
-- layer exists to replace, sitting in the middle of it.
--
-- WHERE THE VALUES COME FROM
--
-- @ifct2017/compositions on npm, version 2.0.9, MIT licensed — the IFCT 2017
-- organisation's own machine-readable release of the published tables. 542
-- foods, 421 columns.
--
-- It was checked against what was already here before a single value was taken
-- from it: all 528 food codes match ours exactly, and all 528 agree to the
-- decimal on energy and protein with the figures imported in 0138 from the
-- book. An independent transcription of the same tables landing on the same
-- numbers is about as good as verification gets without re-typing the book.
--
-- UNITS, WHICH ARE THE ONLY PLACE THIS COULD GO QUIETLY WRONG
--
-- The package stores every nutrient in GRAMS per 100 g, with no exceptions —
-- calcium, iron and folate alike. Read as published, milk would have 0.118 mg
-- of calcium rather than 118 mg, and nothing on screen would look odd. So the
-- conversion is done here and spot-checked against figures anyone can look up:
--
--   milk    calcium 0.118    x1000 = 118 mg     (published ~120)
--   spinach iron    0.00295  x1000 = 2.95 mg    (published ~2.9)
--   spinach folate  0.000142 x1e6  = 142 ug     (published 120-190)
--   egg     cholesterol 0.366 x1000 = 366 mg    (published ~370)
--   spinach oxalate 0.592    x1000 = 592 mg     (spinach is famously high)
--
-- Values are stored to four significant figures. The source carries more, but a
-- milligram of iron to nine decimal places is precision nobody measured.
--
-- WHAT THIS DOES NOT YET DO
--
-- Nothing computes with these yet. A recipe's calcium cannot be added up until
-- the 206 foods added from UK CoFID and USDA have micronutrients too, and only 8
-- recipes in the library are built entirely from IFCT foods. Salt alone appears
-- in 680 of them and has no sodium figure here, which for a clinic watching
-- blood pressure is the opposite of useful.
--
-- This file is deliberately just the data. It changes no arithmetic, no screen
-- and no chart, so it can go in and be checked on its own.
--
-- Re-running is safe.

alter table foods
  add column if not exists calcium_mg numeric,
  add column if not exists iron_mg numeric,
  add column if not exists zinc_mg numeric,
  add column if not exists magnesium_mg numeric,
  add column if not exists sodium_mg numeric,
  add column if not exists potassium_mg numeric,
  add column if not exists phosphorus_mg numeric,
  add column if not exists selenium_ug numeric,
  add column if not exists vit_a_ug numeric,
  add column if not exists retinol_ug numeric,
  add column if not exists vit_d_ug numeric,
  add column if not exists vit_e_mg numeric,
  add column if not exists vit_k_ug numeric,
  add column if not exists vit_c_mg numeric,
  add column if not exists vit_b1_mg numeric,
  add column if not exists vit_b2_mg numeric,
  add column if not exists vit_b3_mg numeric,
  add column if not exists vit_b6_mg numeric,
  add column if not exists folate_ug numeric,
  add column if not exists cholesterol_mg numeric,
  add column if not exists saturated_fat_g numeric,
  add column if not exists oxalate_mg numeric;

comment on column foods.calcium_mg is 'IFCT 2017 ca, per 100 g edible portion, in milligrams.';
comment on column foods.iron_mg is 'IFCT 2017 fe, per 100 g edible portion, in milligrams.';
comment on column foods.zinc_mg is 'IFCT 2017 zn, per 100 g edible portion, in milligrams.';
comment on column foods.magnesium_mg is 'IFCT 2017 mg, per 100 g edible portion, in milligrams.';
comment on column foods.sodium_mg is 'IFCT 2017 na, per 100 g edible portion, in milligrams.';
comment on column foods.potassium_mg is 'IFCT 2017 k, per 100 g edible portion, in milligrams.';
comment on column foods.phosphorus_mg is 'IFCT 2017 p, per 100 g edible portion, in milligrams.';
comment on column foods.selenium_ug is 'IFCT 2017 se, per 100 g edible portion, in micrograms.';
comment on column foods.vit_a_ug is 'IFCT 2017 cartbeq, per 100 g edible portion, in micrograms.';
comment on column foods.retinol_ug is 'IFCT 2017 retol, per 100 g edible portion, in micrograms.';
comment on column foods.vit_d_ug is 'IFCT 2017 vitd, per 100 g edible portion, in micrograms.';
comment on column foods.vit_e_mg is 'IFCT 2017 vite, per 100 g edible portion, in milligrams.';
comment on column foods.vit_k_ug is 'IFCT 2017 vitk, per 100 g edible portion, in micrograms.';
comment on column foods.vit_c_mg is 'IFCT 2017 vitc, per 100 g edible portion, in milligrams.';
comment on column foods.vit_b1_mg is 'IFCT 2017 thia, per 100 g edible portion, in milligrams.';
comment on column foods.vit_b2_mg is 'IFCT 2017 ribf, per 100 g edible portion, in milligrams.';
comment on column foods.vit_b3_mg is 'IFCT 2017 nia, per 100 g edible portion, in milligrams.';
comment on column foods.vit_b6_mg is 'IFCT 2017 vitb6c, per 100 g edible portion, in milligrams.';
comment on column foods.folate_ug is 'IFCT 2017 folsum, per 100 g edible portion, in micrograms.';
comment on column foods.cholesterol_mg is 'IFCT 2017 cholc, per 100 g edible portion, in milligrams.';
comment on column foods.saturated_fat_g is 'IFCT 2017 fasat, per 100 g edible portion, in grams.';
comment on column foods.oxalate_mg is 'IFCT 2017 oxalt, per 100 g edible portion, in milligrams.';

with micro (food_code, calcium_mg, iron_mg, zinc_mg, magnesium_mg, sodium_mg, potassium_mg, phosphorus_mg, selenium_ug, vit_a_ug, retinol_ug, vit_d_ug, vit_e_mg, vit_k_ug, vit_c_mg, vit_b1_mg, vit_b2_mg, vit_b3_mg, vit_b6_mg, folate_ug, cholesterol_mg, saturated_fat_g, oxalate_mg) as (values
  -- Amaranth seed, black
  ('A001', 181::numeric, 9.33::numeric, 2.66::numeric, 325::numeric, 2.7::numeric, 433::numeric, 374::numeric, 16.46::numeric, 0::numeric, 0::numeric, 58.67::numeric, 0.17::numeric, 1.8::numeric, 0::numeric, 0.04::numeric, 0.04::numeric, 0.45::numeric, 0.5::numeric, 27.44::numeric, 0::numeric, 1.28::numeric, 226::numeric),
  -- Amaranth seed, pale brown
  ('A002', 162::numeric, 8.02::numeric, 2.52::numeric, 270::numeric, 2.81::numeric, 413::numeric, 412::numeric, 21.41::numeric, 0::numeric, 0::numeric, 53.98::numeric, 0.15::numeric, 2.5::numeric, 0::numeric, 0.04::numeric, 0.04::numeric, 0.52::numeric, 0.33::numeric, 24.65::numeric, 0::numeric, 1.14::numeric, 209::numeric),
  -- Bajra
  ('A003', 27.35::numeric, 6.42::numeric, 2.76::numeric, 124::numeric, 4.11::numeric, 365::numeric, 289::numeric, 30.4::numeric, 28.23::numeric, 0::numeric, 5.65::numeric, 0.24::numeric, 2.85::numeric, 0::numeric, 0.25::numeric, 0.2::numeric, 0.86::numeric, 0.27::numeric, 36.11::numeric, 0::numeric, 0.875::numeric, 53.13::numeric),
  -- Barley
  ('A004', 28.64::numeric, 1.56::numeric, 1.5::numeric, 48.97::numeric, 7.56::numeric, 268::numeric, 178::numeric, 18.61::numeric, 0::numeric, 0::numeric, 0::numeric, 0.01::numeric, 1.85::numeric, 0::numeric, 0.36::numeric, 0.18::numeric, 2.84::numeric, 0.31::numeric, 31.58::numeric, 0::numeric, 0.232::numeric, 10.98::numeric),
  -- Jowar
  ('A005', 27.6::numeric, 3.95::numeric, 1.96::numeric, 133::numeric, 5.42::numeric, 328::numeric, 274::numeric, 26.29::numeric, 8.29::numeric, 0::numeric, 3.96::numeric, 0.06::numeric, 43.82::numeric, 0::numeric, 0.35::numeric, 0.14::numeric, 2.1::numeric, 0.28::numeric, 39.42::numeric, 0::numeric, 0.163::numeric, 28.38::numeric),
  -- Maize, dry
  ('A006', 8.91::numeric, 2.49::numeric, 2.27::numeric, 145::numeric, 4.44::numeric, 291::numeric, 279::numeric, 8.69::numeric, 296::numeric, 0::numeric, 33.6::numeric, 0.36::numeric, 2.5::numeric, 0::numeric, 0.33::numeric, 0.09::numeric, 2.69::numeric, 0.34::numeric, 25.81::numeric, 0::numeric, 0.413::numeric, 15.26::numeric),
  -- Maize, tender, local
  ('A007', 6.35::numeric, 0.71::numeric, 0.97::numeric, 47.62::numeric, 2.24::numeric, 167::numeric, 163::numeric, 3.83::numeric, 73.53::numeric, 0::numeric, 42.34::numeric, 0.09::numeric, 2::numeric, 4.26::numeric, 0.17::numeric, 0.12::numeric, 1.13::numeric, 0.45::numeric, 62.96::numeric, 0::numeric, 0.109::numeric, 5.2::numeric),
  -- Maize, tender, sweet
  ('A008', 6.37::numeric, 0.54::numeric, 0.77::numeric, 36.51::numeric, 2.23::numeric, 297::numeric, 121::numeric, 2.17::numeric, 105.4::numeric, 0::numeric, 16.94::numeric, 0.1::numeric, 1.8::numeric, 5.72::numeric, 0.1::numeric, 0.14::numeric, 1.14::numeric, 0.38::numeric, 59.71::numeric, 0::numeric, 0.123::numeric, 1.67::numeric),
  -- Quinoa
  ('A009', 198::numeric, 7.51::numeric, 3.31::numeric, 119::numeric, 4.5::numeric, 474::numeric, 212::numeric, 7.81::numeric, 5.12::numeric, 0::numeric, 0::numeric, 2.08::numeric, 2::numeric, 0::numeric, 0.83::numeric, 0.22::numeric, 1.7::numeric, 0.21::numeric, 173::numeric, 0::numeric, 0.57::numeric, 82.94::numeric),
  -- Ragi
  ('A010', 364::numeric, 4.62::numeric, 2.53::numeric, 146::numeric, 4.75::numeric, 443::numeric, 210::numeric, 15.3::numeric, 1.53::numeric, 0::numeric, 41.46::numeric, 0.16::numeric, 3::numeric, 0::numeric, 0.37::numeric, 0.17::numeric, 1.34::numeric, 0.05::numeric, 34.66::numeric, 0::numeric, 0.317::numeric, 39.58::numeric),
  -- Rice flakes
  ('A011', 9.19::numeric, 4.46::numeric, 1.49::numeric, 77.92::numeric, 2.58::numeric, 148::numeric, 195::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.05::numeric, 1::numeric, 0::numeric, 0.12::numeric, 0.04::numeric, 1.6::numeric, 0.02::numeric, 8.46::numeric, 0::numeric, 0.284::numeric, 10.97::numeric),
  -- Rice puffed
  ('A012', 15.09::numeric, 4.55::numeric, 1.45::numeric, 64.59::numeric, 3.69::numeric, 140::numeric, 152::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.04::numeric, 1::numeric, 0::numeric, 0.11::numeric, 0.04::numeric, 1.87::numeric, 0.07::numeric, 0::numeric, 0::numeric, 0.04684::numeric, 6.27::numeric),
  -- Rice, raw, brown
  ('A013', 10.93::numeric, 1.02::numeric, 1.68::numeric, 93.91::numeric, 3.64::numeric, 199::numeric, 267::numeric, 2.26::numeric, 0::numeric, 0::numeric, 0::numeric, 0.69::numeric, 2::numeric, 0::numeric, 0.27::numeric, 0.06::numeric, 3.4::numeric, 0.37::numeric, 11.51::numeric, 0::numeric, 0.346::numeric, 12.06::numeric),
  -- Rice, parboiled, milled
  ('A014', 8.11::numeric, 0.72::numeric, 1.08::numeric, 26.72::numeric, 3.16::numeric, 142::numeric, 140::numeric, 1.19::numeric, 0::numeric, 0::numeric, 0::numeric, 0.09::numeric, 1.5::numeric, 0::numeric, 0.17::numeric, 0.06::numeric, 2.51::numeric, 0.22::numeric, 9.75::numeric, 0::numeric, 0.15::numeric, 5.02::numeric),
  -- Rice, raw, milled
  ('A015', 7.49::numeric, 0.65::numeric, 1.21::numeric, 19.3::numeric, 2.34::numeric, 108::numeric, 96::numeric, 1.01::numeric, 0::numeric, 0::numeric, 0::numeric, 0.06::numeric, 1.5::numeric, 0::numeric, 0.05::numeric, 0.05::numeric, 1.69::numeric, 0.12::numeric, 9.32::numeric, 0::numeric, 0.184::numeric, 1.92::numeric),
  -- Samai
  ('A016', 16.06::numeric, 1.26::numeric, 1.82::numeric, 91.41::numeric, 4.77::numeric, 105::numeric, 130::numeric, 40.41::numeric, 1.91::numeric, 0::numeric, 3.75::numeric, 0.55::numeric, 4.47::numeric, 0::numeric, 0.26::numeric, 0.05::numeric, 1.29::numeric, 0.04::numeric, 36.2::numeric, 0::numeric, 0.589::numeric, 6.74::numeric),
  -- Varagu
  ('A017', 15.27::numeric, 2.34::numeric, 1.65::numeric, 122::numeric, 3.35::numeric, 94::numeric, 101::numeric, 14.12::numeric, 1.41::numeric, 0::numeric, 0::numeric, 0.07::numeric, 3.75::numeric, 0::numeric, 0.29::numeric, 0.2::numeric, 1.49::numeric, 0.07::numeric, 39.49::numeric, 0::numeric, 0.246::numeric, 3.48::numeric),
  -- Wheat flour, refined
  ('A018', 20.4::numeric, 1.77::numeric, 0.88::numeric, 30.69::numeric, 1.54::numeric, 148::numeric, 110::numeric, 0::numeric, 1.97::numeric, 0::numeric, 6.73::numeric, 0.05::numeric, 1::numeric, 0::numeric, 0.15::numeric, 0.06::numeric, 0.77::numeric, 0.08::numeric, 16.25::numeric, 0::numeric, 0.09855::numeric, 20.22::numeric),
  -- Wheat flour, atta
  ('A019', 30.94::numeric, 4.1::numeric, 2.85::numeric, 125::numeric, 2.04::numeric, 311::numeric, 315::numeric, 53.12::numeric, 2.67::numeric, 0::numeric, 13.43::numeric, 0.26::numeric, 1.5::numeric, 0::numeric, 0.42::numeric, 0.15::numeric, 2.37::numeric, 0.25::numeric, 29.22::numeric, 0::numeric, 0.206::numeric, 52.38::numeric),
  -- Wheat, whole
  ('A020', 39.36::numeric, 3.97::numeric, 2.85::numeric, 125::numeric, 2.5::numeric, 366::numeric, 315::numeric, 47.76::numeric, 3.03::numeric, 0::numeric, 17.49::numeric, 0.77::numeric, 1.75::numeric, 0::numeric, 0.46::numeric, 0.15::numeric, 2.68::numeric, 0.26::numeric, 30.09::numeric, 0::numeric, 0.191::numeric, 52.46::numeric),
  -- Wheat, bulgur
  ('A021', 27.09::numeric, 3.86::numeric, 1.97::numeric, 116::numeric, 2.09::numeric, 330::numeric, 245::numeric, 10.54::numeric, 2.55::numeric, 0::numeric, 6.27::numeric, 0.21::numeric, 1.5::numeric, 0::numeric, 0.24::numeric, 0.12::numeric, 2.05::numeric, 0.24::numeric, 26.3::numeric, 0::numeric, 0.196::numeric, 40.23::numeric),
  -- Wheat, semolina
  ('A022', 29.38::numeric, 2.98::numeric, 2.13::numeric, 37.89::numeric, 2.31::numeric, 284::numeric, 119::numeric, 10.93::numeric, 1.6::numeric, 0::numeric, 8.19::numeric, 0.2::numeric, 1.2::numeric, 0::numeric, 0.29::numeric, 0.04::numeric, 1.13::numeric, 0.11::numeric, 25.68::numeric, 0::numeric, 0.08887::numeric, 28.43::numeric),
  -- Wheat, vermicelli
  ('A023', 19.42::numeric, 2.02::numeric, 0.83::numeric, 34.18::numeric, 2.71::numeric, 163::numeric, 99::numeric, 15.33::numeric, 1.68::numeric, 0::numeric, 4.06::numeric, 0.03::numeric, 1::numeric, 0::numeric, 0.13::numeric, 0.01::numeric, 0.86::numeric, 0.03::numeric, 14.35::numeric, 0::numeric, 0.06459::numeric, 23.84::numeric),
  -- Wheat, vermicelli, roasted
  ('A024', 22.63::numeric, 2.09::numeric, 0.88::numeric, 39.03::numeric, 3.43::numeric, 177::numeric, 107::numeric, 14.29::numeric, 0.92::numeric, 0::numeric, 3.21::numeric, 0.01::numeric, 1::numeric, 0::numeric, 0.12::numeric, 0.01::numeric, 0.67::numeric, 0.03::numeric, 13.21::numeric, 0::numeric, 0.04995::numeric, 21.91::numeric),
  -- Bengal gram, dal
  ('B001', 46.32::numeric, 6.08::numeric, 3.65::numeric, 118::numeric, 20.83::numeric, 957::numeric, 325::numeric, 50.97::numeric, 165::numeric, 0::numeric, 1.75::numeric, 0.19::numeric, 1.5::numeric, 0::numeric, 0.35::numeric, 0.15::numeric, 1.87::numeric, 0.19::numeric, 182::numeric, 0::numeric, 0.469::numeric, 6.49::numeric),
  -- Bengal gram, whole
  ('B002', 150::numeric, 6.78::numeric, 3.37::numeric, 160::numeric, 26.56::numeric, 935::numeric, 267::numeric, 41.23::numeric, 172::numeric, 0::numeric, 1.93::numeric, 1.72::numeric, 2.1::numeric, 0::numeric, 0.37::numeric, 0.24::numeric, 2.1::numeric, 0.36::numeric, 233::numeric, 0::numeric, 0.453::numeric, 7.14::numeric),
  -- Black gram, dal
  ('B003', 55.67::numeric, 4.67::numeric, 3::numeric, 173::numeric, 18.88::numeric, 1157::numeric, 375::numeric, 23.99::numeric, 10.11::numeric, 0::numeric, 8.42::numeric, 0.17::numeric, 8.3::numeric, 0::numeric, 0.21::numeric, 0.09::numeric, 1.76::numeric, 0.22::numeric, 88.75::numeric, 0::numeric, 0.276::numeric, 43.78::numeric),
  -- Black gram, whole
  ('B004', 86.18::numeric, 5.97::numeric, 3.05::numeric, 190::numeric, 26.8::numeric, 1093::numeric, 345::numeric, 27.98::numeric, 12.8::numeric, 0::numeric, 16.84::numeric, 0.23::numeric, 10.8::numeric, 0::numeric, 0.32::numeric, 0.11::numeric, 1.85::numeric, 0.53::numeric, 134::numeric, 0::numeric, 0.258::numeric, 56.25::numeric),
  -- Cowpea, brown
  ('B005', 81.73::numeric, 5.9::numeric, 3.41::numeric, 213::numeric, 13.68::numeric, 1241::numeric, 372::numeric, 23.95::numeric, 7.08::numeric, 0::numeric, 0.92::numeric, 0.7::numeric, 1.75::numeric, 0::numeric, 0.33::numeric, 0.09::numeric, 1.64::numeric, 0.3::numeric, 231::numeric, 0::numeric, 0.283::numeric, 14.34::numeric),
  -- Cowpea, white
  ('B006', 84.1::numeric, 5.04::numeric, 3.57::numeric, 213::numeric, 12.52::numeric, 1243::numeric, 378::numeric, 26.55::numeric, 8.21::numeric, 0::numeric, 0.93::numeric, 0.65::numeric, 1.7::numeric, 0::numeric, 0.34::numeric, 0.09::numeric, 1.51::numeric, 0.26::numeric, 249::numeric, 0::numeric, 0.285::numeric, 17.23::numeric),
  -- Field bean, black
  ('B007', 78.16::numeric, 4.5::numeric, 2.42::numeric, 197::numeric, 1.35::numeric, 1272::numeric, 457::numeric, 32.55::numeric, 0::numeric, 0::numeric, 4.35::numeric, 0.51::numeric, 21.5::numeric, 0::numeric, 0.35::numeric, 0.07::numeric, 1.88::numeric, 0.35::numeric, 291::numeric, 0::numeric, 0.188::numeric, 1.28::numeric),
  -- Field bean, brown
  ('B008', 75.2::numeric, 4.99::numeric, 2.44::numeric, 173::numeric, 1.41::numeric, 1245::numeric, 429::numeric, 22.82::numeric, 0::numeric, 0::numeric, 4.24::numeric, 0.53::numeric, 20.7::numeric, 0::numeric, 0.32::numeric, 0.07::numeric, 2.04::numeric, 0.37::numeric, 292::numeric, 0::numeric, 0.198::numeric, 1.26::numeric),
  -- Field bean, white
  ('B009', 77.24::numeric, 5.5::numeric, 2.8::numeric, 190::numeric, 1.7::numeric, 1360::numeric, 448::numeric, 21.52::numeric, 0::numeric, 0::numeric, 4.26::numeric, 0.52::numeric, 22.65::numeric, 0::numeric, 0.37::numeric, 0.07::numeric, 1.96::numeric, 0.38::numeric, 289::numeric, 0::numeric, 0.186::numeric, 1.23::numeric),
  -- Green gram, dal
  ('B010', 43.13::numeric, 3.93::numeric, 2.49::numeric, 155::numeric, 10.14::numeric, 1268::numeric, 416::numeric, 50.14::numeric, 122::numeric, 0::numeric, 2.05::numeric, 0.23::numeric, 8.3::numeric, 0::numeric, 0.35::numeric, 0.12::numeric, 1.84::numeric, 0.19::numeric, 92.11::numeric, 0::numeric, 0.247::numeric, 2.46::numeric),
  -- Green gram, whole
  ('B011', 92.43::numeric, 4.89::numeric, 2.67::numeric, 198::numeric, 12.48::numeric, 1177::numeric, 353::numeric, 23.32::numeric, 137::numeric, 0::numeric, 3.15::numeric, 0.33::numeric, 12.63::numeric, 0::numeric, 0.45::numeric, 0.27::numeric, 2.16::numeric, 0.35::numeric, 145::numeric, 0::numeric, 0.274::numeric, 12.29::numeric),
  -- Horse gram, whole
  ('B012', 269::numeric, 8.76::numeric, 2.71::numeric, 152::numeric, 12.14::numeric, 1065::numeric, 298::numeric, 29.49::numeric, 58.57::numeric, 0::numeric, 1.8::numeric, 0.27::numeric, 10.24::numeric, 0::numeric, 0.32::numeric, 0.24::numeric, 1.82::numeric, 0.21::numeric, 163::numeric, 0::numeric, 0.135::numeric, 181::numeric),
  -- Lentil dal
  ('B013', 44.32::numeric, 7.06::numeric, 3.61::numeric, 74.69::numeric, 10.27::numeric, 786::numeric, 310::numeric, 49.5::numeric, 6.34::numeric, 0::numeric, 1.31::numeric, 0.16::numeric, 3.75::numeric, 0::numeric, 0.34::numeric, 0.16::numeric, 1.81::numeric, 0.18::numeric, 49.99::numeric, 0::numeric, 0.09102::numeric, 10.46::numeric),
  -- Lentil whole, brown
  ('B014', 76.13::numeric, 7.57::numeric, 3.6::numeric, 101::numeric, 11.2::numeric, 756::numeric, 274::numeric, 33.14::numeric, 10.29::numeric, 0::numeric, 14.52::numeric, 0.19::numeric, 7.27::numeric, 0::numeric, 0.4::numeric, 0.22::numeric, 2.54::numeric, 0.46::numeric, 132::numeric, 0::numeric, 0.08122::numeric, 10.74::numeric),
  -- Lentil whole, yellowish
  ('B015', 76.66::numeric, 7.91::numeric, 3.31::numeric, 86.38::numeric, 10.87::numeric, 764::numeric, 261::numeric, 56.28::numeric, 12.64::numeric, 0::numeric, 17.68::numeric, 0.19::numeric, 5.25::numeric, 0::numeric, 0.42::numeric, 0.22::numeric, 2.56::numeric, 0.47::numeric, 121::numeric, 0::numeric, 0.07617::numeric, 13.88::numeric),
  -- Moth bean
  ('B016', 154::numeric, 7.9::numeric, 1.92::numeric, 205::numeric, 26.34::numeric, 1356::numeric, 362::numeric, 18.82::numeric, 3.57::numeric, 0::numeric, 9.77::numeric, 0.79::numeric, 22.75::numeric, 0::numeric, 0.45::numeric, 0.09::numeric, 1.87::numeric, 0.16::numeric, 349::numeric, 0::numeric, 0.434::numeric, 36.11::numeric),
  -- Peas, dry
  ('B017', 75.11::numeric, 5.09::numeric, 3.1::numeric, 123::numeric, 23.4::numeric, 922::numeric, 334::numeric, 50.07::numeric, 65.71::numeric, 0::numeric, 15.21::numeric, 0.32::numeric, 11.45::numeric, 0::numeric, 0.56::numeric, 0.16::numeric, 2.69::numeric, 0.26::numeric, 110::numeric, 0::numeric, 0.242::numeric, 8.89::numeric),
  -- Rajmah, black
  ('B018', 134::numeric, 6.17::numeric, 3.08::numeric, 160::numeric, 9.4::numeric, 1362::numeric, 386::numeric, 18.65::numeric, 1.95::numeric, 0::numeric, 27.98::numeric, 0.21::numeric, 5.05::numeric, 0::numeric, 0.21::numeric, 0.19::numeric, 2.61::numeric, 0.23::numeric, 332::numeric, 0::numeric, 0.238::numeric, 48.66::numeric),
  -- Rajmah, brown
  ('B019', 134::numeric, 6.3::numeric, 2.6::numeric, 164::numeric, 10.47::numeric, 1366::numeric, 396::numeric, 12.7::numeric, 2.16::numeric, 0::numeric, 25.82::numeric, 0.23::numeric, 5.5::numeric, 0::numeric, 0.26::numeric, 0.21::numeric, 2.37::numeric, 0.21::numeric, 330::numeric, 0::numeric, 0.242::numeric, 43.41::numeric),
  -- Rajmah, red
  ('B020', 126::numeric, 6.13::numeric, 2.69::numeric, 173::numeric, 10.45::numeric, 1324::numeric, 409::numeric, 22.45::numeric, 1.6::numeric, 0::numeric, 26.73::numeric, 0.23::numeric, 4.9::numeric, 0::numeric, 0.3::numeric, 0.19::numeric, 2.42::numeric, 0.21::numeric, 316::numeric, 0::numeric, 0.256::numeric, 41.44::numeric),
  -- Red gram, dal
  ('B021', 71.73::numeric, 3.9::numeric, 2.63::numeric, 119::numeric, 18.01::numeric, 1395::numeric, 328::numeric, 14.36::numeric, 127::numeric, 0::numeric, 2.12::numeric, 0.19::numeric, 42.25::numeric, 0::numeric, 0.45::numeric, 0.11::numeric, 2.09::numeric, 0.24::numeric, 108::numeric, 0::numeric, 0.257::numeric, 1.41::numeric),
  -- Red gram, whole
  ('B022', 139::numeric, 5.37::numeric, 2.99::numeric, 155::numeric, 19.03::numeric, 1303::numeric, 312::numeric, 15.41::numeric, 149::numeric, 0::numeric, 2.78::numeric, 0.8::numeric, 91.83::numeric, 0::numeric, 0.74::numeric, 0.15::numeric, 2.42::numeric, 0.42::numeric, 229::numeric, 0::numeric, 0.277::numeric, 1.65::numeric),
  -- Ricebean
  ('B023', 200::numeric, 4.76::numeric, 2.29::numeric, 201::numeric, 10.62::numeric, 1196::numeric, 270::numeric, 0::numeric, 0::numeric, 0::numeric, 8.26::numeric, 1.06::numeric, 21.85::numeric, 1.11::numeric, 0.46::numeric, 0.14::numeric, 2.32::numeric, 0.13::numeric, 122::numeric, 0::numeric, 0.172::numeric, 391::numeric),
  -- Soya bean, brown
  ('B024', 239::numeric, 8.29::numeric, 4.01::numeric, 259::numeric, 2.07::numeric, 1613::numeric, 483::numeric, 19::numeric, 3.5::numeric, 0::numeric, 66.22::numeric, 1.29::numeric, 45.8::numeric, 0::numeric, 0.59::numeric, 0.24::numeric, 2.12::numeric, 0.43::numeric, 297::numeric, 0::numeric, 3.092::numeric, 122::numeric),
  -- Soya bean, white
  ('B025', 195::numeric, 8.22::numeric, 3.47::numeric, 189::numeric, 2.83::numeric, 1634::numeric, 494::numeric, 16.85::numeric, 2.82::numeric, 0::numeric, 69.81::numeric, 1.33::numeric, 46.2::numeric, 0::numeric, 0.61::numeric, 0.23::numeric, 2.28::numeric, 0.45::numeric, 288::numeric, 0::numeric, 3.002::numeric, 119::numeric),
  -- Agathi leaves
  ('C001', 901::numeric, 4.36::numeric, 0.53::numeric, 96.64::numeric, 18.12::numeric, 674::numeric, 52.52::numeric, 30.7::numeric, 12582::numeric, 0::numeric, 4.02::numeric, 1.77::numeric, 269::numeric, 121::numeric, 0.26::numeric, 0.33::numeric, 1.18::numeric, 0.22::numeric, 120::numeric, 0::numeric, 0.49::numeric, 179::numeric),
  -- Amaranth leaves, green
  ('C002', 330::numeric, 4.64::numeric, 0.86::numeric, 194::numeric, 16.08::numeric, 572::numeric, 73.22::numeric, 20.97::numeric, 8553::numeric, 0::numeric, 16.01::numeric, 0.44::numeric, 280::numeric, 83.54::numeric, 0.01::numeric, 0.19::numeric, 0.71::numeric, 0.21::numeric, 70.33::numeric, 0::numeric, 0.194::numeric, 779::numeric),
  -- Amaranth leaves, red mix
  ('C003', 245::numeric, 7.25::numeric, 1.37::numeric, 177::numeric, 14.58::numeric, 564::numeric, 75.98::numeric, 22.55::numeric, 8457::numeric, 0::numeric, 15.1::numeric, 0.46::numeric, 312::numeric, 86.2::numeric, 0.01::numeric, 0.269::numeric, 0.62::numeric, 0.22::numeric, 81.95::numeric, 0::numeric, 0.21::numeric, 823::numeric),
  -- Amaranth leaves, red and green mix
  ('C004', 269::numeric, 5.28::numeric, 1.03::numeric, 146::numeric, 17.55::numeric, 597::numeric, 68.23::numeric, 21.62::numeric, 8464::numeric, 0::numeric, 15.25::numeric, 0.45::numeric, 284::numeric, 77.24::numeric, 0.01::numeric, 0.22::numeric, 0.69::numeric, 0.19::numeric, 69.08::numeric, 0::numeric, 0.197::numeric, 676::numeric),
  -- Amaranth spinosus, leaves, green mix
  ('C005', 359::numeric, 6.37::numeric, 1.57::numeric, 202::numeric, 15.66::numeric, 569::numeric, 72.46::numeric, 28.97::numeric, 1594::numeric, 0::numeric, 15.23::numeric, 0.28::numeric, 443::numeric, 82.56::numeric, 0.01::numeric, 0.13::numeric, 0.63::numeric, 0.22::numeric, 41.44::numeric, 0::numeric, 0.08513::numeric, 1073::numeric),
  -- Amaranth spinosus, leaves, red and green mix
  ('C006', 372::numeric, 4.58::numeric, 1.11::numeric, 187::numeric, 16.27::numeric, 588::numeric, 85.02::numeric, 19.41::numeric, 1487::numeric, 0::numeric, 15.04::numeric, 0.28::numeric, 448::numeric, 77.3::numeric, 0.01::numeric, 0.15::numeric, 0.72::numeric, 0.2::numeric, 44.23::numeric, 0::numeric, 0.08596::numeric, 1045::numeric),
  -- Basella leaves
  ('C007', 93.89::numeric, 4.2::numeric, 0.39::numeric, 153::numeric, 18.74::numeric, 337::numeric, 37.26::numeric, 6.17::numeric, 2473::numeric, 0::numeric, 9.18::numeric, 0.16::numeric, 236::numeric, 63.35::numeric, 0.06::numeric, 0.15::numeric, 0.46::numeric, 0.18::numeric, 90.31::numeric, 0::numeric, 0.101::numeric, 170::numeric),
  -- Bathua leaves
  ('C008', 211::numeric, 2.66::numeric, 0.98::numeric, 48.41::numeric, 10.75::numeric, 438::numeric, 37.55::numeric, 1.4::numeric, 1075::numeric, 0::numeric, 1.01::numeric, 0.25::numeric, 224::numeric, 41.03::numeric, 0.06::numeric, 0.51::numeric, 0.54::numeric, 0.17::numeric, 42.55::numeric, 0::numeric, 0.12::numeric, 1077::numeric),
  -- Beet greens
  ('C009', 151::numeric, 5.8::numeric, 0.16::numeric, 120::numeric, 111::numeric, 530::numeric, 36.02::numeric, 47.75::numeric, 1703::numeric, 0::numeric, 1.65::numeric, 0.21::numeric, 69.45::numeric, 35.83::numeric, 0.02::numeric, 0.17::numeric, 0.43::numeric, 0.13::numeric, 11.52::numeric, 0::numeric, 0.188::numeric, 127::numeric),
  -- Betel leaves, big (kolkata)
  ('C010', 207::numeric, 3::numeric, 0.47::numeric, 107::numeric, 16.8::numeric, 649::numeric, 51.73::numeric, 12.15::numeric, 4377::numeric, 0::numeric, 3.78::numeric, 0.05::numeric, 207::numeric, 18.4::numeric, 0.03::numeric, 0.08::numeric, 0.45::numeric, 0.04::numeric, 15.96::numeric, 0::numeric, 0.25::numeric, 493::numeric),
  -- Betel leaves, small
  ('C011', 196::numeric, 2.87::numeric, 0.39::numeric, 89.94::numeric, 14.04::numeric, 678::numeric, 55.72::numeric, 5.4::numeric, 5103::numeric, 0::numeric, 2.27::numeric, 0.03::numeric, 204::numeric, 24.51::numeric, 0.02::numeric, 0.07::numeric, 0.47::numeric, 0.04::numeric, 16.56::numeric, 0::numeric, 0.238::numeric, 577::numeric),
  -- Brussels sprouts
  ('C012', 53.99::numeric, 1.54::numeric, 0.57::numeric, 32.99::numeric, 18.51::numeric, 639::numeric, 98.56::numeric, 2.01::numeric, 360::numeric, 0::numeric, 0.26::numeric, 0.21::numeric, 23.6::numeric, 89.45::numeric, 0.06::numeric, 0.16::numeric, 0.5::numeric, 0.19::numeric, 85.01::numeric, 0::numeric, 0.226::numeric, 12.4::numeric),
  -- Cabbage, Chinese
  ('C013', 58.46::numeric, 0.39::numeric, 0.19::numeric, 11.51::numeric, 20.28::numeric, 258::numeric, 33.05::numeric, 1.85::numeric, 5.5::numeric, 0::numeric, 0.39::numeric, 0.25::numeric, 111::numeric, 19.32::numeric, 0.01::numeric, 0.05::numeric, 0.38::numeric, 0.19::numeric, 54.51::numeric, 0::numeric, 0.03301::numeric, 16.55::numeric),
  -- Cabbage, collard greens
  ('C014', 170::numeric, 2.67::numeric, 0.35::numeric, 45.9::numeric, 22.98::numeric, 292::numeric, 54.67::numeric, 2.35::numeric, 104::numeric, 0::numeric, 0.18::numeric, 0.2::numeric, 125::numeric, 40.76::numeric, 0.03::numeric, 0.05::numeric, 0.26::numeric, 0.24::numeric, 63.46::numeric, 0::numeric, 0.06187::numeric, 9.42::numeric),
  -- Cabbage, green
  ('C015', 51.76::numeric, 0.35::numeric, 0.16::numeric, 17.99::numeric, 14.98::numeric, 233::numeric, 30.15::numeric, 1.08::numeric, 20.48::numeric, 0::numeric, 0.21::numeric, 0.05::numeric, 113::numeric, 33.25::numeric, 0.03::numeric, 0.05::numeric, 0.24::numeric, 0.13::numeric, 46.36::numeric, 0::numeric, 0.04654::numeric, 2.88::numeric),
  -- Cabbage, violet
  ('C016', 48::numeric, 0.24::numeric, 0.13::numeric, 26.87::numeric, 24::numeric, 201::numeric, 22.14::numeric, 1.08::numeric, 31.17::numeric, 0::numeric, 0.19::numeric, 0.03::numeric, 117::numeric, 43.49::numeric, 0.04::numeric, 0.05::numeric, 0.27::numeric, 0.17::numeric, 34.81::numeric, 0::numeric, 0.05842::numeric, 2.7::numeric),
  -- Cauliflower leaves
  ('C017', 96.7::numeric, 2.42::numeric, 0.31::numeric, 41.5::numeric, 24.31::numeric, 374::numeric, 62.82::numeric, 1.05::numeric, 146::numeric, 0::numeric, 4.15::numeric, 0.08::numeric, 144::numeric, 52.84::numeric, 0.05::numeric, 0.05::numeric, 0.21::numeric, 0.23::numeric, 42.99::numeric, 0::numeric, 0.115::numeric, 172::numeric),
  -- Colocasia leaves, green
  ('C018', 216::numeric, 3.41::numeric, 0.82::numeric, 59.44::numeric, 12.08::numeric, 404::numeric, 57.88::numeric, 4.3::numeric, 5758::numeric, 0::numeric, 1.7::numeric, 0.07::numeric, 318::numeric, 40.71::numeric, 0.08::numeric, 0.07::numeric, 0.8::numeric, 0.29::numeric, 159::numeric, 0::numeric, 0.426::numeric, 701::numeric),
  -- Drumstick leaves
  ('C019', 314::numeric, 4.56::numeric, 0.72::numeric, 97.09::numeric, 9.34::numeric, 397::numeric, 109::numeric, 5.95::numeric, 17542::numeric, 0::numeric, 14.33::numeric, 0.31::numeric, 479::numeric, 108::numeric, 0.06::numeric, 0.45::numeric, 0.82::numeric, 0.87::numeric, 42.89::numeric, 0::numeric, 0.56::numeric, 120::numeric),
  -- Fenugreek leaves
  ('C020', 274::numeric, 5.69::numeric, 0.54::numeric, 63.67::numeric, 47.01::numeric, 226::numeric, 53.05::numeric, 1.29::numeric, 9245::numeric, 0::numeric, 2.36::numeric, 0.36::numeric, 428::numeric, 58.25::numeric, 0.11::numeric, 0.22::numeric, 0.7::numeric, 0.38::numeric, 75.26::numeric, 0::numeric, 0.199::numeric, 34.29::numeric),
  -- Garden cress
  ('C021', 217::numeric, 6.19::numeric, 1.52::numeric, 79.24::numeric, 25.35::numeric, 379::numeric, 45.55::numeric, 8.08::numeric, 88.72::numeric, 0::numeric, 0.55::numeric, 0.74::numeric, 458::numeric, 42.75::numeric, 0.03::numeric, 0.06::numeric, 1.2::numeric, 0.2::numeric, 58.1::numeric, 0::numeric, 0.02868::numeric, 115::numeric),
  -- Gogu leaves, green
  ('C022', 145::numeric, 7.65::numeric, 0.65::numeric, 83.09::numeric, 12.34::numeric, 260::numeric, 41.99::numeric, 2.38::numeric, 5285::numeric, 0::numeric, 4.28::numeric, 0.5::numeric, 433::numeric, 29.65::numeric, 0.13::numeric, 0.06::numeric, 0.58::numeric, 0.33::numeric, 74.94::numeric, 0::numeric, 0.245::numeric, 177::numeric),
  -- Gogu leaves, red
  ('C023', 129::numeric, 9.56::numeric, 0.63::numeric, 75.75::numeric, 14.08::numeric, 161::numeric, 36.38::numeric, 3.25::numeric, 5143::numeric, 0::numeric, 4.27::numeric, 0.5::numeric, 438::numeric, 35.43::numeric, 0.12::numeric, 0.05::numeric, 0.56::numeric, 0.31::numeric, 88.63::numeric, 0::numeric, 0.243::numeric, 187::numeric),
  -- Knol-Khol, leaves
  ('C024', 368::numeric, 2.51::numeric, 0.42::numeric, 66::numeric, 26.8::numeric, 309::numeric, 55.02::numeric, 10.5::numeric, 12.04::numeric, 0::numeric, 0.59::numeric, 0.53::numeric, 295::numeric, 71.11::numeric, 0.06::numeric, 0.15::numeric, 0.86::numeric, 0.28::numeric, 41.55::numeric, 0::numeric, 0.107::numeric, 2.92::numeric),
  -- Lettuce
  ('C025', 56.71::numeric, 2.73::numeric, 0.51::numeric, 43.22::numeric, 17.53::numeric, 279::numeric, 44.1::numeric, 5.56::numeric, 1285::numeric, 0::numeric, 0.1::numeric, 0.01::numeric, 91.08::numeric, 11.91::numeric, 0.05::numeric, 0.09::numeric, 0.17::numeric, 0.08::numeric, 30.69::numeric, 0::numeric, 0.116::numeric, 364::numeric),
  -- Mustard leaves
  ('C026', 191::numeric, 2.84::numeric, 0.68::numeric, 51.63::numeric, 19.14::numeric, 403::numeric, 71.62::numeric, 8.03::numeric, 2619::numeric, 0::numeric, 5.4::numeric, 0.57::numeric, 192::numeric, 60.32::numeric, 0.08::numeric, 0.18::numeric, 0.58::numeric, 0.16::numeric, 110::numeric, 0::numeric, 0.142::numeric, 1.69::numeric),
  -- Pak Choi leaves
  ('C027', 150::numeric, 3.78::numeric, 0.16::numeric, 45.28::numeric, 33.73::numeric, 250::numeric, 25.95::numeric, 0.79::numeric, 2450::numeric, 0::numeric, 0.1::numeric, 0.03::numeric, 39.85::numeric, 55.6::numeric, 0.02::numeric, 0.22::numeric, 0.66::numeric, 0.96::numeric, 98.5::numeric, 0::numeric, 0.03898::numeric, 14.35::numeric),
  -- Parsley
  ('C028', 288::numeric, 5.51::numeric, 1.29::numeric, 49.18::numeric, 53.08::numeric, 466::numeric, 78.56::numeric, 10.24::numeric, 2710::numeric, 0::numeric, 5.55::numeric, 0.35::numeric, 322::numeric, 133::numeric, 0.19::numeric, 0.1::numeric, 0.36::numeric, 0.19::numeric, 197::numeric, 0::numeric, 0.345::numeric, 128::numeric),
  -- Ponnaganni
  ('C029', 388::numeric, 3.88::numeric, 0.99::numeric, 80.39::numeric, 39.36::numeric, 457::numeric, 58.26::numeric, 17.19::numeric, 5288::numeric, 0::numeric, 0.65::numeric, 0.54::numeric, 574::numeric, 103::numeric, 0.02::numeric, 0.1::numeric, 0.32::numeric, 0.19::numeric, 48.42::numeric, 0::numeric, 0.204::numeric, 465::numeric),
  -- Pumpkin leaves, tender
  ('C030', 271::numeric, 5.58::numeric, 0.9::numeric, 84.21::numeric, 12.2::numeric, 423::numeric, 64.54::numeric, 1.38::numeric, 1455::numeric, 0::numeric, 3.19::numeric, 1.69::numeric, 243::numeric, 12.33::numeric, 0.07::numeric, 0.13::numeric, 1.49::numeric, 0.17::numeric, 33.82::numeric, 0::numeric, 0.267::numeric, 13.61::numeric),
  -- Radish leaves
  ('C031', 234::numeric, 3.82::numeric, 0.49::numeric, 57.96::numeric, 17.39::numeric, 304::numeric, 50.08::numeric, 33.05::numeric, 2591::numeric, 0::numeric, 1.39::numeric, 0.08::numeric, 185::numeric, 65.76::numeric, 0.06::numeric, 0.13::numeric, 0.47::numeric, 0.16::numeric, 53.14::numeric, 0::numeric, 0.147::numeric, 53.83::numeric),
  -- Rumex leaves
  ('C032', 131::numeric, 3.67::numeric, 0.46::numeric, 48.33::numeric, 19.95::numeric, 336::numeric, 32.4::numeric, 5.37::numeric, 2754::numeric, 0::numeric, 0.1::numeric, 0.51::numeric, 126::numeric, 53.76::numeric, 0.03::numeric, 0.14::numeric, 0.33::numeric, 0.09::numeric, 41.01::numeric, 0::numeric, 0.06092::numeric, 93.76::numeric),
  -- Spinach
  ('C033', 82.29::numeric, 2.95::numeric, 0.46::numeric, 86.97::numeric, 42.55::numeric, 625::numeric, 32.59::numeric, 2.09::numeric, 2605::numeric, 0::numeric, 0.26::numeric, 1.29::numeric, 325::numeric, 30.28::numeric, 0.16::numeric, 0.1::numeric, 0.33::numeric, 0.15::numeric, 142::numeric, 0::numeric, 0.183::numeric, 592::numeric),
  -- Tamarind leaves, tender
  ('C034', 66.93::numeric, 2.84::numeric, 0.93::numeric, 42.1::numeric, 13.43::numeric, 465::numeric, 86.86::numeric, 2.45::numeric, 168::numeric, 0::numeric, 2.62::numeric, 0.81::numeric, 249::numeric, 28.22::numeric, 0.12::numeric, 0.03::numeric, 0.79::numeric, 0.14::numeric, 91.82::numeric, 0::numeric, 0.176::numeric, 150::numeric),
  -- Ash gourd
  ('D001', 19.39::numeric, 0.47::numeric, 0.13::numeric, 19.95::numeric, 0.77::numeric, 372::numeric, 29.07::numeric, 1.15::numeric, 0::numeric, 0::numeric, 1.35::numeric, 0.02::numeric, 27.15::numeric, 11.41::numeric, 0.03::numeric, 0.01::numeric, 0.12::numeric, 0.18::numeric, 14.11::numeric, 0::numeric, 0.02526::numeric, 4.89::numeric),
  -- Bamboo shoot, tender
  ('D002', 10::numeric, 0.33::numeric, 0.37::numeric, 8.28::numeric, 1.12::numeric, 422::numeric, 39.63::numeric, 2.58::numeric, 0::numeric, 0::numeric, 0.41::numeric, 0::numeric, 1.13::numeric, 15.74::numeric, 0.06::numeric, 0.06::numeric, 0.25::numeric, 0.13::numeric, 17.05::numeric, 0::numeric, 0.04109::numeric, 85.7::numeric),
  -- Bean scarlet, tender
  ('D003', 43.48::numeric, 0.73::numeric, 0.57::numeric, 43.75::numeric, 1.46::numeric, 164::numeric, 62.13::numeric, 0.02::numeric, 35.52::numeric, 0::numeric, 1.4::numeric, 0.15::numeric, 60.1::numeric, 6.61::numeric, 0.13::numeric, 0.12::numeric, 0.52::numeric, 0.31::numeric, 45.26::numeric, 0::numeric, 0.266::numeric, 20.97::numeric),
  -- Bitter gourd, jagged, teeth ridges, elongate
  ('D004', 21.36::numeric, 1.15::numeric, 0.31::numeric, 32.14::numeric, 13.09::numeric, 326::numeric, 44.9::numeric, 4.97::numeric, 122::numeric, 0::numeric, 1.92::numeric, 0.03::numeric, 4.55::numeric, 46.53::numeric, 0.05::numeric, 0.04::numeric, 0.27::numeric, 0.05::numeric, 60.28::numeric, 0::numeric, 0.144::numeric, 45.4::numeric),
  -- Bitter gourd, jagged, teeth ridges, short
  ('D005', 16.27::numeric, 1.08::numeric, 0.36::numeric, 31.58::numeric, 12.59::numeric, 282::numeric, 40.21::numeric, 3.72::numeric, 126::numeric, 0::numeric, 1.9::numeric, 0.03::numeric, 4.85::numeric, 50.87::numeric, 0.06::numeric, 0.04::numeric, 0.29::numeric, 0.04::numeric, 51.45::numeric, 0::numeric, 0.139::numeric, 48.83::numeric),
  -- Bitter gourd, jagged, smooth ridges, elongate
  ('D006', 17.62::numeric, 1.28::numeric, 0.43::numeric, 33.34::numeric, 11.16::numeric, 356::numeric, 44.75::numeric, 5.22::numeric, 130::numeric, 0::numeric, 1.83::numeric, 0.03::numeric, 4.7::numeric, 54.3::numeric, 0.06::numeric, 0.04::numeric, 0.3::numeric, 0.05::numeric, 60.03::numeric, 0::numeric, 0.142::numeric, 43.37::numeric),
  -- Bottle gourd, elongate, pale green
  ('D007', 15.42::numeric, 0.26::numeric, 0.15::numeric, 10.93::numeric, 1.46::numeric, 124::numeric, 16.01::numeric, 1.77::numeric, 44.05::numeric, 0::numeric, 0.74::numeric, 0.02::numeric, 2.1::numeric, 4.33::numeric, 0.03::numeric, 0.01::numeric, 0.14::numeric, 0.02::numeric, 41.99::numeric, 0::numeric, 0.04144::numeric, 3.75::numeric),
  -- Bottle gourd, round, pale green
  ('D008', 15.05::numeric, 0.28::numeric, 0.15::numeric, 10.89::numeric, 1.52::numeric, 116::numeric, 16.99::numeric, 1.8::numeric, 47.13::numeric, 0::numeric, 0.7::numeric, 0.01::numeric, 2.06::numeric, 4.54::numeric, 0.03::numeric, 0.01::numeric, 0.14::numeric, 0.02::numeric, 49.59::numeric, 0::numeric, 0.04107::numeric, 2.53::numeric),
  -- Bottle gourd, elongate, dark green
  ('D009', 16.64::numeric, 0.34::numeric, 0.18::numeric, 12.9::numeric, 1.35::numeric, 171::numeric, 26.86::numeric, 2.05::numeric, 44.82::numeric, 0::numeric, 0.6::numeric, 0.02::numeric, 1.8::numeric, 3.8::numeric, 0.03::numeric, 0.01::numeric, 0.14::numeric, 0.01::numeric, 46.31::numeric, 0::numeric, 0.04204::numeric, 1.7::numeric),
  -- Brinjal-1
  ('D010', 22.17::numeric, 0.49::numeric, 0.32::numeric, 26.75::numeric, 3.15::numeric, 302::numeric, 39.95::numeric, 0::numeric, 126::numeric, 0::numeric, 0.85::numeric, 0.08::numeric, 10.3::numeric, 1.58::numeric, 0.07::numeric, 0.13::numeric, 0.74::numeric, 0.05::numeric, 37.22::numeric, 0::numeric, 0.09453::numeric, 34::numeric),
  -- Brinjal-2
  ('D011', 17.13::numeric, 0.44::numeric, 0.23::numeric, 29.56::numeric, 3.92::numeric, 206::numeric, 44.65::numeric, 0::numeric, 130::numeric, 0::numeric, 1.01::numeric, 0.11::numeric, 11.45::numeric, 1.03::numeric, 0.09::numeric, 0.11::numeric, 0.56::numeric, 0.05::numeric, 27.22::numeric, 0::numeric, 0.08811::numeric, 35.87::numeric),
  -- Brinjal-3
  ('D012', 14.58::numeric, 0.34::numeric, 0.2::numeric, 18.62::numeric, 3.12::numeric, 192::numeric, 27.79::numeric, 0::numeric, 138::numeric, 0::numeric, 1.19::numeric, 0.09::numeric, 12.25::numeric, 2.34::numeric, 0.05::numeric, 0.109::numeric, 0.6::numeric, 0.07::numeric, 32.29::numeric, 0::numeric, 0.07234::numeric, 32.4::numeric),
  -- Brinjal-4
  ('D013', 13.39::numeric, 0.38::numeric, 0.21::numeric, 20.65::numeric, 3.31::numeric, 268::numeric, 31.82::numeric, 0::numeric, 140::numeric, 0::numeric, 1.05::numeric, 0.09::numeric, 12.75::numeric, 2.22::numeric, 0.06::numeric, 0.11::numeric, 0.52::numeric, 0.07::numeric, 36.67::numeric, 0::numeric, 0.06691::numeric, 29.37::numeric),
  -- Brinjal-5
  ('D014', 17.03::numeric, 0.36::numeric, 0.2::numeric, 25.36::numeric, 4.03::numeric, 227::numeric, 33.13::numeric, 0::numeric, 123::numeric, 0::numeric, 1.61::numeric, 0.1::numeric, 13.05::numeric, 3.15::numeric, 0.07::numeric, 0.11::numeric, 0.49::numeric, 0.08::numeric, 32.21::numeric, 0::numeric, 0.06924::numeric, 33.5::numeric),
  -- Brinjal-6
  ('D015', 17.17::numeric, 0.39::numeric, 0.2::numeric, 18.82::numeric, 3.75::numeric, 289::numeric, 30.12::numeric, 0::numeric, 129::numeric, 0::numeric, 1.14::numeric, 0.08::numeric, 21.45::numeric, 1.49::numeric, 0.05::numeric, 0.11::numeric, 0.51::numeric, 0.07::numeric, 34.21::numeric, 0::numeric, 0.07099::numeric, 36.8::numeric),
  -- Brinjal-7
  ('D016', 19.95::numeric, 0.27::numeric, 0.16::numeric, 15.26::numeric, 3.45::numeric, 238::numeric, 29.58::numeric, 0::numeric, 155::numeric, 0::numeric, 0.84::numeric, 0.03::numeric, 13.14::numeric, 1.08::numeric, 0.05::numeric, 0.12::numeric, 0.44::numeric, 0.07::numeric, 26.58::numeric, 0::numeric, 0.07172::numeric, 33.68::numeric),
  -- Brinjal-8
  ('D017', 21::numeric, 0.42::numeric, 0.24::numeric, 26.63::numeric, 4.73::numeric, 284::numeric, 35.84::numeric, 0::numeric, 162::numeric, 0::numeric, 0.97::numeric, 0.08::numeric, 13.94::numeric, 1.89::numeric, 0.07::numeric, 0.11::numeric, 0.65::numeric, 0.07::numeric, 33.89::numeric, 0::numeric, 0.06817::numeric, 37.86::numeric),
  -- Brinjal-9
  ('D018', 18.79::numeric, 0.38::numeric, 0.23::numeric, 26.23::numeric, 3.08::numeric, 224::numeric, 35.71::numeric, 0::numeric, 158::numeric, 0::numeric, 1.02::numeric, 0.09::numeric, 14.05::numeric, 1.72::numeric, 0.06::numeric, 0.11::numeric, 0.56::numeric, 0.09::numeric, 35.89::numeric, 0::numeric, 0.08049::numeric, 43.33::numeric),
  -- Brinjal-10
  ('D019', 15.59::numeric, 0.41::numeric, 0.23::numeric, 22.11::numeric, 4.35::numeric, 252::numeric, 37.36::numeric, 0::numeric, 161::numeric, 0::numeric, 0.88::numeric, 0.05::numeric, 14.25::numeric, 2.4::numeric, 0.06::numeric, 0.1::numeric, 0.5::numeric, 0.08::numeric, 37.11::numeric, 0::numeric, 0.066::numeric, 34.8::numeric),
  -- Brinjal-11
  ('D020', 15.92::numeric, 0.37::numeric, 0.22::numeric, 20.73::numeric, 3.47::numeric, 260::numeric, 33.28::numeric, 0::numeric, 162::numeric, 0::numeric, 1.01::numeric, 0.07::numeric, 14.46::numeric, 2.24::numeric, 0.06::numeric, 0.11::numeric, 0.53::numeric, 0.08::numeric, 34.24::numeric, 0::numeric, 0.06814::numeric, 32.83::numeric),
  -- Brinjal-12
  ('D021', 19.85::numeric, 0.37::numeric, 0.25::numeric, 19.26::numeric, 3.88::numeric, 259::numeric, 37.81::numeric, 0::numeric, 144::numeric, 0::numeric, 0.87::numeric, 0.09::numeric, 14.32::numeric, 2.55::numeric, 0.04::numeric, 0.1::numeric, 0.46::numeric, 0.06::numeric, 27.83::numeric, 0::numeric, 0.06852::numeric, 31.81::numeric),
  -- Brinjal-13
  ('D022', 18.95::numeric, 0.32::numeric, 0.19::numeric, 18::numeric, 3::numeric, 260::numeric, 26.81::numeric, 0::numeric, 138::numeric, 0::numeric, 1.06::numeric, 0.07::numeric, 14.29::numeric, 1.49::numeric, 0.04::numeric, 0.12::numeric, 0.54::numeric, 0.09::numeric, 30.99::numeric, 0::numeric, 0.08296::numeric, 29.12::numeric),
  -- Brinjal-14
  ('D023', 14.43::numeric, 0.32::numeric, 0.19::numeric, 19.19::numeric, 3.71::numeric, 246::numeric, 30.07::numeric, 0::numeric, 134::numeric, 0::numeric, 0.89::numeric, 0.06::numeric, 14.58::numeric, 1.83::numeric, 0.06::numeric, 0.1::numeric, 0.46::numeric, 0.07::numeric, 38.99::numeric, 0::numeric, 0.05914::numeric, 32.95::numeric),
  -- Brinjal-15
  ('D024', 17.82::numeric, 0.36::numeric, 0.22::numeric, 21.89::numeric, 3.34::numeric, 215::numeric, 30.32::numeric, 0::numeric, 162::numeric, 0::numeric, 1.12::numeric, 0.08::numeric, 14.04::numeric, 2.01::numeric, 0.07::numeric, 0.11::numeric, 0.51::numeric, 0.07::numeric, 32.48::numeric, 0::numeric, 0.06708::numeric, 29.74::numeric),
  -- Brinjal-16
  ('D025', 18.33::numeric, 0.32::numeric, 0.19::numeric, 17.06::numeric, 3.22::numeric, 294::numeric, 29.86::numeric, 0::numeric, 155::numeric, 0::numeric, 0.76::numeric, 0.09::numeric, 13.37::numeric, 1.53::numeric, 0.04::numeric, 0.11::numeric, 0.44::numeric, 0.1::numeric, 30.87::numeric, 0::numeric, 0.08365::numeric, 32.81::numeric),
  -- Brinjal-17
  ('D026', 20.83::numeric, 0.5::numeric, 0.25::numeric, 23.13::numeric, 3.09::numeric, 233::numeric, 35.94::numeric, 0::numeric, 146::numeric, 0::numeric, 1.33::numeric, 0.07::numeric, 12.75::numeric, 1.95::numeric, 0.08::numeric, 0.09::numeric, 0.53::numeric, 0.1::numeric, 27.7::numeric, 0::numeric, 0.08114::numeric, 37.14::numeric),
  -- Brinjal-18
  ('D027', 16.24::numeric, 0.38::numeric, 0.18::numeric, 15.48::numeric, 3.63::numeric, 208::numeric, 28.03::numeric, 0::numeric, 130::numeric, 0::numeric, 1.01::numeric, 0.04::numeric, 13.67::numeric, 1.97::numeric, 0.04::numeric, 0.1::numeric, 0.57::numeric, 0.07::numeric, 38.27::numeric, 0::numeric, 0.06918::numeric, 37.58::numeric),
  -- Brinjal-19
  ('D028', 16.1::numeric, 0.32::numeric, 0.19::numeric, 18.41::numeric, 3.11::numeric, 243::numeric, 29.76::numeric, 0::numeric, 119::numeric, 0::numeric, 1.06::numeric, 0.07::numeric, 11.48::numeric, 2.53::numeric, 0.04::numeric, 0.1::numeric, 0.53::numeric, 0.09::numeric, 34.32::numeric, 0::numeric, 0.05927::numeric, 37.84::numeric),
  -- Brinjal-20
  ('D029', 14.36::numeric, 0.33::numeric, 0.2::numeric, 18.51::numeric, 3.58::numeric, 239::numeric, 31.21::numeric, 0::numeric, 139::numeric, 0::numeric, 1.02::numeric, 0.07::numeric, 10.94::numeric, 2.21::numeric, 0.06::numeric, 0.1::numeric, 0.55::numeric, 0.07::numeric, 33.44::numeric, 0::numeric, 0.07991::numeric, 35.39::numeric),
  -- Brinjal-21
  ('D030', 15.27::numeric, 0.34::numeric, 0.2::numeric, 17.3::numeric, 3.06::numeric, 252::numeric, 34.98::numeric, 0::numeric, 155::numeric, 0::numeric, 0.84::numeric, 0.08::numeric, 10.5::numeric, 1.38::numeric, 0.05::numeric, 0.11::numeric, 0.53::numeric, 0.08::numeric, 32.6::numeric, 0::numeric, 0.08828::numeric, 34.6::numeric),
  -- Brinjal - all varieties
  ('D031', 16.59::numeric, 0.37::numeric, 0.21::numeric, 21::numeric, 3.55::numeric, 247::numeric, 32.56::numeric, 0::numeric, 146::numeric, 0::numeric, 1.04::numeric, 0.07::numeric, 13.53::numeric, 2.09::numeric, 0.06::numeric, 0.11::numeric, 0.53::numeric, 0.07::numeric, 33.93::numeric, 0::numeric, 0.07115::numeric, 34.31::numeric),
  -- Broad beans
  ('D032', 64.37::numeric, 0.94::numeric, 0.61::numeric, 40.18::numeric, 20.74::numeric, 362::numeric, 67.97::numeric, 9.03::numeric, 6.38::numeric, 0::numeric, 11.58::numeric, 0.06::numeric, 93.2::numeric, 10.98::numeric, 0.12::numeric, 0.1::numeric, 0.76::numeric, 0.23::numeric, 20.46::numeric, 0::numeric, 0.04262::numeric, 20.25::numeric),
  -- Capsicum, green
  ('D033', 14.75::numeric, 0.48::numeric, 0.15::numeric, 11.84::numeric, 1.84::numeric, 154::numeric, 23::numeric, 0.18::numeric, 328::numeric, 0::numeric, 0.7::numeric, 0.07::numeric, 24.66::numeric, 123::numeric, 0.05::numeric, 0.03::numeric, 0.56::numeric, 0.15::numeric, 51.85::numeric, 0::numeric, 0.07703::numeric, 19.12::numeric),
  -- Capsicum, red
  ('D034', 15.76::numeric, 0.38::numeric, 0.34::numeric, 19.57::numeric, 1.7::numeric, 224::numeric, 30.81::numeric, 0.34::numeric, 246::numeric, 0::numeric, 0.52::numeric, 0.19::numeric, 28.42::numeric, 112::numeric, 0.1::numeric, 0.03::numeric, 0.66::numeric, 0.24::numeric, 62.54::numeric, 0::numeric, 0.08639::numeric, 16.28::numeric),
  -- Capsicum, yellow
  ('D035', 19.13::numeric, 0.69::numeric, 0.26::numeric, 17.23::numeric, 1.56::numeric, 242::numeric, 43.33::numeric, 0.28::numeric, 166::numeric, 0::numeric, 0.89::numeric, 0.18::numeric, 35.25::numeric, 127::numeric, 0.14::numeric, 0.02::numeric, 0.59::numeric, 0.25::numeric, 66.15::numeric, 0::numeric, 0.102::numeric, 18.07::numeric),
  -- Cauliflower
  ('D036', 25.16::numeric, 0.96::numeric, 0.31::numeric, 23.08::numeric, 30.72::numeric, 329::numeric, 47.33::numeric, 0.47::numeric, 1.59::numeric, 0::numeric, 1.32::numeric, 0.02::numeric, 14.33::numeric, 47.14::numeric, 0.04::numeric, 0.07::numeric, 0.31::numeric, 0.13::numeric, 45.95::numeric, 0::numeric, 0.117::numeric, 9.82::numeric),
  -- Celery stalk
  ('D037', 38.73::numeric, 1.36::numeric, 0.18::numeric, 17.12::numeric, 10.68::numeric, 298::numeric, 44.84::numeric, 3.59::numeric, 465::numeric, 0::numeric, 1.39::numeric, 0.03::numeric, 25.87::numeric, 12.3::numeric, 0.03::numeric, 0.04::numeric, 0.48::numeric, 0.06::numeric, 22.48::numeric, 0::numeric, 0.06276::numeric, 54.23::numeric),
  -- Cho-cho-marrow
  ('D038', 18.64::numeric, 0.48::numeric, 0.1::numeric, 13.05::numeric, 1.28::numeric, 120::numeric, 21.61::numeric, 0.16::numeric, 1.57::numeric, 0::numeric, 5.46::numeric, 0.09::numeric, 1.78::numeric, 20.21::numeric, 0.01::numeric, 0.03::numeric, 0.23::numeric, 0.07::numeric, 63.03::numeric, 0::numeric, 0.07612::numeric, 1.55::numeric),
  -- Cluster beans
  ('D039', 121::numeric, 3.9::numeric, 0.61::numeric, 81.74::numeric, 4.05::numeric, 301::numeric, 45.28::numeric, 1.59::numeric, 241::numeric, 0::numeric, 13.72::numeric, 0.81::numeric, 23.7::numeric, 17.96::numeric, 0.05::numeric, 0.03::numeric, 0.71::numeric, 0.12::numeric, 41.24::numeric, 0::numeric, 0.107::numeric, 16.49::numeric),
  -- Colocasia, stem, black
  ('D040', 29.46::numeric, 0.77::numeric, 0.54::numeric, 11.07::numeric, 0.45::numeric, 381::numeric, 20.31::numeric, 0.82::numeric, 4.97::numeric, 0::numeric, 0.21::numeric, 0.06::numeric, 35.75::numeric, 5.15::numeric, 0.02::numeric, 0.04::numeric, 0.16::numeric, 0.06::numeric, 30.88::numeric, 0::numeric, 0.103::numeric, 250::numeric),
  -- Colocasia, stem, green
  ('D041', 40.21::numeric, 0.55::numeric, 0.2::numeric, 19.56::numeric, 0.6::numeric, 414::numeric, 30.73::numeric, 1.48::numeric, 2.3::numeric, 0::numeric, 0.14::numeric, 0.09::numeric, 33.68::numeric, 5.83::numeric, 0.02::numeric, 0.03::numeric, 0.22::numeric, 0.07::numeric, 25.32::numeric, 0::numeric, 0.06753::numeric, 229::numeric),
  -- Corn, Baby
  ('D042', 76.51::numeric, 1.45::numeric, 1.13::numeric, 25.47::numeric, 1.4::numeric, 260::numeric, 8.69::numeric, 0.22::numeric, 1.52::numeric, 0::numeric, 31.2::numeric, 0.13::numeric, 75.05::numeric, 8.59::numeric, 0.15::numeric, 0.07::numeric, 0.53::numeric, 0.16::numeric, 45.53::numeric, 0::numeric, 0.211::numeric, 9.22::numeric),
  -- Cucumber, green, elongate
  ('D043', 16.39::numeric, 0.46::numeric, 0.17::numeric, 20.38::numeric, 6.33::numeric, 183::numeric, 28.34::numeric, 0.17::numeric, 5.33::numeric, 0::numeric, 1.26::numeric, 0.02::numeric, 8.2::numeric, 6.11::numeric, 0.02::numeric, 0.01::numeric, 0.35::numeric, 0.06::numeric, 16.84::numeric, 0::numeric, 0.06417::numeric, 12.13::numeric),
  -- Cucumber, green, short
  ('D044', 19.25::numeric, 0.59::numeric, 0.19::numeric, 18.48::numeric, 6.11::numeric, 198::numeric, 29.74::numeric, 0.19::numeric, 4.8::numeric, 0::numeric, 1.36::numeric, 0.02::numeric, 8::numeric, 6.21::numeric, 0.02::numeric, 0.01::numeric, 0.35::numeric, 0.07::numeric, 14.67::numeric, 0::numeric, 0.06777::numeric, 10.49::numeric),
  -- Cucumber, orange, round
  ('D045', 21.98::numeric, 0.45::numeric, 0.16::numeric, 20.34::numeric, 8.16::numeric, 185::numeric, 23.17::numeric, 0.14::numeric, 5.55::numeric, 0::numeric, 1.59::numeric, 0.02::numeric, 7.5::numeric, 6.24::numeric, 0.02::numeric, 0.01::numeric, 0.36::numeric, 0.04::numeric, 18.77::numeric, 0::numeric, 0.0719::numeric, 11.55::numeric),
  -- Drumstick
  ('D046', 33.3::numeric, 0.73::numeric, 0.31::numeric, 38.1::numeric, 22.38::numeric, 419::numeric, 52.87::numeric, 3.12::numeric, 17.28::numeric, 0::numeric, 1.67::numeric, 0.31::numeric, 358::numeric, 71.86::numeric, 0.04::numeric, 0.07::numeric, 0.62::numeric, 0.12::numeric, 62.75::numeric, 0::numeric, 0.02905::numeric, 123::numeric),
  -- Field beans, tender, broad
  ('D047', 70.57::numeric, 1.95::numeric, 0.64::numeric, 50.88::numeric, 14.14::numeric, 345::numeric, 73.3::numeric, 0::numeric, 638.5::numeric, 0::numeric, 7.14::numeric, 0.11::numeric, 26.45::numeric, 5.99::numeric, 0.07::numeric, 0.07::numeric, 0.32::numeric, 0.42::numeric, 123::numeric, 0::numeric, 0.182::numeric, 34.83::numeric),
  -- Field beans, tender, lean
  ('D048', 58.59::numeric, 1.48::numeric, 0.63::numeric, 47.42::numeric, 12.76::numeric, 314::numeric, 76.54::numeric, 0::numeric, 630.3::numeric, 0::numeric, 7.2::numeric, 0.1::numeric, 26.35::numeric, 3.84::numeric, 0.08::numeric, 0.07::numeric, 0.33::numeric, 0.38::numeric, 127::numeric, 0::numeric, 0.175::numeric, 35.12::numeric),
  -- French beans, country
  ('D049', 55.99::numeric, 1.25::numeric, 0.5::numeric, 43.01::numeric, 8.84::numeric, 324::numeric, 59.86::numeric, 0::numeric, 416.6::numeric, 0::numeric, 1.82::numeric, 0.07::numeric, 15.12::numeric, 15.81::numeric, 0.04::numeric, 0.06::numeric, 0.83::numeric, 0.37::numeric, 47.45::numeric, 0::numeric, 0.07107::numeric, 36.01::numeric),
  -- French beans, hybrid
  ('D050', 49.9::numeric, 0.98::numeric, 0.37::numeric, 34.98::numeric, 9.18::numeric, 317::numeric, 45.9::numeric, 0::numeric, 391.2::numeric, 0::numeric, 1.85::numeric, 0.09::numeric, 15.14::numeric, 1.38::numeric, 0.05::numeric, 0.05::numeric, 0.77::numeric, 0.44::numeric, 61.98::numeric, 0::numeric, 0.0668::numeric, 36.97::numeric),
  -- Jack fruit, raw
  ('D051', 45.74::numeric, 0.31::numeric, 0.17::numeric, 26.6::numeric, 3.53::numeric, 327::numeric, 27.78::numeric, 0::numeric, 0::numeric, 0::numeric, 6.84::numeric, 0.05::numeric, 22.3::numeric, 17.51::numeric, 0.05::numeric, 0.05::numeric, 0.19::numeric, 0.04::numeric, 35.73::numeric, 0::numeric, 0.04736::numeric, 9.6::numeric),
  -- Jack fruit, seed, mature
  ('D052', 37.56::numeric, 0.37::numeric, 0.29::numeric, 37.04::numeric, 4::numeric, 376::numeric, 29.33::numeric, 0.33::numeric, 0::numeric, 0::numeric, 1.4::numeric, 0.06::numeric, 13.56::numeric, 9.68::numeric, 0.06::numeric, 0.03::numeric, 0.19::numeric, 0.08::numeric, 54.58::numeric, 0::numeric, 0.146::numeric, 38.51::numeric),
  -- Knol - Khol
  ('D053', 35.26::numeric, 0.24::numeric, 0.15::numeric, 19.05::numeric, 27.46::numeric, 327::numeric, 40.77::numeric, 0::numeric, 0::numeric, 0::numeric, 0.32::numeric, 0.17::numeric, 8.9::numeric, 64.7::numeric, 0.04::numeric, 0.06::numeric, 0.37::numeric, 0.19::numeric, 14.76::numeric, 0::numeric, 0.0974::numeric, 2.92::numeric),
  -- Kovai, big
  ('D054', 34.39::numeric, 0.38::numeric, 0.18::numeric, 19.6::numeric, 1.53::numeric, 198::numeric, 36.9::numeric, 0::numeric, 134::numeric, 0::numeric, 6.25::numeric, 0.72::numeric, 19.15::numeric, 17.62::numeric, 0.04::numeric, 0.02::numeric, 0.55::numeric, 0.08::numeric, 48.68::numeric, 0::numeric, 0.06884::numeric, 7.72::numeric),
  -- Kovai, small
  ('D055', 37.12::numeric, 0.29::numeric, 0.13::numeric, 18.87::numeric, 2.2::numeric, 167::numeric, 26.29::numeric, 0::numeric, 147::numeric, 0::numeric, 6.06::numeric, 0.7::numeric, 19.1::numeric, 21.08::numeric, 0.04::numeric, 0.02::numeric, 0.51::numeric, 0.05::numeric, 50.13::numeric, 0::numeric, 0.07533::numeric, 8.15::numeric),
  -- Ladies finger
  ('D056', 86.12::numeric, 0.84::numeric, 0.45::numeric, 66.1::numeric, 7.37::numeric, 263::numeric, 57.48::numeric, 0::numeric, 69.1::numeric, 0::numeric, 7.46::numeric, 0.5::numeric, 21.52::numeric, 22.51::numeric, 0.04::numeric, 0.07::numeric, 0.61::numeric, 0.27::numeric, 63.68::numeric, 0::numeric, 0.06937::numeric, 83.87::numeric),
  -- Mango, green, raw
  ('D057', 27::numeric, 0.4::numeric, 0.09::numeric, 17.54::numeric, 33.15::numeric, 147::numeric, 14.92::numeric, 0::numeric, 84.31::numeric, 0::numeric, 7.68::numeric, 0.91::numeric, 14.42::numeric, 90.24::numeric, 0.02::numeric, 0.02::numeric, 0.26::numeric, 0.13::numeric, 25.86::numeric, 0::numeric, 0.02728::numeric, 7.51::numeric),
  -- Onion, stalk
  ('D058', 31.12::numeric, 3.09::numeric, 0.99::numeric, 66.71::numeric, 15.52::numeric, 312::numeric, 28.53::numeric, 5.22::numeric, 700::numeric, 0::numeric, 6.81::numeric, 0.81::numeric, 44.33::numeric, 27.23::numeric, 0.03::numeric, 0.05::numeric, 0.14::numeric, 0.17::numeric, 57.61::numeric, 0::numeric, 0.09208::numeric, 29.72::numeric),
  -- Papaya, raw
  ('D059', 22.72::numeric, 0.2::numeric, 0.08::numeric, 15.03::numeric, 7.55::numeric, 173::numeric, 24.11::numeric, 1.29::numeric, 240.8::numeric, 0::numeric, 7.8::numeric, 0.07::numeric, 2.45::numeric, 20.73::numeric, 0.02::numeric, 0.03::numeric, 0.12::numeric, 0.03::numeric, 29.79::numeric, 0::numeric, 0.06915::numeric, 9.38::numeric),
  -- Parwar
  ('D060', 30.76::numeric, 0.5::numeric, 0.23::numeric, 24.59::numeric, 2.29::numeric, 117::numeric, 33.81::numeric, 2.32::numeric, 13.1::numeric, 0::numeric, 0.69::numeric, 0.04::numeric, 8.37::numeric, 19.24::numeric, 0.05::numeric, 0.05::numeric, 0.67::numeric, 0.2::numeric, 19.96::numeric, 0::numeric, 0.09593::numeric, 3.24::numeric),
  -- Peas, fresh
  ('D061', 28.24::numeric, 1.58::numeric, 1.09::numeric, 40.11::numeric, 3.66::numeric, 249::numeric, 55.95::numeric, 1.63::numeric, 121::numeric, 0::numeric, 12.91::numeric, 0.21::numeric, 44.22::numeric, 38.4::numeric, 0.27::numeric, 0.03::numeric, 1.28::numeric, 0.19::numeric, 54.77::numeric, 0::numeric, 0.01901::numeric, 18.42::numeric),
  -- Plantain, flower
  ('D062', 34.06::numeric, 0.4::numeric, 0.42::numeric, 39.76::numeric, 7.51::numeric, 488::numeric, 47.31::numeric, 2.82::numeric, 35.36::numeric, 0::numeric, 1.29::numeric, 0.19::numeric, 3.38::numeric, 6.49::numeric, 0.02::numeric, 0.02::numeric, 0.28::numeric, 0.13::numeric, 49.27::numeric, 0::numeric, 0.273::numeric, 169::numeric),
  -- Plantain, green
  ('D063', 13.8::numeric, 0.34::numeric, 0.23::numeric, 35.64::numeric, 18.57::numeric, 402::numeric, 31.69::numeric, 0.82::numeric, 3.01::numeric, 0::numeric, 0.27::numeric, 0.08::numeric, 17.42::numeric, 23.28::numeric, 0.01::numeric, 0.05::numeric, 0.33::numeric, 0.1::numeric, 18.96::numeric, 0::numeric, 0.05713::numeric, 85.25::numeric),
  -- Plantain, stem
  ('D064', 11.24::numeric, 0.26::numeric, 0.14::numeric, 32.82::numeric, 23.17::numeric, 373::numeric, 16.31::numeric, 0.45::numeric, 2.39::numeric, 0::numeric, 0.32::numeric, 0.02::numeric, 2.5::numeric, 3.77::numeric, 0.02::numeric, 0.02::numeric, 0.18::numeric, 0.14::numeric, 12.85::numeric, 0::numeric, 0.02745::numeric, 213::numeric),
  -- Pumpkin, green, cylindrical
  ('D065', 24.1::numeric, 0.29::numeric, 0.14::numeric, 13.27::numeric, 5.21::numeric, 186::numeric, 24.51::numeric, 0.34::numeric, 426.9::numeric, 0::numeric, 1.07::numeric, 0.87::numeric, 80.8::numeric, 7.29::numeric, 0.03::numeric, 0.02::numeric, 0.44::numeric, 0.05::numeric, 31.6::numeric, 0::numeric, 0.05332::numeric, 57.33::numeric),
  -- Pumpkin, orange, round
  ('D066', 23.06::numeric, 0.36::numeric, 0.11::numeric, 10.43::numeric, 8.81::numeric, 253::numeric, 22.18::numeric, 0.37::numeric, 239.7::numeric, 0::numeric, 1.4::numeric, 0.6::numeric, 83.7::numeric, 8.04::numeric, 0.03::numeric, 0.03::numeric, 0.41::numeric, 0.08::numeric, 24.14::numeric, 0::numeric, 0.04458::numeric, 41.22::numeric),
  -- Red gram, tender, fresh
  ('D067', 58.58::numeric, 1.18::numeric, 1.1::numeric, 56.95::numeric, 2.54::numeric, 616::numeric, 141::numeric, 2.19::numeric, 165::numeric, 0::numeric, 28.96::numeric, 0.94::numeric, 14.9::numeric, 15.13::numeric, 0.23::numeric, 0.09::numeric, 2.14::numeric, 0.3::numeric, 94.21::numeric, 0::numeric, 0.211::numeric, 19.83::numeric),
  -- Ridge gourd
  ('D068', 13.7::numeric, 0.42::numeric, 0.22::numeric, 16.15::numeric, 4.71::numeric, 118::numeric, 33.06::numeric, 0.59::numeric, 348::numeric, 0::numeric, 0.37::numeric, 0.02::numeric, 11.23::numeric, 5.42::numeric, 0.02::numeric, 0.01::numeric, 0.2::numeric, 0.07::numeric, 29.26::numeric, 0::numeric, 0.05449::numeric, 29.55::numeric),
  -- Ridge gourd, smooth skin
  ('D069', 14.96::numeric, 0.5::numeric, 0.26::numeric, 17.66::numeric, 6.27::numeric, 125::numeric, 39.25::numeric, 0::numeric, 349::numeric, 0::numeric, 0.34::numeric, 0.02::numeric, 11.57::numeric, 8.1::numeric, 0.02::numeric, 0.01::numeric, 0.21::numeric, 0.09::numeric, 27.36::numeric, 0::numeric, 0.04307::numeric, 35.85::numeric),
  -- Snake gourd, long, pale green
  ('D070', 24.6::numeric, 0.32::numeric, 0.14::numeric, 18.7::numeric, 7.07::numeric, 100::numeric, 23.27::numeric, 0::numeric, 61.29::numeric, 0::numeric, 2.67::numeric, 0.01::numeric, 8.35::numeric, 2.72::numeric, 0.03::numeric, 0.03::numeric, 0.34::numeric, 0.1::numeric, 18.34::numeric, 0::numeric, 0.0949::numeric, 24.22::numeric),
  -- Snake gourd, long, dark green
  ('D071', 27.11::numeric, 0.47::numeric, 0.2::numeric, 21.7::numeric, 5.04::numeric, 104::numeric, 31.03::numeric, 0::numeric, 61.64::numeric, 0::numeric, 3.08::numeric, 0.01::numeric, 8.4::numeric, 2.85::numeric, 0.03::numeric, 0.03::numeric, 0.33::numeric, 0.07::numeric, 16.52::numeric, 0::numeric, 0.09587::numeric, 13.44::numeric),
  -- Snake gourd, short
  ('D072', 17.9::numeric, 0.2::numeric, 0.11::numeric, 15.07::numeric, 2.5::numeric, 84::numeric, 21.33::numeric, 0::numeric, 62.84::numeric, 0::numeric, 3.12::numeric, 0.01::numeric, 8.3::numeric, 2.3::numeric, 0.03::numeric, 0.02::numeric, 0.33::numeric, 0.06::numeric, 17.74::numeric, 0::numeric, 0.1::numeric, 14.25::numeric),
  -- Tinda, tender
  ('D073', 19.68::numeric, 0.41::numeric, 0.2::numeric, 18.96::numeric, 20.61::numeric, 56.18::numeric, 30.37::numeric, 0.22::numeric, 7.96::numeric, 0::numeric, 2.76::numeric, 0.05::numeric, 2.73::numeric, 14.2::numeric, 0.02::numeric, 0.03::numeric, 0.56::numeric, 0.06::numeric, 43.23::numeric, 0::numeric, 0.04897::numeric, 3.36::numeric),
  -- Tomato, green
  ('D074', 8.49::numeric, 0.42::numeric, 0.16::numeric, 13.57::numeric, 13.11::numeric, 225::numeric, 22.5::numeric, 8.25::numeric, 38.13::numeric, 0::numeric, 1.1::numeric, 0.39::numeric, 16.1::numeric, 16.41::numeric, 0.08::numeric, 0.05::numeric, 0.46::numeric, 0.07::numeric, 12.51::numeric, 0::numeric, 0.04691::numeric, 8.47::numeric),
  -- Tomato, ripe, hybrid
  ('D075', 8.9::numeric, 0.22::numeric, 0.11::numeric, 11.86::numeric, 11.86::numeric, 167::numeric, 15.45::numeric, 0::numeric, 1520::numeric, 0::numeric, 11.83::numeric, 0.22::numeric, 24.12::numeric, 25.27::numeric, 0.04::numeric, 0.02::numeric, 0.51::numeric, 0.08::numeric, 15.41::numeric, 0::numeric, 0.04765::numeric, 2.89::numeric),
  -- Tomato, ripe, local
  ('D076', 10.17::numeric, 0.3::numeric, 0.12::numeric, 13.65::numeric, 9.73::numeric, 204::numeric, 18.77::numeric, 0::numeric, 914.4::numeric, 0::numeric, 12.24::numeric, 0.27::numeric, 17.18::numeric, 27.47::numeric, 0.03::numeric, 0.03::numeric, 0.52::numeric, 0.09::numeric, 19.46::numeric, 0::numeric, 0.07956::numeric, 5.58::numeric),
  -- Zucchini, green
  ('D077', 17.26::numeric, 0.52::numeric, 0.29::numeric, 15.41::numeric, 0.4::numeric, 178::numeric, 21.38::numeric, 0.21::numeric, 85.79::numeric, 0::numeric, 0.4::numeric, 3.9::numeric, 41.05::numeric, 15.78::numeric, 0.05::numeric, 0.09::numeric, 1.03::numeric, 0.25::numeric, 18.85::numeric, 0::numeric, 0.119::numeric, 17.83::numeric),
  -- Zucchini, yellow
  ('D078', 20.98::numeric, 0.34::numeric, 0.27::numeric, 10.82::numeric, 0.39::numeric, 131::numeric, 32.03::numeric, 0.3::numeric, 69.9::numeric, 0::numeric, 0.38::numeric, 1.48::numeric, 53.28::numeric, 16.71::numeric, 0.03::numeric, 0.02::numeric, 0.42::numeric, 0.2::numeric, 21.5::numeric, 0::numeric, 0.05692::numeric, 16.06::numeric),
  -- Apple, big
  ('E001', 13.68::numeric, 0.26::numeric, 0.09::numeric, 8.09::numeric, 1.43::numeric, 116::numeric, 10.44::numeric, 0.47::numeric, 2.41::numeric, 0::numeric, 1.46::numeric, 0.15::numeric, 3.65::numeric, 3.57::numeric, 0.03::numeric, 0.01::numeric, 0.25::numeric, 0.04::numeric, 3.04::numeric, 0::numeric, 0.154::numeric, 13.19::numeric),
  -- Apple, green
  ('E002', 6.53::numeric, 0.2::numeric, 0.08::numeric, 5.42::numeric, 1.47::numeric, 94.55::numeric, 7.48::numeric, 0.25::numeric, 2.2::numeric, 0::numeric, 2.45::numeric, 0.1::numeric, 2.13::numeric, 2.9::numeric, 0.01::numeric, 0.02::numeric, 0.21::numeric, 0.08::numeric, 3.43::numeric, 0::numeric, 0.116::numeric, 17.63::numeric),
  -- Apple, small
  ('E003', 5.39::numeric, 0.25::numeric, 0.05::numeric, 5.48::numeric, 1.45::numeric, 100::numeric, 8.39::numeric, 0.23::numeric, 2.08::numeric, 0::numeric, 1.86::numeric, 0.07::numeric, 2.18::numeric, 4::numeric, 0.01::numeric, 0.01::numeric, 0.09::numeric, 0.03::numeric, 3.52::numeric, 0::numeric, 0.149::numeric, 15.51::numeric),
  -- Apple, small, Kashmir
  ('E004', 4.72::numeric, 0.21::numeric, 0.08::numeric, 5.19::numeric, 1.22::numeric, 106::numeric, 10.72::numeric, 0.11::numeric, 2.11::numeric, 0::numeric, 2.04::numeric, 0.05::numeric, 2.55::numeric, 4.24::numeric, 0.01::numeric, 0.01::numeric, 0.09::numeric, 0.04::numeric, 3.97::numeric, 0::numeric, 0.176::numeric, 14.35::numeric),
  -- Apricot, dried
  ('E005', 28.57::numeric, 2.5::numeric, 0.41::numeric, 14.04::numeric, 3.94::numeric, 285::numeric, 72.02::numeric, 2.05::numeric, 1806::numeric, 0::numeric, 3.98::numeric, 0.11::numeric, 5.17::numeric, 0.42::numeric, 0.04::numeric, 0.04::numeric, 1.66::numeric, 0.1::numeric, 10.5::numeric, 0::numeric, 0.2::numeric, 113::numeric),
  -- Apricot, processed
  ('E006', 5.42::numeric, 1.12::numeric, 0.26::numeric, 4.29::numeric, 1.6::numeric, 95::numeric, 27.33::numeric, 1.03::numeric, 1372::numeric, 0::numeric, 4.31::numeric, 0.01::numeric, 6.14::numeric, 7.98::numeric, 0.25::numeric, 0.04::numeric, 1.07::numeric, 0.17::numeric, 5.42::numeric, 0::numeric, 0.185::numeric, 44.87::numeric),
  -- Avocado fruit
  ('E007', 28.48::numeric, 0.81::numeric, 0.75::numeric, 48.14::numeric, 2.81::numeric, 377::numeric, 63.14::numeric, 0::numeric, 12::numeric, 0::numeric, 2.1::numeric, 0.02::numeric, 38.74::numeric, 9.36::numeric, 0.07::numeric, 0.08::numeric, 0.9::numeric, 0.18::numeric, 67.17::numeric, 0::numeric, 1.237::numeric, 2.78::numeric),
  -- Bael fruit
  ('E008', 47.95::numeric, 0.23::numeric, 0.14::numeric, 34.1::numeric, 1.56::numeric, 409::numeric, 37.29::numeric, 0.72::numeric, 2.5::numeric, 0::numeric, 1.6::numeric, 0.6::numeric, 4.5::numeric, 7.5::numeric, 0.03::numeric, 0.04::numeric, 0.25::numeric, 0.03::numeric, 55.22::numeric, 0::numeric, 0.19::numeric, 3.87::numeric),
  -- Banana, ripe, montham
  ('E009', 6.77::numeric, 0.4::numeric, 0.15::numeric, 30.22::numeric, 1.25::numeric, 362::numeric, 20.85::numeric, 0::numeric, 56.63::numeric, 0::numeric, 0.2::numeric, 0.09::numeric, 2.2::numeric, 8.06::numeric, 0.01::numeric, 0.04::numeric, 0.48::numeric, 0.51::numeric, 17.93::numeric, 0::numeric, 0.11::numeric, 2.8::numeric),
  -- Banana, ripe, poovam
  ('E010', 8.73::numeric, 0.35::numeric, 0.17::numeric, 43.79::numeric, 1::numeric, 335::numeric, 33.63::numeric, 0::numeric, 59.04::numeric, 0::numeric, 0.24::numeric, 0.08::numeric, 2.6::numeric, 6.74::numeric, 0.01::numeric, 0.03::numeric, 0.43::numeric, 0.5::numeric, 19.95::numeric, 0::numeric, 0.113::numeric, 2.38::numeric),
  -- Banana, ripe, red
  ('E011', 9.56::numeric, 0.24::numeric, 0.09::numeric, 31.44::numeric, 1.11::numeric, 313::numeric, 23.27::numeric, 0::numeric, 53.64::numeric, 0::numeric, 0.21::numeric, 0.09::numeric, 1.9::numeric, 6.74::numeric, 0.01::numeric, 0.02::numeric, 0.46::numeric, 0.45::numeric, 18.92::numeric, 0::numeric, 0.106::numeric, 4.15::numeric),
  -- Banana, ripe, robusta
  ('E012', 5.07::numeric, 0.28::numeric, 0.14::numeric, 34.98::numeric, 0.85::numeric, 306::numeric, 24.32::numeric, 0::numeric, 60.35::numeric, 0::numeric, 0.22::numeric, 0.09::numeric, 2.8::numeric, 4.76::numeric, 0.01::numeric, 0.03::numeric, 0.47::numeric, 0.44::numeric, 16.81::numeric, 0::numeric, 0.114::numeric, 3.24::numeric),
  -- Black berry
  ('E013', 23.81::numeric, 0.63::numeric, 0.11::numeric, 30.9::numeric, 1.21::numeric, 205::numeric, 20.08::numeric, 0::numeric, 52.32::numeric, 0::numeric, 14.65::numeric, 0.52::numeric, 1.82::numeric, 19.45::numeric, 0.01::numeric, 0.02::numeric, 0.4::numeric, 0.05::numeric, 22.95::numeric, 0::numeric, 0.195::numeric, 5.33::numeric),
  -- Cherries, red
  ('E014', 23.88::numeric, 0.36::numeric, 0.12::numeric, 14.37::numeric, 1.64::numeric, 165::numeric, 25.31::numeric, 0::numeric, 40.78::numeric, 0::numeric, 4.3::numeric, 0.06::numeric, 5.56::numeric, 8.82::numeric, 0.07::numeric, 0.02::numeric, 0.19::numeric, 0.04::numeric, 4.92::numeric, 0::numeric, 0.125::numeric, 6.15::numeric),
  -- Currants, black
  ('E015', 40.32::numeric, 1.36::numeric, 0.21::numeric, 16.66::numeric, 1.45::numeric, 283::numeric, 78.8::numeric, 1.51::numeric, 62.48::numeric, 0::numeric, 3.01::numeric, 0.45::numeric, 27.52::numeric, 182::numeric, 0.03::numeric, 0.03::numeric, 0.35::numeric, 0.09::numeric, 8.48::numeric, 0::numeric, 0.08333::numeric, 10.8::numeric),
  -- Custard apple
  ('E016', 28.2::numeric, 0.42::numeric, 0.22::numeric, 38.47::numeric, 3.11::numeric, 278::numeric, 40.81::numeric, 0::numeric, 0::numeric, 0::numeric, 0.18::numeric, 0.19::numeric, 58::numeric, 21.51::numeric, 0.13::numeric, 0.09::numeric, 0.69::numeric, 0.07::numeric, 7.6::numeric, 0::numeric, 0.138::numeric, 35.1::numeric),
  -- Dates, dry, pale brown
  ('E017', 71.2::numeric, 3.2::numeric, 0.7::numeric, 73.79::numeric, 3.27::numeric, 804::numeric, 73.02::numeric, 0.78::numeric, 2700::numeric, 0::numeric, 2.6::numeric, 0.03::numeric, 3.34::numeric, 4.42::numeric, 0.03::numeric, 0.03::numeric, 1.47::numeric, 0.14::numeric, 18.65::numeric, 0::numeric, 0.09703::numeric, 2.11::numeric),
  -- Dates, dry, dark brown
  ('E018', 66.13::numeric, 4.79::numeric, 0.58::numeric, 75.23::numeric, 3.09::numeric, 782::numeric, 70.26::numeric, 0.77::numeric, 2705::numeric, 0::numeric, 0.68::numeric, 0.03::numeric, 4.53::numeric, 3.84::numeric, 0.02::numeric, 0.03::numeric, 1.09::numeric, 0.153::numeric, 12.8::numeric, 0::numeric, 0.114::numeric, 1.98::numeric),
  -- Dates, processed
  ('E019', 15.73::numeric, 0.89::numeric, 0.42::numeric, 14.34::numeric, 1.6::numeric, 289::numeric, 33.88::numeric, 0.46::numeric, 2781::numeric, 0::numeric, 0.83::numeric, 0.03::numeric, 4.93::numeric, 15.51::numeric, 0.05::numeric, 0.02::numeric, 0.51::numeric, 0.06::numeric, 24.53::numeric, 0::numeric, 0.149::numeric, 1.96::numeric),
  -- Fig
  ('E020', 78.52::numeric, 0.69::numeric, 0.22::numeric, 26.18::numeric, 2.37::numeric, 231::numeric, 21.62::numeric, 0::numeric, 2.4::numeric, 0::numeric, 1.47::numeric, 0.54::numeric, 5.75::numeric, 16.92::numeric, 0.04::numeric, 0.02::numeric, 0.27::numeric, 0.15::numeric, 13.67::numeric, 0::numeric, 0.08944::numeric, 46.71::numeric),
  -- Goosberry
  ('E021', 20.14::numeric, 1.25::numeric, 0.05::numeric, 6.5::numeric, 1.37::numeric, 223::numeric, 21.85::numeric, 0::numeric, 1.58::numeric, 0::numeric, 0.27::numeric, 0.12::numeric, 1.64::numeric, 252::numeric, 0.01::numeric, 0.03::numeric, 0.12::numeric, 0.27::numeric, 7.86::numeric, 0::numeric, 0.03848::numeric, 7.96::numeric),
  -- Grapes, seeded, round, black
  ('E022', 10.57::numeric, 0.22::numeric, 0.05::numeric, 7.47::numeric, 1.93::numeric, 171::numeric, 21.04::numeric, 0::numeric, 29.36::numeric, 0::numeric, 6.19::numeric, 0.05::numeric, 3.65::numeric, 18.3::numeric, 0.03::numeric, 0.03::numeric, 0.14::numeric, 0.11::numeric, 8.69::numeric, 0::numeric, 0.106::numeric, 26.12::numeric),
  -- Grapes, seeded, round, green
  ('E023', 11.16::numeric, 0.24::numeric, 0.05::numeric, 6.87::numeric, 1.89::numeric, 166::numeric, 19.5::numeric, 0::numeric, 30.77::numeric, 0::numeric, 3.59::numeric, 0.07::numeric, 7.26::numeric, 17.1::numeric, 0.03::numeric, 0.02::numeric, 0.13::numeric, 0.09::numeric, 8.35::numeric, 0::numeric, 0.09242::numeric, 25.74::numeric),
  -- Grapes, seeded, round, red
  ('E024', 11.27::numeric, 0.33::numeric, 0.07::numeric, 7.06::numeric, 1.59::numeric, 188::numeric, 27.91::numeric, 0::numeric, 19.94::numeric, 0::numeric, 6.87::numeric, 0.07::numeric, 5.2::numeric, 20.59::numeric, 0.04::numeric, 0.03::numeric, 0.1::numeric, 0.1::numeric, 7.49::numeric, 0::numeric, 0.09204::numeric, 23.92::numeric),
  -- Grapes, seedless, oval, black
  ('E025', 15.26::numeric, 0.28::numeric, 0.1::numeric, 11.29::numeric, 1.83::numeric, 237::numeric, 29.02::numeric, 0::numeric, 19.73::numeric, 0::numeric, 6.42::numeric, 0.05::numeric, 3.4::numeric, 27.32::numeric, 0.03::numeric, 0.02::numeric, 0.15::numeric, 0.11::numeric, 7.22::numeric, 0::numeric, 0.04563::numeric, 19.07::numeric),
  -- Grapes, seedless, round, green
  ('E026', 14.22::numeric, 0.24::numeric, 0.05::numeric, 8.43::numeric, 1.81::numeric, 168::numeric, 20.27::numeric, 0::numeric, 25.46::numeric, 0::numeric, 3.54::numeric, 0.08::numeric, 7.15::numeric, 16.47::numeric, 0.04::numeric, 0.03::numeric, 0.12::numeric, 0.08::numeric, 8.31::numeric, 0::numeric, 0.08711::numeric, 20.06::numeric),
  -- Grapes, seedless, round, black
  ('E027', 18.75::numeric, 0.39::numeric, 0.09::numeric, 10.8::numeric, 1.92::numeric, 235::numeric, 26.68::numeric, 0::numeric, 20.58::numeric, 0::numeric, 6.23::numeric, 0.06::numeric, 3::numeric, 22.79::numeric, 0.03::numeric, 0.03::numeric, 0.13::numeric, 0.08::numeric, 8.89::numeric, 0::numeric, 0.129::numeric, 22.11::numeric),
  -- Guava, white flesh
  ('E028', 18.52::numeric, 0.32::numeric, 0.23::numeric, 15.26::numeric, 2.87::numeric, 283::numeric, 23.54::numeric, 1.84::numeric, 298::numeric, 0::numeric, 1.68::numeric, 0.09::numeric, 3.68::numeric, 214::numeric, 0.05::numeric, 0.04::numeric, 0.6::numeric, 0.11::numeric, 29.76::numeric, 0::numeric, 0.0493::numeric, 13.05::numeric),
  -- Guava, pink flesh
  ('E029', 14.22::numeric, 0.4::numeric, 0.21::numeric, 13.26::numeric, 1.89::numeric, 270::numeric, 29.93::numeric, 2.1::numeric, 267::numeric, 0::numeric, 0.93::numeric, 0.11::numeric, 5.35::numeric, 222::numeric, 0.03::numeric, 0.03::numeric, 0.59::numeric, 0.16::numeric, 32.17::numeric, 0::numeric, 0.02718::numeric, 9.57::numeric),
  -- Jack fruit, ripe
  ('E030', 35.03::numeric, 0.36::numeric, 0.17::numeric, 31.84::numeric, 1.62::numeric, 279::numeric, 23.02::numeric, 0::numeric, 23.53::numeric, 0::numeric, 7.49::numeric, 0.07::numeric, 37::numeric, 6.73::numeric, 0.05::numeric, 0.01::numeric, 0.42::numeric, 0.22::numeric, 32.15::numeric, 0::numeric, 0.03766::numeric, 8.45::numeric),
  -- Jambu fruit, ripe
  ('E031', 25.36::numeric, 0.33::numeric, 0.06::numeric, 27.97::numeric, 2.64::numeric, 103::numeric, 9.6::numeric, 0::numeric, 1.55::numeric, 0::numeric, 0.82::numeric, 0.04::numeric, 7.94::numeric, 16.47::numeric, 0.02::numeric, 0.02::numeric, 0.14::numeric, 0.03::numeric, 7.63::numeric, 0::numeric, 0.06649::numeric, 9.6::numeric),
  -- Karonda fruit
  ('E032', 10.81::numeric, 0.87::numeric, 0.25::numeric, 24.45::numeric, 2.55::numeric, 351::numeric, 32.62::numeric, 1.57::numeric, 15.64::numeric, 0::numeric, 1.43::numeric, 0.04::numeric, 2.5::numeric, 135::numeric, 0.01::numeric, 0.02::numeric, 0.25::numeric, 0.08::numeric, 8.72::numeric, 0::numeric, 0.06681::numeric, 5.88::numeric),
  -- Lemon, juice
  ('E033', 22.68::numeric, 0.12::numeric, 0.08::numeric, 8.9::numeric, 1.21::numeric, 113::numeric, 9.86::numeric, 0::numeric, 2.62::numeric, 0::numeric, 0.39::numeric, 0.06::numeric, 1.8::numeric, 48.16::numeric, 0.04::numeric, 0.01::numeric, 0.1::numeric, 0.03::numeric, 12.43::numeric, 0::numeric, 0.202::numeric, 0::numeric),
  -- Lime, sweet, pulp
  ('E034', 25.79::numeric, 0.11::numeric, 0.05::numeric, 15.4::numeric, 1.17::numeric, 182::numeric, 20.55::numeric, 0.72::numeric, 2.54::numeric, 0::numeric, 0.3::numeric, 0.07::numeric, 2.2::numeric, 46.96::numeric, 0.06::numeric, 0.01::numeric, 0.17::numeric, 0.05::numeric, 15.38::numeric, 0::numeric, 0.0764::numeric, 0.57::numeric),
  -- Litchi
  ('E035', 5.77::numeric, 0.79::numeric, 0.24::numeric, 14.58::numeric, 0.54::numeric, 161::numeric, 23.32::numeric, 0.46::numeric, 1.47::numeric, 0::numeric, 0.33::numeric, 0.06::numeric, 7.81::numeric, 33.82::numeric, 0.02::numeric, 0.06::numeric, 0.23::numeric, 0.07::numeric, 15.69::numeric, 0::numeric, 0.09148::numeric, 15.28::numeric),
  -- Mango, ripe, banganapalli
  ('E036', 15.77::numeric, 0.51::numeric, 0.12::numeric, 13.35::numeric, 1.34::numeric, 144::numeric, 11.07::numeric, 1.91::numeric, 1171::numeric, 0::numeric, 3.71::numeric, 0.28::numeric, 4.77::numeric, 32.97::numeric, 0.03::numeric, 0.04::numeric, 0.26::numeric, 0.12::numeric, 82.05::numeric, 0::numeric, 0.17::numeric, 7.94::numeric),
  -- Mango, ripe, gulabkhas
  ('E037', 19.33::numeric, 0.38::numeric, 0.06::numeric, 11.53::numeric, 1.39::numeric, 115::numeric, 10.66::numeric, 2.05::numeric, 670.6::numeric, 0::numeric, 3.91::numeric, 0.2::numeric, 4.8::numeric, 27.65::numeric, 0.03::numeric, 0.04::numeric, 0.23::numeric, 0.13::numeric, 84.35::numeric, 0::numeric, 0.18::numeric, 7.7::numeric),
  -- Mango, ripe, himsagar
  ('E038', 15.54::numeric, 0.29::numeric, 0.12::numeric, 12.07::numeric, 1.31::numeric, 137::numeric, 12.25::numeric, 1.9::numeric, 1187::numeric, 0::numeric, 3.73::numeric, 0.31::numeric, 4.4::numeric, 49.09::numeric, 0.03::numeric, 0.03::numeric, 0.27::numeric, 0.1::numeric, 90.98::numeric, 0::numeric, 0.174::numeric, 8.09::numeric),
  -- Mango, ripe, kesar
  ('E039', 15.74::numeric, 0.43::numeric, 0.1::numeric, 12.53::numeric, 1.43::numeric, 143::numeric, 12.36::numeric, 1.85::numeric, 1271::numeric, 0::numeric, 3.68::numeric, 0.26::numeric, 4.75::numeric, 29.08::numeric, 0.03::numeric, 0.04::numeric, 0.26::numeric, 0.1::numeric, 90.43::numeric, 0::numeric, 0.172::numeric, 8.31::numeric),
  -- Mango, ripe, neelam
  ('E040', 11.36::numeric, 0.36::numeric, 0.07::numeric, 10.1::numeric, 1.2::numeric, 137::numeric, 11.63::numeric, 1.36::numeric, 1294::numeric, 0::numeric, 3.72::numeric, 0.29::numeric, 5::numeric, 29.93::numeric, 0.03::numeric, 0.04::numeric, 0.23::numeric, 0.12::numeric, 68.7::numeric, 0::numeric, 0.178::numeric, 8.46::numeric),
  -- Mango, ripe, paheri
  ('E041', 15.11::numeric, 0.51::numeric, 0.2::numeric, 14.28::numeric, 1.63::numeric, 153::numeric, 15.18::numeric, 1.44::numeric, 1063::numeric, 0::numeric, 3.62::numeric, 0.37::numeric, 4.8::numeric, 30.75::numeric, 0.03::numeric, 0.04::numeric, 0.28::numeric, 0.23::numeric, 65.28::numeric, 0::numeric, 0.186::numeric, 9.71::numeric),
  -- Mango, ripe, totapari
  ('E042', 13.34::numeric, 0.28::numeric, 0.08::numeric, 12.55::numeric, 1.32::numeric, 160::numeric, 9.87::numeric, 1.85::numeric, 606.6::numeric, 0::numeric, 3.77::numeric, 0.3::numeric, 4.6::numeric, 25.26::numeric, 0.02::numeric, 0.05::numeric, 0.27::numeric, 0.12::numeric, 77.69::numeric, 0::numeric, 0.175::numeric, 11.5::numeric),
  -- Mangosteen
  ('E043', 4.69::numeric, 0.28::numeric, 0.21::numeric, 12::numeric, 3.79::numeric, 46.93::numeric, 7.18::numeric, 0::numeric, 1.8::numeric, 0::numeric, 0::numeric, 0.05::numeric, 5.5::numeric, 26.33::numeric, 0.01::numeric, 0.01::numeric, 0.58::numeric, 0.18::numeric, 13.52::numeric, 0::numeric, 0.176::numeric, 8.44::numeric),
  -- Manila tamarind
  ('E044', 8.51::numeric, 0.71::numeric, 0.56::numeric, 32.98::numeric, 1.35::numeric, 376::numeric, 73.53::numeric, 0::numeric, 2.2::numeric, 0::numeric, 0::numeric, 0.38::numeric, 33.18::numeric, 55.78::numeric, 0.18::numeric, 0.14::numeric, 0.4::numeric, 0.04::numeric, 4.24::numeric, 0::numeric, 0.02781::numeric, 4.32::numeric),
  -- Musk melon, orange flesh
  ('E045', 9.8::numeric, 0.18::numeric, 0.09::numeric, 11.62::numeric, 14.94::numeric, 206::numeric, 17.28::numeric, 0.88::numeric, 771::numeric, 0::numeric, 4.41::numeric, 0.01::numeric, 5.7::numeric, 22.76::numeric, 0.01::numeric, 0.01::numeric, 0.41::numeric, 0.05::numeric, 22.31::numeric, 0::numeric, 0.09294::numeric, 2.62::numeric),
  -- Musk melon, yellow flesh
  ('E046', 9.02::numeric, 0.21::numeric, 0.09::numeric, 9.81::numeric, 15.78::numeric, 196::numeric, 13.09::numeric, 1.35::numeric, 6.87::numeric, 0::numeric, 2.33::numeric, 0.02::numeric, 1.74::numeric, 21.32::numeric, 0.01::numeric, 0.02::numeric, 0.43::numeric, 0.06::numeric, 20.23::numeric, 0::numeric, 0.079::numeric, 1.88::numeric),
  -- Orange, pulp
  ('E047', 19.52::numeric, 0.81::numeric, 0.04::numeric, 11.05::numeric, 1.47::numeric, 164::numeric, 12.9::numeric, 0.19::numeric, 81.72::numeric, 0::numeric, 0.34::numeric, 0.04::numeric, 2.5::numeric, 42.72::numeric, 0.07::numeric, 0.02::numeric, 0.28::numeric, 0.04::numeric, 19.46::numeric, 0::numeric, 0.03711::numeric, 8.06::numeric),
  -- Palm fruit, tender
  ('E048', 0::numeric, 0::numeric, 0.05::numeric, 0::numeric, 1.25::numeric, 158::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.02::numeric, 3.6::numeric, 0.25::numeric, 0.01::numeric, 0.46::numeric, 0::numeric, 0.07::numeric, 24.4::numeric, 0::numeric, 0.03336::numeric, 1.05::numeric),
  -- Papaya, ripe
  ('E049', 15.02::numeric, 0.23::numeric, 0.08::numeric, 10.97::numeric, 6.68::numeric, 173::numeric, 17.73::numeric, 12.78::numeric, 1342::numeric, 0::numeric, 11.47::numeric, 0.04::numeric, 2.59::numeric, 43.09::numeric, 0.03::numeric, 0.11::numeric, 0.33::numeric, 0.04::numeric, 60.9::numeric, 0::numeric, 0.05608::numeric, 5.96::numeric),
  -- Peach
  ('E050', 6.98::numeric, 0.35::numeric, 0.1::numeric, 8.06::numeric, 1.15::numeric, 281::numeric, 19.08::numeric, 0.67::numeric, 0::numeric, 0::numeric, 2.41::numeric, 0.02::numeric, 4.4::numeric, 5.49::numeric, 0.02::numeric, 0.02::numeric, 0.29::numeric, 0.1::numeric, 6.34::numeric, 0::numeric, 0.0239::numeric, 6.35::numeric),
  -- Pear
  ('E051', 6.55::numeric, 0.28::numeric, 0.07::numeric, 7.61::numeric, 1.64::numeric, 106::numeric, 6.74::numeric, 0::numeric, 14.6::numeric, 0::numeric, 1.48::numeric, 0.3::numeric, 12.57::numeric, 3.31::numeric, 0.02::numeric, 0.02::numeric, 0.13::numeric, 0.09::numeric, 5.28::numeric, 0::numeric, 0.07594::numeric, 2.41::numeric),
  -- Phalsa
  ('E052', 153::numeric, 2.01::numeric, 0.48::numeric, 76.92::numeric, 1.99::numeric, 362::numeric, 23.65::numeric, 3.53::numeric, 7.39::numeric, 0::numeric, 1.34::numeric, 0.93::numeric, 5.36::numeric, 5.11::numeric, 0.03::numeric, 0.06::numeric, 0.4::numeric, 0.03::numeric, 22.56::numeric, 0::numeric, 0.164::numeric, 352::numeric),
  -- Pineapple
  ('E053', 10.88::numeric, 0.28::numeric, 0.1::numeric, 12.68::numeric, 1.43::numeric, 143::numeric, 13.56::numeric, 0.08::numeric, 31.21::numeric, 0::numeric, 0.21::numeric, 0.45::numeric, 2.4::numeric, 36.37::numeric, 0.05::numeric, 0.03::numeric, 0.12::numeric, 0.13::numeric, 18.21::numeric, 0::numeric, 0.05109::numeric, 3.39::numeric),
  -- Plum
  ('E054', 7.61::numeric, 0.25::numeric, 0.1::numeric, 7.79::numeric, 1.55::numeric, 162::numeric, 13.83::numeric, 0.56::numeric, 1.32::numeric, 0::numeric, 3.32::numeric, 0.5::numeric, 8.5::numeric, 2.26::numeric, 0.02::numeric, 0.02::numeric, 0.44::numeric, 0.05::numeric, 14.29::numeric, 0::numeric, 0.02005::numeric, 0.74::numeric),
  -- Pomegranate, maroon seeds
  ('E055', 10.65::numeric, 0.31::numeric, 0.18::numeric, 11.07::numeric, 2.13::numeric, 206::numeric, 27.2::numeric, 0.55::numeric, 2.05::numeric, 0::numeric, 109::numeric, 0.03::numeric, 18.5::numeric, 12.69::numeric, 0.06::numeric, 0.01::numeric, 0.2::numeric, 0.29::numeric, 38.64::numeric, 0::numeric, 0.0425::numeric, 253::numeric),
  -- Pummelo
  ('E056', 14.03::numeric, 0.06::numeric, 0.06::numeric, 6.83::numeric, 1.06::numeric, 189::numeric, 13.99::numeric, 0::numeric, 11.98::numeric, 0::numeric, 0.98::numeric, 0.5::numeric, 4.88::numeric, 48.89::numeric, 0.06::numeric, 0.02::numeric, 0.23::numeric, 0.04::numeric, 13.44::numeric, 0::numeric, 0.115::numeric, 16.25::numeric),
  -- Raisins, dried, black
  ('E057', 73.24::numeric, 6.81::numeric, 0.22::numeric, 33.76::numeric, 10.99::numeric, 1105::numeric, 77.62::numeric, 1.86::numeric, 3.71::numeric, 0::numeric, 1.76::numeric, 0.02::numeric, 1.63::numeric, 2.05::numeric, 0.09::numeric, 0.04::numeric, 0.48::numeric, 0.17::numeric, 38.3::numeric, 0::numeric, 0.06247::numeric, 10.71::numeric),
  -- Raisins, dried, golden
  ('E058', 51.83::numeric, 4.26::numeric, 0.25::numeric, 28.32::numeric, 10.16::numeric, 913::numeric, 93.3::numeric, 1.72::numeric, 2.53::numeric, 0::numeric, 11.87::numeric, 0.02::numeric, 1.71::numeric, 1.85::numeric, 0.09::numeric, 0.04::numeric, 0.64::numeric, 0.17::numeric, 34.68::numeric, 0::numeric, 0.121::numeric, 10.9::numeric),
  -- Rambutan
  ('E059', 8.67::numeric, 0.37::numeric, 0.53::numeric, 21.38::numeric, 1.75::numeric, 131::numeric, 6.98::numeric, 0::numeric, 2.9::numeric, 0::numeric, 2.4::numeric, 0.08::numeric, 19.7::numeric, 65::numeric, 0.11::numeric, 0.01::numeric, 0.26::numeric, 0.04::numeric, 7.35::numeric, 0::numeric, 0.144::numeric, 1.89::numeric),
  -- Sapota
  ('E060', 17.87::numeric, 0.49::numeric, 0.18::numeric, 16.19::numeric, 4.61::numeric, 280::numeric, 22.26::numeric, 0.39::numeric, 80.7::numeric, 0::numeric, 0.65::numeric, 0.25::numeric, 4.3::numeric, 20.96::numeric, 0.01::numeric, 0.03::numeric, 0.24::numeric, 0.12::numeric, 10.83::numeric, 0::numeric, 0.389::numeric, 8.97::numeric),
  -- Soursop
  ('E061', 10.05::numeric, 0.29::numeric, 0.12::numeric, 17.7::numeric, 6.78::numeric, 264::numeric, 25.83::numeric, 0::numeric, 2.2::numeric, 0::numeric, 3.24::numeric, 0.06::numeric, 2.6::numeric, 59.54::numeric, 0.03::numeric, 0.04::numeric, 0.85::numeric, 0.03::numeric, 6.09::numeric, 0::numeric, 0.135::numeric, 1.07::numeric),
  -- Star fruit
  ('E062', 4.97::numeric, 0.45::numeric, 0.24::numeric, 11.53::numeric, 1.56::numeric, 159::numeric, 11.67::numeric, 0.56::numeric, 1.4::numeric, 0::numeric, 0.96::numeric, 0.4::numeric, 2::numeric, 33.55::numeric, 0.08::numeric, 0.02::numeric, 0.34::numeric, 0.06::numeric, 8.43::numeric, 0::numeric, 0.02077::numeric, 1.23::numeric),
  -- Strawberry
  ('E063', 15.28::numeric, 0.36::numeric, 0.14::numeric, 15.53::numeric, 1.19::numeric, 140::numeric, 26.31::numeric, 0.3::numeric, 2.19::numeric, 0::numeric, 3.95::numeric, 0.26::numeric, 19.81::numeric, 50.2::numeric, 0.06::numeric, 0.01::numeric, 0.48::numeric, 0.09::numeric, 8.91::numeric, 0::numeric, 0.06621::numeric, 2.04::numeric),
  -- Tamarind, pulp
  ('E064', 149::numeric, 9.16::numeric, 0.58::numeric, 82.73::numeric, 24.92::numeric, 836::numeric, 113::numeric, 2.05::numeric, 1.54::numeric, 0::numeric, 25.65::numeric, 0.1::numeric, 1.67::numeric, 3.62::numeric, 0.34::numeric, 0.07::numeric, 1.56::numeric, 0.08::numeric, 9.79::numeric, 0::numeric, 0.02726::numeric, 48.91::numeric),
  -- Water melon, dark green (sugar baby)
  ('E065', 5.29::numeric, 0.22::numeric, 0.1::numeric, 9.91::numeric, 1.89::numeric, 124::numeric, 11.33::numeric, 0::numeric, 605::numeric, 0::numeric, 0.56::numeric, 0.04::numeric, 2.1::numeric, 13.26::numeric, 0.02::numeric, 0.02::numeric, 0.28::numeric, 0.1::numeric, 5.88::numeric, 0::numeric, 0.0397::numeric, 0.72::numeric),
  -- Water melon, pale green
  ('E066', 4.35::numeric, 0.16::numeric, 0.07::numeric, 7.42::numeric, 1.62::numeric, 126::numeric, 8.09::numeric, 0::numeric, 576::numeric, 0::numeric, 0.56::numeric, 0.05::numeric, 2.8::numeric, 11.45::numeric, 0.02::numeric, 0.02::numeric, 0.3::numeric, 0.07::numeric, 5.55::numeric, 0::numeric, 0.05033::numeric, 0.55::numeric),
  -- Wood Apple
  ('E067', 55.71::numeric, 0.45::numeric, 0.31::numeric, 23.7::numeric, 1.48::numeric, 347::numeric, 84.32::numeric, 2.32::numeric, 3.81::numeric, 0::numeric, 28.71::numeric, 0.07::numeric, 6.8::numeric, 22.17::numeric, 0.04::numeric, 0.01::numeric, 0.55::numeric, 0.17::numeric, 6.51::numeric, 0::numeric, 0.877::numeric, 55.8::numeric),
  -- Zizyphus
  ('E068', 46.55::numeric, 0.4::numeric, 0.1::numeric, 16.72::numeric, 1.52::numeric, 237::numeric, 32.38::numeric, 1.42::numeric, 1.5::numeric, 0::numeric, 16.7::numeric, 0.02::numeric, 2.5::numeric, 60.93::numeric, 0.01::numeric, 0.02::numeric, 0.33::numeric, 0.11::numeric, 5.99::numeric, 0::numeric, 0.119::numeric, 2.89::numeric),
  -- Beet root
  ('F001', 17.28::numeric, 0.76::numeric, 0.3::numeric, 33.21::numeric, 69.44::numeric, 306::numeric, 36.33::numeric, 0.25::numeric, 10.14::numeric, 0::numeric, 0.18::numeric, 0.09::numeric, 2.98::numeric, 5.26::numeric, 0.01::numeric, 0.01::numeric, 0.21::numeric, 0.07::numeric, 97.37::numeric, 0::numeric, 0.03117::numeric, 71.37::numeric),
  -- Carrot, orange
  ('F002', 35.09::numeric, 0.6::numeric, 0.25::numeric, 16.73::numeric, 52.33::numeric, 273::numeric, 43.06::numeric, 0.22::numeric, 8077::numeric, 0::numeric, 1.36::numeric, 0.21::numeric, 18.35::numeric, 6.22::numeric, 0.04::numeric, 0.03::numeric, 0.22::numeric, 0.11::numeric, 24.04::numeric, 0::numeric, 0.08771::numeric, 17.45::numeric),
  -- Carrot, red
  ('F003', 41.06::numeric, 0.71::numeric, 0.34::numeric, 18.83::numeric, 60.69::numeric, 267::numeric, 25.81::numeric, 0.29::numeric, 3834::numeric, 0::numeric, 1.39::numeric, 0.22::numeric, 18.75::numeric, 6.76::numeric, 0.04::numeric, 0.03::numeric, 0.25::numeric, 0.07::numeric, 23.67::numeric, 0::numeric, 0.08891::numeric, 16.41::numeric),
  -- Colocasia
  ('F004', 30.18::numeric, 0.66::numeric, 0.41::numeric, 36.93::numeric, 4.54::numeric, 514::numeric, 81.16::numeric, 0.3::numeric, 6.5::numeric, 0::numeric, 0.27::numeric, 0.33::numeric, 3.15::numeric, 1.83::numeric, 0.06::numeric, 0.03::numeric, 0.51::numeric, 0.17::numeric, 19.91::numeric, 0::numeric, 0.04184::numeric, 48.73::numeric),
  -- Lotus root
  ('F005', 37.71::numeric, 3.34::numeric, 0.35::numeric, 26.58::numeric, 20.63::numeric, 611::numeric, 74.3::numeric, 4.61::numeric, 0::numeric, 0::numeric, 0.27::numeric, 0.73::numeric, 44.45::numeric, 26.63::numeric, 0.07::numeric, 0.05::numeric, 0.43::numeric, 0.19::numeric, 26.49::numeric, 0::numeric, 0.249::numeric, 364::numeric),
  -- Potato, brown skin, big
  ('F006', 9.52::numeric, 0.57::numeric, 0.28::numeric, 24.07::numeric, 4.11::numeric, 541::numeric, 43.42::numeric, 0.75::numeric, 0::numeric, 0::numeric, 0.19::numeric, 0.06::numeric, 2.12::numeric, 23.15::numeric, 0.06::numeric, 0.01::numeric, 1.04::numeric, 0.1::numeric, 15.51::numeric, 0::numeric, 0.04356::numeric, 12.24::numeric),
  -- Potato, brown skin, small
  ('F007', 8.53::numeric, 0.53::numeric, 0.38::numeric, 22.34::numeric, 3.97::numeric, 474::numeric, 37.9::numeric, 0.28::numeric, 0::numeric, 0::numeric, 0.22::numeric, 0.07::numeric, 1.8::numeric, 26.41::numeric, 0.05::numeric, 0.01::numeric, 1.36::numeric, 0.12::numeric, 13.85::numeric, 0::numeric, 0.04403::numeric, 13.63::numeric),
  -- Potato, red skin
  ('F008', 8.62::numeric, 0.66::numeric, 0.34::numeric, 25.54::numeric, 4.36::numeric, 501::numeric, 30.39::numeric, 0.32::numeric, 0::numeric, 0::numeric, 0.2::numeric, 0.06::numeric, 2.3::numeric, 25.04::numeric, 0.06::numeric, 0.01::numeric, 1.13::numeric, 0.1::numeric, 17.83::numeric, 0::numeric, 0.03987::numeric, 12.37::numeric),
  -- Radish, elongate, red skin
  ('F009', 28.44::numeric, 0.37::numeric, 0.16::numeric, 13.34::numeric, 24.73::numeric, 255::numeric, 27.51::numeric, 0.13::numeric, 1.62::numeric, 0::numeric, 0.04::numeric, 0.01::numeric, 2.1::numeric, 17.63::numeric, 0.03::numeric, 0.02::numeric, 0.31::numeric, 0.07::numeric, 24.65::numeric, 0::numeric, 0.04265::numeric, 12.73::numeric),
  -- Radish, elongate, white skin
  ('F010', 30.2::numeric, 0.36::numeric, 0.22::numeric, 16.07::numeric, 28.2::numeric, 288::numeric, 30.1::numeric, 0.1::numeric, 0::numeric, 0::numeric, 0.05::numeric, 0.01::numeric, 2.5::numeric, 19.91::numeric, 0.02::numeric, 0.02::numeric, 0.3::numeric, 0.07::numeric, 29.75::numeric, 0::numeric, 0.04388::numeric, 12.72::numeric),
  -- Radish, round, red skin
  ('F011', 35.76::numeric, 0.42::numeric, 0.18::numeric, 22.25::numeric, 32.27::numeric, 308::numeric, 28.27::numeric, 0.22::numeric, 1.2::numeric, 0::numeric, 0.05::numeric, 0.01::numeric, 2.6::numeric, 15.69::numeric, 0.03::numeric, 0.02::numeric, 0.3::numeric, 0.07::numeric, 24.59::numeric, 0::numeric, 0.04608::numeric, 12.27::numeric),
  -- Radish, round, white skin
  ('F012', 34.23::numeric, 0.41::numeric, 0.17::numeric, 15.46::numeric, 24.14::numeric, 287::numeric, 29.47::numeric, 0.13::numeric, 0::numeric, 0::numeric, 0.04::numeric, 0.01::numeric, 1.9::numeric, 14::numeric, 0.03::numeric, 0.02::numeric, 0.24::numeric, 0.07::numeric, 22.6::numeric, 0::numeric, 0.04115::numeric, 15.49::numeric),
  -- Sweet potato, brown skin
  ('F013', 27.5::numeric, 0.35::numeric, 0.16::numeric, 17.37::numeric, 29.6::numeric, 345::numeric, 42.96::numeric, 0::numeric, 5376::numeric, 0::numeric, 1.26::numeric, 0.01::numeric, 3::numeric, 17.94::numeric, 0.07::numeric, 0.04::numeric, 0.67::numeric, 0.12::numeric, 15.62::numeric, 0::numeric, 0.0661::numeric, 14.39::numeric),
  -- Sweet potato, pink skin
  ('F014', 28.93::numeric, 0.51::numeric, 0.14::numeric, 21.05::numeric, 29.04::numeric, 329::numeric, 37.6::numeric, 0::numeric, 11.12::numeric, 0::numeric, 1.64::numeric, 0.01::numeric, 3.5::numeric, 22.2::numeric, 0.06::numeric, 0.04::numeric, 0.69::numeric, 0.09::numeric, 14.44::numeric, 0::numeric, 0.101::numeric, 14.14::numeric),
  -- Tapioca
  ('F015', 25.89::numeric, 0.81::numeric, 0.17::numeric, 23.08::numeric, 10.86::numeric, 255::numeric, 42.55::numeric, 0.07::numeric, 0::numeric, 0::numeric, 0.13::numeric, 0.19::numeric, 2.8::numeric, 15.51::numeric, 0.07::numeric, 0.02::numeric, 0.45::numeric, 0.09::numeric, 25.64::numeric, 0::numeric, 0.0595::numeric, 16.86::numeric),
  -- Water Chestnut
  ('F016', 37.15::numeric, 0.77::numeric, 0.67::numeric, 57.43::numeric, 13.08::numeric, 382::numeric, 62.83::numeric, 2.43::numeric, 0::numeric, 0::numeric, 1.2::numeric, 0.09::numeric, 3.5::numeric, 5.26::numeric, 0.02::numeric, 0.02::numeric, 0.74::numeric, 0.13::numeric, 9.8::numeric, 0::numeric, 0.08742::numeric, 16.54::numeric),
  -- Yam, elephant
  ('F017', 46.91::numeric, 1.22::numeric, 0.26::numeric, 33.51::numeric, 14.33::numeric, 501::numeric, 43.06::numeric, 0.59::numeric, 208.3::numeric, 0::numeric, 1.3::numeric, 0.34::numeric, 4.8::numeric, 15.22::numeric, 0.04::numeric, 0.05::numeric, 0.61::numeric, 0.22::numeric, 20.54::numeric, 0::numeric, 0.03572::numeric, 15.58::numeric),
  -- Yam, ordinary
  ('F018', 16.19::numeric, 0.77::numeric, 0.33::numeric, 30.4::numeric, 15.28::numeric, 463::numeric, 49.46::numeric, 0.57::numeric, 158::numeric, 0::numeric, 0.23::numeric, 0.39::numeric, 5.5::numeric, 13.88::numeric, 0.04::numeric, 0.02::numeric, 0.56::numeric, 0.17::numeric, 15.68::numeric, 0::numeric, 0.04263::numeric, 13.99::numeric),
  -- Yam, wild
  ('F019', 44.13::numeric, 1.04::numeric, 0.31::numeric, 31.75::numeric, 12.8::numeric, 654::numeric, 55.94::numeric, 0.56::numeric, 239::numeric, 0::numeric, 1.18::numeric, 0.53::numeric, 6::numeric, 14.06::numeric, 0.121::numeric, 0.015::numeric, 0.7::numeric, 0.2::numeric, 21.01::numeric, 0::numeric, 0.07951::numeric, 13.45::numeric),
  -- Chillies, green-1
  ('G001', 24.1::numeric, 1.46::numeric, 0.31::numeric, 34.72::numeric, 3.32::numeric, 431::numeric, 62.16::numeric, 0::numeric, 31.69::numeric, 0::numeric, 3.14::numeric, 0.26::numeric, 20.12::numeric, 79.5::numeric, 0.11::numeric, 0.09::numeric, 0.8::numeric, 0.45::numeric, 25.31::numeric, 0::numeric, 0.126::numeric, 28.86::numeric),
  -- Chillies, green-2
  ('G002', 16.86::numeric, 1.24::numeric, 0.26::numeric, 27.54::numeric, 2.47::numeric, 321::numeric, 51.72::numeric, 0::numeric, 232::numeric, 0::numeric, 3.49::numeric, 0.27::numeric, 19.51::numeric, 90.97::numeric, 0.08::numeric, 0.09::numeric, 0.93::numeric, 0.29::numeric, 25.93::numeric, 0::numeric, 0.131::numeric, 26.32::numeric),
  -- Chillies, green-3
  ('G003', 18.04::numeric, 1.25::numeric, 0.27::numeric, 29.9::numeric, 2.56::numeric, 317::numeric, 50.24::numeric, 0::numeric, 158::numeric, 0::numeric, 3.17::numeric, 0.26::numeric, 18.05::numeric, 93.63::numeric, 0.09::numeric, 0.11::numeric, 0.87::numeric, 0.24::numeric, 20.45::numeric, 0::numeric, 0.133::numeric, 27.68::numeric),
  -- Chillies, green-4
  ('G004', 15.87::numeric, 1.08::numeric, 0.28::numeric, 29.74::numeric, 1.94::numeric, 318::numeric, 42.79::numeric, 0::numeric, 67.84::numeric, 0::numeric, 2.87::numeric, 0.3::numeric, 22.16::numeric, 102::numeric, 0.09::numeric, 0.12::numeric, 0.9::numeric, 0.18::numeric, 15.92::numeric, 0::numeric, 0.148::numeric, 23.85::numeric),
  -- Chillies, green-5
  ('G005', 15.31::numeric, 0.93::numeric, 0.31::numeric, 23.96::numeric, 2.19::numeric, 317::numeric, 44.35::numeric, 0::numeric, 45.41::numeric, 0::numeric, 3.26::numeric, 0.25::numeric, 15.7::numeric, 97.77::numeric, 0.08::numeric, 0.16::numeric, 1.06::numeric, 0.2::numeric, 17.75::numeric, 0::numeric, 0.109::numeric, 38.3::numeric),
  -- Chillies, green-6
  ('G006', 24.82::numeric, 0.75::numeric, 0.29::numeric, 34.8::numeric, 2.43::numeric, 340::numeric, 56.05::numeric, 0::numeric, 508::numeric, 0::numeric, 2.19::numeric, 0.31::numeric, 18::numeric, 108::numeric, 0.07::numeric, 0.13::numeric, 0.92::numeric, 0.29::numeric, 18.87::numeric, 0::numeric, 0.121::numeric, 30.12::numeric),
  -- Chillies, green-7
  ('G007', 16.85::numeric, 1.23::numeric, 0.17::numeric, 26.71::numeric, 2::numeric, 319::numeric, 45.58::numeric, 0::numeric, 44::numeric, 0::numeric, 2.43::numeric, 0.22::numeric, 19.5::numeric, 112::numeric, 0.08::numeric, 0.11::numeric, 0.8::numeric, 0.22::numeric, 19.39::numeric, 0::numeric, 0.102::numeric, 29.37::numeric),
  -- Chillies, green - all varieties
  ('G008', 18.45::numeric, 1.2::numeric, 0.27::numeric, 29.51::numeric, 2.5::numeric, 341::numeric, 50.91::numeric, 0::numeric, 125::numeric, 0::numeric, 3.11::numeric, 0.27::numeric, 19.18::numeric, 94.07::numeric, 0.09::numeric, 0.11::numeric, 0.89::numeric, 0.28::numeric, 21.5::numeric, 0::numeric, 0.129::numeric, 28.54::numeric),
  -- Coriander leaves
  ('G009', 146::numeric, 5.3::numeric, 0.68::numeric, 72.68::numeric, 37::numeric, 546::numeric, 64.69::numeric, 0.45::numeric, 3808::numeric, 0::numeric, 3.55::numeric, 0.46::numeric, 274::numeric, 23.87::numeric, 0.09::numeric, 0.05::numeric, 0.73::numeric, 0.19::numeric, 51.01::numeric, 0::numeric, 0.228::numeric, 20.42::numeric),
  -- Curry leaves
  ('G010', 659::numeric, 8.67::numeric, 1.18::numeric, 182::numeric, 18.66::numeric, 584::numeric, 83.29::numeric, 17.25::numeric, 7807::numeric, 0::numeric, 117::numeric, 1.82::numeric, 275::numeric, 6.04::numeric, 0.07::numeric, 0.13::numeric, 0.85::numeric, 0.57::numeric, 117::numeric, 0::numeric, 0.267::numeric, 154::numeric),
  -- Garlic, big clove
  ('G011', 20.08::numeric, 1.05::numeric, 0.89::numeric, 27.08::numeric, 9.42::numeric, 430::numeric, 119::numeric, 0::numeric, 0::numeric, 0::numeric, 1.88::numeric, 0.07::numeric, 2.8::numeric, 12.62::numeric, 0.2::numeric, 0.25::numeric, 0.38::numeric, 0.56::numeric, 85.77::numeric, 0::numeric, 0.03352::numeric, 159::numeric),
  -- Garlic, small clove
  ('G012', 17.63::numeric, 0.88::numeric, 0.81::numeric, 25.78::numeric, 10.56::numeric, 453::numeric, 116::numeric, 0.37::numeric, 0::numeric, 0::numeric, 1.97::numeric, 0.06::numeric, 3.2::numeric, 13.57::numeric, 0.2::numeric, 0.23::numeric, 0.36::numeric, 0.77::numeric, 78.82::numeric, 0::numeric, 0.03263::numeric, 143::numeric),
  -- Garlic, single clove, Kashmir
  ('G013', 19::numeric, 1.01::numeric, 0.66::numeric, 41.13::numeric, 8.87::numeric, 584::numeric, 128::numeric, 0.43::numeric, 0::numeric, 0::numeric, 2.89::numeric, 0.05::numeric, 4.5::numeric, 15.38::numeric, 0.25::numeric, 0.22::numeric, 0.42::numeric, 0.97::numeric, 92.25::numeric, 0::numeric, 0.03476::numeric, 127::numeric),
  -- Ginger, fresh
  ('G014', 18.88::numeric, 1.9::numeric, 0.39::numeric, 54.66::numeric, 10.03::numeric, 407::numeric, 44.36::numeric, 0::numeric, 88.85::numeric, 0::numeric, 4.09::numeric, 0.32::numeric, 25.55::numeric, 5.43::numeric, 0.04::numeric, 0.04::numeric, 0.42::numeric, 0.2::numeric, 10.82::numeric, 0::numeric, 0.231::numeric, 259::numeric),
  -- Mango ginger
  ('G015', 13.74::numeric, 2.31::numeric, 0.47::numeric, 36.86::numeric, 5.51::numeric, 384::numeric, 68.33::numeric, 0::numeric, 76.62::numeric, 0::numeric, 3.1::numeric, 0.59::numeric, 27.71::numeric, 1.62::numeric, 0.02::numeric, 0.07::numeric, 0.45::numeric, 0.18::numeric, 22.62::numeric, 0::numeric, 0.177::numeric, 307::numeric),
  -- Mint leaves
  ('G016', 205::numeric, 8.56::numeric, 0.75::numeric, 110::numeric, 16.87::numeric, 539::numeric, 65.25::numeric, 10.79::numeric, 4602::numeric, 0::numeric, 3.37::numeric, 0.46::numeric, 164::numeric, 17.16::numeric, 0.02::numeric, 0.19::numeric, 0.74::numeric, 0.17::numeric, 106::numeric, 0::numeric, 0.125::numeric, 97.07::numeric),
  -- Onion, big
  ('G017', 21.03::numeric, 0.43::numeric, 0.35::numeric, 17.96::numeric, 5.5::numeric, 171::numeric, 32.34::numeric, 0.35::numeric, 1.08::numeric, 0::numeric, 0.73::numeric, 0.05::numeric, 4.5::numeric, 6.69::numeric, 0.04::numeric, 0.01::numeric, 0.34::numeric, 0.1::numeric, 28.88::numeric, 0::numeric, 0.06081::numeric, 4.03::numeric),
  -- Onion, small
  ('G018', 19.92::numeric, 0.53::numeric, 0.24::numeric, 15.16::numeric, 4.06::numeric, 160::numeric, 39.65::numeric, 1.02::numeric, 1.1::numeric, 0::numeric, 0.12::numeric, 0.06::numeric, 5.3::numeric, 10.96::numeric, 0.07::numeric, 0.02::numeric, 0.21::numeric, 0.12::numeric, 29.68::numeric, 0::numeric, 0.04101::numeric, 11.11::numeric),
  -- Asafoetida
  ('G019', 266::numeric, 15.68::numeric, 0.98::numeric, 96.4::numeric, 16.04::numeric, 245::numeric, 69.09::numeric, 13.42::numeric, 6.42::numeric, 0::numeric, 12.59::numeric, 0.77::numeric, 46.56::numeric, 0::numeric, 0.82::numeric, 0.01::numeric, 0.43::numeric, 0.02::numeric, 26.28::numeric, 0::numeric, 0.242::numeric, 23.82::numeric),
  -- Cardamom, green
  ('G020', 378::numeric, 8.33::numeric, 3.71::numeric, 330::numeric, 15.51::numeric, 1262::numeric, 132::numeric, 11.71::numeric, 21.91::numeric, 0::numeric, 43.72::numeric, 0.77::numeric, 6.81::numeric, 0::numeric, 0.12::numeric, 0.07::numeric, 1.13::numeric, 0.15::numeric, 2.85::numeric, 0::numeric, 0.624::numeric, 1961::numeric),
  -- Cardamom, black
  ('G021', 312::numeric, 7.94::numeric, 4.75::numeric, 286::numeric, 16.25::numeric, 1331::numeric, 117::numeric, 3.99::numeric, 77.48::numeric, 0::numeric, 43.55::numeric, 1.1::numeric, 5.74::numeric, 0::numeric, 0.05::numeric, 0.13::numeric, 0.52::numeric, 0.2::numeric, 4.96::numeric, 0::numeric, 0.493::numeric, 2472::numeric),
  -- Chillies, red
  ('G022', 99.83::numeric, 6.23::numeric, 1.66::numeric, 231::numeric, 19.45::numeric, 2245::numeric, 280::numeric, 18.83::numeric, 3141::numeric, 0::numeric, 24.36::numeric, 0.98::numeric, 274::numeric, 0::numeric, 0.46::numeric, 0.83::numeric, 6.94::numeric, 0.42::numeric, 51.5::numeric, 0::numeric, 1.141::numeric, 87.17::numeric),
  -- Cloves
  ('G023', 567::numeric, 9.41::numeric, 1.13::numeric, 334::numeric, 183::numeric, 1434::numeric, 83.1::numeric, 7.75::numeric, 82.06::numeric, 0::numeric, 45.07::numeric, 0.77::numeric, 161::numeric, 0::numeric, 0.53::numeric, 0.22::numeric, 1.15::numeric, 0.03::numeric, 32.81::numeric, 0::numeric, 2.679::numeric, 1845::numeric),
  -- Coriander seeds
  ('G024', 718::numeric, 17.64::numeric, 3.91::numeric, 343::numeric, 34.41::numeric, 1473::numeric, 293::numeric, 6.34::numeric, 122::numeric, 0::numeric, 1.31::numeric, 1.01::numeric, 35.7::numeric, 0::numeric, 0.19::numeric, 0.23::numeric, 1.2::numeric, 0.04::numeric, 22.07::numeric, 0::numeric, 0.952::numeric, 809::numeric),
  -- Cumin seeds
  ('G025', 878::numeric, 20.58::numeric, 4.29::numeric, 442::numeric, 125::numeric, 1886::numeric, 382::numeric, 4.01::numeric, 89.19::numeric, 0::numeric, 12.1::numeric, 1.49::numeric, 146::numeric, 0::numeric, 0.52::numeric, 0.13::numeric, 2.87::numeric, 0.39::numeric, 27.79::numeric, 0::numeric, 0.619::numeric, 817::numeric),
  -- Fenugreek seeds
  ('G026', 135::numeric, 8.47::numeric, 3.8::numeric, 167::numeric, 40.2::numeric, 891::numeric, 435::numeric, 9.98::numeric, 142::numeric, 0::numeric, 1.98::numeric, 0.02::numeric, 1.5::numeric, 0::numeric, 0.28::numeric, 0.14::numeric, 1.19::numeric, 0.77::numeric, 51.11::numeric, 0::numeric, 0.77::numeric, 31.75::numeric),
  -- Mace
  ('G027', 174::numeric, 22.69::numeric, 1.16::numeric, 207::numeric, 27.17::numeric, 623::numeric, 110::numeric, 7.24::numeric, 2322::numeric, 0::numeric, 44.92::numeric, 4.16::numeric, 70.44::numeric, 0::numeric, 0.13::numeric, 0.13::numeric, 0.92::numeric, 0.3::numeric, 32.65::numeric, 0::numeric, 9.304::numeric, 28.22::numeric),
  -- Nutmeg
  ('G028', 148::numeric, 2.33::numeric, 1.45::numeric, 212::numeric, 14.31::numeric, 474::numeric, 207::numeric, 7.33::numeric, 15.37::numeric, 0::numeric, 46.67::numeric, 1.21::numeric, 60.92::numeric, 0::numeric, 0.04::numeric, 0.05::numeric, 0.51::numeric, 0.1::numeric, 74.78::numeric, 0::numeric, 3.359::numeric, 194::numeric),
  -- Omum
  ('G029', 1034::numeric, 13.65::numeric, 5.67::numeric, 273::numeric, 28.58::numeric, 1692::numeric, 329::numeric, 87.04::numeric, 797.4::numeric, 0::numeric, 2.62::numeric, 0.01::numeric, 30.36::numeric, 0::numeric, 0.3::numeric, 0.23::numeric, 1.23::numeric, 0.24::numeric, 51.79::numeric, 0::numeric, 1.112::numeric, 1020::numeric),
  -- Pippali
  ('G030', 414::numeric, 7.99::numeric, 1.52::numeric, 189::numeric, 16.28::numeric, 1852::numeric, 181::numeric, 20.51::numeric, 933::numeric, 0::numeric, 118::numeric, 0.03::numeric, 93.45::numeric, 0::numeric, 0.06::numeric, 0.14::numeric, 1.06::numeric, 0.6::numeric, 66.45::numeric, 0::numeric, 0.602::numeric, 367::numeric),
  -- Pepper, black
  ('G031', 405::numeric, 11.91::numeric, 1.24::numeric, 196::numeric, 24.08::numeric, 1487::numeric, 144::numeric, 12.13::numeric, 1089::numeric, 0::numeric, 25.68::numeric, 1.27::numeric, 171::numeric, 0::numeric, 0.06::numeric, 0.09::numeric, 0.85::numeric, 0.27::numeric, 21.89::numeric, 0::numeric, 0.654::numeric, 431::numeric),
  -- Poppy seeds
  ('G032', 1372::numeric, 10.13::numeric, 6.38::numeric, 393::numeric, 25.35::numeric, 646::numeric, 804::numeric, 7.68::numeric, 3.51::numeric, 0::numeric, 33.92::numeric, 1.67::numeric, 95.18::numeric, 0::numeric, 0.87::numeric, 0.1::numeric, 0.77::numeric, 0.42::numeric, 78.73::numeric, 0::numeric, 2.074::numeric, 1631::numeric),
  -- Turmeric powder
  ('G033', 122::numeric, 46.08::numeric, 2.64::numeric, 260::numeric, 24.41::numeric, 2374::numeric, 276::numeric, 6.41::numeric, 55.2::numeric, 0::numeric, 18.67::numeric, 2.92::numeric, 12.8::numeric, 0::numeric, 0.06::numeric, 0.01::numeric, 1.55::numeric, 0.13::numeric, 13.86::numeric, 0::numeric, 1.634::numeric, 1531::numeric),
  -- Almond
  ('H001', 228::numeric, 4.59::numeric, 3.5::numeric, 318::numeric, 1.5::numeric, 699::numeric, 446::numeric, 3.61::numeric, 0::numeric, 0::numeric, 1.61::numeric, 25.86::numeric, 8.4::numeric, 0.74::numeric, 0.15::numeric, 0.26::numeric, 3.71::numeric, 0.09::numeric, 36.46::numeric, 0::numeric, 4.358::numeric, 344::numeric),
  -- Arecanut, dried, brown
  ('H002', 61::numeric, 2.74::numeric, 0.89::numeric, 76.39::numeric, 12.06::numeric, 524::numeric, 105::numeric, 15.21::numeric, 0::numeric, 0::numeric, 12.77::numeric, 0.15::numeric, 3.78::numeric, 0::numeric, 0.04::numeric, 0.03::numeric, 0.71::numeric, 0.32::numeric, 7.54::numeric, 0::numeric, 2.605::numeric, 0::numeric),
  -- Arecanut, dried, red color
  ('H003', 51::numeric, 3.26::numeric, 1.02::numeric, 91.01::numeric, 17.13::numeric, 617::numeric, 127::numeric, 12.52::numeric, 0::numeric, 0::numeric, 12.6::numeric, 0.17::numeric, 3.9::numeric, 0::numeric, 0.03::numeric, 0.24::numeric, 0.8::numeric, 0.21::numeric, 8.57::numeric, 0::numeric, 1.674::numeric, 0::numeric),
  -- Arecanut, fresh
  ('H004', 34.03::numeric, 1.04::numeric, 0.56::numeric, 47.6::numeric, 5.53::numeric, 329::numeric, 90.48::numeric, 0::numeric, 0::numeric, 0::numeric, 11.03::numeric, 0.06::numeric, 3.71::numeric, 0::numeric, 0.038::numeric, 0.031::numeric, 0.74::numeric, 0.25::numeric, 26.51::numeric, 0::numeric, 3.389::numeric, 0::numeric),
  -- Cashew nut
  ('H005', 34::numeric, 5.95::numeric, 5.34::numeric, 307::numeric, 9::numeric, 635::numeric, 500::numeric, 13.08::numeric, 0::numeric, 0::numeric, 3.85::numeric, 1.05::numeric, 1.83::numeric, 0::numeric, 0.61::numeric, 0.03::numeric, 1.03::numeric, 0.16::numeric, 25.2::numeric, 0::numeric, 7.816::numeric, 189::numeric),
  -- Coconut, kernal, dry
  ('H006', 32::numeric, 3.13::numeric, 1.41::numeric, 97.21::numeric, 16.68::numeric, 739::numeric, 203::numeric, 25.25::numeric, 0::numeric, 0::numeric, 0::numeric, 6.06::numeric, 2.88::numeric, 0::numeric, 0.04::numeric, 0.04::numeric, 0.71::numeric, 0.15::numeric, 24.27::numeric, 0::numeric, 43.14::numeric, 6.83::numeric),
  -- Coconut, kernel, fresh
  ('H007', 8::numeric, 1.3::numeric, 0.58::numeric, 35::numeric, 8.12::numeric, 246::numeric, 67.73::numeric, 0::numeric, 2.66::numeric, 0::numeric, 0::numeric, 2.72::numeric, 23.22::numeric, 0.8::numeric, 0.03::numeric, 0.08::numeric, 0.3::numeric, 0.1::numeric, 25.41::numeric, 0::numeric, 28.05::numeric, 3.44::numeric),
  -- Garden cress, seeds
  ('H008', 318::numeric, 17.2::numeric, 4.83::numeric, 307::numeric, 21.84::numeric, 952::numeric, 539::numeric, 54.41::numeric, 0::numeric, 0::numeric, 1.92::numeric, 0.07::numeric, 24.66::numeric, 0::numeric, 0.52::numeric, 0.15::numeric, 5.67::numeric, 0.05::numeric, 30.92::numeric, 0::numeric, 4.101::numeric, 60.04::numeric),
  -- Gingelly seeds, black
  ('H009', 1664::numeric, 13.9::numeric, 8.59::numeric, 390::numeric, 15.91::numeric, 480::numeric, 568::numeric, 15.7::numeric, 13.09::numeric, 0::numeric, 67.83::numeric, 0.09::numeric, 110::numeric, 0::numeric, 0.34::numeric, 0.1::numeric, 3.12::numeric, 0.64::numeric, 127::numeric, 0::numeric, 6.317::numeric, 2156::numeric),
  -- Gingelly seeds, brown
  ('H010', 1174::numeric, 14.95::numeric, 7.84::numeric, 328::numeric, 11.94::numeric, 491::numeric, 613::numeric, 52.64::numeric, 5.41::numeric, 0::numeric, 76.51::numeric, 0.23::numeric, 113::numeric, 0::numeric, 0.27::numeric, 0.08::numeric, 3.05::numeric, 0.49::numeric, 92.63::numeric, 0::numeric, 6.25::numeric, 2030::numeric),
  -- Gingelly seeds, white
  ('H011', 1283::numeric, 15.04::numeric, 7.77::numeric, 372::numeric, 15.43::numeric, 460::numeric, 754::numeric, 26.74::numeric, 12.94::numeric, 0::numeric, 62.74::numeric, 1.26::numeric, 106::numeric, 0::numeric, 0.36::numeric, 0.07::numeric, 3.94::numeric, 0.62::numeric, 131::numeric, 0::numeric, 6.43::numeric, 2004::numeric),
  -- Ground nut
  ('H012', 54::numeric, 3.44::numeric, 3.18::numeric, 197::numeric, 12.21::numeric, 679::numeric, 391::numeric, 3.41::numeric, 22.75::numeric, 0::numeric, 7.1::numeric, 0.28::numeric, 2.5::numeric, 0::numeric, 0.57::numeric, 0.12::numeric, 11.35::numeric, 0.23::numeric, 90.87::numeric, 0::numeric, 8.144::numeric, 60.98::numeric),
  -- Mustard seeds
  ('H013', 402::numeric, 13.49::numeric, 4.03::numeric, 266::numeric, 3.97::numeric, 694::numeric, 715::numeric, 71.47::numeric, 36.72::numeric, 0::numeric, 31.79::numeric, 0.45::numeric, 8.2::numeric, 0::numeric, 0.55::numeric, 0.33::numeric, 3.8::numeric, 0.24::numeric, 94.88::numeric, 0::numeric, 2.112::numeric, 6.92::numeric),
  -- Linseeds
  ('H014', 257::numeric, 5.44::numeric, 4.86::numeric, 349::numeric, 32.93::numeric, 655::numeric, 445::numeric, 46.87::numeric, 1.05::numeric, 0::numeric, 0.55::numeric, 8.28::numeric, 19.17::numeric, 0::numeric, 0.28::numeric, 0.05::numeric, 1.09::numeric, 0.35::numeric, 86.5::numeric, 0::numeric, 2.968::numeric, 5.85::numeric),
  -- Niger seeds, black
  ('H015', 572::numeric, 18.19::numeric, 4.98::numeric, 346::numeric, 10.7::numeric, 716::numeric, 461::numeric, 39.31::numeric, 2.15::numeric, 0::numeric, 2.52::numeric, 1.44::numeric, 110::numeric, 0::numeric, 0.46::numeric, 0.23::numeric, 1.14::numeric, 0.45::numeric, 140::numeric, 0::numeric, 5.945::numeric, 1913::numeric),
  -- Niger seeds, gray
  ('H016', 375::numeric, 19.61::numeric, 3.62::numeric, 379::numeric, 8.08::numeric, 874::numeric, 474::numeric, 153.6::numeric, 11.22::numeric, 0::numeric, 2.7::numeric, 2.66::numeric, 105::numeric, 0::numeric, 0.38::numeric, 0.35::numeric, 0.88::numeric, 0.34::numeric, 73.13::numeric, 0::numeric, 9.737::numeric, 1544::numeric),
  -- Pine seed
  ('H017', 17::numeric, 4.5::numeric, 4.18::numeric, 268::numeric, 1.31::numeric, 686::numeric, 618::numeric, 10.56::numeric, 1.98::numeric, 0::numeric, 0.61::numeric, 0.01::numeric, 44.55::numeric, 0::numeric, 0.36::numeric, 0.08::numeric, 3.52::numeric, 0.11::numeric, 31.64::numeric, 0::numeric, 3.801::numeric, 159::numeric),
  -- Pistachio nuts
  ('H018', 135::numeric, 4.5::numeric, 2.42::numeric, 149::numeric, 6.93::numeric, 1053::numeric, 537::numeric, 10.46::numeric, 110::numeric, 0::numeric, 1.8::numeric, 33.92::numeric, 18.65::numeric, 0::numeric, 0.98::numeric, 0.04::numeric, 0.86::numeric, 0.96::numeric, 64.9::numeric, 0::numeric, 4.043::numeric, 46.42::numeric),
  -- Safflower seeds
  ('H019', 211::numeric, 4.06::numeric, 3.9::numeric, 321::numeric, 3.05::numeric, 550::numeric, 644::numeric, 6.33::numeric, 2.07::numeric, 0::numeric, 1.91::numeric, 35.09::numeric, 8.8::numeric, 0::numeric, 0.85::numeric, 0.15::numeric, 1.12::numeric, 0.93::numeric, 82.41::numeric, 0::numeric, 2.548::numeric, 215::numeric),
  -- Sunflower seeds
  ('H020', 176::numeric, 5.85::numeric, 7.07::numeric, 413::numeric, 1.9::numeric, 559::numeric, 752::numeric, 0::numeric, 8.15::numeric, 0::numeric, 1.54::numeric, 12.93::numeric, 9.2::numeric, 0::numeric, 0.59::numeric, 0.13::numeric, 1.6::numeric, 0.94::numeric, 81.79::numeric, 0::numeric, 6.159::numeric, 23.7::numeric),
  -- Walnut
  ('H021', 105::numeric, 3.21::numeric, 2.94::numeric, 180::numeric, 1.33::numeric, 457::numeric, 400::numeric, 6.53::numeric, 14.47::numeric, 0::numeric, 46.31::numeric, 4.12::numeric, 84.92::numeric, 0.88::numeric, 0.4::numeric, 0.12::numeric, 0.86::numeric, 0.8::numeric, 57.95::numeric, 0::numeric, 5.208::numeric, 37.03::numeric),
  -- Jaggery, cane
  ('I001', 107::numeric, 4.63::numeric, 0.45::numeric, 115::numeric, 25.38::numeric, 488::numeric, 74.53::numeric, 0::numeric, 0::numeric, 0::numeric, 0.47::numeric, 0.04::numeric, 0::numeric, 0::numeric, 0.04::numeric, 0.01::numeric, 0.02::numeric, 0.71::numeric, 14.4::numeric, 0::numeric, 0.06923::numeric, 0::numeric),
  -- Sugarcane, juice
  ('I002', 18::numeric, 1.12::numeric, 0.14::numeric, 13.03::numeric, 1.16::numeric, 150::numeric, 22.08::numeric, 0::numeric, 7.87::numeric, 0::numeric, 0.41::numeric, 0.02::numeric, 0::numeric, 6.73::numeric, 0.03::numeric, 0.04::numeric, 0.14::numeric, 0.4::numeric, 44.53::numeric, 0::numeric, 0.14::numeric, 0::numeric),
  -- Button mushroom, fresh
  ('J001', 18.38::numeric, 0.29::numeric, 0.17::numeric, 18.3::numeric, 7.72::numeric, 318::numeric, 87.11::numeric, 0::numeric, 0::numeric, 0::numeric, 20.54::numeric, 0.01::numeric, 12.5::numeric, 0::numeric, 0.01::numeric, 0.03::numeric, 0.68::numeric, 0.12::numeric, 8.28::numeric, 0::numeric, 0.06289::numeric, 10.23::numeric),
  -- Chicken mushroom, fresh
  ('J002', 4.83::numeric, 0.3::numeric, 0.55::numeric, 10.78::numeric, 10.22::numeric, 340::numeric, 79.74::numeric, 0::numeric, 0::numeric, 0::numeric, 27.58::numeric, 0.02::numeric, 16.29::numeric, 0.45::numeric, 0.37::numeric, 0.06::numeric, 1.45::numeric, 0.11::numeric, 11.13::numeric, 0::numeric, 0.0596::numeric, 12.56::numeric),
  -- Shiitake mushroom, fresh
  ('J003', 5.3::numeric, 1.93::numeric, 1.21::numeric, 24.47::numeric, 9.3::numeric, 323::numeric, 96.36::numeric, 0::numeric, 0::numeric, 0::numeric, 36.4::numeric, 0.01::numeric, 12.5::numeric, 0::numeric, 0.05::numeric, 0.16::numeric, 1.92::numeric, 0.45::numeric, 10.92::numeric, 0::numeric, 0.116::numeric, 15.84::numeric),
  -- Oyster mushroom, dried
  ('J004', 23.61::numeric, 3.58::numeric, 8.67::numeric, 136::numeric, 8.67::numeric, 350::numeric, 702::numeric, 0.04::numeric, 0::numeric, 0::numeric, 109::numeric, 0.01::numeric, 11.8::numeric, 0::numeric, 0.24::numeric, 0.17::numeric, 3.77::numeric, 0.85::numeric, 10.4::numeric, 0::numeric, 0.422::numeric, 20.65::numeric),
  -- Toddy
  ('K001', 0.44::numeric, 0.42::numeric, 0.01::numeric, 3.99::numeric, 1.64::numeric, 83.54::numeric, 5.82::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.01::numeric, 0::numeric, 0.92::numeric, 0.01::numeric, 0.27::numeric, 0.35::numeric, 0.03::numeric, 0.73::numeric, 0::numeric, 0.03065::numeric, 0::numeric),
  -- Coconut Water
  ('K002', 27.47::numeric, 0.06::numeric, 0.04::numeric, 18.19::numeric, 28.09::numeric, 215::numeric, 18.05::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.45::numeric, 2.69::numeric, 0.64::numeric, 0.01::numeric, 0.01::numeric, 0.04::numeric, 0.06::numeric, 10.88::numeric, 0::numeric, 0.09349::numeric, 0::numeric),
  -- Milk, whole, Buffalo
  ('L001', 121::numeric, 0.16::numeric, 0.3::numeric, 10.05::numeric, 30.1::numeric, 109::numeric, 86.94::numeric, 1.45::numeric, 8.42::numeric, 0::numeric, 1.63::numeric, 0.19::numeric, 0::numeric, 2.37::numeric, 0.05::numeric, 0.13::numeric, 0.07::numeric, 0.04::numeric, 8.57::numeric, 0::numeric, 4.63::numeric, 0::numeric),
  -- Milk, whole, Cow
  ('L002', 118::numeric, 0.15::numeric, 0.33::numeric, 8.28::numeric, 25.46::numeric, 115::numeric, 96.56::numeric, 0.95::numeric, 13.67::numeric, 0::numeric, 1.22::numeric, 0.22::numeric, 0::numeric, 2.01::numeric, 0.03::numeric, 0.11::numeric, 0.08::numeric, 0.04::numeric, 7.03::numeric, 0::numeric, 2.707::numeric, 0::numeric),
  -- Paneer
  ('L003', 476::numeric, 0.9::numeric, 2.74::numeric, 26.62::numeric, 18.04::numeric, 63.53::numeric, 330::numeric, 23.14::numeric, 4.39::numeric, 0::numeric, 0.13::numeric, 0.02::numeric, 0::numeric, 0::numeric, 0.02::numeric, 0.1::numeric, 0.13::numeric, 0.04::numeric, 93.31::numeric, 0::numeric, 8.851::numeric, 0::numeric),
  -- Khoa
  ('L004', 602::numeric, 2.32::numeric, 2.34::numeric, 58.53::numeric, 48.1::numeric, 536::numeric, 476::numeric, 44.97::numeric, 3.52::numeric, 0::numeric, 0.12::numeric, 0.03::numeric, 0::numeric, 0::numeric, 0.11::numeric, 0.11::numeric, 0.43::numeric, 0.06::numeric, 94.25::numeric, 0::numeric, 12.94::numeric, 0::numeric),
  -- Egg, poultry, whole, raw
  ('M001', 49.44::numeric, 1.82::numeric, 1.23::numeric, 12.01::numeric, 123::numeric, 138::numeric, 185::numeric, 40.44::numeric, 14.57::numeric, 198::numeric, 0.84::numeric, 1.51::numeric, 14.61::numeric, 0::numeric, 0.06::numeric, 0.19::numeric, 0.11::numeric, 0.16::numeric, 49.32::numeric, 366::numeric, 2.958::numeric, 0::numeric),
  -- Egg, poultry, white, raw
  ('M002', 5.64::numeric, 0.07::numeric, 0.03::numeric, 11.42::numeric, 166::numeric, 152::numeric, 15.81::numeric, 21.23::numeric, 0::numeric, 0::numeric, 1.05::numeric, 0::numeric, 0::numeric, 0::numeric, 0.02::numeric, 0.16::numeric, 0.01::numeric, 4.36::numeric, 4.96::numeric, 0::numeric, 0::numeric, 0::numeric),
  -- Egg, poultry, yolk, raw
  ('M003', 116::numeric, 3.17::numeric, 1.64::numeric, 13.17::numeric, 46.33::numeric, 118::numeric, 549::numeric, 51.44::numeric, 90.96::numeric, 539::numeric, 3.29::numeric, 2.97::numeric, 45.14::numeric, 0::numeric, 0.11::numeric, 0.16::numeric, 0.69::numeric, 0.29::numeric, 112::numeric, 1076::numeric, 8.58::numeric, 0::numeric),
  -- Egg, poultry, whole, boiled
  ('M004', 55.12::numeric, 1.87::numeric, 1.31::numeric, 13.76::numeric, 121::numeric, 127::numeric, 209::numeric, 46.12::numeric, 14.26::numeric, 180::numeric, 0.74::numeric, 1.34::numeric, 13.02::numeric, 0::numeric, 0.06::numeric, 0.18::numeric, 0.21::numeric, 0.14::numeric, 48.25::numeric, 365::numeric, 3.464::numeric, 0::numeric),
  -- Egg, poultry, white, boiled
  ('M005', 8.07::numeric, 0.15::numeric, 0.09::numeric, 11.62::numeric, 144::numeric, 147::numeric, 23::numeric, 14.86::numeric, 0::numeric, 0::numeric, 0.18::numeric, 0::numeric, 0::numeric, 0::numeric, 0.02::numeric, 0.18::numeric, 0.01::numeric, 4.37::numeric, 4.1::numeric, 0::numeric, 0::numeric, 0::numeric),
  -- Egg, poultry, yolk, boiled
  ('M006', 120::numeric, 4.92::numeric, 3.59::numeric, 15.52::numeric, 44.83::numeric, 106::numeric, 586::numeric, 38.57::numeric, 70.28::numeric, 456::numeric, 3.04::numeric, 2.8::numeric, 40.29::numeric, 0::numeric, 0.17::numeric, 0.15::numeric, 0.45::numeric, 0.27::numeric, 110::numeric, 1085::numeric, 8.819::numeric, 0::numeric),
  -- Egg, poultry, omlet
  ('M007', 53.26::numeric, 2.16::numeric, 1.31::numeric, 14.84::numeric, 169::numeric, 163::numeric, 222::numeric, 42.18::numeric, 12.11::numeric, 181::numeric, 2.98::numeric, 1.88::numeric, 16.62::numeric, 0::numeric, 0.11::numeric, 0.2::numeric, 0.33::numeric, 0.14::numeric, 37.66::numeric, 316::numeric, 3.179::numeric, 0::numeric),
  -- Egg, country hen, whole, raw
  ('M008', 50.14::numeric, 1.64::numeric, 1.12::numeric, 11::numeric, 157::numeric, 117::numeric, 198::numeric, 62.33::numeric, 20.11::numeric, 206::numeric, 4.46::numeric, 2.1::numeric, 64::numeric, 0::numeric, 0.14::numeric, 0.08::numeric, 0.14::numeric, 0.18::numeric, 54.6::numeric, 355::numeric, 3.792::numeric, 0::numeric),
  -- Egg, country hen, whole, boiled
  ('M009', 57.79::numeric, 1.73::numeric, 1.25::numeric, 11::numeric, 149::numeric, 120::numeric, 206::numeric, 52.65::numeric, 18.51::numeric, 195::numeric, 2.99::numeric, 2.05::numeric, 60::numeric, 0::numeric, 0.11::numeric, 0.08::numeric, 0.12::numeric, 0.18::numeric, 59.98::numeric, 369::numeric, 4.074::numeric, 0::numeric),
  -- Egg, country hen, omlet
  ('M010', 55.88::numeric, 2.15::numeric, 1.26::numeric, 13::numeric, 157::numeric, 151::numeric, 243::numeric, 58.63::numeric, 15.7::numeric, 202::numeric, 3.44::numeric, 2.79::numeric, 66::numeric, 0::numeric, 0.14::numeric, 0.07::numeric, 0.14::numeric, 0.18::numeric, 58.79::numeric, 318::numeric, 4.886::numeric, 0::numeric),
  -- Egg, duck, whole, boiled
  ('M011', 56.12::numeric, 2.61::numeric, 1.58::numeric, 12::numeric, 110::numeric, 221::numeric, 263::numeric, 43.66::numeric, 43.84::numeric, 171::numeric, 1.9::numeric, 2.06::numeric, 117::numeric, 0::numeric, 0.21::numeric, 0.07::numeric, 0.18::numeric, 0.15::numeric, 73.32::numeric, 856::numeric, 3.598::numeric, 0::numeric),
  -- Egg, duck, whole, raw
  ('M012', 52.46::numeric, 2.46::numeric, 1.49::numeric, 12::numeric, 113::numeric, 228::numeric, 247::numeric, 46.33::numeric, 46.74::numeric, 181::numeric, 2.67::numeric, 2.47::numeric, 118::numeric, 0::numeric, 0.18::numeric, 0.07::numeric, 0.13::numeric, 0.15::numeric, 75.48::numeric, 839::numeric, 3.373::numeric, 0::numeric),
  -- Egg, duck, whole, omlet
  ('M013', 71.79::numeric, 3.28::numeric, 1.89::numeric, 15::numeric, 175::numeric, 154::numeric, 309::numeric, 42.02::numeric, 39.06::numeric, 166::numeric, 2.1::numeric, 2.66::numeric, 111::numeric, 0::numeric, 0.31::numeric, 0.09::numeric, 0.14::numeric, 0.15::numeric, 67.95::numeric, 815::numeric, 3.871::numeric, 0::numeric),
  -- Egg, quial, whole, raw
  ('M014', 60.67::numeric, 2.55::numeric, 1.51::numeric, 11::numeric, 132::numeric, 119::numeric, 236::numeric, 50.63::numeric, 16.53::numeric, 151::numeric, 5.72::numeric, 0.99::numeric, 8.19::numeric, 0::numeric, 0.15::numeric, 0.11::numeric, 0.12::numeric, 0.17::numeric, 54.86::numeric, 833::numeric, 2.788::numeric, 0::numeric),
  -- Egg, quial, whole, boiled
  ('M015', 61.35::numeric, 2.63::numeric, 1.55::numeric, 12::numeric, 130::numeric, 115::numeric, 237::numeric, 42.6::numeric, 12.41::numeric, 140::numeric, 4.91::numeric, 0.84::numeric, 4.46::numeric, 0::numeric, 0.11::numeric, 0.08::numeric, 0.15::numeric, 0.15::numeric, 51.72::numeric, 855::numeric, 2.726::numeric, 0::numeric),
  -- Chicken, poultry, leg, skinless
  ('N001', 20.52::numeric, 1.27::numeric, 1.77::numeric, 23.82::numeric, 65.07::numeric, 283::numeric, 199::numeric, 20.22::numeric, 0::numeric, 10.95::numeric, 1.14::numeric, 0.61::numeric, 10.78::numeric, 0::numeric, 0.17::numeric, 0.13::numeric, 5.6::numeric, 0.33::numeric, 7.47::numeric, 84.25::numeric, 1.157::numeric, 0::numeric),
  -- Chicken, poultry, thigh, skinless
  ('N002', 18.37::numeric, 1.11::numeric, 1.42::numeric, 22.55::numeric, 64.59::numeric, 263::numeric, 186::numeric, 18.69::numeric, 0::numeric, 16.48::numeric, 1.24::numeric, 0.66::numeric, 16.17::numeric, 0::numeric, 0.13::numeric, 0.1::numeric, 5.62::numeric, 0.38::numeric, 9::numeric, 91.93::numeric, 1.071::numeric, 0::numeric),
  -- Chicken, poultry, breast, skinless
  ('N003', 12.91::numeric, 0.83::numeric, 0.78::numeric, 20.2::numeric, 36.7::numeric, 295::numeric, 178::numeric, 18.56::numeric, 0::numeric, 6.96::numeric, 1.38::numeric, 0.29::numeric, 27.8::numeric, 0::numeric, 0.1::numeric, 0.06::numeric, 8.06::numeric, 0.53::numeric, 10.44::numeric, 61.55::numeric, 0.816::numeric, 0::numeric),
  -- Chicken, poultry, wing, skinless
  ('N004', 28.13::numeric, 1.38::numeric, 1.48::numeric, 22.81::numeric, 72.78::numeric, 185::numeric, 189::numeric, 20.52::numeric, 0::numeric, 31.21::numeric, 1.11::numeric, 0.58::numeric, 28.17::numeric, 0::numeric, 0.08::numeric, 0.07::numeric, 6.66::numeric, 0.39::numeric, 7.87::numeric, 54.52::numeric, 1.241::numeric, 0::numeric),
  -- Poultry, chicken, liver
  ('N005', 4.1::numeric, 9.92::numeric, 2.65::numeric, 16::numeric, 61.58::numeric, 241::numeric, 244::numeric, 46.35::numeric, 0::numeric, 3486::numeric, 2.64::numeric, 0.73::numeric, 14.3::numeric, 0::numeric, 0.28::numeric, 0.2::numeric, 4.44::numeric, 0.92::numeric, 1032::numeric, 268::numeric, 1.328::numeric, 0::numeric),
  -- Poultry, chicken, gizzard
  ('N006', 5.46::numeric, 3.19::numeric, 2.65::numeric, 14::numeric, 50.6::numeric, 244::numeric, 119::numeric, 54.66::numeric, 0::numeric, 46.78::numeric, 1.6::numeric, 0.63::numeric, 28.58::numeric, 0::numeric, 0.01::numeric, 0.11::numeric, 2.87::numeric, 0.14::numeric, 8.72::numeric, 57.24::numeric, 0.772::numeric, 0::numeric),
  -- Country hen, leg, with skin
  ('N007', 22.56::numeric, 1.66::numeric, 2.71::numeric, 25::numeric, 50.46::numeric, 357::numeric, 250::numeric, 16.33::numeric, 0::numeric, 17.44::numeric, 1.12::numeric, 0.7::numeric, 11.31::numeric, 0::numeric, 0.17::numeric, 0.1::numeric, 2.44::numeric, 0.36::numeric, 8.1::numeric, 87.95::numeric, 0.534::numeric, 0::numeric),
  -- Country hen, thigh, with skin
  ('N008', 20.12::numeric, 1.4::numeric, 2.16::numeric, 24::numeric, 51.14::numeric, 330::numeric, 232::numeric, 18.33::numeric, 0::numeric, 27::numeric, 1.05::numeric, 0.55::numeric, 18.5::numeric, 0::numeric, 0.11::numeric, 0.13::numeric, 3.62::numeric, 0.42::numeric, 10.42::numeric, 91.81::numeric, 0.61::numeric, 0::numeric),
  -- Country hen, breast, with skin
  ('N009', 12.49::numeric, 1.09::numeric, 0.78::numeric, 22::numeric, 23.13::numeric, 365::numeric, 222::numeric, 20.12::numeric, 0::numeric, 8.52::numeric, 0.8::numeric, 0.36::numeric, 28.88::numeric, 0::numeric, 0.11::numeric, 0.04::numeric, 5.62::numeric, 0.59::numeric, 12.98::numeric, 66.03::numeric, 0.419::numeric, 0::numeric),
  -- Country hen, wing, with skin
  ('N010', 35.46::numeric, 1.45::numeric, 1.64::numeric, 25::numeric, 54.15::numeric, 249::numeric, 235::numeric, 18.01::numeric, 0::numeric, 27.52::numeric, 0.61::numeric, 0.58::numeric, 31.65::numeric, 0::numeric, 0.07::numeric, 0.03::numeric, 3.19::numeric, 0.43::numeric, 9.19::numeric, 55.42::numeric, 0.688::numeric, 0::numeric),
  -- Duck, meat, with skin
  ('N011', 22.77::numeric, 4.26::numeric, 2.92::numeric, 26::numeric, 82.25::numeric, 273::numeric, 237::numeric, 23.55::numeric, 0::numeric, 48.86::numeric, 0.91::numeric, 0.7::numeric, 7.88::numeric, 0::numeric, 0.22::numeric, 0.13::numeric, 2.24::numeric, 0.31::numeric, 27.98::numeric, 81.76::numeric, 0.345::numeric, 0::numeric),
  -- Emu, meat, skinless
  ('N012', 7.4::numeric, 3.95::numeric, 2.91::numeric, 25::numeric, 48.48::numeric, 275::numeric, 243::numeric, 21.32::numeric, 0::numeric, 2.84::numeric, 0.67::numeric, 0.42::numeric, 8.06::numeric, 0::numeric, 0.1::numeric, 0.17::numeric, 3.26::numeric, 0.35::numeric, 7.07::numeric, 72.69::numeric, 0.2::numeric, 0::numeric),
  -- Guinea fowl, meat, with skin
  ('N013', 30.77::numeric, 2.2::numeric, 1.48::numeric, 21::numeric, 57.64::numeric, 240::numeric, 187::numeric, 24.37::numeric, 0::numeric, 2.26::numeric, 1.02::numeric, 1.88::numeric, 11.05::numeric, 0::numeric, 0.02::numeric, 0.18::numeric, 3.64::numeric, 0.58::numeric, 5.69::numeric, 87.48::numeric, 1.138::numeric, 0::numeric),
  -- Pigeon, meat, with skin
  ('N014', 18.11::numeric, 3.81::numeric, 2.48::numeric, 29::numeric, 56.1::numeric, 346::numeric, 255::numeric, 19.32::numeric, 0::numeric, 15.25::numeric, 1.2::numeric, 1.54::numeric, 7.1::numeric, 0::numeric, 0.18::numeric, 0.39::numeric, 3.45::numeric, 0.48::numeric, 8.41::numeric, 107::numeric, 1.828::numeric, 0::numeric),
  -- Quail, meat, skinless
  ('N015', 20.6::numeric, 1.9::numeric, 1.13::numeric, 31::numeric, 56.21::numeric, 333::numeric, 300::numeric, 14.32::numeric, 0::numeric, 12.84::numeric, 1.53::numeric, 1.67::numeric, 7.3::numeric, 0::numeric, 0.05::numeric, 0.24::numeric, 4.69::numeric, 0.56::numeric, 9.33::numeric, 77.87::numeric, 2.024::numeric, 0::numeric),
  -- Turkey, leg, with skin
  ('N016', 20.44::numeric, 2.01::numeric, 3.35::numeric, 26::numeric, 66.47::numeric, 308::numeric, 236::numeric, 17.63::numeric, 0::numeric, 8.15::numeric, 0.5::numeric, 0.72::numeric, 18.46::numeric, 0::numeric, 0.05::numeric, 0.11::numeric, 4.92::numeric, 0.48::numeric, 8.55::numeric, 83.44::numeric, 0.98::numeric, 0::numeric),
  -- Turkey, thigh, with skin
  ('N017', 23.52::numeric, 1.58::numeric, 2.95::numeric, 23::numeric, 50.01::numeric, 280::numeric, 194::numeric, 20.36::numeric, 0::numeric, 13.11::numeric, 0.36::numeric, 0.63::numeric, 25.36::numeric, 0::numeric, 0.04::numeric, 0.12::numeric, 1.94::numeric, 0.51::numeric, 10.91::numeric, 85.35::numeric, 1.015::numeric, 0::numeric),
  -- Turkey, breast, with skin
  ('N018', 14.35::numeric, 1.01::numeric, 1.28::numeric, 22::numeric, 40.45::numeric, 315::numeric, 182::numeric, 14.33::numeric, 0::numeric, 8.97::numeric, 0.52::numeric, 0.57::numeric, 26.43::numeric, 0::numeric, 0.06::numeric, 0.1::numeric, 4.49::numeric, 0.56::numeric, 14.67::numeric, 81.28::numeric, 0.934::numeric, 0::numeric),
  -- Turkey, wing, with skin
  ('N019', 33.49::numeric, 1::numeric, 1.68::numeric, 24::numeric, 57::numeric, 262::numeric, 199::numeric, 18.36::numeric, 0::numeric, 18.07::numeric, 0.52::numeric, 0.44::numeric, 18.43::numeric, 0::numeric, 0.03::numeric, 0.09::numeric, 4.38::numeric, 0.45::numeric, 10.41::numeric, 80.01::numeric, 0.897::numeric, 0::numeric),
  -- Goat, shoulder, meat
  ('O001', 6.18::numeric, 1.48::numeric, 4.19::numeric, 21.39::numeric, 47.31::numeric, 332::numeric, 189::numeric, 12.91::numeric, 0::numeric, 7.57::numeric, 0.8::numeric, 0.35::numeric, 5.8::numeric, 0::numeric, 0.07::numeric, 0.17::numeric, 5.14::numeric, 0.26::numeric, 0::numeric, 82.18::numeric, 5.444::numeric, 0::numeric),
  -- Goat, chops
  ('O002', 7.44::numeric, 1.87::numeric, 4.55::numeric, 21.13::numeric, 45.72::numeric, 334::numeric, 195::numeric, 21.76::numeric, 0::numeric, 2.55::numeric, 0.4::numeric, 0.15::numeric, 6.5::numeric, 0::numeric, 0.05::numeric, 0.13::numeric, 5.51::numeric, 0.3::numeric, 0::numeric, 88.37::numeric, 2.877::numeric, 0::numeric),
  -- Goat, legs
  ('O003', 5.76::numeric, 1.77::numeric, 3.52::numeric, 21.71::numeric, 42.77::numeric, 339::numeric, 187::numeric, 17.76::numeric, 0::numeric, 8.51::numeric, 0.32::numeric, 0.09::numeric, 9.5::numeric, 0::numeric, 0.07::numeric, 0.15::numeric, 5.15::numeric, 0.31::numeric, 0::numeric, 82.52::numeric, 3.665::numeric, 0::numeric),
  -- Goat, brain
  ('O004', 10.61::numeric, 1.63::numeric, 1.08::numeric, 13.94::numeric, 132::numeric, 296::numeric, 296::numeric, 21.7::numeric, 0::numeric, 1.98::numeric, 0.3::numeric, 0.07::numeric, 3.8::numeric, 0::numeric, 0.13::numeric, 0.17::numeric, 2.04::numeric, 0.28::numeric, 0::numeric, 1340::numeric, 2.138::numeric, 0::numeric),
  -- Goat, tongue
  ('O005', 7.11::numeric, 2.09::numeric, 2.44::numeric, 19.39::numeric, 118::numeric, 223::numeric, 212::numeric, 22.76::numeric, 0::numeric, 8.95::numeric, 0.35::numeric, 0.08::numeric, 1.7::numeric, 0::numeric, 0.14::numeric, 0.22::numeric, 3.04::numeric, 0.17::numeric, 0::numeric, 206::numeric, 5.028::numeric, 0::numeric),
  -- Goat, lungs
  ('O006', 10.44::numeric, 7.1::numeric, 1.7::numeric, 11.48::numeric, 85.72::numeric, 180::numeric, 209::numeric, 26::numeric, 0::numeric, 2.75::numeric, 1.4::numeric, 0.08::numeric, 4.6::numeric, 0::numeric, 0.08::numeric, 0.32::numeric, 2.79::numeric, 0.14::numeric, 0::numeric, 448::numeric, 1.564::numeric, 0::numeric),
  -- Goat, heart
  ('O007', 5.71::numeric, 3.38::numeric, 1.45::numeric, 18::numeric, 73.21::numeric, 224::numeric, 174::numeric, 15::numeric, 0::numeric, 5.9::numeric, 0.6::numeric, 0.09::numeric, 10.6::numeric, 0::numeric, 0.36::numeric, 0.33::numeric, 5.97::numeric, 0.23::numeric, 0::numeric, 122::numeric, 1.939::numeric, 0::numeric),
  -- Goat, liver
  ('O008', 6.09::numeric, 6.56::numeric, 3.48::numeric, 18::numeric, 55.41::numeric, 284::numeric, 336::numeric, 48.12::numeric, 0::numeric, 15655::numeric, 0.74::numeric, 0.61::numeric, 12.64::numeric, 0::numeric, 0.2::numeric, 0.37::numeric, 12.88::numeric, 0.65::numeric, 0::numeric, 415::numeric, 1.77::numeric, 0::numeric),
  -- Goat, tripe
  ('O009', 20.87::numeric, 0.81::numeric, 1.66::numeric, 13::numeric, 22.38::numeric, 45::numeric, 59.2::numeric, 15.59::numeric, 0::numeric, 2.17::numeric, 0::numeric, 0.1::numeric, 11.5::numeric, 0::numeric, 0.02::numeric, 0.1::numeric, 0.81::numeric, 0.2::numeric, 0::numeric, 113::numeric, 1.682::numeric, 0::numeric),
  -- Goat, spleen
  ('O010', 8.35::numeric, 51.41::numeric, 1.95::numeric, 15.3::numeric, 52.4::numeric, 368::numeric, 266::numeric, 48.55::numeric, 0::numeric, 7.85::numeric, 0.46::numeric, 0.08::numeric, 9::numeric, 0::numeric, 0.06::numeric, 0.16::numeric, 5.2::numeric, 0.33::numeric, 0::numeric, 243::numeric, 1.2::numeric, 0::numeric),
  -- Goat, kidneys
  ('O011', 12.37::numeric, 6.73::numeric, 1.73::numeric, 18.6::numeric, 184::numeric, 195::numeric, 220::numeric, 142::numeric, 0::numeric, 68.56::numeric, 0::numeric, 0.09::numeric, 3.5::numeric, 0::numeric, 0.34::numeric, 0.34::numeric, 5.5::numeric, 0.4::numeric, 0::numeric, 419::numeric, 1.143::numeric, 0::numeric),
  -- Goat, tube (small intestine)
  ('O012', 27.52::numeric, 2.21::numeric, 1.12::numeric, 7.14::numeric, 7.46::numeric, 130::numeric, 55.9::numeric, 26.09::numeric, 0::numeric, 2.62::numeric, 0::numeric, 0.13::numeric, 11::numeric, 0::numeric, 0.01::numeric, 0.11::numeric, 0.64::numeric, 0.21::numeric, 0::numeric, 176::numeric, 4.445::numeric, 0::numeric),
  -- Goat, testis
  ('O013', 5.95::numeric, 1.43::numeric, 1.19::numeric, 13.66::numeric, 92.61::numeric, 253::numeric, 186::numeric, 80.34::numeric, 0::numeric, 2.48::numeric, 0.62::numeric, 0.09::numeric, 2.5::numeric, 0::numeric, 0.15::numeric, 0.11::numeric, 1.72::numeric, 0.24::numeric, 0::numeric, 118::numeric, 1.215::numeric, 0::numeric),
  -- Sheep, shoulder
  ('O014', 5.46::numeric, 1.63::numeric, 3.69::numeric, 21.31::numeric, 45.65::numeric, 336::numeric, 195::numeric, 22.36::numeric, 0::numeric, 8.71::numeric, 0.07::numeric, 0.31::numeric, 6.8::numeric, 0::numeric, 0.05::numeric, 0.18::numeric, 4.53::numeric, 0.15::numeric, 0::numeric, 74.72::numeric, 6.916::numeric, 0::numeric),
  -- Sheep, chops
  ('O015', 7.98::numeric, 2.24::numeric, 3.46::numeric, 21.42::numeric, 45.26::numeric, 323::numeric, 191::numeric, 20.82::numeric, 0::numeric, 3.49::numeric, 0.47::numeric, 0.1::numeric, 7.3::numeric, 0::numeric, 0.07::numeric, 0.16::numeric, 4.94::numeric, 0.18::numeric, 0::numeric, 86.14::numeric, 2.773::numeric, 0::numeric),
  -- Sheep, leg
  ('O016', 6.87::numeric, 1.54::numeric, 2.67::numeric, 22.22::numeric, 49.3::numeric, 333::numeric, 187::numeric, 20::numeric, 0::numeric, 9.93::numeric, 2.79::numeric, 0.08::numeric, 8.9::numeric, 0::numeric, 0.08::numeric, 0.16::numeric, 5.25::numeric, 0.24::numeric, 0::numeric, 84.84::numeric, 3.745::numeric, 0::numeric),
  -- Sheep, brain
  ('O017', 10.27::numeric, 1.93::numeric, 1.11::numeric, 14.08::numeric, 122::numeric, 312::numeric, 271::numeric, 34.6::numeric, 0::numeric, 1.55::numeric, 1.06::numeric, 0.09::numeric, 2.8::numeric, 0::numeric, 0.12::numeric, 0.21::numeric, 2.66::numeric, 0.33::numeric, 0::numeric, 1336::numeric, 2.04::numeric, 0::numeric),
  -- Sheep, tongue
  ('O018', 8.05::numeric, 2.46::numeric, 2.46::numeric, 24.53::numeric, 185::numeric, 220::numeric, 207::numeric, 23.2::numeric, 0::numeric, 7.33::numeric, 0::numeric, 0.07::numeric, 1.5::numeric, 0::numeric, 0.15::numeric, 0.2::numeric, 2.78::numeric, 0.16::numeric, 0::numeric, 210::numeric, 5.576::numeric, 0::numeric),
  -- Sheep, lungs
  ('O019', 7.74::numeric, 8.58::numeric, 1.58::numeric, 11.68::numeric, 109::numeric, 204::numeric, 187::numeric, 16.12::numeric, 0::numeric, 2.45::numeric, 0.31::numeric, 0.08::numeric, 4.9::numeric, 0::numeric, 0.07::numeric, 0.23::numeric, 2.75::numeric, 0.02::numeric, 0::numeric, 431::numeric, 1.138::numeric, 0::numeric),
  -- Sheep, heart
  ('O020', 6.79::numeric, 3.07::numeric, 1.31::numeric, 15.19::numeric, 72.62::numeric, 225::numeric, 163::numeric, 33.3::numeric, 0::numeric, 4.64::numeric, 0.8::numeric, 0.15::numeric, 9.7::numeric, 0::numeric, 0.34::numeric, 0.3::numeric, 5.43::numeric, 0.3::numeric, 0::numeric, 112::numeric, 1.677::numeric, 0::numeric),
  -- Sheep, liver
  ('O021', 5.92::numeric, 6.15::numeric, 3.73::numeric, 17.91::numeric, 55.82::numeric, 280::numeric, 334::numeric, 43.38::numeric, 0::numeric, 14106::numeric, 0.67::numeric, 0.6::numeric, 14.7::numeric, 0::numeric, 0.17::numeric, 0.35::numeric, 15.66::numeric, 0.26::numeric, 0::numeric, 430::numeric, 1.822::numeric, 0::numeric),
  -- Sheep, tripe
  ('O022', 14.85::numeric, 0.9::numeric, 1.89::numeric, 17.81::numeric, 18.37::numeric, 48.75::numeric, 55.61::numeric, 13.92::numeric, 0::numeric, 2.72::numeric, 0::numeric, 0.2::numeric, 10.9::numeric, 0::numeric, 0.02::numeric, 0.08::numeric, 0.63::numeric, 0.22::numeric, 0::numeric, 113::numeric, 1.962::numeric, 0::numeric),
  -- Sheep, spleen
  ('O023', 11.49::numeric, 53.11::numeric, 1.71::numeric, 17.23::numeric, 50.58::numeric, 327::numeric, 266::numeric, 64.53::numeric, 0::numeric, 6.61::numeric, 0::numeric, 0.1::numeric, 7.5::numeric, 0::numeric, 0.07::numeric, 0.23::numeric, 5.42::numeric, 0.27::numeric, 0::numeric, 262::numeric, 1.533::numeric, 0::numeric),
  -- Sheep, kidneys
  ('O024', 14.15::numeric, 6.11::numeric, 1.92::numeric, 17.46::numeric, 163::numeric, 198::numeric, 204::numeric, 127::numeric, 0::numeric, 68.68::numeric, 0.44::numeric, 0.1::numeric, 2.9::numeric, 0::numeric, 0.35::numeric, 0.31::numeric, 5.51::numeric, 0.51::numeric, 0::numeric, 299::numeric, 1.127::numeric, 0::numeric),
  -- Beef, shoulder
  ('O025', 6.5::numeric, 2.22::numeric, 4.64::numeric, 22.24::numeric, 45.59::numeric, 367::numeric, 201::numeric, 11.58::numeric, 0::numeric, 15.51::numeric, 0.6::numeric, 0.4::numeric, 2.9::numeric, 0::numeric, 0.03::numeric, 0.12::numeric, 5.18::numeric, 0.48::numeric, 0::numeric, 66.36::numeric, 7.046::numeric, 0::numeric),
  -- Beef, chops
  ('O026', 4.64::numeric, 1.95::numeric, 3.77::numeric, 24.72::numeric, 32.47::numeric, 383::numeric, 209::numeric, 11.54::numeric, 0::numeric, 2.43::numeric, 0.52::numeric, 0.3::numeric, 2.8::numeric, 0::numeric, 0.02::numeric, 0.06::numeric, 4.36::numeric, 0.34::numeric, 0::numeric, 45.97::numeric, 3.031::numeric, 0::numeric),
  -- Beef, round (leg)
  ('O027', 5.86::numeric, 2.3::numeric, 3.36::numeric, 26.59::numeric, 38.96::numeric, 366::numeric, 215::numeric, 18.14::numeric, 0::numeric, 2.52::numeric, 0.54::numeric, 0.4::numeric, 5.8::numeric, 0::numeric, 0.04::numeric, 0.06::numeric, 6.3::numeric, 0.44::numeric, 0::numeric, 55.81::numeric, 2.998::numeric, 0::numeric),
  -- Beef, brain
  ('O028', 11.38::numeric, 2.15::numeric, 1.18::numeric, 15.84::numeric, 127::numeric, 320::numeric, 326::numeric, 16.57::numeric, 0::numeric, 2.18::numeric, 0.74::numeric, 0.1::numeric, 2.7::numeric, 0::numeric, 0.12::numeric, 0.13::numeric, 1.91::numeric, 0.25::numeric, 0::numeric, 1668::numeric, 2.49::numeric, 0::numeric),
  -- Beef, tongue
  ('O029', 9.49::numeric, 2.17::numeric, 3.31::numeric, 22.82::numeric, 89.88::numeric, 260::numeric, 220::numeric, 15.16::numeric, 0::numeric, 5.56::numeric, 0.76::numeric, 0.11::numeric, 1.9::numeric, 0::numeric, 0.05::numeric, 0.13::numeric, 2.93::numeric, 0.19::numeric, 0::numeric, 141::numeric, 6.287::numeric, 0::numeric),
  -- Beef, lungs
  ('O030', 9.31::numeric, 6.85::numeric, 1.52::numeric, 11.6::numeric, 109::numeric, 216::numeric, 172::numeric, 16.69::numeric, 0::numeric, 1.89::numeric, 0::numeric, 0.11::numeric, 3.7::numeric, 0::numeric, 0.09::numeric, 0.12::numeric, 3.13::numeric, 0.23::numeric, 0::numeric, 334::numeric, 1.198::numeric, 0::numeric),
  -- Beef, heart
  ('O031', 6.16::numeric, 3.62::numeric, 1.5::numeric, 15.66::numeric, 70.52::numeric, 258::numeric, 181::numeric, 20.66::numeric, 0::numeric, 10.13::numeric, 5.98::numeric, 0.1::numeric, 2.5::numeric, 0::numeric, 0.24::numeric, 0.3::numeric, 5.38::numeric, 0.25::numeric, 0::numeric, 92.73::numeric, 1.479::numeric, 0::numeric),
  -- Beef, liver
  ('O032', 5.46::numeric, 14.82::numeric, 4.36::numeric, 18.57::numeric, 50.14::numeric, 289::numeric, 332::numeric, 20.2::numeric, 0::numeric, 9119::numeric, 4::numeric, 0.6::numeric, 4::numeric, 0::numeric, 0.17::numeric, 0.34::numeric, 14.01::numeric, 0.3::numeric, 0::numeric, 261::numeric, 1.543::numeric, 0::numeric),
  -- Beef, tripe
  ('O033', 15.3::numeric, 0.84::numeric, 2.02::numeric, 9.33::numeric, 41::numeric, 143::numeric, 60.17::numeric, 10.18::numeric, 0::numeric, 4.29::numeric, 4.06::numeric, 0.41::numeric, 3.5::numeric, 0::numeric, 0.03::numeric, 0.08::numeric, 1.31::numeric, 0.23::numeric, 0::numeric, 82.66::numeric, 1.371::numeric, 0::numeric),
  -- Beef, spleen
  ('O034', 9.4::numeric, 31.68::numeric, 2.01::numeric, 15.8::numeric, 58.94::numeric, 348::numeric, 252::numeric, 37.55::numeric, 0::numeric, 8.71::numeric, 0.33::numeric, 0.1::numeric, 2.5::numeric, 0::numeric, 0.31::numeric, 0.25::numeric, 7.45::numeric, 0.26::numeric, 0::numeric, 353::numeric, 1.16::numeric, 0::numeric),
  -- Beef, kidneys
  ('O035', 15.31::numeric, 4.71::numeric, 1.4::numeric, 14.7::numeric, 160::numeric, 184::numeric, 180::numeric, 135::numeric, 0::numeric, 98.04::numeric, 0.64::numeric, 0.08::numeric, 2.5::numeric, 0::numeric, 0.26::numeric, 0.27::numeric, 6.52::numeric, 0.22::numeric, 0::numeric, 439::numeric, 1.743::numeric, 0::numeric),
  -- Calf, shoulder
  ('O036', 8.39::numeric, 1.31::numeric, 3.31::numeric, 22.71::numeric, 77::numeric, 369::numeric, 197::numeric, 12.34::numeric, 0::numeric, 13.17::numeric, 0::numeric, 0.3::numeric, 3.5::numeric, 0::numeric, 0.1::numeric, 0.2::numeric, 6.11::numeric, 0.5::numeric, 0::numeric, 58.27::numeric, 3.51::numeric, 0::numeric),
  -- Calf, chops
  ('O037', 9.27::numeric, 1.2::numeric, 3.29::numeric, 20.77::numeric, 64.94::numeric, 366::numeric, 195::numeric, 12.53::numeric, 0::numeric, 2.1::numeric, 0.74::numeric, 0.3::numeric, 3.2::numeric, 0::numeric, 0.07::numeric, 0.17::numeric, 5.11::numeric, 0.37::numeric, 0::numeric, 62.05::numeric, 1.966::numeric, 0::numeric),
  -- Calf, round (leg)
  ('O038', 10.03::numeric, 2.4::numeric, 2.64::numeric, 22.28::numeric, 67.04::numeric, 356::numeric, 185::numeric, 13.32::numeric, 0::numeric, 2.42::numeric, 0.97::numeric, 0.2::numeric, 6.2::numeric, 0::numeric, 0.03::numeric, 0.17::numeric, 5.97::numeric, 0.41::numeric, 0::numeric, 50.1::numeric, 2.263::numeric, 0::numeric),
  -- Calf, brain
  ('O039', 10.53::numeric, 1.44::numeric, 1.11::numeric, 14.29::numeric, 115::numeric, 306::numeric, 296::numeric, 15.48::numeric, 0::numeric, 1.41::numeric, 8.59::numeric, 0.1::numeric, 3::numeric, 0::numeric, 0.07::numeric, 0.19::numeric, 3.19::numeric, 0.3::numeric, 0::numeric, 1345::numeric, 2.202::numeric, 0::numeric),
  -- Calf, tongue
  ('O040', 9.08::numeric, 2.63::numeric, 2.67::numeric, 15.38::numeric, 91.64::numeric, 238::numeric, 178::numeric, 10.57::numeric, 0::numeric, 4.63::numeric, 0::numeric, 0.1::numeric, 1.7::numeric, 0::numeric, 0.11::numeric, 0.22::numeric, 4.31::numeric, 0.17::numeric, 0::numeric, 107::numeric, 5.63::numeric, 0::numeric),
  -- Calf, heart
  ('O041', 6.48::numeric, 4.66::numeric, 1.63::numeric, 18.21::numeric, 58::numeric, 224::numeric, 185::numeric, 11.86::numeric, 0::numeric, 4.83::numeric, 0::numeric, 0.1::numeric, 1.9::numeric, 0::numeric, 0.26::numeric, 0.29::numeric, 5.3::numeric, 0.41::numeric, 0::numeric, 130::numeric, 1.489::numeric, 0::numeric),
  -- Calf, liver
  ('O042', 5.19::numeric, 16.26::numeric, 3.8::numeric, 19.16::numeric, 54.99::numeric, 307::numeric, 358::numeric, 19.94::numeric, 0::numeric, 9664::numeric, 0::numeric, 0.5::numeric, 5::numeric, 0::numeric, 0.17::numeric, 0.31::numeric, 12.98::numeric, 0.59::numeric, 0::numeric, 306::numeric, 1.616::numeric, 0::numeric),
  -- Calf, spleen
  ('O043', 10.56::numeric, 25.42::numeric, 2.02::numeric, 18.95::numeric, 67.87::numeric, 372::numeric, 274::numeric, 41.33::numeric, 0::numeric, 6.32::numeric, 0.29::numeric, 0.1::numeric, 2.5::numeric, 0::numeric, 0.09::numeric, 0.28::numeric, 7.61::numeric, 0.44::numeric, 0::numeric, 360::numeric, 1.03::numeric, 0::numeric),
  -- Calf, kidneys
  ('O044', 12.63::numeric, 4.92::numeric, 1.58::numeric, 17.35::numeric, 174::numeric, 206::numeric, 204::numeric, 91.31::numeric, 0::numeric, 95.73::numeric, 0::numeric, 0.1::numeric, 3.1::numeric, 0::numeric, 0.32::numeric, 0.35::numeric, 4.16::numeric, 0.3::numeric, 0::numeric, 271::numeric, 1.464::numeric, 0::numeric),
  -- Mithun, shoulder
  ('O045', 4.27::numeric, 2.05::numeric, 6.11::numeric, 18.86::numeric, 32.94::numeric, 307::numeric, 199::numeric, 28.28::numeric, 0::numeric, 12.68::numeric, 0.06::numeric, 0.3::numeric, 3.8::numeric, 0::numeric, 0.04::numeric, 0.06::numeric, 6.29::numeric, 0.37::numeric, 0::numeric, 45.07::numeric, 4.436::numeric, 0::numeric),
  -- Mithun, chops
  ('O046', 4.88::numeric, 2.25::numeric, 6.08::numeric, 18.2::numeric, 42.17::numeric, 222::numeric, 178::numeric, 14.58::numeric, 0::numeric, 2.62::numeric, 0.08::numeric, 0.2::numeric, 4.2::numeric, 0::numeric, 0.2::numeric, 0.18::numeric, 4.76::numeric, 0.34::numeric, 0::numeric, 46.99::numeric, 2.736::numeric, 0::numeric),
  -- Mithun, round (leg)
  ('O047', 5.32::numeric, 2.18::numeric, 3.47::numeric, 22.23::numeric, 28.42::numeric, 338::numeric, 190::numeric, 14.81::numeric, 0::numeric, 2.47::numeric, 0.04::numeric, 0.3::numeric, 8.5::numeric, 0::numeric, 0.02::numeric, 0.05::numeric, 5.3::numeric, 0.29::numeric, 0::numeric, 44.01::numeric, 1.442::numeric, 0::numeric),
  -- Pork, shoulder
  ('O048', 9.95::numeric, 0.91::numeric, 2.08::numeric, 15.01::numeric, 54.47::numeric, 234::numeric, 157::numeric, 13.26::numeric, 0::numeric, 5.12::numeric, 9.38::numeric, 0.3::numeric, 1.8::numeric, 0::numeric, 0.18::numeric, 0.1::numeric, 4.22::numeric, 0.41::numeric, 0::numeric, 44.38::numeric, 6.887::numeric, 0::numeric),
  -- Pork, chops
  ('O049', 8.12::numeric, 1::numeric, 1.34::numeric, 11.62::numeric, 43.7::numeric, 243::numeric, 143::numeric, 15.06::numeric, 0::numeric, 1.51::numeric, 7.1::numeric, 0.11::numeric, 2.2::numeric, 0::numeric, 0.3::numeric, 0.11::numeric, 4.49::numeric, 0.36::numeric, 0::numeric, 46.98::numeric, 4.803::numeric, 0::numeric),
  -- Pork, ham
  ('O050', 7.4::numeric, 1.27::numeric, 1.76::numeric, 17.05::numeric, 40.44::numeric, 239::numeric, 140::numeric, 13.21::numeric, 0::numeric, 2.98::numeric, 5.85::numeric, 0.2::numeric, 5.3::numeric, 0::numeric, 0.24::numeric, 0.1::numeric, 4.59::numeric, 0.25::numeric, 0::numeric, 47.08::numeric, 6.938::numeric, 0::numeric),
  -- Pork, lungs
  ('O051', 10.3::numeric, 6.76::numeric, 1.18::numeric, 9.82::numeric, 61.41::numeric, 200::numeric, 161::numeric, 17.75::numeric, 0::numeric, 5.14::numeric, 2.05::numeric, 0.11::numeric, 3.8::numeric, 0::numeric, 0.08::numeric, 0.14::numeric, 3.11::numeric, 0.19::numeric, 0::numeric, 232::numeric, 1.247::numeric, 0::numeric),
  -- Pork, heart
  ('O052', 4.74::numeric, 3.97::numeric, 1.6::numeric, 18.23::numeric, 70.52::numeric, 268::numeric, 187::numeric, 20.75::numeric, 0::numeric, 7.16::numeric, 0::numeric, 0.1::numeric, 3.5::numeric, 0::numeric, 0.28::numeric, 0.3::numeric, 5.13::numeric, 0.3::numeric, 0::numeric, 134::numeric, 1.575::numeric, 0::numeric),
  -- Pork, liver
  ('O053', 5.52::numeric, 20.74::numeric, 4.19::numeric, 16.59::numeric, 64.89::numeric, 279::numeric, 310::numeric, 33.49::numeric, 0::numeric, 8759::numeric, 3.2::numeric, 0.85::numeric, 4.5::numeric, 0::numeric, 0.16::numeric, 0.31::numeric, 13.76::numeric, 0.37::numeric, 0::numeric, 216::numeric, 1.325::numeric, 0::numeric),
  -- Pork, stomach
  ('O054', 11.75::numeric, 1.92::numeric, 2.34::numeric, 23.32::numeric, 109::numeric, 200::numeric, 125::numeric, 31.64::numeric, 0::numeric, 3.34::numeric, 0.55::numeric, 0.3::numeric, 3.5::numeric, 0::numeric, 0.1::numeric, 0.06::numeric, 1.9::numeric, 0.19::numeric, 0::numeric, 187::numeric, 3.327::numeric, 0::numeric),
  -- Pork, spleen
  ('O055', 6.98::numeric, 27.21::numeric, 2.09::numeric, 16.08::numeric, 49.14::numeric, 325::numeric, 230::numeric, 37.25::numeric, 0::numeric, 8.44::numeric, 0::numeric, 0.17::numeric, 2.5::numeric, 0::numeric, 0.13::numeric, 0.27::numeric, 7.8::numeric, 0.22::numeric, 0::numeric, 201::numeric, 1.245::numeric, 0::numeric),
  -- Pork, kidneys
  ('O056', 6.71::numeric, 6.26::numeric, 1.9::numeric, 15.56::numeric, 138::numeric, 198::numeric, 201::numeric, 206::numeric, 0::numeric, 72.53::numeric, 3.16::numeric, 0.19::numeric, 1.5::numeric, 0::numeric, 0.24::numeric, 0.37::numeric, 6.46::numeric, 0.16::numeric, 0::numeric, 267::numeric, 1.169::numeric, 0::numeric),
  -- Pork, tube (small intestine)
  ('O057', 16.05::numeric, 2.83::numeric, 1.36::numeric, 9.78::numeric, 60.17::numeric, 140::numeric, 124::numeric, 26.44::numeric, 0::numeric, 1.13::numeric, 1.01::numeric, 0.2::numeric, 3.5::numeric, 0::numeric, 0.08::numeric, 0.1::numeric, 0.9::numeric, 0.19::numeric, 0::numeric, 180::numeric, 4.109::numeric, 0::numeric),
  -- Hare, shoulder
  ('O058', 57.51::numeric, 2.98::numeric, 2.72::numeric, 28::numeric, 55.03::numeric, 303::numeric, 260::numeric, 16.38::numeric, 0::numeric, 8.88::numeric, 0.06::numeric, 1.46::numeric, 25.59::numeric, 0::numeric, 0.07::numeric, 0.27::numeric, 5.04::numeric, 0.28::numeric, 0::numeric, 79.93::numeric, 2.698::numeric, 0::numeric),
  -- Hare, chops
  ('O059', 38.36::numeric, 2.78::numeric, 1.45::numeric, 31::numeric, 48.61::numeric, 340::numeric, 295::numeric, 30.25::numeric, 0::numeric, 2.84::numeric, 0.09::numeric, 1.73::numeric, 23.65::numeric, 0::numeric, 0.07::numeric, 0.28::numeric, 4.85::numeric, 0.22::numeric, 0::numeric, 77.7::numeric, 1.028::numeric, 0::numeric),
  -- Hare, leg
  ('O060', 53.02::numeric, 2.46::numeric, 1.62::numeric, 32::numeric, 42.48::numeric, 370::numeric, 275::numeric, 21.01::numeric, 0::numeric, 1.26::numeric, 0.08::numeric, 1.44::numeric, 22.18::numeric, 0::numeric, 0.08::numeric, 0.22::numeric, 5.63::numeric, 0.24::numeric, 0::numeric, 78.81::numeric, 0.91::numeric, 0::numeric),
  -- Rabbit, shoulder
  ('O061', 46.37::numeric, 1.74::numeric, 2.34::numeric, 32::numeric, 61.38::numeric, 361::numeric, 238::numeric, 14.83::numeric, 0::numeric, 5.9::numeric, 0.57::numeric, 1.22::numeric, 24.68::numeric, 0::numeric, 0.03::numeric, 0.14::numeric, 4.38::numeric, 0.3::numeric, 0::numeric, 82.56::numeric, 3.142::numeric, 0::numeric),
  -- Rabbit, chops
  ('O062', 25.48::numeric, 2.42::numeric, 1.3::numeric, 33::numeric, 47.84::numeric, 374::numeric, 245::numeric, 30.22::numeric, 0::numeric, 3.88::numeric, 0.7::numeric, 0.83::numeric, 25.88::numeric, 0::numeric, 0.02::numeric, 0.08::numeric, 7.54::numeric, 0.24::numeric, 0::numeric, 79.17::numeric, 1.907::numeric, 0::numeric),
  -- Rabbit, leg
  ('O063', 22.31::numeric, 1.21::numeric, 1.23::numeric, 21::numeric, 46.03::numeric, 389::numeric, 245::numeric, 24.31::numeric, 0::numeric, 8.49::numeric, 0.43::numeric, 0.72::numeric, 23.85::numeric, 0::numeric, 0.03::numeric, 0.1::numeric, 5.02::numeric, 0.26::numeric, 0::numeric, 76.7::numeric, 1.575::numeric, 0::numeric),
  -- Allathi
  ('P001', 13.78::numeric, 0.62::numeric, 0.3::numeric, 29.08::numeric, 32.68::numeric, 286::numeric, 215::numeric, 12.55::numeric, 0::numeric, 9.6::numeric, 1.28::numeric, 1.02::numeric, 1.98::numeric, 0::numeric, 0.08::numeric, 0.04::numeric, 3.67::numeric, 194::numeric, 0::numeric, 13.98::numeric, 0.346::numeric, 0::numeric),
  -- Aluva
  ('P002', 11.32::numeric, 0.42::numeric, 0.38::numeric, 34.38::numeric, 44.86::numeric, 470::numeric, 245::numeric, 35.15::numeric, 0::numeric, 14.3::numeric, 1.13::numeric, 1::numeric, 8.88::numeric, 0::numeric, 0.05::numeric, 0.02::numeric, 2.35::numeric, 158::numeric, 0::numeric, 21.97::numeric, 0.755::numeric, 0::numeric),
  -- Anchovy
  ('P003', 36.6::numeric, 0.54::numeric, 0.65::numeric, 53::numeric, 212::numeric, 270::numeric, 246::numeric, 56.22::numeric, 0::numeric, 12.18::numeric, 2.87::numeric, 0.73::numeric, 0.6::numeric, 0::numeric, 0.03::numeric, 0.04::numeric, 0.91::numeric, 61.25::numeric, 0::numeric, 29.56::numeric, 0.248::numeric, 0::numeric),
  -- Ari fish
  ('P004', 4.36::numeric, 0.47::numeric, 0.31::numeric, 30.27::numeric, 37.35::numeric, 447::numeric, 265::numeric, 53.21::numeric, 0::numeric, 1.56::numeric, 1.04::numeric, 0.1::numeric, 0.88::numeric, 0::numeric, 0.06::numeric, 0.03::numeric, 3.65::numeric, 218::numeric, 0::numeric, 15.99::numeric, 0.408::numeric, 0::numeric),
  -- Betki
  ('P005', 8.84::numeric, 0.31::numeric, 0.36::numeric, 24.16::numeric, 63.68::numeric, 355::numeric, 188::numeric, 35.75::numeric, 0::numeric, 5.58::numeric, 1.11::numeric, 0.38::numeric, 0.63::numeric, 0::numeric, 0.01::numeric, 0.04::numeric, 1.54::numeric, 85::numeric, 0::numeric, 18.99::numeric, 0.0864::numeric, 0::numeric),
  -- Black snapper
  ('P006', 9.91::numeric, 0.56::numeric, 0.4::numeric, 26.72::numeric, 41.23::numeric, 341::numeric, 195::numeric, 14.4::numeric, 0::numeric, 14.55::numeric, 1.49::numeric, 0.51::numeric, 115::numeric, 0::numeric, 0.02::numeric, 0::numeric, 2.89::numeric, 106::numeric, 0::numeric, 30.45::numeric, 0.47::numeric, 0::numeric),
  -- Bombay duck
  ('P007', 159::numeric, 0.81::numeric, 0.42::numeric, 24.27::numeric, 223::numeric, 188::numeric, 185::numeric, 25.45::numeric, 0::numeric, 3.38::numeric, 1.25::numeric, 0.75::numeric, 1.04::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 0.64::numeric, 98::numeric, 0::numeric, 46.43::numeric, 0.398::numeric, 0::numeric),
  -- Bommuralu
  ('P008', 47.33::numeric, 0.43::numeric, 0.67::numeric, 27.13::numeric, 61.87::numeric, 349::numeric, 207::numeric, 18.01::numeric, 0::numeric, 3.28::numeric, 3.27::numeric, 0.54::numeric, 0.94::numeric, 0::numeric, 0.05::numeric, 0.02::numeric, 1.34::numeric, 68.63::numeric, 0::numeric, 44.68::numeric, 1.238::numeric, 0::numeric),
  -- Cat fish
  ('P009', 5.54::numeric, 0.72::numeric, 0.58::numeric, 25.69::numeric, 35.82::numeric, 429::numeric, 252::numeric, 42.33::numeric, 0::numeric, 14.08::numeric, 1.89::numeric, 0.38::numeric, 0.96::numeric, 0::numeric, 0.05::numeric, 0.05::numeric, 1.38::numeric, 223::numeric, 0::numeric, 18.36::numeric, 0.792::numeric, 0::numeric),
  -- Chakla
  ('P010', 6.55::numeric, 0.41::numeric, 0.57::numeric, 24.71::numeric, 51.41::numeric, 343::numeric, 219::numeric, 58.99::numeric, 0::numeric, 1.39::numeric, 2.15::numeric, 0.72::numeric, 0.62::numeric, 0::numeric, 0.06::numeric, 0.04::numeric, 2.37::numeric, 99.11::numeric, 0::numeric, 30.39::numeric, 0.654::numeric, 0::numeric),
  -- Chappal
  ('P011', 10.22::numeric, 1.29::numeric, 0.67::numeric, 25.85::numeric, 38.12::numeric, 306::numeric, 203::numeric, 52.37::numeric, 0::numeric, 1.37::numeric, 0.25::numeric, 1.09::numeric, 0.77::numeric, 0::numeric, 0.06::numeric, 0.02::numeric, 3.95::numeric, 185::numeric, 0::numeric, 10.84::numeric, 0.199::numeric, 0::numeric),
  -- Chelu
  ('P012', 8.17::numeric, 0.67::numeric, 0.41::numeric, 31.68::numeric, 37.6::numeric, 406::numeric, 252::numeric, 18.43::numeric, 0::numeric, 1.49::numeric, 1.03::numeric, 0.41::numeric, 1.06::numeric, 0::numeric, 0.06::numeric, 0.02::numeric, 2.19::numeric, 161::numeric, 0::numeric, 22.64::numeric, 0.229::numeric, 0::numeric),
  -- Chembali
  ('P013', 23.72::numeric, 0.31::numeric, 0.32::numeric, 30.55::numeric, 38.98::numeric, 323::numeric, 211::numeric, 15.65::numeric, 0::numeric, 1.59::numeric, 0.88::numeric, 1.2::numeric, 1.44::numeric, 0::numeric, 0.03::numeric, 0.06::numeric, 1.8::numeric, 146::numeric, 0::numeric, 10.86::numeric, 0.7::numeric, 0::numeric),
  -- Eri meen
  ('P014', 12.45::numeric, 0.46::numeric, 0.31::numeric, 30.99::numeric, 41.19::numeric, 402::numeric, 243::numeric, 14.36::numeric, 0::numeric, 13.24::numeric, 0.34::numeric, 0.1::numeric, 0.92::numeric, 0::numeric, 0.04::numeric, 0.03::numeric, 2.88::numeric, 190::numeric, 0::numeric, 13.17::numeric, 0.739::numeric, 0::numeric),
  -- Gobro
  ('P015', 24.18::numeric, 0.36::numeric, 0.37::numeric, 28.23::numeric, 52.68::numeric, 316::numeric, 170::numeric, 70.58::numeric, 0::numeric, 1.82::numeric, 0.15::numeric, 0.89::numeric, 1.58::numeric, 0::numeric, 0.07::numeric, 0.02::numeric, 1.27::numeric, 43.72::numeric, 0::numeric, 21.38::numeric, 0.289::numeric, 0::numeric),
  -- Guitar fish
  ('P016', 17.32::numeric, 0.44::numeric, 0.35::numeric, 27.45::numeric, 70.81::numeric, 342::numeric, 230::numeric, 34.66::numeric, 0::numeric, 1.27::numeric, 0.42::numeric, 0.34::numeric, 3.43::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 2.01::numeric, 139::numeric, 0::numeric, 10.48::numeric, 0.114::numeric, 0::numeric),
  -- Hilsa
  ('P017', 19.82::numeric, 1.19::numeric, 0.64::numeric, 30.62::numeric, 80.88::numeric, 341::numeric, 278::numeric, 37.62::numeric, 0::numeric, 7.42::numeric, 5.98::numeric, 1.35::numeric, 0.94::numeric, 0::numeric, 0.01::numeric, 0.04::numeric, 2.85::numeric, 120::numeric, 0::numeric, 82.42::numeric, 9.286::numeric, 0::numeric),
  -- Jallal
  ('P018', 14.73::numeric, 0.46::numeric, 0.83::numeric, 29.12::numeric, 74.33::numeric, 368::numeric, 204::numeric, 41.03::numeric, 0::numeric, 8.49::numeric, 0.97::numeric, 0.62::numeric, 0.64::numeric, 0::numeric, 0.02::numeric, 0.02::numeric, 3.24::numeric, 89.14::numeric, 0::numeric, 19.26::numeric, 0.519::numeric, 0::numeric),
  -- Jathi vela meen
  ('P019', 6.65::numeric, 0.28::numeric, 0.35::numeric, 31.12::numeric, 30.53::numeric, 467::numeric, 249::numeric, 12.35::numeric, 0::numeric, 3.16::numeric, 1.03::numeric, 1.49::numeric, 1.06::numeric, 0::numeric, 0.12::numeric, 0.02::numeric, 2.82::numeric, 67.45::numeric, 0::numeric, 19.98::numeric, 0.837::numeric, 0::numeric),
  -- Kadal bral
  ('P020', 73.92::numeric, 0.31::numeric, 0.38::numeric, 29.55::numeric, 53.66::numeric, 366::numeric, 219::numeric, 52.85::numeric, 0::numeric, 10.63::numeric, 1.62::numeric, 0.12::numeric, 0.55::numeric, 0::numeric, 0.01::numeric, 0.06::numeric, 1.76::numeric, 89.19::numeric, 0::numeric, 26.09::numeric, 0.478::numeric, 0::numeric),
  -- Kadali
  ('P021', 8.62::numeric, 0.38::numeric, 0.35::numeric, 26.23::numeric, 36.06::numeric, 390::numeric, 207::numeric, 16.88::numeric, 0::numeric, 25.61::numeric, 1.04::numeric, 0.58::numeric, 1.02::numeric, 0::numeric, 0.04::numeric, 0.01::numeric, 1.86::numeric, 184::numeric, 0::numeric, 19.88::numeric, 1.611::numeric, 0::numeric),
  -- Kalamaara
  ('P022', 7.54::numeric, 0.5::numeric, 0.38::numeric, 34.29::numeric, 29.33::numeric, 420::numeric, 227::numeric, 57.99::numeric, 0::numeric, 9.04::numeric, 1.5::numeric, 0.82::numeric, 0.85::numeric, 0::numeric, 0.06::numeric, 0.03::numeric, 2.22::numeric, 160::numeric, 0::numeric, 28.79::numeric, 2.107::numeric, 0::numeric),
  -- Kalava
  ('P023', 10.66::numeric, 0.26::numeric, 0.82::numeric, 22.87::numeric, 40.14::numeric, 279::numeric, 177::numeric, 12.34::numeric, 0::numeric, 1.29::numeric, 1.93::numeric, 0.33::numeric, 1.63::numeric, 0::numeric, 0.06::numeric, 0.05::numeric, 2.24::numeric, 135::numeric, 0::numeric, 20.59::numeric, 0.455::numeric, 0::numeric),
  -- Kanamayya
  ('P024', 7.72::numeric, 0.36::numeric, 0.31::numeric, 27.07::numeric, 50.53::numeric, 346::numeric, 194::numeric, 5.6::numeric, 0::numeric, 16.42::numeric, 1.16::numeric, 0.59::numeric, 2.15::numeric, 0::numeric, 0.06::numeric, 0.01::numeric, 1.22::numeric, 83.86::numeric, 0::numeric, 22.07::numeric, 0.209::numeric, 0::numeric),
  -- Kannadi paarai
  ('P025', 9.04::numeric, 0.31::numeric, 0.4::numeric, 32.36::numeric, 59.57::numeric, 432::numeric, 252::numeric, 23.26::numeric, 0::numeric, 12.37::numeric, 0.29::numeric, 0.7::numeric, 0.92::numeric, 0::numeric, 0.04::numeric, 0.03::numeric, 1.81::numeric, 67.09::numeric, 0::numeric, 18.56::numeric, 0.479::numeric, 0::numeric),
  -- Karimeen
  ('P026', 11.73::numeric, 0.6::numeric, 0.46::numeric, 28.49::numeric, 23.72::numeric, 452::numeric, 192::numeric, 19.66::numeric, 0::numeric, 1.29::numeric, 1::numeric, 0.37::numeric, 12.04::numeric, 0::numeric, 0.08::numeric, 0.05::numeric, 1.15::numeric, 90.62::numeric, 0::numeric, 15.62::numeric, 0.577::numeric, 0::numeric),
  -- Karnagawala
  ('P027', 60.03::numeric, 0.44::numeric, 0.41::numeric, 44.3::numeric, 63.27::numeric, 228::numeric, 178::numeric, 16.45::numeric, 0::numeric, 1.82::numeric, 1.28::numeric, 0.12::numeric, 0.85::numeric, 0::numeric, 0.07::numeric, 0.01::numeric, 0.98::numeric, 60.47::numeric, 0::numeric, 35.4::numeric, 0.255::numeric, 0::numeric),
  -- Kayrai
  ('P028', 6::numeric, 0.98::numeric, 0.39::numeric, 31.74::numeric, 25.12::numeric, 321::numeric, 266::numeric, 40.32::numeric, 0::numeric, 10.19::numeric, 3.25::numeric, 0.75::numeric, 1.7::numeric, 0::numeric, 0.08::numeric, 0.07::numeric, 5.18::numeric, 264::numeric, 0::numeric, 29.85::numeric, 1.096::numeric, 0::numeric),
  -- Kiriyan
  ('P029', 19.42::numeric, 1::numeric, 0.82::numeric, 31.98::numeric, 35.88::numeric, 277::numeric, 214::numeric, 23.56::numeric, 0::numeric, 1.62::numeric, 0.76::numeric, 0.35::numeric, 0.93::numeric, 0::numeric, 0.04::numeric, 0.13::numeric, 2.75::numeric, 121::numeric, 0::numeric, 11.15::numeric, 2.102::numeric, 0::numeric),
  -- Kite fish
  ('P030', 11.02::numeric, 1.38::numeric, 0.55::numeric, 28.46::numeric, 59.03::numeric, 387::numeric, 231::numeric, 15.69::numeric, 0::numeric, 1.52::numeric, 0.04::numeric, 0.24::numeric, 1.54::numeric, 0::numeric, 0.04::numeric, 0.07::numeric, 2.5::numeric, 127::numeric, 0::numeric, 15.01::numeric, 0.169::numeric, 0::numeric),
  -- Korka
  ('P031', 11.12::numeric, 0.73::numeric, 1.47::numeric, 28.55::numeric, 43.3::numeric, 349::numeric, 229::numeric, 51.96::numeric, 0::numeric, 6.55::numeric, 0.36::numeric, 0.63::numeric, 1.31::numeric, 0::numeric, 0.03::numeric, 0.17::numeric, 3.42::numeric, 316::numeric, 0::numeric, 107::numeric, 1.407::numeric, 0::numeric),
  -- Kulam paarai
  ('P032', 15.17::numeric, 0.5::numeric, 0.52::numeric, 30.79::numeric, 49.17::numeric, 366::numeric, 244::numeric, 21.51::numeric, 0::numeric, 3.64::numeric, 2.76::numeric, 1.05::numeric, 0.88::numeric, 0::numeric, 0.06::numeric, 0.01::numeric, 1.97::numeric, 218::numeric, 0::numeric, 55.4::numeric, 1.43::numeric, 0::numeric),
  -- Maagaa
  ('P033', 8.42::numeric, 0.23::numeric, 0.35::numeric, 30.32::numeric, 52.28::numeric, 375::numeric, 181::numeric, 32.85::numeric, 0::numeric, 1.76::numeric, 1.27::numeric, 1.03::numeric, 0.75::numeric, 0::numeric, 0.02::numeric, 0.01::numeric, 0.73::numeric, 106::numeric, 0::numeric, 7.24::numeric, 0.201::numeric, 0::numeric),
  -- Mackerel
  ('P034', 31.27::numeric, 1.46::numeric, 0.67::numeric, 37.46::numeric, 83.01::numeric, 309::numeric, 231::numeric, 64.08::numeric, 0::numeric, 16.34::numeric, 0.45::numeric, 0.71::numeric, 5.25::numeric, 0::numeric, 0.07::numeric, 0.1::numeric, 2.67::numeric, 100::numeric, 0::numeric, 46.48::numeric, 0.604::numeric, 0::numeric),
  -- Manda clathi
  ('P035', 11.48::numeric, 0.43::numeric, 0.37::numeric, 37.88::numeric, 58.5::numeric, 431::numeric, 320::numeric, 22.56::numeric, 0::numeric, 1.99::numeric, 1.91::numeric, 0.16::numeric, 0.46::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 2.77::numeric, 87.58::numeric, 0::numeric, 21.03::numeric, 0.337::numeric, 0::numeric),
  -- Matha
  ('P036', 14.02::numeric, 0.32::numeric, 0.32::numeric, 40.24::numeric, 62.58::numeric, 450::numeric, 263::numeric, 17.9::numeric, 0::numeric, 4.99::numeric, 2.06::numeric, 0.61::numeric, 0.78::numeric, 0::numeric, 0.05::numeric, 0.05::numeric, 2.37::numeric, 42.45::numeric, 0::numeric, 20.55::numeric, 0.297::numeric, 0::numeric),
  -- Milk fish
  ('P037', 29.18::numeric, 1.35::numeric, 2.43::numeric, 35.38::numeric, 42.98::numeric, 301::numeric, 292::numeric, 62.25::numeric, 0::numeric, 3.29::numeric, 1.22::numeric, 1.86::numeric, 1.18::numeric, 0::numeric, 0.05::numeric, 0.07::numeric, 5.21::numeric, 76.51::numeric, 0::numeric, 21.38::numeric, 0.366::numeric, 0::numeric),
  -- Moon fish
  ('P038', 29.18::numeric, 1.67::numeric, 0.93::numeric, 37.14::numeric, 65.17::numeric, 157::numeric, 169::numeric, 30.02::numeric, 0::numeric, 8.94::numeric, 0.57::numeric, 1.2::numeric, 4.2::numeric, 0::numeric, 0.07::numeric, 0.07::numeric, 1.83::numeric, 136::numeric, 0::numeric, 68.88::numeric, 2.929::numeric, 0::numeric),
  -- Mullet
  ('P039', 35.2::numeric, 1.31::numeric, 0.45::numeric, 34.09::numeric, 66.09::numeric, 331::numeric, 222::numeric, 40.49::numeric, 0::numeric, 18.38::numeric, 0.5::numeric, 0.53::numeric, 0.83::numeric, 0::numeric, 0.05::numeric, 0.09::numeric, 2.52::numeric, 135::numeric, 0::numeric, 18.3::numeric, 0.495::numeric, 0::numeric),
  -- Mural
  ('P040', 8.61::numeric, 0.24::numeric, 0.71::numeric, 27.1::numeric, 110::numeric, 330::numeric, 224::numeric, 26.36::numeric, 0::numeric, 1.61::numeric, 0.87::numeric, 0.44::numeric, 1.34::numeric, 0::numeric, 0.06::numeric, 0.03::numeric, 2.65::numeric, 67.24::numeric, 0::numeric, 17.43::numeric, 0.349::numeric, 0::numeric),
  -- Myil meen
  ('P041', 7.2::numeric, 1.2::numeric, 0.58::numeric, 30.08::numeric, 61.96::numeric, 365::numeric, 268::numeric, 47.58::numeric, 0::numeric, 21.51::numeric, 0.4::numeric, 0.53::numeric, 0.89::numeric, 0::numeric, 0.04::numeric, 0.04::numeric, 4.41::numeric, 119::numeric, 0::numeric, 21.72::numeric, 0.15::numeric, 0::numeric),
  -- Nalla bontha
  ('P042', 9.04::numeric, 0.31::numeric, 0.3::numeric, 29.2::numeric, 57.87::numeric, 403::numeric, 197::numeric, 12.34::numeric, 0::numeric, 2.4::numeric, 0.55::numeric, 0.11::numeric, 1.2::numeric, 0::numeric, 0.04::numeric, 0.01::numeric, 0.56::numeric, 83.41::numeric, 0::numeric, 15::numeric, 0.238::numeric, 0::numeric),
  -- Narba
  ('P043', 7.21::numeric, 1.11::numeric, 0.45::numeric, 26.33::numeric, 49.51::numeric, 384::numeric, 235::numeric, 42.5::numeric, 0::numeric, 2.93::numeric, 0.39::numeric, 0.9::numeric, 1.11::numeric, 0::numeric, 0.05::numeric, 0.04::numeric, 1.51::numeric, 153::numeric, 0::numeric, 16.06::numeric, 0.603::numeric, 0::numeric),
  -- Paarai
  ('P044', 13.52::numeric, 0.69::numeric, 0.45::numeric, 27.59::numeric, 45.22::numeric, 384::numeric, 284::numeric, 35.63::numeric, 0::numeric, 3.23::numeric, 1.78::numeric, 0.3::numeric, 0.97::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 2.86::numeric, 173::numeric, 0::numeric, 23.29::numeric, 0.72::numeric, 0::numeric),
  -- Padayappa
  ('P045', 9.83::numeric, 0.33::numeric, 1.48::numeric, 28.98::numeric, 33.87::numeric, 490::numeric, 256::numeric, 62.35::numeric, 0::numeric, 1.46::numeric, 0.7::numeric, 0.25::numeric, 0.63::numeric, 0::numeric, 0.03::numeric, 0.05::numeric, 4.53::numeric, 68.93::numeric, 0::numeric, 9.65::numeric, 0.169::numeric, 0::numeric),
  -- Pali kora
  ('P046', 17.03::numeric, 0.42::numeric, 0.38::numeric, 28::numeric, 54.85::numeric, 364::numeric, 195::numeric, 32.15::numeric, 0::numeric, 1.89::numeric, 0.13::numeric, 0.44::numeric, 1.92::numeric, 0::numeric, 0.03::numeric, 0.05::numeric, 0.78::numeric, 126::numeric, 0::numeric, 33.18::numeric, 0.761::numeric, 0::numeric),
  -- Pambada
  ('P047', 16.53::numeric, 0.38::numeric, 0.41::numeric, 29.87::numeric, 82.65::numeric, 263::numeric, 170::numeric, 13.58::numeric, 0::numeric, 2.88::numeric, 1.35::numeric, 0.55::numeric, 0.98::numeric, 0::numeric, 0.04::numeric, 0.03::numeric, 1.96::numeric, 76.49::numeric, 0::numeric, 54.63::numeric, 1.959::numeric, 0::numeric),
  -- Pandukopa
  ('P048', 12.18::numeric, 0.47::numeric, 0.33::numeric, 29.15::numeric, 49.15::numeric, 427::numeric, 203::numeric, 15.65::numeric, 0::numeric, 1.33::numeric, 0.3::numeric, 0.47::numeric, 0.62::numeric, 0::numeric, 0.04::numeric, 0.02::numeric, 0.54::numeric, 262::numeric, 0::numeric, 26.43::numeric, 0.195::numeric, 0::numeric),
  -- Parava
  ('P049', 29.12::numeric, 3.58::numeric, 0.56::numeric, 32.52::numeric, 84.08::numeric, 363::numeric, 194::numeric, 11.54::numeric, 0::numeric, 2.56::numeric, 1.13::numeric, 0.55::numeric, 0.66::numeric, 0::numeric, 0.03::numeric, 0.03::numeric, 0.98::numeric, 153::numeric, 0::numeric, 26.2::numeric, 1.184::numeric, 0::numeric),
  -- Parcus
  ('P050', 21.08::numeric, 0.28::numeric, 0.33::numeric, 28.84::numeric, 64.38::numeric, 446::numeric, 218::numeric, 16.23::numeric, 0::numeric, 1.72::numeric, 0.77::numeric, 0.3::numeric, 1.84::numeric, 0::numeric, 0.04::numeric, 0.02::numeric, 0.88::numeric, 202::numeric, 0::numeric, 10.03::numeric, 0.166::numeric, 0::numeric),
  -- Parrot fish
  ('P051', 9.21::numeric, 0.38::numeric, 0.31::numeric, 28.88::numeric, 51.79::numeric, 432::numeric, 316::numeric, 64.52::numeric, 0::numeric, 2.47::numeric, 0.68::numeric, 0.26::numeric, 2.83::numeric, 0::numeric, 0.06::numeric, 0.02::numeric, 1.89::numeric, 132::numeric, 0::numeric, 9.95::numeric, 0.174::numeric, 0::numeric),
  -- Perinkilichai
  ('P052', 7.25::numeric, 0.29::numeric, 0.36::numeric, 29.01::numeric, 34.16::numeric, 365::numeric, 236::numeric, 26.33::numeric, 0::numeric, 1.62::numeric, 0.44::numeric, 1.1::numeric, 0.95::numeric, 0::numeric, 0.08::numeric, 0.01::numeric, 1.48::numeric, 119::numeric, 0::numeric, 17.24::numeric, 0.29::numeric, 0::numeric),
  -- Phopat
  ('P053', 9.32::numeric, 0.47::numeric, 0.36::numeric, 32.27::numeric, 36.2::numeric, 439::numeric, 258::numeric, 65.53::numeric, 0::numeric, 3.52::numeric, 0.68::numeric, 0.58::numeric, 0.75::numeric, 0::numeric, 0.06::numeric, 0.04::numeric, 4.28::numeric, 131::numeric, 0::numeric, 13.53::numeric, 0.441::numeric, 0::numeric),
  -- Piranha
  ('P054', 14.85::numeric, 0.5::numeric, 0.43::numeric, 23.41::numeric, 38.97::numeric, 323::numeric, 170::numeric, 28.22::numeric, 0::numeric, 1.05::numeric, 1.15::numeric, 0.37::numeric, 3.15::numeric, 0::numeric, 0.04::numeric, 0.05::numeric, 0.97::numeric, 67.91::numeric, 0::numeric, 97.5::numeric, 1.973::numeric, 0::numeric),
  -- Pomfret, black
  ('P055', 18.1::numeric, 0.78::numeric, 0.5::numeric, 28.22::numeric, 69.09::numeric, 295::numeric, 195::numeric, 50.25::numeric, 0::numeric, 10.55::numeric, 2.94::numeric, 0.6::numeric, 102::numeric, 0::numeric, 0.06::numeric, 0.02::numeric, 2.61::numeric, 76::numeric, 0::numeric, 48.16::numeric, 2.229::numeric, 0::numeric),
  -- Pomfret, snub nose
  ('P056', 6.57::numeric, 0.41::numeric, 0.92::numeric, 29.85::numeric, 36.1::numeric, 483::numeric, 247::numeric, 30.62::numeric, 0::numeric, 3.91::numeric, 0.59::numeric, 1.54::numeric, 0.84::numeric, 0::numeric, 0.08::numeric, 0.05::numeric, 1.94::numeric, 77.51::numeric, 0::numeric, 7.48::numeric, 0.145::numeric, 0::numeric),
  -- Pomfret, white
  ('P057', 13.64::numeric, 0.31::numeric, 0.53::numeric, 32.2::numeric, 46.09::numeric, 255::numeric, 211::numeric, 29.33::numeric, 0::numeric, 30.31::numeric, 0.71::numeric, 1.26::numeric, 0.99::numeric, 0::numeric, 0.05::numeric, 0.03::numeric, 1.38::numeric, 130::numeric, 0::numeric, 41.56::numeric, 2.669::numeric, 0::numeric),
  -- Pranel
  ('P058', 21.88::numeric, 0.41::numeric, 0.55::numeric, 26.26::numeric, 52.37::numeric, 251::numeric, 166::numeric, 63.35::numeric, 0::numeric, 1.84::numeric, 0.55::numeric, 0.42::numeric, 0.69::numeric, 0::numeric, 0.04::numeric, 0.13::numeric, 3.37::numeric, 120::numeric, 0::numeric, 29.01::numeric, 0.827::numeric, 0::numeric),
  -- Pulli paarai
  ('P059', 21.84::numeric, 0.35::numeric, 0.52::numeric, 31.12::numeric, 58.56::numeric, 335::numeric, 232::numeric, 53.25::numeric, 0::numeric, 1.75::numeric, 1.61::numeric, 0.82::numeric, 1.24::numeric, 0::numeric, 0.05::numeric, 0.04::numeric, 1.94::numeric, 101::numeric, 0::numeric, 47.79::numeric, 0.593::numeric, 0::numeric),
  -- Queen fish
  ('P060', 5.75::numeric, 0.49::numeric, 0.35::numeric, 28.1::numeric, 48.93::numeric, 440::numeric, 235::numeric, 39.82::numeric, 0::numeric, 1.52::numeric, 0.19::numeric, 0.4::numeric, 0.79::numeric, 0::numeric, 0.06::numeric, 0.04::numeric, 3.24::numeric, 118::numeric, 0::numeric, 21.93::numeric, 0.693::numeric, 0::numeric),
  -- Raai fish
  ('P061', 11.09::numeric, 0.46::numeric, 0.36::numeric, 21.99::numeric, 47.62::numeric, 347::numeric, 213::numeric, 7.92::numeric, 0::numeric, 1.15::numeric, 3.13::numeric, 0.52::numeric, 1.05::numeric, 0::numeric, 0.07::numeric, 0.02::numeric, 1.63::numeric, 108::numeric, 0::numeric, 24.95::numeric, 0.654::numeric, 0::numeric),
  -- Raai vanthu
  ('P062', 8.72::numeric, 0.36::numeric, 0.35::numeric, 27.39::numeric, 50.83::numeric, 311::numeric, 178::numeric, 16.53::numeric, 0::numeric, 2.87::numeric, 1.23::numeric, 0.02::numeric, 1.21::numeric, 0::numeric, 0.03::numeric, 0.01::numeric, 0.72::numeric, 112::numeric, 0::numeric, 21.98::numeric, 0.864::numeric, 0::numeric),
  -- Rani
  ('P063', 37.9::numeric, 0.87::numeric, 0.4::numeric, 29.91::numeric, 63.17::numeric, 335::numeric, 208::numeric, 40.12::numeric, 0::numeric, 1.78::numeric, 1.9::numeric, 1.65::numeric, 0.71::numeric, 0::numeric, 0.01::numeric, 0::numeric, 1.33::numeric, 75.7::numeric, 0::numeric, 69.04::numeric, 2.926::numeric, 0::numeric),
  -- Ray fish, bow head, spotted
  ('P064', 9.64::numeric, 0.25::numeric, 0.49::numeric, 19.25::numeric, 105::numeric, 353::numeric, 196::numeric, 44.37::numeric, 0::numeric, 1.97::numeric, 0.83::numeric, 0.33::numeric, 1.51::numeric, 0::numeric, 0.05::numeric, 0.03::numeric, 1.99::numeric, 120::numeric, 0::numeric, 13.91::numeric, 0.187::numeric, 0::numeric),
  -- Red snapper
  ('P065', 8.39::numeric, 0.37::numeric, 0.34::numeric, 32.65::numeric, 59.89::numeric, 446::numeric, 204::numeric, 12.84::numeric, 0::numeric, 4.77::numeric, 2.37::numeric, 0.41::numeric, 98.48::numeric, 0::numeric, 0.02::numeric, 0.02::numeric, 3.14::numeric, 66.93::numeric, 0::numeric, 132::numeric, 0.485::numeric, 0::numeric),
  -- Red snapper, small
  ('P066', 17.43::numeric, 0.57::numeric, 0.4::numeric, 31.03::numeric, 38.97::numeric, 327::numeric, 204::numeric, 23.65::numeric, 0::numeric, 20.87::numeric, 3.18::numeric, 0.85::numeric, 0.97::numeric, 0::numeric, 0.06::numeric, 0.03::numeric, 3.43::numeric, 172::numeric, 0::numeric, 38.42::numeric, 0.861::numeric, 0::numeric),
  -- Sadaya
  ('P067', 9.08::numeric, 0.47::numeric, 0.68::numeric, 26.27::numeric, 49.41::numeric, 360::numeric, 221::numeric, 23.55::numeric, 0::numeric, 64.2::numeric, 1.61::numeric, 0.52::numeric, 1.77::numeric, 0::numeric, 0.07::numeric, 0.38::numeric, 2.45::numeric, 125::numeric, 0::numeric, 61.97::numeric, 1.059::numeric, 0::numeric),
  -- Salmon
  ('P068', 24.3::numeric, 0.98::numeric, 0.51::numeric, 31.18::numeric, 20.25::numeric, 345::numeric, 211::numeric, 36.34::numeric, 0::numeric, 15.63::numeric, 0.94::numeric, 0.58::numeric, 0.75::numeric, 0::numeric, 0.07::numeric, 0.06::numeric, 4.45::numeric, 150::numeric, 0::numeric, 61.27::numeric, 4.305::numeric, 0::numeric),
  -- Sangada
  ('P069', 7.9::numeric, 0.99::numeric, 0.32::numeric, 28.37::numeric, 77.82::numeric, 217::numeric, 211::numeric, 26::numeric, 0::numeric, 3.07::numeric, 1.05::numeric, 0.36::numeric, 0.71::numeric, 0::numeric, 0.01::numeric, 0.02::numeric, 0.68::numeric, 101::numeric, 0::numeric, 75.77::numeric, 1.128::numeric, 0::numeric),
  -- Sankata paarai
  ('P070', 6.03::numeric, 0.99::numeric, 0.39::numeric, 27.53::numeric, 22.33::numeric, 379::numeric, 246::numeric, 33.02::numeric, 0::numeric, 2.58::numeric, 0.72::numeric, 1.07::numeric, 1.17::numeric, 0::numeric, 0.03::numeric, 0.06::numeric, 3.7::numeric, 181::numeric, 0::numeric, 64.34::numeric, 3.317::numeric, 0::numeric),
  -- Sardine
  ('P071', 42.26::numeric, 0.83::numeric, 0.89::numeric, 24.39::numeric, 38.49::numeric, 228::numeric, 191::numeric, 50.21::numeric, 0::numeric, 12.66::numeric, 3.51::numeric, 0.38::numeric, 2.65::numeric, 0::numeric, 0.01::numeric, 0.06::numeric, 0.91::numeric, 140::numeric, 0::numeric, 49.12::numeric, 1.25::numeric, 0::numeric),
  -- Shark
  ('P072', 8.44::numeric, 0.38::numeric, 0.46::numeric, 32.58::numeric, 63.63::numeric, 372::numeric, 263::numeric, 28.9::numeric, 0::numeric, 1.11::numeric, 0.36::numeric, 0.22::numeric, 0.78::numeric, 0::numeric, 0.03::numeric, 0.04::numeric, 2.68::numeric, 110::numeric, 0::numeric, 24.4::numeric, 0.275::numeric, 0::numeric),
  -- Shark, hammer head
  ('P073', 7.92::numeric, 0.86::numeric, 0.4::numeric, 25.11::numeric, 53.55::numeric, 304::numeric, 200::numeric, 50.31::numeric, 0::numeric, 20.55::numeric, 0.72::numeric, 0.78::numeric, 1.16::numeric, 0::numeric, 0.02::numeric, 0.04::numeric, 2.72::numeric, 73.11::numeric, 0::numeric, 55.81::numeric, 0.264::numeric, 0::numeric),
  -- Shark, spotted
  ('P074', 8.1::numeric, 0.54::numeric, 0.55::numeric, 19.05::numeric, 131::numeric, 318::numeric, 179::numeric, 62.32::numeric, 0::numeric, 12.43::numeric, 1.37::numeric, 0.19::numeric, 0.86::numeric, 0::numeric, 0.05::numeric, 0.05::numeric, 1.02::numeric, 76.56::numeric, 0::numeric, 13.75::numeric, 0.253::numeric, 0::numeric),
  -- Shelavu
  ('P075', 11.42::numeric, 0.52::numeric, 0.42::numeric, 29.9::numeric, 38.73::numeric, 453::numeric, 251::numeric, 30.81::numeric, 0::numeric, 24.82::numeric, 1.87::numeric, 0.36::numeric, 1.72::numeric, 0::numeric, 0.05::numeric, 0.06::numeric, 2.1::numeric, 110::numeric, 0::numeric, 30.5::numeric, 0.677::numeric, 0::numeric),
  -- Silan
  ('P076', 28.82::numeric, 0.56::numeric, 0.58::numeric, 22.64::numeric, 29.39::numeric, 223::numeric, 163::numeric, 20.23::numeric, 0::numeric, 3.07::numeric, 0.18::numeric, 0.48::numeric, 1.74::numeric, 0::numeric, 0.02::numeric, 0.07::numeric, 1.27::numeric, 122::numeric, 0::numeric, 58.93::numeric, 3.615::numeric, 0::numeric),
  -- Silk fish
  ('P077', 10.46::numeric, 0.3::numeric, 0.34::numeric, 27.13::numeric, 41.57::numeric, 440::numeric, 211::numeric, 16.59::numeric, 0::numeric, 1.69::numeric, 0.72::numeric, 0.72::numeric, 0.98::numeric, 0::numeric, 0.03::numeric, 0.04::numeric, 2.24::numeric, 169::numeric, 0::numeric, 10.71::numeric, 0.497::numeric, 0::numeric),
  -- Silver carp
  ('P078', 85.55::numeric, 0.58::numeric, 0.57::numeric, 24.97::numeric, 19.6::numeric, 249::numeric, 187::numeric, 72.55::numeric, 0::numeric, 6.74::numeric, 0.86::numeric, 0.6::numeric, 0.83::numeric, 0::numeric, 0.02::numeric, 0.02::numeric, 1.87::numeric, 136::numeric, 0::numeric, 68.54::numeric, 1.826::numeric, 0::numeric),
  -- Sole fish
  ('P079', 47.28::numeric, 0.33::numeric, 0.17::numeric, 27.96::numeric, 74.57::numeric, 199::numeric, 123::numeric, 40.22::numeric, 0::numeric, 9.53::numeric, 1.13::numeric, 0.18::numeric, 0.74::numeric, 0::numeric, 0.01::numeric, 0.02::numeric, 0.47::numeric, 68.89::numeric, 0::numeric, 16::numeric, 0.416::numeric, 0::numeric),
  -- Stingray
  ('P080', 9.16::numeric, 0.74::numeric, 0.44::numeric, 24.61::numeric, 64.14::numeric, 270::numeric, 174::numeric, 23.85::numeric, 0::numeric, 7.55::numeric, 0.9::numeric, 0.28::numeric, 0.9::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 2.74::numeric, 214::numeric, 0::numeric, 62.47::numeric, 0.289::numeric, 0::numeric),
  -- Tarlava
  ('P081', 11.68::numeric, 0.53::numeric, 0.31::numeric, 30.1::numeric, 67.4::numeric, 370::numeric, 199::numeric, 23.42::numeric, 0::numeric, 5.32::numeric, 2.36::numeric, 0.52::numeric, 0.76::numeric, 0::numeric, 0.04::numeric, 0.04::numeric, 2.13::numeric, 149::numeric, 0::numeric, 18.94::numeric, 0.504::numeric, 0::numeric),
  -- Tholam
  ('P082', 11.4::numeric, 0.6::numeric, 0.36::numeric, 26.14::numeric, 28::numeric, 382::numeric, 241::numeric, 46.23::numeric, 0::numeric, 250::numeric, 3.55::numeric, 0.6::numeric, 1.33::numeric, 0::numeric, 0.04::numeric, 0.03::numeric, 2.74::numeric, 160::numeric, 0::numeric, 59.73::numeric, 0.856::numeric, 0::numeric),
  -- Tilapia
  ('P083', 99.39::numeric, 2.84::numeric, 0.88::numeric, 24.56::numeric, 52.55::numeric, 255::numeric, 184::numeric, 20.85::numeric, 0::numeric, 17.14::numeric, 0.93::numeric, 1.86::numeric, 3.65::numeric, 0::numeric, 0.02::numeric, 0.18::numeric, 1.4::numeric, 176::numeric, 0::numeric, 26.36::numeric, 0.413::numeric, 0::numeric),
  -- Tuna
  ('P084', 9.82::numeric, 1.6::numeric, 0.69::numeric, 35.85::numeric, 52.89::numeric, 357::numeric, 292::numeric, 21.55::numeric, 0::numeric, 16.65::numeric, 0.74::numeric, 0.57::numeric, 11.63::numeric, 0::numeric, 0.06::numeric, 0.07::numeric, 4.73::numeric, 68.24::numeric, 0::numeric, 46.1::numeric, 0.66::numeric, 0::numeric),
  -- Tuna, striped
  ('P085', 6.45::numeric, 1.43::numeric, 0.46::numeric, 26.02::numeric, 22.6::numeric, 273::numeric, 209::numeric, 23.85::numeric, 0::numeric, 21.01::numeric, 0.7::numeric, 0.14::numeric, 1.23::numeric, 0::numeric, 0.07::numeric, 0.15::numeric, 5.04::numeric, 122::numeric, 0::numeric, 64.06::numeric, 0.424::numeric, 0::numeric),
  -- Valava
  ('P086', 37.06::numeric, 0.24::numeric, 0.42::numeric, 39.05::numeric, 91.91::numeric, 365::numeric, 229::numeric, 32.02::numeric, 0::numeric, 1.25::numeric, 0.26::numeric, 0.31::numeric, 0.84::numeric, 0::numeric, 0.13::numeric, 0.02::numeric, 0.86::numeric, 104::numeric, 0::numeric, 15.6::numeric, 0.403::numeric, 0::numeric),
  -- Vanjaram
  ('P087', 9.85::numeric, 0.41::numeric, 0.74::numeric, 36.73::numeric, 34.85::numeric, 473::numeric, 302::numeric, 32.64::numeric, 0::numeric, 81.9::numeric, 1.64::numeric, 0.67::numeric, 0.65::numeric, 0::numeric, 0.03::numeric, 0.07::numeric, 3.46::numeric, 163::numeric, 0::numeric, 67.71::numeric, 2.229::numeric, 0::numeric),
  -- Vela meen
  ('P088', 14.9::numeric, 0.64::numeric, 0.36::numeric, 31.93::numeric, 38.15::numeric, 387::numeric, 280::numeric, 35.45::numeric, 0::numeric, 3.03::numeric, 0.92::numeric, 0.44::numeric, 0.81::numeric, 0::numeric, 0.05::numeric, 0.04::numeric, 5.15::numeric, 97.92::numeric, 0::numeric, 35.85::numeric, 1.857::numeric, 0::numeric),
  -- Vora
  ('P089', 7.64::numeric, 0.27::numeric, 0.29::numeric, 32.27::numeric, 43.66::numeric, 401::numeric, 246::numeric, 23.65::numeric, 0::numeric, 3.2::numeric, 0.76::numeric, 0.65::numeric, 1.97::numeric, 0::numeric, 0.06::numeric, 0.07::numeric, 3.72::numeric, 121::numeric, 0::numeric, 19.34::numeric, 1.207::numeric, 0::numeric),
  -- Whale shark
  ('P090', 8.32::numeric, 0.33::numeric, 0.38::numeric, 20.61::numeric, 116::numeric, 365::numeric, 274::numeric, 33.95::numeric, 0::numeric, 1.97::numeric, 2.17::numeric, 0.17::numeric, 0.81::numeric, 0::numeric, 0.06::numeric, 0.04::numeric, 2.9::numeric, 125::numeric, 0::numeric, 25.33::numeric, 0.266::numeric, 0::numeric),
  -- Xiphinis
  ('P091', 12.08::numeric, 0.54::numeric, 0.56::numeric, 26.38::numeric, 66.21::numeric, 306::numeric, 255::numeric, 32.82::numeric, 0::numeric, 1.14::numeric, 0.09::numeric, 0.76::numeric, 0.78::numeric, 0::numeric, 0.06::numeric, 0.05::numeric, 3.24::numeric, 65.79::numeric, 0::numeric, 27.59::numeric, 0.363::numeric, 0::numeric),
  -- Eggs, Cat fish
  ('P092', 61.69::numeric, 6.65::numeric, 3.11::numeric, 59.93::numeric, 54.83::numeric, 252::numeric, 445::numeric, 43.57::numeric, 0::numeric, 2.55::numeric, 3.27::numeric, 0.28::numeric, 0.53::numeric, 0::numeric, 0::numeric, 0.19::numeric, 1.09::numeric, 148::numeric, 0::numeric, 269::numeric, 1.818::numeric, 0::numeric),
  -- Crab
  ('Q001', 128::numeric, 1.1::numeric, 0.76::numeric, 38.04::numeric, 244::numeric, 171::numeric, 100::numeric, 34.8::numeric, 0::numeric, 1.55::numeric, 0.89::numeric, 6.33::numeric, 1.04::numeric, 0::numeric, 0.01::numeric, 0.1::numeric, 1.66::numeric, 120::numeric, 0::numeric, 53.87::numeric, 0.214::numeric, 0::numeric),
  -- Crab, sea
  ('Q002', 333::numeric, 0.98::numeric, 3.07::numeric, 80.04::numeric, 313::numeric, 252::numeric, 193::numeric, 37.69::numeric, 0::numeric, 5.02::numeric, 0.73::numeric, 2.06::numeric, 1.11::numeric, 0::numeric, 0.05::numeric, 0.06::numeric, 0.97::numeric, 117::numeric, 0::numeric, 23.18::numeric, 0.129::numeric, 0::numeric),
  -- Lobster, brown
  ('Q003', 73.06::numeric, 0.77::numeric, 1.16::numeric, 45.34::numeric, 140::numeric, 212::numeric, 223::numeric, 33.82::numeric, 0::numeric, 1.83::numeric, 0.84::numeric, 1.35::numeric, 1.06::numeric, 0::numeric, 0.01::numeric, 0.01::numeric, 0.63::numeric, 216::numeric, 0::numeric, 32.64::numeric, 0.106::numeric, 0::numeric),
  -- Lobster, king size
  ('Q004', 66.44::numeric, 0.35::numeric, 1.92::numeric, 50.16::numeric, 191::numeric, 315::numeric, 261::numeric, 69.71::numeric, 0::numeric, 15.02::numeric, 0.28::numeric, 0.52::numeric, 1.25::numeric, 0::numeric, 0.01::numeric, 0.02::numeric, 1.87::numeric, 156::numeric, 0::numeric, 41.13::numeric, 0.174::numeric, 0::numeric),
  -- Mud crab
  ('Q005', 201::numeric, 0.87::numeric, 3.3::numeric, 46.92::numeric, 305::numeric, 227::numeric, 153::numeric, 51.97::numeric, 0::numeric, 8.33::numeric, 1.08::numeric, 2.34::numeric, 1.03::numeric, 0::numeric, 0.06::numeric, 0.14::numeric, 0.6::numeric, 180::numeric, 0::numeric, 7.1::numeric, 0.09511::numeric, 0::numeric),
  -- Oyster
  ('Q006', 126::numeric, 0.9::numeric, 7.35::numeric, 22.24::numeric, 41.01::numeric, 122::numeric, 170::numeric, 28.91::numeric, 0::numeric, 25.36::numeric, 0.86::numeric, 1.11::numeric, 1.72::numeric, 0::numeric, 0.06::numeric, 0.07::numeric, 0.71::numeric, 145::numeric, 0::numeric, 32.45::numeric, 1.087::numeric, 0::numeric),
  -- Tiger prawns, brown
  ('Q007', 37.81::numeric, 0.73::numeric, 1.1::numeric, 45.93::numeric, 188::numeric, 141::numeric, 189::numeric, 46.95::numeric, 0::numeric, 1.24::numeric, 1.53::numeric, 3.04::numeric, 297::numeric, 0::numeric, 0.01::numeric, 0.03::numeric, 1.03::numeric, 104::numeric, 0::numeric, 70.8::numeric, 0.121::numeric, 0::numeric),
  -- Tiger Prawns, orange
  ('Q008', 71.89::numeric, 0.39::numeric, 1.16::numeric, 30.5::numeric, 61.05::numeric, 140::numeric, 191::numeric, 54.22::numeric, 0::numeric, 6.55::numeric, 2.25::numeric, 2.87::numeric, 2.32::numeric, 0::numeric, 0.03::numeric, 0.03::numeric, 1.18::numeric, 112::numeric, 0::numeric, 19.47::numeric, 0.177::numeric, 0::numeric),
  -- Clam, green shell
  ('R001', 121::numeric, 1.01::numeric, 1.64::numeric, 73.64::numeric, 322::numeric, 152::numeric, 128::numeric, 76.34::numeric, 0::numeric, 29.04::numeric, 0.93::numeric, 2.7::numeric, 1.48::numeric, 0::numeric, 0.06::numeric, 0.1::numeric, 0.96::numeric, 96::numeric, 0::numeric, 43.74::numeric, 0.285::numeric, 0::numeric),
  -- Clam, white shell, ribbed
  ('R002', 50::numeric, 0.94::numeric, 1.16::numeric, 86.64::numeric, 404::numeric, 245::numeric, 192::numeric, 32.81::numeric, 0::numeric, 8.5::numeric, 2.18::numeric, 1.21::numeric, 1.53::numeric, 0::numeric, 0.06::numeric, 0.11::numeric, 0.9::numeric, 108::numeric, 0::numeric, 23.98::numeric, 0.441::numeric, 0::numeric),
  -- Octopus
  ('R003', 22.1::numeric, 1.08::numeric, 4.07::numeric, 50.92::numeric, 230::numeric, 181::numeric, 131::numeric, 40.21::numeric, 0::numeric, 28::numeric, 0.67::numeric, 0.66::numeric, 0.84::numeric, 0::numeric, 0.05::numeric, 0.05::numeric, 1.18::numeric, 87.71::numeric, 0::numeric, 118::numeric, 0.325::numeric, 0::numeric),
  -- Squid, black
  ('R004', 22.98::numeric, 0.5::numeric, 1.24::numeric, 41.99::numeric, 179::numeric, 162::numeric, 173::numeric, 57.13::numeric, 0::numeric, 2.55::numeric, 0.89::numeric, 0.68::numeric, 1.14::numeric, 0::numeric, 0.02::numeric, 0.04::numeric, 1.04::numeric, 236::numeric, 0::numeric, 231::numeric, 0.287::numeric, 0::numeric),
  -- Squid, hard shell
  ('R005', 8.73::numeric, 0.62::numeric, 1.3::numeric, 35.46::numeric, 99.14::numeric, 116::numeric, 173::numeric, 41.34::numeric, 0::numeric, 1.93::numeric, 1::numeric, 0.55::numeric, 2.26::numeric, 0::numeric, 0.02::numeric, 0.02::numeric, 0.65::numeric, 41.5::numeric, 0::numeric, 60.32::numeric, 0.227::numeric, 0::numeric),
  -- Squid, red
  ('R006', 14.15::numeric, 0.26::numeric, 0.95::numeric, 35.74::numeric, 121::numeric, 134::numeric, 167::numeric, 47.43::numeric, 0::numeric, 4.72::numeric, 1.23::numeric, 0.47::numeric, 1.14::numeric, 0::numeric, 0.03::numeric, 0.02::numeric, 0.71::numeric, 101::numeric, 0::numeric, 126::numeric, 0.448::numeric, 0::numeric),
  -- Squid, white, small
  ('R007', 36.46::numeric, 0.39::numeric, 1.64::numeric, 38.53::numeric, 154::numeric, 134::numeric, 151::numeric, 70.02::numeric, 0::numeric, 8.55::numeric, 0.71::numeric, 0.66::numeric, 1.84::numeric, 0::numeric, 0.01::numeric, 0.03::numeric, 0.71::numeric, 118::numeric, 0::numeric, 324::numeric, 0.304::numeric, 0::numeric),
  -- Cat fish
  ('S001', 21.99::numeric, 0.82::numeric, 0.71::numeric, 18.78::numeric, 28.29::numeric, 250::numeric, 157::numeric, 71.03::numeric, 0::numeric, 13.59::numeric, 1.48::numeric, 0.38::numeric, 0.96::numeric, 0::numeric, 0.01::numeric, 0.07::numeric, 1.74::numeric, 114::numeric, 0::numeric, 84.01::numeric, 2.182::numeric, 0::numeric),
  -- Catla
  ('S002', 43.53::numeric, 1.14::numeric, 0.68::numeric, 25.58::numeric, 36.56::numeric, 301::numeric, 182::numeric, 19.73::numeric, 0::numeric, 4.32::numeric, 2.06::numeric, 2.35::numeric, 1.12::numeric, 0::numeric, 0.01::numeric, 0.03::numeric, 2.21::numeric, 116::numeric, 0::numeric, 64.42::numeric, 1.67::numeric, 0::numeric),
  -- Freshwater Eel
  ('S003', 52.99::numeric, 1.54::numeric, 2.23::numeric, 42.5::numeric, 88.67::numeric, 450::numeric, 361::numeric, 67.32::numeric, 0::numeric, 866::numeric, 4.38::numeric, 1.8::numeric, 1.23::numeric, 0::numeric, 0::numeric, 0.31::numeric, 2.3::numeric, 106::numeric, 0::numeric, 58.64::numeric, 0.981::numeric, 0::numeric),
  -- Gold fish
  ('S004', 47.89::numeric, 0.76::numeric, 1.69::numeric, 21.66::numeric, 27.53::numeric, 243::numeric, 185::numeric, 14.22::numeric, 0::numeric, 22.95::numeric, 0.28::numeric, 2.1::numeric, 1.26::numeric, 0::numeric, 0::numeric, 0.05::numeric, 1.86::numeric, 225::numeric, 0::numeric, 0::numeric, 1.077::numeric, 0::numeric),
  -- Pangas
  ('S005', 11.19::numeric, 0.69::numeric, 0.69::numeric, 25.09::numeric, 37.42::numeric, 282::numeric, 179::numeric, 19.31::numeric, 0::numeric, 14.59::numeric, 0.28::numeric, 2.8::numeric, 0.92::numeric, 0::numeric, 0::numeric, 0.05::numeric, 1.28::numeric, 229::numeric, 0::numeric, 66.89::numeric, 0.863::numeric, 0::numeric),
  -- Rohu
  ('S006', 39.37::numeric, 1.04::numeric, 0.8::numeric, 26.53::numeric, 35.56::numeric, 303::numeric, 200::numeric, 51.5::numeric, 0::numeric, 3.87::numeric, 1.01::numeric, 2.4::numeric, 1.03::numeric, 0::numeric, 0::numeric, 0.04::numeric, 2.33::numeric, 240::numeric, 0::numeric, 47.72::numeric, 2.047::numeric, 0::numeric),
  -- Crab
  ('S007', 199::numeric, 1.1::numeric, 2.49::numeric, 66.77::numeric, 280::numeric, 286::numeric, 208::numeric, 71.84::numeric, 0::numeric, 12.55::numeric, 1.37::numeric, 4.85::numeric, 0.91::numeric, 0::numeric, 0.01::numeric, 0.11::numeric, 1.54::numeric, 202::numeric, 0::numeric, 52.91::numeric, 0.214::numeric, 0::numeric),
  -- Prawns, big
  ('S008', 48.55::numeric, 0.78::numeric, 1.44::numeric, 39.25::numeric, 849::numeric, 269::numeric, 237::numeric, 28.59::numeric, 0::numeric, 3.56::numeric, 0.45::numeric, 0::numeric, 0.84::numeric, 0::numeric, 0::numeric, 0.02::numeric, 1.31::numeric, 186::numeric, 0::numeric, 87.28::numeric, 0.08686::numeric, 0::numeric),
  -- Prawns, small
  ('S009', 67.99::numeric, 0.87::numeric, 0.87::numeric, 26.91::numeric, 77.71::numeric, 224::numeric, 192::numeric, 19.92::numeric, 0::numeric, 2.78::numeric, 1.1::numeric, 1.75::numeric, 0.8::numeric, 0::numeric, 0.01::numeric, 0.03::numeric, 0.54::numeric, 207::numeric, 0::numeric, 112::numeric, 0.197::numeric, 0::numeric),
  -- Tiger prawns
  ('S010', 57.9::numeric, 0.84::numeric, 1.02::numeric, 22.94::numeric, 80.77::numeric, 149::numeric, 155::numeric, 14.69::numeric, 0::numeric, 0.55::numeric, 1.61::numeric, 1.65::numeric, 1.02::numeric, 0::numeric, 0.01::numeric, 0.04::numeric, 1.28::numeric, 216::numeric, 0::numeric, 78.87::numeric, 0.134::numeric, 0::numeric)
)
update foods f set
  calcium_mg = m.calcium_mg,
  iron_mg = m.iron_mg,
  zinc_mg = m.zinc_mg,
  magnesium_mg = m.magnesium_mg,
  sodium_mg = m.sodium_mg,
  potassium_mg = m.potassium_mg,
  phosphorus_mg = m.phosphorus_mg,
  selenium_ug = m.selenium_ug,
  vit_a_ug = m.vit_a_ug,
  retinol_ug = m.retinol_ug,
  vit_d_ug = m.vit_d_ug,
  vit_e_mg = m.vit_e_mg,
  vit_k_ug = m.vit_k_ug,
  vit_c_mg = m.vit_c_mg,
  vit_b1_mg = m.vit_b1_mg,
  vit_b2_mg = m.vit_b2_mg,
  vit_b3_mg = m.vit_b3_mg,
  vit_b6_mg = m.vit_b6_mg,
  folate_ug = m.folate_ug,
  cholesterol_mg = m.cholesterol_mg,
  saturated_fat_g = m.saturated_fat_g,
  oxalate_mg = m.oxalate_mg
from micro m
where m.food_code = f.food_code;

-- Proof on screen. Expect 528, and the four spot-checks alongside it.
select count(*) filter (where calcium_mg is not null) as foods_with_micronutrients,
       max(calcium_mg)  filter (where food_code = 'L002') as milk_calcium_mg,
       max(iron_mg)     filter (where food_code = 'C033') as spinach_iron_mg,
       max(folate_ug)   filter (where food_code = 'C033') as spinach_folate_ug,
       max(cholesterol_mg) filter (where food_code = 'M001') as egg_cholesterol_mg
  from foods;
