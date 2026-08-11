// Working out what a portion actually contains.
//
// The clinic's dietitian brief asks that every value come from the ICMR food
// tables and that there be "no tolerance for errors in calorie or macro
// totals". Neither a person recalling a number nor a language model producing
// one can honour that — both are recall dressed as lookup. This file is the
// lookup: ingredients in grams, composition per 100 g, arithmetic.
//
// Deliberately pure. No database, no network, no clock — so the sums can be
// tested against known values rather than trusted.

/** A row of the IFCT table, per 100 g edible portion. */
export type Food = {
  food_code: string;
  name: string;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fibre_g: number | null;
  kcal: number | null;
};

export type Nutrients = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fibre_g: number;
};

export type DishItem = { food_code: string | null; name: string; raw_g: number };

export type Dish = {
  name: string;
  /** What the finished dish weighs. Null when nobody has recorded it. */
  cooked_g: number | null;
  /** How many portions it divides into. */
  servings: number | null;
  items: DishItem[];
};

const ZERO: Nutrients = { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0 };
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * What `grams` of one food contains.
 *
 * A null column in IFCT means the nutrient is ABSENT, not unrecorded — meat and
 * fish have no carbohydrate and no fibre — so it contributes zero rather than
 * poisoning the total.
 */
export function nutrientsOf(food: Food, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: (food.kcal ?? 0) * f,
    protein_g: (food.protein_g ?? 0) * f,
    fat_g: (food.fat_g ?? 0) * f,
    carb_g: (food.carb_g ?? 0) * f,
    fibre_g: (food.fibre_g ?? 0) * f,
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal, protein_g: a.protein_g + b.protein_g,
    fat_g: a.fat_g + b.fat_g, carb_g: a.carb_g + b.carb_g, fibre_g: a.fibre_g + b.fibre_g,
  };
}

export const roundNutrients = (n: Nutrients): Nutrients => ({
  kcal: Math.round(n.kcal),
  protein_g: r1(n.protein_g), fat_g: r1(n.fat_g), carb_g: r1(n.carb_g), fibre_g: r1(n.fibre_g),
});

export type DishVerdict =
  | { priced: true; whole: Nutrients; perServing: Nutrients }
  | { priced: false; reason: string };

/**
 * What one serving of a dish contains.
 *
 * Refuses rather than estimates. An unmapped ingredient, a missing weight or an
 * unrecorded serving count each mean the answer would be a guess, and a guess
 * presented to three decimal places is worse than no answer — it is the exact
 * failure this whole layer exists to remove.
 *
 * Cooking loss is NOT modelled. Ingredients are weighed raw, IFCT's values are
 * for raw foods, and the nutrients in a boiled cup of rice are the nutrients of
 * the rice that went in. Water changes the weight, not the energy.
 */
export function dishNutrients(dish: Dish, foods: Map<string, Food>): DishVerdict {
  if (!dish.items.length) return { priced: false, reason: "no ingredients recorded" };

  const unmapped = dish.items.filter((i) => !i.food_code || !foods.has(i.food_code));
  if (unmapped.length) {
    const names = unmapped.map((i) => i.name).slice(0, 3).join(", ");
    return { priced: false, reason: `${unmapped.length} ingredient${unmapped.length === 1 ? "" : "s"} not matched to the food table (${names})` };
  }
  const weightless = dish.items.filter((i) => !(i.raw_g > 0));
  if (weightless.length) return { priced: false, reason: `${weightless[0].name} has no weight` };

  const whole = dish.items.reduce(
    (acc, i) => addNutrients(acc, nutrientsOf(foods.get(i.food_code!)!, i.raw_g)), ZERO);

  if (!dish.servings || dish.servings <= 0) {
    return { priced: false, reason: "servings not recorded, so one portion cannot be worked out" };
  }
  const per = dish.servings;
  return {
    priced: true,
    whole: roundNutrients(whole),
    perServing: roundNutrients({
      kcal: whole.kcal / per, protein_g: whole.protein_g / per, fat_g: whole.fat_g / per,
      carb_g: whole.carb_g / per, fibre_g: whole.fibre_g / per,
    }),
  };
}

