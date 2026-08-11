import { describe, it, expect } from "vitest";
import { planTotals, targetCheck, planProblems, parseNotes, mealHeading, resequence, optionNutrients, optionMicronutrients, micronutrientLine, MACRO_LABELS,
  targetStepProblem, GENTLE_STEP_KCAL, DEFAULT_MEALS, HOW_TO_USE, parseTargetRange, formatTargetRange,
  type PlanMeal, type PlanOption, type DishOption } from "@/lib/diet-plan";
import { MICRONUTRIENTS, type MicroTotals } from "@/lib/nutrition";

const range = (min: number, max = min) => ({ min, max });

const opt = (seq: number, kcal: number, protein: number, items = `Option ${seq + 1}`) =>
  ({ seq, food_items: items, qty: "1 cup", kcal, carb_g: 40, protein_g: protein, fat_g: 10, fibre_g: 5, micronutrients: null, components: [] });

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
    const blank = { seq: 1, food_items: "   ", qty: null, kcal: null, carb_g: null, protein_g: null, fat_g: null, fibre_g: null, micronutrients: null, components: [] };
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

describe("numeric macro target ranges", () => {
  it("reads historical target text without changing old plans", () => {
    expect(parseTargetRange("90-95 g")).toEqual({ min: 90, max: 95 });
    expect(parseTargetRange("25 g/day")).toEqual({ min: 25, max: 25 });
    expect(parseTargetRange("90- g")).toEqual({ min: 90, max: null });
    expect(parseTargetRange("-95 g")).toEqual({ min: null, max: 95 });
    expect(parseTargetRange(null)).toEqual({ min: null, max: null });
  });

  it("serializes the structured range for the existing print columns", () => {
    expect(formatTargetRange(range(90, 95))).toBe("90-95 g");
    expect(formatTargetRange(range(25))).toBe("25 g");
    expect(formatTargetRange({ min: 90, max: null })).toBe("90- g");
    expect(formatTargetRange({ min: null, max: null })).toBeNull();
  });
});

describe("planProblems", () => {
  const targets = { kcal: 1800, protein: range(90), carbohydrate: range(200), fats: range(60), fibre: range(25), water: "3 ltr" };

  it("blocks a plan with an empty meal slot", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)]), meal("Dinner", [])];
    expect(planProblems(meals, targets).some((p) => /Dinner/.test(p))).toBe(true);
  });

  it("blocks an option with no quantity", () => {
    const noQty = { seq: 0, food_items: "Rice and curry", qty: "", kcal: 500, carb_g: 40, protein_g: 20, fat_g: 10, fibre_g: 5, micronutrients: null, components: [] };
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
      ({ seq, food_items: `Option ${seq + 1}`, qty: "1 cup", kcal, carb_g: 40, protein_g: protein, fat_g: 10, fibre_g: 5, micronutrients: "Iron, folate", components: [] });
    const choices = (kcal: number, protein: number) => [0, 1, 2, 3].map((i) => full(i, kcal, protein));
    const meals = [meal("Breakfast", choices(450, 20)), meal("Lunch", choices(450, 30))];
    expect(planProblems(meals, {
      kcal: 900, protein: range(50), carbohydrate: range(80), fats: range(20), fibre: range(10), water: "3 ltr",
    })).toEqual([]);
  });
});

