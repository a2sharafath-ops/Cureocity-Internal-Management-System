import { describe, expect, it } from "vitest";
import {
  acceptedCoachCopilotText, coachCopilotHasSafetyStop, coachCopilotRequestProblem, coachCopilotSafetyProblem,
  parseCoachCopilotOutput,
} from "@/lib/coach-copilot";

describe("Health Coach Copilot guardrails", () => {
  it("accepts only the SOP task list and requires a client", () => {
    expect(coachCopilotRequestProblem("behaviour_summary", "client-1", "")).toBeNull();
    expect(coachCopilotRequestProblem("interpret_labs", "client-1", "")).toMatch(/available/i);
    expect(coachCopilotRequestProblem("behaviour_summary", "", "")).toMatch(/client/i);
  });

  it("parses a bounded structured draft", () => {
    const result = parseCoachCopilotOutput(JSON.stringify({
      title: "A small next step",
      draft: "If dinner ends, then I will walk for ten minutes.",
      evidence: ["The client identified evenings as workable."],
      caution: null,
      ignored: "not retained",
    }));
    expect(result).toEqual({
      title: "A small next step",
      draft: "If dinner ends, then I will walk for ten minutes.",
      evidence: ["The client identified evenings as workable."],
      caution: null,
    });
  });

  it("rejects malformed or incomplete model output", () => {
    expect(parseCoachCopilotOutput("not json")).toHaveProperty("error");
    expect(parseCoachCopilotOutput(JSON.stringify({ title: "No draft" }))).toHaveProperty("error");
  });

  it("blocks medication, lab, prescription, therapy and safety-closure language", () => {
    const blocked = [
      "Decrease the medication dose.",
      "The blood test is abnormal.",
      "Use a 1,200 calorie meal plan.",
      "Increase the exercise programme weights.",
      "Begin trauma processing.",
      "Close the safety alert.",
    ];
    for (const draft of blocked) {
      expect(coachCopilotSafetyProblem({ title: "Draft", draft, evidence: [], caution: null })).toMatch(/blocked/i);
    }
  });

  it("allows behavioural coaching and warm-referral wording", () => {
    expect(coachCopilotSafetyProblem({
      title: "Warm referral",
      draft: "Would it be okay if I connect you with our Dietitian to discuss the difficulty following the current plan?",
      evidence: ["The client reported a food-environment barrier."],
      caution: "Confirm consent before creating the referral.",
    })).toBeNull();
  });

  it("pauses Copilot whenever a safety item remains open", () => {
    expect(coachCopilotHasSafetyStop([{ status: "Open" }, { status: "Resolved" }])).toBe(true);
    expect(coachCopilotHasSafetyStop([{ status: "Acknowledged" }])).toBe(true);
    expect(coachCopilotHasSafetyStop([{ status: "Resolved" }])).toBe(false);
  });

  it("bounds accepted working text", () => {
    expect(acceptedCoachCopilotText("  Coach-approved wording  ")).toBe("Coach-approved wording");
    expect(acceptedCoachCopilotText("x".repeat(7000))).toHaveLength(6000);
  });
});
