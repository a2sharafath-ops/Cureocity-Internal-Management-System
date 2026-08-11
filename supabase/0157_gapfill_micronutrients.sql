-- Micronutrients for the 198 foods that are not in IFCT, and a correction to
-- the vitamin A figure 0155 imported.
--
-- ===========================================================================
-- A. THE VITAMIN A COLUMN WAS FILLED FROM THE WRONG IFCT COLUMN
-- ===========================================================================
--
-- 0155 took vit_a_ug from IFCT's 'cartbeq' — beta-carotene equivalents. IFCT
-- also publishes 'vita', which is retinol PLUS beta-carotene equivalents, and
-- that is the vitamin A figure a dietitian means.
--
-- For a plant food the two are identical, because there is no retinol in a
-- carrot: spinach reads 2,605 either way. For anything from an animal they are
-- not. A whole egg is 198 ug of retinol and 15 of beta-carotene equivalents, so
-- 0155 gave it 15 ug of vitamin A when IFCT says 213. Every egg, milk, meat and
-- fish row in the table understates vitamin A, and the plant rows — which is
-- most of the table — are unaffected, which is exactly why it survived the spot
-- checks: milk, spinach, rice and coconut all looked right.
--
-- All 528 IFCT rows are rewritten from 'vita' below.
--
-- ===========================================================================
-- B. THE 198 FOODS FROM UK CoFID AND USDA
-- ===========================================================================
--
-- These arrived in 0142 as gap-fills, with the five macros and nothing else,
-- and 0155 could not touch them because they are not IFCT foods. The data was
-- already on disk the whole time: INDB ships UK_fct.xlsx and US_fct.xlsx with
-- 44 columns each, and 39 of them are the micronutrients. Same files, same
-- codes, already matched.
--
-- It matters more than 198 sounds. These are the foods in everything:
--
--   Salt            in 829 recipes   sodium 39,300 mg per 100 g
--   Water           in 554           zero, and now provably rather than blankly
--   Sunflower oil   in 469
--   Chilli powder   in 316           potassium 1,950 mg, iron 17.3 mg
--   Garam masala    in 186           calcium 760 mg, iron 32.6 mg
--
-- Salt is the one to notice. A clinic watching blood pressure had no sodium
-- figure for salt in any of 829 recipes, which made every sodium total in the
-- library meaningless. It is the single most important number in this file.
--
-- ===========================================================================
-- READING THE SOURCES HONESTLY
-- ===========================================================================
--
-- 'Tr' is a trace — recorded as zero, which is what it means to one decimal.
-- 'N' is NOT MEASURED and is left empty, because 0156 is a whole migration
-- about what happens when those two get confused.
--
-- Vitamin A is not defined identically by the two sources. IFCT gives retinol
-- plus beta-carotene equivalents; CoFID gives retinol equivalents, which counts
-- beta-carotene at a sixth. A total mixing the two is therefore approximate in
-- a way the other columns are not. Correcting that needs the carotene figures
-- CoFID does not publish for most of these, so it is recorded here rather than
-- silently averaged.
--
-- Oxalate and retinol stay empty for these 198: IFCT publishes both, CoFID and
-- USDA publish neither, and an empty column is the honest answer.
--
-- Still nothing computes with any of this. A recipe's calcium cannot be added
-- up until the arithmetic in lib/nutrition.ts is extended past five nutrients,
-- which is the next step and a separate one.
--
-- Re-running is safe.

-- ---------------------------------------------------------------------------
-- A. Vitamin A, from IFCT's own total.
-- ---------------------------------------------------------------------------

