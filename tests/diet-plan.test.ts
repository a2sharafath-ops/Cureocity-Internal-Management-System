import { describe, it, expect } from "vitest";
import { planTotals, targetCheck, planProblems, parseNotes, mealHeading, resequence, optionNutrients, DEFAULT_MEALS, HOW_TO_USE, type PlanMeal, type PlanOption, type DishOption } from "@/lib/diet-plan";

const opt = (seq: number, kcal: number, protein: number, items = `Option ${seq + 1}`) =>
  ({ seq, food_items: items, qty: "1 cup", kcal, protein_g: protein, micronutrients: null, components: [] });

const meal = (name: string, opts: ReturnType<typeof opt>[], conditional = false): PlanMeal =>
  ({ seq: 0, name, time_from: null, time_to: null, note: null, conditional, options: opts });

describe("mealHeading", () => {
  it("prints the time window the way the sheet does", () => {
    expect(mealHeading({ name: "Breakfast", time_from: "9:30 am", time_to: "10:00 am" }))
      .toBe("Breakfast (9:30–10:00 am)");
  });
  it("keeps both meridiems when they differ", () => {
    expect(mealHeading({ name: "Lunch", time_from: "11:30 am", time_to: "1:00 pm" }))
      .toBe("Lunch (11:30 am–1:00 pm)");
  });
  it("omits the window when there is none", () => {
    expect(mealHeading({ name: "Travel-delay backup", time_from: null, time_to: null }))
      .toBe("Travel-delay backup");
  });
});

describe("planTotals", () => {
  it("gives the lightest and heaviest way to eat the day", () => {
    const meals = [
      meal("Breakfast", [opt(0, 455, 23), opt(1, 425, 22), opt(2, 445, 23)]),
      meal("Lunch", [opt(0, 520, 31), opt(1, 545, 36), opt(2, 570, 31)]),
    ];
    const t = planTotals(meals);
    expect(t.minKcal).toBe(425 + 520);
    expect(t.maxKcal).toBe(455 + 570);
    expect(t.minProtein).toBe(22 + 31);
    expect(t.maxProtein).toBe(23 + 36);
  });

  it("excludes a conditional slot — it replaces a meal, it isn't extra", () => {
    const meals = [
      meal("Lunch", [opt(0, 500, 30)]),
      meal("Travel-delay backup", [opt(0, 300, 20)], true),
    ];
    expect(planTotals(meals).maxKcal).toBe(500);
  });

  it("names any slot with nothing to eat", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)]), meal("Dinner", [])];
    expect(planTotals(meals).slotsWithoutOptions).toEqual(["Dinner"]);
  });

  it("ignores a blank option row rather than counting it as zero", () => {
    const blank = { seq: 1, food_items: "   ", qty: null, kcal: null, protein_g: null, micronutrients: null, components: [] };
    const meals = [meal("Breakfast", [opt(0, 400, 20), blank])];
    expect(planTotals(meals).minKcal).toBe(400);
  });
});

describe("targetCheck", () => {
  const T = (min: number, max: number) => ({ minKcal: min, maxKcal: max });

  it("passes when every combination is within ±10%", () => {
    expect(targetCheck(T(1750, 1850), 1800).tone).toBe("ok");
  });
  it("warns when the whole plan undershoots", () => {
    const r = targetCheck(T(1200, 1400), 1800);
    expect(r.tone).toBe("warn");
    expect(r.text).toMatch(/under/);
  });
  it("warns when the whole plan overshoots", () => {
    expect(targetCheck(T(2200, 2400), 1800).text).toMatch(/over/);
  });
  it("warns when the spread straddles the band", () => {
    expect(targetCheck(T(1500, 2100), 1800).text).toMatch(/range/);
  });
  it("says nothing without a target or without options", () => {
    expect(targetCheck(T(1750, 1850), null).tone).toBe("none");
    expect(targetCheck(T(0, 0), 1800).tone).toBe("none");
  });
});

