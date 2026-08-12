import { describe, expect, it } from "vitest";
import { COACH_AUDIT_DOMAINS } from "@/lib/coach-quality";
import {
  canApproveCoachQualityStandard, canProposeCoachQualityStandard,
  coachQualityProposalFromValues, governanceDecisionProblem,
} from "@/lib/coach-quality-governance";

const targets = Object.fromEntries(COACH_AUDIT_DOMAINS.map((domain) => [domain.key, 90]));

describe("Health Coach quality governance", () => {
  it("separates operational proposal from Medical Director approval", () => {
    expect(canProposeCoachQualityStandard("Administrator")).toBe(true);
    expect(canProposeCoachQualityStandard("Manager")).toBe(true);
    expect(canProposeCoachQualityStandard("Medical Director")).toBe(false);
    expect(canApproveCoachQualityStandard("Medical Director")).toBe(true);
    expect(canApproveCoachQualityStandard("Administrator")).toBe(false);
  });

  it("accepts a complete governed standard", () => {
    const result = coachQualityProposalFromValues({
      targets,
      reviewCadence: "Quarterly",
      sampleSize: 5,
      coachingTrigger: "Record coaching support when the agreed criteria apply.",
      clinicalReviewTrigger: "Escalate to clinical governance when the agreed criteria apply.",
      rationale: "Reviewed against the current operating model and evidence sources.",
    });
    expect(result.problems).toEqual([]);
    expect(result.proposal).toMatchObject({ reviewCadence: "Quarterly", sampleSize: 5, targets });
  });

  it("rejects missing or invented percentages and incomplete governance text", () => {
    const { assessment_completeness: _missing, ...incompleteTargets } = targets;
    const result = coachQualityProposalFromValues({
      targets: { ...incompleteTargets, safety: 101, goal_quality: 91.5 },
      reviewCadence: "Weekly",
      sampleSize: 0,
      coachingTrigger: "short",
      clinicalReviewTrigger: "",
      rationale: "guess",
    });
    expect(result.proposal).toBeNull();
    expect(result.problems).toContain("Assessment completeness target (0–100)");
    expect(result.problems).toContain("Safety target (0–100)");
    expect(result.problems).toContain("Goal quality target (0–100)");
    expect(result.problems).toContain("Review cadence");
  });

  it("requires an auditable approval or retirement reason", () => {
    expect(governanceDecisionProblem("too short")).toMatch(/12 characters/);
    expect(governanceDecisionProblem("Approved after MDT review.")).toBeNull();
  });
});
