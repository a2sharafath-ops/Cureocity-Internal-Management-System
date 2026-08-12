import { describe, expect, it } from "vitest";
import { adherenceSummary, confidenceNeedsSmallerGoal, reviewIsDue } from "../lib/coach-goals";

describe("health-coach goal helpers", () => {
  it("calculates adherence only from reviewed completed and missed events", () => {
    expect(adherenceSummary([
      { outcome: "Completed" }, { outcome: "Completed" },
      { outcome: "Missed" }, { outcome: "Excused" },
    ])).toEqual({ completed: 2, missed: 1, excused: 1, reviewed: 3, percent: 67 });
  });

  it("does not invent a percentage without reviewed events", () => {
    expect(adherenceSummary([{ outcome: "Excused" }]).percent).toBeNull();
  });

  it("prompts a smaller goal below confidence seven", () => {
    expect(confidenceNeedsSmallerGoal(6)).toBe(true);
    expect(confidenceNeedsSmallerGoal(7)).toBe(false);
  });

  it("marks today and earlier review dates due", () => {
    expect(reviewIsDue("2026-08-12", "2026-08-12")).toBe(true);
    expect(reviewIsDue("2026-08-13", "2026-08-12")).toBe(false);
  });
});
