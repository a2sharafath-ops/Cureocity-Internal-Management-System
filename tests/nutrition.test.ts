import { describe, it, expect } from "vitest";
import {
  nutrientsOf, dishNutrients, portionOf, energyLooksWrong, roundNutrients,
  type Food, type Dish,
} from "@/lib/nutrition";

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