/** What `servings` of a priced dish contains — half a portion, two portions. */
export function portionOf(perServing: Nutrients, servings: number): Nutrients {
  return roundNutrients({
    kcal: perServing.kcal * servings, protein_g: perServing.protein_g * servings,
    fat_g: perServing.fat_g * servings, carb_g: perServing.carb_g * servings,
    fibre_g: perServing.fibre_g * servings,
  });
}

/**
 * How far our own figure may sit from a published one for the same recipe
 * before we stop believing our own.
 *
 * Generous on purpose. Composition tables differ by region and season, cooking
 * losses are modelled by some sources and not others, and a 15% gap between
 * two honest calculations of the same dish is ordinary.
 *
 * What this catches is the other thing entirely: a recipe whose ingredient
 * list is not what a serving contains. A deep-fried dish lists the whole pan
 * of oil, of which the food absorbs a fraction; a marinade is weighed in and
 * then poured away. Those come out three to nine times over, not fifteen
 * percent over, so the line does not need to be fine to find them — and when
 * it does, the fault is in the recipe, not in the arithmetic.
 */
export const TRUST_COMPUTED_WITHIN = 0.25;

export function contradictsSource(ours: number, published: number): boolean {
  return published > 0 && Math.abs(ours - published) / published > TRUST_COMPUTED_WITHIN;
}

/**
 * A serving nobody eats in one sitting.
 *
 * The check above compares two figures for the same recipe and distrusts ours
 * when they disagree. It cannot help when they AGREE on something absurd — and
 * they often do. Around one imported recipe in eight publishes a serving over
 * 1,000 kcal, and the worst reach 4,900: a whole pot of kofta curry, frying
 * oil included, recorded with `servings = 1` so the entire dish counts as one
 * portion. Our arithmetic reproduces that faithfully, agrees with the source
 * to within a few percent, and both are wrong about what a person eats.
 *
 * So this asks a different question: whatever the figure came from, is it a
 * plausible amount for one serving? A chart of six slots against a 1,800 kcal
 * day puts most options between 200 and 500. Past 1,200 the likeliest
 * explanation is a serving count of one on a recipe that feeds four.
 *
 * It flags rather than refuses. A genuine feast dish is somebody's clinical
 * call, not this file's.
 */
export const IMPLAUSIBLE_SERVING_KCAL = 1200;

export const servingLooksTooBig = (kcal: number): boolean => kcal > IMPLAUSIBLE_SERVING_KCAL;

/**
 * More fat or protein than a serving of anything plausibly holds.
 *
 * Both are set well clear of real food. The fattiest thing anyone would put on
 * a chart — a fried snack, a coconut-heavy curry — lands nowhere near 90 g in
 * one portion, and 75 g of protein is more than a whole grilled chicken. What
 * they catch is the same fault the calorie limit does, seen from another
 * angle: a pan of frying oil counted as eaten, or a whole dish recorded as one
 * serving. Kept separate because a dish can pass on calories and still be
 * obviously wrong on a single macro.
 */
export const IMPLAUSIBLE_FAT_G = 90;
export const IMPLAUSIBLE_PROTEIN_G = 75;

/**
 * A typical chart option, in calories.
 *
 * Not a rule about food — a reference point for arithmetic. The clinic's own
 * charts run roughly six slots against an 1,800 kcal day, which puts most
 * options between 200 and 500. 400 is the middle of that.
 */
export const TYPICAL_OPTION_KCAL = 400;

/**
 * How many servings a recipe looks like it makes, from its own total.
 *
 * A SUGGESTION and nothing more, for a recipe recorded as making one serving
 * when it plainly feeds a family: divide what the whole dish comes to by a
 * typical portion. A 4,653 kcal plate of pakora suggests twelve.
 *
 * Deliberately never applied by itself. Nobody measured this, and the app's
 * whole point is that a figure with nothing behind it does not reach a chart —
 * so it is offered in an empty box for a person to accept, alter or ignore,
 * exactly as the BMR estimate is offered on the assessment. The moment she
 * types a number, hers is the one that counts.
 *
 * Returns null where there is nothing to divide, or where the recipe is
 * already a sensible size and needs no suggestion at all.
 */
