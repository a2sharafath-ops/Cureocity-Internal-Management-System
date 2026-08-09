import { describe, it, expect } from "vitest";
import {
  JOURNEY_STAGES, MAX_WAIT_MS, nextStageKey, isWaitStage, assessmentOf,
  stageMeta, journeyKpis, isCoachNotified, fmtElapsed,
  stageForConsult, CONSULT_START_STAGE, CONSULT_DONE_STAGE, AUTO_WINDOW_DAYS,
  type JourneyRow, type JourneyEvent,
} from "@/lib/live-journey";

// A fixed "now" so the fixtures are deterministic.
const NOW = Date.parse("2026-08-09T10:00:00Z");
const ago = (sec: number) => new Date(NOW - sec * 1000).toISOString();
const enter = (journey_id: string, stage: string, sec: number): JourneyEvent => ({ journey_id, kind: "stage_enter", stage, at: ago(sec) });

describe("stage flow", () => {
  it("orders the SOP flow front_desk → … → done", () => {
    expect(JOURNEY_STAGES[0].key).toBe("front_desk");
    expect(JOURNEY_STAGES[JOURNEY_STAGES.length - 1].key).toBe("done");
    expect(JOURNEY_STAGES.map((s) => s.key)).toContain("review");
  });
  it("advances one stage and clamps at done", () => {
    expect(nextStageKey("front_desk")).toBe("await_coach");
    expect(nextStageKey("fitness")).toBe("transition_med");
    expect(nextStageKey("done")).toBe("done");
  });
  it("marks the three transition stages as waiting stages", () => {
    expect(isWaitStage("await_coach")).toBe(true);
    expect(isWaitStage("transition_med")).toBe(true);
    expect(isWaitStage("transition_diet")).toBe(true);
    expect(isWaitStage("fitness")).toBe(false);
    expect(isWaitStage("review")).toBe(false);
  });
  it("does not treat Front Desk as a wait stage", () => {
    // A new journey opens here on package purchase. If this ever became a wait
    // stage, the desk's own paperwork time would be measured against the SOP's
    // three-minute coach-present standard and report phantom breaches.
    expect(isWaitStage("front_desk")).toBe(false);
  });
  it("knows which assessment a professional stage runs", () => {
    expect(assessmentOf("fitness")).toBe("fitness");
    expect(assessmentOf("medical")).toBe("medical");
    expect(assessmentOf("await_coach")).toBeNull();
    expect(stageMeta("diet").owner).toBe("Dietitian");
  });
});

describe("journeyKpis", () => {
  it("counts active vs done", () => {
    const journeys: JourneyRow[] = [
      { id: "a", stage: "medical", status: "active", stage_entered_at: ago(60) },
      { id: "b", stage: "done", status: "done", stage_entered_at: ago(10) },
    ];
    const k = journeyKpis(journeys, [], NOW);
    expect(k.inJourney).toBe(1);
    expect(k.done).toBe(1);
  });

  it("averages only CLOSED waiting stages and flags on-time coach returns", () => {
    // Journey a: await_coach lasted 80s (on time), then briefing.
    const events: JourneyEvent[] = [
      enter("a", "front_desk", 400),
      enter("a", "await_coach", 300),   // closed by next at -220 → 80s
      enter("a", "briefing", 220),
    ];
    const k = journeyKpis(
      [{ id: "a", stage: "briefing", status: "active", stage_entered_at: ago(220) }],
      events, NOW,
    );
    expect(k.avgWaitMs).toBe(80_000);
    expect(k.coachPresentPct).toBe(100);
    expect(k.breaches).toBe(0);
  });

  it("counts a breach when a waiting stage runs over three minutes", () => {
    // await_coach opened 205s ago and is STILL open → over 3 min, unattended.
    const events: JourneyEvent[] = [
      enter("c", "front_desk", 260),
      enter("c", "await_coach", 205),   // no following event → open
    ];
    const k = journeyKpis(
      [{ id: "c", stage: "await_coach", status: "active", stage_entered_at: ago(205) }],
      events, NOW,
    );
    expect(k.breaches).toBe(1);
    // open stage is not a CLOSED wait, so it doesn't move the average or %
    expect(k.avgWaitMs).toBe(0);
    expect(k.coachPresentPct).toBe(100);
    expect(205 * 1000).toBeGreaterThan(MAX_WAIT_MS);
  });

  it("a closed but late transition lowers coach-present %", () => {
    const events: JourneyEvent[] = [
      enter("d", "fitness", 500),
      enter("d", "transition_med", 400), // 240s later → 4:00, a breach + late
      enter("d", "medical", 160),
    ];
    const k = journeyKpis(
      [{ id: "d", stage: "medical", status: "active", stage_entered_at: ago(160) }],
      events, NOW,
    );
    expect(k.breaches).toBe(1);
    expect(k.coachPresentPct).toBe(0);
    expect(k.avgWaitMs).toBe(240_000);
  });
});

