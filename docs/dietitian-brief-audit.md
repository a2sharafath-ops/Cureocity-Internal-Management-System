# The dietitian brief against what is actually built

Updated 12 August 2026. This is the implementation checklist for
`docs/dietitian-brief.md`, based on the current code rather than the order in
which the feature was built.

**Done** means the app stores or enforces it. **Partly** means the information
can reach the dietitian or generator but still needs clinical judgement or a
more complete workflow. **Missing** means there is no dependable implementation.

## 1. Personalization inputs

| Input | State | Current implementation |
|---|---|---|
| Age, sex, height, weight, BMI | **Done** | Client record, InBody and `bmiFrom()` |
| BMR and activity | **Done** | Measured BMR wins; assessment settles activity and TDEE |
| Comorbidities and goals | **Done** | Client record plus diet assessment |
| Stress, sleep and occupation | **Done** | Assessment fields; passed explicitly to AI drafting |
| Region | **Done** | Assessment field; null means the Kerala default; chart reminder and AI context |
| Shift pattern | **Done** | Assessment field; daytime-chart reminder and AI context |
| Outside / English meals | **Done as input** | Assessment field; chart reminder and AI context |
| Medications | **Done** | Active medication table plus assessment rows; chart interaction check and AI context |
| 24-hour dietary recall | **Done as input** | Structured Diet consultation answers; passed to AI by meal |
| Physiological condition | **Partly** | Pregnancy/postpartum/menopause answers are passed to AI, but there is no dedicated assessment field |
| Workout timing | **Partly** | Exercise routine reaches AI; a dependable time-of-day field is still absent |
| Genetics / epigenetics | **Missing** | Consultation can record previous testing, but there is no structured result or clinical rule engine |

## 2. BMR, TDEE and review changes

**Done:** standard activity factors, measured-BMR preference, calculated TDEE,
and a warning when a new chart moves more than 200 kcal from the previous
version.

**Still missing:** automatic 3rd- and 10th-week review scheduling. The calorie
step is deliberately a warning rather than an absolute refusal because a real
InBody measurement may correctly replace a poor estimate by more than 200 kcal.

## 3. Macronutrient planning

**Done:** calorie, carbohydrate, protein, fat and fibre targets are numeric
minimum/maximum ranges in the builder. Historical target text is parsed into
the same structure. The lightest and heaviest possible day are checked against
all four macro ranges, and a chart outside any range cannot be submitted,
approved or shared.

**Still missing:** automatic clinical distribution of TDEE into those targets,
and a separate good-fat / bad-fat target. The dietitian still decides the
numbers.

## 4. Micronutrients and laboratory findings

**Done:** the food table carries the available IFCT/CoFID/USDA micronutrients;
recipes and multi-recipe options total each nutrient independently. Structured
lab results retain the report date and its own reference range. The latest
out-of-range findings appear beside the chart and are passed explicitly to AI
drafting.

**Partly:** findings are clinical reminders, not automatic prescriptions. A
dietitian still decides the response. Vitamin D and oxalate coverage remains
sparse because the source tables publish little or none.

## 5. Food-drug interactions

**Done for the three rules named in the brief:** thyroxine with calcium/iron,
diuretics with sodium/potassium, and statins with grapefruit. The check reads
the client's active medication rows.

These are advisory because timing often resolves the interaction. Expanding
beyond these rules requires a maintained, licensed interaction source.

## 6–10. Structure, workout timing and cultural fit

- Meal slots and times are freely editable and start from the clinic's standard day.
- The early-morning prohibition is enforced and blocks publishing.
- Kerala is the explicit default; non-Kerala region is shown to the dietitian and AI.
- Night/rotating shifts are recorded and a daytime-shaped chart raises a reminder.
- Frequent eating out raises a restaurant/English-meal reminder and reaches AI.

**Still partial:** the application does not itself rearrange slots around a
workout or shift, and it does not calculate restaurant portion distortion or a
corrective balance for the rest of the day. Those remain generator/dietitian
judgements.

## 11. Meal chart format and interchangeability

**Done.** Every option stores and prints food, quantity, calories,
carbohydrate, protein, fat, fibre and key micronutrients. An active meal slot
must contain exactly four named options. Options are checked for the clinic's
40 kcal spread and configured carbohydrate/protein/fat/fibre spreads. Every
possible day is checked against the calorie and numeric macro targets.

Linked options take all five figures from approved recipes. Hand-typed options
must supply all five and pass the calorie-versus-macros consistency check.

## 12. Source and accuracy

**Done as a controlled workflow.** Linked figures come from the food/recipe
tables; the model never supplies nutrition numbers. Missing, negative,
internally inconsistent, unapproved or stale recipe figures block submission,
approval and sharing.

Known source boundaries:

1. IFCT does not contain every ingredient used by the clinic. CoFID and USDA
   rows remain source-labelled rather than presented as IFCT.
2. Imported recipes without reliable ingredient weights use their published
   per-serving figures and are labelled as quoted rather than calculated.

## Tone and rationale

**Partly.** The chart has coaching notes and the AI returns a chart-level
rationale, but that rationale is not persisted. There is no per-option
rationale field yet.

## Remaining work, in priority order

1. Configure `OPENAI_API_KEY` in each environment and run an end-to-end draft with a test client.
2. Add structured workout time and physiological-condition fields.
3. Persist chart-level and per-option rationales.
4. Add 3rd-/10th-week review scheduling.
5. Add restaurant-equivalent and corrective-balance assistance.
6. Decide whether and how genetics data may be stored and acted on.
7. Continue recipe approval, ingredient-weight and micronutrient data-quality work.
8. Add browser/database integration coverage for assessment → chart → review → PDF → portal.
