# The brief against what is actually built

Point by point through `docs/dietitian-brief.md`. Written so the gaps are
visible before anyone asks the app to generate a chart from that brief: a
generator can only honour a rule the chart has somewhere to put.

**Done** — built and enforced. **Partly** — the field exists but nothing checks
it, or it is typed by hand. **Missing** — nowhere to put it.

---

## 1. Personalization inputs

| Input | State | Where |
|---|---|---|
| Age, sex, height, weight, BMI | **Done** | client record; `bmiFrom()` |
| BMR from InBody | **Done** | `measurements`, parsed by `lib/inbody-parse.ts`. Measured BMR beats the Mifflin–St Jeor estimate, deliberately |
| Comorbidities | **Done** | the client's conditions, and **Existing condition** on the assessment |
| Physiological condition (menopause, pregnancy, post-viral) | **Partly** | only as free text inside medical history |
| Health goals | **Done** | **Primary goal**, target weight, timeline |
| **Genetics & epigenetics (SNPs)** | **Missing** | no field anywhere. Cannot be honoured at all |
| Stress, sleep, work nature | **Done** | assessment: stress level, sleep hours and quality, occupation |
| **Shift timing** | **Missing** | no field |
| Medications | **Done** | medication rows on the assessment |
| **24-hour dietary recall** | **Missing** | no structured field. Meal monitoring is a different thing — it is what they ate after the chart, not before it |
| Workout timing | **Partly** | exercise rows exist; the *time of day* is not captured |
| **Client's region** | **Missing** | no field. The Kerala default is a convention, not data |
| **Outside / English-meal preference** | **Missing** | no field |

## 2. BMR and TDEE

**Done.** `ACTIVITY_FACTORS` in `lib/diet-assessment.ts` holds 1.2 / 1.375 /
1.55 / 1.725 / 1.9 exactly as the brief specifies, and `estimateTee()` applies
them to the InBody BMR, rounded to the nearest 50.

**Missing:** the ±100–200 kcal increment rule, and applying changes at the 3rd
and 10th week reviews. Nothing computes a new target from the previous chart,
and nothing knows a review is due. A new version can currently move the target
by any amount.

## 3. Macronutrient planning

**Partly.** The chart carries protein, carbohydrate, fats and fibre targets and
refuses to publish with any of them blank — but they are **free text typed by
hand**, not distributed from TDEE. Nothing splits fats into good and bad, and
nothing adjusts for condition, goal or genetic traits.

## 4. Micronutrient inclusion

**Mostly.** All 726 foods now carry 22 vitamins and minerals from IFCT 2017,
with the non-IFCT ones filled from UK CoFID and USDA (0155, 0157). A recipe
adds them up one nutrient at a time — sodium computes for 717 of 738 priceable
recipes, calcium for 729, iron for 734 — and a chart option built from recipes
offers the line it works out to, which the dietitian accepts with one click.

Still hers to type, on purpose: the box carries things the ingredients cannot
know, and filling it automatically would overwrite one of them.

**Still missing:** nothing reads deficiencies from lab reports, because lab
results are not stored as values (see §12). Vitamin D and oxalate compute for
almost nothing — CoFID publishes neither.

## 5. Food–drug interactions

**Done, for the three the brief names.** `lib/food-drug.ts` reads a chart
against the client's active medicines: thyroxine against calcium and iron,
diuretics against potassium and sodium, statins against grapefruit. Matching is
on the brand names a Kerala prescription actually carries — Thyronorm, Eltroxin,
Dytor, Rosuvas — because nobody writes "levothyroxine".

It warns and does not block, because almost every one of these is answered by
timing rather than by changing the food, and a gate that was wrong on most of
the charts it stopped would train everybody to click through it.

**The boundary, which matters more than the feature:** it holds three rules and
says so on screen. Silence from it means "none of these three", never "no
interaction". Anything wider needs a real interaction database, which is a
different undertaking and a licensing question.

## 6. Lifestyle-based structuring

**Partly.** Slots are freely editable and a new chart seeds the clinic's
standard seven. Nothing derives the number of meals from wake/sleep cycle or
occupation; the dietitian decides.

## 7. Workout-based meal timing

**Partly, by naming.** The default day includes *Evening snack / Pre-workout
meal* and *Dinner / Post-workout meal*, so the convention is baked into the
seed. Nothing reads the client's actual session time and rearranges around it.

