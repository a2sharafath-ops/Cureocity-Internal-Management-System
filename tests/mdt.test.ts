import { describe, expect, it } from "vitest";
import { mdtHuddleProblems, mdtTaskUpdateProblems, type MdtHuddleInput } from "@/lib/mdt";

const valid = (patch: Partial<MdtHuddleInput> = {}): MdtHuddleInput => ({
  clientId: "c1",
  currentPlan: "Continue the agreed care-team plans.",
  progressStatus: "Amber",
  progressReason: "Two actions missed this week.",
  issueCategory: "Engagement",
  newIssue: "Client did not reply twice.",
  barrierCategory: "Time or routine",
  barrierDetail: "Late work shifts.",
  safetyStatus: "None",
  referralStatus: "Not required",
  ownerRole: "Health Coach",
  coachNextMove: "Call after the client's shift.",
  teamDecisionRequired: false,
  teamDecision: "",
  task: "Call and agree a smaller action.",
  dueDate: "2026-08-13",
  priority: "Priority",
  ...patch,
});

describe("structured MDT huddle", () => {
  it("accepts a complete huddle and owned action", () => {
    expect(mdtHuddleProblems(valid(), "2026-08-12")).toEqual([]);
  });

  it("requires details for a recorded issue and barrier", () => {
    const problems = mdtHuddleProblems(valid({ newIssue: "", barrierDetail: "" }), "2026-08-12");
    expect(problems).toContain("New issue detail");
    expect(problems).toContain("Barrier detail");
  });

  it("requires the actual decision when the team must decide", () => {
    expect(mdtHuddleProblems(valid({ teamDecisionRequired: true }), "2026-08-12"))
      .toContain("Team decision needed");
  });

  it("does not allow an already-overdue task at creation", () => {
    expect(mdtHuddleProblems(valid({ dueDate: "2026-08-11" }), "2026-08-12"))
      .toContain("Valid task due date");
  });

  it("requires an outcome when a task is completed or cancelled", () => {
    expect(mdtTaskUpdateProblems("Completed", "")).toEqual(["Decision or outcome"]);
    expect(mdtTaskUpdateProblems("In progress", "")).toEqual([]);
  });
});
