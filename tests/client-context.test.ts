import { describe, it, expect } from "vitest";
import { contextNotes, type ClientContext } from "@/lib/client-context";
import { type PlanMeal } from "@/lib/diet-plan";

const ctx = (o: Partial<ClientContext>): ClientContext =>
  ({ region: null, shift_pattern: null, outside_meals: null, ...o });

const slot = (name: string, from: string | null): PlanMeal =>
  ({ seq: 0, name, time_from: from, time_to: null, note: null, conditional: false, options: [] });

const daytime = [slot("Upon waking", "8:00 am"), slot("Breakfast", "9:30 am")];
const nightShifted = [slot("Upon waking", "4:00 pm"), slot("Breakfast", "5:30 pm")];

const ids = (c: ClientContext, meals = daytime) => contextNotes(c, meals).map((n) => n.id);

describe("the Kerala default (section 9)", () => {
  it("says nothing when the box is empty, because empty means Kerala", () => {
    expect(ids(ctx({}))).toEqual([]);
  });

  it("says nothing when Kerala is written out", () => {
    for (const r of ["Kerala", "kerala", "Malayali family, Kochi"]) {
      expect(ids(ctx({ region: r }))).toEqual([]);
    }
  });

  it("speaks up for a client from elsewhere", () => {
    const n = contextNotes(ctx({ region: "Hyderabad" }), daytime);
    expect(n).toHaveLength(1);
    expect(n[0].text).toContain("Hyderabad");
    // It must not claim to have checked the dishes — it cannot.
    expect(n[0].text).toMatch(/judgement rather than something the app can check/);
  });
});

describe("shift timing (sections 1 and 6)", () => {
  it("speaks up when a night worker has a daytime chart", () => {
    expect(ids(ctx({ shift_pattern: "Night shift, 10pm to 6am" }))).toEqual(["shift"]);
    expect(ids(ctx({ shift_pattern: "Rotating, nights every third week" }))).toEqual(["shift"]);
  });

  it("stays quiet once the chart has been rearranged around it", () => {
    // A warning that fires on a chart somebody has already fixed is how a
    // warning becomes wallpaper.
    expect(ids(ctx({ shift_pattern: "Night shift" }), nightShifted)).toEqual([]);
  });

  it("says nothing about an ordinary working day", () => {
    expect(ids(ctx({ shift_pattern: "9 to 5, office" }))).toEqual([]);
    expect(ids(ctx({}))).toEqual([]);
  });
});

describe("eating out (section 10)", () => {
  it("speaks up when it is a habit", () => {
    for (const s of ["Eats out daily", "Restaurant 3 times a week", "often, English breakfast"]) {
      expect(ids(ctx({ outside_meals: s }))).toEqual(["outside"]);
    }
  });

  it("stays quiet when it is not", () => {
    for (const s of ["Rarely", "Never eats out", "Occasional, once a month"]) {
      expect(ids(ctx({ outside_meals: s }))).toEqual([]);
    }
  });

  it("lets 'rarely' win over 'weekly' in a sentence that says both", () => {
    // "Rarely — maybe weekly" is a no, and reading only the first match would
    // make it a yes.
    expect(ids(ctx({ outside_meals: "Rarely, maybe weekly at most" }))).toEqual([]);
  });
});

describe("all three at once", () => {
  it("reports each on its own terms", () => {
    expect(ids(ctx({
      region: "Chennai", shift_pattern: "Night duty", outside_meals: "daily",
    }))).toEqual(["region", "shift", "outside"]);
  });

  it("never refuses a chart — these are reminders", () => {
    // A night-shift client may want a daytime chart precisely because it is
    // the routine they are trying to get back to.
    const n = contextNotes(ctx({ shift_pattern: "Night shift" }), daytime);
    expect(n[0].text).not.toMatch(/cannot be (sent|published)|must be/i);
  });
});
