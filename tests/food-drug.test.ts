import { describe, it, expect } from "vitest";
import { rulesFor, optionInteractions, DRUG_RULES } from "@/lib/food-drug";
import { MICRONUTRIENTS, type MicroTotals } from "@/lib/nutrition";

const micro = (o: Record<string, number | null>): MicroTotals =>
  ({ ...Object.fromEntries(MICRONUTRIENTS.map((m) => [m.key, null])), ...o }) as MicroTotals;

describe("recognising the drug from what somebody typed", () => {
  it("finds a generic name", () => {
    expect(rulesFor(["levothyroxine 50 mcg"]).map((r) => r.id)).toEqual(["thyroxine"]);
  });

  it("finds the brand names an Indian clinic actually writes", () => {
    // Nobody writes "levothyroxine" on a Kerala prescription.
    for (const typed of ["Thyronorm 50mcg OD", "T. Eltroxin", "tab thyrox 25"]) {
      expect(rulesFor([typed]).map((r) => r.id)).toEqual(["thyroxine"]);
    }
    expect(rulesFor(["Dytor 10"]).map((r) => r.id)).toEqual(["diuretic"]);
    expect(rulesFor(["Rosuvas 10 mg HS"]).map((r) => r.id)).toEqual(["statin"]);
  });

  it("finds more than one", () => {
    expect(rulesFor(["Thyronorm 75", "Lasix 40", "vitamin D"]).map((r) => r.id))
      .toEqual(["thyroxine", "diuretic", "statin"].filter((x) => x !== "statin"));
  });

  it("says nothing about a drug it has never heard of", () => {
    // And that silence means "not one of these three", never "no interaction".
    expect(rulesFor(["Metformin 500", "Amlodipine 5"])).toEqual([]);
    expect(rulesFor([])).toEqual([]);
  });
});

describe("checking one option", () => {
  const thyroxine = rulesFor(["Thyronorm 50"]);
  const statin = rulesFor(["Atorvastatin 20"]);
  const diuretic = rulesFor(["Lasix 40"]);

  it("points at the calcium in a meal when the client is on thyroxine", () => {
    const r = optionInteractions("Breakfast · option 1", "Milk and cornflakes",
      micro({ calcium_mg: 340, iron_mg: 1 }), thyroxine);
    expect(r.found).toHaveLength(1);
    expect(r.found[0].text).toMatch(/340 mg of calcium/);
    expect(r.found[0].text).toMatch(/four hours/);
  });

  it("stays quiet on an ordinary amount", () => {
    const r = optionInteractions("Lunch · option 1", "Rice and dal",
      micro({ calcium_mg: 40, iron_mg: 2 }), thyroxine);
    expect(r.found).toEqual([]);
  });

  it("catches a named food nobody can measure", () => {
    // Grapefruit has no micronutrient signature. Reading the words is the only
    // way a named food can be caught at all.
    const r = optionInteractions("Breakfast · option 2", "Grapefruit juice, toast",
      micro({}), statin);
    expect(r.found).toHaveLength(1);
    expect(r.found[0].text).toMatch(/grapefruit/);
  });

  it("catches a named food on a hand-typed option, where there are no figures", () => {
    const r = optionInteractions("Breakfast · option 2", "Half a pomelo", null, statin);
    expect(r.found).toHaveLength(1);
  });

  it("admits when it could not look", () => {
    // An option typed by hand has no computed minerals. Reporting nothing found
    // would read as a clean check, which it is not.
    const r = optionInteractions("Dinner · option 1", "Chapati and curry", null, thyroxine);
    expect(r.found).toEqual([]);
    expect(r.unchecked).toBe(true);
  });

  it("does not claim it could not look when the rule needs no figures", () => {
    const r = optionInteractions("Dinner · option 1", "Chapati and curry", null, statin);
    expect(r.unchecked).toBe(false);
  });

  it("flags potassium and sodium together for a diuretic", () => {
    const r = optionInteractions("Lunch · option 1", "Banana and coconut water",
      micro({ potassium_mg: 1200, sodium_mg: 900 }), diuretic);
    expect(r.found).toHaveLength(2);
    // The direction depends on which diuretic, so the advice must not pick one.
    expect(r.found[0].text).toMatch(/last electrolytes/);
  });

  it("checks every drug the client is on, not just the first", () => {
    const both = rulesFor(["Thyronorm 50", "Atorvastatin 20"]);
    const r = optionInteractions("Breakfast · option 1", "Grapefruit and milk",
      micro({ calcium_mg: 300 }), both);
    expect(r.found.map((f) => f.ruleId).sort()).toEqual(["statin", "thyroxine"]);
  });
});

describe("the shape of the list itself", () => {
  it("holds only what the brief names, so silence cannot be read as safety", () => {
    expect(DRUG_RULES.map((r) => r.id).sort()).toEqual(["diuretic", "statin", "thyroxine"]);
  });

  it("never tells anyone a chart is safe", () => {
    for (const r of DRUG_RULES) {
      expect(r.advice.toLowerCase()).not.toMatch(/\bsafe\b|no interaction|nothing to worry/);
    }
  });
});
