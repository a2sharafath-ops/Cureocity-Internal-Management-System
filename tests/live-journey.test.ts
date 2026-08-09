import { describe, it, expect } from "vitest";
import {
  JOURNEY_STAGES, MAX_WAIT_MS, nextStageKey, isWaitStage, assessmentOf,
  stageMeta, journeyKpis, isCoachNotified, fmtElapsed,
  stageForConsult, CONSULT_START_STAGE, CONSULT_DONE_STAGE, AUTO_WINDOW_DAYS,
  journeyGroup,
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
    expect(stageForConsult("Coach", "start", "await_coach")).toBe("briefing");
  });

  it("hands back to the coach when the consult ends", () => {
    expect(stageForConsult("Trainer", "complete")).toBe("transition_med");
    expect(stageForConsult("Doctor", "complete")).toBe("transition_diet");
    expect(stageForConsult("Diet", "complete")).toBe("review");
  });

  describe("the coach appears twice, so their stage is read from where the client is", () => {
    // The bug this replaced: Coach was mapped to "briefing" on start and "done"
    // on completion, so finishing the OPENING briefing closed the journey while
    // the client was still waiting for fitness, medical and diet — and because
    // the row was no longer active, nothing could move it again.
    it("treats a coach consult before the assessments as the briefing", () => {
      expect(stageForConsult("Coach", "start", "front_desk")).toBe("briefing");
      expect(stageForConsult("Coach", "start", "await_coach")).toBe("briefing");
      expect(stageForConsult("Coach", "start", "briefing")).toBe("briefing");
    });

    it("sends the client on to fitness when the briefing ends — not home", () => {
      expect(stageForConsult("Coach", "complete", "briefing")).toBe("fitness");
      expect(stageForConsult("Coach", "complete", "await_coach")).toBe("fitness");
    });

    it("treats a coach consult after the diet assessment as the closing review", () => {
      expect(stageForConsult("Coach", "start", "review")).toBe("review");
      expect(stageForConsult("Coach", "complete", "review")).toBe("done");
    });

    it("moves nothing when the coach opens a consult mid-flow", () => {
      // Walking a client between rooms is not an assessment, and guessing would
      // send the board backwards past work already done.
      for (const at of ["fitness", "transition_med", "medical", "transition_diet", "diet"]) {
        expect(stageForConsult("Coach", "start", at), at).toBeNull();
        expect(stageForConsult("Coach", "complete", at), at).toBeNull();
      }
    });

    it("never closes the journey from the opening briefing, at any stage", () => {
      for (const s of JOURNEY_STAGES.map((x) => x.key)) {
        const started = stageForConsult("Coach", "start", s);
        if (started === "briefing") expect(stageForConsult("Coach", "complete", s)).not.toBe("done");
      }
    });
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
    for (const kind of Object.keys(CONSULT_DONE_STAGE)) {
      const from = CONSULT_START_STAGE[kind];
      const to = CONSULT_DONE_STAGE[kind];
      expect(order.indexOf(to)).toBeGreaterThan(order.indexOf(from));
    }
  });

  it("covers the same kinds on both start and completion, bar the coach", () => {
    // Coach is deliberately absent from the DONE map — it is resolved from the
    // journey's current stage instead, because the kind alone cannot say which
    // of the coach's two visits this is.
    const start = Object.keys(CONSULT_START_STAGE).filter((k) => k !== "Coach").sort();
    expect(start).toEqual(Object.keys(CONSULT_DONE_STAGE).sort());
  });

  it("keeps the auto-tracking window generous but bounded", () => {
    // Long enough for an assessment split across visits, short enough that a
    // follow-up months later can't reopen a stale journey.
    expect(AUTO_WINDOW_DAYS).toBeGreaterThan(1);
    expect(AUTO_WINDOW_DAYS).toBeLessThanOrEqual(30);
  });
});

// ---- who is actually in the building ---------------------------------------
// A journey opens the day the package is sold, but a Comprehensive client
// usually arrives days later. These rules keep the sold-but-not-arrived and the
// went-home-mid-visit out of the live numbers.

describe("journeyGroup", () => {
  const at = (iso: string) => Date.parse(iso);
  const NOON = at("2026-08-09T12:00:00Z");
  const todayAt = (t: string) => `2026-08-09T${t}:00Z`;
  const yesterday = "2026-08-08T10:00:00Z";
  const lastWeek = "2026-08-02T10:00:00Z";

  it("counts someone mid-flow today as in the building", () => {
    expect(journeyGroup({ stage: "fitness", status: "active", stage_entered_at: todayAt("11:30") }, false, NOON)).toBe("here");
  });

  it("counts a client still at the desk with a booking today as in the building", () => {
    expect(journeyGroup({ stage: "front_desk", status: "active", stage_entered_at: lastWeek }, true, NOON)).toBe("here");
  });

  it("treats a package sold days ago with no booking today as expected, not here", () => {
    // The Comprehensive case: bought last week, Front Desk still to book them in.
    expect(journeyGroup({ stage: "front_desk", status: "active", stage_entered_at: lastWeek }, false, NOON)).toBe("expected");
  });

  it("counts a package sold today as in the building — they may be at the desk now", () => {
    expect(journeyGroup({ stage: "front_desk", status: "active", stage_entered_at: todayAt("09:15") }, false, NOON)).toBe("here");
  });

  it("treats a client who went home mid-visit as lapsed", () => {
    expect(journeyGroup({ stage: "diet", status: "active", stage_entered_at: yesterday }, false, NOON)).toBe("lapsed");
  });

  it("keeps a finished journey with the day it finished on", () => {
    expect(journeyGroup({ stage: "done", status: "done", stage_entered_at: todayAt("10:00") }, false, NOON)).toBe("here");
    expect(journeyGroup({ stage: "done", status: "done", stage_entered_at: yesterday }, false, NOON)).toBe("lapsed");
  });

  it("still reads lapsed mid-flow even with a booking today, until someone moves them", () => {
    // Deliberate: a mid-flow row is judged on movement, not on the diary. If a
    // client who stalled yesterday comes back, the first consultation started
    // today moves them and they return to the floor on their own. Until then a
    // stale timer must not be counted against the three-minute standard.
    expect(journeyGroup({ stage: "medical", status: "active", stage_entered_at: yesterday }, true, NOON)).toBe("lapsed");
  });
});

describe("Completed today counts only today", () => {
  const NOON = Date.parse("2026-08-09T12:00:00Z");
  it("ignores journeys finished on an earlier day", () => {
    const rows: JourneyRow[] = [
      { id: "a", stage: "done", status: "done", stage_entered_at: "2026-08-09T10:00:00Z" },
      { id: "b", stage: "done", status: "done", stage_entered_at: "2026-08-08T10:00:00Z" },
      { id: "c", stage: "done", status: "done", stage_entered_at: "2026-07-01T10:00:00Z" },
    ];
    expect(journeyKpis(rows, [], NOON).done).toBe(1);
  });
});
