import { describe, expect, it } from "vitest";
import {
  coachProgrammeLifecycleSummary, coachProgrammeTransitionAllowed,
  coachProgrammeTransitionProblem,
} from "@/lib/coach-programme-lifecycle";

describe("Health Coach programme lifecycle", () => {
  it("allows governed exits and reactivation without skipping between exit states", () => {
    expect(coachProgrammeTransitionAllowed("Active", "Disengaged")).toBe(true);
    expect(coachProgrammeTransitionAllowed("Disengaged", "Active")).toBe(true);
    expect(coachProgrammeTransitionAllowed("Completed", "Disengaged")).toBe(false);
    expect(coachProgrammeTransitionAllowed("Active", "Active")).toBe(false);
  });

  it("requires a reason and follow-up plan for disengagement", () => {
    expect(coachProgrammeTransitionProblem({
      from: "Active", to: "Disengaged", reason: "Unable to reach after agreed contact attempts.",
      effectiveDate: "2026-08-13", nextContactDate: "2026-08-20",
      nextContactPlan: "Assigned coach will call once and offer a review slot.", today: "2026-08-13",
    })).toBeNull();
    expect(coachProgrammeTransitionProblem({
      from: "Active", to: "Disengaged", reason: "Too short", effectiveDate: "2026-08-13",
      nextContactDate: "", nextContactPlan: "", today: "2026-08-13",
    })).toMatch(/12 characters/);
  });

  it("requires an actionable next contact when reactivating", () => {
    expect(coachProgrammeTransitionProblem({
      from: "Disengaged", to: "Active", reason: "Client asked to restart coaching support.",
      effectiveDate: "2026-08-13", nextContactDate: "2026-08-13",
      nextContactPlan: "Review the current goals and agree the next smallest step.", today: "2026-08-13",
    })).toBeNull();
  });

  it("does not allow later entries to rewrite the effective timeline backwards", () => {
    expect(coachProgrammeTransitionProblem({
      from: "Paused", to: "Active", reason: "Client asked to restart coaching support.",
      effectiveDate: "2026-08-10", currentEffectiveDate: "2026-08-12",
      nextContactDate: "2026-08-13", nextContactPlan: "Review current goals with the client.",
      today: "2026-08-13",
    })).toMatch(/on or after 2026-08-12/);
  });

  it("summarises transitions as neutral counts", () => {
    expect(coachProgrammeLifecycleSummary([
      { from_status: "Active", to_status: "Paused" },
      { from_status: "Paused", to_status: "Disengaged" },
      { from_status: "Disengaged", to_status: "Active" },
      { from_status: "Active", to_status: "Completed" },
    ])).toEqual({ transitions: 4, disengaged: 1, reactivated: 1, paused: 1, completed: 1, transferred: 0 });
  });
});