describe("isCoachNotified", () => {
  const row: JourneyRow = { id: "a", stage: "medical", status: "active", stage_entered_at: ago(100) };
  it("is true only for a ping on the current stage after it was entered", () => {
    const events: JourneyEvent[] = [
      { journey_id: "a", kind: "notify_coach", stage: "medical", at: ago(20) },
    ];
    expect(isCoachNotified(row, events)).toBe(true);
  });
  it("ignores pings for a previous stage or before entry", () => {
    const events: JourneyEvent[] = [
      { journey_id: "a", kind: "notify_coach", stage: "fitness", at: ago(20) },
      { journey_id: "a", kind: "notify_coach", stage: "medical", at: ago(200) }, // before entry
    ];
    expect(isCoachNotified(row, events)).toBe(false);
  });
});

describe("fmtElapsed", () => {
  it("formats mm:ss and floors negatives at zero", () => {
    expect(fmtElapsed(0)).toBe("0:00");
    expect(fmtElapsed(65_000)).toBe("1:05");
    expect(fmtElapsed(-5_000)).toBe("0:00");
  });
});

// ---- consultation → stage mapping ------------------------------------------
// The board is driven by consultations the team already logs, so this mapping
// is the whole contract: get it wrong and the board silently misreports.

describe("stageForConsult", () => {
  it("puts the client in the assessment while the consult runs", () => {
    expect(stageForConsult("Trainer", "start")).toBe("fitness");
    expect(stageForConsult("Doctor", "start")).toBe("medical");
    expect(stageForConsult("Diet", "start")).toBe("diet");
    expect(stageForConsult("Coach", "start")).toBe("briefing");
  });

  it("hands back to the coach when the consult ends", () => {
    expect(stageForConsult("Trainer", "complete")).toBe("transition_med");
    expect(stageForConsult("Doctor", "complete")).toBe("transition_diet");
    expect(stageForConsult("Diet", "complete")).toBe("review");
  });

  it("ends the journey when the coach's own consult completes", () => {
    expect(stageForConsult("Coach", "complete")).toBe("done");
  });

  it("leaves the board untouched for kinds outside the three assessments", () => {
    // Psychologist is not a core assessment — it must never move the journey.
    expect(stageForConsult("Psychologist", "start")).toBeNull();
    expect(stageForConsult("Psychologist", "complete")).toBeNull();
    expect(stageForConsult("", "start")).toBeNull();
    expect(stageForConsult("Nutritionist", "complete")).toBeNull();
  });

  it("only ever names real stages", () => {
    const keys = new Set(JOURNEY_STAGES.map((s) => s.key));
    for (const stage of Object.values(CONSULT_START_STAGE)) expect(keys.has(stage)).toBe(true);
    for (const stage of Object.values(CONSULT_DONE_STAGE)) expect(keys.has(stage)).toBe(true);
  });

  it("maps every kind forward — a consult never sends the journey backwards", () => {
    const order = JOURNEY_STAGES.map((s) => s.key);
    for (const kind of Object.keys(CONSULT_START_STAGE)) {
      const from = CONSULT_START_STAGE[kind];
      const to = CONSULT_DONE_STAGE[kind];
      expect(order.indexOf(to)).toBeGreaterThan(order.indexOf(from));
    }
  });

  it("covers the same kinds on both start and completion", () => {
    expect(Object.keys(CONSULT_START_STAGE).sort()).toEqual(Object.keys(CONSULT_DONE_STAGE).sort());
  });

  it("keeps the auto-tracking window generous but bounded", () => {
    // Long enough for an assessment split across visits, short enough that a
    // follow-up months later can't reopen a stale journey.
    expect(AUTO_WINDOW_DAYS).toBeGreaterThan(1);
    expect(AUTO_WINDOW_DAYS).toBeLessThanOrEqual(30);
  });
});
