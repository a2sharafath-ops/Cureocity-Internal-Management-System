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
