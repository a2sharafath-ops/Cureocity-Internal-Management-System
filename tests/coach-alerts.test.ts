import { describe, expect, it } from "vitest";
import { buildCoachAlerts, type CoachAlertInput } from "@/lib/coach-alerts";

const base = (patch: Partial<CoachAlertInput> = {}): CoachAlertInput => ({
  today: "2026-08-12",
  clients: [{ id: "c1", name: "Asha" }],
  assessments: [],
  safetyEvents: [],
  referrals: [],
  adherenceEvents: [],
  goals: [],
  lifecycles: [],
  ...patch,
});

describe("Health Coach phase-5 rules", () => {
  it("puts an unresolved safety event first as red", () => {
    const alerts = buildCoachAlerts(base({ safetyEvents: [{
      id: "s1", client_id: "c1", status: "Open", trigger_type: "Positive self-harm response",
      concern_summary: "Item 9 response recorded", opened_at: "2026-08-12T08:00:00Z",
    }] }));
    expect(alerts[0]).toMatchObject({ level: "red", clientId: "c1", actionLabel: "Open safety record" });
  });

  it("creates a human-confirmed referral prompt for a referral-band result", () => {
    const alerts = buildCoachAlerts(base({ assessments: [{
      client_id: "c1", marker: "anxiety", date: "2026-08-12", tone: "bad", band: "Moderate",
      next_review_date: "2026-08-26", recommended_action: "Open psychology pathway.",
    }] }));
    expect(alerts[0]).toMatchObject({ level: "amber", actionLabel: "Prepare Psychologist referral" });
    expect(alerts[0].href).toContain("referral=Psychologist");
  });

  it("does not duplicate a referral prompt when the matching referral is open", () => {
    const alerts = buildCoachAlerts(base({
      assessments: [{ client_id: "c1", marker: "anxiety", date: "2026-08-12", tone: "bad", band: "Moderate", next_review_date: null, recommended_action: null }],
      referrals: [{ id: "r1", client_id: "c1", destination_role: "Psychologist", urgency: "Priority", status: "Sent", reason: "GAD-7 result", created_at: "2026-08-12T08:00:00Z", updated_at: "2026-08-12T08:00:00Z" }],
    }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ level: "blue", key: "referral:r1" });
  });

  it("flags only the newest screening result and its due date", () => {
    const alerts = buildCoachAlerts(base({ assessments: [
      { client_id: "c1", marker: "sleep", date: "2026-07-01", tone: "bad", band: "Refer", next_review_date: "2026-07-15", recommended_action: null },
      { client_id: "c1", marker: "sleep", date: "2026-07-29", tone: "good", band: "Good", next_review_date: "2026-08-12", recommended_action: null },
    ] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ key: "screen-due:c1:sleep", level: "amber" });
  });

  it("turns two consecutive objective misses into an amber barrier review", () => {
    const alerts = buildCoachAlerts(base({ adherenceEvents: [
      { client_id: "c1", event_date: "2026-08-11", outcome: "Missed", category: "Coaching goal" },
      { client_id: "c1", event_date: "2026-08-08", outcome: "Missed", category: "Coach check-in" },
      { client_id: "c1", event_date: "2026-08-01", outcome: "Completed", category: "Coaching goal" },
    ] }));
    expect(alerts[0]).toMatchObject({ level: "amber", key: "adherence:c1" });
  });

  it("shows recent completed goals and referrals as green reinforcement", () => {
    const alerts = buildCoachAlerts(base({
      goals: [{ client_id: "c1", name: "Walk after dinner", status: "Completed", updated_at: "2026-08-10T08:00:00Z" }],
      referrals: [{ id: "r1", client_id: "c1", destination_role: "Dietitian", urgency: "Routine", status: "Completed", reason: "Meal-plan review", created_at: "2026-08-01T08:00:00Z", updated_at: "2026-08-11T08:00:00Z" }],
    }));
    expect(alerts.map((alert) => alert.level)).toEqual(["green", "green"]);
  });

  it("surfaces a due lifecycle contact to the assigned Coach", () => {
    const alerts = buildCoachAlerts(base({ lifecycles: [{
      client_id: "c1", status: "Disengaged", next_contact_date: "2026-08-12",
      next_contact_plan: "Call once and offer a no-pressure review slot.",
    }] }));
    expect(alerts[0]).toMatchObject({ key: "programme-contact:c1", level: "amber", actionLabel: "Open lifecycle" });
  });

  it("surfaces an upcoming lifecycle contact seven days ahead without treating it as due", () => {
    const alerts = buildCoachAlerts(base({ lifecycles: [{
      client_id: "c1", status: "Active", next_contact_date: "2026-08-19",
      next_contact_plan: "Review the agreed walking goal and adherence record.",
    }] }));
    expect(alerts[0]).toMatchObject({ key: "programme-contact:c1", level: "blue", actionLabel: "Plan follow-up" });
    expect(alerts[0].title).toMatch(/coming up/);
  });

  it("does not surface a lifecycle contact more than seven days ahead", () => {
    expect(buildCoachAlerts(base({ lifecycles: [{
      client_id: "c1", status: "Active", next_contact_date: "2026-08-20",
      next_contact_plan: "Review the agreed walking goal and adherence record.",
    }] }))).toHaveLength(0);
  });
});
