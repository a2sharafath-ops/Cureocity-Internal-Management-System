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
