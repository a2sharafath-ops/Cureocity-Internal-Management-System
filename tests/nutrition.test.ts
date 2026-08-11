import { describe, it, expect } from "vitest";
import {
  nutrientsOf, dishNutrients, portionOf, energyLooksWrong, roundNutrients,
  servingLooksTooBig, contradictsSource, suggestServings,
  portionMedians, portionLooksOdd, perPortion, wholeRecipe, energySplit,
  toGrams, fromGrams, unitsFor, type Measure,
  type Food, type Dish,
} from "@/lib/nutrition";

describe("a serving nobody eats at a sitting", () => {
  it("passes an ordinary chart option", () => {
    expect(servingLooksTooBig(210)).toBe(false);   // puttu
    expect(servingLooksTooBig(480)).toBe(false);   // a full breakfast option
    expect(servingLooksTooBig(1200)).toBe(false);  // the line itself
  });

  it("catches a whole pot recorded as one serving", () => {
    // INDB publishes these, and our own sums agree with them, so the
    // disagreement check is silent. Only an absolute reading finds them.
    expect(servingLooksTooBig(4563)).toBe(true);   // cabbage kofta curry, "1 bowl"
    expect(servingLooksTooBig(4703)).toBe(true);   // paneer kofta curry, "1 bowl"
    expect(servingLooksTooBig(4908)).toBe(true);   // spaghetti and cheese balls, "1 plate"
  });

  it("is a different question from whether two sources agree", () => {
    // 4,212 computed against 4,563 published is agreement — within 25% — and
    // both are absurd. That is exactly the case the relative check misses.
    expect(contradictsSource(4212, 4563)).toBe(false);
    expect(servingLooksTooBig(4212)).toBe(true);
  });
});
// Real IFCT 2017 values, per 100 g edible portion.
const RICE: Food = { food_code: "B023", name: "Rice, raw, milled", protein_g: 7.94, fat_g: 0.52, carb_g: 78.24, fibre_g: 2.81, kcal: 356 };
const COCONUT: Food = { food_code: "H012", name: "Coconut, kernel, fresh", protein_g: 3.84, fat_g: 41.38, carb_g: 6.3, fibre_g: 11.5, kcal: 409 };
const CHICKEN: Food = { food_code: "N002", name: "Chicken, breast", protein_g: 21.8, fat_g: 2.1, carb_g: null, fibre_g: null, kcal: 111 };
const foods = new Map([RICE, COCONUT, CHICKEN].map((f) => [f.food_code, f]));

describe("nutrientsOf", () => {
  it("scales a food to the weight actually used", () => {
    const n = roundNutrients(nutrientsOf(RICE, 50));
    expect(n.kcal).toBe(178);
    expect(n.protein_g).toBe(4);
    expect(n.carb_g).toBe(39.1);
  });

  it("treats an absent nutrient as zero, not as unknown", () => {
    // Chicken has no carbohydrate and no fibre. IFCT leaves those blank because
    // there is none — if that became NaN it would poison every total it touched.
    const n = nutrientsOf(CHICKEN, 100);
    expect(n.carb_g).toBe(0);
    expect(n.fibre_g).toBe(0);
    expect(Number.isFinite(n.kcal)).toBe(true);
  });

  it("gives nothing for nothing", () => {
    expect(roundNutrients(nutrientsOf(RICE, 0))).toEqual({ kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0 });
  });
});

