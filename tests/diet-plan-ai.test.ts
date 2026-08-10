import { describe, it, expect } from "vitest";
import { parseGeneratedPlan, dishMenu, clientBrief, SYSTEM_PROMPT, type PlanContext } from "@/lib/diet-plan-ai";
import { type DishOption } from "@/lib/diet-plan";

const dish = (over: Partial<DishOption> & Pick<DishOption, "id" | "name">): DishOption => ({
  serving_label: null, basis: "computed", source: null, reason: null, approved: true,
  perServing: { kcal: 200, carb_g: 30, protein_g: 8, fat_g: 5, fibre_g: 3 },
  ...over,
});

const puttu = dish({ id: "d1", name: "Puttu" });
const kadala = dish({ id: "d2", name: "Kadala curry" });
const notApproved = dish({ id: "d3", name: "Appam", approved: false });
const unpriced = dish({ id: "d4", name: "Egg roast", perServing: null, basis: null, reason: "no weights" });
const library = [puttu, kadala, notApproved, unpriced];

const slot = (options: unknown[]) => ({
  name: "Breakfast", time_from: "9:30 am", time_to: "10:00 am", note: null, conditional: false, options,
});
const option = (over: Record<string, unknown> = {}) => ({
  food_items: "Puttu with kadala curry",
  qty: "1 piece + ½ cup",
  micronutrients: "Iron, folate",
  components: [{ dish_id: "d1", servings: 1 }, { dish_id: "d2", servings: 0.5 }],
  ...over,
});
const parse = (obj: unknown) => parseGeneratedPlan(JSON.stringify(obj), library);

describe("the prompt", () => {
  it("forbids the model from stating a figure, in as many words", () => {
    expect(SYSTEM_PROMPT).toMatch(/never state a calorie or a macronutrient figure/i);
  });

  it("carries the clinic's own rules, not generic dietetics", () => {
    expect(SYSTEM_PROMPT).toMatch(/EXACTLY 4 options/);
    expect(SYSTEM_PROMPT).toMatch(/40 kcal/);
    expect(SYSTEM_PROMPT).toMatch(/Kerala/);
    // The brief's one outright prohibition.
    expect(SYSTEM_PROMPT).toMatch(/ashwagandha/i);
    expect(SYSTEM_PROMPT).toMatch(/apple cider vinegar/i);
    // The clinical safety rule.
    expect(SYSTEM_PROMPT).toMatch(/thyroxine/i);
  });
});

describe("the recipe list the model is given", () => {
  it("offers only approved, priceable recipes", () => {
    const menu = dishMenu(library);
    expect(menu).toMatch(/Puttu/);
    expect(menu).toMatch(/Kadala curry/);
    expect(menu).not.toMatch(/Appam/);      // not approved
    expect(menu).not.toMatch(/Egg roast/);  // cannot be priced
  });

  it("carries per-serving figures so the model can balance a slot", () => {
    expect(dishMenu([puttu])).toMatch(/200 kcal, 30c 8p 5f 3fib per serving/);
  });

  it("honours the cap, so a huge library cannot run away with the bill", () => {
    const many = Array.from({ length: 50 }, (_, i) => dish({ id: `x${i}`, name: `Dish ${i}` }));
    expect(dishMenu(many, 10).split("\n")).toHaveLength(10);
  });
});

describe("what the client brief says", () => {
  const ctx: PlanContext = {
    name: "A. Client", age: 41, sex: "female", height_cm: 160, weight_kg: 68, bmi: 26.6,
    bmr: 1350, tdee: 1850, activity: "Lightly active",
    conditions: "Hypothyroidism", goals: "Fat loss",
    allergies: ["Peanuts (severe)"], medications: ["Thyroxine 50 mcg"],
    consultations: [{ role: "Doctor", kind: "Medical", on: "2026-08-01", text: "TSH elevated." }],
    reports: [{ label: "Lipid panel", on: "2026-07-20", summary: "LDL 140" }],
    vitals: null,
  };

  it("states the calorie target as already settled", () => {
    // The one number in the exercise, and it comes from the InBody and a
    // published multiplier — not from the model.
    expect(clientBrief(ctx)).toMatch(/1850 kcal — this figure is fixed and already calculated/);
  });

  it("puts allergies, medications and the write-ups in front of it", () => {
    const b = clientBrief(ctx);
    expect(b).toMatch(/Peanuts \(severe\)/);
    expect(b).toMatch(/Thyroxine/);
    expect(b).toMatch(/Doctor \(Medical, 2026-08-01\): TSH elevated\./);
    expect(b).toMatch(/Lipid panel .*LDL 140/);
  });
});