export function suggestServings(totalKcal: number): number | null {
  if (!(totalKcal > 0)) return null;
  const n = Math.round(totalKcal / TYPICAL_OPTION_KCAL);
  return n >= 2 ? n : null;
}

/**
 * A portion far heavier or lighter than others sharing its name.
 *
 * There is no published weight for "one bowl", so this is checked against the
 * only reference that exists: what every other bowl in this library weighs.
 * Stated plainly because it is a weaker claim than a citation — it says a dish
 * is unlike its neighbours, not that it is wrong. A bowl of clear soup really
 * is lighter than a bowl of biryani.
 *
 * The band is wide on purpose. Food varies, and a check that fires on half the
 * library teaches the reader to ignore it.
 */
export const PORTION_OUTLIER_FACTOR = 3;

export function portionLooksOdd(portionG: number, medianForUnit: number | null): string | null {
  if (!medianForUnit || !(portionG > 0)) return null;
  const ratio = portionG / medianForUnit;
  if (ratio > PORTION_OUTLIER_FACTOR) {
    return `${Math.round(portionG)} g of ingredients a portion, against about ${Math.round(medianForUnit)} g for others measured the same way`;
  }
  if (ratio < 1 / PORTION_OUTLIER_FACTOR) {
    return `only ${Math.round(portionG)} g of ingredients a portion, against about ${Math.round(medianForUnit)} g for others measured the same way`;
  }
  return null;
}

/** The middle portion weight for each serving unit — "bowl", "plate", "piece". */
export function portionMedians(
  dishes: { serving_label: string | null; portion_g: number | null }[],
): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const d of dishes) {
    const unit = servingUnit(d.serving_label);
    if (!unit || !d.portion_g || d.portion_g <= 0) continue;
    (by.get(unit) ?? by.set(unit, []).get(unit)!).push(d.portion_g);
  }
  const out = new Map<string, number>();
  for (const [unit, vals] of by) {
    // Too few to have a middle worth comparing against.
    if (vals.length < 5) continue;
    vals.sort((a, b) => a - b);
    out.set(unit, vals[Math.floor(vals.length / 2)]);
  }
  return out;
}

/** "1 bowl" and "2 bowls" are the same unit for this purpose. */
export function servingUnit(label: string | null): string | null {
  const u = (label ?? "").toLowerCase().replace(/^[\d.\s]+/, "").trim().replace(/s$/, "");
  return u || null;
}

/**
 * Everything mechanically wrong with one serving's figures, or null.
 *
 * One place, so the server and the library screen cannot drift apart, and so a
 * recipe the dietitian writes herself is held to the same tests as an imported
 * one. Returns the FIRST problem: they nearly always share a cause, and four
 * sentences about one bad servings count is noise.
 *
 * Says nothing about whether a dish suits a particular client. That is not a
 * question arithmetic can answer.
 */
export function servingProblem(n: Nutrients): string | null {
  if (n.kcal > IMPLAUSIBLE_SERVING_KCAL) {
    return `${Math.round(n.kcal)} kcal is more than a person eats at a sitting`;
  }
  if (n.fat_g > IMPLAUSIBLE_FAT_G) {
    return `${r1(n.fat_g)} g of fat in one serving is more than any dish plausibly holds`;
  }
  if (n.protein_g > IMPLAUSIBLE_PROTEIN_G) {
    return `${r1(n.protein_g)} g of protein in one serving is more than any dish plausibly holds`;
  }
  if (energyLooksWrong(n)) {
    const est = Math.round(4 * n.protein_g + 4 * n.carb_g + 9 * n.fat_g + 2 * n.fibre_g);
    return `the calories do not match the macros — ${Math.round(n.kcal)} stated against ${est} from the carbohydrate, protein and fat`;
  }
  return null;
}

/**
 * Does the energy on a row agree with its own macros?
 *
 * Atwater: 4 kcal per gram of protein and carbohydrate, 9 for fat, 2 for fibre.
 * It is a cross-check, not a source — IFCT measures energy directly and the two
 * differ a little by design. What it catches is a figure that cannot be right
 * at all: 600 kcal against 10 g of food, or a decimal point in the wrong place.
 *
 * The tolerance is generous for the same reason. On a 20 kcal vegetable a 25%
 * band is 5 kcal, which is noise; the floor stops that being reported.
 */