describe("dishNutrients", () => {
  const puttu: Dish = {
    name: "Puttu", cooked_g: 300, servings: 2,
    items: [
      { food_code: "B023", name: "Rice flour", raw_g: 100 },
      { food_code: "H012", name: "Grated coconut", raw_g: 20 },
    ],
  };

  it("prices a dish from its ingredients", () => {
    const v = dishNutrients(puttu, foods);
    expect(v.priced).toBe(true);
    if (!v.priced) return;
    // 100g rice (356) + 20g coconut (81.8) = 437.8 for the whole dish
    expect(v.whole.kcal).toBe(438);
    expect(v.perServing.kcal).toBe(219);
    expect(v.perServing.protein_g).toBe(4.4);
  });

  it("refuses when an ingredient is not in the food table", () => {
    // The reason this refuses rather than estimates: a guess presented to one
    // decimal place is worse than no answer.
    const v = dishNutrients({ ...puttu, items: [...puttu.items, { food_code: null, name: "Jaggery", raw_g: 10 }] }, foods);
    expect(v.priced).toBe(false);
    if (v.priced) return;
    expect(v.reason).toMatch(/not matched/);
    expect(v.reason).toMatch(/Jaggery/);
  });

  it("refuses when the servings were never recorded", () => {
    const v = dishNutrients({ ...puttu, servings: null }, foods);
    expect(v.priced).toBe(false);
    if (!v.priced) expect(v.reason).toMatch(/servings/);
  });

  it("refuses an ingredient with no weight", () => {
    const v = dishNutrients({ ...puttu, items: [{ food_code: "B023", name: "Rice flour", raw_g: 0 }] }, foods);
    expect(v.priced).toBe(false);
    if (!v.priced) expect(v.reason).toMatch(/no weight/);
  });

  it("refuses an empty recipe", () => {
    expect(dishNutrients({ ...puttu, items: [] }, foods).priced).toBe(false);
  });

  it("does not model cooking loss — water changes the weight, not the energy", () => {
    // Rice triples in weight when boiled. The energy is the energy of the rice
    // that went in, whatever the finished dish weighs.
    const dry = dishNutrients({ ...puttu, cooked_g: 300 }, foods);
    const wet = dishNutrients({ ...puttu, cooked_g: 900 }, foods);
    expect(dry).toEqual(wet);
  });
});

describe("portionOf", () => {
  const serving = { kcal: 220, protein_g: 4.4, fat_g: 8.5, carb_g: 39.7, fibre_g: 2.6 };

  it("scales a half portion", () => {
    expect(portionOf(serving, 0.5).kcal).toBe(110);
  });

  it("scales two portions", () => {
    expect(portionOf(serving, 2).protein_g).toBe(8.8);
  });
});

describe("energyLooksWrong", () => {
  it("passes a row whose macros explain its calories", () => {
    expect(energyLooksWrong({ kcal: 356, protein_g: 7.94, fat_g: 0.52, carb_g: 78.24, fibre_g: 2.81 })).toBe(false);
  });

  it("catches a decimal point in the wrong place", () => {
    expect(energyLooksWrong({ kcal: 3560, protein_g: 7.94, fat_g: 0.52, carb_g: 78.24, fibre_g: 2.81 })).toBe(true);
  });

  it("catches calories that no amount of food could contain", () => {
    expect(energyLooksWrong({ kcal: 600, protein_g: 1, fat_g: 1, carb_g: 2, fibre_g: 0 })).toBe(true);
  });

  it("stays quiet on small numbers, where a few calories is not a discrepancy", () => {
    // A 20 kcal vegetable: 25% is 5 kcal, which is measurement noise.
    expect(energyLooksWrong({ kcal: 17, protein_g: 0.6, fat_g: 0.1, carb_g: 3.4, fibre_g: 1.9 })).toBe(false);
  });
});

describe("suggesting a servings count", () => {
  it("suggests portions for a recipe recorded as one huge serving", () => {
    expect(suggestServings(4653)).toBe(12);   // bread pakora, "1 plate"
    expect(suggestServings(2368)).toBe(6);    // peanut cutlet
  });

  it("says nothing about a recipe that is already a sensible size", () => {
    // No suggestion beats a needless one: a 210 kcal puttu does not want
    // dividing, and offering "1" would be noise on every clean row.
    expect(suggestServings(210)).toBeNull();
    expect(suggestServings(480)).toBeNull();
    expect(suggestServings(0)).toBeNull();
  });

  it("is a suggestion, not a measurement — it only ever divides the total", () => {
    // Whatever it returns, dividing by it must land near a real portion.
    for (const total of [1600, 2400, 3200, 4800]) {
      const n = suggestServings(total)!;
      expect(total / n).toBeGreaterThan(250);
      expect(total / n).toBeLessThan(600);
    }
  });
});

