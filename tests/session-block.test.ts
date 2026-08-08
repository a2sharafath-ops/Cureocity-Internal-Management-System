import { describe, it, expect } from "vitest";
import { comprehensiveSla } from "@/lib/comprehensive-sla";

// A client who completed all 12 strength sessions by day 20 was still shown a
// permanent "missed" badge on their protocol board from day 29 onward. The
// block recorded `now` as its completion time rather than the date of the 12th
// session, so once the deadline passed, an on-time client became a late one.

const base = {
  startDate: "2026-06-01",
  validityDays: 28,
  consults: [],
  dietDraftedAt: null,
  workoutPlannedAt: null,
  prescriptionSharedAt: null,
  appointments: [],
  hold: { holdSince: null, holdMs: 0 },
};

const dates = (n: number, from = "2026-06-02") =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

const block = (r: ReturnType<typeof comprehensiveSla>) =>
  r.milestones.find((m) => m.gate.startsWith("pt_block"))!;

describe("strength-session block", () => {
  it("is not late when the 12th session happened before the deadline", () => {
    // 12 sessions finishing 13 June; deadline is day 28 (29 June). We look on
    // 15 July — long after the deadline, which is when the bug appeared.
    const r = comprehensiveSla(
      { ...base, sessionsCompleted: 12, sessionDates: dates(12) },
      Date.parse("2026-07-15T00:00:00Z"),
    );
    expect(block(r).clock.missed).toBe(false);
  });

  it("IS late when the 12th session happened after the deadline", () => {
    const r = comprehensiveSla(
      { ...base, sessionsCompleted: 12, sessionDates: dates(12, "2026-07-01") },
      Date.parse("2026-07-20T00:00:00Z"),
    );
    expect(block(r).clock.missed).toBe(true);
  });

  it("is still open when the block is unfinished", () => {
    // 7 of 12 done, deadline still ahead — neither met nor missed yet.
    const r = comprehensiveSla(
      { ...base, sessionsCompleted: 7, sessionDates: dates(7) },
      Date.parse("2026-06-20T00:00:00Z"),
    );
    expect(block(r).clock.status).not.toBe("met");
    expect(block(r).clock.missed).toBe(false);
  });

  it("falls back to the count alone when no dates are supplied", () => {
    // Older callers pass only a count; they must keep working rather than
    // crashing or reporting every block unfinished.
    const r = comprehensiveSla(
      { ...base, sessionsCompleted: 12 },
      Date.parse("2026-06-20T00:00:00Z"),
    );
    expect(block(r).clock.status).toBe("met");
  });
});