export const ATWATER_TOLERANCE = 0.25;
export const ATWATER_FLOOR_KCAL = 15;

export function energyLooksWrong(n: Nutrients): boolean {
  const est = 4 * n.protein_g + 4 * n.carb_g + 9 * n.fat_g + 2 * n.fibre_g;
  const gap = Math.abs(est - n.kcal);
  if (gap <= ATWATER_FLOOR_KCAL) return false;
  return gap / Math.max(n.kcal, 1) > ATWATER_TOLERANCE;
}

/* -------------------------------------------------------------------------
   READING A RECIPE ONE PORTION AT A TIME

   A recipe is stored as what goes into the whole pot: 282 g of potato making
   three paranthas. A dietitian deciding what to put on a client's chart is
   thinking about one parantha. These convert between the two.

   The conversion is deliberately not applied to the stored data. The recipe
   remains what the recipe is, and only the screen divides — because dividing
   and multiplying back through a rounded display is how 282 quietly becomes
   279 after somebody opens a dish and closes it again.
   ------------------------------------------------------------------------- */

/**
 * What one portion of an ingredient weighs, given a recipe that makes several.
 *
 * Returns null rather than the whole weight where the servings count is
 * missing or nonsensical. A screen that showed the pot's worth of rice labelled
 * "one portion" would be worse than a screen that admits it does not know.
 */
export function perPortion(wholeRecipeG: number, servings: number | null): number | null {
  if (servings == null || !Number.isFinite(servings) || servings <= 0) return null;
  if (!Number.isFinite(wholeRecipeG)) return null;
  return wholeRecipeG / servings;
}

/**
 * The reverse, for saving an amount somebody typed as one portion.
 *
 * Rounded to 0.1 g, which is the precision the food table itself carries and
 * finer than any kitchen scale in the building.
 */
export function wholeRecipe(portionG: number, servings: number | null): number | null {
  if (servings == null || !Number.isFinite(servings) || servings <= 0) return null;
  if (!Number.isFinite(portionG) || portionG < 0) return null;
  return Math.round(portionG * servings * 10) / 10;
}

/**
 * What share of a dish's energy each macro carries.
 *
 * The percentages come from the macros through Atwater — 4 kcal a gram for
 * protein and carbohydrate, 9 for fat — and NOT from dividing by the stated
 * calories. Those two disagree slightly by design, because IFCT measures energy
 * directly, and dividing by the stated figure gives three percentages that do
 * not add to a hundred. Whatever a reader thinks of a pie chart, one that fails
 * to close is a bug they will report.
 *
 * Fibre is left out of the split. It carries a little energy and the brief asks
 * for it, but a fourth slice on an energy chart implies it competes with the
 * other three for a place in the diet, which is not how anyone plans a meal.
 * It is reported in grams alongside.
 *
 * Returns null for a dish with no energy in it at all — a cup of black tea has
 * no macro split, and 0/0 rendered as "33% fat" would be an invention.
 */
export type EnergySplit = { protein: number; carb: number; fat: number };

export const KCAL_PER_G = { protein: 4, carb: 4, fat: 9 } as const;

export function energySplit(n: Nutrients): EnergySplit | null {
  const p = KCAL_PER_G.protein * n.protein_g;
  const c = KCAL_PER_G.carb * n.carb_g;
  const f = KCAL_PER_G.fat * n.fat_g;
  const total = p + c + f;
  if (!(total > 0)) return null;
  // Rounded so the three always add to 100: the two smaller shares are rounded
  // normally and the largest takes the remainder. Three independent roundings
  // give 33/33/33 and a reader who can add up.
  const pct = { protein: (100 * p) / total, carb: (100 * c) / total, fat: (100 * f) / total };
  const keys = (Object.keys(pct) as (keyof EnergySplit)[]).sort((a, b) => pct[a] - pct[b]);
  const out = { protein: 0, carb: 0, fat: 0 } as EnergySplit;
  let used = 0;
  for (const k of keys.slice(0, 2)) { out[k] = Math.round(pct[k]); used += out[k]; }
  out[keys[2]] = 100 - used;
  return out;
}

