import { describe, expect, it } from "vitest";
import { coachClientWriteDecision } from "@/lib/coach-access";

describe("Health Coach assigned-client write policy", () => {
  it("allows the formally assigned Health Coach", () => {
    expect(coachClientWriteDecision({
      role: "Health Coach", staffId: "coach-1", assignedCoachStaffId: "coach-1",
    })).toEqual({ allowed: true, mode: "assigned-coach", overrideReason: null });
  });

  it("rejects another, unlinked, or unassigned Health Coach", () => {
    expect(coachClientWriteDecision({
      role: "Health Coach", staffId: "coach-2", assignedCoachStaffId: "coach-1",
    }).allowed).toBe(false);
    expect(coachClientWriteDecision({
      role: "Health Coach", staffId: null, assignedCoachStaffId: "coach-1",
    }).allowed).toBe(false);
    expect(coachClientWriteDecision({
      role: "Health Coach", staffId: "coach-1", assignedCoachStaffId: null,
    }).allowed).toBe(false);
  });

  it("requires and preserves a meaningful supervisor override reason", () => {
    expect(coachClientWriteDecision({
      role: "Manager", staffId: null, assignedCoachStaffId: "coach-1", overrideReason: "too short",
    }).allowed).toBe(false);
    expect(coachClientWriteDecision({
      role: "Medical Director", staffId: "md-1", assignedCoachStaffId: "coach-1",
      overrideReason: "  Assigned coach is on emergency leave.  ",
    })).toEqual({
      allowed: true,
      mode: "supervisor-override",
      overrideReason: "Assigned coach is on emergency leave.",
    });
  });

  it("does not turn another clinician into a Health Coach writer", () => {
    expect(coachClientWriteDecision({
      role: "Doctor", staffId: "doctor-1", assignedCoachStaffId: "coach-1",
      overrideReason: "I want to edit this coaching plan.",
    }).allowed).toBe(false);
  });
});