describe("planProblems", () => {
  const targets = { kcal: 1800, protein: "90 g", carbohydrate: "200 g", fats: "60 g", fibre: "25 g", water: "3 ltr" };

  it("blocks a plan with an empty meal slot", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)]), meal("Dinner", [])];
    expect(planProblems(meals, targets).some((p) => /Dinner/.test(p))).toBe(true);
  });

  it("blocks an option with no quantity", () => {
    const noQty = { seq: 0, food_items: "Rice and curry", qty: "", kcal: 500, protein_g: 20, micronutrients: null, components: [] };
    expect(planProblems([meal("Lunch", [noQty])], targets).some((p) => /quantity/.test(p))).toBe(true);
  });

  it("blocks a plan with no calorie target", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)])];
    expect(planProblems(meals, { ...targets, kcal: null }).some((p) => /calorie target/.test(p))).toBe(true);
  });

  it("passes a complete plan", () => {
    // "Complete" now means every column the issued document prints is filled —
    // micronutrients included — and the day lands on its target. The clinic's
    // rule is that nothing goes to a client with a blank or a mismatch in it.
    const full = (seq: number, kcal: number, protein: number) =>
      ({ seq, food_items: `Option ${seq + 1}`, qty: "1 cup", kcal, protein_g: protein, micronutrients: "Iron, folate", components: [] });
    const meals = [meal("Breakfast", [full(0, 450, 20)]), meal("Lunch", [full(0, 450, 30)])];
    expect(planProblems(meals, { ...targets, kcal: 900 })).toEqual([]);
  });
});

describe("an option built from recipes", () => {
  const puttu: DishOption = {
    id: "d1", name: "Puttu", serving_label: null,
    perServing: { kcal: 210, protein_g: 4.6 }, reason: null,
  };
  const kadala: DishOption = {
    id: "d2", name: "Kadala curry", serving_label: null,
    perServing: { kcal: 118, protein_g: 6.2 }, reason: null,
  };
  const unpriced: DishOption = {
    id: "d3", name: "Egg roast", serving_label: null,
    perServing: null, reason: "2 ingredients not matched to the food table (coconut, shallot)",
  };
  const library = new Map([puttu, kadala, unpriced].map((d) => [d.id, d] as const));
  const targets = { kcal: 1900, protein: "100 g", carbohydrate: "220 g", fats: "60 g", fibre: "25 g", water: "3 ltr" };

  const part = (dish_id: string, servings = 1, seq = 0) => ({ seq, dish_id, servings });
  /** Puttu + half a kadala curry: 210 + 59 = 269 kcal, 4.6 + 3.1 = 7.7 g. */
  const built = (over: Partial<PlanOption> = {}): PlanOption => ({
    seq: 0, food_items: "Puttu with kadala curry", qty: "1 piece + ½ cup",
    kcal: 269, protein_g: 7.7, micronutrients: "Iron, folate",
    components: [part("d1", 1, 0), part("d2", 0.5, 1)], ...over,
  });
  const meal = (options: PlanOption[]): PlanMeal =>
    ({ seq: 0, name: "Breakfast", time_from: null, time_to: null, note: null, conditional: false, options });

  describe("optionNutrients", () => {
    it("adds the recipes up", () => {
      expect(optionNutrients([part("d1"), part("d2", 0.5, 1)], library)).toEqual({ kcal: 269, protein_g: 7.7 });
    });
    it("gives one recipe on its own as the recipe has it", () => {
      expect(optionNutrients([part("d1")], library)).toEqual({ kcal: 210, protein_g: 4.6 });
    });
    it("rounds once at the end, not per item", () => {
      // Three thirds of a puttu is a whole puttu. Rounding each component
      // first would make it 210.09 → 210 by luck, or 209 by bad luck.
      expect(optionNutrients([part("d1", 1 / 3, 0), part("d1", 1 / 3, 1), part("d1", 1 / 3, 2)], library))
        .toEqual({ kcal: 210, protein_g: 4.6 });
    });
    it("gives nothing at all when one item cannot be priced", () => {
      // Not a partial total: a breakfast missing its egg roast is not a
      // lighter breakfast, it is a wrong number.
      expect(optionNutrients([part("d1"), part("d3", 1, 1)], library)).toBeNull();
    });
    it("gives nothing for an unknown recipe or a portion of nothing", () => {
      expect(optionNutrients([part("gone")], library)).toBeNull();
      expect(optionNutrients([part("d1", 0)], library)).toBeNull();
      expect(optionNutrients([part("d1", -1)], library)).toBeNull();
    });
    it("says nothing about an option with no recipes — that is free text", () => {
      expect(optionNutrients([], library)).toBeNull();
    });
  });

  describe("planProblems", () => {
    it("names the recipe, not the empty box, when one cannot be priced", () => {
      const m = [meal([built({ components: [part("d1"), part("d3", 1, 1)], kcal: null, protein_g: null })])];
      const out = planProblems(m, targets, [puttu, kadala, unpriced]);
      expect(out.some((p) => /Egg roast/.test(p) && /not matched/.test(p))).toBe(true);
      // The generic message would send her to a box she cannot type in.
      expect(out.some((p) => /has no calories/.test(p))).toBe(false);
    });

    it("catches a recipe that has since been deleted", () => {
      const m = [meal([built({ components: [part("gone")] })])];
      expect(planProblems(m, targets, [puttu, kadala]).some((p) => /no longer exists/.test(p))).toBe(true);
    });

    it("refuses a portion of nothing", () => {
      const m = [meal([built({ components: [part("d1", 0)] })])];
      expect(planProblems(m, targets, [puttu, kadala]).some((p) => /more than nothing/.test(p))).toBe(true);
    });

    it("reports one problem per option, not one per component", () => {
      // Four broken items on one row would otherwise bury every other meal.
      const m = [meal([built({ components: [part("d3", 1, 0), part("d3", 1, 1), part("d3", 1, 2)] })])];
      expect(planProblems(m, targets, [puttu, kadala, unpriced]).filter((p) => /Egg roast/.test(p))).toHaveLength(1);
    });

    it("refuses a row whose figures no longer match its recipes", () => {
      // How a new version arrives: copied from a published chart, carrying the
      // numbers the recipes gave months ago. Nothing re-prices it until
      // someone saves, so without this it could be approved and sent as is.
      const m = [meal([built({ kcal: 240, protein_g: 7.1 })])];
      const out = planProblems(m, targets, [puttu, kadala]);
      expect(out.some((p) => /work out at 269 kcal today/.test(p))).toBe(true);
      expect(out.some((p) => /Press Save/.test(p))).toBe(true);
    });

    it("says nothing when the row already agrees with its recipes", () => {
      expect(planProblems([meal([built()])], targets, [puttu, kadala])
        .filter((p) => /work out at/.test(p))).toEqual([]);
    });

    it("still asks for micronutrients — no recipe supplies those", () => {
      const m = [meal([built({ micronutrients: "" })])];
      expect(planProblems(m, targets, [puttu, kadala]).some((p) => /no micronutrients/.test(p))).toBe(true);
    });

    it("says nothing about the recipes when no library was passed", () => {
      // The caller has no list to judge against; inventing "that recipe no
      // longer exists" would be worse than checking the row as it stands.
      const m = [meal([built({ components: [part("anything")] })])];
      expect(planProblems(m, targets).some((p) => /no longer exists/.test(p))).toBe(false);
    });
  });
});

