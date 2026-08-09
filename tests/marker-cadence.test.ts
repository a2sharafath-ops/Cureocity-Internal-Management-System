import { describe, it, expect } from "vitest";
import { MARKER_BY_KEY, markerOverdueDays } from "@/lib/coach-markers";
import { MARKER_BASELINE_GRACE_DAYS } from "@/lib/work-owners";

const stress = MARKER_BY_KEY.stress;
const TODAY = "2026-08-09";
const daysBefore = (n: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

/** What the coach's own screen now computes, mirroring the attention queue. */
const dueOnScreen = (opts: { lastDate?: string; sinceStart: number }) => {
  const last = opts.lastDate ? { marker: "stress" as const, date: opts.lastDate, tone: null, band: null } : undefined;
  const withinGrace = !last && opts.sinceStart < MARKER_BASELINE_GRACE_DAYS;
  if (withinGrace) return null;
  return markerOverdueDays(stress, last, TODAY, opts.sinceStart - MARKER_BASELINE_GRACE_DAYS);
};

describe("a brand-new client does not arrive covered in warnings", () => {
  it("says nothing on day one", () => {
    // The coach's screen flagged all six markers the moment a client existed,
    // while the attention queue said nothing for a week. Two screens, one
    // client, opposite answers on their first morning.
    expect(dueOnScreen({ sinceStart: 0 })).toBeNull();
  });

  it("stays quiet through the grace week", () => {
    for (let d = 0; d < MARKER_BASELINE_GRACE_DAYS; d++) {
      expect(dueOnScreen({ sinceStart: d }), `day ${d}`).toBeNull();
    }
  });

  it("is due, not yet overdue, on the day the grace runs out", () => {
    expect(dueOnScreen({ sinceStart: MARKER_BASELINE_GRACE_DAYS })).toBe(0);
  });

  it("goes overdue the day after, and keeps counting", () => {
    expect(dueOnScreen({ sinceStart: 8 })).toBe(1);
    expect(dueOnScreen({ sinceStart: 14 })).toBe(7);
  });
});

describe("re-assessment cadence once a baseline exists", () => {
  it("is not overdue inside the cadence, whatever the client's age", () => {
    expect(dueOnScreen({ lastDate: daysBefore(3), sinceStart: 0 })).toBeNull();
    expect(dueOnScreen({ lastDate: daysBefore(stress.reassessDays), sinceStart: 90 })).toBeNull();
  });

  it("counts the days past the cadence", () => {
    expect(dueOnScreen({ lastDate: daysBefore(stress.reassessDays + 3), sinceStart: 90 })).toBe(3);
  });

  it("ignores the grace once there IS a baseline — that grace is for the first one", () => {
    expect(dueOnScreen({ lastDate: daysBefore(stress.reassessDays + 1), sinceStart: 1 })).toBe(1);
  });
});
