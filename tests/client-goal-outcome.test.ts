import { describe, expect, it } from "vitest";
import { clientGoalOutcomeFromValues, clientGoalOutcomeSummary } from "@/lib/client-goal-outcome";

describe("client-reported goal outcomes", () => {
  it("accepts a 0–10 self-rating with optional context", () => {
    expect(clientGoalOutcomeFromValues({ rating: "7", note: "Evening walks now feel routine.", supportRequested: "on" })).toEqual({
      outcome: { rating: 7, note: "Evening walks now feel routine.", supportRequested: true },
      error: null,
    });
  });

  it("does not treat a missing rating as zero", () => {
    expect(clientGoalOutcomeFromValues({ rating: "", note: "", supportRequested: false }).error).toMatch(/0 to 10/);
  });

  it("rejects invented scales and oversized notes", () => {
    expect(clientGoalOutcomeFromValues({ rating: 11, note: "", supportRequested: false }).outcome).toBeNull();
    expect(clientGoalOutcomeFromValues({ rating: 4.5, note: "", supportRequested: false }).outcome).toBeNull();
    expect(clientGoalOutcomeFromValues({ rating: 5, note: "x".repeat(1001), supportRequested: false }).error).toMatch(/1,000/);
  });

  it("summarises client voice without assigning pass or fail", () => {
    expect(clientGoalOutcomeSummary([
      { achievement_rating: 4, support_requested: true },
      { achievement_rating: 7, support_requested: false },
      { achievement_rating: 8, support_requested: true },
    ])).toEqual({ total: 3, averageRating: 6.3, supportRequested: 2 });
    expect(clientGoalOutcomeSummary([])).toEqual({ total: 0, averageRating: null, supportRequested: 0 });
  });
});