describe("portion weight against the library's own distribution", () => {
  const lib = [
    { serving_label: "1 bowl", portion_g: 240 }, { serving_label: "1 bowl", portion_g: 259 },
    { serving_label: "1 bowl", portion_g: 270 }, { serving_label: "2 bowls", portion_g: 250 },
    { serving_label: "1 bowl", portion_g: 280 }, { serving_label: "1 plate", portion_g: 359 },
  ];

  it("takes the middle of each unit, and treats bowl and bowls alike", () => {
    const m = portionMedians(lib);
    expect(m.get("bowl")).toBe(259);
  });

  it("says nothing about a unit with too few examples to have a middle", () => {
    // One plate is not a distribution. Comparing against it would be arithmetic
    // dressed up as evidence.
    expect(portionMedians(lib).has("plate")).toBe(false);
  });

  it("flags a portion far from its neighbours, in either direction", () => {
    expect(portionLooksOdd(976, 259)).toMatch(/against about 259 g/);
    expect(portionLooksOdd(45, 259)).toMatch(/^only 45 g/);
  });

  it("leaves ordinary variation alone — food is not uniform", () => {
    // A bowl of biryani really is heavier than a bowl of rasam, and a check
    // that fires on half the library teaches people to ignore it.
    expect(portionLooksOdd(500, 259)).toBeNull();
    expect(portionLooksOdd(120, 259)).toBeNull();
  });

  it("says nothing without a reference to compare against", () => {
    expect(portionLooksOdd(976, null)).toBeNull();
  });
});

describe("reading a recipe one portion at a time", () => {
  it("divides the pot by what it makes", () => {
    expect(perPortion(282, 3)).toBeCloseTo(94, 5);
    expect(perPortion(120, 1)).toBe(120);
  });

  it("admits it does not know, rather than showing the pot as a portion", () => {
    // A recipe with no servings count would otherwise label 282 g of potato
    // "one parantha", which is four times what anyone eats.
    expect(perPortion(282, null)).toBeNull();
    expect(perPortion(282, 0)).toBeNull();
    expect(perPortion(282, -2)).toBeNull();
  });

  it("multiplies back, to 0.1 g", () => {
    expect(wholeRecipe(94, 3)).toBe(282);
    expect(wholeRecipe(33.333, 3)).toBe(100);
  });

  it("survives a round trip without drifting", () => {
    // The whole reason the conversion is display-only: open a dish, save it
    // unchanged, and every weight must be exactly what it was.
    for (const [g, s] of [[282, 3], [100, 7], [1, 3], [4.5, 2], [1000, 6]] as const) {
      expect(wholeRecipe(perPortion(g, s)!, s)).toBeCloseTo(g, 1);
    }
  });

  it("refuses a negative weight", () => {
    expect(wholeRecipe(-5, 2)).toBeNull();
  });
});

describe("the energy split", () => {
  const n = { kcal: 384, protein_g: 40.9, carb_g: 18.1, fat_g: 17.3, fibre_g: 4.2 };

  it("splits a dish by where its energy comes from", () => {
    const s = energySplit(n)!;
    expect(s.protein).toBe(42);
    // 17.3 g of fat against 18.1 g of carbohydrate, and the fat carries more
    // than twice the energy — 9 kcal a gram against 4.
    expect(s.fat).toBe(40);
    expect(s.carb).toBe(18);
  });

  it("always adds to a hundred", () => {
    // Three independent roundings give 33/33/33, and a reader who can add up
    // reports it as a bug. The largest share takes the remainder instead.
    for (const d of [
      { kcal: 100, protein_g: 3.33, carb_g: 3.33, fat_g: 1.48, fibre_g: 0 },
      { kcal: 210, protein_g: 4.4, carb_g: 39.7, fat_g: 8.5, fibre_g: 2.6 },
      { kcal: 899, protein_g: 0, carb_g: 0, fat_g: 99.9, fibre_g: 0 },
      { kcal: 17, protein_g: 0.6, carb_g: 3.4, fat_g: 0.1, fibre_g: 1.9 },
    ]) {
      const s = energySplit(d)!;
      expect(s.protein + s.carb + s.fat).toBe(100);
    }
  });

  it("comes from the macros, not from the stated calories", () => {
    // IFCT measures energy directly, so the stated figure and the Atwater sum
    // differ slightly. Dividing by the stated figure would give three shares
    // that do not close.
    const s = energySplit({ kcal: 1, protein_g: 10, carb_g: 10, fat_g: 0, fibre_g: 0 })!;
    expect(s.protein).toBe(50);
    expect(s.carb).toBe(50);
  });

  it("says nothing about a dish with no energy in it", () => {
    // Black tea. "33% fat" would be an invention, and this screen exists to
    // stop exactly that.
    expect(energySplit({ kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fibre_g: 0 })).toBeNull();
  });
});

