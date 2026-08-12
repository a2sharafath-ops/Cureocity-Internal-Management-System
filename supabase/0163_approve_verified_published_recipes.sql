-- Clear the remaining INDB recipes whose per-serving figures were reconciled
-- against Nutrient Data.xlsx.
--
-- The audit requires all five published values, a real serving record, an
-- active (not superseded) source, a passing calorie/macronutrient energy
-- balance, and a plausible amount for one serving. It cleared 108 rows. The
-- source-incomplete recipes are deliberately excluded and remain unavailable
-- to client charts.

update dishes
set
  approved = true,
  approved_by = 'INDB published nutrition audit',
  approved_at = now(),
  updated_at = now()
where approved = false
  and source like 'INDB %'
  and servings > 0
  and source_superseded is null
  and source_kcal is not null
  and source_carb_g is not null
  and source_protein_g is not null
  and source_fat_g is not null
  and source_fibre_g is not null
  -- The same generous plausibility gates used by lib/nutrition.ts.
  and source_kcal <= 1200
  and source_fat_g <= 90
  and source_protein_g <= 75
  and (
    abs((4 * source_protein_g + 4 * source_carb_g + 9 * source_fat_g + 2 * source_fibre_g) - source_kcal) <= 15
    or abs((4 * source_protein_g + 4 * source_carb_g + 9 * source_fat_g + 2 * source_fibre_g) - source_kcal)
       / greatest(source_kcal, 1) <= 0.25
  );

select count(*) as source_data_needed
from dishes
where approved = false;