with vita (food_code, ug) as (values
  ('A001', 0::numeric),
  ('A002', 0::numeric),
  ('A003', 28.23::numeric),
  ('A004', 0::numeric),
  ('A005', 8.29::numeric),
  ('A006', 296::numeric),
  ('A007', 73.53::numeric),
  ('A008', 105.4::numeric),
  ('A009', 5.12::numeric),
  ('A010', 1.53::numeric),
  ('A011', 0::numeric),
  ('A012', 0::numeric),
  ('A013', 0::numeric),
  ('A014', 0::numeric),
  ('A015', 0::numeric),
  ('A016', 1.91::numeric),
  ('A017', 1.41::numeric),
  ('A018', 1.97::numeric),
  ('A019', 2.67::numeric),
  ('A020', 3.03::numeric),
  ('A021', 2.55::numeric),
  ('A022', 1.6::numeric),
  ('A023', 1.68::numeric),
  ('A024', 0.92::numeric),
  ('B001', 165::numeric),
  ('B002', 172::numeric),
  ('B003', 10.11::numeric),
  ('B004', 12.8::numeric),
  ('B005', 7.08::numeric),
  ('B006', 8.21::numeric),
  ('B007', 0::numeric),
  ('B008', 0::numeric),
  ('B009', 0::numeric),
  ('B010', 122::numeric),
  ('B011', 137::numeric),
  ('B012', 58.57::numeric),
  ('B013', 6.34::numeric),
  ('B014', 10.29::numeric),
  ('B015', 12.64::numeric),
  ('B016', 3.57::numeric),
  ('B017', 65.71::numeric),
  ('B018', 1.95::numeric),
  ('B019', 2.16::numeric),
  ('B020', 1.6::numeric),
  ('B021', 127::numeric),
  ('B022', 149::numeric),
  ('B023', 0::numeric),
  ('B024', 3.5::numeric),
  ('B025', 2.82::numeric),
  ('C001', 12582::numeric),
  ('C002', 8553::numeric),
  ('C003', 8457::numeric),
  ('C004', 8464::numeric),
  ('C005', 1594::numeric),
  ('C006', 1487::numeric),
  ('C007', 2473::numeric),
  ('C008', 1075::numeric),
  ('C009', 1703::numeric),
  ('C010', 4377::numeric),
  ('C011', 5103::numeric),
  ('C012', 360::numeric),
  ('C013', 5.5::numeric),
  ('C014', 104::numeric),
  ('C015', 20.48::numeric),
  ('C016', 31.17::numeric),
  ('C017', 146::numeric),
  ('C018', 5758::numeric),
  ('C019', 17542::numeric),
  ('C020', 9245::numeric),
  ('C021', 88.72::numeric),
  ('C022', 5285::numeric),
  ('C023', 5143::numeric),
  ('C024', 12.04::numeric),
  ('C025', 1285::numeric),
  ('C026', 2619::numeric),
  ('C027', 2450::numeric),
  ('C028', 2710::numeric),
  ('C029', 5288::numeric),
  ('C030', 1455::numeric),
  ('C031', 2591::numeric),
  ('C032', 2754::numeric),
  ('C033', 2605::numeric),
  ('C034', 168::numeric),
  ('D001', 0::numeric),
  ('D002', 0::numeric),
  ('D003', 35.52::numeric),
  ('D004', 122::numeric),
  ('D005', 126::numeric),
  ('D006', 130::numeric),
  ('D007', 44.05::numeric),
  ('D008', 47.13::numeric),
  ('D009', 44.82::numeric),
  ('D010', 126::numeric),
  ('D011', 130::numeric),
  ('D012', 138::numeric),
  ('D013', 140::numeric),
  ('D014', 123::numeric),
  ('D015', 129::numeric),
  ('D016', 155::numeric),
  ('D017', 162::numeric),
  ('D018', 158::numeric),
  ('D019', 161::numeric),
  ('D020', 162::numeric),
  ('D021', 144::numeric),
  ('D022', 138::numeric),
  ('D023', 134::numeric),
  ('D024', 162::numeric),
  ('D025', 155::numeric),
  ('D026', 146::numeric),
  ('D027', 130::numeric),
  ('D028', 119::numeric),
  ('D029', 139::numeric),
  ('D030', 155::numeric),
  ('D031', 146::numeric),
  ('D032', 6.38::numeric),
  ('D033', 328::numeric),
  ('D034', 246::numeric),
  ('D035', 166::numeric),
  ('D036', 1.59::numeric),
  ('D037', 465::numeric),
  ('D038', 1.57::numeric),
  ('D039', 241::numeric),
  ('D040', 4.97::numeric),
  ('D041', 2.3::numeric),
  ('D042', 1.52::numeric),
  ('D043', 5.33::numeric),
  ('D044', 4.8::numeric),
  ('D045', 5.55::numeric),
  ('D046', 17.28::numeric),
  ('D047', 638.5::numeric),
  ('D048', 630.3::numeric),
  ('D049', 416.6::numeric),
  ('D050', 391.2::numeric),
  ('D051', 0::numeric),
  ('D052', 0::numeric),
  ('D053', 0::numeric),
  ('D054', 134::numeric),
  ('D055', 147::numeric),
  ('D056', 69.1::numeric),
  ('D057', 84.31::numeric),
  ('D058', 700::numeric),
  ('D059', 240.8::numeric),
  ('D060', 13.1::numeric),
  ('D061', 121::numeric),
  ('D062', 35.36::numeric),
  ('D063', 3.01::numeric),
  ('D064', 2.39::numeric),
  ('D065', 426.9::numeric),
  ('D066', 239.7::numeric),
  ('D067', 165::numeric),
  ('D068', 348::numeric),
  ('D069', 349::numeric),
  ('D070', 61.29::numeric),
  ('D071', 61.64::numeric),
  ('D072', 62.84::numeric),
  ('D073', 7.96::numeric),
  ('D074', 38.13::numeric),
  ('D075', 1520::numeric),
  ('D076', 914.4::numeric),
  ('D077', 85.79::numeric),
  ('D078', 69.9::numeric),
  ('E001', 2.41::numeric),
  ('E002', 2.2::numeric),
  ('E003', 2.08::numeric),
  ('E004', 2.11::numeric),
  ('E005', 1806::numeric),
  ('E006', 1372::numeric),
  ('E007', 12::numeric),
  ('E008', 2.5::numeric),
  ('E009', 56.63::numeric),
  ('E010', 59.04::numeric),
  ('E011', 53.64::numeric),
  ('E012', 60.35::numeric),
  ('E013', 52.32::numeric),
  ('E014', 40.78::numeric),
  ('E015', 62.48::numeric),
  ('E016', 0::numeric),
  ('E017', 2700::numeric),
  ('E018', 2705::numeric),
  ('E019', 2781::numeric),
  ('E020', 2.4::numeric),
  ('E021', 1.58::numeric),
  ('E022', 29.36::numeric),
  ('E023', 30.77::numeric),
  ('E024', 19.94::numeric),
  ('E025', 19.73::numeric),
  ('E026', 25.46::numeric),
  ('E027', 20.58::numeric),
  ('E028', 298::numeric),
  ('E029', 267::numeric),
  ('E030', 23.53::numeric),
  ('E031', 1.55::numeric),
  ('E032', 15.64::numeric),
  ('E033', 2.62::numeric),
  ('E034', 2.54::numeric),
  ('E035', 1.47::numeric),
  ('E036', 1171::numeric),
  ('E037', 670.6::numeric),
  ('E038', 1187::numeric),
  ('E039', 1271::numeric),
  ('E040', 1294::numeric),
  ('E041', 1063::numeric),
  ('E042', 606.6::numeric),
  ('E043', 1.8::numeric),
  ('E044', 2.2::numeric),
  ('E045', 771::numeric),
  ('E046', 6.87::numeric),
  ('E047', 81.72::numeric),
  ('E048', 0::numeric),
  ('E049', 1342::numeric),
  ('E050', 0::numeric),
  ('E051', 14.6::numeric),
  ('E052', 7.39::numeric),
  ('E053', 31.21::numeric),
  ('E054', 1.32::numeric),
  ('E055', 2.05::numeric),
  ('E056', 11.98::numeric),
  ('E057', 3.71::numeric),
  ('E058', 2.53::numeric),
  ('E059', 2.9::numeric),
  ('E060', 80.7::numeric),
  ('E061', 2.2::numeric),
  ('E062', 1.4::numeric),
  ('E063', 2.19::numeric),
  ('E064', 1.54::numeric),
  ('E065', 605::numeric),
  ('E066', 576::numeric),
  ('E067', 3.81::numeric),
  ('E068', 1.5::numeric),
  ('F001', 10.14::numeric),
  ('F002', 8077::numeric),
  ('F003', 3834::numeric),
  ('F004', 6.5::numeric),
  ('F005', 0::numeric),
  ('F006', 0::numeric),
  ('F007', 0::numeric),
  ('F008', 0::numeric),
  ('F009', 1.62::numeric),
  ('F010', 0::numeric),
  ('F011', 1.2::numeric),
  ('F012', 0::numeric),
  ('F013', 5376::numeric),
  ('F014', 11.12::numeric),
  ('F015', 0::numeric),
  ('F016', 0::numeric),
  ('F017', 208.3::numeric),
  ('F018', 158::numeric),
  ('F019', 239::numeric),
  ('G001', 31.69::numeric),
  ('G002', 232::numeric),
  ('G003', 158::numeric),
  ('G004', 67.84::numeric),
  ('G005', 45.41::numeric),
  ('G006', 508::numeric),
  ('G007', 44::numeric),
  ('G008', 125::numeric),
  ('G009', 3808::numeric),
  ('G010', 7807::numeric),
  ('G011', 0::numeric),
  ('G012', 0::numeric),
  ('G013', 0::numeric),
  ('G014', 88.85::numeric),
  ('G015', 76.62::numeric),
  ('G016', 4602::numeric),
  ('G017', 1.08::numeric),
  ('G018', 1.1::numeric),
  ('G019', 6.42::numeric),
  ('G020', 21.91::numeric),
  ('G021', 77.48::numeric),
  ('G022', 3141::numeric),
  ('G023', 82.06::numeric),
  ('G024', 122::numeric),
  ('G025', 89.19::numeric),
  ('G026', 142::numeric),
  ('G027', 2322::numeric),
  ('G028', 15.37::numeric),
  ('G029', 797.4::numeric),
  ('G030', 933::numeric),
  ('G031', 1089::numeric),
  ('G032', 3.51::numeric),
  ('G033', 55.2::numeric),
  ('H001', 0::numeric),
  ('H002', 0::numeric),
  ('H003', 0::numeric),
  ('H004', 0::numeric),
  ('H005', 0::numeric),
  ('H006', 0::numeric),
  ('H007', 2.66::numeric),
  ('H008', 0::numeric),
  ('H009', 13.09::numeric),
  ('H010', 5.41::numeric),
  ('H011', 12.94::numeric),
  ('H012', 22.75::numeric),
  ('H013', 36.72::numeric),
  ('H014', 1.05::numeric),
  ('H015', 2.15::numeric),
  ('H016', 11.22::numeric),
  ('H017', 1.98::numeric),
  ('H018', 110::numeric),
  ('H019', 2.07::numeric),
  ('H020', 8.15::numeric),
  ('H021', 14.47::numeric),
  ('I001', 0::numeric),
  ('I002', 7.87::numeric),
  ('J001', 0::numeric),
  ('J002', 0::numeric),
  ('J003', 0::numeric),
  ('J004', 0::numeric),
  ('K001', 0::numeric),
  ('K002', 0::numeric),
  ('L001', 8.42::numeric),
  ('L002', 13.67::numeric),
  ('L003', 4.39::numeric),
  ('L004', 3.52::numeric),
  ('M001', 212.6::numeric),
  ('M002', 0::numeric),
  ('M003', 630::numeric),
  ('M004', 194.3::numeric),
  ('M005', 0::numeric),
  ('M006', 526.3::numeric),
  ('M007', 193.1::numeric),
  ('M008', 226.1::numeric),
  ('M009', 213.5::numeric),
  ('M010', 217.7::numeric),
  ('M011', 214.8::numeric),
  ('M012', 227.7::numeric),
  ('M013', 205.1::numeric),
  ('M014', 167.5::numeric),
  ('M015', 152.4::numeric),
  ('N001', 10.95::numeric),
  ('N002', 16.48::numeric),
  ('N003', 6.96::numeric),
  ('N004', 31.21::numeric),
  ('N005', 3486::numeric),
  ('N006', 46.78::numeric),
  ('N007', 17.44::numeric),
  ('N008', 27::numeric),
  ('N009', 8.52::numeric),
  ('N010', 27.52::numeric),
  ('N011', 48.86::numeric),
  ('N012', 2.84::numeric),
  ('N013', 2.26::numeric),
  ('N014', 15.25::numeric),
  ('N015', 12.84::numeric),
  ('N016', 8.15::numeric),
  ('N017', 13.11::numeric),
  ('N018', 8.97::numeric),
  ('N019', 18.07::numeric),
  ('O001', 7.57::numeric),
  ('O002', 2.55::numeric),
  ('O003', 8.51::numeric),
  ('O004', 1.98::numeric),
  ('O005', 8.95::numeric),
  ('O006', 2.75::numeric),
  ('O007', 5.9::numeric),
  ('O008', 15655::numeric),
  ('O009', 2.17::numeric),
  ('O010', 7.85::numeric),
  ('O011', 68.56::numeric),
  ('O012', 2.62::numeric),
  ('O013', 2.48::numeric),
  ('O014', 8.71::numeric),
  ('O015', 3.49::numeric),
  ('O016', 9.93::numeric),
  ('O017', 1.55::numeric),
  ('O018', 7.33::numeric),
  ('O019', 2.45::numeric),
  ('O020', 4.64::numeric),
  ('O021', 14106::numeric),
  ('O022', 2.72::numeric),
  ('O023', 6.61::numeric),
  ('O024', 68.68::numeric),
  ('O025', 15.51::numeric),
  ('O026', 2.43::numeric),
  ('O027', 2.52::numeric),
  ('O028', 2.18::numeric),
  ('O029', 5.56::numeric),
  ('O030', 1.89::numeric),
  ('O031', 10.13::numeric),
  ('O032', 9119::numeric),
  ('O033', 4.29::numeric),
  ('O034', 8.71::numeric),
  ('O035', 98.04::numeric),
  ('O036', 13.17::numeric),
  ('O037', 2.1::numeric),
  ('O038', 2.42::numeric),
  ('O039', 1.41::numeric),
  ('O040', 4.63::numeric),
  ('O041', 4.83::numeric),
  ('O042', 9664::numeric),
  ('O043', 6.32::numeric),
  ('O044', 95.73::numeric),
  ('O045', 12.68::numeric),
  ('O046', 2.62::numeric),
  ('O047', 2.47::numeric),
  ('O048', 5.12::numeric),
  ('O049', 1.51::numeric),
  ('O050', 2.98::numeric),
  ('O051', 5.14::numeric),
  ('O052', 7.16::numeric),
  ('O053', 8759::numeric),
  ('O054', 3.34::numeric),
  ('O055', 8.44::numeric),
  ('O056', 72.53::numeric),
  ('O057', 1.13::numeric),
  ('O058', 8.88::numeric),
  ('O059', 2.84::numeric),
  ('O060', 1.26::numeric),
  ('O061', 5.9::numeric),
  ('O062', 3.88::numeric),
  ('O063', 8.49::numeric),
  ('P001', 9.6::numeric),
  ('P002', 14.3::numeric),
  ('P003', 12.18::numeric),
  ('P004', 1.56::numeric),
  ('P005', 5.58::numeric),
  ('P006', 14.55::numeric),
  ('P007', 3.38::numeric),
  ('P008', 3.28::numeric),
  ('P009', 14.08::numeric),
  ('P010', 1.39::numeric),
  ('P011', 1.37::numeric),
  ('P012', 1.49::numeric),
  ('P013', 1.59::numeric),
  ('P014', 13.24::numeric),
  ('P015', 1.82::numeric),
  ('P016', 1.27::numeric),
  ('P017', 7.42::numeric),
  ('P018', 8.49::numeric),
  ('P019', 3.16::numeric),
  ('P020', 10.63::numeric),
  ('P021', 25.61::numeric),
  ('P022', 9.04::numeric),
  ('P023', 1.29::numeric),
  ('P024', 16.42::numeric),
  ('P025', 12.37::numeric),
  ('P026', 1.29::numeric),
  ('P027', 1.82::numeric),
  ('P028', 10.19::numeric),
  ('P029', 1.62::numeric),
  ('P030', 1.52::numeric),
  ('P031', 6.55::numeric),
  ('P032', 3.64::numeric),
  ('P033', 1.76::numeric),
  ('P034', 16.34::numeric),
  ('P035', 1.99::numeric),
  ('P036', 4.99::numeric),
  ('P037', 3.29::numeric),
  ('P038', 8.94::numeric),
  ('P039', 18.38::numeric),
  ('P040', 1.61::numeric),
  ('P041', 21.51::numeric),
  ('P042', 2.4::numeric),
  ('P043', 2.93::numeric),
  ('P044', 3.23::numeric),
  ('P045', 1.46::numeric),
  ('P046', 1.89::numeric),
  ('P047', 2.88::numeric),
  ('P048', 1.33::numeric),
  ('P049', 2.56::numeric),
  ('P050', 1.72::numeric),
  ('P051', 2.47::numeric),
  ('P052', 1.62::numeric),
  ('P053', 3.52::numeric),
  ('P054', 1.05::numeric),
  ('P055', 10.55::numeric),
  ('P056', 3.91::numeric),
  ('P057', 30.31::numeric),
  ('P058', 1.84::numeric),
  ('P059', 1.75::numeric),
  ('P060', 1.52::numeric),
  ('P061', 1.15::numeric),
  ('P062', 2.87::numeric),
  ('P063', 1.78::numeric),
  ('P064', 1.97::numeric),
  ('P065', 4.77::numeric),
  ('P066', 20.87::numeric),
  ('P067', 64.2::numeric),
  ('P068', 15.63::numeric),
  ('P069', 3.07::numeric),
  ('P070', 2.58::numeric),
  ('P071', 12.66::numeric),
  ('P072', 1.11::numeric),
  ('P073', 20.55::numeric),
  ('P074', 12.43::numeric),
  ('P075', 24.82::numeric),
  ('P076', 3.07::numeric),
  ('P077', 1.69::numeric),
  ('P078', 6.74::numeric),
  ('P079', 9.53::numeric),
  ('P080', 7.55::numeric),
  ('P081', 5.32::numeric),
  ('P082', 250::numeric),
  ('P083', 17.14::numeric),
  ('P084', 16.65::numeric),
  ('P085', 21.01::numeric),
  ('P086', 1.25::numeric),
  ('P087', 81.9::numeric),
  ('P088', 3.03::numeric),
  ('P089', 3.2::numeric),
  ('P090', 1.97::numeric),
  ('P091', 1.14::numeric),
  ('P092', 2.55::numeric),
  ('Q001', 1.55::numeric),
  ('Q002', 5.02::numeric),
  ('Q003', 1.83::numeric),
  ('Q004', 15.02::numeric),
  ('Q005', 8.33::numeric),
  ('Q006', 25.36::numeric),
  ('Q007', 1.24::numeric),
  ('Q008', 6.55::numeric),
  ('R001', 29.04::numeric),
  ('R002', 8.5::numeric),
  ('R003', 28::numeric),
  ('R004', 2.55::numeric),
  ('R005', 1.93::numeric),
  ('R006', 4.72::numeric),
  ('R007', 8.55::numeric),
  ('S001', 13.59::numeric),
  ('S002', 4.32::numeric),
  ('S003', 866::numeric),
  ('S004', 22.95::numeric),
  ('S005', 14.59::numeric),
  ('S006', 3.87::numeric),
  ('S007', 12.55::numeric),
  ('S008', 3.56::numeric),
  ('S009', 2.78::numeric),
  ('S010', 0.55::numeric)
)
update foods f set vit_a_ug = v.ug from vita v where v.food_code = f.food_code;