describe("units", () => {
  const atta: Measure[] = [{ unit: "cup", grams: 130, source: "INDB Units.xlsx — BFP manual", set_by: null }];
  const milk: Measure[] = [{ unit: "ml", grams: 1.03, source: "published density", set_by: null }];
  const hers: Measure[] = [{ unit: "cup", grams: 150, source: "weighed in the clinic", set_by: "Afya" }];
  const none: Measure[] = [];

  it("converts mass without caring what the food is", () => {
    expect(toGrams(1, "oz", none)).toEqual({ ok: true, grams: 28.349523125, how: "28.349523125 g per oz" });
    expect(toGrams(2, "kg", none)).toMatchObject({ ok: true, grams: 2000 });
    expect(toGrams(1, "lb", none)).toMatchObject({ ok: true, grams: 453.59237 });
    expect(toGrams(75, "g", none)).toMatchObject({ ok: true, grams: 75 });
  });

  it("converts a cup only for a food somebody has weighed", () => {
    expect(toGrams(2, "cup", atta)).toMatchObject({ ok: true, grams: 260 });
  });

  it("refuses a cup of something nobody has weighed", () => {
    // The whole point. A cup of flour taken as 240 g would be nearly double,
    // and a chart built on it would look exactly as confident as a correct one.
    const r = toGrams(1, "cup", none);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toMatch(/nobody has recorded/);
  });

  it("says where the figure came from, and names her when it is hers", () => {
    const a = toGrams(1, "cup", atta);
    if (a.ok) expect(a.how).toMatch(/BFP manual/);
    const b = toGrams(1, "cup", hers);
    if (b.ok) expect(b.how).toMatch(/set by Afya/);
  });

  it("reads a litre off a millilitre, because that is the same measurement", () => {
    expect(toGrams(1, "L", milk)).toMatchObject({ ok: true, grams: 1030 });
    expect(toGrams(250, "ml", milk)).toMatchObject({ ok: true, grams: 257.5 });
  });

  it("does not derive a tablespoon from a teaspoon", () => {
    // Three level teaspoons and one heaped tablespoon of flour are not the same
    // weight, and the tables that publish both do not always agree. If nobody
    // measured the tablespoon, we have not got one.
    const tsp: Measure[] = [{ unit: "tsp", grams: 2.5, source: "USDA", set_by: null }];
    expect(toGrams(1, "tbsp", tsp).ok).toBe(false);
  });

  it("converts back for display", () => {
    expect(fromGrams(260, "cup", atta)).toBe(2);
    expect(fromGrams(28.349523125, "oz", none)).toBeCloseTo(1, 9);
    expect(fromGrams(100, "cup", none)).toBeNull();
  });

  it("offers mass for anything, and a cup only where there is one", () => {
    expect(unitsFor(none)).toEqual(["g", "kg", "oz", "lb"]);
    expect(unitsFor(atta)).toContain("cup");
    expect(unitsFor(none)).not.toContain("cup");
    // A millilitre weight answers for litres too.
    expect(unitsFor(milk)).toEqual(expect.arrayContaining(["ml", "L"]));
  });

  it("refuses a negative amount", () => {
    expect(toGrams(-1, "g", none).ok).toBe(false);
  });
});
