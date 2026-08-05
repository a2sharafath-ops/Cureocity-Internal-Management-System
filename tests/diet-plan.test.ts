import { describe, it, expect } from "vitest";
import { planTotals, targetCheck, planProblems, parseNotes, mealHeading, resequence, DEFAULT_MEALS, HOW_TO_USE, type PlanMeal } from "@/lib/diet-plan";

const opt = (seq: number, kcal: number, protein: number, items = `Option ${seq + 1}`) =>
  ({ seq, food_items: items, qty: "1 cup", kcal, protein_g: protein, micronutrients: null });

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
    const blank = { seq: 1, food_items: "   ", qty: null, kcal: null, protein_g: null, micronutrients: null };
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
  const targets = { kcal: 1800, protein: null, carbohydrate: null, fats: null, fibre: null, water: null };

  it("blocks a plan with an empty meal slot", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)]), meal("Dinner", [])];
    expect(planProblems(meals, targets).some((p) => /Dinner/.test(p))).toBe(true);
  });

  it("blocks an option with no quantity", () => {
    const noQty = { seq: 0, food_items: "Rice and curry", qty: "", kcal: 500, protein_g: 20, micronutrients: null };
    expect(planProblems([meal("Lunch", [noQty])], targets).some((p) => /quantity/.test(p))).toBe(true);
  });

  it("blocks a plan with no calorie target", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)])];
    expect(planProblems(meals, { ...targets, kcal: null }).some((p) => /calorie target/.test(p))).toBe(true);
  });

  it("passes a complete plan", () => {
    const meals = [meal("Breakfast", [opt(0, 400, 20)]), meal("Lunch", [opt(0, 500, 30)])];
    expect(planProblems(meals, targets)).toEqual([]);
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
  const targets = { kcal: 1800, protein: null, carbohydrate: null, fats: null, fibre: null, water: null };
  it("refuses an option that has numbers but no food items", () => {
    const orphan = { seq: 0, food_items: "  ", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: null };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: null };
    const m: PlanMeal = { seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false, options: [orphan, good] };
    expect(planProblems([m], targets).some((p) => /no food items/.test(p))).toBe(true);
  });
  it("ignores a wholly empty row — that's just an unused slot in the grid", () => {
    const empty = { seq: 0, food_items: "", qty: "", kcal: null, protein_g: null, micronutrients: null };
    const good = { seq: 1, food_items: "Rice", qty: "1 cup", kcal: 400, protein_g: 20, micronutrients: null };
    const m: PlanMeal = { seq: 0, name: "Lunch", time_from: null, time_to: null, note: null, conditional: false, options: [empty, good] };
    expect(planProblems([m], targets)).toEqual([]);
  });
});