describe("resequence", () => {
  it("renumbers after a delete so option numbers stay contiguous", () => {
    expect(resequence([{ seq: 0 }, { seq: 5 }, { seq: 9 }]).map((r) => r.seq)).toEqual([0, 1, 2]);
  });
});

describe("the clinic's defaults", () => {
  it("covers the day the issued plan describes", () => {
    const names = DEFAULT_MEALS.map((m) => m.name);
    expect(names).toContain("Upon waking");
    expect(names).toContain("Morning milk tea");
    expect(names).toContain("Breakfast");
    expect(names).toContain("Lunch");
    expect(names).toContain("Dinner / Post-workout meal");
  });
  it("marks only the travel backup conditional", () => {
    expect(DEFAULT_MEALS.filter((m) => m.conditional).map((m) => m.name)).toEqual(["Travel-delay backup"]);
  });
  it("carries all nine how-to-use points", () => {
    expect(HOW_TO_USE).toHaveLength(9);
  });
});

describe("parseNotes", () => {
  it("reads a colon-terminated short line as a heading", () => {
    const out = parseNotes("Build your hydration gradually :\nAim for 2.5–3 litres daily.");
    expect(out[0]).toEqual({ kind: "heading", text: "Build your hydration gradually" });
    expect(out[1].kind).toBe("text");
  });

  it("does not turn a long sentence ending in a colon into a heading", () => {
    const long = "This plan is flexible enough for days when you eat outside and you may find the following useful:";
    expect(parseNotes(long)[0].kind).toBe("text");
  });

  it("reads numbered steps and asterisk bullets as list items", () => {
    const out = parseNotes("1. One controlled carbohydrate portion\n* Drink 300–500 ml water before training.\n- Sip during");
    expect(out.map((l) => l.kind)).toEqual(["item", "item", "item"]);
    expect(out[0].text).toBe("One controlled carbohydrate portion");
    expect(out[1].text).toBe("Drink 300–500 ml water before training.");
  });

  it("keeps blank lines so paragraphs stay apart", () => {
    expect(parseNotes("A\n\nB").map((l) => l.kind)).toEqual(["text", "blank", "text"]);
  });

  it("returns nothing for empty notes", () => {
    expect(parseNotes(null)).toEqual([]);
    expect(parseNotes("   ")).toEqual([]);
  });
});