## 8. Scientific early morning drink

**Missing as a rule.** The *Upon waking* slot exists; nothing enforces the
allowed list, and nothing refuses lemon water, ashwagandha, cinnamon water or
apple cider vinegar. Worth noting this is the one rule in the brief phrased as
an outright prohibition, and it is the easiest to check mechanically.

## 9. Kerala default

**Done in substance.** The dish library is Kerala and Indian cuisine under
local names — puttu, kadala curry, idiyappam, avial. New dishes default to
cuisine "Kerala". Imported INDB recipes are tagged "Indian".

**Missing:** the client's region as a field, so "if the client is from outside
Kerala it will be specified" has nowhere to be specified.

## 10. Restaurant / English meal inclusion

**Missing as a feature**, possible as free text. Any option can be written by
hand as a restaurant meal, but nothing offers equivalents or suggests
corrective balance for the rest of the day.

## 11. Meal chart format

**This is the gap that matters most for a generator.** The brief's table has
nine columns; the builder has six.

| Brief column | In the builder? |
|---|---|
| Option | Yes |
| Food Item(s) | Yes |
| Quantity | Yes |
| Calories | Yes |
| **Carbs (g)** | **No column** |
| Protein (g) | Yes |
| **Fat (g)** | **No column** |
| **Fiber (g)** | **No column** |
| Key Micronutrients | Yes |

Consequences:

- **Carbs, fat and fibre per option are not stored**, so they cannot print on
  the client's chart and the day's totals cannot be checked against the
  macronutrient targets. Only calories and protein are totalled.
- The **±40 kcal spread is enforced** (`OPTION_KCAL_SPREAD`) — that half of the
  rule is done.
- **"Equal in carb, protein, fat and fiber" is not enforced**, and cannot be
  until those columns exist.
- **"4 options" is not enforced.** A slot may hold any number, including one.

Worth knowing: `lib/nutrition.ts` already computes carbs, fat and fibre for
every dish. The figures exist; the chart simply has nowhere to keep them.

## 12. Source and accuracy

**Done, and it is the spine of the whole feature.** Values come from the food
table, never from recall; a chart with a blank or an impossible figure cannot
be submitted, approved or sent; a linked option's numbers cannot be typed over;
and where our own sum contradicts a published one by more than 25% the app
distrusts its own arithmetic.

**Two documented deviations, both agreed knowingly:**

1. **Not everything is IFCT.** IFCT covers raw agricultural foods and does not
   carry salt, refined oils, sugar or spice blends. 191 ingredients come from
   UK CoFID 2021 and USDA FoodData Central, each row tagged with its source.
2. **585 of the 1,014 imported recipes quote INDB's published per-serving
   figures** rather than computing from ingredients, because their amounts are
   in spoons with no published gram weight. The screen says *"quoted, not
   calculated"* wherever this applies.

**Missing:** "ensure daily summary matches target macros" is only checked for
calories. Protein, carbohydrate, fat and fibre targets are never compared
against what the day's options actually add up to — again because three of
those columns do not exist.

## Tone and output style

**Missing:** there is no field for a per-option rationale ("supports satiety
due to high fibre"). Coaching notes are per chart, not per option.

---

## If a generate button is to honour this brief

In rough order of how much each blocks it:

1. ~~**Add carbs, fat and fibre to a chart option.**~~ Done — 0144, and the
   totals check all five.
2. ~~**Food–drug interaction checks (§5).**~~ Done — `lib/food-drug.ts`, for
   the three the brief names.
3. **The early-morning-drink prohibition (§8)** — a short, mechanical check,
   and the only rule in the brief phrased as an outright refusal. Needs no new
   data.
4. **A region field, and shift timing (§1, §9).** Two columns and two boxes;
   what they unlock is a convention becoming a rule.
5. **The ±100–200 kcal review increments (§2)** — needs the previous chart's
   target, which versioning already keeps.
6. **Structured lab values (§4)** — today reports are uploaded files with a
   typed summary, so deficiencies can only be read if a human wrote them down.
   This is what would let §4 read a deficiency rather than wait to be told one.
7. **Genetics (§1)** — a real feature in its own right, not a field.

**Not in the brief, but blocking it in practice:** the "Draft from
consultations" button has never once run — it needs OPENAI_API_KEY in the
environment. Everything above is written so a generator could honour it, and
nobody has yet seen the generator work.
