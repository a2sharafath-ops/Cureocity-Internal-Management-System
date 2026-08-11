import { describe, it, expect } from "vitest";
import { readValue, labFindings, markerFor, LAB_MARKERS, type LabResult } from "@/lib/lab-results";

const r = (o: Partial<LabResult>): LabResult => ({
  marker: "ferritin", label: null, value: 45, unit: "ng/mL",
  low: null, high: null, taken_on: "2026-08-01", ...o,
});

describe("reading a value against a range", () => {
  it("uses the range printed on the report when there is one", () => {
    // The lab's own range wins. Analysers differ, and men and women differ.
    const v = readValue(r({ value: 25, low: 20, high: 250 }));
    expect(v.verdict).toBe("in range");
    expect(v.usingReport).toBe(true);
  });

  it("falls back to a published range, and says it did", () => {
    // 25 is below the published floor of 30 but inside the lab's 20–250, so
    // the two disagree — which is exactly why the report's range wins above.
    const v = readValue(r({ value: 25 }));
    expect(v.verdict).toBe("low");
    expect(v.usingReport).toBe(false);
  });

  it("calls high high", () => {
    expect(readValue(r({ marker: "tsh", unit: "µIU/mL", value: 7.8 })).verdict).toBe("high");
  });

  it("admits when it cannot say", () => {
    // A marker nobody has a range for is not "in range".
    expect(readValue(r({ marker: "something_new", value: 12 })).verdict).toBe("unknown");
    expect(readValue(r({ value: NaN })).verdict).toBe("unknown");
  });

  it("copes with a one-sided range", () => {
    expect(readValue(r({ marker: "ldl", unit: "mg/dL", value: 160 })).verdict).toBe("high");
    expect(readValue(r({ marker: "ldl", unit: "mg/dL", value: 80 })).verdict).toBe("in range");
  });
});

describe("what a dietitian is shown", () => {
  it("reports only what is out of range", () => {
    // Twelve normal results is a screen nobody reads.
    const f = labFindings([r({ value: 120 }), r({ marker: "tsh", unit: "µIU/mL", value: 2.1 })]);
    expect(f).toEqual([]);
  });

  it("names the value, the range and the date", () => {
    const f = labFindings([r({ value: 9, taken_on: "2026-07-14" })]);
    expect(f).toHaveLength(1);
    expect(f[0].text).toMatch(/Ferritin is low at 9 ng\/mL/);
    expect(f[0].text).toMatch(/30–300/);
    expect(f[0].text).toMatch(/2026-07-14/);
  });

  it("points at the nutrient a chart can actually move", () => {
    const f = labFindings([r({ value: 9 })]);
    expect(f[0].answers).toBe("iron_mg");
    expect(f[0].answersLabel).toBe("Iron");
  });

  it("keeps only the latest result for a marker", () => {
    // A ferritin since repeated is history, and showing both invites the wrong
    // one being acted on.
    const f = labFindings([
      r({ value: 9, taken_on: "2026-03-01" }),
      r({ value: 65, taken_on: "2026-07-01" }),
    ]);
    expect(f).toEqual([]);
  });

  it("puts deficiencies before high readings", () => {
    const f = labFindings([
      r({ marker: "ldl", unit: "mg/dL", value: 180 }),
      r({ value: 8 }),
    ]);
    expect(f[0].verdict).toBe("low");
    expect(f[1].verdict).toBe("high");
  });

  it("says when the range came from us rather than the lab", () => {
    expect(labFindings([r({ value: 9 })])[0].text).toMatch(/this report printed none/);
    expect(labFindings([r({ value: 9, low: 30, high: 300 })])[0].text)
      .not.toMatch(/this report printed none/);
  });
});

describe("the advice attached to a marker", () => {
  it("never names a dose", () => {
    for (const m of LAB_MARKERS) {
      for (const a of [m.whenLow, m.whenHigh]) {
        if (!a) continue;
        expect(a).not.toMatch(/\b\d+\s?(mg|mcg|µg|iu|IU|g)\b/);
      }
    }
  });

  it("sends the ones a chart cannot fix to the doctor", () => {
    // Food carries very little vitamin D, and kidney numbers are not the
    // dietitian's to move unaided.
    expect(markerFor("vitamin_d")!.whenLow).toMatch(/doctor/);
    expect(markerFor("creatinine")!.whenHigh).toMatch(/doctor/);
  });

  it("does not claim food fixes vitamin D", () => {
    expect(markerFor("vitamin_d")!.whenLow).toMatch(/cannot fix this on its own/);
  });
});