describe("planProblems — silent data loss", () => {
  const targets = { kcal: 1800, protein: "90 g", carbohydrate: "200 g", fats: "60 g", fibre: "25 g", water: "3 ltr" };
  it("refuses an option that has numbers but no food items", () => {
    const orphan = { seq: 0, food_items: "  ", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: null, components: [] };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: null, components: [] };
    const m: PlanMeal = { seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false, options: [orphan, good] };
    expect(planProblems([m], targets).some((p) => /no food items/.test(p))).toBe(true);
  });
  it("ignores a wholly empty row — that's just an unused slot in the grid", () => {
    const empty = { seq: 0, food_items: "", qty: "", kcal: null, protein_g: null, micronutrients: null, components: [] };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: "Iron", components: [] };
    const m: PlanMeal = { seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false, options: [empty, good] };
    // Nothing is reported against the blank row itself; the filled one is fine.
    expect(planProblems([m], { ...targets, kcal: 400 })).toEqual([]);
  });
});

describe("a chart cannot go out with blanks or mismatches", () => {
  // The clinic's rule, stated by the user: no warnings. Anything wrong, missing
  // or inconsistent blocks approval and blocks sending, and has to be resolved.
  const targets = { kcal: 1900, protein: "100-105 g", carbohydrate: "220-230 g", fats: "60-65 g", fibre: "20-30 g", water: "3 ltr" };
  const opt = (over: Partial<PlanOption> = {}): PlanOption => ({
    seq: 0, food_items: "Ragi puttu + kadala curry", qty: "1 medium piece + ½ cup",
    kcal: 440, protein_g: 26, micronutrients: "Calcium, iron, folate", components: [], ...over,
  });
  const meal = (options: PlanOption[]): PlanMeal =>
    ({ seq: 0, name: "Breakfast", time_from: null, time_to: null, note: null, conditional: false, options });
  // A day that adds up: four slots of ~475 kcal each against a 1900 target.
  const day = (over: PlanMeal[] = []): PlanMeal[] => over.length ? over : [0, 1, 2, 3].map((i) =>
    ({ ...meal([opt({ kcal: 475, protein_g: 25 })]), seq: i, name: `Meal ${i + 1}` }));

  it("passes a complete chart", () => {
    expect(planProblems(day(), targets)).toEqual([]);
  });

  it("refuses a missing calorie count", () => {
    const m = day(); m[0].options[0].kcal = null;
    expect(planProblems(m, targets).some((p) => /no calories/.test(p))).toBe(true);
  });

  it("refuses a missing protein figure", () => {
    const m = day(); m[0].options[0].protein_g = null;
    expect(planProblems(m, targets).some((p) => /no protein/.test(p))).toBe(true);
  });

  it("refuses a blank micronutrient column — it prints on the client's chart", () => {
    const m = day(); m[0].options[0].micronutrients = "  ";
    expect(planProblems(m, targets).some((p) => /no micronutrients/.test(p))).toBe(true);
  });

  it("refuses a nonsense value", () => {
    const m = day(); m[0].options[0].kcal = 0;
    expect(planProblems(m, targets).some((p) => /cannot be right/.test(p))).toBe(true);
  });

  it("refuses a header target left blank", () => {
    for (const key of ["protein", "carbohydrate", "fats", "fibre", "water"] as const) {
      const t = { ...targets, [key]: null };
      expect(planProblems(day(), t).length, key).toBeGreaterThan(0);
    }
  });

  it("refuses options in one meal that are not interchangeable", () => {
    // The clinic's own brief: options within a meal sit within ±40 kcal of each
    // other. 300 vs 600 means the day's total depends on the client's mood.
    const m = day();
    m[0] = { ...m[0], options: [opt({ seq: 0, kcal: 300 }), opt({ seq: 1, kcal: 600, food_items: "Idiyappam + stew" })] };
    expect(planProblems(m, targets).some((p) => /spread of 300/.test(p))).toBe(true);
  });

  it("accepts options that differ within the allowed spread", () => {
    const m = day();
    m[0] = { ...m[0], options: [opt({ seq: 0, kcal: 460 }), opt({ seq: 1, kcal: 490, food_items: "Idiyappam + stew" })] };
    expect(planProblems(m, targets).filter((p) => /spread/.test(p))).toEqual([]);
  });

  it("refuses a day that misses its own calorie target", () => {
    const m = day().map((x) => ({ ...x, options: [opt({ kcal: 200, protein_g: 10 })] }));
    expect(planProblems(m, targets).some((p) => /target/.test(p))).toBe(true);
  });

  it("ignores the conditional backup slot in the day's total", () => {
    // The travel-delay meal is eaten INSTEAD of another, not as well as.
    const m = [...day(), { ...meal([opt({ kcal: 500 })]), seq: 9, name: "Travel-delay backup", conditional: true }];
    expect(planProblems(m, targets)).toEqual([]);
  });

  it("still catches an empty meal slot", () => {
    const m = day(); m[1] = { ...m[1], options: [] };
    expect(planProblems(m, targets).some((p) => /nothing to eat/.test(p))).toBe(true);
  });
});
