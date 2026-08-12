import { describe, expect, it } from "vitest";
import { auditReviewProblems, calculateCoachQuality, type CoachQualityInput } from "@/lib/coach-quality";

const base = (patch: Partial<CoachQualityInput> = {}): CoachQualityInput => ({
  clientCount: 2,
  appointments: [], followups: [], goals: [], adherenceCurrent: [], adherencePrevious: [],
  barriers: [], referrals: [], safetyEvents: [], mdtTasks: [], baselines: [], assessments: [],
  sessions: [], huddles: [], huddleTaskIds: [], ...patch,
});

describe("Health Coach quality metrics", () => {
  it("calculates completion and response rates only from known outcomes", () => {
    const metrics = calculateCoachQuality(base({
      appointments: [{ status: "completed" }, { status: "scheduled" }, { status: "cancelled" }],
      followups: [{ status: "done", no_answer: false }, { status: "pending", no_answer: true }, { status: "pending", no_answer: false }],
    }));
    expect(metrics.scheduledCheckins).toEqual({ met: 1, total: 2, percent: 50 });
    expect(metrics.responseRate).toEqual({ met: 1, total: 2, percent: 50 });
  });

  it("compares current adherence with the prior period without counting excused events", () => {
    const metrics = calculateCoachQuality(base({
      adherenceCurrent: [{ outcome: "Completed" }, { outcome: "Missed" }, { outcome: "Excused" }],
      adherencePrevious: [{ outcome: "Completed" }, { outcome: "Completed" }],
    }));
    expect(metrics.adherence).toMatchObject({ percent: 50, previousPercent: 100, change: -50, total: 2 });
  });

  it("measures structured goal, barrier and MDT evidence", () => {
    const metrics = calculateCoachQuality(base({
      goals: [
        { name: "Walk", cadence: "daily", target_per_week: 5, status: "Completed", if_then_plan: "If dinner ends, then walk." },
        { name: "Water", cadence: "daily", target_per_week: 7, status: "Active", if_then_plan: null },
      ],
      barriers: [{ status: "Open" }, { status: "Addressed" }],
      huddles: [{ id: "h1" }, { id: "h2" }], huddleTaskIds: ["h1"],
    }));
    expect(metrics.goalCompletion.percent).toBe(50);
    expect(metrics.ifThenPlanning.percent).toBe(50);
    expect(metrics.barriersAddressed.percent).toBe(50);
    expect(metrics.mdtCoordination.percent).toBe(50);
  });

  it("reports safety acknowledgement coverage and elapsed minutes", () => {
    const metrics = calculateCoachQuality(base({ safetyEvents: [
      { opened_at: "2026-08-12T08:00:00Z", acknowledged_at: "2026-08-12T08:12:00Z" },
      { opened_at: "2026-08-12T09:00:00Z", acknowledged_at: null },
    ] }));
    expect(metrics.safetyAcknowledgement).toMatchObject({ met: 1, total: 2, percent: 50, averageMinutes: 12 });
  });

  it("never invents a percentage without a denominator", () => {
    expect(calculateCoachQuality(base()).referralCompletion.percent).toBeNull();
  });

  it("requires every human audit domain and a note for a failed review", () => {
    expect(auditReviewProblems({}, "Needs coaching", "")).toContain("Reviewer note");
  });
});