describe("an option built from recipes", () => {
  const dish = (over: Partial<DishOption> & Pick<DishOption, "id" | "name">): DishOption => ({
    serving_label: null, perServing: null, basis: null, source: null, reason: null, approved: true, ...over,
  });
  const puttu = dish({ id: "d1", name: "Puttu", perServing: { kcal: 210, carb_g: 44, protein_g: 4.6, fat_g: 2.2, fibre_g: 1.4 }, basis: "computed" });
  const kadala = dish({ id: "d2", name: "Kadala curry", perServing: { kcal: 118, carb_g: 14, protein_g: 6.2, fat_g: 4.0, fibre_g: 5.0 }, basis: "computed" });
  const unpriced = dish({ id: "d3", name: "Egg roast", reason: "2 ingredients not matched to the food table (coconut, shallot)" });
  const unapproved = dish({
    id: "d4", name: "Appam", perServing: { kcal: 120, carb_g: 25, protein_g: 2.4, fat_g: 1.2, fibre_g: 0.8 },
    basis: "published", source: "INDB ASC123", approved: false,
  });
  const library = new Map([puttu, kadala, unpriced, unapproved].map((d) => [d.id, d] as const));
  const targets = { kcal: 1900, protein: range(100), carbohydrate: range(220), fats: range(60), fibre: range(25), water: "3 ltr" };

  const part = (dish_id: string, servings = 1, seq = 0) => ({ seq, dish_id, servings });
  /** Puttu + half a kadala curry: 269 kcal, 51 g carb, 7.7 g protein, 4.2 g fat, 3.9 g fibre. */
  const FULL = { kcal: 269, carb_g: 51, protein_g: 7.7, fat_g: 4.2, fibre_g: 3.9 };
  const built = (over: Partial<PlanOption> = {}): PlanOption => ({
    seq: 0, food_items: "Puttu with kadala curry", qty: "1 piece + ½ cup",
    ...FULL, micronutrients: "Iron, folate",
    components: [part("d1", 1, 0), part("d2", 0.5, 1)], ...over,
  });
  const meal = (options: PlanOption[]): PlanMeal =>
    ({ seq: 0, name: "Breakfast", time_from: null, time_to: null, note: null, conditional: false, options });

  describe("optionNutrients", () => {
    it("adds the recipes up", () => {
      expect(optionNutrients([part("d1"), part("d2", 0.5, 1)], library)).toEqual(FULL);
    });
    it("gives one recipe on its own as the recipe has it", () => {
      expect(optionNutrients([part("d1")], library)).toEqual({ kcal: 210, carb_g: 44, protein_g: 4.6, fat_g: 2.2, fibre_g: 1.4 });
    });
    it("rounds once at the end, not per item", () => {
      // Three thirds of a puttu is a whole puttu. Rounding each component
      // first would make it 210.09 → 210 by luck, or 209 by bad luck.
      expect(optionNutrients([part("d1", 1 / 3, 0), part("d1", 1 / 3, 1), part("d1", 1 / 3, 2)], library))
        .toEqual({ kcal: 210, carb_g: 44, protein_g: 4.6, fat_g: 2.2, fibre_g: 1.4 });
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
      const m = [meal([built({ components: [part("d1"), part("d3", 1, 1)], kcal: null, carb_g: null, protein_g: null, fat_g: null, fibre_g: null })])];
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

    it("refuses a recipe the dietitian has not approved, even though it is priced", () => {
      // The picker hides these. This is what stops one that was selected
      // before the library was reviewed, or had approval withdrawn after.
      const m = [meal([built({ components: [part("d4")], kcal: 120, carb_g: 25, protein_g: 2.4, fat_g: 1.2, fibre_g: 0.8 })])];
      const out = planProblems(m, targets, [puttu, kadala, unapproved]);
      expect(out.some((p) => /Appam/.test(p) && /not been approved/.test(p))).toBe(true);
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
      const m = [meal([built({ kcal: 240 })])];
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
  const targets = { kcal: 1800, protein: range(90), carbohydrate: range(200), fats: range(60), fibre: range(25), water: "3 ltr" };
  it("refuses an option that has numbers but no food items", () => {
    const orphan = { seq: 0, food_items: "  ", qty: "1 cup", kcal: 400, carb_g: 40, protein_g: 20, fat_g: 10, fibre_g: 5, micronutrients: null, components: [] };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, carb_g: 40, protein_g: 20, fat_g: 10, fibre_g: 5, micronutrients: null, components: [] };
    const m: PlanMeal = { seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false, options: [orphan, good] };
    expect(planProblems([m], targets).some((p) => /no food items/.test(p))).toBe(true);
  });
  it("ignores a wholly empty row — that's just an unused slot in the grid", () => {
    const empty = { seq: 0, food_items: "", qty: "", kcal: null, carb_g: null, protein_g: null, fat_g: null, fibre_g: null, micronutrients: null, components: [] };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, carb_g: 40, protein_g: 20, fat_g: 10, fibre_g: 5, micronutrients: "Iron", components: [] };
    const m: PlanMeal = {
      seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false,
      options: [empty, ...[0, 1, 2, 3].map((seq) => ({ ...good, seq, food_items: `Rice ${seq + 1}` }))],
    };
    // Nothing is reported against the blank row itself; the filled one is fine.
    expect(planProblems([m], {
      kcal: 400, protein: range(20), carbohydrate: range(40), fats: range(10), fibre: range(5), water: "3 ltr",
    })).toEqual([]);
  });
});

describe("a chart cannot go out with blanks or mismatches", () => {
  // The clinic's rule, stated by the user: no warnings. Anything wrong, missing
  // or inconsistent blocks approval and blocks sending, and has to be resolved.
  const targets = { kcal: 1900, protein: range(100, 105), carbohydrate: range(220, 230), fats: range(45, 50), fibre: range(20, 30), water: "3 ltr" };
  const opt = (over: Partial<PlanOption> = {}): PlanOption => ({
    seq: 0, food_items: "Ragi puttu + kadala curry", qty: "1 medium piece + ½ cup",
    kcal: 440, carb_g: 55, protein_g: 26, fat_g: 12, fibre_g: 6, micronutrients: "Calcium, iron, folate", components: [], ...over,
  });
  const meal = (options: PlanOption[]): PlanMeal =>
    ({ seq: 0, name: "Breakfast", time_from: null, time_to: null, note: null, conditional: false, options });
  // A day that adds up: four slots of ~475 kcal each against a 1900 target.
  const four = (over: Partial<PlanOption> = {}) => [0, 1, 2, 3].map((seq) =>
    opt({ kcal: 475, protein_g: 25, ...over, seq, food_items: `${over.food_items ?? "Ragi puttu + kadala curry"} ${seq + 1}` }));
  const day = (over: PlanMeal[] = []): PlanMeal[] => over.length ? over : [0, 1, 2, 3].map((i) =>
    ({ ...meal(four()), seq: i, name: `Meal ${i + 1}` }));

  it("passes a complete chart", () => {
    expect(planProblems(day(), targets)).toEqual([]);
  });

  it("requires exactly four options in every active meal slot", () => {
    const tooFew = day(); tooFew[0].options = tooFew[0].options.slice(0, 3);
    expect(planProblems(tooFew, targets).some((p) => /Meal 1 has 3 options.*exactly 4/.test(p))).toBe(true);

    const tooMany = day(); tooMany[0].options.push(opt({ seq: 4, food_items: "Fifth option" }));
    expect(planProblems(tooMany, targets).some((p) => /Meal 1 has 5 options.*exactly 4/.test(p))).toBe(true);
  });

  it("blocks a day whose choices miss a numeric macro target", () => {
    const lowProtein = day().map((m) => ({ ...m, options: m.options.map((o) => ({ ...o, protein_g: 10 })) }));
    expect(planProblems(lowProtein, targets).some((p) => /under.*protein target/.test(p))).toBe(true);
  });

  it("refuses a missing calorie count", () => {
    const m = day(); m[0].options[0].kcal = null;
    expect(planProblems(m, targets).some((p) => /no calories/.test(p))).toBe(true);
  });

  it("refuses a missing protein figure", () => {
    const m = day(); m[0].options[0].protein_g = null;
    expect(planProblems(m, targets).some((p) => /no protein/.test(p))).toBe(true);
  });

  it("refuses a blank in any of the five columns the document prints", () => {
    // The brief's table has nine columns. Until the chart could hold carbs,
    // fat and fibre, three of them could be silently empty on an issued PDF.
    for (const [key, label] of MACRO_LABELS) {
      const m = day();
      (m[0].options[0] as Record<string, unknown>)[key] = null;
      expect(planProblems(m, targets).some((p) => p.includes(`no ${label}`)), label).toBe(true);
    }
  });

  it("refuses options in one meal whose macros are not interchangeable", () => {
    // Same calories, different food. 40 kcal apart is within the clinic's rule
    // on energy, but a plate of rice against a plate of fish is not a choice
    // between equals, and the brief asks for both to match.
    const m = day();
    m[0] = { ...m[0], options: [
      opt({ seq: 0, kcal: 475, carb_g: 80, protein_g: 10, fat_g: 5, fibre_g: 6 }),
      opt({ seq: 1, kcal: 470, carb_g: 10, protein_g: 55, fat_g: 20, fibre_g: 1, food_items: "Grilled fish" }),
    ] };
    const out = planProblems(m, targets);
    expect(out.some((p) => /carbohydrate/.test(p) && /interchangeable/.test(p))).toBe(true);
    expect(out.some((p) => /protein/.test(p) && /interchangeable/.test(p))).toBe(true);
  });

  it("accepts options whose macros differ only a little", () => {
    const m = day();
    m[0] = { ...m[0], options: [
      opt({ seq: 0, kcal: 470, carb_g: 55, protein_g: 25, fat_g: 12, fibre_g: 6 }),
      opt({ seq: 1, kcal: 480, carb_g: 60, protein_g: 27, fat_g: 14, fibre_g: 7, food_items: "Idiyappam + stew" }),
    ] };
    expect(planProblems(m, targets).filter((p) => /interchangeable/.test(p))).toEqual([]);
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
    const m = [...day(), { ...meal(four({ kcal: 500 })), seq: 9, name: "Travel-delay backup", conditional: true }];
    expect(planProblems(m, targets)).toEqual([]);
  });

  it("still catches an empty meal slot", () => {
    const m = day(); m[1] = { ...m[1], options: [] };
    expect(planProblems(m, targets).some((p) => /nothing to eat/.test(p))).toBe(true);
  });
});

describe("a typed option that disagrees with itself", () => {
  const targets = { kcal: 1800, protein: range(90), carbohydrate: range(200), fats: range(60), fibre: range(25), water: "3 ltr" };
  const typed = (o: Partial<PlanOption>): PlanOption => ({
    seq: 0, food_items: "Rice and dal", qty: "1 cup", micronutrients: "iron, folate",
    kcal: 400, carb_g: 60, protein_g: 15, fat_g: 8, fibre_g: 4, components: [], ...o,
  });
  const problems = (o: PlanOption) => planProblems([meal("Lunch", [o])], targets);
  const complains = (o: PlanOption) => problems(o).some((p) => /come to about/.test(p));

  it("catches calories that the macros beside them cannot explain", () => {
    // 10 g carb, 5 g protein and 2 g fat is 78 kcal, not 400. Somebody has
    // typed a figure remembered from a different portion.
    expect(complains(typed({ kcal: 400, carb_g: 10, protein_g: 5, fat_g: 2, fibre_g: 1 }))).toBe(true);
  });

  it("catches a decimal point in the wrong place", () => {
    expect(complains(typed({ kcal: 4000, carb_g: 60, protein_g: 15, fat_g: 8, fibre_g: 4 }))).toBe(true);
  });

  it("names the option and what the macros actually come to", () => {
    const p = problems(typed({ kcal: 400, carb_g: 10, protein_g: 5, fat_g: 2, fibre_g: 1 }))
      .find((x) => /come to about/.test(x))!;
    expect(p).toMatch(/Lunch/);
    expect(p).toMatch(/400 kcal/);
    // 4×10 carb + 4×5 protein + 9×2 fat + 2×1 fibre = 80.
    expect(p).toMatch(/about 80/);
  });

  it("leaves an option whose figures agree alone", () => {
    expect(complains(typed({}))).toBe(false);
  });

  it("stays quiet on a small option, where a few calories is not a discrepancy", () => {
    // A 20 kcal side salad: 25% of it is 5 kcal, which is rounding, and a
    // warning that fires on those teaches everyone to ignore the warning.
    expect(complains(typed({ kcal: 17, carb_g: 3.4, protein_g: 0.6, fat_g: 0.1, fibre_g: 1.9 }))).toBe(false);
  });

  it("says nothing until all five figures are there", () => {
    // The missing-figure messages already cover this, and guessing at a total
    // from four of five would report the wrong problem.
    expect(complains(typed({ fat_g: null }))).toBe(false);
  });

  it("never fires on an option built from the library", () => {
    // Those are summed from IFCT, which measures energy directly rather than
    // deriving it from the macros, so the two differ a little by design. A
    // warning on every linked option would be noise on the correct path.
    const dish: DishOption = {
      id: "d1", name: "Rice", serving_label: "1 cup",
      perServing: { kcal: 400, carb_g: 10, protein_g: 5, fat_g: 2, fibre_g: 1 },
      basis: "computed", source: null, reason: null, approved: true,
    };
    const linked = typed({
      kcal: 400, carb_g: 10, protein_g: 5, fat_g: 2, fibre_g: 1,
      components: [{ seq: 0, dish_id: "d1", servings: 1 }],
    });
    const p = planProblems([meal("Lunch", [linked])], targets, [dish]);
    expect(p.some((x) => /come to about/.test(x))).toBe(false);
  });
});

describe("micronutrients on a chart option", () => {
  const micro = (o: Record<string, number | null>) =>
    ({ ...Object.fromEntries(MICRONUTRIENTS.map((m) => [m.key, null])), ...o }) as MicroTotals;
  const dish = (id: string, m: Record<string, number | null>): DishOption => ({
    id, name: id, serving_label: "1 bowl",
    perServing: { kcal: 200, carb_g: 20, protein_g: 8, fat_g: 6, fibre_g: 3 },
    basis: "computed", source: null, reason: null, approved: true, micro: micro(m),
  });
  const map = (...ds: DishOption[]) => new Map(ds.map((d) => [d.id, d]));

  it("adds a nutrient across the recipes, scaled by the portion of each", () => {
    const m = new Map([["a", dish("a", { iron_mg: 4, sodium_mg: 300 })]]);
    const t = optionMicronutrients([{ seq: 0, dish_id: "a", servings: 0.5 }], m)!;
    expect(t.iron_mg).toBe(2);
    expect(t.sodium_mg).toBe(150);
  });

  it("adds across several recipes", () => {
    const m = map(dish("a", { iron_mg: 4 }), dish("b", { iron_mg: 1.5 }));
    const t = optionMicronutrients(
      [{ seq: 0, dish_id: "a", servings: 1 }, { seq: 1, dish_id: "b", servings: 2 }], m)!;
    expect(t.iron_mg).toBe(7);
  });

  it("has no total for a nutrient one of its recipes is missing", () => {
    // Three of four items is not a smaller sodium figure, it is a wrong one —
    // and this ends up printed on a document somebody is treated from.
    const m = map(dish("a", { iron_mg: 4, sodium_mg: 300 }), dish("b", { iron_mg: 1 }));
    const t = optionMicronutrients(
      [{ seq: 0, dish_id: "a", servings: 1 }, { seq: 1, dish_id: "b", servings: 1 }], m)!;
    expect(t.iron_mg).toBe(5);
    expect(t.sodium_mg).toBeNull();
  });

  it("has nothing at all when a recipe is missing or unpriced", () => {
    const m = map(dish("a", { iron_mg: 4 }));
    const t = optionMicronutrients([{ seq: 0, dish_id: "gone", servings: 1 }], m)!;
    expect(t.iron_mg).toBeNull();
    expect(optionMicronutrients([], m)).toBeNull();
  });

  describe("the line it puts on the chart", () => {
    it("names the largest few by share of a day, not by the raw number", () => {
      // 30 mg of vitamin C is 37% of a day; 5 mg of iron is 26%; 400 mg of
      // sodium is 20%. Sorted by size they would come out in exactly the
      // wrong order, with the least notable figure first.
      const line = micronutrientLine(micro({ iron_mg: 5, sodium_mg: 400, vit_c_mg: 30 }));
      expect(line).toBe("Vitamin C 30 mg, Iron 5 mg, Sodium 400 mg");
    });

    it("rounds a large figure to whole units and a small one to a decimal", () => {
      expect(micronutrientLine(micro({ folate_ug: 172.53 }))).toBe("Folate (B9) 173 µg");
      expect(micronutrientLine(micro({ iron_mg: 5.24 }))).toBe("Iron 5.2 mg");
    });

    it("says nothing rather than an empty string, so the two can be told apart", () => {
      // "" would read the same as "we could not work it out".
      expect(micronutrientLine(micro({ iron_mg: 0.4 }))).toBeNull();
      expect(micronutrientLine(null)).toBeNull();
    });
  });
});

describe("the early morning drink (section 8)", () => {
  const targets = { kcal: 1800, protein: range(90), carbohydrate: range(200), fats: range(60), fibre: range(25), water: "3 ltr" };
  const opt = (food: string): PlanOption => ({
    seq: 0, food_items: food, qty: "1 glass", micronutrients: "—",
    kcal: 20, carb_g: 4, protein_g: 0.5, fat_g: 0.2, fibre_g: 0.5, components: [],
  });
  const check = (slot: string, food: string) =>
    planProblems([meal(slot, [opt(food)]), meal("Breakfast", [opt("Idli and sambar")])], targets)
      .filter((p) => /rules out/.test(p));

  it("refuses each of the four the brief names", () => {
    for (const [food, called] of [
      ["Warm lemon water", "lemon water"],
      ["Ashwagandha with milk", "ashwagandha"],
      ["Cinnamon water", "cinnamon water"],
      ["Apple cider vinegar in water", "apple cider vinegar"],
    ]) {
      const p = check("Upon waking", food);
      expect(p).toHaveLength(1);
      expect(p[0]).toContain(called);
    }
  });

  it("refuses the same claim written a different way", () => {
    for (const food of ["Nimbu pani", "ACV shot", "Jeera water", "Methi water", "Detox drink"]) {
      expect(check("Upon waking", food)).toHaveLength(1);
    }
  });

  it("offers what the brief allows instead of only refusing", () => {
    // A refusal with no alternative is a message somebody argues with.
    expect(check("Upon waking", "Lemon water")[0]).toContain("5 soaked almonds and 2 dates");
  });

  it("passes what the brief actually recommends", () => {
    for (const food of ["5 soaked almonds and 2 dates", "1 tsp soaked chia seeds in plain water", "1 small apple"]) {
      expect(check("Upon waking", food)).toEqual([]);
    }
  });

  it("only looks at the waking slot", () => {
    // Lemon in a salad at lunch is lemon in a salad. A rule that fired there
    // would be ignored within a week.
    expect(check("Lunch", "Rice, fish curry, lemon water on the side")).toEqual([]);
    expect(check("Evening snack", "Cinnamon water")).toEqual([]);
  });

  it("finds the slot however she has renamed it", () => {
    for (const slot of ["Upon waking", "On waking", "Early morning", "Empty stomach", "Bed tea"]) {
      expect(check(slot, "Lemon water")).toHaveLength(1);
    }
  });

  it("names both when an option carries two of them", () => {
    expect(check("Upon waking", "Lemon water with a pinch of cinnamon water")[0])
      .toMatch(/lemon water and cinnamon water/);
  });
});

describe("how far a target may move between reviews (section 2)", () => {
  it("says nothing about a gentle step", () => {
    // The brief asks for 100–200 kcal, so those must pass silently.
    expect(targetStepProblem(1800, 1650)).toBeNull();
    expect(targetStepProblem(1800, 2000)).toBeNull();
    expect(targetStepProblem(1800, 1800)).toBeNull();
  });

  it("flags a sudden jump, in either direction", () => {
    const down = targetStepProblem(1800, 1300)!;
    expect(down).toMatch(/moves down 500 kcal/);
    expect(down).toMatch(/last chart's 1800/);
    expect(targetStepProblem(1800, 2400)).toMatch(/moves up 600 kcal/);
  });

  it("says nothing about a first chart", () => {
    // Nothing to be gentle about — there is no step.
    expect(targetStepProblem(null, 1800)).toBeNull();
  });

  it("says nothing when either figure is missing", () => {
    expect(targetStepProblem(1800, null)).toBeNull();
    expect(targetStepProblem(null, null)).toBeNull();
  });

  it("names the reason a big step can be right, so it reads as a question", () => {
    // A target from an estimated BMR, corrected by a real InBody reading, can
    // move 400 kcal and be more right afterwards. The message must not imply
    // the chart is wrong.
    expect(targetStepProblem(1800, 1300)).toMatch(/measured BMR replacing an estimate/);
  });

  it("uses the brief's own boundary", () => {
    expect(GENTLE_STEP_KCAL).toBe(200);
    expect(targetStepProblem(1800, 1600)).toBeNull();      // exactly 200 is asked for
    expect(targetStepProblem(1800, 1599)).not.toBeNull();  // 201 is not
  });
});
