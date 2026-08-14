import { describe, expect, it } from "vitest";
import {
  COMPLETION_SYSTEM_PROMPT,
  completeDietPlanDraft,
  completionDraftBrief,
} from "@/lib/diet-plan-assistant";
import type { DishOption, PlanMeal, PlanOption } from "@/lib/diet-plan";
import type { GeneratedPlan } from "@/lib/diet-plan-ai";
import { MICRO_KEYS, type MicroTotals } from "@/lib/nutrition";

const micros = (): MicroTotals => ({
  ...Object.fromEntries(MICRO_KEYS.map((key) => [key, null])),
  iron_mg: 5,
  calcium_mg: 220,
  folate_ug: 80,
} as MicroTotals);

const dish = (id: string, name: string, kcal: number, over: Partial<DishOption> = {}): DishOption => ({
  id, name, serving_label: "1 bowl", approved: true, basis: "computed", source: null, reason: null,
  perServing: { kcal, carb_g: 50, protein_g: 20, fat_g: 10, fibre_g: 6 },
  micro: micros(),
  ...over,
});

const library = [
  dish("d1", "Existing bowl", 400),
  dish("d2", "Option two", 410),
  dish("d3", "Option three", 390),
  dish("d4", "Option four", 420),
  dish("far", "Far too large", 520, {
    perServing: { kcal: 520, carb_g: 80, protein_g: 35, fat_g: 20, fibre_g: 12 },
  }),
  dish("unapproved", "Not reviewed", 405, { approved: false }),
];

const existing = (over: Partial<PlanOption> = {}): PlanOption => ({
  seq: 0, food_items: "Existing meal", qty: "1 bowl", kcal: 400,
  carb_g: 50, protein_g: 20, fat_g: 10, fibre_g: 6,
  micronutrients: "Dietitian's existing note", components: [],
  ...over,
});

const meal = (options: PlanOption[]): PlanMeal => ({
  seq: 0, name: "Breakfast", time_from: "9:00 am", time_to: "9:30 am",
  note: "Keep this note", conditional: false, options,
});

const suggestion = (id: string, name: string) => ({
  food_items: name,
  qty: "1 bowl",
  micronutrients: "model words are ignored",
  components: [{ seq: 0, dish_id: id, servings: 1 }],
});

const proposal = (options: ReturnType<typeof suggestion>[]): GeneratedPlan => ({
  meals: [{
    name: "Breakfast", time_from: null, time_to: null, note: null,
    conditional: false, options,
  }],
  notes: "Do not replace the saved note", rationale: "For review", dropped: [],
});

describe("the existing-draft completion assistant", () => {
  it("makes the safety boundaries explicit in the prompt", () => {
    expect(COMPLETION_SYSTEM_PROMPT).toMatch(/EXISTING saved diet-chart draft/);
    expect(COMPLETION_SYSTEM_PROMPT).toMatch(/never state or invent.*target/is);
    expect(COMPLETION_SYSTEM_PROMPT).toMatch(/Nothing you return is saved/i);
    expect(COMPLETION_SYSTEM_PROMPT).toMatch(/untrusted reference data/i);
  });

  it("describes exactly how many choices each saved slot still needs", () => {
    const brief = completionDraftBrief([meal([existing()])]);
    expect(brief).toMatch(/Existing choices: 1; propose 3 more/);
    expect(brief).toMatch(/Existing meal.*400 kcal, 50c, 20p/s);
  });

  it("preserves every existing value and adds only enough calculated choices to reach four", () => {
    const current = meal([existing()]);
    const result = completeDietPlanDraft(
      [current],
      proposal([suggestion("d2", "Second"), suggestion("d3", "Third"), suggestion("d4", "Fourth")]),
      library,
    );

    expect(result.added).toHaveLength(3);
    expect(result.meals[0].options).toHaveLength(4);
    expect(result.meals[0].options[0]).toEqual(current.options[0]);
    expect(result.meals[0].note).toBe("Keep this note");
    expect(result.meals[0].options[1]).toMatchObject({
      food_items: "Second", qty: "1 bowl", kcal: 410, carb_g: 50,
      protein_g: 20, fat_g: 10, fibre_g: 6,
    });
    expect(result.meals[0].options[1].micronutrients).toMatch(/Iron|Calcium|Folate/);
  });

  it("fills a blank micronutrient line only when an existing option is recipe-backed", () => {
    const linked = existing({
      micronutrients: null,
      components: [{ seq: 0, dish_id: "d1", servings: 1 }],
    });
    const typed = existing({ seq: 1, food_items: "Free text", micronutrients: null, components: [] });
    const result = completeDietPlanDraft([meal([linked, typed])], proposal([]), library);

    expect(result.meals[0].options[0].micronutrients).toMatch(/Iron|Calcium|Folate/);
    expect(result.meals[0].options[1].micronutrients).toBeNull();
    expect(result.filledMicronutrients).toEqual([{ meal: "Breakfast", option: "Existing meal" }]);
    expect(result.skipped.some((item) => /Free text still needs a dietitian-reviewed micronutrient line/.test(item))).toBe(true);
  });

  it("rejects unapproved, uncalculated or non-interchangeable suggestions", () => {
    const result = completeDietPlanDraft(
      [meal([existing()])],
      proposal([
        suggestion("unapproved", "Unreviewed"),
        suggestion("far", "Too different"),
        suggestion("missing", "Not in library"),
      ]),
      library,
    );

    expect(result.added).toEqual([]);
    expect(result.meals[0].options).toHaveLength(1);
    expect(result.skipped.some((item) => /not close enough/.test(item))).toBe(true);
    expect(result.skipped.some((item) => /could not be calculated/.test(item))).toBe(true);
  });

  it("respects the saved figures that exist even when the original row is incomplete", () => {
    const partial = existing({ carb_g: null, fat_g: null, fibre_g: null });
    const result = completeDietPlanDraft(
      [meal([partial])],
      proposal([suggestion("far", "Too large for the saved calories")]),
      library,
    );
    expect(result.added).toEqual([]);
    expect(result.skipped.some((item) => /not close enough/.test(item))).toBe(true);
  });

  it("does not add a fifth choice or duplicate the same recipe composition", () => {
    const four = [
      existing(),
      existing({ seq: 1, food_items: "B", components: [{ seq: 0, dish_id: "d2", servings: 1 }] }),
      existing({ seq: 2, food_items: "C", components: [{ seq: 0, dish_id: "d3", servings: 1 }] }),
      existing({ seq: 3, food_items: "D", components: [{ seq: 0, dish_id: "d4", servings: 1 }] }),
    ];
    const result = completeDietPlanDraft([meal(four)], proposal([suggestion("d2", "Another")]), library);
    expect(result.meals[0].options).toHaveLength(4);
    expect(result.added).toEqual([]);
  });
});
