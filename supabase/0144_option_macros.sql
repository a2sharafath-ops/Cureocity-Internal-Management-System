-- The three columns the clinic's brief asks for and the chart never had.
--
-- `docs/dietitian-brief.md` §11 specifies nine columns per option — Option,
-- Food Items, Quantity, Calories, Carbs, Protein, Fat, Fibre, Micronutrients.
-- The chart stored six. Carbohydrate, fat and fibre were asked for on the
-- printed document and were nowhere in the record.
--
-- Three things follow from that, and all three are the reason this migration
-- exists rather than being a tidy-up:
--
--   * They could not print on the client's chart.
--   * §3's macronutrient targets could not be checked against what the day
--     actually adds up to. Only calories were totalled, so a chart could state
--     "protein 90-95 g" and quietly deliver 60.
--   * §11's "equal in carb, protein, fat and fiber" could not be enforced at
--     all. The +/-40 kcal half of that rule was; this half had nowhere to look.
--
-- None of this is new arithmetic. `lib/nutrition.ts` has computed all five
-- figures for every dish since the food table went in — the chart simply had
-- nowhere to keep three of them.

alter table diet_plan_options
  add column if not exists carb_g  numeric(6,1),
  add column if not exists fat_g   numeric(6,1),
  add column if not exists fibre_g numeric(6,1);

-- The published per-serving figures a quoted recipe carries, extended to match.
--
-- Without these an imported recipe could fill in calories and protein and
-- leave the other three blank, which would block every chart built from one —
-- 585 of the 1,014 recipes quote rather than compute. INDB publishes all five
-- per serving, so all five come across.
alter table dishes
  add column if not exists source_carb_g  numeric,
  add column if not exists source_fat_g   numeric,
  add column if not exists source_fibre_g numeric;

-- ---- check afterwards -------------------------------------------------------
--   select count(*) from diet_plan_options where carb_g is null;
--   select count(*) from dishes where source_kcal is not null and source_carb_g is null;