describe("parsing what comes back", () => {
  it("keeps a well-formed slot", () => {
    const r = parse({ meals: [slot([option(), option(), option(), option()])], notes: "Drink water." });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.meals).toHaveLength(1);
    expect(r.meals[0].options).toHaveLength(4);
    expect(r.meals[0].options[0].components).toEqual([
      { seq: 0, dish_id: "d1", servings: 1 },
      { seq: 1, dish_id: "d2", servings: 0.5 },
    ]);
    expect(r.notes).toBe("Drink water.");
    expect(r.dropped).toEqual([]);
  });

  it("ignores any figure the model volunteers", () => {
    // There is nowhere in the returned shape to put one, and if it invents a
    // field anyway it must not reach the chart. Everything is priced here.
    const r = parse({ meals: [slot([option({ kcal: 999, protein_g: 77 })])] });
    if ("error" in r) throw new Error(r.error);
    expect(Object.keys(r.meals[0].options[0])).toEqual(["food_items", "qty", "micronutrients", "components"]);
  });

  it("drops an option naming a recipe that is not in the library", () => {
    const r = parse({ meals: [slot([option(), option({ components: [{ dish_id: "nope", servings: 1 }] })])] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals[0].options).toHaveLength(1);
    expect(r.dropped.some((d) => /not in the approved library/.test(d))).toBe(true);
  });

  it("drops an option naming a recipe that exists but is not approved", () => {
    const r = parse({ meals: [slot([option(), option({ components: [{ dish_id: "d3", servings: 1 }] })])] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals[0].options).toHaveLength(1);
  });

  it("drops an option with no recipes at all — that is free text it invented", () => {
    const r = parse({ meals: [slot([option(), option({ components: [] })])] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals[0].options).toHaveLength(1);
  });

  it("leaves out a slot with nothing usable rather than saving an empty one", () => {
    // An empty slot blocks publishing, so it would only be work to delete.
    const r = parse({ meals: [slot([option()]), { ...slot([option({ components: [{ dish_id: "nope", servings: 1 }] })]), name: "Lunch" }] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals.map((m) => m.name)).toEqual(["Breakfast"]);
    expect(r.dropped.some((d) => /Lunch: no usable options/.test(d))).toBe(true);
  });

  it("says when a slot has fewer than the four the brief asks for", () => {
    const r = parse({ meals: [slot([option(), option()])] });
    if ("error" in r) throw new Error(r.error);
    expect(r.dropped.some((d) => /only 2 options/.test(d))).toBe(true);
  });

  it("treats a nonsense portion as one serving", () => {
    const r = parse({ meals: [slot([option({ components: [{ dish_id: "d1", servings: -3 }] })])] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals[0].options[0].components[0].servings).toBe(1);
  });

  it("carries the conditional flag through for the travel-delay slot", () => {
    const r = parse({ meals: [{ ...slot([option()]), name: "Travel-delay backup", conditional: true }] });
    if ("error" in r) throw new Error(r.error);
    expect(r.meals[0].conditional).toBe(true);
  });

  it("refuses unreadable or empty output rather than saving half a chart", () => {
    expect(parseGeneratedPlan("not json", library)).toEqual({ error: "The model did not return readable JSON." });
    expect(parse({ meals: [] })).toEqual({ error: "The model returned no meal slots." });
    const allBad = parse({ meals: [slot([option({ components: [{ dish_id: "nope", servings: 1 }] })])] });
    expect("error" in allBad).toBe(true);
  });
});