-- ---------------------------------------------------------------------------
-- B. The gap-fill foods.
-- ---------------------------------------------------------------------------

with micro (food_code, calcium_mg, iron_mg, zinc_mg, magnesium_mg, sodium_mg, potassium_mg, phosphorus_mg, selenium_ug, vit_a_ug, retinol_ug, vit_d_ug, vit_e_mg, vit_k_ug, vit_c_mg, vit_b1_mg, vit_b2_mg, vit_b3_mg, vit_b6_mg, folate_ug, cholesterol_mg, saturated_fat_g, oxalate_mg) as (values
  -- Salt — UK_fct, used in 829 recipes
  ('G528', 10::numeric, 0.3::numeric, 0.1::numeric, 76::numeric, 39300::numeric, 89::numeric, 1::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Water, distilled — UK_fct, used in 554 recipes
  ('K505', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Oil, sunflower — UK_fct, used in 469 recipes
  ('T508', 0::numeric, 0.1::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 49.22::numeric, 6.3::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 12::numeric, null::numeric),
  -- Chilli powder — UK_fct, used in 316 recipes
  ('G516', 330::numeric, 17.3::numeric, 4.3::numeric, 149::numeric, 4000::numeric, 1950::numeric, 300::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, 105.7::numeric, 1::numeric, 0.25::numeric, 0.94::numeric, 11.6::numeric, 2.1::numeric, 28::numeric, 0::numeric, 2.46::numeric, null::numeric),
  -- Butter, unsalted — UK_fct, used in 284 recipes
  ('T501', 18::numeric, 0::numeric, 0.1::numeric, 2::numeric, 8::numeric, 27::numeric, 23::numeric, 0::numeric, 958::numeric, null::numeric, null::numeric, 1.85::numeric, 7.4::numeric, 0::numeric, 0::numeric, 0.07::numeric, 0::numeric, 0::numeric, 0::numeric, 213::numeric, 52.09::numeric, null::numeric),
  -- Sugar, white — UK_fct, used in 278 recipes
  ('I502', 10::numeric, 0.2::numeric, 0.1::numeric, 2::numeric, 5::numeric, 5::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Garam masala — UK_fct, used in 186 recipes
  ('G523', 760::numeric, 32.6::numeric, 3.8::numeric, 330::numeric, 97::numeric, 1450::numeric, 390::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.35::numeric, 0.33::numeric, 2.5::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric),
  -- Sugar, icing — UK_fct, used in 167 recipes
  ('I504', 2::numeric, 0.5::numeric, 0.1::numeric, 0::numeric, 12::numeric, 11::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Yogurt, whole milk, plain — UK_fct, used in 119 recipes
  ('L520', 200::numeric, 0.1::numeric, 0.7::numeric, 19::numeric, 80::numeric, 280::numeric, 170::numeric, 2::numeric, 28::numeric, null::numeric, null::numeric, 0.05::numeric, null::numeric, 1::numeric, 0.06::numeric, 0.27::numeric, 0.2::numeric, 0.1::numeric, 18::numeric, 11::numeric, 1.91::numeric, null::numeric),
  -- Ghee, butter — UK_fct, used in 113 recipes
  ('T506', 1::numeric, 0::numeric, 0::numeric, 0::numeric, 1::numeric, 0::numeric, 0::numeric, 0::numeric, 922::numeric, null::numeric, null::numeric, 5.76::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 246::numeric, 58.42::numeric, null::numeric),
  -- Bread, white, average — UK_fct, used in 107 recipes
  ('U511', 155::numeric, 1.5::numeric, 0.7::numeric, 22::numeric, 400::numeric, 134::numeric, 96::numeric, 7::numeric, 0::numeric, null::numeric, null::numeric, 0.08::numeric, null::numeric, 0::numeric, 0.22::numeric, 0.07::numeric, 1.6::numeric, 0.07::numeric, 29::numeric, 0::numeric, null::numeric, null::numeric),
  -- Cream, fresh, single — UK_fct, used in 89 recipes
  ('L519', 89::numeric, 0::numeric, 0.3::numeric, 8::numeric, 29::numeric, 104::numeric, 79::numeric, null::numeric, 291::numeric, null::numeric, null::numeric, 0.47::numeric, null::numeric, 1::numeric, 0.03::numeric, 0.19::numeric, 0.1::numeric, 0.03::numeric, 5::numeric, 55::numeric, 12.15::numeric, null::numeric),
  -- Baking powder — UK_fct, used in 80 recipes
  ('K500', 1130::numeric, 0::numeric, 2.8::numeric, 9::numeric, 11800::numeric, 49::numeric, 8430::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Cinnamon, ground — UK_fct, used in 80 recipes
  ('G518', 1002::numeric, 8.32::numeric, 1.8::numeric, 60::numeric, 10::numeric, 431::numeric, 64::numeric, 3::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, 31.2::numeric, 4::numeric, 0.02::numeric, 0.04::numeric, 1.3::numeric, 0.16::numeric, 6::numeric, 0::numeric, 0.35::numeric, null::numeric),
  -- Lemons, flesh only, raw, weighed with peel and pips — UK_fct, used in 76 recipes
  ('E520', 17::numeric, 0.3::numeric, 0.1::numeric, 6::numeric, 2::numeric, 90::numeric, 10::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 34::numeric, 0.03::numeric, 0.01::numeric, 0.1::numeric, 0.05::numeric, 7::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Vanilla extract — US_fct, used in 76 recipes
  ('G544', 11::numeric, 0.12::numeric, 0.11::numeric, 12::numeric, 9::numeric, 148::numeric, 6::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0.011::numeric, 0.095::numeric, 0.425::numeric, 0.026::numeric, 0::numeric, 0::numeric, 0.01::numeric, null::numeric),
  -- Flour, corn — UK_fct, used in 75 recipes
  ('A503', 2::numeric, 0.1::numeric, 0.5::numeric, 2::numeric, 11::numeric, 3::numeric, 17::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0.02::numeric, 0::numeric, 0::numeric, 0::numeric, 2::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Cheese, processed, plain — UK_fct, used in 67 recipes
  ('L505', 610::numeric, 0.5::numeric, 2.6::numeric, 27::numeric, 1000::numeric, 178::numeric, 768::numeric, 5::numeric, 270::numeric, null::numeric, null::numeric, 0.55::numeric, 1.6::numeric, 0::numeric, 0.06::numeric, 0.25::numeric, 0.1::numeric, 0.07::numeric, 15::numeric, 85::numeric, 14.32::numeric, null::numeric),
  -- Bay leaf, dried — UK_fct, used in 64 recipes
  ('G512', 830::numeric, 43::numeric, 3.7::numeric, 120::numeric, 23::numeric, 530::numeric, 110::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.01::numeric, 0.42::numeric, 2::numeric, null::numeric, 0::numeric, 0::numeric, 2.3::numeric, null::numeric),
  -- Flour, gram — UK_fct, used in 55 recipes
  ('A504', 58::numeric, 2.63::numeric, 1.5::numeric, 62::numeric, 2::numeric, 297::numeric, 220::numeric, 4::numeric, 0::numeric, null::numeric, null::numeric, 2.54::numeric, 8.92::numeric, 0::numeric, 0.45::numeric, 0.17::numeric, 1.9::numeric, 0.45::numeric, 193::numeric, 0::numeric, 0.61::numeric, null::numeric),
  -- Vinegar — UK_fct, used in 44 recipes
  ('G532', 3::numeric, 0.1::numeric, 0.1::numeric, 4::numeric, 5::numeric, 34::numeric, 10::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- SIVA'S, AMHUR POWDER (DRY MANGO POWDER) — US_fct, used in 43 recipes
  ('G535', 200::numeric, 0::numeric, null::numeric, null::numeric, 3000::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 12::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Mustard powder — UK_fct, used in 40 recipes
  ('G533', 330::numeric, 9.5::numeric, 6.5::numeric, 260::numeric, 5::numeric, 940::numeric, 180::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 1.5::numeric, null::numeric),
  -- Gelatine — UK_fct, used in 35 recipes
  ('K504', 250::numeric, 2.1::numeric, 0.2::numeric, 15::numeric, 330::numeric, 7::numeric, 32::numeric, 19::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Ginger, ground — UK_fct, used in 34 recipes
  ('G554', 97::numeric, 46.8::numeric, 4.7::numeric, 130::numeric, 34::numeric, 910::numeric, 140::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.05::numeric, 0.19::numeric, 5.1::numeric, 1.01::numeric, 0::numeric, 0::numeric, 1.57::numeric, null::numeric),
  -- Cocoa powder — UK_fct, used in 31 recipes
  ('V501', 130::numeric, 10.5::numeric, 6.9::numeric, 520::numeric, null::numeric, 1500::numeric, 660::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.68::numeric, 1.5::numeric, 0::numeric, 0.16::numeric, 0.06::numeric, 1.7::numeric, 0.07::numeric, 38::numeric, 0::numeric, 12.8::numeric, null::numeric),
  -- AJWAIN SEED WHOLE ORGANIC SPICES — US_fct, used in 31 recipes
  ('G536', 667::numeric, 16.19::numeric, null::numeric, null::numeric, 0::numeric, 1333::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.62::numeric, null::numeric),
  -- Cherries, glace — UK_fct, used in 26 recipes
  ('E511', 56::numeric, 0.9::numeric, 0.1::numeric, 5::numeric, 27::numeric, 24::numeric, 9::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Cream, fresh, whipping — UK_fct, used in 26 recipes
  ('L512', 58::numeric, 0::numeric, 0.2::numeric, 6::numeric, 25::numeric, 86::numeric, 59::numeric, null::numeric, 399::numeric, null::numeric, null::numeric, 1.32::numeric, null::numeric, 1::numeric, 0.02::numeric, 0.17::numeric, 0::numeric, 0.04::numeric, 7::numeric, 105::numeric, 25.23::numeric, null::numeric),
  -- Oil, olive — UK_fct, used in 26 recipes
  ('T502', 0::numeric, 0.4::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 5.1::numeric, 57.5::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 14.3::numeric, null::numeric),
  -- Mayonnaise, standard, retail — UK_fct, used in 25 recipes
  ('L507', 2::numeric, 0.16::numeric, 0.1::numeric, 0::numeric, 131::numeric, 4::numeric, 5::numeric, 0::numeric, 78::numeric, null::numeric, null::numeric, 22.1::numeric, null::numeric, 0::numeric, 0::numeric, 0.1::numeric, 0::numeric, 0.09::numeric, 9::numeric, 57.2::numeric, 5.65::numeric, null::numeric),
  -- Spring onions, bulbs and tops, raw — UK_fct, used in 25 recipes
  ('G547', 39::numeric, 1.9::numeric, 0.4::numeric, 12::numeric, 7::numeric, 260::numeric, 29::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 26::numeric, 0.05::numeric, 0.03::numeric, 0.5::numeric, 0.13::numeric, 54::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Stock cubes, vegetable — UK_fct, used in 25 recipes
  ('K507', 47::numeric, 2.8::numeric, 0.4::numeric, 44::numeric, 16800::numeric, 390::numeric, 120::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Lamb, mince, raw — UK_fct, used in 24 recipes
  ('O502', 17::numeric, 1.6::numeric, 3.5::numeric, 21::numeric, 69::numeric, 310::numeric, 190::numeric, 2::numeric, 5::numeric, null::numeric, null::numeric, 0.18::numeric, null::numeric, 0::numeric, 0.12::numeric, 0.18::numeric, 4.8::numeric, 0.2::numeric, 2::numeric, 77::numeric, 6.2::numeric, null::numeric),
  -- Tomato sauce, homemade — UK_fct, used in 23 recipes
  ('X505', 19::numeric, 0.6::numeric, 0.3::numeric, 10::numeric, 340::numeric, 280::numeric, 39::numeric, 1::numeric, 26::numeric, null::numeric, null::numeric, 1.47::numeric, null::numeric, 8::numeric, 0.11::numeric, 0.02::numeric, 1.2::numeric, 0.14::numeric, 9::numeric, 10::numeric, 1.8::numeric, null::numeric),
  -- Bicarbonate of soda — UK_fct, used in 22 recipes
  ('K501', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 27380::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Fennel seeds — UK_fct, used in 22 recipes
  ('G510', 1200::numeric, 12.3::numeric, 3.7::numeric, 390::numeric, 88::numeric, 1660::numeric, 510::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.41::numeric, 0.35::numeric, 10.3::numeric, null::numeric, 0::numeric, 0::numeric, 0.5::numeric, null::numeric),
  -- Pasta, white, dried, raw — UK_fct, used in 22 recipes
  ('A507', 24::numeric, 1.59::numeric, 1.2::numeric, 47::numeric, 2::numeric, 232::numeric, 179::numeric, 22::numeric, 0::numeric, null::numeric, null::numeric, 0.3::numeric, 0.21::numeric, 0::numeric, 0.17::numeric, 0.03::numeric, 3.3::numeric, 0.14::numeric, 19::numeric, 0::numeric, 0.23::numeric, null::numeric),
  -- Saffron — UK_fct, used in 19 recipes
  ('G529', 110::numeric, 11.1::numeric, null::numeric, null::numeric, 150::numeric, 1720::numeric, 250::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric),
  -- Chilli sauce — UK_fct, used in 18 recipes
  ('G517', 17::numeric, 2.8::numeric, 0.1::numeric, 15::numeric, 1250::numeric, 140::numeric, 28::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 1.97::numeric, null::numeric, 8::numeric, 0.01::numeric, 0.09::numeric, 0.6::numeric, 0.1::numeric, 10::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Soy sauce, light and dark varieties — UK_fct, used in 17 recipes
  ('X501', 17::numeric, 2.4::numeric, 0.2::numeric, 37::numeric, 5500::numeric, 180::numeric, 47::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.05::numeric, 0.13::numeric, 3.4::numeric, null::numeric, 11::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Oil, mustard — US_fct, used in 16 recipes
  ('T510', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, 11.6::numeric, null::numeric),
  -- Chocolate, plain — UK_fct, used in 15 recipes
  ('I509', 33::numeric, 2.3::numeric, 1.3::numeric, 89::numeric, 6::numeric, 300::numeric, 140::numeric, 4::numeric, 15::numeric, null::numeric, null::numeric, 1.44::numeric, 2.3::numeric, 0::numeric, 0.04::numeric, 0.06::numeric, 0.4::numeric, 0.03::numeric, 12::numeric, 6::numeric, 16.8::numeric, null::numeric),
  -- Honey — UK_fct, used in 15 recipes
  ('I507', 5::numeric, 0.4::numeric, 0.9::numeric, 2::numeric, 11::numeric, 51::numeric, 17::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0.05::numeric, 0.2::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Stock cubes, chicken — UK_fct, used in 15 recipes
  ('K506', 120::numeric, 4.9::numeric, 1.2::numeric, 47::numeric, 16300::numeric, 400::numeric, 200::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Orange juice, freshly squeezed — UK_fct, used in 14 recipes
  ('E518', 12::numeric, 0.3::numeric, 0::numeric, 12::numeric, 2::numeric, 180::numeric, 22::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.35::numeric, null::numeric, 48::numeric, 0.08::numeric, 0.02::numeric, 0.2::numeric, 0.05::numeric, 28::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Beansprouts, mung, boiled in unsalted water — UK_fct, used in 12 recipes
  ('B501', 19::numeric, 2.2::numeric, 0.3::numeric, 14::numeric, 4::numeric, 46::numeric, 37::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 2::numeric, 0.09::numeric, 0.05::numeric, 0.3::numeric, 0.07::numeric, 17::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Pineapple juice, unsweetened — UK_fct, used in 11 recipes
  ('V509', 8::numeric, 0.2::numeric, 0.1::numeric, 6::numeric, 8::numeric, 53::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.03::numeric, null::numeric, 11::numeric, 0.06::numeric, 0.01::numeric, 0.1::numeric, 0.05::numeric, 8::numeric, 0::numeric, 0::numeric, null::numeric),
  -- JAM — US_fct, used in 11 recipes
  ('W504', 0::numeric, 0::numeric, 0::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- MIXED NUTS CASHEWS, ALMONDS, HAZELNUTS, PISTACHIOS,  — US_fct, used in 11 recipes
  ('H505', 143::numeric, 5.36::numeric, null::numeric, null::numeric, 286::numeric, 714::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 7.14::numeric, null::numeric),
  -- Pepper, white — UK_fct, used in 10 recipes
  ('G527', 270::numeric, 14.3::numeric, 1.1::numeric, 90::numeric, 5::numeric, 73::numeric, 180::numeric, 3::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 21::numeric, 0.02::numeric, 0.13::numeric, 0.2::numeric, 0.1::numeric, 10::numeric, 0::numeric, 0.63::numeric, null::numeric),
  -- Coffee, powder, instant — UK_fct, used in 9 recipes
  ('V502', 140::numeric, 4.6::numeric, 1.1::numeric, 330::numeric, 81::numeric, 3780::numeric, 310::numeric, 9::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 4.3::numeric, 0::numeric, 0.04::numeric, 0.21::numeric, 24.8::numeric, 0.02::numeric, 11::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Oregano, dried, ground — UK_fct, used in 9 recipes
  ('G526', 1597::numeric, 36.8::numeric, 2.7::numeric, 270::numeric, 25::numeric, 1260::numeric, 148::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 2::numeric, 0.18::numeric, 0.53::numeric, 4.6::numeric, 1.04::numeric, 237::numeric, 0::numeric, 1.55::numeric, null::numeric),
  -- HIMALAYAN BLACK SALT — US_fct, used in 9 recipes
  ('G540', 0::numeric, 0::numeric, 0::numeric, null::numeric, 38182::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Milk, condensed, whole, sweetened — UK_fct, used in 8 recipes
  ('L508', 290::numeric, 0.23::numeric, 1::numeric, 29::numeric, 90::numeric, 360::numeric, 240::numeric, 3::numeric, 110::numeric, null::numeric, null::numeric, 0.19::numeric, 0.36::numeric, 4::numeric, 0.09::numeric, 0.46::numeric, 0.3::numeric, 0.07::numeric, 15::numeric, 29::numeric, 4.99::numeric, null::numeric),
  -- Flour, rice — UK_fct, used in 7 recipes
  ('A505', 24::numeric, 1.9::numeric, null::numeric, 23::numeric, 5::numeric, 240::numeric, 130::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.1::numeric, 0.05::numeric, 2.1::numeric, 0.2::numeric, null::numeric, null::numeric, null::numeric, null::numeric),
  -- Tofu, soya bean, steamed — UK_fct, used in 7 recipes
  ('B506', null::numeric, 1.2::numeric, 0.7::numeric, 23::numeric, 4::numeric, 63::numeric, 95::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.95::numeric, null::numeric, 0::numeric, 0.06::numeric, 0.02::numeric, 0.1::numeric, 0.07::numeric, 15::numeric, 0::numeric, 0.5::numeric, null::numeric),
  -- Tomato ketchup — UK_fct, used in 7 recipes
  ('X503', 13::numeric, 0.3::numeric, 0.1::numeric, 19::numeric, 800::numeric, 350::numeric, 31::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 2::numeric, 1::numeric, 0.09::numeric, 2.1::numeric, 0.03::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric),
  -- CRACKED WHEAT — US_fct, used in 7 recipes
  ('A510', 50::numeric, 4.5::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Whey, acid, fluid — US_fct, used in 7 recipes
  ('L517', 103::numeric, 0.08::numeric, 0.43::numeric, 10::numeric, 48::numeric, 143::numeric, 78::numeric, 1.8::numeric, 2::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0.1::numeric, 0.042::numeric, 0.14::numeric, 0.079::numeric, 0.042::numeric, 2::numeric, 1::numeric, 0.057::numeric, null::numeric),
  -- Coconut milk — UK_fct, used in 6 recipes
  ('H501', 29::numeric, 0.1::numeric, 0.1::numeric, 30::numeric, 110::numeric, 280::numeric, 30::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 2::numeric, 0.03::numeric, 0.06::numeric, 0.1::numeric, 0.03::numeric, null::numeric, 0::numeric, 0.2::numeric, null::numeric),
  -- Ice cream, dairy, vanilla, soft scoop — UK_fct, used in 6 recipes
  ('I501', 104::numeric, 0.06::numeric, 0.3::numeric, 13::numeric, 63::numeric, 163::numeric, 85::numeric, 1::numeric, 91::numeric, null::numeric, null::numeric, 0.49::numeric, null::numeric, 1::numeric, 0.1::numeric, 0.28::numeric, 0.2::numeric, 0.04::numeric, 6::numeric, 29.4::numeric, 5.19::numeric, null::numeric),
  -- Shallots, raw — UK_fct, used in 6 recipes
  ('G546', 24::numeric, 0.8::numeric, 0.4::numeric, 4::numeric, 10::numeric, 180::numeric, 50::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0.31::numeric, null::numeric, 13::numeric, 0.04::numeric, 0.06::numeric, 0.6::numeric, 0.2::numeric, 17::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Sugar, brown — UK_fct, used in 6 recipes
  ('I503', 56::numeric, 1.7::numeric, 0.1::numeric, 17::numeric, 31::numeric, 140::numeric, 4::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Lemon peel, raw — US_fct, used in 6 recipes
  ('G550', 134::numeric, 0.8::numeric, 0.25::numeric, 15::numeric, 6::numeric, 160::numeric, 12::numeric, 0.7::numeric, 0::numeric, null::numeric, null::numeric, 0.25::numeric, 0::numeric, 129::numeric, 0.06::numeric, 0.08::numeric, 0.4::numeric, 0.172::numeric, 13::numeric, 0::numeric, 0.039::numeric, null::numeric),
  -- Broccoli, green, raw — UK_fct, used in 5 recipes
  ('C500', 48::numeric, 1.06::numeric, 0.7::numeric, 22::numeric, 9::numeric, 397::numeric, 81::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 1.72::numeric, 185::numeric, 79::numeric, 0.15::numeric, 0.12::numeric, 0.8::numeric, 0.13::numeric, 95::numeric, 0::numeric, 0.15::numeric, null::numeric),
  -- Chicken, whole, corn-fed, raw, meat and skin, weighe — UK_fct, used in 5 recipes
  ('N500', 5::numeric, 0.3::numeric, 0.7::numeric, 14::numeric, 50::numeric, 180::numeric, 120::numeric, 8::numeric, 36::numeric, null::numeric, null::numeric, 0.08::numeric, null::numeric, 0::numeric, 0.04::numeric, 0.08::numeric, 4.9::numeric, 0.3::numeric, 4::numeric, 64::numeric, 3::numeric, null::numeric),
  -- Mixed curry spices — UK_fct, used in 5 recipes
  ('G515', 490::numeric, 32.33::numeric, 4.1::numeric, 234::numeric, 1154::numeric, 1878::numeric, 319::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 1::numeric, 0.3::numeric, 0.69::numeric, 6.9::numeric, null::numeric, 33::numeric, 0::numeric, null::numeric, null::numeric),
  -- Pears, canned in juice, whole contents — UK_fct, used in 5 recipes
  ('E509', 6::numeric, 0.2::numeric, 0.1::numeric, 5::numeric, 3::numeric, 81::numeric, 10::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 3::numeric, 0.01::numeric, 0.01::numeric, 0.2::numeric, 0.03::numeric, 4::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Sesame seeds — UK_fct, used in 5 recipes
  ('G513', 670::numeric, 10.4::numeric, 5.3::numeric, 370::numeric, 20::numeric, 570::numeric, 720::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 2.53::numeric, null::numeric, 0::numeric, 0.93::numeric, 0.17::numeric, 5::numeric, 0.75::numeric, 97::numeric, 0::numeric, 10.48::numeric, null::numeric),
  -- Sweetcorn, kernels, raw — UK_fct, used in 5 recipes
  ('D503', 3::numeric, 0.7::numeric, 0.4::numeric, 37::numeric, 1::numeric, 260::numeric, 91::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.33::numeric, null::numeric, 8::numeric, 0.16::numeric, 0.05::numeric, 1.9::numeric, 0.02::numeric, 41::numeric, 0::numeric, 0.2::numeric, null::numeric),
  -- Syrup, corn, dark — UK_fct, used in 5 recipes
  ('I505', 18::numeric, 0.4::numeric, 0::numeric, 8::numeric, 160::numeric, 44::numeric, 11::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0.01::numeric, 0.01::numeric, 0::numeric, 0.01::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Tea, black, infusion, average — UK_fct, used in 5 recipes
  ('V510', 0::numeric, 0::numeric, 0::numeric, 2::numeric, 0::numeric, 27::numeric, 2::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, 0.27::numeric, 0::numeric, 0::numeric, 0.02::numeric, 0::numeric, 0::numeric, 3::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Turnip, flesh only, raw — UK_fct, used in 5 recipes
  ('F501', 48::numeric, 0.2::numeric, 0.1::numeric, 8::numeric, 15::numeric, 280::numeric, 41::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0.15::numeric, 17::numeric, 0.05::numeric, 0.01::numeric, 0.4::numeric, 0.08::numeric, 14::numeric, 0::numeric, 0::numeric, null::numeric),
  -- MSG MONOSODIUM GLUTAMATE — US_fct, used in 5 recipes
  ('G541', null::numeric, null::numeric, null::numeric, null::numeric, 12500::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric),
  -- Orange peel, raw — US_fct, used in 5 recipes
  ('G552', 161::numeric, 0.8::numeric, 0.25::numeric, 22::numeric, 3::numeric, 212::numeric, 21::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0.25::numeric, null::numeric, 136::numeric, 0.12::numeric, 0.09::numeric, 0.9::numeric, 0.176::numeric, 30::numeric, 0::numeric, 0.024::numeric, null::numeric),
  -- Bacon rashers, back, raw — UK_fct, used in 4 recipes
  ('O500', 5::numeric, 0.4::numeric, 1.2::numeric, 17::numeric, 1140::numeric, 300::numeric, 150::numeric, 8::numeric, 0::numeric, null::numeric, null::numeric, 0.02::numeric, null::numeric, 1::numeric, 0.63::numeric, 0.11::numeric, 5.6::numeric, 0.46::numeric, 3::numeric, 53::numeric, 6.2::numeric, null::numeric),
  -- Basil, dried, ground — UK_fct, used in 4 recipes
  ('G511', 2110::numeric, 42::numeric, 5.8::numeric, 420::numeric, 34::numeric, 3430::numeric, 490::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.15::numeric, 0.32::numeric, 6.9::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric),
  -- Bread, brown, average — UK_fct, used in 4 recipes
  ('U501', 186::numeric, 2.2::numeric, 1.3::numeric, 45::numeric, 400::numeric, 216::numeric, 157::numeric, 4::numeric, 0::numeric, null::numeric, null::numeric, 0.01::numeric, null::numeric, 0::numeric, 0.22::numeric, 0.07::numeric, 2.8::numeric, 0.17::numeric, 45::numeric, 0::numeric, 0.43::numeric, null::numeric),
  -- Breakfast cereal, crunchy clusters type, without nut — UK_fct, used in 4 recipes
  ('A501', 40::numeric, 2.68::numeric, 1.6::numeric, 72::numeric, 41::numeric, 310::numeric, 232::numeric, 6::numeric, 0::numeric, null::numeric, null::numeric, 1.38::numeric, null::numeric, 0::numeric, 1.02::numeric, 1.06::numeric, 4::numeric, 0.17::numeric, 90::numeric, null::numeric, 4.15::numeric, null::numeric),
  -- Cheese, cottage, plain — UK_fct, used in 4 recipes
  ('L502', 127::numeric, 0::numeric, 0.6::numeric, 13::numeric, 250::numeric, 161::numeric, 171::numeric, 4::numeric, 64::numeric, null::numeric, null::numeric, 0.14::numeric, null::numeric, 0::numeric, 0.05::numeric, 0.24::numeric, 0.2::numeric, 0.05::numeric, 22::numeric, 22::numeric, 3.24::numeric, null::numeric),
  -- Cheese, Mozzarella, fresh — UK_fct, used in 4 recipes
  ('L503', 362::numeric, 0::numeric, 2.7::numeric, 15::numeric, 395::numeric, 51::numeric, 267::numeric, 6::numeric, 258::numeric, null::numeric, null::numeric, 0.31::numeric, null::numeric, 0::numeric, 0.03::numeric, 0.4::numeric, 0.1::numeric, 0.1::numeric, 20::numeric, 58::numeric, 13.75::numeric, null::numeric),
  -- Cream of tartar — UK_fct, used in 4 recipes
  ('U505', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 20780::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Custard powder — UK_fct, used in 4 recipes
  ('K503', 2::numeric, 0.1::numeric, 0.5::numeric, 2::numeric, 378::numeric, 3::numeric, 17::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0.02::numeric, 0::numeric, 0::numeric, 0::numeric, 2::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Ham — UK_fct, used in 4 recipes
  ('O501', 7::numeric, 0.7::numeric, 1.8::numeric, 24::numeric, 800::numeric, 340::numeric, 340::numeric, 11::numeric, 0::numeric, null::numeric, null::numeric, 0.04::numeric, null::numeric, 0::numeric, 0.8::numeric, 0.17::numeric, 6.5::numeric, 0.61::numeric, 19::numeric, 58::numeric, 1.1::numeric, null::numeric),
  -- Mint sauce, homemade — UK_fct, used in 4 recipes
  ('X512', 39::numeric, 1.73::numeric, null::numeric, 0::numeric, 5::numeric, 59::numeric, 17::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.87::numeric, null::numeric, 5::numeric, 0.02::numeric, 0.06::numeric, 0.2::numeric, null::numeric, 19::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Oil, coconut — UK_fct, used in 4 recipes
  ('T507', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.66::numeric, 1::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 86.5::numeric, null::numeric),
  -- Porridge oats, unfortified — UK_fct, used in 4 recipes
  ('A508', 50::numeric, 3.64::numeric, 2.3::numeric, 114::numeric, 1::numeric, 372::numeric, 387::numeric, 3::numeric, 0::numeric, null::numeric, null::numeric, 0.59::numeric, null::numeric, 0::numeric, 1.05::numeric, 0.05::numeric, 0.8::numeric, 0.34::numeric, 32::numeric, 0.3::numeric, 1.28::numeric, null::numeric),
  -- Sago, raw — UK_fct, used in 4 recipes
  ('I508', 10::numeric, 1.2::numeric, null::numeric, 3::numeric, 3::numeric, 5::numeric, 29::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Tomato puree — UK_fct, used in 4 recipes
  ('X504', 45::numeric, 1.45::numeric, 0.6::numeric, 57::numeric, 49::numeric, 1257::numeric, 94::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 5.22::numeric, null::numeric, 43::numeric, 0.98::numeric, 0.12::numeric, 3.6::numeric, 0.28::numeric, 39::numeric, 0::numeric, 0.04::numeric, null::numeric),
  -- Worcestershire sauce — UK_fct, used in 4 recipes
  ('X507', 190::numeric, 10.1::numeric, 0.4::numeric, 73::numeric, 1500::numeric, 600::numeric, 31::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0.01::numeric, 0.4::numeric, null::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Chickpeas (garbanzo beans, bengal gram), mature seed — US_fct, used in 4 recipes
  ('B509', 57::numeric, 4.31::numeric, 2.76::numeric, 79::numeric, 24::numeric, 718::numeric, 252::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.82::numeric, 9::numeric, 4::numeric, 0.477::numeric, 0.212::numeric, 1.54::numeric, 0.535::numeric, 557::numeric, 0::numeric, 0.603::numeric, null::numeric),
  -- SWEET SUNNAH, WHOLE BLACK SEEDS NIGELLA SATIVA — US_fct, used in 4 recipes
  ('A512', 0::numeric, 12::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Vinegar, distilled — US_fct, used in 4 recipes
  ('G538', 6::numeric, 0.03::numeric, 0.01::numeric, 1::numeric, 2::numeric, 2::numeric, 4::numeric, 0.5::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Beans, chick peas, Kabuli, whole, dried, raw — UK_fct, used in 3 recipes
  ('B500', 160::numeric, 5.5::numeric, 3::numeric, 130::numeric, 39::numeric, 1000::numeric, 310::numeric, 2::numeric, 0::numeric, null::numeric, null::numeric, 2.88::numeric, 8.92::numeric, 0::numeric, 0.39::numeric, 0.24::numeric, 1.9::numeric, 0.53::numeric, 180::numeric, 0::numeric, 0.5::numeric, null::numeric),
  -- Cheese, Cheddar, English — UK_fct, used in 3 recipes
  ('L500', 739::numeric, 0.3::numeric, 4.1::numeric, 29::numeric, 723::numeric, 75::numeric, 505::numeric, 6::numeric, 364::numeric, null::numeric, null::numeric, 0.52::numeric, 4.7::numeric, 0::numeric, 0.03::numeric, 0.39::numeric, 0.1::numeric, 0.15::numeric, 31::numeric, 97::numeric, 21.68::numeric, null::numeric),
  -- Cola — UK_fct, used in 3 recipes
  ('V503', 6::numeric, 0::numeric, 0::numeric, 1::numeric, 5::numeric, 1::numeric, 30::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Curry powder — UK_fct, used in 3 recipes
  ('G520', 640::numeric, 58.3::numeric, 4.1::numeric, 280::numeric, 450::numeric, 1830::numeric, 270::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 1::numeric, 0.25::numeric, 0.28::numeric, 3.5::numeric, 0.1::numeric, 56::numeric, 0::numeric, null::numeric, null::numeric),
  -- Fruit cocktail, canned in juice, whole contents — UK_fct, used in 3 recipes
  ('E516', 9::numeric, 0.4::numeric, 0.1::numeric, 7::numeric, 3::numeric, 95::numeric, 14::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 14::numeric, 0.01::numeric, 0.01::numeric, 0.3::numeric, 0.04::numeric, 6::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Garlic powder — UK_fct, used in 3 recipes
  ('G524', 65::numeric, 3.9::numeric, 2.6::numeric, 61::numeric, 19::numeric, 1360::numeric, 220::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, 0.03::numeric, null::numeric, 0::numeric, null::numeric, 0.12::numeric, 0.7::numeric, 0.99::numeric, 0::numeric, 0::numeric, 0.2::numeric, null::numeric),
  -- Jelly, made with water — UK_fct, used in 3 recipes
  ('W501', 7::numeric, 0.4::numeric, null::numeric, 0::numeric, 5::numeric, 5::numeric, 1::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Spirits, 40% volume — UK_fct, used in 3 recipes
  ('K502', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Sultanas — UK_fct, used in 3 recipes
  ('E506', 64::numeric, 2.2::numeric, 0.3::numeric, 31::numeric, 19::numeric, 1060::numeric, 86::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.7::numeric, null::numeric, 0::numeric, 0.09::numeric, 0.05::numeric, 0.8::numeric, 0.25::numeric, 27::numeric, 0::numeric, null::numeric, null::numeric),
  -- Thyme, dried, ground — UK_fct, used in 3 recipes
  ('G531', 1890::numeric, 123.6::numeric, 6.2::numeric, 220::numeric, 55::numeric, 810::numeric, 200::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 50::numeric, 0.51::numeric, 0.4::numeric, 4.9::numeric, 0.55::numeric, 274::numeric, 0::numeric, 2.7::numeric, null::numeric),
  -- Candies, gum drops, no sugar or low calorie (sorbito — US_fct, used in 3 recipes
  ('I510', 0::numeric, 0::numeric, 0::numeric, 0::numeric, 7::numeric, null::numeric, 0::numeric, 0.5::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.034::numeric, null::numeric),
  -- Cheese spread, cream cheese, regular — US_fct, used in 3 recipes
  ('L501', 71::numeric, 1.13::numeric, 0.51::numeric, 6::numeric, 436::numeric, 112::numeric, 91::numeric, 2.7::numeric, 300::numeric, null::numeric, null::numeric, 0.77::numeric, null::numeric, 0::numeric, 0.02::numeric, 0.19::numeric, 0.95::numeric, 0.04::numeric, 12::numeric, 90::numeric, 18.02::numeric, null::numeric),
  -- Cream, fluid, light (coffee cream or table cream) — US_fct, used in 3 recipes
  ('L515', 91::numeric, 0.05::numeric, 0.32::numeric, 9::numeric, 72::numeric, 136::numeric, 92::numeric, 4.6::numeric, 117::numeric, null::numeric, 1.1::numeric, 0.12::numeric, 1.7::numeric, 0.8::numeric, 0.023::numeric, 0.19::numeric, 0.09::numeric, 0.044::numeric, 2::numeric, 59::numeric, 10.2::numeric, null::numeric),
  -- ROASTED CHICKPEAS — US_fct, used in 3 recipes
  ('B511', 36::numeric, 4.64::numeric, 0::numeric, null::numeric, 679::numeric, 821::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Seeds, lotus seeds, dried — US_fct, used in 3 recipes
  ('H503', 163::numeric, 3.53::numeric, 1.05::numeric, 210::numeric, 5::numeric, 1370::numeric, 626::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.64::numeric, 0.15::numeric, 1.6::numeric, 0.629::numeric, 104::numeric, 0::numeric, 0.33::numeric, null::numeric),
  -- Sour cream, regular — US_fct, used in 3 recipes
  ('L514', 101::numeric, 0.07::numeric, 0.33::numeric, 10::numeric, 31::numeric, 125::numeric, 76::numeric, 3.7::numeric, 121::numeric, null::numeric, null::numeric, 0.38::numeric, 1.5::numeric, 0.9::numeric, 0.02::numeric, 0.168::numeric, 0.093::numeric, 0.041::numeric, 6::numeric, 59::numeric, 10.14::numeric, null::numeric),
  -- STRAWBERRY JAM — US_fct, used in 3 recipes
  ('W505', 5::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 40::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- TUTTI FRUTTI GUMBALLS, TUTTI FRUTTI — US_fct, used in 3 recipes
  ('I511', 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Bananas, raw, flesh only, weighed with skin — UK_fct, used in 2 recipes
  ('E503', 4::numeric, 0.17::numeric, 0.1::numeric, 17::numeric, 0::numeric, 208::numeric, 14::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.1::numeric, 0.04::numeric, 5::numeric, 0.09::numeric, 0.03::numeric, 0.5::numeric, 0.2::numeric, 9::numeric, 0::numeric, 0.03::numeric, null::numeric),
  -- Biscuits, digestive, plain — UK_fct, used in 2 recipes
  ('U500', 95::numeric, 1.8::numeric, 0.9::numeric, 31::numeric, 561::numeric, 215::numeric, 119::numeric, 4::numeric, 0::numeric, null::numeric, null::numeric, 5.32::numeric, 1.51::numeric, 0::numeric, 0.12::numeric, 0.02::numeric, 1.9::numeric, 0.07::numeric, 11::numeric, 2.4::numeric, 7.71::numeric, null::numeric),
  -- Curly kale, raw — UK_fct, used in 2 recipes
  ('D500', 130::numeric, 1.7::numeric, 0.4::numeric, 34::numeric, 43::numeric, 450::numeric, 61::numeric, 2::numeric, 0::numeric, null::numeric, null::numeric, 1.7::numeric, 623::numeric, 110::numeric, 0.08::numeric, 0.09::numeric, 1::numeric, 0.26::numeric, 120::numeric, 0::numeric, 0.2::numeric, null::numeric),
  -- Dressing, French — UK_fct, used in 2 recipes
  ('X510', null::numeric, null::numeric, null::numeric, null::numeric, 600::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric),
  -- Drinking chocolate, powder — UK_fct, used in 2 recipes
  ('V504', 39::numeric, 3.5::numeric, 5.6::numeric, 132::numeric, 228::numeric, 495::numeric, 193::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.41::numeric, null::numeric, 0::numeric, 0.02::numeric, 0.06::numeric, 0.6::numeric, 0.01::numeric, 7::numeric, 0::numeric, 3.41::numeric, null::numeric),
  -- Energy drink, carbonated — UK_fct, used in 2 recipes
  ('V505', null::numeric, null::numeric, null::numeric, null::numeric, 60::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Flour, soya — UK_fct, used in 2 recipes
  ('B503', 182::numeric, 8.42::numeric, 4.1::numeric, 245::numeric, 1::numeric, 1867::numeric, 668::numeric, 7::numeric, 0::numeric, null::numeric, null::numeric, 4.33::numeric, 25.3::numeric, 0::numeric, 0.38::numeric, 0.26::numeric, 1.9::numeric, 0.4::numeric, 245::numeric, 0.3::numeric, 2.74::numeric, null::numeric),
  -- Paprika — UK_fct, used in 2 recipes
  ('G545', 229::numeric, 21.14::numeric, 4.3::numeric, 178::numeric, 68::numeric, 2280::numeric, 314::numeric, 6::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 1::numeric, 0.33::numeric, 1.23::numeric, 10.1::numeric, 2.14::numeric, 49::numeric, 0::numeric, 2.14::numeric, null::numeric),
  -- Salami — UK_fct, used in 2 recipes
  ('O503', 11::numeric, 1.3::numeric, 3::numeric, 18::numeric, 1530::numeric, 320::numeric, 170::numeric, 7::numeric, 0::numeric, null::numeric, null::numeric, 0.23::numeric, 1.11::numeric, null::numeric, 0.6::numeric, 0.23::numeric, 5.6::numeric, 0.36::numeric, 3::numeric, 83::numeric, 14.6::numeric, null::numeric),
  -- Sausages, premium, raw — UK_fct, used in 2 recipes
  ('O504', 160::numeric, 1::numeric, 1.2::numeric, 14::numeric, 500::numeric, 190::numeric, 160::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.9::numeric, null::numeric, 14::numeric, 0.05::numeric, 0.11::numeric, 3::numeric, 0.16::numeric, 7::numeric, 63::numeric, 8.17::numeric, null::numeric),
  -- Wafers, plain ice cream wafers, not filled — UK_fct, used in 2 recipes
  ('U509', 89::numeric, 2.3::numeric, 1.2::numeric, 28::numeric, 192::numeric, 195::numeric, 129::numeric, 7::numeric, 0::numeric, null::numeric, null::numeric, 0.42::numeric, null::numeric, 0::numeric, 0.08::numeric, 0.02::numeric, 1.6::numeric, 0.04::numeric, 14::numeric, 4.1::numeric, 0.59::numeric, null::numeric),
  -- Yeast extract — UK_fct, used in 2 recipes
  ('G534', 70::numeric, 2.9::numeric, 2.7::numeric, 160::numeric, 4300::numeric, 2100::numeric, 950::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 4.1::numeric, 11.9::numeric, 64::numeric, 1.6::numeric, 2620::numeric, 0::numeric, null::numeric, null::numeric),
  -- ALMOND MILK — US_fct, used in 2 recipes
  ('H507', 42::numeric, 0.15::numeric, null::numeric, null::numeric, 75::numeric, 79::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Cheese, cream, low fat — US_fct, used in 2 recipes
  ('L518', 148::numeric, 0.17::numeric, 0.57::numeric, 8::numeric, 317::numeric, 247::numeric, 152::numeric, 4::numeric, 160::numeric, null::numeric, 0.3::numeric, 0.27::numeric, 5.4::numeric, 0::numeric, 0.04::numeric, 0.185::numeric, 0.125::numeric, 0.045::numeric, 19::numeric, 54::numeric, 10::numeric, null::numeric),
  -- DRIED MANGO — US_fct, used in 2 recipes
  ('E514', 0::numeric, 0::numeric, null::numeric, null::numeric, 175::numeric, 275::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Gooseberries, raw — US_fct, used in 2 recipes
  ('E515', 25::numeric, 0.31::numeric, 0.12::numeric, 10::numeric, 1::numeric, 198::numeric, 27::numeric, 0.6::numeric, 0::numeric, null::numeric, null::numeric, 0.37::numeric, null::numeric, 27.7::numeric, 0.04::numeric, 0.03::numeric, 0.3::numeric, 0.08::numeric, 6::numeric, 0::numeric, 0.038::numeric, null::numeric),
  -- MARGARINE — US_fct, used in 2 recipes
  ('T504', null::numeric, null::numeric, null::numeric, null::numeric, 750::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 21.4::numeric, null::numeric),
  -- Milk, buttermilk, fluid, whole — US_fct, used in 2 recipes
  ('L521', 115::numeric, 0.03::numeric, 0.38::numeric, 10::numeric, 105::numeric, 135::numeric, 85::numeric, 3.7::numeric, 46::numeric, null::numeric, 1.3::numeric, 0.07::numeric, 0.3::numeric, 0::numeric, 0.047::numeric, 0.172::numeric, 0.09::numeric, 0.036::numeric, 5::numeric, 11::numeric, 1.9::numeric, null::numeric),
  -- Peppers, jalapeno, raw — US_fct, used in 2 recipes
  ('G549', 12::numeric, 0.25::numeric, 0.14::numeric, 15::numeric, 3::numeric, 248::numeric, 26::numeric, 0.4::numeric, 0::numeric, null::numeric, null::numeric, 3.58::numeric, 18.5::numeric, 119::numeric, 0.04::numeric, 0.07::numeric, 1.28::numeric, 0.419::numeric, 27::numeric, 0::numeric, 0.092::numeric, null::numeric),
  -- Raspberries, raw — US_fct, used in 2 recipes
  ('E513', 25::numeric, 0.69::numeric, 0.42::numeric, 22::numeric, 1::numeric, 151::numeric, 29::numeric, 0.2::numeric, 0.002::numeric, null::numeric, null::numeric, 0.87::numeric, 7.8::numeric, 26.2::numeric, 0.032::numeric, 0.038::numeric, 0.598::numeric, 0.055::numeric, 21::numeric, 0::numeric, 0.019::numeric, null::numeric),
  -- STAR ANISE — US_fct, used in 2 recipes
  ('G537', null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric),
  -- Agar, dried — UK_fct, used in 1 recipe
  ('G509', 760::numeric, 20.6::numeric, 14.4::numeric, 620::numeric, 110::numeric, 110::numeric, 50::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0.01::numeric, 0.22::numeric, 0.2::numeric, 0::numeric, 0::numeric, 0::numeric, 0.3::numeric, null::numeric),
  -- Amla — UK_fct, used in 1 recipe
  ('E507', 50::numeric, 1.2::numeric, null::numeric, null::numeric, 5::numeric, 230::numeric, 20::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0.03::numeric, 0.01::numeric, 0.2::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Apple juice, clear, ambient and chilled — UK_fct, used in 1 recipe
  ('V500', 6::numeric, 0.06::numeric, 0::numeric, 4::numeric, 3::numeric, 89::numeric, 6::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 26::numeric, 0.05::numeric, 0.02::numeric, 0.2::numeric, 0.05::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Beans, broad, whole, raw — UK_fct, used in 1 recipe
  ('D508', 23::numeric, 0.9::numeric, 0.9::numeric, 24::numeric, 1::numeric, 310::numeric, 130::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.46::numeric, null::numeric, 32::numeric, 0.04::numeric, 0.04::numeric, 3.2::numeric, 0.06::numeric, 145::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Blueberries — UK_fct, used in 1 recipe
  ('E500', 10::numeric, 0.55::numeric, 0.1::numeric, 5::numeric, 2::numeric, 66::numeric, 16::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.94::numeric, null::numeric, 6::numeric, 0.04::numeric, 0.04::numeric, 0.3::numeric, 0.01::numeric, 8::numeric, 0::numeric, 0.02::numeric, null::numeric),
  -- Bread, brown, toasted — UK_fct, used in 1 recipe
  ('U502', 238::numeric, 2.82::numeric, 1.7::numeric, 58::numeric, 513::numeric, 277::numeric, 201::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, 0.01::numeric, null::numeric, 0::numeric, 0.24::numeric, 0.08::numeric, 3.4::numeric, 0.16::numeric, 29::numeric, 0::numeric, 0.55::numeric, null::numeric),
  -- Buckwheat, groats — UK_fct, used in 1 recipe
  ('A514', 12::numeric, 2::numeric, 2.6::numeric, 48::numeric, 1::numeric, 220::numeric, 150::numeric, 9::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::numeric, 0.28::numeric, 0.07::numeric, 2.8::numeric, 0.4::numeric, null::numeric, null::numeric, null::numeric, null::numeric),
  -- Butter, salted — UK_fct, used in 1 recipe
  ('T500', 18::numeric, 0::numeric, 0.1::numeric, 2::numeric, 730::numeric, 27::numeric, 23::numeric, 0::numeric, 958::numeric, null::numeric, null::numeric, 1.85::numeric, 7.4::numeric, 0::numeric, 0::numeric, 0.07::numeric, 0::numeric, 0::numeric, 0::numeric, 213.2::numeric, 52.09::numeric, null::numeric),
  -- Cheese, Feta — UK_fct, used in 1 recipe
  ('L506', 360::numeric, 0.2::numeric, 0.9::numeric, 20::numeric, 1000::numeric, 95::numeric, 280::numeric, 5::numeric, 220::numeric, null::numeric, null::numeric, 0.37::numeric, null::numeric, 0::numeric, 0.04::numeric, 0.21::numeric, 0.2::numeric, 0.07::numeric, 23::numeric, 70::numeric, 13.7::numeric, null::numeric),
  -- Cheese, Ricotta — UK_fct, used in 1 recipe
  ('L511', 240::numeric, 0.4::numeric, 1.3::numeric, 13::numeric, 100::numeric, 110::numeric, 170::numeric, null::numeric, 185::numeric, null::numeric, null::numeric, 0.03::numeric, null::numeric, 0::numeric, 0.02::numeric, 0.19::numeric, 0.1::numeric, 0.03::numeric, null::numeric, 50::numeric, 6.9::numeric, null::numeric),
  -- Cherries, West Indian, flesh only — UK_fct, used in 1 recipe
  ('E504', 11::numeric, 0.2::numeric, null::numeric, 18::numeric, 5::numeric, 110::numeric, 15::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 1720::numeric, 0.02::numeric, 0.07::numeric, 0.4::numeric, 0.01::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Couscous, plain, raw — UK_fct, used in 1 recipe
  ('A502', 28::numeric, 2::numeric, 1.8::numeric, 59::numeric, 4::numeric, 287::numeric, 238::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, 0.13::numeric, null::numeric, 0::numeric, 0.28::numeric, 0.06::numeric, 2.6::numeric, 0.15::numeric, 28::numeric, 0::numeric, 0.3::numeric, null::numeric),
  -- Cranberries — UK_fct, used in 1 recipe
  ('E501', 12::numeric, 0.7::numeric, 0.2::numeric, 7::numeric, 2::numeric, 95::numeric, 11::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 13::numeric, 0.03::numeric, 0.02::numeric, 0.1::numeric, 0.07::numeric, 2::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Dips, sour-cream based, assorted flavours — UK_fct, used in 1 recipe
  ('X508', 72::numeric, 0.4::numeric, 0.9::numeric, 10::numeric, 330::numeric, 130::numeric, 79::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 60::numeric, null::numeric, null::numeric),
  -- Dressing, thousand island — UK_fct, used in 1 recipe
  ('X509', 24::numeric, 0.3::numeric, 0.2::numeric, 9::numeric, 470::numeric, 130::numeric, 34::numeric, 1::numeric, null::numeric, null::numeric, null::numeric, 4.4::numeric, null::numeric, 0::numeric, 0.01::numeric, 0.02::numeric, 0.1::numeric, 0.02::numeric, 4::numeric, null::numeric, 2.04::numeric, null::numeric),
  -- Fruit juice drink/squash, undiluted — UK_fct, used in 1 recipe
  ('V508', 6::numeric, 0::numeric, 0::numeric, 1::numeric, 40::numeric, 27::numeric, 2::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0.1::numeric, 0.01::numeric, 2::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Gherkins, pickled, drained — UK_fct, used in 1 recipe
  ('D505', 20::numeric, 0.7::numeric, 0.3::numeric, 11::numeric, 690::numeric, 110::numeric, 22::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 1::numeric, 0::numeric, 0.02::numeric, 0.1::numeric, null::numeric, 6::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Hazelnuts, kernel only — UK_fct, used in 1 recipe
  ('H502', 140::numeric, 3.2::numeric, 2.1::numeric, 160::numeric, 6::numeric, 730::numeric, 300::numeric, 2::numeric, 0::numeric, null::numeric, null::numeric, 24.98::numeric, null::numeric, 0::numeric, 0.43::numeric, 0.16::numeric, 1.1::numeric, 0.59::numeric, 72::numeric, 0::numeric, 4.55::numeric, null::numeric),
  -- Kiwi fruit, flesh only, raw — UK_fct, used in 1 recipe
  ('E502', 33::numeric, 0.22::numeric, 0.1::numeric, 13::numeric, 1::numeric, 289::numeric, 33::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 2.17::numeric, null::numeric, 71::numeric, 0::numeric, 0::numeric, 0.3::numeric, 0.09::numeric, 33::numeric, 0::numeric, 0.07::numeric, null::numeric),
  -- Marmalade — UK_fct, used in 1 recipe
  ('W502', 26::numeric, 0.2::numeric, 0.1::numeric, 3::numeric, 64::numeric, 35::numeric, 6::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 10::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 5::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Melon seeds — UK_fct, used in 1 recipe
  ('H500', 71::numeric, 7.6::numeric, 4::numeric, 510::numeric, 99::numeric, 650::numeric, 690::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.17::numeric, 0.15::numeric, 2.1::numeric, null::numeric, 58::numeric, 0::numeric, 12::numeric, null::numeric),
  -- Milk, evaporated, light — UK_fct, used in 1 recipe
  ('L509', 260::numeric, 0::numeric, 1::numeric, 25::numeric, 115::numeric, 336::numeric, 233::numeric, 3::numeric, 50::numeric, null::numeric, null::numeric, 0.11::numeric, null::numeric, 1::numeric, 0.07::numeric, 0.42::numeric, 0.2::numeric, 0.04::numeric, 8::numeric, 16.9::numeric, 2.5::numeric, null::numeric),
  -- Milk, skimmed, dried, fortified — UK_fct, used in 1 recipe
  ('L510', 1280::numeric, 0.27::numeric, 4::numeric, 130::numeric, 550::numeric, 1590::numeric, 970::numeric, 11::numeric, 550::numeric, null::numeric, null::numeric, 0.01::numeric, null::numeric, 13::numeric, 0.38::numeric, 1.63::numeric, 1::numeric, 0.6::numeric, 51::numeric, 12::numeric, 0.4::numeric, null::numeric),
  -- Mixed herbs, dried — UK_fct, used in 1 recipe
  ('G521', 1653::numeric, 68.97::numeric, 4.6::numeric, 280::numeric, 81::numeric, 1873::numeric, 235::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 43::numeric, null::numeric, 0.34::numeric, 5::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Oil, sesame — UK_fct, used in 1 recipe
  ('T509', 10::numeric, 0.1::numeric, 0::numeric, 0::numeric, 2::numeric, 20::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.01::numeric, 0.07::numeric, 0.1::numeric, 0::numeric, 0::numeric, 0::numeric, 14.6::numeric, null::numeric),
  -- Olives, green, in brine, drained, flesh and skin — UK_fct, used in 1 recipe
  ('D504', 61::numeric, 1::numeric, null::numeric, 22::numeric, 1330::numeric, 91::numeric, 17::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 1.99::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0.02::numeric, 0::numeric, 0::numeric, 1.7::numeric, null::numeric),
  -- Peanut butter, smooth — UK_fct, used in 1 recipe
  ('B504', 37::numeric, 2.1::numeric, 3::numeric, 180::numeric, 350::numeric, 700::numeric, 330::numeric, 3::numeric, 0::numeric, null::numeric, null::numeric, 4.99::numeric, null::numeric, 0::numeric, 0.17::numeric, 0.09::numeric, 12.5::numeric, 0.58::numeric, 53::numeric, 0::numeric, 12.78::numeric, null::numeric),
  -- Peanuts, dry roasted — UK_fct, used in 1 recipe
  ('B505', 52::numeric, 2.1::numeric, 3.3::numeric, 190::numeric, 790::numeric, 730::numeric, 420::numeric, 3::numeric, 0::numeric, null::numeric, null::numeric, 1.11::numeric, 0.31::numeric, 0::numeric, 0.18::numeric, 0.13::numeric, 13.1::numeric, 0.54::numeric, 44::numeric, 0::numeric, 8.9::numeric, null::numeric),
  -- Pickle, sweet — UK_fct, used in 1 recipe
  ('D506', 15::numeric, 0.6::numeric, 0.1::numeric, 6::numeric, 1130::numeric, 94::numeric, 12::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.03::numeric, 0.01::numeric, 0.1::numeric, 0.01::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Pizza base, raw — UK_fct, used in 1 recipe
  ('X513', 86::numeric, 1.55::numeric, 0.7::numeric, 18::numeric, 400::numeric, 124::numeric, 85::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.41::numeric, 0.03::numeric, 1.7::numeric, 0.03::numeric, 8::numeric, null::numeric, null::numeric, null::numeric),
  -- Redcurrants, raw — UK_fct, used in 1 recipe
  ('E505', 36::numeric, 1.2::numeric, 0.2::numeric, 13::numeric, 2::numeric, 280::numeric, 30::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0.1::numeric, null::numeric, 40::numeric, 0.04::numeric, 0.06::numeric, 0.1::numeric, 0.05::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Rosemary, dried — UK_fct, used in 1 recipe
  ('G525', 1280::numeric, 29.3::numeric, 3.2::numeric, 220::numeric, 50::numeric, 950::numeric, 70::numeric, 5::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 61::numeric, 0.51::numeric, 0.43::numeric, 1::numeric, 1.74::numeric, 307::numeric, 0::numeric, 7.37::numeric, null::numeric),
  -- Sauces, Indian cook in, other — UK_fct, used in 1 recipe
  ('X500', 33::numeric, 1.02::numeric, 0.2::numeric, 18::numeric, 300::numeric, 236::numeric, 32::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 2.34::numeric, null::numeric, 3::numeric, 0.03::numeric, 0.03::numeric, 0.8::numeric, 0.08::numeric, 11::numeric, null::numeric, 0.5::numeric, null::numeric),
  -- Spring onions, bulbs only, raw — UK_fct, used in 1 recipe
  ('G501', 140::numeric, 1.2::numeric, null::numeric, 11::numeric, 13::numeric, 230::numeric, 24::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 25::numeric, 0.13::numeric, 0::numeric, 0.7::numeric, 0.2::numeric, 17::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Tea, green, infusion — UK_fct, used in 1 recipe
  ('V511', 2::numeric, 0.1::numeric, 0::numeric, 0::numeric, 1::numeric, 20::numeric, 1::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 3::numeric, 0::numeric, 0.02::numeric, 0.1::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Tomatoes, cherry, raw — UK_fct, used in 1 recipe
  ('D502', 10::numeric, 0.34::numeric, 0.2::numeric, 12::numeric, 4::numeric, 274::numeric, 31::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, 0.89::numeric, null::numeric, 15::numeric, 0.05::numeric, 0.02::numeric, 0.4::numeric, 0.06::numeric, 24::numeric, 0::numeric, 0.1::numeric, null::numeric),
  -- Watercress, raw — UK_fct, used in 1 recipe
  ('C502', 138::numeric, 0.72::numeric, 0.5::numeric, 16::numeric, 37::numeric, 300::numeric, 61::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 1.46::numeric, 315::numeric, 62::numeric, 0.16::numeric, 0.06::numeric, 0.3::numeric, 0.23::numeric, 43::numeric, 0::numeric, 0.09::numeric, null::numeric),
  -- White sauce, savoury, made with whole milk, homemade — UK_fct, used in 1 recipe
  ('X506', 136::numeric, 0.18::numeric, 0.6::numeric, 14::numeric, 105::numeric, 182::numeric, 113::numeric, 1::numeric, 118::numeric, null::numeric, null::numeric, 0.25::numeric, null::numeric, 1::numeric, 0.04::numeric, 0.23::numeric, 0.2::numeric, 0.06::numeric, 5::numeric, 30.4::numeric, 6.8::numeric, null::numeric),
  -- ALMOND FLOUR, ALMOND — US_fct, used in 1 recipe
  ('A513', 271::numeric, 3.57::numeric, null::numeric, 271::numeric, null::numeric, 736::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 26::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 3.57::numeric, null::numeric),
  -- BALSAMIC VINEGAR — US_fct, used in 1 recipe
  ('G539', null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric),
  -- BLACK BEANS — US_fct, used in 1 recipe
  ('B507', 31::numeric, 1.13::numeric, null::numeric, null::numeric, 496::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 4.7::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- BLACK RICE — US_fct, used in 1 recipe
  ('A509', 0::numeric, 1.67::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- CAJUN SEASONING, CAJUN — US_fct, used in 1 recipe
  ('X517', 0::numeric, 0::numeric, null::numeric, null::numeric, 25556::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Capers, canned — US_fct, used in 1 recipe
  ('G542', 40::numeric, 1.67::numeric, 0.32::numeric, 33::numeric, 2350::numeric, 40::numeric, 10::numeric, 1.2::numeric, 0::numeric, null::numeric, 0::numeric, 0.88::numeric, null::numeric, 4.3::numeric, 0.018::numeric, 0.139::numeric, 0.652::numeric, 0.023::numeric, 23::numeric, 0::numeric, 0.233::numeric, null::numeric),
  -- Cheese, provolone — US_fct, used in 1 recipe
  ('L513', 756::numeric, 0.52::numeric, 3.23::numeric, 28::numeric, 727::numeric, 138::numeric, 496::numeric, 14.5::numeric, 230::numeric, null::numeric, 0.5::numeric, 0.23::numeric, 2.2::numeric, 0::numeric, 0.019::numeric, 0.321::numeric, 0.156::numeric, 0.073::numeric, 10::numeric, 69::numeric, 17.1::numeric, null::numeric),
  -- Chia seeds — US_fct, used in 1 recipe
  ('H506', 255::numeric, 5.73::numeric, 4.34::numeric, 392::numeric, 30::numeric, 813::numeric, 642::numeric, 25.4::numeric, 0::numeric, null::numeric, null::numeric, 0.31::numeric, 4.3::numeric, 0.6::numeric, 1.644::numeric, 0.161::numeric, 3.08::numeric, 0.473::numeric, 87::numeric, 0::numeric, 3.663::numeric, null::numeric),
  -- CREAMED CORN — US_fct, used in 1 recipe
  ('X518', 53::numeric, 0.32::numeric, 0::numeric, null::numeric, 186::numeric, null::numeric, null::numeric, null::numeric, 0.265::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 3.2::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 27::numeric, 4.42::numeric, null::numeric),
  -- DIJON MUSTARD, DIJON — US_fct, used in 1 recipe
  ('X515', 0::numeric, 0::numeric, null::numeric, null::numeric, 2400::numeric, 200::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- GINGER JUICE, GINGER — US_fct, used in 1 recipe
  ('G548', 17::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 417::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, null::numeric),
  -- HOT DOG BUNS — US_fct, used in 1 recipe
  ('U506', 30::numeric, 1.89::numeric, 0::numeric, null::numeric, 434::numeric, 72::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0.94::numeric, null::numeric),
  -- Lemon grass (citronella), raw — US_fct, used in 1 recipe
  ('G551', 65::numeric, 8.17::numeric, 2.23::numeric, 60::numeric, 6::numeric, 723::numeric, 101::numeric, 0.7::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 2.6::numeric, 0.065::numeric, 0.135::numeric, 1.1::numeric, 0.08::numeric, 75::numeric, 0::numeric, 0.119::numeric, null::numeric),
  -- Milk, dry, nonfat, regular, without added vitamin A  — US_fct, used in 1 recipe
  ('L516', 1260::numeric, 0.32::numeric, 4.08::numeric, 110::numeric, 535::numeric, 1790::numeric, 968::numeric, 27.3::numeric, 6::numeric, null::numeric, 0::numeric, 0::numeric, 0.1::numeric, 6.8::numeric, 0.415::numeric, 1.55::numeric, 0.951::numeric, 0.361::numeric, 50::numeric, 20::numeric, 0.499::numeric, null::numeric),
  -- MUSTARD SAUCE — US_fct, used in 1 recipe
  ('X514', 0::numeric, 1.29::numeric, 0::numeric, null::numeric, 714::numeric, null::numeric, null::numeric, null::numeric, 0.357::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 89::numeric, 12.5::numeric, null::numeric),
  -- Nuts, coconut water (liquid from coconuts) — US_fct, used in 1 recipe
  ('H508', 24::numeric, 0.29::numeric, 0.1::numeric, 25::numeric, 105::numeric, 250::numeric, 20::numeric, 1::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 2.4::numeric, 0.03::numeric, 0.057::numeric, 0.08::numeric, 0.032::numeric, 3::numeric, 0::numeric, 0.176::numeric, null::numeric),
  -- PITTED BLACK OLIVES — US_fct, used in 1 recipe
  ('D507', 0::numeric, 4.8::numeric, null::numeric, null::numeric, 800::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 3.33::numeric, null::numeric),
  -- RICE VINEGAR — US_fct, used in 1 recipe
  ('G543', null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric),
  -- Spices, onion powder — US_fct, used in 1 recipe
  ('G555', 384::numeric, 3.9::numeric, 4.05::numeric, 113::numeric, 73::numeric, 985::numeric, 322::numeric, 14.3::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, 4.1::numeric, 23.4::numeric, 0.457::numeric, 0.08::numeric, 0.321::numeric, 0.718::numeric, 64::numeric, 0::numeric, 0.219::numeric, null::numeric),
  -- WHITE HAMBURGER BUNS — US_fct, used in 1 recipe
  ('U507', 47::numeric, 2.51::numeric, null::numeric, null::numeric, 465::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 1::numeric, 0.316::numeric, 4.651::numeric, null::numeric, 93::numeric, 0::numeric, 0::numeric, null::numeric),
  -- WHOLE WHEAT HAMBURGER BUNS — US_fct, used in 1 recipe
  ('U508', 75::numeric, 2.04::numeric, 0::numeric, null::numeric, 453::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0.128::numeric, 3.019::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Currants — UK_fct, used in 0 recipes
  ('E510', 93::numeric, 1.3::numeric, 0.3::numeric, 30::numeric, 14::numeric, 720::numeric, 71::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.16::numeric, 0.05::numeric, 0.9::numeric, 0.23::numeric, 4::numeric, 0::numeric, null::numeric, null::numeric),
  -- Fruit cocktail, canned in syrup, whole contents — UK_fct, used in 0 recipes
  ('V506', 5::numeric, 0.3::numeric, 0.1::numeric, 5::numeric, 3::numeric, 95::numeric, 9::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 4::numeric, 0.02::numeric, 0.01::numeric, 0.4::numeric, 0.03::numeric, 5::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Fruit juice drink/squash, diluted — UK_fct, used in 0 recipes
  ('V507', 1::numeric, 0::numeric, 0::numeric, 0::numeric, 8::numeric, 5::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Peaches, canned in syrup, whole contents — UK_fct, used in 0 recipes
  ('E508', 3::numeric, 0.2::numeric, 0::numeric, 5::numeric, 4::numeric, 110::numeric, 11::numeric, 0::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 5::numeric, 0.01::numeric, 0.01::numeric, 0.6::numeric, 0.02::numeric, 7::numeric, 0::numeric, 0::numeric, null::numeric),
  -- Pumpkin seeds — UK_fct, used in 0 recipes
  ('H518', 39::numeric, 10::numeric, 6.6::numeric, 270::numeric, 18::numeric, 820::numeric, 850::numeric, 6::numeric, 0::numeric, null::numeric, null::numeric, null::numeric, null::numeric, 0::numeric, 0.23::numeric, 0.32::numeric, 1.7::numeric, null::numeric, null::numeric, 0::numeric, 7::numeric, null::numeric),
  -- Soybeans, mature seeds, raw — US_fct, used in 0 recipes
  ('B508', 277::numeric, 15.7::numeric, 4.89::numeric, 280::numeric, 2::numeric, 1800::numeric, 704::numeric, 17.8::numeric, 0::numeric, null::numeric, null::numeric, 0.85::numeric, 47::numeric, 6::numeric, 0.874::numeric, 0.87::numeric, 1.62::numeric, 0.377::numeric, 375::numeric, 0::numeric, 2.88::numeric, null::numeric)
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

-- Proof on screen.
select (select count(*) from foods where calcium_mg is not null)      as foods_with_micronutrients,
       (select sodium_mg from foods where food_code = 'G528')          as salt_sodium_mg,
       (select round(vit_a_ug) from foods where food_code = 'M001')    as egg_vitamin_a_ug,
       (select round(vit_a_ug) from foods where food_code = 'C033')    as spinach_vitamin_a_ug,
       (select iron_mg from foods where food_code = 'G523')            as garam_masala_iron_mg;