/* -------------------------------------------------------------------------
   UNITS

   A gram is a gram. A cup is not a cup.

   Mass converts on a fixed factor and always has: an ounce is 28.3495 g
   whatever is in the pan. Volume does not. A cup of puffed rice weighs 30 g, a
   cup of atta 130 g, a cup of bengal gram dal 200 g — nearly seven times the
   first. "A cup in grams" is not a quantity that exists; only a cup OF
   something is.

   So the two kinds are kept apart here. Mass units convert with no knowledge of
   the food. Everything else needs a row in `food_measures` for that particular
   food, and where there is none the answer is that we cannot say — not a
   plausible number with nothing behind it.
   ------------------------------------------------------------------------- */

/** Grams per unit of mass. Exact, by definition — an ounce IS 28.349523125 g. */
export const MASS_UNITS = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
} as const;

export type MassUnit = keyof typeof MASS_UNITS;

/** Units that mean nothing without knowing which food is being measured. */
export const FOOD_UNITS = [
  "ml", "L", "tsp", "tbsp", "cup",
  "piece", "slice", "medium", "small", "clove", "cube", "handful",
] as const;

export type FoodUnit = (typeof FOOD_UNITS)[number];
export type Unit = MassUnit | FoodUnit;

export const isMassUnit = (u: string): u is MassUnit => u in MASS_UNITS;

/**
 * A weight for one unit of a particular food, as `food_measures` holds it.
 *
 * `source` is a citation or the name of whoever measured it, and is never
 * blank — the screen shows it, so that a figure a dietitian took with her own
 * scales can be told apart from one USDA published.
 */
export type Measure = { unit: string; grams: number; source: string; set_by: string | null };

export type Conversion =
  | { ok: true; grams: number; how: string }
  | { ok: false; why: string };

/**
 * Turn an amount in some unit into grams.
 *
 * `measures` are the rows held for THIS food. A litre is a thousand millilitres
 * of the same substance, so a millilitre weight answers for both; nothing else
 * is derived, because a tablespoon is three teaspoons of volume but a heaped
 * spoon of flour and three level ones are not the same weight and the tables
 * that publish both do not always agree.
 */
export function toGrams(amount: number, unit: string, measures: Measure[]): Conversion {
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, why: "that is not an amount" };

  if (isMassUnit(unit)) {
    return { ok: true, grams: amount * MASS_UNITS[unit], how: unit === "g" ? "" : `${MASS_UNITS[unit]} g per ${unit}` };
  }

  const direct = measures.find((m) => m.unit === unit);
  if (direct) {
    return { ok: true, grams: amount * direct.grams, how: `1 ${unit} = ${direct.grams} g (${direct.set_by ? `set by ${direct.set_by}` : direct.source})` };
  }

  // A litre is a thousand millilitres of the same thing. Arithmetic on the same
  // measurement, not a second one.
  if (unit === "L") {
    const ml = measures.find((m) => m.unit === "ml");
    if (ml) return { ok: true, grams: amount * ml.grams * 1000, how: `1 ml = ${ml.grams} g (${ml.set_by ? `set by ${ml.set_by}` : ml.source})` };
  }
  if (unit === "ml") {
    const l = measures.find((m) => m.unit === "L");
    if (l) return { ok: true, grams: (amount * l.grams) / 1000, how: `1 L = ${l.grams} g (${l.set_by ? `set by ${l.set_by}` : l.source})` };
  }

  return { ok: false, why: `nobody has recorded what a ${unit} of this weighs` };
}

/** The reverse, for showing a stored gram weight in the unit she chose. */
export function fromGrams(grams: number, unit: string, measures: Measure[]): number | null {
  if (!Number.isFinite(grams)) return null;
  if (isMassUnit(unit)) return grams / MASS_UNITS[unit];
  const one = toGrams(1, unit, measures);
  return one.ok && one.grams > 0 ? grams / one.grams : null;
}

/** Which units this food can actually be measured in, mass first. */
export function unitsFor(measures: Measure[]): Unit[] {
  const mass = Object.keys(MASS_UNITS) as MassUnit[];
  const have = new Set(measures.map((m) => m.unit));
  if (have.has("ml")) have.add("L");
  if (have.has("L")) have.add("ml");
  return [...mass, ...FOOD_UNITS.filter((u) => have.has(u))];
}
