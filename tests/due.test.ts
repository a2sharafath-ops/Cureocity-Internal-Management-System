import { describe, it, expect } from "vitest";
import { dueOn, waitingSince, daysBetweenISO } from "@/lib/due";

const TODAY = "2026-08-05";

describe("dueOn", () => {
  it("speaks in relative time for the near future", () => {
    expect(dueOn("2026-08-05", TODAY)).toEqual({ dueLabel: "due today", overdue: false });
    expect(dueOn("2026-08-06", TODAY)).toEqual({ dueLabel: "due tomorrow", overdue: false });
  });
  it("gives the date AND the gap further out", () => {
    expect(dueOn("2026-08-12", TODAY)?.dueLabel).toBe("due 12 Aug · in 7 days");
  });
  it("counts how late, not just that it is late", () => {
    expect(dueOn("2026-08-04", TODAY)).toEqual({ dueLabel: "was due 4 Aug · 1 day overdue", overdue: true });
    expect(dueOn("2026-07-28", TODAY)).toEqual({ dueLabel: "was due 28 Jul · 8 days overdue", overdue: true });
  });
  it("returns nothing when there is no date to show", () => {
    expect(dueOn(null, TODAY)).toBeUndefined();
    expect(dueOn(undefined, TODAY)).toBeUndefined();
  });
});

describe("waitingSince", () => {
  it("states the wait without alarm inside the window", () => {
    expect(waitingSince("2026-08-02", TODAY)).toEqual({ dueLabel: "waiting 3 days · since 2 Aug", overdue: false });
  });
  it("flags it once waiting is no longer normal", () => {
    expect(waitingSince("2026-07-29", TODAY)?.overdue).toBe(true);   // 7 days
    expect(waitingSince("2026-07-20", TODAY)?.dueLabel).toBe("waiting 16 days · since 20 Jul");
  });
  it("respects a custom threshold", () => {
    expect(waitingSince("2026-08-02", TODAY, 3)?.overdue).toBe(true);
    expect(waitingSince("2026-08-03", TODAY, 3)?.overdue).toBe(false);
  });
  it("handles same-day and singular wording", () => {
    expect(waitingSince(TODAY, TODAY)).toEqual({ dueLabel: "requested today", overdue: false });
    expect(waitingSince("2026-08-04", TODAY)?.dueLabel).toBe("waiting 1 day · since 4 Aug");
  });
});

describe("daysBetweenISO", () => {
  it("counts whole days across a month boundary", () => {
    expect(daysBetweenISO("2026-07-28", "2026-08-05")).toBe(8);
    expect(daysBetweenISO("2026-08-05", "2026-07-28")).toBe(-8);
  });
});
