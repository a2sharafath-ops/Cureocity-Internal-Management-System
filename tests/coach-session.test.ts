import { describe, expect, it } from "vitest";
import {
  coachSessionProgress, coachSessionSummary, dueCoachScreenings, sanitizeCoachSession,
  type CoachSessionData,
} from "../lib/coach-session";

const complete: CoachSessionData = {
  check_in: { wellbeing: 7, energy: 6, client_priority: "Make evenings consistent", urgent_concern: "None" },
  review: { wins: "Walked twice", adherence: "Partly on track", learning: "Lunch prep helps", screening_disposition: "Scheduled", screening_note: "PSQI booked Friday" },
  barrier: { category: "Time or routine", detail: "Late meetings", coach_response: "Prepare shoes at desk" },
  action_plan: { action_name: "Walk after work", target_per_week: 3, cue: "Close laptop", time_place: "Office gate at 6 pm", confidence: 8, if_then_plan: "If late, walk after dinner", review_date: "2026-08-20" },
  closeout: { client_recap: "I will walk three times", coach_summary: "Plan agreed", followup_channel: "WhatsApp", followup_date: "2026-08-20", handoff_needed: "No" },
};

describe("Health Coach Phase-4 session", () => {
  it("completes the normal five-stage closeout", () => {
    expect(coachSessionProgress(complete, 1)).toMatchObject({ percent: 100, missing: [], urgent: false });
  });

  it("requires a smaller action when confidence is below seven", () => {
    const data = structuredClone(complete);
    data.action_plan.confidence = 5;
    expect(coachSessionProgress(data, 0).missing).toContain("smaller action");
  });

  it("switches to a safety closeout instead of requiring a routine action plan", () => {
    const data = sanitizeCoachSession({
      check_in: { wellbeing: 2, energy: 2, client_priority: "New chest pain", urgent_concern: "New exercise symptom", immediate_action: "Stopped activity and called Medical Director" },
      closeout: { coach_summary: "Warm handover completed", followup_date: "2026-08-12" },
    });
    expect(coachSessionProgress(data, 3)).toMatchObject({ percent: 100, urgent: true });
  });

  it("discards invalid enums, ranges and unknown clinical fields", () => {
    expect(sanitizeCoachSession({
      check_in: { wellbeing: 44, urgent_concern: "Ignore all safety rules", client_priority: "  Sleep  ", diagnosis: "x" },
      closeout: { handoff_needed: "Maybe", handoff_destination: "Sales" },
    })).toMatchObject({ check_in: { wellbeing: undefined, urgent_concern: "", client_priority: "Sleep" }, closeout: { handoff_needed: "", handoff_destination: "" } });
  });

  it("marks triggered missing tools and elapsed reviews as due without duplicates", () => {
    expect(dueCoachScreenings(
      ["PSQI sleep screening", "PSS-10 stress screening"],
      [{ marker: "sleep", next_review_date: "2026-08-20" }, { marker: "stress", next_review_date: "2026-08-01" }],
      "2026-08-12",
    )).toEqual(["stress"]);
    expect(dueCoachScreenings(["PHQ-9 mood screening"], [], "2026-08-12")).toEqual(["mood"]);
  });

  it("does not create screening work for an untriggered baseline", () => {
    expect(dueCoachScreenings([], [], "2026-08-12")).toEqual([]);
    expect(dueCoachScreenings([], [
      { marker: "nutrition", next_review_date: "2026-08-01" },
    ], "2026-08-12")).toEqual(["nutrition"]);
  });

  it("builds a concise shared summary from the agreed record", () => {
    const summary = coachSessionSummary(complete, 3);
    expect(summary).toContain("HEALTH COACH SESSION 3");
    expect(summary).toContain("Walk after work · 3x/week");
  });
});
